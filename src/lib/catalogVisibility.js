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

// ── Catalog visibility — the one gate every device picker shares ─────────────
// Two independent exclusivity rules decide whether a catalog family can be
// SELECTED (lookups of an already-fitted family always use the full catalog):
//
//   1. TPA exclusivity — a family carrying a tpa (Relate → 'UHCH', TH white-
//      labels → 'TruHearing') is only offered when quoting on that TPA;
//      tpa-less families show for everyone.
//   2. Proprietary fitting software — some brands can only be fit with
//      software the clinic must be authorized for (Beltone → Solus Max). Those
//      families show only at clinics whose clinics.proprietary_software_auth
//      lists the brand's key. Every other clinic never sees them, so nobody
//      quotes a device they can't program.
//
// Rule 2 keys on the manufacturer as well as the row flag so a family added
// through the catalog editor (which doesn't expose the flag) is still gated.

// Canonical keys (lowercase) of brands that need clinic-level software auth.
export const PROPRIETARY_SOFTWARE_MFRS = ["beltone"];

// Settings-screen copy for each gated brand.
export const PROPRIETARY_SOFTWARE_LABELS = {
  beltone: { brand: "Beltone", software: "Solus Max" },
};

const mfrKey = (name) => String(name || "").trim().toLowerCase();

// The auth key a family needs, or null when it needs none.
export function proprietaryAuthKey(entry) {
  if (!entry) return null;
  const k = mfrKey(entry.manufacturer);
  if (PROPRIETARY_SOFTWARE_MFRS.includes(k)) return k;
  return entry.requiresProprietarySoftware ? k : null;
}

// Can this clinic offer the family? `proprietaryAuth` is the clinic's list of
// authorized keys (e.g. ['beltone']).
export function clinicCanFit(entry, proprietaryAuth = []) {
  const k = proprietaryAuthKey(entry);
  return !k || (proprietaryAuth || []).map(mfrKey).includes(k);
}

// Full selection gate: active, TPA-eligible, and fittable at this clinic.
export function isCatalogEntryVisible(entry, { tpa = null, proprietaryAuth = [] } = {}) {
  if (!entry?.active) return false;
  if (entry.tpa && entry.tpa !== tpa) return false;
  return clinicCanFit(entry, proprietaryAuth);
}
