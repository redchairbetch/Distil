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
  DIRECT_PURCHASE_TIER_LEVEL, directPurchaseLockedTech, resolveClassRetailPerAid,
  TIER_LABEL_CATALOG_RANK, tierMatchedTech,
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
  { id: "res-key-ric",       manufacturer: "Resound", generation: "Key" },
  { id: "res-key-custom",    manufacturer: "Resound", generation: "Key" },
  { id: "res-savi-ric",      manufacturer: "Resound", generation: "Savi" },
  { id: "res-vivia",         manufacturer: "Resound", generation: "Nexia" },
  { id: "oti-own",           manufacturer: "Oticon",  generation: "Own" },
  { id: "oti-own-intent",    manufacturer: "Oticon",  generation: "Intent" },
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
  it("maps the ReSound value lines (Key / Savi) by family — the no-OOP options", () => {
    // Level 3 means different tiers per family (off-plan for Nexia, Standard for
    // Key, Select for Savi) — hence the per-family branch.
    expect(nationsCoverageTier(fam("res-key-ric"), "3")).toBe("Standard");
    expect(nationsCoverageTier(fam("res-key-ric"), "4")).toBe("Select");
    expect(nationsCoverageTier(fam("res-key-custom"), "3")).toBe("Superior Plus");
    expect(nationsCoverageTier(fam("res-key-custom"), "4")).toBe("Superior Plus");
    expect(nationsCoverageTier(fam("res-savi-ric"), "2")).toBe("Standard");
    expect(nationsCoverageTier(fam("res-savi-ric"), "3")).toBe("Select");
  });
  it("maps ReSound Vivia level 3 to Superior Plus (not off-plan like Nexia 3)", () => {
    expect(nationsCoverageTier(fam("res-vivia"), "9")).toBe("Specialty");
    expect(nationsCoverageTier(fam("res-vivia"), "7")).toBe("Advanced Plus");
    expect(nationsCoverageTier(fam("res-vivia"), "5")).toBe("Advanced");
    expect(nationsCoverageTier(fam("res-vivia"), "3")).toBe("Superior Plus");
  });
  it("maps Oticon legacy Own (inverted) and keeps Own-Intent off-plan", () => {
    expect(nationsCoverageTier(fam("oti-own"), "1")).toBe("Specialty");
    expect(nationsCoverageTier(fam("oti-own"), "3")).toBe("Advanced Plus");
    expect(nationsCoverageTier(fam("oti-own"), "5")).toBe("Superior Plus");
    expect(nationsCoverageTier(fam("oti-own-intent"), "1")).toBeNull(); // Intent gen off-plan
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

describe("resolveClassRetailPerAid (managed-care savings anchor)", () => {
  const opts = { catalog: CATALOG, productCatalogTiers: TIERS, anchorsByClass: ANCHORS };

  it("resolves an honest per-brand retail for a known manufacturer", () => {
    const r = resolveClassRetailPerAid({ familyId: "fam-signia-pure", techLevel: "7IX" }, opts);
    expect(r).toMatchObject({ price: 3997.5, class: "signia", rank: 5, anchorLabel: "Premium", fallbackUsed: false, realRetail: true });
  });

  it("marks a standard-class backfill as NOT a real per-brand retail", () => {
    // Rexton has no class anchors in the fixture → falls back to 'standard'.
    const r = resolveClassRetailPerAid({ familyId: "fam-rexton-reach", techLevel: "R-Li M" }, opts);
    expect(r.price).toBe(3997.5); // standard rank-3
    expect(r.fallbackUsed).toBe(true);
    expect(r.realRetail).toBe(false);
  });

  it("treats an unrecognized brand (→ standard class, e.g. Relate) as no real retail", () => {
    // manufacturerToClass('Relate') → 'standard'; the standard anchors match
    // directly (no fallback), but 'standard' is never an honest per-brand
    // anchor, so the savings framing must stay suppressed for Relate.
    const localCatalog = [{ id: "relate-x", manufacturer: "Relate" }];
    const localTiers = [{ productCatalogId: "relate-x", tierName: "Gold", tierRank: 5 }];
    const r = resolveClassRetailPerAid(
      { familyId: "relate-x", techLevel: "Gold" },
      { catalog: localCatalog, productCatalogTiers: localTiers, anchorsByClass: ANCHORS }
    );
    expect(r.class).toBe("standard");
    expect(r.fallbackUsed).toBe(false);
    expect(r.realRetail).toBe(false);
    expect(r.price).toBe(4997.5); // standard rank-5
  });

  it("returns null for CROS units and insufficient config", () => {
    expect(resolveClassRetailPerAid({ variant: "CROS Pure" }, opts)).toBeNull();
    expect(resolveClassRetailPerAid({ familyId: "fam-signia-pure" }, opts)).toBeNull(); // no techLevel
    expect(resolveClassRetailPerAid({ familyId: "fam-unknown", techLevel: "7IX" }, opts)).toBeNull();
    expect(resolveClassRetailPerAid(null, opts)).toBeNull();
  });
});

describe("deriveEarPrice", () => {
  const baseOpts = { catalog: CATALOG, productCatalogTiers: TIERS, anchorsByClass: ANCHORS, plans: [] };

  it("prices CROS units flat at $1,250", () => {
    expect(deriveEarPrice({ variant: "CROS" }, { ...baseOpts, form: { payType: "private" } }))
      .toEqual({ price: CROS_PRICE_PER_UNIT, source: "cros" });
  });

  it("prices a TruHearing CROS transmitter at the tier instrument price (plan row), not $1,250", () => {
    // Doctrine (Kurt, 2026-07-14): private-pay CROS is $1,250/unit; TruHearing
    // CROS transmitters bill at the coordinating technology-level instrument
    // price — the plan's tier copay. The TH card flow sets isCROS on the
    // transmitter side (no variant string, no familyId).
    const side = { manufacturer: "TruHearing", thModel: "th7li", style: "ric", techLevel: "Premium", isCROS: true };
    const plans = [{ tpa: "TruHearing", carrier: "Anthem", planGroup: "Prefix XMM",
      tiers: [{ label: "Advanced", price: 550 }, { label: "Premium", price: 850 }] }];
    const form = { payType: "insurance", tpa: "TruHearing", carrier: "Anthem", planGroup: "Prefix XMM", tierPrice: 850 };
    expect(deriveEarPrice(side, { ...baseOpts, plans, form }))
      .toEqual({ price: 850, source: "cros", tier: "Premium" });
  });

  it("falls back to form.tierPrice for a TruHearing CROS transmitter when the plan row is missing, then to $1,250", () => {
    const side = { manufacturer: "TruHearing", thModel: "th6", style: "ric", techLevel: "Advanced", isCROS: true };
    expect(deriveEarPrice(side, { ...baseOpts, plans: [], form: { payType: "insurance", tpa: "TruHearing", tierPrice: 550 } }))
      .toEqual({ price: 550, source: "cros", tier: "Advanced" });
    // No plan row AND no tierPrice resolved yet → flat unit rate backstop.
    expect(deriveEarPrice(side, { ...baseOpts, plans: [], form: { payType: "insurance", tpa: "TruHearing" } }))
      .toEqual({ price: CROS_PRICE_PER_UNIT, source: "cros" });
  });

  it("keeps non-TruHearing CROS flat at $1,250 even on insurance", () => {
    // Standard-catalog CROS variants (and Direct Purchase Signia CROS) are
    // clinic-priced units — the tier-copay rule is TruHearing-only.
    expect(deriveEarPrice({ manufacturer: "Signia", variant: "CROS" },
      { ...baseOpts, form: { payType: "insurance", tpa: "TruHearing", tierPrice: 850 } }))
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

  it("flags an on-plan Nations device whose tier copay is a catalog hole", () => {
    // The device resolves to a covered tier (Specialty), but the plan row has
    // no copay for it → not off-plan, just an un-mapped rate to verify.
    const plansWithHole = [{ tpa: "Nations", carrier: "Aetna", planGroup: "Nations Hearing",
      tiers: [{ label: "Standard", price: 600 }] }]; // Specialty missing
    const ep = deriveEarPrice(
      { familyId: "sig-pure-ix", techLevel: "7IX" }, // maps to Specialty
      { ...baseOpts, plans: plansWithHole, form: nationsForm }
    );
    expect(ep).toEqual({ price: null, source: "nations-onplan", tier: "Specialty", requiresVerification: true });
  });

  it("flags an on-plan UHCH device whose tier copay is a catalog hole", () => {
    const plansWithHole = [{ tpa: "UHCH", carrier: "UnitedHealthcare", planGroup: "Medicare Supplement",
      tiers: [{ label: "Standard", price: 775 }] }]; // Premium missing
    const ep = deriveEarPrice(
      { familyId: "fam-signia-pure", techLevel: "7IX" }, // maps to Premium
      { ...baseOpts, plans: plansWithHole, form: { payType: "insurance", tpa: "UHCH", carrier: "UnitedHealthcare", planGroup: "Medicare Supplement" } }
    );
    expect(ep).toEqual({ price: null, source: "uhch-onplan", tier: "Premium", requiresVerification: true });
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

describe("Direct Purchase — tier locks the Signia tech level", () => {
  const pureIX = { techLevels: ["7IX", "5IX", "3IX", "2IX", "1IX"] };
  const pureAX = { techLevels: ["7AX", "5AX", "3AX", "2AX", "1AX"] };
  const activeIX = { techLevels: ["7IX", "1IX"] };

  it("maps TruHearing tiers to Signia level numbers", () => {
    expect(DIRECT_PURCHASE_TIER_LEVEL).toEqual({ Premium: 7, Advanced: 5, Standard: 3 });
  });

  it("locks to the family's matching level, carrying IX vs AX from the family", () => {
    expect(directPurchaseLockedTech(pureIX, "Premium")).toBe("7IX");
    expect(directPurchaseLockedTech(pureIX, "Advanced")).toBe("5IX");
    expect(directPurchaseLockedTech(pureIX, "Standard")).toBe("3IX");
    expect(directPurchaseLockedTech(pureAX, "Premium")).toBe("7AX");
    expect(directPurchaseLockedTech(pureAX, "Advanced")).toBe("5AX");
  });

  it("returns null when the family doesn't offer that tier's level (hidden at that tier)", () => {
    expect(directPurchaseLockedTech(activeIX, "Advanced")).toBeNull(); // only 7IX / 1IX
    expect(directPurchaseLockedTech(pureIX, "Level 1")).toBeNull();    // unknown tier
    expect(directPurchaseLockedTech(null, "Premium")).toBeNull();
  });

  it("prices a Direct Purchase at the flat TruHearing tier price (source direct-purchase)", () => {
    const ep = deriveEarPrice(
      { familyId: "sig-pure-ix", techLevel: "7IX" },
      { catalog: CATALOG, productCatalogTiers: TIERS, anchorsByClass: ANCHORS, plans: [],
        form: { payType: "insurance", tpa: "TruHearing", directPurchase: true, tierPrice: 999 } }
    );
    expect(ep).toEqual({ price: 999, source: "direct-purchase" }); // Signia device, TruHearing $999
  });
});

describe("tierMatchedTech — tier-first standard cascade", () => {
  // Rank rows for a cross-brand pool: Signia numbers and Phonak numbers both
  // resolve through product_catalog_tier ranks, not brand-specific parsing.
  const MATCH_TIERS = [
    { productCatalogId: "fam-signia-pure", tierName: "7IX", tierRank: 5 },
    { productCatalogId: "fam-signia-pure", tierName: "5IX", tierRank: 4 },
    { productCatalogId: "fam-signia-pure", tierName: "3IX", tierRank: 3 },
    { productCatalogId: "fam-signia-pure", tierName: "1IX", tierRank: 1 },
    { productCatalogId: "pho-audeo-infinio", tierName: "90", tierRank: 5 },
    { productCatalogId: "pho-audeo-infinio", tierName: "70", tierRank: 4 },
    { productCatalogId: "pho-audeo-infinio", tierName: "50", tierRank: 3 },
  ];
  const sigFam = { id: "fam-signia-pure", techLevels: ["7IX", "5IX", "3IX", "1IX"] };
  const phoFam = { id: "pho-audeo-infinio", techLevels: ["90", "70", "50"] };

  it("maps both tier vocabularies onto the catalog rank scale", () => {
    expect(TIER_LABEL_CATALOG_RANK["select"]).toBe(5);
    expect(TIER_LABEL_CATALOG_RANK["premium"]).toBe(5);
    expect(TIER_LABEL_CATALOG_RANK["advanced"]).toBe(4);
    expect(TIER_LABEL_CATALOG_RANK["level 1"]).toBe(1);
  });

  it("finds the family's level at the tier's rank across brands", () => {
    expect(tierMatchedTech(sigFam, "Select", MATCH_TIERS)).toBe("7IX");
    expect(tierMatchedTech(sigFam, "Advanced", MATCH_TIERS)).toBe("5IX");
    expect(tierMatchedTech(sigFam, "Level 1", MATCH_TIERS)).toBe("1IX");
    expect(tierMatchedTech(phoFam, "Select", MATCH_TIERS)).toBe("90");
    expect(tierMatchedTech(phoFam, "Standard", MATCH_TIERS)).toBe("50");
  });

  it("is case-insensitive on the label and null-safe on gaps", () => {
    expect(tierMatchedTech(sigFam, "select", MATCH_TIERS)).toBe("7IX");
    expect(tierMatchedTech(sigFam, "Level 2", MATCH_TIERS)).toBeNull(); // no rank-2 level seeded
    expect(tierMatchedTech(phoFam, "Level 1", MATCH_TIERS)).toBeNull(); // family has no rank-1 level
    expect(tierMatchedTech(sigFam, "Off-Plan", MATCH_TIERS)).toBeNull();
    expect(tierMatchedTech(null, "Select", MATCH_TIERS)).toBeNull();
    expect(tierMatchedTech(sigFam, "Select", [])).toBeNull();
  });
});
