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

// ── COMPLEX-BENEFIT CALCULATOR ──────────────────────────────────────────────
// For the rare (~1–2/month) commercial / PPO / FEP plans that don't fit the
// device-driven copay model (TruHearing / UHCH-MedSupp / Nations). These are
// billed at the clinic's charge and the plan pays part per a Verification of
// Benefits (VOB). Distil CANNOT auto-resolve these — a patient's remaining
// deductible / OOP-max is not knowable from a hearing CRM — so the provider
// enters the VOB numbers from the billing department and this computes the
// patient's out-of-pocket transparently, showing its work.
//
// One model covers every real VOB we've seen (Regence BC/BS, GEHA/UHC, FEP,
// non-Nations Aetna):
//
//   deductible remaining  → patient satisfies it first
//   coinsurance %         → plan pays X% of the amount after the deductible
//   benefit max           → caps the plan's payment (per-ear or combined)
//   OOP-max remaining     → backstop: patient's deductible + coinsurance share
//                           never exceeds it; the plan then covers the rest
//
// A "100% up to $2,025/ear" allowance is just coverage 100% + a per-ear cap —
// no separate allowance rail needed. A `finalOverridePerAid` escape hatch lets
// the provider type the exact patient cost when a VOB doesn't fit the model, so
// we never fight a plan we didn't anticipate.
//
// Money is in DOLLARS here (the UI works in dollars; the db.js boundary handles
// cents). All inputs are provider-entered; nothing is inferred.

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const clampPct = (p) => Math.min(100, Math.max(0, Number(p) || 0));
const nonNeg = (n) => Math.max(0, Number(n) || 0);

// inputs shape (all optional except coveragePercent, which defaults to 0):
//   { coveragePercent, deductibleRemaining, benefitMax, benefitBasis:'combined'|'per_ear',
//     oopMaxRemaining, finalOverridePerAid }
// baselinePerAid = the clinic's per-aid charge for the selected device (retail).
// fittingType = 'binaural' | 'monaural'.
//
// Returns { patientTotal, patientPerAid, insuranceTotal, billedTotal,
//           oopApplied, capApplied, breakdown } — dollars, rounded to cents.
export function computeComplexBenefit({ baselinePerAid, fittingType, inputs } = {}) {
  const nEars = fittingType === 'monaural' ? 1 : 2;
  const per = nonNeg(baselinePerAid);
  const billedTotal = round2(per * nEars);
  const i = inputs || {};

  // Escape hatch: provider typed the exact per-aid patient cost from the VOB.
  if (i.finalOverridePerAid != null && i.finalOverridePerAid !== '') {
    const perAid = nonNeg(i.finalOverridePerAid);
    const total = round2(perAid * nEars);
    return {
      patientTotal: total,
      patientPerAid: round2(perAid),
      insuranceTotal: round2(Math.max(0, billedTotal - total)),
      billedTotal,
      oopApplied: false,
      capApplied: false,
      overridden: true,
      breakdown: [
        { kind: 'billed', label: `Billed (${nEars} aid${nEars > 1 ? 's' : ''})`, amount: billedTotal },
        { kind: 'patient', label: 'Your cost (provider-entered)', amount: total },
      ],
    };
  }

  const pct = clampPct(i.coveragePercent) / 100;
  const dedRem = nonNeg(i.deductibleRemaining);
  const perEar = i.benefitBasis === 'per_ear';
  const hasCap = i.benefitMax != null && i.benefitMax !== '';
  const cap = hasCap ? (perEar ? nonNeg(i.benefitMax) * nEars : nonNeg(i.benefitMax)) : Infinity;

  // 1. Deductible: patient satisfies the remaining deductible out of the bill.
  const dedApplied = Math.min(billedTotal, dedRem);
  const afterDed = billedTotal - dedApplied;

  // 2. Coinsurance on the post-deductible amount, capped at the benefit max.
  const rawInsurance = pct * afterDed;
  const insurancePaid = Math.min(rawInsurance, cap);
  const coinsuranceShare = afterDed - rawInsurance;          // patient's % share (OOP-eligible)
  const overCapExcess = Math.max(0, rawInsurance - cap);     // above the cap (NOT OOP-eligible)
  const capApplied = overCapExcess > 0;

  // 3. OOP-max backstop: the deductible + coinsurance share can't exceed the
  //    patient's remaining OOP max (the plan then covers 100%). The over-cap
  //    excess is the patient's responsibility above the allowed amount and does
  //    NOT count toward OOP.
  const oopEligible = dedApplied + coinsuranceShare;
  let oopEligiblePaid = oopEligible;
  let oopApplied = false;
  if (i.oopMaxRemaining != null && i.oopMaxRemaining !== '') {
    const oopRem = nonNeg(i.oopMaxRemaining);
    if (oopEligible > oopRem) { oopEligiblePaid = oopRem; oopApplied = true; }
  }

  const patientTotal = round2(oopEligiblePaid + overCapExcess);
  const insuranceTotal = round2(Math.max(0, billedTotal - patientTotal));

  const capNote = hasCap
    ? ` up to $${nonNeg(i.benefitMax).toLocaleString('en-US')}${perEar ? '/ear' : ''}`
    : '';
  const breakdown = [
    { kind: 'billed', label: `Billed (${nEars} aid${nEars > 1 ? 's' : ''})`, amount: billedTotal },
  ];
  if (dedApplied > 0) breakdown.push({ kind: 'deduct', label: 'Your deductible (paid first)', amount: dedApplied });
  breakdown.push({ kind: 'plan', label: `Plan pays ${Math.round(pct * 100)}%${capNote}`, amount: insuranceTotal });
  if (oopApplied) breakdown.push({ kind: 'oop', label: 'Out-of-pocket max reached — plan covers the rest', amount: null });
  breakdown.push({ kind: 'patient', label: 'Your cost', amount: patientTotal });

  return { patientTotal, patientPerAid: round2(patientTotal / nEars), insuranceTotal, billedTotal, oopApplied, capApplied, overridden: false, breakdown };
}
