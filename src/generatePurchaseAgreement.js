// ============================================================
// generatePurchaseAgreement.js — PDF generation for Distil CRM
// Uses jsPDF to create a modern, clean purchase agreement
// that auto-populates from patient/device/clinic/provider data.
// ============================================================

import { jsPDF } from 'jspdf'

// ── Constants ────────────────────────────────────────────────
const PAGE_W = 612   // US Letter width in pts (8.5")
const PAGE_H = 792   // US Letter height in pts (11")
const MARGIN = 50
const CONTENT_W = PAGE_W - MARGIN * 2
const NAVY = [10, 22, 40]       // #0a1628
const GRAY = [107, 114, 128]    // #6b7280
const LIGHT_GRAY = [229, 231, 235] // #e5e7eb
const MED_GRAY = [156, 163, 175]   // #9ca3af
const BLACK = [0, 0, 0]
const WHITE = [255, 255, 255]

// Care plan metadata for warranty and pricing
const CARE_PLAN_META = {
  paygo:    { label: 'Pay-As-You-Go', warrantyYears: 3, price: null, fiveYearCost: 1625, ldCost: 275 },
  punch:    { label: 'Treatment Punch Card', warrantyYears: 3, price: 575, ldCost: 275 },
  complete: { label: 'Complete Care+', warrantyYears: 4, price: 1250, ldCost: 275 },
}

// ── Helpers ──────────────────────────────────────────────────
function fmt$(amount) {
  if (amount == null) return '—'
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function todayFormatted() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Parse state abbreviation from clinic address
function parseState(address) {
  if (!address) return null
  const parts = address.split(',').map(s => s.trim())
  const last = parts[parts.length - 1] || ''
  const m = last.match(/\b([A-Z]{2})\b/)
  return m ? m[1] : null
}

// ── Text wrapping utility ────────────────────────────────────
function wrapText(doc, text, maxWidth) {
  return doc.splitTextToSize(text, maxWidth)
}

// ── Draw a horizontal rule ───────────────────────────────────
function drawHR(doc, y, x1 = MARGIN, x2 = PAGE_W - MARGIN) {
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.5)
  doc.line(x1, y, x2, y)
  return y + 2
}

// ── Check if we need a new page ──────────────────────────────
function checkPage(doc, y, needed = 80) {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage()
    return MARGIN + 20
  }
  return y
}


// ============================================================
// MAIN EXPORT
// ============================================================
/**
 * Generate a purchase agreement PDF.
 *
 * @param {Object} params
 * @param {Object} params.patient    - { name, address, phone, dob }
 * @param {Object} params.devices    - { fittingType, left, right } where each side = { manufacturer, family, variant, style, battery, techLevel }
 * @param {string} params.carePlan   - 'paygo' | 'punch' | 'complete'
 * @param {number} params.pricePerAid - patient cost per aid (from insurance or private pay)
 * @param {Object} params.clinic     - { name, address, phone }
 * @param {Object} params.provider   - { fullName, activeLicense, signatureUrl }
 * @param {string} params.patientSignature - typed patient name for "adopt and sign"
 * @param {string} params.patientSignatureDate - ISO date string
 * @param {string|null} params.deliverySignature - typed patient name for delivery (null if not yet delivered)
 * @param {string|null} params.deliveryDate - ISO date for delivery
 * @param {string|null} params.signatureImageBase64 - base64 provider signature image
 * @returns {jsPDF} - the PDF document
 */
export function generatePurchaseAgreement({
  patient,
  devices,
  carePlan,
  pricePerAid,
  clinic,
  provider,
  patientSignature = null,
  patientSignatureDate = null,
  deliverySignature = null,
  deliveryDate = null,
  signatureImageBase64 = null,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const cpMeta = CARE_PLAN_META[carePlan] || CARE_PLAN_META.complete
  const isBilateral = devices.fittingType === 'bilateral' || devices.fittingType === 'cros_bicros'
  const aidCount = isBilateral ? 2 : 1

  // Calculate pricing
  const deviceTotal = (pricePerAid || 0) * aidCount
  const carePlanPrice = cpMeta.price || 0 // 0 for PAYG (excluded from total)
  const totalPurchasePrice = deviceTotal + carePlanPrice

  let y = MARGIN

  // ─────────────────────────────────────────────────────────
  // HEADER — Clinic info + title
  // ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...NAVY)
  doc.text('MY HEARING CENTERS', MARGIN, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  y += 16
  doc.text(clinic.address || '', MARGIN, y)
  y += 12
  doc.text(clinic.phone || '', MARGIN, y)

  // Title — right-aligned
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...NAVY)
  doc.text('HEARING AID', PAGE_W - MARGIN, MARGIN, { align: 'right' })
  doc.text('PURCHASE AGREEMENT', PAGE_W - MARGIN, MARGIN + 18, { align: 'right' })

  // Date
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Date: ${todayFormatted()}`, PAGE_W - MARGIN, MARGIN + 36, { align: 'right' })

  y += 18
  y = drawHR(doc, y)
  y += 14

  // ─────────────────────────────────────────────────────────
  // PATIENT INFORMATION
  // ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('PATIENT INFORMATION', MARGIN, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...BLACK)

  const labelX = MARGIN
  const valX = MARGIN + 80
  const label2X = MARGIN + CONTENT_W / 2
  const val2X = label2X + 80

  // Row 1: Name + Phone
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MED_GRAY)
  doc.text('Name', labelX, y)
  doc.text('Phone', label2X, y)
  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)
  doc.text(patient.name || '—', labelX, y)
  doc.text(patient.phone || '—', label2X, y)
  y += 18

  // Row 2: Address
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MED_GRAY)
  doc.text('Address', labelX, y)
  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)
  doc.text(patient.address || '—', labelX, y)

  y += 22
  y = drawHR(doc, y)
  y += 14

  // ─────────────────────────────────────────────────────────
  // DEVICE SPECIFICATIONS
  // ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('DEVICE SPECIFICATIONS', MARGIN, y)
  y += 6

  // Device table
  const colLabels = ['', 'Manufacturer', 'Model', 'Style', 'Battery', 'Price']
  const colWidths = [50, 90, 110, 80, 70, CONTENT_W - 400]
  const colX = []
  let cx = MARGIN
  for (const w of colWidths) { colX.push(cx); cx += w }

  // Table header
  y += 10
  doc.setFillColor(...NAVY)
  doc.rect(MARGIN, y - 10, CONTENT_W, 18, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...WHITE)
  colLabels.forEach((label, i) => {
    doc.text(label, colX[i] + 6, y + 2)
  })
  y += 16

  // Helper to render a device row
  const renderDeviceRow = (sideLabel, side, bgColor) => {
    if (!side) return
    doc.setFillColor(...bgColor)
    doc.rect(MARGIN, y - 10, CONTENT_W, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    doc.text(sideLabel, colX[0] + 6, y + 2)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...BLACK)
    doc.text(side.manufacturer || '—', colX[1] + 6, y + 2)

    // Model: combine family + variant + techLevel
    const model = [side.family, side.variant, side.techLevel].filter(Boolean).join(' ')
    doc.text(model || '—', colX[2] + 6, y + 2)

    doc.text(side.style || '—', colX[3] + 6, y + 2)
    doc.text(side.battery || '—', colX[4] + 6, y + 2)

    doc.setFont('helvetica', 'bold')
    doc.text(fmt$(pricePerAid), colX[5] + 6, y + 2)

    y += 20
  }

  // Render device rows
  if (isBilateral) {
    renderDeviceRow('Right', devices.right, [248, 250, 252])
    renderDeviceRow('Left', devices.left, WHITE)
  } else if (devices.fittingType === 'monaural_right') {
    renderDeviceRow('Right', devices.right, [248, 250, 252])
  } else {
    renderDeviceRow('Left', devices.left, [248, 250, 252])
  }

  // Device subtotal row
  doc.setFillColor(...LIGHT_GRAY)
  doc.rect(MARGIN, y - 10, CONTENT_W, 20, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`Device Total (${aidCount === 2 ? 'pair' : 'single'})`, colX[0] + 6, y + 2)
  doc.text(fmt$(deviceTotal), colX[5] + 6, y + 2)
  y += 28

  // ─────────────────────────────────────────────────────────
  // CARE PLAN
  // ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('CARE PLAN', MARGIN, y)
  y += 16

  // Care plan box
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.75)
  doc.roundedRect(MARGIN, y - 8, CONTENT_W, carePlan === 'paygo' ? 68 : 44, 4, 4, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)
  doc.text(cpMeta.label, MARGIN + 12, y + 6)

  if (carePlan === 'paygo') {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    doc.text('$65 per visit · Annual exams covered', MARGIN + 12, y + 20)
    doc.text(`Estimated 5-year cost: ${fmt$(cpMeta.fiveYearCost)}`, MARGIN + 12, y + 34)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text('(Based on 5 visits/year — 3 cleanings + 2 triage. Not included in purchase total.)', MARGIN + 12, y + 47)
    y += 74
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...NAVY)
    doc.text(fmt$(cpMeta.price), PAGE_W - MARGIN - 12, y + 6, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    const desc = carePlan === 'complete'
      ? 'Includes all follow-up visits, cleanings, adjustments, and repairs for 4 years'
      : 'Prepaid bundle of follow-up visits and cleanings for 3 years'
    doc.text(desc, MARGIN + 12, y + 20)
    y += 50
  }

  // ─────────────────────────────────────────────────────────
  // TOTAL PURCHASE PRICE
  // ─────────────────────────────────────────────────────────
  y += 4
  doc.setFillColor(...NAVY)
  doc.roundedRect(MARGIN, y - 8, CONTENT_W, 32, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...WHITE)
  doc.text('TOTAL PURCHASE PRICE', MARGIN + 14, y + 12)
  doc.text(fmt$(totalPurchasePrice), PAGE_W - MARGIN - 14, y + 12, { align: 'right' })

  y += 40

  // ─────────────────────────────────────────────────────────
  // WARRANTY
  // ─────────────────────────────────────────────────────────
  y = checkPage(doc, y, 100)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('WARRANTY', MARGIN, y)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...BLACK)

  const warrantyText = `The manufacturer warrants patient's hearing aid(s) to be free from defects in workmanship and materials for a period of ${cpMeta.warrantyYears} year(s) from date of delivery and agrees to make all necessary repairs without charge to patient during the warranty period. The manufacturer provides a one-time loss and damage replacement during the warranty period at a cost of $${cpMeta.ldCost} per hearing aid.`

  const warrantyLines = wrapText(doc, warrantyText, CONTENT_W)
  warrantyLines.forEach(line => {
    doc.text(line, MARGIN, y)
    y += 12
  })
  y += 6

  // ─────────────────────────────────────────────────────────
  // 100% SATISFACTION GUARANTEED
  // ─────────────────────────────────────────────────────────
  y = checkPage(doc, y, 80)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('100% SATISFACTION GUARANTEED', MARGIN, y)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...BLACK)

  const satisfactionText = `Patient has a right to cancel this agreement for any reason within 60 days. Patient is entitled to receive a full refund of any payment made for the hearing aid within 30 days of returning the hearing aid to MHC in normal working condition. MHC may refuse to provide a refund for a hearing aid that has been lost or damaged beyond repair while in the patient's possession.`

  const satLines = wrapText(doc, satisfactionText, CONTENT_W)
  satLines.forEach(line => {
    doc.text(line, MARGIN, y)
    y += 12
  })
  y += 6

  // ─────────────────────────────────────────────────────────
  // PATIENT RESPONSIBILITY
  // ─────────────────────────────────────────────────────────
  y = checkPage(doc, y, 120)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('PATIENT RESPONSIBILITY', MARGIN, y)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...BLACK)

  const respText = `Patient is responsible to carefully follow all rehabilitation instructions and communicate with the provider on the progress with adjustments. During this time MHC may make any needed adjustments on the hearing aid(s) for the benefit of the patient's listening and hearing comfort. Patient should realize that adjusting to hearing aids is not an overnight experience and may take time. Patient also agrees to allow themselves time to adjust and allows MHC to assist them in their hearing rehabilitation. If MHC believes that, during the rehabilitation period, a different choice of circuitry, model, or choice of hearing aid(s) is better suited to the patient's needs, no extra cost will be incurred by the patient unless an upgrade of quality, model, or style is chosen. Suggested rehabilitation time is a minimum of 30 days. Additional time may be granted subject to approval by MHC.`

  const respLines = wrapText(doc, respText, CONTENT_W)
  respLines.forEach(line => {
    y = checkPage(doc, y, 14)
    doc.text(line, MARGIN, y)
    y += 12
  })

  y += 16

  // ─────────────────────────────────────────────────────────
  // SIGNATURES — Purchase Agreement
  // ─────────────────────────────────────────────────────────
  y = checkPage(doc, y, 140)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('AGREEMENT SIGNATURES', MARGIN, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text(`Executed this ${todayFormatted()}`, MARGIN, y + 10)
  y += 24

  const sigBoxW = (CONTENT_W - 20) / 2

  // Patient signature box (left)
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.5)
  doc.roundedRect(MARGIN, y, sigBoxW, 56, 3, 3, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MED_GRAY)
  doc.text('PATIENT SIGNATURE', MARGIN + 10, y + 12)

  if (patientSignature) {
    // "Adopt and Sign" — render typed name in cursive-like italic
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(16)
    doc.setTextColor(...NAVY)
    doc.text(patientSignature, MARGIN + 10, y + 34)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text(`Signed electronically ${patientSignatureDate || todayFormatted()}`, MARGIN + 10, y + 48)
  }

  // Provider signature box (right)
  const provX = MARGIN + sigBoxW + 20
  doc.setDrawColor(...LIGHT_GRAY)
  doc.roundedRect(provX, y, sigBoxW, 56, 3, 3, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MED_GRAY)
  doc.text('MHC PROVIDER', provX + 10, y + 12)

  // Provider signature image or name
  if (signatureImageBase64) {
    try {
      doc.addImage(signatureImageBase64, 'PNG', provX + 10, y + 14, 100, 28)
    } catch (e) {
      // Fallback to text if image fails
      doc.setFont('helvetica', 'bolditalic')
      doc.setFontSize(14)
      doc.setTextColor(...NAVY)
      doc.text(provider.fullName, provX + 10, y + 34)
    }
  } else {
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(14)
    doc.setTextColor(...NAVY)
    doc.text(provider.fullName, provX + 10, y + 34)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text(`${provider.fullName}  ·  License: ${provider.activeLicense}`, provX + 10, y + 48)

  y += 72

  // ─────────────────────────────────────────────────────────
  // SIGNATURES — Delivery
  // ─────────────────────────────────────────────────────────
  y = checkPage(doc, y, 90)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('DELIVERY ACKNOWLEDGEMENT', MARGIN, y)
  y += 18

  // Delivery patient signature box
  doc.setDrawColor(...LIGHT_GRAY)
  doc.roundedRect(MARGIN, y, sigBoxW, 56, 3, 3, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MED_GRAY)
  doc.text('PATIENT SIGNATURE — DELIVERY', MARGIN + 10, y + 12)

  if (deliverySignature) {
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(16)
    doc.setTextColor(...NAVY)
    doc.text(deliverySignature, MARGIN + 10, y + 34)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text(`Delivered ${deliveryDate ? fmtDate(deliveryDate) : todayFormatted()}`, MARGIN + 10, y + 48)
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...MED_GRAY)
    doc.text('Pending delivery', MARGIN + 10, y + 34)
  }

  // Delivery date box (right)
  doc.setDrawColor(...LIGHT_GRAY)
  doc.roundedRect(provX, y, sigBoxW, 56, 3, 3, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MED_GRAY)
  doc.text('DELIVERY DATE', provX + 10, y + 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...BLACK)
  doc.text(deliveryDate ? fmtDate(deliveryDate) : '________________', provX + 10, y + 34)

  // ─────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────
  const footerY = PAGE_H - 30
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MED_GRAY)
  doc.text(`${clinic.name} · ${clinic.address} · ${clinic.phone}`, PAGE_W / 2, footerY, { align: 'center' })
  doc.text('Generated by Distil CRM', PAGE_W / 2, footerY + 10, { align: 'center' })

  return doc
}


// ============================================================
// Convenience: generate and trigger download
// ============================================================
export function downloadPurchaseAgreement(params) {
  const doc = generatePurchaseAgreement(params)
  const patientName = (params.patient.name || 'patient').replace(/\s+/g, '_')
  const date = new Date().toISOString().split('T')[0]
  doc.save(`Purchase_Agreement_${patientName}_${date}.pdf`)
  return doc
}

// ============================================================
// Convenience: generate and return blob URL (for preview)
// ============================================================
export function previewPurchaseAgreement(params) {
  const doc = generatePurchaseAgreement(params)
  return doc.output('bloburl')
}
