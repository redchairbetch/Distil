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
import { messagePreview, patientDisplayName, channelLabel, PUSH_PREVIEW_MAX } from "./comms.js";

describe("messagePreview", () => {
  it("passes short bodies through untouched", () => {
    expect(messagePreview("See you Tuesday!")).toBe("See you Tuesday!");
  });

  it("collapses newlines and runs of whitespace", () => {
    expect(messagePreview("Line one.\n\nLine   two.")).toBe("Line one. Line two.");
  });

  it("truncates long bodies to the max with an ellipsis", () => {
    const long = "word ".repeat(60);
    const out = messagePreview(long);
    expect(out.length).toBeLessThanOrEqual(PUSH_PREVIEW_MAX);
    expect(out.endsWith("…")).toBe(true);
  });

  it("respects a custom max", () => {
    expect(messagePreview("abcdefghij", 5)).toBe("abcd…");
  });

  it("handles null/undefined/empty", () => {
    expect(messagePreview(null)).toBe("");
    expect(messagePreview(undefined)).toBe("");
    expect(messagePreview("   ")).toBe("");
  });
});

describe("patientDisplayName", () => {
  it("joins first and last name", () => {
    expect(patientDisplayName({ first_name: "Ruth", last_name: "Nielsen" })).toBe("Ruth Nielsen");
  });

  it("tolerates a missing last name (splitName stores '' for single-word names)", () => {
    expect(patientDisplayName({ first_name: "Ruth", last_name: "" })).toBe("Ruth");
  });

  it("falls back to 'Patient' when the embed is null (deleted/unlinked row)", () => {
    expect(patientDisplayName(null)).toBe("Patient");
    expect(patientDisplayName({})).toBe("Patient");
  });
});

describe("channelLabel", () => {
  it("labels the two channels, defaulting unknown/legacy rows to the app", () => {
    expect(channelLabel("aided")).toBe("Aided app");
    expect(channelLabel("email")).toBe("Email");
    expect(channelLabel(undefined)).toBe("Aided app");
  });
});
