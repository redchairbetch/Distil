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

// Single source of truth for practice branding (white-label). Documents and
// screens print the clinic's own name from the database and fall back to
// BRAND_NAME; legal copy (purchase-agreement terms, HIPAA consent, kiosk
// insurance authorization) names BRAND_NAME as the contracting practice.
// Swapping the brand for another practice = edit this file + the logo assets.

import logoFull from '../assets/logos/Distil.png'
import logoFullWhite from '../assets/logos/Distil-white.png'
import logoMark from '../assets/logos/Distil-mark.png'
import logoMarkWhite from '../assets/logos/Distil-mark-white.png'

export const BRAND_NAME = 'Distil Hearing'
export const BRAND_TEAL = '#35907E'

export const BRAND_LOGO = logoFull            // mark + "Distil" wordmark, teal
export const BRAND_LOGO_WHITE = logoFullWhite // same, for dark backgrounds
export const BRAND_MARK = logoMark            // "D" mark only, teal
export const BRAND_MARK_WHITE = logoMarkWhite

// Clinic display name with brand fallback.
export const clinicName = (clinic) => (clinic?.name || '').trim() || BRAND_NAME

// Strip the practice prefix from a location name for compact UI
// ("Distil Hearing – Phoenix" → "Phoenix"). Also strips the legacy
// "My Hearing Centers – " prefix so pre-rebrand snapshots still render short.
const PREFIX_RE = /^(?:Distil Hearing|My Hearing Centers)\s*[–-]\s*/
export const shortClinicName = (name) => (name || '').replace(PREFIX_RE, '')

// ── PDF logo embedding ───────────────────────────────────────
// jsPDF's addImage needs a data URL. Fetch + encode the mark once at module
// load so the (synchronous) PDF generators can embed it; until it resolves —
// or if it fails, or outside a browser — they fall back to text only.
let markDataUrl = null
let markDataUrlPromise = null

async function urlToDataUrl(url) {
  const blob = await fetch(url).then(r => r.ok ? r.blob() : Promise.reject(new Error('logo fetch failed')))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function loadBrandMarkDataUrl() {
  if (markDataUrl) return Promise.resolve(markDataUrl)
  if (!markDataUrlPromise) {
    markDataUrlPromise = urlToDataUrl(BRAND_MARK)
      .then(d => (markDataUrl = d))
      .catch(e => { console.warn('Brand logo load failed; PDFs fall back to text:', e); markDataUrlPromise = null; return null })
  }
  return markDataUrlPromise
}

if (typeof window !== 'undefined' && typeof FileReader !== 'undefined') loadBrandMarkDataUrl()

// Full logo (mark + wordmark) as a data URL, for the intake PDF header.
export const loadBrandLogoDataUrl = () => urlToDataUrl(BRAND_LOGO).catch(() => null)

// Draw the brand mark with its top-left at (x, y), `h` points tall.
// Returns the horizontal space consumed (mark width + gap), or 0 when the
// logo isn't available so callers can offset their text by the result.
export function drawPdfBrandMark(doc, x, y, h, gap = 8) {
  if (!markDataUrl) return 0
  try {
    const props = doc.getImageProperties(markDataUrl)
    const w = h * (props.width / props.height)
    doc.addImage(markDataUrl, 'PNG', x, y, w, h)
    return w + gap
  } catch {
    return 0
  }
}

// Largest font size (≤ size, ≥ min) at which `text` fits in maxW points —
// keeps long location names from colliding with right-aligned PDF titles.
export function fitPdfFontSize(doc, text, maxW, size, min = 9) {
  let s = size
  while (s > min && doc.getStringUnitWidth(text) * s > maxW) s -= 0.5
  return s
}
