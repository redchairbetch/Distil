import { useState } from 'react'
import { COLOR, FONT } from '../theme.js'
import { OUTCOME_REASON_REQUIRED, OUTCOME_REASONS } from '../db.js'

// Close Appointment disposition modal — the required final step of every
// visit. Captures the two-layer outcome (device / care plan) that feeds the
// appointment_outcomes table. Deliberately fast: everything the flow already
// knows (context, signed PA, chosen care plan) arrives pre-selected, so the
// common path is confirm-and-save. There is no backdrop-dismiss or × — the
// only ways out are saving a complete disposition or explicitly going back,
// which leaves the appointment open (nothing is written, the wizard/profile
// is exactly as it was). An accidental open must never force a fabricated
// outcome row into the baseline data.
//
// Labels are provider-facing and deliberately neutral — a provider should
// never hesitate to pick the accurate code because it reads badly on a
// dashboard.

export const CONTEXT_OPTIONS = [
  { id: 'new_fit',        label: 'New fitting' },
  { id: 'upgrade',        label: 'Upgrade' },
  { id: 'care_plan_only', label: 'Care plan only' },
]

export const DISPOSITION_OPTIONS = [
  { id: 'committed',       label: 'Committed today' },
  { id: 'deferred',        label: 'Decision pending' },
  { id: 'declined',        label: 'Not proceeding' },
  { id: 'no_decision',     label: 'No decision this visit' },
  { id: 'not_a_candidate', label: 'Not a candidate' },
  { id: 'not_applicable',  label: 'Not applicable' },
]

export const REASON_OPTIONS = [
  { id: 'price_budget',                   label: 'Budget / price' },
  { id: 'spouse_family_consult',          label: 'Consulting spouse or family' },
  { id: 'wants_to_think',                 label: 'Wants time to think it over' },
  { id: 'no_perceived_need',              label: 'Not feeling the need yet' },
  { id: 'shopping_second_opinion',        label: 'Comparing options / second opinion' },
  { id: 'insurance_benefit_issue',        label: 'Insurance benefit question' },
  { id: 'health_life_circumstances',      label: 'Health or life circumstances' },
  { id: 'satisfied_with_current_devices', label: 'Happy with current devices' },
]

// App-internal care plan vocabulary (see wizard CARE_PLAN_OPTIONS).
export const CARE_PLAN_CHOICES = [
  { id: 'complete', label: 'Complete Care+' },
  { id: 'punch',    label: 'MHC Punch Card' },
  { id: 'paygo',    label: 'Standard Billing' },
]

// ── Pending-outcome store ────────────────────────────────────────────────────
// If the patient was finalized but the outcome insert failed, the payload is
// stashed here so the profile can nag until it's logged. localStorage rather
// than Supabase because the most likely cause of a failed insert is the DB
// being unreachable — a DB-backed marker would fail with it.
const pendingKey = patientId => `distil_pending_outcome_${patientId}`

export function stashPendingOutcome(patientId, outcome) {
  try { localStorage.setItem(pendingKey(patientId), JSON.stringify(outcome)) } catch { /* full/blocked storage — nag is best-effort */ }
}
export function readPendingOutcome(patientId) {
  try {
    const raw = localStorage.getItem(pendingKey(patientId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
export function clearPendingOutcome(patientId) {
  try { localStorage.removeItem(pendingKey(patientId)) } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────

const label = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: COLOR.ink3, marginBottom: 8, fontFamily: FONT.ui,
}

function PillRow({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const selected = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={selected}
            style={{
              padding: '7px 12px', fontSize: 12.5, fontWeight: 600,
              fontFamily: FONT.ui, cursor: 'pointer', borderRadius: 999,
              background: selected ? COLOR.pine : 'white',
              color: selected ? 'white' : COLOR.ink2,
              border: `1.5px solid ${selected ? COLOR.pine : COLOR.line}`,
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
          >{opt.label}</button>
        )
      })}
    </div>
  )
}

function ReasonPicker({ value, onChange }) {
  return (
    <div style={{ marginTop: 10 }}>
      <span style={{ ...label, marginBottom: 6 }}>Reason</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {REASON_OPTIONS.map(r => {
          const selected = value === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange(r.id)}
              aria-pressed={selected}
              style={{
                padding: '6px 10px', fontSize: 12, fontWeight: 500,
                fontFamily: FONT.ui, cursor: 'pointer', borderRadius: 8,
                background: selected ? COLOR.tealSoft : 'white',
                color: selected ? COLOR.tealInk : COLOR.ink2,
                border: `1.5px solid ${selected ? COLOR.teal : COLOR.line}`,
              }}
            >{r.label}</button>
          )
        })}
      </div>
    </div>
  )
}

// props:
//   patientName        — header context
//   payerLabel         — payer snapshot summary chip (e.g. "TruHearing · Premium")
//   defaultContext     — 'new_fit' | 'upgrade' | 'care_plan_only'
//   defaultDevice / defaultDeviceReason / defaultCarePlan / defaultCarePlanReason /
//   defaultCarePlanSelected — prefills (from wizard state or a stashed pending outcome)
//   onSubmit(fields)   — async; parent finalizes/inserts. Rejections surface in the modal.
//   onCancel()         — go back WITHOUT closing the appointment (nothing written)
export default function CloseAppointmentModal({
  patientName,
  payerLabel,
  defaultContext = 'new_fit',
  defaultDevice = null,
  defaultDeviceReason = null,
  defaultCarePlan = null,
  defaultCarePlanReason = null,
  defaultCarePlanSelected = null,
  onSubmit,
  onCancel,
}) {
  const [context, setContext] = useState(defaultContext)
  const [device, setDevice] = useState(defaultDevice)
  const [deviceReason, setDeviceReason] = useState(defaultDeviceReason)
  const [carePlan, setCarePlan] = useState(defaultCarePlan)
  const [carePlanReason, setCarePlanReason] = useState(defaultCarePlanReason)
  const [carePlanSelected, setCarePlanSelected] = useState(defaultCarePlanSelected)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const setDeviceDisposition = (id) => {
    setDevice(id)
    // Medical referral out (etc.) means there was no care plan decision to
    // make — auto-set that layer, but leave it editable.
    if (id === 'not_a_candidate') {
      setCarePlan('not_applicable')
      setCarePlanSelected(null)
    }
  }

  const setContextSafe = (id) => {
    setContext(id)
    // A care-plan-only visit has no device decision in it.
    if (id === 'care_plan_only' && device == null) setDevice('not_applicable')
  }

  // Mirrors validateAppointmentOutcome's disposition rules so the button can
  // gate before the parent composes the full payload.
  const problem = (() => {
    if (!device) return 'Select a device outcome.'
    if (!carePlan) return 'Select a care plan outcome.'
    if (OUTCOME_REASON_REQUIRED.includes(device) && !OUTCOME_REASONS.includes(deviceReason || '')) return 'Select a reason for the device outcome.'
    if (OUTCOME_REASON_REQUIRED.includes(carePlan) && !OUTCOME_REASONS.includes(carePlanReason || '')) return 'Select a reason for the care plan outcome.'
    if (carePlan === 'committed' && !carePlanSelected) return 'Select which care plan was chosen.'
    if (device === 'not_applicable' && carePlan === 'not_applicable') return 'Device and care plan cannot both be "not applicable".'
    return null
  })()

  const handleSave = async () => {
    if (problem || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        context,
        deviceDisposition: device,
        deviceReason: OUTCOME_REASON_REQUIRED.includes(device) ? deviceReason : null,
        carePlanDisposition: carePlan,
        carePlanReason: OUTCOME_REASON_REQUIRED.includes(carePlan) ? carePlanReason : null,
        carePlanSelected: carePlan === 'committed' ? carePlanSelected : null,
      })
      // Parent unmounts the modal on success — no local state to reset.
    } catch (e) {
      setError(e?.message || 'Could not save the outcome — try again.')
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10, 22, 40, 0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 30, zIndex: 1100, overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: 'white', borderRadius: 12,
          maxWidth: 680, width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          fontFamily: FONT.ui,
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 26px', borderBottom: `1px solid ${COLOR.line}` }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: COLOR.ink }}>Close Appointment</div>
          <div style={{ fontSize: 12.5, color: COLOR.ink2, marginTop: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{patientName}</span>
            {payerLabel && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                background: COLOR.tealSoft, color: COLOR.tealInk,
              }}>{payerLabel}</span>
            )}
          </div>
        </div>

        <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Context */}
          <div>
            <span style={label}>This visit was</span>
            <PillRow options={CONTEXT_OPTIONS} value={context} onChange={setContextSafe} />
          </div>

          {/* Device layer */}
          <div style={{ background: COLOR.paper, borderRadius: 10, padding: '14px 16px' }}>
            <span style={label}>Devices</span>
            <PillRow options={DISPOSITION_OPTIONS} value={device} onChange={setDeviceDisposition} />
            {OUTCOME_REASON_REQUIRED.includes(device) && (
              <ReasonPicker value={deviceReason} onChange={setDeviceReason} />
            )}
          </div>

          {/* Care plan layer */}
          <div style={{ background: COLOR.paper, borderRadius: 10, padding: '14px 16px' }}>
            <span style={label}>Care plan</span>
            <PillRow options={DISPOSITION_OPTIONS} value={carePlan} onChange={setCarePlan} />
            {carePlan === 'committed' && (
              <div style={{ marginTop: 10 }}>
                <span style={{ ...label, marginBottom: 6 }}>Plan chosen</span>
                <PillRow options={CARE_PLAN_CHOICES} value={carePlanSelected} onChange={setCarePlanSelected} />
              </div>
            )}
            {OUTCOME_REASON_REQUIRED.includes(carePlan) && (
              <ReasonPicker value={carePlanReason} onChange={setCarePlanReason} />
            )}
          </div>

          {error && (
            <div style={{
              background: COLOR.dangerSoft, color: COLOR.dangerInk,
              borderRadius: 8, padding: '10px 14px', fontSize: 13,
            }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 26px', borderTop: `1px solid ${COLOR.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12.5, color: COLOR.ink3, fontFamily: FONT.ui,
                textDecoration: 'underline', padding: 4,
              }}
            >Go back — don't close yet</button>
          ) : <span />}
          <button
            type="button"
            onClick={handleSave}
            disabled={!!problem || saving}
            title={problem || undefined}
            style={{
              padding: '11px 22px', fontSize: 14, fontWeight: 700,
              fontFamily: FONT.ui, borderRadius: 8,
              background: (!problem && !saving) ? COLOR.pine : COLOR.line,
              color: (!problem && !saving) ? 'white' : COLOR.ink3,
              border: 'none', cursor: (!problem && !saving) ? 'pointer' : 'not-allowed',
            }}
          >{saving ? 'Saving…' : '✓ Close Appointment'}</button>
        </div>
      </div>
    </div>
  )
}
