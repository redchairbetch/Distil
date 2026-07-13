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
  isTestedNoLoss,
  buildTnlRetestAppointment,
  NORMAL_HEARING_MAX_DB,
  TNL_RETEST_TYPE,
} from "./audiogram.js";

const normalEar = { 250: 10, 500: 15, 1000: 10, 2000: 20, 4000: 15, 8000: 20 };

describe("isTestedNoLoss", () => {
  it("uses the 20 dB domain rule, not 25", () => {
    expect(NORMAL_HEARING_MAX_DB).toBe(20);
    // 25 dB is "Normal" on some clinical scales but NOT within Distil's rule
    expect(isTestedNoLoss({ rightT: { ...normalEar, 4000: 25 }, leftT: normalEar })).toBe(false);
  });

  it("suggests TNL when every entered threshold in both ears is ≤ 20 dB", () => {
    expect(isTestedNoLoss({ rightT: normalEar, leftT: normalEar })).toBe(true);
    expect(isTestedNoLoss({ rightT: { 1000: 20 }, leftT: { 1000: 20 } })).toBe(true); // boundary
  });

  it("requires BOTH ears to be tested", () => {
    expect(isTestedNoLoss({ rightT: normalEar, leftT: {} })).toBe(false);
    expect(isTestedNoLoss({ rightT: {}, leftT: {} })).toBe(false);
    expect(isTestedNoLoss(null)).toBe(false);
    expect(isTestedNoLoss({})).toBe(false);
  });

  it("any single elevated threshold disqualifies (unilateral loss is still loss)", () => {
    expect(isTestedNoLoss({ rightT: normalEar, leftT: { ...normalEar, 4000: 45 } })).toBe(false);
  });

  it("treats empty-string cells as untested, and numeric strings as numbers", () => {
    expect(isTestedNoLoss({ rightT: { 1000: "15", 2000: "" }, leftT: { 1000: "20" } })).toBe(true);
    expect(isTestedNoLoss({ rightT: { 1000: "15" }, leftT: { 1000: "35" } })).toBe(false);
  });

  it("non-numeric junk disqualifies rather than passes", () => {
    expect(isTestedNoLoss({ rightT: { 1000: "abc" }, leftT: normalEar })).toBe(false);
  });
});

describe("buildTnlRetestAppointment", () => {
  it("schedules the retest 12 months out as a local-time date-only string", () => {
    const appt = buildTnlRetestAppointment(new Date(2026, 6, 13)); // 2026-07-13 local
    expect(appt.type).toBe(TNL_RETEST_TYPE);
    expect(appt.date).toBe("2027-07-13");
    expect(appt.note).toMatch(/annual monitoring retest/i);
  });

  it("lets Date handle month-length rollover", () => {
    // Feb 29 → Mar 1 the following (non-leap) year
    const appt = buildTnlRetestAppointment(new Date(2028, 1, 29));
    expect(appt.date).toBe("2029-03-01");
  });
});
