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

import React, { useState } from "react";

// Closer-role: Price Adjustment Authorization (spec §6). A formal modal the
// provider opens on the TV — the patient watches the exception get documented.
// Per Kurt's simplification, closers have unlimited discount authority with
// their name attached: NO manager-auth path, NO threshold, NO username/password
// fields. The logged-in staff is the actor (stamped server-side by the
// log_price_adjustment RPC). Reason codes are the §6 v1 set; "other" requires a
// written justification (mirrors the price_adjustment_log CHECK constraint).

const NAVY = "#0a1628";

// reason_code values MUST match the price_adjustment_log_reason_code_check
// constraint in Postgres. Labels are provider-facing only.
export const ADJUST_REASON_CODES = [
  { code: "preferred_provider_courtesy", label: "Preferred provider courtesy" },
  { code: "hardship_consideration",      label: "Hardship consideration" },
  { code: "bundle_adjustment",           label: "Bundle adjustment" },
  { code: "price_match",                 label: "Price match" },
  { code: "loyalty_returning_patient",   label: "Loyalty / returning patient" },
  { code: "clinical_judgment",           label: "Clinical judgment" },
  { code: "other",                       label: "Other (explain below)" },
];

const fmt$ = (n) =>
  (n == null || isNaN(n))
    ? "—"
    : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AdjustPriceModal({ currentPrice, priceUnit = "per aid", onCancel, onConfirm }) {
  const original = Number(currentPrice) || 0;
  const [newPriceStr, setNewPriceStr] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);

  const newPrice = newPriceStr === "" ? null : Number(newPriceStr);
  const validPrice = newPrice != null && !isNaN(newPrice) && newPrice >= 0;
  const delta = validPrice ? newPrice - original : null;
  const deltaPct = validPrice && original > 0 ? (delta / original) * 100 : null;
  const needsText = reasonCode === "other";
  const canConfirm =
    validPrice && newPrice !== original && !!reasonCode &&
    (!needsText || reasonText.trim().length > 0) && !saving;

  // Discounts (negative delta) read green; increases read red.
  const deltaColor = delta == null ? "#6b7280" : delta < 0 ? "#16a34a" : delta > 0 ? "#b91c1c" : "#6b7280";
  const deltaSign = delta == null ? "" : delta < 0 ? "−" : delta > 0 ? "+" : "";

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      await onConfirm({ newPrice, reasonCode, reasonText: needsText ? reasonText.trim() : null });
    } finally {
      setSaving(false);
    }
  };

  const overlay = { position: "fixed", inset: 0, background: "rgba(10,22,40,0.6)", zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "56px 16px" };
  const card = { background: "#fff", width: "100%", maxWidth: 480, borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.35)", overflow: "hidden", fontFamily: "'Sora',sans-serif" };
  const input = { width: "100%", padding: "11px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 15, fontFamily: "'Sora',sans-serif", outline: "none", boxSizing: "border-box" };
  const label = { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#6b7280", marginBottom: 6, display: "block" };

  return (
    <div style={overlay} onClick={saving ? undefined : onCancel}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: NAVY }}>Price Adjustment Authorization</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Documenting an exception on the patient's behalf</div>
          </div>
          <button onClick={onCancel} disabled={saving} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: saving ? "default" : "pointer", lineHeight: 1 }}>&times;</button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Old price */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Current price <span style={{ color: "#9ca3af" }}>({priceUnit})</span></span>
            <span style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>{fmt$(original)}</span>
          </div>

          {/* Reason code (required) */}
          <div>
            <label style={label}>Reason for adjustment</label>
            <select style={input} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              <option value="">Select a reason&hellip;</option>
              {ADJUST_REASON_CODES.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </div>

          {needsText && (
            <div>
              <label style={label}>Justification</label>
              <textarea
                style={{ ...input, minHeight: 64, resize: "vertical" }}
                placeholder="Required — briefly explain the adjustment"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
              />
            </div>
          )}

          {/* New price */}
          <div>
            <label style={label}>New price ({priceUnit})</label>
            <input
              style={input}
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              placeholder="Enter adjusted price"
              value={newPriceStr}
              onChange={(e) => setNewPriceStr(e.target.value)}
              autoFocus
            />
          </div>

          {/* Live delta — dollar + percent, computed as the patient watches */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 10, background: delta == null ? "#f8fafc" : delta < 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${delta == null ? "#e5e7eb" : delta < 0 ? "#bbf7d0" : "#fecaca"}` }}>
            <span style={{ fontSize: 13, color: "#374151" }}>Change</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: deltaColor }}>
              {delta == null ? "—" : `${deltaSign}${fmt$(Math.abs(delta))}`}
              {deltaPct != null && <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 8 }}>({deltaSign}{Math.abs(deltaPct).toFixed(1)}%)</span>}
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={onCancel} disabled={saving} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 14, cursor: saving ? "default" : "pointer" }}>Cancel</button>
            <button onClick={handleConfirm} disabled={!canConfirm} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: canConfirm ? "#15803d" : "#d1d5db", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: canConfirm ? "pointer" : "not-allowed" }}>
              {saving ? "Recording…" : "Confirm adjustment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
