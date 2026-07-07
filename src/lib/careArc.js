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

// Regimented care arc auto-generated at fitting (backlog #5) — offsets are
// from the fitting date. 21 visits over 4 years: dense follow-ups in the
// acclimatization window, quarterly clean & checks thereafter, annual exams
// absorbing their quarter, and the Year-4 upgrade consultation closing the arc.
// (Extracted from Distil.jsx so the schedule math is unit-testable.)
export const CARE_ARC = [
  { offset: 0,  unit: "days",   type: "Fitting & Orientation",
    note: "Orient the patient on device use and care; program to a comfortable starting level with acclimatization management enabled to ramp amplification toward prescriptive targets over four weeks." },
  { offset: 2,  unit: "days",   type: "Day-2 Follow-Up Call",
    note: "Phone check-in on first impressions, comfort, and any immediate concerns." },
  { offset: 2,  unit: "weeks",  type: "2-Week Follow-Up",
    note: "First in-office fine-tune; review device maintenance and daily care." },
  { offset: 4,  unit: "weeks",  type: "4-Week Follow-Up",
    note: "Perform real-ear measurement; set the acclimatization manager to reach prescriptive targets over the next two weeks." },
  { offset: 6,  unit: "weeks",  type: "6-Week Follow-Up",
    note: "Confirm the patient is comfortable and understanding well before transitioning to the quarterly clean-and-check cadence." },
  { offset: 3,  unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 6,  unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 9,  unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 12, unit: "months", type: "Annual Exam — Year 1",
    note: "Annual audiometric re-evaluation and device performance review (covers this quarter's clean & check)." },
  { offset: 15, unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 18, unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 21, unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 24, unit: "months", type: "Annual Exam — Year 2",
    note: "Annual audiometric re-evaluation and device performance review (covers this quarter's clean & check)." },
  { offset: 27, unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 30, unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 33, unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 36, unit: "months", type: "Annual Exam — Year 3",
    note: "Annual audiometric re-evaluation and device performance review (covers this quarter's clean & check)." },
  { offset: 39, unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 42, unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 45, unit: "months", type: "Quarterly Clean & Check",
    note: "Routine cleaning and performance check." },
  { offset: 48, unit: "months", type: "Year-4 Upgrade Consultation",
    note: "Review device performance and warranty status; discuss upgrade options." },
];

// Expand CARE_ARC into concrete dated appointments (backlog #5). Dates are built
// in local time from the 'YYYY-MM-DD' fitting date to avoid a UTC-parse day skew.
export function buildCareArc(fittingDate) {
  if (!fittingDate) return [];
  const [y, m, day] = String(fittingDate).slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return [];
  const pad = n => String(n).padStart(2, "0");
  return CARE_ARC.map(({ offset, unit, type, note }) => {
    const d = new Date(y, m - 1, day);
    if (unit === "days") d.setDate(d.getDate() + offset);
    else if (unit === "weeks") d.setDate(d.getDate() + offset * 7);
    else if (unit === "months") d.setMonth(d.getMonth() + offset);
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, type, note };
  });
}
