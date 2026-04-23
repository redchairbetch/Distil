import { useState, useEffect, useMemo, useRef } from 'react'
import {
  loadPatientHeader,
  loadCurrentRecommendation,
  generateRecommendation,
  loadPatientRecommendationInputs,
  loadPricingReveal,
  loadRetailAnchors,
  loadProductCatalogTiers,
  loadPatientTnsFlag,
  saveProviderEditedRationale,
} from '../db.js'
import {
  normalizeAudiogramInput,
  normalizeIntakeInput,
} from '../recommendationEngine.js'

// Narrative §3 — Chapter 3: Recommendation. Patient cost first, always.
// Retail shown only as "full retail value" anchor. Premium label is banned;
// tier labels come from clinic_retail_anchors.

// Ranks displayed as cards. Engine outputs 1/3/5; others reserved for pilot.
const CARD_RANKS = [5, 3, 1]

// Maps engine/product tier_rank to the clinic's retail-anchor slug.
const ANCHOR_KEY_BY_RANK = {
  5: 'select',
  4: 'advanced',
  3: 'standard',
  2: 'level2',
  1: 'level1',
}

// Signia family each rank lives in. Matches db.js SIGNIA_FAMILY_BY_RANK.
const FAMILY_BY_RANK = {
  5: 'sig-pure-ix',
  4: 'sig-pure-ix',
  3: 'sig-pure-ix',
  2: 'sig-pure-ax',
  1: 'sig-pure-ax',
}

const COLOR = {
  ink:     '#0a1628',
  muted:   '#6b7280',
  faint:   '#9ca3af',
  line:    '#e5e7eb',
  bgSoft:  '#f9fafb',
  bgChip:  '#f3f4f6',
  accent:  '#0f766e',  // recommended-card accent (teal-700)
  warn:    '#b45309',  // TNS / caution
  good:    '#047857',
}

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function formatDob(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function computeAge(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age
}

// Pick one representative tier row per rank for the card display. Prefers
// the rank's canonical family; falls back to any active tier at that rank.
function pickTierForRank(allTiers, rank) {
  if (!Array.isArray(allTiers)) return null
  const family = FAMILY_BY_RANK[rank]
  const primary = allTiers.find(t => t.tierRank === rank && t.productCatalogId === family)
  if (primary) return primary
  return allTiers.find(t => t.tierRank === rank) || null
}

// Per-tier-card pricing. Same tier as covered → copay. Upgrade →
// copay + retail delta. Downgrade → copay (TH does not refund).
function computeCardPricing(targetRank, pricing, anchorsByKey) {
  if (!pricing || !anchorsByKey) return null
  const targetKey = ANCHOR_KEY_BY_RANK[targetRank]
  const targetAnchor = anchorsByKey[targetKey]
  if (!targetAnchor) return null
  const targetRetail = Number(targetAnchor.price_per_aid)
  const coveredRetail = pricing.retailPerAid
  const copay = pricing.copayPerAid

  if (pricing.anchorKey === targetKey) {
    return {
      patientCost: copay,
      retail: targetRetail,
      tierLabel: targetAnchor.label,
      isCovered: true,
      isUpgrade: false,
      upgradeDelta: 0,
    }
  }
  if (targetRetail > coveredRetail) {
    const delta = targetRetail - coveredRetail
    return {
      patientCost: copay + delta,
      retail: targetRetail,
      tierLabel: targetAnchor.label,
      isCovered: false,
      isUpgrade: true,
      upgradeDelta: delta,
    }
  }
  return {
    patientCost: copay,
    retail: targetRetail,
    tierLabel: targetAnchor.label,
    isCovered: false,
    isUpgrade: false,
    upgradeDelta: 0,
  }
}

export default function DeviceSelection({ patientId, staffId, clinicId }) {
  const [state, setState] = useState({ loading: true, error: null })
  const [patient, setPatient] = useState(null)
  const [rec, setRec] = useState(null)
  const [recInputs, setRecInputs] = useState(null)
  const [pricing, setPricing] = useState(null)
  const [anchors, setAnchors] = useState([])
  const [tiers, setTiers] = useState([])
  const [tnsFlag, setTnsFlag] = useState(null)

  useEffect(() => {
    if (!patientId || !clinicId) return
    let cancelled = false
    ;(async () => {
      try {
        const [patientRow, existingRec, inputs, pricingRow, anchorRows, tierRows, tnsRow] =
          await Promise.all([
            loadPatientHeader(patientId),
            loadCurrentRecommendation(patientId),
            loadPatientRecommendationInputs(patientId),
            loadPricingReveal(clinicId, patientId),
            loadRetailAnchors(clinicId, 'signia'),
            loadProductCatalogTiers(),
            loadPatientTnsFlag(patientId),
          ])
        if (cancelled) return

        // Write-once-on-initial-load: if no active recommendation, run the
        // engine now and persist. Re-runs happen elsewhere (future phase).
        let current = existingRec
        if (!current) {
          const generated = await generateRecommendation(patientId, clinicId)
          if (cancelled) return
          if (generated?.blocked) {
            setState({ loading: false, error: generated.reason })
            return
          }
          current = generated
        }

        setPatient(patientRow)
        setRec(current)
        setRecInputs(inputs)
        setPricing(pricingRow)
        setAnchors(anchorRows || [])
        setTiers(tierRows || [])
        setTnsFlag(tnsRow)
        setState({ loading: false, error: null })
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e.message || String(e) })
      }
    })()
    return () => { cancelled = true }
  }, [patientId, clinicId])

  const anchorsByKey = useMemo(() => {
    const out = {}
    for (const a of anchors) out[a.id] = a
    return out
  }, [anchors])

  const normalizedAudio = useMemo(() => {
    if (!recInputs?.audiogram) return null
    return normalizeAudiogramInput(recInputs.audiogram, recInputs.thresholds || [])
  }, [recInputs])

  const normalizedIntake = useMemo(() => {
    if (!recInputs?.intakeAnswers) return null
    return normalizeIntakeInput(recInputs.intakeAnswers)
  }, [recInputs])

  if (state.loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>Loading device selection…</div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Can't build recommendation</div>
          <div style={{ color: COLOR.muted, fontSize: 14 }}>{state.error}</div>
          <a href="/distil" style={styles.backLink}>← Back to CRM</a>
        </div>
      </div>
    )
  }

  const patientName = patient
    ? [patient.first_name, patient.last_name].filter(Boolean).join(' ')
    : 'Patient'
  const age = computeAge(patient?.dob)

  return (
    <div style={styles.page}>
      <Header patientName={patientName} age={age} dob={patient?.dob} patientId={patient?.id} />

      <Zone1
        audio={normalizedAudio}
        intake={normalizedIntake}
        audiogramRow={recInputs?.audiogram}
        pricing={pricing}
        tnsFlag={tnsFlag}
      />

      <Zone2
        rec={rec}
        tiers={tiers}
        pricing={pricing}
        anchorsByKey={anchorsByKey}
      />

      <RationaleEditor rec={rec} onSaved={updated => setRec(r => ({ ...r, ...updated }))} />
    </div>
  )
}

// ============================================================
// HEADER
// ============================================================

function Header({ patientName, age, dob, patientId }) {
  return (
    <div style={styles.header}>
      <a href="/distil" style={styles.backLink}>← CRM</a>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: COLOR.ink }}>
          {patientName}
        </div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2 }}>
          {[
            age != null ? `${age} y/o` : null,
            formatDob(dob),
            patientId ? `ID ${patientId.slice(0, 8)}` : null,
          ].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div style={{ fontSize: 11, color: COLOR.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Device Selection
      </div>
    </div>
  )
}

// ============================================================
// ZONE 1 — Clinical context strip
// ============================================================

function Zone1({ audio, intake, audiogramRow, pricing, tnsFlag }) {
  return (
    <div style={styles.zone1}>
      <AudiogramBlock audio={audio} audiogramRow={audiogramRow} />
      <IntakeBlock intake={intake} />
      <InsuranceBlock pricing={pricing} />
      <TnsBlock flag={tnsFlag} />
    </div>
  )
}

function AudiogramBlock({ audio, audiogramRow }) {
  if (!audio) {
    return (
      <div style={styles.stripCell}>
        <div style={styles.stripLabel}>Audiogram</div>
        <div style={styles.stripEmpty}>No audiogram on file</div>
      </div>
    )
  }
  const ptaLow = avgOrNull([audio.ptaLowRight, audio.ptaLowLeft])
  const ptaHigh = avgOrNull([audio.ptaHighRight, audio.ptaHighLeft])
  const asymmetry = Math.abs((audio.ptaHighRight || 0) - (audio.ptaHighLeft || 0))
  const wrsR = audio.wrsRight
  const wrsL = audio.wrsLeft
  const configLabel = {
    sloping:    'Sloping HF',
    flat:       'Flat',
    mild_slope: 'Mild slope',
    unknown:    'Config unknown',
  }[audio.configuration] || '—'

  return (
    <div style={styles.stripCell}>
      <div style={styles.stripLabel}>Audiogram</div>
      <div style={styles.stripRow}>
        <span style={styles.stripKey}>LF PTA</span>
        <span style={styles.stripVal}>
          {ptaLow != null ? `${Math.round(ptaLow)} dB HL` : '—'}
        </span>
      </div>
      <div style={styles.stripRow}>
        <span style={styles.stripKey}>HF PTA</span>
        <span style={styles.stripVal}>
          {ptaHigh != null ? `${Math.round(ptaHigh)} dB HL` : '—'}
        </span>
      </div>
      <div style={styles.stripRow}>
        <span style={styles.stripKey}>WRS</span>
        <span style={styles.stripVal}>
          {wrsR != null || wrsL != null
            ? `R ${wrsR ?? '—'}% / L ${wrsL ?? '—'}%`
            : '—'}
        </span>
      </div>
      <div style={styles.chipRow}>
        <span style={styles.chip}>{configLabel}</span>
        {asymmetry >= 15 && <span style={{ ...styles.chip, background: '#fef3c7', color: '#92400e' }}>Asymmetric {Math.round(asymmetry)} dB</span>}
      </div>
      {audiogramRow?.test_date && (
        <div style={{ fontSize: 10, color: COLOR.faint, marginTop: 4 }}>
          tested {formatDob(audiogramRow.test_date)}
        </div>
      )}
    </div>
  )
}

function IntakeBlock({ intake }) {
  if (!intake) {
    return (
      <div style={styles.stripCell}>
        <div style={styles.stripLabel}>Intake</div>
        <div style={styles.stripEmpty}>No intake submitted</div>
      </div>
    )
  }
  return (
    <div style={styles.stripCell}>
      <div style={styles.stripLabel}>Intake</div>
      <div style={styles.stripRow}>
        <span style={styles.stripKey}>Symptoms</span>
        <span style={styles.stripVal}>{intake.hearYesCount} / {intake.hearSymptomsTotal}</span>
      </div>
      <div style={styles.stripRow}>
        <span style={styles.stripKey}>Self-rated</span>
        <span style={styles.stripVal}>
          {intake.selfRating != null ? `${intake.selfRating}/10` : '—'}
        </span>
      </div>
      <div style={styles.chipRow}>
        {intake.occupationalNoise && <span style={styles.chip}>Occupational noise</span>}
        {intake.recreationalNoise && <span style={styles.chip}>Recreational noise</span>}
        {intake.readyToAddress && <span style={{ ...styles.chip, background: '#dcfce7', color: COLOR.good }}>Ready</span>}
      </div>
    </div>
  )
}

function InsuranceBlock({ pricing }) {
  if (!pricing) {
    return (
      <div style={styles.stripCell}>
        <div style={styles.stripLabel}>Insurance</div>
        <div style={styles.stripEmpty}>No active plan linked</div>
      </div>
    )
  }
  return (
    <div style={styles.stripCell}>
      <div style={styles.stripLabel}>Insurance</div>
      <div style={styles.stripRow}>
        <span style={styles.stripKey}>Covered tier</span>
        <span style={styles.stripVal}>{pricing.tierLabel}</span>
      </div>
      <div style={styles.stripRow}>
        <span style={styles.stripKey}>Copay / aid</span>
        <span style={{ ...styles.stripVal, fontWeight: 700 }}>{formatMoney(pricing.copayPerAid)}</span>
      </div>
      <div style={styles.stripRow}>
        <span style={styles.stripKey}>Saves</span>
        <span style={styles.stripVal}>{pricing.savingsPct}% vs retail</span>
      </div>
    </div>
  )
}

function TnsBlock({ flag }) {
  if (!flag) {
    return (
      <div style={styles.stripCell}>
        <div style={styles.stripLabel}>History</div>
        <div style={{ ...styles.stripEmpty, color: COLOR.good }}>No prior TNS</div>
      </div>
    )
  }
  return (
    <div style={{ ...styles.stripCell, background: '#fffbeb', borderColor: '#fde68a' }}>
      <div style={{ ...styles.stripLabel, color: COLOR.warn }}>Prior TNS</div>
      <div style={styles.stripRow}>
        <span style={styles.stripKey}>Reason</span>
        <span style={styles.stripVal}>{flag.outcome_reason || '—'}</span>
      </div>
      <div style={{ fontSize: 10, color: COLOR.muted, marginTop: 4 }}>
        Consider empathy-forward approach before revealing price.
      </div>
    </div>
  )
}

// ============================================================
// ZONE 2 — Three tier cards
// ============================================================

function Zone2({ rec, tiers, pricing, anchorsByKey }) {
  return (
    <div>
      <div style={styles.zoneLabel}>Recommendation</div>
      <div style={styles.cardsRow}>
        {CARD_RANKS.map(rank => {
          const tier = pickTierForRank(tiers, rank)
          const cardPricing = computeCardPricing(rank, pricing, anchorsByKey)
          const isRecommended = rec?.recommended_tier_rank === rank
          return (
            <TierCard
              key={rank}
              rank={rank}
              tier={tier}
              pricing={cardPricing}
              isRecommended={isRecommended}
            />
          )
        })}
      </div>
    </div>
  )
}

function TierCard({ rank, tier, pricing, isRecommended }) {
  const label = pricing?.tierLabel || `Tier ${rank}`
  return (
    <div
      style={{
        ...styles.card,
        borderColor: isRecommended ? COLOR.accent : COLOR.line,
        borderWidth: isRecommended ? 3 : 1,
        boxShadow: isRecommended ? '0 8px 24px rgba(15, 118, 110, 0.15)' : 'none',
      }}
    >
      {isRecommended && (
        <div style={styles.recBadge}>Engine recommended</div>
      )}
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, color: COLOR.ink }}>
        {label}
      </div>
      {tier && (
        <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2, marginBottom: 14 }}>
          {tier.family} · {tier.generation}
        </div>
      )}

      {/* Patient-cost-first */}
      {pricing ? (
        <div style={styles.priceBlock}>
          <div style={styles.priceLabel}>Your cost, per aid</div>
          <div style={styles.priceBig}>{formatMoney(pricing.patientCost)}</div>
          <div style={styles.priceRetail}>
            full retail value {formatMoney(pricing.retail)}
          </div>
          {pricing.isCovered && (
            <div style={{ ...styles.priceNote, color: COLOR.good }}>
              Covered by your plan
            </div>
          )}
          {pricing.isUpgrade && (
            <div style={styles.priceNote}>
              Plan copay + {formatMoney(pricing.upgradeDelta)} upgrade to {label}
            </div>
          )}
          {!pricing.isCovered && !pricing.isUpgrade && (
            <div style={styles.priceNote}>
              Your plan covers this tier at its copay
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: COLOR.faint, fontSize: 13 }}>Pricing unavailable</div>
      )}

      {tier && <FeatureList tier={tier} />}
    </div>
  )
}

function FeatureList({ tier }) {
  const rows = []
  if (tier.platformChip)   rows.push(['Platform', tier.platformChip])
  if (tier.rechargeable != null) rows.push(['Battery', tier.rechargeable ? 'Rechargeable' : (tier.batteryType || 'Disposable')])
  if (tier.directionalMic) rows.push(['Directional mic', tier.directionalMic])
  if (tier.ipRating)       rows.push(['IP rating', tier.ipRating])
  if (tier.streamingProtocols?.length)
    rows.push(['Streaming', tier.streamingProtocols.join(', ')])
  if (tier.telecoil)       rows.push(['Telecoil', 'Included'])

  return (
    <ul style={styles.featureList}>
      {rows.map(([k, v]) => (
        <li key={k} style={styles.featureRow}>
          <span style={styles.featureKey}>{k}</span>
          <span style={styles.featureVal}>{v}</span>
        </li>
      ))}
    </ul>
  )
}

// ============================================================
// RATIONALE EDITOR — always-open textarea, save on blur
// ============================================================

function RationaleEditor({ rec, onSaved }) {
  const initial = rec?.provider_edited_rationale_text ?? rec?.generated_rationale_text ?? ''
  const [text, setText] = useState(initial)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)
  const lastSavedRef = useRef(initial)

  // Reset editor when recommendation row changes (e.g., regenerated).
  useEffect(() => {
    const next = rec?.provider_edited_rationale_text ?? rec?.generated_rationale_text ?? ''
    setText(next)
    lastSavedRef.current = next
  }, [rec?.id])

  const isEdited = rec?.provider_edited_rationale_text != null && rec.provider_edited_rationale_text.length > 0

  async function handleBlur() {
    if (!rec?.id) return
    if (text === lastSavedRef.current) return
    setError(null)
    try {
      await saveProviderEditedRationale(rec.id, text)
      lastSavedRef.current = text
      setSavedAt(Date.now())
      onSaved?.({ provider_edited_rationale_text: text && text.trim().length > 0 ? text : null })
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  function handleResetToEngine() {
    if (!rec?.id) return
    setText(rec.generated_rationale_text || '')
  }

  return (
    <div style={styles.rationaleBox}>
      <div style={styles.rationaleHeader}>
        <div style={styles.zoneLabel}>Patient-facing rationale</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isEdited && <span style={styles.editedChip}>Provider-edited</span>}
          {savedAt && <span style={styles.savedChip}>Saved</span>}
          {error && <span style={{ color: '#b91c1c', fontSize: 12 }}>Save failed: {error}</span>}
          <button type="button" onClick={handleResetToEngine} style={styles.resetBtn}>
            Reset to engine draft
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={handleBlur}
        rows={4}
        style={styles.textarea}
        placeholder="Rationale shown to the patient"
      />
      <div style={{ fontSize: 11, color: COLOR.faint, marginTop: 4 }}>
        Saves automatically when you click away. Engine-generated text is kept as the
        fallback; your edits replace it on the presentation screen.
      </div>
    </div>
  )
}

// ============================================================
// HELPERS
// ============================================================

function avgOrNull(arr) {
  const vals = (arr || []).filter(v => v != null && !Number.isNaN(v))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// ============================================================
// STYLES
// ============================================================

const styles = {
  page: {
    minHeight: '100vh',
    background: COLOR.bgSoft,
    padding: '24px 32px 64px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: COLOR.ink,
  },
  loading: {
    padding: 48,
    textAlign: 'center',
    color: COLOR.muted,
  },
  errorBox: {
    maxWidth: 560,
    margin: '48px auto',
    background: 'white',
    border: `1px solid ${COLOR.line}`,
    borderRadius: 12,
    padding: 24,
  },
  backLink: {
    fontSize: 13,
    color: COLOR.muted,
    textDecoration: 'none',
    display: 'inline-block',
    padding: '6px 12px',
    marginRight: 16,
    borderRadius: 8,
    border: `1px solid ${COLOR.line}`,
    background: 'white',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  zone1: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 24,
  },
  stripCell: {
    background: 'white',
    border: `1px solid ${COLOR.line}`,
    borderRadius: 10,
    padding: 12,
    minHeight: 110,
  },
  stripLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLOR.muted,
    marginBottom: 8,
  },
  stripRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    marginBottom: 3,
  },
  stripKey: { color: COLOR.muted },
  stripVal: { color: COLOR.ink, fontWeight: 500 },
  stripEmpty: { fontSize: 13, color: COLOR.faint, fontStyle: 'italic' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  chip: {
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 10,
    background: COLOR.bgChip,
    color: COLOR.ink,
  },
  zoneLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLOR.muted,
    marginBottom: 10,
  },
  cardsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  card: {
    position: 'relative',
    background: 'white',
    border: `1px solid ${COLOR.line}`,
    borderRadius: 16,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  recBadge: {
    position: 'absolute',
    top: -10,
    left: 16,
    background: COLOR.accent,
    color: 'white',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    padding: '4px 10px',
    borderRadius: 12,
  },
  priceBlock: {
    background: COLOR.bgSoft,
    border: `1px solid ${COLOR.line}`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLOR.muted,
  },
  priceBig: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 32,
    fontWeight: 700,
    color: COLOR.ink,
    marginTop: 2,
  },
  priceRetail: {
    fontSize: 11,
    color: COLOR.muted,
    textDecoration: 'line-through',
    marginTop: 2,
  },
  priceNote: {
    fontSize: 11,
    color: COLOR.muted,
    marginTop: 6,
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  featureRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: `1px solid ${COLOR.line}`,
    fontSize: 12,
  },
  featureKey: { color: COLOR.muted },
  featureVal: { color: COLOR.ink, fontWeight: 500, textAlign: 'right', marginLeft: 8 },
  rationaleBox: {
    background: 'white',
    border: `1px solid ${COLOR.line}`,
    borderRadius: 12,
    padding: 16,
  },
  rationaleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  textarea: {
    width: '100%',
    border: `1px solid ${COLOR.line}`,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'inherit',
    color: COLOR.ink,
    lineHeight: 1.5,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  editedChip: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    padding: '3px 8px',
    borderRadius: 10,
    background: '#fef3c7',
    color: '#92400e',
  },
  savedChip: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    padding: '3px 8px',
    borderRadius: 10,
    background: '#dcfce7',
    color: COLOR.good,
  },
  resetBtn: {
    background: 'white',
    border: `1px solid ${COLOR.line}`,
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 12,
    color: COLOR.muted,
    cursor: 'pointer',
  },
}
