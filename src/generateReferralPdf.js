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
// generateReferralPdf.js — Medical referral document
// The patient takes this to their ENT / physician appointment.
// Layout modeled on generatePurchaseAgreement.js (jsPDF primitives,
// selectable text). Runs one to two pages: the referral letter plus a
// clinical audiogram (AC + BC, standard symbol set, Avant-style plain
// grid — no counseling shading) and the FDA medical-safety battery
// from the patient's intake with per-question provider notes.
// ============================================================

import { jsPDF } from 'jspdf'
import { referralReasonLabel, referralTypeLabel } from './lib/medicalReferral.js'
import { AUDIG_FREQS } from './audiogramAnalysis.js'

const PAGE_W = 612
const PAGE_H = 792
const M = 44
const CW = PAGE_W - M * 2
const NAVY = [10, 22, 40]
const GRAY = [107, 114, 128]
const LIGHT_GRAY = [229, 231, 235]
const MED_GRAY = [156, 163, 175]
const BLACK = [0, 0, 0]
// Clinical plot colors — match the on-screen AudigramSVG conventions.
const RED_AC = [220, 38, 38]
const BLUE_AC = [37, 99, 235]
const GRID = [209, 213, 219]
const GRID_LIGHT = [224, 227, 231]

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
// Clinical audiogram panel — one ear, Avant/MedRx-style printout:
// plain white grid, octave columns evenly spaced with inter-octaves
// midway (lighter, dashed), -10..120 dB HL, standard symbol set:
//   Right: AC ○ (masked △), BC < (masked [) — red
//   Left:  AC ✕ (masked □), BC > (masked ]) — blue
// AC connected solid, BC connected dashed (mirrors the on-screen chart).
// ============================================================
const FREQ_POS = { 250: 0, 500: 1, 750: 1.5, 1000: 2, 1500: 2.5, 2000: 3, 3000: 3.5, 4000: 4, 6000: 4.5, 8000: 5 }
const FREQ_POS_MAX = 5
const INTER_OCTAVES = new Set([750, 1500, 3000, 6000])
const DB_MIN = -10
const DB_MAX = 120

function drawEarAudiogram(doc, x0, y0, w, h, side, { ac = {}, bc = {}, acMask = {}, bcMask = {} }) {
  const color = side === 'right' ? RED_AC : BLUE_AC
  const L = 24, T = 24, R = 6, B = 6
  const plotX = x0 + L, plotY = y0 + T
  const plotW = w - L - R, plotH = h - T - B
  const fx = f => plotX + (FREQ_POS[f] / FREQ_POS_MAX) * plotW
  const dy = db => plotY + ((db - DB_MIN) / (DB_MAX - DB_MIN)) * plotH

  // Panel title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...color)
  doc.text(side === 'right' ? 'RIGHT EAR' : 'LEFT EAR', x0 + w / 2, y0 + 7, { align: 'center' })

  // dB HL axis caption + labels (every 20 dB keeps the margin readable)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  doc.setTextColor(...MED_GRAY)
  doc.text('dB HL', x0 + 2, plotY - 3)
  doc.setFontSize(5.5)
  doc.setTextColor(...GRAY)
  for (let db = 0; db <= DB_MAX; db += 20) {
    doc.text(String(db), plotX - 3, dy(db) + 2, { align: 'right' })
  }

  // Frequency labels above the plot — octaves dark, inter-octaves lighter
  AUDIG_FREQS.forEach(f => {
    const inter = INTER_OCTAVES.has(f)
    doc.setFont('helvetica', inter ? 'normal' : 'bold')
    doc.setFontSize(inter ? 4.5 : 5.5)
    doc.setTextColor(...(inter ? MED_GRAY : GRAY))
    doc.text(f >= 1000 ? `${f / 1000}k` : String(f), fx(f), plotY - 3, { align: 'center' })
  })

  // Grid — horizontal every 10 dB (0 dB line darker), vertical per frequency
  for (let db = DB_MIN; db <= DB_MAX; db += 10) {
    if (db === 0) { doc.setDrawColor(107, 114, 128); doc.setLineWidth(0.7) }
    else { doc.setDrawColor(...GRID_LIGHT); doc.setLineWidth(0.35) }
    doc.line(plotX, dy(db), plotX + plotW, dy(db))
  }
  AUDIG_FREQS.forEach(f => {
    const inter = INTER_OCTAVES.has(f)
    doc.setDrawColor(...(inter ? GRID_LIGHT : GRID))
    doc.setLineWidth(0.35)
    if (inter) doc.setLineDashPattern([1.5, 1.5], 0)
    doc.line(fx(f), plotY, fx(f), plotY + plotH)
    if (inter) doc.setLineDashPattern([], 0)
  })
  // Plot border
  doc.setDrawColor(...GRID)
  doc.setLineWidth(0.6)
  doc.rect(plotX, plotY, plotW, plotH, 'S')

  // Connecting lines — AC solid, BC dashed (clip nothing; points only where tested)
  const pts = map => AUDIG_FREQS.filter(f => map[f] != null).map(f => [fx(f), dy(map[f])])
  const drawPolyline = (p, dashed) => {
    if (p.length < 2) return
    doc.setDrawColor(...color)
    doc.setLineWidth(0.9)
    if (dashed) doc.setLineDashPattern([2, 1.5], 0)
    for (let i = 1; i < p.length; i++) doc.line(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1])
    if (dashed) doc.setLineDashPattern([], 0)
  }
  drawPolyline(pts(ac), false)
  drawPolyline(pts(bc), true)

  // Threshold symbols — drawn after the lines so they sit on top.
  const s = 2.8
  doc.setDrawColor(...color)
  doc.setFillColor(255, 255, 255)
  doc.setLineWidth(0.9)
  AUDIG_FREQS.forEach(f => {
    if (ac[f] == null) return
    const cx = fx(f), cy = dy(ac[f])
    if (side === 'right') {
      if (acMask[f]) doc.triangle(cx, cy - s, cx + s, cy + s, cx - s, cy + s, 'FD')
      else doc.circle(cx, cy, s, 'FD')
    } else {
      if (acMask[f]) doc.rect(cx - s, cy - s, s * 2, s * 2, 'FD')
      else {
        doc.line(cx - s, cy - s, cx + s, cy + s)
        doc.line(cx + s, cy - s, cx - s, cy + s)
      }
    }
  })
  AUDIG_FREQS.forEach(f => {
    if (bc[f] == null) return
    const cx = fx(f), cy = dy(bc[f])
    if (side === 'right') {
      // '<' unmasked, '[' masked
      if (bcMask[f]) {
        doc.line(cx + s, cy - s, cx - s + 1, cy - s)
        doc.line(cx - s + 1, cy - s, cx - s + 1, cy + s)
        doc.line(cx - s + 1, cy + s, cx + s, cy + s)
      } else {
        doc.line(cx + s, cy - s, cx - s + 1, cy)
        doc.line(cx - s + 1, cy, cx + s, cy + s)
      }
    } else {
      // '>' unmasked, ']' masked
      if (bcMask[f]) {
        doc.line(cx - s, cy - s, cx + s - 1, cy - s)
        doc.line(cx + s - 1, cy - s, cx + s - 1, cy + s)
        doc.line(cx + s - 1, cy + s, cx - s, cy + s)
      } else {
        doc.line(cx - s, cy - s, cx + s - 1, cy)
        doc.line(cx + s - 1, cy, cx - s, cy + s)
      }
    }
  })
}

// Symbol legend row under the two panels. Each item draws its symbol at
// (x, y) then its label; returns the x where the next item starts.
function drawAudiogramLegend(doc, y, panels) {
  const s = 2.4
  const item = (x, color, drawSym, label) => {
    doc.setDrawColor(...color)
    doc.setFillColor(255, 255, 255)
    doc.setLineWidth(0.8)
    drawSym(x + s, y - 1.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...GRAY)
    doc.text(label, x + s * 2 + 3, y)
    return x + s * 2 + 3 + doc.getTextWidth(label) + 9
  }
  panels.forEach(({ x0, w, side }) => {
    const color = side === 'right' ? RED_AC : BLUE_AC
    const items = side === 'right'
      ? [
          [(cx, cy) => doc.circle(cx, cy, s, 'FD'), 'Air'],
          [(cx, cy) => doc.triangle(cx, cy - s, cx + s, cy + s, cx - s, cy + s, 'FD'), 'Air masked'],
          [(cx, cy) => { doc.line(cx + s, cy - s, cx - s + 0.8, cy); doc.line(cx - s + 0.8, cy, cx + s, cy + s) }, 'Bone'],
          [(cx, cy) => { doc.line(cx + s, cy - s, cx - s + 0.8, cy - s); doc.line(cx - s + 0.8, cy - s, cx - s + 0.8, cy + s); doc.line(cx - s + 0.8, cy + s, cx + s, cy + s) }, 'Bone masked'],
        ]
      : [
          [(cx, cy) => { doc.line(cx - s, cy - s, cx + s, cy + s); doc.line(cx + s, cy - s, cx - s, cy + s) }, 'Air'],
          [(cx, cy) => doc.rect(cx - s, cy - s, s * 2, s * 2, 'FD'), 'Air masked'],
          [(cx, cy) => { doc.line(cx - s, cy - s, cx + s - 0.8, cy); doc.line(cx + s - 0.8, cy, cx - s, cy + s) }, 'Bone'],
          [(cx, cy) => { doc.line(cx - s, cy - s, cx + s - 0.8, cy - s); doc.line(cx + s - 0.8, cy - s, cx + s - 0.8, cy + s); doc.line(cx + s - 0.8, cy + s, cx - s, cy + s) }, 'Bone masked'],
        ]
    // Measure total width first so the legend centers under its panel.
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    const totalW = items.reduce((acc, [, label]) => acc + s * 2 + 3 + doc.getTextWidth(label) + 9, 0) - 9
    let x = x0 + (w - totalW) / 2
    items.forEach(([sym, label]) => { x = item(x, color, sym, label) })
  })
}

// ============================================================
// MAIN EXPORT — Medical referral document
//   patient:    { name, dob, phone }
//   clinic:     { name, address, phone }
//   provider:   { fullName, activeLicense }
//   referralType: 'ent' | 'physician' | 'other'
//   reasons:    array of REFERRAL_REASONS keys (checked red flags)
//   notes:      provider narrative (optional unless other_medical_concern)
//   referredTo: free-text practice/physician name (optional)
//   audiometry: optional { right: {pta, pta4, wrs}, left: {pta, pta4, wrs} }
//   audiogram:  optional full threshold maps for the clinical charts —
//               { rightT, leftT, rightBC, leftBC, rightMask, leftMask,
//                 rightBCMask, leftBCMask } (Hz → dB HL / Hz → bool)
//   safety:     optional medical-safety battery snapshot from intake —
//               array of { label, answer: 'yes'|'no'|'unanswered', note }
//               (see buildSafetySnapshot in lib/medicalReferral.js)
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
  audiogram = null,
  safety = null,
  signatureImageBase64 = null,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  let y = M

  // Content now runs past one page (audiogram + safety battery), so
  // sections reserve their space and break cleanly instead of clipping.
  const BOTTOM = PAGE_H - 56
  const newPage = () => {
    doc.addPage()
    y = M
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MED_GRAY)
    doc.text(`MEDICAL REFERRAL — ${(patient.name || '').toUpperCase()} (CONTINUED)`, M, y)
    y += 8
    y = drawHR(doc, y)
    y += 14
  }
  const ensureSpace = (needed) => { if (y + needed > BOTTOM) newPage() }

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

  // ── AUDIOMETRIC FINDINGS (optional) ──
  // Clinical audiogram panels (full AC/BC plot) plus the PTA/PTA4/WRS
  // summary table. Either half renders independently of the other.
  const hasChart = audiogram &&
    ['rightT', 'leftT', 'rightBC', 'leftBC'].some(k => audiogram[k] && Object.keys(audiogram[k]).length > 0)
  const hasAud = audiometry && (audiometry.right || audiometry.left)
  if (hasChart || hasAud) {
    const gap = 16
    const panelW = (CW - gap) / 2
    const panelH = 196
    y += 10
    y = drawHR(doc, y)
    y += 14
    if (hasChart) ensureSpace(12 + panelH + 22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...NAVY)
    doc.text('AUDIOMETRIC FINDINGS (THIS VISIT)', M, y)
    y += 10

    if (hasChart) {
      drawEarAudiogram(doc, M, y, panelW, panelH, 'right', {
        ac: audiogram.rightT || {}, bc: audiogram.rightBC || {},
        acMask: audiogram.rightMask || {}, bcMask: audiogram.rightBCMask || {},
      })
      drawEarAudiogram(doc, M + panelW + gap, y, panelW, panelH, 'left', {
        ac: audiogram.leftT || {}, bc: audiogram.leftBC || {},
        acMask: audiogram.leftMask || {}, bcMask: audiogram.leftBCMask || {},
      })
      y += panelH + 8
      drawAudiogramLegend(doc, y, [
        { x0: M, w: panelW, side: 'right' },
        { x0: M + panelW + gap, w: panelW, side: 'left' },
      ])
      y += 14
    }

    if (hasAud) {
      ensureSpace(50)
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
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text('Full audiometric results are available from our office on request.', M, y + 2)
    y += 12
  }

  // ── MEDICAL SAFETY QUESTIONNAIRE (optional) ──
  // The FDA safety battery from the patient's intake, answer per item,
  // with the provider's per-question clinical note underneath. Unanswered
  // items print as "Not answered" — never silently as a No.
  if (safety && safety.length) {
    y += 10
    y = drawHR(doc, y)
    y += 14
    ensureSpace(46)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...NAVY)
    doc.text('MEDICAL SAFETY QUESTIONNAIRE (PATIENT INTAKE)', M, y)
    y += 12
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('The patient reported the following on the medical portion of our intake questionnaire.', M, y)
    y += 14

    const answerX = PAGE_W - M
    safety.forEach(row => {
      const labelLines = doc.splitTextToSize(row.label, CW - 100)
      const noteLines = row.note
        ? doc.splitTextToSize(`Provider note: ${row.note}`, CW - 28)
        : []
      ensureSpace(labelLines.length * 12 + noteLines.length * 10 + 8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...BLACK)
      labelLines.forEach((line, i) => { doc.text(line, M, y + i * 12) })
      if (row.answer === 'yes') {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...NAVY)
        doc.text('Yes', answerX, y, { align: 'right' })
      } else if (row.answer === 'no') {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...BLACK)
        doc.text('No', answerX, y, { align: 'right' })
      } else {
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(...MED_GRAY)
        doc.text('Not answered', answerX, y, { align: 'right' })
      }
      y += labelLines.length * 12
      if (noteLines.length) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(...GRAY)
        noteLines.forEach(line => { doc.text(line, M + 12, y); y += 10 })
        y += 2
      }
      y += 4
    })
  }

  // ── NEXT STEP FOR THE PATIENT ──
  ensureSpace(160)
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
  ensureSpace(76)
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

  // ── FOOTER (every page, with page numbers once it runs long) ──
  const footerY = PAGE_H - 24
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...MED_GRAY)
    doc.text(
      `${clinic.name || 'My Hearing Centers'} · ${clinic.address || ''} · ${clinic.phone || ''}  ·  Generated by Distil CRM`,
      PAGE_W / 2, footerY, { align: 'center' }
    )
    if (pageCount > 1) {
      doc.text(`Page ${i} of ${pageCount}`, PAGE_W - M, footerY, { align: 'right' })
    }
  }

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
