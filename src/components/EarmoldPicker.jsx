// Per-ear earmold configurator (backlog #42a) — replaces the dead-end
// "Earmold required" banner in the wizard's device cascade. Cascading selects
// driven by the earmold_catalog (loadEarmoldCatalog: DB with bundled-seed
// fallback), filtered to the side's manufacturer + coupling branch.
// TruHearing devices are Signia-built and resolve to the Signia catalog
// (normalizeMfr). Emits flat earmold* fields through updSide — the same
// per-side state the chart persists.

import React, { useEffect, useMemo, useState } from "react";
import { loadEarmoldCatalog } from "../db.js";
import { normalizeMfr } from "../lib/manufacturerKeys.js";

const selStyle = {
  width: "100%", padding: "7px 9px", borderRadius: 6, border: "1px solid #E4E0D5",
  fontSize: 12.5, fontFamily: "'Sora',sans-serif", background: "white", color: "#0a1628",
  boxSizing: "border-box",
};
const lblStyle = {
  display: "block", fontSize: 10, fontWeight: 700, color: "#8B8577",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3,
};

export default function EarmoldPicker({ side, sd, updSide, deviceType = "ric" }) {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let live = true;
    loadEarmoldCatalog().then((rows) => { if (live) setCatalog(rows); });
    return () => { live = false; };
  }, []);

  const mfrKey = normalizeMfr(sd.manufacturer);
  const rows = useMemo(
    () => (catalog || []).filter((r) => r.manufacturer === mfrKey && (r.deviceType === deviceType || r.deviceType === "both")),
    [catalog, mfrKey, deviceType]
  );
  const row = rows.find((r) => r.styleId === sd.earmoldStyle) || null;
  const material = row?.materials?.find((m) => m.id === sd.earmoldMaterial) || null;
  const vent = row?.vents?.find((v) => v.id === sd.earmoldVent) || null;

  const set = (k, v, clear = []) => {
    updSide(side, k, v);
    for (const c of clear) updSide(side, c, "");
  };

  if (catalog === null) {
    return <div style={{ fontSize: 12, color: "#9AA39B", padding: "8px 0" }}>Loading earmold options…</div>;
  }

  return (
    <div style={{ background: "#FBF9F3", border: "1px solid #E4E0D5", borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0B4A42" }}>🦻 Custom earmold</span>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {rows.length
            ? "Impression required — the order form fills from these choices."
            : `No ${sd.manufacturer || "manufacturer"} earmold catalog on file yet — record the details in notes.`}
        </span>
      </div>

      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px 12px" }}>
          <div>
            <label style={lblStyle}>Mold style</label>
            <select style={selStyle} value={sd.earmoldStyle || ""}
              onChange={(e) => set("earmoldStyle", e.target.value, ["earmoldMaterial", "earmoldColor", "earmoldVent", "earmoldVentSize", "earmoldCanal"])}>
              <option value="">Select…</option>
              {rows.map((r) => <option key={r.styleId} value={r.styleId}>{r.styleLabel}</option>)}
            </select>
          </div>

          {row && row.materials?.length > 0 && (
            <div>
              <label style={lblStyle}>Material</label>
              <select style={selStyle} value={sd.earmoldMaterial || ""}
                onChange={(e) => set("earmoldMaterial", e.target.value, ["earmoldColor"])}>
                <option value="">Select…</option>
                {row.materials.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          )}

          {material && material.colors?.length > 0 && (
            <div>
              <label style={lblStyle}>Color</label>
              <select style={selStyle} value={sd.earmoldColor || ""}
                onChange={(e) => set("earmoldColor", e.target.value)}>
                <option value="">Select…</option>
                {material.colors.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          )}

          {row && row.vents?.length > 0 && (
            <div>
              <label style={lblStyle}>Vent</label>
              <select style={selStyle} value={sd.earmoldVent || ""}
                onChange={(e) => set("earmoldVent", e.target.value, ["earmoldVentSize"])}>
                <option value="">Select…</option>
                {row.vents.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
          )}

          {vent && vent.sizes?.length > 0 && (
            <div>
              <label style={lblStyle}>Vent size</label>
              <select style={selStyle} value={sd.earmoldVentSize || ""}
                onChange={(e) => set("earmoldVentSize", e.target.value)}>
                <option value="">Select…</option>
                {vent.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {row && row.canal?.lengths?.length > 0 && (
            <div>
              <label style={lblStyle}>Canal length</label>
              <select style={selStyle} value={sd.earmoldCanal || ""}
                onChange={(e) => set("earmoldCanal", e.target.value)}>
                <option value="">Select…</option>
                {row.canal.lengths.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lblStyle}>Mold notes (retention, waxguard, finish…)</label>
            <input style={selStyle} value={sd.earmoldNotes || ""} placeholder="e.g. canal lock, Nanocare waxguard, matte finish"
              onChange={(e) => set("earmoldNotes", e.target.value)} />
          </div>
        </div>
      )}

      {(material?.notes || vent?.notes || row?.constraintsNote) && (
        <div style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: 6, padding: "6px 10px", marginTop: 8, lineHeight: 1.45 }}>
          {[material?.notes, vent?.notes, row?.constraintsNote].filter(Boolean).join(" · ")}
          {row?.confidence === "medium" && " · Verify unusual combinations against the printed order form."}
        </div>
      )}
    </div>
  );
}
