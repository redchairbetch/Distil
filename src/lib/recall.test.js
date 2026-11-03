import { describe, it, expect } from "vitest";
import {
  classify, dueUnbookedVisit, missedBookedVisit, leadDaysFor, openedQuote,
  awaitingClearance, unansweredStreak, needsEscalation, scriptFor,
  legacyNeedsArc, remainingArcFor, tnsNeedsRetest, tnsRetestFor, bucketAppointment,
} from "./recall.js";

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const iso = (offset) => new Date(Date.now() + offset * 86400000).toISOString();
const appt = (offset, extra = {}) => ({ id: `a${offset}`, date: day(offset), type: "Quarterly Clean & Check", status: "scheduled", isBooked: false, ...extra });
const base = (extra = {}) => ({ id: "p1", name: "Ada Lovelace", patientStatus: "active", appointments: [], ...extra });

describe("recall windows", () => {
  it("gives annual-type visits a 30-day lead and routine visits 14", () => {
    expect(leadDaysFor("Annual Hearing Retest")).toBe(30);
    expect(leadDaysFor("Year 4 Upgrade Consultation")).toBe(30);
    expect(leadDaysFor("Quarterly Clean & Check")).toBe(14);
  });

  it("dueUnbookedVisit ignores booked rows and respects the lead window", () => {
    expect(dueUnbookedVisit([appt(10)])).toBeTruthy();
    expect(dueUnbookedVisit([appt(20)])).toBeNull();
    expect(dueUnbookedVisit([appt(20, { type: "Annual Exam" })])).toBeTruthy();
    expect(dueUnbookedVisit([appt(5, { isBooked: true })])).toBeNull();
    expect(dueUnbookedVisit([appt(-61)])).toBeNull();
    expect(dueUnbookedVisit([appt(-30)])).toBeTruthy();
    expect(dueUnbookedVisit([appt(3, { status: "completed" })])).toBeNull();
  });

  it("missedBookedVisit finds a booked, passed, open visit within 30 days", () => {
    expect(missedBookedVisit([appt(-3, { isBooked: true })])).toBeTruthy();
    expect(missedBookedVisit([appt(-3)])).toBeNull();
    expect(missedBookedVisit([appt(-40, { isBooked: true })])).toBeNull();
    expect(missedBookedVisit([appt(1, { isBooked: true })])).toBeNull();
  });
});

describe("classify", () => {
  it("excludes do-not-contact and lapsed patients entirely", () => {
    const due = { appointments: [appt(2)] };
    expect(classify(base(due)).primary).toBe("care_visit_due");
    expect(classify(base({ ...due, doNotContact: true })).primary).toBeNull();
    expect(classify(base({ ...due, patientStatus: "lapsed" })).primary).toBeNull();
  });

  it("ranks a missed booked visit above a due one", () => {
    const p = base({ appointments: [appt(2), appt(-2, { isBooked: true })] });
    expect(classify(p).matched).toEqual(["missed_visit", "care_visit_due"]);
  });

  it("honors the outcome cooldown", () => {
    const p = base({ appointments: [appt(2)], followUpStatus: "contacted", followUpContactedAt: iso(-1), followUpOutcome: "voicemail" });
    expect(classify(p).primary).toBeNull();
    expect(classify({ ...p, followUpContactedAt: iso(-4) }).primary).toBe("care_visit_due");
  });

  it("does not flag legacy fits as fit-no-return", () => {
    const devices = { fittingStatus: "fitted", fittingDate: day(-200) };
    expect(classify(base({ devices })).matched).toContain("fit_no_return");
    expect(classify(base({ devices: { ...devices, recordSource: "legacy_fastpath" } })).matched).not.toContain("fit_no_return");
  });
});

describe("quote and referral signals", () => {
  const share = (extra = {}) => ({ viewCount: 2, lastViewedAt: iso(-3), expiresAt: iso(20), revokedAt: null, ...extra });

  it("openedQuote: live, viewed, recent, non-buyer only", () => {
    expect(openedQuote(base({ patientStatus: "tns", quoteShares: [share()] }))).toBeTruthy();
    expect(openedQuote(base({ patientStatus: "active", quoteShares: [share()] }))).toBeNull();
    expect(openedQuote(base({ patientStatus: "tns", quoteShares: [share({ viewCount: 0 })] }))).toBeNull();
    expect(openedQuote(base({ patientStatus: "tns", quoteShares: [share({ revokedAt: iso(-1) })] }))).toBeNull();
    expect(openedQuote(base({ patientStatus: "tns", quoteShares: [share({ expiresAt: iso(-1) })] }))).toBeNull();
    expect(openedQuote(base({ patientStatus: "tns", quoteShares: [share({ lastViewedAt: iso(-45) })] }))).toBeNull();
  });

  it("awaitingClearance: 14–180 days out, not back since", () => {
    const p = base({ patientStatus: "prospect", medicalReferrals: [{ createdAt: iso(-20) }] });
    expect(awaitingClearance(p)).toBeTruthy();
    expect(awaitingClearance({ ...p, medicalReferrals: [{ createdAt: iso(-5) }] })).toBeNull();
    expect(awaitingClearance({ ...p, lastVisitDate: iso(-2) })).toBeNull();
    expect(awaitingClearance({ ...p, audiology: { testDate: day(-1) } })).toBeNull();
    expect(awaitingClearance({ ...p, patientStatus: "active" })).toBeNull();
  });
});

describe("escalation", () => {
  it("counts consecutive unanswered attempts until a real contact", () => {
    const rows = ["no_answer", "voicemail", "no_answer", "reached", "no_answer"].map(outcome => ({ outcome }));
    expect(unansweredStreak(rows)).toBe(3);
    expect(needsEscalation(rows)).toBe(true);
    expect(unansweredStreak([{ outcome: "sent" }, { outcome: "no_answer" }])).toBe(0);
  });
});

describe("scripts", () => {
  it("fills first name, clinic, visit and date", () => {
    const p = base({ appointments: [appt(5, { type: "Annual Exam" })] });
    const s = scriptFor("care_visit_due", p, "Distil Hearing");
    expect(s).toContain("Hi Ada");
    expect(s).toContain("Distil Hearing");
    expect(s).toContain("annual exam");
    expect(s).not.toMatch(/\{|\}/);
    expect(s).not.toMatch(/trial|demo/i);
  });

  it("bucketAppointment points 'Booked' at the bucket's visit", () => {
    const p = base({ appointments: [appt(5)] });
    expect(bucketAppointment("care_visit_due", p).id).toBe("a5");
    expect(bucketAppointment("warranty_expiring", p)).toBeNull();
  });
});

describe("coverage", () => {
  it("legacy fit with no open appointments gets only future arc visits", () => {
    const p = base({ devices: { recordSource: "legacy_fastpath", fittingStatus: "fitted", fittingDate: day(-400) } });
    expect(legacyNeedsArc(p)).toBe(true);
    const rest = remainingArcFor(p.devices.fittingDate);
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.every(v => v.date >= day(0))).toBe(true);
    expect(legacyNeedsArc({ ...p, appointments: [appt(30)] })).toBe(false);
    // Fit 5 years ago: the 4-year arc is over — nothing to enroll.
    expect(legacyNeedsArc({ ...p, devices: { ...p.devices, fittingDate: day(-5 * 366) } })).toBe(false);
  });

  it("TNS retest lands a year after the last test, or today if that passed", () => {
    const p = base({ patientStatus: "tns" });
    expect(tnsNeedsRetest(p)).toBe(true);
    expect(tnsNeedsRetest({ ...p, appointments: [appt(100)] })).toBe(false);
    expect(tnsNeedsRetest({ ...p, doNotContact: true })).toBe(false);
    const recent = tnsRetestFor({ ...p, audiology: { testDate: day(-30) } });
    expect(recent.date > day(300)).toBe(true);
    const old = tnsRetestFor({ ...p, audiology: { testDate: day(-500) } });
    expect(old.date).toBe(day(0));
  });
});
