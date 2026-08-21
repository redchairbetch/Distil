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

// ============================================================
// generateReferralPdf.js — One-page medical referral document
// The patient takes this to their ENT / physician appointment.
// Layout modeled on generatePurchaseAgreement.js (jsPDF primitives,
// selectable text).
// ============================================================

import { jsPDF } from 'jspdf'
import { referralReasonLabel, referralTypeLabel } from './lib/medicalReferral.js'

const PAGE_W = 612
const PAGE_H = 792
const M = 44
const CW = PAGE_W - M * 2
const NAVY = [10, 22, 40]
const GRAY = [107, 114, 128]
const LIGHT_GRAY = [229, 231, 235]
const MED_GRAY = [156, 163, 175]
const BLACK = [0, 0, 0]

function todayFormatted() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function drawHR(doc, y) {
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.4)
  doc.line(M, y, PAGE_W - M, y)
  return y + 1
}

// ============================================================
// MAIN EXPORT — One-page medical referral
//   patient:    { name, dob, phone }
//   clinic:     { name, address, phone }
//   provider:   { fullName, activeLicense }
//   referralType: 'ent' | 'physician' | 'other'
//   reasons:    array of REFERRAL_REASONS keys (checked red flags)
//   notes:      provider narrative (optional unless other_medical_concern)
//   referredTo: free-text practice/physician name (optional)
//   audiometry: optional { right: {pta, pta4, wrs}, left: {pta, pta4, wrs} }
//   signatureImageBase64: optional provider signature PNG
// ============================================================
export function generateReferralPdf({
  patient,
  clinic,
  provider,
  referralType = 'ent',
  reasons = [],
  notes = '',
  referredTo = '',
  audiometry = null,
  signatureImageBase64 = null,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  let y = M

  // ── HEADER ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...NAVY)
  doc.text('MY HEARING CENTERS', M, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(`${clinic.address || ''}  ·  ${clinic.phone || ''}`, M, y + 13)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...NAVY)
  doc.text('MEDICAL REFERRAL', PAGE_W - M, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(`Date: ${todayFormatted()}`, PAGE_W - M, y + 13, { align: 'right' })

  y += 24
  y = drawHR(doc, y)
  y += 12

  // ── PATIENT / REFERRED TO ──
  const col2 = M + CW * 0.38
  const col3 = M + CW * 0.72
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...MED_GRAY)
  doc.text('Patient', M, y)
  doc.text('Date of Birth', col2, y)
  doc.text('Phone', col3, y)
  y += 11
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)
  doc.text(patient.name || '—', M, y)
  doc.text(patient.dob || '—', col2, y)
  doc.text(patient.phone || '—', col3, y)
  y += 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...MED_GRAY)
  doc.text('Referred For Evaluation By', M, y)
  y += 11
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)
  const referredLine = referredTo
    ? `${referralTypeLabel(referralType)} — ${referredTo}`
    : referralTypeLabel(referralType)
  doc.text(referredLine, M, y)

  y += 14
  y = drawHR(doc, y)
  y += 14

  // ── PURPOSE ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BLACK)
  const intro =
    `${patient.name || 'This patient'} was seen at ${clinic.name || 'My Hearing Centers'} for a hearing ` +
    `evaluation on ${todayFormatted()}. During the visit, the finding(s) listed below were identified. ` +
    `These findings warrant medical evaluation before we proceed with hearing aid fitting, so we are ` +
    `referring the patient to you for examination and, if appropriate, medical clearance for amplification.`
  doc.splitTextToSize(intro, CW).forEach(line => { doc.text(line, M, y); y += 12 })
  y += 8

  // ── REASONS FOR REFERRAL ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...NAVY)
  doc.text('REASON(S) FOR REFERRAL', M, y)
  y += 14

  reasons.forEach(key => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    doc.text('•', M + 4, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...BLACK)
    const lines = doc.splitTextToSize(referralReasonLabel(key), CW - 20)
    lines.forEach((line, i) => { doc.text(line, M + 16, y + i * 12) })
    y += lines.length * 12 + 3
  })

  if (notes && notes.trim()) {
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...MED_GRAY)
    doc.text('PROVIDER NOTES', M, y)
    y += 11
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...BLACK)
    doc.splitTextToSize(notes.trim(), CW).forEach(line => { doc.text(line, M, y); y += 12 })
  }

  // ── AUDIOMETRIC SUMMARY (optional) ──
  const hasAud = audiometry && (audiometry.right || audiometry.left)
  if (hasAud) {
    y += 10
    y = drawHR(doc, y)
    y += 14
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...NAVY)
    doc.text('AUDIOMETRIC SUMMARY (THIS VISIT)', M, y)
    y += 12

    const cols = [M, M + 110, M + 230, M + 350]
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...MED_GRAY)
    ;['Ear', 'PTA (.5/1/2 kHz)', 'PTA4 (.5/1/2/4 kHz)', 'Word Recognition'].forEach((h, i) => doc.text(h, cols[i], y))
    y += 11

    const earRow = (label, ear) => {
      if (!ear) return
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...NAVY)
      doc.text(label, cols[0], y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...BLACK)
      doc.text(ear.pta != null ? `${ear.pta} dB HL` : '—', cols[1], y)
      doc.text(ear.pta4 != null ? `${ear.pta4} dB HL` : '—', cols[2], y)
      doc.text(ear.wrs != null && ear.wrs !== '' ? `${ear.wrs}%` : '—', cols[3], y)
      y += 13
    }
    earRow('Right', audiometry.right)
    earRow('Left', audiometry.left)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text('Full audiometric results are available from our office on request.', M, y + 2)
    y += 12
  }

  // ── NEXT STEP FOR THE PATIENT ──
  y += 10
  y = drawHR(doc, y)
  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...NAVY)
  doc.text('AFTER YOUR MEDICAL APPOINTMENT', M, y)
  y += 13
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BLACK)
  const nextStep =
    `Please bring this document to your medical appointment. Once your medical provider has completed ` +
    `their evaluation, contact our office to continue your hearing care. If your provider gives medical ` +
    `clearance for hearing aids, we will pick up right where we left off.`
  doc.splitTextToSize(nextStep, CW).forEach(line => { doc.text(line, M, y); y += 12 })

  // ── PROVIDER SIGNATURE ──
  y += 16
  const sigBoxW = CW * 0.55
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.4)
  doc.roundedRect(M, y, sigBoxW, 48, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...MED_GRAY)
  doc.text('REFERRING PROVIDER', M + 8, y + 10)
  if (signatureImageBase64) {
    try { doc.addImage(signatureImageBase64, 'PNG', M + 8, y + 13, 90, 24) }
    catch {
      doc.setFont('helvetica', 'bolditalic')
      doc.setFontSize(13)
      doc.setTextColor(...NAVY)
      doc.text(provider.fullName, M + 8, y + 30)
    }
  } else {
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text(provider.fullName, M + 8, y + 30)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...GRAY)
  doc.text(`${provider.fullName}  ·  License: ${provider.activeLicense || '—'}`, M + 8, y + 42)

  // ── FOOTER ──
  const footerY = PAGE_H - 24
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MED_GRAY)
  doc.text(
    `${clinic.name || 'My Hearing Centers'} · ${clinic.address || ''} · ${clinic.phone || ''}  ·  Generated by Distil CRM`,
    PAGE_W / 2, footerY, { align: 'center' }
  )

  return doc
}

// ============================================================
// Convenience: generate, trigger download, and return artifacts
// for archiving (caller uploads `blob` to patient_documents).
// ============================================================
export function downloadReferralPdf(params) {
  const doc = generateReferralPdf(params)
  const patientName = (params.patient.name || 'patient').replace(/\s+/g, '_')
  const date = new Date().toISOString().split('T')[0]
  const fileName = `Medical_Referral_${patientName}_${date}.pdf`
  doc.save(fileName)
  const blob = doc.output('blob')
  return { doc, blob, fileName }
}
