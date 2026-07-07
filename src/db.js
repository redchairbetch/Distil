// ============================================================
// db.js — Supabase data layer for Distil CRM
// Replaces all window.storage calls with Supabase queries.
// All functions maintain the same shape the UI already expects
// so Distil.jsx needs minimal changes.
// ============================================================

import { supabase } from './supabase.js'
import { CONTENT_LIBRARY, CAMPAIGN_TIMELINE } from './nurture_seed_data.js'
import { runRecommendationEngine } from './recommendationEngine.js'
import { LEGACY_DEVICES_DEFAULT } from './legacyDevices.js'
import { messagePreview } from './lib/comms.js'


// ============================================================
// AUTH
// ============================================================

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getCurrentStaff() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('staff')
    // clinics!staff_clinic_id_fkey: staff_clinics is a join table between
    // staff and clinics, so a bare clinics(*) embed is ambiguous (PGRST201).
    .select('*, clinics!staff_clinic_id_fkey(*), staff_clinics(clinic_id, clinics(id, name, clinic_code))')
    .eq('id', user.id)
    .single()
  if (error) return null
  return data
}

// Clinics the logged-in user is assigned to (drives the clinic switcher).
// Returns [{ id, name, clinic_code }] sorted by name.
export async function loadMyClinics() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('staff_clinics')
    .select('clinic_id, clinics(id, name, clinic_code)')
    .eq('staff_id', user.id)
  if (error) { console.error('loadMyClinics:', error); return [] }
  return (data || [])
    .map(r => r.clinics)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Switch the active clinic. RLS (via my_clinic_id) only honors clinics
// present in staff_clinics, so a bad id silently falls back to home clinic.
export async function setActiveClinic(clinicId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await supabase
    .from('staff')
    .update({ active_clinic_id: clinicId })
    .eq('id', user.id)
  if (error) throw error
}

// Subscribe to auth state changes (call in App useEffect)
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}


// ============================================================
// STAFF PROFILE (for purchase agreements, provider info)
// ============================================================

/**
 * Load full staff profile including clinic details and licenses.
 * Returns: { id, full_name, role, licenses, signature_url, clinic }
 * where clinic = { id, name, address, phone }
 */
export async function loadStaffProfile(staffId) {
  const { data, error } = await supabase
    .from('staff')
    .select('id, full_name, role, licenses, signature_url, clinics!staff_clinic_id_fkey(id, name, address, phone)')
    .eq('id', staffId)
    .single()
  if (error || !data) return null

  // Parse state from clinic address (e.g. "1234 N Hearing Ave, St. George, UT 84770" → "UT")
  const addrParts = (data.clinics?.address || '').split(',').map(s => s.trim())
  const stateZip = addrParts[addrParts.length - 1] || ''
  const stateMatch = stateZip.match(/\b([A-Z]{2})\b/)
  const clinicState = stateMatch ? stateMatch[1] : null

  // Pick the license that matches the clinic's state
  const licenses = data.licenses || {}
  const activeLicense = clinicState && licenses[clinicState] ? licenses[clinicState] : Object.values(licenses)[0] || ''

  return {
    id: data.id,
    fullName: data.full_name,
    role: data.role,
    licenses,
    activeLicense,
    clinicState,
    signatureUrl: data.signature_url,
    clinic: data.clinics
  }
}

/**
 * Update provider signature URL after uploading to Supabase Storage
 */
export async function updateStaffSignature(staffId, signatureUrl) {
  const { error } = await supabase
    .from('staff')
    .update({ signature_url: signatureUrl })
    .eq('id', staffId)
  if (error) throw error
}

/**
 * Upload a signature image to Supabase Storage and return the public URL.
 * Expects a File or Blob object.
 */
export async function uploadSignatureImage(staffId, file) {
  const filePath = `signatures/${staffId}.png`
  const { error: uploadError } = await supabase.storage
    .from('provider-assets')
    .upload(filePath, file, { upsert: true, contentType: 'image/png' })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('provider-assets').getPublicUrl(filePath)
  return data.publicUrl
}


// ============================================================
// PATIENT DOCUMENTS (PDF archive)
// ============================================================
// Quote, purchase agreement, and kiosk intake PDFs are uploaded to the
// private 'patient-documents' bucket and indexed in the patient_documents
// table. Path layout:
//   clinics/{clinic_id}/patients/{patient_id}/{kind}/{ts}_{name}.pdf  (provider)
//   clinics/{clinic_id}/intakes/{intake_id}/{ts}_{name}.pdf            (kiosk)
// Storage RLS keys off the first two segments (clinics/{clinic_id});
// the third segment distinguishes provider vs kiosk origin.

const DOCUMENTS_BUCKET = 'patient-documents'

// Strip path-unsafe characters from a filename so storage keys stay clean.
function sanitizeFileName(name) {
  return String(name || 'document')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

/**
 * Archive a PDF to the patient's chart.
 * - Provider-side: pass patientId + staffId + clinicId.
 * - Kiosk-side: pass intakeId + clinicId + returnRow:false; patientId/staffId
 *   are null until the intake is matched to a patient.
 *
 * Args:
 *   blob       — Blob with type 'application/pdf'
 *   fileName   — display name (e.g. "Purchase_Agreement_Smith_Jane_2026-04-29.pdf")
 *   kind       — 'quote' | 'purchase_agreement' | 'kiosk_intake'
 *   metadata   — jsonb snapshot for audit trail (devices, totals, etc.)
 *   returnRow  — when true (default) issue INSERT...RETURNING and return the
 *                row; when false, plain INSERT and return null. Anon kiosk
 *                callers must pass false: RETURNING triggers a SELECT RLS
 *                check and anon has no SELECT policy on patient_documents,
 *                same as the submitIntake workaround.
 *
 * Returns the inserted patient_documents row, or null when returnRow=false.
 */
export async function uploadPatientDocument({
  patientId = null,
  clinicId,
  staffId = null,
  intakeId = null,
  kind,
  blob,
  fileName,
  metadata = {},
  returnRow = true,
}) {
  if (!clinicId) throw new Error('uploadPatientDocument: clinicId is required')
  if (!blob) throw new Error('uploadPatientDocument: blob is required')
  if (!['quote', 'purchase_agreement', 'kiosk_intake'].includes(kind)) {
    throw new Error(`uploadPatientDocument: invalid kind "${kind}"`)
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const cleanName = sanitizeFileName(fileName || `${kind}.pdf`)

  let storagePath
  if (kind === 'kiosk_intake') {
    if (!intakeId) throw new Error('uploadPatientDocument: intakeId required for kiosk_intake')
    storagePath = `clinics/${clinicId}/intakes/${intakeId}/${ts}_${cleanName}`
  } else {
    if (!patientId) throw new Error('uploadPatientDocument: patientId required for provider docs')
    storagePath = `clinics/${clinicId}/patients/${patientId}/${kind}/${ts}_${cleanName}`
  }

  // Use the blob's declared MIME type when available so HTML kiosk intakes
  // are served as text/html (renders inline in a browser tab) instead of
  // being mis-labeled as PDF (which makes the browser try to download them).
  const contentType = blob.type || 'application/pdf'
  const { error: uploadErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, blob, { contentType, upsert: false })
  if (uploadErr) throw uploadErr

  const insertBuilder = supabase
    .from('patient_documents')
    .insert({
      patient_id:   patientId,
      clinic_id:    clinicId,
      staff_id:     staffId,
      intake_id:    intakeId,
      kind,
      storage_path: storagePath,
      file_name:    cleanName,
      byte_size:    blob.size ?? null,
      metadata,
    })
  const { data, error: insertErr } = returnRow
    ? await insertBuilder.select('*').single()
    : await insertBuilder

  if (insertErr) {
    // Best-effort cleanup of the orphaned object so a retry doesn't collide
    // on the unique storage_path constraint. Anon role has no DELETE policy
    // so the cleanup silently no-ops on the kiosk path; orphans need a
    // separate sweep job (see backlog).
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]).catch(() => {})
    throw insertErr
  }

  return data ?? null
}

/**
 * List archived documents for a patient, newest first. Each row is
 * augmented with a short-lived signedUrl for direct download.
 */
export async function listPatientDocuments(patientId, { signedUrlSeconds = 3600 } = {}) {
  if (!patientId) return []
  const { data, error } = await supabase
    .from('patient_documents')
    .select('id, kind, file_name, byte_size, metadata, storage_path, created_at, staff_id')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!data?.length) return []

  // Batch-sign URLs in one round-trip.
  const { data: signed, error: signErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrls(data.map(d => d.storage_path), signedUrlSeconds)
  if (signErr) throw signErr

  const urlByPath = new Map((signed || []).map(s => [s.path, s.signedUrl]))
  const signedUrlAt = Date.now()
  return data.map(row => ({
    ...row,
    signedUrl: urlByPath.get(row.storage_path) || null,
    signedUrlAt,
  }))
}

/**
 * Get a fresh signed URL for a single document (e.g. when the cached
 * URL on a list row has expired).
 */
export async function getDocumentSignedUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data?.signedUrl || null
}


// ============================================================
// PUSH NOTIFICATIONS
// ============================================================

/**
 * Send a Web Push notification to every active subscription the patient has
 * registered from the Aided app. Routes through the `send-push` edge
 * function, which holds the VAPID private key and does the payload
 * encryption. The provider's session token is forwarded so the edge function
 * can confirm a real authenticated caller (it rejects the bare anon key).
 *
 * Returns { ok, sent, failed }. `sent: 0` means the patient has no active
 * subscription yet (hasn't enabled notifications in Aided).
 */
export async function sendPushNotification(patientId, { title, body, url = '/aided', tag = null }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ patient_id: patientId, title, body, url, tag }),
  })

  const result = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(result.error || 'Failed to send notification')
  return result
}


// ============================================================
// PATIENT MESSAGES (Inbox)
// ============================================================

// Truncate notification preview to fit the OS notification surface — the
// full body lives in the inbox, not the toast. Lives in lib/comms.js
// (tested) and is shared with the dashboard inbox list.
const previewForPush = messagePreview

/**
 * Send a longer-form message to a patient. Persists to patient_messages so
 * it shows up in their Aided inbox, then (optionally) fires a Web Push
 * notification with a deep-link back to the saved message.
 *
 * Returns { messageId, pushSent, pushFailed }. pushSent === 0 means the
 * patient hasn't enabled notifications yet (the message is still in the
 * inbox, they'll see it next time they open Aided).
 */
export async function sendPatientMessage(patientId, {
  title, body, tag = null, staffId, clinicId, firePush = true,
}) {
  if (!patientId) throw new Error('patientId required')
  if (!title?.trim() || !body?.trim()) throw new Error('title and body required')
  if (!staffId || !clinicId) throw new Error('staffId and clinicId required')

  // 1. Insert the message — push_url is filled in once we know the id.
  const { data: row, error: insertErr } = await supabase
    .from('patient_messages')
    .insert({
      patient_id:      patientId,
      clinic_id:       clinicId,
      sender_role:     'clinic',
      sender_staff_id: staffId,
      title:           title.trim(),
      body:            body.trim(),
      tag:             tag || null,
    })
    .select('id')
    .single()
  if (insertErr) throw insertErr

  const messageId = row.id
  const pushUrl = `/aided?tab=inbox&msg=${messageId}`

  // 2. Save the deep-link on the row so future re-sends or audits have it.
  await supabase
    .from('patient_messages')
    .update({ push_url: pushUrl })
    .eq('id', messageId)

  // 3. Fire the push (optional). The push payload carries a preview, not the
  //    full body — the inbox is the canonical place to read it.
  let pushSent = 0
  let pushFailed = 0
  if (firePush) {
    try {
      const result = await sendPushNotification(patientId, {
        title:  title.trim(),
        body:   previewForPush(body),
        url:    pushUrl,
        tag,
      })
      pushSent = result?.sent || 0
      pushFailed = result?.failed || 0
      if (pushSent > 0) {
        await supabase
          .from('patient_messages')
          .update({
            push_fired_at:   new Date().toISOString(),
            push_sent_count: pushSent,
          })
          .eq('id', messageId)
      }
    } catch (e) {
      // Push failed but inbox row is saved — surface the error so the UI can
      // distinguish "saved + push failed" from "fully saved + sent".
      console.warn('sendPatientMessage: push delivery failed', e)
      pushFailed = 1
    }
  }

  return { messageId, pushSent, pushFailed }
}

/**
 * Distil-side history list — every message sent to this patient, newest first.
 * Includes read state and sender so the patient profile can show "Read MM/DD"
 * vs. "Unread" next to each entry.
 */
export async function listMessagesForPatient(patientId) {
  const { data, error } = await supabase
    .from('patient_messages')
    .select('id, title, body, tag, sender_role, sender_staff_id, channel, email_from, push_fired_at, push_sent_count, read_at, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Aided-side inbox list — same rows, but only the fields the patient app
 * actually needs. Anon-readable thanks to the "Anon read messages" policy.
 */
export async function listInboxMessages(patientId) {
  const { data, error } = await supabase
    .from('patient_messages')
    .select('id, title, body, tag, sender_role, read_at, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Idempotent flip of read_at -> now() via the mark_message_read RPC.
 * Anon-callable (SECURITY DEFINER) — see migration 014.
 */
export async function markMessageRead(messageId) {
  if (!messageId) return
  const { error } = await supabase.rpc('mark_message_read', { p_message_id: messageId })
  if (error) throw error
}

/**
 * Count of unread messages for the inbox nav badge in Aided. Anon-readable.
 * Clinic-sent rows only — on patient-sent rows read_at means "the clinic
 * handled it", so counting those would inflate the patient's badge with
 * their own replies.
 */
export async function countUnreadMessages(patientId) {
  const { count, error } = await supabase
    .from('patient_messages')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('sender_role', 'clinic')
    .is('read_at', null)
  if (error) throw error
  return count || 0
}

/**
 * Patient reply from Aided. Runs through the send_patient_reply RPC
 * (SECURITY DEFINER) — anon can't insert into patient_messages directly, and
 * the RPC derives clinic_id from the patient row server-side. Returns the new
 * message id.
 */
export async function sendPatientReply(patientId, body) {
  if (!patientId) throw new Error('patientId required')
  if (!body?.trim()) throw new Error('message body required')
  const { data, error } = await supabase.rpc('send_patient_reply', {
    p_patient_id: patientId,
    p_body: body.trim(),
  })
  if (error) throw error
  return data
}

/**
 * Provider-side clinic inbox — messages patients sent us (Aided replies now,
 * ingested email replies later), newest first, with the patient's name
 * embedded for the dashboard list.
 */
export async function listClinicInbox(clinicId, { limit = 25 } = {}) {
  if (!clinicId) return []
  const { data, error } = await supabase
    .from('patient_messages')
    .select('id, patient_id, body, channel, email_from, read_at, created_at, patient:patients(id, first_name, last_name)')
    .eq('clinic_id', clinicId)
    .eq('sender_role', 'patient')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

/**
 * Unread patient-sent messages for the dashboard badge — "how many patients
 * are waiting on a response". Served by the partial index from migration
 * 20260705120000.
 */
export async function countClinicUnread(clinicId) {
  if (!clinicId) return 0
  const { count, error } = await supabase
    .from('patient_messages')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('sender_role', 'patient')
    .is('read_at', null)
  if (error) throw error
  return count || 0
}

/**
 * Staff marks a patient-sent message handled (read_at flip). Direct UPDATE
 * under the staff update policy — the mark_message_read RPC is deliberately
 * restricted to clinic-sent rows so anon callers can't clear the provider
 * queue. Idempotent: only flips rows still unread.
 */
export async function markMessageHandled(messageId) {
  if (!messageId) return
  const { error } = await supabase
    .from('patient_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('read_at', null)
  if (error) throw error
}

/**
 * Realtime: new patient-sent messages for this clinic — same pattern as
 * subscribeToIntakes. Returns an unsubscribe function for useEffect cleanup.
 * The INSERT payload has no patient embed, so callers should refetch via
 * listClinicInbox rather than trusting the raw row for display.
 */
export function subscribeToClinicMessages(clinicId, onNewMessage) {
  const channel = supabase
    .channel('patient-messages-channel')
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'patient_messages',
        filter: `clinic_id=eq.${clinicId}`,
      },
      (payload) => {
        if (payload.new?.sender_role === 'patient') onNewMessage(payload.new)
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}


// ============================================================
// HELPERS
// ============================================================

// Split "Kurt Kullberg" → { first_name: "Kurt", last_name: "Kullberg" }
// Handles single-word names gracefully
function splitName(fullName = '') {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { first_name: parts[0], last_name: '' }
  const last = parts.pop()
  return { first_name: parts.join(' '), last_name: last }
}

// Most-recently-created row from an embedded array (or null). With the visits
// model a patient accrues multiple fittings/audiograms (one per visit), so the
// "current" record is the newest — not whatever order PostgREST happens to return.
function pickNewest(rows) {
  if (!rows?.length) return null
  return rows.reduce((newest, r) =>
    new Date(r.created_at || 0) > new Date(newest.created_at || 0) ? r : newest)
}

// Reassemble DB row back into the flat patient shape Distil UI expects
function assemblePatient(row) {
  const coverage = row.insurance_coverage?.[0] || null
  // Current fitting/audiogram = the newest. Baseline + full history load on
  // demand (loadBaselineAudiology / loadVisitHistory) for the upgrade flow.
  const fitting  = pickNewest(row.device_fittings)
  const sides    = fitting?.device_sides || []
  const leftSide  = sides.find(s => s.ear === 'left')  || null
  const rightSide = sides.find(s => s.ear === 'right') || null
  const audiogram = pickNewest(row.audiograms)
  const thresholds = audiogram?.audiogram_thresholds || []
  const appts = row.appointments || []

  // Rebuild threshold maps { frequency: threshold_db } and mask maps { frequency: true }
  const rightT = {}, leftT = {}, rightBC = {}, leftBC = {}
  const rightMask = {}, leftMask = {}, rightBCMask = {}, leftBCMask = {}
  thresholds.forEach(t => {
    const isAC = t.test_type === 'AC'
    const isBC = t.test_type === 'BC'
    if (isAC) {
      if (t.ear === 'right') { rightT[t.frequency] = t.threshold_db; if (t.is_masked) rightMask[t.frequency] = true }
      if (t.ear === 'left')  { leftT[t.frequency]  = t.threshold_db; if (t.is_masked) leftMask[t.frequency] = true }
    }
    if (isBC) {
      if (t.ear === 'right') { rightBC[t.frequency] = t.threshold_db; if (t.is_masked) rightBCMask[t.frequency] = true }
      if (t.ear === 'left')  { leftBC[t.frequency]  = t.threshold_db; if (t.is_masked) leftBCMask[t.frequency] = true }
    }
  })

  const primary = leftSide || rightSide

  return {
    id:        row.id,
    clinicId:  row.clinic_id,
    location:  row.clinics?.name || '',
    createdAt: row.created_at,
    name:      [row.first_name, row.last_name].filter(Boolean).join(' '),
    dob:       row.dob || '',
    phone:     row.phone || '',
    email:     row.email || '',
    address:   row.address || '',
    payType:   row.pay_type,
    notes:     row.notes || '',

    // Raw DB IDs needed for inline edits — not displayed in UI
    _ids: {
      coverageId:  coverage?.id   || null,
      fittingId:   fitting?.id    || null,
      leftSideId:  leftSide?.id   || null,
      rightSideId: rightSide?.id  || null,
    },

    insurance: coverage ? {
      carrier:   coverage.carrier,
      planGroup: coverage.plan_group,
      tpa:       coverage.tpa,
      tier:      coverage.tier,
      tierPrice: coverage.tier_price_per_aid ? coverage.tier_price_per_aid / 100 : null,
    } : null,

    // Mirrors the insurance block for private-pay flow. Snapshot of the
    // tier label + per-aid retail price chosen at close, so re-generated
    // quotes/PAs from the patient list match what the patient saw.
    privatePay: (row.private_pay_tier || row.private_pay_price_per_aid != null) ? {
      tier:      row.private_pay_tier || null,
      tierPrice: row.private_pay_price_per_aid != null
        ? row.private_pay_price_per_aid / 100
        : null,
    } : null,

    carePlan: coverage?.care_plan_type || null,

    devices: fitting ? {
      fittingType:    fitting.fitting_type,
      fittingDate:    fitting.fitting_date,
      warrantyExpiry: fitting.warranty_expiry,
      serialLeft:     fitting.serial_left,
      serialRight:    fitting.serial_right,
      manufacturer:   primary?.manufacturer || '',
      family:         primary?.family || '',
      techLevel:      primary?.tech_level || '',
      style:          primary?.style || '',
      color:          primary?.color || '',
      battery:        primary?.battery || '',
      left:  leftSide  ? assembleSide(leftSide)  : null,
      right: rightSide ? assembleSide(rightSide) : null,
    } : null,

    audiology: {
      rightT, leftT, rightBC, leftBC,
      rightMask, leftMask, rightBCMask, leftBCMask,
      tinnitusRight: audiogram?.tinnitus_right ?? false,
      tinnitusLeft:  audiogram?.tinnitus_left  ?? false,
      unaidedR: audiogram?.unaided_wrs_right ?? null,
      unaidedL: audiogram?.unaided_wrs_left  ?? null,
      aidedR:   audiogram?.aided_wrs_right   ?? null,
      aidedL:   audiogram?.aided_wrs_left    ?? null,
      wrMclR:   audiogram?.wr_mcl_right      ?? null,
      wrMclL:   audiogram?.wr_mcl_left       ?? null,
      sinBin:   audiogram?.sin_score         ?? null,
      cctR:     audiogram?.cct_right         ?? null,
      cctL:     audiogram?.cct_left          ?? null,
      cctLevelR: audiogram?.cct_level_right  ?? null,
      cctLevelL: audiogram?.cct_level_left   ?? null,
    },

    patientStatus: row.patient_status || 'prospect',

    // Follow-up queue inputs (populated by savePunch + provider edits).
    lastVisitDate:        row.last_visit_date         || null,
    followUpStatus:       row.follow_up_status        || 'none',
    followUpContactedAt:  row.follow_up_contacted_date || null,
    followUpNotes:        row.follow_up_notes         || '',

    // Year-4 / off-warranty upgrade tracking.
    carePlanStartDate:    row.care_plan_start_date    || null,
    upgradeTierOffered:   row.upgrade_tier_offered    || '',
    upgradeOutcome:       row.upgrade_outcome         || '',
    donationRecipient:    row.donation_recipient      || '',

    appointments: appts.map(a => ({
      date: a.appointment_date,
      type: a.appointment_type,
      note: a.notes,
      status: a.status,
    })),
  }
}

function assembleSide(s) {
  return {
    manufacturer:  s.manufacturer  || '',
    family:        s.family        || '',
    generation:    s.generation    || '',
    variant:       s.variant       || '',
    techLevel:     s.tech_level    || '',
    style:         s.style         || '',
    color:         s.color         || '',
    battery:       s.battery       || '',
    receiverLength: s.receiver_length || '',
    receiverPower:  s.receiver_power  || '',
    dome:           s.dome            || '',
    thModel:        s.th_model        || '',
    faceplateColor: s.faceplate_color || '',
    shellColor:     s.shell_color     || '',
    gainMatrix:     s.gain_matrix     || '',
    domeCategory:   s.dome_category   || '',
    domeSize:       s.dome_size       || '',
  }
}


// ============================================================
// PATIENTS
// ============================================================

const PATIENT_SELECT = `
  *,
  clinics(name),
  insurance_coverage(*),
  device_fittings(
    *,
    device_sides(*)
  ),
  audiograms(
    *,
    audiogram_thresholds(*)
  ),
  appointments(*)
`

// Load all patients for one clinic, assembled into UI shape. The explicit
// clinic filter is required: authenticated reads are org-wide (for the
// all-locations search), so RLS no longer scopes this list.
export async function loadAllPatients(clinicId) {
  let query = supabase
    .from('patients')
    .select(PATIENT_SELECT)
    .order('created_at', { ascending: false })
  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) { console.error('loadAllPatients:', error); return [] }
  return data.map(assemblePatient)
}

// Sycle-style "all locations" search: server-side, org-wide, same UI shape
// as loadAllPatients plus clinicId/clinicName for the clinic badge.
export async function searchPatientsGlobal(term) {
  const t = (term || '').trim()
  if (t.length < 2) return []
  const pattern = `%${t.replace(/[%_]/g, '')}%`
  const { data, error } = await supabase
    .from('patients')
    .select(PATIENT_SELECT)
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern}`)
    .order('last_name')
    .limit(25)
  if (error) { console.error('searchPatientsGlobal:', error); return [] }
  return (data || []).map(assemblePatient)
}

// Permanently delete a patient profile and every dependent record. Admin only
// — the delete_patient_profile RPC re-checks staff.role server-side, clears
// the child tables whose FKs don't cascade, and deletes the patient row (all
// other children cascade; see the 20260706120000 migration). Storage files
// for the patient's archived documents are removed first, while the
// patient_documents rows holding their paths still exist. Storage cleanup is
// best-effort: a failure there logs and continues, since the DB rows are the
// access path and they're gone either way. Throws on RPC error.
export async function deletePatientProfile(patientId) {
  if (!patientId) throw new Error('deletePatientProfile: patientId required')

  try {
    const { data: docs } = await supabase
      .from('patient_documents')
      .select('storage_path')
      .eq('patient_id', patientId)
    const paths = (docs || []).map(d => d.storage_path).filter(Boolean)
    if (paths.length) await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths)
  } catch (e) {
    console.warn('deletePatientProfile storage cleanup:', e)
  }

  const { error } = await supabase.rpc('delete_patient_profile', { p_patient_id: patientId })
  if (error) { console.error('deletePatientProfile:', error); throw error }
}

// Save a new patient — decomposes the flat UI object into multiple tables.
//
// Failure contract: the core patient row either saves or this throws a plain
// error. Every dependent section (visit, insurance, fitting, sides, audiogram,
// thresholds, appointments, campaign enrollment) is still ATTEMPTED after an
// earlier one fails, but failures are collected and thrown at the end as an
// error with `.partial = true` and `.failures = [...]` — the patient row
// exists at that point, so callers must surface the error rather than
// re-saving (which would duplicate the patient). Previously these sections
// logged to console and continued, which let a patient record silently save
// without its insurance row — and pricing is derived from insurance data.
export async function savePatient(patient, staffId, clinicId) {
  const { first_name, last_name } = splitName(patient.name)
  const failures = []
  const recordFailure = (section, error) => {
    console.error(`savePatient — ${section}:`, error)
    failures.push(`${section} (${error?.message || error})`)
  }

  // 1. Insert core patient row
  const { data: patientRow, error: patientError } = await supabase
    .from('patients')
    .insert({
      id:         patient.id,
      clinic_id:  clinicId,
      created_by: staffId,
      first_name,
      last_name,
      dob:       patient.dob       || null,
      phone:     patient.phone     || null,
      email:     patient.email     || null,
      address:   patient.address   || null,
      pay_type:  patient.payType,
      notes:     patient.notes     || null,
      patient_status: patient.patientStatus || 'prospect',
      // Private-pay tier snapshot — null for insurance patients.
      private_pay_tier:          patient.privatePay?.tier || null,
      private_pay_price_per_aid: patient.privatePay?.tierPrice != null
                                   ? Math.round(patient.privatePay.tierPrice * 100)
                                   : null,
    })
    .select()
    .single()

  if (patientError) throw patientError

  // Open the initial visit so this full-save's fitting + audiogram are tagged
  // with a clinical encounter (longitudinal history) — mirrors the incremental
  // wizard opening a visit at step 0.
  const visitId = await createVisit(patientRow.id, {
    clinicId, staffId, visitType: 'initial_fit',
    visitDate: patient.devices?.fittingDate || null,
    status: patient.patientStatus === 'active' ? 'completed' : 'in_progress',
  })
  // createVisit returns null on error — without a visit, the fitting and
  // audiogram below still save but lose their encounter linkage.
  if (!visitId) failures.push('visit record (fitting/audiogram saved without an encounter link)')

  // 2. Insert insurance coverage (if applicable)
  if (patient.insurance && patient.payType === 'insurance') {
    const planId = await resolveInsurancePlanId(
      patient.insurance.carrier,
      patient.insurance.planGroup,
      patient.insurance.tier
    )
    const { error } = await supabase.from('insurance_coverage').insert({
      patient_id:         patientRow.id,
      carrier:            patient.insurance.carrier,
      plan_group:         patient.insurance.planGroup,
      tpa:                patient.insurance.tpa     || null,
      tier:               patient.insurance.tier    || null,
      tier_price_per_aid: patient.insurance.tierPrice
                            ? Math.round(patient.insurance.tierPrice * 100)
                            : null,
      insurance_plan_id:  planId,
      care_plan_type:     patient.carePlan          || null,
      warranty_expiry:    patient.devices?.warrantyExpiry || null,
    })
    if (error) recordFailure('insurance coverage', error)
  }

  // 3. Insert device fitting + sides
  if (patient.devices) {
    const fittingType = (patient.devices.fittingType || 'bilateral')
      .toLowerCase().replace('/', '_').replace(' ', '_')

    const { data: fittingRow, error: fittingError } = await supabase
      .from('device_fittings')
      .insert({
        patient_id:      patientRow.id,
        visit_id:        visitId,
        fitted_by:       staffId,
        fitting_date:    patient.devices.fittingDate    || null,
        fitting_type:    fittingType,
        warranty_expiry: patient.devices.warrantyExpiry || null,
        serial_left:     patient.devices.serialLeft     || null,
        serial_right:    patient.devices.serialRight    || null,
      })
      .select()
      .single()

    if (fittingError) {
      recordFailure('device fitting', fittingError)
    } else {
      // Insert left and right sides
      const sidesToInsert = []
      if (patient.devices.left) {
        sidesToInsert.push(buildSideRow(fittingRow.id, 'left', patient.devices.left))
      }
      if (patient.devices.right) {
        sidesToInsert.push(buildSideRow(fittingRow.id, 'right', patient.devices.right))
      }
      if (sidesToInsert.length) {
        const { error } = await supabase.from('device_sides').insert(sidesToInsert)
        if (error) recordFailure('device details (left/right configuration)', error)
      }
    }
  }

  // 4. Insert audiogram + thresholds
  if (patient.audiology) {
    const a = patient.audiology
    const hasAudioData = Object.keys(a.rightT || {}).length > 0 ||
                         Object.keys(a.leftT  || {}).length > 0 ||
                         Object.keys(a.rightBC || {}).length > 0 ||
                         Object.keys(a.leftBC  || {}).length > 0 ||
                         a.unaidedR != null || a.unaidedL != null ||
                         a.cctR != null || a.cctL != null ||
                         a.tinnitusRight || a.tinnitusLeft

    if (hasAudioData) {
      const { data: audioRow, error: audioError } = await supabase
        .from('audiograms')
        .insert({
          patient_id:        patientRow.id,
          visit_id:          visitId,
          tested_by:         staffId,
          test_date:         new Date().toISOString().split('T')[0],
          unaided_wrs_right: a.unaidedR ?? null,
          unaided_wrs_left:  a.unaidedL ?? null,
          aided_wrs_right:   a.aidedR   ?? null,
          aided_wrs_left:    a.aidedL   ?? null,
          wr_mcl_right:      a.wrMclR   ?? null,
          wr_mcl_left:       a.wrMclL   ?? null,
          sin_score:         a.sinBin   ?? null,
          tinnitus_right:    a.tinnitusRight ?? false,
          tinnitus_left:     a.tinnitusLeft  ?? false,
          cct_right:         a.cctR     ?? null,
          cct_left:          a.cctL     ?? null,
          cct_level_right:   a.cctLevelR ?? null,
          cct_level_left:    a.cctLevelL ?? null,
          source_type:       a._sourceType || 'manual',
        })
        .select()
        .single()

      if (audioError) {
        recordFailure('audiogram', audioError)
      } else {
        // Build threshold rows from frequency maps (AC + BC, with masking)
        const thresholdRows = []
        const addRows = (map, ear, testType, maskMap) => {
          Object.entries(map || {}).forEach(([freq, db]) => {
            thresholdRows.push({
              audiogram_id:  audioRow.id,
              ear,
              frequency:     parseInt(freq),
              threshold_db:  db,
              test_type:     testType,
              is_masked:     !!(maskMap && maskMap[freq]),
            })
          })
        }
        addRows(a.rightT,  'right', 'AC', a.rightMask)
        addRows(a.leftT,   'left',  'AC', a.leftMask)
        addRows(a.rightBC, 'right', 'BC', a.rightBCMask)
        addRows(a.leftBC,  'left',  'BC', a.leftBCMask)
        if (thresholdRows.length) {
          const { error } = await supabase.from('audiogram_thresholds').insert(thresholdRows)
          if (error) recordFailure('audiogram thresholds', error)
        }
      }
    }
  }

  // 5. Insert appointments
  if (patient.appointments?.length) {
    const apptRows = patient.appointments.map(appt => ({
      patient_id:       patientRow.id,
      clinic_id:        clinicId,
      staff_id:         staffId,
      appointment_date: appt.date,
      appointment_type: appt.type || null,
      status:           'scheduled',
    }))
    const { error } = await supabase.from('appointments').insert(apptRows)
    if (error) recordFailure('appointments', error)
  }

  // 6. Auto-enroll in default campaign (if patient has a fitting date)
  if (patient.devices?.fittingDate) {
    try {
      const { data: defaultTemplate } = await supabase
        .from('campaign_templates')
        .select('id')
        .eq('name', 'Standard Hearing Care Journey')
        .eq('active', true)
        .limit(1)
        .maybeSingle()
      if (defaultTemplate) {
        await enrollPatientInCampaign(patientRow.id, defaultTemplate.id, patient.devices.fittingDate, staffId)
      }
    } catch (e) {
      recordFailure('care-journey campaign enrollment', e)
    }
  }

  if (failures.length) {
    const err = new Error(
      `The patient record was created, but these sections failed to save: ${failures.join('; ')}. ` +
      `Do NOT re-save from the wizard (that would create a duplicate patient) — ` +
      `open the patient's chart and re-enter the missing pieces.`
    )
    err.partial = true
    err.failures = failures
    err.patientId = patientRow.id
    throw err
  }

  return patientRow
}

function buildSideRow(fittingId, ear, side) {
  return {
    fitting_id:      fittingId,
    ear,
    manufacturer:    side.manufacturer    || null,
    family:          side.family          || null,
    generation:      side.generation      || null,
    variant:         side.variant         || null,
    tech_level:      side.techLevel       || null,
    style:           side.style           || null,
    color:           side.color           || null,
    battery:         side.battery         || null,
    receiver_length: side.receiverLength  || null,
    receiver_power:  side.receiverPower   || null,
    dome:            side.dome            || null,
    th_model:        side.thModel         || null,
    faceplate_color: side.faceplateColor  || null,
    shell_color:     side.shellColor      || null,
    gain_matrix:     side.gainMatrix      || null,
    dome_category:   side.domeCategory    || null,
    dome_size:       side.domeSize        || null,
  }
}


// ============================================================
// VISITS (clinical encounters — longitudinal history)
// ============================================================

// Open a visit (clinical encounter) for a patient. The new-patient wizard
// opens an 'initial_fit' visit at draft time; the established-patient flow
// opens an 'upgrade_consult' / 'annual_check' / etc. Audiograms and device
// fittings saved during a wizard are tagged with this visit_id, so prior
// visits' records survive instead of being overwritten on save.
export async function createVisit(patientId, { clinicId = null, staffId = null, visitType = 'initial_fit', visitDate = null, status = 'in_progress' } = {}) {
  const { data, error } = await supabase
    .from('visits')
    .insert({
      patient_id: patientId,
      clinic_id:  clinicId,
      staff_id:   staffId,
      visit_type: visitType,
      visit_date: visitDate || new Date().toISOString().split('T')[0],
      status,
    })
    .select('id')
    .single()
  if (error) { console.error('createVisit:', error); return null }
  return data.id
}

// Oldest audiogram on file (the baseline from the original fit), with its
// thresholds — the reference the upgrade flow diffs the new visit against.
// Returns null if the patient has no audiogram history.
export async function loadBaselineAudiology(patientId) {
  const { data, error } = await supabase
    .from('audiograms')
    .select('*, audiogram_thresholds(*)')
    .eq('patient_id', patientId)
    .order('test_date',  { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) { console.error('loadBaselineAudiology:', error); return null }
  return data || null
}

// Audiogram captured during a specific visit — the "current" side of the upgrade
// delta, in the same shape as loadBaselineAudiology so it drops straight into
// computeAudiometricDelta. Newest if a visit somehow carries more than one;
// null if the visit has no audiogram on file yet.
export async function loadVisitAudiology(visitId) {
  if (!visitId) return null
  const { data, error } = await supabase
    .from('audiograms')
    .select('*, audiogram_thresholds(*)')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) { console.error('loadVisitAudiology:', error); return null }
  return data || null
}

// All visits for a patient, newest first, each with its audiogram(s) +
// fitting(s). Feeds the upgrade consultation timeline + history views.
export async function loadVisitHistory(patientId) {
  const { data, error } = await supabase
    .from('visits')
    .select('*, audiograms(*, audiogram_thresholds(*)), device_fittings(*, device_sides(*))')
    .eq('patient_id', patientId)
    .order('visit_date',  { ascending: false })
    .order('created_at', { ascending: false })
  if (error) { console.error('loadVisitHistory:', error); return [] }
  return data || []
}

// Patch a visit as the established-patient flow advances (notes, status, type).
export async function updateVisit(visitId, fields = {}) {
  if (!visitId) return
  const updates = {}
  if (fields.visitType !== undefined) updates.visit_type = fields.visitType
  if (fields.status    !== undefined) updates.status     = fields.status
  if (fields.notes     !== undefined) updates.notes      = fields.notes
  if (fields.visitDate !== undefined) updates.visit_date = fields.visitDate
  if (Object.keys(updates).length === 0) return
  const { error } = await supabase.from('visits').update(updates).eq('id', visitId)
  if (error) console.error('updateVisit:', error)
}

// ── Upgrade assessments (readiness + performance; backlog #23) ──────────────
// One row per visit; upsert keyed on visit_id so re-saving within a visit updates
// rather than duplicates. decision* fields are written later by the PR3 engine.
export async function saveUpgradeAssessment(visitId, patientId, clinicId, fields = {}) {
  if (!visitId || !patientId) return null
  const row = {
    visit_id:         visitId,
    patient_id:       patientId,
    clinic_id:        clinicId ?? null,
    responses:        fields.responses       ?? {},
    readiness_score:  fields.readinessScore  ?? null,
    readiness_band:   fields.readinessBand   ?? null,
    performance_tier: fields.performanceTier ?? null,
    performance_tags: fields.performanceTags ?? [],
  }
  if (fields.decision                !== undefined) row.decision = fields.decision
  if (fields.decisionScore           !== undefined) row.decision_score = fields.decisionScore
  if (fields.decisionRationale       !== undefined) row.decision_rationale = fields.decisionRationale
  if (fields.providerEditedRationale !== undefined) row.provider_edited_rationale = fields.providerEditedRationale
  const { data, error } = await supabase
    .from('upgrade_assessments')
    .upsert(row, { onConflict: 'visit_id' })
    .select()
    .single()
  if (error) { console.error('saveUpgradeAssessment:', error); return null }
  return data
}

export async function loadUpgradeAssessment(visitId) {
  if (!visitId) return null
  const { data, error } = await supabase
    .from('upgrade_assessments')
    .select('*')
    .eq('visit_id', visitId)
    .maybeSingle()
  if (error) { console.error('loadUpgradeAssessment:', error); return null }
  return data || null
}


// ============================================================
// INCREMENTAL WIZARD SAVE
// ============================================================

// Step 0 — create a draft patient with basic info + insurance
export async function createPatientDraft(data, staffId, clinicId) {
  const { first_name, last_name } = splitName(data.name)
  const { data: row, error } = await supabase
    .from('patients')
    .insert({
      id:             data.id,
      clinic_id:      clinicId,
      created_by:     staffId,
      first_name,
      last_name,
      dob:            data.dob       || null,
      phone:          data.phone     || null,
      email:          data.email     || null,
      address:        data.address   || null,
      pay_type:       data.payType,
      notes:          data.notes     || null,
      patient_status: 'prospect',
      // Private-pay tier snapshot — null for insurance patients.
      private_pay_tier:          data.privatePay?.tier || null,
      private_pay_price_per_aid: data.privatePay?.tierPrice != null
                                   ? Math.round(data.privatePay.tierPrice * 100)
                                   : null,
    })
    .select()
    .single()
  if (error) throw error

  if (data.insurance && data.payType === 'insurance') {
    const planId = await resolveInsurancePlanId(
      data.insurance.carrier,
      data.insurance.planGroup,
      data.insurance.tier
    )
    const { error: covErr } = await supabase.from('insurance_coverage').insert({
      patient_id:         row.id,
      carrier:            data.insurance.carrier,
      plan_group:         data.insurance.planGroup,
      tpa:                data.insurance.tpa     || null,
      tier:               data.insurance.tier    || null,
      tier_price_per_aid: data.insurance.tierPrice
                            ? Math.round(data.insurance.tierPrice * 100)
                            : null,
      insurance_plan_id:  planId,
    })
    if (covErr) console.error('draft insurance_coverage insert:', covErr)
  }

  return row.id
}

// Step 1 — save audiogram data for an existing patient
export async function updatePatientAudiology(patientId, audiology, staffId, visitId = null) {
  if (!audiology) return
  const a = audiology
  const hasAudioData = Object.keys(a.rightT || {}).length > 0 ||
                       Object.keys(a.leftT  || {}).length > 0 ||
                       Object.keys(a.rightBC || {}).length > 0 ||
                       Object.keys(a.leftBC  || {}).length > 0 ||
                       a.unaidedR != null || a.unaidedL != null ||
                       a.cctR != null || a.cctL != null ||
                       a.tinnitusRight || a.tinnitusLeft
  if (!hasAudioData) return

  // Re-save pattern, scoped to THIS visit so prior visits' audiograms survive
  // (the longitudinal-history the upgrade pathway depends on). Pre-visits
  // callers (visitId null) fall back to the legacy patient-wide replace.
  let existingQ = supabase.from('audiograms').select('id').eq('patient_id', patientId)
  if (visitId) existingQ = existingQ.eq('visit_id', visitId)
  const { data: existing } = await existingQ
  if (existing?.length) {
    for (const row of existing) {
      await supabase.from('audiogram_thresholds').delete().eq('audiogram_id', row.id)
    }
    let delQ = supabase.from('audiograms').delete().eq('patient_id', patientId)
    if (visitId) delQ = delQ.eq('visit_id', visitId)
    await delQ
  }

  const { data: audioRow, error: audioError } = await supabase
    .from('audiograms')
    .insert({
      patient_id:        patientId,
      visit_id:          visitId,
      tested_by:         staffId,
      test_date:         new Date().toISOString().split('T')[0],
      unaided_wrs_right: a.unaidedR ?? null,
      unaided_wrs_left:  a.unaidedL ?? null,
      aided_wrs_right:   a.aidedR   ?? null,
      aided_wrs_left:    a.aidedL   ?? null,
      wr_mcl_right:      a.wrMclR   ?? null,
      wr_mcl_left:       a.wrMclL   ?? null,
      sin_score:         a.sinBin   ?? null,
      tinnitus_right:    a.tinnitusRight ?? false,
      tinnitus_left:     a.tinnitusLeft  ?? false,
      cct_right:         a.cctR     ?? null,
      cct_left:          a.cctL     ?? null,
      cct_level_right:   a.cctLevelR ?? null,
      cct_level_left:    a.cctLevelL ?? null,
      source_type:       a._sourceType || 'manual',
    })
    .select()
    .single()

  if (audioError) { console.error('updatePatientAudiology:', audioError); return }

  const thresholdRows = []
  const addRows = (map, ear, testType, maskMap) => {
    Object.entries(map || {}).forEach(([freq, db]) => {
      thresholdRows.push({
        audiogram_id:  audioRow.id,
        ear,
        frequency:     parseInt(freq),
        threshold_db:  db,
        test_type:     testType,
        is_masked:     !!(maskMap && maskMap[freq]),
      })
    })
  }
  addRows(a.rightT,  'right', 'AC', a.rightMask)
  addRows(a.leftT,   'left',  'AC', a.leftMask)
  addRows(a.rightBC, 'right', 'BC', a.rightBCMask)
  addRows(a.leftBC,  'left',  'BC', a.leftBCMask)
  if (thresholdRows.length) {
    const { error } = await supabase.from('audiogram_thresholds').insert(thresholdRows)
    if (error) console.error('audiogram_thresholds insert:', error)
  }

  // Audiogram changed → invalidate cached tier recommendation so the
  // next entry to the tier step re-runs the engine against new inputs.
  await supersedeRecommendationsForPatient(patientId)
}

// Step 3 — save device fitting + sides for existing patient
export async function updatePatientDevices(patientId, devices, staffId, visitId = null) {
  if (!devices) return
  const fittingType = (devices.fittingType || 'bilateral')
    .toLowerCase().replace('/', '_').replace(' ', '_')

  // Re-save pattern, scoped to THIS visit so a prior visit's fitting survives
  // (an upgrade visit adds a new fitting; the original aids stay on record).
  // Pre-visits callers (visitId null) fall back to the legacy patient-wide replace.
  let existingQ = supabase.from('device_fittings').select('id').eq('patient_id', patientId)
  if (visitId) existingQ = existingQ.eq('visit_id', visitId)
  const { data: existing } = await existingQ
  if (existing?.length) {
    for (const row of existing) {
      await supabase.from('device_sides').delete().eq('fitting_id', row.id)
    }
    let delQ = supabase.from('device_fittings').delete().eq('patient_id', patientId)
    if (visitId) delQ = delQ.eq('visit_id', visitId)
    await delQ
  }

  const { data: fittingRow, error: fittingError } = await supabase
    .from('device_fittings')
    .insert({
      patient_id:      patientId,
      visit_id:        visitId,
      fitted_by:       staffId,
      fitting_type:    fittingType,
      serial_left:     devices.serialLeft  || null,
      serial_right:    devices.serialRight || null,
    })
    .select()
    .single()

  if (fittingError) { console.error('updatePatientDevices:', fittingError); return }

  const sidesToInsert = []
  if (devices.left)  sidesToInsert.push(buildSideRow(fittingRow.id, 'left', devices.left))
  if (devices.right) sidesToInsert.push(buildSideRow(fittingRow.id, 'right', devices.right))
  if (sidesToInsert.length) {
    const { error } = await supabase.from('device_sides').insert(sidesToInsert)
    if (error) console.error('device_sides insert:', error)
  }
}

// Step 4 — save care plan selection
export async function updatePatientCarePlan(patientId, carePlan) {
  const { error } = await supabase
    .from('insurance_coverage')
    .update({ care_plan_type: carePlan || null })
    .eq('patient_id', patientId)
  if (error) console.error('updatePatientCarePlan:', error)
}

// ============================================================
// ANALYTICS
// ============================================================

// Fire-and-forget event logger. Writes to public.analytics_events with a
// jsonb payload. Never throws — analytics must never break a user flow.
// Callers should pass { patient_id, provider_id, clinic_id, ... }; the
// provider_id must match the authenticated user (RLS enforces this).
export async function logAnalyticsEvent(eventName, payload = {}) {
  try {
    const row = {
      event_name: eventName,
      payload: { ...payload, timestamp: payload.timestamp || new Date().toISOString() },
    }
    const { error } = await supabase.from('analytics_events').insert(row)
    if (error) console.warn('logAnalyticsEvent:', eventName, error.message)
  } catch (e) {
    console.warn('logAnalyticsEvent threw:', eventName, e?.message)
  }
}

// Final — promote draft to active/tns and set warranty/fitting info
export async function finalizePatient(patientId, status, devices, carePlan, notes, appointments, staffId, clinicId, privatePay = null, visitId = null) {
  // Update patient status + notes. Stamp care_plan_start_date with the
  // fitting date when the patient is being finalized with a care plan
  // selected — gives the year-4 upgrade pathway a ground-truth anchor.
  const updates = { patient_status: status || 'active' }
  if (notes != null) updates.notes = notes
  if (carePlan && devices?.fittingDate) {
    // Set-once: care_plan_start_date is the "Year 0" of the patient's original
    // journey. An upgrade re-finalize must not reset it (current-aids age is
    // derived from the latest fitting's date instead).
    const { data: existing } = await supabase
      .from('patients').select('care_plan_start_date').eq('id', patientId).maybeSingle()
    if (!existing?.care_plan_start_date) updates.care_plan_start_date = devices.fittingDate
  }
  // Snapshot private-pay tier + price at finalize time. The patient picks
  // their tier mid-wizard (TierSelection), well after createPatientDraft
  // ran, so this is the canonical write moment.
  if (privatePay) {
    updates.private_pay_tier = privatePay.tier || null
    updates.private_pay_price_per_aid = privatePay.tierPrice != null
      ? Math.round(privatePay.tierPrice * 100)
      : null
  }
  const { error: patErr } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', patientId)
  if (patErr) console.error('finalizePatient status:', patErr)

  // Update warranty/fitting dates on device_fittings
  if (devices?.fittingDate || devices?.warrantyExpiry) {
    const devUpdate = {}
    if (devices.fittingDate)    devUpdate.fitting_date    = devices.fittingDate
    if (devices.warrantyExpiry) devUpdate.warranty_expiry = devices.warrantyExpiry
    let updQ = supabase.from('device_fittings').update(devUpdate).eq('patient_id', patientId)
    if (visitId) updQ = updQ.eq('visit_id', visitId)   // target only this visit's fitting
    const { error } = await updQ
    if (error) console.error('finalizePatient fittings:', error)
  }

  // Update warranty on insurance_coverage
  if (devices?.warrantyExpiry) {
    const { error } = await supabase
      .from('insurance_coverage')
      .update({ warranty_expiry: devices.warrantyExpiry, care_plan_type: carePlan || null })
      .eq('patient_id', patientId)
    if (error) console.error('finalizePatient coverage:', error)
  }

  // Insert appointments — guarded against a duplicate finalize (the Finalize
  // Patient button has no click-guard) so the care arc isn't re-inserted.
  if (appointments?.length) {
    const dateKey = d => (d || '').split('T')[0]
    const { data: existingAppts } = await supabase
      .from('appointments')
      .select('appointment_type, appointment_date')
      .eq('patient_id', patientId)
    const existingKeys = new Set((existingAppts || []).map(r => `${r.appointment_type}|${dateKey(r.appointment_date)}`))
    const apptRows = appointments
      .filter(appt => !existingKeys.has(`${appt.type || null}|${dateKey(appt.date)}`))
      .map(appt => ({
        patient_id:       patientId,
        clinic_id:        clinicId,
        staff_id:         staffId,
        appointment_date: appt.date,
        appointment_type: appt.type || null,
        notes:            appt.note || null,
        status:           'scheduled',
      }))
    if (apptRows.length) {
      const { error } = await supabase.from('appointments').insert(apptRows)
      if (error) console.error('finalizePatient appointments:', error)
    }
  }

  // Auto-enroll in default campaign
  if (devices?.fittingDate) {
    try {
      const { data: defaultTemplate } = await supabase
        .from('campaign_templates')
        .select('id')
        .eq('name', 'Standard Hearing Care Journey')
        .eq('active', true)
        .limit(1)
        .maybeSingle()
      if (defaultTemplate) {
        await enrollPatientInCampaign(patientId, defaultTemplate.id, devices.fittingDate, staffId)
      }
    } catch (e) {
      console.error('auto-enroll campaign:', e)
    }
  }
}


// ============================================================
// APPOINTMENT OUTCOMES (Close Appointment disposition capture)
// ============================================================

// Vocabulary mirrors the appointment_outcomes enums. Two-layer design:
// device and care plan dispositions are captured separately so the TPA
// care-plan attach rate stays computable when a patient accepts devices
// but declines a care plan.
export const OUTCOME_CONTEXTS = ['new_fit', 'upgrade', 'care_plan_only']
export const OUTCOME_DISPOSITIONS = ['committed', 'deferred', 'declined', 'not_a_candidate', 'no_decision', 'not_applicable']
export const OUTCOME_REASON_REQUIRED = ['deferred', 'declined']
export const OUTCOME_REASONS = [
  'price_budget',
  'spouse_family_consult',
  'wants_to_think',
  'no_perceived_need',
  'shopping_second_opinion',
  'insurance_benefit_issue',
  'health_life_circumstances',
  'satisfied_with_current_devices',
]

// Mirrors the table's CHECK constraints so the modal gets a readable message
// instead of a Postgres constraint error. Returns null when valid.
export function validateAppointmentOutcome(o) {
  if (!o?.patientId || !o?.clinicId || !o?.providerId) return 'Missing patient, clinic, or provider.'
  if (!OUTCOME_CONTEXTS.includes(o.context)) return 'Select the appointment context.'
  if (!OUTCOME_DISPOSITIONS.includes(o.deviceDisposition)) return 'Select a device outcome.'
  if (!OUTCOME_DISPOSITIONS.includes(o.carePlanDisposition)) return 'Select a care plan outcome.'
  if (OUTCOME_REASON_REQUIRED.includes(o.deviceDisposition) && !OUTCOME_REASONS.includes(o.deviceReason)) {
    return 'Select a reason for the device outcome.'
  }
  if (OUTCOME_REASON_REQUIRED.includes(o.carePlanDisposition) && !OUTCOME_REASONS.includes(o.carePlanReason)) {
    return 'Select a reason for the care plan outcome.'
  }
  if (o.carePlanDisposition === 'committed' && !o.carePlanSelected) {
    return 'Select which care plan the patient committed to.'
  }
  if (o.deviceDisposition === 'not_applicable' && o.carePlanDisposition === 'not_applicable') {
    return 'Device and care plan outcomes cannot both be "not applicable".'
  }
  if (!['tpa', 'other_insurance', 'private_pay'].includes(o.payerType)) return 'Missing payer type.'
  return null
}

// Insert one appointment_outcomes row — the de facto visit-history record.
// Payer fields are snapshotted at the moment of decision, never derived from
// the patient record at query time, so a later insurance change cannot
// corrupt historical attach-rate numbers. Throws on validation or insert
// failure so callers can route the payload into the disposition-missing
// retry state instead of losing it.
export async function saveAppointmentOutcome(o) {
  const problem = validateAppointmentOutcome(o)
  if (problem) throw new Error(problem)
  const row = {
    patient_id:            o.patientId,
    clinic_id:             o.clinicId,
    provider_id:           o.providerId,
    visit_id:              o.visitId || null,
    context:               o.context,
    device_disposition:    o.deviceDisposition,
    // Reasons only persist on the layers that require one; care_plan_selected
    // only when committed — matches the table's iff CHECK constraints.
    device_reason:         OUTCOME_REASON_REQUIRED.includes(o.deviceDisposition) ? o.deviceReason : null,
    care_plan_disposition: o.carePlanDisposition,
    care_plan_reason:      OUTCOME_REASON_REQUIRED.includes(o.carePlanDisposition) ? o.carePlanReason : null,
    care_plan_selected:    o.carePlanDisposition === 'committed' ? o.carePlanSelected : null,
    payer_type:            o.payerType,
    payer_name:            o.payerName || null,
    payer_plan_snapshot:   o.payerPlanSnapshot || null,
  }
  const { data, error } = await supabase
    .from('appointment_outcomes')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  runPostCloseHooks(data)
  return data
}

// Outcomes for the Reports view. clinicId null = org-wide (the RLS read
// policy allows authenticated org-wide SELECT, mirroring All Locations
// search); from/to filter on closed_at. Throws on error — Reports shows
// failures loudly rather than rendering a silently-empty dashboard.
export async function loadAppointmentOutcomes({ clinicId = null, from = null, to = null } = {}) {
  // Embed the patient's name and the outcome's clinic so the Reports
  // drill-downs can list who's behind each number even in org-wide scope
  // (both tables allow org-wide authenticated reads). computeReportStats
  // ignores the extra keys; only the drill views consume them.
  let q = supabase
    .from('appointment_outcomes')
    .select('*, patient:patients(first_name,last_name), outcome_clinic:clinics(name)')
    .order('closed_at', { ascending: false })
    .limit(5000)
  if (clinicId) q = q.eq('clinic_id', clinicId)
  if (from) q = q.gte('closed_at', from)
  if (to) q = q.lte('closed_at', to)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// fitting_type per visit for the outcomes' linked visits, so committed
// revenue can count real fitted ears instead of assuming bilateral.
// Returns { [visit_id]: fitting_type }. Best-effort: an error here only
// degrades the revenue figure to the bilateral assumption, so it logs
// and returns {} rather than failing the whole report.
export async function loadFittingTypesForVisits(visitIds = []) {
  const ids = visitIds.filter(Boolean)
  if (!ids.length) return {}
  const { data, error } = await supabase
    .from('device_fittings')
    .select('visit_id, fitting_type')
    .in('visit_id', ids)
  if (error) { console.error('loadFittingTypesForVisits:', error); return {} }
  const map = {}
  for (const row of data || []) {
    if (row.visit_id) map[row.visit_id] = row.fitting_type
  }
  return map
}

// Post-close seam: everything that should eventually fire after a disposition
// is logged (take-home patient summary email, nurture segment refresh, staff
// task for insurance_benefit_issue) hangs off this single hook. Deliberately
// a no-op today — do not put UI-blocking work here.
function runPostCloseHooks(outcomeRow) { // eslint-disable-line no-unused-vars
}

// ============================================================
// PUNCH CARDS
// ============================================================

export async function loadPunch(patientId) {
  try {
    const { data, error } = await supabase
      .from('punch_cards')
      .select('*')
      .eq('patient_id', patientId)
      .single()
    if (error || !data) return { cleanings: 0, appointments: 0, log: [] }
    return {
      cleanings:    data.cleanings,
      appointments: data.appointments,
      log:          data.log || [],
    }
  } catch { return { cleanings: 0, appointments: 0, log: [] } }
}

export async function savePunch(patientId, punchData) {
  const log = punchData.log || []
  const { error } = await supabase
    .from('punch_cards')
    .upsert({
      patient_id:   patientId,
      cleanings:    punchData.cleanings,
      appointments: punchData.appointments,
      log,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'patient_id' })
  if (error) console.error('savePunch:', error)

  // Mirror the most recent appointment punch onto patients.last_visit_date
  // so the follow-up queue can filter on a single column without scanning
  // every patient's punch_card.log jsonb. Falls back to NULL on undo of the
  // last appointment so the queue treats them as never-visited.
  let lastVisit = null
  for (const entry of log) {
    if (entry?.type !== 'appointment' || !entry.date) continue
    if (!lastVisit || new Date(entry.date) > new Date(lastVisit)) lastVisit = entry.date
  }
  const { error: pErr } = await supabase
    .from('patients')
    .update({ last_visit_date: lastVisit })
    .eq('id', patientId)
  if (pErr) console.error('savePunch: last_visit_date sync:', pErr)
}


// ============================================================
// FOLLOW-UP QUEUE
// ============================================================

// Mark a patient as contacted from the follow-up queue. The queue UI
// uses this to push a patient out of the "needs outreach" buckets for
// a cooldown period without losing the audit trail of when/what.
export async function markFollowUpContacted(patientId, notes) {
  const { error } = await supabase
    .from('patients')
    .update({
      follow_up_status:         'contacted',
      follow_up_contacted_date: new Date().toISOString(),
      follow_up_notes:          notes || null,
    })
    .eq('id', patientId)
  if (error) console.error('markFollowUpContacted:', error)
}

// Reset a patient's follow-up tracking — used when a buckets-they-fell-into
// problem is resolved (e.g. they came in for a visit) and we want them back
// in the live queue if they trip a different bucket later.
export async function clearFollowUp(patientId) {
  const { error } = await supabase
    .from('patients')
    .update({
      follow_up_status:         'none',
      follow_up_contacted_date: null,
      follow_up_notes:          null,
    })
    .eq('id', patientId)
  if (error) console.error('clearFollowUp:', error)
}

// Record the outcome of a year-4 / off-warranty upgrade conversation.
// outcome is free-form for now (e.g. 'pending', 'declined', 'upgraded',
// 'donated'). donationRecipient is set when outcome === 'donated'.
export async function recordUpgradeOutcome(patientId, { tierOffered, outcome, donationRecipient }) {
  const updates = {}
  if (tierOffered       !== undefined) updates.upgrade_tier_offered = tierOffered || null
  if (outcome           !== undefined) updates.upgrade_outcome      = outcome     || null
  if (donationRecipient !== undefined) updates.donation_recipient   = donationRecipient || null
  if (Object.keys(updates).length === 0) return
  const { error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', patientId)
  if (error) console.error('recordUpgradeOutcome:', error)
}


// ============================================================
// CLINIC SETTINGS
// (stored in the clinics table, not a separate settings store)
// ============================================================

export async function loadClinicSettings(clinicId) {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .single()
  if (error || !data) return null
  return {
    name:    data.name,
    address: data.address  || '',
    phone:   data.phone    || '',
    accent:  data.accent_color || '#16a34a',
    defaultBundleMode: data.default_bundle_mode || 'bundled',
  }
}

export async function saveClinicSettings(clinicId, settings) {
  const { error } = await supabase
    .from('clinics')
    .update({
      name:         settings.name,
      address:      settings.address,
      phone:        settings.phone,
      accent_color: settings.accent,
    })
    .eq('id', clinicId)
  if (error) console.error('saveClinicSettings:', error)
}


// ============================================================
// PRODUCT CATALOG
// ============================================================

export async function loadProductCatalog() {
  const { data, error } = await supabase
    .from('product_catalog')
    .select(`*, product_catalog_tier ( id, tier_name, msrp )`)
    .eq('active', true)
    .order('manufacturer')
  if (error) { console.error('loadProductCatalog:', error); return [] }

  // Map DB rows back to the shape CATALOG_DEFAULT uses in Distil
  return data.map(row => ({
    id:           row.id,
    manufacturer: row.manufacturer,
    generation:   row.generation   || '',
    family:       row.family,
    styles:       row.styles       || [],
    variants:     row.variants     || [],
    techLevels:   row.tech_levels  || [],
    colors:       row.colors       || [],
    battery:      row.battery_options || [],
    active:       row.active,
    tpa:          row.tpa          || null,
    notes:        row.notes        || '',
    // Optional per-family display metadata (stored in product_catalog.metadata):
    //   techLevelLabels — rich labels for tech-level chips (e.g. Active IX)
    //   faceplate       — color choice is a faceplate; shell is fixed red/blue by side (Silk)
    techLevelLabels: row.metadata?.techLevelLabels || null,
    faceplate:       row.metadata?.faceplate || false,
    tiers:        (row.product_catalog_tier || []).map(t => ({
      id:       t.id,
      tierName: t.tier_name,
      msrp:     t.msrp != null ? Number(t.msrp) : null,
    })),
  }))
}

// Map a Distil catalog item to a product_catalog DB row. `metadata` is
// deliberately omitted so editor saves preserve techLevelLabels/faceplate
// (set via migration) instead of clobbering them.
function toCatalogRow(item) {
  return {
    id:              item.id,
    manufacturer:    item.manufacturer,
    family:          item.family,
    generation:      item.generation      || null,
    styles:          item.styles          || [],
    tech_levels:     item.techLevels      || [],
    variants:        item.variants        || [],
    battery_options: item.battery         || [],
    colors:          item.colors          || [],
    notes:           item.notes           ?? null,
    tpa:             item.tpa             || null,
    active:          item.active          ?? true,
  }
}

// Sync product_catalog_tier rows for a single family. Tiers carried back from
// the editor have an `id` if they were loaded from DB; new tiers (added via the
// chip editor for a brand-new techLevel) have no id and get inserted. Anything
// in DB for this family that's no longer in the set gets deleted. Throws on error.
async function syncCatalogTiers(item) {
  const { data: existing, error: exErr } = await supabase
    .from('product_catalog_tier')
    .select('id')
    .eq('product_catalog_id', item.id)
  if (exErr) { console.error('syncCatalogTiers scan:', exErr); throw exErr }

  const wantedIds = new Set((item.tiers || []).filter(t => t.id).map(t => t.id))
  const toDelete = (existing || []).filter(r => !wantedIds.has(r.id)).map(r => r.id)
  if (toDelete.length) {
    const { error: delErr } = await supabase
      .from('product_catalog_tier').delete().in('id', toDelete)
    if (delErr) { console.error('syncCatalogTiers delete:', delErr); throw delErr }
  }

  const tierRows = (item.tiers || [])
    .filter(t => t.tierName && t.tierName.trim())
    .map(t => ({
      ...(t.id ? { id: t.id } : {}),
      product_catalog_id: item.id,
      tier_name:          t.tierName,
      msrp:               t.msrp != null && t.msrp !== '' ? Number(t.msrp) : null,
    }))
  if (tierRows.length) {
    const { error: upErr } = await supabase
      .from('product_catalog_tier').upsert(tierRows)
    if (upErr) { console.error('syncCatalogTiers upsert:', upErr); throw upErr }
  }
}

// Bulk-upsert the whole catalog (used by Reset to Defaults). Admin only (RLS).
// Throws on error so callers can surface failures instead of failing silently.
export async function saveProductCatalog(catalogItems) {
  const { error } = await supabase
    .from('product_catalog')
    .upsert(catalogItems.map(toCatalogRow), { onConflict: 'id' })
  if (error) { console.error('saveProductCatalog:', error); throw error }
  for (const item of catalogItems) await syncCatalogTiers(item)
}

// Upsert a single catalog family + its tiers. Admin only (RLS). Throws on error.
export async function saveCatalogEntry(item) {
  const { error } = await supabase
    .from('product_catalog')
    .upsert([toCatalogRow(item)], { onConflict: 'id' })
  if (error) { console.error('saveCatalogEntry:', error); throw error }
  await syncCatalogTiers(item)
}

// Delete a catalog family and its tier rows. Admin only (RLS). Throws on error.
export async function deleteCatalogEntry(id) {
  const { error: tErr } = await supabase
    .from('product_catalog_tier').delete().eq('product_catalog_id', id)
  if (tErr) { console.error('deleteCatalogEntry tiers:', tErr); throw tErr }
  const { error } = await supabase
    .from('product_catalog').delete().eq('id', id)
  if (error) { console.error('deleteCatalogEntry:', error); throw error }
}


// ============================================================
// DISPENSING PROVIDERS & CLINIC NETWORK (closer-role admin manager)
// ============================================================

// Load everything the Providers & Locations admin screen needs in one shot:
// every dispensing provider, every clinic, and the clinic<->provider links.
// Admin-only by RLS (dp_admin_all / cp_admin_all); clinics readable to all auth.
export async function loadProvidersAdmin() {
  const [provRes, clinicRes, linkRes] = await Promise.all([
    supabase.from('dispensing_providers')
      .select('id, full_name, licenses, npi, credentials, signature_url, staff_id, active')
      .order('full_name'),
    supabase.from('clinics')
      .select('id, organization_id, name, clinic_code, address, phone, active')
      .order('name'),
    supabase.from('clinic_providers').select('clinic_id, provider_id'),
  ])
  if (provRes.error)   { console.error('loadProvidersAdmin providers:', provRes.error); throw provRes.error }
  if (clinicRes.error) { console.error('loadProvidersAdmin clinics:', clinicRes.error); throw clinicRes.error }
  if (linkRes.error)   { console.error('loadProvidersAdmin links:', linkRes.error); throw linkRes.error }
  return { providers: provRes.data || [], clinics: clinicRes.data || [], links: linkRes.data || [] }
}

// Upsert a single dispensing provider. `licenses` is a {STATE: number} object.
// Returns the row id (new id on insert). Admin only (RLS). Throws on error.
export async function saveDispensingProvider(p) {
  const row = {
    ...(p.id ? { id: p.id } : {}),
    full_name:   (p.full_name || '').trim(),
    licenses:    p.licenses || {},
    npi:         p.npi || null,
    credentials: p.credentials || null,
    active:      p.active ?? true,
  }
  const { data, error } = await supabase
    .from('dispensing_providers').upsert([row]).select('id').single()
  if (error) { console.error('saveDispensingProvider:', error); throw error }
  return data.id
}

// Delete a dispensing provider. clinic_providers links cascade via FK.
// Refuses to delete a provider linked to a login account. Admin only. Throws.
export async function deleteDispensingProvider(id) {
  const { error } = await supabase.from('dispensing_providers').delete().eq('id', id)
  if (error) { console.error('deleteDispensingProvider:', error); throw error }
}

// Replace the full set of clinics a provider serves with `clinicIds`.
// Admin only (RLS). Throws on error.
export async function setProviderClinics(providerId, clinicIds) {
  const { error: delErr } = await supabase
    .from('clinic_providers').delete().eq('provider_id', providerId)
  if (delErr) { console.error('setProviderClinics delete:', delErr); throw delErr }
  if (clinicIds.length) {
    const rows = clinicIds.map(cid => ({ clinic_id: cid, provider_id: providerId }))
    const { error } = await supabase.from('clinic_providers').insert(rows)
    if (error) { console.error('setProviderClinics insert:', error); throw error }
  }
}

// Upsert a clinic location. New rows need organization_id (the caller passes one
// from an existing clinic). location_key stays null for admin-created rows.
// Admin only (RLS clinics_admin_write). Returns the row id. Throws on error.
export async function saveClinicAdmin(c) {
  const row = {
    ...(c.id ? { id: c.id } : {}),
    name:        (c.name || '').trim(),
    address:     c.address || null,
    phone:       c.phone || null,
    clinic_code: c.clinic_code || null,
    active:      c.active ?? true,
    ...(c.id ? {} : { organization_id: c.organization_id, accent_color: '#16a34a' }),
  }
  const { data, error } = await supabase
    .from('clinics').upsert([row]).select('id').single()
  if (error) { console.error('saveClinicAdmin:', error); throw error }
  return data.id
}

// ============================================================
// TEAM ADMIN (admin-only via RLS: staff_admin_* / staff_clinics_admin_all)
// ============================================================

// Every staff member with their clinic assignments, for the Team view.
export async function loadTeam() {
  const { data, error } = await supabase
    .from('staff')
    .select('id, full_name, role, is_manager, active, clinic_id, active_clinic_id, staff_clinics(clinic_id, clinics(id, name))')
    .order('full_name')
  if (error) { console.error('loadTeam:', error); return [] }
  return data || []
}

// Update a staff member's profile fields (admin RLS enforced server-side).
export async function saveStaffMember(staffId, fields) {
  const { error } = await supabase
    .from('staff')
    .update(fields)
    .eq('id', staffId)
  if (error) throw error
}

// Replace a staff member's clinic assignments with the given set.
export async function setStaffClinics(staffId, clinicIds) {
  let del = supabase.from('staff_clinics').delete().eq('staff_id', staffId)
  if (clinicIds.length) del = del.not('clinic_id', 'in', `(${clinicIds.join(',')})`)
  const { error: delErr } = await del
  if (delErr) throw delErr
  if (clinicIds.length) {
    const { error: insErr } = await supabase
      .from('staff_clinics')
      .upsert(clinicIds.map(clinic_id => ({ staff_id: staffId, clinic_id })))
    if (insErr) throw insErr
  }
}

// Create a login + staff record via the admin-users edge function
// (service role on the server; caller must be an admin).
// payload: { email, password, fullName, role, homeClinicId, clinicIds }
export async function adminCreateUser(payload) {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'create-user', ...payload },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

// Auth users (email + last sign-in), merged with staff rows server-side —
// surfaces logins that don't have a staff record yet.
export async function adminListUsers() {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'list-users' },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data?.users || []
}

// Set a new temporary password for an existing login.
export async function adminResetPassword(userId, password) {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'reset-password', userId, password },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

// All active clinics for the closer's dispensing-location picker.
export async function loadActiveClinics() {
  const { data, error } = await supabase
    .from('clinics')
    .select('id, name, clinic_code, address, phone')
    .eq('active', true)
    .order('name')
  if (error) { console.error('loadActiveClinics:', error); return [] }
  return data || []
}

// Providers serving a given clinic, via the cross-clinic SECURITY DEFINER
// resolver (so a closer homed to one clinic can read another clinic's providers
// without a patient-data RLS hole). Returns [{provider_id, full_name, licenses,
// signature_url, credentials}].
export async function getClinicProviders(clinicId) {
  const { data, error } = await supabase.rpc('get_clinic_providers', { p_clinic_id: clinicId })
  if (error) { console.error('getClinicProviders:', error); return [] }
  return data || []
}

// Price adjustment audit log (spec §6/§10). Routed through the
// log_price_adjustment SECURITY DEFINER RPC, which stamps provider_id =
// auth.uid() server-side (so every adjustment is recorded under the real actor)
// and derives clinic_id from the patient — letting a traveling closer log an
// adjustment at an event clinic that isn't their home clinic, which the table's
// clinic-scoped RLS write check would otherwise block. Manager-auth columns are
// left inert (closers have unlimited discount authority, name attached).
// Returns the new log row id; throws on error so the caller can surface it.
export async function logPriceAdjustment({
  patientId,
  originalPrice,
  adjustedPrice,
  reasonCode,
  reasonText = null,
  productType = 'device',
  sku = null,
  purchaseId = null,
}) {
  const { data, error } = await supabase.rpc('log_price_adjustment', {
    p_patient_id: patientId,
    p_original_price: originalPrice,
    p_adjusted_price: adjustedPrice,
    p_reason_code: reasonCode,
    p_reason_text: reasonText,
    p_product_type: productType,
    p_sku: sku,
    p_purchase_id: purchaseId,
  })
  if (error) throw error
  return data
}

// The provider's own price-adjustment history (spec §6/§11 reflection tool).
// provider_id is stamped = auth.uid() by log_price_adjustment, and staff.id
// IS auth.uid() (getCurrentStaff joins on it), so the caller's staffId is the
// provider_id — a provider only ever sees their own rows here. Rows are sorted
// client-side: the table's timestamp column name isn't relied on (select *),
// so this stays correct whether it's created_at or timestamp.
export async function loadPriceAdjustmentHistory(providerId, { limit = 500 } = {}) {
  if (!providerId) return []
  const { data, error } = await supabase
    .from('price_adjustment_log')
    .select('*')
    .eq('provider_id', providerId)
    .limit(limit)
  if (error) { console.error('loadPriceAdjustmentHistory:', error); return [] }
  return data || []
}


// Load all tier rows (one per device tier within a family) with their parent
// family fields denormalized onto each row for convenient consumption.
// Used by the Device Selection screen's recommendation engine and tier comparison.
export async function loadProductCatalogTiers() {
  const { data, error } = await supabase
    .from('product_catalog_tier')
    .select(`
      id,
      product_catalog_id,
      tier_name,
      tier_rank,
      msrp,
      platform_chip,
      battery_type,
      rechargeable,
      streaming_protocols,
      ip_rating,
      telecoil,
      directional_mic,
      fitting_range_low_hz_db,
      fitting_range_high_hz_db,
      bundled_cc_plus_compatible,
      active,
      notes,
      product_catalog ( manufacturer, family, generation, display_generation )
    `)
    .eq('active', true)
    .order('tier_rank', { ascending: false })
  if (error) { console.error('loadProductCatalogTiers:', error); return [] }
  return (data || []).map(row => ({
    id:                       row.id,
    productCatalogId:         row.product_catalog_id,
    tierName:                 row.tier_name,
    tierRank:                 row.tier_rank,
    msrp:                     row.msrp != null ? Number(row.msrp) : null,
    platformChip:             row.platform_chip,
    batteryType:              row.battery_type,
    rechargeable:             row.rechargeable,
    streamingProtocols:       row.streaming_protocols || [],
    ipRating:                 row.ip_rating,
    telecoil:                 row.telecoil,
    directionalMic:           row.directional_mic,
    fittingRangeLowHzDb:      row.fitting_range_low_hz_db,
    fittingRangeHighHzDb:     row.fitting_range_high_hz_db,
    bundledCcPlusCompatible:  row.bundled_cc_plus_compatible,
    active:                   row.active,
    notes:                    row.notes,
    manufacturer:             row.product_catalog?.manufacturer,
    family:                   row.product_catalog?.family,
    generation:               row.product_catalog?.generation,
    // Patient-facing platform label. Falls back to `generation` for brands
    // where it isn't set. Rexton uses this to show "Reach"/"BiCore" instead of
    // the Signia IX/AX codes `generation` carries as a dome-resolution key (#28).
    displayGeneration:        row.product_catalog?.display_generation || row.product_catalog?.generation,
  }))
}


// Active rebates for the device-selection screen (spec §5 "Available Rebates").
// Returns promos that are flagged active AND inside their [active_from,active_to]
// window AND either corporate-wide (clinic_id null) or scoped to this clinic.
// Scope-to-device filtering (manufacturer / family / tier / patient attribute)
// happens client-side against the selected tier — see AvailableRebates in
// views/DeviceSelection.jsx. Empty today (Kurt seeds promos); the panel is
// conditional, so it stays hidden until a matching active promo exists.
export async function loadActiveRebates(clinicId) {
  const nowIso = new Date().toISOString()
  let q = supabase
    .from('rebate_promo')
    .select('*')
    .eq('active', true)
    .lte('active_from', nowIso)
    .gte('active_to', nowIso)
  // Corporate-default rows (clinic_id null) OR this clinic's own rows.
  q = clinicId ? q.or(`clinic_id.is.null,clinic_id.eq.${clinicId}`) : q.is('clinic_id', null)
  const { data, error } = await q
  if (error) { console.error('loadActiveRebates:', error); return [] }
  return (data || []).map(mapRebateRow)
}

// Shared rebate_promo row → camelCase mapper (loaders + editor).
function mapRebateRow(r) {
  return {
    id:                    r.id,
    clinicId:              r.clinic_id,
    name:                  r.name,
    type:                  r.type,
    scopeManufacturer:     r.scope_manufacturer,
    scopeDeviceFamily:     r.scope_device_family,
    scopeTierRank:         r.scope_tier_rank,
    scopePatientAttribute: r.scope_patient_attribute,
    discountType:          r.discount_type,
    discountValue:         r.discount_value != null ? Number(r.discount_value) : null,
    activeFrom:            r.active_from,
    activeTo:              r.active_to,
    active:                r.active,
  }
}

// ── Rebate editor CRUD (Admin → Rebates) ────────────────────────────────────
// The rebate_promo write policy is WITH CHECK (clinic_id = my_clinic_id()), so
// every write must be clinic-scoped — callers stamp clinicId. Corporate rows
// (clinic_id null) are readable but not writable here (surfaced read-only).

// All promos for the editor (active + inactive + expired), unlike
// loadActiveRebates which filters to the live window for the device screen.
export async function loadRebatePromos(clinicId) {
  let q = supabase.from('rebate_promo').select('*').order('active_to', { ascending: false })
  if (clinicId) q = q.or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
  const { data, error } = await q
  if (error) { console.error('loadRebatePromos:', error); return [] }
  return (data || []).map(mapRebateRow)
}

export async function saveRebatePromo(promo) {
  const row = {
    clinic_id:               promo.clinicId ?? null,
    name:                    promo.name,
    type:                    promo.type,
    scope_manufacturer:      promo.scopeManufacturer || null,
    scope_device_family:     promo.scopeDeviceFamily || null,
    scope_tier_rank:         promo.scopeTierRank ?? null,
    scope_patient_attribute: promo.scopePatientAttribute || null,
    discount_type:           promo.discountType,
    discount_value:          promo.discountValue,
    active_from:             promo.activeFrom,
    active_to:               promo.activeTo,
    active:                  promo.active !== false,
    updated_at:              new Date().toISOString(),
  }
  const res = promo.id
    ? await supabase.from('rebate_promo').update(row).eq('id', promo.id).select().single()
    : await supabase.from('rebate_promo').insert(row).select().single()
  if (res.error) throw new Error(res.error.message)
  return mapRebateRow(res.data)
}

export async function deleteRebatePromo(id) {
  const { error } = await supabase.from('rebate_promo').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// Load the curated legacy/competitor/trade-in device reference used by the
// old-vs-new comparator (views/DeviceComparison.jsx). Reads are open to every
// authenticated provider (RLS); falls back to the bundled default on error so
// the tool still works offline. Newest first — most trade-ins are recent.
export async function loadLegacyDevices() {
  const { data, error } = await supabase
    .from('legacy_device')
    .select('*')
    .eq('active', true)
    .order('release_year', { ascending: false })
  if (error || !data) { console.error('loadLegacyDevices:', error); return LEGACY_DEVICES_DEFAULT }
  return data.map(row => ({
    id:                row.id,
    manufacturer:      row.manufacturer,
    brand:             row.brand,
    model:             row.model,
    aliases:           row.aliases || [],
    releaseYear:       row.release_year,
    platform:          row.platform,
    originalTierLabel: row.original_tier_label,
    originalTierRank:  row.original_tier_rank,
    formFactors:       row.form_factors || [],
    channels:          row.channels,
    directionalMic:    row.directional_mic,
    rechargeable:      row.rechargeable,
    bluetoothStreaming:row.bluetooth_streaming,
    telecoil:          row.telecoil,
    ipRating:          row.ip_rating,
    notableFeatures:   row.notable_features || [],
    sourceUrl:         row.source_url,
    confidence:        row.confidence,
  }))
}


// ============================================================
// INTAKE QUEUE
// Replaces window.storage polling with Supabase realtime.
// ============================================================

// Write a completed intake from the kiosk
// Note: IntakeKiosk uses the anon key — the "anyone_insert_intakes"
// RLS policy allows unauthenticated inserts.
//
// IMPORTANT: no .select() on the insert. Supabase's PostgREST would
// issue RETURNING, which triggers a SELECT RLS check on the row — and
// anon has no SELECT policy on intakes (only staff do, scoped to their
// clinic). RETURNING as anon fails and Postgres reports the whole
// operation as "violates row-level security policy". We don't need the
// inserted row back anyway.
export async function submitIntake(answers, clinicId, explicitId = null) {
  // Caller may supply a UUID so the kiosk can archive the signed-intake PDF
  // under the same ID without needing RETURNING (which would trip RLS for the
  // anon role). If none is provided, we mint one client-side — the DB will
  // accept any UUID since the `id` column has no constraints beyond PK.
  const id = explicitId || (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : null)
  const row = {
    clinic_id: clinicId,
    answers,
    status: 'pending',
  }
  if (id) row.id = id
  const { error } = await supabase
    .from('intakes')
    .insert(row)
  if (error) throw error
  return id
}

// Mark an intake as accepted (called from Distil when provider accepts)
export async function acceptIntake(intakeId) {
  const { error } = await supabase
    .from('intakes')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', intakeId)
  if (error) console.error('acceptIntake:', error)
}

// Mint a patient-facing intake reference ID: MHC-YYYYMMDD-XXXXX (format is a
// fixed domain rule — do not change it). Random part uses crypto when
// available; a unique expression index on intakes backs this up, and the
// kiosk regenerates + retries on the (rare) same-day collision.
export function genIntakeId() {
  const d = new Date()
  const datePart = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let rand = ''
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(5)
    crypto.getRandomValues(buf)
    for (const n of buf) rand += alphabet[n % alphabet.length]
  } else {
    rand = Math.random().toString(36).substring(2,7).toUpperCase()
  }
  return `MHC-${datePart}-${rand}`
}

// Create a fresh intake row tagged source='provider' for a patient who
// did not submit through the kiosk. Used by the Health History wizard
// step's "Start a guided conversation" affordance — the provider then
// fills in the same fields with the patient verbally, and the engine
// can run on real intake signal instead of falling back to audio-only.
//
// Stored answers shape mirrors a kiosk submission's wrapper so the
// existing read/write logic in HealthHistory + IntakeResponsesAccordion
// works unchanged. consent is null because no patient signature exists.
export async function createProviderIntake(patientId, clinicId) {
  if (!patientId || !clinicId) throw new Error('createProviderIntake: patientId and clinicId required')
  const now = new Date()
  const intakeId = genIntakeId()
  const timestamp = now.toISOString()
  const wrapped = {
    _meta: { intakeId, submittedAt: timestamp, lang: 'en', status: 'accepted', source: 'provider' },
    answers: {},
    consent: null,
  }
  const { data, error } = await supabase
    .from('intakes')
    .insert({
      clinic_id:     clinicId,
      patient_id:    patientId,
      answers:       wrapped,
      provider_notes: {},
      status:        'accepted',
      source:        'provider',
      accepted_at:   timestamp,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Set intakes.patient_id after savePatient creates the patient record.
// Used by the device-selection recommendation engine to query intake
// responses by patient, and by the Health History wizard step to
// surface all prior intakes on the patient profile.
//
// Also backfills any patient_documents rows tied to this intake (e.g. the
// signed-intake PDF archived at kiosk submit time when no patient_id was
// known yet). The matching staff member's clinic must own the intake — RLS
// already enforces this on the update.
//
// `clinicId` is required and constrains both updates to rows in the
// caller's clinic so a stray API call can't cross-link a kiosk PDF to
// another clinic's patient.
export async function linkIntakeToPatient(intakeId, patientId, clinicId) {
  if (!intakeId || !patientId || !clinicId) return
  const { error } = await supabase
    .from('intakes')
    .update({ patient_id: patientId })
    .eq('id', intakeId)
    .eq('clinic_id', clinicId)
  if (error) console.error('linkIntakeToPatient:', error)

  // Best-effort backfill — failures here shouldn't block the intake link.
  const { error: docErr } = await supabase
    .from('patient_documents')
    .update({ patient_id: patientId })
    .eq('intake_id', intakeId)
    .eq('clinic_id', clinicId)
    .is('patient_id', null)
  if (docErr) console.error('linkIntakeToPatient: backfill patient_documents:', docErr)
}

// Load all intakes for a patient, newest first. Each submission is its own
// row — history is preserved and never overwritten. Used by the Health
// History wizard step and the patient-detail "Intake Responses" accordion.
export async function loadIntakesForPatient(patientId) {
  if (!patientId) return []
  const { data, error } = await supabase
    .from('intakes')
    .select('*')
    .eq('patient_id', patientId)
    .order('submitted_at', { ascending: false })
  if (error) { console.error('loadIntakesForPatient:', error); return [] }
  return (data || []).map(row => ({
    answers:         row.answers       || {},
    providerNotes:   row.provider_notes || {},
    motivationScore: row.motivation_score ?? null,
    softCommitment:  row.soft_commitment  || null,
    _meta: {
      intakeId:    row.id,
      patientId:   row.patient_id,
      status:      row.status,
      submittedAt: row.submitted_at,
      acceptedAt:  row.accepted_at || null,
    },
  }))
}

// Load the patient's most recent kiosk annual/upgrade check-in (backlog #23,
// kiosk side). Returns the structured upgradeReadiness object the kiosk wrote
// (satisfaction / environments / featureGaps / issues / notes — keys aligned
// with upgradeReadiness.js) so the UpgradeWizard REVIEW step can pre-fill from
// the patient's self-report. The intake must already be LINKED to the patient
// (patient_id set via the provider intake-queue accept step); an unlinked kiosk
// submission isn't visible here yet. Returns null when no upgrade intake exists.
export async function loadLatestUpgradeIntake(patientId) {
  if (!patientId) return null
  const { data, error } = await supabase
    .from('intakes')
    .select('id, answers, submitted_at')
    .eq('patient_id', patientId)
    .order('submitted_at', { ascending: false })
  if (error) { console.error('loadLatestUpgradeIntake:', error); return null }
  // intakes.answers wraps the kiosk payload: { _meta, answers, consent }.
  const row = (data || []).find(r => r?.answers?._meta?.intakeType === 'upgrade')
  if (!row) return null
  const readiness = row.answers?.answers?.upgradeReadiness || null
  return {
    intakeId:    row.id,
    submittedAt: row.submitted_at,
    refId:       row.answers?._meta?.intakeId || null,
    readiness,
  }
}

// ── Upgrade check-in handoff (backlog #23, Phase 2) ─────────────────────────
// Cross-device prefill: a provider mints a short single-use code in the CRM that
// the anonymous kiosk redeems to review last year's answers. The kiosk can't
// read patient data directly (anon, no SELECT), so the code carries a frozen
// payload (prior contact + last readiness) redeemed via the kiosk-upgrade-prefill
// edge function (service role). 8-char unambiguous alphabet (no 0/O/1/I/L), so a
// patient can read it off a screen without confusion.
function genCheckinCode() {
  const alpha = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const arr = new Uint32Array(8)
  crypto.getRandomValues(arr)
  let s = ''
  for (let i = 0; i < 8; i++) s += alpha[arr[i] % alpha.length]
  return s
}

// Provider-side (authenticated): build the prefill payload from the patient's
// current contact + most recent kiosk upgrade readiness, store it under a fresh
// code, and return the code + expiry for the front desk to read to the patient.
// 30-minute TTL, single-use (the edge function marks it consumed on redeem).
export async function createUpgradeCheckinSession(patientId, clinicId, staffId) {
  if (!patientId || !clinicId) throw new Error('createUpgradeCheckinSession: patientId and clinicId required')
  const { data: p, error: pErr } = await supabase
    .from('patients')
    .select('first_name, last_name, dob, phone, email')
    .eq('id', patientId)
    .single()
  if (pErr) throw pErr
  const prior = await loadLatestUpgradeIntake(patientId)
  const payload = {
    patient:   { firstName: p.first_name || '', lastName: p.last_name || '', dob: p.dob || '' },
    contact:   { mobilePhone: p.phone || '', email: p.email || '' },
    readiness: prior?.readiness || null,
  }
  // Retry on the rare code collision (unique constraint) with a fresh code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCheckinCode()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('kiosk_upgrade_sessions')
      .insert({ code, patient_id: patientId, clinic_id: clinicId, created_by: staffId || null, payload, expires_at: expiresAt })
    if (!error) return { code, expiresAt }
    if (error.code !== '23505') throw error // not a unique violation → real failure
  }
  throw new Error('Could not generate a unique check-in code. Please try again.')
}

// Kiosk-side (anon): redeem a code via the edge function. Returns
// { payload } on success or { error } (missing_code | not_found | already_used |
// expired | redeem_failed) so the kiosk can show a specific message.
export async function redeemUpgradeCheckinCode(code) {
  const clean = String(code || '').trim().toUpperCase()
  if (!clean) return { error: 'missing_code' }
  const { data, error } = await supabase.functions.invoke('kiosk-upgrade-prefill', { body: { code: clean } })
  if (error) {
    try {
      const body = await error.context?.json?.()
      if (body?.error) return { error: body.error }
    } catch { /* fall through to generic */ }
    console.error('redeemUpgradeCheckinCode:', error)
    return { error: 'redeem_failed' }
  }
  return data || { error: 'redeem_failed' }
}

// Patch a single answer field on an intake. Called per-field on blur
// from the Health History wizard step so the provider's clinical review
// edits persist without a Save button.
export async function updateIntakeAnswers(intakeId, answers) {
  if (!intakeId) return
  const { data, error } = await supabase
    .from('intakes')
    .update({ answers })
    .eq('id', intakeId)
    .select('patient_id')
    .single()
  if (error) { console.error('updateIntakeAnswers:', error); return }
  // Intake answers changed → invalidate cached tier recommendation.
  if (data?.patient_id) await supersedeRecommendationsForPatient(data.patient_id)
}

// Write the provider_notes JSONB object. Shape is keyed by intake field
// name, e.g. { "med_pain": "Discussed, left ear" }. Provider notes live
// alongside but separate from patient answers — answers remain the
// patient's immutable source of truth.
export async function updateIntakeProviderNotes(intakeId, providerNotes) {
  if (!intakeId) return
  const { error } = await supabase
    .from('intakes')
    .update({ provider_notes: providerNotes })
    .eq('id', intakeId)
  if (error) console.error('updateIntakeProviderNotes:', error)
}

// Patch the provider's Chapter 1 assessment fields (motivation 1-10 +
// soft-commitment enum). Captured during the Health History wizard step
// so downstream chapters and the personalization engine can read them
// off the most-recent intake. Pass only the fields you want to change.
export async function updateIntakeAssessment(intakeId, fields) {
  if (!intakeId) return
  const update = {}
  if ('motivationScore' in fields) update.motivation_score = fields.motivationScore
  if ('softCommitment'  in fields) update.soft_commitment  = fields.softCommitment
  if (Object.keys(update).length === 0) return
  const { error } = await supabase
    .from('intakes')
    .update(update)
    .eq('id', intakeId)
  if (error) console.error('updateIntakeAssessment:', error)
}

// Mark an intake as dismissed
export async function dismissIntake(intakeId) {
  const { error } = await supabase
    .from('intakes')
    .update({ status: 'dismissed' })
    .eq('id', intakeId)
  if (error) console.error('dismissIntake:', error)
}

// Load all pending intakes for the current clinic (initial load)
export async function loadPendingIntakes() {
  const { data, error } = await supabase
    .from('intakes')
    .select('*')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })
  if (error) { console.error('loadPendingIntakes:', error); return [] }
  // Normalize to the shape Distil's acceptIntake() expects
  return data.map(normalizeIntake)
}

// Subscribe to new intakes in realtime — replaces the 10-second polling loop.
// Returns an unsubscribe function — call it in your useEffect cleanup.
export function subscribeToIntakes(clinicId, onNewIntake) {
  const channel = supabase
    .channel('intakes-channel')
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'intakes',
        filter: `clinic_id=eq.${clinicId}`,
      },
      (payload) => {
        onNewIntake(normalizeIntake(payload.new))
      }
    )
    .subscribe()

  // Return cleanup function
  return () => supabase.removeChannel(channel)
}

// Normalize a Supabase intakes row into the shape Distil's UI expects
// (matches the _meta structure from the old window.storage intake format)
function normalizeIntake(row) {
  return {
    answers: row.answers || {},
    motivationScore: row.motivation_score ?? null,
    softCommitment:  row.soft_commitment  || null,
    _meta: {
      intakeId:    row.id,
      status:      row.status,
      submittedAt: row.submitted_at,
      acceptedAt:  row.accepted_at || null,
    },
  }
}


// ============================================================
// PATIENT DETAIL EDITS
// All updates go through Supabase and will trigger HIPAA audit_log triggers.
// ============================================================

// Update core patient contact fields
export async function updatePatientContact(patientId, fields) {
  const { error } = await supabase
    .from('patients')
    .update(fields)
    .eq('id', patientId)
  if (error) throw error
}

// Update (or insert) insurance coverage for a patient
export async function updateInsuranceCoverage(patientId, fields, coverageId) {
  if (coverageId) {
    const { error } = await supabase
      .from('insurance_coverage')
      .update(fields)
      .eq('id', coverageId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('insurance_coverage')
      .insert({ patient_id: patientId, ...fields })
    if (error) throw error
  }
}

// Update a device fitting row
export async function updateDeviceFitting(fittingId, fields) {
  const { error } = await supabase
    .from('device_fittings')
    .update(fields)
    .eq('id', fittingId)
  if (error) throw error
}

// Update a single device side (left or right)
export async function updateDeviceSide(sideId, fields) {
  const { error } = await supabase
    .from('device_sides')
    .update(fields)
    .eq('id', sideId)
  if (error) throw error
}


// ============================================================
// CAMPAIGN CONTENT LIBRARY
// ============================================================

export async function loadCampaignContent(clinicId) {
  const { data, error } = await supabase
    .from('campaign_content')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (error) { console.error('loadCampaignContent:', error); return [] }
  return data
}

export async function saveCampaignContent(item) {
  const row = {
    clinic_id:       item.clinic_id,
    content_type:    item.content_type,
    title:           item.title,
    body:            item.body          || null,
    url:             item.url           || null,
    thumbnail_url:   item.thumbnail_url || null,
    category:        item.category      || 'general',
    tags:            item.tags          || [],
    source_url:      item.source_url    || null,
    source_name:     item.source_name   || null,
    tone:            item.tone          || null,
    lifecycle_phase: item.lifecycle_phase || null,
    suggested_month: item.suggested_month || null,
    active:          item.active        ?? true,
    created_by:      item.created_by    || null,
    updated_at:      new Date().toISOString(),
  }
  if (item.id) {
    const { data, error } = await supabase.from('campaign_content').update(row).eq('id', item.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('campaign_content').insert(row).select().single()
  if (error) throw error
  return data
}

export async function deleteCampaignContent(id) {
  const { error } = await supabase
    .from('campaign_content')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error('deleteCampaignContent:', error)
}


// ============================================================
// CAMPAIGN TEMPLATES
// ============================================================

export async function loadCampaignTemplates(clinicId) {
  const { data, error } = await supabase
    .from('campaign_templates')
    .select(`*, campaign_steps(*, campaign_content(id, title, content_type, category))`)
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
  if (error) { console.error('loadCampaignTemplates:', error); return [] }
  return data.map(t => ({ ...t, campaign_steps: (t.campaign_steps || []).sort((a, b) => a.step_order - b.step_order) }))
}

export async function saveCampaignTemplate(template) {
  const row = {
    clinic_id:    template.clinic_id,
    name:         template.name,
    description:  template.description || null,
    trigger_type: template.trigger_type,
    active:       template.active ?? true,
    created_by:   template.created_by || null,
    updated_at:   new Date().toISOString(),
  }
  if (template.id) {
    const { data, error } = await supabase.from('campaign_templates').update(row).eq('id', template.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('campaign_templates').insert(row).select().single()
  if (error) throw error
  return data
}

export async function saveCampaignSteps(templateId, steps) {
  const { error: delError } = await supabase.from('campaign_steps').delete().eq('template_id', templateId)
  if (delError) console.error('delete campaign_steps:', delError)
  if (!steps.length) return
  const rows = steps.map((s, i) => ({
    template_id: templateId, content_id: s.content_id,
    step_order: i + 1, delay_days: s.delay_days, delivery_channel: s.delivery_channel,
  }))
  const { error } = await supabase.from('campaign_steps').insert(rows)
  if (error) console.error('insert campaign_steps:', error)
}


// ============================================================
// PATIENT CAMPAIGNS (Enrollment & Tracking)
// ============================================================

// Load all campaign enrollments for a patient, with deliveries and step metadata
export async function enrollPatientInCampaign(patientId, templateId, triggerDate, staffId) {
  const { data: enrollment, error: enrollError } = await supabase
    .from('patient_campaigns')
    .insert({
      patient_id:  patientId,
      template_id: templateId,
      trigger_date: triggerDate,
      enrolled_by: staffId,
    })
    .select()
    .single()
  if (enrollError) throw enrollError

  const { data: steps, error: stepsError } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('template_id', templateId)
    .order('step_order')
  if (stepsError) { console.error('load steps for enrollment:', stepsError); return enrollment }

  if (steps.length) {
    const trigger = new Date(triggerDate)
    const deliveryRows = steps.map(step => {
      const scheduled = new Date(trigger)
      scheduled.setDate(scheduled.getDate() + step.delay_days)
      return {
        patient_campaign_id: enrollment.id,
        step_id:             step.id,
        scheduled_date:      scheduled.toISOString().split('T')[0],
        status:              'pending',
      }
    })
    const { error } = await supabase.from('campaign_deliveries').insert(deliveryRows)
    if (error) console.error('insert campaign_deliveries:', error)
  }

  return enrollment
}

export async function loadPatientCampaigns(patientId) {
  const { data, error } = await supabase
    .from('patient_campaigns')
    .select(`
      *,
      campaign_templates(id, name, trigger_type),
      campaign_deliveries(
        *,
        campaign_steps(
          step_order, delay_days, delivery_channel,
          campaign_content(id, title, content_type, category)
        )
      )
    `)
    .eq('patient_id', patientId)
    .order('enrolled_at', { ascending: false })
  if (error) { console.error('loadPatientCampaigns:', error); return [] }
  return data
}

// Update campaign status or trigger_date
export async function updatePatientCampaign(campaignId, fields) {
  const { error } = await supabase
    .from('patient_campaigns')
    .update(fields)
    .eq('id', campaignId)
  if (error) throw error
}

// Update the scheduled_date of a single campaign delivery
export async function updateDeliveryDate(deliveryId, scheduledDate) {
  const { error } = await supabase
    .from('campaign_deliveries')
    .update({ scheduled_date: scheduledDate })
    .eq('id', deliveryId)
  if (error) throw error
}

export async function loadAllActiveCampaigns() {
  const { data, error } = await supabase
    .from('patient_campaigns')
    .select(`
      *,
      patients(id, first_name, last_name),
      campaign_templates(id, name),
      campaign_deliveries(id, scheduled_date, status)
    `)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false })
  if (error) { console.error('loadAllActiveCampaigns:', error); return [] }
  return data
}

export async function pauseCampaign(campaignId) {
  const { error } = await supabase
    .from('patient_campaigns')
    .update({ status: 'paused' })
    .eq('id', campaignId)
  if (error) console.error('pauseCampaign:', error)
}

export async function resumeCampaign(campaignId) {
  const { error } = await supabase
    .from('patient_campaigns')
    .update({ status: 'active' })
    .eq('id', campaignId)
  if (error) console.error('resumeCampaign:', error)
}

export async function cancelCampaign(campaignId) {
  const { error } = await supabase
    .from('patient_campaigns')
    .update({ status: 'cancelled' })
    .eq('id', campaignId)
  if (error) console.error('cancelCampaign:', error)
}


// ============================================================
// CAMPAIGN DELIVERIES
// ============================================================

export async function loadPendingDeliveries() {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('campaign_deliveries')
    .select(`
      *,
      campaign_steps(
        delivery_channel,
        campaign_content(*)
      ),
      patient_campaigns(
        patient_id,
        patients(id, first_name, last_name, email, phone)
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_date', today)
  if (error) { console.error('loadPendingDeliveries:', error); return [] }
  return data
}

export async function markDelivered(deliveryId) {
  const { error } = await supabase
    .from('campaign_deliveries')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', deliveryId)
  if (error) console.error('markDelivered:', error)
}

export async function markFailed(deliveryId, errorMessage) {
  const { error } = await supabase
    .from('campaign_deliveries')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('id', deliveryId)
  if (error) console.error('markFailed:', error)
}

export async function recordEngagement(deliveryId, engagementData) {
  const { error } = await supabase
    .from('campaign_deliveries')
    .update({ engagement: engagementData })
    .eq('id', deliveryId)
  if (error) console.error('recordEngagement:', error)
}


// ============================================================
// LIMA CHARLIE
// ============================================================

export async function loadDonationStatus(patientId) {
  const { data, error } = await supabase
    .from('lima_charlie_donations')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) { console.error('loadDonationStatus:', error); return null }
  return data
}

export async function updateDonationIntent(patientId, fittingId, intentStatus) {
  const { data: existing } = await supabase
    .from('lima_charlie_donations')
    .select('id')
    .eq('patient_id', patientId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('lima_charlie_donations')
      .update({
        intent_status: intentStatus,
        intent_date:   new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('lima_charlie_donations')
    .insert({
      patient_id:    patientId,
      fitting_id:    fittingId,
      intent_status: intentStatus,
      intent_date:   new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function loadDonationCandidates() {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      id, first_name, last_name,
      device_fittings(id, fitting_date, warranty_expiry, created_at),
      lima_charlie_donations(id, intent_status, intent_date, donation_date, recipient_id)
    `)
  if (error) { console.error('loadDonationCandidates:', error); return [] }

  // A patient may now have multiple fittings (one per visit). Donation
  // candidacy keys off the CURRENT aids — the newest fitting's warranty.
  const now = new Date()
  return data
    .filter(p => pickNewest(p.device_fittings)?.warranty_expiry)
    .map(p => {
      const fitting = pickNewest(p.device_fittings)
      const expiry = new Date(fitting.warranty_expiry)
      const daysLeft = Math.ceil((expiry - now) / 86400000)
      const donation = p.lima_charlie_donations?.[0] || null
      return {
        id:           p.id,
        name:         [p.first_name, p.last_name].filter(Boolean).join(' '),
        fittingId:    fitting.id,
        fittingDate:  fitting.fitting_date,
        warrantyExpiry: fitting.warranty_expiry,
        daysLeft,
        intentStatus: donation?.intent_status || 'none',
        intentDate:   donation?.intent_date || null,
        donationId:   donation?.id || null,
      }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export async function loadRecipients() {
  const { data, error } = await supabase
    .from('lima_charlie_recipients')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) { console.error('loadRecipients:', error); return [] }
  return data
}

export async function saveRecipient(recipient) {
  if (recipient.id) {
    const { data, error } = await supabase
      .from('lima_charlie_recipients')
      .update({
        first_name: recipient.first_name,
        last_name:  recipient.last_name,
        branch:     recipient.branch || null,
        notes:      recipient.notes  || null,
      })
      .eq('id', recipient.id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase
    .from('lima_charlie_recipients')
    .insert({
      first_name: recipient.first_name,
      last_name:  recipient.last_name,
      branch:     recipient.branch || null,
      notes:      recipient.notes  || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function matchDonation(donationId, recipientId) {
  const { error: dErr } = await supabase
    .from('lima_charlie_donations')
    .update({
      intent_status: 'matched',
      recipient_id:  recipientId,
      donation_date: new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    })
    .eq('id', donationId)
  if (dErr) throw dErr

  const { error: rErr } = await supabase
    .from('lima_charlie_recipients')
    .update({
      status:              'matched',
      matched_donation_id: donationId,
    })
    .eq('id', recipientId)
  if (rErr) throw rErr
}


// ============================================================
// AIDED PATIENT FEED (consumed by patient-facing app)
// ============================================================

export async function loadPatientFeed(patientId) {
  const { data: campaigns } = await supabase
    .from('patient_campaigns')
    .select('id')
    .eq('patient_id', patientId)
  if (!campaigns?.length) return []

  const campaignIds = campaigns.map(c => c.id)
  const { data: deliveries, error } = await supabase
    .from('campaign_deliveries')
    .select(`
      id, scheduled_date, delivered_at, status, engagement,
      campaign_steps(
        delay_days, delivery_channel,
        campaign_content(id, content_type, title, body, url, thumbnail_url, category)
      )
    `)
    .in('patient_campaign_id', campaignIds)
    .eq('status', 'delivered')
    .order('delivered_at', { ascending: false })
  if (error) { console.error('loadPatientFeed:', error); return [] }
  return deliveries || []
}


// ============================================================
// SEED: Default Campaign from Content Calendar Spreadsheet
// ============================================================

export async function seedDefaultCampaign(clinicId, staffId) {
  // Check if already seeded
  const { data: existing } = await supabase
    .from('campaign_templates')
    .select('id')
    .eq('name', 'Standard Hearing Care Journey')
    .eq('clinic_id', clinicId)
    .maybeSingle()
  if (existing) return existing

  // 1. Insert all 115 content items
  const contentByN = {}
  for (const item of CONTENT_LIBRARY) {
    const { data, error } = await supabase
      .from('campaign_content')
      .insert({
        clinic_id:       clinicId,
        content_type:    item.type,
        title:           item.title,
        body:            item.body || null,
        category:        item.cat,
        source_url:      item.url || null,
        source_name:     item.src || null,
        tone:            item.tone || null,
        lifecycle_phase: item.phase || null,
        suggested_month: item.month || null,
        active:          true,
        created_by:      staffId,
      })
      .select()
      .single()
    if (error) { console.error('seed content item ' + item.n + ':', error); continue }
    contentByN[item.n] = data.id
  }

  // 2. Create the campaign template
  const { data: template, error: tErr } = await supabase
    .from('campaign_templates')
    .insert({
      clinic_id:    clinicId,
      name:         'Standard Hearing Care Journey',
      description:  '60-month lifecycle: onboarding, education, maintenance, Lima Charlie donation program, and upgrade path',
      trigger_type: 'fitting_date',
      active:       true,
      created_by:   staffId,
    })
    .select()
    .single()
  if (tErr) { console.error('seed template:', tErr); return null }

  // 3. Build campaign steps from the 60-month timeline
  // Match timeline entries to content items by title substring
  const contentList = Object.entries(contentByN).map(([n, id]) => ({
    n: parseInt(n),
    id,
    title: CONTENT_LIBRARY.find(c => c.n === parseInt(n))?.title || '',
  }))

  const findContentId = (sendTitle) => {
    if (!sendTitle) return null
    const clean = sendTitle.replace(/\s*\(.*?\)\s*$/, '').trim().toLowerCase()
    const match = contentList.find(c => c.title.toLowerCase().includes(clean) || clean.includes(c.title.toLowerCase()))
    return match?.id || null
  }

  const channelFromType = (type) => {
    const map = { push: 'push', article: 'in_app', email: 'email', sms: 'sms', video: 'in_app' }
    return map[type] || 'in_app'
  }

  const stepRows = []
  let stepOrder = 0
  for (const t of CAMPAIGN_TIMELINE) {
    const delayDays = t.month * 30

    // Primary send
    const priContentId = findContentId(t.pri)
    if (priContentId) {
      stepOrder++
      stepRows.push({
        template_id:      template.id,
        content_id:       priContentId,
        step_order:       stepOrder,
        delay_days:       delayDays,
        delivery_channel: channelFromType(t.priType),
      })
    }

    // Secondary send (offset by 3 days)
    if (t.sec) {
      const secContentId = findContentId(t.sec)
      if (secContentId) {
        stepOrder++
        stepRows.push({
          template_id:      template.id,
          content_id:       secContentId,
          step_order:       stepOrder,
          delay_days:       delayDays + 3,
          delivery_channel: channelFromType(t.secType),
        })
      }
    }
  }

  if (stepRows.length) {
    const { error: sErr } = await supabase.from('campaign_steps').insert(stepRows)
    if (sErr) console.error('seed steps:', sErr)
  }

  return template
}


// ============================================================
// BACKFILL: Enroll existing patients in default campaign
// ============================================================

export async function backfillCampaignEnrollment(clinicId, staffId) {
  const { data: template } = await supabase
    .from('campaign_templates')
    .select('id')
    .eq('name', 'Standard Hearing Care Journey')
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .maybeSingle()
  if (!template) return { enrolled: 0, skipped: 0, error: 'No default template found. Seed it first.' }

  const { data: patients } = await supabase
    .from('patients')
    .select('id, device_fittings(fitting_date)')
    .eq('clinic_id', clinicId)

  const { data: existingEnrollments } = await supabase
    .from('patient_campaigns')
    .select('patient_id')
    .eq('template_id', template.id)

  const enrolledSet = new Set((existingEnrollments || []).map(e => e.patient_id))

  let enrolled = 0
  let skipped = 0
  for (const p of (patients || [])) {
    // Earliest fitting = the original fit, which anchors the care-journey
    // cadence (a patient may now have multiple fittings across visits).
    const fitting = (p.device_fittings || [])
      .filter(f => f.fitting_date)
      .sort((a, b) => new Date(a.fitting_date) - new Date(b.fitting_date))[0]
    if (!fitting?.fitting_date) { skipped++; continue }
    if (enrolledSet.has(p.id)) { skipped++; continue }

    try {
      const enrollment = await enrollPatientInCampaign(p.id, template.id, fitting.fitting_date, staffId)

      const today = new Date().toISOString().split('T')[0]
      await supabase
        .from('campaign_deliveries')
        .update({ status: 'skipped' })
        .eq('patient_campaign_id', enrollment.id)
        .lt('scheduled_date', today)

      enrolled++
    } catch (e) {
      console.error('backfill patient ' + p.id + ':', e)
      skipped++
    }
  }

  return { enrolled, skipped }
}


// ============================================================
// INSURANCE PLANS (from Supabase)
// ============================================================

// Look up the insurance_plans.id for a given carrier + plan_group + tier_label combo
export async function resolveInsurancePlanId(carrier, planGroup, tierLabel) {
  if (!carrier || !planGroup || !tierLabel) return null
  const { data, error } = await supabase
    .from('insurance_plans')
    .select('id')
    .eq('carrier', carrier)
    .eq('plan_group', planGroup)
    .eq('tier_label', tierLabel)
    .eq('active', true)
    .maybeSingle()
  if (error || !data) return null
  return data.id
}

// Canonical tier-label vocabulary + ordering for insurance plans. The wizard's
// private-label detection (isPrivateLabelPlan) and the device-driven TPAs' pricing
// (UHCH, Nations) key on these exact strings, so the plan editor constrains tier
// labels to this list instead of free text. TruHearing/UHCH labels come first
// (their historical order); Nations' own 4 unique rungs are appended so they're
// selectable and sortable. Nations shares 'Standard'/'Advanced' with the leading
// set, so within a Nations plan those two sort by their leading-set index — a
// cosmetic quirk only (Nations is device-driven, so no provider tier-pick UI
// depends on this order; deriveEarPrice matches tiers by label, not position).
export const PLAN_TIER_LABELS = ['Standard', 'Advanced', 'Premium', 'Gold', 'Platinum', 'Select', 'Superior Plus', 'Advanced Plus', 'Specialty']
const tierOrder = (label) => {
  const i = PLAN_TIER_LABELS.indexOf(label)
  return i === -1 ? PLAN_TIER_LABELS.length : i
}

// retail_anchor_key derivation for TruHearing rows (same mapping as migration
// 018). UHCH and TPA-less rows deliberately carry no anchor — Relate has no
// street retail to anchor against.
const TIER_ANCHOR_BY_LABEL = { Premium: 'select', Advanced: 'advanced', Standard: 'standard' }

// All insurance_plans rows (active and inactive) grouped into the wizard's
// plan shape: one entry per carrier+planGroup with a tiers array, prices in
// DOLLARS (the table stores cents). Mirrors the inline INSURANCE_PLANS
// fallback const in Distil.jsx. A group is "active" if any of its rows is;
// saves write the flag uniformly so a mixed group self-heals on next save.
export async function loadInsurancePlansGrouped() {
  const { data, error } = await supabase
    .from('insurance_plans')
    .select('id, carrier, plan_group, tpa, tier_label, price_per_aid, retail_anchor_key, notes, active')
    .order('carrier')
    .order('plan_group')
  if (error) throw error
  const byKey = new Map()
  for (const row of (data || [])) {
    const key = `${row.carrier}|${row.plan_group}`
    if (!byKey.has(key)) {
      byKey.set(key, {
        carrier:   row.carrier,
        planGroup: row.plan_group,
        tpa:       row.tpa || '',
        notes:     row.notes || '',
        active:    false,
        tiers:     [],
      })
    }
    const plan = byKey.get(key)
    if (row.active) plan.active = true
    if (row.notes && !plan.notes) plan.notes = row.notes
    plan.tiers.push({
      id:    row.id,
      label: row.tier_label,
      price: row.price_per_aid != null ? row.price_per_aid / 100 : null,
      retailAnchorKey: row.retail_anchor_key || null,
    })
  }
  const plans = [...byKey.values()]
  for (const p of plans) p.tiers.sort((a, b) => tierOrder(a.label) - tierOrder(b.label))
  return plans
}

// Map an editor plan draft to insurance_plans rows (one per tier). Prices
// arrive in dollars and are stored as integer cents; anchor keys are derived,
// never user-entered.
function toInsurancePlanRows(plan) {
  return (plan.tiers || [])
    .filter(t => t.label && t.price !== null && t.price !== '' && !Number.isNaN(Number(t.price)))
    .map(t => ({
      ...(t.id ? { id: t.id } : {}),
      carrier:           plan.carrier.trim(),
      plan_group:        plan.planGroup.trim(),
      tpa:               plan.tpa || null,
      tier_label:        t.label,
      price_per_aid:     Math.round(Number(t.price) * 100),
      retail_anchor_key: plan.tpa === 'TruHearing' ? (TIER_ANCHOR_BY_LABEL[t.label] || null) : null,
      notes:             plan.notes || null,
      active:            plan.active !== false,
    }))
}

// Translate the two constraint errors the editor can hit into provider-readable
// messages; anything else passes through.
function friendlyPlanError(error) {
  if (error?.code === '23503') return new Error('A patient is linked to this plan — deactivate it instead of deleting.')
  if (error?.code === '23505') return new Error('An active plan with this carrier, plan group, and tier already exists.')
  return error
}

// Upsert one plan group's tier rows and delete rows the editor removed.
// `origRowIds` is the set of row ids the group had when editing began —
// identity travels with row ids, so carrier/planGroup renames update rows in
// place instead of orphaning them. Admin only (RLS admin_manage_plans).
// Throws on error. Returns the saved rows' { id, tier_label } so callers can
// refresh draft ids after inserts.
export async function saveInsurancePlanGroup(plan, origRowIds = []) {
  const rows = toInsurancePlanRows(plan)
  if (!rows.length) throw new Error('A plan needs at least one tier with a copay.')
  const keptIds = new Set(rows.map(r => r.id).filter(Boolean))
  const toDelete = (origRowIds || []).filter(id => !keptIds.has(id))
  if (toDelete.length) {
    const { error } = await supabase.from('insurance_plans').delete().in('id', toDelete)
    if (error) { console.error('saveInsurancePlanGroup delete:', error); throw friendlyPlanError(error) }
  }
  // Existing rows and new rows go in separate calls: PostgREST bulk writes
  // need uniform keys, and new rows must omit `id` to get the column default.
  const existing = rows.filter(r => r.id)
  const fresh    = rows.filter(r => !r.id)
  const saved = []
  if (existing.length) {
    const { data, error } = await supabase
      .from('insurance_plans').upsert(existing, { onConflict: 'id' }).select('id, tier_label')
    if (error) { console.error('saveInsurancePlanGroup upsert:', error); throw friendlyPlanError(error) }
    saved.push(...(data || []))
  }
  if (fresh.length) {
    const { data, error } = await supabase
      .from('insurance_plans').insert(fresh).select('id, tier_label')
    if (error) { console.error('saveInsurancePlanGroup insert:', error); throw friendlyPlanError(error) }
    saved.push(...(data || []))
  }
  return saved
}

// Delete all rows of a plan group. Blocked by the insurance_coverage FK when a
// patient is linked — surfaced as a deactivate hint. Admin only. Throws.
export async function deleteInsurancePlanGroup(rowIds) {
  if (!rowIds?.length) return
  const { error } = await supabase.from('insurance_plans').delete().in('id', rowIds)
  if (error) { console.error('deleteInsurancePlanGroup:', error); throw friendlyPlanError(error) }
}


// ============================================================
// PRICING REVEAL
// ============================================================

export async function loadRetailAnchors(clinicId, manufacturerClass = 'signia') {
  const { data, error } = await supabase
    .from('clinic_retail_anchors')
    .select('id, label, price_per_aid, sort_order, manufacturer_class')
    .eq('clinic_id', clinicId)
    .eq('manufacturer_class', manufacturerClass)
    .order('sort_order')
  if (error) return []
  return data || []
}

// Single-query alternative to N calls of loadRetailAnchors() — returns
// an object keyed by manufacturer_class, each value an array of rows
// already sorted by sort_order. Used by the per-ear pricing path which
// needs to resolve a private-pay fitting against the *device's*
// manufacturer class (signia/phonak/oticon/...) rather than the legacy
// single-class default.
export async function loadAllRetailAnchors(clinicId) {
  const { data, error } = await supabase
    .from('clinic_retail_anchors')
    .select('id, label, price_per_aid, sort_order, manufacturer_class')
    .eq('clinic_id', clinicId)
    .order('manufacturer_class')
    .order('sort_order')
  if (error) { console.error('loadAllRetailAnchors:', error); return {} }
  const byClass = {}
  for (const row of (data || [])) {
    const k = row.manufacturer_class
    if (!byClass[k]) byClass[k] = []
    byClass[k].push(row)
  }
  return byClass
}

export async function saveRetailAnchors(clinicId, manufacturerClass, anchors) {
  // Get existing rows for this clinic + manufacturer class
  const { data: existing, error: exErr } = await supabase
    .from('clinic_retail_anchors')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('manufacturer_class', manufacturerClass)
  if (exErr) { console.error('saveRetailAnchors scan:', exErr); return { success: false, error: exErr } }

  const wantedIds = new Set((anchors || []).filter(a => a.id).map(a => a.id))
  const toDelete = (existing || []).filter(r => !wantedIds.has(r.id)).map(r => r.id)
  if (toDelete.length) {
    const { error: delErr } = await supabase
      .from('clinic_retail_anchors')
      .delete()
      .in('id', toDelete)
    if (delErr) { console.error('saveRetailAnchors delete:', delErr); return { success: false, error: delErr } }
  }

  // Generate client-side UUIDs for new rows. The clinic_retail_anchors.id
  // column doesn't have a server-side default, so omitting id causes the
  // insert to silently fail (NOT NULL violation hidden by error logging).
  const rows = (anchors || [])
    .filter(a => a.label && a.label.trim())
    .map((a, i) => ({
      id:                 a.id || crypto.randomUUID(),
      clinic_id:          clinicId,
      manufacturer_class: manufacturerClass,
      label:              a.label,
      price_per_aid:      a.price_per_aid != null && a.price_per_aid !== '' ? Number(a.price_per_aid) : null,
      sort_order:         i + 1,
    }))
  if (rows.length) {
    const { error: upErr } = await supabase
      .from('clinic_retail_anchors')
      .upsert(rows)
    if (upErr) { console.error('saveRetailAnchors upsert:', upErr); return { success: false, error: upErr } }
  }
  return { success: true }
}

export async function loadPricingReveal(clinicId, patientId) {
  const { data, error } = await supabase
    .from('insurance_coverage')
    .select(`
      tier_price_per_aid,
      tier,
      insurance_plan_id,
      insurance_plans (
        tier_label,
        retail_anchor_key
      )
    `)
    .eq('patient_id', patientId)
    .single()

  if (error || !data) return null

  const anchorKey = data.insurance_plans?.retail_anchor_key
  if (!anchorKey) return null

  // retail_anchor_key on insurance_plans points at one clinic's anchor row
  // (historically St. George). Other clinics carry copies of the same
  // anchors under new ids, so if the keyed row belongs to a different
  // clinic, re-resolve by label against the current clinic's set.
  let { data: anchor } = await supabase
    .from('clinic_retail_anchors')
    .select('clinic_id, label, price_per_aid')
    .eq('id', anchorKey)
    .eq('manufacturer_class', 'signia')
    .single()

  if (anchor && anchor.clinic_id !== clinicId) {
    const { data: localAnchor } = await supabase
      .from('clinic_retail_anchors')
      .select('clinic_id, label, price_per_aid')
      .eq('clinic_id', clinicId)
      .eq('manufacturer_class', 'signia')
      .eq('label', anchor.label)
      .maybeSingle()
    anchor = localAnchor || anchor
  }

  if (!anchor) return null

  // tier_price_per_aid is stored in cents (matches loadInsurancePlansGrouped /
  // loadAllPatients convention). Anchor price_per_aid is numeric dollars.
  const retailPerAid  = parseFloat(anchor.price_per_aid)
  const copayPerAid   = data.tier_price_per_aid != null ? data.tier_price_per_aid / 100 : null
  if (copayPerAid == null) return null
  const savingsPerAid = retailPerAid - copayPerAid
  const savingsPct    = Math.round((savingsPerAid / retailPerAid) * 100)

  return {
    anchorKey,
    tierLabel:    anchor.label,
    retailPerAid,
    copayPerAid,
    savingsPerAid,
    savingsPct,
  }
}


// ============================================================
// PURCHASE CONFIGURATION
// ============================================================

// Care plan catalog for a clinic — Complete Care+, punch card, pay-as-you-go.
// Zone 5 uses the Complete Care+ price for the bundled care-plan line item.
export async function loadCarePlanCatalog(clinicId) {
  const { data, error } = await supabase
    .from('care_plan_catalog')
    .select('plan_type, display_name, price, unit_label')
    .eq('clinic_id', clinicId)
    .eq('active', true)
  if (error) { console.error('loadCarePlanCatalog:', error); return [] }
  return (data || []).map(r => ({
    planType:    r.plan_type,
    displayName: r.display_name,
    price:       r.price != null ? Number(r.price) : null,
    unitLabel:   r.unit_label,
  }))
}

// Load the patient's current (non-finalized) purchase configuration and
// its line items, or null if none exists. Zone 5 of the device-selection
// screen restores an in-progress purchase from this.
export async function loadPurchaseConfiguration(patientId) {
  const { data: config, error } = await supabase
    .from('purchase_configuration')
    .select('id, bundle_mode, total_displayed_price, finalized')
    .eq('patient_id', patientId)
    .eq('finalized', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !config) return null

  const { data: items, error: itemsErr } = await supabase
    .from('purchase_line_item')
    .select('id, product_type, product_catalog_tier_id, care_plan_type, listed_price, adjusted_price, rebate_promo_id')
    .eq('purchase_id', config.id)
  if (itemsErr) console.error('loadPurchaseConfiguration items:', itemsErr)

  return {
    id:                  config.id,
    bundleMode:          config.bundle_mode,
    totalDisplayedPrice: config.total_displayed_price != null ? Number(config.total_displayed_price) : null,
    finalized:           config.finalized,
    lineItems: (items || []).map(it => ({
      id:                   it.id,
      productType:          it.product_type,
      productCatalogTierId: it.product_catalog_tier_id,
      carePlanType:         it.care_plan_type,
      listedPrice:          it.listed_price != null ? Number(it.listed_price) : null,
      adjustedPrice:        it.adjusted_price != null ? Number(it.adjusted_price) : null,
      rebatePromoId:        it.rebate_promo_id,
    })),
  }
}

// Upsert the patient's draft purchase configuration and replace its line
// items. Returns { success, error, configId }. Follows the saveRetailAnchors
// delete-then-insert pattern. The config row is written first so its
// clinic_id satisfies the purchase_line_item RLS policy, which gates on the
// parent config's clinic.
export async function savePurchaseConfiguration(patientId, clinicId, { bundleMode, lineItems, totalDisplayedPrice }) {
  const { data: existing, error: exErr } = await supabase
    .from('purchase_configuration')
    .select('id')
    .eq('patient_id', patientId)
    .eq('finalized', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (exErr) { console.error('savePurchaseConfiguration scan:', exErr); return { success: false, error: exErr } }

  let configId = existing?.id
  if (configId) {
    const { error: upErr } = await supabase
      .from('purchase_configuration')
      .update({
        bundle_mode:           bundleMode,
        total_displayed_price: totalDisplayedPrice,
        updated_at:            new Date().toISOString(),
      })
      .eq('id', configId)
    if (upErr) { console.error('savePurchaseConfiguration update:', upErr); return { success: false, error: upErr } }
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('purchase_configuration')
      .insert({
        patient_id:            patientId,
        clinic_id:             clinicId,
        bundle_mode:           bundleMode,
        total_displayed_price: totalDisplayedPrice,
      })
      .select('id')
      .single()
    if (insErr || !inserted) { console.error('savePurchaseConfiguration insert:', insErr); return { success: false, error: insErr } }
    configId = inserted.id
  }

  const { error: delErr } = await supabase
    .from('purchase_line_item')
    .delete()
    .eq('purchase_id', configId)
  if (delErr) { console.error('savePurchaseConfiguration delete items:', delErr); return { success: false, error: delErr } }

  const rows = (lineItems || []).map(li => ({
    purchase_id:             configId,
    product_type:            li.productType,
    product_catalog_tier_id: li.productCatalogTierId || null,
    care_plan_type:          li.carePlanType || null,
    listed_price:            li.listedPrice,
  }))
  if (rows.length) {
    const { error: itemsErr } = await supabase
      .from('purchase_line_item')
      .insert(rows)
    if (itemsErr) { console.error('savePurchaseConfiguration insert items:', itemsErr); return { success: false, error: itemsErr } }
  }
  return { success: true, configId }
}


// ============================================================
// TNS OUTCOMES
// ============================================================

export async function loadTnsOutcomes() {
  const { data, error } = await supabase
    .from('tns_outcomes')
    .select('patient_id, outcome_reasons')
  if (error) { console.error('loadTnsOutcomes:', error); return [] }
  return data
}

export async function updatePatientStatus(patientId, status) {
  const { error } = await supabase
    .from('patients')
    .update({ patient_status: status, status_updated_at: new Date().toISOString() })
    .eq('id', patientId)
  if (error) throw error
}

export async function saveTnsOutcome(patientId, clinicId, staffId, reasons, notes) {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    throw new Error('saveTnsOutcome: reasons must be a non-empty array')
  }
  const { error } = await supabase.from('tns_outcomes').insert({
    patient_id:      patientId,
    clinic_id:       clinicId,
    logged_by:       staffId,
    outcome_reasons: reasons,
    outcome_notes:   notes || null,
  })
  if (error) throw error
}

export async function convertTnsToActive(patientId, warrantyYears = 3) {
  const fittingDate = new Date().toISOString().split('T')[0]
  const expiry = new Date()
  expiry.setFullYear(expiry.getFullYear() + warrantyYears)
  const warrantyExpiry = expiry.toISOString().split('T')[0]

  const { error: pErr } = await supabase.from('patients').update({
    patient_status: 'active',
    status_updated_at: new Date().toISOString(),
  }).eq('id', patientId)
  if (pErr) throw pErr

  const { error: fErr } = await supabase.from('device_fittings').update({
    fitting_date: fittingDate,
    warranty_expiry: warrantyExpiry,
  }).eq('patient_id', patientId)
  if (fErr) throw fErr
}


// ============================================================
// RECOMMENDATION ENGINE (Device Selection & Pricing Screen v1)
// ============================================================

// Default Signia flagship family. IX covers ranks 3–5; AX covers entry
// tiers (1–2) not yet available in the current IX generation.
const SIGNIA_FAMILY_BY_RANK = {
  5: 'sig-pure-ix',
  4: 'sig-pure-ix',
  3: 'sig-pure-ix',
  2: 'sig-pure-ax',
  1: 'sig-pure-ax',
}

export async function loadPatientRecommendationInputs(patientId) {
  const { data: audiogram } = await supabase
    .from('audiograms')
    .select('*')
    .eq('patient_id', patientId)
    .order('test_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  let thresholds = []
  if (audiogram?.id) {
    const { data } = await supabase
      .from('audiogram_thresholds')
      .select('ear, frequency, threshold_db, test_type, is_masked')
      .eq('audiogram_id', audiogram.id)
    thresholds = data || []
  }

  const { data: intake } = await supabase
    .from('intakes')
    .select('answers, accepted_at')
    .eq('patient_id', patientId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    audiogram:     audiogram || null,
    thresholds,
    intakeAnswers: intake?.answers || null,
  }
}

export async function generateRecommendation(patientId, clinicId) {
  const inputs = await loadPatientRecommendationInputs(patientId)
  const result = runRecommendationEngine(
    inputs.audiogram,
    inputs.thresholds,
    inputs.intakeAnswers,
  )

  if (result.blocked) return { blocked: true, reason: result.reason }

  const familyId = SIGNIA_FAMILY_BY_RANK[result.recommendedRank]
  let tierId = null
  if (familyId) {
    const { data: tier } = await supabase
      .from('product_catalog_tier')
      .select('id')
      .eq('product_catalog_id', familyId)
      .eq('tier_rank', result.recommendedRank)
      .eq('active', true)
      .maybeSingle()
    tierId = tier?.id || null
  }

  // Supersede any currently active recommendation before inserting
  await supabase
    .from('recommendation_engine_output')
    .update({ superseded_at: new Date().toISOString() })
    .eq('patient_id', patientId)
    .is('superseded_at', null)

  const { data: output, error } = await supabase
    .from('recommendation_engine_output')
    .insert({
      patient_id:                          patientId,
      clinic_id:                           clinicId,
      recommended_tier_rank:               result.recommendedRank,
      recommended_product_catalog_tier_id: tierId,
      down_tier_score:                     result.downTierScore,
      contributing_inputs: {
        score:  result.downTierScore,
        inputs: result.contributingInputs,
        audio:  result.normalizedInputs.audio,
        intake: result.normalizedInputs.intake,
      },
      generated_rationale_text:            result.rationale,
    })
    .select()
    .single()

  if (error) {
    console.error('generateRecommendation:', error)
    return { blocked: true, reason: error.message }
  }
  return output
}

export async function loadCurrentRecommendation(patientId) {
  const { data } = await supabase
    .from('recommendation_engine_output')
    .select('*')
    .eq('patient_id', patientId)
    .is('superseded_at', null)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

// Mark all current recommendation rows for a patient as superseded.
// Called from updatePatientAudiology and updateIntakeAnswers so the
// next visit to the tier step regenerates against the fresh inputs
// instead of serving the cached row from before the change.
export async function supersedeRecommendationsForPatient(patientId) {
  if (!patientId) return
  const { error } = await supabase
    .from('recommendation_engine_output')
    .update({ superseded_at: new Date().toISOString() })
    .eq('patient_id', patientId)
    .is('superseded_at', null)
  if (error) console.error('supersedeRecommendationsForPatient:', error)
}

export async function saveProviderEditedRationale(recOutputId, text) {
  const value = typeof text === 'string' && text.trim().length > 0 ? text : null
  const { error } = await supabase
    .from('recommendation_engine_output')
    .update({ provider_edited_rationale_text: value })
    .eq('id', recOutputId)
  if (error) throw error
}

export async function loadPatientHeader(patientId) {
  const { data } = await supabase
    .from('patients')
    .select('id, first_name, last_name, dob, pay_type')
    .eq('id', patientId)
    .maybeSingle()
  return data || null
}

// Patient-has-TNS flag for Zone 1 clinical strip. Any row present → show warning.
// Also drives the patient-profile "TNS Reasons" display block — outcome_notes
// is included so the optional free-text note renders alongside the tag chips.
export async function loadPatientTnsFlag(patientId) {
  const { data } = await supabase
    .from('tns_outcomes')
    .select('outcome_reasons, outcome_notes, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}


// ============================================================
// NURTURE PERSONALIZATION
// ============================================================

// One-shot loader for everything the personalization profile builder needs.
// Returns null fields where data is missing — the builder tolerates partial
// inputs and degrades gracefully.
export async function loadPersonalizationInputs(patientId) {
  const [patientRes, audiogramRes, intakeRes, tnsRes] = await Promise.all([
    supabase.from('patients')
      .select('id, dob, pay_type, first_name, last_name, clinic_id')
      .eq('id', patientId).maybeSingle(),
    supabase.from('audiograms')
      .select('*')
      .eq('patient_id', patientId)
      .order('test_date', { ascending: false })
      .limit(1).maybeSingle(),
    supabase.from('intakes')
      .select('answers, accepted_at, motivation_score, soft_commitment')
      .eq('patient_id', patientId)
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: false })
      .limit(1).maybeSingle(),
    supabase.from('tns_outcomes')
      .select('outcome_reasons, outcome_notes, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle(),
  ])

  let thresholds = []
  if (audiogramRes.data?.id) {
    const { data } = await supabase
      .from('audiogram_thresholds')
      .select('ear, frequency, threshold_db, test_type, is_masked')
      .eq('audiogram_id', audiogramRes.data.id)
    thresholds = data || []
  }

  return {
    patient:    patientRes.data || null,
    audiogram:  audiogramRes.data || null,
    thresholds,
    intake:     intakeRes.data || null,
    tnsOutcome: tnsRes.data || null,
  }
}
