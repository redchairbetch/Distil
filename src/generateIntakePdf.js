// ============================================================
// generateIntakePdf.js — Text-selectable signed-intake PDF
//
// Lays the kiosk intake out directly with jsPDF text primitives
// (modeled on generatePurchaseAgreement.js) so the archived
// signed intake is searchable, copy-pasteable, and small —
// unlike a rasterized html2canvas/jsPDF.html() capture.
//
// Layout mirrors the kiosk's printable intake: logo header,
// 3-column patient info, side-by-side Medical / Hearing history,
// optional Current Hearing Aids, and a consent page (Privacy
// Policy + Insurance Billing + signature).
//
// The only image content is the logo and the patient signature;
// every field value is real text.
// ============================================================

import { jsPDF } from 'jspdf'

// ── Geometry ─────────────────────────────────────────────────
const PAGE_W = 612
const PAGE_H = 792
const M = 42                  // page margin
const CW = PAGE_W - M * 2     // content width (528)
const BOTTOM = PAGE_H - 32    // y past this triggers a page break

// ── Palette (mirrors the kiosk intake HTML — teal brand) ─────
const TEAL  = [10, 123, 140]  // #0A7B8C — headings, accents, Yes/No
const INK   = [17, 17, 17]    // #111    — field values, questions
const LABEL = [119, 119, 119] // #777    — field labels
const RULE  = [204, 204, 204] // #ccc    — field value underline
const HAIR  = [232, 232, 232] // light   — Q&A row separators
const SOFT  = [85, 85, 85]    // #555    — clinic info / meta
const BODY  = [51, 51, 51]    // #333    — consent paragraphs
const CERT  = [68, 68, 68]    // #444    — certification text
const SECT  = [208, 220, 222] // #D0DCDE — section-heading underline
const TAGLN = [90, 114, 116]  // #5A7274 — fallback tagline

const VAL_LH = 10.5           // field-value line height
const YN_LH  = 9.5            // history-row line height

// ── Value formatting ─────────────────────────────────────────
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString()
}

// DOB is stored ISO YYYY-MM-DD; print MM/DD/YYYY (provider scan format).
function fmtDob(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '—'
}

// Localize a stored answer (radio/multiChoice keys → label); raw
// passthrough for free text; "—" when empty.
function val(answers, t, key) {
  const raw = answers[key]
  if (raw == null || raw === '') return '—'
  return t[raw] || raw
}

function yn(answers, key) {
  return answers[key] === true ? 'Yes' : answers[key] === false ? 'No' : '—'
}

// Multi-select array → comma-joined localized names, "other" freeform
// text appended in parentheses when present.
function multiDisplay(answers, t, arrKey, options, otherKey, otherValueKey) {
  const arr = Array.isArray(answers[arrKey]) ? answers[arrKey] : []
  if (!arr.length) return '—'
  const names = arr
    .filter(k => k !== otherKey)
    .map(k => {
      const found = options.find(([kk]) => kk === k)
      return found ? (t[found[1]] || found[1]) : k
    })
  if (otherKey && arr.includes(otherKey)) {
    const found = options.find(([k]) => k === otherKey)
    const label = found ? (t[found[1]] || found[1]) : 'Other'
    names.push(answers[otherValueKey] ? `${label} (${answers[otherValueKey]})` : label)
  }
  return names.join(', ') || '—'
}

// Referral source name, with the freeform reveal text appended for the
// "Other" and "Friend or family referral" options (backlog #10).
function referralDisplay(answers, t, referralOptions) {
  const src = answers.referralSource
  if (!src) return '—'
  const found = referralOptions.find(([k]) => k === src)
  const name = found ? (t[found[1]] || found[1]) : src
  if (src === 'other' && answers.referralOther) return `${name} — ${answers.referralOther}`
  if (src === 'friend_family' && answers.referrerName) return `${name} — ${answers.referrerName}`
  return name
}

function stateName(code, states) {
  if (!code) return ''
  const found = states.find(([c]) => c === code)
  return found ? found[1] : code
}

// Collapse street/apt/city/state/zip into one naturally-punctuated line.
function addressLine(answers, states) {
  const line = [
    [answers.street || '', answers.apt || ''].filter(Boolean).join(' '),
    answers.city || '',
    [stateName(answers.state, states), answers.zip || ''].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ')
  return line || '—'
}

// ── Layout primitives ────────────────────────────────────────
// A page-break-aware cursor: { doc, y }. ensureSpace adds a page
// when the next block won't fit.
function ensureSpace(ctx, needed) {
  if (ctx.y + needed > BOTTOM) {
    ctx.doc.addPage()
    ctx.y = M
  }
}

// Teal uppercase section heading + thin rule. Returns the y below it.
function heading(doc, x, w, y, text) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...TEAL)
  doc.text(String(text).toUpperCase(), x, y + 8, { charSpace: 0.4 })
  doc.setDrawColor(...SECT)
  doc.setLineWidth(0.5)
  doc.line(x, y + 12, x + w, y + 12)
  return y + 23
}

function fieldHeight(nLines) {
  return 15 + (nLines - 1) * VAL_LH + 3 + 6
}

// One labeled field: small grey caps label, value (wrapped), underline.
// Returns the vertical space consumed.
function field(doc, x, y, w, label, value) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...LABEL)
  doc.text(String(label).toUpperCase(), x, y + 5, { charSpace: 0.3 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  const text = (value == null || value === '') ? '—' : String(value)
  const lines = doc.splitTextToSize(text, w)
  lines.forEach((ln, i) => doc.text(ln, x, y + 15 + i * VAL_LH))

  const uy = y + 15 + (lines.length - 1) * VAL_LH + 3
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.5)
  doc.line(x, uy, x + w, uy)
  return fieldHeight(lines.length)
}

// A row of fields spanning a given width. Pre-measures the tallest field
// so the whole row breaks to a new page together. Advances ctx.y.
function fieldRow(ctx, items, totalW = CW, originX = M) {
  const { doc } = ctx
  const gap = 16
  const n = items.length
  const w = n === 1 ? totalW : (totalW - gap * (n - 1)) / n

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  let maxLines = 1
  items.forEach(it => {
    const text = (it.value == null || it.value === '') ? '—' : String(it.value)
    maxLines = Math.max(maxLines, doc.splitTextToSize(text, w).length)
  })
  const rowH = fieldHeight(maxLines)
  ensureSpace(ctx, rowH)
  items.forEach((it, i) => {
    field(doc, originX + i * (w + gap), ctx.y, w, it.label, it.value)
  })
  ctx.y += rowH
}

// One question→Yes/No row inside a history column. Returns height consumed.
function ynRow(doc, x, w, y, question, answer) {
  const ansW = 30
  const qW = w - ansW - 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...INK)
  const lines = doc.splitTextToSize(String(question), qW)
  lines.forEach((ln, i) => doc.text(ln, x, y + 8 + i * YN_LH))

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...TEAL)
  doc.text(String(answer), x + w, y + 8, { align: 'right' })

  const rowH = 8 + (lines.length - 1) * YN_LH + 6
  doc.setDrawColor(...HAIR)
  doc.setLineWidth(0.5)
  doc.line(x, y + rowH - 1, x + w, y + rowH - 1)
  return rowH
}

// Wrapped paragraph at the page margin. Returns the y below it.
function paragraph(doc, y, text, size, color) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...color)
  const lh = size * 1.45
  const lines = doc.splitTextToSize(String(text), CW)
  lines.forEach((ln, i) => doc.text(ln, M, y + size + i * lh))
  return y + size + (lines.length - 1) * lh + 4
}

// Bulleted line (drawn dot — no reliance on a bullet glyph).
function bullet(doc, y, text) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BODY)
  const lh = 13
  const indent = 15
  doc.setFillColor(...TEAL)
  doc.circle(M + 4, y + 6, 1.3, 'F')
  const lines = doc.splitTextToSize(String(text), CW - indent)
  lines.forEach((ln, i) => doc.text(ln, M + indent, y + 9 + i * lh))
  return y + 9 + (lines.length - 1) * lh + 6
}

// Logo image scaled to fit maxH x maxW; text wordmark fallback.
function drawLogo(doc, x, y, maxH, maxW, logoDataUrl) {
  if (logoDataUrl) {
    try {
      const props = doc.getImageProperties(logoDataUrl)
      const ratio = props.width / props.height
      let h = maxH
      let w = h * ratio
      if (w > maxW) { w = maxW; h = w / ratio }
      doc.addImage(logoDataUrl, props.fileType || 'PNG', x, y, w, h)
      return h
    } catch {
      /* fall through to the text wordmark */
    }
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...TEAL)
  doc.text(')) MY HEARING CENTERS', x, y + 13)
  return 16
}

// ── Header ───────────────────────────────────────────────────
function header(doc, intakeId, timestamp, clinic, title = 'PATIENT INTAKE FORM') {
  const top = M
  // Left: logo + clinic info block
  const logoH = drawLogo(doc, M, top, 36, 220, clinic.logoDataUrl)
  let ly = top + logoH + 12
  if (clinic.name || clinic.address || clinic.phone) {
    if (clinic.name) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEAL)
      doc.text(clinic.name, M, ly)
      ly += 9.5
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...SOFT)
    if (clinic.address) { doc.text(clinic.address, M, ly); ly += 9 }
    if (clinic.phone)   { doc.text(clinic.phone, M, ly);   ly += 9 }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(...TAGLN)
    doc.text('We Change Lives Through Better Hearing', M, ly)
    ly += 9
  }

  // Right: meta block
  let my = top + 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.text(title, PAGE_W - M, my, { align: 'right' })
  my += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...SOFT)
  doc.text('Sycle ID: ___________', PAGE_W - M, my, { align: 'right' });   my += 10.5
  doc.text(`Intake ID: ${intakeId || '—'}`, PAGE_W - M, my, { align: 'right' }); my += 10.5
  doc.text(`Date: ${fmtDate(timestamp)}`, PAGE_W - M, my, { align: 'right' })
  my += 10.5

  // Teal rule under the taller of the two blocks
  const ruleY = Math.max(ly, my) + 2
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(1.4)
  doc.line(M, ruleY, PAGE_W - M, ruleY)
  return ruleY + 15
}

// ── Patient Information ──────────────────────────────────────
function patientInfo(ctx, answers, t, lk) {
  const { doc } = ctx
  ctx.y = heading(doc, M, CW, ctx.y, 'Patient Information')
  fieldRow(ctx, [
    { label: 'First Name', value: val(answers, t, 'firstName') },
    { label: 'M.I.', value: val(answers, t, 'mi') },
    { label: 'Last Name', value: val(answers, t, 'lastName') },
  ])
  fieldRow(ctx, [
    { label: 'Date of Birth', value: fmtDob(answers.dob) },
    { label: 'Gender', value: val(answers, t, 'gender') },
    { label: 'Primary Care Physician', value: val(answers, t, 'pcp') },
  ])
  fieldRow(ctx, [{ label: 'Address', value: addressLine(answers, lk.states) }])
  fieldRow(ctx, [
    { label: 'Home Phone', value: val(answers, t, 'homePhone') },
    { label: 'Mobile Phone', value: val(answers, t, 'mobilePhone') },
    { label: 'Email', value: val(answers, t, 'email') },
  ])
  fieldRow(ctx, [
    { label: 'Spouse', value: val(answers, t, 'spouseName') },
    { label: 'Spouse DOB', value: fmtDob(answers.spouseDob) },
    { label: 'Spouse Phone', value: val(answers, t, 'spousePhone') },
  ])
  fieldRow(ctx, [
    { label: 'Emergency Contact', value: val(answers, t, 'emergencyName') },
    { label: 'Emergency Phone', value: val(answers, t, 'emergencyPhone') },
    { label: 'Referred By', value: referralDisplay(answers, t, lk.referral) },
  ])
  fieldRow(ctx, [{ label: 'Reason for Visit', value: val(answers, t, 'visitReason') }])
}

// ── Medical / Hearing history rows ───────────────────────────
function medicalRows(answers, t, lk) {
  const occ = multiDisplay(answers, t, 'med_noise_occupational_types', lk.noiseOccupational, 'other', 'med_noise_occupational_other')
  const rec = multiDisplay(answers, t, 'med_noise_recreational_types', lk.noiseRecreational, 'other', 'med_noise_recreational_other')
  const defs = [
    ['Pain or discomfort in ear(s)?', 'med_pain'],
    ['Drainage in ear(s)?', 'med_drain'],
    ['Sudden/rapid hearing loss in past 90 days?', 'med_sudden'],
    ['Ringing or other sounds in ears?', 'med_ring'],
    ['Dizziness or vertigo?', 'med_dizzy'],
    ['Ears feel full or blocked?', 'med_full'],
    ['Seen doctor regarding above?', 'med_doctor'],
    ['Ever had ear surgery?', 'med_surgery'],
    ['Taking blood thinning medication?', 'med_thinner'],
    ['Diabetic?', 'med_diabetic'],
    ['Occupational noise exposure?', 'med_noise_occupational'],
    ['Recreational noise exposure?', 'med_noise_recreational'],
  ]
  return defs.map(([q, k]) => {
    let suffix = ''
    if (k === 'med_diabetic' && answers.med_diabetic_type) {
      suffix = ' — ' + (t[answers.med_diabetic_type] || answers.med_diabetic_type)
    }
    if (k === 'med_doctor' && answers.med_doctor_when) {
      suffix = ' (' + answers.med_doctor_when + ')'
    }
    if (k === 'med_noise_occupational' && occ !== '—') suffix = ' — ' + occ
    if (k === 'med_noise_recreational' && rec !== '—') suffix = ' — ' + rec
    return { q: q + suffix, a: yn(answers, k) }
  })
}

function hearingRows(answers, t) {
  const defs = [
    ['Had hearing tested before?', 'hear_tested'],
    ['People seem to mumble?', 'hear_mumble'],
    ['Frequently ask people to repeat?', 'hear_repeat'],
    ["Hear speaking but don't understand?", 'hear_understand'],
    ['Difficulty hearing in noisy places?', 'hear_noisy'],
    ['Told you speak loudly?', 'hear_loud'],
    ['Told you turn TV too loud?', 'hear_tv'],
    ["Difficulty with children's voices?", 'hear_kids'],
    ['Were aids recommended?', 'hear_aids_recommended'],
    ['Ready to improve if loss diagnosed?', 'hear_ready'],
  ]
  return defs.map(([q, k]) => {
    let suffix = ''
    if (k === 'hear_tested' && answers.hear_tested_when) {
      const sev = answers.hear_tested_results
      const sevLabel = sev ? (t[sev] || sev) : null
      suffix = ' — Last: ' + answers.hear_tested_when + (sevLabel ? ', ' + sevLabel : '')
    }
    return { q: q + suffix, a: yn(answers, k) }
  })
}

// One history column: heading + Q&A rows + trailing field rows.
// extraRows: array of field-item arrays (1 or 2 fields each).
function renderColumn(doc, x, colW, startY, title, rows, extraRows) {
  let y = heading(doc, x, colW, startY, title)
  rows.forEach(r => { y += ynRow(doc, x, colW, y, r.q, r.a) })
  y += 6
  extraRows.forEach(items => {
    const gap = 12
    const n = items.length
    const w = n === 1 ? colW : (colW - gap * (n - 1)) / n
    let h = 0
    items.forEach((it, i) => {
      h = Math.max(h, field(doc, x + i * (w + gap), y, w, it.label, it.value))
    })
    y += h
  })
  return y
}

// Two-column Medical | Hearing history. Treated as one atomic block —
// ensureSpace before it so the columns never split across a page (the
// section is bounded by ~22 fixed questions and always fits on a fresh
// page).
function historySection(ctx, answers, t, lk) {
  const { doc } = ctx
  ensureSpace(ctx, 380)
  const colGap = 22
  const colW = (CW - colGap) / 2
  const startY = ctx.y

  const family = multiDisplay(answers, t, 'medFamilyHistory', lk.family, null, null)
  const resistance = multiDisplay(answers, t, 'resistancePoints', lk.resistance, 'other', 'resistancePointsOther')

  const medEnd = renderColumn(
    doc, M, colW, startY, 'Medical History',
    medicalRows(answers, t, lk),
    [[{ label: 'Family with hearing loss/aids', value: family }]],
  )
  const hearEnd = renderColumn(
    doc, M + colW + colGap, colW, startY, 'Hearing History',
    hearingRows(answers, t),
    [
      [
        { label: 'Best ear', value: val(answers, t, 'hear_best') },
        { label: 'Self-rated (1-10)', value: val(answers, t, 'hear_rating') },
      ],
      [{ label: 'What has prevented addressing hearing', value: resistance }],
    ],
  )
  ctx.y = Math.max(medEnd, hearEnd) + 8
}

// ── Current Hearing Aids (conditional) ───────────────────────
function currentAids(ctx, answers, t) {
  if (!answers.aids_q) return
  const { doc } = ctx
  ensureSpace(ctx, 72)
  ctx.y = heading(doc, M, CW, ctx.y, 'Current Hearing Aids')
  fieldRow(ctx, [
    { label: 'Which ear(s)', value: val(answers, t, 'aids_ear') },
    { label: 'How often worn', value: val(answers, t, 'aids_howOften') },
    { label: 'Age of aids', value: val(answers, t, 'aids_howOld') },
  ])
  fieldRow(ctx, [
    { label: 'Brand', value: val(answers, t, 'aids_brand') },
    { label: 'Style', value: val(answers, t, 'aids_style') },
    { label: 'Cost', value: val(answers, t, 'aids_cost') },
  ])
  fieldRow(ctx, [
    { label: 'Hearing well with current aids?', value: yn(answers, 'aids_satisfied') },
    { label: 'If not, why?', value: val(answers, t, 'aids_whyNot') },
    { label: 'Satisfaction (1-10)', value: val(answers, t, 'aids_satisfRating') },
  ])
}

// ── Consent page (always its own sheet) ──────────────────────
function consentPage(doc, tEn, signatureDataUrl, timestamp) {
  doc.addPage()
  const ctx = { doc, y: M }

  // Privacy Policy
  ctx.y = heading(doc, M, CW, ctx.y, tEn.privacyTitle || 'Privacy Policy')
  ctx.y = paragraph(doc, ctx.y, tEn.privacyIntro || '', 9, BODY)
  ctx.y += 2
  ;(tEn.privacyBullets || []).forEach(b => { ctx.y = bullet(doc, ctx.y, b) })
  ctx.y += 14

  // Insurance Billing Acknowledgment
  ensureSpace(ctx, 60)
  ctx.y = heading(doc, M, CW, ctx.y, tEn.insTitle || 'Insurance Billing Acknowledgment')
  ;(tEn.insText || '').split('\n\n').forEach(para => {
    ctx.y = paragraph(doc, ctx.y, para, 9, BODY)
    ctx.y += 5
  })
  ctx.y += 10

  // Certification + signature
  ensureSpace(ctx, 180)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(1.4)
  doc.line(M, ctx.y, PAGE_W - M, ctx.y)
  ctx.y += 15
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...TEAL)
  doc.text('CERTIFICATION & SIGNATURE', M, ctx.y, { charSpace: 0.4 })
  ctx.y += 13
  ctx.y = paragraph(doc, ctx.y, tEn.sigCert || '', 8, CERT)
  ctx.y += 8

  if (signatureDataUrl) {
    try {
      const boxW = 232
      const boxH = 66
      doc.setDrawColor(...RULE)
      doc.setLineWidth(0.5)
      doc.roundedRect(M, ctx.y, boxW, boxH, 2, 2, 'S')
      doc.addImage(signatureDataUrl, 'PNG', M + 8, ctx.y + 6, boxW - 16, boxH - 12)
      ctx.y += boxH + 6
    } catch {
      /* signature image unavailable — the field row below still records the date */
    }
  }

  // Signature / date row (signature line left blank — the image is the
  // electronic signature; the line mirrors the printable intake).
  const gap = 16
  const w = (CW - gap) / 2
  field(doc, M, ctx.y, w, 'Authorized Signature', ' ')
  field(doc, M + w + gap, ctx.y, w, 'Date', fmtDate(timestamp))
}

// ── Upgrade / annual check-in body (returning-patient flow) ──
// A short layout for the established-patient kiosk check-in: identity,
// any contact/insurance changes, and the upgrade-readiness answers.
// Reads the same answer keys the kiosk writes (upg_*); option keys are
// localized through the upgrade lookup tables.
function upgradeBody(ctx, answers, t, lk) {
  const { doc } = ctx

  ctx.y = heading(doc, M, CW, ctx.y, 'Patient')
  fieldRow(ctx, [
    { label: 'First Name', value: val(answers, t, 'firstName') },
    { label: 'M.I.', value: val(answers, t, 'mi') },
    { label: 'Last Name', value: val(answers, t, 'lastName') },
  ])
  fieldRow(ctx, [{ label: 'Date of Birth', value: fmtDob(answers.dob) }])

  ctx.y += 6
  ctx.y = heading(doc, M, CW, ctx.y, 'Contact / Insurance Updates')
  fieldRow(ctx, [
    { label: 'Mobile Phone', value: val(answers, t, 'mobilePhone') },
    { label: 'Email', value: val(answers, t, 'email') },
  ])
  fieldRow(ctx, [{ label: 'Other updates', value: val(answers, t, 'upg_contact_other') }])
  fieldRow(ctx, [
    { label: 'Insurance changed?', value: yn(answers, 'upg_insurance_changed') },
    { label: 'New carrier', value: val(answers, t, 'upg_insurance_new') },
  ])

  ctx.y += 6
  ctx.y = heading(doc, M, CW, ctx.y, 'Annual Check-In')
  fieldRow(ctx, [{ label: 'Satisfaction with current aids (1-10)', value: val(answers, t, 'upg_satisfaction') }])
  fieldRow(ctx, [{ label: 'New struggle environments', value: multiDisplay(answers, t, 'upg_environments', lk.upgEnvironments, null, null) }])
  fieldRow(ctx, [{ label: 'Current-aid problems reported', value: multiDisplay(answers, t, 'upg_issues', lk.upgIssues, null, null) }])
  fieldRow(ctx, [{ label: 'Desired features in new aids', value: multiDisplay(answers, t, 'upg_featureGaps', lk.upgFeatures, null, null) }])
  fieldRow(ctx, [{ label: 'Other notes', value: val(answers, t, 'upg_notes') }])
}

// Lighter consent block for returning patients — HIPAA is already on file, so
// this records only the accuracy attestation + signature (no privacy/insurance
// re-walk). Continues from the shared cursor so it follows the check-in body
// (ensureSpace breaks to a new page only if it won't fit).
function upgradeConsentBlock(ctx, tEn, signatureDataUrl, timestamp) {
  const { doc } = ctx
  ctx.y += 14
  ensureSpace(ctx, 180)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(1.4)
  doc.line(M, ctx.y, PAGE_W - M, ctx.y)
  ctx.y += 15
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...TEAL)
  doc.text('CERTIFICATION & SIGNATURE', M, ctx.y, { charSpace: 0.4 })
  ctx.y += 13
  ctx.y = paragraph(doc, ctx.y, tEn.upgSigCert || tEn.sigCert || '', 8, CERT)
  ctx.y += 8

  if (signatureDataUrl) {
    try {
      const boxW = 232
      const boxH = 66
      doc.setDrawColor(...RULE)
      doc.setLineWidth(0.5)
      doc.roundedRect(M, ctx.y, boxW, boxH, 2, 2, 'S')
      doc.addImage(signatureDataUrl, 'PNG', M + 8, ctx.y + 6, boxW - 16, boxH - 12)
      ctx.y += boxH + 6
    } catch {
      /* signature image unavailable — the field row below still records the date */
    }
  }
  const gap = 16
  const w = (CW - gap) / 2
  field(doc, M, ctx.y, w, 'Authorized Signature', ' ')
  field(doc, M + w + gap, ctx.y, w, 'Date', fmtDate(timestamp))
}

// ============================================================
// MAIN EXPORT
// Returns a jsPDF doc — caller does doc.save() / doc.output('blob').
// `lookups` carries the kiosk's option tables (referral / family /
// noise / resistance / states / upg*) so this module stays a pure
// layout module with no import back into IntakeKiosk.jsx.
// `intakeType` selects the new-patient layout ('new', default) or the
// shorter returning-patient annual/upgrade check-in ('upgrade').
// ============================================================
export function generateIntakePdf({
  answers = {},
  intakeId = '',
  signatureDataUrl = null,
  timestamp = new Date().toISOString(),
  lang = 'en',
  T = {},
  logoDataUrl = null,
  clinic = {},
  lookups = {},
  intakeType = 'new',
}) {
  const t = T[lang] || T.en || {}
  const tEn = T.en || t
  const lk = {
    referral: lookups.referral || [],
    family: lookups.family || [],
    noiseOccupational: lookups.noiseOccupational || [],
    noiseRecreational: lookups.noiseRecreational || [],
    resistance: lookups.resistance || [],
    states: lookups.states || [],
    upgEnvironments: lookups.upgEnvironments || [],
    upgFeatures: lookups.upgFeatures || [],
    upgIssues: lookups.upgIssues || [],
  }

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const ctx = { doc, y: M }

  if (intakeType === 'upgrade') {
    ctx.y = header(doc, intakeId, timestamp, { ...clinic, logoDataUrl }, 'ANNUAL / UPGRADE CHECK-IN')
    upgradeBody(ctx, answers, t, lk)
    upgradeConsentBlock(ctx, tEn, signatureDataUrl, timestamp)
    return doc
  }

  ctx.y = header(doc, intakeId, timestamp, { ...clinic, logoDataUrl })
  patientInfo(ctx, answers, t, lk)
  historySection(ctx, answers, t, lk)
  currentAids(ctx, answers, t)
  consentPage(doc, tEn, signatureDataUrl, timestamp)

  return doc
}
