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
import { computeComplexBenefit } from "./complexBenefit.js";

// Each case is a REAL Verification of Benefits from the billing department,
// with a chosen device baseline and a hand-verified patient out-of-pocket.
describe("computeComplexBenefit — real VOB examples", () => {
  it("Regence BC/BS — 75% after deductible, $1,000/yr max (benefit-cap binds)", () => {
    // Ded $2000/$1000 met → $1000 remaining; 75% up to $1000 max/yr; OOP huge.
    const r = computeComplexBenefit({
      baselinePerAid: 2500, fittingType: "binaural",
      inputs: { coveragePercent: 75, deductibleRemaining: 1000, benefitMax: 1000, benefitBasis: "combined", oopMaxRemaining: 15533.04 },
    });
    // billed 5000; plan pays min(75% of 4000, 1000) = 1000; patient = 4000.
    expect(r.insuranceTotal).toBe(1000);
    expect(r.patientTotal).toBe(4000);
    expect(r.patientPerAid).toBe(2000);
    expect(r.capApplied).toBe(true);
    expect(r.oopApplied).toBe(false);
  });

  it("GEHA / UHC — 75%, deductible met, $2,500 combined max", () => {
    // Ded fully met (0 remaining); 75% up to $2500 combined; OOP 7166.91 remaining.
    const r = computeComplexBenefit({
      baselinePerAid: 2500, fittingType: "binaural",
      inputs: { coveragePercent: 75, deductibleRemaining: 0, benefitMax: 2500, benefitBasis: "combined", oopMaxRemaining: 7166.91 },
    });
    // billed 5000; 75% = 3750 capped to 2500; patient = 2500.
    expect(r.insuranceTotal).toBe(2500);
    expect(r.patientTotal).toBe(2500);
    expect(r.capApplied).toBe(true);
    expect(r.oopApplied).toBe(false);
  });

  it("Regence — 100% up to $2,025 per ear, no deductible (allowance-as-coverage)", () => {
    const r = computeComplexBenefit({
      baselinePerAid: 3500, fittingType: "binaural",
      inputs: { coveragePercent: 100, deductibleRemaining: 0, benefitMax: 2025, benefitBasis: "per_ear", oopMaxRemaining: 5000 },
    });
    // billed 7000; plan pays min(7000, 2025*2=4050) = 4050; patient = 2950 ($1475/ear).
    expect(r.insuranceTotal).toBe(4050);
    expect(r.patientTotal).toBe(2950);
    expect(r.patientPerAid).toBe(1475);
    expect(r.capApplied).toBe(true);
  });

  it("UHC Choice Plus — 80% up to $3,000/ear, OOP-max remaining BINDS", () => {
    // Ded met; 80% up to $3000/ear; OOP 6550/5240.42 met → 1309.58 remaining.
    const r = computeComplexBenefit({
      baselinePerAid: 3500, fittingType: "binaural",
      inputs: { coveragePercent: 80, deductibleRemaining: 0, benefitMax: 3000, benefitBasis: "per_ear", oopMaxRemaining: 1309.58 },
    });
    // billed 7000; 80% = 5600 (< cap 6000); coinsurance share 1400 > OOP 1309.58
    // → patient capped at 1309.58, plan covers the rest.
    expect(r.patientTotal).toBe(1309.58);
    expect(r.oopApplied).toBe(true);
    expect(r.capApplied).toBe(false);
    expect(r.insuranceTotal).toBe(5690.42);
  });

  it("BC/BS FEP — 100% up to $2,500 total, no deductible", () => {
    const r = computeComplexBenefit({
      baselinePerAid: 2500, fittingType: "binaural",
      inputs: { coveragePercent: 100, deductibleRemaining: 0, benefitMax: 2500, benefitBasis: "combined" },
    });
    // billed 5000; plan pays min(5000, 2500) = 2500; patient = 2500.
    expect(r.insuranceTotal).toBe(2500);
    expect(r.patientTotal).toBe(2500);
  });

  it("Aetna (non-Nations) — 100% up to $2,000 total, no ded/OOP", () => {
    const r = computeComplexBenefit({
      baselinePerAid: 2500, fittingType: "binaural",
      inputs: { coveragePercent: 100, deductibleRemaining: 0, benefitMax: 2000, benefitBasis: "combined" },
    });
    expect(r.insuranceTotal).toBe(2000);
    expect(r.patientTotal).toBe(3000);
  });
});

describe("computeComplexBenefit — mechanics", () => {
  it("prices a monaural fitting on a per-ear cap", () => {
    const r = computeComplexBenefit({
      baselinePerAid: 3500, fittingType: "monaural",
      inputs: { coveragePercent: 100, benefitMax: 2025, benefitBasis: "per_ear" },
    });
    // billed 3500 (1 aid); cap 2025*1; plan pays 2025; patient 1475.
    expect(r.billedTotal).toBe(3500);
    expect(r.patientTotal).toBe(1475);
    expect(r.patientPerAid).toBe(1475);
  });

  it("applies deductible before coinsurance", () => {
    const r = computeComplexBenefit({
      baselinePerAid: 2000, fittingType: "binaural",
      inputs: { coveragePercent: 80, deductibleRemaining: 1000, benefitMax: null, benefitBasis: "combined" },
    });
    // billed 4000; ded 1000 first; after 3000; plan pays 80% = 2400; patient = 1600.
    expect(r.insuranceTotal).toBe(2400);
    expect(r.patientTotal).toBe(1600);
    expect(r.capApplied).toBe(false);
  });

  it("honors the finalOverridePerAid escape hatch", () => {
    const r = computeComplexBenefit({
      baselinePerAid: 3000, fittingType: "binaural",
      inputs: { coveragePercent: 80, finalOverridePerAid: 900 },
    });
    expect(r.overridden).toBe(true);
    expect(r.patientTotal).toBe(1800);
    expect(r.patientPerAid).toBe(900);
    expect(r.insuranceTotal).toBe(4200); // 6000 billed - 1800
  });

  it("no cap + no deductible + no OOP → straight coinsurance", () => {
    const r = computeComplexBenefit({
      baselinePerAid: 2500, fittingType: "binaural",
      inputs: { coveragePercent: 50 },
    });
    expect(r.patientTotal).toBe(2500);
    expect(r.insuranceTotal).toBe(2500);
  });
});
