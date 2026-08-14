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

// Appointment display/partition logic shared by the chart schedule, the
// follow-up queue's care-visit bucket, and the dashboard due-this-week card.
//
// appointment_date is timestamptz but every writer treats it as a DAY: the
// wizard inserts bare 'YYYY-MM-DD' (stored as UTC midnight) and the care arc
// inserts local-midnight timestamps. Parsing those with native `new Date()`
// renders UTC-midnight rows a day early in negative-offset timezones, so all
// day math here goes through the date part of the string — the same
// `split('T')[0]` convention db.js uses for its dedup keys.

import { daysUntil } from "./dates.js";

export const APPT_STATUSES = ["scheduled", "completed", "cancelled"];

export function apptDay(dateStr) {
  return String(dateStr || "").slice(0, 10);
}

export function apptDaysUntil(dateStr) {
  return daysUntil(apptDay(dateStr));
}

// Partition a patient's appointments for display and due-work logic.
// A row with no status counts as scheduled (pre-status-vocabulary rows).
export function partitionAppointments(appts = []) {
  const valid = appts.filter(a => a?.date);
  const scheduled = valid.filter(a => !a.status || a.status === "scheduled");
  const byDayAsc = (a, b) => apptDay(a.date).localeCompare(apptDay(b.date));
  const overdue = scheduled.filter(a => apptDaysUntil(a.date) < 0).sort(byDayAsc);
  const upcoming = scheduled.filter(a => apptDaysUntil(a.date) >= 0).sort(byDayAsc);
  const history = valid
    .filter(a => a.status === "completed" || a.status === "cancelled")
    .sort((a, b) => byDayAsc(b, a));
  return { overdue, next: upcoming[0] || null, upcoming, history };
}

// Scheduled visits due within the next `days` days (or overdue), for the
// dashboard due-this-week card and the follow-up queue bucket.
export function dueAppointments(appts = [], days = 7) {
  const { overdue, upcoming } = partitionAppointments(appts);
  return [...overdue, ...upcoming.filter(a => apptDaysUntil(a.date) <= days)];
}

// The single most actionable due visit for a patient, or null. Overdue rows
// older than maxOverdueDays are ignored: scheduled rows that predate
// completion tracking (or were simply never checked off) would otherwise
// flood the follow-up queue with months-stale arc visits — those get tidied
// on the chart, not chased as outreach.
export function dueCareVisit(appts = [], { days = 7, maxOverdueDays = 30 } = {}) {
  const due = dueAppointments(appts, days).filter(a => apptDaysUntil(a.date) >= -maxOverdueDays);
  return due[0] || null;
}
