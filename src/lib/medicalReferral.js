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

// ============================================================
// medicalReferral.js — Medical Referral vocabulary + helpers
//
// A patient who presents with a medical red-flag condition must be
// referred for medical evaluation before amplification can proceed.
// The referral closes the visit with a 'medical_referral' device
// disposition (its own measured outcome bucket — deliberately NOT
// lumped into not_a_candidate) and produces a printable referral
// document the patient takes to their medical appointment.
//
// The reason vocabulary is the FDA red-flag condition list for
// hearing aid dispensing (21 CFR 801.420) plus asymmetry and a
// free-text catch-all. Keys are mirrored by the CHECK constraint on
// medical_referrals.reasons — keep both in sync.
// ============================================================

export const REFERRAL_REASONS = [
  {
    key: 'ear_deformity',
    label: 'Visible congenital or traumatic deformity of the ear',
  },
  {
    key: 'active_drainage',
    label: 'History of active drainage from the ear within the previous 90 days',
  },
  {
    key: 'sudden_progressive_loss',
    label: 'History of sudden or rapidly progressive hearing loss within the previous 90 days',
  },
  {
    key: 'unilateral_sudden_loss',
    label: 'Unilateral hearing loss of sudden or recent onset within the previous 90 days',
  },
  {
    key: 'significant_asymmetry',
    label: 'Significant asymmetry between ears on audiometric testing',
  },
  {
    key: 'air_bone_gap',
    label: 'Audiometric air-bone gap of 15 dB or greater at 500, 1000, and 2000 Hz',
  },
  {
    key: 'acute_chronic_dizziness',
    label: 'Acute or chronic dizziness',
  },
  {
    key: 'ear_pain_discomfort',
    label: 'Pain or discomfort in the ear',
  },
  {
    key: 'cerumen_foreign_body',
    label: 'Visible evidence of significant cerumen accumulation or a foreign body in the ear canal',
  },
  {
    key: 'other_medical_concern',
    label: 'Other condition warranting medical evaluation (described in notes)',
  },
]

export const REFERRAL_REASON_KEYS = REFERRAL_REASONS.map(r => r.key)

export function referralReasonLabel(key) {
  return REFERRAL_REASONS.find(r => r.key === key)?.label || key
}

export const REFERRAL_TYPES = [
  { key: 'ent', label: 'ENT / Otolaryngologist' },
  { key: 'physician', label: 'Primary care physician' },
  { key: 'other', label: 'Other medical specialist' },
]

export function referralTypeLabel(key) {
  return REFERRAL_TYPES.find(t => t.key === key)?.label || 'Medical provider'
}

// A referral needs at least one checked reason; 'other_medical_concern'
// additionally needs the note that describes it.
export function validateReferral({ reasons = [], notes = '' }) {
  if (!reasons.length) return 'Select at least one reason for the referral.'
  if (reasons.includes('other_medical_concern') && !notes.trim()) {
    return 'Describe the medical concern in the notes field.'
  }
  return null
}
