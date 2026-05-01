// ============================================================
// db.js — Supabase data layer for Distil CRM
// Replaces all window.storage calls with Supabase queries.
// All functions maintain the same shape the UI already expects
// so Distil.jsx needs minimal changes.
// ============================================================

import { supabase } from './supabase.js'
import { CONTENT_LIBRARY, CAMPAIGN_TIMELINE } from './nurture_seed_data.js'
import { runRecommendationEngine } from './recommendationEngine.js'


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
    .select('*, clinics(*)')
    .eq('id', user.id)
    .single()
  if (error) return null
  return data
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
    .select('id, full_name, role, licenses, signature_url, clinics(id, name, address, phone)')
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

  const { error: uploadErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, blob, { contentType: 'application/pdf', upsert: false })
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
  return data.map(row => ({ ...row, signedUrl: urlByPath.get(row.storage_path) || null }))
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

// Reassemble DB row back into the flat patient shape Distil UI expects
function assemblePatient(row) {
  const coverage = row.insurance_coverage?.[0] || null
  const fitting  = row.device_fittings?.[0] || null
  const sides    = fitting?.device_sides || []
  const leftSide  = sides.find(s => s.ear === 'left')  || null
  const rightSide = sides.find(s => s.ear === 'right') || null
  const audiogram = row.audiograms?.[0] || null
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

    appointments: appts.map(a => ({
      date: a.appointment_date,
      type: a.appointment_type,
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

// Load all patients for the current clinic, assembled into UI shape
export async function loadAllPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select(`
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
    `)
    .order('created_at', { ascending: false })

  if (error) { console.error('loadAllPatients:', error); return [] }
  return data.map(assemblePatient)
}

// Save a new patient — decomposes the flat UI object into multiple tables
export async function savePatient(patient, staffId, clinicId) {
  const { first_name, last_name } = splitName(patient.name)

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
    })
    .select()
    .single()

  if (patientError) throw patientError

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
    if (error) console.error('insurance_coverage insert:', error)
  }

  // 3. Insert device fitting + sides
  if (patient.devices) {
    const fittingType = (patient.devices.fittingType || 'bilateral')
      .toLowerCase().replace('/', '_').replace(' ', '_')

    const { data: fittingRow, error: fittingError } = await supabase
      .from('device_fittings')
      .insert({
        patient_id:      patientRow.id,
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
      console.error('device_fittings insert:', fittingError)
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
        if (error) console.error('device_sides insert:', error)
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
        console.error('audiograms insert:', audioError)
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
          if (error) console.error('audiogram_thresholds insert:', error)
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
    if (error) console.error('appointments insert:', error)
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
      console.error('auto-enroll campaign:', e)
    }
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
export async function updatePatientAudiology(patientId, audiology, staffId) {
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

  // Delete existing audiogram + thresholds for this patient (re-save pattern)
  const { data: existing } = await supabase
    .from('audiograms')
    .select('id')
    .eq('patient_id', patientId)
  if (existing?.length) {
    for (const row of existing) {
      await supabase.from('audiogram_thresholds').delete().eq('audiogram_id', row.id)
    }
    await supabase.from('audiograms').delete().eq('patient_id', patientId)
  }

  const { data: audioRow, error: audioError } = await supabase
    .from('audiograms')
    .insert({
      patient_id:        patientId,
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
}

// Step 3 — save device fitting + sides for existing patient
export async function updatePatientDevices(patientId, devices, staffId) {
  if (!devices) return
  const fittingType = (devices.fittingType || 'bilateral')
    .toLowerCase().replace('/', '_').replace(' ', '_')

  // Delete existing fittings + sides (re-save)
  const { data: existing } = await supabase
    .from('device_fittings')
    .select('id')
    .eq('patient_id', patientId)
  if (existing?.length) {
    for (const row of existing) {
      await supabase.from('device_sides').delete().eq('fitting_id', row.id)
    }
    await supabase.from('device_fittings').delete().eq('patient_id', patientId)
  }

  const { data: fittingRow, error: fittingError } = await supabase
    .from('device_fittings')
    .insert({
      patient_id:      patientId,
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

// Final — promote draft to active/tns and set warranty/fitting info
export async function finalizePatient(patientId, status, devices, carePlan, notes, appointments, staffId, clinicId) {
  // Update patient status + notes
  const updates = { patient_status: status || 'active' }
  if (notes != null) updates.notes = notes
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
    const { error } = await supabase
      .from('device_fittings')
      .update(devUpdate)
      .eq('patient_id', patientId)
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

  // Insert appointments
  if (appointments?.length) {
    const apptRows = appointments.map(appt => ({
      patient_id:       patientId,
      clinic_id:        clinicId,
      staff_id:         staffId,
      appointment_date: appt.date,
      appointment_type: appt.type || null,
      status:           'scheduled',
    }))
    const { error } = await supabase.from('appointments').insert(apptRows)
    if (error) console.error('finalizePatient appointments:', error)
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
  const { error } = await supabase
    .from('punch_cards')
    .upsert({
      patient_id:   patientId,
      cleanings:    punchData.cleanings,
      appointments: punchData.appointments,
      log:          punchData.log || [],
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'patient_id' })
  if (error) console.error('savePunch:', error)
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
    notes:        row.notes        || '',
    tiers:        (row.product_catalog_tier || []).map(t => ({
      id:       t.id,
      tierName: t.tier_name,
      msrp:     t.msrp != null ? Number(t.msrp) : null,
    })),
  }))
}

export async function saveProductCatalog(catalogItems) {
  // Upsert all items — admin only (enforced by RLS)
  const rows = catalogItems.map(item => ({
    id:              item.id,
    manufacturer:    item.manufacturer,
    family:          item.family,
    generation:      item.generation      || null,
    styles:          item.styles          || [],
    tech_levels:     item.techLevels      || [],
    variants:        item.variants        || [],
    battery_options: item.battery         || [],
    colors:          item.colors          || [],
    tpa:             item.tpa             || null,
    active:          item.active          ?? true,
  }))
  const { error } = await supabase
    .from('product_catalog')
    .upsert(rows, { onConflict: 'id' })
  if (error) { console.error('saveProductCatalog:', error); return }

  // Sync product_catalog_tier rows for each family.
  // Tiers carried back from the editor have an `id` if they were loaded from
  // DB; new tiers (added via the chip editor for a brand-new techLevel) have
  // no id and get inserted. Anything in DB that's no longer in the new set
  // gets deleted.
  const allCatalogIds = catalogItems.map(i => i.id)
  if (!allCatalogIds.length) return

  const { data: existing, error: exErr } = await supabase
    .from('product_catalog_tier')
    .select('id, product_catalog_id')
    .in('product_catalog_id', allCatalogIds)
  if (exErr) { console.error('saveProductCatalog tier scan:', exErr); return }

  const wantedIds = new Set(
    catalogItems.flatMap(item => (item.tiers || []).filter(t => t.id).map(t => t.id))
  )
  const toDelete = (existing || []).filter(r => !wantedIds.has(r.id)).map(r => r.id)
  if (toDelete.length) {
    const { error: delErr } = await supabase
      .from('product_catalog_tier')
      .delete()
      .in('id', toDelete)
    if (delErr) console.error('saveProductCatalog tier delete:', delErr)
  }

  const tierRows = catalogItems.flatMap(item =>
    (item.tiers || [])
      .filter(t => t.tierName && t.tierName.trim())
      .map(t => ({
        ...(t.id ? { id: t.id } : {}),
        product_catalog_id: item.id,
        tier_name:          t.tierName,
        msrp:               t.msrp != null && t.msrp !== '' ? Number(t.msrp) : null,
      }))
  )
  if (tierRows.length) {
    const { error: upErr } = await supabase
      .from('product_catalog_tier')
      .upsert(tierRows)
    if (upErr) console.error('saveProductCatalog tier upsert:', upErr)
  }
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
      product_catalog ( manufacturer, family, generation )
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
  const datePart = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
  const rand = Math.random().toString(36).substring(2,7).toUpperCase()
  const intakeId = `MHC-${datePart}-${rand}`
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
export async function linkIntakeToPatient(intakeId, patientId) {
  if (!intakeId || !patientId) return
  const { error } = await supabase
    .from('intakes')
    .update({ patient_id: patientId })
    .eq('id', intakeId)
  if (error) console.error('linkIntakeToPatient:', error)

  // Best-effort backfill — failures here shouldn't block the intake link.
  const { error: docErr } = await supabase
    .from('patient_documents')
    .update({ patient_id: patientId })
    .eq('intake_id', intakeId)
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
    answers:       row.answers       || {},
    providerNotes: row.provider_notes || {},
    _meta: {
      intakeId:    row.id,
      patientId:   row.patient_id,
      status:      row.status,
      submittedAt: row.submitted_at,
      acceptedAt:  row.accepted_at || null,
    },
  }))
}

// Patch a single answer field on an intake. Called per-field on blur
// from the Health History wizard step so the provider's clinical review
// edits persist without a Save button.
export async function updateIntakeAnswers(intakeId, answers) {
  if (!intakeId) return
  const { error } = await supabase
    .from('intakes')
    .update({ answers })
    .eq('id', intakeId)
  if (error) console.error('updateIntakeAnswers:', error)
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
        campaign_steps(step_order, delay_days, delivery_channel)
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
      device_fittings(id, fitting_date, warranty_expiry),
      lima_charlie_donations(id, intent_status, intent_date, donation_date, recipient_id)
    `)
  if (error) { console.error('loadDonationCandidates:', error); return [] }

  const now = new Date()
  return data
    .filter(p => p.device_fittings?.[0]?.warranty_expiry)
    .map(p => {
      const fitting = p.device_fittings[0]
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
    const fitting = p.device_fittings?.[0]
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

export async function loadInsurancePlans() {
  const { data, error } = await supabase
    .from('insurance_plans')
    .select('id, carrier, plan_group, tpa, tier_label, price_per_aid, retail_anchor_key, notes')
    .eq('active', true)
    .order('carrier')
    .order('plan_group')
  if (error) throw error
  // reshape to match the shape the edit modal expects
  return (data || []).map(row => ({
    id:        row.id,
    carrier:   row.carrier,
    planGroup: row.plan_group,
    tpa:       row.tpa || '',
    tier:      row.tier_label,
    tierPrice: row.price_per_aid != null ? row.price_per_aid / 100 : null,
    retailAnchorKey: row.retail_anchor_key,
    notes:     row.notes || '',
  }))
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

  const { data: anchor } = await supabase
    .from('clinic_retail_anchors')
    .select('label, price_per_aid')
    .eq('id', anchorKey)
    .eq('clinic_id', clinicId)
    .eq('manufacturer_class', 'signia')
    .single()

  if (!anchor) return null

  // tier_price_per_aid is stored in cents (matches loadInsurancePlans /
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
    .select('id, first_name, last_name, dob')
    .eq('id', patientId)
    .maybeSingle()
  return data || null
}

// Patient-has-TNS flag for Zone 1 clinical strip. Any row present → show warning.
export async function loadPatientTnsFlag(patientId) {
  const { data } = await supabase
    .from('tns_outcomes')
    .select('outcome_reasons, created_at')
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
      .select('answers, accepted_at')
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
