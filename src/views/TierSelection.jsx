import { useState, useEffect, useMemo } from "react";
import { generateRecommendation, loadCurrentRecommendation } from "../db.js";

// Technology Tier Selection — wizard step between Results and Device
// Selection. Shows the patient three tier cards (filtered by insurance
// coverage) with a personalized lifestyle chart that visualizes how
// each tier handles the environments the patient flagged as struggles.
//
// Engine recommendation is computed on mount via the existing engine
// (PR #52 infrastructure) — this component is the visual surface, not
// the brains. Plain-transparency rationale shown above the cards.

const TEAL = "#0A7B8C";
const TEAL_BG = "#F0F9FA";
const TEAL_DARK = "#075E6B";
const TEXT = "#0a1628";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const BORDER = "#e5e7eb";
const RECOMMEND = "#0f766e";
const BG_SOFT = "#f9fafb";

// Listening environments displayed in the chart. Order is fixed —
// roughly left-to-right ramp from "easy" to "hardest". The patient's
// flagged environments appear in the upper card section; the rest
// appear in the lower section.
const ENVIRONMENTS = [
  { id: "home",       label: "Quiet home / private conversation" },
  { id: "tv",         label: "TV / movies" },
  { id: "phone",      label: "Phone calls" },
  { id: "religious",  label: "Religious services" },
  { id: "car",        label: "Car (road noise)" },
  { id: "restaurant", label: "Restaurant" },
  { id: "groups",     label: "Group conversations / meetings" },
  { id: "outdoors",   label: "Outdoors / wind" },
  { id: "crowds",     label: "Crowds / cocktail / concerts" },
];

// Tier × environment coverage, 0–100. Same matrix Kurt and I aligned
// on. Premium tops at 95% on cocktail-class environments — honest,
// no industry chart pretends to fully solve those.
const COVERAGE_BY_RANK = {
  5: { home:100, tv:100, phone:100, religious:100, car:100, restaurant:100, groups:100, outdoors:100, crowds: 95 }, // Premium / Select
  3: { home:100, tv:100, phone:100, religious: 80, car: 85, restaurant: 80, groups: 80, outdoors: 75, crowds: 65 }, // Advanced
  1: { home:100, tv: 90, phone: 90, religious: 60, car: 60, restaurant: 50, groups: 50, outdoors: 40, crowds: 30 }, // Standard / entry
};

// Intake answer (true) → environment IDs the patient struggles with.
// Multiple flags can map to the same environment; we de-duplicate
// in flaggedEnvironments(). Drawn from #56 backlog comment + the
// structured signals shipped in #62.
const INTAKE_TO_ENVS = {
  hear_tv:                ["tv"],
  hear_noisy:             ["restaurant", "crowds", "groups"],
  hear_understand:        ["groups", "restaurant"],
  hear_kids:              ["religious", "groups"],
  hear_repeat:            ["groups"],
  hear_mumble:            ["home", "groups"],
  hear_loud:              ["home"],
  med_noise_recreational: ["outdoors"],
  med_noise_occupational: ["groups", "outdoors"],
};

// Marketing labels → engine ranks. Anchored on the three TruHearing
// plan tiers and the three clinic_retail_anchors slugs in current use.
// "Premium" is TruHearing's name; "Select" is private-pay's top tier.
function tierLabelToRank(label) {
  if (!label) return null;
  const l = String(label).toLowerCase();
  if (l === "premium" || l === "select") return 5;
  if (l === "advanced") return 3;
  if (l === "standard") return 1;
  return null;
}

// Compute the set of environments this patient flagged in their
// intake. Empty set if no intake / nothing flagged → chart falls
// back to "all environments shown in lower section."
function flaggedEnvironments(intakeAnswers) {
  if (!intakeAnswers) return new Set();
  const envs = new Set();
  for (const [key, envList] of Object.entries(INTAKE_TO_ENVS)) {
    if (intakeAnswers[key] === true) {
      for (const e of envList) envs.add(e);
    }
  }
  return envs;
}

// Pick the tier the engine recommends, capped to what the plan covers.
// If the engine's pick isn't available (TruHearing locks tier list),
// fall back to the highest covered tier. Returns { tier, capped, originalRank }.
function pickRecommendedTier(engineRank, availableTiers) {
  if (!engineRank || availableTiers.length === 0) return { tier: null, capped: false };
  const ranked = availableTiers
    .map(t => ({ ...t, rank: tierLabelToRank(t.label) }))
    .filter(t => t.rank != null)
    .sort((a, b) => b.rank - a.rank); // highest rank first
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

  // Auto-select the recommended tier on first arrival, if nothing is
  // selected yet. Provider override stays sticky after that.
  useEffect(() => {
    if (selectedTier) return;
    if (recommended?.tier) {
      onSelectTier(recommended.tier.label, recommended.tier.price);
    }
  }, [recommended?.tier?.label]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="card">
      <div className="card-title">Technology Tier</div>

      <RecommendationBanner
        loading={loading}
        engineError={engineError}
        recommended={recommended}
        rationaleText={engineResult?.generated_rationale_text}
        flaggedCount={flagged.size}
      />

      <div style={{ display:"grid", gridTemplateColumns:`repeat(${availableTiers.length}, 1fr)`, gap:16, marginTop:16 }}>
        {availableTiers.map(tier => (
          <TierCard
            key={tier.label}
            tier={tier}
            selected={selectedTier === tier.label}
            recommended={recommended?.tier?.label === tier.label}
            blurb={tierBlurbs[tier.label]}
            flagged={flagged}
            onSelect={() => onSelectTier(tier.label, tier.price)}
          />
        ))}
      </div>
    </div>
  );
}

function RecommendationBanner({ loading, engineError, recommended, rationaleText, flaggedCount }) {
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
  const sourceNote = flaggedCount === 0
    ? " Recommendation is grounded in audiometric findings (no intake answers were available)."
    : ` Recommendation reflects your audiogram and the ${flaggedCount === 1 ? "environment you flagged" : `${flaggedCount} environments you flagged`} in your intake.`;

  return (
    <div style={{ background:TEAL_BG, borderLeft:`4px solid ${TEAL}`, borderRadius:6, padding:"12px 16px" }}>
      <div style={{ fontSize:13, fontWeight:700, color:TEAL_DARK, marginBottom:4 }}>
        ⭐ Recommended: {recommended.tier.label}
      </div>
      <div style={{ fontSize:13, color:TEXT, lineHeight:1.5 }}>
        {rationaleText}{cappedNote}{sourceNote}
      </div>
    </div>
  );
}

function TierCard({ tier, selected, recommended, blurb, flagged, onSelect }) {
  const rank = tierLabelToRank(tier.label);
  const coverage = rank ? COVERAGE_BY_RANK[rank] : null;

  // Split environments into "flagged for this patient" vs "other".
  // If the patient flagged none, show all in the "other" group.
  const flaggedEnvs = flagged.size > 0 ? ENVIRONMENTS.filter(e => flagged.has(e.id)) : [];
  const otherEnvs   = flagged.size > 0 ? ENVIRONMENTS.filter(e => !flagged.has(e.id)) : ENVIRONMENTS;

  const borderColor = selected ? RECOMMEND : recommended ? TEAL : BORDER;
  const borderWidth = selected ? 2 : 1;

  return (
    <div style={{
      border:`${borderWidth}px solid ${borderColor}`,
      borderRadius:10,
      padding:0,
      background:"#fff",
      cursor:"pointer",
      position:"relative",
      display:"flex",
      flexDirection:"column",
      transition:"border-color 0.15s",
    }} onClick={onSelect}>
      {recommended && (
        <div style={{
          position:"absolute", top:-10, left:14,
          background:TEAL, color:"#fff",
          padding:"2px 10px", borderRadius:99,
          fontSize:11, fontWeight:700, letterSpacing:"0.04em",
        }}>
          ⭐ ENGINE PICK
        </div>
      )}

      <div style={{ padding:"16px 16px 12px" }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
          <div style={{ fontSize:18, fontWeight:700, color:TEXT }}>{tier.label}</div>
          <div style={{ fontSize:14, fontWeight:700, color:TEXT }}>
            {tier.price === 0 ? "No charge" : `$${Math.round(tier.price).toLocaleString()} / aid`}
          </div>
        </div>
        {blurb && (
          <div style={{ marginTop:6, fontSize:12, lineHeight:1.45, color:"#475569" }}>{blurb}</div>
        )}
      </div>

      {coverage ? (
        <div style={{ borderTop:`1px solid ${BORDER}`, padding:"12px 16px", flex:1 }}>
          {flaggedEnvs.length > 0 && (
            <>
              <div style={{ fontSize:10, fontWeight:700, color:TEAL_DARK, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>
                Your most challenging environments
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
                {flaggedEnvs.map(env => (
                  <CoverageRow key={env.id} label={env.label} pct={coverage[env.id]} prominent />
                ))}
              </div>
            </>
          )}
          <div style={{ fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>
            {flaggedEnvs.length > 0 ? "Other environments" : "All listening environments"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {otherEnvs.map(env => (
              <CoverageRow key={env.id} label={env.label} pct={coverage[env.id]} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ borderTop:`1px solid ${BORDER}`, padding:"12px 16px", flex:1, fontSize:12, color:MUTED, fontStyle:"italic" }}>
          Coverage chart not available for this tier label.
        </div>
      )}

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
    </div>
  );
}

// Red (≤50%) → Yellow (75%) → Green (100%) gradient. Linear RGB
// interpolation between anchors so adjacent percentages read as
// distinct shades — easier to scan than the prior 4-bucket palette.
function coverageColor(pct) {
  const RED = [220, 38, 38];   // #dc2626
  const YEL = [234, 179, 8];   // #eab308
  const GRN = [22, 163, 74];   // #16a34a
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const mix = (c1, c2, t) =>
    `rgb(${lerp(c1[0], c2[0], t)}, ${lerp(c1[1], c2[1], t)}, ${lerp(c1[2], c2[2], t)})`;
  if (pct <= 50) return `rgb(${RED.join(",")})`;
  if (pct >= 100) return `rgb(${GRN.join(",")})`;
  if (pct <= 75) return mix(RED, YEL, (pct - 50) / 25);
  return mix(YEL, GRN, (pct - 75) / 25);
}

function CoverageRow({ label, pct, prominent = false }) {
  const fillColor = coverageColor(pct);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, fontSize: prominent ? 12 : 11 }}>
      <div style={{ flex:1, color: prominent ? TEXT : MUTED, fontWeight: prominent ? 600 : 500 }}>
        {label}
      </div>
      <div style={{ flex:"0 0 70px", height:6, background:BORDER, borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:fillColor, transition:"width 0.2s" }} />
      </div>
      <div style={{ flex:"0 0 32px", textAlign:"right", fontSize:10, color: prominent ? TEXT : FAINT, fontWeight:600 }}>
        {pct}%
      </div>
    </div>
  );
}
