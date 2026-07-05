// Pure computation behind the Reports view. Consumes appointment_outcomes
// rows (see migration 20260702183612) and produces the July-story metrics:
// device close rate, outcome/reason mix, care-plan attach rate by payer type
// (TPA attach is the headline), and committed revenue / tier mix.
//
// Definitions (deliberate, keep in sync with the view's labels):
// - Close-rate denominator: committed + deferred + declined + no_decision.
//   not_a_candidate (medical referrals out) and not_applicable are excluded —
//   they are not losable opportunities.
// - Care-plan attach candidates: device committed AND the care-plan layer was
//   in play (≠ not_applicable). Attach = care-plan committed.
// - Revenue: committed device outcomes only, per-aid price from the payer
//   snapshot (never the live patient record) × fitted ears from the linked
//   visit's fitting_type; bilateral is assumed when no fitting is linked and
//   the estimate is flagged.

const CLOSABLE = ["committed", "deferred", "declined", "no_decision"];

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
    other_insurance: { candidates: 0, attached: 0 },
    private_pay:     { candidates: 0, attached: 0 },
  };
  const carePlanSelectedMix = {};
  const carePlanReasons = {};

  let committedRevenue = 0;
  let revenueCount = 0;       // committed outcomes with a priced snapshot
  let estimatedAidCount = 0;  // of those, how many assumed bilateral (no linked fitting)
  let unpricedCount = 0;      // committed outcomes with no per-aid price in the snapshot
  const tierMix = {};
  const payerMix = {};

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

    // Revenue + tier mix (committed devices only, snapshot prices only)
    if (o.device_disposition === "committed") {
      const snap = o.payer_plan_snapshot || {};
      const perAid = snap.tier_price_per_aid ?? snap.private_pay_price_per_aid ?? null;
      tally(tierMix, snap.tier ?? snap.private_pay_tier ?? "(no tier)");
      if (perAid != null) {
        const fittingType = o.visit_id ? fittingTypeByVisit[o.visit_id] : null;
        let aids;
        if (fittingType) aids = fittingType === "bilateral" ? 2 : 1;
        else { aids = 2; estimatedAidCount++; }
        committedRevenue += perAid * aids;
        revenueCount++;
      } else {
        unpricedCount++;
      }
    }
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
      committedRevenue,
      revenueCount,
      estimatedAidCount,
      unpricedCount,
      tierMix,
      payerMix,
    },
  };
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
