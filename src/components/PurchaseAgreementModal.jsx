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

import { useState, useMemo } from 'react'
import { downloadPurchaseAgreement } from '../generatePurchaseAgreement.js'
import {
  uploadPatientDocument,
  logPriceAdjustment,
  recordPurchaseFitting,
  updateInsuranceCoverage,
  updatePatientContact,
  convertTnsToActive,
} from '../db.js'
import { ADJUST_REASON_CODES } from '../views/AdjustPriceModal.jsx'
import { nationsCoverageTier, deriveEarPrice, CROS_PRICE_PER_UNIT } from '../lib/pricing.js'

// Full purchase-agreement flow launched from the patient profile (or handed
// off from the Custom Quote via `initialState`). Replaces the old read-only
// signing modal, which priced from the chart snapshot with no way to change
// devices, pricing, or care plan — the exact failure when a patient closes at
// a quoted price that never touched the chart. Three stages:
//   1. Configure — same device cascade + pricing engine as CreateQuoteModal
//      (plan copays, retail-anchored private-pay discounts with §6 audit
//      logging, device-driven UHCH/Nations copays, manual-copay fallback),
//      plus the care plan the agreement is executed with.
//   2. Sign — typed patient signature (+ optional delivery acknowledgement),
//      then PDF download + archive to patient_documents.
//   3. Chart write-back — the agreed configuration becomes the chart of
//      record: new fitting row when devices changed (history-preserving),
//      care plan, pay type, and the pricing snapshot future documents read.

// Fitting-taxonomy styles collapsed to catalog buckets — same remap as
// CreateQuoteModal so a patient fit in a style the catalog doesn't key
// (e.g. TruHearing Instant Fit) still resolves the manufacturer cascade.
const STYLE_BUCKET = {
  sr: 'ric', ric_bct: 'ric',
  s_bte: 'bte', p_bte: 'bte', sp_bte: 'bte',
  hs: 'ite', fs: 'ite', if: 'ite',
}

function normalizeStyle(cat, manufacturer, style) {
  if (!style) return ''
  const mfrStyles = new Set()
  cat.forEach(e => {
    if (manufacturer && e.manufacturer !== manufacturer) return
    ;(e.styles || []).forEach(s => mfrStyles.add(s))
  })
  if (mfrStyles.has(style)) return style
  const bucket = STYLE_BUCKET[style]
  return (bucket && mfrStyles.has(bucket)) ? bucket : style
}

// Unlike the quote's "None", an executed agreement always carries a care
// arrangement — Standard Billing (paygo) is the no-plan option.
const CARE_PLAN_OPTIONS = [
  { id: 'complete', label: 'Complete Care+',   price: 1250 },
  { id: 'punch',    label: 'MHC Punch Card',   price: 575  },
  { id: 'paygo',    label: 'Standard Billing ($65/visit)', price: 0 },
]

function isCrosVariant(v) {
  return !!v && /^(CROS|BICROS)/i.test(v)
}

function emptySide() {
  return {
    style:'', manufacturer:'', generation:'', familyId:'',
    family:'', variant:'', techLevel:'', isCROS:false,
  }
}

// Keep the saved side's hardware detail (battery, color, receiver, dome…) so
// it prints on the agreement and survives the chart write-back when the
// device itself isn't changed. Cleared by setSideField when the cascade
// picks a different device.
function sideFromSaved(s) {
  if (!s) return emptySide()
  return {
    ...s,
    style:        s.style        || '',
    manufacturer: s.manufacturer || '',
    generation:   s.generation   || '',
    familyId:     s.familyId     || '',
    family:       s.family       || s.model || '',
    variant:      s.variant      || '',
    techLevel:    s.techLevel    || '',
    isCROS:       !!s.isCROS || isCrosVariant(s.variant),
  }
}

function defaultPricePerAid(patient) {
  if (patient?.payType === 'private') {
    return patient?.privatePay?.tierPrice || 2750
  }
  return patient?.insurance?.tierPrice ?? 0
}

// Device identity for the "did the configuration change?" check that gates
// the new-fitting insert. Styles compare by catalog bucket so a saved
// fitting-taxonomy style ('if') matching its normalized bucket ('ite')
// doesn't read as a device change.
function sideIdentity(s) {
  if (!s) return ''
  const bucket = (st) => STYLE_BUCKET[st] || st || ''
  return [s.manufacturer, s.family, s.techLevel, s.variant, s.generation, bucket(s.style)]
    .map(x => x || '').join('|')
}

const todayISO = () => new Date().toISOString().split('T')[0]

const C = {
  ink:    '#0a1628',
  muted:  '#6b7280',
  line:   '#e5e7eb',
  bgSoft: '#f9fafb',
  accent: '#1d4ed8',
  navy:   '#0a1628',
}

const money = (n) =>
  (n == null || isNaN(n))
    ? '—'
    : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const inputStyle = {
  width: '100%', padding: '7px 10px',
  border: `1px solid ${C.line}`, borderRadius: 6,
  fontSize: 13, color: C.ink, boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const labelStyle = {
  display: 'block',
  fontSize: 11, fontWeight: 600, color: C.muted,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: 4,
}

export default function PurchaseAgreementModal({
  patient,
  clinic,
  provider,
  signatureImageBase64 = null,
  clinicId,
  staffId,
  catalog = [],
  insurancePlans = [],
  productCatalogTiers = [],
  anchorsByClass = {},
  resolveRetailPerAid,
  initialState = null,          // hand-off from the Custom Quote modal
  closerNeedsLocation = false,
  onNeedLocation,
  onClose,
  onArchived,                   // documents list refresh
  onChartSaved,                 // (patch) => parent merges into selectedPatient + refreshes
}) {
  const p = patient
  const init = initialState || {}
  const patientTpa = p?.insurance?.tpa || null

  const [step, setStep] = useState('configure') // 'configure' | 'sign' | 'delivery' | 'done'

  const [payType, setPayType] = useState(init.payType || p?.payType || 'insurance')
  // Quote hand-off may carry '' (the quote's "None"); an agreement needs a
  // real arrangement, so that maps to Standard Billing.
  const [carePlan, setCarePlan] = useState(
    init.carePlan !== undefined
      ? (init.carePlan || 'paygo')
      : (p?.carePlan || 'complete')
  )

  const [planCarrier, setPlanCarrier] = useState(init.planCarrier ?? (p?.insurance?.carrier || ''))
  const [planGroup,   setPlanGroup]   = useState(init.planGroup   ?? (p?.insurance?.planGroup || ''))
  const [planTier,    setPlanTier]    = useState(init.planTier    ?? (p?.insurance?.tier || ''))

  const planMode = payType === 'insurance' && planCarrier !== ''
  const selectedPlan = planMode
    ? insurancePlans.find(pl => pl.carrier === planCarrier && pl.planGroup === planGroup) || null
    : null
  const deviceDriven = selectedPlan?.tpa === 'UHCH' || selectedPlan?.tpa === 'Nations'
  const tierCopay = selectedPlan && !deviceDriven
    ? (selectedPlan.tiers?.find(t => t.label === planTier)?.price ?? null)
    : null

  const quoteTpa = selectedPlan ? selectedPlan.tpa : patientTpa
  const isNations = quoteTpa === 'Nations'
  const famOffPlan = (fam) =>
    isNations && Array.isArray(fam?.techLevels) && fam.techLevels.length > 0
      && fam.techLevels.every(t => nationsCoverageTier(fam, t) === null)
  const techOffPlan = (fam, t) => isNations && nationsCoverageTier(fam, t) === null
  const activeCatalog = useMemo(
    () => catalog.filter(e => e.active && (!e.tpa || e.tpa === quoteTpa)),
    [catalog, quoteTpa]
  )

  const planCarriers = useMemo(
    () => [...new Set(insurancePlans.map(pl => pl.carrier))].sort(),
    [insurancePlans]
  )
  const carrierPlans = insurancePlans.filter(pl => pl.carrier === planCarrier)

  const pickCarrier = (c) => {
    const groups = insurancePlans.filter(pl => pl.carrier === c)
    const only = groups.length === 1 ? groups[0] : null
    setPlanCarrier(c)
    setPlanGroup(only ? only.planGroup : '')
    setPlanTier(only?.tiers?.length === 1 ? only.tiers[0].label : '')
  }
  const pickPlanGroup = (g) => {
    const pl = insurancePlans.find(x => x.carrier === planCarrier && x.planGroup === g)
    setPlanGroup(g)
    setPlanTier(pl?.tiers?.length === 1 ? pl.tiers[0].label : '')
  }

  const [hasLeft,  setHasLeft]  = useState(init.hasLeft  ?? (!!p?.devices?.left  || !p?.devices))
  const [hasRight, setHasRight] = useState(init.hasRight ?? (!!p?.devices?.right || !p?.devices))

  const [left,  setLeft]  = useState(() => {
    if (init.left) return { ...init.left }
    const s = sideFromSaved(p?.devices?.left)
    return { ...s, style: normalizeStyle(activeCatalog, s.manufacturer, s.style) }
  })
  const [right, setRight] = useState(() => {
    if (init.right) return { ...init.right }
    const s = sideFromSaved(p?.devices?.right)
    return { ...s, style: normalizeStyle(activeCatalog, s.manufacturer, s.style) }
  })

  const initialPrice = p?.payType === 'private'
    ? (defaultPricePerAid(p) || 2750)
    : (p?.insurance?.tierPrice ?? 0)
  const [leftPrice,  setLeftPrice]  = useState(init.leftPrice  ?? initialPrice)
  const [rightPrice, setRightPrice] = useState(init.rightPrice ?? initialPrice)

  const [leftDisc,  setLeftDisc]  = useState(init.leftDisc  ? { ...init.leftDisc }  : { mode: '$', value: '' })
  const [rightDisc, setRightDisc] = useState(init.rightDisc ? { ...init.rightDisc } : { mode: '$', value: '' })

  const [reasonCode, setReasonCode] = useState(init.reasonCode || '')
  const [reasonText, setReasonText] = useState(init.reasonText || '')

  const [signatureName, setSignatureName] = useState('')
  const [deliveryName,  setDeliveryName]  = useState('')
  const [deliveryDate,  setDeliveryDate]  = useState('')

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  // Done panel: { warnings: string[], chartUpdated: bool }
  const [doneInfo, setDoneInfo] = useState(null)

  const optionsFor = (sd) => {
    const stylesSet = new Set()
    activeCatalog.forEach(e => (e.styles || []).forEach(s => stylesSet.add(s)))
    const styles = [...stylesSet].sort()

    const mfrsSet = new Set()
    activeCatalog.forEach(e => {
      if (sd.style && !(e.styles || []).includes(sd.style)) return
      mfrsSet.add(e.manufacturer)
    })
    const manufacturers = [...mfrsSet].sort()

    const gensSet = new Set()
    activeCatalog.forEach(e => {
      if (sd.style && !(e.styles || []).includes(sd.style)) return
      if (sd.manufacturer && e.manufacturer !== sd.manufacturer) return
      if (e.generation) gensSet.add(e.generation)
    })
    const generations = [...gensSet].sort()

    const families = activeCatalog.filter(e => {
      if (sd.style && !(e.styles || []).includes(sd.style)) return false
      if (sd.manufacturer && e.manufacturer !== sd.manufacturer) return false
      if (sd.generation && e.generation !== sd.generation) return false
      return true
    })

    const family = activeCatalog.find(e => e.id === sd.familyId)
    const techLevels = family?.techLevels || []
    const variants = family?.variants || []

    return { styles, manufacturers, generations, families, techLevels, variants, family }
  }

  const setSideField = (which, field, value) => {
    // TruHearing white-labels sync the plan tier from the product's
    // planTierKey — same behavior as the quote modal.
    if (field === 'familyId' && selectedPlan && !deviceDriven) {
      const f = activeCatalog.find(e => e.id === value)
      if (f?.planTierKey && (selectedPlan.tiers || []).some(t => t.label === f.planTierKey)) {
        setPlanTier(f.planTierKey)
      }
    }
    const update = (prev) => {
      const next = { ...prev, [field]: value }
      // Cascade resets — and picking a different device invalidates the
      // saved hardware detail (battery, receiver, dome, colors), which
      // described the old device.
      const clearHardware = () => {
        next.battery = ''; next.color = ''
        next.receiverLength = ''; next.receiverPower = ''
        next.dome = ''; next.thModel = ''
        next.faceplateColor = ''; next.shellColor = ''
        next.gainMatrix = ''; next.domeCategory = ''; next.domeSize = ''
      }
      if (field === 'style') {
        next.manufacturer = ''; next.generation = ''; next.familyId = ''
        next.family = ''; next.variant = ''; next.techLevel = ''
        clearHardware()
      } else if (field === 'manufacturer') {
        next.generation = ''; next.familyId = ''
        next.family = ''; next.variant = ''; next.techLevel = ''
        clearHardware()
      } else if (field === 'generation') {
        next.familyId = ''; next.family = ''
        next.variant = ''; next.techLevel = ''
        clearHardware()
      } else if (field === 'familyId') {
        const f = activeCatalog.find(e => e.id === value)
        next.family = f?.family || f?.name || ''
        next.variant = ''; next.techLevel = ''
        clearHardware()
      } else if (field === 'variant') {
        next.isCROS = isCrosVariant(value)
      }
      return next
    }
    if (which === 'left')  setLeft(update)
    if (which === 'right') setRight(update)
  }

  const setDiscField = (which, field, value) => {
    const upd = (prev) => ({ ...prev, [field]: value })
    if (which === 'left')  setLeftDisc(upd)
    if (which === 'right') setRightDisc(upd)
  }

  const fittingType = (() => {
    if (!hasLeft && !hasRight) return null
    const eitherCros = (hasLeft && left.isCROS) || (hasRight && right.isCROS)
    if (hasLeft && hasRight) return eitherCros ? 'cros_bicros' : 'bilateral'
    return hasLeft ? 'monaural_left' : 'monaural_right'
  })()

  // Per-ear pricing — identical engine to CreateQuoteModal.
  const fallbackRetail = defaultPricePerAid(p) || 2750
  const earPricing = (active, side, disc, priceState) => {
    if (!active) return { retail: null, discountAmt: 0, net: null }
    if (side.isCROS || isCrosVariant(side.variant)) {
      // TruHearing CROS transmitters bill at the coordinating technology-level
      // instrument price — fall through to the plan's tier copay below.
      // Every other CROS unit is a fixed $1,250 add-on, no discount.
      if (!(side.manufacturer === 'TruHearing' && payType === 'insurance' && planMode)) {
        return { retail: CROS_PRICE_PER_UNIT, discountAmt: 0, net: CROS_PRICE_PER_UNIT }
      }
    }
    if (payType === 'private') {
      const resolved = resolveRetailPerAid ? resolveRetailPerAid(side) : null
      const retail = resolved != null ? resolved : fallbackRetail
      if (retail == null) return { retail: null, discountAmt: 0, net: null }
      const v = Number(disc.value) || 0
      let amt = disc.mode === '%' ? retail * (v / 100) : v
      amt = Math.max(0, Math.min(amt, retail))
      return { retail, discountAmt: amt, net: Math.max(0, retail - amt) }
    }
    if (planMode) {
      if (!selectedPlan) return { retail: null, discountAmt: 0, net: null }
      if (deviceDriven) {
        if (!side.familyId || !side.techLevel) return { retail: null, discountAmt: 0, net: null }
        const ep = deriveEarPrice(side, {
          form: {
            payType: 'insurance',
            tpa: selectedPlan.tpa,
            carrier: selectedPlan.carrier,
            planGroup: selectedPlan.planGroup,
          },
          catalog, productCatalogTiers, anchorsByClass, plans: insurancePlans,
        })
        return {
          retail: null, discountAmt: 0,
          net: ep?.price ?? null,
          coverageTier: ep?.tier || null,
          offPlan: !!ep?.offPlan,
          needsRate: !!ep?.requiresVerification,
        }
      }
      return { retail: null, discountAmt: 0, net: tierCopay }
    }
    return { retail: null, discountAmt: 0, net: Number(priceState) || 0 }
  }

  const leftPx  = earPricing(hasLeft,  left,  leftDisc,  leftPrice)
  const rightPx = earPricing(hasRight, right, rightDisc, rightPrice)
  const leftEarP  = leftPx.net
  const rightEarP = rightPx.net

  const cpMeta = CARE_PLAN_OPTIONS.find(c => c.id === carePlan) || CARE_PLAN_OPTIONS[0]
  // Private pay bundles the care plan into the per-aid retail price.
  const carePlanCost = payType === 'private' ? 0 : cpMeta.price

  const retailSubtotal = (leftPx.retail || 0) + (rightPx.retail || 0)
  const totalDiscount  = (leftPx.discountAmt || 0) + (rightPx.discountAmt || 0)
  const hasDiscount    = totalDiscount > 0.005
  const deviceTotal    = (leftEarP || 0) + (rightEarP || 0)
  const grandTotal     = deviceTotal + carePlanCost

  const needsReason = payType === 'private' && hasDiscount
  const reasonOk = !needsReason ||
    (!!reasonCode && (reasonCode !== 'other' || reasonText.trim().length > 0))
  const sideConfigured = (active, side) =>
    !active ||
    side.isCROS || isCrosVariant(side.variant) ||
    (!!side.familyId && !!side.techLevel)
  const earsResolved = payType !== 'private' ||
    (sideConfigured(hasLeft, left) && sideConfigured(hasRight, right))
  const planPriced = !planMode || (
    (!hasLeft  || leftPx.net  != null) &&
    (!hasRight || rightPx.net != null)
  )

  const canProceed = !!fittingType
    && (!hasLeft  || left.manufacturer)
    && (!hasRight || right.manufacturer)
    && reasonOk
    && earsResolved
    && planPriced

  const canSign = signatureName.trim().length > 2 && !generating

  // ── Generate: PDF → archive → audit log → chart write-back ──────────────
  const handleGenerate = async (includeDelivery) => {
    if (!canSign) return
    if (closerNeedsLocation) { onNeedLocation?.(); return }
    setGenerating(true)
    setError(null)
    const warnings = []
    try {
      const pricePerAid = (leftEarP && rightEarP)
        ? Math.max(leftEarP, rightEarP)
        : (leftEarP || rightEarP || 0)
      const sigDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      const carePlanId = carePlan || 'complete'
      // Warranty follows the printed agreement (CARE_PLAN_META): Complete
      // Care+ extends to 4 years; private pay bundles Complete Care+.
      const warrantyYears = (payType === 'private' || carePlanId === 'complete') ? 4 : 3
      const fittingDate = todayISO()
      const expiry = new Date()
      expiry.setFullYear(expiry.getFullYear() + warrantyYears)
      const warrantyExpiry = expiry.toISOString().split('T')[0]

      const leftOut  = hasLeft  ? { ...left,  model: left.family  || left.familyId  } : null
      const rightOut = hasRight ? { ...right, model: right.family || right.familyId } : null

      const { blob, fileName } = downloadPurchaseAgreement({
        patient: { name: p.name, address: p.address, phone: p.phone, dob: p.dob },
        devices: { fittingType, left: leftOut, right: rightOut },
        carePlan: carePlanId,
        pricePerAid,
        leftPrice:  leftEarP,
        rightPrice: rightEarP,
        payType,
        clinic,
        provider,
        patientSignature: signatureName.trim(),
        patientSignatureDate: sigDate,
        deliverySignature: includeDelivery ? (deliveryName.trim() || null) : null,
        deliveryDate: includeDelivery ? (deliveryDate || null) : null,
        signatureImageBase64,
      })

      // §6 paper trail — each distinct discounted per-aid price logs once.
      if (needsReason && reasonCode) {
        const reasonTextClean = reasonCode === 'other' ? (reasonText.trim() || null) : null
        const seen = new Set()
        for (const px of [leftPx, rightPx]) {
          if (px.net == null || !(px.discountAmt > 0)) continue
          const key = `${px.retail}|${px.net}`
          if (seen.has(key)) continue
          seen.add(key)
          try {
            await logPriceAdjustment({
              patientId: p.id,
              originalPrice: px.retail,
              adjustedPrice: px.net,
              reasonCode,
              reasonText: reasonTextClean,
              productType: 'device',
            })
          } catch (e) {
            console.error('Log agreement discount:', e)
            warnings.push('Recording the discount to the audit log failed: ' + (e?.message || e))
          }
        }
      }

      // Archive to chart — paper trail required for compliance.
      try {
        await uploadPatientDocument({
          patientId: p.id,
          clinicId, staffId,
          kind: 'purchase_agreement',
          blob, fileName,
          metadata: {
            carePlan: carePlanId,
            pricePerAid,
            leftPrice:  leftEarP,
            rightPrice: rightEarP,
            leftRetail:  payType === 'private' && hasLeft  ? leftPx.retail  : null,
            rightRetail: payType === 'private' && hasRight ? rightPx.retail : null,
            totalDiscount: payType === 'private' ? totalDiscount : 0,
            discountReasonCode: needsReason ? reasonCode : null,
            aidCount: (hasLeft ? 1 : 0) + (hasRight ? 1 : 0),
            deviceTotal,
            carePlanCost,
            totalPurchasePrice: grandTotal,
            fittingType,
            payType,
            carrier: selectedPlan ? selectedPlan.carrier : (payType === 'insurance' ? (p.insurance?.carrier || null) : null),
            tpa:     selectedPlan ? selectedPlan.tpa     : (payType === 'insurance' ? (p.insurance?.tpa     || null) : null),
            planGroup: selectedPlan ? selectedPlan.planGroup : null,
            tierLabel: selectedPlan
              ? (deviceDriven
                  ? [...new Set([leftPx.coverageTier, rightPx.coverageTier].filter(Boolean))].join(' / ') || null
                  : planTier || null)
              : null,
            leftFamily:  hasLeft  ? (left.family  || null) : null,
            rightFamily: hasRight ? (right.family || null) : null,
            patientSignature: signatureName.trim(),
            includesDelivery: !!includeDelivery,
            deliverySignature: includeDelivery ? (deliveryName.trim() || null) : null,
            deliveryDate: includeDelivery ? (deliveryDate || null) : null,
            providerName: provider?.fullName || null,
          },
        })
        onArchived?.()
      } catch (e) {
        console.error('Archive purchase agreement:', e)
        warnings.push('PDF downloaded, but archiving to the chart failed: ' + (e?.message || e))
      }

      // ── Chart write-back — the agreement is now the chart of record ──────
      const chartPatch = {}

      // Devices: insert a NEW fitting only when the configuration actually
      // changed (identity ignores hardware detail + style-bucket remaps), so
      // re-signing an unchanged config doesn't churn fitting history.
      const savedIdentity = p.devices
        ? `${p.devices.fittingType || ''}~${sideIdentity(p.devices.left)}~${sideIdentity(p.devices.right)}`
        : null
      const newIdentity = `${fittingType}~${sideIdentity(hasLeft ? left : null)}~${sideIdentity(hasRight ? right : null)}`
      const devicesChanged = savedIdentity !== newIdentity

      if (devicesChanged) {
        try {
          await recordPurchaseFitting(
            p.id,
            // Serials describe the outgoing hardware — new devices arrive
            // with their own; enter them on the chart at delivery.
            { fittingType, left: hasLeft ? left : null, right: hasRight ? right : null },
            staffId,
            { fittingDate, warrantyExpiry }
          )
          const primary = (hasLeft ? left : null) || (hasRight ? right : null)
          chartPatch.devices = {
            fittingType,
            fittingDate,
            warrantyExpiry,
            serialLeft: null,
            serialRight: null,
            manufacturer: primary?.manufacturer || '',
            family:       primary?.family || '',
            techLevel:    primary?.techLevel || '',
            style:        primary?.style || '',
            color:        primary?.color || '',
            battery:      primary?.battery || '',
            left:  hasLeft  ? { ...left }  : null,
            right: hasRight ? { ...right } : null,
          }
        } catch (e) {
          console.error('Save agreement devices:', e)
          warnings.push('Saving the updated devices to the chart failed: ' + (e?.message || e))
        }
      }

      // Pay type + private-pay price snapshot on patients.
      try {
        const patFields = {}
        if (payType !== p.payType) patFields.pay_type = payType
        if (payType === 'private') {
          patFields.private_pay_price_per_aid = Math.round(pricePerAid * 100)
        }
        if (Object.keys(patFields).length) {
          await updatePatientContact(p.id, patFields)
          if (patFields.pay_type) chartPatch.payType = payType
          if (patFields.private_pay_price_per_aid != null) {
            chartPatch.privatePay = { ...(p.privatePay || { tier: null }), tierPrice: pricePerAid }
          }
        }
      } catch (e) {
        console.error('Save agreement pay snapshot:', e)
        warnings.push('Saving the pricing snapshot failed: ' + (e?.message || e))
      }

      // Care plan + insurance snapshot on insurance_coverage.
      try {
        const covFields = { warranty_expiry: warrantyExpiry }
        if (carePlanId !== p.carePlan) covFields.care_plan_type = carePlanId
        if (payType === 'insurance') {
          covFields.tier_price_per_aid = Math.round(pricePerAid * 100)
          if (selectedPlan) {
            covFields.carrier    = selectedPlan.carrier
            covFields.plan_group = selectedPlan.planGroup
            covFields.tpa        = selectedPlan.tpa || null
            covFields.tier       = deviceDriven
              ? ([...new Set([leftPx.coverageTier, rightPx.coverageTier].filter(Boolean))].join(' / ') || null)
              : (planTier || null)
          }
        }
        if (p._ids?.coverageId || payType === 'insurance' || carePlanId !== p.carePlan) {
          await updateInsuranceCoverage(p.id, covFields, p._ids?.coverageId || null)
          if (covFields.care_plan_type) chartPatch.carePlan = carePlanId
          if (payType === 'insurance') {
            chartPatch.insurance = {
              ...(p.insurance || {}),
              tierPrice: pricePerAid,
              ...(selectedPlan ? {
                carrier: selectedPlan.carrier,
                planGroup: selectedPlan.planGroup,
                tpa: selectedPlan.tpa || null,
                tier: covFields.tier ?? p.insurance?.tier ?? null,
              } : {}),
            }
          }
        }
      } catch (e) {
        console.error('Save agreement coverage:', e)
        warnings.push('Saving the care plan / coverage snapshot failed: ' + (e?.message || e))
      }

      // Quote-only patient signed — convert to active.
      if (p.patientStatus === 'tns') {
        try {
          await convertTnsToActive(p.id, warrantyYears)
          chartPatch.patientStatus = 'active'
          if (!chartPatch.devices && p.devices) {
            chartPatch.devices = { ...p.devices, fittingDate, warrantyExpiry }
          }
        } catch (e) {
          console.error('convertTnsToActive:', e)
          warnings.push('Converting the patient from TNS to active failed: ' + (e?.message || e))
        }
      }

      if (Object.keys(chartPatch).length) {
        try { await onChartSaved?.(chartPatch) } catch (e) { console.error('onChartSaved:', e) }
      }

      setDoneInfo({ warnings, chartUpdated: Object.keys(chartPatch).length > 0, devicesChanged })
      setStep('done')
    } catch (e) {
      console.error('Purchase agreement generate:', e)
      setError(e?.message || String(e))
    } finally {
      setGenerating(false)
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderEarColumn = (label, active, setActive, side, which, price, setPrice, disc, onCopyFromLeft) => {
    const opts = optionsFor(side)
    const isCros = side.isCROS || isCrosVariant(side.variant)
    const px = earPricing(active, side, disc, price)
    return (
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10, gap: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {onCopyFromLeft && (
              <button
                type="button"
                onClick={onCopyFromLeft}
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '4px 10px',
                  background: 'white', color: C.accent,
                  border: `1px solid ${C.accent}`, borderRadius: 6,
                  cursor: 'pointer',
                }}
                title="Mirror the left ear's device, price, and discount to this ear"
              >Copy from left →</button>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Include this ear
            </label>
          </div>
        </div>
        <div style={{
          padding: 14,
          background: active ? C.bgSoft : '#f3f4f6',
          border: `1px solid ${C.line}`, borderRadius: 8,
          opacity: active ? 1 : 0.55, pointerEvents: active ? 'auto' : 'none',
        }}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Style</label>
            <select style={inputStyle} value={side.style} onChange={e => setSideField(which, 'style', e.target.value)}>
              <option value="">— Select style —</option>
              {opts.styles.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Manufacturer</label>
            <select style={inputStyle} value={side.manufacturer} onChange={e => setSideField(which, 'manufacturer', e.target.value)}>
              <option value="">— Select manufacturer —</option>
              {opts.manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {opts.generations.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Generation</label>
              <select style={inputStyle} value={side.generation} onChange={e => setSideField(which, 'generation', e.target.value)}>
                <option value="">— Select generation —</option>
                {opts.generations.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Family / Model</label>
            <select style={inputStyle} value={side.familyId} onChange={e => setSideField(which, 'familyId', e.target.value)}>
              <option value="">— Select family —</option>
              {opts.families.map(f => {
                const off = famOffPlan(f)
                return <option key={f.id} value={f.id} disabled={off}>{(f.family || f.name || f.id)}{off ? ' — not on plan' : ''}</option>
              })}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            {opts.techLevels.length > 0 && (
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tech Level</label>
                <select style={inputStyle} value={side.techLevel} onChange={e => setSideField(which, 'techLevel', e.target.value)}>
                  <option value="">—</option>
                  {opts.techLevels.map(t => {
                    const off = techOffPlan(opts.family, t)
                    return <option key={t} value={t} disabled={off}>{t}{off ? ' — not on plan' : ''}</option>
                  })}
                </select>
              </div>
            )}
            {opts.variants.length > 0 && (
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Variant</label>
                <select style={inputStyle} value={side.variant} onChange={e => setSideField(which, 'variant', e.target.value)}>
                  <option value="">—</option>
                  {opts.variants.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
          </div>

          {isCros ? (
            <div>
              <label style={labelStyle}>Price per unit</label>
              <div style={{ fontSize: 13, color: C.muted }}>
                {side.manufacturer === 'TruHearing' && payType === 'insurance' && planMode
                  ? <>CROS transmitter — bills at the tier instrument price{px.net != null ? ` (${money(px.net)})` : ''}.</>
                  : <>CROS unit — fixed {money(CROS_PRICE_PER_UNIT)}, no discount.</>}
              </div>
            </div>
          ) : payType === 'private' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={labelStyle}>Retail (clinic anchor)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                  {px.retail != null ? `${money(px.retail)} / aid` : '—'}
                </span>
              </div>
              <label style={labelStyle}>Discount</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', border: `1px solid ${C.line}`, borderRadius: 6, overflow: 'hidden' }}>
                  {['$', '%'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDiscField(which, 'mode', m)}
                      style={{
                        padding: '7px 12px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                        background: disc.mode === m ? C.accent : 'white',
                        color: disc.mode === m ? 'white' : C.ink,
                      }}
                    >{m}</button>
                  ))}
                </div>
                <input
                  type="number" min="0" step={disc.mode === '%' ? '1' : '10'}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder={disc.mode === '%' ? 'e.g. 10' : 'e.g. 500'}
                  value={disc.value}
                  onChange={e => setDiscField(which, 'value', e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purchase price</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: px.discountAmt > 0 ? '#15803d' : C.ink }}>
                  {px.net != null ? `${money(px.net)} / aid` : '—'}
                  {px.discountAmt > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d', marginLeft: 6 }}>
                      (−{money(px.discountAmt)})
                    </span>
                  )}
                </span>
              </div>
            </div>
          ) : planMode ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={labelStyle}>
                  Plan copay
                  {deviceDriven
                    ? (px.coverageTier ? ` — ${px.coverageTier} tier` : '')
                    : (planTier ? ` — ${planTier}` : '')}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: px.offPlan ? '#b45309' : C.ink }}>
                  {px.net != null ? `${money(px.net)} / aid` : '—'}
                </span>
              </div>
              {!selectedPlan && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                  Select the plan above to price this ear.
                </div>
              )}
              {selectedPlan && !deviceDriven && !planTier && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                  Select a plan tier above to price this ear.
                </div>
              )}
              {selectedPlan && deviceDriven && (!side.familyId || !side.techLevel) && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                  Select family and tech level — {selectedPlan.tpa} copays are device-driven.
                </div>
              )}
              {px.offPlan && (
                <div style={{ fontSize: 12, color: '#b45309', marginTop: 6 }}>
                  Not covered by this plan — priced at standard retail. Requires a signed
                  insurance acknowledgement form.
                </div>
              )}
              {px.needsRate && (
                <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>
                  Covered tier, but its copay isn't on file — verify the rate before signing.
                </div>
              )}
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Price per aid</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: C.muted, fontSize: 14 }}>$</span>
                <input
                  type="number" min="0" step="1"
                  style={{ ...inputStyle, flex: 1 }}
                  value={price}
                  onChange={e => setPrice(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const sideLine = (label, side, earP) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: 13, color: '#374151' }}>
        {label}: {side.manufacturer} {side.family}
        {side.manufacturer !== 'TruHearing' && side.techLevel ? ` ${side.techLevel}` : ''}
        {isCrosVariant(side.variant) ? ` (${side.variant})` : ''}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{money(earP)}</span>
    </div>
  )

  const summaryBox = (
    <div style={{ background: '#FBF9F3', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid #E4E0D5' }}>
      <div style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: '#9ca3af', letterSpacing: 1, marginBottom: 8 }}>Agreement Summary</div>
      {hasRight && sideLine('Right', right, rightEarP)}
      {hasLeft  && sideLine('Left',  left,  leftEarP)}
      {payType === 'private' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: '#374151' }}>{cpMeta.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>Included</span>
        </div>
      ) : carePlan === 'paygo' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Standard Billing ($65 per visit)</span>
          <span style={{ fontSize: 13, color: C.muted }}>$0.00</span>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: '#374151' }}>{cpMeta.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{money(carePlanCost)}</span>
        </div>
      )}
      <div style={{ borderTop: '1px solid #E4E0D5', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Total</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{money(grandTotal)}</span>
      </div>
    </div>
  )

  // ── Done panel ───────────────────────────────────────────────────────────
  if (step === 'done' && doneInfo) {
    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10, 22, 40, 0.55)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: 30, zIndex: 1000, overflowY: 'auto',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'white', borderRadius: 12,
            maxWidth: 560, width: '100%',
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
            fontFamily: "'Sora', sans-serif",
            padding: 26,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
            ✓ Purchase agreement signed
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
            The PDF downloaded and was archived to {p?.name}'s chart.
            {doneInfo.chartUpdated && (
              <> The chart now reflects this agreement{doneInfo.devicesChanged
                ? ' — devices, pricing, and care plan updated. Enter the new serial numbers on the chart when the devices arrive.'
                : ' — pricing and care plan updated.'}</>
            )}
          </div>
          {doneInfo.warnings.length > 0 && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a',
              color: '#92400e', borderRadius: 8, padding: '10px 14px',
              fontSize: 13, marginBottom: 14, lineHeight: 1.5,
            }}>
              {doneInfo.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 18px', fontSize: 13, fontWeight: 600,
                background: C.accent, color: 'white',
                border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >Done</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10, 22, 40, 0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 30, zIndex: 1000, overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12,
          maxWidth: step === 'configure' ? 880 : 560, width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          fontFamily: "'Sora', sans-serif",
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 26px', borderBottom: `1px solid ${C.line}`,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>Purchase Agreement</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {p?.name}{step === 'configure'
                ? ' · Confirm devices, pricing, and care plan — this becomes the chart of record'
                : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 22, color: C.muted, padding: 4, lineHeight: 1,
            }}
          >×</button>
        </div>

        {step === 'configure' && (
          <>
            <div style={{ padding: 26 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={labelStyle}>Pay type</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['insurance','Insurance'], ['private','Private Pay']].map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => setPayType(v)}
                        style={{
                          flex: 1, padding: '8px 12px', fontSize: 13,
                          background: payType === v ? C.accent : 'white',
                          color: payType === v ? 'white' : C.ink,
                          border: `1px solid ${payType === v ? C.accent : C.line}`,
                          borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                        }}
                      >{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={labelStyle}>Care plan</label>
                  <select
                    style={inputStyle}
                    value={carePlan}
                    onChange={e => setCarePlan(e.target.value)}
                  >
                    {CARE_PLAN_OPTIONS.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label}{payType === 'insurance' && c.price ? ` (+$${c.price})` : ''}
                      </option>
                    ))}
                  </select>
                  {payType === 'private' && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      Bundled into per-aid pricing — no separate line.
                    </div>
                  )}
                </div>
              </div>

              {payType === 'insurance' && (
                <div style={{
                  background: C.bgSoft, border: `1px solid ${C.line}`,
                  borderRadius: 8, padding: 14, marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <label style={labelStyle}>Carrier</label>
                      <select style={inputStyle} value={planCarrier} onChange={e => pickCarrier(e.target.value)}>
                        <option value="">Manual copay — no plan</option>
                        {planCarrier && !planCarriers.includes(planCarrier) && (
                          <option value={planCarrier}>{planCarrier} — not in plan table</option>
                        )}
                        {planCarriers.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {planCarrier && (
                      <div style={{ flex: 2, minWidth: 220 }}>
                        <label style={labelStyle}>Plan</label>
                        <select style={inputStyle} value={planGroup} onChange={e => pickPlanGroup(e.target.value)}>
                          <option value="">— Select plan —</option>
                          {planGroup && !carrierPlans.some(pl => pl.planGroup === planGroup) && (
                            <option value={planGroup}>{planGroup} — not in plan table</option>
                          )}
                          {carrierPlans.map(pl => <option key={pl.planGroup} value={pl.planGroup}>{pl.planGroup}</option>)}
                        </select>
                      </div>
                    )}
                    {selectedPlan && !deviceDriven && (
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <label style={labelStyle}>Plan tier</label>
                        <select style={inputStyle} value={planTier} onChange={e => setPlanTier(e.target.value)}>
                          <option value="">— Select tier —</option>
                          {(selectedPlan.tiers || []).map(t => (
                            <option key={t.label} value={t.label}>{t.label} — {money(t.price)} / aid</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  {selectedPlan && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                      {deviceDriven
                        ? `${selectedPlan.tpa} is device-driven — the copay resolves from each ear's device once family and tech level are selected. Devices outside the plan's catalog price at standard retail and need an insurance acknowledgement form.`
                        : 'Copay applies per aid at the selected tier. Devices are chosen freely — the tier sets the price, not the device.'}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                {renderEarColumn('Left ear',  hasLeft,  setHasLeft,  left,  'left',  leftPrice,  setLeftPrice,  leftDisc)}
                {renderEarColumn(
                  'Right ear', hasRight, setHasRight, right, 'right', rightPrice, setRightPrice, rightDisc,
                  (left.style || left.manufacturer || left.familyId)
                    ? () => {
                        setHasRight(true)
                        setRight({ ...left })
                        setRightPrice(leftPrice)
                        setRightDisc({ ...leftDisc })
                      }
                    : null
                )}
              </div>

              {needsReason && (
                <div style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 8, padding: 14, marginBottom: 16,
                }}>
                  <label style={labelStyle}>Reason for discount (recorded to the audit log)</label>
                  <select style={inputStyle} value={reasonCode} onChange={e => setReasonCode(e.target.value)}>
                    <option value="">Select a reason…</option>
                    {ADJUST_REASON_CODES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </select>
                  {reasonCode === 'other' && (
                    <textarea
                      style={{ ...inputStyle, marginTop: 8, minHeight: 60, resize: 'vertical' }}
                      placeholder="Required — briefly explain the discount"
                      value={reasonText}
                      onChange={e => setReasonText(e.target.value)}
                    />
                  )}
                </div>
              )}

              <div style={{
                background: C.bgSoft, border: `1px solid ${C.line}`,
                borderRadius: 8, padding: 14,
              }}>
                {payType === 'private' && retailSubtotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 6 }}>
                    <span>Retail subtotal</span>
                    <span>{money(retailSubtotal)}</span>
                  </div>
                )}
                {hasDiscount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: 6 }}>
                    <span>Discount</span>
                    <span>−{money(totalDiscount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 6 }}>
                  <span>Device subtotal</span>
                  <span>{money(deviceTotal)}</span>
                </div>
                {carePlanCost > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 6 }}>
                    <span>{cpMeta.label}</span>
                    <span>{money(carePlanCost)}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 15, fontWeight: 700, color: C.ink,
                  paddingTop: 8, borderTop: `1px solid ${C.line}`,
                }}>
                  <span>Total purchase price</span>
                  <span>{money(grandTotal)}</span>
                </div>
              </div>
            </div>

            <div style={{
              padding: '16px 26px',
              borderTop: `1px solid ${C.line}`,
              display: 'flex', justifyContent: 'flex-end', gap: 10,
            }}>
              <button
                onClick={onClose}
                style={{
                  padding: '9px 18px', fontSize: 13, fontWeight: 600,
                  background: 'white', color: C.muted,
                  border: `1px solid ${C.line}`, borderRadius: 6,
                  cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={() => canProceed && setStep('sign')}
                disabled={!canProceed}
                style={{
                  padding: '9px 18px', fontSize: 13, fontWeight: 600,
                  background: canProceed ? C.navy : '#9ca3af',
                  color: 'white', border: 'none', borderRadius: 6,
                  cursor: canProceed ? 'pointer' : 'not-allowed',
                }}
              >Continue to Signature →</button>
            </div>
          </>
        )}

        {(step === 'sign' || step === 'delivery') && (
          <div style={{ padding: 26 }}>
            {summaryBox}

            {step === 'sign' && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: '#9ca3af', letterSpacing: 1, marginBottom: 8 }}>Patient Signature — Adopt and Sign</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Type your full legal name to electronically sign this agreement.</div>
                  <input
                    value={signatureName}
                    onChange={e => setSignatureName(e.target.value)}
                    placeholder="Full legal name"
                    autoFocus
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #E4E0D5', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  {signatureName.trim().length > 2 && (
                    <div style={{ marginTop: 12, padding: '14px 18px', background: '#FBF9F3', borderRadius: 10, border: '1px dashed #d1d5db' }}>
                      <div style={{ fontFamily: "'Georgia','Times New Roman',serif", fontSize: 24, fontStyle: 'italic', color: C.ink, letterSpacing: 0.5 }}>{signatureName}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Electronic signature preview</div>
                    </div>
                  )}
                </div>

                {error && (
                  <div style={{
                    background: '#fef2f2', color: '#991b1b',
                    padding: '10px 14px', borderRadius: 6,
                    fontSize: 13, marginBottom: 14,
                    border: '1px solid #fecaca',
                  }}>{error}</div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setStep('configure')}
                    style={{ background: 'none', border: '1px solid #E4E0D5', borderRadius: 10, padding: '12px 16px', fontWeight: 600, fontSize: 12, cursor: 'pointer', color: C.muted, fontFamily: 'inherit' }}
                  >← Back</button>
                  <button
                    disabled={!canSign}
                    onClick={() => handleGenerate(false)}
                    style={{ flex: 1, background: canSign ? C.navy : '#d1d5db', color: 'white', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: canSign ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                  >{generating ? 'Generating…' : 'Adopt, Sign & Download'}</button>
                  <button
                    onClick={() => setStep('delivery')}
                    style={{ background: 'none', border: '1px solid #E4E0D5', borderRadius: 10, padding: '12px 16px', fontWeight: 600, fontSize: 12, cursor: 'pointer', color: C.muted, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                  >+ Delivery</button>
                </div>
              </>
            )}

            {step === 'delivery' && (
              <>
                <div style={{ background: '#ecfdf5', borderRadius: 10, padding: 12, marginBottom: 16, border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#16a34a', fontSize: 16 }}>✓</span>
                  <span style={{ fontSize: 13, color: '#065f46' }}>
                    {signatureName.trim().length > 2 ? `Purchase signed by ${signatureName}` : 'Enter the patient signature on the previous step first.'}
                  </span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: '#9ca3af', letterSpacing: 1, marginBottom: 8 }}>Delivery Acknowledgement</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Patient Name</label>
                      <input
                        value={deliveryName}
                        onChange={e => setDeliveryName(e.target.value)}
                        placeholder="Full legal name"
                        autoFocus
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #E4E0D5', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Delivery Date</label>
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={e => setDeliveryDate(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #E4E0D5', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{
                    background: '#fef2f2', color: '#991b1b',
                    padding: '10px 14px', borderRadius: 6,
                    fontSize: 13, marginBottom: 14,
                    border: '1px solid #fecaca',
                  }}>{error}</div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setStep('sign')}
                    style={{ background: 'none', border: '1px solid #E4E0D5', borderRadius: 10, padding: '12px 16px', fontWeight: 600, fontSize: 12, cursor: 'pointer', color: C.muted, fontFamily: 'inherit' }}
                  >← Back</button>
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={!canSign || !deliveryName.trim() || !deliveryDate}
                    style={{ flex: 1, background: (canSign && deliveryName.trim() && deliveryDate) ? C.navy : '#d1d5db', color: 'white', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: (canSign && deliveryName.trim() && deliveryDate) ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                  >{generating ? 'Generating…' : 'Sign & Download with Delivery'}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
