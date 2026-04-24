import { useState, useEffect } from "react";
import { loadIntakesForPatient } from "../db.js";
import { unwrapIntakeAnswers } from "../recommendationEngine.js";
import { SECTIONS, formatFieldValue } from "./HealthHistory.jsx";

// Patient-detail "Intake Responses" accordion. Read-only render of the
// patient's intake history. Edits happen only in the Health History
// wizard step — this view is for at-a-glance review on the profile.
//
// Older intakes are hidden behind a dropdown selector; default shows
// the most recent. The accordion itself is collapsed by default so
// the patient detail page stays scannable.

const TEAL = "#0A7B8C";
const TEAL_BG = "#F0F9FA";
const TEXT = "#0a1628";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

export default function IntakeResponsesAccordion({ patientId }) {
  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setLoading(true);
    loadIntakesForPatient(patientId).then(rows => {
      if (cancelled) return;
      const normalized = rows.map(row => {
        const raw = row.answers;
        const isWrapped = raw && typeof raw === "object" && raw.answers
          && typeof raw.answers === "object" && (raw._meta || raw.consent);
        return {
          ...row,
          answers: isWrapped ? raw.answers : (raw || {}),
        };
      });
      setIntakes(normalized);
      setSelectedIdx(0);
      setLoading(false);
    }).catch(e => {
      console.error("loadIntakesForPatient (accordion):", e);
      if (!cancelled) { setIntakes([]); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [patientId]);

  if (loading) return null;
  if (intakes.length === 0) return null;

  const selected = intakes[selectedIdx];
  const submitted = selected._meta?.submittedAt
    ? new Date(selected._meta.submittedAt).toLocaleDateString()
    : null;

  return (
    <div className="detail-card full" style={{ padding: 0, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", background: "transparent", border: "none", cursor: "pointer",
          fontFamily: "inherit", textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af" }}>
            Intake Responses
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
            {intakes.length === 1
              ? `Submitted ${submitted}`
              : `${intakes.length} intakes on file · most recent ${submitted}`}
          </div>
        </div>
        <span style={{ fontSize: 14, color: MUTED }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: 18 }}>
          {intakes.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: "block", marginBottom: 4 }}>
                Showing
              </label>
              <select
                value={selectedIdx}
                onChange={e => setSelectedIdx(Number(e.target.value))}
                style={{
                  padding: "6px 10px", fontSize: 13, border: `1px solid ${BORDER}`,
                  borderRadius: 6, background: "#fff", color: TEXT, fontFamily: "inherit",
                }}
              >
                {intakes.map((it, i) => {
                  const d = it._meta?.submittedAt ? new Date(it._meta.submittedAt).toLocaleDateString() : "(unknown date)";
                  return (
                    <option key={it._meta?.intakeId || i} value={i}>
                      {i === 0 ? `Most recent — ${d}` : `${d}`}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {SECTIONS
              .filter(sec => !sec.showWhen || sec.showWhen(selected.answers))
              .map(sec => (
                <Section key={sec.id} section={sec} answers={selected.answers} notes={selected.providerNotes || {}} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ section, answers, notes }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
        {section.label}
      </div>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fff" }}>
        {section.fields.map((field, i) => {
          const value = answers[field.key];
          const note = notes[field.key];
          const followUpValue = field.followUpKey ? answers[field.followUpKey] : null;
          const secondFollowUpValue = field.secondFollowUpKey ? answers[field.secondFollowUpKey] : null;
          return (
            <div key={field.key} style={{ padding: "8px 14px", borderBottom: i === section.fields.length - 1 ? "none" : `1px solid ${BORDER}`, fontSize: 13 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) 2fr", gap: 12, alignItems: "baseline" }}>
                <div style={{ color: MUTED, fontSize: 12, fontWeight: 600 }}>{field.label}</div>
                <div style={{ color: TEXT }}>{formatFieldValue(field, value, answers)}</div>
              </div>
              {field.followUpKey && shouldShowFollowUp(field, value) && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) 2fr", gap: 12, marginTop: 4, paddingLeft: 12, borderLeft: `2px solid ${BORDER}` }}>
                  <div style={{ color: MUTED, fontSize: 11 }}>↳ {field.followUpLabel}</div>
                  <div style={{ color: TEXT, fontSize: 12 }}>
                    {formatFieldValue(
                      { type: field.followUpType || "text", options: field.followUpOptions, otherKey: "other", otherValueKey: field.otherFollowUpKey },
                      followUpValue,
                      answers
                    )}
                  </div>
                </div>
              )}
              {field.secondFollowUpKey && shouldShowFollowUp(field, value) && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) 2fr", gap: 12, marginTop: 4, paddingLeft: 12, borderLeft: `2px solid ${BORDER}` }}>
                  <div style={{ color: MUTED, fontSize: 11 }}>↳ {field.secondFollowUpLabel}</div>
                  <div style={{ color: TEXT, fontSize: 12 }}>{formatFieldValue({ type: "text" }, secondFollowUpValue, answers)}</div>
                </div>
              )}
              {note && String(note).trim() && (
                <div style={{ marginTop: 6, padding: "6px 10px", background: TEAL_BG, borderLeft: `3px solid ${TEAL}`, borderRadius: "0 4px 4px 0", fontSize: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                    Provider note
                  </div>
                  <div style={{ color: TEXT, whiteSpace: "pre-wrap" }}>{note}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function shouldShowFollowUp(field, value) {
  if (field.type === "yesno") return value === true;
  return value !== undefined && value !== "" && value !== null;
}
