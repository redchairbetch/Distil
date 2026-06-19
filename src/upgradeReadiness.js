// Upgrade-readiness scoring (backlog #23, provider-administered). Pure functions
// so the model is unit-checkable and reusable by the reprogram-vs-upgrade engine
// (PR3). The readiness band balances what the patient REPORTS (subjective) against
// what the data SHOWS (objective) at ~equal weight, plus a benefit-timing nudge.
//
// Blocks (max 14): subjective 6 (satisfaction + environments + feature gaps),
// objective 6 (current-aid performance + warranty/device age), opportunity 2
// (insurance benefit timing). Bands: 1 Not-ready 0–2 · 2 Early 3–5 ·
// 3 Warming 6–8 · 4 Ready 9–11 · 5 Overdue 12–14.

// ── Option lists (provider multi-select) ──────────────────────────────────
export const STRUGGLE_ENVIRONMENTS = [
  { key: "restaurants", label: "Restaurants / noise" },
  { key: "groups",      label: "Groups & meetings" },
  { key: "phone",       label: "Phone calls" },
  { key: "tv",          label: "TV" },
  { key: "one_on_one",  label: "One-on-one (quiet)" },
  { key: "car",         label: "Car" },
  { key: "outdoors",    label: "Outdoors / wind" },
  { key: "worship",     label: "Place of worship" },
  { key: "music",       label: "Music" },
];

export const FEATURE_GAPS = [
  { key: "rechargeable",   label: "Rechargeable" },
  { key: "phone_stream",   label: "Phone streaming" },
  { key: "tv_stream",      label: "TV streaming" },
  { key: "hands_free",     label: "Hands-free calls" },
  { key: "app_control",    label: "App control" },
  { key: "fall_detection", label: "Fall detection" },
  { key: "tinnitus",       label: "Tinnitus relief" },
  { key: "noise",          label: "Better noise handling" },
];

// Real-world failure tags. 'severe' tags force the performance tier to Failing;
// other tags drop it one level (the clinician can still override the final tier).
export const PERFORMANCE_TAGS = [
  { key: "feedback",         label: "Feedback / whistling", severe: false },
  { key: "low_volume",       label: "Not loud enough",      severe: false },
  { key: "streaming_fails",  label: "Streaming fails",      severe: false },
  { key: "comfort",          label: "Comfort / fit",        severe: false },
  { key: "frequent_repairs", label: "Frequent repairs",     severe: false },
  { key: "wont_charge",      label: "Won't charge",         severe: true },
  { key: "not_wearing",      label: "Not wearing them",     severe: true },
];

export const BAND_LABELS = { 1: "Not ready", 2: "Early", 3: "Warming", 4: "Ready", 5: "Overdue" };

const TIER_POINTS = { Excellent: 0, Adequate: 1, Marginal: 2, Failing: 3 };

// ── Performance tier from real-world failure tags ──────────────────────────
// Aided WRS (binaural aided sound field) was dropped from the upgrade flow — it's
// available in only one office and is unreliable, so it no longer feeds the tier.
// The tier is now provider judgment, nudged by the real-world tags: a severe tag
// (won't charge / not wearing) forces Failing; any other issue suggests Marginal;
// no tags → no suggestion and the provider sets it. Real Ear Measurement is
// captured as a provider note for now and will feed this objectively in a later pass.
export function computePerformanceTier({ tags = [] } = {}) {
  const tagDefs = PERFORMANCE_TAGS.filter((t) => tags.includes(t.key));
  if (tagDefs.some((t) => t.severe)) return "Failing";
  if (tagDefs.length) return "Marginal";
  return null;
}

// ── Warranty / tenure, keyed to the 3-year manufacturer warranty ───────────
// CC+'s year-4 coverage does NOT soften this — the clinic eats year-4 warranty/
// L&D claims and wants those patients upgraded back into manufacturer warranty.
export function tenurePoints(yearsSinceFit) {
  if (yearsSinceFit == null) return 0;
  if (yearsSinceFit < 3) return 0;
  if (yearsSinceFit < 4) return 1; // year 3 — last manufacturer-warranty year
  if (yearsSinceFit < 5) return 2; // year 4 — past mfr warranty; clinic exposed
  return 3;                        // year 5+ — well past
}

function satisfactionPoints(s) {
  if (s == null) return 0;
  if (s >= 8) return 0;
  if (s >= 5) return 1;
  return 2;
}
function countBandPoints(n) {
  if (!n) return 0;
  return n <= 2 ? 1 : 2;
}

export function bandFromScore(score) {
  if (score <= 2) return 1;
  if (score <= 5) return 2;
  if (score <= 8) return 3;
  if (score <= 11) return 4;
  return 5;
}

// ── Readiness score (max 14) + 1-5 band + per-domain breakdown ─────────────
export function scoreReadiness({
  satisfaction = null,
  environments = [],
  featureGaps = [],
  benefitRefreshed = false,
  performanceTier = null,
  yearsSinceFit = null,
} = {}) {
  const breakdown = [
    { key: "satisfaction", label: "Satisfaction",            block: "subjective",  points: satisfactionPoints(satisfaction) },
    { key: "environments", label: "New struggle areas",      block: "subjective",  points: countBandPoints(environments.length) },
    { key: "feature_gaps", label: "Feature gaps",            block: "subjective",  points: countBandPoints(featureGaps.length) },
    { key: "performance",  label: "Current-aid performance", block: "objective",   points: performanceTier ? TIER_POINTS[performanceTier] : 0 },
    { key: "tenure",       label: "Warranty / device age",   block: "objective",   points: tenurePoints(yearsSinceFit) },
    { key: "benefit",      label: "Insurance benefit timing", block: "opportunity", points: benefitRefreshed ? 2 : 0 },
  ];
  const score = breakdown.reduce((s, d) => s + d.points, 0);
  const band = bandFromScore(score);
  return { score, band, bandLabel: BAND_LABELS[band], breakdown };
}
