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

import { COLOR, FONT } from '../theme.js'
import { REFERRAL_REASONS, REFERRAL_TYPES } from '../lib/medicalReferral.js'

// Red-flag referral capture — the shared panel behind every medical-referral
// surface (Close Appointment modal + the UpgradeWizard's Exam Results fork).
// What's checked here feeds the medical_referrals row and prints verbatim on
// the referral document the patient takes to their medical appointment, so
// the vocabulary must stay identical everywhere it's captured.
//
// Controlled: value = { reasons: [], referralType, referredTo, notes },
// onChange(nextValue). Validation stays with the caller (validateReferral)
// so each surface gates its own save button.

const label = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: COLOR.ink3, marginBottom: 8, fontFamily: FONT.ui,
}

export default function ReferralCapture({ value, onChange, hint }) {
  const patch = (fields) => onChange({ ...value, ...fields })
  const toggleReason = (key) =>
    patch({ reasons: value.reasons.includes(key) ? value.reasons.filter(k => k !== key) : [...value.reasons, key] })

  return (
    <div style={{ background: COLOR.paper, borderRadius: 10, padding: '14px 16px', border: `1.5px solid ${COLOR.teal}` }}>
      <span style={label}>Reason(s) for referral</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {REFERRAL_REASONS.map(r => {
          const checked = value.reasons.includes(r.key)
          return (
            <label key={r.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
              fontSize: 12.5, color: COLOR.ink2, fontFamily: FONT.ui, padding: '3px 2px',
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleReason(r.key)}
                style={{ marginTop: 2, accentColor: COLOR.pine }}
              />
              <span style={{ fontWeight: checked ? 600 : 400, color: checked ? COLOR.ink : COLOR.ink2 }}>{r.label}</span>
            </label>
          )
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <span style={{ ...label, marginBottom: 6 }}>Referring to</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {REFERRAL_TYPES.map(t => {
            const selected = value.referralType === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => patch({ referralType: t.key })}
                aria-pressed={selected}
                style={{
                  padding: '7px 12px', fontSize: 12.5, fontWeight: 600,
                  fontFamily: FONT.ui, cursor: 'pointer', borderRadius: 999,
                  background: selected ? COLOR.pine : 'white',
                  color: selected ? 'white' : COLOR.ink2,
                  border: `1.5px solid ${selected ? COLOR.pine : COLOR.line}`,
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
              >{t.label}</button>
            )
          })}
        </div>
        <input
          type="text"
          value={value.referredTo}
          onChange={e => patch({ referredTo: e.target.value })}
          placeholder="Practice or physician name (optional)"
          style={{
            marginTop: 8, width: '100%', boxSizing: 'border-box', padding: '8px 10px',
            fontSize: 12.5, fontFamily: FONT.ui, borderRadius: 8,
            border: `1.5px solid ${COLOR.line}`, color: COLOR.ink,
          }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <span style={{ ...label, marginBottom: 6 }}>Notes for the medical provider</span>
        <textarea
          value={value.notes}
          onChange={e => patch({ notes: e.target.value })}
          rows={2}
          placeholder={value.reasons.includes('other_medical_concern')
            ? 'Describe the medical concern (required)'
            : 'Optional — prints on the referral document'}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 10px',
            fontSize: 12.5, fontFamily: FONT.ui, borderRadius: 8,
            border: `1.5px solid ${COLOR.line}`, color: COLOR.ink, resize: 'vertical',
          }}
        />
      </div>

      {hint && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: COLOR.ink3, fontFamily: FONT.ui }}>
          {hint}
        </div>
      )}
    </div>
  )
}
