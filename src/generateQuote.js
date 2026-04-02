// ============================================================
// generateQuote.js — Quote PDF generation for Distil CRM
// Uses jsPDF to create a comprehensive take-home quote with
// device specs, all care plan options, audiogram, and education.
// ============================================================

import { jsPDF } from 'jspdf'

// ── Constants ────────────────────────────────────────────────
const PAGE_W = 612   // US Letter width in pts (8.5")
const PAGE_H = 792   // US Letter height in pts (11")
const MARGIN = 50
const CONTENT_W = PAGE_W - MARGIN * 2
const NAVY = [10, 22, 40]
const GRAY = [107, 114, 128]
const LIGHT_GRAY = [229, 231, 235]
const MED_GRAY = [156, 163, 175]
const BLACK = [0, 0, 0]
const WHITE = [255, 255, 255]
const GREEN = [22, 163, 74]

// Care plan metadata
const CARE_PLAN_META = {
  paygo:    { label: 'Pay-As-You-Go', warrantyYears: 3, coverageYears: 0, price: null, fiveYearCost: 1625, ldCost: 275 },
  punch:    { label: 'Treatment Punch Card', warrantyYears: 3, coverageYears: 4, price: 575, ldCost: 275 },
  complete: { label: 'Complete Care+', warrantyYears: 5, coverageYears: 5, price: 1250, ldCost: 275 },
}

// Plan comparison data
const PLAN_COMPARE = [
  { label: 'Cost',                 paygo: '$65/visit',    punch: '$575 one-time',  complete: '$1,250 one-time' },
  { label: 'Office Visits',        paygo: 'Per visit',    punch: 'All visits (4 yrs)',  complete: 'Unlimited (5 yrs)' },
  { label: 'Cleanings',            paygo: 'Per visit',    punch: 'All included (4 yrs)', complete: 'Unlimited (5 yrs)' },
  { label: 'Adjustments & Triage', paygo: 'Per visit',    punch: 'All included (4 yrs)', complete: 'Unlimited (5 yrs)' },
  { label: 'Warranty',             paygo: '3 years',      punch: '3 years',        complete: '5 years' },
  { label: 'Loss & Damage',       paygo: '$275/aid (3 yrs)', punch: '$275/aid (3 yrs)', complete: '$275/aid (5 yrs)' },
]

// Coverage dot data per plan (9 visits over lifecycle)
const PLAN_COV = {
  paygo:    ['oop','oop','oop','oop','oop','oop','oop','oop','oop'],
  punch:    ['inc','inc','inc','inc','inc','inc','inc','inc','oop'],
  complete: ['inc','inc','inc','inc','inc','inc','inc','inc','inc'],
}
const COV_COLORS = {
  inc:  { fill: [22, 163, 74],  stroke: [21, 128, 61]  },
  oop:  { fill: [255,255,255],  stroke: [209, 213, 219] },
}

// Audiogram constants
const FREQS = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000]
const DEGREE_REGIONS = [
  { label: 'Normal',     from: -10, to: 20,  fill: [220, 252, 231] },
  { label: 'Mild',       from: 25,  to: 40,  fill: [254, 249, 195] },
  { label: 'Moderate',   from: 40,  to: 55,  fill: [254, 215, 170] },
  { label: 'Mod-Severe', from: 55,  to: 70,  fill: [254, 202, 202] },
  { label: 'Severe',     from: 70,  to: 90,  fill: [252, 165, 165] },
  { label: 'Profound',   from: 90,  to: 120, fill: [239, 68, 68]   },
]

// Why treatment matters — evidence-based cards
const WHY_IT_MATTERS = [
  { title: 'Relationships & connection',
    body: 'Communication difficulty strains relationships in ways patients often don\'t name directly. Spouses, children, and colleagues consistently report higher satisfaction and less frustration after treatment begins. For most patients, this is the most immediate and tangible benefit they notice.' },
  { title: 'Reducing cognitive load',
    body: 'Untreated hearing loss forces the brain to divert resources away from memory and comprehension just to decode sound. Research consistently shows that hearing aid users demonstrate better working memory performance and experience less cognitive fatigue during conversation.' },
  { title: 'Listening fatigue',
    body: 'Listening fatigue is real, measurable, and often underreported. Patients describe it as a kind of exhaustion that sneaks up on them — especially after crowded environments, work meetings, or social events. Correcting the input signal reduces this burden substantially.' },
  { title: 'Auditory plasticity — the case for acting now',
    body: 'Hearing pathways that go unstimulated over time become less efficient. This is why fitting sooner rather than later consistently produces better long-term outcomes, even in patients who feel they\'re managing fine. The brain adapts to what it receives — give it more to work with.' },
  { title: 'Cognitive health — one piece of a larger picture',
    body: 'Large-scale studies, including the Lancet Commission on Dementia Prevention, have identified untreated hearing loss as one of the largest modifiable risk factors for cognitive decline in midlife. This doesn\'t mean hearing loss causes dementia — it means treating it is one of the more impactful preventive steps available. Worth knowing, not worth catastrophizing.' },
]

// ── Helpers ──────────────────────────────────────────────────
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

function drawHR(doc, y, x1 = MARGIN, x2 = PAGE_W - MARGIN) {
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.5)
  doc.line(x1, y, x2, y)
  return y + 2
}

function checkPage(doc, y, needed = 80) {
  if (y + needed > PAGE_H - MARGIN - 30) { // leave room for footer
    doc.addPage()
    return MARGIN + 20
  }
  return y
}

function getPTA(t) {
  const fs = [500, 1000, 2000, 4000]
  const v = fs.map(f => t?.[f]).filter(x => x != null)
  return v.length ? Math.round(v.reduce((a, b) => a + b) / v.length) : null
}

function getDegreeName(pta) {
  if (pta == null) return null
  if (pta <= 20) return 'Normal'
  if (pta <= 40) return 'Mild'
  if (pta <= 55) return 'Moderate'
  if (pta <= 70) return 'Moderately Severe'
  if (pta <= 90) return 'Severe'
  return 'Profound'
}

function drawFooter(doc, clinic, pageNum, totalPages) {
  const y = PAGE_H - 30
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MED_GRAY)
  doc.text(`${clinic.name || ''} · ${clinic.address || ''} · ${clinic.phone || ''}`, PAGE_W / 2, y, { align: 'center' })
  doc.text(`Quote valid for 30 days from ${todayFormatted()}  ·  Page ${pageNum} of ${totalPages}  ·  Generated by Distil CRM`, PAGE_W / 2, y + 10, { align: 'center' })
}


// ============================================================
// MAIN EXPORT
// ============================================================
export function generateQuote({
  patient,
  devices,
  pricePerAid,
  selectedCarePlan,
  payType,
  tpa,
  carrier,
  audiology,
  counselingSections,
  clinic,
  provider,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const cpMeta = CARE_PLAN_META[selectedCarePlan] || CARE_PLAN_META.complete
  const isBilateral = devices.fittingType === 'bilateral' || devices.fittingType === 'cros_bicros'
  const aidCount = isBilateral ? 2 : 1
  const deviceTotal = (pricePerAid || 0) * aidCount
  const carePlanPrice = cpMeta.price || 0
  const totalPrice = deviceTotal + carePlanPrice

  // TPA-specific PAYG cost for savings calc
  const isTruHearing = (tpa || '').toLowerCase().includes('truhearing')
  const isUHCH = (tpa || '').toLowerCase().includes('uhc')
  const paygo4yr = isTruHearing ? 975 : isUHCH ? 1235 : 20 * 65

  let y = MARGIN

  // ═══════════════════════════════════════════════════════════
  // PAGE 1: Device Specs + Recommended Plan
  // ═══════════════════════════════════════════════════════════

  // ── Header ──
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
  doc.text('HEARING CARE', PAGE_W - MARGIN, MARGIN, { align: 'right' })
  doc.text('QUOTE', PAGE_W - MARGIN, MARGIN + 18, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Date: ${todayFormatted()}`, PAGE_W - MARGIN, MARGIN + 36, { align: 'right' })

  y += 18
  y = drawHR(doc, y)
  y += 14

  // Prepared for
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text('Prepared for', MARGIN, y)
  doc.text('By', PAGE_W / 2, y)
  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text(patient.name || '—', MARGIN, y)
  doc.text(provider.fullName || '—', PAGE_W / 2, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  if (patient.phone) doc.text(patient.phone, MARGIN, y)
  if (provider.activeLicense) doc.text(`License: ${provider.activeLicense}`, PAGE_W / 2, y)

  y += 20
  y = drawHR(doc, y)
  y += 14

  // ── Device Specifications Table ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('DEVICE SPECIFICATIONS', MARGIN, y)
  y += 6

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
  colLabels.forEach((label, i) => doc.text(label, colX[i] + 6, y + 2))
  y += 16

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
    const model = [side.family, side.variant, side.techLevel].filter(Boolean).join(' ')
    doc.text(model || '—', colX[2] + 6, y + 2)
    doc.text(side.style || '—', colX[3] + 6, y + 2)
    doc.text(side.battery || '—', colX[4] + 6, y + 2)
    doc.setFont('helvetica', 'bold')
    doc.text(fmt$(pricePerAid), colX[5] + 6, y + 2)
    y += 20
  }

  if (isBilateral) {
    renderDeviceRow('Right', devices.right, [248, 250, 252])
    renderDeviceRow('Left', devices.left, WHITE)
  } else if (devices.fittingType === 'monaural_right') {
    renderDeviceRow('Right', devices.right, [248, 250, 252])
  } else {
    renderDeviceRow('Left', devices.left, [248, 250, 252])
  }

  // Device subtotal
  doc.setFillColor(...LIGHT_GRAY)
  doc.rect(MARGIN, y - 10, CONTENT_W, 20, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`Device Total (${aidCount === 2 ? 'pair' : 'single'})`, colX[0] + 6, y + 2)
  doc.text(fmt$(deviceTotal), colX[5] + 6, y + 2)
  y += 28

  // ── Recommended Care Plan ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('RECOMMENDED CARE PLAN', MARGIN, y)
  y += 14

  // Green accent box
  const recBoxH = selectedCarePlan === 'paygo' ? 72 : 50
  doc.setFillColor(240, 253, 244) // light green bg
  doc.roundedRect(MARGIN, y - 6, CONTENT_W, recBoxH, 4, 4, 'F')
  doc.setFillColor(...GREEN)
  doc.rect(MARGIN, y - 6, 4, recBoxH, 'F') // left accent bar

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...GREEN)
  doc.text('YOUR PROVIDER RECOMMENDS', MARGIN + 14, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text(cpMeta.label, MARGIN + 14, y + 20)

  if (selectedCarePlan !== 'paygo' && cpMeta.price) {
    doc.text(fmt$(cpMeta.price), PAGE_W - MARGIN - 14, y + 20, { align: 'right' })
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  if (selectedCarePlan === 'complete') {
    doc.text('Unlimited visits, cleanings, adjustments, and repairs for 5 years', MARGIN + 14, y + 34)
  } else if (selectedCarePlan === 'punch') {
    doc.text('All visits and cleanings covered for 4 years', MARGIN + 14, y + 34)
  } else {
    doc.text('$65 per visit · Annual exams covered', MARGIN + 14, y + 34)
    doc.text(`Estimated 5-year cost: ${fmt$(cpMeta.fiveYearCost)}`, MARGIN + 14, y + 48)
  }

  y += recBoxH + 14

  // ── Total Investment ──
  doc.setFillColor(...NAVY)
  doc.roundedRect(MARGIN, y - 6, CONTENT_W, 32, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...WHITE)
  doc.text('RECOMMENDED INVESTMENT', MARGIN + 14, y + 14)
  doc.text(fmt$(totalPrice), PAGE_W - MARGIN - 14, y + 14, { align: 'right' })

  y += 44

  // Insurance note
  if (payType === 'insurance' && carrier) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(`Coverage: ${carrier}${tpa ? ` (${tpa})` : ''}  ·  Prices shown reflect your plan's copay`, MARGIN, y)
    y += 16
  }


  // ═══════════════════════════════════════════════════════════
  // PAGE 2: Care Plan Comparison
  // ═══════════════════════════════════════════════════════════
  doc.addPage()
  y = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text('Care Plan Options', MARGIN, y)
  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text('Compare all three plans to find the best fit for your needs and budget.', MARGIN, y)
  y += 24

  // ── Comparison Table ──
  const tableX = MARGIN
  const labelColW = 130
  const planColW = (CONTENT_W - labelColW) / 3
  const planIds = ['paygo', 'punch', 'complete']
  const planLabels = ['Pay-As-You-Go', 'Punch Card', 'Complete Care+']

  // Header row
  doc.setFillColor(...NAVY)
  doc.rect(tableX, y - 8, CONTENT_W, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...WHITE)
  doc.text('', tableX + 6, y + 4)
  planLabels.forEach((label, i) => {
    const px = tableX + labelColW + i * planColW
    // Highlight selected plan column header
    if (planIds[i] === selectedCarePlan) {
      doc.setFillColor(30, 64, 175) // brighter blue
      doc.rect(px, y - 8, planColW, 22, 'F')
    }
    doc.setTextColor(...WHITE)
    doc.text(label, px + 8, y + 4)
  })
  y += 22

  // Data rows
  PLAN_COMPARE.forEach((row, ri) => {
    const rowH = 22
    const bgColor = ri % 2 === 0 ? [248, 250, 252] : WHITE
    doc.setFillColor(...bgColor)
    doc.rect(tableX, y - 8, CONTENT_W, rowH, 'F')

    // Highlight selected plan column
    const selIdx = planIds.indexOf(selectedCarePlan)
    if (selIdx >= 0) {
      doc.setFillColor(239, 246, 255) // very light blue
      doc.rect(tableX + labelColW + selIdx * planColW, y - 8, planColW, rowH, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...NAVY)
    doc.text(row.label, tableX + 8, y + 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...BLACK)
    doc.text(row.paygo, tableX + labelColW + 8, y + 5)
    doc.text(row.punch, tableX + labelColW + planColW + 8, y + 5)
    // Complete column may have longer text
    const compLines = wrapText(doc, row.complete, planColW - 16)
    doc.text(compLines[0], tableX + labelColW + 2 * planColW + 8, y + 5)

    y += rowH
  })
  y += 16

  // ── Savings vs Pay-As-You-Go ──
  const punchSavings = paygo4yr - 575
  const completeSavings = paygo4yr - 1250
  if (punchSavings > 0 || completeSavings > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    doc.text('ESTIMATED SAVINGS vs. PAY-AS-YOU-GO', MARGIN, y)
    y += 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...BLACK)
    if (punchSavings > 0) {
      doc.setTextColor(...GREEN)
      doc.text(`Punch Card saves ${fmt$(punchSavings)} over the typical hearing aid lifecycle`, MARGIN + 8, y)
      y += 14
    }
    if (completeSavings > 0) {
      doc.setTextColor(...GREEN)
      doc.text(`Complete Care+ saves ${fmt$(completeSavings)} over the typical hearing aid lifecycle`, MARGIN + 8, y)
      y += 14
    }
    doc.setTextColor(...GRAY)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.text(isTruHearing
      ? 'Based on TruHearing Select visit bundling over the warranty period.'
      : isUHCH
        ? 'Based on UnitedHealthcare Hearing visit bundling over the warranty period.'
        : 'Based on ~5 visits/year at $65/visit over a 4-year lifecycle.',
      MARGIN + 8, y)
    y += 20
  }

  // ── Coverage Infographic ──
  y = checkPage(doc, y, 180)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text('HEARING JOURNEY — 4-YEAR LIFECYCLE', MARGIN, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Each dot represents a typical clinic visit. Color shows what the plan covers.', MARGIN, y)
  y += 18

  // Draw 3 rows of dots
  const dotR = 6
  const dotSpacing = 42
  const dotStartX = MARGIN + 120
  const rowLabels = ['Pay-As-You-Go', 'Punch Card', 'Complete Care+']
  const rowKeys = ['paygo', 'punch', 'complete']

  rowKeys.forEach((key, ri) => {
    const ry = y + ri * 30

    // Plan label
    doc.setFont('helvetica', ri === planIds.indexOf(selectedCarePlan) ? 'bold' : 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...NAVY)
    doc.text(rowLabels[ri], MARGIN, ry + 3)

    // Selected indicator
    if (key === selectedCarePlan) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...GREEN)
      doc.text('← Selected', MARGIN, ry + 13)
    }

    // Dots
    PLAN_COV[key].forEach((cov, di) => {
      const dx = dotStartX + di * dotSpacing
      const cc = COV_COLORS[cov]
      doc.setFillColor(...cc.fill)
      doc.setDrawColor(...cc.stroke)
      doc.setLineWidth(1.5)
      doc.circle(dx, ry, dotR, cov === 'oop' ? 'S' : 'FD')
    })
  })

  y += 100

  // Legend
  const legendItems = [
    { fill: GREEN,   stroke: [21,128,61],  label: 'Included' },
    { fill: WHITE,   stroke: [209,213,219], label: 'Out of pocket' },
  ]
  let lx = MARGIN
  legendItems.forEach(item => {
    doc.setFillColor(...item.fill)
    doc.setDrawColor(...item.stroke)
    doc.setLineWidth(1)
    const isOutline = item.label === 'Out of pocket'
    doc.circle(lx + 5, y, 4, isOutline ? 'S' : 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(item.label, lx + 14, y + 3)
    lx += 90
  })

  y += 20

  // Year markers
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MED_GRAY)
  const yearPositions = [
    { x: dotStartX, label: 'First fit' },
    { x: dotStartX + 2 * dotSpacing, label: 'Year 1' },
    { x: dotStartX + 5 * dotSpacing, label: 'Year 2' },
    { x: dotStartX + 7 * dotSpacing, label: 'Year 3' },
    { x: dotStartX + 8 * dotSpacing, label: 'Year 4+' },
  ]
  yearPositions.forEach(p => {
    doc.text(p.label, p.x, y, { align: 'center' })
  })


  // ═══════════════════════════════════════════════════════════
  // PAGE 3: Hearing Evaluation Results
  // ═══════════════════════════════════════════════════════════
  doc.addPage()
  y = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text('Your Hearing Evaluation', MARGIN, y)
  y += 22

  const hasRightT = audiology?.rightT && Object.keys(audiology.rightT).length > 0
  const hasLeftT = audiology?.leftT && Object.keys(audiology.leftT).length > 0
  const hasAudiogramData = hasRightT || hasLeftT

  if (hasAudiogramData) {
    // ── Audiogram Chart ──
    const chartX = MARGIN + 30
    const chartW = 380
    const chartH = 200
    const chartY = y

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    doc.text('AUDIOGRAM', MARGIN, y - 4)

    // Background degree-of-loss bands
    const dbMin = -10
    const dbMax = 120
    const dbRange = dbMax - dbMin
    DEGREE_REGIONS.forEach(region => {
      const ry1 = chartY + ((region.from - dbMin) / dbRange) * chartH
      const ry2 = chartY + ((region.to - dbMin) / dbRange) * chartH
      // Blend fill color with white for 40% opacity effect
      const blended = region.fill.map(c => Math.round(c * 0.4 + 255 * 0.6))
      doc.setFillColor(...blended)
      doc.rect(chartX, ry1, chartW, ry2 - ry1, 'F')
      // Region label
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...MED_GRAY)
      doc.text(region.label, chartX + chartW + 4, (ry1 + ry2) / 2 + 2)
    })

    // Grid lines
    doc.setDrawColor(...LIGHT_GRAY)
    doc.setLineWidth(0.3)
    for (let db = 0; db <= 120; db += 10) {
      const gy = chartY + ((db - dbMin) / dbRange) * chartH
      doc.line(chartX, gy, chartX + chartW, gy)
    }

    // Frequency columns
    const freqXPositions = FREQS.map((f, i) => chartX + (i / (FREQS.length - 1)) * chartW)
    freqXPositions.forEach(fx => {
      doc.line(fx, chartY, fx, chartY + chartH)
    })

    // Axis labels
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    FREQS.forEach((f, i) => {
      const label = f >= 1000 ? `${f / 1000}k` : String(f)
      doc.text(label, freqXPositions[i], chartY + chartH + 12, { align: 'center' })
    })
    doc.text('Frequency (Hz)', chartX + chartW / 2, chartY + chartH + 24, { align: 'center' })

    // dB labels
    for (let db = 0; db <= 120; db += 20) {
      const gy = chartY + ((db - dbMin) / dbRange) * chartH
      doc.text(String(db), chartX - 8, gy + 2, { align: 'right' })
    }
    // Rotated Y-axis label
    doc.text('dB HL', chartX - 26, chartY + chartH / 2, { align: 'center', angle: 90 })

    // Plot thresholds — Right ear (red circles)
    if (hasRightT) {
      const points = []
      FREQS.forEach((f, i) => {
        const db = audiology.rightT[f]
        if (db != null) {
          const px = freqXPositions[i]
          const py = chartY + ((db - dbMin) / dbRange) * chartH
          points.push({ x: px, y: py })
          doc.setFillColor(220, 38, 38) // red
          doc.setDrawColor(220, 38, 38)
          doc.setLineWidth(1.5)
          doc.circle(px, py, 4, 'FD')
        }
      })
      // Connect with lines
      if (points.length > 1) {
        doc.setDrawColor(220, 38, 38)
        doc.setLineWidth(1)
        for (let i = 1; i < points.length; i++) {
          doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y)
        }
      }
    }

    // Plot thresholds — Left ear (blue X marks)
    if (hasLeftT) {
      const points = []
      FREQS.forEach((f, i) => {
        const db = audiology.leftT[f]
        if (db != null) {
          const px = freqXPositions[i]
          const py = chartY + ((db - dbMin) / dbRange) * chartH
          points.push({ x: px, y: py })
          // Draw X
          doc.setDrawColor(37, 99, 235) // blue
          doc.setLineWidth(2)
          const s = 4
          doc.line(px - s, py - s, px + s, py + s)
          doc.line(px - s, py + s, px + s, py - s)
        }
      })
      // Connect with lines
      if (points.length > 1) {
        doc.setDrawColor(37, 99, 235)
        doc.setLineWidth(1)
        for (let i = 1; i < points.length; i++) {
          doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y)
        }
      }
    }

    // Legend
    y = chartY + chartH + 36
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    // Right ear legend
    doc.setFillColor(220, 38, 38)
    doc.circle(MARGIN + 8, y, 3.5, 'F')
    doc.setTextColor(220, 38, 38)
    doc.text('Right Ear', MARGIN + 18, y + 3)
    // Left ear legend
    doc.setDrawColor(37, 99, 235)
    doc.setLineWidth(1.5)
    const lx2 = MARGIN + 80
    doc.line(lx2 + 4, y - 3, lx2 + 10, y + 3)
    doc.line(lx2 + 4, y + 3, lx2 + 10, y - 3)
    doc.setTextColor(37, 99, 235)
    doc.text('Left Ear', lx2 + 18, y + 3)

    y += 18

    // PTA values
    const rPTA = getPTA(audiology.rightT)
    const lPTA = getPTA(audiology.leftT)
    if (rPTA != null || lPTA != null) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...NAVY)
      doc.text('PURE TONE AVERAGE (PTA)', MARGIN, y)
      y += 14
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...BLACK)
      if (rPTA != null) {
        const rDeg = getDegreeName(rPTA)
        doc.text(`Right: ${rPTA} dB HL — ${rDeg} hearing loss`, MARGIN + 8, y)
        y += 14
      }
      if (lPTA != null) {
        const lDeg = getDegreeName(lPTA)
        doc.text(`Left: ${lPTA} dB HL — ${lDeg} hearing loss`, MARGIN + 8, y)
        y += 14
      }
      y += 6
    }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(...MED_GRAY)
    doc.text('Audiogram data not yet recorded.', MARGIN, y)
    y += 20
  }

  // ── Speech Recognition Results ──
  const hasWRS = audiology?.unaidedR != null || audiology?.unaidedL != null
  const hasAided = audiology?.aidedR != null || audiology?.aidedL != null
  const hasSIN = audiology?.sinBin != null

  if (hasWRS || hasAided || hasSIN) {
    y = checkPage(doc, y, 80)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    doc.text('SPEECH RECOGNITION', MARGIN, y)
    y += 14

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...BLACK)

    if (hasWRS) {
      doc.text('Word Recognition (Unaided):', MARGIN + 8, y)
      const scores = []
      if (audiology.unaidedR != null) scores.push(`Right ${audiology.unaidedR}%`)
      if (audiology.unaidedL != null) scores.push(`Left ${audiology.unaidedL}%`)
      doc.text(scores.join('  ·  '), MARGIN + 160, y)
      y += 14
    }
    if (hasAided) {
      doc.text('Word Recognition (Aided):', MARGIN + 8, y)
      const scores = []
      if (audiology.aidedR != null) scores.push(`Right ${audiology.aidedR}%`)
      if (audiology.aidedL != null) scores.push(`Left ${audiology.aidedL}%`)
      doc.text(scores.join('  ·  '), MARGIN + 160, y)
      y += 14
    }
    if (hasSIN) {
      const snr = audiology.sinBin
      const label = snr <= 2 ? 'Near-normal' : snr <= 7 ? 'Mild' : snr <= 15 ? 'Moderate' : 'Severe'
      doc.text(`QuickSIN SNR Loss: ${snr} dB (${label} difficulty)`, MARGIN + 8, y)
      y += 14
    }
    y += 8
  }

  // ── Personalized Counseling ──
  if (counselingSections && counselingSections.length > 0) {
    y = checkPage(doc, y, 60)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...NAVY)
    doc.text('WHAT YOUR RESULTS MEAN', MARGIN, y)
    y += 16

    counselingSections.forEach(section => {
      y = checkPage(doc, y, 50)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...NAVY)
      doc.text(section.heading, MARGIN + 8, y)
      y += 12

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...BLACK)
      const lines = wrapText(doc, section.body, CONTENT_W - 16)
      lines.forEach(line => {
        y = checkPage(doc, y, 12)
        doc.text(line, MARGIN + 8, y)
        y += 11
      })
      y += 8
    })
  }


  // ═══════════════════════════════════════════════════════════
  // PAGE 4: Why Treatment Matters
  // ═══════════════════════════════════════════════════════════
  doc.addPage()
  y = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text('Why Treating Hearing Loss Matters', MARGIN, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text('Evidence-based outcomes for patients who treat their hearing loss — framed around quality of life, not fear.', MARGIN, y)
  y += 22

  WHY_IT_MATTERS.forEach(card => {
    y = checkPage(doc, y, 70)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...NAVY)
    doc.text(card.title, MARGIN + 8, y)
    y += 13

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...BLACK)
    const lines = wrapText(doc, card.body, CONTENT_W - 16)
    lines.forEach(line => {
      y = checkPage(doc, y, 12)
      doc.text(line, MARGIN + 8, y)
      y += 11
    })
    y += 10

    // Separator
    y = drawHR(doc, y, MARGIN + 8, PAGE_W - MARGIN - 8)
    y += 8
  })

  // Citations with URLs
  y = checkPage(doc, y, 70)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('Sources', MARGIN, y)
  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  const citations = [
    ['Lancet Commission on Dementia Prevention, Intervention, and Care (2020)', 'https://doi.org/10.1016/S0140-6736(20)30367-6'],
    ['Lin et al. — ACHIEVE Study, Lancet (2023)', 'https://doi.org/10.1016/S0140-6736(23)01048-8'],
    ['Deal et al. — Hearing Treatment & Cognitive Decline, JAMA (2023)', 'https://doi.org/10.1001/jamaoto.2023.3439'],
    ['Hearing Health Foundation — Hearing Loss & Brain Health', 'https://hearinghealthfoundation.org/hearing-loss-brain-health'],
  ]
  citations.forEach(([label, url]) => {
    doc.text(`${label}`, MARGIN + 8, y)
    y += 9
    doc.setTextColor(30, 64, 175) // blue link color
    doc.textWithLink(url, MARGIN + 8, y, { url })
    doc.setTextColor(...GRAY)
    y += 12
  })

  y += 16

  // Call to action
  y = checkPage(doc, y, 60)
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.5)
  doc.roundedRect(MARGIN, y - 6, CONTENT_W, 52, 4, 4, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text('Ready to move forward?', MARGIN + 14, y + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Call ${clinic.phone || 'your clinic'} or ask your provider about scheduling your fitting appointment.`, MARGIN + 14, y + 26)
  doc.text('This quote is valid for 30 days from the date shown on page 1.', MARGIN + 14, y + 38)


  // ═══════════════════════════════════════════════════════════
  // FOOTERS — go back and add to each page
  // ═══════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawFooter(doc, clinic, p, totalPages)
  }

  return doc
}


// ============================================================
// Convenience: generate and trigger download
// ============================================================
export function downloadQuote(params) {
  const doc = generateQuote(params)
  const patientName = (params.patient.name || 'patient').replace(/\s+/g, '_')
  const date = new Date().toISOString().split('T')[0]
  doc.save(`Hearing_Care_Quote_${patientName}_${date}.pdf`)
  return doc
}
