// ============================================================
// db.js — Supabase data layer for Distil CRM
// Replaces all window.storage calls with Supabase queries.
// All functions maintain the same shape the UI already expects
// so Distil.jsx needs minimal changes.
// ============================================================

import { supabase } from './supabase.js'
import { CONTENT_LIBRARY, CAMPAIGN_TIMELINE } from './nurture_seed_data.js'


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

  // Rebuild threshold maps { frequency: threshold_db }
  const rightT = {}
  const leftT  = {}
  thresholds.forEach(t => {
    if (t.test_type === 'AC') {
      if (t.ear === 'right') rightT[t.frequency] = t.threshold_db
      if (t.ear === 'left')  leftT[t.frequency]  = t.threshold_db
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
      rightT,
      leftT,
      unaidedR: audiogram?.unaided_wrs_right ?? null,
      unaidedL: audiogram?.unaided_wrs_left  ?? null,
      aidedR:   audiogram?.aided_wrs_right   ?? null,
      aidedL:   audiogram?.aided_wrs_left    ?? null,
      sinBin:   audiogram?.sin_score         ?? null,
    },

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
    })
    .select()
    .single()

  if (patientError) throw patientError

  // 2. Insert insurance coverage (if applicable)
  if (patient.insurance && patient.payType === 'insurance') {
    const { error } = await supabase.from('insurance_coverage').insert({
      patient_id:         patientRow.id,
      carrier:            patient.insurance.carrier,
      plan_group:         patient.insurance.planGroup,
      tpa:                patient.insurance.tpa     || null,
      tier:               patient.insurance.tier    || null,
      tier_price_per_aid: patient.insurance.tierPrice
                            ? Math.round(patient.insurance.tierPrice * 100)
                            : null,
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
                         a.unaidedR != null || a.unaidedL != null

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
          sin_score:         a.sinBin   ?? null,
        })
        .select()
        .single()

      if (audioError) {
        console.error('audiograms insert:', audioError)
      } else {
        // Build threshold rows from frequency maps
        const thresholdRows = []
        Object.entries(a.rightT || {}).forEach(([freq, db]) => {
          thresholdRows.push({
            audiogram_id:  audioRow.id,
            ear:           'right',
            frequency:     parseInt(freq),
            threshold_db:  db,
            test_type:     'AC',
          })
        })
        Object.entries(a.leftT || {}).forEach(([freq, db]) => {
          thresholdRows.push({
            audiogram_id:  audioRow.id,
            ear:           'left',
            frequency:     parseInt(freq),
            threshold_db:  db,
            test_type:     'AC',
          })
        })
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
    .select('*')
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
  if (error) console.error('saveProductCatalog:', error)
}


// ============================================================
// INTAKE QUEUE
// Replaces window.storage polling with Supabase realtime.
// ============================================================

// Write a completed intake from the kiosk
// Note: IntakeKiosk uses the anon key — the "anyone_insert_intakes"
// RLS policy allows unauthenticated inserts.
// clinicId must be passed in from the kiosk's environment config.
export async function submitIntake(answers, clinicId) {
  const { data, error } = await supabase
    .from('intakes')
    .insert({
      clinic_id: clinicId,
      answers,
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Mark an intake as accepted (called from Distil when provider accepts)
export async function acceptIntake(intakeId) {
  const { error } = await supabase
    .from('intakes')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', intakeId)
  if (error) console.error('acceptIntake:', error)
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
// PATIENT INLINE EDIT
// ============================================================

export async function loadInsurancePlans() {
  const { data, error } = await supabase
    .from('insurance_plans')
    .select('*')
    .order('carrier')
  if (error) { console.error('loadInsurancePlans:', error); return [] }
  return data
}

export async function updatePatientContact(patientId, fields) {
  const { error } = await supabase
    .from('patients')
    .update(fields)
    .eq('id', patientId)
  if (error) throw error
}

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


// ============================================================
// CAMPAIGN CONTENT
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
    const { data, error } = await supabase
      .from('campaign_content')
      .update(row)
      .eq('id', item.id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase
    .from('campaign_content')
    .insert(row)
    .select()
    .single()
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
    .select(`
      *,
      campaign_steps(
        *,
        campaign_content(id, title, content_type, category)
      )
    `)
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
  if (error) { console.error('loadCampaignTemplates:', error); return [] }
  return data.map(t => ({
    ...t,
    campaign_steps: (t.campaign_steps || []).sort((a, b) => a.step_order - b.step_order),
  }))
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
    const { data, error } = await supabase
      .from('campaign_templates')
      .update(row)
      .eq('id', template.id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase
    .from('campaign_templates')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveCampaignSteps(templateId, steps) {
  const { error: delError } = await supabase
    .from('campaign_steps')
    .delete()
    .eq('template_id', templateId)
  if (delError) console.error('delete campaign_steps:', delError)

  if (!steps.length) return
  const rows = steps.map((s, i) => ({
    template_id:      templateId,
    content_id:       s.content_id,
    step_order:       i + 1,
    delay_days:       s.delay_days,
    delivery_channel: s.delivery_channel,
  }))
  const { error } = await supabase.from('campaign_steps').insert(rows)
  if (error) console.error('insert campaign_steps:', error)
}


// ============================================================
// PATIENT CAMPAIGNS (Enrollment & Tracking)
// ============================================================

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
