import { useState, useMemo } from 'react'
import { downloadQuote } from '../generateQuote.js'
import { uploadPatientDocument } from '../db.js'

// Custom-quote modal launched from the patient profile. Lets the provider
// pick any devices the patient is eligible for and override per-ear pricing
// without touching the patient's saved fitting. Ephemeral — does not write to
// device_fittings or update form.tierPrice. Quote PDF is archived to
// patient_documents with kind='quote' and metadata.customized=true so the
// chart distinguishes provider-generated custom quotes from wizard quotes.

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
  onClose,
  onArchived,
}) {
  // TPA exclusivity mirrors the wizard's visibleCatalog gate: tpa-less rows
  // show for everyone; tpa'd rows (Relate → UHCH, TH white-labels →
  // TruHearing) only for patients on that TPA. Keyed to the saved plan, not
  // the modal's pay-type toggle — eligibility comes from the patient's
  // coverage, and TPA-exclusive products have no street retail to quote.
  const patientTpa = patient?.insurance?.tpa || null
  const activeCatalog = useMemo(
    () => catalog.filter(e => e.active && (!e.tpa || e.tpa === patientTpa)),
    [catalog, patientTpa]
  )

  const [payType, setPayType] = useState(patient?.payType || 'insurance')
  const [carePlan, setCarePlan] = useState(patient?.carePlan || 'complete')

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

  const initialPrice = defaultPricePerAid(patient) || 2750
  const [leftPrice,  setLeftPrice]  = useState(initialPrice)
  const [rightPrice, setRightPrice] = useState(initialPrice)

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

    return { styles, manufacturers, generations, families, techLevels, variants }
  }

  const setSideField = (which, field, value) => {
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

  const fittingType = (() => {
    if (!hasLeft && !hasRight) return null
    const eitherCros = (hasLeft && left.isCROS) || (hasRight && right.isCROS)
    if (hasLeft && hasRight) return eitherCros ? 'cros_bicros' : 'bilateral'
    return hasLeft ? 'monaural_left' : 'monaural_right'
  })()

  const sidePrice = (active, side, price) => {
    if (!active) return null
    if (side.isCROS || isCrosVariant(side.variant)) return CROS_PRICE_PER_UNIT
    return Number(price) || 0
  }

  const leftEarP  = sidePrice(hasLeft,  left,  leftPrice)
  const rightEarP = sidePrice(hasRight, right, rightPrice)

  const carePlanCost = payType === 'private'
    ? 0
    : (CARE_PLAN_OPTIONS.find(c => c.id === carePlan)?.price || 0)

  const deviceTotal = (leftEarP || 0) + (rightEarP || 0)
  const grandTotal  = deviceTotal + carePlanCost

  const canGenerate = !!fittingType
    && (!hasLeft  || left.manufacturer)
    && (!hasRight || right.manufacturer)
    && !generating

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setError(null)
    try {
      const pricePerAid = (leftEarP && rightEarP)
        ? Math.max(leftEarP, rightEarP)
        : (leftEarP || rightEarP || 0)
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
        selectedCarePlan: carePlan || 'complete',
        payType,
        tpa:     patient.insurance?.tpa     || null,
        carrier: patient.insurance?.carrier || null,
        audiology: patient.audiology,
        clinic,
        provider: {
          fullName:      staffProfile?.fullName      || 'Provider',
          activeLicense: staffProfile?.activeLicense || '',
        },
      })
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
            aidCount: (hasLeft ? 1 : 0) + (hasRight ? 1 : 0),
            selectedCarePlan: carePlan || 'complete',
            payType,
            carrier: patient.insurance?.carrier || null,
            tpa:     patient.insurance?.tpa     || null,
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

  const renderEarColumn = (label, active, setActive, side, which, price, setPrice, onCopyFromLeft) => {
    const opts = optionsFor(side)
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
                title="Mirror the left ear's device and price to this ear"
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
              {opts.families.map(f => <option key={f.id} value={f.id}>{f.family || f.name || f.id}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            {opts.techLevels.length > 0 && (
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tech Level</label>
                <select style={inputStyle} value={side.techLevel} onChange={e => setSideField(which, 'techLevel', e.target.value)}>
                  <option value="">—</option>
                  {opts.techLevels.map(t => <option key={t} value={t}>{t}</option>)}
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
          <div>
            <label style={labelStyle}>
              {side.isCROS || isCrosVariant(side.variant)
                ? 'Price per unit (CROS — fixed)'
                : 'Price per aid'}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: C.muted, fontSize: 14 }}>$</span>
              <input
                type="number" min="0" step="1"
                style={{ ...inputStyle, flex: 1 }}
                value={side.isCROS || isCrosVariant(side.variant) ? CROS_PRICE_PER_UNIT : price}
                disabled={side.isCROS || isCrosVariant(side.variant)}
                onChange={e => setPrice(Number(e.target.value) || 0)}
              />
            </div>
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

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            {renderEarColumn('Left ear',  hasLeft,  setHasLeft,  left,  'left',  leftPrice,  setLeftPrice)}
            {renderEarColumn(
              'Right ear', hasRight, setHasRight, right, 'right', rightPrice, setRightPrice,
              (left.style || left.manufacturer || left.familyId)
                ? () => {
                    setHasRight(true)
                    setRight({ ...left })
                    setRightPrice(leftPrice)
                  }
                : null
            )}
          </div>

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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 6 }}>
              <span>Device subtotal</span>
              <span>${deviceTotal.toLocaleString()}</span>
            </div>
            {carePlanCost > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 6 }}>
                <span>{CARE_PLAN_OPTIONS.find(c => c.id === carePlan)?.label}</span>
                <span>${carePlanCost.toLocaleString()}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 15, fontWeight: 700, color: C.ink,
              paddingTop: 8, borderTop: `1px solid ${C.line}`,
            }}>
              <span>Total</span>
              <span>${grandTotal.toLocaleString()}</span>
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
