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
import { FDA_SAFETY_CHECKS } from "./intakeReview.js";
import { buildSafetySnapshot, validateReferral } from "./medicalReferral.js";

describe("buildSafetySnapshot", () => {
  it("returns one row per FDA battery item, in battery order", () => {
    const snap = buildSafetySnapshot({}, {});
    expect(snap.map(r => r.key)).toEqual(FDA_SAFETY_CHECKS.map(c => c.key));
    expect(snap.map(r => r.label)).toEqual(FDA_SAFETY_CHECKS.map(c => c.label));
  });

  it("maps tri-state answers — unanswered never collapses to no", () => {
    const snap = buildSafetySnapshot({ med_pain: true, med_drain: false }, {});
    const byKey = Object.fromEntries(snap.map(r => [r.key, r.answer]));
    expect(byKey.med_pain).toBe("yes");
    expect(byKey.med_drain).toBe("no");
    expect(byKey.med_sudden).toBe("unanswered");
    expect(byKey.med_ring).toBe("unanswered");
  });

  it("attaches the provider note for its own question only", () => {
    const snap = buildSafetySnapshot(
      { med_dizzy: true },
      { med_dizzy: "Spinning episodes, unevaluated — refer.", med_pain: "  " }
    );
    const byKey = Object.fromEntries(snap.map(r => [r.key, r.note]));
    expect(byKey.med_dizzy).toBe("Spinning episodes, unevaluated — refer.");
    // Whitespace-only notes normalize to null so the PDF skips the line.
    expect(byKey.med_pain).toBeNull();
    expect(byKey.med_sudden).toBeNull();
  });

  it("tolerates missing inputs entirely", () => {
    const snap = buildSafetySnapshot(undefined, undefined);
    expect(snap).toHaveLength(FDA_SAFETY_CHECKS.length);
    expect(snap.every(r => r.answer === "unanswered" && r.note === null)).toBe(true);
  });
});

describe("validateReferral", () => {
  it("requires at least one reason", () => {
    expect(validateReferral({ reasons: [], notes: "" })).toMatch(/at least one reason/i);
    expect(validateReferral({ reasons: ["ear_pain_discomfort"], notes: "" })).toBeNull();
  });

  it("requires a note only for the free-text catch-all", () => {
    expect(validateReferral({ reasons: ["other_medical_concern"], notes: " " })).toMatch(/notes/i);
    expect(validateReferral({ reasons: ["other_medical_concern"], notes: "Growth in canal" })).toBeNull();
  });
});
