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

// Pure computation behind the Reports view. Consumes appointment_outcomes
// rows (see migration 20260702183612) and produces the July-story metrics:
// device close rate, outcome/reason mix, care-plan attach rate by payer type
// (TPA attach is the headline), and committed revenue / tier mix.
//
// Definitions (deliberate, keep in sync with the view's labels):
// - Close-rate denominator: committed + deferred + declined + no_decision.
//   not_a_candidate (medical referrals out), no_hearing_loss (Tested No Loss —
//   thresholds within normal limits, so no recommendation was ever on the
//   table), did_not_test (the visit ended before testing — wax removal only,
//   patient declined, etc.) and not_applicable are excluded — they are not
//   losable opportunities. TNL and did-not-test visits still show up in the
//   outcome mix as their own categories.
// - Care-plan attach candidates: device committed AND the care-plan layer was
//   in play (≠ not_applicable). Attach = care-plan committed.
// - Revenue: committed device outcomes only, per-aid price from the payer
//   snapshot (never the live patient record) × fitted ears from the linked
//   visit's fitting_type; bilateral is assumed when no fitting is linked and
//   the estimate is flagged.

import { NATIONS_TIER_PRICING } from "../nations_catalog_data.js";

const CLOSABLE = ["committed", "deferred", "declined", "no_decision"];

// Nations clinic-side economics: the member's copay flows to NationsBenefits,
// NOT the clinic — what the clinic earns on a Nations fitting is the per-aid
// FITTING FEE, which slides by tier ($200 Standard … $700 Specialty). Kurt
// (2026-07-10): report fitting fees as true clinic revenue; never surface them
// patient-facing (quotes/PAs/pricing reveal stay copay-only). Returns the
// per-aid fee for an on-plan Nations outcome snapshot, or null for everything
// else — including Nations OFF-plan sales ("Off-Plan" tier), where the patient
// pays the clinic standard retail directly and no TPA fee applies.
export function nationsFittingFeePerAid(snap = {}) {
  if (snap?.tpa !== "Nations") return null;
  // NATIONS_TIER_PRICING is the Aetna · Nations Hearing fee schedule. Other
  // NationsBenefits plans (Molina Medicare Complete Care) rename the rungs —
  // Molina's 'Advanced'/'Premium' are different rungs than Aetna's — and carry
  // their own, still-unknown fee schedules, so only apply this table to the
  // Aetna plan. A missing plan_group is a legacy snapshot from before Molina
  // existed, i.e. Aetna. Molina commits report no fee until its schedule lands.
  if (snap.plan_group && snap.plan_group !== "Nations Hearing") return null;
  return NATIONS_TIER_PRICING[snap.tier]?.fittingFeePerAid ?? null;
}

function rate(closed, denominator) {
  return denominator > 0 ? closed / denominator : null;
}

function tally(map, key) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

export function computeReportStats(outcomes = [], fittingTypeByVisit = {}) {
  const deviceMix = {};
  const deviceReasons = {};
  const byContext = {};
  let closed = 0, denominator = 0;

  const carePlanByPayer = {
    tpa:             { candidates: 0, attached: 0 },
    direct_purchase: { candidates: 0, attached: 0 }, // TruHearing benefit sold private at the TPA price
    other_insurance: { candidates: 0, attached: 0 },
    private_pay:     { candidates: 0, attached: 0 },
  };
  const carePlanSelectedMix = {};
  const carePlanReasons = {};

  let deviceRevenue = 0;
  let carePlanRevenue = 0;    // committed care plans, priced by CARE_PLAN_REVENUE
  let carePlanCount = 0;      // how many committed care plans contributed revenue
  let revenueCount = 0;       // committed outcomes with a priced device snapshot
  let estimatedAidCount = 0;  // of those, how many assumed bilateral (no linked fitting)
  let unpricedCount = 0;      // committed outcomes with no per-aid price in the snapshot
  const tierMix = {};
  const payerMix = {};
  // Nations clinic revenue (fitting fees) — see nationsFittingFeePerAid.
  // memberCopays = the Nations on-plan copay dollars inside deviceRevenue,
  // so the view can say how much of the headline flows to the TPA instead.
  const nationsFees = { revenue: 0, count: 0, estimatedAidCount: 0, memberCopays: 0 };

  for (const o of outcomes) {
    tally(deviceMix, o.device_disposition);
    tally(payerMix, o.payer_type);
    if (o.device_reason) tally(deviceReasons, o.device_reason);

    const closable = CLOSABLE.includes(o.device_disposition);
    if (closable) {
      denominator++;
      const ctx = (byContext[o.context] ||= { closed: 0, denominator: 0 });
      ctx.denominator++;
      if (o.device_disposition === "committed") { closed++; ctx.closed++; }
    }

    // Care-plan layer
    if (o.device_disposition === "committed" && o.care_plan_disposition !== "not_applicable") {
      const payer = carePlanByPayer[o.payer_type];
      if (payer) {
        payer.candidates++;
        if (o.care_plan_disposition === "committed") payer.attached++;
      }
    }
    if (o.care_plan_disposition === "committed") tally(carePlanSelectedMix, o.care_plan_selected);
    if (o.care_plan_reason) tally(carePlanReasons, o.care_plan_reason);

    // Device revenue + tier mix (committed devices only, snapshot prices only)
    if (o.device_disposition === "committed") {
      const snap = o.payer_plan_snapshot || {};
      const perAid = snap.tier_price_per_aid ?? snap.private_pay_price_per_aid ?? null;
      tally(tierMix, snap.tier ?? snap.private_pay_tier ?? "(no tier)");
      const fittingType = o.visit_id ? fittingTypeByVisit[o.visit_id] : null;
      const aids = fittingType ? (fittingType === "bilateral" ? 2 : 1) : 2;
      if (perAid != null) {
        if (!fittingType) estimatedAidCount++;
        deviceRevenue += perAid * aids;
        revenueCount++;
      } else {
        unpricedCount++;
      }
      // Nations fitting fees accrue independently of the copay being priced —
      // the fee schedule is keyed on the snapshot tier alone.
      const fee = nationsFittingFeePerAid(snap);
      if (fee != null) {
        nationsFees.revenue += fee * aids;
        nationsFees.count++;
        if (!fittingType) nationsFees.estimatedAidCount++;
        if (perAid != null) nationsFees.memberCopays += perAid * aids;
      }
    }

    // Care-plan revenue — a committed care plan is its own purchase, counted
    // regardless of device disposition (care-plan-only visits included).
    const cpr = carePlanRevenueOf(o);
    if (cpr > 0) { carePlanRevenue += cpr; carePlanCount++; }
  }

  const overallCandidates = Object.values(carePlanByPayer).reduce((a, p) => a + p.candidates, 0);
  const overallAttached  = Object.values(carePlanByPayer).reduce((a, p) => a + p.attached, 0);

  return {
    total: outcomes.length,
    closeRate: { closed, denominator, rate: rate(closed, denominator) },
    byContext: Object.fromEntries(
      Object.entries(byContext).map(([k, v]) => [k, { ...v, rate: rate(v.closed, v.denominator) }])
    ),
    deviceMix,
    deviceReasons,
    carePlan: {
      byPayer: Object.fromEntries(
        Object.entries(carePlanByPayer).map(([k, v]) => [k, { ...v, rate: rate(v.attached, v.candidates) }])
      ),
      overall: { candidates: overallCandidates, attached: overallAttached, rate: rate(overallAttached, overallCandidates) },
      selectedMix: carePlanSelectedMix,
      reasons: carePlanReasons,
    },
    revenue: {
      committedRevenue: deviceRevenue + carePlanRevenue, // headline = devices + care plans
      deviceRevenue,
      carePlanRevenue,
      carePlanCount,
      revenueCount,
      estimatedAidCount,
      unpricedCount,
      nationsFittingFees: nationsFees,
      tierMix,
      payerMix,
    },
  };
}

// Follow-up loop: is contacting queue patients actually converting? Buckets
// are counted with the caller-supplied classify fn (FollowUpQueue's, so the
// definition of "needs follow-up" lives in exactly one place). Conversion:
// a patient contacted in range whose chart logged an appointment outcome ON
// OR AFTER the contact stamp — committed device = the win condition.
export function computeFollowUpStats(patients = [], outcomes = [], { from = null, classify = null } = {}) {
  const buckets = {};
  if (classify) {
    for (const p of patients) {
      const primary = classify(p)?.primary;
      if (primary) tally(buckets, primary);
    }
  }

  const outcomesByPatient = {};
  for (const o of outcomes) {
    if (o.patient_id) (outcomesByPatient[o.patient_id] ||= []).push(o);
  }

  let contacted = 0, withOutcome = 0, committed = 0;
  for (const p of patients) {
    const at = p.followUpContactedAt ? new Date(p.followUpContactedAt) : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    if (from && at < from) continue;
    contacted++;
    const after = (outcomesByPatient[p.id] || []).filter(o => new Date(o.closed_at) >= at);
    if (after.length) {
      withOutcome++;
      if (after.some(o => o.device_disposition === "committed")) committed++;
    }
  }

  return { buckets, contacted, withOutcome, committed };
}

// ── Drill-down selectors ────────────────────────────────────────────────
// Every number on the Reports dashboard is a roll-up of the SAME rows the
// dashboard already loaded. These pure selectors "open" a roll-up back into
// the underlying patients/transactions (no refetch) plus a small recomputed
// metric block, so a detail page can never disagree with the card it came
// from. Kept here (not in the view) so the filtering math is unit-tested.

function snapTier(o) {
  const snap = o.payer_plan_snapshot || {};
  return snap.tier ?? snap.private_pay_tier ?? "(no tier)";
}
function snapPerAid(o) {
  const snap = o.payer_plan_snapshot || {};
  return snap.tier_price_per_aid ?? snap.private_pay_price_per_aid ?? null;
}

// Care-plan revenue by app care-plan key. Flat per-transaction charges (per
// patient, not per aid). Complete Care+ on a PRIVATE-PAY sale is already
// bundled into the per-aid device retail (generateQuote private-pay path:
// "Complete Care+ is bundled into the per-aid retail price"), so it adds
// nothing on top there; on insurance/TPA sales it's a separate purchase. The
// MHC Care Card ('punch') is always a separate purchase.
export const CARE_PLAN_REVENUE = { complete: 1250, punch: 575, paygo: 0 };

export function carePlanRevenueOf(o = {}) {
  if (o.care_plan_disposition !== "committed") return 0;
  if (o.care_plan_selected === "complete" && o.payer_type === "private_pay") return 0;
  return CARE_PLAN_REVENUE[o.care_plan_selected] || 0;
}

// One appointment_outcomes row → a flat display transaction. The revenue math
// mirrors computeReportStats exactly (snapshot per-aid price × fitted ears,
// bilateral assumed when no fitting is linked) so a drilled row's revenue
// sums back to the committed-revenue card. patient/outcome_clinic are the
// embeds added by loadAppointmentOutcomes.
export function toTransaction(o = {}, fittingTypeByVisit = {}) {
  const perAid = snapPerAid(o);
  const committed = o.device_disposition === "committed";
  let aids = null, aidsEstimated = false, deviceRevenue = 0, nationsFittingFee = 0;
  if (committed && perAid != null) {
    const ft = o.visit_id ? fittingTypeByVisit[o.visit_id] : null;
    if (ft) aids = ft === "bilateral" ? 2 : 1;
    else { aids = 2; aidsEstimated = true; }
    deviceRevenue = perAid * aids;
  }
  // Clinic-side Nations economics (fitting fee × aids); 0 for everything else.
  if (committed) {
    const fee = nationsFittingFeePerAid(o.payer_plan_snapshot || {});
    if (fee != null) {
      const ft = o.visit_id ? fittingTypeByVisit[o.visit_id] : null;
      nationsFittingFee = fee * (ft ? (ft === "bilateral" ? 2 : 1) : 2);
    }
  }
  const carePlanRevenue = carePlanRevenueOf(o);
  const pt = o.patient || null;
  const patientName = pt ? [pt.first_name, pt.last_name].filter(Boolean).join(" ") : null;
  return {
    id: o.id,
    patientId: o.patient_id,
    patientName: patientName || null,
    clinicName: o.outcome_clinic?.name || null,
    closedAt: o.closed_at,
    context: o.context,
    deviceDisposition: o.device_disposition,
    deviceReason: o.device_reason,
    carePlanDisposition: o.care_plan_disposition,
    carePlanSelected: o.care_plan_selected,
    carePlanReason: o.care_plan_reason,
    payerType: o.payer_type,
    payerName: o.payer_name,
    tier: snapTier(o) === "(no tier)" ? null : snapTier(o),
    perAid,
    aids,
    aidsEstimated,
    deviceRevenue,
    carePlanRevenue,
    nationsFittingFee,
    revenue: deviceRevenue + carePlanRevenue,
  };
}

// Predicate for an outcomes-sourced drill. `kind` names a dashboard element;
// `value` narrows within it (a disposition, reason, payer, tier, …). Each
// predicate reproduces the membership rule the matching roll-up used.
export function outcomePredicate({ kind, value } = {}) {
  switch (kind) {
    case "all":                return () => true;
    case "close_rate":         return (o) => CLOSABLE.includes(o.device_disposition);
    case "committed":          return (o) => o.device_disposition === "committed";
    case "device_disposition": return (o) => o.device_disposition === value;
    case "device_reason":      return (o) => o.device_reason === value;
    case "careplan_payer":     return (o) => o.device_disposition === "committed" && o.care_plan_disposition !== "not_applicable" && o.payer_type === value;
    case "tpa_attach":         return (o) => o.device_disposition === "committed" && o.care_plan_disposition !== "not_applicable" && o.payer_type === "tpa";
    case "careplan_selected":  return (o) => o.care_plan_disposition === "committed" && o.care_plan_selected === value;
    case "tier":               return (o) => o.device_disposition === "committed" && snapTier(o) === value;
    case "revenue":            return (o) => (o.device_disposition === "committed" && snapPerAid(o) != null) || carePlanRevenueOf(o) > 0;
    default:                   return () => false;
  }
}

// Filter → normalize → sort (newest close first) + a recomputed metric block.
// `committed`/`attached`/`revenue` cover every headline a caller might front:
// close-rate uses committed÷count, TPA attach uses attached÷count, revenue
// uses the sum.
export function selectOutcomeDrill(outcomes = [], drill = {}, fittingTypeByVisit = {}) {
  const pred = outcomePredicate(drill);
  const rows = outcomes
    .filter(pred)
    .map((o) => toTransaction(o, fittingTypeByVisit))
    .sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0));
  const committed = rows.filter((r) => r.deviceDisposition === "committed").length;
  const attached  = rows.filter((r) => r.carePlanDisposition === "committed").length;
  const revenue   = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  return { rows, count: rows.length, committed, attached, revenue, rate: rate(committed, rows.length) };
}

// Follow-up drill. `followup_bucket` lists patients whose PRIMARY bucket is
// value (using the caller's classify — one definition of "needs follow-up").
// `followup_contacted` / `followup_withOutcome` / `followup_committed` list
// patients contacted in range, narrowed by conversion progress. Conversion
// mirrors computeFollowUpStats: an outcome closed on/after the contact stamp.
export function selectFollowUpDrill(patients = [], drill = {}, { classify = null, from = null, outcomes = [] } = {}) {
  const { kind, value } = drill;
  const outcomesByPatient = {};
  for (const o of outcomes) if (o.patient_id) (outcomesByPatient[o.patient_id] ||= []).push(o);

  const contactInfo = (p) => {
    const raw = p.followUpContactedAt ? new Date(p.followUpContactedAt) : null;
    const at = raw && !Number.isNaN(raw.getTime()) ? raw : null;
    const inRange = !!at && (!from || at >= from);
    const after = at ? (outcomesByPatient[p.id] || []).filter((o) => new Date(o.closed_at) >= at) : [];
    return { at, inRange, withOutcome: after.length > 0, committed: after.some((o) => o.device_disposition === "committed") };
  };

  const row = (p, bucket, ci) => ({
    id: p.id,
    name: p.name || null,
    bucket: bucket || null,
    warrantyExpiry: p.devices?.warrantyExpiry || null,
    fittingDate: p.devices?.fittingDate || null,
    lastVisitDate: p.lastVisitDate || null,
    contactedAt: ci.at ? ci.at.toISOString() : null,
    withOutcome: ci.withOutcome,
    committed: ci.committed,
  });

  const rows = [];
  for (const p of patients) {
    const primary = classify ? classify(p)?.primary : null;
    if (kind === "followup_bucket") {
      if (primary === value) rows.push(row(p, primary, contactInfo(p)));
    } else {
      const ci = contactInfo(p);
      if (!ci.inRange) continue;
      if (kind === "followup_withOutcome" && !ci.withOutcome) continue;
      if (kind === "followup_committed" && !ci.committed) continue;
      rows.push(row(p, primary, ci));
    }
  }
  rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return { rows, count: rows.length };
}

// Adjustment drill: the provider's own price_adjustment_log rows, filtered to
// the range (and optionally one reason_code), newest first. Rows are returned
// raw — the detail view already knows the log shape.
export function selectAdjustmentDrill(rows = [], drill = {}, { from = null } = {}) {
  const { value } = drill;
  const tsOf = (r) => r.created_at || r.timestamp || r.logged_at || r.inserted_at || null;
  const out = rows.filter((r) => {
    if (value && r.reason_code !== value) return false;
    if (from) {
      const ts = tsOf(r);
      if (ts && new Date(ts) < from) return false;
    }
    return true;
  });
  out.sort((a, b) => new Date(tsOf(b) || 0) - new Date(tsOf(a) || 0));
  return { rows: out, count: out.length };
}

// ── CSV helpers (shared by the detail-page export) ──────────────────────
// RFC-4180-ish: quote any field containing a comma, quote, or newline, and
// double embedded quotes. Rows joined with CRLF for Excel.
export function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(headers, records) {
  return [headers, ...records].map(row => row.map(csvEscape).join(",")).join("\r\n");
}

// Price-adjustment summary from price_adjustment_log rows. delta_amount /
// delta_percent are GENERATED columns; fall back to computing from the raw
// prices in case older rows predate them.
export function computeAdjustmentStats(rows = []) {
  let count = 0, totalDiscount = 0, percentSum = 0, percentCount = 0;
  const byReason = {};
  for (const r of rows) {
    const original = Number(r.original_price);
    const adjusted = Number(r.adjusted_price);
    const delta = r.delta_amount != null ? Number(r.delta_amount)
      : (Number.isFinite(original) && Number.isFinite(adjusted) ? adjusted - original : null);
    if (delta == null) continue;
    count++;
    totalDiscount += -delta; // discounts are negative deltas; report as positive dollars given away
    const pct = r.delta_percent != null ? Number(r.delta_percent)
      : (Number.isFinite(original) && original !== 0 ? (delta / original) * 100 : null);
    if (pct != null && Number.isFinite(pct)) { percentSum += pct; percentCount++; }
    tally(byReason, r.reason_code);
  }
  return {
    count,
    totalDiscount,
    avgPercent: percentCount ? percentSum / percentCount : null,
    byReason,
  };
}
