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

// ── catalog.js — device-catalog data access ──────────────────────────────────
// Loads device_platforms / device_tech_tiers (the generational catalog behind
// the two-delta comparison) and writes legacy fast-path fitting records. Lives
// alongside db.js by design (device-catalog build brief §6): the catalog is
// research-verified REFERENCE data with its own lifecycle (verification_status,
// source_urls), separate from db.js's transactional loaders. Same idioms:
// camelCase mapping, console.error + safe fallback returns.
//
// The catalog deliberately shares no vocabulary with product_catalog_tier:
// tier_position here counts DOWN from the flagship (1 = top of the ladder),
// while product_catalog_tier.tier_rank counts up. Plan tier ≠ device generation.
import { supabase } from './supabase.js'

function mapPlatform(row) {
  return {
    id:                  row.id,
    manufacturer:        row.manufacturer,
    platformName:        row.platform_name,
    deviceClass:         row.device_class,
    chipset:             row.chipset,
    releaseYear:         row.release_year,
    status:              row.status,
    bluetoothProtocol:   row.bluetooth_protocol || [],
    auracast:            row.auracast,
    rechargeableOffered: row.rechargeable_offered,
    disposableOffered:   row.disposable_offered,
    handsfreeCalls:      row.handsfree_calls,
    dnnProcessing:       row.dnn_processing,
    sensors:             row.sensors || [],
    ownVoiceProcessing:  row.own_voice_processing,
    formFactors:         row.form_factors || [],
    platformInnovations: row.platform_innovations || [],
    regulatoryClass:     row.regulatory_class,
    appFitting:          row.app_fitting,
    notableLimits:       row.notable_limits,
    lineageOrder:        row.lineage_order,
    basePlatformId:      row.base_platform_id,
    sourceUrls:          row.source_urls || [],
    verificationStatus:  row.verification_status,
    notes:               row.notes,
  }
}

function mapTier(row) {
  return {
    id:                    row.id,
    platformId:            row.platform_id,
    tierDesignation:       row.tier_designation,
    tierPosition:          row.tier_position,
    channelsBands:         row.channels_bands,
    mfrSpecTerm:           row.mfr_spec_term,
    noiseMgmt:             row.noise_mgmt,
    directionality:        row.directionality,
    speechInNoiseFeatures: row.speech_in_noise_features || [],
    programCount:          row.program_count,
    tierFeatureGates:      row.tier_feature_gates || [],
    tinnitusFeatures:      row.tinnitus_features,
    capabilityScore:       row.capability_score != null ? Number(row.capability_score) : null,
    sourceUrls:            row.source_urls || [],
    verificationStatus:    row.verification_status,
    notes:                 row.notes,
  }
}

// Full catalog in one shot — reference data, small enough to hold client-side
// (dozens of platforms, a few hundred tiers). Callers index it with
// indexCatalog() from catalogComparison.js.
export async function loadDeviceCatalog() {
  const [pRes, tRes] = await Promise.all([
    supabase.from('device_platforms').select('*')
      .order('manufacturer').order('lineage_order', { ascending: true }),
    supabase.from('device_tech_tiers').select('*').order('tier_position'),
  ])
  if (pRes.error) { console.error('loadDeviceCatalog platforms:', pRes.error); return { platforms: [], tiers: [] } }
  if (tRes.error) { console.error('loadDeviceCatalog tiers:', tRes.error); return { platforms: [], tiers: [] } }
  return {
    platforms: (pRes.data || []).map(mapPlatform),
    tiers:     (tRes.data || []).map(mapTier),
  }
}

// ── Legacy fast-path ─────────────────────────────────────────────────────────
// A returning patient with no Distil history gets a minimal fitting row:
// catalog-linked device (or free text), fit date, warranty. record_source
// distinguishes it from a real Distil fitting everywhere downstream.
export async function createLegacyFastpathFitting({
  patientId, enteredBy = null, fitDate, fittingType = 'bilateral',
  platformId = null, tierId = null, deviceFreetext = null, warrantyExpiry = null,
}) {
  const { data, error } = await supabase
    .from('device_fittings')
    .insert({
      patient_id:      patientId,
      fitted_by:       enteredBy,
      fitting_date:    fitDate,
      fitting_type:    fittingType,
      warranty_expiry: warrantyExpiry || null,
      platform_id:     platformId,
      tier_id:         tierId,
      device_freetext: deviceFreetext || null,
      record_source:   'legacy_fastpath',
    })
    .select()
    .single()
  if (error) { console.error('createLegacyFastpathFitting:', error); throw error }
  return data
}

// Newest fitting that actually names a device the comparison can use —
// catalog-linked (platform_id) or at least free-text. Fast-path records and
// catalog-tagged Distil fittings both qualify.
export async function loadNewestCatalogFitting(patientId) {
  if (!patientId) return null
  const { data, error } = await supabase
    .from('device_fittings')
    .select('id, fitting_date, warranty_expiry, record_source, platform_id, tier_id, device_freetext')
    .eq('patient_id', patientId)
    .order('fitting_date', { ascending: false })
  if (error) { console.error('loadNewestCatalogFitting:', error); return null }
  return (data || []).find(r => r.platform_id || r.device_freetext) || null
}
