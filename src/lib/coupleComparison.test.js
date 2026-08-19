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
  SEVERITY_DISPLAY,
  buildPersonSummary,
  clarityColor,
  patientTierLabel,
  tierProcessingPhrase,
  styleGuidance,
} from "./coupleComparison.js";

// A flat ear at a given dB across the standard frequencies.
const flatEar = db => ({ 250: db, 500: db, 1000: db, 2000: db, 4000: db, 8000: db });

const normalEar = flatEar(15);
// Sloping loss: 4k is 40+ dB worse than 500 (getSlope > 30 rule).
const slopingEar = { 250: 20, 500: 25, 1000: 35, 2000: 50, 4000: 65, 8000: 70 };

describe("SEVERITY_DISPLAY", () => {
  it("maps classifier vocabulary to consultation-mode display words", () => {
    expect(SEVERITY_DISPLAY["mod-severe"]).toBe("Moderately Severe");
    expect(SEVERITY_DISPLAY.normal).toBe("Normal");
    expect(SEVERITY_DISPLAY.profound).toBe("Profound");
  });
});

describe("buildPersonSummary", () => {
  it("classifies per-ear severity on the 20/40/55/70/90 worst-threshold bands", () => {
    expect(buildPersonSummary({ rightT: flatEar(20), leftT: flatEar(20) }).rSeverity).toBe("normal");
    expect(buildPersonSummary({ rightT: flatEar(21), leftT: flatEar(21) }).rSeverity).toBe("mild");
    expect(buildPersonSummary({ rightT: flatEar(41), leftT: {} }).rSeverity).toBe("moderate");
    expect(buildPersonSummary({ rightT: flatEar(56), leftT: {} }).rSeverity).toBe("mod-severe");
    expect(buildPersonSummary({ rightT: flatEar(71), leftT: {} }).rSeverity).toBe("severe");
    expect(buildPersonSummary({ rightT: flatEar(91), leftT: {} }).rSeverity).toBe("profound");
  });

  it("overall severity is the worse ear", () => {
    const s = buildPersonSummary({ rightT: flatEar(30), leftT: flatEar(60) });
    expect(s.rSeverity).toBe("mild");
    expect(s.lSeverity).toBe("mod-severe");
    expect(s.overall).toBe("mod-severe");
  });

  it("handles unilateral data: null severity on the untested ear, asymmetric stays false", () => {
    const s = buildPersonSummary({ rightT: flatEar(50), leftT: {} });
    expect(s.rSeverity).toBe("moderate");
    expect(s.lSeverity).toBeNull();
    expect(s.overall).toBe("moderate");
    expect(s.lPTA4).toBeNull();
    expect(s.asymmetric).toBe(false); // isAsymmetric needs both PTA4s
    expect(s.hasThresholds).toBe(true);
    expect(s.normalHearing).toBe(false); // TNL requires both ears tested
  });

  it("handles no data at all", () => {
    const empty = buildPersonSummary(null);
    expect(empty.hasThresholds).toBe(false);
    expect(empty.overall).toBeNull();
    expect(empty.slope).toBeNull();
    expect(empty.clarityR).toBeNull();
  });

  it("flags tested-no-loss when both ears sit at or under 20 dB", () => {
    const s = buildPersonSummary({ rightT: normalEar, leftT: normalEar });
    expect(s.normalHearing).toBe(true);
    expect(s.rSeverity).toBe("normal");
  });

  it("flags asymmetry at a 15 dB PTA4 gap and reads slope off the worse ear", () => {
    const s = buildPersonSummary({ rightT: flatEar(25), leftT: slopingEar });
    expect(s.asymmetric).toBe(true);
    expect(s.slope).toBe("sloping"); // left is the worse ear
  });

  it("word clarity falls back from CCT to unaided WRS, per consultation mode", () => {
    expect(buildPersonSummary({ rightT: {}, leftT: {}, cctR: 82, unaidedR: 60 }).clarityR).toBe(82);
    expect(buildPersonSummary({ rightT: {}, leftT: {}, unaidedR: 60 }).clarityR).toBe(60);
  });
});

describe("clarityColor", () => {
  it("matches consultation mode's bands", () => {
    expect(clarityColor(null)).toBe("#9ca3af");
    expect(clarityColor(90)).toBe("#16a34a");
    expect(clarityColor(89)).toBe("#f59e0b");
    expect(clarityColor(75)).toBe("#f59e0b");
    expect(clarityColor(74)).toBe("#dc2626");
  });
});

describe("tier labels", () => {
  it("never renders 'Premium' patient-side — rank 5 displays as Select", () => {
    expect(patientTierLabel(5)).toBe("Select");
    expect(patientTierLabel(3)).toBe("Advanced");
    expect(patientTierLabel(1)).toBe("Standard");
    expect(patientTierLabel(0)).toBeNull();
    expect(patientTierLabel(null)).toBeNull();
  });

  it("processing phrases mirror TierSelection's wording", () => {
    expect(tierProcessingPhrase(5)).toBe("top-of-the-line");
    expect(tierProcessingPhrase(3)).toBe("mid-line");
    expect(tierProcessingPhrase(1)).toBe("essential");
    expect(tierProcessingPhrase(7)).toBeNull();
  });
});

describe("styleGuidance", () => {
  const headlineAt = worst =>
    styleGuidance({ rightT: { 1000: worst }, leftT: { 1000: 25 } }).headline;

  it("returns null when nothing was tested", () => {
    expect(styleGuidance(null)).toBeNull();
    expect(styleGuidance({ rightT: {}, leftT: {} })).toBeNull();
  });

  it("normal range → no device, annual re-check", () => {
    const g = styleGuidance({ rightT: normalEar, leftT: normalEar });
    expect(g.headline).toMatch(/normal range/i);
    expect(g.notes[0]).toMatch(/No device is recommended today/);
  });

  it("bands on the worst entered threshold: 55/56, 70/71, 90/91 boundaries", () => {
    expect(headlineAt(55)).toMatch(/standard receiver/);
    expect(headlineAt(56)).toMatch(/power receiver/);
    expect(headlineAt(70)).toMatch(/power receiver/);
    expect(headlineAt(71)).toMatch(/high-power receiver, or behind-the-ear/);
    expect(headlineAt(90)).toMatch(/high-power receiver, or behind-the-ear/);
    expect(headlineAt(91)).toMatch(/Behind-the-ear \(BTE\) — the style with the most power/);
  });

  it("uses the worst threshold across BOTH ears", () => {
    const g = styleGuidance({ rightT: flatEar(30), leftT: { 4000: 95 } });
    expect(g.headline).toMatch(/Behind-the-ear/);
  });

  it("appends the open-fit note for sloping losses", () => {
    const g = styleGuidance({ rightT: slopingEar, leftT: slopingEar });
    expect(g.notes.some(n => /open fit/.test(n))).toBe(true);
  });

  it("appends the per-ear receiver note for asymmetric losses", () => {
    const g = styleGuidance({ rightT: flatEar(25), leftT: flatEar(65) });
    expect(g.notes.some(n => /different receiver strength/.test(n))).toBe(true);
  });

  it("no sloping/asymmetry notes on a flat symmetric loss", () => {
    const g = styleGuidance({ rightT: flatEar(45), leftT: flatEar(45) });
    expect(g.notes.some(n => /open fit|different receiver/.test(n))).toBe(false);
  });

  it("ignores empty-string and junk cells rather than treating them as 0 dB", () => {
    const g = styleGuidance({ rightT: { 500: "", 1000: 60, 2000: "n/a" }, leftT: {} });
    expect(g.headline).toMatch(/power receiver/);
  });
});
