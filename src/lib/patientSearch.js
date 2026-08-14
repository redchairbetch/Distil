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

// Shared roster search + sort. Before this, the three patient searches each
// matched a different field set (local: name+manufacturer, global: name+phone,
// archive: all three) — a phone-number search on "This Clinic" silently found
// nothing. Every client-side patient search now runs through this matcher;
// the server-side global search matches name+phone in SQL.

import { parseDateOnly } from "./dates.js";

// Case-insensitive match on name and device manufacturer; digit-normalized
// match on phone so "(435) 555-1234" is found by "4355551" or "555-1234".
export function patientMatchesSearch(p, term) {
  const t = (term || "").trim().toLowerCase();
  if (!t) return true;
  if (p?.name?.toLowerCase().includes(t)) return true;
  if (p?.devices?.manufacturer?.toLowerCase().includes(t)) return true;
  const digits = t.replace(/\D/g, "");
  // Require the term to be mostly digits so a name search never accidentally
  // matches a phone number, and at least 3 digits to avoid noise matches.
  if (digits.length >= 3 && digits.length >= t.replace(/[\s()+.-]/g, "").length) {
    return (p?.phone || "").replace(/\D/g, "").includes(digits);
  }
  return false;
}

function toTime(s) {
  if (!s) return null;
  const d = parseDateOnly(s) || new Date(s);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

// Column key → sortable value. null means "no value" and always sorts last
// regardless of direction (an empty cell should never lead the list).
const SORT_ACCESSORS = {
  name: p => (p.name || "").toLowerCase() || null,
  device: p => (p.devices?.manufacturer || "").toLowerCase() || null,
  coverage: p =>
    p.payType === "insurance"
      ? (p.insurance?.carrier || "insurance").toLowerCase()
      : "private pay",
  carePlan: p => p.carePlan || null,
  warranty: p => toTime(p.devices?.warrantyExpiry),
  fitting: p => toTime(p.devices?.fittingDate || p.createdAt),
};

export const PATIENT_SORT_KEYS = Object.keys(SORT_ACCESSORS);

export function sortPatients(list, key, dir = "asc") {
  const acc = SORT_ACCESSORS[key];
  if (!acc) return list;
  const mul = dir === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    const va = acc(a);
    const vb = acc(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number") return (va - vb) * mul;
    return String(va).localeCompare(String(vb)) * mul;
  });
}
