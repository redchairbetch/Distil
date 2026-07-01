// ── Device comparison — old-vs-new performance model ─────────────────────────
// Powers the split-screen comparator (views/DeviceComparison.jsx): a patient's
// current/older hearing aid vs. a proposed new one, scored across the same nine
// listening environments the Technology Tier + Device Selection screens already
// use (listeningSituations.js). Built for the returning-patient Journey Review
// and as a standalone tool.
//
// The whole point is apples-to-apples: BOTH sides derive from the same
// COVERAGE_BY_RANK baseline the rest of the app trusts. An older device starts
// from its tier baseline (when new) and loses ground two ways:
//   1. Era — years of platform advancement since release. Weighted so the loss
//      lands where the last decade actually moved (noise / connectivity), not
//      in the quiet room where a 2015 premium aid still does fine.
//   2. Specs — documented shortfalls (no Bluetooth streaming, omni/fixed mic)
//      that separate two same-era, same-tier devices from each other.
//
// Every number here is a transparent, tunable estimate — never a measured
// claim about a competitor. The provider confirms tier/era at point of use, so
// the output is a clinician estimate. Tune the constants below after real use.
import { ENVIRONMENTS, COVERAGE_BY_RANK } from "./listeningSituations.js";

// ── Model constants (tunable) ────────────────────────────────────────────────

// A hearing-aid "generation" is ~2 years of platform cadence. Cap the era
// penalty at 4 generations (~8+ yrs) so a very old aid floors out rather than
// scoring negative.
const YEARS_PER_GENERATION = 2;
// Cap at 6 generations (~12 yrs) so a decade-old premium aid registers the full
// distance modern DSP has travelled, rather than flattening after a few years.
const MAX_GENERATIONS = 6;
// Coverage points lost per generation, before per-environment weighting.
const POINTS_PER_GENERATION = 9;
// A working aid still does something — never drop a bar below this.
const COVERAGE_FLOOR = 12;

// Where generational advances actually land. ~1.0 = hard noisy/social
// environments (the whole story of modern DSP + directionality); ~0.2 = quiet
// rooms that were already solved a decade ago.
const ERA_WEIGHT = {
  home: 0.2, tv: 0.5, phone: 0.4, religious: 0.7, car: 0.6,
  restaurant: 1.0, groups: 1.0, outdoors: 0.9, crowds: 1.0,
};

// Directional-mic sophistication ladder. Higher = tighter focus in noise.
const MIC_RANK = { omni: 0, fixed: 1, adaptive: 2, beamforming: 3 };

// Per-environment penalties for documented spec shortfalls. Applied on top of
// the era penalty so two same-era, same-tier devices can still differ. Modest
// by design — the tier baseline already carries most of the signal.
function specPenalties(device) {
  const p = {};
  const add = (env, n) => { p[env] = (p[env] || 0) + n; };
  // No direct-to-phone streaming: TV and phone clarity suffer most.
  if (device.bluetoothStreaming === false) { add("tv", 10); add("phone", 10); }
  // Weak directionality: the noisy/social environments take the hit. Even
  // "adaptive" (e.g. Oticon OpenSound) trails today's narrow beamforming in
  // heavy noise, so it carries a modest penalty; beamforming carries none.
  const mic = MIC_RANK[device.directionalMic] ?? null;
  if (mic === 0) { add("restaurant", 12); add("groups", 12); add("crowds", 10); add("outdoors", 6); add("car", 4); }
  else if (mic === 1) { add("restaurant", 6); add("groups", 6); add("crowds", 5); add("outdoors", 3); }
  else if (mic === 2) { add("restaurant", 5); add("groups", 5); add("crowds", 5); add("outdoors", 3); }
  return p;
}

// ── Marketing label → engine rank ────────────────────────────────────────────
// Mirrors tierLabelToRank() in views/TierSelection.jsx. Maps the three plan
// tiers onto the sparse 5/3/1 rank scale COVERAGE_BY_RANK is keyed on.
export function rankFromTierLabel(label) {
  if (label == null) return null;
  const l = String(label).toLowerCase().trim();
  if (l === "premium" || l === "select" || l === "7") return 5;
  if (l === "advanced" || l === "5") return 3;
  if (l === "standard" || l === "3") return 1;
  if (l === "level 2" || l === "2") return 0;
  if (l === "level 1" || l === "1") return -1;
  return null;
}

// ── Descriptor normalization ─────────────────────────────────────────────────
// Accept a legacy_device row (snake_case), a catalog-derived new device, or a
// manual quick-entry, and produce the minimal shape the model needs. Forgiving
// about casing and about which tier signal is present (rank or label).
export function toDescriptor(raw) {
  raw = raw || {}; // tolerate null/undefined — specUpgrades() runs before a device is picked
  const rank =
    raw.tierRank ?? raw.tier_rank ?? raw.originalTierRank ?? raw.original_tier_rank ??
    rankFromTierLabel(
      raw.tierLabel ?? raw.tier_label ?? raw.originalTierLabel ?? raw.original_tier_label ?? raw.tier
    );
  const releaseYear = raw.releaseYear ?? raw.release_year ?? null;
  return {
    tierRank: rank == null ? null : Number(rank),
    releaseYear: releaseYear == null ? null : Number(releaseYear),
    directionalMic: raw.directionalMic ?? raw.directional_mic ?? null,
    bluetoothStreaming: raw.bluetoothStreaming ?? raw.bluetooth_streaming ?? null,
    rechargeable: raw.rechargeable ?? null,
    telecoil: raw.telecoil ?? null,
  };
}

// Filter a loaded legacy-device list by a free-text query against brand,
// manufacturer, model, and aliases. Small list (client-side), case-insensitive,
// token-AND so "costco 9" matches the KS9 row. Empty query returns all.
export function searchLegacyDevices(devices = [], query = "") {
  const tokens = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return devices;
  return devices.filter(d => {
    const hay = [d.brand, d.manufacturer, d.model, d.platform, ...(d.aliases || [])]
      .filter(Boolean).join(" ").toLowerCase();
    return tokens.every(t => hay.includes(t));
  });
}

// Generations of platform advancement between a release year and "now".
// Returns 0 when the year is missing (treat as current-generation).
export function generationsBehind(releaseYear, currentYear = new Date().getFullYear()) {
  if (!releaseYear) return 0;
  const gap = Math.max(0, currentYear - releaseYear);
  return Math.min(MAX_GENERATIONS, Math.round(gap / YEARS_PER_GENERATION));
}

// ── Coverage for a single device ─────────────────────────────────────────────
// Returns a { env: pct } map, or null if the tier rank has no baseline. A
// current device (no releaseYear) returns its tier baseline unchanged, minus
// any spec penalties.
export function deviceCoverage(device, { currentYear } = {}) {
  const d = toDescriptor(device);
  const base = d.tierRank == null ? null : COVERAGE_BY_RANK[d.tierRank];
  if (!base) return null;
  const gens = generationsBehind(d.releaseYear, currentYear);
  const pen = specPenalties(d);
  const out = {};
  for (const { id } of ENVIRONMENTS) {
    const eraLoss = gens * POINTS_PER_GENERATION * (ERA_WEIGHT[id] ?? 0.5);
    const pct = base[id] - eraLoss - (pen[id] || 0);
    out[id] = Math.max(COVERAGE_FLOOR, Math.min(100, Math.round(pct)));
  }
  return out;
}

// ── Old vs new comparison ────────────────────────────────────────────────────
// Returns one row per environment: { id, label, old, new, delta }. `old` or
// `new` is null when that side lacks a usable tier rank (component can render a
// "pick a device" placeholder). Order follows ENVIRONMENTS (easy → hardest).
export function compareCoverage(oldDevice, newDevice, { currentYear } = {}) {
  const oldCov = oldDevice ? deviceCoverage(oldDevice, { currentYear }) : null;
  const newCov = newDevice ? deviceCoverage(newDevice, { currentYear }) : null;
  return ENVIRONMENTS.map(({ id, label }) => {
    const o = oldCov ? oldCov[id] : null;
    const n = newCov ? newCov[id] : null;
    return { id, label, old: o, new: n, delta: o != null && n != null ? n - o : null };
  });
}

// Average coverage gain across environments (or across a flagged subset, when
// provided). Handy for a headline like "+31% on average in the rooms you flagged".
export function averageGain(rows, flagged = null) {
  const scoped = flagged && flagged.size > 0 ? rows.filter(r => flagged.has(r.id)) : rows;
  const deltas = scoped.map(r => r.delta).filter(d => d != null);
  if (deltas.length === 0) return null;
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
}

// ── Capability upgrades gained ───────────────────────────────────────────────
// Short chips describing concrete features the new device adds over the old.
// Gains only — we never editorialize about what the old device lacked beyond
// the plain fact of the upgrade.
export function specUpgrades(oldDevice, newDevice) {
  const o = toDescriptor(oldDevice);
  const n = toDescriptor(newDevice);
  const gains = [];
  if (n.bluetoothStreaming === true && o.bluetoothStreaming !== true)
    gains.push("Direct phone & TV streaming");
  if (n.rechargeable === true && o.rechargeable !== true)
    gains.push("Rechargeable — no more batteries");
  const oMic = MIC_RANK[o.directionalMic] ?? null;
  const nMic = MIC_RANK[n.directionalMic] ?? null;
  if (oMic != null && nMic != null && nMic > oMic)
    gains.push(nMic >= 3 ? "Beamforming focus in noise" : "Sharper focus in noise");
  if (n.telecoil === true && o.telecoil !== true)
    gains.push("Telecoil (loop systems)");
  return gains;
}
