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
import { parseDateOnly, warrantyDate, daysUntil } from "./dates.js";

describe("parseDateOnly", () => {
  it("parses a bare YYYY-MM-DD as local time (the UTC-skew bug this exists to fix)", () => {
    const d = parseDateOnly("2026-07-04");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);   // July, 0-indexed
    expect(d.getDate()).toBe(4);    // NOT the 3rd — new Date('2026-07-04') would give the 3rd evening in US timezones
    expect(d.getHours()).toBe(0);
  });

  it("returns null for timestamps so timestamptz values fall through", () => {
    expect(parseDateOnly("2026-07-04T12:00:00Z")).toBeNull();
  });

  it("returns null for non-strings and garbage", () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly(20260704)).toBeNull();
    expect(parseDateOnly("07/04/2026")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });
});

describe("warrantyDate", () => {
  it("adds the default 3 years", () => {
    expect(warrantyDate("2026-01-15")).toBe("2029-01-15");
  });

  it("adds explicit years (4-year Complete Care+ warranty)", () => {
    expect(warrantyDate("2024-11-20", 4)).toBe("2028-11-20");
  });
});

describe("daysUntil", () => {
  it("returns 0 for today", () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    expect(daysUntil(today)).toBe(0);
  });

  it("is negative for past dates and positive for future dates", () => {
    expect(daysUntil("2000-01-01")).toBeLessThan(0);
    expect(daysUntil("2090-01-01")).toBeGreaterThan(0);
  });
});
