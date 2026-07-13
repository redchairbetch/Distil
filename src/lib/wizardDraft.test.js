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
import { stashWizardDraft, readWizardDraft, clearWizardDraft, WIZARD_DRAFT_TTL_MS } from './wizardDraft.js'

// Minimal localStorage stand-in — the module takes storage as a parameter so
// tests run in plain node without jsdom.
function fakeStorage() {
  const m = new Map()
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    get size() { return m.size },
  }
}

const OWNER = { clinicId: 'clinic-1', staffId: 'staff-1' }
const DRAFT = {
  ...OWNER,
  form: { firstName: 'Jane', lastName: 'Doe', payType: 'insurance' },
  step: 4,
  wizardPatientId: 'pat-1',
  wizardVisitId: 'vis-1',
  wizardMode: 'new',
}

describe('wizardDraft stash/read round-trip', () => {
  it('returns what was stashed, stamped with savedAt', () => {
    const s = fakeStorage()
    stashWizardDraft(DRAFT, s)
    const d = readWizardDraft(OWNER, s)
    expect(d.form.firstName).toBe('Jane')
    expect(d.step).toBe(4)
    expect(d.wizardPatientId).toBe('pat-1')
    expect(d.wizardVisitId).toBe('vis-1')
    expect(typeof d.savedAt).toBe('number')
  })

  it('returns null when nothing is stashed', () => {
    expect(readWizardDraft(OWNER, fakeStorage())).toBeNull()
  })
})

describe('ownership scoping', () => {
  it('hides a draft stashed under another clinic but leaves it stored', () => {
    const s = fakeStorage()
    stashWizardDraft(DRAFT, s)
    expect(readWizardDraft({ clinicId: 'clinic-2', staffId: 'staff-1' }, s)).toBeNull()
    // still resumable after switching back to the owning clinic
    expect(readWizardDraft(OWNER, s)).not.toBeNull()
  })

  it('hides a draft stashed by another provider', () => {
    const s = fakeStorage()
    stashWizardDraft(DRAFT, s)
    expect(readWizardDraft({ clinicId: 'clinic-1', staffId: 'staff-2' }, s)).toBeNull()
    expect(readWizardDraft(OWNER, s)).not.toBeNull()
  })
})

describe('expiry', () => {
  it('returns a draft younger than the TTL', () => {
    const s = fakeStorage()
    stashWizardDraft(DRAFT, s)
    expect(readWizardDraft(OWNER, s, Date.now() + WIZARD_DRAFT_TTL_MS - 60000)).not.toBeNull()
  })

  it('clears and hides a draft older than the TTL', () => {
    const s = fakeStorage()
    stashWizardDraft(DRAFT, s)
    expect(readWizardDraft(OWNER, s, Date.now() + WIZARD_DRAFT_TTL_MS + 1)).toBeNull()
    expect(s.size).toBe(0)
  })
})

describe('bad data hygiene', () => {
  it('clears unparseable JSON and returns null', () => {
    const s = fakeStorage()
    s.setItem('distil_wizard_draft', '{not json')
    expect(readWizardDraft(OWNER, s)).toBeNull()
    expect(s.size).toBe(0)
  })

  it('clears a draft from a different schema version', () => {
    const s = fakeStorage()
    s.setItem('distil_wizard_draft', JSON.stringify({ ...DRAFT, v: 999, savedAt: Date.now() }))
    expect(readWizardDraft(OWNER, s)).toBeNull()
    expect(s.size).toBe(0)
  })

  it('clearWizardDraft removes the entry', () => {
    const s = fakeStorage()
    stashWizardDraft(DRAFT, s)
    clearWizardDraft(s)
    expect(readWizardDraft(OWNER, s)).toBeNull()
  })
})
