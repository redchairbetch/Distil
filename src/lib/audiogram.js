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

// Tested No Loss (TNL) detection. Domain rule: normal hearing threshold is
// 20 dB (NOT 25). A visit qualifies for the TNL path when both ears were
// tested and every entered air-conduction threshold sits at or under that
// line. This only ever SUGGESTS the path — the provider confirms, because
// thresholds alone can't rule out a red flag (poor word recognition,
// asymmetry, medical history).

export const NORMAL_HEARING_MAX_DB = 20;

// Entered thresholds only — an empty string or null cell means "not tested
// at this frequency", not "normal". Non-numeric junk disqualifies rather
// than passes, so a data-entry glitch can never manufacture a TNL suggestion.
function enteredThresholds(ear) {
  if (!ear || typeof ear !== "object") return [];
  return Object.values(ear)
    .filter(v => v !== null && v !== undefined && v !== "")
    .map(Number);
}

// audiology is the wizard's form.audiology shape; rightT/leftT are the
// air-conduction threshold maps keyed by frequency.
export function isTestedNoLoss(audiology) {
  if (!audiology) return false;
  const right = enteredThresholds(audiology.rightT);
  const left = enteredThresholds(audiology.leftT);
  if (!right.length || !left.length) return false; // both ears must be tested
  return [...right, ...left].every(v => Number.isFinite(v) && v <= NORMAL_HEARING_MAX_DB);
}

// The annual-retest recall a TNL close schedules: today + 12 months, built in
// local time (same UTC-parse guard as lib/careArc.js — toISOString on a
// UTC-midnight date can render a day early in US timezones).
export const TNL_RETEST_TYPE = "Annual Hearing Retest";
export const TNL_RETEST_NOTE =
  "Baseline within normal limits at last test — annual monitoring retest to track any change year over year.";

export function buildTnlRetestAppointment(fromDate = new Date()) {
  const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  d.setFullYear(d.getFullYear() + 1);
  const pad = n => String(n).padStart(2, "0");
  return {
    type: TNL_RETEST_TYPE,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    note: TNL_RETEST_NOTE,
  };
}
