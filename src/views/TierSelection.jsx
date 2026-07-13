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

import { useState, useEffect, useMemo } from "react";
import { generateRecommendation, loadCurrentRecommendation } from "../db.js";
import { COLOR, FONT, SHADOW } from "../theme.js";
import {
  ENVIRONMENTS,
  COVERAGE_BY_RANK,
  SITUATION_LABEL,
  TIER_EFFORT_COPY,
  EFFORT_SIGNAL_LABEL,
  flaggedEnvironments,
  flaggedEffortSignals,
} from "../listeningSituations.js";
import { EnvironmentCoverage } from "../components/CoverageBars.jsx";

// Technology Tier Selection — wizard step between Results and Device
// Selection. Shows the patient three tier cards (filtered by insurance
// coverage) with a personalized lifestyle chart that visualizes how
// each tier handles the environments the patient flagged as struggles.
//
// Engine recommendation is computed on mount via the existing engine
// (PR #52 infrastructure) — this component is the visual surface, not
// the brains. Plain-transparency rationale shown above the cards.

// Colors mapped onto the Clinical-luxe design tokens (src/theme.js). The names
// are kept so the render below reads unchanged; the values now come from the
// shared system (warm paper · pine/teal brand · brass for value).
const TEAL = COLOR.teal;
const TEAL_BG = COLOR.tealSoft;
const TEAL_DARK = COLOR.tealInk;
const TEXT = COLOR.ink;
const MUTED = COLOR.ink2;
const FAINT = COLOR.ink3;
const BORDER = COLOR.line;
const RECOMMEND = COLOR.pine;
const BG_SOFT = COLOR.paper2;
const BRASS = COLOR.brass;
const BRASS_SOFT = COLOR.brassSoft;
const BRASS_INK = COLOR.brassInk;

// ENVIRONMENTS, COVERAGE_BY_RANK, INTAKE_TO_ENVS → moved to
// ../listeningSituations.js (shared with the Pricing Reveal — context.md #25).

// Marketing labels → engine ranks. Anchored on the three TruHearing
// plan tiers and the three clinic_retail_anchors slugs in current use.
// "Premium" is TruHearing's name; "Select" is private-pay's top tier.
// Signia's manufacturer_class anchors use numeric level labels (7/5/3/2/1)
// where 7≈Premium, 5≈Advanced, 3≈Standard. Levels 1 and 2 sit below the
// three-tier matrix; pickRecommendedTier excludes them from the engine
// pool but they get full coverage charts so the patient can compare.
// three-tier coverage matrix and intentionally return null.
function tierLabelToRank(label) {
  if (!label) return null;
  const l = String(label).toLowerCase().trim();
  if (l === "premium" || l === "select" || l === "7") return 5;
  if (l === "advanced" || l === "5") return 3;
  if (l === "standard" || l === "3") return 1;
  if (l === "level 2" || l === "2") return 0;
  if (l === "level 1" || l === "1") return -1;
  return null;
}

// flaggedEnvironments → moved to ../listeningSituations.js

// Pick the tier the engine recommends, capped to what the plan covers.
// If the engine's pick isn't available (TruHearing locks tier list),
// fall back to the highest covered tier. Returns { tier, capped, originalRank }.
//
// The pool is floored at rank ≥ 1 (Standard) — levels 0 and -1 are
// "value" tiers shown only behind the accordion, never auto-recommended.
function pickRecommendedTier(engineRank, availableTiers) {
  if (!engineRank || availableTiers.length === 0) return { tier: null, capped: false };
  const ranked = availableTiers
    .map(t => ({ ...t, rank: tierLabelToRank(t.label) }))
    .filter(t => t.rank != null && t.rank >= 1)
    .sort((a, b) => b.rank - a.rank); // highest rank first
  // No primary tier (Std/Adv/Premium) maps for this plan — fall back
  // to manual selection in the UI; provider picks from the value tiers.
  // Plan tiers can use labels outside the ranked set (e.g. "Level 1" / "Level 2").
  // When nothing maps, return no recommendation — the provider can still pick.
  if (ranked.length === 0) return { tier: null, capped: false, originalRank: engineRank };
  const exact = ranked.find(t => t.rank === engineRank);
  if (exact) return { tier: exact, capped: false, originalRank: engineRank };
  // No exact match → take the highest available tier at or below engine rank
  const best = ranked.find(t => t.rank <= engineRank) || ranked[0];
  return { tier: best, capped: best.rank < engineRank, originalRank: engineRank };
}

function rankToLabel(rank) {
  if (rank === 5) return "Premium";
  if (rank === 3) return "Advanced";
  if (rank === 1) return "Standard";
  if (rank === 0) return "Level 2";
  if (rank === -1) return "Level 1";
  return "—";
}

export default function TierSelection({
  patientId, clinicId,
  selectedTier, onSelectTier,
  planTiers, payType, isPrivateLabel,
  retailAnchors,
  intakeAnswers,
  tierBlurbs = {},
}) {
  const [engineResult, setEngineResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [engineError, setEngineError] = useState(null);

  // Compute the list of tiers we can show for this flow.
  const availableTiers = useMemo(() => {
    if (isPrivateLabel) {
      return (planTiers || []).map(t => ({ label: t.label, price: t.price, source: "insurance" }));
    }
    if (payType === "private") {
      return (retailAnchors || []).map(a => ({
        label: a.label || rankToLabel(tierLabelToRank(a.id?.toUpperCase()) || 0),
        price: Number(a.price_per_aid),
        source: "private",
      }));
    }
    return [];
  }, [isPrivateLabel, payType, planTiers, retailAnchors]);

  // Load-or-generate: reuse the existing recommendation row if one's
  // active for this patient (set by /distil/select or a prior wizard
  // pass), otherwise run the engine and persist. Avoids row spam from
  // re-entering the step within the same session.
  useEffect(() => {
    if (!patientId || !clinicId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        let current = await loadCurrentRecommendation(patientId);
        if (cancelled) return;
        if (!current) {
          current = await generateRecommendation(patientId, clinicId);
          if (cancelled) return;
          if (current?.blocked) {
            setEngineError(current.reason || "Engine could not generate a recommendation.");
            setLoading(false);
            return;
          }
        }
        setEngineResult(current);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        console.error("TierSelection engine load:", e);
        setEngineError("Recommendation engine unavailable.");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, clinicId]);

  const recommended = useMemo(
    () => pickRecommendedTier(engineResult?.recommended_tier_rank, availableTiers),
    [engineResult, availableTiers]
  );
  const flagged = useMemo(() => flaggedEnvironments(intakeAnswers), [intakeAnswers]);
  const effortSignals = useMemo(() => flaggedEffortSignals(intakeAnswers), [intakeAnswers]);
  // Distinguish "no intake on file" from "intake exists but nothing flagged"
  // so the banner copy doesn't tell a patient who answered every question
  // that no intake answers were available.
  const hasIntakeAnswers = intakeAnswers != null
    && typeof intakeAnswers === "object"
    && Object.keys(intakeAnswers).length > 0;

  // Split tiers into primary (Std/Adv/Premium, rank ≥ 1) and value
  // (Levels 1/2 and any unranked label). Primary cards render up front;
  // value cards are gated behind an accordion so the patient defaults
  // to the three options that match their lifestyle.
  const { primaryTiers, valueTiers } = useMemo(() => {
    const primary = [];
    const value = [];
    for (const t of availableTiers) {
      const r = tierLabelToRank(t.label);
      if (r != null && r >= 1) primary.push(t);
      else value.push(t);
    }
    return { primaryTiers: primary, valueTiers: value };
  }, [availableTiers]);

  const [showValueTiers, setShowValueTiers] = useState(false);

  // Cards are selectable as soon as the tier list has loaded. The
  // engine's recommendation stays visually anchored (⭐ badge + teal
  // border on the recommended card) regardless of what the patient
  // picks — so a patient can downgrade for affordability without
  // losing the recommendation context, and pricing updates downstream.
  const cardsSelectable = !loading && availableTiers.length > 0;

  // Adopt the engine's pick as the default selection when no tier is
  // chosen yet, or when the prior choice is no longer valid for the
  // current tier list (e.g. plan changed via back-nav). Once the user
  // makes a deliberate selection, leave it alone — the recommendation
  // stays highlighted but does not override.
  useEffect(() => {
    if (!recommended?.tier) return;
    const stillValid = selectedTier && availableTiers.some(t => t.label === selectedTier);
    if (!stillValid) {
      onSelectTier(recommended.tier.label, recommended.tier.price);
    }
    // selectedTier intentionally excluded from deps — re-anchor only
    // when the engine pick or available tier list changes, not on
    // user selection (which would create an override-defeating loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended?.tier?.label, recommended?.tier?.price, availableTiers]);

  if (availableTiers.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Technology Tier</div>
        <div style={{ padding:24, color:MUTED, fontSize:14, textAlign:"center" }}>
          Tier selection isn't available for this plan type. Continue to device selection.
        </div>
      </div>
    );
  }

  const renderGrid = (tiers) => (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${tiers.length}, 1fr)`, gap:16 }}>
      {tiers.map(tier => (
        <TierCard
          key={tier.label}
          tier={tier}
          selected={selectedTier === tier.label}
          recommended={recommended?.tier?.label === tier.label}
          selectable={cardsSelectable}
          blurb={tierBlurbs[tier.label]}
          flagged={flagged}
          onSelect={() => onSelectTier(tier.label, tier.price)}
        />
      ))}
    </div>
  );

  return (
    <div style={{ background: COLOR.card, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, boxShadow: SHADOW.md, fontFamily: FONT.ui }}>
      <div style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 600, color: TEXT, letterSpacing: "0.1px" }}>
        Here's what we found — and your options
      </div>
      <div style={{ fontSize: 13, color: FAINT, marginTop: 3, marginBottom: 18 }}>
        Based on what you told us and your hearing test.
      </div>

      <IntakeReflection flagged={flagged} effortSignals={effortSignals} hasIntakeAnswers={hasIntakeAnswers} />

      <RecommendationBanner
        loading={loading}
        engineError={engineError}
        recommended={recommended}
        rationaleText={engineResult?.generated_rationale_text}
        flaggedCount={flagged.size}
        hasIntakeAnswers={hasIntakeAnswers}
      />

      {primaryTiers.length === 0 ? (
        // Plan has no primary tier — render value tiers directly so the
        // provider can pick something. No accordion needed.
        <div style={{ marginTop:16 }}>{renderGrid(valueTiers)}</div>
      ) : (
        <>
          <div style={{ marginTop:16 }}>{renderGrid(primaryTiers)}</div>
          {valueTiers.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowValueTiers(s => !s)}
                style={{
                  display:"block", width:"100%",
                  marginTop:20, marginBottom: showValueTiers ? 12 : 0,
                  padding:"10px 16px",
                  background:"transparent",
                  border:`1px dashed ${BORDER}`, borderRadius:8,
                  color:MUTED, fontSize:13, fontWeight:600,
                  fontFamily:"inherit",
                  cursor:"pointer",
                  letterSpacing:"0.02em",
                }}
              >
                {showValueTiers ? "Hide all options ▴" : "Show all options ▾"}
              </button>
              {showValueTiers && renderGrid(valueTiers)}
            </>
          )}
        </>
      )}
    </div>
  );
}

// "Here's what you told us" — reflects the patient's flagged listening
// situations back as warm chips at the top of the step, plus brass chips for
// the effort signals (drained / concentrating hard), which are the felt cost
// rather than a place. Renders nothing if there's no intake on file or
// nothing was flagged.
function IntakeReflection({ flagged, effortSignals = [], hasIntakeAnswers }) {
  if (!hasIntakeAnswers || (flagged.size === 0 && effortSignals.length === 0)) return null;
  const labels = ENVIRONMENTS
    .filter(e => flagged.has(e.id))
    .map(e => SITUATION_LABEL[e.id] || e.label);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: TEAL_DARK, marginBottom: 9 }}>
        From your intake — where listening takes the most effort
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {labels.map(l => (
          <span key={l} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: TEAL_BG, color: TEAL_DARK,
            border: `1px solid ${TEAL_BG}`, borderRadius: 20,
            padding: "6px 13px", fontSize: 12.5, fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: BRASS }} />
            {l}
          </span>
        ))}
        {effortSignals.map(k => (
          <span key={k} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: BRASS_SOFT, color: BRASS_INK,
            border: `1px solid ${BRASS_SOFT}`, borderRadius: 20,
            padding: "6px 13px", fontSize: 12.5, fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: BRASS }} />
            {EFFORT_SIGNAL_LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

function RecommendationBanner({ loading, engineError, recommended, rationaleText, flaggedCount, hasIntakeAnswers }) {
  if (loading) {
    return (
      <div style={{ background:BG_SOFT, border:`1px solid ${BORDER}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:MUTED }}>
        Computing recommendation…
      </div>
    );
  }
  if (engineError) {
    return (
      <div style={{ background:"#fef9c3", border:"1px solid #fde047", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#854d0e" }}>
        {engineError} You can still pick a tier manually below.
      </div>
    );
  }
  if (!recommended?.tier) return null;

  const cappedNote = recommended.capped
    ? ` The engine flagged a higher tier, but ${rankToLabel(recommended.originalRank)} isn't part of this plan — ${recommended.tier.label} is the strongest option available to you.`
    : "";
  const sourceNote = !hasIntakeAnswers
    ? " Recommendation is grounded in audiometric findings — no intake on file."
    : flaggedCount === 0
      ? " Recommendation reflects your audiogram. Your intake answers didn't flag specific listening challenges, which the engine reads as a quieter listening profile."
      : ` Recommendation reflects your audiogram and the ${flaggedCount === 1 ? "situation" : `${flaggedCount} situations`} you flagged as taking the most listening effort.`;

  return (
    <div style={{ background:TEAL_BG, borderLeft:`4px solid ${TEAL}`, borderRadius:6, padding:"12px 16px" }}>
      <div style={{ fontSize:13, fontWeight:700, color:TEAL_DARK, marginBottom:4 }}>
        Recommended: {recommended.tier.label}
      </div>
      <div style={{ fontSize:13, color:TEXT, lineHeight:1.5 }}>
        {rationaleText}{cappedNote}{sourceNote}
      </div>
    </div>
  );
}

function TierCard({ tier, selected, recommended, selectable, blurb, flagged, onSelect }) {
  const rank = tierLabelToRank(tier.label);
  const coverage = rank != null ? COVERAGE_BY_RANK[rank] : null;
  const effortCopy = rank != null ? TIER_EFFORT_COPY[rank] : null;

  // Recommended (engine pick) is the dominant visual state. The selected
  // state only matters in the manual-fallback mode — when the engine has
  // produced a pick, cards are read-only and `selectable` is false.
  const showSelectionRing = selectable && selected;
  const borderColor = recommended ? BRASS : showSelectionRing ? RECOMMEND : BORDER;
  const borderWidth = recommended || showSelectionRing ? 2 : 1;

  return (
    <div
      style={{
        border:`${borderWidth}px solid ${borderColor}`,
        borderRadius:12,
        padding:0,
        background:COLOR.card,
        boxShadow: SHADOW.sm,
        cursor: selectable ? "pointer" : "default",
        position:"relative",
        display:"flex",
        flexDirection:"column",
        transition:"border-color 0.15s, box-shadow 0.15s",
        fontFamily: FONT.ui,
      }}
      onClick={selectable ? onSelect : undefined}
    >
      {recommended && (
        <div style={{
          position:"absolute", top:-10, left:14,
          background:BRASS, color:"#fff",
          padding:"3px 11px", borderRadius:99,
          fontSize:11, fontWeight:700, letterSpacing:"0.03em",
        }}>
          Recommended for you
        </div>
      )}

      <div style={{ padding:"16px 16px 12px" }}>
        <div style={{ fontFamily:FONT.display, fontSize:19, fontWeight:600, color:TEXT }}>{tier.label}</div>
        {/* Listening effort is the tier's primary description (effort pivot) —
            who does the work of separating speech from noise at this level.
            The feature blurb demotes to a secondary line underneath. */}
        {effortCopy && (
          <div style={{ marginTop:9 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:BRASS_INK, marginBottom:4 }}>
              Listening effort
            </div>
            <div style={{ fontSize:13, lineHeight:1.55, color:TEXT }}>{effortCopy}</div>
          </div>
        )}
        {blurb && (
          <div style={{ marginTop:8, fontSize:11.5, lineHeight:1.45, color:MUTED }}>{blurb}</div>
        )}
      </div>

      {coverage ? (
        <div style={{ borderTop:`1px solid ${BORDER}`, padding:"12px 16px", flex:1 }}>
          {/* Coverage bars are supporting evidence for the effort story above,
              not the headline — the connector line makes that relationship
              explicit. */}
          <div style={{ fontSize:11.5, color:MUTED, marginBottom:9, lineHeight:1.4 }}>
            Here's where that shows up, situation by situation:
          </div>
          <EnvironmentCoverage rank={rank} flagged={flagged} />
        </div>
      ) : (
        <div style={{ borderTop:`1px solid ${BORDER}`, padding:"12px 16px", flex:1, fontSize:12, color:MUTED, fontStyle:"italic" }}>
          Coverage chart not available for this tier label.
        </div>
      )}

      {selectable && (
        <div style={{ borderTop:`1px solid ${BORDER}`, padding:"10px 16px", textAlign:"center" }}>
          <div style={{
            display:"inline-block",
            padding:"6px 18px",
            background: selected ? RECOMMEND : "transparent",
            color: selected ? "#fff" : MUTED,
            border:`1px solid ${selected ? RECOMMEND : BORDER}`,
            borderRadius:6,
            fontSize:13, fontWeight:700,
            fontFamily:"inherit",
          }}>
            {selected ? "✓ Selected" : `Select ${tier.label}`}
          </div>
        </div>
      )}
    </div>
  );
}
