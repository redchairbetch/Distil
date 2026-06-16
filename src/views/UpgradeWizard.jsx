import React, { useState, useMemo } from "react";
import { createVisit, updateVisit, saveUpgradeAssessment } from "../db.js";
import {
  scoreReadiness,
  computePerformanceTier,
  STRUGGLE_ENVIRONMENTS,
  FEATURE_GAPS,
  PERFORMANCE_TAGS,
  BAND_LABELS,
} from "../upgradeReadiness.js";

// Established-patient visit flow (backlog #23). Parallel to the new-patient
// 8-step wizard — opens from "Start a New Visit" on a patient who already has a
// fitting on file. Flow: pick a visit type → confirm-don't-retype the stable
// fields → assess current-aid performance → upgrade-readiness questionnaire →
// summary (readiness band + performance tier recorded to the visit). The
// reprogram-vs-upgrade decision aid + anchored hearing-journey infographic land
// in PR3 and slot in before Summary.

const VISIT_TYPES = [
  { key: "annual_check",    label: "Annual Check",         icon: "🗓", blurb: "Routine yearly hearing review and device check." },
  { key: "upgrade_consult", label: "Upgrade Conversation", icon: "⬆",  blurb: "Reprogram vs. upgrade to newer technology." },
  { key: "device_eval",     label: "Device Evaluation",    icon: "🔬", blurb: "Assess current device performance and fit." },
  { key: "fit_follow_up",   label: "Fit Follow-up",        icon: "🔧", blurb: "Post-fitting adjustment and acclimatization." },
];

const STEPS = ["Visit Type", "Confirm Details", "Current Aids", "Upgrade Readiness", "Summary"];
const TIERS = ["Excellent", "Adequate", "Marginal", "Failing"];
const TIER_COLORS = { Excellent: "#059669", Adequate: "#0f766e", Marginal: "#b45309", Failing: "#dc2626" };
const BAND_COLORS = { 1: "#6b7280", 2: "#0f766e", 3: "#0d9488", 4: "#b45309", 5: "#dc2626" };

function parseDateOnly(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
}
function yearsSince(dateStr) {
  const d = parseDateOnly(dateStr);
  if (!d || Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}
function fmtDate(s) {
  const d = parseDateOnly(s);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function UpgradeWizard({ patient, clinicId, staffId, onExit, onCompleted }) {
  const [step, setStep] = useState(0);
  const [visitType, setVisitType] = useState("");
  const [visitId, setVisitId] = useState(null);
  const [changeNotes, setChangeNotes] = useState("");

  // Current-aid performance inputs
  const [aidedWrsRight, setAidedWrsRight] = useState("");
  const [aidedWrsLeft, setAidedWrsLeft] = useState("");
  const [perfTags, setPerfTags] = useState([]);
  const [tierOverride, setTierOverride] = useState(null); // null → use computed

  // Readiness questionnaire inputs
  const [satisfaction, setSatisfaction] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const [featureGaps, setFeatureGaps] = useState([]);
  const [benefitRefreshed, setBenefitRefreshed] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const fittingDate = patient?.devices?.fittingDate || patient?.carePlanStartDate || null;
  const years = yearsSince(fittingDate);
  const typeMeta = VISIT_TYPES.find((v) => v.key === visitType);

  const computedTier = useMemo(
    () => computePerformanceTier({ aidedWrsRight, aidedWrsLeft, tags: perfTags }),
    [aidedWrsRight, aidedWrsLeft, perfTags]
  );
  const effectiveTier = tierOverride || computedTier;

  const readiness = useMemo(
    () => scoreReadiness({ satisfaction, environments, featureGaps, benefitRefreshed, performanceTier: effectiveTier, yearsSinceFit: years }),
    [satisfaction, environments, featureGaps, benefitRefreshed, effectiveTier, years]
  );

  const toggle = (arr, setArr, key) =>
    setArr(arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);

  const startVisit = async () => {
    if (!visitType) return;
    setBusy(true); setError(null);
    const vid = await createVisit(patient.id, { clinicId, staffId, visitType });
    setBusy(false);
    if (!vid) { setError("Couldn't open the visit. Please try again."); return; }
    setVisitId(vid);
    setStep(1);
  };

  const finishVisit = async () => {
    setBusy(true); setError(null);
    try {
      await saveUpgradeAssessment(visitId, patient.id, clinicId, {
        responses: { satisfaction, environments, featureGaps, benefitRefreshed, aidedWrsRight, aidedWrsLeft, changeNotes, yearsSinceFit: years },
        readinessScore: readiness.score,
        readinessBand: readiness.band,
        performanceTier: effectiveTier,
        performanceTags: perfTags,
      });
      await updateVisit(visitId, { notes: changeNotes || null, status: "completed" });
      onCompleted?.();
    } catch (e) {
      console.error("finish upgrade visit:", e);
      setError(e?.message || "Couldn't save the visit.");
      setBusy(false);
    }
  };

  const payLabel = patient?.payType === "private"
    ? "Private pay"
    : (patient?.insurance?.carrier
        ? `${patient.insurance.carrier}${patient.insurance.planGroup ? " · " + patient.insurance.planGroup : ""}`
        : "Insurance");

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Upgrade Visit</div>
          <div className="topbar-sub">{patient?.name} · Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>
        </div>
        <button className="btn-ghost" onClick={onExit}>Cancel</button>
      </div>

      <div className="content">
        <div className="wizard-wrap">
          <div className="wizard-steps">
            {STEPS.map((s, i) => (
              <div key={s} className={`wizard-step ${i < step ? "done" : ""}`}>
                <div className={`step-dot ${i === step ? "active" : i < step ? "done" : ""}`}>{i < step ? "✓" : i + 1}</div>
                <div className={`step-name ${i === step ? "active" : ""}`}>{s}</div>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 12, fontSize: 13, color: "#dc2626" }}>{error}</div>
          )}

          {step === 0 && (
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>What kind of visit?</h2>
              <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 14 }}>
                {patient?.name} was last fit {years != null ? `${years.toFixed(1)} years ago` : "—"}
                {fittingDate ? ` (${fmtDate(fittingDate)})` : ""}.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {VISIT_TYPES.map((v) => {
                  const active = v.key === visitType;
                  return (
                    <button key={v.key} onClick={() => setVisitType(v.key)} style={{
                      textAlign: "left", padding: 16, borderRadius: 12, cursor: "pointer",
                      border: active ? "2px solid #0f766e" : "1px solid #e5e7eb",
                      background: active ? "#f0fdfa" : "white",
                    }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{v.icon}</div>
                      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 15, color: "#111827" }}>{v.label}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{v.blurb}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>Is this still correct?</h2>
              <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 14 }}>
                Confirm the details on file. Edit anything that's changed in the patient profile; note what's new below.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", marginBottom: 20 }}>
                <Field label="Name" value={patient?.name} />
                <Field label="Date of birth" value={fmtDate(patient?.dob)} />
                <Field label="Phone" value={patient?.phone} />
                <Field label="Email" value={patient?.email} />
                <Field label="Address" value={patient?.address} wide />
                <Field label="Payment" value={payLabel} wide />
              </div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>What's changed since last visit?</label>
              <textarea value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)} rows={4}
                placeholder="New medications, lifestyle changes, hearing concerns, insurance updates…"
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "inherit", fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>
          )}

          {step === 2 && (
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>Current-aid performance</h2>
              <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 14 }}>
                How are the current aids actually performing? Enter aided word recognition and flag any real-world issues.
              </p>
              <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
                <WrsInput label="Aided WRS — Right" value={aidedWrsRight} onChange={setAidedWrsRight} />
                <WrsInput label="Aided WRS — Left" value={aidedWrsLeft} onChange={setAidedWrsLeft} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Real-world issues</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PERFORMANCE_TAGS.map((t) => (
                    <Chip key={t.key} active={perfTags.includes(t.key)} onClick={() => toggle(perfTags, setPerfTags, t.key)}>
                      {t.severe ? "⚠ " : ""}{t.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Performance tier {computedTier && <span style={{ fontWeight: 400, color: "#9ca3af" }}>· suggested: {computedTier}</span>}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {TIERS.map((t) => {
                    const active = effectiveTier === t;
                    return (
                      <button key={t} onClick={() => setTierOverride(t)} style={{
                        padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: active ? 700 : 500,
                        border: active ? `2px solid ${TIER_COLORS[t]}` : "1px solid #e5e7eb",
                        background: active ? TIER_COLORS[t] : "white",
                        color: active ? "white" : "#374151",
                      }}>{t}</button>
                    );
                  })}
                </div>
                {tierOverride && (
                  <button onClick={() => setTierOverride(null)} style={{ marginTop: 8, fontSize: 12, color: "#0f766e", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    ↺ Reset to suggested
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>Upgrade readiness</h2>
              <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 14 }}>
                The patient's own read. Balanced against the objective performance to land a realistic band.
              </p>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Satisfaction with current aids (1–10)
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                    const active = satisfaction === n;
                    return (
                      <button key={n} onClick={() => setSatisfaction(n)} style={{
                        width: 36, height: 36, borderRadius: 8, fontSize: 14, cursor: "pointer", fontWeight: active ? 700 : 500,
                        border: active ? "2px solid #0f766e" : "1px solid #e5e7eb",
                        background: active ? "#0f766e" : "white", color: active ? "white" : "#374151",
                      }}>{n}</button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  New struggle environments <span style={{ fontWeight: 400, color: "#9ca3af" }}>(weren't an issue at fit)</span>
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {STRUGGLE_ENVIRONMENTS.map((e) => (
                    <Chip key={e.key} active={environments.includes(e.key)} onClick={() => toggle(environments, setEnvironments, e.key)}>{e.label}</Chip>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Feature gaps they'd value <span style={{ fontWeight: 400, color: "#9ca3af" }}>(want, current aids lack)</span>
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {FEATURE_GAPS.map((f) => (
                    <Chip key={f.key} active={featureGaps.includes(f.key)} onClick={() => toggle(featureGaps, setFeatureGaps, f.key)}>{f.label}</Chip>
                  ))}
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: "#374151" }}>
                <input type="checkbox" checked={benefitRefreshed} onChange={(e) => setBenefitRefreshed(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#0f766e" }} />
                Insurance hearing benefit available / refreshed now
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ margin: "0 0 16px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>Visit summary</h2>

              <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px", background: "#f8fafc", borderRadius: 12, padding: 16, borderLeft: `4px solid ${BAND_COLORS[readiness.band]}` }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af" }}>Upgrade readiness</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: BAND_COLORS[readiness.band] }}>
                    {readiness.band} · {BAND_LABELS[readiness.band]}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{readiness.score} / 14 points</div>
                </div>
                <div style={{ flex: "1 1 200px", background: "#f8fafc", borderRadius: 12, padding: 16, borderLeft: `4px solid ${effectiveTier ? TIER_COLORS[effectiveTier] : "#cbd5e1"}` }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af" }}>Current-aid performance</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: effectiveTier ? TIER_COLORS[effectiveTier] : "#9ca3af" }}>
                    {effectiveTier || "Not assessed"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{typeMeta?.label} · {years != null ? `${years.toFixed(1)} yr since fit` : "—"}</div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Score breakdown</div>
                {readiness.breakdown.map((d) => (
                  <div key={d.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid #f8fafc" }}>
                    <span style={{ color: "#6b7280" }}>{d.label} <em style={{ color: "#cbd5e1", fontStyle: "normal" }}>· {d.block}</em></span>
                    <span style={{ fontWeight: 600, color: d.points ? "#111827" : "#cbd5e1" }}>+{d.points}</span>
                  </div>
                ))}
              </div>

              {changeNotes && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Changes noted</div>
                  <div style={{ fontSize: 14, color: "#111827", whiteSpace: "pre-wrap" }}>{changeNotes}</div>
                </div>
              )}

              <div style={{ background: "#f0fdfa", border: "1px dashed #5eead4", borderRadius: 10, padding: 16, fontSize: 13, color: "#0f766e" }}>
                <strong>Coming next:</strong> the reprogram-vs-upgrade decision aid (audiogram delta vs. baseline) and the hearing-journey infographic anchored on {patient?.name?.split(" ")[0] || "the patient"}'s timeline — both keyed off this readiness band and performance tier.
              </div>
            </div>
          )}

          <div className="wizard-nav">
            <button className="btn-ghost" onClick={() => { if (step === 0) onExit?.(); else setStep((s) => s - 1); }}>
              {step === 0 ? "Cancel" : "← Back"}
            </button>
            {step === 0 && (
              <button className="btn-primary" disabled={!visitType || busy} style={{ opacity: (!visitType || busy) ? 0.4 : 1 }} onClick={startVisit}>
                {busy ? "Opening…" : "Continue →"}
              </button>
            )}
            {(step === 1 || step === 2 || step === 3) && (
              <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>Continue →</button>
            )}
            {step === 4 && (
              <button className="btn-primary green" disabled={busy} onClick={finishVisit}>
                {busy ? "Saving…" : "✓ Save Visit"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, wide }) {
  return (
    <div style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#111827" }}>{value || "—"}</div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer",
      border: active ? "2px solid #0f766e" : "1px solid #e5e7eb",
      background: active ? "#f0fdfa" : "white",
      color: active ? "#0f766e" : "#374151", fontWeight: active ? 600 : 400,
    }}>{children}</button>
  );
}

function WrsInput({ label, value, onChange }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" min={0} max={100} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          style={{ width: 80, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, fontFamily: "inherit" }} />
        <span style={{ fontSize: 14, color: "#9ca3af" }}>%</span>
      </div>
    </div>
  );
}
