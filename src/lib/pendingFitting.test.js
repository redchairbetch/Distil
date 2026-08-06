import { describe, it, expect } from "vitest";
import {
  ESTIMATED_FIT_LEAD_DAYS,
  FITTING_OVERDUE_DAYS,
  estimateFitDate,
  warrantyYearsFor,
  CANCEL_REASONS,
} from "./pendingFitting.js";

describe("estimateFitDate", () => {
  it("adds the default lead time to a signing date", () => {
    expect(estimateFitDate("2026-08-05")).toBe("2026-08-19");
    expect(ESTIMATED_FIT_LEAD_DAYS).toBe(14);
  });

  it("rolls across month boundaries", () => {
    expect(estimateFitDate("2026-08-25")).toBe("2026-09-08");
    expect(estimateFitDate("2026-12-27")).toBe("2027-01-10");
  });

  it("handles leap-year February", () => {
    expect(estimateFitDate("2028-02-20")).toBe("2028-03-05");
  });

  it("stays date-stable across the DST spring-forward window", () => {
    // Mar 8 2026 is the US spring-forward date; naive ms math can land a
    // day short. Local calendar math must not.
    expect(estimateFitDate("2026-03-01")).toBe("2026-03-15");
  });

  it("accepts a custom lead time", () => {
    expect(estimateFitDate("2026-08-05", 7)).toBe("2026-08-12");
  });

  it("returns null for missing or malformed input", () => {
    expect(estimateFitDate(null)).toBeNull();
    expect(estimateFitDate("")).toBeNull();
    expect(estimateFitDate("not-a-date")).toBeNull();
  });

  it("tolerates a timestamp by using its date part", () => {
    expect(estimateFitDate("2026-08-05T14:30:00Z")).toBe("2026-08-19");
  });
});

describe("warrantyYearsFor", () => {
  it("gives private pay 4 years (Complete Care+ is bundled)", () => {
    expect(warrantyYearsFor("private", null)).toBe(4);
    expect(warrantyYearsFor("private", "paygo")).toBe(4);
  });

  it("gives insurance + Complete Care+ 4 years", () => {
    expect(warrantyYearsFor("insurance", "complete")).toBe(4);
  });

  it("gives insurance without Complete Care+ the 3-year manufacturer term", () => {
    expect(warrantyYearsFor("insurance", "punch")).toBe(3);
    expect(warrantyYearsFor("insurance", "paygo")).toBe(3);
    expect(warrantyYearsFor("insurance", null)).toBe(3);
  });
});

describe("FITTING_OVERDUE_DAYS", () => {
  it("is longer than the estimated lead time", () => {
    expect(FITTING_OVERDUE_DAYS).toBeGreaterThan(ESTIMATED_FIT_LEAD_DAYS);
  });
});

describe("CANCEL_REASONS", () => {
  // Keys must stay in lockstep with the device_fittings_cancel_reason_check
  // DB constraint (migration 20260805130000).
  it("matches the DB constraint vocabulary", () => {
    expect(CANCEL_REASONS.map(r => r.id)).toEqual([
      "changed_mind",
      "financing_fell_through",
      "insurance_issue",
      "medical",
      "moved_relocated",
      "deceased",
      "other",
    ]);
  });

  it("every reason has a patient-neutral label", () => {
    for (const r of CANCEL_REASONS) {
      expect(r.label).toBeTruthy();
      // banned patient-facing vocabulary (see CLAUDE.md)
      expect(r.label.toLowerCase()).not.toMatch(/trial|demo/);
    }
  });
});
