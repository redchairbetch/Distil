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

// Staff/session utilities shared by the provider CRM. Extracted verbatim from
// Distil.jsx (backlog #40a — monolith decomposition).

export function genId() { return crypto.randomUUID(); }

// ── ROLE CHECK UTILITY ─────────────────────────────────────────────────────────
// Role categories: 'care_coordinator' | 'provider' | 'closer' | 'admin'
// This is UI gating (defense-in-depth). The real enforcement is in Postgres RLS:
// catalog (product_catalog/product_catalog_tier), pricing (clinic_retail_anchors)
// and insurance_plans writes are all admin-only, and a trigger blocks non-admins
// from self-escalating their staff.role — see migration
// 20260624000000_harden_admin_rls_catalog_and_staff_role.sql.
export function checkRole(staffRole, allowedRoles) {
  return Array.isArray(allowedRoles) && allowedRoles.includes(staffRole);
}


// Downscale a signature image file to a compact PNG data URL. Signatures are
// line art, so a 600px-wide PNG is plenty and keeps both storage and the
// signature embedded in every purchase-agreement PDF small. Returns a data: URL.
export function downscaleSignature(file, maxW = 600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}


// Pick the license matching a clinic's state from a {STATE: number} map,
// mirroring loadStaffProfile's resolution. Falls back to the first license.
// Used to print the right state license when a closer dispenses under a local
// provider at the event clinic.
export function pickLicenseForClinic(licenses, address) {
  const parts = (address || "").split(",").map(s => s.trim());
  const stateZip = parts[parts.length - 1] || "";
  const m = stateZip.match(/\b([A-Z]{2})\b/);
  const state = m ? m[1] : null;
  const lic = licenses || {};
  return (state && lic[state]) ? lic[state] : (Object.values(lic)[0] || "");
}
