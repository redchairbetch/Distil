import { getPTA } from "./audiogramAnalysis.js";

// Reprogram-vs-upgrade decision aid (backlog #23, PR3). Pure functions, reused by
// the upgrade consultation UI. Compares the baseline audiogram (original fit)
// against the current visit's audiogram and, with the PR2 current-aid performance
// tier + readiness band, recommends reprogram / upgrade / provider judgment.
//
// Anchored to the POORER ear (asymmetric losses anchor to the worse side, per Kurt).
// Medical referral is always the provider's call — there is no auto-referral here
// (FDA-8 / red-flag audiometric criteria are deliberately backlogged).

// Unaided AC thresholds for one ear as a { frequency: threshold_db } map, from an
// audiogram row carrying an `audiogram_thresholds` array (loadBaselineAudiology /
// a visit's audiogram shape).
function earThresholds(audiogramRow, ear) {
  const map = {};
  (audiogramRow?.audiogram_thresholds || []).forEach((t) => {
    if (t.test_type === "AC" && t.ear === ear) map[t.frequency] = t.threshold_db;
  });
  return map;
}

const wrsFor = (row, ear) => (ear === "right" ? row?.unaided_wrs_right : row?.unaided_wrs_left);

// Delta severity. Kurt-specced: a PTA shift over 5 dB is already meaningful.
//   stable <5 · moderate 5–10 · significant 10+  (same point buckets for WRS drop)
export function deltaSeverity({ ptaShift, wrsDrop } = {}) {
  if ((ptaShift != null && ptaShift >= 10) || (wrsDrop != null && wrsDrop >= 10)) return "significant";
  if ((ptaShift != null && ptaShift >= 5) || (wrsDrop != null && wrsDrop >= 5)) return "moderate";
  return "stable";
}

// Per-ear PTA + WRS deltas, anchored to the poorer ear (worse current PTA). The
// returned object spreads the anchor ear's values to the top level for the matrix.
export function computeAudiometricDelta(baseline, current) {
  if (!baseline || !current) return null;
  const perEar = {};
  for (const ear of ["right", "left"]) {
    const basePTA = getPTA(earThresholds(baseline, ear));
    const curPTA = getPTA(earThresholds(current, ear));
    const baseWRS = wrsFor(baseline, ear);
    const curWRS = wrsFor(current, ear);
    perEar[ear] = {
      basePTA, curPTA,
      ptaShift: basePTA != null && curPTA != null ? curPTA - basePTA : null,
      baseWRS: baseWRS ?? null,
      curWRS: curWRS ?? null,
      wrsDrop: baseWRS != null && curWRS != null ? baseWRS - curWRS : null,
    };
  }
  const r = perEar.right.curPTA, l = perEar.left.curPTA;
  let anchorEar = "right";
  if (r == null && l != null) anchorEar = "left";
  else if (r != null && l != null) anchorEar = l > r ? "left" : "right";
  return { perEar, anchorEar, ...perEar[anchorEar] };
}

const GOOD_TIERS = ["Excellent", "Adequate"];

// Decision matrix (Kurt-confirmed). Readiness band breaks ties in the
// provider-judgment cells (band 4–5 leans upgrade).
export function decideReprogramVsUpgrade(delta, performanceTier, readinessBand) {
  const severity = delta ? deltaSeverity(delta) : "unknown";
  const perfKnown = performanceTier != null;
  const perfGood = GOOD_TIERS.includes(performanceTier);

  let decision;
  if (severity === "significant") decision = "upgrade";
  else if (severity === "moderate") decision = perfKnown && !perfGood ? "upgrade" : "provider_judgment";
  else if (severity === "stable") decision = perfGood ? "reprogram" : "provider_judgment";
  else decision = "provider_judgment";

  // lean still breaks the provider-judgment tie for the default close path,
  // but is deliberately absent from the patient-facing rationale (Kurt,
  // 2026-07-03: no "readiness leans …" framing in the recommendation).
  const lean = decision === "provider_judgment" ? (readinessBand >= 4 ? "upgrade" : "reprogram") : null;

  return { decision, severity, lean, rationale: generateDecisionRationale({ delta, performanceTier, decision }) };
}

function describeDelta(delta) {
  if (!delta) return "no comparison audiogram on file";
  const parts = [];
  if (delta.ptaShift != null) parts.push(`PTA ${delta.ptaShift > 0 ? "+" : ""}${Math.round(delta.ptaShift)} dB`);
  if (delta.wrsDrop != null) parts.push(delta.wrsDrop > 0 ? `WRS −${delta.wrsDrop} pts` : "WRS stable");
  const ear = delta.anchorEar ? ` (poorer ${delta.anchorEar} ear)` : "";
  return (parts.length ? parts.join(", ") : "stable hearing") + ear;
}

export function generateDecisionRationale({ delta, performanceTier, decision }) {
  const d = describeDelta(delta);
  const perf = performanceTier ? `${performanceTier.toLowerCase()} current-aid performance` : "current-aid performance not assessed";
  if (decision === "reprogram")
    return `Stable hearing (${d}) with ${perf} — reprogram the current devices before considering new technology.`;
  if (decision === "upgrade")
    return `${d} with ${perf} — an upgrade is the recommended path.`;
  return `${d} with ${perf} — borderline. Present both paths.`;
}
