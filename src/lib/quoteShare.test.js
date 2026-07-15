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

import { describe, it, expect } from 'vitest'
import { buildQuoteSharePayload, firstNameOf } from './quoteShare.js'

const RIC = (over = {}) => ({
  style: 'ric', manufacturer: 'Signia', family: 'Pure Charge&Go IX',
  techLevel: '7', variant: '', battery: 'Li-Ion Rechargeable', isCROS: false,
  ...over,
})

describe('firstNameOf', () => {
  it('takes the first token only', () => {
    expect(firstNameOf('Margaret Ann Thatcher')).toBe('Margaret')
    expect(firstNameOf('  Bob  ')).toBe('Bob')
    expect(firstNameOf('')).toBe('')
    expect(firstNameOf(null)).toBe('')
  })
})

describe('buildQuoteSharePayload', () => {
  it('is PHI-minimal: first name only, no phone/contact fields', () => {
    const p = buildQuoteSharePayload({
      patient: { name: 'Jane Q Doe', phone: '555-1234', dob: '1950-01-01' },
      devices: { fittingType: 'bilateral', left: RIC(), right: RIC() },
      pricePerAid: 850,
      selectedCarePlan: 'complete',
      payType: 'insurance',
    })
    expect(p.patient).toEqual({ firstName: 'Jane' })
    expect(JSON.stringify(p)).not.toContain('555-1234')
    expect(JSON.stringify(p)).not.toContain('Doe')
    expect(JSON.stringify(p)).not.toContain('1950')
  })

  it('bilateral insurance: legacy pricePerAid fallback + care plan charge', () => {
    const p = buildQuoteSharePayload({
      patient: { name: 'Jane Doe' },
      devices: { fittingType: 'bilateral', left: RIC(), right: RIC() },
      pricePerAid: 850,
      selectedCarePlan: 'complete',
      payType: 'insurance',
    })
    expect(p.pricing.deviceTotal).toBe(1700)
    expect(p.pricing.carePlanPrice).toBe(1250)
    expect(p.pricing.total).toBe(2950)
    expect(p.pricing.hasDiscount).toBe(false)
  })

  it('per-ear prices win over pricePerAid (CROS math)', () => {
    // TruHearing CROS: transmitter bills at the tier instrument price too,
    // but a standard-catalog BICROS has an $850 aid + $1,250 transmitter.
    const p = buildQuoteSharePayload({
      patient: { name: 'Jane' },
      devices: {
        fittingType: 'cros_bicros',
        left:  RIC({ variant: 'BICROS', isCROS: true }),
        right: RIC(),
      },
      pricePerAid: 850,
      leftPrice: 1250,
      rightPrice: 850,
      selectedCarePlan: 'punch',
      payType: 'insurance',
    })
    expect(p.pricing.deviceTotal).toBe(2100)
    expect(p.pricing.total).toBe(2100 + 575)
    expect(p.devices.left.isCROS).toBe(true)
  })

  it('flags a CROS side from the variant even when isCROS was not set', () => {
    const p = buildQuoteSharePayload({
      patient: { name: 'Jane' },
      devices: {
        fittingType: 'cros_bicros',
        left: RIC({ variant: 'CROS', isCROS: false }),
        right: RIC(),
      },
      pricePerAid: 850,
      leftPrice: 1250, rightPrice: 850,
      selectedCarePlan: 'complete',
      payType: 'insurance',
    })
    expect(p.devices.left.isCROS).toBe(true)
  })

  it('private pay bundles the care plan ($0 line) and carries the discount', () => {
    const p = buildQuoteSharePayload({
      patient: { name: 'Jane' },
      devices: { fittingType: 'bilateral', left: RIC(), right: RIC() },
      pricePerAid: null,
      leftPrice: 3497.5, rightPrice: 3497.5,
      leftRetail: 3997.5, rightRetail: 3997.5,
      selectedCarePlan: 'complete',
      payType: 'private',
    })
    expect(p.pricing.carePlanPrice).toBe(0)
    expect(p.pricing.deviceTotal).toBe(6995)
    expect(p.pricing.total).toBe(6995)
    expect(p.pricing.hasDiscount).toBe(true)
    expect(p.pricing.totalDiscount).toBe(1000)
  })

  it('monaural totals only count the fitted ear', () => {
    const p = buildQuoteSharePayload({
      patient: { name: 'Jane' },
      devices: { fittingType: 'monaural_right', left: null, right: RIC() },
      pricePerAid: 850,
      selectedCarePlan: 'paygo',
      payType: 'insurance',
    })
    expect(p.pricing.deviceTotal).toBe(850)
    // Standard Billing has no upfront price
    expect(p.pricing.carePlanPrice).toBe(0)
    expect(p.pricing.total).toBe(850)
    expect(p.devices.left).toBeNull()
  })

  it('unknown care plan id falls back to complete (matches the PDF)', () => {
    const p = buildQuoteSharePayload({
      patient: { name: 'Jane' },
      devices: { fittingType: 'bilateral', left: RIC(), right: RIC() },
      pricePerAid: 850,
      selectedCarePlan: 'not_a_plan',
      payType: 'insurance',
    })
    expect(p.selectedCarePlan).toBe('complete')
    expect(p.pricing.carePlanPrice).toBe(1250)
  })

  it('keeps only the audiology fields the page renders', () => {
    const p = buildQuoteSharePayload({
      patient: { name: 'Jane' },
      devices: { fittingType: 'bilateral', left: RIC(), right: RIC() },
      pricePerAid: 850,
      selectedCarePlan: 'complete',
      payType: 'insurance',
      audiology: {
        rightT: { 1000: 40 }, leftT: { 1000: 45 },
        unaidedR: 72, unaidedL: 68, aidedR: 92, aidedL: 90, sinBin: 4,
        internalNotes: 'do not leak', tympanometry: { right: 'A' },
      },
    })
    expect(p.audiology.rightT).toEqual({ 1000: 40 })
    expect(p.audiology.sinBin).toBe(4)
    expect(JSON.stringify(p.audiology)).not.toContain('do not leak')
    expect(p.audiology.tympanometry).toBeUndefined()
  })
})
