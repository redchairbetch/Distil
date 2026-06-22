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
  loadClinicSettings,
  loadCarePlanCatalog,
  loadPurchaseConfiguration,
  savePurchaseConfiguration,
  saveProviderEditedRationale,
} from '../db.js'
import {
  normalizeAudiogramInput,
  normalizeIntakeInput,
  unwrapIntakeAnswers,
} from '../recommendationEngine.js'
import { tnsTagLabel } from '../tns_tags.js'
import { flaggedEnvironments, COVERAGE_BY_RANK } from '../listeningSituations.js'
import { EnvironmentCoverage } from '../components/CoverageBars.jsx'

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

// Per-tier-card pricing.
// Private pay: patient cost = clinic retail anchor for the rank.
// Insurance: same tier as covered → copay; upgrade → copay + retail delta;
// downgrade → copay (TH does not refund).
function computeCardPricing(targetRank, pricing, anchorsByKey, payType) {
  if (!anchorsByKey) return null
  const targetKey = ANCHOR_KEY_BY_RANK[targetRank]
  const targetAnchor = anchorsByKey[targetKey]
  if (!targetAnchor) return null
  const targetRetail = Number(targetAnchor.price_per_aid)

  // Private pay: no insurance copay — the patient pays clinic retail.
  if (payType === 'private') {
    return {
      patientCost: targetRetail,
      retail: targetRetail,
      tierLabel: targetAnchor.label,
      payType: 'private',
      isCovered: false,
      isUpgrade: false,
      upgradeDelta: 0,
    }
  }

  // Insurance: needs a pricing reveal (copay + covered tier).
  if (!pricing) return null
  const coveredRetail = pricing.retailPerAid
  const copay = pricing.copayPerAid

  if (pricing.anchorKey === targetKey) {
    return {
      patientCost: copay,
      retail: targetRetail,
      tierLabel: targetAnchor.label,
      payType: 'insurance',
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
      payType: 'insurance',
      isCovered: false,
      isUpgrade: true,
      upgradeDelta: delta,
    }
  }
  return {
    patientCost: copay,
    retail: targetRetail,
    tierLabel: targetAnchor.label,
    payType: 'insurance',
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
  const [carePlans, setCarePlans] = useState([])
  const [existingPurchase, setExistingPurchase] = useState(null)
  const [selectedRank, setSelectedRank] = useState(null)
  // Bundled vs unbundled lives here (not in Zone5) so the "What's included"
  // detail panel can reflect it too. Initialized from the saved purchase /
  // clinic default in the load effect once data arrives.
  const [bundleMode, setBundleMode] = useState('bundled')

  useEffect(() => {
    if (!patientId || !clinicId) return
    let cancelled = false
    ;(async () => {
      try {
        const [patientRow, existingRec, inputs, pricingRow, anchorRows, tierRows, tnsRow, clinicRow, carePlanRows, purchaseRow] =
          await Promise.all([
            loadPatientHeader(patientId),
            loadCurrentRecommendation(patientId),
            loadPatientRecommendationInputs(patientId),
            loadPricingReveal(clinicId, patientId),
            loadRetailAnchors(clinicId, 'signia'),
            loadProductCatalogTiers(),
            loadPatientTnsFlag(patientId),
            loadClinicSettings(clinicId),
            loadCarePlanCatalog(clinicId),
            loadPurchaseConfiguration(patientId),
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
        setCarePlans(carePlanRows || [])
        setExistingPurchase(purchaseRow)
        const savedTierId = purchaseRow?.lineItems?.find(li => li.productType === 'device_left' || li.productType === 'device_right')?.productCatalogTierId
        const savedRank = savedTierId ? (tierRows || []).find(t => t.id === savedTierId)?.tierRank : null
        setSelectedRank(savedRank ?? current?.recommended_tier_rank ?? null)
        setBundleMode(purchaseRow?.bundleMode || clinicRow?.defaultBundleMode || 'bundled')
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

  // Environments the patient flagged as struggles — drives the prominent
  // rows in the environment-fit chart. Unwrap first: the kiosk stores
  // answers as {_meta, answers, consent}; flaggedEnvironments wants flat keys.
  const flaggedEnvs = useMemo(
    () => flaggedEnvironments(unwrapIntakeAnswers(recInputs?.intakeAnswers)),
    [recInputs],
  )

  // The product-catalog tier row for the selected rank — feeds the Zone 4
  // device-specs and fit-confirmation panels (Zone 5 derives its own copy).
  const selectedTier = useMemo(() => pickTierForRank(tiers, selectedRank), [tiers, selectedRank])

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
        payType={patient?.pay_type}
        tnsFlag={tnsFlag}
      />

      <Zone2
        rec={rec}
        tiers={tiers}
        pricing={pricing}
        anchorsByKey={anchorsByKey}
        payType={patient?.pay_type}
        selectedRank={selectedRank}
        onSelectRank={setSelectedRank}
      />

      <EnvironmentFit
        selectedRank={selectedRank}
        anchorsByKey={anchorsByKey}
        flagged={flaggedEnvs}
      />

      <Zone4
        selectedRank={selectedRank}
        selectedTier={selectedTier}
        audio={normalizedAudio}
        payType={patient?.pay_type}
        bundleMode={bundleMode}
        anchorsByKey={anchorsByKey}
      />

      <RationaleEditor rec={rec} onSaved={updated => setRec(r => ({ ...r, ...updated }))} />

      <Zone5
        selectedRank={selectedRank}
        tiers={tiers}
        pricing={pricing}
        anchorsByKey={anchorsByKey}
        payType={patient?.pay_type}
        carePlans={carePlans}
        bundleMode={bundleMode}
        setBundleMode={setBundleMode}
        existingPurchase={existingPurchase}
        patientId={patientId}
        clinicId={clinicId}
      />
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

function Zone1({ audio, intake, audiogramRow, pricing, payType, tnsFlag }) {
  return (
    <div style={styles.zone1}>
      <AudiogramBlock audio={audio} audiogramRow={audiogramRow} />
      <IntakeBlock intake={intake} />
      <InsuranceBlock pricing={pricing} payType={payType} />
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

function InsuranceBlock({ pricing, payType }) {
  if (payType === 'private') {
    return (
      <div style={styles.stripCell}>
        <div style={styles.stripLabel}>Coverage</div>
        <div style={{ ...styles.stripVal, fontWeight: 700 }}>Private pay</div>
        <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 4 }}>
          Self-funded — clinic retail pricing applies.
        </div>
      </div>
    )
  }
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
        <span style={styles.stripKey}>Reasons</span>
        <span style={styles.stripVal}>
          {flag.outcome_reasons?.length
            ? flag.outcome_reasons.map(tnsTagLabel).join(', ')
            : '—'}
        </span>
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

function Zone2({ rec, tiers, pricing, anchorsByKey, payType, selectedRank, onSelectRank }) {
  return (
    <div>
      <div style={styles.zoneLabel}>Recommendation</div>
      <div style={styles.cardsRow}>
        {CARD_RANKS.map(rank => {
          const tier = pickTierForRank(tiers, rank)
          const cardPricing = computeCardPricing(rank, pricing, anchorsByKey, payType)
          const isRecommended = rec?.recommended_tier_rank === rank
          return (
            <TierCard
              key={rank}
              rank={rank}
              tier={tier}
              pricing={cardPricing}
              isRecommended={isRecommended}
              isSelected={selectedRank === rank}
              onSelect={() => onSelectRank(rank)}
            />
          )
        })}
      </div>
    </div>
  )
}

function TierCard({ rank, tier, pricing, isRecommended, isSelected, onSelect }) {
  const label = pricing?.tierLabel || `Tier ${rank}`
  return (
    <div
      onClick={onSelect}
      style={{
        ...styles.card,
        cursor: 'pointer',
        borderColor: isSelected ? COLOR.ink : isRecommended ? COLOR.accent : COLOR.line,
        borderWidth: isSelected || isRecommended ? 3 : 1,
        boxShadow: isSelected
          ? '0 8px 24px rgba(10, 22, 40, 0.18)'
          : isRecommended ? '0 8px 24px rgba(15, 118, 110, 0.15)' : 'none',
      }}
    >
      {isRecommended && (
        <div style={styles.recBadge}>Engine recommended</div>
      )}
      {isSelected && (
        <div style={styles.selectedBadge}>✓ Selected</div>
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
          {pricing.payType === 'private' ? (
            <div style={styles.priceNote}>Private pay — clinic retail</div>
          ) : (
            <>
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
            </>
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
// ENVIRONMENT FIT — how the selected tier handles the patient's day
// ============================================================

// Carries the Technology Tier step's listening-environment comparison onto
// this screen (context.md Distil #25). Reflects the currently-selected tier,
// so the bars re-fill when the provider/patient moves between tier cards.
function EnvironmentFit({ selectedRank, anchorsByKey, flagged }) {
  if (selectedRank == null || !COVERAGE_BY_RANK[selectedRank]) return null
  const tierLabel = anchorsByKey?.[ANCHOR_KEY_BY_RANK[selectedRank]]?.label || `Tier ${selectedRank}`
  const hasFlagged = flagged && flagged.size > 0
  return (
    <div style={styles.envPanel}>
      <div style={styles.zoneLabel}>Environment fit</div>
      <div style={styles.envTitle}>How {tierLabel} technology handles your day</div>
      <div style={styles.envSub}>
        {hasFlagged
          ? 'Performance across the situations you told us are hardest — and everywhere else.'
          : 'Expected performance across everyday listening environments.'}
      </div>
      <div style={{ marginTop: 14 }}>
        <EnvironmentCoverage rank={selectedRank} flagged={flagged} />
      </div>
      <div style={styles.envLegend}>
        Bars show how fully each environment is supported —
        <span style={{ color: '#16a34a', fontWeight: 700 }}> green</span> is fully covered,
        <span style={{ color: '#dc2626', fontWeight: 700 }}> red</span> is where even the best
        technology has limits.
      </div>
    </div>
  )
}

// ============================================================
// ZONE 4 — Expandable detail panels (specs · what's included · fit)
// ============================================================

// Spec §3 Zone 4: collapsed-by-default accordions so the deeper detail doesn't
// crowd the primary view. Cross-manufacturer comparison (the spec's 4th panel)
// is parked until the cross_manufacturer_equivalence table is populated —
// context.md Distil #16.
function Zone4({ selectedRank, selectedTier, audio, payType, bundleMode, anchorsByKey }) {
  const [open, setOpen] = useState({})
  if (selectedRank == null) return null
  const toggle = key => setOpen(o => ({ ...o, [key]: !o[key] }))

  const tierLabel = anchorsByKey?.[ANCHOR_KEY_BY_RANK[selectedRank]]?.label || ''
  const deviceName = (selectedTier?.family || tierLabel || '').trim()
  const fit = computeFitConfirmation(selectedTier, audio)

  // Fit-confirmation panel only appears when the catalog carries a fitting
  // range for this device — otherwise there's nothing honest to claim.
  const panels = [
    { key: 'specs',    title: 'Device specifications', body: <DeviceSpecsPanel tier={selectedTier} /> },
    { key: 'included', title: "What's included",       body: <WhatsIncludedPanel payType={payType} bundleMode={bundleMode} /> },
  ]
  if (fit) {
    panels.push({ key: 'fit', title: 'Does this device fit your hearing?', body: <FitConfirmationPanel fit={fit} deviceName={deviceName} /> })
  }

  return (
    <div style={styles.zone4}>
      <div style={styles.zoneLabel}>The details</div>
      {panels.map(p => (
        <div key={p.key} style={styles.accordionItem}>
          <button
            type="button"
            onClick={() => toggle(p.key)}
            aria-expanded={!!open[p.key]}
            style={styles.accordionHeader}
          >
            <span style={styles.accordionTitle}>{p.title}</span>
            <span style={{ ...styles.chevron, transform: open[p.key] ? 'rotate(90deg)' : 'none' }}>›</span>
          </button>
          {open[p.key] && <div style={styles.accordionBody}>{p.body}</div>}
        </div>
      ))}
    </div>
  )
}

// Patient-friendly battery descriptor. Rechargeable wins; otherwise humanize
// the raw catalog enum (e.g. 'disposable_312' → 'Size 312 battery').
function batteryLabel(tier) {
  if (tier.rechargeable) return 'Rechargeable (lithium-ion)'
  const t = tier.batteryType || ''
  if (/312/.test(t)) return 'Size 312 battery'
  if (/\b10\b|_10/.test(t)) return 'Size 10 battery'
  if (/13/.test(t)) return 'Size 13 battery'
  if (/675/.test(t)) return 'Size 675 battery'
  return t ? t.replace(/_/g, ' ') : 'Disposable battery'
}

function DeviceSpecsPanel({ tier }) {
  if (!tier) return <div style={styles.stripEmpty}>Select a device tier to see its specifications.</div>
  const rows = []
  const device = [tier.family, tier.generation].filter(Boolean).join(' · ')
  if (device)                    rows.push(['Device', device])
  if (tier.platformChip)         rows.push(['Platform', tier.platformChip])
  if (tier.rechargeable != null || tier.batteryType) rows.push(['Battery', batteryLabel(tier)])
  if (tier.streamingProtocols?.length) rows.push(['Wireless streaming', tier.streamingProtocols.join(', ')])
  if (tier.directionalMic)       rows.push(['Microphones', tier.directionalMic])
  if (tier.ipRating)             rows.push(['Water & dust resistance', tier.ipRating])
  if (tier.telecoil != null)     rows.push(['Telecoil', tier.telecoil ? 'Included' : 'Not included'])

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

// What's covered under Complete Care+. Copy mirrors the vetted pricing-reveal
// language (transparent: "5 years", never "lifetime"). Framing differs by pay
// type: private-pay bundles CC+ into the price (spec §7), insurance treats it
// as a separately purchased add-on.
function WhatsIncludedPanel({ payType, bundleMode }) {
  const isPrivate = payType === 'private'
  const declined = isPrivate && bundleMode !== 'bundled'
  const items = [
    'Unlimited office visits for 5 years',
    "A 4-year repair warranty — your manufacturer's 3 years, plus 1 more from us",
    'Loss and damage protection',
    'Cleanings, adjustments, and reprogramming as your hearing changes',
    'Replacement domes and wax guards',
    'A check-in call two days after you start',
    'Remote care between visits',
  ]
  return (
    <div>
      <div style={styles.includedHead}>
        <span>Complete Care+</span>
        {isPrivate
          ? (declined
              ? <span style={styles.includedBadgeWarn}>Declined — device only</span>
              : <span style={styles.includedBadgeGood}>Included with your purchase</span>)
          : <span style={styles.includedBadgeNeutral}>Available as an add-on</span>}
      </div>
      <ul style={styles.includedList}>
        {items.map(it => (
          <li key={it} style={{ ...styles.includedItem, opacity: declined ? 0.5 : 1 }}>
            <span style={styles.includedCheck}>{declined ? '—' : '✓'}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
      {declined && (
        <div style={styles.includedNote}>
          Complete Care+ is currently declined — the price reflects the devices only. You can add it back anytime in the purchase section below.
        </div>
      )}
      {!isPrivate && (
        <div style={styles.includedNote}>
          With insurance, Complete Care+ is purchased separately and layered on top of your plan's device benefit.
        </div>
      )}
    </div>
  )
}

// Conservative audiogram fit check: does the device's published fitting range
// cover the patient's loss in the low- and high-frequency regions? Uses the
// worse ear (max PTA) so the "covers your loss" claim is honest. Returns null
// when the catalog has no fitting range or there's no audiogram — the panel
// then simply doesn't render.
function computeFitConfirmation(tier, audio) {
  if (!tier || !audio) return null
  const deviceLow = tier.fittingRangeLowHzDb
  const deviceHigh = tier.fittingRangeHighHzDb
  if (deviceLow == null || deviceHigh == null) return null
  const patientLow = maxOrNull([audio.ptaLowRight, audio.ptaLowLeft])
  const patientHigh = maxOrNull([audio.ptaHighRight, audio.ptaHighLeft])
  if (patientLow == null && patientHigh == null) return null
  const lowOk = patientLow == null || patientLow <= deviceLow
  const highOk = patientHigh == null || patientHigh <= deviceHigh
  return { covered: lowOk && highOk, lowOk, highOk }
}

function FitConfirmationPanel({ fit, deviceName }) {
  if (fit.covered) {
    return (
      <div style={styles.fitOk}>
        <span style={styles.fitIcon}>✓</span>
        <div>
          <div style={styles.fitTitle}>This device is built to fit your hearing</div>
          <div style={styles.fitBody}>
            {deviceName ? `The ${deviceName}` : 'This device'}'s fitting range covers your hearing levels
            across the low and high frequencies we tested — it has the power for a full, comfortable fit.
          </div>
        </div>
      </div>
    )
  }
  const where = !fit.highOk && !fit.lowOk ? '' : !fit.highOk ? ' in the higher frequencies' : ' in the lower frequencies'
  return (
    <div style={styles.fitWarn}>
      <span style={styles.fitIcon}>!</span>
      <div>
        <div style={styles.fitTitle}>Your provider will confirm the fit</div>
        <div style={styles.fitBody}>
          Your hearing levels sit near the edge of this device's fitting range{where}. Your provider will
          confirm it delivers enough power, or recommend a model with more range.
        </div>
      </div>
    </div>
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
// ZONE 5 — Purchase configuration & pricing
// ============================================================

// Derive the aids selection ('pair' | 'left' | 'right') from saved line items.
function aidsFromLineItems(lineItems) {
  const hasL = (lineItems || []).some(li => li.productType === 'device_left')
  const hasR = (lineItems || []).some(li => li.productType === 'device_right')
  if (hasL && hasR) return 'pair'
  if (hasR) return 'right'
  return hasL ? 'left' : 'pair'
}

function Zone5({ selectedRank, tiers, pricing, anchorsByKey, payType, carePlans, bundleMode, setBundleMode, existingPurchase, patientId, clinicId }) {
  const [aids, setAids] = useState(existingPurchase ? aidsFromLineItems(existingPurchase.lineItems) : 'pair')
  const [save, setSave] = useState({ saving: false, savedAt: null, error: null })

  const selectedTier = useMemo(() => pickTierForRank(tiers, selectedRank), [tiers, selectedRank])
  const selectedPricing = useMemo(
    () => computeCardPricing(selectedRank, pricing, anchorsByKey, payType),
    [selectedRank, pricing, anchorsByKey, payType],
  )
  const ccPlan = useMemo(() => (carePlans || []).find(p => p.planType === 'complete'), [carePlans])

  const perAid = selectedPricing?.patientCost ?? null
  const ccPrice = ccPlan?.price ?? null
  const bundled = bundleMode === 'bundled'
  const aidCount = aids === 'pair' ? 2 : 1

  // Line items in the shape savePurchaseConfiguration expects. CC+ is its
  // own line; in unbundled mode it is not purchased, so it is omitted.
  const lineItems = useMemo(() => {
    if (perAid == null) return []
    const items = []
    if (aids === 'pair' || aids === 'left')
      items.push({ productType: 'device_left', productCatalogTierId: selectedTier?.id || null, listedPrice: perAid })
    if (aids === 'pair' || aids === 'right')
      items.push({ productType: 'device_right', productCatalogTierId: selectedTier?.id || null, listedPrice: perAid })
    if (bundled && ccPrice != null)
      items.push({ productType: 'care_plan', carePlanType: 'complete', listedPrice: ccPrice })
    return items
  }, [perAid, aids, bundled, ccPrice, selectedTier])

  const deviceTotal = perAid != null ? perAid * aidCount : null
  const total = deviceTotal != null ? deviceTotal + (bundled && ccPrice != null ? ccPrice : 0) : null

  async function handleSave() {
    if (perAid == null) return
    setSave({ saving: true, savedAt: null, error: null })
    const result = await savePurchaseConfiguration(patientId, clinicId, {
      bundleMode,
      lineItems,
      totalDisplayedPrice: total,
    })
    if (result?.success) setSave({ saving: false, savedAt: Date.now(), error: null })
    else setSave({ saving: false, savedAt: null, error: result?.error?.message || 'Save failed' })
  }

  if (perAid == null) {
    return (
      <div style={styles.zone5}>
        <div style={styles.zoneLabel}>Purchase</div>
        <div style={styles.stripEmpty}>Select a device tier above to configure the purchase.</div>
      </div>
    )
  }

  const tierLabel = selectedPricing.tierLabel

  return (
    <div style={styles.zone5}>
      <div style={styles.zoneLabel}>Purchase</div>

      <div style={styles.purchaseRowControls}>
        <span style={styles.controlLabel}>Aids</span>
        {[['pair', 'Pair'], ['left', 'Left only'], ['right', 'Right only']].map(([opt, lbl]) => (
          <button
            key={opt}
            type="button"
            onClick={() => setAids(opt)}
            style={{ ...styles.segBtn, ...(aids === opt ? styles.segBtnActive : {}) }}
          >
            {lbl}
          </button>
        ))}
      </div>

      <div style={styles.purchaseRowControls}>
        <span style={styles.controlLabel}>Care plan</span>
        {[['bundled', 'Bundled — Complete Care+ included'], ['unbundled', 'Unbundled — declined']].map(([mode, lbl]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setBundleMode(mode)}
            style={{ ...styles.segBtn, ...(bundleMode === mode ? styles.segBtnActive : {}) }}
          >
            {lbl}
          </button>
        ))}
      </div>

      <div style={styles.lineItemList}>
        {(aids === 'pair' || aids === 'left') && (
          <LineItemRow label={`Left aid — ${tierLabel}`} amount={perAid} />
        )}
        {(aids === 'pair' || aids === 'right') && (
          <LineItemRow label={`Right aid — ${tierLabel}`} amount={perAid} />
        )}
        {ccPrice != null && (
          <LineItemRow
            label={ccPlan.displayName || 'Complete Care+'}
            amount={ccPrice}
            muted={!bundled}
            note={bundled ? null : 'Declined'}
          />
        )}
      </div>

      <div style={styles.purchaseTotalRow}>
        <span style={styles.purchaseTotalLabel}>
          Total{payType === 'private' ? '' : ' · patient cost'}
        </span>
        <span style={styles.purchaseTotalValue}>{formatMoney(total)}</span>
      </div>

      <div style={styles.purchaseSaveRow}>
        <button type="button" onClick={handleSave} disabled={save.saving} style={styles.saveBtn}>
          {save.saving ? 'Saving…' : 'Save purchase'}
        </button>
        {save.savedAt && <span style={styles.savedChip}>Saved</span>}
        {save.error && <span style={{ color: '#b91c1c', fontSize: 12 }}>{save.error}</span>}
      </div>
    </div>
  )
}

function LineItemRow({ label, amount, muted, note }) {
  return (
    <div style={{ ...styles.lineItemRow, opacity: muted ? 0.55 : 1 }}>
      <span style={styles.lineItemLabel}>
        {label}
        {note ? <span style={styles.lineItemNote}> · {note}</span> : null}
      </span>
      <span style={{ ...styles.lineItemAmount, textDecoration: muted ? 'line-through' : 'none' }}>
        {formatMoney(amount)}
      </span>
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

function maxOrNull(arr) {
  const vals = (arr || []).filter(v => v != null && !Number.isNaN(v))
  if (!vals.length) return null
  return Math.max(...vals)
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
  envPanel: {
    background: 'white',
    border: `1px solid ${COLOR.line}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  envTitle: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 18,
    fontWeight: 700,
    color: COLOR.ink,
    marginTop: 2,
  },
  envSub: {
    fontSize: 12,
    color: COLOR.muted,
    marginTop: 3,
  },
  envLegend: {
    fontSize: 11,
    color: COLOR.faint,
    marginTop: 14,
    paddingTop: 12,
    borderTop: `1px solid ${COLOR.line}`,
    lineHeight: 1.5,
  },
  zone4: {
    background: 'white',
    border: `1px solid ${COLOR.line}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  accordionItem: {
    border: `1px solid ${COLOR.line}`,
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
    background: 'white',
  },
  accordionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '12px 14px',
    background: 'white',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: COLOR.ink,
  },
  chevron: {
    fontSize: 20,
    lineHeight: 1,
    color: COLOR.faint,
    transition: 'transform 0.15s',
    display: 'inline-block',
  },
  accordionBody: {
    padding: '12px 14px 14px',
    borderTop: `1px solid ${COLOR.line}`,
  },
  includedHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    fontSize: 14,
    fontWeight: 700,
    color: COLOR.ink,
    marginBottom: 12,
  },
  includedBadgeGood: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
    padding: '3px 8px', borderRadius: 10, background: '#dcfce7', color: COLOR.good,
  },
  includedBadgeWarn: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
    padding: '3px 8px', borderRadius: 10, background: '#fef3c7', color: COLOR.warn,
  },
  includedBadgeNeutral: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
    padding: '3px 8px', borderRadius: 10, background: COLOR.bgChip, color: COLOR.muted,
  },
  includedList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: 7,
  },
  includedItem: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    fontSize: 13, color: COLOR.ink, lineHeight: 1.45,
  },
  includedCheck: { color: COLOR.good, fontWeight: 700, flex: '0 0 auto' },
  includedNote: {
    fontSize: 12, color: COLOR.muted, marginTop: 12, lineHeight: 1.5, fontStyle: 'italic',
  },
  fitOk: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10,
    padding: '12px 14px', color: COLOR.good,
  },
  fitWarn: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
    padding: '12px 14px', color: COLOR.warn,
  },
  fitIcon: { fontSize: 18, fontWeight: 700, lineHeight: 1.3, flex: '0 0 auto' },
  fitTitle: { fontSize: 13.5, fontWeight: 700, color: COLOR.ink, marginBottom: 3 },
  fitBody: { fontSize: 12.5, color: COLOR.muted, lineHeight: 1.5 },
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
  selectedBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    background: COLOR.ink,
    color: 'white',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    padding: '4px 10px',
    borderRadius: 12,
  },
  zone5: {
    background: 'white',
    border: `1px solid ${COLOR.line}`,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  purchaseRowControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: COLOR.muted,
    width: 72,
  },
  segBtn: {
    background: 'white',
    border: `1px solid ${COLOR.line}`,
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    color: COLOR.muted,
    cursor: 'pointer',
  },
  segBtnActive: {
    background: COLOR.ink,
    borderColor: COLOR.ink,
    color: 'white',
    fontWeight: 600,
  },
  lineItemList: {
    borderTop: `1px solid ${COLOR.line}`,
    marginTop: 6,
  },
  lineItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: `1px solid ${COLOR.line}`,
    fontSize: 14,
  },
  lineItemLabel: { color: COLOR.ink },
  lineItemNote: { color: COLOR.warn, fontWeight: 600, fontSize: 12 },
  lineItemAmount: { color: COLOR.ink, fontWeight: 600 },
  purchaseTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '14px 0 4px',
  },
  purchaseTotalLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLOR.muted,
  },
  purchaseTotalValue: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 30,
    fontWeight: 700,
    color: COLOR.ink,
  },
  purchaseSaveRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  saveBtn: {
    background: COLOR.accent,
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
