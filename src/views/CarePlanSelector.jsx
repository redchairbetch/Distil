import { useState, useRef } from "react";
import { updateInsuranceCoverage } from "../db";

// ── PLAN DATA ────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "paygo",
    label: "Pay-As-You-Go",
    color: "#6b7280",
    bg: "#f9fafb",
    border: "#e5e7eb",
    base5yr: 1625,
    visitDesc: "$65/visit, ~5/yr",
    warranty: "3-yr manufacturer",
    repairWindow: [4, 5],       // years where out-of-warranty repair risk exists
    practiceWarranty: 0,
    features: [
      "Pay per visit ($65 each)",
      "~5 visits/year recommended",
      "3-year manufacturer warranty",
      "No upfront commitment",
    ],
    persona: "I only come in when something feels off",
    personaDesc: "Best if you prefer minimal visits and want to pay only when needed. No upfront cost, but higher long-term spend if you visit regularly.",
  },
  {
    id: "punch",
    label: "Punch Card",
    color: "#0c4a6e",
    bg: "#e0f2fe",
    border: "#7dd3fc",
    base5yr: 575,
    visitDesc: "Flat fee, defined schedule",
    warranty: "3-yr manufacturer",
    repairWindow: [4, 5],
    practiceWarranty: 0,
    badge: { text: "Lowest cost", color: "#16a34a", bg: "#dcfce7" },
    features: [
      "12 cleanings + 16 appointments",
      "Flat fee — no per-visit charges",
      "3-year manufacturer warranty",
      "Structured visit schedule",
    ],
    persona: "I want a plan and I'll stick to it",
    personaDesc: "Best if you'll follow a set visit schedule. Lowest 5-year cost with predictable spending. 28 total visits included.",
  },
  {
    id: "complete",
    label: "Complete Care+",
    color: "#15803d",
    bg: "#dcfce7",
    border: "#86efac",
    base5yr: 1250,
    visitDesc: "Flat fee, unlimited visits",
    warranty: "4-yr (3 mfr + 1 practice)",
    repairWindow: [5],          // only year 5 is a risk window
    practiceWarranty: 1,
    badge: { text: "Most comprehensive", color: "#15803d", bg: "#dcfce7" },
    features: [
      "Unlimited office visits",
      "4-year warranty (3 mfr + 1 practice)",
      "Only 1 year of repair risk vs 2",
      "Best long-term protection",
    ],
    persona: "I want full coverage and peace of mind",
    personaDesc: "Best if you want unlimited visits and maximum warranty protection. Extra year of practice warranty means only 1 year of out-of-warranty risk.",
  },
];

const SCENARIOS = [
  { id: "routine", label: "Routine care only" },
  { id: "ld",      label: "+ L&D replacement" },
  { id: "repair",  label: "+ Out-of-warranty repair" },
  { id: "both",    label: "+ Both" },
];

const LD_COST_PER_DEVICE = 275;
const REPAIR_COST_PER_EAR = 250;
const DEVICE_COUNT = 2; // bilateral default

function calcTotal(plan, scenario) {
  let total = plan.base5yr;
  if (scenario === "ld" || scenario === "both") {
    total += LD_COST_PER_DEVICE * DEVICE_COUNT;
  }
  if (scenario === "repair" || scenario === "both") {
    total += REPAIR_COST_PER_EAR * DEVICE_COUNT * plan.repairWindow.length;
  }
  return total;
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  section: { background: "white", borderRadius: 14, border: "1px solid #e5e7eb", padding: 28, marginBottom: 0 },
  title: { fontSize: 18, fontWeight: 700, color: "#0a1628", marginBottom: 4 },
  subtitle: { fontSize: 12, color: "#9ca3af", marginBottom: 20 },
  pillBar: { display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" },
  pill: (active) => ({
    padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: active ? "2px solid #0a1628" : "2px solid #e5e7eb",
    background: active ? "#0a1628" : "white",
    color: active ? "white" : "#6b7280",
    transition: "all 0.15s", userSelect: "none",
  }),
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 },
  card: (plan, selected) => ({
    border: `2px solid ${selected ? plan.color : plan.border}`,
    borderRadius: 14, padding: "18px 16px", cursor: "pointer",
    background: selected ? plan.bg : "white",
    transition: "all 0.15s", position: "relative",
    display: "flex", flexDirection: "column",
    boxShadow: selected ? `0 0 0 1px ${plan.color}` : "none",
  }),
  badgeTag: (badge) => ({
    fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg,
    borderRadius: 6, padding: "2px 8px", display: "inline-block", marginBottom: 6,
    letterSpacing: 0.3, alignSelf: "flex-start",
  }),
  planLabel: (plan) => ({ fontSize: 12, fontWeight: 700, color: plan.color, marginBottom: 6, lineHeight: 1.3 }),
  planTotal: { fontSize: 28, fontWeight: 800, color: "#0a1628", lineHeight: 1 },
  planSub: { fontSize: 11, color: "#9ca3af", marginTop: 3 },
  featureList: { marginTop: 12, display: "flex", flexDirection: "column", gap: 5 },
  featureItem: { fontSize: 12, color: "#374151", display: "flex", gap: 8, alignItems: "flex-start" },
  savings: { marginTop: 10, fontSize: 11, fontWeight: 700, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "3px 8px", display: "inline-block", alignSelf: "flex-start" },
  selected: (plan) => ({ marginTop: 10, fontSize: 12, fontWeight: 700, color: plan.color }),
  infoNote: { background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 24 },
  // Timeline
  tlSection: { marginBottom: 24 },
  tlTitle: { fontSize: 13, fontWeight: 700, color: "#0a1628", marginBottom: 12 },
  tlRow: { display: "flex", alignItems: "center", marginBottom: 8, gap: 12 },
  tlLabel: { width: 120, fontSize: 11, fontWeight: 600, color: "#374151", flexShrink: 0 },
  tlBar: { flex: 1, height: 20, borderRadius: 6, display: "flex", overflow: "hidden", background: "#f3f4f6" },
  tlSeg: (color, pct) => ({ width: `${pct}%`, background: color, height: "100%", transition: "width 0.3s" }),
  tlYears: { display: "flex", flex: 1, marginLeft: 132 },
  tlYear: { flex: 1, textAlign: "center", fontSize: 10, color: "#9ca3af", fontWeight: 600 },
  legend: { display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 },
  legendItem: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" },
  legendDot: (color) => ({ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }),
  // Decision guide
  guideSection: { marginBottom: 24 },
  guideTitle: { fontSize: 13, fontWeight: 700, color: "#0a1628", marginBottom: 12 },
  guideGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 },
  guideCard: (plan) => ({
    background: plan.bg, border: `1px solid ${plan.border}`, borderRadius: 12, padding: "16px 14px",
  }),
  guideQuote: (plan) => ({ fontSize: 13, fontWeight: 700, color: plan.color, marginBottom: 8, fontStyle: "italic" }),
  guideDesc: { fontSize: 12, color: "#374151", lineHeight: 1.5 },
  // Confirm bar
  confirmBar: { display: "flex", gap: 10, alignItems: "center", marginTop: 16, padding: "16px 0", borderTop: "1px solid #e5e7eb" },
  btnConfirm: (saving) => ({
    background: "#16a34a", color: "white", border: "none", borderRadius: 8,
    padding: "10px 24px", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13,
    cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, transition: "all 0.15s",
  }),
  btnCancel: {
    background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
    padding: "10px 18px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13,
    cursor: "pointer", color: "#6b7280",
  },
  btnPrint: {
    background: "#0a1628", color: "white", border: "none", borderRadius: 8,
    padding: "10px 24px", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13,
    cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
  },
  toast: { fontSize: 13, fontWeight: 600, color: "#16a34a" },
  error: { fontSize: 12, color: "#ef4444" },
  currentBadge: {
    fontSize: 10, fontWeight: 700, color: "#0a1628", background: "#f3f4f6",
    borderRadius: 6, padding: "2px 8px", letterSpacing: 0.3,
  },
};

// ── SCENARIO INFO NOTES ──────────────────────────────────────────────────────
const SCENARIO_NOTES = {
  routine: "Showing routine care costs only — regular visits over 5 years. No device replacements or repairs included.",
  ld: `Includes one loss & damage replacement at $${LD_COST_PER_DEVICE}/device (${DEVICE_COUNT} devices). This is a one-time cost during the warranty period.`,
  repair: `Includes out-of-warranty repair costs at $${REPAIR_COST_PER_EAR}/ear. PAYG and Punch Card have a 2-year risk window (yrs 4–5); Complete Care+ has only 1 year (yr 5) due to extended practice warranty.`,
  both: "Includes both L&D replacement and out-of-warranty repair costs. Complete Care+ shows the lowest additional risk due to its extended warranty coverage.",
};

// ── COMPONENT ────────────────────────────────────────────────────────────────
export default function CarePlanSelector({ patientId, currentPlan, patientName, onPlanSaved, coverageId }) {
  const [selectedPlan, setSelectedPlan] = useState(currentPlan || null);
  const [scenario, setScenario] = useState("routine");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const printRef = useRef(null);

  const paygoTotal = calcTotal(PLANS[0], scenario);

  const handleSelect = (planId) => {
    if (saved) return; // don't allow changes after save until parent refreshes
    setSelectedPlan(planId);
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
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=800,height=1000");
    const plan = PLANS.find(p => p.id === selectedPlan);
    const routineTotal = calcTotal(plan, "routine");
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

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
    <p><strong>Patient:</strong> ${patientName || "—"}</p>
    <p><strong>Date:</strong> ${today}</p>
  </div>

  <div class="plan-box">
    <div class="plan-name">${plan?.label || "—"}</div>
    <div class="plan-cost">$${routineTotal.toLocaleString()}</div>
    <div class="plan-note">Estimated 5-year cost · Routine care</div>
  </div>

  <div class="section">
    <h2>What's Included</h2>
    ${(plan?.features || []).map(f => `<p>&#10003; ${f}</p>`).join("")}
  </div>

  <div class="section">
    <h2>Additional Costs (if applicable)</h2>
    <p>&#8226; Loss & Damage replacement: $${LD_COST_PER_DEVICE}/device (one-time, during warranty period)</p>
    <p>&#8226; Out-of-warranty repair: $${REPAIR_COST_PER_EAR}/ear (applies ${plan?.id === "complete" ? "year 5 only" : "years 4–5"})</p>
  </div>

  <div class="section">
    <h2>Terms</h2>
    <p>This agreement confirms the patient's selection of the above care plan for their hearing instruments. The care plan fee is due at time of fitting. The plan covers the services described above for the duration of the hearing instrument warranty period plus any extended coverage noted.</p>
    <p>Care plan benefits are non-transferable and apply only to the hearing instruments fitted at this appointment. Benefits expire at the end of the coverage period regardless of usage.</p>
  </div>

  <div class="sig-block">
    <div>
      <div class="sig-line">Patient Signature</div>
    </div>
    <div>
      <div class="sig-line">Date</div>
    </div>
    <div>
      <div class="sig-line">Hearing Care Specialist</div>
    </div>
    <div>
      <div class="sig-line">Date</div>
    </div>
  </div>

  <div class="footer">
    My Hearing Centers &middot; A WSAudiology Company &middot; This document is confidential and intended for the named patient only.
  </div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const planChanged = selectedPlan && selectedPlan !== currentPlan;
  const showConfirm = planChanged && !saved;
  const showPrint = saved;

  return (
    <div style={S.section}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <div style={S.title}>Care Plan Comparison</div>
          <div style={S.subtitle}>Compare 5-year costs across all care plans</div>
        </div>
        {currentPlan && (
          <div style={S.currentBadge}>
            Current: {PLANS.find(p => p.id === currentPlan)?.label || currentPlan}
          </div>
        )}
      </div>

      {/* ── SCENARIO PILLS ─────────────────────────────────────────── */}
      <div style={S.pillBar}>
        {SCENARIOS.map(s => (
          <div key={s.id} style={S.pill(scenario === s.id)} onClick={() => setScenario(s.id)}>
            {s.label}
          </div>
        ))}
      </div>

      {/* ── PLAN CARDS ─────────────────────────────────────────────── */}
      <div style={S.grid}>
        {PLANS.map(plan => {
          const total = calcTotal(plan, scenario);
          const isSelected = selectedPlan === plan.id;
          const savingsAmt = paygoTotal - total;
          return (
            <div key={plan.id} style={S.card(plan, isSelected)} onClick={() => handleSelect(plan.id)}>
              {plan.badge && <div style={S.badgeTag(plan.badge)}>{plan.badge.text}</div>}
              <div style={S.planLabel(plan)}>{plan.label}</div>
              <div style={S.planTotal}>${total.toLocaleString()}</div>
              <div style={S.planSub}>5-year estimated total</div>
              <div style={S.featureList}>
                {plan.features.map((f, i) => (
                  <div key={i} style={S.featureItem}>
                    <span style={{ color: plan.color, flexShrink: 0 }}>&#10003;</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              {plan.id !== "paygo" && savingsAmt > 0 && (
                <div style={S.savings}>Saves ${savingsAmt.toLocaleString()} vs Pay-As-You-Go</div>
              )}
              {isSelected && <div style={S.selected(plan)}>&#10003; Selected</div>}
            </div>
          );
        })}
      </div>

      {/* ── SCENARIO INFO NOTE ─────────────────────────────────────── */}
      <div style={S.infoNote}>
        {SCENARIO_NOTES[scenario]}
      </div>

      {/* ── WARRANTY TIMELINE ──────────────────────────────────────── */}
      <div style={S.tlSection}>
        <div style={S.tlTitle}>5-Year Warranty Timeline</div>
        {/* Year labels */}
        <div style={{ ...S.tlYears, marginBottom: 4 }}>
          {[1, 2, 3, 4, 5].map(yr => (
            <div key={yr} style={S.tlYear}>Year {yr}</div>
          ))}
        </div>
        {PLANS.map(plan => (
          <div key={plan.id} style={S.tlRow}>
            <div style={S.tlLabel}>{plan.label}</div>
            <div style={S.tlBar}>
              {/* Manufacturer warranty: 3 years = 60% */}
              <div style={S.tlSeg("#0d9488", 60)} title="Manufacturer warranty (3 years)" />
              {/* Practice warranty for CC+: 1 year = 20% */}
              {plan.practiceWarranty > 0 && (
                <div style={S.tlSeg("#115e59", 20)} title="Practice warranty (1 year)" />
              )}
              {/* Repair risk window */}
              {plan.repairWindow.length === 2 && plan.practiceWarranty === 0 && (
                <div style={S.tlSeg("#f59e0b", 40)} title="Repair risk window (2 years)" />
              )}
              {plan.repairWindow.length === 1 && plan.practiceWarranty > 0 && (
                <div style={S.tlSeg("#f59e0b", 20)} title="Repair risk window (1 year)" />
              )}
              {/* Remaining safe zone for non-risk plans (shouldn't happen, but safety) */}
            </div>
          </div>
        ))}
        {/* Legend */}
        <div style={{ ...S.legend, marginLeft: 132 }}>
          {[
            { color: "#0d9488", label: "Manufacturer warranty" },
            { color: "#115e59", label: "Practice warranty (CC+ only)" },
            { color: "#f59e0b", label: "Out-of-warranty risk" },
          ].map(item => (
            <div key={item.label} style={S.legendItem}>
              <div style={S.legendDot(item.color)} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── DECISION GUIDE ─────────────────────────────────────────── */}
      <div style={S.guideSection}>
        <div style={S.guideTitle}>Which plan fits you?</div>
        <div style={S.guideGrid}>
          {PLANS.map(plan => (
            <div key={plan.id} style={S.guideCard(plan)}>
              <div style={S.guideQuote(plan)}>"{plan.persona}"</div>
              <div style={S.guideDesc}>{plan.personaDesc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONFIRM / PRINT BAR ────────────────────────────────────── */}
      {(showConfirm || showPrint || error) && (
        <div style={S.confirmBar}>
          {showConfirm && (
            <>
              <button style={S.btnConfirm(saving)} onClick={handleConfirm} disabled={saving}>
                {saving ? "Saving…" : `Confirm ${PLANS.find(p => p.id === selectedPlan)?.label}`}
              </button>
              <button style={S.btnCancel} onClick={() => { setSelectedPlan(currentPlan || null); setError(null); }}>
                Cancel
              </button>
            </>
          )}
          {showPrint && (
            <>
              <span style={S.toast}>&#10003; Plan saved successfully</span>
              <button style={S.btnPrint} onClick={handlePrint}>
                <span>&#128424;</span> Print for signature
              </button>
            </>
          )}
          {error && <span style={S.error}>{error}</span>}
        </div>
      )}

      {/* Hidden ref for print (not used directly, but kept for future inline print) */}
      <div ref={printRef} style={{ display: "none" }} />
    </div>
  );
}
