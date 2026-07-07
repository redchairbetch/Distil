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

// One appointment_outcomes row → a flat display transaction. The revenue math
// mirrors computeReportStats exactly (snapshot per-aid price × fitted ears,
// bilateral assumed when no fitting is linked) so a drilled row's revenue
// sums back to the committed-revenue card. patient/outcome_clinic are the
// embeds added by loadAppointmentOutcomes.
export function toTransaction(o = {}, fittingTypeByVisit = {}) {
  const perAid = snapPerAid(o);
  const committed = o.device_disposition === "committed";
  let aids = null, aidsEstimated = false, revenue = null;
  if (committed && perAid != null) {
    const ft = o.visit_id ? fittingTypeByVisit[o.visit_id] : null;
    if (ft) aids = ft === "bilateral" ? 2 : 1;
    else { aids = 2; aidsEstimated = true; }
    revenue = perAid * aids;
  }
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
    revenue,
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
    case "revenue":            return (o) => o.device_disposition === "committed" && snapPerAid(o) != null;
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
