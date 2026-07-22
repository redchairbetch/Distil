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

import { describe, it, expect } from "vitest";
import {
  computeReportStats, computeAdjustmentStats, computeFollowUpStats,
  toTransaction, outcomePredicate, selectOutcomeDrill, selectFollowUpDrill, selectAdjustmentDrill,
  csvEscape, toCsv,
} from "./reportStats.js";

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

  it("excludes Tested No Loss from the denominator but keeps it in the mix", () => {
    const stats = computeReportStats([
      outcome(),                                                            // committed
      outcome({ device_disposition: "no_hearing_loss", care_plan_disposition: "not_applicable", care_plan_selected: null }),
    ]);
    // Normal hearing = never a losable opportunity — the close rate stays 1/1.
    expect(stats.closeRate).toEqual({ closed: 1, denominator: 1, rate: 1 });
    expect(stats.deviceMix.no_hearing_loss).toBe(1);
  });

  it("excludes Did Not Test from the denominator but keeps it and its reason in the mix", () => {
    const stats = computeReportStats([
      outcome(),                                                            // committed
      outcome({ device_disposition: "did_not_test", device_reason: "cerumen_management_only", care_plan_disposition: "not_applicable", care_plan_selected: null }),
    ]);
    // No test = no recommendation was ever on the table — the close rate stays 1/1.
    expect(stats.closeRate).toEqual({ closed: 1, denominator: 1, rate: 1 });
    expect(stats.deviceMix.did_not_test).toBe(1);
    expect(stats.deviceReasons.cerumen_management_only).toBe(1);
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

  it("tracks Direct Purchase as its own attach bucket and counts CC+ like a TPA sale", () => {
    const stats = computeReportStats([
      outcome({ payer_type: "direct_purchase", payer_name: "TruHearing (direct)" }),                         // attached
      outcome({ payer_type: "direct_purchase", care_plan_disposition: "declined", care_plan_reason: "price_budget", care_plan_selected: null }), // candidate, not attached
    ]);
    expect(stats.carePlan.byPayer.direct_purchase).toEqual({ candidates: 2, attached: 1, rate: 0.5 });
    // Complete Care+ on a Direct Purchase is a separate charge (not bundled) → counts.
    expect(stats.revenue.carePlanRevenue).toBe(1250);
    expect(stats.carePlan.byPayer.private_pay).toEqual({ candidates: 0, attached: 0, rate: null });
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
  it("prices devices from the snapshot × fitted ears, assuming bilateral when unlinked", () => {
    const stats = computeReportStats(
      [
        outcome({ visit_id: "v1" }),                      // bilateral → 999 × 2
        outcome({ visit_id: "v2" }),                      // unilateral → 999 × 1
        outcome(),                                        // no visit → assume 2, flagged
        outcome({ payer_plan_snapshot: {} }),             // committed but unpriced device
        outcome({ device_disposition: "declined", device_reason: "price_budget", care_plan_disposition: "not_applicable", care_plan_selected: null }), // not committed — no device revenue
      ],
      { v1: "bilateral", v2: "unilateral" }
    );
    // Devices: bilateral + unilateral + assumed-bilateral (the unpriced row adds nothing).
    expect(stats.revenue.deviceRevenue).toBe(999 * 2 + 999 + 999 * 2);
    // Care plans: the four committed Complete Care+ (all TPA → separate charge).
    expect(stats.revenue.carePlanRevenue).toBe(1250 * 4);
    expect(stats.revenue.carePlanCount).toBe(4);
    // Headline folds both together.
    expect(stats.revenue.committedRevenue).toBe(999 * 2 + 999 + 999 * 2 + 1250 * 4);
    expect(stats.revenue.revenueCount).toBe(3);
    expect(stats.revenue.estimatedAidCount).toBe(1);
    expect(stats.revenue.unpricedCount).toBe(1);
  });

  it("counts care-plan revenue as a separate purchase, except bundled private-pay Complete Care+", () => {
    const stats = computeReportStats([
      outcome(),                                                                    // TPA + Complete Care+ → +1250
      outcome({ care_plan_selected: "punch" }),                                     // TPA + MHC Care Card → +575
      outcome({ payer_type: "private_pay", payer_plan_snapshot: { private_pay_tier: "Advanced", private_pay_price_per_aid: 3000 } }),               // private + CC+ bundled → +0
      outcome({ payer_type: "private_pay", care_plan_selected: "punch", payer_plan_snapshot: { private_pay_tier: "Advanced", private_pay_price_per_aid: 3000 } }), // private + Care Card → +575
      outcome({ care_plan_disposition: "declined", care_plan_reason: "price_budget", care_plan_selected: null }), // care plan lost → +0
    ]);
    expect(stats.revenue.carePlanRevenue).toBe(1250 + 575 + 0 + 575);
    expect(stats.revenue.carePlanCount).toBe(3);
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

describe("toTransaction", () => {
  it("normalizes a committed TPA row with an embedded patient + snapshot price", () => {
    const t = toTransaction(
      outcome({
        id: "o1", patient_id: "p1", visit_id: "v1",
        patient: { first_name: "Jane", last_name: "Doe" },
        outcome_clinic: { name: "Provo" },
        closed_at: "2026-07-01T00:00:00Z",
      }),
      { v1: "bilateral" }
    );
    expect(t).toMatchObject({
      id: "o1", patientId: "p1", patientName: "Jane Doe", clinicName: "Provo",
      deviceDisposition: "committed", payerType: "tpa", tier: "Premium",
      perAid: 999, aids: 2, aidsEstimated: false,
      deviceRevenue: 1998, carePlanRevenue: 1250, revenue: 3248, // device + Complete Care+ (TPA)
    });
  });

  it("assumes bilateral (flagged) when no fitting is linked, and zero-prices non-commits", () => {
    const est = toTransaction(outcome({ visit_id: null }));
    expect(est).toMatchObject({ aids: 2, aidsEstimated: true, deviceRevenue: 1998, carePlanRevenue: 1250, revenue: 3248 });
    const declined = toTransaction(outcome({ device_disposition: "declined", device_reason: "price_budget", care_plan_disposition: "not_applicable", care_plan_selected: null }));
    expect(declined.revenue).toBe(0);
    expect(declined.aids).toBeNull();
  });

  it("falls back to private-pay snapshot fields, bundles private-pay CC+, and null patient name", () => {
    const t = toTransaction(outcome({ payer_type: "private_pay", payer_name: null, patient: null, payer_plan_snapshot: { private_pay_tier: "Advanced", private_pay_price_per_aid: 3497.5 } }));
    expect(t).toMatchObject({ patientName: null, tier: "Advanced", perAid: 3497.5, carePlanRevenue: 0 }); // CC+ bundled in device price
  });
});

describe("outcomePredicate + selectOutcomeDrill", () => {
  const rows = [
    outcome({ id: "a", closed_at: "2026-07-03T00:00:00Z" }),                                                   // committed, tpa, complete
    outcome({ id: "b", closed_at: "2026-07-02T00:00:00Z", care_plan_disposition: "declined", care_plan_reason: "price_budget", care_plan_selected: null }), // committed tpa, care plan declined
    outcome({ id: "c", closed_at: "2026-07-04T00:00:00Z", device_disposition: "declined", device_reason: "price_budget", care_plan_disposition: "not_applicable", care_plan_selected: null }),
    outcome({ id: "d", closed_at: "2026-07-01T00:00:00Z", device_disposition: "not_a_candidate", care_plan_disposition: "not_applicable", care_plan_selected: null }),
  ];

  it("close_rate keeps closable dispositions and sorts newest-close first", () => {
    const sel = selectOutcomeDrill(rows, { kind: "close_rate" });
    expect(sel.rows.map(r => r.id)).toEqual(["c", "a", "b"]); // d excluded, c newest
    expect(sel.count).toBe(3);
    expect(sel.committed).toBe(2);
    expect(sel.rate).toBeCloseTo(2 / 3);
  });

  it("tpa_attach keeps device-committed TPA rows with a care plan in play; attach = care plan committed", () => {
    const sel = selectOutcomeDrill(rows, { kind: "tpa_attach" });
    expect(sel.rows.map(r => r.id).sort()).toEqual(["a", "b"]);
    expect(sel.count).toBe(2);
    expect(sel.attached).toBe(1);
  });

  it("device_reason filters to a single reason", () => {
    expect(outcomePredicate({ kind: "device_reason", value: "price_budget" })(rows[2])).toBe(true);
    const sel = selectOutcomeDrill(rows, { kind: "device_reason", value: "price_budget" });
    expect(sel.rows.map(r => r.id)).toEqual(["c"]);
  });

  it("revenue keeps priced commits and sums back to the committed-revenue card", () => {
    const sel = selectOutcomeDrill(rows, { kind: "revenue" });
    expect(sel.count).toBe(2);                          // a + b committed & priced
    // a: devices 999×2 + Complete Care+ 1250 (TPA); b: devices 999×2 + care plan declined 0.
    expect(sel.revenue).toBe(999 * 2 + 1250 + 999 * 2);
  });

  it("tier drills the snapshot tier of commits", () => {
    const sel = selectOutcomeDrill(rows, { kind: "tier", value: "Premium" });
    expect(sel.rows.map(r => r.id).sort()).toEqual(["a", "b"]);
  });

  it("unknown kind matches nothing", () => {
    expect(selectOutcomeDrill(rows, { kind: "nope" }).count).toBe(0);
  });
});

describe("selectFollowUpDrill", () => {
  const classify = (p) => ({ primary: p.flag || null });
  const patients = [
    { id: "p1", name: "Ann A", flag: "warranty_expiring", followUpContactedAt: "2026-07-01T10:00:00Z", devices: { warrantyExpiry: "2026-08-01" } },
    { id: "p2", name: "Bob B", flag: "stale_visit", followUpContactedAt: "2026-07-02T10:00:00Z", lastVisitDate: "2025-01-01" },
    { id: "p3", name: "Cy C",  flag: "warranty_expiring", followUpContactedAt: null },
  ];
  const outcomes = [
    { patient_id: "p1", closed_at: "2026-07-03T10:00:00Z", device_disposition: "committed" },
    { patient_id: "p2", closed_at: "2026-07-03T10:00:00Z", device_disposition: "declined" },
  ];

  it("followup_bucket lists patients whose primary bucket matches, alpha-sorted", () => {
    const sel = selectFollowUpDrill(patients, { kind: "followup_bucket", value: "warranty_expiring" }, { classify, outcomes });
    expect(sel.rows.map(r => r.name)).toEqual(["Ann A", "Cy C"]);
    expect(sel.rows[0]).toMatchObject({ bucket: "warranty_expiring", committed: true }); // Ann converted after contact
  });

  it("followup_contacted counts only in-range contacts and marks conversion", () => {
    const sel = selectFollowUpDrill(patients, { kind: "followup_contacted" }, { classify, from: new Date("2026-06-15"), outcomes });
    expect(sel.count).toBe(2); // p1, p2 (p3 never contacted)
    expect(sel.rows.find(r => r.id === "p1").committed).toBe(true);
    expect(sel.rows.find(r => r.id === "p2")).toMatchObject({ withOutcome: true, committed: false });
  });

  it("followup_committed keeps only converted contacts", () => {
    const sel = selectFollowUpDrill(patients, { kind: "followup_committed" }, { classify, outcomes });
    expect(sel.rows.map(r => r.id)).toEqual(["p1"]);
  });
});

describe("CSV helpers", () => {
  it("quotes fields with commas, quotes, or newlines and doubles inner quotes", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(1998)).toBe("1998");
  });

  it("builds CRLF-joined rows with a header", () => {
    const csv = toCsv(["Patient", "Revenue"], [["Doe, Jane", 3248], ["Ann", 0]]);
    expect(csv).toBe('Patient,Revenue\r\n"Doe, Jane",3248\r\nAnn,0');
  });
});

describe("selectAdjustmentDrill", () => {
  const rows = [
    { id: "1", reason_code: "price_match", created_at: "2026-07-01T00:00:00Z" },
    { id: "2", reason_code: "hardship",    created_at: "2026-07-03T00:00:00Z" },
    { id: "3", reason_code: "price_match", created_at: "2026-05-01T00:00:00Z" },
  ];

  it("filters by reason and sorts newest first", () => {
    const sel = selectAdjustmentDrill(rows, { kind: "adjust_reason", value: "price_match" });
    expect(sel.rows.map(r => r.id)).toEqual(["1", "3"]);
  });

  it("no reason value returns all, and from drops older rows", () => {
    const all = selectAdjustmentDrill(rows, { kind: "adjust_all" });
    expect(all.count).toBe(3);
    const recent = selectAdjustmentDrill(rows, { kind: "adjust_all" }, { from: new Date("2026-06-01") });
    expect(recent.rows.map(r => r.id)).toEqual(["2", "1"]);
  });
});

// ── Nations clinic revenue (fitting fees) ─────────────────────────────────
// The member copay flows to NationsBenefits; the clinic earns the tier-sliding
// per-aid fitting fee (Kurt 2026-07-10 — reportable metric, never patient-
// facing). Snapshot detection keys on payer_plan_snapshot.tpa === 'Nations'.
describe("computeReportStats — Nations fitting fees", () => {
  const nationsSnap = (tier, price) => ({
    carrier: "Aetna", plan_group: "Nations Hearing", tpa: "Nations",
    tier, tier_price_per_aid: price,
  });
  const nations = (tier, price, over = {}) =>
    outcome({ payer_name: "Nations", payer_plan_snapshot: nationsSnap(tier, price), ...over });

  it("accrues fee × fitted ears and tracks the copay dollars that flow to the TPA", () => {
    const stats = computeReportStats(
      [nations("Advanced Plus", 1625, { visit_id: "v1" })],
      { v1: "bilateral" }
    );
    expect(stats.revenue.nationsFittingFees).toEqual({
      revenue: 1100,        // $550/aid Advanced Plus fee × 2
      count: 1,
      estimatedAidCount: 0,
      memberCopays: 3250,   // 1625 × 2 — inside deviceRevenue, but TPA money
    });
    expect(stats.revenue.deviceRevenue).toBe(3250);
  });

  it("handles unilateral fittings and assumes bilateral when no fitting is linked", () => {
    const stats = computeReportStats(
      [nations("Specialty", 2000, { visit_id: "v1" }), nations("Standard", 600)],
      { v1: "unilateral" }
    );
    // Specialty $700 × 1 + Standard $200 × 2 (bilateral assumed)
    expect(stats.revenue.nationsFittingFees.revenue).toBe(1100);
    expect(stats.revenue.nationsFittingFees.count).toBe(2);
    expect(stats.revenue.nationsFittingFees.estimatedAidCount).toBe(1);
  });

  it("skips Nations OFF-plan sales — patient pays clinic retail, no TPA fee", () => {
    const stats = computeReportStats([nations("Off-Plan", 4997.5, { visit_id: "v1" })], { v1: "bilateral" });
    expect(stats.revenue.nationsFittingFees.count).toBe(0);
    expect(stats.revenue.nationsFittingFees.revenue).toBe(0);
    expect(stats.revenue.deviceRevenue).toBe(9995); // retail still counts as committed revenue
  });

  it("stays zero for non-Nations payers and non-committed Nations outcomes", () => {
    const stats = computeReportStats([
      outcome(),                                                    // TruHearing
      outcome({ payer_type: "private_pay", payer_name: null, payer_plan_snapshot: { private_pay_tier: "Advanced", private_pay_price_per_aid: 3497.5 } }),
      nations("Advanced", 1450, { device_disposition: "declined", device_reason: "price_budget", care_plan_disposition: "not_applicable", care_plan_selected: null }),
    ]);
    expect(stats.revenue.nationsFittingFees).toEqual({ revenue: 0, count: 0, estimatedAidCount: 0, memberCopays: 0 });
  });

  it("accrues the fee even when the snapshot copay is unpriced (fee keys on tier alone)", () => {
    const stats = computeReportStats([nations("Select", null, { visit_id: "v1" })], { v1: "bilateral" });
    expect(stats.revenue.nationsFittingFees).toEqual({ revenue: 430, count: 1, estimatedAidCount: 0, memberCopays: 0 });
    expect(stats.revenue.unpricedCount).toBe(1);
  });

  it("never applies the Aetna fee schedule to Molina commits — colliding tier labels", () => {
    // Molina Medicare Complete Care is also tpa 'Nations' and its 'Advanced'
    // rung shares a label with Aetna's (different rung, different economics).
    // Until Molina's own fee schedule is imported, its commits accrue NO fee —
    // silently pulling Aetna's $400 'Advanced' fee would be wrong money.
    const molina = (tier, price, over = {}) => outcome({
      payer_name: "Nations",
      payer_plan_snapshot: { carrier: "Molina", plan_group: "Medicare Complete Care HMO D-SNP", tpa: "Nations", tier, tier_price_per_aid: price },
      ...over,
    });
    const stats = computeReportStats(
      [molina("Advanced", 1075, { visit_id: "v1" }), molina("Premium", 1475, { visit_id: "v2" })],
      { v1: "bilateral", v2: "bilateral" }
    );
    expect(stats.revenue.nationsFittingFees).toEqual({ revenue: 0, count: 0, estimatedAidCount: 0, memberCopays: 0 });
    expect(stats.revenue.deviceRevenue).toBe(5100); // copays still count as device revenue
    expect(toTransaction(molina("Advanced", 1075, { visit_id: "v1" }), { v1: "bilateral" }).nationsFittingFee).toBe(0);
  });

  it("treats a legacy snapshot with no plan_group as Aetna (pre-Molina rows)", () => {
    const legacy = outcome({ payer_name: "Nations", payer_plan_snapshot: { tpa: "Nations", tier: "Advanced", tier_price_per_aid: 1450 }, visit_id: "v1" });
    const stats = computeReportStats([legacy], { v1: "unilateral" });
    expect(stats.revenue.nationsFittingFees.revenue).toBe(400);
  });

  it("toTransaction mirrors the per-row clinic fee for drill/CSV consistency", () => {
    const t = toTransaction(nations("Advanced", 1450, { visit_id: "v1" }), { v1: "unilateral" });
    expect(t.nationsFittingFee).toBe(400);   // $400/aid Advanced × 1
    expect(t.deviceRevenue).toBe(1450);
    expect(toTransaction(outcome()).nationsFittingFee).toBe(0);
  });
});
