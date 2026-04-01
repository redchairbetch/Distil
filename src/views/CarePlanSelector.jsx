import { useState, useRef } from "react";
import { updateInsuranceCoverage } from "../db";

// ── PLAN DATA ────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "paygo",
    label: "PAY-AS-YOU-GO",
    shortLabel: "Pay-as-you-go",
    base5yr: 1625,
    lines: [
      "$65 per visit · 5 visits/yr",
      "3-year mfr warranty",
      "Repair risk: yrs 4–5",
    ],
    guideLine: "You come in rarely and want no long-term commitment.",
    greenBorder: false,
    features: [
      "Pay per visit ($65 each)",
      "~5 visits/year recommended",
      "3-year manufacturer warranty",
      "No upfront commitment",
    ],
    repairNote: "years 4–5",
    // timeline: 3yr mfr, 2yr risk
    tlSegments: [
      { flex: 3, bg: "#1D9E75", text: "Mfr warranty · 3 yrs", textColor: "#E1F5EE" },
      { flex: 2, bg: "#EF9F27", text: "Repair risk", textColor: "#412402" },
    ],
  },
  {
    id: "punch",
    label: "PUNCH CARD",
    shortLabel: "Punch card",
    base5yr: 575,
    lines: [
      "Flat rate · defined schedule",
      "3-year mfr warranty",
      "Repair risk: yrs 4–5",
    ],
    guideLine: "You want the lowest cost and will follow the standard care schedule.",
    greenBorder: true,
    badge: "Lowest cost",
    features: [
      "12 cleanings + 16 appointments",
      "Flat fee — no per-visit charges",
      "3-year manufacturer warranty",
      "Structured visit schedule",
    ],
    repairNote: "years 4–5",
    tlSegments: [
      { flex: 3, bg: "#1D9E75", text: "Mfr warranty · 3 yrs", textColor: "#E1F5EE" },
      { flex: 2, bg: "#EF9F27", text: "Repair risk", textColor: "#412402" },
    ],
  },
  {
    id: "complete",
    label: "COMPLETE CARE+",
    shortLabel: "Complete Care+",
    base5yr: 1250,
    lines: [
      "Flat rate · unlimited visits",
      "4-year warranty (3 mfr + 1 practice)",
      "Repair risk: yr 5 only",
    ],
    guideLine: "You want unlimited access and an extra year of warranty coverage.",
    greenBorder: false,
    features: [
      "Unlimited office visits",
      "4-year warranty (3 mfr + 1 practice)",
      "Only 1 year of repair risk vs 2",
      "Best long-term protection",
    ],
    repairNote: "year 5 only",
    tlSegments: [
      { flex: 3, bg: "#1D9E75", text: "Mfr warranty · 3 yrs", textColor: "#E1F5EE" },
      { flex: 1, bg: "#085041", text: "+1 yr", textColor: "#9FE1CB" },
      { flex: 1, bg: "#EF9F27", text: "Risk", textColor: "#412402" },
    ],
  },
];

const SCENARIOS = [
  { id: 0, label: "Routine care only" },
  { id: 1, label: "+ L\u0026D replacement ($275/device)" },
  { id: 2, label: "+ Out-of-warranty repair ($250/ear)" },
  { id: 3, label: "+ Both" },
];

// Add-on costs are flat — same amount added to every plan
const ADDON = [
  [0, 0, 0],       // routine
  [275, 275, 275],  // +L&D
  [250, 250, 250],  // +repair
  [525, 525, 525],  // +both
];

const SCENARIO_NOTES = [
  "Routine service costs only. L&D and repair charges are separate on all plans.",
  "L&D replacement: $275 per device. Available on all plans during the warranty period.",
  "Out-of-warranty repair: $250 per ear. Applies after manufacturer warranty expires.",
  "Includes both L&D replacement and one out-of-warranty repair — worst-case scenario.",
];

function totals(scenarioIdx) {
  return PLANS.map((p, i) => p.base5yr + ADDON[scenarioIdx][i]);
}

// ── COMPONENT ────────────────────────────────────────────────────────────────
// wizardMode: no confirm/save — just calls onSelect(planId) on click
// detail mode (default): two-step confirm → save to Supabase → print
export default function CarePlanSelector({ patientId, currentPlan, patientName, onPlanSaved, coverageId, wizardMode, onSelect, selectedPlanOverride }) {
  const [localSelected, setLocalSelected] = useState(currentPlan || null);
  const [scenario, setScenario] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const printRef = useRef(null);

  // In wizard mode, parent controls selection via selectedPlanOverride
  const selectedPlan = wizardMode ? (selectedPlanOverride || null) : localSelected;

  const costs = totals(scenario);
  const paygoTotal = costs[0];

  const handleSelect = (planId) => {
    if (wizardMode) {
      if (onSelect) onSelect(planId);
      return;
    }
    if (saved) return;
    setLocalSelected(planId);
    setSaved(false);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selectedPlan || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateInsuranceCoverage(
        patientId,
        { care_plan_type: selectedPlan },
        coverageId || null
      );
      setSaved(true);
      if (onPlanSaved) onPlanSaved(selectedPlan);
    } catch (err) {
      setError(err?.message || "Failed to save care plan");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const plan = PLANS.find(p => p.id === selectedPlan);
    const routineTotal = plan.base5yr;
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const win = window.open("", "_blank", "width=800,height=1000");

    win.document.write(`<!DOCTYPE html><html><head><title>Care Plan Agreement</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sora', sans-serif; padding: 48px; color: #0a1628; line-height: 1.6; }
  h1 { font-size: 22px; margin-bottom: 8px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #0a1628; padding-bottom: 16px; }
  .header-sub { font-size: 12px; color: #6b7280; }
  .plan-box { background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 16px 0; }
  .plan-name { font-size: 18px; font-weight: 700; }
  .plan-cost { font-size: 24px; font-weight: 800; color: #16a34a; margin-top: 4px; }
  .plan-note { font-size: 11px; color: #6b7280; margin-top: 4px; }
  .section { margin: 20px 0; }
  .section p { font-size: 13px; margin-bottom: 8px; }
  .sig-block { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .sig-line { border-top: 1px solid #0a1628; padding-top: 6px; font-size: 11px; color: #6b7280; margin-top: 48px; }
  .footer { margin-top: 40px; font-size: 10px; color: #9ca3af; text-align: center; }
  @media print { body { padding: 24px; } }
</style></head><body>
  <div class="header">
    <h1>My Hearing Centers</h1>
    <div class="header-sub">Care Plan Purchase Agreement</div>
  </div>
  <div class="section">
    <p><strong>Patient:</strong> ${patientName || "\u2014"}</p>
    <p><strong>Date:</strong> ${today}</p>
  </div>
  <div class="plan-box">
    <div class="plan-name">${plan?.shortLabel || "\u2014"}</div>
    <div class="plan-cost">$${routineTotal.toLocaleString()}</div>
    <div class="plan-note">Estimated 5-year cost \u00b7 Routine care</div>
  </div>
  <div class="section">
    <h2>What\u2019s Included</h2>
    ${(plan?.features || []).map(f => `<p>&#10003; ${f}</p>`).join("")}
  </div>
  <div class="section">
    <h2>Additional Costs (if applicable)</h2>
    <p>&#8226; Loss & Damage replacement: $275/device (one-time, during warranty period)</p>
    <p>&#8226; Out-of-warranty repair: $250/ear (applies ${plan?.repairNote || "years 4\u20135"})</p>
  </div>
  <div class="section">
    <h2>Terms</h2>
    <p>This agreement confirms the patient\u2019s selection of the above care plan for their hearing instruments. The care plan fee is due at time of fitting. The plan covers the services described above for the duration of the hearing instrument warranty period plus any extended coverage noted.</p>
    <p>Care plan benefits are non-transferable and apply only to the hearing instruments fitted at this appointment. Benefits expire at the end of the coverage period regardless of usage.</p>
  </div>
  <div class="sig-block">
    <div><div class="sig-line">Patient Signature</div></div>
    <div><div class="sig-line">Date</div></div>
    <div><div class="sig-line">Hearing Care Specialist</div></div>
    <div><div class="sig-line">Date</div></div>
  </div>
  <div class="footer">My Hearing Centers &middot; A WSAudiology Company &middot; This document is confidential and intended for the named patient only.</div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const planChanged = selectedPlan && selectedPlan !== currentPlan;
  const showConfirm = !wizardMode && planChanged && !saved;
  const showPrint = !wizardMode && saved;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: wizardMode ? 0 : "20px 28px", fontFamily: "'Sora', sans-serif" }}>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0a1628", marginBottom: 2 }}>Care Plan Comparison</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>5-year cost breakdown across all care plans</div>
        </div>
        {currentPlan && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "#0a1628", background: "#f3f4f6", borderRadius: 6, padding: "3px 10px", letterSpacing: 0.3 }}>
            Current: {PLANS.find(p => p.id === currentPlan)?.shortLabel || currentPlan}
          </span>
        )}
      </div>

      {/* ── SCENARIO PILLS ──────────────────────────────────────────── */}
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 8 }}>Select a scenario</div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 24 }}>
        {SCENARIOS.map(s => (
          <button
            key={s.id}
            onClick={() => setScenario(s.id)}
            style={{
              padding: "5px 13px", borderRadius: 20, fontSize: 12, fontFamily: "'Sora',sans-serif",
              cursor: "pointer", transition: "all 0.15s",
              border: scenario === s.id ? "none" : "0.5px solid #d1d5db",
              background: scenario === s.id ? "#dbeafe" : "transparent",
              color: scenario === s.id ? "#1d4ed8" : "#6b7280",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── PLAN CARDS ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
        {PLANS.map((plan, idx) => {
          const cost = costs[idx];
          const isSelected = selectedPlan === plan.id;
          const savingsAmt = paygoTotal - cost;
          return (
            <div
              key={plan.id}
              onClick={() => handleSelect(plan.id)}
              style={{
                background: "white",
                border: plan.greenBorder
                  ? `2px solid ${isSelected ? "#15803d" : "#16a34a"}`
                  : isSelected
                    ? "2px solid #0a1628"
                    : "0.5px solid #e5e7eb",
                borderRadius: 12, padding: 16, cursor: "pointer",
                transition: "all 0.15s",
                boxShadow: isSelected ? "0 0 0 1px #0a1628" : "none",
              }}
            >
              {/* Label + badge row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500, letterSpacing: "0.06em" }}>{plan.label}</span>
                {plan.badge && (
                  <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 10 }}>
                    {plan.badge}
                  </span>
                )}
              </div>

              {/* Cost */}
              <div style={{ fontSize: 30, fontWeight: 500, color: "#0a1628", lineHeight: 1.1, margin: "0 0 2px" }}>
                ${cost.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>5-year total</div>

              {/* Details */}
              <div style={{ borderTop: "0.5px solid #e5e7eb", paddingTop: 9, display: "flex", flexDirection: "column", gap: 4 }}>
                {plan.lines.map((line, i) => (
                  <span key={i} style={{ fontSize: 12, color: "#6b7280" }}>{line}</span>
                ))}
                {plan.id !== "paygo" && savingsAmt > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 500, marginTop: 2,
                    color: plan.id === "punch" ? "#16a34a" : "#6b7280",
                  }}>
                    Saves ${savingsAmt.toLocaleString()} vs PAYG
                  </span>
                )}
                {plan.id !== "paygo" && savingsAmt === 0 && (
                  <span style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Same cost as PAYG</span>
                )}
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: "#0a1628" }}>&#10003; Selected</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── SCENARIO NOTE ───────────────────────────────────────────── */}
      <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px", marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{SCENARIO_NOTES[scenario]}</span>
      </div>

      {/* ── WARRANTY TIMELINE ───────────────────────────────────────── */}
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 6 }}>Warranty protection — 5-year window</div>

      {/* Year labels */}
      <div style={{ display: "flex", marginLeft: 96, marginBottom: 3 }}>
        {[1, 2, 3, 4, 5].map(yr => (
          <div key={yr} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#9ca3af" }}>Yr {yr}</div>
        ))}
      </div>

      {/* Bars */}
      {PLANS.map(plan => (
        <div key={plan.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <span style={{
            width: 88, fontSize: 11, color: "#6b7280", textAlign: "right", flexShrink: 0, lineHeight: 1.3,
          }} dangerouslySetInnerHTML={{ __html: plan.shortLabel.replace(/\s/g, (m, off, s) => {
            // Break long labels onto two lines at the best word boundary
            return s.length > 12 && off > 3 && off < s.length - 3 ? "<br/>" : m;
          }) }} />
          <div style={{ flex: 1, height: 28, display: "flex", borderRadius: 4, overflow: "hidden" }}>
            {plan.tlSegments.map((seg, i) => (
              <div key={i} style={{
                flex: seg.flex, background: seg.bg,
                display: "flex", alignItems: "center",
                justifyContent: seg.flex === 1 ? "center" : undefined,
                paddingLeft: seg.flex > 1 ? 8 : undefined,
              }}>
                <span style={{ fontSize: 10, color: seg.textColor, whiteSpace: "nowrap" }}>{seg.text}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, marginBottom: 20 }}>
        {[
          { bg: "#1D9E75", label: "Manufacturer warranty" },
          { bg: "#085041", label: "Practice warranty (CC+ only)" },
          { bg: "#EF9F27", label: "Out-of-warranty repair risk" },
        ].map(item => (
          <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: item.bg, display: "inline-block", flexShrink: 0 }} />
            {item.label}
          </span>
        ))}
      </div>

      {/* ── DECISION GUIDE ──────────────────────────────────────────── */}
      <div style={{ borderTop: "0.5px solid #e5e7eb", paddingTop: 16 }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 8 }}>Which plan fits you?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#0a1628", marginBottom: 3 }}>{plan.shortLabel}</div>
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>{plan.guideLine}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONFIRM / PRINT BAR ─────────────────────────────────────── */}
      {(showConfirm || showPrint || error) && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, paddingTop: 16, borderTop: "0.5px solid #e5e7eb" }}>
          {showConfirm && (
            <>
              <button
                onClick={handleConfirm}
                disabled={saving}
                style={{
                  background: "#16a34a", color: "white", border: "none", borderRadius: 8,
                  padding: "10px 24px", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13,
                  cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, transition: "all 0.15s",
                }}
              >
                {saving ? "Saving\u2026" : `Confirm ${PLANS.find(p => p.id === selectedPlan)?.shortLabel}`}
              </button>
              <button
                onClick={() => { setLocalSelected(currentPlan || null); setError(null); }}
                style={{
                  background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
                  padding: "10px 18px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13,
                  cursor: "pointer", color: "#6b7280",
                }}
              >
                Cancel
              </button>
            </>
          )}
          {showPrint && (
            <>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>&#10003; Plan saved successfully</span>
              <button
                onClick={handlePrint}
                style={{
                  background: "#0a1628", color: "white", border: "none", borderRadius: 8,
                  padding: "10px 24px", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                }}
              >
                &#128424; Print for signature
              </button>
            </>
          )}
          {error && <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>}
        </div>
      )}

      <div ref={printRef} style={{ display: "none" }} />
    </div>
  );
}
