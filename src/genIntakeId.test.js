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

  // Sized so birthday odds in the 36^5/day space are ~1 in 120k runs — a
  // 5,000-call version flaked at ~1 in 5k. Real collision safety is the DB
  // unique index + the kiosk's regenerate-and-retry, not this test.
  it("does not collide across 1,000 consecutive calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => genIntakeId()));
    expect(ids.size).toBe(1000);
  });
});
