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
  catalogTierRank, TIER_LABEL_BY_RANK, rankFromTierLabel, deviceCoverage,
} from "./deviceComparison.js";
import { COVERAGE_BY_RANK } from "./listeningSituations.js";

describe("catalogTierRank", () => {
  it("maps a five-level prescription ladder onto the full sparse scale (Signia 7→1)", () => {
    expect([1, 2, 3, 4, 5].map(p => catalogTierRank(p))).toEqual([5, 3, 1, 0, -1]);
  });

  it("maps by position, not designation — position 1 is flagship for every brand", () => {
    // Oticon Intent "1" and Signia "7IX" are both position 1 → both premium-class.
    expect(catalogTierRank(1)).toBe(5);
    expect(catalogTierRank(1)).toBe(rankFromTierLabel("Premium"));
  });

  it("keeps OTC devices on the lower band — best self-fit tops out at standard class", () => {
    expect(catalogTierRank(1, "otc")).toBe(1);
    expect(catalogTierRank(2, "otc")).toBe(0);
    expect(catalogTierRank(3, "otc")).toBe(-1);
  });

  it("floors deep ladders instead of walking off the scale", () => {
    expect(catalogTierRank(7)).toBe(-1);
    expect(catalogTierRank(5, "otc")).toBe(-1);
  });

  it("returns null when position is missing or invalid", () => {
    expect(catalogTierRank(null)).toBeNull();
    expect(catalogTierRank(0)).toBeNull();
  });

  it("only ever produces ranks that have coverage baselines and labels", () => {
    for (const cls of ["prescription", "otc"]) {
      for (let pos = 1; pos <= 6; pos++) {
        const rank = catalogTierRank(pos, cls);
        expect(COVERAGE_BY_RANK[rank]).toBeTruthy();
        expect(TIER_LABEL_BY_RANK[rank]).toBeTruthy();
        expect(deviceCoverage({ tierRank: rank })).toBeTruthy();
      }
    }
  });
});
