/*!
 * Distil — hearing clinic patient management & intake system
 *
 * Copyright (c) 2026 Kurt Mooney. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL. This source code is the exclusive property of
 * the copyright holder. Unauthorized copying, distribution, modification, or
 * use of this file, in whole or in part, via any medium, is strictly
 * prohibited without the prior written permission of the copyright holder.
 * See the LICENSE file at the repository root for full terms.
 */

// Descriptor engine (Phase 2b).
//
// Turns a raw audiogram + speech scores into the categorical loss description
// that the Evaluation Results Review screen reads. Pure functions over
// threshold maps of the shape { 250: dB, 500: dB, ... } per ear, mirroring
// audiogramAnalysis.js. No DB access, no side effects.
//
// FIVE AXES. The first four compose the clinical sentence; the fifth is what
// the standard sentence cannot carry.
//   1. Degree        — audibility, expressed as a SPAN across two ladder points
//   2. Configuration — the shape of the loss (deliberately coarse)
//   3. Type          — sensorineural / conductive / mixed, from the AC–BC gap
//   4. Symmetry      — two rules, different thresholds (narrative vs referral)
//   5. Clarity       — WRS + QuickSIN, NEVER collapsed into degree
//
// OUTPUT SHAPE. Every axis emits a PAIR: a `clinical` string (jargon-first,
// provider-facing) and a `plain` string (patient-facing). The patient-facing
// phrasing is sourced from Kurt's narration corpus, which does not exist yet —
// so `plain` is deliberately NULL here and `plainPending` is true. Do not
// invent patient phrasing; wire the corpus into fillPlainLanguage() when it
// lands. `plainDimension` records the axis→plain mapping the brief specifies
// (degree=volume, configuration=which sounds went missing, clarity=hearing vs
// understanding) so the corpus has a stable key to attach to.
//
// DEGRADED STATES ARE FIRST-CLASS. A missing measurement never silently becomes
// a default. Each axis returns an explicit `status` ('ok' | 'undetermined' |
// 'atypical' | 'absent') with a `reason`, so the screen can render an honest
// "not measured" instead of a fabricated value.

import { AUDIG_FREQS } from './audiogramAnalysis.js';

// ---------------------------------------------------------------------------
// Severity ladder — the 9-value scale used in practice (migration
// severity_ladder_kurt_scale). This is NOT the 6-value campaign-gating scale in
// audiogramAnalysis.js (SEVERITY_ORDER); that one serves content matching and
// is intentionally coarser. Keep them separate.
// ---------------------------------------------------------------------------
export const SEVERITY_LADDER = [
  'normal', 'normal_mild', 'mild', 'mild_moderate', 'moderate',
  'moderate_severe', 'severe', 'severe_profound', 'profound',
];

// dB HL upper bound (inclusive) for each ladder step. Normal tops out at 20 dB
// per MHC clinical rule (not 25). The half-steps (normal_mild, mild_moderate,
// severe_profound) are ~5 dB transition bands straddling the classic
// boundaries — the ladder is deliberately permissive at the endpoints. These
// cutoffs are the initial mapping; they live here, in one table, so they are
// transparent and tunable rather than scattered through the logic.
export const SEVERITY_BANDS = [
  { label: 'normal', max: 20 },
  { label: 'normal_mild', max: 25 },
  { label: 'mild', max: 40 },
  { label: 'mild_moderate', max: 45 },
  { label: 'moderate', max: 55 },
  { label: 'moderate_severe', max: 70 },
  { label: 'severe', max: 85 },
  { label: 'severe_profound', max: 90 },
  { label: 'profound', max: Infinity },
];

// Human-readable clinical label for a ladder step used on its own.
const SEVERITY_TERM = {
  normal: 'normal',
  normal_mild: 'borderline normal-to-mild',
  mild: 'mild',
  mild_moderate: 'mild-to-moderate',
  moderate: 'moderate',
  moderate_severe: 'moderately severe',
  severe: 'severe',
  severe_profound: 'severe-to-profound',
  profound: 'profound',
};

// Base word for a ladder step when it is one END of a span ("mild sloping to
// profound"). The half-steps collapse to their nearer classic term so a range
// never reads as "mild-to-moderate sloping to severe-to-profound".
const SEVERITY_ENDPOINT = {
  normal: 'normal',
  normal_mild: 'near-normal',
  mild: 'mild',
  mild_moderate: 'mild',
  moderate: 'moderate',
  moderate_severe: 'moderately severe',
  severe: 'severe',
  severe_profound: 'severe',
  profound: 'profound',
};

export function severityRank(label) {
  return SEVERITY_LADDER.indexOf(label);
}

// Map a single dB HL threshold onto the ladder. Returns null for null input.
export function dbToSeverity(db) {
  if (db == null || Number.isNaN(db)) return null;
  for (const band of SEVERITY_BANDS) {
    if (db <= band.max) return band.label;
  }
  return 'profound';
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const LOW_FREQS = [250, 500, 1000];
const HIGH_FREQS = [2000, 4000, 6000, 8000];

function presentFreqs(t) {
  if (!t) return [];
  return AUDIG_FREQS.filter(f => t[f] != null);
}

function avgAt(t, freqs) {
  if (!t) return null;
  const vals = freqs.map(f => t[f]).filter(v => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Canonical 3-frequency PTA (500/1000/2000) — correlates with SRT. Inter-octave
// frequencies never enter a PTA.
export function pta3(t) {
  const v = avgAt(t, [500, 1000, 2000]);
  return v == null ? null : Math.round(v);
}

// Count significant direction reversals across the ordered thresholds, using a
// 20 dB hysteresis so audiometric noise does not read as a shape. A monotonic
// loss (flat, sloping, rising) has 0; a single-peak or single-dip shape
// (cookie-bite, notch) has 1; a jagged audiogram has 2+. The classifier uses
// this to send irregular shapes to 'atypical' instead of forcing a named shape.
export function significantReversals(t) {
  const freqs = presentFreqs(t).sort((a, b) => a - b);
  const vals = freqs.map(f => t[f]);
  if (vals.length < 3) return 0;
  const H = 20;

  // Reduce the sequence to significant turning points (pivots). A move counts
  // only once it clears H from the last confirmed pivot; a same-direction move
  // extends the current run. Reversals = interior pivots = pivots - 2.
  const pivots = [vals[0]];
  for (let i = 1; i < vals.length; i++) {
    const v = vals[i];
    const last = pivots[pivots.length - 1];
    if (pivots.length < 2) {
      if (Math.abs(v - last) >= H) pivots.push(v);   // establish first run
    } else {
      const prevDir = Math.sign(last - pivots[pivots.length - 2]);
      const curDir = Math.sign(v - last);
      if (curDir === prevDir) pivots[pivots.length - 1] = v;   // extend run
      else if (Math.abs(v - last) >= H) pivots.push(v);        // significant turn
      // else: sub-threshold counter-move, ignore
    }
  }
  return Math.max(0, pivots.length - 2);
}

// ---------------------------------------------------------------------------
// Axis 1 — DEGREE (per ear). A span across two ladder endpoints, not a value.
// The distance between endpoints is a slope signal the configuration axis reads.
// ---------------------------------------------------------------------------
export function degreeAxis(t) {
  const freqs = presentFreqs(t);
  if (freqs.length < 2) {
    return { status: 'absent', reason: 'insufficient_thresholds',
      mildest: null, worst: null, direction: null,
      clinical: null, plain: null, plainPending: true, plainDimension: 'volume' };
  }

  // Endpoints come from three REGIONAL anchors (low / mid / high averages), not
  // per-frequency thresholds. A single-frequency dip should not manufacture a
  // span — a clinician reads the span off the regions ("mild in the lows
  // sloping to severe in the highs"), and mid anchors keep cookie-bites honest.
  const anchors = [
    avgAt(t, [250, 500, 1000]),
    avgAt(t, [2000, 3000]),
    avgAt(t, [4000, 6000, 8000]),
  ].filter(v => v != null);
  const ranks = anchors.map(v => severityRank(dbToSeverity(Math.round(v))));
  const mildestRank = Math.min(...ranks);
  const worstRank = Math.max(...ranks);
  const mildest = SEVERITY_LADDER[mildestRank];
  const worst = SEVERITY_LADDER[worstRank];

  // Slope direction from low-frequency vs high-frequency averages.
  const lowAvg = avgAt(t, LOW_FREQS);
  const highAvg = avgAt(t, HIGH_FREQS);
  let direction = null;
  if (lowAvg != null && highAvg != null) {
    const delta = highAvg - lowAvg;
    if (delta > 15) direction = 'sloping';
    else if (delta < -15) direction = 'rising';
    else direction = 'flat';
  }

  let clinical;
  if (mildestRank === worstRank) {
    clinical = `${SEVERITY_TERM[worst]} degree`;
  } else {
    const a = SEVERITY_ENDPOINT[mildest];
    const b = SEVERITY_ENDPOINT[worst];
    const slopeWord = direction === 'sloping' ? ' sloping'
      : direction === 'rising' ? ' rising' : '';
    clinical = `${a}${slopeWord} to ${b} degree`;
  }

  return {
    status: 'ok',
    mildest, worst, direction,
    span: [mildest, worst],
    clinical, plain: null, plainPending: true, plainDimension: 'volume',
  };
}

// ---------------------------------------------------------------------------
// Axis 2 — CONFIGURATION (per ear). Deliberately coarse. Its only jobs are
// naming a recognizable shape and hinting at etiology (provider-facing only).
//
// "Doesn't fit a standard pattern" (atypical) is a FIRST-CLASS output and must
// be common. The named patterns have strict criteria; anything that does not
// clearly match falls through to atypical — NEVER to 'flat'. Forcing every
// audiogram into a named shape produces confidently wrong descriptions.
// ---------------------------------------------------------------------------
export function configurationAxis(t) {
  const t250 = t?.[250], t500 = t?.[500], t1k = t?.[1000];
  const t2k = t?.[2000], t3k = t?.[3000], t4k = t?.[4000];
  const t6k = t?.[6000], t8k = t?.[8000];

  // Need the octave backbone to say anything.
  if ([t500, t1k, t2k, t4k].some(v => v == null)) {
    return { status: 'undetermined', reason: 'incomplete_octaves', pattern: null,
      etiologyHint: null, clinical: null, plain: null, plainPending: true,
      plainDimension: 'which_sounds' };
  }

  // Slope is measured over WIDE bands (low 250–1000 vs high 4000–8000), not a
  // narrow 500–4000 window. A gradual age-related slope is the single most
  // common real audiogram; a narrow window understates it and dumps it into
  // atypical, which is exactly the "confidently wrong" failure in the other
  // direction. Mid band anchors the cookie-bite test.
  const low = avgAt(t, [250, 500, 1000]);
  const high = avgAt(t, [4000, 6000, 8000]) ?? avgAt(t, [4000, 8000]) ?? t4k;
  const mid = avgAt(t, [2000, 3000]) ?? t2k;
  const octaves = [t500, t1k, t2k, t4k];
  const range = Math.max(...octaves) - Math.min(...octaves);

  // Largest single adjacent step among the high frequencies — a precipitous
  // (ski-slope) loss has one steep cliff; a gradual slope does not.
  const hiSeq = [t1k, t2k, t3k, t4k, t6k, t8k].filter(v => v != null);
  let maxHiStep = 0;
  for (let i = 1; i < hiSeq.length; i++) maxHiStep = Math.max(maxHiStep, hiSeq[i] - hiSeq[i - 1]);

  let pattern;

  // Jaggedness guard FIRST. An irregular audiogram (2+ significant reversals)
  // fits no named shape — atypical, not a forced label. This is what keeps
  // atypical common: genuinely messy audiograms land here by design.
  if (significantReversals(t) >= 2) {
    pattern = 'atypical';
  } else if (high - low >= 40 && low <= 35 && maxHiStep >= 30) {
    // Precipitous / ski-slope: near-normal lows, one steep cliff into the highs.
    pattern = 'ski_slope';
  } else if ((mid - low) >= 15 && (mid - high) >= 15) {
    // Cookie-bite: mids worse than both lows and highs. Checked before slope so
    // a mid-peak that also has raised highs isn't miscalled sloping.
    pattern = 'cookie_bite';
  } else if (high - low >= 15) {
    // Sloping high-frequency: any clear downward slope, gradual or steep.
    pattern = 'sloping_high_frequency';
  } else if (low - high >= 15) {
    // Rising / reverse: lows worse than highs.
    pattern = 'rising';
  } else if (range <= 20) {
    // Flat: little variation across the octave backbone.
    pattern = 'flat';
  } else {
    // Fits none of the coarse shapes → atypical, never a default.
    pattern = 'atypical';
  }

  // Etiology hint is PROVIDER-FACING ONLY and is separate from the shape name. A
  // notch is a hypothesis about one person that the audiogram cannot support as
  // a causal claim, so it lives here as a hint, not as a patient-facing shape.
  let etiologyHint = null;
  const notchPeak = [t3k, t4k, t6k].filter(v => v != null);
  const isNoiseNotch = notchPeak.length && t8k != null && low != null && t2k != null
    && low <= 30 && t2k <= 35
    && Math.max(...notchPeak) >= 40
    && Math.max(...notchPeak) - t2k >= 20
    && t8k <= Math.max(...notchPeak) - 15;
  if (isNoiseNotch) {
    etiologyHint = 'noise-notch signature (near-normal through 2 kHz, worst 3–6 kHz, 8 kHz recovery) is suggestive of noise exposure — provider hypothesis, not diagnostic from the audiogram alone';
  } else if (pattern === 'ski_slope') {
    etiologyHint = 'precipitous high-frequency loss — commonly age-related or noise-related; provider judgment required';
  } else if (pattern === 'sloping_high_frequency') {
    etiologyHint = 'sloping high-frequency loss — the most common age-related pattern; provider judgment required';
  } else if (pattern === 'cookie_bite') {
    etiologyHint = 'mid-frequency (cookie-bite) loss — sometimes genetic or congenital; provider judgment required';
  } else if (pattern === 'rising') {
    etiologyHint = 'rising (low-frequency) loss — can accompany a conductive component or Ménière-type pathology; provider judgment required';
  }

  const PATTERN_TERM = {
    ski_slope: 'precipitous high-frequency',
    sloping_high_frequency: 'high-frequency',
    cookie_bite: 'mid-frequency (cookie-bite)',
    rising: 'rising (low-frequency)',
    flat: 'flat',
    atypical: 'atypical (does not fit a standard configuration)',
  };

  return {
    status: pattern === 'atypical' ? 'atypical' : 'ok',
    pattern,
    etiologyHint,
    clinical: PATTERN_TERM[pattern],
    plain: null, plainPending: true, plainDimension: 'which_sounds',
  };
}

// ---------------------------------------------------------------------------
// Axis 3 — TYPE (per ear). Sensorineural / conductive / mixed from the AC–BC
// gap. Standard criteria: a significant air–bone gap is >= 15 dB. When bone
// conduction is missing, type CANNOT be determined — that is a degraded state,
// not "sensorineural by default".
// ---------------------------------------------------------------------------
export function typeAxis(ac, bc) {
  if (!bc || presentFreqs(bc).length === 0) {
    return { status: 'undetermined', reason: 'bc_missing', type: null,
      clinical: null, plain: null, plainPending: true, plainDimension: null };
  }
  if (!ac || presentFreqs(ac).length === 0) {
    return { status: 'absent', reason: 'ac_missing', type: null,
      clinical: null, plain: null, plainPending: true, plainDimension: null };
  }

  // Air–bone gaps at frequencies where both are present.
  const gaps = [500, 1000, 2000, 4000]
    .filter(f => ac[f] != null && bc[f] != null)
    .map(f => ac[f] - bc[f]);
  if (!gaps.length) {
    return { status: 'undetermined', reason: 'no_matched_frequencies', type: null,
      clinical: null, plain: null, plainPending: true, plainDimension: null };
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const significantGaps = gaps.filter(g => g >= 15).length;
  const conductiveComponent = avgGap >= 15 || significantGaps >= 2;
  const bcElevated = (pta3(bc) ?? 0) > 20;

  let type;
  if (conductiveComponent && bcElevated) type = 'mixed';
  else if (conductiveComponent) type = 'conductive';
  else type = 'sensorineural';

  const TYPE_TERM = {
    sensorineural: 'sensorineural',
    conductive: 'conductive',
    mixed: 'mixed',
  };

  return {
    status: 'ok',
    type,
    avgAirBoneGap: Math.round(avgGap),
    clinical: TYPE_TERM[type],
    plain: null, plainPending: true, plainDimension: null,
  };
}

// ---------------------------------------------------------------------------
// Axis 4 — SYMMETRY. TWO rules with different thresholds.
//
//   Narrative trigger — 15 dB PTA difference, OR a 15 dB gap at four or more
//   frequencies. Below this, describe both ears together; above it, explain
//   each ear separately.
//
//   Referral trigger — FDA-style asymmetry, set TIGHTER. A missed retrocochlear
//   asymmetry is a far worse error than an unnecessary explanation, so this
//   errs toward flagging.
// ---------------------------------------------------------------------------
export function symmetryAxis(right, left) {
  const rP = pta3(right), lP = pta3(left);
  if (rP == null || lP == null) {
    return { status: 'undetermined', reason: 'missing_ear', separateEars: false,
      referralFlag: false, clinical: null, plain: null, plainPending: true,
      plainDimension: null };
  }

  const ptaDiff = Math.abs(rP - lP);

  // Per-frequency asymmetries across the shared frequency set.
  const perFreqDiffs = AUDIG_FREQS
    .filter(f => right?.[f] != null && left?.[f] != null)
    .map(f => ({ f, d: Math.abs(right[f] - left[f]) }));
  const freqsWith15 = perFreqDiffs.filter(x => x.d >= 15).length;
  const maxFreqDiff = perFreqDiffs.reduce((m, x) => Math.max(m, x.d), 0);

  // Narrative rule.
  const separateEars = ptaDiff >= 15 || freqsWith15 >= 4;

  // Referral rule — tighter than the narrative rule. FDA-style red flags for
  // asymmetric sensorineural loss, set conservatively: >= 15 dB average PTA
  // asymmetry, OR >= 20 dB at any single frequency, OR >= 15 dB at two or more
  // adjacent-ish frequencies. Err toward flagging.
  const referralFlag = ptaDiff >= 15 || maxFreqDiff >= 20 || freqsWith15 >= 2;

  const worseEar = rP > lP ? 'right' : lP > rP ? 'left' : null;

  let clinical;
  if (!separateEars) {
    clinical = `symmetric (PTA difference ${ptaDiff} dB)`;
  } else {
    clinical = `asymmetric, ${worseEar} ear poorer (PTA difference ${ptaDiff} dB`
      + `${freqsWith15 ? `, ${freqsWith15} frequencies ≥15 dB apart` : ''})`;
  }
  if (referralFlag) {
    clinical += ' — meets asymmetry referral criteria; medical evaluation indicated';
  }

  return {
    status: 'ok',
    ptaDiff, freqsWith15, maxFreqDiff, worseEar,
    separateEars,
    // Referral is a safety flag, surfaced to the provider; it is independent of
    // the narrative decision to describe ears together or separately.
    referralFlag,
    clinical, plain: null, plainPending: true, plainDimension: null,
  };
}

// ---------------------------------------------------------------------------
// Axis 5 — CLARITY. WRS + QuickSIN. NEVER collapse this into degree. PTA
// describes how much needs to be made louder, not how much is understood.
// ---------------------------------------------------------------------------

// Classic word-recognition-score bands (percent correct).
export function wrsCategory(pct) {
  if (pct == null) return null;
  if (pct >= 90) return 'excellent';
  if (pct >= 76) return 'good';
  if (pct >= 60) return 'fair';
  if (pct >= 40) return 'poor';
  return 'very_poor';
}

// QuickSIN SNR-loss bands (dB SNR loss), Etymotic interpretive scale.
export function snrLossCategory(db) {
  if (db == null) return null;
  if (db < 3) return 'normal';
  if (db < 7) return 'mild';
  if (db <= 15) return 'moderate';
  return 'severe';
}

const WRS_RANK = { excellent: 0, good: 1, fair: 2, poor: 3, very_poor: 4 };

// Rough audibility-based expectation: what WRS category a given degree would
// predict on its own. Used ONLY to detect the clarity-contradicts-degree case —
// never to project a benefit or a number.
function expectedWrsCeilingFromDegree(worstSeverity) {
  const r = severityRank(worstSeverity);
  if (r <= severityRank('mild')) return 'excellent';
  if (r <= severityRank('moderate')) return 'good';
  if (r <= severityRank('moderate_severe')) return 'fair';
  return 'poor';
}

export function clarityAxis({ wrsRight, wrsLeft, wrsBinaural, sinScore, sinTest, degreeWorstByEar } = {}) {
  const anyWrs = [wrsRight, wrsLeft, wrsBinaural].some(v => v != null);
  const haveSin = sinScore != null;

  if (!anyWrs && !haveSin) {
    return { status: 'absent', reason: 'no_clarity_measures',
      wrs: {}, snr: null, clarityVsDegree: null,
      clinical: null, plain: null, plainPending: true, plainDimension: 'hearing_vs_understanding' };
  }

  const wrs = {
    right: wrsRight != null ? { pct: wrsRight, category: wrsCategory(wrsRight) } : null,
    left: wrsLeft != null ? { pct: wrsLeft, category: wrsCategory(wrsLeft) } : null,
    binaural: wrsBinaural != null ? { pct: wrsBinaural, category: wrsCategory(wrsBinaural) } : null,
  };

  const snr = haveSin
    ? { score: sinScore, test: sinTest || 'quicksin', category: snrLossCategory(sinScore) }
    : { status: 'absent', reason: 'quicksin_not_administered' };

  // Clarity-contradicts-degree: a mild-degree ear with disproportionately poor
  // word recognition breaks the textbook classifier, and is exactly where
  // clinical judgment matters most. Flag per ear, do not resolve it.
  const contradictions = [];
  for (const ear of ['right', 'left']) {
    const earWrs = ear === 'right' ? wrs.right : wrs.left;
    const worst = degreeWorstByEar?.[ear];
    if (!earWrs || !worst) continue;
    const ceiling = expectedWrsCeilingFromDegree(worst);
    if (WRS_RANK[earWrs.category] > WRS_RANK[ceiling] + 1) {
      contradictions.push({
        ear,
        wrsCategory: earWrs.category,
        wrsPct: earWrs.pct,
        degree: worst,
        note: `${ear} word recognition (${earWrs.pct}%) is poorer than the ${SEVERITY_TERM[worst]} audiometric degree predicts; discrimination, not audibility, is the limiting factor — clinical judgment indicated`,
      });
    }
  }
  // Severe SNR loss at a mild/moderate degree is the same dissociation seen in
  // noise, and is the basis for a technology-tier conversation.
  const bestDegree = degreeWorstByEar
    ? [degreeWorstByEar.right, degreeWorstByEar.left].filter(Boolean)
        .sort((a, b) => severityRank(a) - severityRank(b))[0]
    : null;
  if (snr?.category === 'severe' && bestDegree && severityRank(bestDegree) <= severityRank('moderate')) {
    contradictions.push({
      ear: 'binaural',
      snrLoss: 'severe',
      degree: bestDegree,
      note: `severe SNR loss (QuickSIN ${sinScore} dB) despite ${SEVERITY_TERM[bestDegree]} audiometric degree — speech-in-noise difficulty exceeds what the audiogram alone predicts`,
    });
  }

  const clarityVsDegree = contradictions.length ? contradictions : null;

  // Compose a provider-facing clinical summary of the clarity picture.
  const parts = [];
  if (wrs.right) parts.push(`right WRS ${wrs.right.pct}% (${wrs.right.category})`);
  if (wrs.left) parts.push(`left WRS ${wrs.left.pct}% (${wrs.left.category})`);
  if (wrs.binaural) parts.push(`binaural WRS ${wrs.binaural.pct}% (${wrs.binaural.category})`);
  if (snr.category) parts.push(`${(snr.test || 'quicksin')} SNR loss ${snr.score} dB (${snr.category})`);
  let clinical = parts.join('; ') || null;
  if (clarityVsDegree) clinical += ' — clarity poorer than degree predicts';

  return {
    status: 'ok',
    wrs, snr, clarityVsDegree,
    clinical, plain: null, plainPending: true, plainDimension: 'hearing_vs_understanding',
  };
}

// ---------------------------------------------------------------------------
// Compose the clinical sentence from axes 1–4 for one ear.
// Example: "moderately severe high-frequency sensorineural hearing loss".
// Any axis that is undetermined/absent drops out of the sentence rather than
// contributing a guessed word.
// ---------------------------------------------------------------------------
function composeEarSentence(degree, config, type) {
  const degreeWord = degree?.status === 'ok'
    ? degree.clinical.replace(/ degree$/, '') : null;
  const configWord = config?.status === 'ok' ? config.clinical
    : config?.status === 'atypical' ? null : null; // atypical is stated separately
  const typeWord = type?.status === 'ok' ? type.clinical : null;

  const words = [degreeWord, configWord, typeWord].filter(Boolean);
  if (!words.length) return null;
  let sentence = words.join(' ') + ' hearing loss';
  if (config?.status === 'atypical') {
    sentence += ' (configuration does not fit a standard pattern)';
  } else if (config?.status === 'undetermined') {
    sentence += ' (configuration undetermined — incomplete octave data)';
  }
  if (type?.status === 'undetermined') {
    sentence += type.reason === 'bc_missing'
      ? ' (type undetermined — no bone-conduction data)'
      : ' (type undetermined)';
  }
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// ---------------------------------------------------------------------------
// Top-level entry point.
//
// Input:
//   {
//     right, left            AC threshold maps { freq: dB }
//     rightBC, leftBC        BC threshold maps { freq: dB }
//     speech: { unaidedR, unaidedL, unaidedBin, wrMclR, wrMclL,
//               sinScore, sinTest }
//     age, sex               patient demographics (passed through for the
//                            effects-branch matcher; not used to classify loss)
//   }
//
// Returns a structured descriptor. Every axis carries its own status so the
// consuming screen can render degraded states explicitly.
// ---------------------------------------------------------------------------
export function describeAudiogram(input = {}) {
  const { right, left, rightBC, leftBC, speech = {}, age = null, sex = null } = input;

  const degreeRight = degreeAxis(right);
  const degreeLeft = degreeAxis(left);
  const configRight = configurationAxis(right);
  const configLeft = configurationAxis(left);
  const typeRight = typeAxis(right, rightBC);
  const typeLeft = typeAxis(left, leftBC);
  const symmetry = symmetryAxis(right, left);

  const degreeWorstByEar = {
    right: degreeRight.status === 'ok' ? degreeRight.worst : null,
    left: degreeLeft.status === 'ok' ? degreeLeft.worst : null,
  };

  const clarity = clarityAxis({
    wrsRight: speech.unaidedR ?? null,
    wrsLeft: speech.unaidedL ?? null,
    wrsBinaural: speech.unaidedBin ?? null,
    sinScore: speech.sinScore ?? null,
    sinTest: speech.sinTest ?? null,
    degreeWorstByEar,
  });

  const ears = {
    right: {
      degree: degreeRight, configuration: configRight, type: typeRight,
      sentence: composeEarSentence(degreeRight, configRight, typeRight),
    },
    left: {
      degree: degreeLeft, configuration: configLeft, type: typeLeft,
      sentence: composeEarSentence(degreeLeft, configLeft, typeLeft),
    },
  };

  // Overall categorized-degree the effects branch matches on: the worse ear's
  // worst endpoint. Explicitly null when neither ear can be computed.
  const overallDegree = [degreeRight, degreeLeft]
    .filter(d => d.status === 'ok')
    .map(d => d.worst)
    .sort((a, b) => severityRank(b) - severityRank(a))[0] || null;

  return {
    ears,
    symmetry,
    clarity,
    overallDegree,
    // Narrative decision: one combined sentence or two.
    presentSeparately: symmetry.separateEars,
    // Referral safety flag, surfaced independently.
    referralFlag: symmetry.referralFlag,
    // Demographics passed through untouched for the effects-branch matcher.
    patient: { age, sex },
  };
}
