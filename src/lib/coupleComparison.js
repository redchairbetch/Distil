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

// Couples side-by-side comparison helpers. Pure functions over the assembled
// patient.audiology shape ({ rightT, leftT, cctR/L, unaidedR/L, ... }) so the
// CouplesComparison view stays presentational.
//
// Severity here MUST agree with consultation mode: same worst-threshold basis
// and the same 20/40/55/70/90 cutoffs (severityFromWorstThreshold matches
// Distil.jsx's getWorstThresholdSeverity), so the words a couple sees side by
// side never contradict what either of them saw in their own consultation.

import {
  severityFromWorstThreshold,
  severityRank,
  getPTA4,
  getSlope,
  getConfiguration,
  isAsymmetric,
} from "../audiogramAnalysis.js";
import { isTestedNoLoss, NORMAL_HEARING_MAX_DB } from "./audiogram.js";
import { COMP_T } from "../i18n/comparison.js";

// Lowercase classifier vocabulary → the display words consultation mode uses.
export const SEVERITY_DISPLAY = {
  normal: "Normal",
  mild: "Mild",
  moderate: "Moderate",
  "mod-severe": "Moderately Severe",
  severe: "Severe",
  profound: "Profound",
};

// Entered thresholds only — null/undefined/"" means "not tested", and
// non-numeric junk is dropped rather than coerced (same stance as
// lib/audiogram.js's enteredThresholds).
function enteredVals(ear) {
  if (!ear || typeof ear !== "object") return [];
  return Object.values(ear)
    .filter(v => v !== null && v !== undefined && v !== "")
    .map(Number)
    .filter(Number.isFinite);
}

// Everything one person's comparison column needs, derived once.
export function buildPersonSummary(audiology) {
  const aud = audiology || {};
  const rightT = aud.rightT || {};
  const leftT = aud.leftT || {};

  const rSeverity = severityFromWorstThreshold(rightT);
  const lSeverity = severityFromWorstThreshold(leftT);
  const overall = rSeverity && lSeverity
    ? (severityRank(rSeverity) >= severityRank(lSeverity) ? rSeverity : lSeverity)
    : (rSeverity || lSeverity);

  const rPTA4 = getPTA4(rightT);
  const lPTA4 = getPTA4(leftT);

  // Slope reads off the worse ear (by PTA4) — that's the ear driving the
  // fitting conversation.
  let worseEarT = null;
  if (rPTA4 != null && lPTA4 != null) worseEarT = rPTA4 >= lPTA4 ? rightT : leftT;
  else if (rPTA4 != null) worseEarT = rightT;
  else if (lPTA4 != null) worseEarT = leftT;

  return {
    rSeverity,
    lSeverity,
    overall,
    rPTA4,
    lPTA4,
    hasThresholds: rSeverity != null || lSeverity != null,
    asymmetric: isAsymmetric(leftT, rightT),
    slope: worseEarT ? getSlope(worseEarT) : null,
    normalHearing: isTestedNoLoss({ rightT, leftT }),
    // Word clarity: CCT when tested, unaided WRS as the fallback — the same
    // substitution consultation mode makes.
    clarityR: aud.cctR ?? aud.unaidedR ?? null,
    clarityL: aud.cctL ?? aud.unaidedL ?? null,
    unaidedR: aud.unaidedR ?? null,
    unaidedL: aud.unaidedL ?? null,
  };
}

// Consultation mode's word-score color bands (Distil.jsx cctColor).
export function clarityColor(v) {
  if (v == null) return "#9ca3af";
  if (v >= 90) return "#16a34a";
  if (v >= 75) return "#f59e0b";
  return "#dc2626";
}

// Patient-facing tier label for an engine rank. "Premium" never renders
// patient-side (CapabilityComparison rule) — the top tier displays as
// "Select", private pay's name for it.
export function patientTierLabel(rank) {
  if (rank === 5) return "Select";
  if (rank === 3) return "Advanced";
  if (rank === 1) return "Standard";
  return null;
}

// Neutral processing phrase per rank — mirrors TierSelection's
// rankToProcessingLabel so the vocabulary matches the wizard.
export function tierProcessingPhrase(rank) {
  if (rank === 5) return "top-of-the-line";
  if (rank === 3) return "mid-line";
  if (rank === 1) return "essential";
  return null;
}

// Frequencies that drive the receiver-power decision — the fitting-power
// (speech) range. An isolated 6–8 kHz drop must not push someone into power
// territory: a high-frequency presentation with healthy lows wants an
// open-fit standard receiver, not a power device.
const POWER_FREQS = [500, 750, 1000, 1500, 2000, 3000, 4000];
// Frequencies that drive the acoustics (open vs. closed fit) decision — the
// venting / own-voice story lives in the lows.
const LOW_FREQS = [250, 500];

function enteredAt(ear, freqs) {
  if (!ear || typeof ear !== "object") return [];
  return freqs
    .map(f => ear[f])
    .filter(v => v !== null && v !== undefined && v !== "")
    .map(Number)
    .filter(Number.isFinite);
}

// Body-style fit guidance from the audiogram. Deliberately NOT an engine —
// there is no body-style engine in the app; the provider decides. Three
// independent signals, mirroring how computeFitConfirmation (DeviceSelection)
// treats low- and high-frequency coverage separately:
//   power     ← worst entered 500–4000 Hz threshold across both ears
//   acoustics ← 250/500 Hz average of the worse ear (open vs. closed fit)
//   copy      ← configuration/slope of the worse ear
// Returns { headline, notes[] } or null when nothing was tested.
export function styleGuidance(audiology, lang = "en") {
  const L = COMP_T[lang] || COMP_T.en;
  const aud = audiology || {};
  const rightT = aud.rightT || {};
  const leftT = aud.leftT || {};
  const allEntered = [...enteredVals(rightT), ...enteredVals(leftT)];
  if (!allEntered.length) return null;

  if (Math.max(...allEntered) <= NORMAL_HEARING_MAX_DB) {
    return {
      headline: L.sgNormalHeadline,
      notes: [L.sgNormalNote],
    };
  }

  // Receiver power. Falls back to the overall worst when nothing in the
  // speech range was entered, so guidance never silently understates.
  const powerVals = [...enteredAt(rightT, POWER_FREQS), ...enteredAt(leftT, POWER_FREQS)];
  const powerWorst = powerVals.length ? Math.max(...powerVals) : Math.max(...allEntered);

  // Worse ear (by PTA4) carries the acoustics and configuration story.
  const rP = getPTA4(rightT), lP = getPTA4(leftT);
  const worseT = rP != null && lP != null ? (rP >= lP ? rightT : leftT)
    : rP != null ? rightT
    : lP != null ? leftT
    : (enteredVals(rightT).length ? rightT : leftT);
  const lowVals = enteredAt(worseT, LOW_FREQS);
  const lowAvg = lowVals.length ? lowVals.reduce((a, b) => a + b, 0) / lowVals.length : null;
  const acoustics = lowAvg == null ? null : lowAvg <= 30 ? "open" : lowAvg <= 50 ? "vented" : "sealed";
  const config = getConfiguration(worseT);
  const highFreqPattern = config === "ski-slope" || config === "high-freq" || getSlope(worseT) === "sloping";

  const notes = [];
  let headline;

  if (powerWorst > 90) {
    headline = L.sgBte;
  } else if (powerWorst > 70) {
    headline = L.sgRicHighPower;
    notes.push(L.sgInCanalNote);
  } else {
    const receiver = powerWorst <= 55 ? L.sgStandardReceiver : L.sgPowerReceiver;
    if (acoustics === "open") {
      headline = L.sgOpenHeadline(receiver);
      notes.push(highFreqPattern ? L.sgOpenNoteHF : L.sgOpenNote);
    } else if (acoustics === "vented") {
      headline = L.sgVentedHeadline(receiver);
      notes.push(L.sgVentedNote);
    } else if (acoustics === "sealed") {
      headline = L.sgSealedHeadline(receiver);
      notes.push(L.sgSealedNote);
    } else {
      headline = L.sgRicGeneric(receiver);
    }
  }

  if (config === "cookie-bite") {
    notes.push(L.sgCookieBite);
  } else if (config === "reverse") {
    notes.push(L.sgReverse);
  }

  if (isAsymmetric(leftT, rightT)) {
    notes.push(L.sgAsymmetric);
  }

  return { headline, notes };
}
