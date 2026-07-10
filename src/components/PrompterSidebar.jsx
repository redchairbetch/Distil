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

import { useMemo } from "react";
import { getPTA, severityFromPTA, severityRank } from "../audiogramAnalysis.js";

// PrompterSidebar — provider-only support panel that runs alongside the
// wizard. Backlog #8, PR 2. Three things on screen at all times:
//   1. Talking points keyed to the current chapter (filtered by ctx)
//   2. Soft-commitment badge (read from intake assessment)
//   3. Close-readiness pill (motivation + WR gap + severity → 3 states)
//
// Self-contained: drawer chrome + readiness logic + content all live here.
// Inline styles to match the existing wizard aesthetic. Toggle button is
// pinned to the right edge so the drawer can be re-opened after collapse.

const NAVY = "#0a1628";
const NAVY_BG = "#f8fafc";
const SUBDUED = "#6b7280";
const BORDER = "#e5e7eb";
const TEAL = "#0A7B8C";
const TEAL_BG = "#F0F9FA";

// State colors for pills
const READY_GREEN = "#15803d";
const READY_GREEN_BG = "#f0fdf4";
const WARMING_AMBER = "#b45309";
const WARMING_AMBER_BG = "#fef3c7";
const NEUTRAL_GRAY = "#475569";
const NEUTRAL_GRAY_BG = "#f1f5f9";

// ── Talking points content ──────────────────────────────────────────
// Hardcoded per chapter. `base` is always shown; `conditional` items
// only render when their `when(ctx)` predicate returns truthy. Edit
// this object directly to refine the script over time.
const PROMPTER_CONTENT = {
  1: {
    base: [
      "Open with their own words — read back the chief complaint from intake before anything clinical.",
      "Confirm any red flags from the medical history with the patient out loud.",
      "Set the agenda: brief history → testing → results → options. Predictability lowers anxiety.",
    ],
    conditional: [
      { when: (ctx) => ctx.softCommitment === "high",
        text: "They're already leaning in. Validate their motivation; don't oversell." },
      { when: (ctx) => ctx.softCommitment === "low",
        text: "Slow down. Build rapport before testing. Find out what's holding them back." },
      { when: (ctx) => ctx.motivationScore != null && ctx.motivationScore <= 3,
        text: "Low motivation — find their personal 'why' (a specific person or situation) before moving on." },
    ],
  },
  2: {
    base: [
      "Walk through findings in plain language. They care about understanding, not numbers.",
      "Tie each finding back to a complaint they shared in intake — make the data feel personal.",
      "Pause for questions before moving to options. Let them sit with the diagnosis.",
    ],
    conditional: [
      { when: (ctx) => ctx.wrGap != null && ctx.wrGap >= 30,
        text: "Significant WR gap — 'Hearing isn't the same as understanding' is the key message." },
      { when: (ctx) => ctx.severity === "mild" || ctx.severity === "normal",
        text: "Mild or borderline finding — focus on prevention, listening fatigue, and acting early." },
      { when: (ctx) => severityRank(ctx.severity) >= severityRank("mod-severe"),
        text: "Moderate-severe or worse — be direct. Anchor to what they're missing today, not five years from now." },
    ],
  },
  3: {
    base: [
      "Lead with what they'll experience, not the technology.",
      "Frame tiers by listening effort, not hobbies: it's not whether they go out, it's how hard their brain works when they do.",
      "If they lean to a lower tier to save money, name the trade-off — fatigue in the noise they DO hit. Inform, don't push.",
      "Present patient cost first. Retail price is for anchoring only — never bare.",
    ],
    conditional: [
      { when: (ctx) => ctx.readiness === "ready",
        text: "Close-ready — make a clear recommendation. Don't hedge with 'or you could…'." },
      { when: (ctx) => ctx.readiness === "not_yet",
        text: "Not ready — frame options as 'when you're ready' rather than 'today'. Plant seeds." },
    ],
  },
  4: {
    base: [
      "Complete Care+ is the recommendation. Default is opt-out, not opt-in.",
      "Reframe the price: 'Over five years, that's $X/month for unlimited care.'",
      "Address the investment question: 'What's it worth to hear your grandkids on the phone?'",
    ],
    conditional: [
      { when: (ctx) => ctx.payType === "private",
        text: "Private pay — Complete Care+ is bundled. The patient cost they're seeing already includes it." },
    ],
  },
  5: {
    base: [
      "Confirm the fitting date and what to expect at the fitting.",
      "Schedule the day-2 check-in call before they leave the office.",
      "Set the warranty calendar reminder — tied to fitting date, not today.",
      "Reinforce the adaptation period mindset (not 'trial', not 'demo').",
    ],
    conditional: [],
  },
};

const CHAPTER_NAMES = {
  1: "Patient story",
  2: "Evidence",
  3: "Recommendation",
  4: "Investment",
  5: "Commitment",
};

// ── Readiness logic ─────────────────────────────────────────────────
// Returns { state, rationale } where state is one of:
//   'ready'    — go for the close
//   'warming'  — directionally positive but not all signals aligned
//   'not_yet'  — slow down
//   'unknown'  — not enough data to decide
function computeReadiness(ctx) {
  const { motivationScore, severity, wrGap } = ctx;

  if (motivationScore == null) {
    return { state: "unknown", rationale: "Set motivation score in Health History to enable readiness signal." };
  }

  const hasSeverity = severity && severity !== "normal";
  const hasGap = wrGap != null && wrGap >= 15;
  const isMotivated = motivationScore >= 7;
  const isUnmotivated = motivationScore <= 3;

  // Compose the rationale from whichever signals are present.
  const parts = [`Motivation ${motivationScore}/10`];
  if (severity) parts.push(`${severity === "mod-severe" ? "mod-severe" : severity} loss`);
  if (wrGap != null) parts.push(`${wrGap}-pt WR gap`);
  const rationale = parts.join(" · ");

  if (isMotivated && hasSeverity && hasGap) {
    return { state: "ready", rationale };
  }
  if (isUnmotivated || (severity === "normal" && (wrGap == null || wrGap < 10))) {
    return { state: "not_yet", rationale };
  }
  return { state: "warming", rationale };
}

// Worst (lowest) WR score across both ears, or null if neither captured.
// Falls back from CCT to unaided word recognition the same way
// renderResultsContent does in Distil.jsx.
function computeWorstWR(audiology) {
  if (!audiology) return null;
  const r = audiology.cctR ?? audiology.unaidedR ?? null;
  const l = audiology.cctL ?? audiology.unaidedL ?? null;
  const scores = [r, l].filter(v => v != null);
  return scores.length ? Math.min(...scores) : null;
}

function computeWorstSeverity(audiology) {
  if (!audiology) return null;
  const ptaR = getPTA(audiology.rightT);
  const ptaL = getPTA(audiology.leftT);
  const sR = severityFromPTA(ptaR);
  const sL = severityFromPTA(ptaL);
  if (!sR && !sL) return null;
  if (!sR) return sL;
  if (!sL) return sR;
  return severityRank(sR) >= severityRank(sL) ? sR : sL;
}

// ── Component ───────────────────────────────────────────────────────
export default function PrompterSidebar({
  open,
  onToggle,
  chapter,           // 1..5 or null
  chapterTitle,
  motivationScore,
  softCommitment,
  audiology,
  payType,
  tier,
  carePlan,
}) {
  const ctx = useMemo(() => {
    const severity = computeWorstSeverity(audiology);
    const worstWR = computeWorstWR(audiology);
    const wrGap = worstWR != null ? 100 - worstWR : null;
    const readiness = computeReadiness({ motivationScore, severity, wrGap });
    return {
      motivationScore,
      softCommitment,
      severity,
      wrGap,
      readiness: readiness.state,
      rationale: readiness.rationale,
      payType,
      tier,
      carePlan,
    };
  }, [motivationScore, softCommitment, audiology, payType, tier, carePlan]);

  const content = chapter ? PROMPTER_CONTENT[chapter] : null;
  const points = content
    ? [
        ...content.base.map(text => ({ text, conditional: false })),
        ...content.conditional.filter(c => c.when(ctx)).map(c => ({ text: c.text, conditional: true })),
      ]
    : [];

  return (
    <>
      {/* Toggle handle — pinned to right edge so it's reachable open or closed */}
      <button
        type="button"
        onClick={onToggle}
        title={open ? "Hide prompter" : "Show prompter"}
        style={{
          position: "fixed",
          top: "50%",
          right: open ? 300 : 0,
          transform: "translateY(-50%)",
          zIndex: 9997,
          width: 36, height: 96,
          background: NAVY, color: "white",
          border: "none",
          borderRadius: open ? "8px 0 0 8px" : "8px 0 0 8px",
          cursor: "pointer",
          fontFamily: "'Sora',sans-serif",
          fontWeight: 700, fontSize: 11,
          letterSpacing: "0.06em",
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          padding: "10px 4px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          transition: "right 220ms ease",
        }}
      >
        {open ? "HIDE" : "PROMPTER"}
      </button>

      {/* Drawer */}
      <aside
        aria-label="Provider prompter"
        style={{
          position: "fixed",
          top: 0, right: 0, bottom: 0,
          width: 300,
          zIndex: 9996,
          background: "white",
          borderLeft: `1px solid ${BORDER}`,
          boxShadow: "-8px 0 24px rgba(0,0,0,0.08)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Sora',sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: `1px solid ${BORDER}`,
          background: NAVY_BG,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: TEAL }}>
            Provider prompter
          </div>
          <div style={{
            fontFamily: "'Fraunces',Georgia,serif",
            fontSize: 19, fontWeight: 700, color: NAVY,
            marginTop: 2, lineHeight: 1.2, letterSpacing: "-0.01em",
          }}>
            {chapter ? `Ch ${chapter} — ${CHAPTER_NAMES[chapter] || chapterTitle}` : "—"}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          <ReadinessPill state={ctx.readiness} rationale={ctx.rationale} />
          <SoftCommitmentBadge value={ctx.softCommitment} />

          {points.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBDUED, marginBottom: 10 }}>
                Talking points
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {points.map((p, i) => (
                  <li key={i} style={{
                    fontSize: 13, lineHeight: 1.5, color: NAVY,
                    paddingLeft: 14, position: "relative",
                    fontFamily: "'DM Sans',sans-serif",
                  }}>
                    <span style={{
                      position: "absolute", left: 0, top: 7,
                      width: 6, height: 6, borderRadius: "50%",
                      background: p.conditional ? TEAL : NAVY,
                    }} />
                    {p.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 20px",
          borderTop: `1px solid ${BORDER}`,
          fontSize: 10, color: SUBDUED, fontFamily: "'DM Sans',sans-serif",
        }}>
          Provider-only · Not shown to the patient
        </div>
      </aside>
    </>
  );
}

// ── Pills ───────────────────────────────────────────────────────────
function ReadinessPill({ state, rationale }) {
  const stateConfig = {
    ready:   { label: "Close-ready",   fg: READY_GREEN,   bg: READY_GREEN_BG,   dot: READY_GREEN },
    warming: { label: "Warming up",    fg: WARMING_AMBER, bg: WARMING_AMBER_BG, dot: WARMING_AMBER },
    not_yet: { label: "Not yet",       fg: NEUTRAL_GRAY,  bg: NEUTRAL_GRAY_BG,  dot: NEUTRAL_GRAY },
    unknown: { label: "Insufficient",  fg: NEUTRAL_GRAY,  bg: NEUTRAL_GRAY_BG,  dot: NEUTRAL_GRAY },
  }[state] || { label: "—", fg: NEUTRAL_GRAY, bg: NEUTRAL_GRAY_BG, dot: NEUTRAL_GRAY };

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBDUED, marginBottom: 6 }}>
        Close-readiness
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 12px",
        background: stateConfig.bg,
        color: stateConfig.fg,
        borderRadius: 999,
        fontSize: 12, fontWeight: 700,
        fontFamily: "'Sora',sans-serif",
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: stateConfig.dot }} />
        {stateConfig.label}
      </div>
      <div style={{
        marginTop: 8, fontSize: 12, color: SUBDUED,
        lineHeight: 1.5, fontFamily: "'DM Sans',sans-serif",
      }}>
        {rationale}
      </div>
    </div>
  );
}

function SoftCommitmentBadge({ value }) {
  const cfg = {
    high:    { label: "High",    fg: READY_GREEN,   bg: READY_GREEN_BG },
    medium:  { label: "Medium",  fg: TEAL,          bg: TEAL_BG },
    low:     { label: "Low",     fg: WARMING_AMBER, bg: WARMING_AMBER_BG },
    unknown: { label: "Unknown", fg: NEUTRAL_GRAY,  bg: NEUTRAL_GRAY_BG },
  }[value] || { label: "—", fg: NEUTRAL_GRAY, bg: NEUTRAL_GRAY_BG };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBDUED, marginBottom: 6 }}>
        Soft commitment
      </div>
      <span style={{
        display: "inline-flex", alignItems: "center",
        padding: "5px 12px",
        background: cfg.bg, color: cfg.fg,
        borderRadius: 999,
        fontSize: 12, fontWeight: 700,
        fontFamily: "'Sora',sans-serif",
      }}>
        {cfg.label}
      </span>
    </div>
  );
}
