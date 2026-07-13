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

import { useMemo, useState } from "react";
import { computeComplexBenefit } from "../lib/complexBenefit.js";

// Provider-facing calculator for the rare commercial/PPO/FEP plans that price by
// coinsurance + deductible + benefit-max + OOP rather than a device-driven copay
// (Regence BC/BS, GEHA/UHC, FEP, non-Nations Aetna). Distil can't auto-resolve
// these — the provider enters the Verification of Benefits numbers from billing
// and the math is shown transparently. baselinePerAid = the clinic's per-aid
// charge for the selected device. onSave persists the inputs + computed cost.

const num = (v) => (v === "" || v == null ? null : Number(v));
const fmt = (n) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

const PAPER = "#FCF8EF", LINE = "#EADFC7", INK = "#16201D", INK2 = "#54625C", INK3 = "#9AA39B", BRASS = "#B5832E", PINE = "#0B4A42";

export default function ComplexBenefitCalculator({ baselinePerAid, fittingType = "binaural", initial = null, onSave, onCancel }) {
  const [coveragePercent, setCoveragePercent] = useState(initial?.coveragePercent ?? "");
  const [deductibleRemaining, setDeductibleRemaining] = useState(initial?.deductibleRemaining ?? "");
  const [benefitMax, setBenefitMax] = useState(initial?.benefitMax ?? "");
  const [benefitBasis, setBenefitBasis] = useState(initial?.benefitBasis ?? "combined");
  const [oopMaxRemaining, setOopMaxRemaining] = useState(initial?.oopMaxRemaining ?? "");
  const [periodNote, setPeriodNote] = useState(initial?.periodNote ?? "");
  const [finalOverridePerAid, setFinalOverridePerAid] = useState(initial?.finalOverridePerAid ?? "");
  const [showOverride, setShowOverride] = useState(initial?.finalOverridePerAid != null && initial?.finalOverridePerAid !== "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const inputs = useMemo(() => ({
    coveragePercent: num(coveragePercent),
    deductibleRemaining: num(deductibleRemaining),
    benefitMax: num(benefitMax),
    benefitBasis,
    oopMaxRemaining: num(oopMaxRemaining),
    periodNote: periodNote || null,
    finalOverridePerAid: showOverride ? num(finalOverridePerAid) : null,
  }), [coveragePercent, deductibleRemaining, benefitMax, benefitBasis, oopMaxRemaining, periodNote, finalOverridePerAid, showOverride]);

  const result = useMemo(
    () => computeComplexBenefit({ baselinePerAid, fittingType, inputs }),
    [baselinePerAid, fittingType, inputs]
  );

  const hasBaseline = baselinePerAid != null && baselinePerAid > 0;
  // Override enters the final cost directly (no device baseline needed); the
  // calculator path needs both a coverage % and the device's retail baseline.
  const usable = showOverride
    ? inputs.finalOverridePerAid != null
    : (hasBaseline && inputs.coveragePercent != null);

  async function handleSave() {
    if (!usable || saving) return;
    setSaving(true); setErr(null);
    try { await onSave(inputs, result.patientPerAid); }
    catch (e) { setErr(e?.message || "Couldn't save."); setSaving(false); }
  }

  const field = { padding: "7px 9px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13.5, width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 11, fontWeight: 600, color: INK2, marginBottom: 4, display: "block" };

  return (
    <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 14, padding: "20px 22px", marginTop: 12, fontFamily: "'Sora',sans-serif" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: BRASS, marginBottom: 4 }}>
        Coinsurance / deductible plan
      </div>
      <div style={{ fontSize: 12.5, color: INK2, lineHeight: 1.5, marginBottom: 14 }}>
        Enter the Verification of Benefits from billing. We'll show the patient's out-of-pocket and its breakdown.
      </div>

      {!showOverride && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Plan covers (%)</label>
            <input style={field} type="number" min="0" max="100" inputMode="decimal" placeholder="e.g. 80" value={coveragePercent} onChange={e => setCoveragePercent(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Deductible remaining ($)</label>
            <input style={field} type="number" min="0" inputMode="decimal" placeholder="total − met" value={deductibleRemaining} onChange={e => setDeductibleRemaining(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Benefit max ($)</label>
            <input style={field} type="number" min="0" inputMode="decimal" placeholder="allowed amount" value={benefitMax} onChange={e => setBenefitMax(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Benefit basis</label>
            <select style={field} value={benefitBasis} onChange={e => setBenefitBasis(e.target.value)}>
              <option value="combined">Combined (total)</option>
              <option value="per_ear">Per ear</option>
            </select>
          </div>
          <div>
            <label style={lbl}>OOP max remaining ($)</label>
            <input style={field} type="number" min="0" inputMode="decimal" placeholder="blank if n/a" value={oopMaxRemaining} onChange={e => setOopMaxRemaining(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Period (note)</label>
            <input style={field} type="text" placeholder="e.g. every 3 yrs" value={periodNote} onChange={e => setPeriodNote(e.target.value)} />
          </div>
        </div>
      )}

      {showOverride && (
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Final patient cost per aid ($)</label>
          <input style={{ ...field, maxWidth: 200 }} type="number" min="0" inputMode="decimal" placeholder="from the VOB" value={finalOverridePerAid} onChange={e => setFinalOverridePerAid(e.target.value)} />
          <div style={{ fontSize: 11, color: INK3, marginTop: 4 }}>Bypasses the calculator — use when a VOB doesn't fit the standard model.</div>
        </div>
      )}

      <button type="button" onClick={() => setShowOverride(v => !v)} style={{ background: "none", border: "none", color: BRASS, fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14 }}>
        {showOverride ? "← Back to the calculator" : "Enter final cost directly instead →"}
      </button>

      {/* Live breakdown */}
      {hasBaseline ? (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          {result.breakdown.map((b, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "5px 0", fontSize: 13,
              borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
              fontWeight: b.kind === "patient" ? 700 : 400,
              color: b.kind === "patient" ? INK : b.kind === "plan" ? PINE : b.kind === "oop" ? BRASS : INK2,
            }}>
              <span>{b.label}</span>
              <span>{b.amount == null ? "" : fmt(b.amount)}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: INK3, marginTop: 6 }}>
            {fittingType === "binaural" ? "2 aids" : "1 aid"} · {fmt(result.patientPerAid)}/aid
            {result.capApplied ? " · benefit cap reached" : ""}
            {result.oopApplied ? " · OOP max reached" : ""}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: INK3, marginBottom: 14 }}>Select a device to see the patient's out-of-pocket.</div>
      )}

      {err && <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 10 }}>{err}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" disabled={!usable || saving} onClick={handleSave}
          style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: usable && !saving ? PINE : "#cbd5e1", color: "#fff", fontWeight: 700, fontSize: 13, cursor: usable && !saving ? "pointer" : "default" }}>
          {saving ? "Saving…" : "Apply to this patient"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${LINE}`, background: "#fff", color: INK2, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
