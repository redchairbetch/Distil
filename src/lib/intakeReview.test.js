import { describe, it, expect } from "vitest";
import {
  FDA_SAFETY_CHECKS,
  HEARING_SITUATIONS,
  fdaSafetyState,
  hearingSituationState,
  perceptionGapCopy,
  mapComplaintsToFindings,
} from "./intakeReview.js";

const allNo = (items) => Object.fromEntries(items.map(i => [i.key, false]));
const allYes = (items) => Object.fromEntries(items.map(i => [i.key, true]));

describe("fdaSafetyState", () => {
  it("is all-clear only when every item is an explicit No", () => {
    const s = fdaSafetyState(allNo(FDA_SAFETY_CHECKS));
    expect(s.allClear).toBe(true);
    expect(s.clear).toHaveLength(6);
    expect(s.flagged).toHaveLength(0);
    expect(s.unanswered).toHaveLength(0);
  });

  it("never treats unanswered as clear", () => {
    const answers = allNo(FDA_SAFETY_CHECKS);
    delete answers.med_ring;
    const s = fdaSafetyState(answers);
    expect(s.allClear).toBe(false);
    expect(s.unanswered.map(i => i.key)).toEqual(["med_ring"]);
  });

  it("collects flagged items", () => {
    const answers = { ...allNo(FDA_SAFETY_CHECKS), med_sudden: true, med_dizzy: true };
    const s = fdaSafetyState(answers);
    expect(s.flagged.map(i => i.key).sort()).toEqual(["med_dizzy", "med_sudden"]);
    expect(s.allClear).toBe(false);
  });

  it("handles a missing answers object", () => {
    const s = fdaSafetyState(undefined);
    expect(s.unanswered).toHaveLength(6);
    expect(s.allClear).toBe(false);
  });
});

describe("hearingSituationState", () => {
  it("splits endorsed / denied / unanswered", () => {
    const s = hearingSituationState({ hear_mumble: true, hear_tv: false });
    expect(s.endorsed.map(i => i.key)).toEqual(["hear_mumble"]);
    expect(s.denied.map(i => i.key)).toEqual(["hear_tv"]);
    expect(s.unanswered).toHaveLength(HEARING_SITUATIONS.length - 2);
    expect(s.total).toBe(HEARING_SITUATIONS.length);
  });
});

describe("perceptionGapCopy", () => {
  it("returns null without a rating", () => {
    expect(perceptionGapCopy({})).toBeNull();
  });

  it("names the gap when a high self-rating meets several endorsements", () => {
    const answers = { hear_rating: 8, hear_mumble: true, hear_noisy: true, hear_tv: true };
    const copy = perceptionGapCopy(answers);
    expect(copy).toContain("8 out of 10");
    expect(copy).toContain("3 of 9");
  });

  it("validates a low self-rating instead of contrasting it", () => {
    const copy = perceptionGapCopy({ hear_rating: 3, hear_mumble: true });
    expect(copy).toContain("3 out of 10");
    expect(copy).not.toContain("of 9");
  });
});

describe("mapComplaintsToFindings", () => {
  const lossMetrics = { overallSeverity: "Moderate", worseCCT: 72, highFreqCount: 4, hasThresholds: true };

  it("returns nothing when no situations are endorsed", () => {
    expect(mapComplaintsToFindings({}, lossMetrics)).toEqual([]);
    expect(mapComplaintsToFindings(allNo(HEARING_SITUATIONS), lossMetrics)).toEqual([]);
  });

  it("maps only endorsed situations, preserving battery order", () => {
    const rows = mapComplaintsToFindings({ hear_noisy: true, hear_mumble: true }, lossMetrics);
    expect(rows.map(r => r.key)).toEqual(["hear_mumble", "hear_noisy"]);
  });

  it("ties clarity complaints to high-frequency audibility when present", () => {
    const [row] = mapComplaintsToFindings({ hear_mumble: true }, lossMetrics);
    expect(row.supported).toBe(true);
    expect(row.explanation).toMatch(/consonants/i);
  });

  it("ties noise complaints to the measured word-recognition score", () => {
    const [row] = mapComplaintsToFindings({ hear_noisy: true }, lossMetrics);
    expect(row.supported).toBe(true);
    expect(row.explanation).toContain("72%");
  });

  it("is honest when the test does not explain the complaint", () => {
    const normal = { overallSeverity: "Normal", worseCCT: 96, highFreqCount: 0, hasThresholds: true };
    const rows = mapComplaintsToFindings(allYes(HEARING_SITUATIONS), normal);
    expect(rows.every(r => r.supported === false)).toBe(true);
    expect(rows[0].explanation).toMatch(/don't fully explain/);
  });

  it("falls back to severity framing when speech scores are absent", () => {
    const noSpeech = { overallSeverity: "Mild", worseCCT: null, highFreqCount: 0, hasThresholds: true };
    const [row] = mapComplaintsToFindings({ hear_noisy: true }, noSpeech);
    expect(row.supported).toBe(true);
    expect(row.explanation).toMatch(/mild/);
  });

  it("explains effort complaints through listening effort, not volume", () => {
    const [row] = mapComplaintsToFindings({ hear_fatigue: true }, lossMetrics);
    expect(row.supported).toBe(true);
    expect(row.explanation).toMatch(/brain works overtime/);
  });
});
