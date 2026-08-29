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

// Drift guard for the forked style picker: every body style either catalog
// can hand BodyStylePicker must land in exactly one subcategory, or a style
// silently vanishes from the wizard's opening screen.

import { describe, it, expect } from "vitest";
import {
  BODY_STYLES, STYLE_CATEGORIES, STYLE_SUBCATEGORIES, STYLE_BRANCH,
} from "./catalogConstants.js";
import { TH_BODY_STYLES } from "./truhearingCatalog.js";
import { BODY_STYLE_STATS } from "./bodyStyleRec.js";

describe("style taxonomy", () => {
  it("routes every standard-catalog style into exactly one subcategory", () => {
    for (const s of BODY_STYLES) {
      expect(STYLE_BRANCH[s.id], `BODY_STYLES '${s.id}' missing from taxonomy`).toBeTruthy();
    }
  });

  it("routes every TruHearing style into exactly one subcategory", () => {
    for (const s of TH_BODY_STYLES) {
      expect(STYLE_BRANCH[s.id], `TH_BODY_STYLES '${s.id}' missing from taxonomy`).toBeTruthy();
    }
  });

  it("has no style claimed by two subcategories", () => {
    const seen = new Set();
    for (const sub of STYLE_SUBCATEGORIES) {
      for (const id of sub.styleIds) {
        expect(seen.has(id), `style '${id}' appears in two subcategories`).toBe(false);
        seen.add(id);
      }
    }
  });

  it("hangs every subcategory off a real category", () => {
    const catIds = new Set(STYLE_CATEGORIES.map(c => c.id));
    for (const sub of STYLE_SUBCATEGORIES) {
      expect(catIds.has(sub.categoryId), `subcategory '${sub.id}' has unknown category`).toBe(true);
    }
  });

  it("keeps the recommendation engine covering every routed style", () => {
    for (const id of Object.keys(STYLE_BRANCH)) {
      expect(BODY_STYLE_STATS[id], `engine has no stats for '${id}'`).toBeTruthy();
    }
  });
});
