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

// ── CouplesComparison — spousal side-by-side counseling view ────────────────
// Reached from Consultation Mode. The provider searches for the partner's
// chart (pre-filled from the intake's spouse name when we have it) and both
// patients' results render as matched row-cards: audiogram, hearing levels,
// speech understanding, technology level, style guidance. The payload is the
// "why this for you and that for them" conversation.
//
// Deliberately self-contained: own local state only — none of consultation
// mode's singleton counseling state (draw canvas, phoneme dim, hearing sim)
// is shared, which is what makes rendering two audiograms safe. Pairing is
// ad-hoc per session; nothing is persisted. STRICTLY READ-ONLY: this view
// must never call generateRecommendation — looking at a spouse's results
// must not write to or supersede anything on their chart. When no persisted
// recommendation exists, the engine runs ephemerally in memory instead.
import React, { useState, useEffect, useRef } from "react";
import {
  searchPatientsGlobal,
  loadIntakesForPatient,
  loadCurrentRecommendation,
  loadPatientRecommendationInputs,
} from "../db.js";
import { runRecommendationEngine, unwrapIntakeAnswers } from "../recommendationEngine.js";
import {
  SEVERITY_DISPLAY,
  buildPersonSummary,
  clarityColor,
  patientTierLabel,
  tierProcessingPhrase,
  styleGuidance,
} from "../lib/coupleComparison.js";
import { AudigramSVG } from "../components/AudiogramSVG.jsx";
import { COLOR, FONT } from "../theme.js";

const card = {
  background: COLOR.card,
  border: `1px solid ${COLOR.line}`,
  borderRadius: 12,
  padding: "16px 18px",
};
const cardTitle = {
  fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
  color: COLOR.ink3, marginBottom: 10,
};

// Resolve one person's tier recommendation without side effects. Persisted
// active row first (respecting provider-edited rationale); otherwise run the
// engine ephemerally. Returns a RecState the tech-level card can render.
async function resolveRecommendation(p) {
  const summary = buildPersonSummary(p.audiology);
  if (!summary.hasThresholds) {
    return { status: "none", copy: "A hearing test is needed before we can tailor a recommendation." };
  }
  if (summary.normalHearing) {
    return { status: "none", copy: "Hearing in the normal range — no device is recommended today." };
  }
  try {
    const row = await loadCurrentRecommendation(p.id);
    if (row?.recommended_tier_rank != null) {
      return {
        status: "ready",
        rank: row.recommended_tier_rank,
        rationale: row.provider_edited_rationale_text || row.generated_rationale_text || "",
      };
    }
    const inputs = await loadPatientRecommendationInputs(p.id);
    const result = runRecommendationEngine(inputs.audiogram, inputs.thresholds, inputs.intakeAnswers);
    if (result.blocked) {
      return { status: "none", copy: "A hearing test is needed before we can tailor a recommendation." };
    }
    return { status: "ready", rank: result.recommendedRank, rationale: result.rationale };
  } catch (err) {
    console.error("CouplesComparison resolveRecommendation:", err);
    return { status: "none", copy: "Guidance isn't available for this chart right now." };
  }
}

export default function CouplesComparison({ patient, clinicId, onExit }) {
  const [partner, setPartner] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [recs, setRecs] = useState({}); // patientId → RecState
  const aliveRef = useRef(true);
  const searchSeq = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // Spouse-name prefill from the most recent intake — best-effort.
  useEffect(() => {
    let cancelled = false;
    loadIntakesForPatient(patient.id).then(intakes => {
      if (cancelled) return;
      const answers = unwrapIntakeAnswers(intakes[0]?.answers);
      const spouseName = (answers?.spouseName || "").trim();
      if (spouseName) {
        setSearchTerm(prev => {
          if (prev) return prev;
          setPrefilled(true);
          return spouseName;
        });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [patient.id]);

  // Debounced org-wide partner search; the index patient never appears in
  // their own results.
  useEffect(() => {
    if (partner) return;
    const term = searchTerm.trim();
    if (term.length < 2) { setResults([]); setSearchedOnce(false); return; }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchPatientsGlobal(term);
      if (!aliveRef.current || seq !== searchSeq.current) return;
      setResults(found.filter(r => r.id !== patient.id));
      setSearching(false);
      setSearchedOnce(true);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, partner, patient.id]);

  // Recommendation per person — index patient on mount, partner on pick.
  useEffect(() => {
    const people = [patient, partner].filter(Boolean);
    people.forEach(p => {
      if (recs[p.id]) return;
      setRecs(prev => ({ ...prev, [p.id]: { status: "loading" } }));
      resolveRecommendation(p).then(rec => {
        if (aliveRef.current) setRecs(prev => ({ ...prev, [p.id]: rec }));
      });
    });
  }, [patient, partner]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── per-person cards ──────────────────────────────────────────────────────

  const nameCard = (p) => (
    <div style={{ ...card, display: "flex", alignItems: "baseline", gap: 10, padding: "12px 18px" }}>
      <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 700, color: COLOR.ink }}>{p.name}</div>
      {p.dob && <div style={{ fontSize: 12, color: COLOR.ink2 }}>DOB {p.dob}</div>}
      {p === partner && (
        <button onClick={() => setPartner(null)}
          style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: COLOR.ink2, background: "transparent", border: `1px solid ${COLOR.line}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
          Change partner
        </button>
      )}
    </div>
  );

  const audiogramCard = (p, summary) => (
    <div style={card}>
      <div style={cardTitle}>Audiogram</div>
      {summary.hasThresholds ? (
        <div style={{ background: "#fafafa", border: `1px solid ${COLOR.line}`, borderRadius: 10, padding: "10px 6px" }}>
          <AudigramSVG
            rightT={p.audiology?.rightT || {}} leftT={p.audiology?.leftT || {}}
            rightBC={p.audiology?.rightBC || {}} leftBC={p.audiology?.leftBC || {}}
            rightMask={p.audiology?.rightMask || {}} leftMask={p.audiology?.leftMask || {}}
            rightBCMask={p.audiology?.rightBCMask || {}} leftBCMask={p.audiology?.leftBCMask || {}}
            interactive={false} showBanana={true} presentation={true}
          />
        </div>
      ) : (
        <div style={{ fontSize: 13, color: COLOR.ink2, padding: "24px 8px", textAlign: "center" }}>
          No hearing test on file yet — we can add {p.name.split(" ")[0]}&rsquo;s results after a hearing evaluation.
        </div>
      )}
    </div>
  );

  const severityChip = (label, severity, pta4, palette) => (
    <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 8, padding: "10px 16px", flex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: palette.accent, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#0a1628" }}>
        {severity ? SEVERITY_DISPLAY[severity] : "—"}
      </div>
      <div style={{ fontSize: 10, color: COLOR.ink3, marginTop: 2 }}>
        {severity == null ? "Not tested" : pta4 != null ? `${pta4} dB 4-frequency average` : ""}
      </div>
    </div>
  );

  const levelsCard = (summary) => (
    <div style={card}>
      <div style={cardTitle}>Hearing Levels</div>
      <div style={{ display: "flex", gap: 10 }}>
        {severityChip("Right Ear", summary.rSeverity, summary.rPTA4, { bg: "#fef2f2", border: "#fecaca", accent: "#dc2626" })}
        {severityChip("Left Ear", summary.lSeverity, summary.lPTA4, { bg: "#eff6ff", border: "#bfdbfe", accent: "#2563eb" })}
      </div>
      {summary.asymmetric && (
        <div style={{ fontSize: 12, color: COLOR.ink2, marginTop: 10 }}>
          The two ears differ noticeably — each ear gets its own settings.
        </div>
      )}
    </div>
  );

  const scoreCell = (label, value, colored) => (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: COLOR.ink2, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: colored ? clarityColor(value) : "#0a1628" }}>
        {value != null ? `${value}%` : "—"}
      </div>
    </div>
  );

  const speechCard = (p, summary) => (
    <div style={card}>
      <div style={cardTitle}>Speech Understanding</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#dc2626", marginBottom: 8 }}>Right Ear</div>
          <div style={{ display: "flex", gap: 16 }}>
            {scoreCell("Word recognition", summary.unaidedR, false)}
            {scoreCell("Word clarity", summary.clarityR, true)}
          </div>
        </div>
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#2563eb", marginBottom: 8 }}>Left Ear</div>
          <div style={{ display: "flex", gap: 16 }}>
            {scoreCell("Word recognition", summary.unaidedL, false)}
            {scoreCell("Word clarity", summary.clarityL, true)}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: COLOR.ink3, marginTop: 8 }}>
        Word clarity is measured at a comfortable volume — it shows understanding, not loudness.
      </div>
    </div>
  );

  const techCard = (p) => {
    const rec = recs[p.id];
    return (
      <div style={card}>
        <div style={cardTitle}>Technology Level</div>
        {!rec || rec.status === "loading" ? (
          <div style={{ fontSize: 13, color: COLOR.ink2 }}>Preparing guidance…</div>
        ) : rec.status === "none" ? (
          <div style={{ fontSize: 13, color: COLOR.ink2 }}>{rec.copy}</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ background: "#f0fdfa", border: "1px solid #5eead4", color: "#0f766e", borderRadius: 14, padding: "3px 14px", fontSize: 13, fontWeight: 800 }}>
                {patientTierLabel(rec.rank) || "—"}
              </span>
              {tierProcessingPhrase(rec.rank) && (
                <span style={{ fontSize: 12, color: COLOR.ink2 }}>{tierProcessingPhrase(rec.rank)} processing</span>
              )}
            </div>
            {rec.rationale && <div style={{ fontSize: 13, color: COLOR.ink, lineHeight: 1.55 }}>{rec.rationale}</div>}
          </>
        )}
      </div>
    );
  };

  const styleCard = (summary, guidance) => (
    <div style={card}>
      <div style={cardTitle}>Style Guidance</div>
      {guidance ? (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLOR.ink, marginBottom: 6 }}>{guidance.headline}</div>
          {guidance.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 12.5, color: COLOR.ink2, lineHeight: 1.5, marginBottom: 4 }}>{n}</div>
          ))}
        </>
      ) : (
        <div style={{ fontSize: 13, color: COLOR.ink2 }}>
          Style guidance will appear once a hearing test is on file.
        </div>
      )}
    </div>
  );

  const personCards = (p) => {
    const summary = buildPersonSummary(p.audiology);
    const guidance = styleGuidance(p.audiology);
    return [
      nameCard(p),
      audiogramCard(p, summary),
      levelsCard(summary),
      speechCard(p, summary),
      techCard(p),
      styleCard(summary, guidance),
    ];
  };

  // ── partner search panel ──────────────────────────────────────────────────

  const searchPanel = (
    <div style={card}>
      <div style={cardTitle}>Find Their Partner</div>
      <input
        type="text" value={searchTerm} autoFocus
        onChange={e => { setSearchTerm(e.target.value); setPrefilled(false); }}
        placeholder="Search by name or phone…"
        style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "10px 12px", border: `1px solid ${COLOR.line}`, borderRadius: 8, outline: "none", fontFamily: FONT.ui }}
      />
      {prefilled && (
        <div style={{ fontSize: 11, color: "#0f766e", marginTop: 6 }}>Pre-filled from {patient.name.split(" ")[0]}&rsquo;s intake.</div>
      )}
      <div style={{ marginTop: 10 }}>
        {searchTerm.trim().length < 2 && (
          <div style={{ fontSize: 12, color: COLOR.ink3, padding: "4px 2px" }}>Type at least two letters to search all locations.</div>
        )}
        {searching && <div style={{ fontSize: 12, color: COLOR.ink3, padding: "4px 2px" }}>Searching…</div>}
        {!searching && searchedOnce && results.length === 0 && (
          <div style={{ fontSize: 12, color: COLOR.ink3, padding: "4px 2px" }}>No patients match &ldquo;{searchTerm.trim()}&rdquo;.</div>
        )}
        {!searching && results.map(r => (
          <button key={r.id} onClick={() => { setPartner(r); setResults([]); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", padding: "9px 12px", marginBottom: 6, borderRadius: 8, border: `1px solid ${COLOR.line}`, background: "white", cursor: "pointer", fontFamily: FONT.ui }}>
            <span>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#111" }}>{r.name}</span>
              <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>DOB {r.dob || "—"}</span>
            </span>
            {r.location && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#0f766e", background: "#f0fdfa", border: "1px solid #5eead4", borderRadius: 12, padding: "1px 8px" }}>{r.location}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  // ── layout ────────────────────────────────────────────────────────────────
  // With a partner picked, both people's cards go into one grid in row-major
  // order (A-name, B-name, A-audiogram, B-audiogram, …) so each section pair
  // shares a row and lines up across the couple.

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", fontFamily: FONT.ui }}>
      <div style={{ fontSize: 13, color: COLOR.ink2, margin: "2px 2px 14px" }}>
        Seeing both sets of results together shows how each hearing profile calls for its own approach.
      </div>
      {partner ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {(() => {
            const a = personCards(patient), b = personCards(partner);
            return a.map((cardEl, i) => (
              <React.Fragment key={`row-${i}`}>
                {cardEl}
                {b[i]}
              </React.Fragment>
            ));
          })()}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{personCards(patient)}</div>
          {searchPanel}
        </div>
      )}
    </div>
  );
}
