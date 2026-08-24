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

// Financing terms + payment math, extracted from components/FinancingCalculator.jsx
// (backlog #16 §8) so the patient-facing pricing-reveal calculator and the
// provider-facing Device Selection payment-options panel share one source of
// truth. Terms are the clinic's CareCredit / Allegro menu (Kurt, 2026-06-30):
//   • 6 / 12 / 18 mo — DEFERRED INTEREST: 0% *only* if the full balance is paid
//     within the promo window; otherwise interest is charged retroactively from
//     the purchase date at 32.99% APR (the deferred-interest "gotcha").
//   • 24 / 36 / 48 mo — fixed installment APRs (the "equal pay" plans).
//   • 60 mo — fixed, only on financed amounts of $2,500+.
// HealthiPlan is named in the §8 spec but its terms are not on file — do NOT
// invent rows for it; add them here when Kurt supplies the menu.

export const FINANCING_TERMS = [
  { months: 6,  kind: "deferred", apr: 0 },
  { months: 12, kind: "deferred", apr: 0 },
  { months: 18, kind: "deferred", apr: 0 },
  { months: 24, kind: "fixed", apr: 17.90 },
  { months: 36, kind: "fixed", apr: 18.90 },
  { months: 48, kind: "fixed", apr: 19.90 },
  { months: 60, kind: "fixed", apr: 20.90, minTotal: 2500 },
];
export const DEFERRED_RETRO_APR = 32.99;

// Standard amortized monthly payment: M = P·r / (1 − (1+r)^−n), r = APR/12.
// Returns { monthly, total, interest }.
export function fixedSchedule(principal, apr, months) {
  const r = apr / 1200;
  const monthly = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
  const total = monthly * months;
  return { monthly, total, interest: total - principal };
}

// Terms available for a given financed amount (the 60-mo plan gates on $2,500+).
export function eligibleTerms(amount) {
  return FINANCING_TERMS.filter((t) => !t.minTotal || amount >= t.minTotal);
}

// Payment schedule for one term row. Deferred plans display the pay-in-full
// path (balance ÷ months, zero interest) — the retroactive charge is a
// warning, never a projection.
export function scheduleForTerm(amount, term) {
  return term.kind === "deferred"
    ? { monthly: amount / term.months, total: amount, interest: 0 }
    : fixedSchedule(amount, term.apr, term.months);
}
