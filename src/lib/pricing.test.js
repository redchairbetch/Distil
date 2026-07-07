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
  CROS_PRICE_PER_UNIT, isSideCros, manufacturerToClass, uhchCoverageTier,
  nationsCoverageTier, NATIONS_TIER_ORDER,
  findTierRank, findAnchorForRank, deriveEarPrice, pickBaselinePerAid,
} from "./pricing.js";

// Minimal fixtures mirroring the real data shapes.
const CATALOG = [
  { id: "fam-signia-pure", manufacturer: "Signia" },
  { id: "fam-rexton-reach", manufacturer: "Rexton" },
  // Nations fixtures — real product_catalog ids/generations the map keys on.
  { id: "sig-pure-ix",       manufacturer: "Signia",  generation: "IX" },
  { id: "sig-active-ix",     manufacturer: "Signia",  generation: "IX" },
  { id: "pho-audeo-lumity",  manufacturer: "Phonak",  generation: "Lumity" },
  { id: "pho-audeo-infinio", manufacturer: "Phonak",  generation: "Infinio" },
  { id: "pho-sphere-infinio",manufacturer: "Phonak",  generation: "Infinio" },
  { id: "oti-real",          manufacturer: "Oticon",  generation: "Real" },
  { id: "oti-intent",        manufacturer: "Oticon",  generation: "Intent" },
  { id: "res-nexia-ric",     manufacturer: "Resound", generation: "Nexia" },
  { id: "res-nexia-custom",  manufacturer: "Resound", generation: "Nexia" },
  { id: "sta-edge-ai-ric",   manufacturer: "Starkey", generation: "Edge AI" },
  { id: "wid-moment-bte",    manufacturer: "Widex",   generation: "Moment" },
  { id: "rex-reach-r",       manufacturer: "Rexton",  generation: "IX" },
];
const TIERS = [
  { productCatalogId: "fam-signia-pure", tierName: "7IX", tierRank: 5 },
  { productCatalogId: "fam-signia-pure", tierName: "5IX", tierRank: 4 },
  { productCatalogId: "fam-rexton-reach", tierName: "R-Li M", tierRank: 3 },
  // For the Nations off-plan anchor path (Oticon Intent isn't in Nations).
  { productCatalogId: "oti-intent", tierName: "1", tierRank: 5 },
];
// sort_order 1 = rank 5 (Premium) per the 6 - rank mapping.
const ANCHORS = {
  signia:   [{ sort_order: 1, label: "Premium", price_per_aid: "3997.50" },
             { sort_order: 2, label: "Advanced", price_per_aid: "3497.50" }],
  standard: [{ sort_order: 1, label: "Premium", price_per_aid: "4997.50" },
             { sort_order: 2, label: "Advanced", price_per_aid: "4497.50" },
             { sort_order: 3, label: "Standard", price_per_aid: "3997.50" }],
};
const UHCH_PLANS = [{
  tpa: "UHCH", carrier: "UnitedHealthcare", planGroup: "Medicare Supplement",
  tiers: [{ label: "Premium", price: 1075 }, { label: "Standard", price: 775 }],
}];
const NATIONS_PLANS = [{
  tpa: "Nations", carrier: "Aetna", planGroup: "Nations Hearing",
  tiers: [
    { label: "Standard", price: 600 }, { label: "Select", price: 800 },
    { label: "Superior Plus", price: 1150 }, { label: "Advanced", price: 1450 },
    { label: "Advanced Plus", price: 1625 }, { label: "Specialty", price: 2000 },
  ],
}];
const nationsForm = { payType: "insurance", tpa: "Nations", carrier: "Aetna", planGroup: "Nations Hearing" };
const fam = (id) => CATALOG.find(e => e.id === id);

describe("isSideCros", () => {
  it("detects CROS/BICROS variants and the explicit flag", () => {
    expect(isSideCros({ variant: "CROS Pure" })).toBe(true);
    expect(isSideCros({ variant: "BICROS" })).toBe(true);
    expect(isSideCros({ isCROS: true })).toBe(true);
    expect(isSideCros({ variant: "Standard" })).toBe(false);
    expect(isSideCros(null)).toBe(false);
  });
});

describe("manufacturerToClass", () => {
  it("maps known manufacturers case-insensitively", () => {
    expect(manufacturerToClass("Signia")).toBe("signia");
    expect(manufacturerToClass("REXTON")).toBe("rexton");
  });
  it("falls back to standard for private-label and unknown brands", () => {
    expect(manufacturerToClass("TruHearing")).toBe("standard");
    expect(manufacturerToClass("")).toBe("standard");
    expect(manufacturerToClass(null)).toBe("standard");
  });
});

describe("uhchCoverageTier", () => {
  it("covers flagship + the UHCH-specific mid tier", () => {
    expect(uhchCoverageTier("Signia", "7IX")).toBe("Premium");
    expect(uhchCoverageTier("Signia", "3IX")).toBe("Standard");
    expect(uhchCoverageTier("Phonak", "50")).toBe("Standard");
  });
  it("is null for off-plan devices (Rexton entirely; skipped mid tiers)", () => {
    expect(uhchCoverageTier("Rexton", "R-Li M")).toBeNull();
    expect(uhchCoverageTier("Signia", "5IX")).toBeNull(); // UHCH skips 5 — mid is 3
    expect(uhchCoverageTier("Phonak", "70")).toBeNull();  // UHCH skips 70 — mid is 50
  });
});

describe("nationsCoverageTier", () => {
  it("keeps Nations' own 6-rung ladder in order", () => {
    expect(NATIONS_TIER_ORDER).toEqual(
      ["Standard", "Select", "Superior Plus", "Advanced", "Advanced Plus", "Specialty"]);
  });
  it("maps Signia by numeric tech level, generation-agnostic", () => {
    expect(nationsCoverageTier(fam("sig-pure-ix"), "7IX")).toBe("Specialty");
    expect(nationsCoverageTier(fam("sig-pure-ix"), "5IX")).toBe("Advanced Plus");
    expect(nationsCoverageTier(fam("sig-pure-ix"), "3IX")).toBe("Advanced");
    expect(nationsCoverageTier(fam("sig-pure-ix"), "2IX")).toBe("Superior Plus");
    expect(nationsCoverageTier(fam("sig-pure-ix"), "1IX")).toBeNull(); // off-plan
  });
  it("treats base Active IX (1IX) as Superior Plus, not off-plan", () => {
    expect(nationsCoverageTier(fam("sig-active-ix"), "1IX")).toBe("Superior Plus");
    expect(nationsCoverageTier(fam("sig-active-ix"), "7IX")).toBe("Specialty"); // Active Pro
  });
  it("splits Phonak 30 by generation (Lumity=Select, Infinio=Superior Plus)", () => {
    expect(nationsCoverageTier(fam("pho-audeo-lumity"), "30")).toBe("Select");
    expect(nationsCoverageTier(fam("pho-audeo-infinio"), "30")).toBe("Superior Plus");
    expect(nationsCoverageTier(fam("pho-audeo-lumity"), "90")).toBe("Specialty");
    expect(nationsCoverageTier(fam("pho-audeo-infinio"), "70")).toBe("Advanced Plus");
  });
  it("prices Phonak Sphere at Specialty for 90/70 only", () => {
    expect(nationsCoverageTier(fam("pho-sphere-infinio"), "90")).toBe("Specialty");
    expect(nationsCoverageTier(fam("pho-sphere-infinio"), "70")).toBe("Specialty");
    expect(nationsCoverageTier(fam("pho-sphere-infinio"), "50")).toBeNull();
  });
  it("maps Oticon Real (inverted numbering) and leaves Intent off-plan", () => {
    expect(nationsCoverageTier(fam("oti-real"), "1")).toBe("Specialty");
    expect(nationsCoverageTier(fam("oti-real"), "3")).toBe("Advanced");
    expect(nationsCoverageTier(fam("oti-intent"), "1")).toBeNull(); // not in Nations catalog
  });
  it("bumps ReSound Nexia customs one tier above the RIC/BTE forms", () => {
    expect(nationsCoverageTier(fam("res-nexia-ric"), "7")).toBe("Advanced Plus");
    expect(nationsCoverageTier(fam("res-nexia-custom"), "7")).toBe("Specialty");
    expect(nationsCoverageTier(fam("res-nexia-ric"), "3")).toBeNull(); // level 3 off-plan
  });
  it("maps Starkey and Widex by numeric level", () => {
    expect(nationsCoverageTier(fam("sta-edge-ai-ric"), "24")).toBe("Specialty");
    expect(nationsCoverageTier(fam("sta-edge-ai-ric"), "12")).toBe("Superior Plus");
    expect(nationsCoverageTier(fam("wid-moment-bte"), "440")).toBe("Specialty");
    expect(nationsCoverageTier(fam("wid-moment-bte"), "110")).toBe("Superior Plus");
  });
  it("prices the whole Rexton line at Select regardless of tech level", () => {
    expect(nationsCoverageTier(fam("rex-reach-r"), "80")).toBe("Select");
    expect(nationsCoverageTier(fam("rex-reach-r"), "20")).toBe("Select");
  });
  it("is null for missing input", () => {
    expect(nationsCoverageTier(null, "7IX")).toBeNull();
    expect(nationsCoverageTier(fam("sig-pure-ix"), null)).toBeNull();
    expect(nationsCoverageTier({ manufacturer: "Beltone", id: "x" }, "5")).toBeNull();
  });
});

describe("findTierRank / findAnchorForRank", () => {
  it("resolves (familyId, techLevel) → rank and rank → anchor via 6 - sort_order", () => {
    const rank = findTierRank(TIERS, "fam-signia-pure", "7IX");
    expect(rank).toBe(5);
    expect(findAnchorForRank(ANCHORS.signia, rank).label).toBe("Premium");
    expect(findAnchorForRank(ANCHORS.signia, 4).label).toBe("Advanced");
  });
  it("returns null for unseeded families or missing input", () => {
    expect(findTierRank(TIERS, "fam-unknown", "7IX")).toBeNull();
    expect(findTierRank(TIERS, "fam-signia-pure", null)).toBeNull();
    expect(findAnchorForRank(ANCHORS.signia, null)).toBeNull();
    expect(findAnchorForRank([], 5)).toBeNull();
  });
});

describe("deriveEarPrice", () => {
  const baseOpts = { catalog: CATALOG, productCatalogTiers: TIERS, anchorsByClass: ANCHORS, plans: [] };

  it("prices CROS units flat at $1,250", () => {
    expect(deriveEarPrice({ variant: "CROS" }, { ...baseOpts, form: { payType: "private" } }))
      .toEqual({ price: CROS_PRICE_PER_UNIT, source: "cros" });
  });

  it("uses the carrier copay for insurance patients regardless of manufacturer", () => {
    const ep = deriveEarPrice(
      { familyId: "fam-signia-pure", techLevel: "7IX" },
      { ...baseOpts, form: { payType: "insurance", tierPrice: 699 } }
    );
    expect(ep).toEqual({ price: 699, source: "insurance-copay" });
  });

  it("backfills insurance-with-no-plan at standard-class retail (Kurt), not null", () => {
    // No plan/tier chosen (tierPrice null) → the screen should still price the
    // device at the manufacturer-agnostic 'standard' anchor, NOT go blank.
    const ep = deriveEarPrice(
      { familyId: "fam-signia-pure", techLevel: "7IX" },
      { ...baseOpts, form: { payType: "insurance", tierPrice: null } }
    );
    expect(ep).toEqual({ price: 4997.5, source: "insurance-standard", class: "standard", rank: 5, anchorLabel: "Premium" });
  });

  it("recomputes the no-plan backfill per device — not sticky to a prior price", () => {
    const opts = { ...baseOpts, form: { payType: "insurance", tierPrice: null } };
    expect(deriveEarPrice({ familyId: "fam-signia-pure", techLevel: "7IX" }, opts).price).toBe(4997.5); // standard rank 5
    expect(deriveEarPrice({ familyId: "fam-signia-pure", techLevel: "5IX" }, opts).price).toBe(4497.5); // standard rank 4
  });

  it("still returns null for no-plan insurance when the device isn't configured", () => {
    expect(deriveEarPrice(
      { familyId: "fam-signia-pure" }, // no techLevel
      { ...baseOpts, form: { payType: "insurance", tierPrice: null } }
    )).toBeNull();
  });

  it("resolves private-pay from the manufacturer-class anchor (the #18 fix: Signia 7IX ≠ standard Premium)", () => {
    const ep = deriveEarPrice(
      { familyId: "fam-signia-pure", techLevel: "7IX" },
      { ...baseOpts, form: { payType: "private" } }
    );
    expect(ep.price).toBe(3997.5);
    expect(ep.source).toBe("class");
    expect(ep.class).toBe("signia");
    expect(ep.anchorLabel).toBe("Premium");
  });

  it("falls back to the standard class when the manufacturer class isn't seeded", () => {
    const ep = deriveEarPrice(
      { familyId: "fam-rexton-reach", techLevel: "R-Li M" },
      { ...baseOpts, form: { payType: "private" } }
    );
    expect(ep.source).toBe("fallback");
    expect(ep.price).toBe(3997.5); // standard rank-3 anchor
  });

  it("prices UHCH on-plan devices from the plan tier, not a flat copay", () => {
    const ep = deriveEarPrice(
      { familyId: "fam-signia-pure", techLevel: "7IX" },
      { ...baseOpts, plans: UHCH_PLANS, form: { payType: "insurance", tpa: "UHCH", carrier: "UnitedHealthcare", planGroup: "Medicare Supplement" } }
    );
    expect(ep).toEqual({ price: 1075, source: "uhch-onplan", tier: "Premium" });
  });

  it("flags UHCH off-plan devices at standard retail", () => {
    const ep = deriveEarPrice(
      { familyId: "fam-signia-pure", techLevel: "5IX" }, // UHCH skips Signia 5
      { ...baseOpts, plans: UHCH_PLANS, form: { payType: "insurance", tpa: "UHCH", carrier: "UnitedHealthcare", planGroup: "Medicare Supplement" } }
    );
    expect(ep.source).toBe("uhch-offplan");
    expect(ep.offPlan).toBe(true);
    expect(ep.price).toBe(3497.5); // signia rank-4 anchor
  });

  it("prices Nations on-plan devices from the flat tier copay (device-driven)", () => {
    const ep = deriveEarPrice(
      { familyId: "sig-pure-ix", techLevel: "7IX" },
      { ...baseOpts, plans: NATIONS_PLANS, form: nationsForm }
    );
    expect(ep).toEqual({ price: 2000, source: "nations-onplan", tier: "Specialty" });
  });

  it("prices a lower Nations tier from the same plan (Phonak Lumity 30 = Select)", () => {
    const ep = deriveEarPrice(
      { familyId: "pho-audeo-lumity", techLevel: "30" },
      { ...baseOpts, plans: NATIONS_PLANS, form: nationsForm }
    );
    expect(ep).toEqual({ price: 800, source: "nations-onplan", tier: "Select" });
  });

  it("flags Nations off-plan devices at standard retail (Oticon Intent)", () => {
    const ep = deriveEarPrice(
      { familyId: "oti-intent", techLevel: "1" },
      { ...baseOpts, plans: NATIONS_PLANS, form: nationsForm }
    );
    expect(ep.source).toBe("nations-offplan");
    expect(ep.offPlan).toBe(true);
    expect(ep.price).toBe(4997.5); // falls back to standard rank-5 anchor
  });

  it("returns null when configuration is insufficient", () => {
    expect(deriveEarPrice(null, { ...baseOpts, form: { payType: "private" } })).toBeNull();
    expect(deriveEarPrice({ familyId: "fam-signia-pure" }, { ...baseOpts, form: { payType: "private" } })).toBeNull();
    expect(deriveEarPrice({ familyId: "fam-unknown", techLevel: "7IX" }, { ...baseOpts, form: { payType: "private" } })).toBeNull();
  });
});

describe("pickBaselinePerAid", () => {
  it("excludes CROS ears and takes the max of mismatched prices", () => {
    expect(pickBaselinePerAid({ price: 1250, source: "cros" }, { price: 3997.5, source: "class" })).toBe(3997.5);
    expect(pickBaselinePerAid({ price: 3497.5, source: "class" }, { price: 3997.5, source: "class" })).toBe(3997.5);
    expect(pickBaselinePerAid(null, { price: 3997.5, source: "class" })).toBe(3997.5);
    expect(pickBaselinePerAid(null, null)).toBeNull();
  });
});
