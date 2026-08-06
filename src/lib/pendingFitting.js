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

// Pending-fittings model. A signed purchase agreement creates a PENDING
// fitting: the sale is closed but the devices haven't been delivered. The
// fitting date on a pending record is an ESTIMATE (signing + lead time) used
// for scheduling display only; the authoritative date is stamped when the
// fitting is confirmed from the Pending Fittings queue, and every downstream
// clock — warranty expiry, the regimented care arc, nurture-campaign
// enrollment, care_plan_start_date — starts from that confirmed date.

// Typical order-to-delivery turnaround. Matches the +14-day estimate the
// wizard has always used for its warranty-start guess.
export const ESTIMATED_FIT_LEAD_DAYS = 14;

// Devices that sit in the queue longer than this are probably stuck in
// ordering/shipping — the queue flags them for a status call.
export const FITTING_OVERDUE_DAYS = 21;

// 'YYYY-MM-DD' signing date -> 'YYYY-MM-DD' estimated fit date, built in
// local time to avoid the UTC-parse day skew (same rule as lib/careArc.js).
export function estimateFitDate(signedDate, leadDays = ESTIMATED_FIT_LEAD_DAYS) {
  if (!signedDate) return null;
  const [y, m, day] = String(signedDate).slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return null;
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + leadDays);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Warranty term captured at signing. Complete Care+ extends the manufacturer
// warranty to 4 years, and private pay bundles Complete Care+ — so both get
// 4; everything else gets the 3-year manufacturer term. Mirrors
// CARE_PLAN_META in generatePurchaseAgreement.js (the printed agreement).
export function warrantyYearsFor(payType, carePlan) {
  return (payType === "private" || carePlan === "complete") ? 4 : 3;
}

// Why a pending sale was cancelled before the fitting. Keys mirror the
// device_fittings_cancel_reason_check DB constraint — change both together.
export const CANCEL_REASONS = [
  { id: "changed_mind",           label: "Patient changed their mind" },
  { id: "financing_fell_through", label: "Financing fell through" },
  { id: "insurance_issue",        label: "Insurance issue / benefit denied" },
  { id: "medical",                label: "Medical reason" },
  { id: "moved_relocated",        label: "Moved / transferred care" },
  { id: "deceased",               label: "Patient deceased" },
  { id: "other",                  label: "Other" },
];
