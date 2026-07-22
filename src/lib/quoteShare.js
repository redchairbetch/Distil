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
// quoteShare.js — display snapshot for shared take-home quotes
//
// Builds the JSONB payload stored on a quote_shares row: the same
// facts the quote PDF prints, deliberately PHI-minimal because the
// /quote/<token> page renders behind nothing but token knowledge.
//
// PHI policy (non-negotiable):
//   * patient FIRST NAME only — never last name, phone, DOB, or address
//   * audiogram/speech data ride along (they're the counseling core and
//     are effectively de-identified next to a bare first name)
//   * NEVER include Nations fitting fees or any clinic-revenue figure —
//     quotes are copay-only by explicit decision (context.md)
//
// Totals are computed HERE and frozen into the snapshot so the web page
// always agrees with the PDF the patient carried home, even if pricing
// logic changes later.
// ============================================================

import { CARE_PLAN_META } from '../generateQuote.js'

export const QUOTE_SHARE_VALID_DAYS = 30

export function firstNameOf(fullName) {
  const t = String(fullName || '').trim()
  return t ? t.split(/\s+/)[0] : ''
}

// Strip a device side down to display fields — drops ids and anything the
// page doesn't render.
function sideSnapshot(side) {
  if (!side) return null
  return {
    style:        side.style        || '',
    manufacturer: side.manufacturer || '',
    family:       side.family || side.model || '',
    techLevel:    side.techLevel    || '',
    variant:      side.variant      || '',
    battery:      side.battery      || '',
    isCROS:       !!side.isCROS || /^(CROS|BICROS)/i.test(side.variant || ''),
  }
}

// Mirrors generateQuote's totals math (per-ear prices with legacy
// pricePerAid fallback, retail anchor + discount, private-pay bundling).
export function buildQuoteSharePayload({
  patient,
  devices,
  pricePerAid,
  leftPrice = null,
  rightPrice = null,
  leftRetail = null,
  rightRetail = null,
  selectedCarePlan,
  payType,
  directPurchase = false,
  tpa = null,
  carrier = null,
  tierLabel = null,
  audiology = null,
  counselingSections = null,
  provider = null,
}) {
  const cpKey = CARE_PLAN_META[selectedCarePlan] ? selectedCarePlan : 'complete'
  const cpMeta = CARE_PLAN_META[cpKey]
  const isBilateral = devices.fittingType === 'bilateral' || devices.fittingType === 'cros_bicros'
  const aidCount = isBilateral ? 2 : 1
  const hasPerEar = leftPrice != null || rightPrice != null
  const deviceTotal = hasPerEar
    ? (leftPrice || 0) + (rightPrice || 0)
    : (pricePerAid || 0) * aidCount

  const hasRetail = leftRetail != null || rightRetail != null
  const sideRetail = (side, retail, net) =>
    side ? (retail != null ? retail : (net != null ? net : 0)) : 0
  let retailTotal = 0
  if (isBilateral) {
    retailTotal = sideRetail(devices.right, rightRetail, rightPrice) + sideRetail(devices.left, leftRetail, leftPrice)
  } else if (devices.fittingType === 'monaural_right') {
    retailTotal = sideRetail(devices.right, rightRetail, rightPrice)
  } else {
    retailTotal = sideRetail(devices.left, leftRetail, leftPrice)
  }
  const totalDiscount = Math.max(0, retailTotal - deviceTotal)
  const hasDiscount = hasRetail && totalDiscount > 0.005

  const isPrivate = (payType || '').toLowerCase() === 'private'
  const carePlanPrice = isPrivate ? 0 : (cpMeta.price || 0)
  const total = deviceTotal + carePlanPrice

  return {
    version: 1,
    quoteDate: new Date().toISOString().split('T')[0],
    validDays: QUOTE_SHARE_VALID_DAYS,
    patient: { firstName: firstNameOf(patient?.name) },
    devices: {
      fittingType: devices.fittingType,
      left:  sideSnapshot(devices.left),
      right: sideSnapshot(devices.right),
    },
    pricing: {
      pricePerAid: pricePerAid ?? null,
      leftPrice, rightPrice,
      leftRetail, rightRetail,
      deviceTotal,
      totalDiscount: hasDiscount ? totalDiscount : 0,
      hasDiscount,
      carePlanPrice,
      total,
    },
    selectedCarePlan: cpKey,
    payType: payType || null,
    directPurchase: !!directPurchase,
    tpa, carrier, tierLabel,
    audiology: audiology ? {
      rightT:   audiology.rightT   || null,
      leftT:    audiology.leftT    || null,
      unaidedR: audiology.unaidedR ?? null,
      unaidedL: audiology.unaidedL ?? null,
      aidedR:   audiology.aidedR   ?? null,
      aidedL:   audiology.aidedL   ?? null,
      sinBin:   audiology.sinBin   ?? null,
    } : null,
    counselingSections: Array.isArray(counselingSections) && counselingSections.length
      ? counselingSections.map(s => ({ heading: s.heading, body: s.body }))
      : null,
    provider: { fullName: provider?.fullName || '' },
  }
}
