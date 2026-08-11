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
import {
  RESISTANCE_REVIEW,
  fdaSafetyState,
  hearingSituationState,
  perceptionGapCopy,
} from "../lib/intakeReview.js";

// IntakePresentation — the patient-facing face of the Health History
// step. The screen is viewed BY PATIENT AND PROVIDER TOGETHER, so every
// visible word is patient-safe: no motivation score, no soft-commitment
// badge, no "red flag" language. The provider's deepening prompts exist
// on every card but hide behind a deliberately unlabeled "⋯" reveal;
// notes captured there write to the same providerNotes map the clinical
// grid uses, so nothing lives in two places.
//
// Four beats, in conversation order:
//   1. In your words        — the visit reason, quoted verbatim
//   2. Medical safety check — the six FDA items, all-clear or flagged
//   3. Where hearing gets hard — only the situations they endorsed
//   4. Where you stand      — self-rating, readiness, what's held them back
//
// Unanswered yes/no items stay answerable inline (small pills), so the
// walk-through can fill intake gaps without leaving presentation mode.

const TEAL = "#0A7B8C";
const TEAL_BG = "#F0F9FA";
const TEXT = "#0a1628";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const GREEN = "#15803d";
const GREEN_BG = "#f0fdf4";
const GREEN_BORDER = "#bbf7d0";
const AMBER = "#b45309";
const AMBER_BG = "#fffbeb";
const AMBER_BORDER = "#fde68a";
const SLATE_BG = "#f8fafc";

export default function IntakePresentation({ intake, onUpdateAnswer, onUpdateNote }) {
  const answers = intake?.answers || {};
  const notes = intake?.providerNotes || {};
  const firstName = answers.firstName || "";

  const fda = fdaSafetyState(answers);
  const situations = hearingSituationState(answers);
  const gapCopy = perceptionGapCopy(answers);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ textAlign: "center", padding: "8px 0 0" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: TEXT, letterSpacing: "-0.01em" }}>
          {firstName ? `${firstName}, let's start with your story` : "Let's start with your story"}
        </div>
        <div style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>
          Everything below came from your answers — let's walk through it together before we test.
        </div>
      </div>

      <TheirWords answers={answers} />
      <SafetyCheck fda={fda} answers={answers} notes={notes}
        onUpdateAnswer={onUpdateAnswer} onUpdateNote={onUpdateNote} />
      <Situations situations={situations} notes={notes}
        onUpdateAnswer={onUpdateAnswer} onUpdateNote={onUpdateNote} />
      <WhereYouStand answers={answers} gapCopy={gapCopy} notes={notes} onUpdateNote={onUpdateNote} />
    </div>
  );
}

function BeatLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

// ── Beat 1 — In your words ──────────────────────────────────────────
function TheirWords({ answers }) {
  const reason = (answers.visitReason || "").trim();
  if (!reason) return null;
  return (
    <div>
      <BeatLabel>In your words</BeatLabel>
      <div style={{
        background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${TEAL}`,
        borderRadius: 10, padding: "22px 26px",
      }}>
        <div style={{ fontSize: 19, lineHeight: 1.6, color: TEXT, fontWeight: 500, fontStyle: "italic" }}>
          “{reason}”
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
          — your reason for today's visit
        </div>
      </div>
    </div>
  );
}

// ── Beat 2 — Medical safety check ───────────────────────────────────
function SafetyCheck({ fda, answers, notes, onUpdateAnswer, onUpdateNote }) {
  const { flagged, clear, unanswered, allClear } = fda;
  const doctorSeen = answers.med_doctor === true;
  const doctorWhen = (answers.med_doctor_when || "").trim();

  return (
    <div>
      <BeatLabel>Your medical safety check</BeatLabel>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 12, lineHeight: 1.55 }}>
        We screen every patient for six medical signs that deserve a doctor's attention before anything else.
      </div>

      {allClear && (
        <div style={{
          background: GREEN_BG, border: `1px solid ${GREEN_BORDER}`, borderRadius: 10,
          padding: "18px 22px", display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>✅</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: GREEN }}>All clear</div>
            <div style={{ fontSize: 13, color: "#166534", marginTop: 3, lineHeight: 1.5 }}>
              None of the six apply to you — we're clear to move ahead with testing.
            </div>
          </div>
        </div>
      )}

      {/* Flagged items — one amber card each, with the provider's
          deepening prompt tucked behind the discreet reveal. */}
      {flagged.map(item => (
        <RevealCard
          key={item.key}
          noteKey={item.key}
          prompt={item.prompt}
          note={notes[item.key] || ""}
          onUpdateNote={onUpdateNote}
          style={{
            background: AMBER_BG, border: `1px solid ${AMBER_BORDER}`,
            borderRadius: 10, padding: "14px 18px", marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 20, lineHeight: 1 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>{item.label}</div>
          </div>
          <div style={{ fontSize: 12.5, color: "#92400e", marginTop: 6, lineHeight: 1.5 }}>
            Let's talk about this one together — it matters for how we plan your care.
          </div>
        </RevealCard>
      ))}

      {flagged.length > 0 && doctorSeen && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8,
          background: TEAL_BG, border: `1px solid #B7DDE2`, borderRadius: 999,
          padding: "5px 12px", fontSize: 12, fontWeight: 600, color: TEAL,
        }}>
          🩺 Discussed with a doctor{doctorWhen ? ` — ${doctorWhen}` : ""}
        </div>
      )}

      {/* Compact strip of the explicit "No" items so the all-clear (or
          partial state) is visibly grounded in their own answers. */}
      {!allClear && clear.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {clear.map(item => (
            <span key={item.key} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: GREEN_BG, border: `1px solid ${GREEN_BORDER}`, borderRadius: 999,
              padding: "4px 11px", fontSize: 12, fontWeight: 600, color: GREEN,
            }}>
              ✓ {item.label}
            </span>
          ))}
        </div>
      )}

      {unanswered.length > 0 && (
        <div style={{
          marginTop: 10, background: SLATE_BG, border: `1px solid ${BORDER}`,
          borderRadius: 10, padding: "12px 16px",
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, marginBottom: 8 }}>
            A few we didn't get your answer on — let's cover them now:
          </div>
          {unanswered.map(item => (
            <InlineYesNo key={item.key} label={item.label} answerKey={item.key} onUpdateAnswer={onUpdateAnswer} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Beat 3 — Where hearing gets hard ────────────────────────────────
function Situations({ situations, notes, onUpdateAnswer, onUpdateNote }) {
  const { endorsed, denied, unanswered, total } = situations;

  return (
    <div>
      <BeatLabel>Where hearing gets hard</BeatLabel>
      {endorsed.length > 0 ? (
        <>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 12, lineHeight: 1.55 }}>
            You told us <strong style={{ color: TEXT }}>{endorsed.length} of {total}</strong> everyday
            listening situations are a struggle:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
            {endorsed.map(item => (
              <RevealCard
                key={item.key}
                noteKey={item.key}
                prompt={item.prompt}
                note={notes[item.key] || ""}
                onUpdateNote={onUpdateNote}
                style={{
                  background: "#fff", border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: "16px 18px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ fontSize: 26, lineHeight: 1.1 }}>{item.icon}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: TEXT, lineHeight: 1.4, paddingTop: 2 }}>
                    {item.restatement}
                  </div>
                </div>
              </RevealCard>
            ))}
          </div>
        </>
      ) : denied.length > 0 ? (
        // Only claim "not much trouble" when they actually answered No —
        // an unanswered battery (fresh guided-conversation intake) gets
        // the fill-in list below instead of words in their mouth.
        <div style={{
          background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px 22px",
        }}>
          <div style={{ fontSize: 14, color: TEXT, fontWeight: 600, lineHeight: 1.5 }}>
            You told us everyday listening isn't giving you much trouble right now.
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
            Today's test gives us a baseline either way — hearing is worth tracking like anything else about your health.
          </div>
        </div>
      ) : null}

      {unanswered.length > 0 && (
        <div style={{
          marginTop: 10, background: SLATE_BG, border: `1px solid ${BORDER}`,
          borderRadius: 10, padding: "12px 16px",
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, marginBottom: 8 }}>
            {unanswered.length === total
              ? "Let's walk through these together:"
              : "A few we didn't get your answer on:"}
          </div>
          {unanswered.map(item => (
            <InlineYesNo key={item.key} label={item.restatement} answerKey={item.key} onUpdateAnswer={onUpdateAnswer} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Beat 4 — Where you stand ────────────────────────────────────────
function WhereYouStand({ answers, gapCopy, notes, onUpdateNote }) {
  const rating = Number(answers.hear_rating) || null;
  const ready = answers.hear_ready;
  const picks = Array.isArray(answers.resistancePoints) ? answers.resistancePoints : [];
  const otherText = (answers.resistancePointsOther || "").trim();

  const resistanceHints = picks
    .map(k => RESISTANCE_REVIEW[k])
    .filter(Boolean)
    .map(r => `${r.label}: ${r.hint}`)
    .join("\n");

  if (!rating && ready == null && picks.length === 0) return null;

  return (
    <div>
      <BeatLabel>Where you stand</BeatLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rating != null && (
          <div style={{
            background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10,
            padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
          }}>
            <div style={{ textAlign: "center", minWidth: 110 }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: TEAL, lineHeight: 1 }}>
                {rating}<span style={{ fontSize: 20, color: MUTED, fontWeight: 600 }}> / 10</span>
              </div>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                How you rate your hearing
              </div>
            </div>
            {gapCopy && (
              <div style={{ flex: 1, minWidth: 260, fontSize: 14.5, color: TEXT, lineHeight: 1.6, fontWeight: 500 }}>
                {gapCopy}
              </div>
            )}
          </div>
        )}

        {ready != null && (
          <div style={{
            background: ready ? GREEN_BG : SLATE_BG,
            border: `1px solid ${ready ? GREEN_BORDER : BORDER}`,
            borderRadius: 10, padding: "14px 18px",
            fontSize: 14, fontWeight: 600, color: ready ? GREEN : TEXT, lineHeight: 1.5,
          }}>
            {ready
              ? "You told us you're ready to improve your hearing if a loss is found today."
              : "You're still weighing it — that's exactly what today is for. No decisions required to get answers."}
          </div>
        )}

        {picks.length > 0 && (
          <RevealCard
            noteKey="resistancePoints"
            prompt={resistanceHints}
            note={notes.resistancePoints || ""}
            onUpdateNote={onUpdateNote}
            style={{
              background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 8 }}>
              What's made this hard to address before:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {picks.map(k => {
                const r = RESISTANCE_REVIEW[k];
                const label = k === "other" && otherText ? otherText : (r ? r.label : k);
                return (
                  <span key={k} style={{
                    background: TEAL_BG, border: "1px solid #B7DDE2", borderRadius: 999,
                    padding: "5px 13px", fontSize: 13, fontWeight: 600, color: TEAL,
                  }}>
                    {label}
                  </span>
                );
              })}
            </div>
          </RevealCard>
        )}
      </div>
    </div>
  );
}

// ── Shared pieces ───────────────────────────────────────────────────

// Inline yes/no pills for questions the intake left unanswered, so the
// walk-through can fill gaps without leaving presentation mode.
function InlineYesNo({ label, answerKey, onUpdateAnswer }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "5px 0" }}>
      <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.4 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {[["Yes", true], ["No", false]].map(([txt, v]) => (
          <button key={txt} type="button" onClick={() => onUpdateAnswer(answerKey, v)}
            style={{
              padding: "5px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6,
              border: `1px solid ${BORDER}`, background: "#fff", color: TEXT,
              cursor: "pointer", fontFamily: "inherit",
            }}>
            {txt}
          </button>
        ))}
      </div>
    </div>
  );
}

// Card wrapper with the discreet provider reveal: an unlabeled "⋯"
// button in the corner. Expanded, it shows the deepening prompt and a
// note field writing to the shared providerNotes map. Deliberately
// small and gray — nothing on the closed card says "provider script".
function RevealCard({ children, noteKey, prompt, note, onUpdateNote, style }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(note || "");

  return (
    <div style={{ position: "relative", ...style }}>
      {prompt && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label="More"
          style={{
            position: "absolute", top: 8, right: 8,
            width: 24, height: 24, borderRadius: 6,
            border: "none", background: "transparent",
            color: open ? TEAL : "#c3c9d1", fontSize: 15, fontWeight: 700,
            cursor: "pointer", lineHeight: 1, padding: 0,
          }}
        >
          ⋯
        </button>
      )}
      {children}
      {open && prompt && (
        <div style={{
          marginTop: 12, padding: "10px 12px", background: SLATE_BG,
          border: `1px solid ${BORDER}`, borderRadius: 8,
        }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
            Provider
          </div>
          <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.55, whiteSpace: "pre-line", marginBottom: 8 }}>
            {prompt}
          </div>
          <textarea
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onUpdateNote(noteKey, local)}
            rows={2}
            placeholder="What they said…"
            style={{
              width: "100%", boxSizing: "border-box", padding: "6px 8px",
              fontSize: 12.5, border: `1px solid ${BORDER}`, borderRadius: 6,
              color: TEXT, background: "#fff", fontFamily: "inherit", outline: "none",
              resize: "vertical", minHeight: 42,
            }}
          />
        </div>
      )}
    </div>
  );
}
