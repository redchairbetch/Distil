// ============================================================
// generatePurchaseAgreement.js — One-page PDF purchase agreement
// Compact layout: specs, terms, agreement + delivery signatures
// ============================================================

import { jsPDF } from 'jspdf'

// ── Constants ────────────────────────────────────────────────
const PAGE_W = 612
const PAGE_H = 792
const M = 36          // tighter margins for one-page fit
const CW = PAGE_W - M * 2
const NAVY = [10, 22, 40]
const GRAY = [107, 114, 128]
const LIGHT_GRAY = [229, 231, 235]
const MED_GRAY = [156, 163, 175]
const BLACK = [0, 0, 0]
const WHITE = [255, 255, 255]

const CARE_PLAN_META = {
  paygo:    { label: 'Pay-As-You-Go', warrantyYears: 3, price: null, fiveYearCost: 1625, ldCost: 275 },
  punch:    { label: 'Treatment Punch Card', warrantyYears: 3, coverageYears: 4, price: 575, ldCost: 275 },
  complete: { label: 'Complete Care+', warrantyYears: 5, coverageYears: 5, price: 1250, ldCost: 275 },
}

function fmt$(amount) {
  if (amount == null) return '—'
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function todayFormatted() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function wrapText(doc, text, maxWidth) {
  return doc.splitTextToSize(text, maxWidth)
}

function drawHR(doc, y) {
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.4)
  doc.line(M, y, PAGE_W - M, y)
  return y + 1
}

// ============================================================
// MAIN EXPORT — One-page purchase agreement
// ============================================================
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
  const deviceTotal = (pricePerAid || 0) * aidCount
  const carePlanPrice = cpMeta.price || 0
  const totalPurchasePrice = deviceTotal + carePlanPrice

  let y = M

  // ── HEADER ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text('MY HEARING CENTERS', M, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text(`${clinic.address || ''}  ·  ${clinic.phone || ''}`, M, y + 12)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('HEARING AID PURCHASE AGREEMENT', PAGE_W - M, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text(`Date: ${todayFormatted()}`, PAGE_W - M, y + 12, { align: 'right' })

  y += 20
  y = drawHR(doc, y)
  y += 8

  // ── PATIENT INFO (compact inline) ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...MED_GRAY)
  doc.text('Patient', M, y)
  doc.text('Phone', M + CW * 0.5, y)
  doc.text('Address', M + CW * 0.75, y)
  y += 9
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...BLACK)
  doc.text(patient.name || '—', M, y)
  doc.text(patient.phone || '—', M + CW * 0.5, y)
  doc.text(patient.address || '—', M + CW * 0.75, y)

  y += 12
  y = drawHR(doc, y)
  y += 6

  // ── DEVICE TABLE ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('DEVICE SPECIFICATIONS', M, y)
  y += 8

  const colWidths = [36, 72, 100, 56, 110, CW - 374]
  const colX = []; let cx = M
  for (const w of colWidths) { colX.push(cx); cx += w }

  // Header row
  doc.setFillColor(...NAVY)
  doc.rect(M, y - 6, CW, 14, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...WHITE)
  ;['', 'Manufacturer', 'Model', 'Style', 'Battery', 'Price'].forEach((label, i) => {
    doc.text(label, colX[i] + 4, y + 3)
  })
  y += 12

  const renderRow = (sideLabel, side, bg) => {
    if (!side) return
    doc.setFillColor(...bg)
    doc.rect(M, y - 6, CW, 14, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...NAVY)
    doc.text(sideLabel, colX[0] + 4, y + 3)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...BLACK)
    doc.text(side.manufacturer || '—', colX[1] + 4, y + 3)
    const model = [side.family, side.techLevel].filter(Boolean).join(' ')
    doc.setFontSize(7)
    doc.text(model || '—', colX[2] + 4, y + 3)
    doc.setFontSize(7.5)
    const styleLabel = (side.style || '—').toUpperCase()
    doc.text(styleLabel, colX[3] + 4, y + 3)
    doc.text(side.battery || '—', colX[4] + 4, y + 3)
    doc.setFont('helvetica', 'bold')
    doc.text(fmt$(pricePerAid), colX[5] + 4, y + 3)
    y += 14
  }

  if (isBilateral) {
    renderRow('Right', devices.right, [248, 250, 252])
    renderRow('Left', devices.left, WHITE)
  } else if (devices.fittingType === 'monaural_right') {
    renderRow('Right', devices.right, [248, 250, 252])
  } else {
    renderRow('Left', devices.left, [248, 250, 252])
  }

  // Subtotal
  doc.setFillColor(...LIGHT_GRAY)
  doc.rect(M, y - 6, CW, 14, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...NAVY)
  doc.text(`Device Total (${aidCount === 2 ? 'pair' : 'single'})`, colX[0] + 4, y + 3)
  doc.text(fmt$(deviceTotal), colX[5] + 4, y + 3)
  y += 18

  // ── CARE PLAN (compact) ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('CARE PLAN', M, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BLACK)
  doc.text(cpMeta.label, M + 70, y)

  if (cpMeta.price) {
    doc.text(fmt$(cpMeta.price), PAGE_W - M, y, { align: 'right' })
  }

  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  if (carePlan === 'complete') {
    doc.text('Unlimited visits, cleanings, adjustments, and repairs for 5 years', M, y)
  } else if (carePlan === 'punch') {
    doc.text('All visits and cleanings covered for 4 years · 3-year manufacturer warranty', M, y)
  } else {
    doc.text(`$65/visit · Annual exams covered · Est. 5-year cost: ${fmt$(cpMeta.fiveYearCost)}`, M, y)
  }
  y += 12

  // ── TOTAL ──
  doc.setFillColor(...NAVY)
  doc.roundedRect(M, y - 4, CW, 22, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text('TOTAL PURCHASE PRICE', M + 10, y + 10)
  doc.text(fmt$(totalPurchasePrice), PAGE_W - M - 10, y + 10, { align: 'right' })
  y += 28

  // ── TERMS (original MHC legal verbiage) ──
  const termFS = 5.8  // font size to fit one page
  const termLH = 7    // line height

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...NAVY)
  doc.text('WARRANTY', M, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(termFS)
  doc.setTextColor(...BLACK)
  const warrantyText = `The manufacturer warrants patient's hearing aid(s) to be free from defects in workmanship and materials for a period of ${cpMeta.warrantyYears} year(s) from date of delivery and agrees to make all necessary repairs without charge to patient during the warranty period. The manufacturer provides a one-time loss and damage replacement during the warranty period at a cost of $${cpMeta.ldCost} per hearing aid.`
  wrapText(doc, warrantyText, CW).forEach(line => { doc.text(line, M, y); y += termLH })
  y += 3

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...NAVY)
  doc.text('100% SATISFACTION GUARANTEED', M, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(termFS)
  doc.setTextColor(...BLACK)
  const satText = `Patient has a right to cancel this agreement for any reason within 60 days. Patient is entitled to receive a full refund of any payment made for the hearing aid within 30 days of returning the hearing aid to MHC in normal working condition. MHC may refuse to provide a refund for a hearing aid that has been lost or damaged beyond repair while in the patient's possession.`
  wrapText(doc, satText, CW).forEach(line => { doc.text(line, M, y); y += termLH })
  y += 3

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...NAVY)
  doc.text('PATIENT RESPONSIBILITY', M, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(termFS)
  doc.setTextColor(...BLACK)
  const respText = `Patient is responsible to carefully follow all rehabilitation instructions and communicate with the provider on the progress with adjustments. During this time MHC may make any needed adjustments on the hearing aid(s) for the benefit of the patient's listening and hearing comfort. Patient should realize that adjusting to hearing aids is not an overnight experience and may take time. Patient also agrees to allow themselves time to adjust and allows MHC to assist them in their hearing rehabilitation. If MHC believes that, during the rehabilitation period, a different choice of circuitry, model, or choice of hearing aid(s) is better suited to the patient's needs, no extra cost will be incurred by the patient unless an upgrade of quality, model, or style is chosen. Suggested rehabilitation time is a minimum of 30 days. Additional time may be granted subject to approval by MHC.`
  wrapText(doc, respText, CW).forEach(line => { doc.text(line, M, y); y += termLH })
  y += 6

  // ── AGREEMENT SIGNATURES ──
  y = drawHR(doc, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...NAVY)
  doc.text('AGREEMENT SIGNATURES', M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...GRAY)
  doc.text(`Executed ${todayFormatted()}`, M + 140, y)
  y += 12

  const sigBoxW = (CW - 16) / 2

  // Patient signature (left)
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.4)
  doc.roundedRect(M, y, sigBoxW, 42, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...MED_GRAY)
  doc.text('PATIENT SIGNATURE', M + 8, y + 9)
  if (patientSignature) {
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(14)
    doc.setTextColor(...NAVY)
    doc.text(patientSignature, M + 8, y + 26)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    doc.setTextColor(...GRAY)
    doc.text(`Signed electronically ${patientSignatureDate || todayFormatted()}`, M + 8, y + 36)
  }

  // Provider signature (right)
  const provX = M + sigBoxW + 16
  doc.setDrawColor(...LIGHT_GRAY)
  doc.roundedRect(provX, y, sigBoxW, 42, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...MED_GRAY)
  doc.text('MHC PROVIDER', provX + 8, y + 9)
  if (signatureImageBase64) {
    try { doc.addImage(signatureImageBase64, 'PNG', provX + 8, y + 11, 80, 22) }
    catch { doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(12); doc.setTextColor(...NAVY); doc.text(provider.fullName, provX + 8, y + 26) }
  } else {
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    doc.text(provider.fullName, provX + 8, y + 26)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(...GRAY)
  doc.text(`${provider.fullName}  ·  License: ${provider.activeLicense}`, provX + 8, y + 36)

  y += 50

  // ── DELIVERY ACKNOWLEDGEMENT (wet-sign lines) ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...NAVY)
  doc.text('DELIVERY ACKNOWLEDGEMENT', M, y)
  y += 14

  // Patient delivery signature line (left)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...MED_GRAY)
  doc.text('Patient Signature', M, y)
  doc.text('Date', provX, y)
  y += 4

  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.5)
  doc.line(M, y + 18, M + sigBoxW, y + 18)             // signature line
  doc.line(provX, y + 18, provX + sigBoxW * 0.6, y + 18) // date line

  if (deliverySignature) {
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    doc.text(deliverySignature, M, y + 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...BLACK)
    doc.text(deliveryDate || '', provX, y + 14)
  }

  // ── FOOTER ──
  const footerY = PAGE_H - 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...MED_GRAY)
  doc.text(`${clinic.name} · ${clinic.address} · ${clinic.phone}  ·  Generated by Distil CRM`, PAGE_W / 2, footerY, { align: 'center' })

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
