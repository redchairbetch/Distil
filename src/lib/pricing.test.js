import { describe, it, expect } from "vitest";
import {
  CROS_PRICE_PER_UNIT, isSideCros, manufacturerToClass, uhchCoverageTier,
  findTierRank, findAnchorForRank, deriveEarPrice, pickBaselinePerAid,
} from "./pricing.js";

// Minimal fixtures mirroring the real data shapes.
const CATALOG = [
  { id: "fam-signia-pure", manufacturer: "Signia" },
  { id: "fam-rexton-reach", manufacturer: "Rexton" },
];
const TIERS = [
  { productCatalogId: "fam-signia-pure", tierName: "7IX", tierRank: 5 },
  { productCatalogId: "fam-signia-pure", tierName: "5IX", tierRank: 4 },
  { productCatalogId: "fam-rexton-reach", tierName: "R-Li M", tierRank: 3 },
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

  it("returns null when the insurance tier price isn't set yet", () => {
    expect(deriveEarPrice(
      { familyId: "fam-signia-pure", techLevel: "7IX" },
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
