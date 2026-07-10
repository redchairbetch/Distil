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

import { useState } from "react";

// Inline "verify managed copay rate" card, shown in the Pricing Reveal when a
// device-driven managed-care patient (Nations / UHCH) lands on a COVERED tier
// whose copay is a catalog hole — our managed-care rates are reverse-engineered
// and have gaps. Instead of a dead "select a device" placeholder, the provider
// phones the insurer, enters the confirmed per-aid copay, and Save prices the
// patient immediately + queues an admin reconcile to plug the hole for good.
export default function VerifyRateCard({ tpaName, tier, onSave }) {
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const num = parseFloat(val);
  const valid = val !== "" && Number.isFinite(num) && num >= 0;

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true); setErr(null);
    try {
      await onSave(num);
      // On success the reveal re-prices and this card unmounts — no reset needed.
    } catch (e) {
      setErr(e?.message || "Couldn't save the rate. Try again.");
      setSaving(false);
    }
  }

  return (
    <div style={{ background:"#fffbeb", border:"1px solid #fde047", borderRadius:12, padding:"18px 20px", marginTop:12, fontFamily:"'Sora',sans-serif" }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#854d0e", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>
        Verify managed copay rate
      </div>
      <div style={{ fontSize:13, color:"#713f12", lineHeight:1.55, marginBottom:12 }}>
        {tpaName} covers this device{tier ? <> at the <strong>{tier}</strong> tier</> : null}, but we don't have that copay on
        file yet. Call {tpaName} to confirm the per-aid copay, enter it below, and we'll price it now and file it for the office to lock in for future patients.
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:15, color:"#713f12", fontWeight:700 }}>$</span>
        <input
          type="number" min="0" step="1" inputMode="decimal"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
          placeholder="Per-aid copay"
          style={{ flex:"0 0 150px", padding:"8px 10px", border:"1px solid #d6b64a", borderRadius:8, fontSize:14 }}
        />
        <span style={{ fontSize:12, color:"#854d0e" }}>/ aid</span>
        <button
          type="button" disabled={!valid || saving} onClick={handleSave}
          style={{
            marginLeft:"auto", padding:"8px 16px", borderRadius:8, border:"none",
            background: valid && !saving ? "#0B4A42" : "#cbd5e1", color:"#fff",
            fontWeight:700, fontSize:13, cursor: valid && !saving ? "pointer" : "default",
          }}>
          {saving ? "Saving…" : "Save rate"}
        </button>
      </div>
      {err && <div style={{ marginTop:8, fontSize:12, color:"#b91c1c" }}>{err}</div>}
    </div>
  );
}
