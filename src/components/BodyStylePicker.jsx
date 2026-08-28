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

// Body-style picker — the patient-facing opener of Device Selection. One
// full-width card per style with the real Signia packshot, six stat bars, and
// the audiogram engine's annotations (bodyStyleRec.js). One click seeds BOTH
// ears; the per-ear cascades keep their own compact "Change" escape hatch for
// CROS and asymmetric fits. The `styles` prop decides scope, so the
// TruHearing flow passes only what the tier allows.

import React, { useMemo } from "react";
import {
  BODY_STYLE_STATS, STAT_KEYS, recommendBodyStyles,
} from "../lib/bodyStyleRec.js";

const STATUS_PILL = {
  recommended: { background: "#ecfdf5", border: "#bbf7d0", color: "#15803d" },
  caution:     { background: "#fef9c3", border: "#fde047", color: "#854d0e" },
  blocked:     { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
};

function StatBar({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 9.5, color: "#9AA39B", width: 76, flexShrink: 0, textAlign: "right", lineHeight: 1.2 }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 2, flex: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{
            height: 5, flex: 1, borderRadius: 2,
            background: i <= value ? "#0B4A42" : "#EAE6DA",
          }} />
        ))}
      </div>
    </div>
  );
}

function StyleCard({ style, ann, selected, onSelect }) {
  const blocked = ann?.status === "blocked";
  const pill = ann && ann.badge ? STATUS_PILL[ann.status] : null;
  const stats = BODY_STYLE_STATS[style.id];
  return (
    <div
      onClick={blocked ? undefined : onSelect}
      title={blocked ? ann.notes[0] : undefined}
      style={{
        flex: "1 1 150px", minWidth: 140, position: "relative",
        border: `2px solid ${selected ? "#0B4A42" : ann?.status === "recommended" ? "#1B8A7A" : "#E4E0D5"}`,
        borderRadius: 12, padding: "14px 12px 12px",
        background: selected ? "#FBF9F3" : "#fff",
        cursor: blocked ? "not-allowed" : "pointer",
        opacity: blocked ? 0.55 : 1,
        boxShadow: selected ? "0 4px 14px rgba(11,74,66,0.12)" : "0 1px 2px rgba(0,0,0,0.03)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {style.img ? (
        <img src={style.img} alt={style.label}
          style={{ display: "block", margin: "0 auto 8px", width: 72, height: 72, objectFit: "contain",
            filter: blocked ? "grayscale(1)" : "none" }} />
      ) : (
        <div style={{ width: 72, height: 72, margin: "0 auto 8px", borderRadius: 10, background: "#F0EDE3",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9AA39B" }}>
          photo soon
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0a1628", textAlign: "center" }}>{style.label}</div>
      <div style={{ fontSize: 10.5, color: "#6b7280", textAlign: "center", marginTop: 2, lineHeight: 1.35 }}>{style.desc}</div>
      {pill && (
        <div style={{
          margin: "8px auto 0", width: "fit-content", maxWidth: "100%",
          background: pill.background, border: `1px solid ${pill.border}`, color: pill.color,
          borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
        }}>
          {ann.badge}
        </div>
      )}
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {STAT_KEYS.map((k) => <StatBar key={k.id} label={k.label} value={stats?.[k.id] ?? 0} />)}
      </div>
      {selected && (
        <div style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: "50%",
          background: "#0B4A42", color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: "18px", textAlign: "center" }}>
          ✓
        </div>
      )}
    </div>
  );
}

export default function BodyStylePicker({ styles, selectedId, onSelect, audiology, subtitle }) {
  const rec = useMemo(() => recommendBodyStyles(audiology), [audiology]);
  const selectedStyle = styles.find((s) => s.id === selectedId) || null;
  const selectedAnn = selectedId ? rec.byStyle[selectedId] : null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0a1628" }}>Choose a style together</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {subtitle || "One choice sets both ears — either ear can be changed on its own below."}
        </div>
      </div>

      {/* Narratable engine banner — "From today's test results…" */}
      {rec.summary && (
        <div style={{ background: "#E7F1EE", borderLeft: "4px solid #1B8A7A", borderRadius: 6,
          padding: "10px 14px", margin: "10px 0 0", fontSize: 12.5, color: "#16201D", lineHeight: 1.5 }}>
          {rec.summary}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
        {styles.map((s) => (
          <StyleCard
            key={s.id}
            style={s}
            ann={rec.byStyle[s.id]}
            selected={selectedId === s.id}
            onSelect={() => onSelect(s.id)}
          />
        ))}
      </div>

      {/* Detail panel — full sentences for whatever's selected */}
      {selectedStyle && (
        <div style={{ marginTop: 12, background: "#FBF9F3", border: "1px solid #E4E0D5", borderRadius: 10,
          padding: "12px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0B4A42", marginBottom: 4 }}>
            {selectedStyle.label} — {selectedStyle.desc}
          </div>
          <div style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.55 }}>
            {selectedAnn && selectedAnn.notes.length > 0
              ? selectedAnn.notes.join(" ")
              : "Today's test results place no restriction on this style — the fit can follow comfort, dexterity, and how visible the patient wants it to be."}
          </div>
        </div>
      )}
    </div>
  );
}
