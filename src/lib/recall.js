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

// Recall & follow-up rules (backlog #43). Pure — no Supabase, no React — so
// the Follow-up Queue view, its sidebar badge, and Reports all classify a
// patient with exactly the same logic, and every rule is unit-testable.
//
// Vocabulary:
//   DUE     — an appointments row the clinic generated (care arc, annual
//             retest) with is_booked = false: "we want them back around here".
//   BOOKED  — is_booked = true: the patient agreed to the date. Booked rows
//             get the day-before push; they need no outreach unless missed.
//
// Coverage (who has a recall schedule at all) is handled by the selectors at
// the bottom: legacy fits get the remaining care arc, TNS patients get an
// annual retest — both materialized as DUE appointments, so the one
// "visit due" bucket covers every recall type.

import { parseDateOnly, daysUntil as libDaysUntil } from "./dates.js";
import { apptDay, apptDaysUntil } from "./appointments.js";
import { buildCareArc } from "./careArc.js";

// ── Cooldowns ────────────────────────────────────────────────────────────────
// After a logged attempt the patient leaves the queue for a stretch matching
// the outcome. Default covers legacy rows contacted before outcomes existed.
export const CONTACTED_COOLDOWN_DAYS = 14;
export const OUTCOME_COOLDOWN_DAYS = {
  reached:   14,
  voicemail: 3,
  no_answer: 3,
  scheduled: 30, // a booked visit resurfaces only if missed
  declined:  90,
  sent:      7,  // letter / message sent — give it a week to land
};

// ── Recall windows ───────────────────────────────────────────────────────────
// Annual-type visits are booked further ahead than routine clean & checks.
export const LONG_LEAD_DAYS = 30;
export const SHORT_LEAD_DAYS = 14;
export const MAX_DUE_OVERDUE_DAYS = 60;   // older unbooked rows = chart cleanup
export const MAX_MISSED_DAYS = 30;        // booked + passed + not completed
export const QUOTE_OPEN_WINDOW_DAYS = 30;
export const REFERRAL_MIN_DAYS = 14;      // give the ENT visit time to happen
export const REFERRAL_MAX_DAYS = 180;
export const ESCALATE_AFTER = 3;          // unanswered attempts before letter/lapse

const LONG_LEAD_RE = /annual|retest|upgrade|exam/i;
export function leadDaysFor(type) {
  return LONG_LEAD_RE.test(type || "") ? LONG_LEAD_DAYS : SHORT_LEAD_DAYS;
}

const isOpen = a => a?.date && (!a.status || a.status === "scheduled");

// The earliest unbooked visit inside its booking window (or ≤60d overdue).
export function dueUnbookedVisit(appts = []) {
  const rows = appts
    .filter(a => isOpen(a) && !a.isBooked)
    .filter(a => {
      const d = apptDaysUntil(a.date);
      return d <= leadDaysFor(a.type) && d >= -MAX_DUE_OVERDUE_DAYS;
    })
    .sort((a, b) => apptDay(a.date).localeCompare(apptDay(b.date)));
  return rows[0] || null;
}

// A booked visit whose day passed without being completed or cancelled.
export function missedBookedVisit(appts = []) {
  const rows = appts
    .filter(a => isOpen(a) && a.isBooked)
    .filter(a => {
      const d = apptDaysUntil(a.date);
      return d < 0 && d >= -MAX_MISSED_DAYS;
    })
    .sort((a, b) => apptDay(b.date).localeCompare(apptDay(a.date)));
  return rows[0] || null;
}

function daysFromNow(iso) {
  if (!iso) return null;
  const d = libDaysUntil(String(iso).slice(0, 10));
  return Number.isNaN(d) ? null : d;
}
function daysSince(iso) {
  const d = daysFromNow(iso);
  return d == null ? null : -d;
}
export function fmtShort(iso) {
  if (!iso) return "—";
  const d = parseDateOnly(String(iso).slice(0, 10)) || new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// A live, opened quote link for a not-yet-buying patient, viewed recently.
export function openedQuote(p) {
  if (!["tns", "prospect"].includes(p.patientStatus)) return null;
  const live = (p.quoteShares || []).filter(q =>
    q.viewCount > 0 && !q.revokedAt &&
    (!q.expiresAt || new Date(q.expiresAt) > new Date()) &&
    q.lastViewedAt && (daysSince(q.lastViewedAt) ?? Infinity) <= QUOTE_OPEN_WINDOW_DAYS);
  if (!live.length) return null;
  return live.sort((a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt))[0];
}

// A prospect referred out for medical clearance who hasn't been back since.
export function awaitingClearance(p) {
  if (p.patientStatus !== "prospect") return null;
  const refs = (p.medicalReferrals || []).filter(r => r.createdAt);
  if (!refs.length) return null;
  const latest = refs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const age = daysSince(latest.createdAt);
  if (age == null || age < REFERRAL_MIN_DAYS || age > REFERRAL_MAX_DAYS) return null;
  const refDay = String(latest.createdAt).slice(0, 10);
  const back = [p.lastVisitDate, p.audiology?.testDate]
    .some(d => d && String(d).slice(0, 10) > refDay);
  return back ? null : latest;
}

// ── Buckets ──────────────────────────────────────────────────────────────────
// Priority order = display order. `script` is the call-list opener: short,
// plain, and in the clinic's voice (no banned terms: never "trial"/"demo").
export const BUCKETS = [
  {
    key: "missed_visit",
    label: "Missed booked visit",
    color: "#be123c", bg: "#ffe4e6", icon: "⚠",
    blurb: "Booked, the day passed, and the visit was never completed. Reschedule.",
    script: "Hi {first}, this is {clinic}. We missed you at your {visit} on {date} — I'd love to get you rescheduled. What day works best this week or next?",
  },
  {
    key: "quote_opened",
    label: "Quote opened · no decision",
    color: "#9333ea", bg: "#f3e8ff", icon: "👀",
    blurb: "They've been looking at their take-home quote in the last 30 days. Warm lead — answer questions while it's on their mind.",
    script: "Hi {first}, this is {clinic}. I wanted to check in after your hearing evaluation — do you have any questions about the options we went over? I'm happy to walk through anything.",
  },
  {
    key: "care_visit_due",
    label: "Visit due · not booked",
    color: "#0f766e", bg: "#ccfbf1", icon: "📅",
    blurb: "A care or recall visit is coming due (30 days ahead for annual exams and retests, 14 for routine visits) and isn't booked yet. Call to book — then hit Book on the chart, or log \"Visit scheduled\" here with the date.",
    script: "Hi {first}, this is {clinic}. You're due for your {visit} around {date}. Can we get that on the calendar? It keeps your hearing — and your devices — performing at their best.",
  },
  {
    key: "referred_out",
    label: "Awaiting medical clearance",
    color: "#e11d48", bg: "#ffe4e6", icon: "🩺",
    blurb: "Referred out for medical evaluation 2+ weeks ago and hasn't been back. Check on the appointment and invite them back once cleared.",
    script: "Hi {first}, this is {clinic}. I'm following up on the medical referral we gave you — were you able to see {referredTo}? Once you're cleared, we'd love to get you back in to continue.",
  },
  {
    key: "warranty_expiring",
    label: "Warranty expiring (< 90 days)",
    color: "#dc2626", bg: "#fee2e2", icon: "⏱",
    blurb: "Devices coming off warranty soon. Get them in for a check before coverage lapses.",
    script: "Hi {first}, this is {clinic}. Your hearing aid warranty ends on {date}. Let's get you in for a full check before then so anything that needs attention is covered.",
  },
  {
    key: "off_warranty_no_upgrade",
    label: "Off warranty · no upgrade conversation",
    color: "#b45309", bg: "#fef3c7", icon: "💬",
    blurb: "Warranty has lapsed and no upgrade outcome is on record. Time for the year-4+ conversation.",
    script: "Hi {first}, this is {clinic}. Your devices are past their warranty, and technology has come a long way. I'd like to invite you in for a hearing check and a look at what's new — no obligation.",
  },
  {
    key: "fit_no_return",
    label: "Fit but never returned",
    color: "#7c3aed", bg: "#ede9fe", icon: "↩",
    blurb: "Fit more than 30 days ago and never logged a follow-up visit. Check in.",
    script: "Hi {first}, this is {clinic}. It's been about a month since your fitting — how are the new hearing aids treating you? Let's get your follow-up on the books so we can fine-tune them.",
  },
  {
    key: "stale_visit",
    label: "No visit in 12+ months",
    color: "#1d4ed8", bg: "#dbeafe", icon: "📭",
    blurb: "Active patients we haven't seen in over a year.",
    script: "Hi {first}, this is {clinic}. It's been over a year since we've seen you — let's get your annual hearing check and a device clean & check scheduled.",
  },
];
const ORDER = BUCKETS.map(b => b.key);

// Returns { matched: bucketKey[], primary } for one patient. Silenced
// (cooldown), do-not-contact, and lapsed/churned patients return no match.
export function classify(p) {
  const none = { matched: [], primary: null };
  if (!p || p.doNotContact) return none;
  if (p.patientStatus === "lapsed" || p.patientStatus === "churned") return none;
  if (p.followUpStatus === "contacted" && p.followUpContactedAt) {
    const since = daysSince(p.followUpContactedAt);
    const cooldown = OUTCOME_COOLDOWN_DAYS[p.followUpOutcome] ?? CONTACTED_COOLDOWN_DAYS;
    if (since != null && since < cooldown) return none;
  }

  const matched = [];
  const warrantyExpiry = p.devices?.warrantyExpiry || null;
  // Only a CONFIRMED fitting's date counts as "fit": pending sales carry an
  // estimated date and cancelled sales were never fit.
  const fitted = (p.devices?.fittingStatus ?? "fitted") === "fitted";
  const fittingDate = fitted ? (p.devices?.fittingDate || null) : null;
  const isLegacy = p.devices?.recordSource === "legacy_fastpath";

  if (missedBookedVisit(p.appointments)) matched.push("missed_visit");
  if (openedQuote(p)) matched.push("quote_opened");
  if (dueUnbookedVisit(p.appointments)) matched.push("care_visit_due");
  if (awaitingClearance(p)) matched.push("referred_out");

  if (warrantyExpiry) {
    const dn = daysFromNow(warrantyExpiry);
    if (dn != null && dn >= 0 && dn <= 90) matched.push("warranty_expiring");
    if (dn != null && dn < 0 && !p.upgradeOutcome) matched.push("off_warranty_no_upgrade");
  }

  // Legacy (pre-Distil) fits never had a first follow-up to miss — their
  // null lastVisitDate means "no history", not "never came back".
  if (fittingDate && !isLegacy && !p.lastVisitDate) {
    const ds = daysSince(fittingDate);
    if (ds != null && ds > 30) matched.push("fit_no_return");
  }

  if (p.patientStatus === "active" && p.lastVisitDate) {
    const ds = daysSince(p.lastVisitDate);
    if (ds != null && ds > 365 && matched.length === 0) matched.push("stale_visit");
  }

  matched.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return { matched, primary: matched[0] || null };
}

export function countFollowUpPatients(patients) {
  let n = 0;
  for (const p of patients || []) if (classify(p).primary) n++;
  return n;
}

// The appointment a bucket is about (for "Visit scheduled" → book it).
export function bucketAppointment(key, p) {
  if (key === "missed_visit") return missedBookedVisit(p.appointments);
  if (key === "care_visit_due") return dueUnbookedVisit(p.appointments);
  return null;
}

// Within a bucket: most urgent first.
export function sortKeyFor(key, p) {
  switch (key) {
    case "missed_visit":
    case "care_visit_due": {
      const a = bucketAppointment(key, p);
      return a ? apptDaysUntil(a.date) : 0;
    }
    case "quote_opened":            return -new Date(openedQuote(p)?.lastViewedAt || 0).getTime();
    case "referred_out":            return new Date(awaitingClearance(p)?.createdAt || 0).getTime();
    case "warranty_expiring":
    case "off_warranty_no_upgrade": return new Date(p.devices?.warrantyExpiry || 0).getTime();
    case "fit_no_return":           return new Date(p.devices?.fittingDate || 0).getTime();
    case "stale_visit":             return new Date(p.lastVisitDate || 0).getTime();
    default:                        return 0;
  }
}

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function bucketDetail(key, p) {
  switch (key) {
    case "missed_visit": {
      const a = missedBookedVisit(p.appointments);
      return a ? `${a.type || "Visit"} · booked ${fmtShort(apptDay(a.date))} (${plural(-apptDaysUntil(a.date), "day")} ago)` : "";
    }
    case "care_visit_due": {
      const a = dueUnbookedVisit(p.appointments);
      if (!a) return "";
      const dn = apptDaysUntil(a.date);
      const when = dn < 0 ? `was due ${fmtShort(apptDay(a.date))} (${-dn}d overdue)`
        : dn === 0 ? "due today"
        : `due ${fmtShort(apptDay(a.date))} (in ${dn}d)`;
      return `${a.type || "Care visit"} · ${when}`;
    }
    case "quote_opened": {
      const q = openedQuote(p);
      return q ? `Quote opened ${plural(q.viewCount, "time")} · last viewed ${fmtShort(q.lastViewedAt)}` : "";
    }
    case "referred_out": {
      const r = awaitingClearance(p);
      return r ? `Referred${r.referredTo ? ` to ${r.referredTo}` : ""} ${fmtShort(r.createdAt)} (${plural(daysSince(r.createdAt), "day")} ago) · not back yet` : "";
    }
    case "warranty_expiring": {
      const dn = daysFromNow(p.devices?.warrantyExpiry);
      return `Warranty expires ${fmtShort(p.devices?.warrantyExpiry)} (${plural(dn, "day")})`;
    }
    case "off_warranty_no_upgrade": {
      const ds = daysSince(p.devices?.warrantyExpiry);
      return `Warranty lapsed ${plural(ds, "day")} ago · no upgrade outcome logged`;
    }
    case "fit_no_return": {
      const ds = daysSince(p.devices?.fittingDate);
      return `Fit ${fmtShort(p.devices?.fittingDate)} (${plural(ds, "day")} ago) · 0 visits logged`;
    }
    case "stale_visit": {
      const ds = daysSince(p.lastVisitDate);
      return `Last visit ${fmtShort(p.lastVisitDate)} (${plural(ds, "day")} ago)`;
    }
    default:
      return "";
  }
}

// Fill a bucket's script for one patient.
export function scriptFor(key, p, clinicName = "the clinic") {
  const b = BUCKETS.find(x => x.key === key);
  if (!b?.script) return "";
  const appt = bucketAppointment(key, p);
  const first = (p.name || "").trim().split(/\s+/)[0] || "there";
  const date = key === "warranty_expiring" ? fmtShort(p.devices?.warrantyExpiry)
    : appt ? fmtShort(apptDay(appt.date)) : "";
  const ref = key === "referred_out" ? awaitingClearance(p) : null;
  return b.script
    .replaceAll("{first}", first)
    .replaceAll("{clinic}", clinicName)
    .replaceAll("{visit}", (appt?.type || "visit").toLowerCase())
    .replaceAll("{date}", date)
    .replaceAll("{referredTo}", ref?.referredTo || "the specialist");
}

// ── Escalation ───────────────────────────────────────────────────────────────
// Consecutive unanswered attempts (newest first) since the last real contact.
// `contacts` = patient_contacts rows for ONE patient, newest first.
const UNANSWERED = new Set(["voicemail", "no_answer"]);
export function unansweredStreak(contacts = []) {
  let n = 0;
  for (const c of contacts) {
    if (UNANSWERED.has(c.outcome)) n++;
    else break;
  }
  return n;
}
export const needsEscalation = contacts => unansweredStreak(contacts) >= ESCALATE_AFTER;

// ── Coverage selectors ───────────────────────────────────────────────────────
const hasOpenAppointment = p => (p.appointments || []).some(isOpen);
const toYmd = d => {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Remaining (today-or-later) care-arc visits for a legacy fit.
export function remainingArcFor(fittingDate, today = new Date()) {
  if (!fittingDate) return [];
  const todayYmd = toYmd(today);
  return buildCareArc(fittingDate).filter(v => v.date >= todayYmd);
}

// Pre-Distil fit with no open appointments and arc visits still ahead.
export function legacyNeedsArc(p, today = new Date()) {
  if (p.archivedAt || p.devices?.recordSource !== "legacy_fastpath") return false;
  if ((p.devices?.fittingStatus ?? "fitted") !== "fitted") return false;
  if (hasOpenAppointment(p)) return false;
  return remainingArcFor(p.devices?.fittingDate, today).length > 0;
}

export const TNS_RETEST_TYPE = "Annual Hearing Retest";
export const TNS_RETEST_NOTE =
  "Tested, not yet treated — annual retest to track change and revisit treatment options.";

// TNS patient with nothing on the books.
export function tnsNeedsRetest(p) {
  return !p.archivedAt && p.patientStatus === "tns" && !hasOpenAppointment(p) && !p.doNotContact;
}

// Retest one year after the last test; if that's already past, due today
// (so it lands straight in the "visit due" bucket).
export function tnsRetestFor(p, today = new Date()) {
  const base = p.audiology?.testDate || p.createdAt;
  const from = parseDateOnly(String(base || "").slice(0, 10)) || today;
  const d = new Date(from.getFullYear() + 1, from.getMonth(), from.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return { type: TNS_RETEST_TYPE, date: toYmd(d < t ? t : d), note: TNS_RETEST_NOTE };
}
