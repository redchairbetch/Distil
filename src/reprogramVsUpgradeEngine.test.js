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
import { deltaSeverity, computeAudiometricDelta, decideReprogramVsUpgrade } from "./reprogramVsUpgradeEngine.js";

// Build an audiogram row in the loadBaselineAudiology shape: unaided AC
// thresholds per ear plus WRS columns.
function audiogramRow({ right = {}, left = {}, wrsRight = null, wrsLeft = null }) {
  const thresholds = [];
  for (const [freq, db] of Object.entries(right)) {
    thresholds.push({ ear: "right", test_type: "AC", frequency: +freq, threshold_db: db });
  }
  for (const [freq, db] of Object.entries(left)) {
    thresholds.push({ ear: "left", test_type: "AC", frequency: +freq, threshold_db: db });
  }
  return { audiogram_thresholds: thresholds, unaided_wrs_right: wrsRight, unaided_wrs_left: wrsLeft };
}

describe("deltaSeverity", () => {
  it("buckets per Kurt's spec: stable <5, moderate 5–10, significant 10+", () => {
    expect(deltaSeverity({ ptaShift: 0 })).toBe("stable");
    expect(deltaSeverity({ ptaShift: 4 })).toBe("stable");
    expect(deltaSeverity({ ptaShift: 5 })).toBe("moderate");
    expect(deltaSeverity({ ptaShift: 9 })).toBe("moderate");
    expect(deltaSeverity({ ptaShift: 10 })).toBe("significant");
    expect(deltaSeverity({ wrsDrop: 12 })).toBe("significant");
    expect(deltaSeverity({})).toBe("stable");
  });
  it("takes the worse of PTA shift and WRS drop", () => {
    expect(deltaSeverity({ ptaShift: 2, wrsDrop: 11 })).toBe("significant");
    expect(deltaSeverity({ ptaShift: 6, wrsDrop: 0 })).toBe("moderate");
  });
});

describe("computeAudiometricDelta", () => {
  const flat = { 500: 30, 1000: 30, 2000: 30, 4000: 30 };
  const worse = { 500: 45, 1000: 45, 2000: 45, 4000: 45 };

  it("anchors to the poorer ear", () => {
    const baseline = audiogramRow({ right: flat, left: flat, wrsRight: 88, wrsLeft: 88 });
    const current = audiogramRow({ right: flat, left: worse, wrsRight: 88, wrsLeft: 72 });
    const delta = computeAudiometricDelta(baseline, current);
    expect(delta.anchorEar).toBe("left");
    expect(delta.ptaShift).toBe(15);
    expect(delta.wrsDrop).toBe(16);
  });

  it("returns null when either audiogram is missing", () => {
    expect(computeAudiometricDelta(null, audiogramRow({}))).toBeNull();
    expect(computeAudiometricDelta(audiogramRow({}), null)).toBeNull();
  });
});

describe("decideReprogramVsUpgrade (Kurt-confirmed matrix)", () => {
  it("significant decline → upgrade regardless of aid performance", () => {
    const { decision } = decideReprogramVsUpgrade({ ptaShift: 12 }, "Excellent", 2);
    expect(decision).toBe("upgrade");
  });

  it("moderate decline + poorly performing aids → upgrade", () => {
    const { decision } = decideReprogramVsUpgrade({ ptaShift: 6 }, "Failing", 3);
    expect(decision).toBe("upgrade");
  });

  it("moderate decline + good aids → provider judgment, readiness breaks the tie", () => {
    const high = decideReprogramVsUpgrade({ ptaShift: 6 }, "Excellent", 5);
    expect(high.decision).toBe("provider_judgment");
    expect(high.lean).toBe("upgrade");
    const low = decideReprogramVsUpgrade({ ptaShift: 6 }, "Excellent", 2);
    expect(low.lean).toBe("reprogram");
  });

  it("stable hearing + good aids → reprogram", () => {
    const { decision, lean } = decideReprogramVsUpgrade({ ptaShift: 1 }, "Adequate", 4);
    expect(decision).toBe("reprogram");
    expect(lean).toBeNull();
  });

  it("stable hearing + struggling aids → provider judgment", () => {
    const { decision } = decideReprogramVsUpgrade({ ptaShift: 1 }, "Marginal", 3);
    expect(decision).toBe("provider_judgment");
  });

  it("no delta at all → provider judgment", () => {
    const { decision, severity } = decideReprogramVsUpgrade(null, null, null);
    expect(decision).toBe("provider_judgment");
    expect(severity).toBe("unknown");
  });
});
