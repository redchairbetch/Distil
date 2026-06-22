import React, { useState, useMemo, useEffect } from "react";
import {
  createVisit, updateVisit, saveUpgradeAssessment,
  updatePatientAudiology, loadBaselineAudiology, loadVisitAudiology,
  recordUpgradeOutcome, loadLatestUpgradeIntake,
} from "../db.js";
import {
  scoreReadiness,
  computePerformanceTier,
  STRUGGLE_ENVIRONMENTS,
  FEATURE_GAPS,
  PERFORMANCE_TAGS,
} from "../upgradeReadiness.js";
import { computeAudiometricDelta, decideReprogramVsUpgrade } from "../reprogramVsUpgradeEngine.js";
import AudiogramEntry from "../components/AudiogramEntry.jsx";
import CareJourney from "./CareJourney.jsx";
import UpgradeClose from "./UpgradeClose.jsx";

// Established-patient visit flow (backlog #23). Parallel to the new-patient
// 8-step wizard — opens from "Start a New Visit" on a patient who already has a
// fitting on file. Framed as transparent, protocol-driven annual care rather
// than an "is this patient ready to upgrade?" assessment: the provider picks
// where the patient sits on the five-year journey, and the flow shows every
// check we promised at each step. The journey year GATES the flow —
//   Years 1–3 (annual care): Current-aid performance → exam → care-journey
//     review (the year-by-year checklist + annual check-in), then save.
//   Years 4–5 (upgrade evaluation): the same, plus the reprogram-vs-upgrade
//     decision card on the review and a consultation Close step.
// Aided WRS was removed (unreliable, single-office); Real Ear Measurement is
// captured as a note for now. The readiness score is still computed and saved,
// but only as the silent tie-breaker for the Y4–5 decision — never shown as a
// "band" to the patient.

const VISIT_TYPES = [
  { key: "annual_check",    label: "Annual Check",         icon: "🗓", blurb: "Routine yearly hearing review and device check." },
  { key: "upgrade_consult", label: "Upgrade Conversation", icon: "⬆",  blurb: "Reprogram vs. upgrade to newer technology." },
  { key: "device_eval",     label: "Device Evaluation",    icon: "🔬", blurb: "Assess current device performance and fit." },
  { key: "fit_follow_up",   label: "Fit Follow-up",        icon: "🔧", blurb: "Post-fitting adjustment and acclimatization." },
];

// Step indices. Years 1–3 end at REVIEW (save there); years 4–5 add CLOSE.
const STEP = { VISIT: 0, CONFIRM: 1, CURRENT: 2, EXAM: 3, REVIEW: 4, CLOSE: 5 };

const YEAR_LABELS = { 1: "First annual", 2: "Annual review", 3: "Warranty review", 4: "Upgrade eval", 5: "Definitive upgrade" };

// Journey-year → x-position on the CareJourney curve (aligns with its AHT milestones:
// AHT1 .20 · AHT2 .40 · AHT3 .60 · AHT4 .78 · Upgrade 1.0).
const YEAR_TO_POSITION = { 1: 0.20, 2: 0.40, 3: 0.60, 4: 0.78, 5: 1.0 };

// The promised five-year care protocol — the "boxes we check" the patient sees
// laid out on the review screen. Current year is highlighted; prior years read
// as done, future years as what's coming.
const JOURNEY_PROTOCOL = [
  { year: 1, title: "First annual",       items: ["Hearing test", "Device performance check", "Care cadence explained"] },
  { year: 2, title: "Annual review",      items: ["Hearing test", "Device performance check"] },
  { year: 3, title: "Warranty review",    items: ["Hearing test", "Device performance check", "Warranty-end review", "Lima Charlie donation option"] },
  { year: 4, title: "Upgrade evaluation", items: ["Hearing test", "Device performance check", "Reprogram vs. upgrade assessment"] },
  { year: 5, title: "Definitive upgrade", items: ["Hearing test", "Device performance check", "Final upgrade recommendation"] },
];

const TIERS = ["Excellent", "Adequate", "Marginal", "Failing"];
const TIER_COLORS = { Excellent: "#059669", Adequate: "#0f766e", Marginal: "#b45309", Failing: "#dc2626" };

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
  const fittingDate = patient?.devices?.fittingDate || patient?.carePlanStartDate || null;
  const years = yearsSince(fittingDate);
  const suggestedYear = years != null ? Math.min(5, Math.max(1, Math.round(years))) : 1;

  const [step, setStep] = useState(0);
  const [visitType, setVisitType] = useState("");
  const [journeyYear, setJourneyYear] = useState(suggestedYear);
  const [visitId, setVisitId] = useState(null);
  const [changeNotes, setChangeNotes] = useState("");

  // Current audiogram captured this visit (starts blank; the prior test overlays
  // in greyscale via AudiogramEntry's ghost prop).
  const [audiology, setAudiology] = useState(makeEmptyAudiology);

  // Current-aid performance inputs (aided WRS removed — tags drive the tier).
  const [perfTags, setPerfTags] = useState([]);
  const [tierOverride, setTierOverride] = useState(null); // null → use computed
  const [remDone, setRemDone] = useState("");    // "" | "yes" | "no"
  const [remTarget, setRemTarget] = useState(""); // "" | "yes" | "no" (only when remDone === "yes")

  // Annual check-in (the reframed questionnaire — collected every year, shown as
  // "how's it going", never surfaced as a score). benefitRefreshed only matters
  // on the Y4–5 upgrade evaluation.
  const [satisfaction, setSatisfaction] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const [featureGaps, setFeatureGaps] = useState([]);
  const [benefitRefreshed, setBenefitRefreshed] = useState(false);

  // Reprogram-vs-upgrade decision (Y4–5 only). The audiogram delta is loaded once
  // when the provider reaches the review; the verdict is derived synchronously
  // from it + the perf tier + (silent) readiness band, so adjusting the check-in
  // re-scores instantly instead of reloading and flickering the card.
  const [deltaState, setDeltaState] = useState(null); // { delta, hasBaseline, hasCurrent } | null
  const [deltaLoading, setDeltaLoading] = useState(false);
  const [rationaleDraft, setRationaleDraft] = useState("");
  const [rationaleEdited, setRationaleEdited] = useState(false);

  // Consultation close (PR4) — path defaults to the decision but is provider-overridable.
  const [closeState, setCloseState] = useState({
    path: "", tierOffered: "", outcome: "", disposition: "", donationRecipient: "", followUpDate: "", notes: "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Patient self-reported check-in from the kiosk annual/upgrade route (backlog
  // #23). Pre-fills the REVIEW check-in + CURRENT performance tags so the
  // provider confirms/adjusts rather than re-asks. { refId, submittedAt } | null.
  const [kioskPrefill, setKioskPrefill] = useState(null);

  const firstName = patient?.name?.split(" ")[0] || "the patient";
  const isUpgradeYear = journeyYear >= 4;

  const STEPS = isUpgradeYear
    ? ["Visit Type", "Confirm Details", "Current Aids", "Exam Results", "Journey Review", "Close"]
    : ["Visit Type", "Confirm Details", "Current Aids", "Exam Results", "Journey Review"];
  const topTitle = isUpgradeYear ? "Upgrade Evaluation" : "Annual Care Visit";

  const computedTier = useMemo(() => computePerformanceTier({ tags: perfTags }), [perfTags]);
  const effectiveTier = tierOverride || computedTier;

  const readiness = useMemo(
    () => scoreReadiness({ satisfaction, environments, featureGaps, benefitRefreshed, performanceTier: effectiveTier, yearsSinceFit: years }),
    [satisfaction, environments, featureGaps, benefitRefreshed, effectiveTier, years]
  );

  // CareJourney inputs: "you are here" sits at the SELECTED journey year's milestone
  // (the provider's explicit call — more reliable than elapsed time, which is null for
  // patients with no fitting date on file). Ability overlay from the perf tier; warranty
  // span from the fitting/warranty dates (CC+ 4-yr default).
  const journeyPosition = YEAR_TO_POSITION[journeyYear] ?? (years != null ? Math.max(0, Math.min(1, years / 5)) : 0);
  const currentAbility = effectiveTier ? TIER_ABILITY[effectiveTier] : null;

  // Verdict derived from the loaded delta + current tier/band — no DB reload.
  const decisionState = useMemo(() => {
    if (!deltaState) return null;
    const result = decideReprogramVsUpgrade(deltaState.delta, effectiveTier, readiness.band);
    return { ...result, ...deltaState };
  }, [deltaState, effectiveTier, readiness.band]);

  // Default close path = the recommendation (provider_judgment falls to the lean).
  const defaultClosePath = decisionState
    ? (decisionState.decision === "reprogram"
        ? "reprogram"
        : decisionState.decision === "upgrade"
          ? "upgrade"
          : (decisionState.lean === "reprogram" ? "reprogram" : "upgrade"))
    : "upgrade";
  const warrantyYears = useMemo(() => {
    const fit = parseDateOnly(fittingDate);
    const exp = parseDateOnly(patient?.devices?.warrantyExpiry);
    if (fit && exp && !Number.isNaN(fit.getTime()) && !Number.isNaN(exp.getTime())) {
      const yrs = (exp.getTime() - fit.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (yrs > 0) return Math.round(yrs);
    }
    return 4;
  }, [fittingDate, patient?.devices?.warrantyExpiry]);

  // Load the audiogram delta once when the provider reaches the review on a Y4–5
  // evaluation (the verdict itself is derived above, synchronously).
  useEffect(() => {
    if (step !== STEP.REVIEW || !isUpgradeYear || !visitId) { setDeltaState(null); return; }
    let cancelled = false;
    setDeltaLoading(true);
    setDeltaState(null);
    (async () => {
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
        setDeltaState({ delta, hasBaseline: !!realBaseline, hasCurrent: !!current });
      } finally {
        if (!cancelled) setDeltaLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visitId, isUpgradeYear]);

  // Keep the editable rationale synced to the engine draft until the provider
  // edits it (then leave their wording alone).
  useEffect(() => {
    if (decisionState && !rationaleEdited) setRationaleDraft(decisionState.rationale);
  }, [decisionState, rationaleEdited]);

  // Pre-fill the check-in from the patient's most recent kiosk annual/upgrade
  // submission (if linked to this patient). Runs once on mount; only seeds the
  // fields the provider hasn't touched yet. Keys are filtered against the live
  // option lists so a stale kiosk key never sets an un-rendered chip.
  useEffect(() => {
    if (!patient?.id) return;
    let cancelled = false;
    (async () => {
      const hit = await loadLatestUpgradeIntake(patient.id);
      if (cancelled || !hit?.readiness) return;
      const r = hit.readiness;
      const envKeys = new Set(STRUGGLE_ENVIRONMENTS.map((e) => e.key));
      const featKeys = new Set(FEATURE_GAPS.map((f) => f.key));
      const tagKeys = new Set(PERFORMANCE_TAGS.map((t) => t.key));
      if (typeof r.satisfaction === "number") setSatisfaction((prev) => (prev == null ? r.satisfaction : prev));
      if (Array.isArray(r.environments)) {
        const vals = r.environments.filter((k) => envKeys.has(k));
        if (vals.length) setEnvironments((prev) => (prev.length ? prev : vals));
      }
      if (Array.isArray(r.featureGaps)) {
        const vals = r.featureGaps.filter((k) => featKeys.has(k));
        if (vals.length) setFeatureGaps((prev) => (prev.length ? prev : vals));
      }
      if (Array.isArray(r.issues)) {
        const vals = r.issues.filter((k) => tagKeys.has(k));
        if (vals.length) setPerfTags((prev) => (prev.length ? prev : vals));
      }
      if (r.notes) setChangeNotes((prev) => (prev ? prev : r.notes));
      setKioskPrefill({ refId: hit.refId, submittedAt: hit.submittedAt });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id]);

  const toggle = (arr, setArr, key) =>
    setArr(arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);

  const startVisit = async () => {
    if (!visitType) return;
    setBusy(true); setError(null);
    const vid = await createVisit(patient.id, { clinicId, staffId, visitType });
    setBusy(false);
    if (!vid) { setError("Couldn't open the visit. Please try again."); return; }
    setVisitId(vid);
    setStep(STEP.CONFIRM);
  };

  const saveAudiogramAndNext = async () => {
    setBusy(true); setError(null);
    try {
      // Visit-scoped save — prior visits' audiograms survive (longitudinal history).
      // No-ops on an empty grid, so skipping the test won't create a junk baseline.
      await updatePatientAudiology(patient.id, audiology, staffId, visitId);
      setStep(STEP.REVIEW);
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
      const isUpg = isUpgradeYear;
      const decisionFields = (isUpg && decisionState) ? {
        decision: decisionState.decision,
        decisionRationale: decisionState.rationale,
        providerEditedRationale: rationaleEdited && rationaleDraft.trim() ? rationaleDraft : null,
      } : {};
      const effPath = isUpg ? (closeState.path || defaultClosePath) : null;
      // Reprogram is its own retention outcome; the upgrade path uses the picked one.
      const outcome = !isUpg ? null : (effPath === "reprogram" ? "reprogrammed" : (closeState.outcome || null));

      const responses = {
        journeyYear,
        satisfaction, environments, featureGaps,
        benefitRefreshed: isUpg ? benefitRefreshed : false,
        rem: { performed: remDone || null, onTarget: remDone === "yes" ? (remTarget || null) : null },
        changeNotes, yearsSinceFit: years,
      };
      if (isUpg) {
        responses.close = {
          path: effPath,
          tierOffered: closeState.tierOffered || null,
          outcome,
          disposition: closeState.disposition || null,
          donationRecipient: closeState.donationRecipient || null,
          followUpDate: closeState.followUpDate || null,
          notes: closeState.notes || null,
        };
      }

      await saveUpgradeAssessment(visitId, patient.id, clinicId, {
        responses,
        readinessScore: readiness.score,
        readinessBand: readiness.band,
        performanceTier: effectiveTier,
        performanceTags: perfTags,
        ...decisionFields,
      });

      // Patient-level upgrade tracking — gates the off-warranty follow-up bucket
      // and surfaces in the patient-detail Upgrade Tracking card. Only the Y4–5
      // upgrade evaluation records an outcome; annual visits leave it untouched.
      // Reprogram only sets the outcome, leaving any prior tier/donation values be.
      if (isUpg) {
        await recordUpgradeOutcome(
          patient.id,
          effPath === "upgrade"
            ? {
                tierOffered: closeState.tierOffered || null,
                outcome,
                // Only write the recipient when actually donating — omitting the key
                // leaves any prior recipient untouched (recordUpgradeOutcome skips
                // undefined fields). Passing null would clobber it.
                ...(closeState.disposition === "donate"
                  ? { donationRecipient: closeState.donationRecipient || null }
                  : {}),
              }
            : { outcome }
        );
      }

      const mergedNotes = [changeNotes, isUpg ? closeState.notes : null].map((s) => (s || "").trim()).filter(Boolean).join("\n\n");
      await updateVisit(visitId, { notes: mergedNotes || null, status: "completed" });
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
          <div className="topbar-title">{topTitle}</div>
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

          {step === STEP.VISIT && (
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

              {/* Journey year — the spine that gates the rest of the flow */}
              <div style={{ marginTop: 24, borderTop: "1px solid #f1f5f9", paddingTop: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Where are they on the five-year journey?
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[1, 2, 3, 4, 5].map((y) => {
                    const active = journeyYear === y;
                    const upg = y >= 4;
                    const accent = upg ? "#b45309" : "#0f766e";
                    return (
                      <button key={y} onClick={() => setJourneyYear(y)} style={{
                        textAlign: "center", padding: "10px 16px", borderRadius: 10, cursor: "pointer", minWidth: 96,
                        border: active ? `2px solid ${accent}` : "1px solid #e5e7eb",
                        background: active ? (upg ? "#fffbeb" : "#f0fdfa") : "white",
                      }}>
                        <div style={{ fontSize: 14, fontWeight: active ? 700 : 600, fontFamily: "'Sora',sans-serif", color: active ? accent : "#111827" }}>Year {y}</div>
                        <div style={{ fontSize: 11, color: active ? accent : "#9ca3af", marginTop: 2 }}>{YEAR_LABELS[y]}</div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 10 }}>
                  {years != null ? `Suggested from last fit: Year ${suggestedYear}. ` : ""}
                  {isUpgradeYear
                    ? "Upgrade evaluation — adds the reprogram-vs-upgrade decision and a consultation close."
                    : "Annual care — hearing test, device check, and the year-by-year journey review."}
                </div>
              </div>
            </div>
          )}

          {step === STEP.CONFIRM && (
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

          {step === STEP.CURRENT && (
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>Current-aid performance</h2>
              <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 14 }}>
                How are the current aids actually performing? Flag any real-world issues and set a performance tier.
              </p>
              {kioskPrefill && perfTags.length > 0 && (
                <div style={{ background: "#f0fdfa", border: "1px solid #5eead4", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#0f766e", lineHeight: 1.5 }}>
                  ✓ Issues below pre-filled from {firstName}'s kiosk check-in. Confirm or adjust.
                </div>
              )}
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

          {step === STEP.EXAM && (
            <>
              <div className="card" style={{ padding: 24, marginBottom: 16 }}>
                <h2 style={{ margin: "0 0 4px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>Today's hearing test</h2>
                <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
                  Capture a fresh audiogram for {firstName}. Toggle <strong>Overlay previous test</strong> on the chart to show the prior test in grey and see what's changed since the last visit.
                </p>
              </div>
              <AudiogramEntry value={audiology} onChange={setAudiology} ghost={patient?.audiology || null} hideUnaidedSpeech />
              <div className="card">
                <div className="card-title">Real Ear Measurement (REM)</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14, lineHeight: 1.6 }}>
                  The accurate check of whether the aids hit prescriptive target. Detailed visualization coming later.
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "#374151" }}>Performed?</span>
                  <Chip active={remDone === "yes"} onClick={() => setRemDone("yes")}>Yes</Chip>
                  <Chip active={remDone === "no"} onClick={() => { setRemDone("no"); setRemTarget(""); }}>No</Chip>
                  {remDone === "yes" && (
                    <>
                      <span style={{ fontSize: 13, color: "#374151", marginLeft: 8 }}>Within target?</span>
                      <Chip active={remTarget === "yes"} onClick={() => setRemTarget("yes")}>On target</Chip>
                      <Chip active={remTarget === "no"} onClick={() => setRemTarget("no")}>Off target</Chip>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {step === STEP.REVIEW && (
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>Care journey review</h2>
              <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 14 }}>
                Where {firstName} sits on the five-year plan, and the checks we promised at each step — so nothing this year is a surprise.
              </p>

              <CareJourney position={journeyPosition} warrantyYears={warrantyYears} currentAbility={currentAbility} />

              <ProtocolChecklist currentYear={journeyYear} />

              {journeyYear === 3 && (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 16, marginBottom: 24, fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
                  <strong>Year 3 — warranty &amp; giving back.</strong> The manufacturer warranty ends after this year. We'll walk through what that means, and — if {firstName} ever upgrades — the option to donate the current aids through Lima Charlie to a veteran in need.
                </div>
              )}

              {/* Annual check-in — the reframed questionnaire, no score shown */}
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 20 }}>
                <h3 style={{ margin: "0 0 2px", fontFamily: "'Sora',sans-serif", fontSize: 16 }}>Annual check-in</h3>
                <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 13 }}>How are things going with the current aids?</p>
                {kioskPrefill && (
                  <div style={{ background: "#f0fdfa", border: "1px solid #5eead4", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#0f766e", lineHeight: 1.5 }}>
                    ✓ Pre-filled from {firstName}'s kiosk check-in{kioskPrefill.submittedAt ? ` (${fmtDate(kioskPrefill.submittedAt)})` : ""}. Confirm or adjust below.
                  </div>
                )}

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

                <div style={{ marginBottom: isUpgradeYear ? 20 : 0 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                    Feature gaps they'd value <span style={{ fontWeight: 400, color: "#9ca3af" }}>(want, current aids lack)</span>
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {FEATURE_GAPS.map((f) => (
                      <Chip key={f.key} active={featureGaps.includes(f.key)} onClick={() => toggle(featureGaps, setFeatureGaps, f.key)}>{f.label}</Chip>
                    ))}
                  </div>
                </div>

                {isUpgradeYear && (
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: "#374151" }}>
                    <input type="checkbox" checked={benefitRefreshed} onChange={(e) => setBenefitRefreshed(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#0f766e" }} />
                    Insurance hearing benefit available / refreshed now
                  </label>
                )}
              </div>

              {/* ── Reprogram-vs-upgrade decision (Y4–5 only) ── */}
              {isUpgradeYear && (
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 20, marginTop: 20 }}>
                  {deltaLoading && (
                    <div style={{ fontSize: 13, color: "#6b7280", padding: "8px 0" }}>Computing recommendation…</div>
                  )}
                  {decisionState && (() => {
                    const meta = DECISION_META[decisionState.decision] || DECISION_META.provider_judgment;
                    const d = decisionState.delta;
                    const deltaBits = [];
                    if (d?.ptaShift != null) deltaBits.push(`PTA ${d.ptaShift > 0 ? "+" : ""}${Math.round(d.ptaShift)} dB`);
                    if (d?.wrsDrop != null) deltaBits.push(d.wrsDrop > 0 ? `WRS −${d.wrsDrop} pts` : "WRS stable");
                    return (
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
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {step === STEP.CLOSE && isUpgradeYear && (
            <UpgradeClose
              value={closeState}
              onChange={setCloseState}
              defaultPath={defaultClosePath}
              patient={patient}
              decision={decisionState}
              journeyPosition={journeyPosition}
              warrantyYears={warrantyYears}
              currentAbility={currentAbility}
            />
          )}

          <div className="wizard-nav">
            <button className="btn-ghost" onClick={() => { if (step === 0) onExit?.(); else setStep((s) => s - 1); }}>
              {step === 0 ? "Cancel" : "← Back"}
            </button>

            {step === STEP.VISIT && (
              <button className="btn-primary" disabled={!visitType || busy} style={{ opacity: (!visitType || busy) ? 0.4 : 1 }} onClick={startVisit}>
                {busy ? "Opening…" : "Continue →"}
              </button>
            )}
            {(step === STEP.CONFIRM || step === STEP.CURRENT) && (
              <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>Continue →</button>
            )}
            {step === STEP.EXAM && (
              <button className="btn-primary" disabled={busy} style={{ opacity: busy ? 0.4 : 1 }} onClick={saveAudiogramAndNext}>
                {busy ? "Saving…" : "Save & Continue →"}
              </button>
            )}
            {step === STEP.REVIEW && (
              isUpgradeYear ? (
                <button className="btn-primary" disabled={deltaLoading} style={{ opacity: deltaLoading ? 0.4 : 1 }} onClick={() => setStep((s) => s + 1)}>
                  {deltaLoading ? "Computing…" : "Continue →"}
                </button>
              ) : (
                <button className="btn-primary green" disabled={busy} onClick={finishVisit}>
                  {busy ? "Saving…" : "✓ Save Visit"}
                </button>
              )
            )}
            {step === STEP.CLOSE && (
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

// The promised five-year care protocol, laid out as a checklist. Prior years
// read as done, the current year is highlighted with its boxes checked (the
// patient sees we did exactly what we said we would), future years as upcoming.
function ProtocolChecklist({ currentYear }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>What we check, year by year</div>
      <p style={{ fontSize: 12.5, color: "#6b7280", margin: "0 0 14px" }}>
        Nothing here is a surprise — this is the plan from day one. You're on <strong>Year {currentYear}</strong>.
      </p>
      <div>
        {JOURNEY_PROTOCOL.map((p, i) => {
          const state = p.year < currentYear ? "done" : p.year === currentYear ? "current" : "upcoming";
          const isLast = i === JOURNEY_PROTOCOL.length - 1;
          const badgeBg = state === "current" ? "#0f766e" : state === "done" ? "#94a3b8" : "white";
          const badgeColor = state === "upcoming" ? "#9ca3af" : "white";
          const railColor = p.year < currentYear ? "#94a3b8" : "#e5e7eb";
          return (
            <div key={p.year} style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
              {/* Rail: badge + connector */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: badgeBg, color: badgeColor,
                  border: state === "upcoming" ? "2px solid #e5e7eb" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif",
                }}>
                  {state === "done" ? "✓" : p.year}
                </div>
                {!isLast && <div style={{ width: 2, flex: 1, minHeight: 10, background: railColor }} />}
              </div>
              {/* Content */}
              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16, opacity: state === "upcoming" ? 0.75 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: state === "current" ? "#0f766e" : "#111827" }}>
                    Year {p.year} · {p.title}
                  </span>
                  {state === "current" && (
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#0f766e", background: "#f0fdfa", border: "1px solid #5eead4", borderRadius: 999, padding: "2px 8px" }}>Today</span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", marginTop: 4 }}>
                  {p.items.map((it) => {
                    const checked = state === "done" || state === "current";
                    return (
                      <span key={it} style={{ fontSize: 12.5, color: state === "upcoming" ? "#9ca3af" : "#6b7280" }}>
                        <span style={{ color: checked ? "#0f766e" : "#cbd5e1", fontWeight: 700 }}>{checked ? "✓" : "○"}</span> {it}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
