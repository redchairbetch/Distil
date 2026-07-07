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

// ── catalogComparison.js — two-delta comparison engine ───────────────────────
// Models an upgrade patient's situation as two SEPARATE, true statements:
//   1. Platform delta — how many device generations sit between their platform
//      and the recommendation, and the accumulated manufacturer-named
//      platform_innovations of every intervening generation (things their
//      device lacks categorically, whatever tier they bought).
//   2. Tier delta — the manufacturer-named feature gates between their tier
//      position and the recommended tier, evaluated on the RECOMMENDED
//      platform's ladder.
// This replaces the flat "compare as if they owned the flagship" story: a
// Livio AI 1200 owner is 4 generations back AND mid-tier — both true, told apart.
//
// Anchoring rules (build brief §5):
//   • Vertical first — same-manufacturer lineage is the default path. Private-
//     label devices (TruHearing TH7, Kirkland KS9…) resolve through
//     base_platform_id to the platform they actually are before lineage math.
//   • Cross-brand — capability categories only (connectivity, speech-in-noise,
//     sensors, power). channels_bands NEVER crosses brands: manufacturers count
//     channels differently and a cross-brand channel race is clinically
//     misleading. Nothing here emits one.
//   • Tier positioning across platforms uses tier_position (1 = flagship,
//     counting down) — relative position, never tier labels.
//
// Verification: every claim item carries the verification_status of the row it
// came from. The UI renders only 'verified' items patient-side (rule §3.6);
// provider mode shows the rest with badges. This module is pure — no Supabase.

// ── Catalog indexing ─────────────────────────────────────────────────────────
export function indexCatalog(platforms = [], tiers = []) {
  const platformsById = new Map(platforms.map(p => [p.id, p]))
  const tiersById = new Map(tiers.map(t => [t.id, t]))
  const tiersByPlatform = new Map()
  for (const t of tiers) {
    if (!tiersByPlatform.has(t.platformId)) tiersByPlatform.set(t.platformId, [])
    tiersByPlatform.get(t.platformId).push(t)
  }
  for (const arr of tiersByPlatform.values()) arr.sort((a, b) => a.tierPosition - b.tierPosition)
  // Lineages: one ordered generation line per manufacturer. Sibling rows may
  // share a lineage_order (Starkey Livio / Livio AI / Livio Edge AI are one
  // generation patients know by three names) — generation math counts DISTINCT
  // orders, not rows.
  const lineages = new Map()
  for (const p of platforms) {
    if (p.lineageOrder == null) continue
    if (!lineages.has(p.manufacturer)) lineages.set(p.manufacturer, [])
    lineages.get(p.manufacturer).push(p)
  }
  for (const arr of lineages.values()) {
    arr.sort((a, b) => (a.lineageOrder - b.lineageOrder) || ((a.releaseYear || 0) - (b.releaseYear || 0)))
  }
  return { platforms, tiers, platformsById, tiersById, tiersByPlatform, lineages }
}

// Private-label / channel rows point at the platform they are built on; walk
// the chain (guarded — the data is one hop today) before any lineage math.
export function resolveBase(platform, idx) {
  let p = platform, guard = 0
  while (p?.basePlatformId && guard++ < 5) {
    const b = idx.platformsById.get(p.basePlatformId)
    if (!b) break
    p = b
  }
  return p || platform
}

export function ladderOf(platform, idx) {
  return (platform && idx.tiersByPlatform.get(platform.id)) || []
}

const maxPosition = ladder => ladder.reduce((m, t) => Math.max(m, t.tierPosition), 0)

// ── Platform delta (vertical lineage) ────────────────────────────────────────
// Generations behind = count of distinct lineage_order values in
// (patientOrder, recOrder]. Intervening steps carry their platform_innovations
// — accumulated, oldest first, so the story reads as compounding capability.
function platformDelta(basePatient, baseRec, idx) {
  const lineage = idx.lineages.get(baseRec.manufacturer) || []
  const po = basePatient.lineageOrder, ro = baseRec.lineageOrder
  if (po == null || ro == null) {
    return { generations: null, steps: [], note: 'lineage position unknown' }
  }
  const stepRows = lineage.filter(p => p.lineageOrder > po && p.lineageOrder <= ro)
  const generations = new Set(stepRows.map(p => p.lineageOrder)).size
  return {
    generations,
    steps: stepRows.map(p => ({
      platform: p,
      innovations: p.platformInnovations || [],
      verificationStatus: p.verificationStatus,
    })),
  }
}

// ── Tier delta (evaluated on the recommended platform's ladder) ──────────────
// When the recommended platform is a private label with no gate data of its own
// (TruHearing sells 3 levels of what is a 5-level Signia ladder), fall through
// to the base platform's ladder by POSITION — TH Premium is position 1, which
// lands on 7IX; Advanced (2) on 5IX; Standard (3) on 3IX. viaBase flags it so
// the provider view can say "via Signia IX".
function tierDelta(patientPlatform, patientTier, recPlatform, recTier, idx) {
  if (!recTier) return { applicable: false, reason: 'no-recommended-tier' }

  const patientLadder = ladderOf(patientPlatform, idx)
  let ladderPlatform = recPlatform
  let ladder = ladderOf(recPlatform, idx)
  let anchorTier = recTier
  let viaBase = false

  const hasGateData = ladder.some(t => (t.tierFeatureGates || []).length > 0)
  if (ladder.length <= 1 || !hasGateData) {
    const base = resolveBase(recPlatform, idx)
    if (base.id !== recPlatform.id) {
      const baseLadder = ladderOf(base, idx)
      const positionMatch = baseLadder.find(t => t.tierPosition === recTier.tierPosition)
      if (baseLadder.length > 1 && positionMatch) {
        ladderPlatform = base
        ladder = baseLadder
        anchorTier = positionMatch
        viaBase = true
      }
    }
  }

  if (ladder.length <= 1) return { applicable: false, reason: 'single-level-recommendation' }
  if (patientLadder.length <= 1 && patientPlatform?.deviceClass !== 'otc') {
    // Single-level channel line (KS9…): it had no tier ladder, so a tier story
    // would be invented. The platform/capability story carries the comparison.
    return { applicable: false, reason: 'patient-single-level-line' }
  }

  const patientPosRaw = patientTier?.tierPosition ?? (patientPlatform?.deviceClass === 'otc' ? maxPosition(ladder) : null)
  if (patientPosRaw == null) return { applicable: false, reason: 'unknown-patient-tier' }

  const recPos = anchorTier.tierPosition
  const patientPos = Math.min(patientPosRaw, maxPosition(ladder))
  if (patientPos <= recPos) {
    return { applicable: true, moved: false, patientPos, recPos, ladderPlatform, viaBase, gates: [] }
  }
  const between = ladder
    .filter(t => t.tierPosition >= recPos && t.tierPosition < patientPos)
    .sort((a, b) => b.tierPosition - a.tierPosition) // just-above-patient first, flagship last
  return {
    applicable: true,
    moved: true,
    patientPos,
    recPos,
    ladderSize: ladder.length,
    ladderPlatform,
    viaBase,
    gates: between.map(t => ({
      tier: t,
      gates: t.tierFeatureGates || [],
      verificationStatus: t.verificationStatus,
    })),
  }
}

// ── Capability categories (cross-brand / OTC path) ───────────────────────────
// Named capabilities grouped by category, each item tagged with the
// verification_status of the row it came from. No spec-number racing.
const AURACAST_LABEL = {
  yes: 'Auracast broadcast audio',
  firmware_upgradeable: 'Auracast-ready (firmware upgrade)',
}

function sideCapabilities(platform, tier) {
  if (!platform) return null
  const tag = (values, status) =>
    (values || []).filter(Boolean).map(text => ({ text, status }))
  const pv = platform.verificationStatus
  const tv = tier?.verificationStatus
  return {
    connectivity: [
      ...tag(platform.bluetoothProtocol, pv),
      ...tag([AURACAST_LABEL[platform.auracast]], pv),
      ...tag([platform.handsfreeCalls], pv),
    ],
    speechInNoise: [
      ...tag([platform.dnnProcessing], pv),
      ...tag([tier?.noiseMgmt, tier?.directionality], tv),
      ...tag(tier?.speechInNoiseFeatures, tv),
    ],
    sensors: tag(platform.sensors, pv),
    power: [
      ...tag([platform.rechargeableOffered === true ? 'Rechargeable option' : null], pv),
      ...tag([platform.disposableOffered === true ? 'Replaceable-battery option' : null], pv),
    ],
  }
}

export const CATEGORY_LABELS = [
  ['connectivity',  'Connectivity'],
  ['speechInNoise', 'Speech in noise'],
  ['sensors',       'Sensors & health'],
  ['power',         'Power'],
]

// ── Internal spectrum score ──────────────────────────────────────────────────
// Drives marker POSITIONS on the capability spectrum only — never shown to
// patients as a number (rule §3.1). capability_score (provider-assigned) wins
// when present; otherwise a provisional structural heuristic: how far along the
// manufacturer's lineage the platform sits, plus how high on its ladder the
// tier sits. OTC devices occupy a deliberately lower band — that separation IS
// the OTC→prescription story, told structurally.
export function spectrumScore(platform, tier, idx) {
  if (tier?.capabilityScore != null) return Math.max(0, Math.min(100, tier.capabilityScore))
  if (!platform) return null
  const base = resolveBase(platform, idx)
  const lineage = idx.lineages.get(base.manufacturer) || []
  const orders = [...new Set(lineage.map(p => p.lineageOrder))]
  const lineageFrac = orders.length > 1 && base.lineageOrder != null
    ? (orders.indexOf(base.lineageOrder)) / (orders.length - 1)
    : 0.5
  const ladder = ladderOf(platform, idx).length > 1 ? ladderOf(platform, idx) : ladderOf(base, idx)
  const pos = tier?.tierPosition ?? maxPosition(ladder)
  const tierFrac = ladder.length > 1 ? (maxPosition(ladder) - pos) / (maxPosition(ladder) - 1) : 0.5
  if (platform.deviceClass === 'otc') return Math.round(8 + lineageFrac * 10 + tierFrac * 10)
  return Math.round(20 + lineageFrac * 50 + tierFrac * 30)
}

// ── Main entry ───────────────────────────────────────────────────────────────
// Inputs are catalog ids (from a fast-path record, a fitting, or the pickers).
// Returns everything the component renders; null if either platform is missing.
export function compareDevices({ patientPlatformId, patientTierId, recommendedPlatformId, recommendedTierId }, idx) {
  const patientPlatform = idx.platformsById.get(patientPlatformId) || null
  const recPlatform = idx.platformsById.get(recommendedPlatformId) || null
  if (!patientPlatform || !recPlatform) return null
  const patientTier = idx.tiersById.get(patientTierId) || null
  const recTier = idx.tiersById.get(recommendedTierId) || null

  const basePatient = resolveBase(patientPlatform, idx)
  const baseRec = resolveBase(recPlatform, idx)
  const otcStep = patientPlatform.deviceClass === 'otc' && recPlatform.deviceClass === 'prescription'
  const vertical = basePatient.manufacturer === baseRec.manufacturer
  const mode = otcStep ? 'otc'
    : !vertical ? 'cross-brand'
    : basePatient.id === baseRec.id ? 'same-platform'
    : 'vertical'

  return {
    mode,
    patient: { platform: patientPlatform, tier: patientTier, base: basePatient },
    recommended: { platform: recPlatform, tier: recTier, base: baseRec },
    platformDelta: mode === 'vertical' ? platformDelta(basePatient, baseRec, idx)
      : mode === 'same-platform' ? { generations: 0, steps: [] }
      : null,
    categories: (mode === 'cross-brand' || mode === 'otc') ? {
      patient: sideCapabilities(patientPlatform, patientTier),
      recommended: sideCapabilities(recPlatform, recTier),
    } : null,
    tierDelta: tierDelta(patientPlatform, patientTier, recPlatform, recTier, idx),
    spectrum: {
      patient: spectrumScore(patientPlatform, patientTier, idx),
      recommended: spectrumScore(recPlatform, recTier, idx),
    },
  }
}
