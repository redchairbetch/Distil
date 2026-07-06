import { describe, it, expect } from "vitest";
import { computeReportStats, computeAdjustmentStats, computeFollowUpStats } from "./reportStats.js";

// Outcome-row factory in the appointment_outcomes DB shape.
function outcome(over = {}) {
  return {
    context: "new_fit",
    device_disposition: "committed",
    device_reason: null,
    care_plan_disposition: "committed",
    care_plan_reason: null,
    care_plan_selected: "complete",
    payer_type: "tpa",
    payer_name: "TruHearing",
    payer_plan_snapshot: { tier: "Premium", tier_price_per_aid: 999 },
    visit_id: null,
    ...over,
  };
}

describe("computeReportStats — close rate", () => {
  it("counts committed over closable dispositions only", () => {
    const stats = computeReportStats([
      outcome(),                                                            // committed
      outcome({ device_disposition: "deferred", device_reason: "wants_to_think", care_plan_disposition: "not_applicable", care_plan_selected: null }),
      outcome({ device_disposition: "declined", device_reason: "price_budget", care_plan_disposition: "not_applicable", care_plan_selected: null }),
      outcome({ device_disposition: "no_decision", care_plan_disposition: "not_applicable", care_plan_selected: null }),
      outcome({ device_disposition: "not_a_candidate", care_plan_disposition: "not_applicable", care_plan_selected: null }), // excluded from denominator
    ]);
    expect(stats.closeRate).toEqual({ closed: 1, denominator: 4, rate: 0.25 });
    expect(stats.deviceMix.not_a_candidate).toBe(1);
    expect(stats.deviceReasons).toEqual({ wants_to_think: 1, price_budget: 1 });
  });

  it("splits close rate by context", () => {
    const stats = computeReportStats([
      outcome({ context: "new_fit" }),
      outcome({ context: "upgrade", device_disposition: "declined", device_reason: "satisfied_with_current_devices", care_plan_disposition: "not_applicable", care_plan_selected: null }),
      outcome({ context: "upgrade" }),
    ]);
    expect(stats.byContext.new_fit).toEqual({ closed: 1, denominator: 1, rate: 1 });
    expect(stats.byContext.upgrade.rate).toBe(0.5);
  });

  it("returns null rate on an empty range instead of NaN", () => {
    const stats = computeReportStats([]);
    expect(stats.closeRate.rate).toBeNull();
    expect(stats.total).toBe(0);
  });
});

describe("computeReportStats — TPA care-plan attach (the headline)", () => {
  it("counts candidates only where devices committed and care plan was in play", () => {
    const stats = computeReportStats([
      outcome(),                                                             // TPA, attached
      outcome({ care_plan_disposition: "declined", care_plan_reason: "price_budget", care_plan_selected: null }), // TPA candidate, not attached
      outcome({ device_disposition: "declined", device_reason: "price_budget", care_plan_disposition: "not_applicable", care_plan_selected: null }), // device lost — not a candidate
      outcome({ care_plan_disposition: "not_applicable", care_plan_selected: null }),  // care plan not in play — not a candidate
      outcome({ payer_type: "private_pay", payer_name: null, payer_plan_snapshot: { private_pay_tier: "Advanced", private_pay_price_per_aid: 3497.5 } }), // private candidate, attached
    ]);
    expect(stats.carePlan.byPayer.tpa).toEqual({ candidates: 2, attached: 1, rate: 0.5 });
    expect(stats.carePlan.byPayer.private_pay.rate).toBe(1);
    expect(stats.carePlan.overall).toEqual({ candidates: 3, attached: 2, rate: 2 / 3 });
    expect(stats.carePlan.reasons.price_budget).toBe(1);
  });

  it("tracks which care plan was selected", () => {
    const stats = computeReportStats([
      outcome({ care_plan_selected: "complete" }),
      outcome({ care_plan_selected: "complete" }),
      outcome({ care_plan_selected: "punch" }),
    ]);
    expect(stats.carePlan.selectedMix).toEqual({ complete: 2, punch: 1 });
  });
});

describe("computeReportStats — revenue & tier mix", () => {
  it("prices from the snapshot × fitted ears, assuming bilateral when unlinked", () => {
    const stats = computeReportStats(
      [
        outcome({ visit_id: "v1" }),                      // bilateral → 999 × 2
        outcome({ visit_id: "v2" }),                      // unilateral → 999 × 1
        outcome(),                                        // no visit → assume 2, flagged
        outcome({ payer_plan_snapshot: {} }),             // committed but unpriced
        outcome({ device_disposition: "declined", device_reason: "price_budget", care_plan_disposition: "not_applicable", care_plan_selected: null }), // not committed — no revenue
      ],
      { v1: "bilateral", v2: "unilateral" }
    );
    expect(stats.revenue.committedRevenue).toBe(999 * 2 + 999 + 999 * 2);
    expect(stats.revenue.revenueCount).toBe(3);
    expect(stats.revenue.estimatedAidCount).toBe(1);
    expect(stats.revenue.unpricedCount).toBe(1);
  });

  it("builds tier and payer mixes from snapshots, not live records", () => {
    const stats = computeReportStats([
      outcome(),
      outcome({ payer_type: "private_pay", payer_plan_snapshot: { private_pay_tier: "Advanced", private_pay_price_per_aid: 3497.5 } }),
      outcome({ payer_plan_snapshot: {} }),
    ]);
    expect(stats.revenue.tierMix).toEqual({ Premium: 1, Advanced: 1, "(no tier)": 1 });
    expect(stats.revenue.payerMix).toEqual({ tpa: 2, private_pay: 1 });
  });
});

describe("computeFollowUpStats", () => {
  // Stub classify: bucket comes straight off the patient fixture.
  const classify = (p) => ({ primary: p.flag || null });

  it("counts buckets via the supplied classify and conversions after contact", () => {
    const patients = [
      { id: "p1", flag: "warranty_expiring", followUpContactedAt: "2026-07-01T10:00:00Z" },
      { id: "p2", flag: "stale_visit", followUpContactedAt: "2026-07-02T10:00:00Z" },
      { id: "p3", flag: null, followUpContactedAt: null },              // never contacted
      { id: "p4", flag: "stale_visit", followUpContactedAt: "2026-05-01T10:00:00Z" }, // contacted before range
    ];
    const outcomes = [
      { patient_id: "p1", closed_at: "2026-07-03T10:00:00Z", device_disposition: "committed" }, // after contact → converted
      { patient_id: "p2", closed_at: "2026-06-01T10:00:00Z", device_disposition: "committed" }, // BEFORE contact → doesn't count
      { patient_id: "p4", closed_at: "2026-07-01T10:00:00Z", device_disposition: "declined" },
    ];
    const stats = computeFollowUpStats(patients, outcomes, { from: new Date("2026-06-15"), classify });
    expect(stats.buckets).toEqual({ warranty_expiring: 1, stale_visit: 2 });
    expect(stats.contacted).toBe(2);       // p1 + p2 (p4 outside range)
    expect(stats.withOutcome).toBe(1);     // only p1's outcome follows its contact
    expect(stats.committed).toBe(1);
  });

  it("counts non-committed outcomes as contact-resolved but not won", () => {
    const patients = [{ id: "p1", followUpContactedAt: "2026-07-01T00:00:00Z" }];
    const outcomes = [{ patient_id: "p1", closed_at: "2026-07-02T00:00:00Z", device_disposition: "declined" }];
    const stats = computeFollowUpStats(patients, outcomes, {});
    expect(stats).toMatchObject({ contacted: 1, withOutcome: 1, committed: 0 });
  });

  it("handles empty inputs", () => {
    expect(computeFollowUpStats([], [], {})).toEqual({ buckets: {}, contacted: 0, withOutcome: 0, committed: 0 });
  });
});

describe("computeAdjustmentStats", () => {
  it("uses generated columns when present, falls back to raw prices", () => {
    const stats = computeAdjustmentStats([
      { original_price: 1000, adjusted_price: 900, delta_amount: -100, delta_percent: -10, reason_code: "price_match" },
      { original_price: 2000, adjusted_price: 1800, reason_code: "hardship" }, // no generated cols
    ]);
    expect(stats.count).toBe(2);
    expect(stats.totalDiscount).toBe(300);
    expect(stats.avgPercent).toBe(-10);
    expect(stats.byReason).toEqual({ price_match: 1, hardship: 1 });
  });

  it("handles empty input", () => {
    expect(computeAdjustmentStats([])).toEqual({ count: 0, totalDiscount: 0, avgPercent: null, byReason: {} });
  });
});
