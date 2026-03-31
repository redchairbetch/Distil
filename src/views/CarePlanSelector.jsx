import { useState, useRef } from "react";
import { updateInsuranceCoverage } from "../db";

// ─── Plan data ───────────────────────────────────────────────
const PLANS = [
  { id: "paygo",    label: "Pay-As-You-Go",        color: "#6b7280", bg: "#f9fafb",  border: "#e5e7eb" },
  { id: "punch",    label: "Treatment Punch Card",  color: "#0c4a6e", bg: "#e0f2fe",  border: "#0ea5e9", badge: "Lowest 5-year cost", badgeBg: "#dcfce7", badgeColor: "#166534" },
  { id: "complete", label: "Complete Care+",         color: "#15803d", bg: "#dcfce7",  border: "#16a34a", badge: "Recommended",        badgeBg: "#dcfce7", badgeColor: "#166534" },
];

// Base 5-year costs (routine care only)
const BASE_COST   = { paygo: 1625, punch: 575, complete: 1250 };
// Per-scenario add-ons
const LD_COST     = 275;  // per device, one-time during warranty
const OOW_COST    = 250;  // per ear, out-of-warranty repair

// Features list per plan
const FEATURES = {
  paygo: [
    "$65 per office visit",
    "~5 visits/year estimated",
    "3-year manufacturer warranty",
    "L&D replacement: $275/device",
    "Years 4–5: no warranty coverage",
  ],
  punch: [
    "$575 one-time (28 prepaid visits)",
    "12 cleanings + 16 appointments",
    "3-year manufacturer warranty",
    "L&D replacement: $275/device",
    "Years 4–5: no warranty coverage",
  ],
  complete: [
    "$1,250 one-time",
    "Unlimited visits for 4 years",
    "4-year warranty (3 mfr + 1 practice)",
    "L&D replacement: $275/device",
    "Year 5 only: no warranty coverage",
  ],
};

// Decision guide
const DECISION_GUIDE = {
  paygo:    { who: "Minimal maintenance needs", best: "Patients who rarely visit", risk: "Costs add up quickly if issues arise" },
  punch:    { who: "Predictable visit schedule", best: "Patients who keep appointments", risk: "Runs out if extra visits needed" },
  complete: { who: "Peace of mind for 4 years", best: "Most patients — worry-free", risk: "Higher upfront, but lowest risk" },
};

// ─── Scenario logic ──────────────────────────────────────────
const SCENARIOS = [
  { id: "routine",  label: "Routine care only" },
  { id: "ld",       label: "L&D replacement ($275/device)" },
  { id: "oow",      label: "Out-of-warranty repair ($250/ear)" },
  { id: "both",     label: "Both add-ons" },
];

function fiveYearCost(planId, scenario, aidCount = 2) {
  let total = BASE_COST[planId];
  const includesLD  = scenario === "ld" || scenario === "both";
  const includesOOW = scenario === "oow" || scenario === "both";

  if (includesLD) {
    total += LD_COST * aidCount;
  }
  if (includesOOW) {
    // PAYG & Punch: risk window is yrs 4–5 (2 years of exposure)
    // CC+: risk window is yr 5 only (1 year of exposure)
    // We model one occurrence during the risk window
    total += OOW_COST * aidCount;
  }
  return total;
}

function scenarioNote(scenario) {
  if (scenario === "routine") return "Showing base care costs only — no device incidents over 5 years.";
  if (scenario === "ld")      return "Includes one loss & damage replacement ($275/device) during warranty period.";
  if (scenario === "oow")     return "Includes one out-of-warranty repair ($250/ear) after warranty expires.";
  return "Includes both L&D replacement and out-of-warranty repair costs.";
}

// ─── Component ───────────────────────────────────────────────
export default function CarePlanSelector({ patientId, currentPlan, patientName, coverageId, onPlanSaved }) {
  const [selected, setSelected]   = useState(currentPlan || null);
  const [scenario, setScenario]   = useState("routine");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState(null);

  const aidCount = 2; // bilateral default

  // ─── Save handler ────────────────────────────────────────
  async function handleConfirm() {
    if (!selected || !patientId) return;
    setSaving(true);
    setError(null);
    try {
      await updateInsuranceCoverage(patientId, { care_plan_type: selected }, coverageId);
      setSaved(true);
      onPlanSaved?.(selected);
    } catch (e) {
      setError(e.message || "Failed to save care plan");
    } finally {
      setSaving(false);
    }
  }

  // ─── Print handler ───────────────────────────────────────
  function handlePrint() {
    const planLabel = PLANS.find(p => p.id === selected)?.label || selected;
    const routineCost = fiveYearCost(selected, "routine", aidCount);
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const html = `<!DOCTYPE html>
<html><head><title>Patient Purchase Agreement</title>
<style>
  @page { size: letter; margin: 0.75in; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; max-width: 7in; margin: 0 auto; }
  h1 { font-size: 18pt; text-align: center; margin-bottom: 4pt; }
  h2 { font-size: 13pt; margin-top: 18pt; margin-bottom: 6pt; border-bottom: 1px solid #ccc; padding-bottom: 4pt; }
  .center { text-align: center; }
  .field { border-bottom: 1px solid #333; display: inline-block; min-width: 200px; padding: 2px 4px; font-weight: bold; }
  .sig-block { display: flex; justify-content: space-between; margin-top: 40pt; gap: 40px; }
  .sig-line { flex: 1; }
  .sig-line .line { border-bottom: 1px solid #333; height: 30pt; margin-bottom: 4pt; }
  .sig-line .label { font-size: 10pt; color: #666; }
  .cost-box { background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; padding: 12pt 16pt; margin: 12pt 0; }
  .cost-row { display: flex; justify-content: space-between; padding: 4pt 0; }
  .cost-total { font-size: 14pt; font-weight: bold; border-top: 2px solid #333; padding-top: 8pt; margin-top: 8pt; }
  .legal { font-size: 9pt; color: #666; line-height: 1.4; margin-top: 24pt; }
</style></head><body>
  <h1>My Hearing Centers</h1>
  <p class="center" style="font-size:10pt;color:#666;margin-top:0">Patient Purchase Agreement</p>

  <h2>Patient Information</h2>
  <p>Patient Name: <span class="field">${patientName || "________________________"}</span></p>
  <p>Date: <span class="field">${today}</span></p>

  <h2>Selected Care Plan</h2>
  <div class="cost-box">
    <div class="cost-row"><span>Care Plan</span><strong>${planLabel}</strong></div>
    <div class="cost-row"><span>5-Year Routine Care Cost</span><strong>$${routineCost.toLocaleString()}</strong></div>
  </div>

  <h2>Care Plan Details</h2>
  <ul>${FEATURES[selected]?.map(f => `<li>${f}</li>`).join("") || ""}</ul>

  <h2>Important Disclosures</h2>
  <p>Loss & Damage replacement is available during the warranty period at a cost of $275 per device. Out-of-warranty repairs are $250 per ear and apply after the warranty period ends.</p>
  <p>The ${planLabel} plan ${selected === "complete" ? "includes a 4-year warranty (3-year manufacturer warranty plus 1-year practice warranty)" : "includes a 3-year manufacturer warranty"}. After the warranty period, repair costs are the patient's responsibility.</p>

  <h2>Acknowledgment</h2>
  <p>I acknowledge that I have reviewed the care plan options presented to me and have selected the <strong>${planLabel}</strong> plan. I understand the costs, coverage, and limitations described above.</p>

  <div class="sig-block">
    <div class="sig-line"><div class="line"></div><div class="label">Patient Signature</div></div>
    <div class="sig-line"><div class="line"></div><div class="label">Date</div></div>
  </div>
  <div class="sig-block" style="margin-top:24pt">
    <div class="sig-line"><div class="line"></div><div class="label">Hearing Care Specialist</div></div>
    <div class="sig-line"><div class="line"></div><div class="label">Date</div></div>
  </div>

  <div class="legal">
    <p>This agreement is between the patient named above and My Hearing Centers. Care plan pricing is valid for 30 days from the date shown. The selected care plan will be applied to the patient's account upon signature. All sales are subject to My Hearing Centers' standard terms and conditions.</p>
  </div>
</body></html>`;

    const w = window.open("", "_blank", "width=800,height=1000");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  // ─── Render ──────────────────────────────────────────────
  const paygoCost = fiveYearCost("paygo", scenario, aidCount);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* ── Scenario Selector ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#9ca3af", marginBottom: 8 }}>
          Cost Scenario
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SCENARIOS.map(s => {
            const active = scenario === s.id;
            return (
              <button key={s.id}
                onClick={() => setScenario(s.id)}
                style={{
                  padding: "7px 14px", borderRadius: 20, border: active ? "2px solid #0a1628" : "1px solid #d1d5db",
                  background: active ? "#0a1628" : "white", color: active ? "white" : "#374151",
                  fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                  fontFamily: "'Sora', sans-serif", transition: "all 0.15s",
                }}>
                {s.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>
          {scenarioNote(scenario)}
        </div>
      </div>

      {/* ── Plan Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {PLANS.map(plan => {
          const cost = fiveYearCost(plan.id, scenario, aidCount);
          const isSelected = selected === plan.id;
          const savings = plan.id !== "paygo" ? paygoCost - cost : null;
          return (
            <div key={plan.id}
              onClick={() => { if (!saved) { setSelected(plan.id); setSaved(false); } }}
              style={{
                border: isSelected ? `2.5px solid ${plan.border}` : "2px solid #e5e7eb",
                borderRadius: 14, padding: "18px 16px", cursor: saved ? "default" : "pointer",
                background: isSelected ? plan.bg : "white",
                transition: "all 0.15s", position: "relative",
                display: "flex", flexDirection: "column",
                boxShadow: isSelected ? `0 0 0 1px ${plan.border}20, 0 4px 12px ${plan.border}15` : "none",
              }}>
              {/* Badge */}
              {plan.badge && (
                <div style={{
                  fontSize: 10, fontWeight: 700, color: plan.badgeColor, background: plan.badgeBg,
                  borderRadius: 6, padding: "2px 8px", display: "inline-block", marginBottom: 6,
                  letterSpacing: 0.3, alignSelf: "flex-start",
                }}>
                  {plan.badge}
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 700, color: plan.color, marginBottom: 6 }}>{plan.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0a1628", lineHeight: 1 }}>
                ${cost.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, marginBottom: 12 }}>5-year total</div>

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                {FEATURES[plan.id].map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 7, fontSize: 11, color: "#374151", lineHeight: 1.4 }}>
                    <span style={{ color: plan.color, flexShrink: 0 }}>&#10003;</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              {/* Savings vs PAYG */}
              {savings != null && savings > 0 && (
                <div style={{
                  marginTop: 10, fontSize: 11, fontWeight: 700, color: "#166534",
                  background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8,
                  padding: "5px 10px", textAlign: "center",
                }}>
                  Saves ${savings.toLocaleString()} vs Pay-As-You-Go
                </div>
              )}

              {/* Selected indicator */}
              {isSelected && (
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: plan.color, textAlign: "center" }}>
                  &#10003; Selected
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 5-Year Warranty Timeline ── */}
      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 }}>
          5-Year Warranty Timeline
        </div>
        {PLANS.map(plan => {
          const mfrYears = 3;
          const practiceYears = plan.id === "complete" ? 1 : 0;
          const totalWarranty = mfrYears + practiceYears;
          const riskYears = 5 - totalWarranty;
          const isActive = selected === plan.id;
          return (
            <div key={plan.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 140, fontSize: 11, fontWeight: isActive ? 700 : 500, color: isActive ? plan.color : "#6b7280", textAlign: "right", flexShrink: 0 }}>
                {plan.label}
              </div>
              <div style={{ flex: 1, display: "flex", height: 24, borderRadius: 6, overflow: "hidden", border: isActive ? `2px solid ${plan.border}` : "1px solid #e5e7eb" }}>
                {/* Manufacturer warranty */}
                <div style={{
                  width: `${(mfrYears / 5) * 100}%`, background: "#0d9488",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, color: "white", letterSpacing: 0.3,
                }}>
                  {mfrYears}yr Mfr
                </div>
                {/* Practice warranty (CC+ only) */}
                {practiceYears > 0 && (
                  <div style={{
                    width: `${(practiceYears / 5) * 100}%`, background: "#115e59",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "white", letterSpacing: 0.3,
                  }}>
                    +1yr Practice
                  </div>
                )}
                {/* Risk window */}
                {riskYears > 0 && (
                  <div style={{
                    width: `${(riskYears / 5) * 100}%`, background: "#fef3c7",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 600, color: "#92400e", letterSpacing: 0.3,
                  }}>
                    {riskYears}yr repair risk
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* Year labels */}
        <div style={{ display: "flex", marginLeft: 150, marginTop: 4 }}>
          {[1, 2, 3, 4, 5].map(yr => (
            <div key={yr} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "#9ca3af", fontWeight: 500 }}>
              Yr {yr}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginLeft: 150, marginTop: 8 }}>
          {[
            { color: "#0d9488", label: "Manufacturer warranty" },
            { color: "#115e59", label: "Practice warranty (CC+)" },
            { color: "#fef3c7", border: "#f59e0b", label: "Repair risk window" },
          ].map(item => (
            <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#6b7280" }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: item.color, border: item.border ? `1px solid ${item.border}` : "none", display: "inline-block" }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Decision Guide ── */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 }}>
          Which plan fits you?
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {PLANS.map(plan => {
            const guide = DECISION_GUIDE[plan.id];
            const isActive = selected === plan.id;
            return (
              <div key={plan.id} style={{
                borderRadius: 10, padding: "14px 12px",
                border: isActive ? `2px solid ${plan.border}` : "1px solid #f3f4f6",
                background: isActive ? plan.bg : "#fafafa",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: plan.color, marginBottom: 8 }}>{plan.label}</div>
                {[
                  { icon: "👤", label: "Best for", value: guide.who },
                  { icon: "✓",  label: "Ideal if", value: guide.best },
                  { icon: "⚠",  label: "Consider", value: guide.risk },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", letterSpacing: 0.5, marginBottom: 1 }}>
                      {row.icon} {row.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.4 }}>{row.value}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Confirm / Save / Print ── */}
      {selected && !saved && (
        <div style={{
          background: "linear-gradient(135deg, #0a1628, #1a3050)", borderRadius: 12,
          padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 16,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>
              {PLANS.find(p => p.id === selected)?.label}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              5-year routine cost: ${fiveYearCost(selected, "routine", aidCount).toLocaleString()}
            </div>
          </div>
          <button
            onClick={handleConfirm}
            disabled={saving}
            style={{
              background: "#16a34a", color: "white", border: "none", borderRadius: 10,
              padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer",
              fontFamily: "'Sora', sans-serif", opacity: saving ? 0.7 : 1, transition: "opacity 0.15s",
            }}>
            {saving ? "Saving..." : "Confirm Plan"}
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#991b1b" }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{
          background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12,
          padding: "16px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#166534" }}>
              &#10003; {PLANS.find(p => p.id === selected)?.label} saved
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              Care plan updated for {patientName || "patient"}
            </div>
          </div>
          <button
            onClick={handlePrint}
            style={{
              background: "#0a1628", color: "white", border: "none", borderRadius: 10,
              padding: "12px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Sora', sans-serif", display: "flex", alignItems: "center", gap: 8,
            }}>
            🖨 Print for Signature
          </button>
        </div>
      )}
    </div>
  );
}
