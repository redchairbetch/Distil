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

import React, { useMemo, useState } from "react";
import { NATIONS_TIER_ORDER } from "../lib/pricing.js";
import { NATIONS_CATALOG, NATIONS_TIER_PRICING } from "../nations_catalog_data.js";

// Admin → Nations Catalog: read-only reference view over the authoritative
// NationsBenefits covered-device catalog (637 SKUs). Answers "is this exact
// device on the Nations plan, and at which tier/copay?" when the wizard's
// family-level map isn't granular enough (e.g. checking a specific portal SKU
// before ordering). Pure static data — nothing here feeds pricing; the wizard
// resolves device→tier via nationsCoverageTier() (lib/pricing.js).

const fmtUsd = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0 });

// Brands MHC dispenses get plain rows; the rest (Beltone/Bernafon/Unitron —
// covered by Nations but not serviceable by MHC; Beltone needs proprietary
// software auth we lack) are dimmed with a badge so nobody quotes them.
const MHC_BRANDS = new Set(["Signia", "Phonak", "Oticon", "Starkey", "Widex", "ReSound", "Rexton"]);

const TIER_COLOR = {
  Standard: "#6b7280", Select: "#0e7490", "Superior Plus": "#7c3aed",
  Advanced: "#b45309", "Advanced Plus": "#c2410c", Specialty: "#0a1628",
};

export default function NationsCatalog() {
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("all");
  const [tier, setTier] = useState("all");

  const brands = useMemo(() => {
    const set = new Set(NATIONS_CATALOG.map(([b]) => b));
    // MHC-dispensed brands first, then the rest alphabetically.
    return [...set].sort((a, b) =>
      (MHC_BRANDS.has(b) - MHC_BRANDS.has(a)) || a.localeCompare(b));
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return NATIONS_CATALOG.filter(([b, model, t]) =>
      (brand === "all" || b === brand) &&
      (tier === "all" || t === tier) &&
      (!q || model.toLowerCase().includes(q) || b.toLowerCase().includes(q)));
  }, [search, brand, tier]);

  const pillStyle = (active) => ({
    padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
    fontFamily: "'Sora',sans-serif", border: "1px solid " + (active ? "#0a1628" : "#e5e7eb"),
    background: active ? "#0a1628" : "#fff", color: active ? "#fff" : "#374151",
  });

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Nations Hearing Catalog</div>
          <div className="topbar-sub">
            NationsBenefits covered devices · {NATIONS_CATALOG.length} SKUs · reference only — pricing resolves from the device cascade
          </div>
        </div>
      </div>

      <div className="content">
        {/* Tier summary strip — the flat per-aid copay + fitting fee ladder. */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {NATIONS_TIER_ORDER.map((t) => {
            const p = NATIONS_TIER_PRICING[t];
            const active = tier === t;
            return (
              <div key={t} onClick={() => setTier(active ? "all" : t)}
                style={{
                  flex: "1 1 130px", minWidth: 130, background: "#fff", borderRadius: 10, padding: "10px 12px",
                  cursor: "pointer", border: "1px solid " + (active ? TIER_COLOR[t] : "#e5e7eb"),
                  boxShadow: active ? `inset 0 0 0 1px ${TIER_COLOR[t]}` : "none",
                }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: TIER_COLOR[t] }}>{t}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", marginTop: 2 }}>{fmtUsd(p.copayPerAid)}<span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af" }}> /aid</span></div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>+ {fmtUsd(p.fittingFeePerAid)} fitting fee</div>
              </div>
            );
          })}
        </div>

        {/* Search + brand filter */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search model (e.g. L70, Pure_Charge, NX7)…"
            style={{ flex: "1 1 240px", maxWidth: 340, padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontFamily: "'Sora',sans-serif", fontSize: 13, outline: "none" }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={pillStyle(brand === "all")} onClick={() => setBrand("all")}>All brands</button>
            {brands.map((b) => (
              <button key={b} style={{ ...pillStyle(brand === b), ...(MHC_BRANDS.has(b) ? {} : { color: brand === b ? "#fff" : "#9ca3af" }) }}
                onClick={() => setBrand(brand === b ? "all" : b)}>
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Result table */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 130px 100px 90px", gap: 0, padding: "9px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9ca3af" }}>
            <div>Brand</div><div>Nations model</div><div>Tier</div><div style={{ textAlign: "right" }}>Copay /aid</div><div style={{ textAlign: "right" }}>Fit fee</div>
          </div>
          {rows.length === 0 && (
            <div style={{ padding: "22px 14px", fontSize: 13, color: "#6b7280" }}>No devices match. Clear the search or filters.</div>
          )}
          {rows.map(([b, model, t]) => {
            const dispensed = MHC_BRANDS.has(b);
            const p = NATIONS_TIER_PRICING[t];
            return (
              <div key={model} style={{ display: "grid", gridTemplateColumns: "110px 1fr 130px 100px 90px", padding: "8px 14px", borderBottom: "1px solid #f3f4f6", fontSize: 12.5, alignItems: "center", opacity: dispensed ? 1 : 0.55 }}>
                <div style={{ fontWeight: 600, color: "#0a1628" }}>{b}</div>
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11.5, color: "#374151", wordBreak: "break-all" }}>
                  {model}
                  {!dispensed && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#b45309", background: "#fef3c7", borderRadius: 10, padding: "1px 7px", fontFamily: "'Sora',sans-serif" }}>NOT DISPENSED BY MHC</span>}
                </div>
                <div><span style={{ fontSize: 11, fontWeight: 700, color: TIER_COLOR[t] }}>{t}</span></div>
                <div style={{ textAlign: "right", fontWeight: 600, color: "#0a1628" }}>{fmtUsd(p.copayPerAid)}</div>
                <div style={{ textAlign: "right", color: "#6b7280" }}>{fmtUsd(p.fittingFeePerAid)}</div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 10, lineHeight: 1.6 }}>
          Source: NationsBenefits Hearing Aids Pricing Catalog (Drive · Distil CRM/Insurance, 2026-07-06).
          Copays are flat per tier — every device in a tier costs the patient the same. Pair pricing is exactly 2× the per-aid values.
          Dimmed brands are covered by Nations but not dispensed by MHC.
        </div>
      </div>
    </>
  );
}
