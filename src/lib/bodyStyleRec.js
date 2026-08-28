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

// Body-style recommendation engine — pure logic, no React, no assets.
//
// Two kinds of data live here, both deliberately plain so Kurt can argue with
// any number as a one-line change:
//
//   1. BODY_STYLE_STATS — the six patient-facing stat bars (1–5) per style.
//      These encode clinical priors about the FORM FACTOR, not any specific
//      product: a CIC is discreet but power-limited whoever makes it.
//   2. The clinical thresholds below — worse-ear PTA power gates, the
//      occlusion line, and the steep-slope rule.
//
// recommendBodyStyles() reads the wizard's form.audiology (rightT/leftT
// air-conduction maps) and annotates each body style with a status, badges,
// and full-sentence notes the provider can narrate, plus a "From today's
// test results…" summary banner. It only ever advises — the provider decides.

import { getPTA } from "./audiogram.js";

// ── Stat table — 1 (weak) to 5 (strong), per body style ─────────────────────
export const STAT_KEYS = [
  { id: "discreetness", label: "Discreetness" },
  { id: "power",        label: "Power reserve" },
  { id: "connectivity", label: "Connectivity" },
  { id: "handling",     label: "Ease of handling" },
  { id: "adaptation",   label: "Adaptation speed" },
  { id: "reliability",  label: "Reliability" },
];

export const BODY_STYLE_STATS = {
  //        discreet power connect handling adapt reliability
  ric: { discreetness: 4, power: 4, connectivity: 5, handling: 3, adaptation: 4, reliability: 4 },
  bte: { discreetness: 2, power: 5, connectivity: 4, handling: 4, adaptation: 3, reliability: 5 },
  ite: { discreetness: 3, power: 3, connectivity: 4, handling: 5, adaptation: 4, reliability: 4 },
  itc: { discreetness: 4, power: 3, connectivity: 3, handling: 4, adaptation: 4, reliability: 3 },
  cic: { discreetness: 5, power: 2, connectivity: 2, handling: 2, adaptation: 3, reliability: 3 },
  iic: { discreetness: 5, power: 1, connectivity: 1, handling: 2, adaptation: 3, reliability: 2 },
  if:  { discreetness: 5, power: 2, connectivity: 1, handling: 3, adaptation: 5, reliability: 3 },
};

// ── Clinical thresholds (dB HL) ──────────────────────────────────────────────
// Worse-ear PTA at/above SEVERE flags the small shells and RIC receiver; at/
// above PROFOUND the small shells are blocked outright as underpowered.
export const POWER_GATE_SEVERE = 70;
export const POWER_GATE_PROFOUND = 85;
// Better-ear low-frequency average (250/500 Hz) at/under this line means the
// patient still hears their own voice naturally — sealing the canal with a
// closed custom invites occlusion complaints.
export const OCCLUSION_LOW_FREQ_DB = 30;
// A 500 Hz → 4 kHz drop at/above this, with preserved lows, is the textbook
// open-fit RIC audiogram.
export const STEEP_SLOPE_DB = 40;

const SMALL_SHELLS = ["cic", "iic", "if"];   // power-limited, deep-canal styles
const CLOSED_CUSTOMS = ["ite", "itc", "cic", "iic"]; // sealed-shell occlusion risk

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

// Mean of the entered 250/500 Hz thresholds for one ear; null if neither entered.
function lowFreqAvg(t) {
  const vals = [num(t?.[250]), num(t?.[500])].filter((v) => Number.isFinite(v));
  return vals.length ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : null;
}

// 500 Hz → 4 kHz rise for one ear; null unless both entered.
function earSlope(t) {
  const lo = num(t?.[500]);
  const hi = num(t?.[4000]);
  return Number.isFinite(lo) && Number.isFinite(hi) ? hi - lo : null;
}

// ── Metrics — the numbers the rules run on ───────────────────────────────────
export function styleMetrics(audiology) {
  const rightT = audiology?.rightT || {};
  const leftT = audiology?.leftT || {};
  const ptaR = getPTA(rightT);
  const ptaL = getPTA(leftT);
  const ptas = [ptaR, ptaL].filter((v) => v != null);
  const worsePta = ptas.length ? Math.max(...ptas) : null;
  const lowR = lowFreqAvg(rightT);
  const lowL = lowFreqAvg(leftT);
  const lows = [lowR, lowL].filter((v) => v != null);
  const betterLowAvg = lows.length ? Math.min(...lows) : null;
  // An ear shows the textbook ski-slope when its own lows are preserved AND
  // its 500→4k drop clears the slope line.
  const steepWithPreservedLows =
    (earSlope(rightT) != null && earSlope(rightT) >= STEEP_SLOPE_DB && lowR != null && lowR <= OCCLUSION_LOW_FREQ_DB) ||
    (earSlope(leftT) != null && earSlope(leftT) >= STEEP_SLOPE_DB && lowL != null && lowL <= OCCLUSION_LOW_FREQ_DB);
  return {
    worsePta,
    betterLowAvg,
    steepWithPreservedLows,
    hasData: worsePta != null,
  };
}

// ── The engine ───────────────────────────────────────────────────────────────
// Returns { metrics, summary, byStyle } where byStyle[id] =
//   { status: "ok" | "recommended" | "caution" | "blocked",
//     badge:  short pill text | null,
//     notes:  [full sentences for the detail panel] }
export function recommendBodyStyles(audiology) {
  const metrics = styleMetrics(audiology);
  const byStyle = {};
  for (const id of Object.keys(BODY_STYLE_STATS)) {
    byStyle[id] = { status: "ok", badge: null, notes: [] };
  }
  const { worsePta, betterLowAvg, steepWithPreservedLows, hasData } = metrics;

  if (!hasData) {
    return { metrics, summary: null, byStyle };
  }

  const summaryParts = [];

  // ── Power gates — worse-ear PTA decides how much amplification headroom
  // the shell must hold. Small deep-canal shells run out first.
  if (worsePta >= POWER_GATE_PROFOUND) {
    for (const id of SMALL_SHELLS) {
      byStyle[id].status = "blocked";
      byStyle[id].badge = "Not enough power";
      byStyle[id].notes.push(
        "With hearing at this level, this style cannot deliver enough amplification without feedback — the shell is simply too small for the receiver this loss needs."
      );
    }
    byStyle.ric.status = "caution";
    byStyle.ric.badge = "HP receiver + earmold";
    byStyle.ric.notes.push(
      "A RIC can reach this level of loss, but only with the high-power receiver and a custom earmold rather than an open dome."
    );
    byStyle.bte.status = "recommended";
    byStyle.bte.badge = "Power match";
    byStyle.bte.notes.push(
      "This degree of hearing loss calls for the power reserve a BTE carries — it is the style built for exactly this situation."
    );
    summaryParts.push(
      "the degree of loss in the worse ear needs serious amplification power, which rules out the smallest in-canal styles and points toward BTE or a high-power RIC with an earmold"
    );
  } else if (worsePta >= POWER_GATE_SEVERE) {
    for (const id of SMALL_SHELLS) {
      byStyle[id].status = "caution";
      byStyle[id].badge = "At its power limit";
      byStyle[id].notes.push(
        "This style sits at the edge of its fitting range for this degree of loss — it can work today, but leaves little headroom if hearing changes."
      );
    }
    byStyle.ric.status = "caution";
    byStyle.ric.badge = "HP receiver + earmold";
    byStyle.ric.notes.push(
      "At this level a RIC should be fitted with the high-power receiver and a custom earmold to hold the gain without feedback."
    );
    summaryParts.push(
      "the worse ear needs enough amplification that the smallest in-canal styles are at their limit, and a RIC should be fitted with its high-power receiver and an earmold"
    );
  }

  // ── Occlusion — near-normal lows plus a sealed shell = plugged-up voice.
  if (betterLowAvg != null && betterLowAvg <= OCCLUSION_LOW_FREQ_DB) {
    for (const id of CLOSED_CUSTOMS) {
      if (byStyle[id].status === "blocked") continue;
      byStyle[id].status = "caution";
      if (!byStyle[id].badge) byStyle[id].badge = "Occlusion risk";
      byStyle[id].notes.push(
        "The low pitches are still close to normal, so a shell that seals the ear canal tends to make the wearer's own voice sound boomy and plugged-up (occlusion) — expect an adjustment period or venting."
      );
    }
    summaryParts.push(
      "the low pitches are still strong, so sealed in-the-ear shells carry a real risk of that plugged-up, boomy own-voice feeling"
    );
  }

  // ── Textbook RIC — steep slope with preserved lows: open fit keeps the
  // natural lows and adds back only the missing highs.
  if (steepWithPreservedLows && byStyle.ric.status === "ok") {
    byStyle.ric.status = "recommended";
    byStyle.ric.badge = "Textbook match";
    byStyle.ric.notes.push(
      "This audiogram — strong low pitches falling steeply into the highs — is exactly what an open-fit RIC was designed for: the ear keeps its natural bass while the aid restores only the missing clarity."
    );
    summaryParts.push(
      "the pattern of strong lows falling steeply into the highs is the textbook fit for an open RIC"
    );
  }

  const summary = summaryParts.length
    ? `From today's test results: ${summaryParts.join("; ")}.`
    : "From today's test results, no style is ruled out — the choice can follow lifestyle, dexterity, and cosmetic preference.";

  return { metrics, summary, byStyle };
}
