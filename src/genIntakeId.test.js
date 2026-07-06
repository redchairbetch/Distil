import { describe, it, expect } from "vitest";
import { genIntakeId } from "./db.js";

describe("genIntakeId", () => {
  it("matches the non-negotiable MHC-YYYYMMDD-XXXXX format", () => {
    expect(genIntakeId()).toMatch(/^MHC-\d{8}-[A-Z0-9]{5}$/);
  });

  it("stamps today's local date", () => {
    const d = new Date();
    const expected = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    expect(genIntakeId().split("-")[1]).toBe(expected);
  });

  it("does not collide across 5,000 consecutive calls", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => genIntakeId()));
    expect(ids.size).toBe(5000);
  });
});
