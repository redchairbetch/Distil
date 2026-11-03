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

// Serialized device inventory rules (backlog #44). Pure: the state machine,
// RFC deadline math, and the alert thresholds the Inventory view and its
// sidebar badge share. db.js transitionDeviceUnit() refuses any move this
// file doesn't allow, so a unit's history can't skip states.

import { daysUntil } from "./dates.js";
import { normalizeMfr } from "./manufacturerKeys.js";

export const UNIT_STATUSES = [
  { id: "on_order",            label: "On order",            color: "#1d4ed8", bg: "#dbeafe" },
  { id: "reserved",            label: "Received · reserved", color: "#7c3aed", bg: "#ede9fe" },
  { id: "in_stock",            label: "In stock",            color: "#0f766e", bg: "#ccfbf1" },
  { id: "fitted",              label: "Fitted",              color: "#166534", bg: "#dcfce7" },
  { id: "in_repair",           label: "In repair",           color: "#b45309", bg: "#fef3c7" },
  { id: "loaned_out",          label: "Loaned out",          color: "#9333ea", bg: "#f3e8ff" },
  { id: "rfc_pending",         label: "Return for credit",   color: "#be123c", bg: "#ffe4e6" },
  { id: "returned_for_credit", label: "Credited",            color: "#6b7280", bg: "#f3f4f6" },
  { id: "lost_damaged",        label: "Lost / damaged",      color: "#991b1b", bg: "#fee2e2" },
  { id: "retired",             label: "Retired",             color: "#6b7280", bg: "#f3f4f6" },
];
export const STATUS_BY_ID = Object.fromEntries(UNIT_STATUSES.map(s => [s.id, s]));
export const TERMINAL = new Set(["returned_for_credit", "lost_damaged", "retired"]);

export const PURPOSES = [
  { id: "patient_order", label: "Patient order" },
  { id: "stock",         label: "Shelf stock" },
  { id: "loaner",        label: "Loaner" },
  { id: "demo",          label: "Demo" },
];

export const ALLOWED_TRANSITIONS = {
  on_order:    ["reserved", "in_stock", "retired"],
  reserved:    ["fitted", "in_stock", "rfc_pending"],
  in_stock:    ["reserved", "fitted", "loaned_out", "rfc_pending", "retired"],
  fitted:      ["in_repair", "lost_damaged", "rfc_pending", "in_stock", "retired"],
  in_repair:   ["fitted", "in_stock", "retired"],
  loaned_out:  ["in_stock", "lost_damaged"],
  rfc_pending: ["returned_for_credit", "in_stock"],
  returned_for_credit: [],
  lost_damaged: [],
  retired: [],
};

export function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

// Event vocabulary written to device_unit_events.event_type.
export const EVENT_LABELS = {
  created:          "Added to inventory",
  ordered:          "Ordered",
  received:         "Received",
  reserved:         "Reserved for patient",
  unreserved:       "Released to stock",
  fitted:           "Fit to patient",
  repair_sent:      "Sent for repair",
  repair_returned:  "Back from repair",
  loaned:           "Loaned out",
  loaner_returned:  "Loaner returned",
  rfc_started:      "Return for credit started",
  rfc_cancelled:    "Return for credit cancelled",
  credited:         "Credit received",
  ld_claim:         "Loss & damage claim",
  replaced:         "Replaced by manufacturer",
  order_cancelled:  "Order cancelled",
  retired:          "Retired",
  serial_updated:   "Serial updated",
  form_generated:   "Manufacturer form generated",
  note:             "Note",
};

// ── RFC window ───────────────────────────────────────────────────────────────
// Kurt's terms (2026-11-03): 60 days from receipt. Per-manufacturer override:
// clinics.manufacturer_accounts[<mfrKey>].rfc_days.
export const RFC_DAYS_DEFAULT = 60;

export function rfcDaysFor(manufacturer, manufacturerAccounts = {}) {
  const key = normalizeMfr(manufacturer);
  const n = Number(manufacturerAccounts?.[key]?.rfc_days);
  return Number.isFinite(n) && n > 0 ? n : RFC_DAYS_DEFAULT;
}

export function rfcDeadline(receivedYmd, manufacturer, manufacturerAccounts) {
  if (!receivedYmd) return null;
  const [y, m, d] = String(receivedYmd).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d + rfcDaysFor(manufacturer, manufacturerAccounts));
  const pad = n => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// ── Alerts ───────────────────────────────────────────────────────────────────
export const ALERT_THRESHOLDS = {
  orderOverdueDays: 10,  // ordered, not received
  rfcWarnDays: 14,       // RFC window closing on a unit that could still go back
  repairOverdueDays: 21, // out for repair
  loanerOverdueDays: 30, // loaner still out
};

function daysSince(ymd) {
  if (!ymd) return null;
  const d = daysUntil(String(ymd).slice(0, 10));
  return Number.isNaN(d) ? null : -d;
}

// Units whose RFC window still matters: received but not yet settled with a
// patient long-term. Fitted units count — a patient can still return aids in
// the adaptation period, and that only nets a credit inside the window.
const RFC_RELEVANT = new Set(["reserved", "in_stock", "fitted", "rfc_pending"]);

// `lastEventAt` (optional) maps unitId → ISO of the most recent status event,
// used for "how long has it been in repair / on loan".
export function inventoryAlerts(units = [], lastEventAt = {}) {
  const out = [];
  for (const u of units) {
    if (u.status === "on_order") {
      const age = daysSince(u.ordered_at || String(u.created_at || "").slice(0, 10));
      if (age != null && age > ALERT_THRESHOLDS.orderOverdueDays)
        out.push({ unit: u, kind: "order_overdue", days: age, label: `On order ${age} days — chase the manufacturer` });
    }
    if (RFC_RELEVANT.has(u.status) && u.rfc_deadline) {
      const left = daysUntil(String(u.rfc_deadline).slice(0, 10));
      if (!Number.isNaN(left) && left >= 0 && left <= ALERT_THRESHOLDS.rfcWarnDays)
        out.push({ unit: u, kind: "rfc_closing", days: left, label: `Return-for-credit window closes in ${left} day${left === 1 ? "" : "s"}` });
    }
    if (u.status === "in_repair" || u.status === "loaned_out") {
      const since = daysSince(String(lastEventAt[u.id] || u.updated_at || "").slice(0, 10));
      const limit = u.status === "in_repair" ? ALERT_THRESHOLDS.repairOverdueDays : ALERT_THRESHOLDS.loanerOverdueDays;
      if (since != null && since > limit)
        out.push({ unit: u, kind: u.status === "in_repair" ? "repair_overdue" : "loaner_overdue", days: since,
          label: u.status === "in_repair" ? `In repair ${since} days` : `Loaner out ${since} days` });
    }
  }
  return out;
}

// One-line identity for a unit: "Phonak Lumity 90 RIC · L · SN 1234".
export function unitLabel(u) {
  const model = [u.manufacturer, u.family || u.model, u.tech_level].filter(Boolean).join(" ");
  const ear = u.ear === "left" ? "L" : u.ear === "right" ? "R" : null;
  return [model || "Unit", u.style, ear, u.serial_number ? `SN ${u.serial_number}` : "no serial"].filter(Boolean).join(" · ");
}

// Does an in-stock unit match what a patient's fitting calls for?
export function unitMatchesSide(u, side) {
  if (!side) return false;
  const eq = (a, b) => !a || !b || String(a).toLowerCase() === String(b).toLowerCase();
  const mk = n => normalizeMfr(n) || String(n || "").trim().toLowerCase();
  return !!mk(u.manufacturer) && mk(u.manufacturer) === mk(side.manufacturer)
    && eq(u.family, side.family) && eq(u.tech_level, side.techLevel)
    && (!u.ear || !side.ear || u.ear === side.ear);
}
