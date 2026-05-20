import { useState } from 'react'
import { sendPatientMessage } from '../db.js'

// "Send Message" modal launched from the patient profile. Persists a message
// to the patient's Aided inbox AND (if they've enabled notifications) fires a
// Web Push with a deep-link back to the saved message. Delivery runs through
// db.js → sendPatientMessage → send-push edge function.
//
// Replaces the earlier "Notify Patient" modal — the inbox makes this a real
// messaging surface (longer bodies, persistent history, read receipts) rather
// than a fire-and-forget toast.

const C = {
  ink:    '#0a1628',
  muted:  '#6b7280',
  line:   '#e5e7eb',
  bgSoft: '#f9fafb',
  accent: '#1d4ed8',
}

const inputStyle = {
  width: '100%', padding: '8px 10px',
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

// Quick-fill templates. A preset also carries a `tag` so the service worker
// de-dupes repeat sends of the same category (see public/sw.js).
const PRESETS = [
  {
    label: 'Appointment reminder',
    tag: 'appointment',
    title: 'Appointment reminder',
    body: 'This is a friendly reminder about your upcoming appointment. Call the clinic if you need to reschedule.',
  },
  {
    label: 'Clean & check',
    tag: 'cleaning',
    title: 'Time for a Clean & Check',
    body: "It's been a while — bring your hearing aids in for a cleaning so they keep performing their best.",
  },
  {
    label: 'Checking in',
    tag: 'checkin',
    title: 'Checking in',
    body: 'How are your hearing aids working for you? Call the clinic if anything needs adjusting.',
  },
]

// Soft character cap — not enforced, just shown so providers know when the
// push preview will start truncating. Inbox body can be much longer.
const PUSH_PREVIEW_LIMIT = 140

export default function SendMessageModal({ patient, staffId, clinicId, onClose, onSent }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tag, setTag] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const clearStatus = () => { setError(null); setResult(null) }

  const applyPreset = (preset) => {
    setTitle(preset.title)
    setBody(preset.body)
    setTag(preset.tag)
    clearStatus()
  }

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    clearStatus()
    try {
      const res = await sendPatientMessage(patient.id, {
        title: title.trim(),
        body:  body.trim(),
        tag,
        staffId,
        clinicId,
      })
      setResult(res)
      onSent?.(res)
    } catch (e) {
      console.error('Send message:', e)
      setError(e?.message || String(e))
    } finally {
      setSending(false)
    }
  }

  const bodyOverLimit = body.length > PUSH_PREVIEW_LIMIT

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
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 26px', borderBottom: `1px solid ${C.line}`,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>Send Message</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {patient?.name} · Saved to their Aided inbox + push notification
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
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Quick fill</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESETS.map(preset => (
                <button
                  key={preset.tag}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 12px',
                    background: tag === preset.tag ? C.accent : 'white',
                    color: tag === preset.tag ? 'white' : C.accent,
                    border: `1px solid ${C.accent}`, borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >{preset.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); clearStatus() }}
              placeholder="e.g. Appointment reminder"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Message</label>
            <textarea
              value={body}
              onChange={e => { setBody(e.target.value); clearStatus() }}
              placeholder="What should the patient see? Longer notes, follow-ups, even the occasional lame joke."
              rows={6}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, minHeight: 130 }}
            />
            <div style={{
              fontSize: 11, color: bodyOverLimit ? '#b45309' : C.muted,
              marginTop: 4, display: 'flex', justifyContent: 'space-between',
            }}>
              <span>
                {bodyOverLimit
                  ? 'Push preview will be truncated — full message stays in their inbox.'
                  : 'Full message appears in their Aided inbox; push shows a preview.'}
              </span>
              <span>{body.length} chars</span>
            </div>
          </div>

          {result && (
            <div style={{
              marginTop: 14,
              background: result.pushSent > 0 ? '#f0fdf4' : C.bgSoft,
              color: result.pushSent > 0 ? '#15803d' : C.muted,
              border: `1px solid ${result.pushSent > 0 ? '#bbf7d0' : C.line}`,
              padding: '10px 14px', borderRadius: 6, fontSize: 13,
            }}>
              {result.pushSent > 0
                ? `Saved to inbox · pushed to ${result.pushSent} device${result.pushSent === 1 ? '' : 's'}.${result.pushFailed ? ` ${result.pushFailed} push failed.` : ''}`
                : 'Saved to inbox · push not sent (patient hasn’t enabled notifications yet).'}
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 14,
              background: '#fef2f2', color: '#991b1b',
              padding: '10px 14px', borderRadius: 6,
              fontSize: 13, border: '1px solid #fecaca',
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
              border: `1px solid ${C.line}`, borderRadius: 6, cursor: 'pointer',
            }}
          >{result ? 'Close' : 'Cancel'}</button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              padding: '9px 18px', fontSize: 13, fontWeight: 600,
              background: canSend ? C.accent : '#9ca3af',
              color: 'white', border: 'none', borderRadius: 6,
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
          >{sending ? 'Sending…' : 'Send Message'}</button>
        </div>
      </div>
    </div>
  )
}
