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
import { isCatalogEntryVisible, clinicCanFit, proprietaryAuthKey } from "./catalogVisibility.js";
import { CATALOG_DEFAULT } from "./catalogConstants.js";

const signia = { id: "sig", manufacturer: "Signia", active: true };
const relate = { id: "rel", manufacturer: "Relate", active: true, tpa: "UHCH" };
const beltone = { id: "bel", manufacturer: "Beltone", active: true, requiresProprietarySoftware: true };

describe("catalog visibility", () => {
  it("hides Beltone from clinics without Solus Max authorization", () => {
    expect(isCatalogEntryVisible(beltone, {})).toBe(false);
    expect(isCatalogEntryVisible(beltone, { proprietaryAuth: [] })).toBe(false);
    expect(isCatalogEntryVisible(beltone, { proprietaryAuth: null })).toBe(false);
  });

  it("shows Beltone at authorized clinics", () => {
    expect(isCatalogEntryVisible(beltone, { proprietaryAuth: ["beltone"] })).toBe(true);
    expect(isCatalogEntryVisible(beltone, { proprietaryAuth: ["Beltone"] })).toBe(true);
  });

  it("gates on manufacturer even when the row flag is missing (catalog-editor rows)", () => {
    const unflagged = { id: "bel2", manufacturer: "Beltone", active: true };
    expect(proprietaryAuthKey(unflagged)).toBe("beltone");
    expect(clinicCanFit(unflagged, [])).toBe(false);
  });

  it("leaves non-proprietary brands alone", () => {
    expect(isCatalogEntryVisible(signia, {})).toBe(true);
    expect(isCatalogEntryVisible(signia, { proprietaryAuth: ["beltone"] })).toBe(true);
  });

  it("keeps TPA exclusivity independent of software auth", () => {
    expect(isCatalogEntryVisible(relate, { tpa: null, proprietaryAuth: ["beltone"] })).toBe(false);
    expect(isCatalogEntryVisible(relate, { tpa: "UHCH" })).toBe(true);
  });

  it("never shows inactive rows", () => {
    expect(isCatalogEntryVisible({ ...beltone, active: false }, { proprietaryAuth: ["beltone"] })).toBe(false);
  });

  it("flags every Beltone fallback-catalog row as proprietary", () => {
    const rows = CATALOG_DEFAULT.filter(e => e.manufacturer === "Beltone");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.requiresProprietarySoftware, r.id).toBe(true);
  });
});
