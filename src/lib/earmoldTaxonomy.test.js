// Drift guard for the earmold catalog + coupling fork (backlog #42a),
// styleTaxonomy.test.js's sibling. Guards the referential seams: coupling ids
// between the picker fork and the per-side state vocabulary, canonical
// manufacturer keys everywhere, and the expectation that every manufacturer
// whose receiver table can demand an earmold either has catalog rows or is
// explicitly listed as awaiting its order form — so adding a new earmold:true
// power without catalog coverage fails loudly instead of rendering an empty
// picker.

import { describe, it, expect } from "vitest";
import { COUPLINGS, STYLE_SUBCATEGORIES, RECEIVER_POWERS } from "./catalogConstants.js";
import { TH_GAIN_MATRIX } from "./truhearingCatalog.js";
import { EARMOLD_SEED } from "./earmoldSeed.js";
import { MFR_KEYS, normalizeMfr } from "./manufacturerKeys.js";

// Manufacturers with earmold-requiring receivers but no earmold order form in
// docs/manufacturer-forms/ yet (Kurt sourcing). Shrink this list as forms land.
// 2026-08-30: Phonak/Unitron/Widex forms arrived and are seeded — Rexton is
// the last one out.
const AWAITING_ORDER_FORM = new Set(["rexton"]);

describe("coupling fork", () => {
  it("COUPLINGS ids are exactly dome|earmold and ride on the RIC/BTE branches", () => {
    expect(COUPLINGS.map((c) => c.id).sort()).toEqual(["dome", "earmold"]);
    for (const subId of ["ric-family", "trad-bte"]) {
      const sub = STYLE_SUBCATEGORIES.find((s) => s.id === subId);
      expect(sub?.couplings, `${subId} missing couplings`).toBe(COUPLINGS);
    }
    for (const subId of ["instant-fit", "custom-molded"]) {
      const sub = STYLE_SUBCATEGORIES.find((s) => s.id === subId);
      expect(sub?.couplings, `${subId} must not carry couplings`).toBeUndefined();
    }
  });
});

describe("earmold catalog seed", () => {
  it("rows are canonical, uniquely keyed, and structurally sound", () => {
    const ids = new Set();
    for (const r of EARMOLD_SEED) {
      expect(MFR_KEYS, `${r.id}: manufacturer '${r.manufacturer}' not canonical`).toContain(r.manufacturer);
      expect(r.id, `${r.id}: id must be '<mfr>|<styleId>'`).toBe(`${r.manufacturer}|${r.styleId}`);
      expect(ids.has(r.id), `duplicate id ${r.id}`).toBe(false);
      ids.add(r.id);
      expect(["ric", "bte", "both"], `${r.id}: bad deviceType`).toContain(r.deviceType);
      expect(Array.isArray(r.materials), `${r.id}: materials must be an array`).toBe(true);
      expect(Array.isArray(r.vents), `${r.id}: vents must be an array`).toBe(true);
      expect(["high", "medium", "low"], `${r.id}: bad confidence`).toContain(r.confidence);
    }
  });

  it("every earmold-requiring receiver manufacturer has catalog rows or is explicitly awaiting its form", () => {
    const mfrsWithEarmoldPowers = new Set(
      Object.entries(RECEIVER_POWERS)
        .filter(([, powers]) => powers.some((p) => p.earmold))
        .map(([name]) => normalizeMfr(name))
        .filter(Boolean)
    );
    const seeded = new Set(EARMOLD_SEED.filter((r) => r.deviceType !== "bte").map((r) => r.manufacturer));
    for (const key of mfrsWithEarmoldPowers) {
      const covered = seeded.has(key) || AWAITING_ORDER_FORM.has(key);
      expect(covered, `manufacturer '${key}' has earmold:true receiver powers but no catalog rows and is not listed as awaiting its order form`).toBe(true);
    }
  });

  it("TruHearing earmold gains resolve to the Signia catalog", () => {
    const anyThEarmold = Object.values(TH_GAIN_MATRIX).some((rows) => rows.some((g) => g.earmold));
    expect(anyThEarmold).toBe(true);
    expect(normalizeMfr("TruHearing")).toBe("signia");
    expect(EARMOLD_SEED.some((r) => r.manufacturer === "signia" && r.deviceType === "ric")).toBe(true);
  });
});
