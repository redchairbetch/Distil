import { useEffect } from "react";

// ChapterIntro — full-screen overlay shown between wizard steps to mark
// the start of a new "chapter" of the patient's narrative arc. Backlog
// item #8 (Narrative Thread UX). Each chapter intro carries one line
// forward from the prior chapter so the appointment reads as a continuous
// story instead of a checklist.
//
// Props:
//   number          — 1..5
//   title           — chapter title, e.g. "Patient story"
//   prevSummary     — optional one-line carry-forward from the prior chapter
//   complaintQuote  — optional patient's-own-words quote (Ch 1 / Ch 3)
//   onBegin         — callback fired by the Begin button, click-outside, or Escape
//
// Inline styles to match the rest of the wizard. Click-outside + Escape
// both dismiss (so a confident provider can fly through without clicking
// the button).

const NAVY = "#0a1628";
const GREEN = "#15803d";
const LIGHT_GRAY_BORDER = "#e5e7eb";
const SUBDUED = "#6b7280";

export default function ChapterIntro({
  number,
  title,
  prevSummary = null,
  complaintQuote = null,
  onBegin,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onBegin?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBegin]);

  return (
    <div
      onClick={onBegin}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(10,22,40,0.55)", backdropFilter: "blur(4px)",
        zIndex: 9998,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: 16,
          padding: "40px 44px",
          width: "100%", maxWidth: 560,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          fontFamily: "'Sora',sans-serif",
        }}
      >
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: GREEN, marginBottom: 10,
        }}>
          Chapter {number} of 5
        </div>

        <h1 style={{
          fontFamily: "'Fraunces',Georgia,serif",
          fontSize: 34, fontWeight: 700, color: NAVY,
          letterSpacing: "-0.02em", lineHeight: 1.15,
          margin: 0,
        }}>
          {title}
        </h1>

        {prevSummary && (
          <div style={{
            marginTop: 18,
            fontSize: 13, color: SUBDUED, lineHeight: 1.55,
          }}>
            {prevSummary}
          </div>
        )}

        {complaintQuote && (
          <div style={{
            marginTop: 18,
            padding: "14px 18px",
            background: "#f8fafc",
            borderLeft: `3px solid ${NAVY}`,
            borderRadius: "0 10px 10px 0",
          }}>
            <div style={{
              fontFamily: "Georgia,serif", fontStyle: "italic",
              fontSize: 16, color: NAVY, lineHeight: 1.5,
            }}>
              &ldquo;{complaintQuote}&rdquo;
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: SUBDUED,
              marginTop: 6,
            }}>
              In their own words
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onBegin}
          style={{
            marginTop: 28,
            background: NAVY, color: "white",
            border: "none", borderRadius: 10,
            padding: "14px 28px",
            fontFamily: "inherit", fontWeight: 700, fontSize: 14,
            letterSpacing: "0.02em",
            cursor: "pointer",
          }}
        >
          Begin
        </button>

        <div style={{
          marginTop: 16, fontSize: 11, color: SUBDUED,
        }}>
          Press <kbd style={kbdStyle}>Esc</kbd> or click outside to continue.
        </div>
      </div>
    </div>
  );
}

const kbdStyle = {
  fontFamily: "monospace",
  fontSize: 10,
  padding: "1px 5px",
  border: `1px solid ${LIGHT_GRAY_BORDER}`,
  borderRadius: 3,
  background: "#f8fafc",
  color: NAVY,
};
