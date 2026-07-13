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
import { downloadQuote } from '../generateQuote.js'
import { uploadPatientDocument, logPriceAdjustment } from '../db.js'
import { ADJUST_REASON_CODES } from '../views/AdjustPriceModal.jsx'
import { nationsCoverageTier, deriveEarPrice } from '../lib/pricing.js'

// Custom-quote modal launched from the patient profile (the sole quote entry
// point — the saved-config "Generate Quote" button was retired). Lets the
// provider pick any devices the patient is eligible for and, for private pay,
// discount off the clinic's retail anchor rather than typing an arbitrary
// price — so every printed quote reflects the clinic's selected retail pricing.
// Insurance quotes price from a selected insurance plan (carrier → plan →
// tier copay; UHCH/Nations derive the copay from the chosen device), with a
// manual-copay fallback when the plan isn't in the table.
// Any discount is recorded to the §6 price_adjustment_log (a paper trail
// explaining the reason). Ephemeral — does not write to device_fittings or
// update form.tierPrice. Quote PDF is archived to patient_documents with
// kind='quote' and metadata.customized=true so the chart distinguishes
// provider-generated custom quotes from wizard quotes.

const CROS_PRICE_PER_UNIT = 1250

// Saved device_sides use the fine-grained TruHearing *fitting* taxonomy
// (TH_STYLES in Distil.jsx: if, sr, ric_bct, hs, fs, s_bte/p_bte/sp_bte, …),
// but product_catalog buckets styles coarsely (ric, ite, itc, cic, iic, bte).
// This modal's manufacturer cascade filters the catalog by the pre-filled
// style, so a patient fit in a style the catalog doesn't key (e.g. TruHearing
// Instant Fit → catalog "ite", not "if") strands the manufacturer dropdown:
// no row matches → empty list → the manufacturer can't be picked.
// STYLE_BUCKET collapses a fitting style into its catalog bucket. The remap is
// applied manufacturer-scoped (see normalizeStyle) because the same physical
// style can key differently across catalogs — e.g. "if" is Signia Silk's own
// catalog key but TruHearing's instant-fit rows live under "ite".
const STYLE_BUCKET = {
  sr: 'ric', ric_bct: 'ric',
  s_bte: 'bte', p_bte: 'bte', sp_bte: 'bte',
  hs: 'ite', fs: 'ite', if: 'ite',
}

// Map a saved fitting style onto a style key the catalog actually uses for the
// saved manufacturer. Keep the style as-is when the catalog already knows it;
// otherwise fall back to its bucket only if that bucket exists for this mfr.
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

const CARE_PLAN_OPTIONS = [
  { id: 'complete', label: 'Complete Care+', price: 1250 },
  { id: 'punch',    label: 'Punch Card',     price: 575  },
  { id: '',         label: 'None',           price: 0    },
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

function sideFromSaved(s) {
  if (!s) return emptySide()
  return {
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

// Fallback retail when the live clinic anchor can't resolve (e.g. anchors not
// yet loaded, or a saved device the catalog can't rank). Uses the snapshot
// price the patient was fit at so the discount flow still has a base.
function defaultPricePerAid(patient) {
  if (patient?.payType === 'private') {
    return patient?.privatePay?.tierPrice || 2750
  }
  return patient?.insurance?.tierPrice ?? 0
}

const C = {
  ink:    '#0a1628',
  muted:  '#6b7280',
  line:   '#e5e7eb',
  bgSoft: '#f9fafb',
  accent: '#1d4ed8',
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

export default function CreateQuoteModal({
  patient,
  clinic,
  staffProfile,
  clinicId,
  staffId,
  catalog = [],
  insurancePlans = [],
  productCatalogTiers = [],
  anchorsByClass = {},
  resolveRetailPerAid,
  onClose,
  onArchived,
}) {
  const patientTpa = patient?.insurance?.tpa || null

  const [payType, setPayType] = useState(patient?.payType || 'insurance')
  const [carePlan, setCarePlan] = useState(patient?.carePlan || 'complete')

  // Insurance plan selection — defaults to the patient's saved coverage so an
  // insurance quote opens already priced at their plan, not at private-pay
  // numbers. An empty carrier means "manual copay" (the legacy behavior),
  // kept for plans that aren't in the table yet.
  const [planCarrier, setPlanCarrier] = useState(patient?.insurance?.carrier || '')
  const [planGroup,   setPlanGroup]   = useState(patient?.insurance?.planGroup || '')
  const [planTier,    setPlanTier]    = useState(patient?.insurance?.tier || '')

  const planMode = payType === 'insurance' && planCarrier !== ''
  const selectedPlan = planMode
    ? insurancePlans.find(pl => pl.carrier === planCarrier && pl.planGroup === planGroup) || null
    : null
  // UHCH and Nations are device-driven: the chosen device decides the tier and
  // its flat copay (via the coverage maps in lib/pricing), so no tier picker.
  const deviceDriven = selectedPlan?.tpa === 'UHCH' || selectedPlan?.tpa === 'Nations'
  const tierCopay = selectedPlan && !deviceDriven
    ? (selectedPlan.tiers?.find(t => t.label === planTier)?.price ?? null)
    : null

  // TPA exclusivity mirrors the wizard's visibleCatalog gate: tpa-less rows
  // show for everyone; tpa'd rows (Relate → UHCH, TH white-labels →
  // TruHearing) only when quoting on that TPA. Keyed to the selected plan
  // when quoting insurance (so picking a TruHearing plan surfaces the TH
  // white-labels), and to the saved coverage otherwise — TPA-exclusive
  // products have no street retail to quote.
  const quoteTpa = selectedPlan ? selectedPlan.tpa : patientTpa
  // Nations obligates us to the plan's covered catalog — off-plan families and
  // tech levels are disabled in the pickers (mirrors the wizard cascade).
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

  // Picking earlier in the carrier → plan → tier chain clears later; single
  // options auto-select so the common one-plan carriers price in one click.
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

  const [hasLeft,  setHasLeft]  = useState(!!patient?.devices?.left  || !patient?.devices)
  const [hasRight, setHasRight] = useState(!!patient?.devices?.right || !patient?.devices)

  // Normalize the pre-filled style against the (TPA-gated) catalog so the
  // manufacturer cascade resolves for patients fit in a fitting-only style
  // (e.g. TruHearing Instant Fit / SR / RIC+BCT) the coarse catalog buckets.
  const [left,  setLeft]  = useState(() => {
    const s = sideFromSaved(patient?.devices?.left)
    return { ...s, style: normalizeStyle(activeCatalog, s.manufacturer, s.style) }
  })
  const [right, setRight] = useState(() => {
    const s = sideFromSaved(patient?.devices?.right)
    return { ...s, style: normalizeStyle(activeCatalog, s.manufacturer, s.style) }
  })

  // Manual-copay fallback (insurance with no plan selected) keeps an editable
  // per-aid price. Private pay derives the price from the clinic retail anchor
  // minus the per-ear discount below. No `|| 2750` here — that turned a $0 or
  // unknown insurance copay into the private-pay default.
  const initialPrice = patient?.payType === 'private'
    ? (defaultPricePerAid(patient) || 2750)
    : (patient?.insurance?.tierPrice ?? 0)
  const [leftPrice,  setLeftPrice]  = useState(initialPrice)
  const [rightPrice, setRightPrice] = useState(initialPrice)

  // Per-ear discount off the retail anchor (private pay only). mode = '$' | '%'.
  const [leftDisc,  setLeftDisc]  = useState({ mode: '$', value: '' })
  const [rightDisc, setRightDisc] = useState({ mode: '$', value: '' })

  // Discount justification (one reason per quote — required when discounting).
  const [reasonCode, setReasonCode] = useState('')
  const [reasonText, setReasonText] = useState('')

  const [note, setNote] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  // Cascade options derived per side from the catalog.
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
    // TruHearing white-labels carry their plan tier on the product
    // (planTierKey: TH7→Premium, TH6→Advanced, TH5→Standard). Picking one
    // syncs the quote's tier when the selected plan offers that tier — TH5
    // BTE on an Advanced/Premium-only plan stays at the chosen tier ("always
    // available; the plan price covers whatever the clinician fits").
    if (field === 'familyId' && selectedPlan && !deviceDriven) {
      const f = activeCatalog.find(e => e.id === value)
      if (f?.planTierKey && (selectedPlan.tiers || []).some(t => t.label === f.planTierKey)) {
        setPlanTier(f.planTierKey)
      }
    }
    const update = (prev) => {
      const next = { ...prev, [field]: value }
      // Cascade resets — picking earlier in the chain clears later.
      if (field === 'style') {
        next.manufacturer = ''; next.generation = ''; next.familyId = ''
        next.family = ''; next.variant = ''; next.techLevel = ''
      } else if (field === 'manufacturer') {
        next.generation = ''; next.familyId = ''
        next.family = ''; next.variant = ''; next.techLevel = ''
      } else if (field === 'generation') {
        next.familyId = ''; next.family = ''
        next.variant = ''; next.techLevel = ''
      } else if (field === 'familyId') {
        const f = activeCatalog.find(e => e.id === value)
        next.family = f?.family || f?.name || ''
        next.variant = ''; next.techLevel = ''
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

  // Per-ear pricing. Private pay anchors to the clinic retail price (resolved
  // by the parent from clinic_retail_anchors) and applies the $/% discount.
  // Insurance prices from the selected plan — flat tier copay, or per-device
  // copay for UHCH/Nations — with an editable manual copay when no plan is
  // selected. CROS units are a fixed $1,250 add-on with no discount.
  const fallbackRetail = defaultPricePerAid(patient) || 2750
  const earPricing = (active, side, disc, priceState) => {
    if (!active) return { retail: null, discountAmt: 0, net: null }
    if (side.isCROS || isCrosVariant(side.variant)) {
      return { retail: CROS_PRICE_PER_UNIT, discountAmt: 0, net: CROS_PRICE_PER_UNIT }
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
    // insurance — plan-driven copay when a plan is selected
    if (planMode) {
      // Carrier picked but plan not resolved yet — nothing to price.
      if (!selectedPlan) return { retail: null, discountAmt: 0, net: null }
      if (deviceDriven) {
        // UHCH / Nations: the device decides the copay — same deriveEarPrice
        // path the wizard uses (on-plan → flat tier copay; off-plan →
        // standard retail, flagged; copay hole → requires rate verification).
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
      // Tier-copay plan (TruHearing et al.) — flat per-aid copay for the
      // chosen tier; null until a tier is picked, which blocks Generate.
      return { retail: null, discountAmt: 0, net: tierCopay }
    }
    // insurance, manual copay (no plan selected) — editable, no retail anchor
    return { retail: null, discountAmt: 0, net: Number(priceState) || 0 }
  }

  const leftPx  = earPricing(hasLeft,  left,  leftDisc,  leftPrice)
  const rightPx = earPricing(hasRight, right, rightDisc, rightPrice)
  const leftEarP  = leftPx.net
  const rightEarP = rightPx.net

  const carePlanCost = payType === 'private'
    ? 0
    : (CARE_PLAN_OPTIONS.find(c => c.id === carePlan)?.price || 0)

  const retailSubtotal = (leftPx.retail || 0) + (rightPx.retail || 0)
  const totalDiscount  = (leftPx.discountAmt || 0) + (rightPx.discountAmt || 0)
  const hasDiscount    = totalDiscount > 0.005
  const deviceTotal    = (leftEarP || 0) + (rightEarP || 0)
  const grandTotal     = deviceTotal + carePlanCost

  // A discount must carry a documented reason (recorded to the audit log).
  const needsReason = payType === 'private' && hasDiscount
  const reasonOk = !needsReason ||
    (!!reasonCode && (reasonCode !== 'other' || reasonText.trim().length > 0))
  // Private-pay ears must be fully configured (family + tech level) so the
  // retail anchor is the real clinic price, not the fallback. CROS units and
  // insurance quotes have no such requirement.
  const sideConfigured = (active, side) =>
    !active ||
    side.isCROS || isCrosVariant(side.variant) ||
    (!!side.familyId && !!side.techLevel)
  const earsResolved = payType !== 'private' ||
    (sideConfigured(hasLeft, left) && sideConfigured(hasRight, right))
  // Plan-priced quotes must fully resolve before generating: a tier picked
  // for copay plans, a configured device for UHCH/Nations (and no unverified
  // copay holes) — otherwise the quote would print a dash.
  const planPriced = !planMode || (
    (!hasLeft  || leftPx.net  != null) &&
    (!hasRight || rightPx.net != null)
  )

  const canGenerate = !!fittingType
    && (!hasLeft  || left.manufacturer)
    && (!hasRight || right.manufacturer)
    && reasonOk
    && earsResolved
    && planPriced
    && !generating

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setError(null)
    try {
      const pricePerAid = (leftEarP && rightEarP)
        ? Math.max(leftEarP, rightEarP)
        : (leftEarP || rightEarP || 0)
      const leftRetail  = payType === 'private' && hasLeft  ? leftPx.retail  : null
      const rightRetail = payType === 'private' && hasRight ? rightPx.retail : null
      const reasonTextClean = reasonCode === 'other' ? (reasonText.trim() || null) : null
      // Coverage identity on the quote follows the plan it was priced from —
      // the saved coverage only when quoting manually / private.
      const quoteCarrier = selectedPlan ? selectedPlan.carrier : (patient.insurance?.carrier || null)
      const quoteTpaOut  = selectedPlan ? selectedPlan.tpa     : (patient.insurance?.tpa     || null)
      // Tier label for the archive: quote-level for copay plans, per-ear
      // coverage tiers for device-driven plans (they can differ by ear).
      const tierLabel = selectedPlan
        ? (deviceDriven
            ? [...new Set([leftPx.coverageTier, rightPx.coverageTier].filter(Boolean))].join(' / ') || null
            : planTier || null)
        : null

      const { blob, fileName } = downloadQuote({
        patient: { name: patient.name, phone: patient.phone },
        devices: {
          fittingType,
          left:  hasLeft  ? { ...left,  model: left.family  || left.familyId  } : null,
          right: hasRight ? { ...right, model: right.family || right.familyId } : null,
        },
        pricePerAid,
        leftPrice:  leftEarP,
        rightPrice: rightEarP,
        // Per-ear retail anchor — drives the "Retail / Discount" lines on the PDF.
        leftRetail,
        rightRetail,
        selectedCarePlan: carePlan || 'complete',
        payType,
        tpa:     quoteTpaOut,
        carrier: quoteCarrier,
        audiology: patient.audiology,
        clinic,
        provider: {
          fullName:      staffProfile?.fullName      || 'Provider',
          activeLicense: staffProfile?.activeLicense || '',
        },
      })

      // Paper trail first: record each distinct discounted per-aid price to the
      // §6 price-adjustment audit log. A matched bilateral pair logs once.
      if (needsReason && reasonCode) {
        const seen = new Set()
        for (const px of [leftPx, rightPx]) {
          if (px.net == null || !(px.discountAmt > 0)) continue
          const key = `${px.retail}|${px.net}`
          if (seen.has(key)) continue
          seen.add(key)
          try {
            await logPriceAdjustment({
              patientId: patient.id,
              originalPrice: px.retail,
              adjustedPrice: px.net,
              reasonCode,
              reasonText: reasonTextClean,
              productType: 'device',
            })
          } catch (e) {
            console.error('Log custom-quote discount:', e)
            setError('Quote downloaded, but recording the discount to the audit log failed: ' + (e?.message || e))
            return
          }
        }
      }

      try {
        await uploadPatientDocument({
          patientId: patient.id,
          clinicId, staffId,
          kind: 'quote',
          blob, fileName,
          metadata: {
            customized: true,
            customNote: note || null,
            fittingType,
            pricePerAid,
            leftPrice:  leftEarP,
            rightPrice: rightEarP,
            leftRetail,
            rightRetail,
            totalDiscount: payType === 'private' ? totalDiscount : 0,
            discountReasonCode: needsReason ? reasonCode : null,
            discountReasonText: needsReason ? reasonTextClean : null,
            aidCount: (hasLeft ? 1 : 0) + (hasRight ? 1 : 0),
            selectedCarePlan: carePlan || 'complete',
            payType,
            carrier: quoteCarrier,
            tpa:     quoteTpaOut,
            planGroup: selectedPlan ? selectedPlan.planGroup : null,
            tierLabel,
            leftFamily:  hasLeft  ? (left.family  || null) : null,
            rightFamily: hasRight ? (right.family || null) : null,
          },
        })
        onArchived?.()
      } catch (e) {
        console.error('Archive custom quote:', e)
        setError('Quote downloaded, but archive failed: ' + (e?.message || e))
        return
      }
      onClose?.()
    } catch (e) {
      console.error('Custom quote generate:', e)
      setError(e?.message || String(e))
    } finally {
      setGenerating(false)
    }
  }

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

          {/* Pricing — retail-anchored discount (private pay) or editable copay (insurance) */}
          {isCros ? (
            <div>
              <label style={labelStyle}>Price per unit</label>
              <div style={{ fontSize: 13, color: C.muted }}>
                CROS unit — fixed {money(CROS_PRICE_PER_UNIT)}, no discount.
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
                <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your price</span>
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
                  Covered tier, but its copay isn't on file — verify the rate before quoting.
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
          maxWidth: 880, width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          fontFamily: "'Sora', sans-serif",
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 26px', borderBottom: `1px solid ${C.line}`,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>Custom Quote</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {patient?.name} · Devices and pricing here are independent of the saved fitting
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
                  <option key={c.id || 'none'} value={c.id}>
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

          {payType === 'private' && (
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              Pricing starts from the clinic's retail anchor for the selected device. Enter a discount to
              adjust — the quote prints the retail price and the discount, and the reason is recorded to the audit log.
            </div>
          )}

          {/* Insurance plan — devices and copays price from the selected plan */}
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
                    {/* Saved coverage naming a carrier the plan table doesn't
                        have — keep it visible instead of a blank select. */}
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

          {/* Discount reason — required once any ear is discounted (private pay) */}
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

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Internal note (optional)</label>
            <input
              type="text"
              placeholder="Why this quote departs from the saved configuration"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{
            background: C.bgSoft, border: `1px solid ${C.line}`,
            borderRadius: 8, padding: 14, marginBottom: 16,
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
                <span>{CARE_PLAN_OPTIONS.find(c => c.id === carePlan)?.label}</span>
                <span>{money(carePlanCost)}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 15, fontWeight: 700, color: C.ink,
              paddingTop: 8, borderTop: `1px solid ${C.line}`,
            }}>
              <span>Total</span>
              <span>{money(grandTotal)}</span>
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
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              padding: '9px 18px', fontSize: 13, fontWeight: 600,
              background: canGenerate ? C.accent : '#9ca3af',
              color: 'white', border: 'none', borderRadius: 6,
              cursor: canGenerate ? 'pointer' : 'not-allowed',
            }}
          >
            {generating ? 'Generating…' : 'Generate Quote'}
          </button>
        </div>
      </div>
    </div>
  )
}
