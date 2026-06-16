import React, { useState } from "react";
import { createVisit, updateVisit } from "../db.js";

// Established-patient visit flow (backlog #23). Parallel to the new-patient
// 8-step wizard — opens from "Start a New Visit" on a patient who already has a
// fitting on file. PR1 scope: pick a visit type, confirm-don't-retype the
// stable fields, and record the encounter as a visit. The clinical steps —
// upgrade-readiness questionnaire, current-aid performance assessment, the
// reprogram-vs-upgrade decision aid, and the anchored hearing-journey
// infographic — land in later PRs and slot in between Confirm and Summary.

const VISIT_TYPES = [
  { key: "annual_check",    label: "Annual Check",         icon: "🗓", blurb: "Routine yearly hearing review and device check." },
  { key: "upgrade_consult", label: "Upgrade Conversation", icon: "⬆",  blurb: "Reprogram vs. upgrade to newer technology." },
  { key: "device_eval",     label: "Device Evaluation",    icon: "🔬", blurb: "Assess current device performance and fit." },
  { key: "fit_follow_up",   label: "Fit Follow-up",        icon: "🔧", blurb: "Post-fitting adjustment and acclimatization." },
];

const STEPS = ["Visit Type", "Confirm Details", "Summary"];

// Parse a bare YYYY-MM-DD as local midnight (avoids the UTC day-skew the main
// app fixed in parseDateOnly); pass timestamps through to the native parser.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // assemblePatient resolves devices to the newest fitting, so this is the
  // patient's current aids; carePlanStartDate is the original-journey fallback.
  const fittingDate = patient?.devices?.fittingDate || patient?.carePlanStartDate || null;
  const years = yearsSince(fittingDate);
  const typeMeta = VISIT_TYPES.find((v) => v.key === visitType);

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
              <h2 style={{ margin: "0 0 16px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>Visit summary</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", marginBottom: 20 }}>
                <Field label="Patient" value={patient?.name} />
                <Field label="Visit type" value={typeMeta?.label} />
                <Field label="Years since fit" value={years != null ? years.toFixed(1) : "—"} />
                <Field label="Current aids fit" value={fmtDate(fittingDate)} />
              </div>
              {changeNotes && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Changes noted</div>
                  <div style={{ fontSize: 14, color: "#111827", whiteSpace: "pre-wrap" }}>{changeNotes}</div>
                </div>
              )}
              <div style={{ background: "#f0fdfa", border: "1px dashed #5eead4", borderRadius: 10, padding: 16, fontSize: 13, color: "#0f766e" }}>
                <strong>Coming next in this flow:</strong> upgrade-readiness questionnaire, current-aid performance assessment, and the reprogram-vs-upgrade decision aid anchored on {patient?.name?.split(" ")[0] || "the patient"}'s hearing-journey timeline.
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
            {step === 1 && (
              <button className="btn-primary" onClick={() => setStep(2)}>Continue →</button>
            )}
            {step === 2 && (
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
