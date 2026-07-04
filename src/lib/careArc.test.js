import { describe, it, expect } from "vitest";
import { CARE_ARC, buildCareArc } from "./careArc.js";

describe("CARE_ARC", () => {
  it("is the 21-visit / 4-year arc", () => {
    expect(CARE_ARC).toHaveLength(21);
    expect(CARE_ARC[0].type).toBe("Fitting & Orientation");
    expect(CARE_ARC[1].type).toBe("Day-2 Follow-Up Call");
    expect(CARE_ARC[CARE_ARC.length - 1].type).toBe("Year-4 Upgrade Consultation");
    expect(CARE_ARC[CARE_ARC.length - 1].offset).toBe(48);
  });

  it("contains the three annual exams (Year 4 is the upgrade consultation)", () => {
    const annuals = CARE_ARC.filter(v => /^Annual Exam/.test(v.type));
    expect(annuals.map(v => v.offset)).toEqual([12, 24, 36]);
  });
});

describe("buildCareArc", () => {
  it("expands every arc entry into a dated appointment", () => {
    const arc = buildCareArc("2026-07-04");
    expect(arc).toHaveLength(CARE_ARC.length);
    expect(arc[0]).toEqual({ date: "2026-07-04", type: "Fitting & Orientation", note: CARE_ARC[0].note });
    expect(arc[1].date).toBe("2026-07-06"); // Day-2 call
    expect(arc[2].date).toBe("2026-07-18"); // 2 weeks
    expect(arc[arc.length - 1].date).toBe("2030-07-04"); // 48 months out
  });

  it("produces chronologically non-decreasing dates", () => {
    const dates = buildCareArc("2026-03-15").map(a => a.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it("handles a month-end fitting without producing invalid dates", () => {
    const arc = buildCareArc("2026-01-31");
    for (const { date } of arc) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const [y, m, d] = date.split("-").map(Number);
      const roundTrip = new Date(y, m - 1, d);
      expect(roundTrip.getDate()).toBe(d); // date is real, not a rollover artifact
    }
  });

  it("returns [] for missing or malformed input", () => {
    expect(buildCareArc(null)).toEqual([]);
    expect(buildCareArc("")).toEqual([]);
    expect(buildCareArc("garbage")).toEqual([]);
  });

  it("accepts a timestamp by slicing the date part", () => {
    const arc = buildCareArc("2026-07-04T10:30:00Z");
    expect(arc[0].date).toBe("2026-07-04");
  });
});
