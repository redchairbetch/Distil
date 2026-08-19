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
  isAsymmetric,
} from "../audiogramAnalysis.js";
import { isTestedNoLoss, NORMAL_HEARING_MAX_DB } from "./audiogram.js";

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

// Body-style fit guidance from the audiogram. Deliberately NOT an engine —
// there is no body-style engine in the app; the provider decides. This is
// severity-banded counseling guidance keyed off the worst entered AC
// threshold across both ears (same basis as worst-threshold severity), with
// receiver-power logic in the spirit of DeviceSelection's fit confirmation.
// Returns { headline, notes[] } or null when nothing was tested.
export function styleGuidance(audiology) {
  const aud = audiology || {};
  const entered = [...enteredVals(aud.rightT), ...enteredVals(aud.leftT)];
  if (!entered.length) return null;
  const worst = Math.max(...entered);

  if (worst <= NORMAL_HEARING_MAX_DB) {
    return {
      headline: "Hearing in the normal range",
      notes: ["No device is recommended today — an annual re-check keeps a baseline on file."],
    };
  }

  let headline;
  const notes = [];
  if (worst <= 55) {
    headline = "Receiver-in-canal (RIC) — standard receiver";
    notes.push("Smaller in-the-canal styles are also within range for this degree of loss.");
  } else if (worst <= 70) {
    headline = "Receiver-in-canal (RIC) with a power receiver";
    notes.push("The smallest in-the-canal styles can run short on power at this level.");
  } else if (worst <= 90) {
    headline = "RIC with a high-power receiver, or behind-the-ear (BTE)";
    notes.push("In-the-canal styles aren't recommended at this level — power comes first.");
  } else {
    headline = "Behind-the-ear (BTE) — the style with the most power";
  }

  const summaryish = buildPersonSummary(audiology);
  if (summaryish.slope === "sloping") {
    notes.push("A steeply sloping loss fits best with an open fit, which keeps your own voice sounding natural.");
  }
  if (summaryish.asymmetric) {
    notes.push("Each ear may call for a different receiver strength — that's normal and easy to do.");
  }

  return { headline, notes };
}
