// ── PER-EAR PRICING ────────────────────────────────────────────────────────────
// Backlog item #18: manufacturer- and tech-level-aware pricing. The wizard's
// step 5 used to lock `form.tierPrice` to whatever step 4 wrote — meaning a
// private-pay Signia 7IX patient saw the manufacturer-agnostic $4,997.50
// Premium price instead of Signia's $3,997.50. Now each ear resolves its own
// price from (manufacturer × techLevel × clinic_retail_anchors), with CROS/
// BICROS pricing flat at $1,250/unit per Kurt.
// (Extracted from Distil.jsx so the money math is unit-testable. Callers pass
// `plans` explicitly — Distil's activePlans already falls back to its seed
// INSURANCE_PLANS constant, so no fallback lives here.)

export const CROS_PRICE_PER_UNIT = 1250;

export function isSideCros(side) {
  if (!side) return false;
  if (side.isCROS) return true;
  return /^(CROS|BICROS)/i.test(side.variant || '');
}

// Map a catalog manufacturer name to a clinic_retail_anchors.manufacturer_class
// key. Returns 'standard' for unrecognized labels (TruHearing private-label,
// custom brands) so the pricing math gracefully falls back to the
// manufacturer-agnostic baseline rather than producing a null.
export function manufacturerToClass(name) {
  const m = (name || '').toLowerCase();
  if (m === 'signia')  return 'signia';
  if (m === 'phonak')  return 'phonak';
  if (m === 'oticon')  return 'oticon';
  if (m === 'starkey') return 'starkey';
  if (m === 'widex')   return 'widex';
  if (m === 'rexton')  return 'rexton';
  if (m === 'resound') return 'resound';
  return 'standard';
}

// ── UHCH (United Healthcare Hearing) coverage map ───────────────────────────
// UHCH's plan "tech levels" do NOT map cleanly to the manufacturers' real tech
// ladders — UHCH covers only the flagship + one specific mid tier per brand,
// and Relate (their private-label Unitron) carries its own Gold/Platinum value
// tiers. This table is the hardcoded translation: (manufacturer × catalog
// tech_level) → UHCH tier label. Anything not listed is OFF-PLAN — Rexton
// entirely, Signia 5IX/2IX/1IX, Phonak 70/30, ReSound 7/3, etc. — billed at
// standard retail and flagged, because off-plan devices can't be ordered
// through the UHCH portal without a signed insurance acknowledgement form.
// Seeded from the UHCH Medicare Supplement price list; validated with Kurt
// 2026-06-08. (Mid tier is deliberately "skip one": Signia=3 not 5, Phonak=50
// not 70 — that asymmetry is UHCH's, and the whole reason this is a lookup.)
const UHCH_COVERAGE = {
  Oticon:  { '1':'Premium', '3':'Standard' },
  Phonak:  { '90':'Premium', '50':'Standard' },
  Resound: { '9':'Premium', '5':'Standard' },
  Signia:  { '7AX':'Premium', '7IX':'Premium', '3AX':'Standard', '3IX':'Standard' },
  Starkey: { '24':'Premium', '16':'Standard' },
  Widex:   { '440':'Premium', '220':'Standard' },
  Relate:  { 'Gold':'Gold', 'Platinum':'Platinum' },
};

// UHCH tier label a (manufacturer, techLevel) maps to, or null when off-plan.
export function uhchCoverageTier(manufacturer, techLevel) {
  return UHCH_COVERAGE[manufacturer]?.[techLevel] ?? null;
}

// ── NationsBenefits (Nations Hearing) coverage map ──────────────────────────
// Nations, like UHCH, is device-driven: the chosen device decides the tier, and
// each Nations tier carries a FLAT copay — every device in a tier costs the
// patient the same. But Nations keeps its OWN 6-rung ladder (Standard < Select
// < Superior Plus < Advanced < Advanced Plus < Specialty) and the device→tier
// assignment is per product family, not a clean tech-level rule: Phonak Lumity
// 30 = Select but Infinio 30 = Superior Plus; Oticon's numbering inverts
// (Real1 = Specialty, Real3 = Advanced). This map encodes only what Nations'
// catalog actually covers for the brands MHC dispenses. Anything not covered —
// Oticon Intent/Own (Nations' catalog predates Intent), Signia level 1, Phonak
// Sphere below 70, ReSound level 3 — returns null → OFF-PLAN: billed at
// standard retail and flagged, because off-plan devices can't be ordered
// through the Nations portal without a signed insurance acknowledgement form
// (same mechanism as UHCH off-plan). Built from the NationsBenefits Hearing
// Aids Pricing Catalog (638 SKUs), cross-referenced against product_catalog;
// validated with Kurt 2026-07-07. Nations prices apply Nation-wide (single
// generic plan nested under Aetna — ~90% of MHC's Nations patients); the tier
// copays live on the insurance_plans row, not here.
export const NATIONS_TIER_ORDER = [
  'Standard', 'Select', 'Superior Plus', 'Advanced', 'Advanced Plus', 'Specialty',
];

// (catalog family, techLevel) → Nations tier label, or null when off-plan.
// `family` is a product_catalog entry (manufacturer, id, generation); techLevel
// is the cascade's per-ear level string ('7IX', '90', '440', '24', …).
export function nationsCoverageTier(family, techLevel) {
  if (!family || techLevel == null || techLevel === '') return null;
  const lvl = String(techLevel);
  const num = parseInt(lvl, 10); // '7IX'→7, '90'→90, '440'→440, '24'→24
  switch (family.manufacturer) {
    case 'Signia':
      // Numeric ladder, generation-agnostic (IX and AX price identically).
      // Level 1 isn't in Nations' catalog except the base Active IX (rank 1IX).
      if (family.id === 'sig-active-ix' && /^1/.test(lvl)) return 'Superior Plus';
      return { 7: 'Specialty', 5: 'Advanced Plus', 3: 'Advanced', 2: 'Superior Plus' }[num] || null;
    case 'Phonak':
      // Sphere is premium-only (90/70 → Specialty); its 50/30 rungs don't exist.
      if (family.id === 'pho-sphere-infinio') return num >= 70 ? 'Specialty' : null;
      if (family.generation === 'Lumity')
        return { 90: 'Specialty', 70: 'Advanced Plus', 50: 'Advanced', 30: 'Select' }[num] || null;
      // Infinio (Audéo / Naída / Virto): 30 sits a rung above Lumity 30.
      return { 90: 'Specialty', 70: 'Advanced Plus', 50: 'Advanced', 30: 'Superior Plus' }[num] || null;
    case 'Oticon':
      // Only Real and Xceed are in Nations' catalog; Intent-generation is not.
      if (family.id === 'oti-real')  return { 1: 'Specialty', 2: 'Advanced Plus', 3: 'Advanced' }[num] || null;
      if (family.id === 'oti-xceed') return { 1: 'Specialty', 2: 'Specialty', 3: 'Advanced Plus' }[num] || null;
      return null;
    case 'Resound': {
      // Nexia customs sit one tier above the RIC/BTE forms at the same level.
      const custom = family.id === 'res-nexia-custom';
      return custom
        ? { 9: 'Specialty', 7: 'Specialty', 5: 'Advanced Plus' }[num] || null
        : { 9: 'Specialty', 7: 'Advanced Plus', 5: 'Advanced' }[num] || null; // level 3 off-plan
    }
    case 'Starkey':
      return { 24: 'Specialty', 20: 'Advanced Plus', 16: 'Advanced', 12: 'Superior Plus' }[num] || null;
    case 'Widex':
      return { 440: 'Specialty', 330: 'Advanced Plus', 220: 'Advanced', 110: 'Superior Plus' }[num] || null;
    case 'Rexton':
      // Nations prices its entire Rexton line at Select, regardless of tech level.
      return 'Select';
    default:
      return null;
  }
}

// (familyId, techLevel) → tier_rank lookup via the product_catalog_tier table.
// Returns null when the family isn't in the catalog tier table yet (the row
// would need to be seeded — see migration 008 for the Signia IX 2IX/1IX pass).
export function findTierRank(productCatalogTiers, familyId, techLevel) {
  if (!familyId || !techLevel || !productCatalogTiers?.length) return null;
  const row = productCatalogTiers.find(
    t => t.productCatalogId === familyId && t.tierName === techLevel
  );
  return row?.tierRank ?? null;
}

// Anchor rows for a class are stored sorted by sort_order with sort 1 = top
// tier (rank 5 / Premium). Universal mapping: rank = 6 - sort_order. Works
// for both 4-tier (rank 5/4/3/2) and 5-tier (signia / standard) classes.
export function findAnchorForRank(anchors, rank) {
  if (!anchors?.length || rank == null) return null;
  return anchors.find(a => a.sort_order === (6 - rank)) || null;
}

// Resolve the per-aid price for one ear. Returns null when the configuration
// isn't sufficient to derive a price (manufacturer/techLevel unset, anchor
// row missing). Caller falls back to the tier baseline in that case.
//
// Shape: { price, source, class?, rank?, anchorLabel? }
//   source:
//     'cros'              — CROS/BICROS unit, $1,250 flat
//     'insurance-copay'   — carrier copay (form.tierPrice), manufacturer
//                            doesn't change patient out-of-pocket
//     'uhch-onplan'       — UHCH covers this device → tier copay (sets tier)
//     'uhch-offplan'      — UHCH does NOT cover it → standard retail, flagged
//                            (offPlan:true); not orderable via the UHCH portal
//     'nations-onplan'    — Nations covers this device → flat tier copay (sets
//                            tier); device-driven like UHCH
//     'nations-offplan'   — Nations does NOT cover it → standard retail, flagged
//                            (offPlan:true); needs an acknowledgement form
//     'class'             — resolved from manufacturer-class anchor
//     'fallback'          — manufacturer class wasn't seeded; used standard
export function deriveEarPrice(side, opts) {
  if (!side) return null;
  if (isSideCros(side)) {
    return { price: CROS_PRICE_PER_UNIT, source: 'cros' };
  }
  const { form, catalog, productCatalogTiers, anchorsByClass, plans } = opts;
  // UHCH is device-driven: the chosen device decides the patient's price via
  // the coverage map, not a flat plan copay. Must run before the generic
  // insurance branch (UHCH patients are payType 'insurance').
  if (form?.tpa === 'UHCH') {
    const family = (catalog || []).find(e => e.id === side.familyId);
    if (!family || !side.techLevel) return null;
    const covTier = uhchCoverageTier(family.manufacturer, side.techLevel);
    if (covTier) {
      const plan = (plans || []).find(p => p.tpa === 'UHCH' && p.carrier === form.carrier && p.planGroup === form.planGroup);
      const price = plan?.tiers?.find(t => t.label === covTier)?.price ?? null;
      if (price == null) return null;
      return { price, source: 'uhch-onplan', tier: covTier };
    }
    // Off-plan: not covered by UHCH → standard retail (manufacturer-class
    // anchor, same resolution as private pay), flagged for the provider.
    const cls = manufacturerToClass(family.manufacturer);
    const rank = findTierRank(productCatalogTiers, family.id, side.techLevel);
    let anchor = rank != null ? findAnchorForRank(anchorsByClass?.[cls], rank) : null;
    if (!anchor && rank != null) anchor = findAnchorForRank(anchorsByClass?.standard, rank);
    return {
      price: anchor ? parseFloat(anchor.price_per_aid) : null,
      source: 'uhch-offplan', offPlan: true, class: cls, rank, anchorLabel: anchor?.label,
    };
  }
  // Nations is device-driven like UHCH: the chosen device → Nations tier → a
  // flat copay pulled from the Nations plan row. Must run before the generic
  // insurance branch (Nations patients are payType 'insurance').
  if (form?.tpa === 'Nations') {
    const family = (catalog || []).find(e => e.id === side.familyId);
    if (!family || !side.techLevel) return null;
    const covTier = nationsCoverageTier(family, side.techLevel);
    if (covTier) {
      const plan = (plans || []).find(p => p.tpa === 'Nations'
        && p.carrier === form.carrier && p.planGroup === form.planGroup);
      const price = plan?.tiers?.find(t => t.label === covTier)?.price ?? null;
      if (price == null) return null;
      return { price, source: 'nations-onplan', tier: covTier };
    }
    // Off-plan: not in Nations' catalog → standard retail (manufacturer-class
    // anchor, same resolution as private pay), flagged for the provider.
    const cls = manufacturerToClass(family.manufacturer);
    const rank = findTierRank(productCatalogTiers, family.id, side.techLevel);
    let anchor = rank != null ? findAnchorForRank(anchorsByClass?.[cls], rank) : null;
    if (!anchor && rank != null) anchor = findAnchorForRank(anchorsByClass?.standard, rank);
    return {
      price: anchor ? parseFloat(anchor.price_per_aid) : null,
      source: 'nations-offplan', offPlan: true, class: cls, rank, anchorLabel: anchor?.label,
    };
  }
  if (form?.payType === 'insurance') {
    if (form.tierPrice == null) return null;
    return { price: form.tierPrice, source: 'insurance-copay' };
  }
  // Private-pay branch — manufacturer + techLevel required.
  const family = (catalog || []).find(e => e.id === side.familyId);
  if (!family || !side.techLevel) return null;
  const cls = manufacturerToClass(family.manufacturer);
  const rank = findTierRank(productCatalogTiers, family.id, side.techLevel);
  if (rank == null) return null;
  let anchor = findAnchorForRank(anchorsByClass?.[cls], rank);
  let source = 'class';
  if (!anchor) {
    anchor = findAnchorForRank(anchorsByClass?.standard, rank);
    source = 'fallback';
  }
  if (!anchor) return null;
  return {
    price: parseFloat(anchor.price_per_aid),
    source,
    class: cls,
    rank,
    anchorLabel: anchor.label,
  };
}

// Effective per-aid baseline for the back-compat `form.tierPrice` scalar
// downstream. For CROS fittings, the "real aid" ear drives the baseline
// (the CROS unit is a $1,250 add-on, not the per-aid price). For matched
// bilateral fittings, both ears agree so either works. For mismatched
// manufacturers the higher of the two wins — the UI shows a caution.
export function pickBaselinePerAid(leftEar, rightEar) {
  const lp = leftEar && leftEar.source !== 'cros' ? leftEar.price : null;
  const rp = rightEar && rightEar.source !== 'cros' ? rightEar.price : null;
  if (lp == null && rp == null) return null;
  if (lp == null) return rp;
  if (rp == null) return lp;
  return Math.max(lp, rp);
}
