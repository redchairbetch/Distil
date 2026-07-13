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

// In-progress wizard appointment drafts. The new-patient/upgrade wizard keeps
// its session (form, step, wizardPatientId/VisitId, mode) in React state only,
// so navigating away or refreshing mid-visit used to lose everything not yet
// incrementally saved. While the provider is in the wizard, the session
// snapshots here so the dashboard can offer a Resume path.
//
// localStorage rather than Supabase for the same reason as the kiosk intake
// draft (PR #119) and the pending-outcome stash: this is device-local UI
// residue — everything durable already writes incrementally to the DB (draft
// patient at step 0, audiogram at step 2, devices at step 5). Drafts expire
// after WIZARD_DRAFT_TTL_MS and are cleared on close/discard so patient data
// doesn't sit on the machine indefinitely.

const KEY = 'distil_wizard_draft'
const VERSION = 1

// Roughly a clinic day. Older than this, resuming mid-appointment would be
// clinically stale anyway; it also bounds how long the snapshot's patient
// data lives on the device.
export const WIZARD_DRAFT_TTL_MS = 12 * 60 * 60 * 1000

// Storage is injectable so the pure logic is unit-testable outside a browser.
const defaultStorage = () => {
  try { return globalThis.localStorage } catch { return null }
}

export function stashWizardDraft(draft, storage = defaultStorage()) {
  if (!storage) return
  try {
    storage.setItem(KEY, JSON.stringify({ ...draft, v: VERSION, savedAt: Date.now() }))
  } catch { /* full/blocked storage — persistence is best-effort */ }
}

// Returns the stashed draft only when it belongs to this provider at this
// clinic and hasn't expired. Expired or unreadable drafts are cleared; a
// draft owned by a different clinic/provider is left alone (switching back
// to that clinic should still be able to resume it) but never returned.
export function readWizardDraft({ clinicId, staffId }, storage = defaultStorage(), now = Date.now()) {
  if (!storage) return null
  let d = null
  try { d = JSON.parse(storage.getItem(KEY)) } catch { clearWizardDraft(storage); return null }
  if (!d || typeof d !== 'object') return null
  if (d.v !== VERSION) { clearWizardDraft(storage); return null }
  if (!d.savedAt || now - d.savedAt > WIZARD_DRAFT_TTL_MS) { clearWizardDraft(storage); return null }
  if (d.clinicId !== clinicId || d.staffId !== staffId) return null
  return d
}

export function clearWizardDraft(storage = defaultStorage()) {
  if (!storage) return
  try { storage.removeItem(KEY) } catch { /* ignore */ }
}
