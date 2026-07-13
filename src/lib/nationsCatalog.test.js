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
import { nationsCoverageTier, NATIONS_TIER_ORDER } from "./pricing.js";
import { NATIONS_CATALOG, NATIONS_TIER_PRICING } from "../nations_catalog_data.js";

// Drift guard: nationsCoverageTier() is a HAND-DERIVED map (validated with Kurt
// 2026-07-07); nations_catalog_data.js is the AUTHORITATIVE NationsBenefits
// catalog export (637 SKUs). This suite re-derives (Distil family, techLevel)
// from each Nations SKU string where that's unambiguous and asserts the map
// agrees with the catalog's tier — so neither can silently drift from the
// other. Validated against the full export on import (2026-07-10): 285 SKUs
// checkable, 0 disagreements.
//
// SKUs that DON'T resolve to a product_catalog family are skipped by design:
// brands MHC doesn't dispense (Beltone/Bernafon/Unitron), legacy platforms not
// in the catalog (Widex Evoke, Starkey G Series/Evolv, Phonak Virto Paradise,
// Oticon More/OPN/Own/Zircon/Jet, ReSound Key/Savi/EnzoCore), economy lines
// (Signia Intuis), and ReSound Vivia (Nations codes it VIVIA4/VIVIA5, which
// doesn't align with product_catalog's 9/7/5/3 ladder — see PR notes).

// Minimal fixtures mirroring real product_catalog rows the map keys on.
const SIG = { id: "sig-pure-ix", manufacturer: "Signia", generation: "IX" };
const SIG_ACTIVE = { id: "sig-active-ix", manufacturer: "Signia", generation: "IX" };
const PHO_LUMITY = { id: "pho-audeo-lumity", manufacturer: "Phonak", generation: "Lumity" };
const PHO_INFINIO = { id: "pho-audeo-infinio", manufacturer: "Phonak", generation: "Infinio" };
const PHO_SPHERE = { id: "pho-sphere-infinio", manufacturer: "Phonak", generation: "Infinio" };
const OTI_REAL = { id: "oti-real", manufacturer: "Oticon", generation: "Real" };
const OTI_XCEED = { id: "oti-xceed", manufacturer: "Oticon", generation: "Intent" };
const RES_RIC = { id: "res-nexia-ric", manufacturer: "Resound", generation: "Nexia" };
const RES_CUSTOM = { id: "res-nexia-custom", manufacturer: "Resound", generation: "Nexia" };
const STA = { id: "sta-edge-ai-ric", manufacturer: "Starkey", generation: "Edge AI" };
const WID = { id: "wid-moment-sheer", manufacturer: "Widex", generation: "Moment" };
const REX = { id: "rex-reach-r", manufacturer: "Rexton", generation: "IX" };

// Nations SKU string → [family, techLevel], or null when the SKU has no
// product_catalog counterpart (skipped — see header comment).
function toDistilDevice(model) {
  if (model.startsWith("SIGNIA")) {
    if (model.includes("INTUIS")) return null; // economy line, not in product_catalog
    // Base Active = the 1IX rung; Active Pro = the 7IX rung (both sig-active-ix).
    if (model === "SIGNIA SI_Active_IX") return [SIG_ACTIVE, "1IX"];
    if (model === "SIGNIA SI_Active_Pro_IX") return [SIG_ACTIVE, "7IX"];
    // '7IX', '3AX', 'Styletto 5Ax' (lowercase x), 'SI700_' — all → digit; the
    // map is generation-agnostic numeric, so IX stands in for AX too.
    let m = model.match(/([1-7])(?:IX|AX)/i);
    if (!m) m = model.match(/SI([1-7])00_/);
    return m ? [SIG, m[1] + "IX"] : ["UNMATCHED"];
  }
  if (model.startsWith("PHONAK")) {
    const m = model.match(/^PHONAK ([LIP])(\d0)_/);
    if (!m) return ["UNMATCHED"];
    if (m[1] === "P") return null; // Virto Paradise, not in product_catalog
    if (model.includes("Sphere")) return [PHO_SPHERE, m[2]];
    return [m[1] === "L" ? PHO_LUMITY : PHO_INFINIO, m[2]];
  }
  if (model.startsWith("OTICON")) {
    let m = model.match(/OTREAL([1-3])/);
    if (m) return [OTI_REAL, m[1]];
    m = model.match(/OTXCEED([1-3])/);
    if (m) return [OTI_XCEED, m[1]];
    return null; // More/OPN/Own/Zircon/Jet — no product_catalog family
  }
  if (model.startsWith("GNR")) {
    let m = model.match(/RSNEXIA(\d)_NX\d(CIC|HS|ITC|ITE)?/);
    if (m) return [m[2] ? RES_CUSTOM : RES_RIC, m[1]];
    m = model.match(/RSENZOQ(\d)/);
    if (m) return [RES_RIC, m[1]]; // ENZO Q is a BTE — non-custom branch
    return null; // Key/Savi/EnzoCore/EI/Vivia/XH — not mappable
  }
  if (model.startsWith("STARKEY")) {
    const m = model.match(/^STARKEY (\d\d)(?: NW)?_STARKEY\.(?:EDGE AI|GENESIS AI|OMEGA AI)/);
    return m ? [STA, m[1]] : null; // G Series / Evolv AI — legacy, skipped
  }
  if (model.startsWith("WIDEX")) {
    if (!/^WIDEX WI (Moment|Custom|Smart RIC)\b/.test(model)) return null; // Evoke/Allure
    // Level is the 3-digit group before the underscore ('RIC 312 110_MRB2D1'
    // carries a battery size too — restrict to the real rungs).
    const m = model.split("_")[0].match(/\b(110|220|330|440)\b/);
    return m ? [WID, m[1]] : ["UNMATCHED"];
  }
  if (model.startsWith("Rexton")) return [REX, "30"]; // whole line prices at Select
  return null; // Beltone / Bernafon / Unitron — not dispensed by MHC
}

describe("Nations catalog dataset", () => {
  it("carries the full 637-SKU export with no duplicate models", () => {
    expect(NATIONS_CATALOG.length).toBe(637);
    expect(new Set(NATIONS_CATALOG.map(([, m]) => m)).size).toBe(637);
  });

  it("uses only the six Nations tiers", () => {
    for (const [, , tier] of NATIONS_CATALOG) {
      expect(NATIONS_TIER_ORDER).toContain(tier);
    }
  });

  it("tier pricing matches the Nations insurance_plans copays", () => {
    // Same values as the insurance_plans row (Aetna · Nations Hearing) and the
    // INSURANCE_PLANS seed in Distil.jsx — if Nations reprices, all three move.
    expect(NATIONS_TIER_PRICING).toEqual({
      Standard: { copayPerAid: 600, fittingFeePerAid: 200 },
      Select: { copayPerAid: 800, fittingFeePerAid: 215 },
      "Superior Plus": { copayPerAid: 1150, fittingFeePerAid: 300 },
      Advanced: { copayPerAid: 1450, fittingFeePerAid: 400 },
      "Advanced Plus": { copayPerAid: 1625, fittingFeePerAid: 550 },
      Specialty: { copayPerAid: 2000, fittingFeePerAid: 700 },
    });
  });
});

describe("nationsCoverageTier ↔ catalog drift guard", () => {
  const checked = {}; // brand → count
  const mismatches = [];
  const unmatched = [];
  for (const [brand, model, tier] of NATIONS_CATALOG) {
    const res = toDistilDevice(model);
    if (res === null) continue;
    if (res[0] === "UNMATCHED") { unmatched.push(model); continue; }
    const [family, techLevel] = res;
    checked[brand] = (checked[brand] || 0) + 1;
    const got = nationsCoverageTier(family, techLevel);
    if (got !== tier) mismatches.push({ model, catalog: tier, map: got });
  }

  it("recognizes every SKU of a mapped brand (extraction never bit-rots silently)", () => {
    expect(unmatched).toEqual([]);
  });

  it("agrees with the catalog tier for every checkable SKU", () => {
    expect(mismatches).toEqual([]);
  });

  it("keeps per-brand coverage at least at import-time levels", () => {
    // Counts from the 2026-07-10 import sweep. A drop means the extraction or
    // the dataset lost rows — investigate, don't just lower the floor.
    expect(checked.Signia).toBeGreaterThanOrEqual(73);
    expect(checked.Phonak).toBeGreaterThanOrEqual(43);
    expect(checked.Widex).toBeGreaterThanOrEqual(68);
    expect(checked.Starkey).toBeGreaterThanOrEqual(35);
    expect(checked.ReSound).toBeGreaterThanOrEqual(42);
    expect(checked.Oticon).toBeGreaterThanOrEqual(15);
    expect(checked.Rexton).toBeGreaterThanOrEqual(9);
  });

  it("confirms the documented off-plan exclusions really are absent from Nations' catalog", () => {
    // Oticon Intent: the whole platform is off-plan (Nations' catalog predates
    // it — More/OPN/Own/Zircon/Jet/Real/Xceed only).
    expect(NATIONS_CATALOG.some(([, m]) => /INTENT/i.test(m))).toBe(false);
    expect(nationsCoverageTier({ id: "oti-intent", manufacturer: "Oticon", generation: "Intent" }, "1")).toBe(null);
    // The zero-mismatch sweep above implies the other exclusions (mainstream
    // Signia level 1, Phonak Sphere <70, ReSound level 3): if the catalog
    // carried such a SKU, the map's null would have mismatched its tier.
    expect(nationsCoverageTier(SIG, "1IX")).toBe(null);
    expect(nationsCoverageTier(PHO_SPHERE, "50")).toBe(null);
    expect(nationsCoverageTier(RES_RIC, "3")).toBe(null);
  });
});
