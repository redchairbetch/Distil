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
  FINANCING_TERMS,
  DEFERRED_RETRO_APR,
  fixedSchedule,
  eligibleTerms,
  scheduleForTerm,
} from "./financing.js";

describe("FINANCING_TERMS menu", () => {
  it("matches the clinic's CareCredit/Allegro menu (Kurt, 2026-06-30)", () => {
    // Deferred-interest windows: 6/12/18 at 0%.
    const deferred = FINANCING_TERMS.filter((t) => t.kind === "deferred");
    expect(deferred.map((t) => t.months)).toEqual([6, 12, 18]);
    expect(deferred.every((t) => t.apr === 0)).toBe(true);
    // Fixed installment plans with their real APRs.
    const fixed = Object.fromEntries(
      FINANCING_TERMS.filter((t) => t.kind === "fixed").map((t) => [t.months, t.apr]),
    );
    expect(fixed).toEqual({ 24: 17.9, 36: 18.9, 48: 19.9, 60: 20.9 });
    expect(DEFERRED_RETRO_APR).toBe(32.99);
  });

  it("gates only the 60-month plan, at $2,500 financed", () => {
    const gated = FINANCING_TERMS.filter((t) => t.minTotal);
    expect(gated).toHaveLength(1);
    expect(gated[0]).toMatchObject({ months: 60, minTotal: 2500 });
  });
});

describe("fixedSchedule", () => {
  it("amortizes $5,000 over 24 months at 17.9% APR", () => {
    const s = fixedSchedule(5000, 17.9, 24);
    expect(s.monthly).toBeCloseTo(249.38, 2);
    expect(s.total).toBeCloseTo(5985.1, 1);
    expect(s.interest).toBeCloseTo(985.1, 1);
  });

  it("amortizes the 60-month plan at 20.9% APR", () => {
    const s = fixedSchedule(4995, 20.9, 60);
    expect(s.monthly).toBeCloseTo(134.85, 2);
    expect(s.total).toBeCloseTo(8091.04, 1);
    expect(s.interest).toBeCloseTo(3096.04, 1);
  });

  it("degrades to straight division at 0% APR", () => {
    const s = fixedSchedule(3000, 0, 12);
    expect(s.monthly).toBe(250);
    expect(s.total).toBe(3000);
    expect(s.interest).toBe(0);
  });

  it("keeps total = monthly × months and interest = total − principal", () => {
    const s = fixedSchedule(6500, 18.9, 36);
    expect(s.total).toBeCloseTo(s.monthly * 36, 6);
    expect(s.interest).toBeCloseTo(s.total - 6500, 6);
  });
});

describe("eligibleTerms", () => {
  it("includes the 60-month plan at exactly $2,500 financed", () => {
    expect(eligibleTerms(2500).map((t) => t.months)).toContain(60);
  });

  it("drops the 60-month plan below $2,500 financed", () => {
    const months = eligibleTerms(2499.99).map((t) => t.months);
    expect(months).not.toContain(60);
    expect(months).toEqual([6, 12, 18, 24, 36, 48]);
  });
});

describe("scheduleForTerm", () => {
  it("deferred plans show the pay-in-full path: balance ÷ months, zero interest", () => {
    const term = FINANCING_TERMS.find((t) => t.months === 18);
    const s = scheduleForTerm(3600, term);
    expect(s).toEqual({ monthly: 200, total: 3600, interest: 0 });
  });

  it("fixed plans route through fixedSchedule", () => {
    const term = FINANCING_TERMS.find((t) => t.months === 24);
    expect(scheduleForTerm(5000, term)).toEqual(fixedSchedule(5000, 17.9, 24));
  });
});
