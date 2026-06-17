import React, { useState, useMemo, useEffect } from "react";
import {
  createVisit, updateVisit, saveUpgradeAssessment,
  updatePatientAudiology, loadBaselineAudiology, loadVisitAudiology,
} from "../db.js";
import {
  scoreReadiness,
  computePerformanceTier,
  STRUGGLE_ENVIRONMENTS,
  FEATURE_GAPS,
  PERFORMANCE_TAGS,
  BAND_LABELS,
} from "../upgradeReadiness.js";
import { computeAudiometricDelta, decideReprogramVsUpgrade } from "../reprogramVsUpgradeEngine.js";
import AudiogramEntry from "../components/AudiogramEntry.jsx";
import CareJourney from "./CareJourney.jsx";

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

const STEPS = ["Visit Type", "Confirm Details", "Audiogram", "Current Aids", "Upgrade Readiness", "Summary"];
const TIERS = ["Excellent", "Adequate", "Marginal", "Failing"];
const TIER_COLORS = { Excellent: "#059669", Adequate: "#0f766e", Marginal: "#b45309", Failing: "#dc2626" };
const BAND_COLORS = { 1: "#6b7280", 2: "#0f766e", 3: "#0d9488", 4: "#b45309", 5: "#dc2626" };

// Current-aid performance tier → an ability point (0–1) for the CareJourney
// "you are here" overlay. Worse tiers sit further below the ideal care curve.
const TIER_ABILITY = { Excellent: 0.85, Adequate: 0.70, Marginal: 0.50, Failing: 0.32 };

// Decision verdict display (reprogram-vs-upgrade engine output).
const DECISION_META = {
  upgrade:           { label: "Upgrade recommended",       color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  reprogram:         { label: "Reprogram current devices", color: "#0f766e", bg: "#f0fdfa", border: "#5eead4" },
  provider_judgment: { label: "Provider judgment",         color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
};

// Blank audiology in the camelCase shape AudiogramEntry / updatePatientAudiology
// expect. The upgrade visit captures a fresh test (the prior one overlays as a
// greyscale ghost) rather than pre-filling, so an unchanged grid never reads as
// a false "no change".
function makeEmptyAudiology() {
  return {
    rightT: {}, leftT: {}, rightBC: {}, leftBC: {},
    rightMask: {}, leftMask: {}, rightBCMask: {}, leftBCMask: {},
    tinnitusRight: false, tinnitusLeft: false,
    unaidedR: null, unaidedL: null, aidedR: null, aidedL: null,
    wrMclR: null, wrMclL: null, sinBin: null,
    cctR: null, cctL: null, cctLevelR: null, cctLevelL: null,
  };
}

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

  // Current audiogram captured this visit (starts blank; the prior test overlays
  // in greyscale via AudiogramEntry's ghost prop).
  const [audiology, setAudiology] = useState(makeEmptyAudiology);

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

  // Reprogram-vs-upgrade decision — computed on the Summary step from the baseline
  // audiogram vs. this visit's, plus the perf tier + readiness band.
  const [decisionState, setDecisionState] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [rationaleDraft, setRationaleDraft] = useState("");
  const [rationaleEdited, setRationaleEdited] = useState(false);

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

  // CareJourney inputs: timeline position from years-since-fit, ability overlay
  // from the perf tier, warranty span from the fitting/warranty dates (CC+ 4-yr default).
  const journeyPosition = years != null ? Math.max(0, Math.min(1, years / 5)) : 0;
  const currentAbility = effectiveTier ? TIER_ABILITY[effectiveTier] : null;
  const warrantyYears = useMemo(() => {
    const fit = parseDateOnly(fittingDate);
    const exp = parseDateOnly(patient?.devices?.warrantyExpiry);
    if (fit && exp && !Number.isNaN(fit.getTime()) && !Number.isNaN(exp.getTime())) {
      const yrs = (exp.getTime() - fit.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (yrs > 0) return Math.round(yrs);
    }
    return 4;
  }, [fittingDate, patient?.devices?.warrantyExpiry]);

  // Compute the decision once the provider reaches the Summary step (index 5),
  // re-running if they step back and change the perf tier or readiness inputs.
  useEffect(() => {
    if (step !== 5 || !visitId) return;
    let cancelled = false;
    setDecisionState(null); // clear any prior verdict so a re-fetch never shows a stale one
    (async () => {
      setDecisionLoading(true);
      try {
        const [baseline, current] = await Promise.all([
          loadBaselineAudiology(patient.id),
          loadVisitAudiology(visitId),
        ]);
        if (cancelled) return;
        // If the oldest audiogram on file IS the one we just saved this visit, there's
        // no true prior to diff against — treat the baseline as absent.
        const realBaseline = (baseline && current && baseline.id === current.id) ? null : baseline;
        const delta = computeAudiometricDelta(realBaseline, current);
        const result = decideReprogramVsUpgrade(delta, effectiveTier, readiness.band);
        setDecisionState({ ...result, delta, hasBaseline: !!realBaseline, hasCurrent: !!current });
        setRationaleDraft((prev) => (rationaleEdited ? prev : result.rationale));
      } finally {
        if (!cancelled) setDecisionLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visitId, effectiveTier, readiness.band]);

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

  const saveAudiogramAndNext = async () => {
    setBusy(true); setError(null);
    try {
      // Visit-scoped save — prior visits' audiograms survive (longitudinal history).
      await updatePatientAudiology(patient.id, audiology, staffId, visitId);
      setStep(3);
    } catch (e) {
      console.error("save upgrade audiogram:", e);
      setError(e?.message || "Couldn't save the audiogram.");
    } finally {
      setBusy(false);
    }
  };

  const finishVisit = async () => {
    setBusy(true); setError(null);
    try {
      const decisionFields = decisionState ? {
        decision: decisionState.decision,
        decisionRationale: decisionState.rationale,
        providerEditedRationale: rationaleEdited && rationaleDraft.trim() ? rationaleDraft : null,
      } : {};
      await saveUpgradeAssessment(visitId, patient.id, clinicId, {
        responses: { satisfaction, environments, featureGaps, benefitRefreshed, aidedWrsRight, aidedWrsLeft, changeNotes, yearsSinceFit: years },
        readinessScore: readiness.score,
        readinessBand: readiness.band,
        performanceTier: effectiveTier,
        performanceTags: perfTags,
        ...decisionFields,
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
            <>
              <div className="card" style={{ padding: 24, marginBottom: 16 }}>
                <h2 style={{ margin: "0 0 4px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>Today's hearing test</h2>
                <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
                  Capture a fresh audiogram for {patient?.name?.split(" ")[0] || "the patient"}. Toggle <strong>Overlay previous test</strong> on the chart to show the prior test in grey and see what's changed since the last visit.
                </p>
              </div>
              <AudiogramEntry value={audiology} onChange={setAudiology} ghost={patient?.audiology || null} />
            </>
          )}

          {step === 3 && (
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

          {step === 4 && (
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

          {step === 5 && (
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

              {/* ── Reprogram-vs-upgrade decision + anchored hearing journey ── */}
              {decisionLoading && (
                <div style={{ fontSize: 13, color: "#6b7280", padding: "8px 0" }}>Computing recommendation…</div>
              )}
              {decisionState && (() => {
                const meta = DECISION_META[decisionState.decision] || DECISION_META.provider_judgment;
                const d = decisionState.delta;
                const deltaBits = [];
                if (d?.ptaShift != null) deltaBits.push(`PTA ${d.ptaShift > 0 ? "+" : ""}${Math.round(d.ptaShift)} dB`);
                if (d?.wrsDrop != null) deltaBits.push(d.wrsDrop > 0 ? `WRS −${d.wrsDrop} pts` : "WRS stable");
                return (
                  <>
                    <CareJourney position={journeyPosition} warrantyYears={warrantyYears} currentAbility={currentAbility} />
                    <div style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 12, padding: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af" }}>Recommendation</span>
                        <span style={{ padding: "4px 12px", borderRadius: 999, background: meta.color, color: "white", fontSize: 13, fontWeight: 700, fontFamily: "'Sora',sans-serif" }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {decisionState.hasCurrent
                            ? <>Δ {decisionState.severity}{deltaBits.length ? ` · ${deltaBits.join(", ")}` : ""}{d?.anchorEar ? ` (poorer ${d.anchorEar} ear)` : ""}</>
                            : "no audiogram captured this visit"}
                          {decisionState.lean ? ` · readiness leans ${decisionState.lean}` : ""}
                        </span>
                      </div>
                      {!decisionState.hasBaseline && (
                        <div style={{ fontSize: 12, color: "#b45309", marginBottom: 10 }}>
                          No baseline audiogram on file — the delta can't be computed, so this defaults to provider judgment.
                        </div>
                      )}
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                        Patient-facing rationale
                      </label>
                      <textarea
                        value={rationaleDraft}
                        onChange={(e) => { setRationaleDraft(e.target.value); setRationaleEdited(true); }}
                        rows={4}
                        style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "inherit", fontSize: 14, resize: "vertical", boxSizing: "border-box", background: "white" }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>
                          {rationaleEdited ? "Provider-edited · saves with the visit" : "Engine-generated · edit to personalize"}
                        </span>
                        {rationaleEdited && (
                          <button onClick={() => { setRationaleDraft(decisionState.rationale); setRationaleEdited(false); }}
                            style={{ fontSize: 12, color: "#0f766e", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            ↺ Reset to engine draft
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
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
            {step === 2 && (
              <button className="btn-primary" disabled={busy} style={{ opacity: busy ? 0.4 : 1 }} onClick={saveAudiogramAndNext}>
                {busy ? "Saving…" : "Save & Continue →"}
              </button>
            )}
            {(step === 1 || step === 3 || step === 4) && (
              <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>Continue →</button>
            )}
            {step === 5 && (
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
