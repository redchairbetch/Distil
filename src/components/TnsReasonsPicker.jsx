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

import { useState } from 'react'
import { TNS_TAGS } from '../tns_tags.js'
import { saveTnsOutcome } from '../db.js'

// Tag-selection panel for capturing why a patient did not proceed at point of
// sale. Shared between the dashboard "Pending Follow-ups" widget and the
// patient-profile header so the picker UI stays consistent across surfaces.
//
// Props:
//   patientId   — required
//   patientName — shown in the prompt ("What kept Jane from moving forward?")
//   clinicId, staffId — passed through to saveTnsOutcome
//   onSaved(reasons, notes) — called after a successful insert
//   onCancel — optional; renders a Cancel button when provided
export default function TnsReasonsPicker({ patientId, patientName, clinicId, staffId, onSaved, onCancel }) {
  const [tags, setTags] = useState([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const toggle = (id) =>
    setTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  const save = async () => {
    if (tags.length === 0 || saving) return
    setSaving(true)
    try {
      await saveTnsOutcome(patientId, clinicId, staffId, tags, note)
      onSaved?.(tags, note)
      setTags([])
      setNote('')
    } catch (e) {
      console.error('TnsReasonsPicker save:', e)
      alert('Failed to save TNS reasons: ' + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  const firstName = patientName?.split(' ')[0] || 'this patient'

  return (
    <div style={{ background: '#fffbeb', padding: '16px 20px', borderRadius: 8, border: '1px solid #fde68a' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 12 }}>
        What kept {firstName} from moving forward? Select all that apply.
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 8, marginBottom: 12,
      }}>
        {TNS_TAGS.map(tag => {
          const selected = tags.includes(tag.id)
          return (
            <button
              key={tag.id}
              onClick={() => toggle(tag.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: selected ? '#fef3c7' : 'white',
                border: `1.5px solid ${selected ? '#f59e0b' : '#fde68a'}`,
                borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: selected ? 600 : 500,
                color: selected ? '#92400e' : '#374151',
                textAlign: 'left', transition: 'all 0.12s',
              }}
            >
              <span style={{ fontSize: 18 }}>{tag.emoji}</span>
              {tag.label}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          placeholder={"Optional note — e.g. 'Husband skeptical, follow up in 2 weeks'"}
          value={note}
          onChange={e => setNote(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px',
            border: '1.5px solid #fde68a', borderRadius: 8,
            fontSize: 13, color: '#374151', boxSizing: 'border-box',
          }}
        />
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              fontSize: 13, padding: '8px 18px',
              background: 'white', border: '1.5px solid #d1d5db',
              borderRadius: 8, color: '#6b7280', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={save}
          disabled={tags.length === 0 || saving}
          style={{
            fontSize: 13, padding: '8px 18px',
            opacity: tags.length === 0 || saving ? 0.5 : 1,
            cursor: tags.length === 0 || saving ? 'not-allowed' : 'pointer',
            background: '#15803d', color: 'white',
            border: 'none', borderRadius: 8, fontWeight: 600,
          }}
        >
          {saving ? 'Saving…' : `Save${tags.length > 0 ? ` (${tags.length})` : ''}`}
        </button>
      </div>
    </div>
  )
}
