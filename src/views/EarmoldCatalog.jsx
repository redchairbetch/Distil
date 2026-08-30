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

// Earmold Catalog browse view (backlog #42a) — read-only reference, propless
// self-contained (NationsCatalog pattern). One card per manufacturer+style
// row, transcribed from the order forms in docs/manufacturer-forms/. The
// confidence badge marks rows whose printed availability grid wasn't fully
// machine-readable — audit those against the paper before trusting an
// unusual combination. Edits happen by updating src/lib/earmoldSeed.js and
// regenerating the seed (scripts/gen-earmold-seed-sql.mjs), not in-app.

import React, { useEffect, useMemo, useState } from "react";
import { loadEarmoldCatalog } from "../db.js";
import { MFR_DISPLAY } from "../lib/manufacturerKeys.js";

export default function EarmoldCatalog() {
  const [rows, setRows] = useState(null);
  const [mfr, setMfr] = useState("All");
  const [deviceType, setDeviceType] = useState("All");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let live = true;
    loadEarmoldCatalog().then((r) => { if (live) setRows(r); });
    return () => { live = false; };
  }, []);

  const mfrs = useMemo(() => ["All", ...new Set((rows || []).map((r) => r.manufacturer))], [rows]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows || [])
      .filter((r) => mfr === "All" || r.manufacturer === mfr)
      .filter((r) => deviceType === "All" || r.deviceType === deviceType)
      .filter((r) => !term || r.styleLabel.toLowerCase().includes(term) || r.styleId.includes(term));
  }, [rows, mfr, deviceType, search]);

  const chipList = (title, items) => items?.length > 0 && (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#8B8577", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {items.map((it, i) => (
          <span key={i} style={{ fontSize: 11, background: "#F0EDE3", borderRadius: 12, padding: "2px 9px", color: "#374151" }}>
            {typeof it === "string" ? it : it.label}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Earmold Catalog</div>
          <div className="topbar-sub">
            {rows ? `${filtered.length} shown · ${rows.length} styles across ${mfrs.length - 1} manufacturers` : "Loading…"}
            {" · transcribed from the manufacturer order forms"}
          </div>
        </div>
      </div>
      <div className="content">
        <div className="catalog-wrap">
          <div className="catalog-toolbar">
            <input className="catalog-search" placeholder="Search mold styles…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E4E0D5", fontSize: 13, fontFamily: "'Sora',sans-serif", background: "white" }}>
              <option value="All">RIC + BTE</option>
              <option value="ric">RIC coupling</option>
              <option value="bte">BTE coupling</option>
            </select>
          </div>
          <div className="catalog-mfr-tabs">
            {mfrs.map((m) => (
              <div key={m} className={`catalog-mfr-tab ${mfr === m ? "active" : ""}`} onClick={() => setMfr(m)}>
                {m === "All" ? "All" : MFR_DISPLAY[m] || m}
              </div>
            ))}
          </div>

          {rows && filtered.length === 0 && <div className="empty-state">No mold styles match.</div>}

          {filtered.map((r) => (
            <div key={r.id} className="catalog-entry">
              <div className="catalog-entry-header" onClick={() => setOpenId(openId === r.id ? null : r.id)} style={{ cursor: "pointer" }}>
                <div>
                  <span className="catalog-entry-name">{r.styleLabel}</span>
                  <span className="catalog-entry-gen" style={{ marginLeft: 8 }}>
                    {MFR_DISPLAY[r.manufacturer] || r.manufacturer} · {r.deviceType.toUpperCase()}
                  </span>
                </div>
                <div className="catalog-entry-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {r.confidence !== "high" && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
                      VERIFY ON FORM
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "#9AA39B" }}>{openId === r.id ? "▾" : "▸"}</span>
                </div>
              </div>
              {openId === r.id && (
                <div style={{ padding: "10px 14px", borderTop: "1px solid #F0EDE3" }}>
                  {r.materials?.map((m) => chipList(`Material — ${m.label}${m.notes ? ` (${m.notes})` : ""}`, m.colors))}
                  {chipList("Vents", r.vents?.map((v) => v.label + (v.sizes?.length ? ` [${v.sizes.join(", ")}]` : "") + (v.notes ? ` — ${v.notes}` : "")))}
                  {chipList("Canal", [...(r.canal?.types || []), ...(r.canal?.lengths || [])])}
                  {chipList(r.tubing?.receivers ? "Receivers" : "Tubing", r.tubing?.receivers || r.tubing?.options)}
                  {chipList("Retention", r.extras?.retention)}
                  {chipList("Waxguard", r.extras?.waxguard)}
                  {chipList("Finish", r.extras?.finish)}
                  {chipList("Options", r.extras?.options)}
                  {chipList("Labeling", r.extras?.labeling)}
                  {r.constraintsNote && (
                    <div style={{ fontSize: 11.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px", marginTop: 4 }}>
                      {r.constraintsNote}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: "#9AA39B", marginTop: 8 }}>
                    Source: docs/manufacturer-forms · {r.formId}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
