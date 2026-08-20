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

// Intake review — the shared vocabulary behind the Health History
// presentation mode and the Results-step complaint carry-forward.
//
// Two consumers, one source of truth:
//   1. IntakePresentation.jsx renders the FDA safety battery and the
//      endorsed hearing situations as patient-facing cards, with the
//      provider's deepening prompts hidden behind a discreet reveal.
//   2. renderResultsContent (Distil.jsx) re-surfaces the endorsed
//      situations next to the audiogram, each mapped to the audiometric
//      finding that explains it.
//
// All copy in `label` / `restatement` / explanation strings is
// PATIENT-FACING: no "red flag", no jargon, no percentage-improvement
// framing, and honest degraded states when the test data doesn't
// support a complaint (never invent an explanation).
// `prompt` strings are PROVIDER-ONLY and hidden by default in the UI.

import { PRES_T } from "../i18n/presentation.js";

// ── FDA medical safety battery ──────────────────────────────────────
// The six medQ_* intake items are the FDA red-flag conditions for
// hearing aid dispensing. Patient-facing framing is "medical safety
// check" — the moment the practice reads medical, not retail.
export const FDA_SAFETY_CHECKS = [
  { key: "med_pain",   label: "Pain or discomfort in your ears",
    prompt: "Which ear? Constant or intermittent? Rule out infection / TMJ before impressions." },
  { key: "med_drain",  label: "Drainage from your ears",
    prompt: "Active drainage is a medical referral before any fitting. When did it start? Color/odor?" },
  { key: "med_sudden", label: "A sudden hearing change in the past 90 days",
    prompt: "Sudden loss inside 90 days is urgent — which ear, exactly when? Document and refer if unevaluated." },
  { key: "med_ring",   label: "Ringing or other sounds in your ears",
    prompt: "Tinnitus: one ear or both? Pulsatile? Unilateral or pulsatile tinnitus warrants medical work-up." },
  { key: "med_dizzy",  label: "Dizziness or vertigo",
    prompt: "Spinning vs. lightheaded? Episodes with hearing change suggest Ménière's — refer if unevaluated." },
  { key: "med_full",   label: "Fullness or a blocked feeling",
    prompt: "Could be cerumen — check otoscopy first. Persistent unilateral fullness needs medical eyes." },
];

// ── Everyday hearing situations ─────────────────────────────────────
// The hearQ_* difficulty battery, restated as situations rather than
// questions. `category` keys the Results-step mapping:
//   clarity — high-frequency consonant audibility
//   noise   — speech-in-noise / word recognition under degradation
//   effort  — listening effort (fatigue / strain)
//   volume  — overall audibility
//   mixed   — audibility + clarity combined
export const HEARING_SITUATIONS = [
  { key: "hear_mumble",     icon: "🗣️", category: "clarity",
    restatement: "People seem to mumble",
    prompt: "Whose voice is hardest — spouse, grandkids, TV anchors? Get a name; it becomes the 'why'." },
  { key: "hear_repeat",     icon: "🔁", category: "mixed",
    restatement: "Often asking people to repeat themselves",
    prompt: "How do people react when they repeat? Frustration in the family is a stronger motivator than the loss itself." },
  { key: "hear_understand", icon: "💬", category: "clarity",
    restatement: "Hearing voices but not making out the words",
    prompt: "'Hearing isn't understanding' — have them describe a recent moment it happened." },
  { key: "hear_noisy",      icon: "🍽️", category: "noise",
    restatement: "Noisy places are a struggle",
    prompt: "Which restaurant / gathering? Ask what they do now — avoid it, sit out, leave early?" },
  { key: "hear_loud",       icon: "📢", category: "volume",
    restatement: "Told you speak loudly",
    prompt: "Who tells them? Their own voice comes back quiet, so they raise it — normalize, don't embarrass." },
  { key: "hear_tv",         icon: "📺", category: "volume",
    restatement: "The TV volume keeps creeping up",
    prompt: "Who complains about the volume? That person is usually the reason they're here today." },
  { key: "hear_kids",       icon: "🧒", category: "clarity",
    restatement: "Children's voices are hard to catch",
    prompt: "Grandkids by name if possible. Higher-pitched voices sit exactly where the loss usually is." },
  { key: "hear_fatigue",    icon: "😮‍💨", category: "effort",
    restatement: "Conversations in noise leave you drained",
    prompt: "Listening fatigue is the felt cost of decoding a degraded signal. Ask what they skip because it's exhausting." },
  { key: "hear_strain",     icon: "🎯", category: "effort",
    restatement: "Keeping up takes hard concentration",
    prompt: "Effort now, fatigue later. This endorsement should echo again at the technology-tier conversation." },
];

// Patient-facing labels for the what's-held-you-back picks, with a
// provider-only coaching hint per pick (hidden by default in the UI).
export const RESISTANCE_REVIEW = {
  cost:            { label: "Cost or affordability",
    hint: "Insurance benefit + care plan value story. Never open with retail." },
  cosmetics:       { label: "Cosmetics or appearance",
    hint: "Show discreet styles early — let the device answer the objection." },
  denial:          { label: "Didn't feel ready",
    hint: "Ask what changed. Something got them in the door today." },
  bad_experience:  { label: "A past bad experience",
    hint: "Ask exactly what happened — fitting, follow-up, or expectations? Name how care is different here." },
  stigma:          { label: "Stigma",
    hint: "Untreated loss is more visible than any device — the repeats, the volume, the withdrawal." },
  dont_know:       { label: "Didn't know where to start",
    hint: "Validate: today IS the start. Walk the agenda so the path feels short." },
  fear_dependence: { label: "Fear of becoming dependent",
    hint: "Reframe: glasses framing. The brain re-engaging isn't dependence, it's function returning." },
  other:           { label: "Something else",
    hint: "Read their own words back and let them expand." },
};

// ── Answer-state helpers ────────────────────────────────────────────

// Tri-state read of one yes/no intake answer.
const yn = (v) => (v === true ? "yes" : v === false ? "no" : "unanswered");

// FDA battery rollup. `allClear` is deliberately strict: it requires an
// explicit "No" on all six — unanswered never silently counts as clear.
export function fdaSafetyState(answers = {}) {
  const flagged = [], clear = [], unanswered = [];
  for (const item of FDA_SAFETY_CHECKS) {
    const state = yn(answers[item.key]);
    if (state === "yes") flagged.push(item);
    else if (state === "no") clear.push(item);
    else unanswered.push(item);
  }
  return { flagged, clear, unanswered, allClear: flagged.length === 0 && unanswered.length === 0 };
}

// Hearing-situation rollup: which of the nine they endorsed, denied,
// or never answered.
export function hearingSituationState(answers = {}) {
  const endorsed = [], denied = [], unanswered = [];
  for (const item of HEARING_SITUATIONS) {
    const state = yn(answers[item.key]);
    if (state === "yes") endorsed.push(item);
    else if (state === "no") denied.push(item);
    else unanswered.push(item);
  }
  return { endorsed, denied, unanswered, total: HEARING_SITUATIONS.length };
}

// Perception-gap line for the "Where you stand" beat. Curiosity
// framing, never gotcha — and only when there's actually a story to
// tell. Returns null when the rating is missing.
export function perceptionGapCopy(answers = {}, lang = "en") {
  const L = PRES_T[lang] || PRES_T.en;
  const rating = Number(answers.hear_rating);
  if (!rating) return null;
  const { endorsed, total } = hearingSituationState(answers);
  if (rating >= 6 && endorsed.length >= 3) {
    return L.gapHighRating(rating, endorsed.length, total);
  }
  if (rating <= 5) {
    return L.gapLowRating(rating);
  }
  return L.gapNeutral(rating);
}

// ── Results-step carry-forward mapping ──────────────────────────────
// Maps each endorsed situation to the audiometric finding that explains
// it. `metrics` comes from renderResultsContent's already-computed
// values:
//   overallSeverity — "Normal" | "Mild" | "Moderate" | "Moderately Severe" | "Severe" | "Profound" | null
//   worseCCT        — worse-ear CCT / unaided WRS %, or null
//   highFreqCount   — how many high-frequency consonants fall below threshold
//   hasThresholds   — any AC thresholds entered
//
// Every row is { key, icon, restatement, explanation, supported }.
// `supported:false` marks the honest degraded state — the test doesn't
// explain the complaint, and the copy says so instead of inventing.
export function mapComplaintsToFindings(answers = {}, metrics = {}, lang = "en") {
  const L = PRES_T[lang] || PRES_T.en;
  const { endorsed } = hearingSituationState(answers);
  if (endorsed.length === 0) return [];

  const { overallSeverity = null, worseCCT = null, highFreqCount = 0, hasThresholds = false } = metrics;
  const severityKnown = hasThresholds && overallSeverity != null;
  const hasLoss = severityKnown && overallSeverity !== "Normal";
  const clarityDeficit = worseCCT != null && worseCCT < 90;
  const sevPhrase = overallSeverity ? (L.sevPhrase[overallSeverity] || overallSeverity.toLowerCase()) : null;

  const unexplained = L.unexplained;

  const explain = (item) => {
    switch (item.category) {
      case "clarity":
        if (highFreqCount >= 1) {
          if (item.key === "hear_kids") return L.clarityKids;
          return L.clarityHF;
        }
        if (hasLoss) return L.clarityLoss(sevPhrase);
        return unexplained;
      case "noise":
        if (clarityDeficit) return L.noiseCCT(worseCCT);
        if (hasLoss) return L.noiseLoss(sevPhrase);
        return unexplained;
      case "effort":
        if (clarityDeficit || hasLoss) return L.effortCost;
        return unexplained;
      case "volume":
        if (hasLoss) {
          if (item.key === "hear_loud") return L.volumeLoud(sevPhrase);
          return L.volumeTV(sevPhrase);
        }
        return unexplained;
      case "mixed":
        if (hasLoss && highFreqCount >= 1) return L.mixedBoth;
        if (hasLoss) return L.mixedLoss(sevPhrase);
        if (clarityDeficit) return L.mixedCCT(worseCCT);
        return unexplained;
      default:
        return unexplained;
    }
  };

  return endorsed.map(item => {
    const explanation = explain(item);
    return {
      key: item.key,
      icon: item.icon,
      restatement: L.restatements[item.key] || item.restatement,
      explanation,
      supported: explanation !== unexplained,
    };
  });
}
