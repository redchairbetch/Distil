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
// QuoteView.jsx — the shared take-home quote page (/quote/<token>)
//
// Anonymous, mobile-first. Renders the PHI-minimal snapshot minted when a
// provider generates a quote: devices with patient cost first, the selected
// care plan (comparison collapsed behind one tap), spec drill-downs, the
// audiogram, and the education content from the PDF — reorganized for a
// phone screen. Deliberately NOT a configurator: nothing on this page
// changes the quote; interactivity is drill-down only.
//
// Copy rules (context.md, non-negotiable): patient cost first, retail only
// as "full retail value" WITH savings alongside; never "Neurotechnology";
// never "trial"/"demo" (use "adaptation period" / "evaluation").
// ============================================================

import { useState, useEffect } from 'react'
import { fetchSharedQuote } from '../db.js'
import { COLOR, FONT, SHADOW, RADIUS } from '../theme.js'
import {
  CARE_PLAN_META, PLAN_COMPARE, WHY_IT_MATTERS,
  FREQS, DEGREE_REGIONS, getPTA, getDegreeName,
} from '../generateQuote.js'

const money = (n) =>
  (n == null || isNaN(n))
    ? '—'
    : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const longDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Fitting styles → coarse silhouette/explainer bucket (mirrors the catalog's
// coarse buckets; fine-grained TH fitting styles collapse into them).
const STYLE_BUCKET = {
  ric: 'ric', sr: 'ric', ric_bct: 'ric',
  bte: 'bte', s_bte: 'bte', p_bte: 'bte', sp_bte: 'bte',
  ite: 'ite', itc: 'ite', hs: 'ite', fs: 'ite', if: 'ite',
  cic: 'cic', iic: 'cic',
}

const STYLE_EXPLAINERS = {
  ric: {
    title: 'Receiver-in-Canal (RIC)',
    body: 'The most commonly fit style today. A small, lightweight unit rests behind the ear while a nearly invisible wire carries sound directly into the ear canal. The open, comfortable fit keeps your own voice sounding natural, and the placement of the speaker in the canal delivers clear, detailed sound.',
  },
  bte: {
    title: 'Behind-the-Ear (BTE)',
    body: 'A durable, powerful style. The electronics sit in a slim case behind the ear, connected by tubing to a custom earpiece. BTEs offer the most amplification headroom of any style and are easy to handle, making them a dependable choice for significant hearing loss.',
  },
  ite: {
    title: 'In-the-Ear custom (ITE)',
    body: 'A custom shell molded from an impression of your own ear, so the entire device sits securely in the ear with nothing behind it. Easy to insert and remove, with controls right on the device — a great fit for glasses wearers and active lifestyles.',
  },
  cic: {
    title: 'Completely-in-Canal (CIC)',
    body: 'The most discreet custom style — molded to sit deep in the ear canal where it is barely visible. The ear itself funnels sound naturally to the microphone, which helps with wind noise and phone use.',
  },
}

const CROS_EXPLAINER = {
  title: 'Your CROS system',
  body: 'One of your units is a CROS transmitter rather than a hearing aid: it picks up sound on the side that can’t benefit from amplification and streams it instantly to the device on your better-hearing ear. Conversation and awareness from that side are no longer missed — no head-turning required.',
}

const RECHARGEABLE_EXPLAINER = {
  title: 'Rechargeable battery',
  body: 'Your devices use a sealed lithium-ion battery — set them in their charger overnight and they’re ready for a full day, every day. No tiny batteries to buy, change, or drop, and the sealed case adds protection from moisture and dust.',
}

const disposableExplainer = (batteryLabel) => ({
  title: 'Battery',
  body: `Your devices run on size ${batteryLabel} zinc-air batteries — inexpensive, sold everywhere, and easy to swap in seconds. A battery typically lasts several days to a week depending on wear time and streaming, and your clinic keeps them in stock.`,
})

// ── Small building blocks ────────────────────────────────────────────────────

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      border: `1px solid ${COLOR.line}`, borderRadius: RADIUS.md,
      background: COLOR.card, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: FONT.ui, fontSize: 14, fontWeight: 600, color: COLOR.ink, textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span aria-hidden style={{
          fontSize: 12, color: COLOR.ink3, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease',
        }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', fontSize: 13.5, lineHeight: 1.65, color: COLOR.ink2 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontFamily: FONT.display, fontSize: 22, fontWeight: 600,
      color: COLOR.ink, margin: '36px 0 14px',
    }}>{children}</h2>
  )
}

// Stylized line-art silhouettes per style bucket. Deliberately abstract —
// they read as "your device's shape", not a specific product photo. Swap in
// real product imagery later by keying on manufacturer + family.
function DeviceSilhouette({ bucket }) {
  const stroke = COLOR.pine
  const fill = COLOR.tealSoft
  const common = { width: 64, height: 64, viewBox: '0 0 64 64', fill: 'none', 'aria-hidden': true }
  if (bucket === 'bte') {
    return (
      <svg {...common}>
        <path d="M24 8c9 0 15 6 15 16 0 9-4 14-6 22-1 4-4 7-8 7s-8-3-8-8c0-12 -2-37 7-37z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M39 22c6 2 9 7 8 13" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="48" cy="41" rx="7" ry="9" fill={fill} stroke={stroke} strokeWidth="2.5" />
      </svg>
    )
  }
  if (bucket === 'ite') {
    return (
      <svg {...common}>
        <path d="M20 26c0-10 8-16 17-15 10 1 14 10 12 19-2 10-10 12-12 19-1 4-5 6-9 4-6-3-8-17-8-27z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="34" cy="22" r="2.4" fill={stroke} />
        <path d="M27 34c3 3 8 3 11 0" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (bucket === 'cic') {
    return (
      <svg {...common}>
        <path d="M26 30c0-8 6-13 13-12 7 1 11 7 9 14-2 8-8 9-10 15-1 3-4 5-7 3-4-2-5-12-5-20z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="37" cy="26" r="2" fill={stroke} />
        <path d="M18 20c-3 6-3 14 0 20" stroke={COLOR.ink3} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 4" />
      </svg>
    )
  }
  // ric (default)
  return (
    <svg {...common}>
      <path d="M28 6c7 0 11 5 11 12 0 6-3 10-5 15-1 4-4 6-7 6s-7-2-7-7c0-9-1-26 8-26z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M37 22c8 5 11 15 7 24" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <circle cx="42" cy="50" r="5.5" fill={fill} stroke={stroke} strokeWidth="2.5" />
    </svg>
  )
}

// ── Audiogram (SVG twin of the PDF chart) ────────────────────────────────────

function Audiogram({ rightT, leftT }) {
  const W = 520, H = 372
  const chartX = 44, chartW = 420, chartY = 16, chartH = 300
  const dbMin = -10, dbMax = 120, dbRange = dbMax - dbMin
  const yOf = (db) => chartY + ((db - dbMin) / dbRange) * chartH
  const xOf = (i) => chartX + (i / (FREQS.length - 1)) * chartW

  const seriesPoints = (t) => FREQS
    .map((f, i) => (t?.[f] != null ? { x: xOf(i), y: yOf(t[f]) } : null))
    .filter(Boolean)
  const rPts = seriesPoints(rightT)
  const lPts = seriesPoints(leftT)
  const poly = (pts) => pts.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Audiogram">
      {DEGREE_REGIONS.map(r => (
        <rect key={r.label} x={chartX} y={yOf(r.from)} width={chartW} height={yOf(r.to) - yOf(r.from)}
          fill={`rgba(${r.fill[0]},${r.fill[1]},${r.fill[2]},0.4)`} />
      ))}
      {DEGREE_REGIONS.map(r => (
        <text key={`lbl-${r.label}`} x={chartX + chartW + 4} y={(yOf(r.from) + yOf(r.to)) / 2 + 3}
          fontSize="9" fill={COLOR.ink3} fontFamily={FONT.ui}>{r.label}</text>
      ))}
      {Array.from({ length: 13 }, (_, i) => i * 10).map(db => (
        <line key={`g${db}`} x1={chartX} y1={yOf(db)} x2={chartX + chartW} y2={yOf(db)}
          stroke={COLOR.line} strokeWidth="0.75" />
      ))}
      {FREQS.map((f, i) => (
        <line key={`f${f}`} x1={xOf(i)} y1={chartY} x2={xOf(i)} y2={chartY + chartH}
          stroke={COLOR.line} strokeWidth="0.75" />
      ))}
      {FREQS.map((f, i) => (
        <text key={`ft${f}`} x={xOf(i)} y={chartY + chartH + 16} fontSize="10" fill={COLOR.ink2}
          textAnchor="middle" fontFamily={FONT.ui}>{f >= 1000 ? `${f / 1000}k` : f}</text>
      ))}
      {[0, 20, 40, 60, 80, 100, 120].map(db => (
        <text key={`dt${db}`} x={chartX - 8} y={yOf(db) + 3} fontSize="10" fill={COLOR.ink2}
          textAnchor="end" fontFamily={FONT.ui}>{db}</text>
      ))}
      <text x={chartX + chartW / 2} y={chartY + chartH + 34} fontSize="10" fill={COLOR.ink2}
        textAnchor="middle" fontFamily={FONT.ui}>Frequency (Hz)</text>
      <text x={12} y={chartY + chartH / 2} fontSize="10" fill={COLOR.ink2} textAnchor="middle"
        fontFamily={FONT.ui} transform={`rotate(-90 12 ${chartY + chartH / 2})`}>dB HL</text>

      {rPts.length > 1 && <polyline points={poly(rPts)} fill="none" stroke="#dc2626" strokeWidth="1.75" />}
      {rPts.map((p, i) => (
        <circle key={`r${i}`} cx={p.x} cy={p.y} r="4.5" fill="#dc2626" stroke="#fff" strokeWidth="1.25" />
      ))}
      {lPts.length > 1 && <polyline points={poly(lPts)} fill="none" stroke="#2563eb" strokeWidth="1.75" />}
      {lPts.map((p, i) => (
        <g key={`l${i}`} stroke="#2563eb" strokeWidth="2.25" strokeLinecap="round">
          <line x1={p.x - 4.5} y1={p.y - 4.5} x2={p.x + 4.5} y2={p.y + 4.5} />
          <line x1={p.x - 4.5} y1={p.y + 4.5} x2={p.x + 4.5} y2={p.y - 4.5} />
        </g>
      ))}
    </svg>
  )
}

// ── Device card ──────────────────────────────────────────────────────────────

function DeviceCard({ sideLabel, side, price, retail }) {
  if (!side) return null
  const isCros = side.isCROS
  const bucket = STYLE_BUCKET[side.style] || 'ric'
  // TruHearing carries the tech level once near pricing (it's the plan tier,
  // not part of the model name); others append it unless the family name
  // already contains it — same rules as the PDF device table.
  const appendTech = !isCros
    && side.manufacturer !== 'TruHearing'
    && !!side.techLevel
    && !(side.family || '').toLowerCase().includes(side.techLevel.toLowerCase())
  const modelName = isCros
    ? `${side.variant || 'CROS'} transmitter`
    : [side.family, appendTech ? side.techLevel : ''].filter(Boolean).join(' ')
  const savings = retail != null && price != null ? Math.max(0, retail - price) : 0
  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'center',
      background: COLOR.card, border: `1px solid ${COLOR.line}`,
      borderRadius: RADIUS.lg, padding: 16, boxShadow: SHADOW.sm,
    }}>
      <div style={{
        width: 72, height: 72, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: COLOR.paper, borderRadius: RADIUS.md,
      }}>
        <DeviceSilhouette bucket={bucket} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'inline-block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: COLOR.tealInk, background: COLOR.tealSoft,
          borderRadius: RADIUS.pill, padding: '3px 10px', marginBottom: 6,
        }}>{sideLabel} ear</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: COLOR.ink, lineHeight: 1.3 }}>
          {side.manufacturer}{modelName ? ` ${modelName}` : ''}
        </div>
        <div style={{ fontSize: 12.5, color: COLOR.ink2, marginTop: 3 }}>
          {(side.style || '').toUpperCase()}{side.battery ? ` · ${side.battery}` : ''}
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 600, color: COLOR.brassInk }}>
            {money(price)}
          </span>
          {savings > 0.005 && (
            <div style={{ fontSize: 12, color: COLOR.ink2, marginTop: 2 }}>
              Full retail value {money(retail)} — you save {money(savings)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Not-available screen (expired / revoked / unknown token) ─────────────────

function UnavailableScreen() {
  return (
    <div style={{
      minHeight: '100vh', background: COLOR.paper, fontFamily: FONT.ui,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        maxWidth: 420, background: COLOR.card, borderRadius: RADIUS.xl,
        boxShadow: SHADOW.md, padding: '36px 28px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 34, marginBottom: 12 }} aria-hidden>⏳</div>
        <div style={{ fontFamily: FONT.display, fontSize: 22, color: COLOR.ink, marginBottom: 10 }}>
          This quote link is no longer active
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.65, color: COLOR.ink2 }}>
          Quote links expire 30 days after your visit, or when a newer quote replaces
          this one. Your hearing care team can send you a current quote — just give
          your clinic a call.
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function QuoteView({ token }) {
  const [state, setState] = useState({ status: 'loading', data: null })

  useEffect(() => {
    document.title = 'Your Hearing Care Quote'
    let cancelled = false
    fetchSharedQuote(token)
      .then(data => { if (!cancelled) setState({ status: data ? 'ok' : 'gone', data }) })
      .catch(() => { if (!cancelled) setState({ status: 'error', data: null }) })
    return () => { cancelled = true }
  }, [token])

  if (state.status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', background: COLOR.paper, fontFamily: FONT.ui,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: COLOR.ink3, fontSize: 14,
      }}>Loading your quote…</div>
    )
  }
  if (state.status !== 'ok') return <UnavailableScreen />

  const { payload: q, clinic, expiresAt } = state.data
  const devices = q.devices || {}
  const pricing = q.pricing || {}
  const isPrivate = (q.payType || '').toLowerCase() === 'private'
  const cpMeta = CARE_PLAN_META[q.selectedCarePlan] || CARE_PLAN_META.complete
  const isBilateral = devices.fittingType === 'bilateral' || devices.fittingType === 'cros_bicros'

  const sides = []
  if (isBilateral || devices.fittingType === 'monaural_right') {
    sides.push({ label: 'Right', side: devices.right, price: pricing.rightPrice ?? pricing.pricePerAid, retail: pricing.rightRetail })
  }
  if (isBilateral || devices.fittingType === 'monaural_left') {
    sides.push({ label: 'Left', side: devices.left, price: pricing.leftPrice ?? pricing.pricePerAid, retail: pricing.leftRetail })
  }

  // TruHearing prints the tech level once, next to pricing — not per row.
  const thTechLevel = [devices.left, devices.right]
    .find(s => s?.manufacturer === 'TruHearing' && !s?.isCROS)?.techLevel

  // Drill-down content assembled from what was actually quoted.
  const buckets = [...new Set(sides.filter(s => s.side && !s.side.isCROS).map(s => STYLE_BUCKET[s.side.style] || 'ric'))]
  const anyCros = sides.some(s => s.side?.isCROS)
  const batteryLabel = sides.map(s => s.side?.battery).find(Boolean) || ''
  const isRechargeable = /li[-\s]?ion|recharge/i.test(batteryLabel)
  const batterySize = (batteryLabel.match(/\b(10|13|312|675)\b/) || [])[1]
  const drilldowns = [
    ...buckets.map(b => STYLE_EXPLAINERS[b]),
    ...(anyCros ? [CROS_EXPLAINER] : []),
    ...(isRechargeable ? [RECHARGEABLE_EXPLAINER] : (batterySize ? [disposableExplainer(batterySize)] : [])),
  ].filter(Boolean)

  const aud = q.audiology
  const hasAudiogram = !!(aud && ((aud.rightT && Object.keys(aud.rightT).length) || (aud.leftT && Object.keys(aud.leftT).length)))
  const rPTA = hasAudiogram ? getPTA(aud.rightT) : null
  const lPTA = hasAudiogram ? getPTA(aud.leftT) : null
  const hasSpeech = !!(aud && (aud.unaidedR != null || aud.unaidedL != null || aud.aidedR != null || aud.aidedL != null || aud.sinBin != null))
  const sinLabel = aud?.sinBin == null ? null
    : aud.sinBin <= 2 ? 'Near-normal' : aud.sinBin <= 7 ? 'Mild' : aud.sinBin <= 15 ? 'Moderate' : 'Severe'

  // Private pay bundles Complete Care+ into per-aid pricing (mirror the PDF).
  const compareRows = isPrivate
    ? PLAN_COMPARE.map(r => r.label === 'Cost' ? { ...r, complete: 'Included with devices' } : r)
    : PLAN_COMPARE
  const planCols = [
    { id: 'paygo', label: 'Standard Billing' },
    { id: 'punch', label: 'MHC Punch Card' },
    { id: 'complete', label: 'Complete Care+' },
  ]

  const phoneHref = clinic?.phone ? `tel:${String(clinic.phone).replace(/[^\d+]/g, '')}` : null

  return (
    <div style={{ minHeight: '100vh', background: COLOR.paper, fontFamily: FONT.ui, color: COLOR.ink }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 18px 64px' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: COLOR.tealInk,
          }}>{clinic?.name || 'My Hearing Centers'}</div>
          <h1 style={{
            fontFamily: FONT.display, fontSize: 30, fontWeight: 600, margin: '10px 0 6px', color: COLOR.ink,
          }}>Your Hearing Care Quote</h1>
          <div style={{ fontSize: 13.5, color: COLOR.ink2 }}>
            Prepared for <strong>{q.patient?.firstName || 'you'}</strong>
            {q.provider?.fullName ? <> by {q.provider.fullName}</> : null}
            {q.quoteDate ? <> · {longDate(q.quoteDate)}</> : null}
          </div>
          {expiresAt && (
            <div style={{
              display: 'inline-block', marginTop: 10, fontSize: 12, fontWeight: 600,
              color: COLOR.brassInk, background: COLOR.brassSoft,
              borderRadius: RADIUS.pill, padding: '4px 12px',
            }}>Valid through {longDate(expiresAt)}</div>
          )}
        </div>

        {/* ── Devices ── */}
        <SectionTitle>Your Recommended Devices</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sides.map(s => (
            <DeviceCard key={s.label} sideLabel={s.label} side={s.side} price={s.price} retail={s.retail} />
          ))}
        </div>
        {thTechLevel && (
          <div style={{ fontSize: 12, color: COLOR.ink2, marginTop: 10 }}>
            Technology level {thTechLevel} — included in the price shown for each device above.
          </div>
        )}
        {q.directPurchase ? (
          <div style={{ fontSize: 12, color: COLOR.ink2, marginTop: 10 }}>
            Direct purchase · pricing matched to your {q.tpa || q.carrier || 'insurance'} benefit · not billed to insurance
          </div>
        ) : (q.payType === 'insurance' && q.carrier) ? (
          <div style={{ fontSize: 12, color: COLOR.ink2, marginTop: 10 }}>
            Coverage: {q.carrier}{q.tpa ? ` (${q.tpa})` : ''} · prices shown reflect your plan's copay
          </div>
        ) : null}

        {/* ── Learn more ── */}
        {drilldowns.length > 0 && (
          <>
            <SectionTitle>Want the Details?</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {drilldowns.map(d => (
                <Accordion key={d.title} title={d.title}><p style={{ margin: 0 }}>{d.body}</p></Accordion>
              ))}
            </div>
          </>
        )}

        {/* ── Care plan ── */}
        <SectionTitle>{isPrivate ? 'Included Care Plan' : 'Your Care Plan'}</SectionTitle>
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '4px solid #16a34a',
          borderRadius: RADIUS.md, padding: '16px 18px',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#15803d' }}>
            {isPrivate ? 'Included with your devices' : 'You selected'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: COLOR.ink }}>{cpMeta.label}</div>
            <div style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 600, color: COLOR.ink, whiteSpace: 'nowrap' }}>
              {isPrivate ? 'No charge' : q.selectedCarePlan === 'paygo' ? '$65 per visit' : money(cpMeta.price)}
            </div>
          </div>
          <div style={{ fontSize: 13, color: COLOR.ink2, marginTop: 6, lineHeight: 1.6 }}>
            {isPrivate
              ? 'Bundled with your device purchase — no separate charge.'
              : q.selectedCarePlan === 'complete'
                ? 'Unlimited visits for the life of your aids · 4-year warranty & loss/damage coverage'
                : q.selectedCarePlan === 'punch'
                  ? 'Prepaid visit package · locked-in visit pricing · 3-year warranty'
                  : 'Pay per visit as needed · no upfront commitment · 3-year warranty'}
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <Accordion title="See how the three care plans compare">
            <div style={{ overflowX: 'auto', margin: '4px -4px 0' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 480 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 10px' }} />
                    {planCols.map(c => (
                      <th key={c.id} style={{
                        padding: '8px 10px', textAlign: 'left', fontWeight: 700,
                        color: c.id === q.selectedCarePlan ? COLOR.card : COLOR.ink,
                        background: c.id === q.selectedCarePlan ? COLOR.pine : COLOR.paper2,
                        borderRadius: c.id === q.selectedCarePlan ? '6px 6px 0 0' : 0,
                        whiteSpace: 'nowrap',
                      }}>{c.label}{c.id === q.selectedCarePlan ? ' ✓' : ''}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row, ri) => (
                    <tr key={row.label} style={{ background: ri % 2 ? 'transparent' : COLOR.paper }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: COLOR.ink, whiteSpace: 'nowrap' }}>{row.label}</td>
                      {planCols.map(c => (
                        <td key={c.id} style={{
                          padding: '8px 10px', color: COLOR.ink2,
                          background: c.id === q.selectedCarePlan ? COLOR.tealSoft : 'transparent',
                        }}>{row[c.id]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Accordion>
        </div>

        {/* ── Total ── */}
        <div style={{
          marginTop: 28, background: COLOR.pine, borderRadius: RADIUS.xl,
          boxShadow: SHADOW.md, padding: '22px 22px 20px', color: COLOR.card,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85 }}>
            Total Investment
          </div>
          <div style={{ fontFamily: FONT.display, fontSize: 40, fontWeight: 600, color: COLOR.brass2, margin: '6px 0 12px' }}>
            {money(pricing.total)}
          </div>
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, opacity: 0.92 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Devices ({isBilateral ? 'pair' : 'single'})</span><span>{money(pricing.deviceTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{cpMeta.label}</span>
              <span>{isPrivate ? 'Included' : q.selectedCarePlan === 'paygo' ? 'Per visit' : money(pricing.carePlanPrice)}</span>
            </div>
            {pricing.hasDiscount && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#86efac', fontWeight: 600 }}>
                <span>Your discount off full retail value</span><span>−{money(pricing.totalDiscount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Evaluation results ── */}
        {(hasAudiogram || hasSpeech) && (
          <>
            <SectionTitle>Your Hearing Evaluation</SectionTitle>
            {hasAudiogram && (
              <div style={{
                background: COLOR.card, border: `1px solid ${COLOR.line}`,
                borderRadius: RADIUS.lg, padding: 16, boxShadow: SHADOW.sm,
              }}>
                <Audiogram rightT={aud.rightT} leftT={aud.leftT} />
                <div style={{ display: 'flex', gap: 18, fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
                  <span style={{ color: '#dc2626' }}>● Right ear</span>
                  <span style={{ color: '#2563eb' }}>✕ Left ear</span>
                </div>
                {(rPTA != null || lPTA != null) && (
                  <div style={{ fontSize: 13, color: COLOR.ink2, marginTop: 10, lineHeight: 1.6 }}>
                    {rPTA != null && <div>Right: {rPTA} dB HL — {getDegreeName(rPTA)} hearing loss</div>}
                    {lPTA != null && <div>Left: {lPTA} dB HL — {getDegreeName(lPTA)} hearing loss</div>}
                  </div>
                )}
              </div>
            )}
            {hasSpeech && (
              <div style={{
                background: COLOR.card, border: `1px solid ${COLOR.line}`,
                borderRadius: RADIUS.lg, padding: '14px 16px', boxShadow: SHADOW.sm,
                marginTop: 12, fontSize: 13.5, color: COLOR.ink2, lineHeight: 1.7,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLOR.ink, marginBottom: 6 }}>
                  Speech Recognition
                </div>
                {(aud.unaidedR != null || aud.unaidedL != null) && (
                  <div>Word recognition (unaided): {[aud.unaidedR != null ? `Right ${aud.unaidedR}%` : null, aud.unaidedL != null ? `Left ${aud.unaidedL}%` : null].filter(Boolean).join(' · ')}</div>
                )}
                {(aud.aidedR != null || aud.aidedL != null) && (
                  <div>Word recognition (aided): {[aud.aidedR != null ? `Right ${aud.aidedR}%` : null, aud.aidedL != null ? `Left ${aud.aidedL}%` : null].filter(Boolean).join(' · ')}</div>
                )}
                {aud.sinBin != null && (
                  <div>QuickSIN SNR loss: {aud.sinBin} dB ({sinLabel} difficulty)</div>
                )}
              </div>
            )}
            {Array.isArray(q.counselingSections) && q.counselingSections.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {q.counselingSections.map(s => (
                  <Accordion key={s.heading} title={s.heading} defaultOpen={false}>
                    <p style={{ margin: 0 }}>{s.body}</p>
                  </Accordion>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Why it matters ── */}
        <SectionTitle>Why Treating Hearing Loss Matters</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WHY_IT_MATTERS.map(card => (
            <Accordion key={card.title} title={card.title}>
              <p style={{ margin: 0 }}>{card.body}</p>
            </Accordion>
          ))}
          <Accordion title="Sources">
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>Lancet Commission on Dementia Prevention, Intervention, and Care (2020) — <a href="https://doi.org/10.1016/S0140-6736(20)30367-6" target="_blank" rel="noopener noreferrer" style={{ color: COLOR.teal }}>doi.org/10.1016/S0140-6736(20)30367-6</a></li>
              <li>Lin et al. — ACHIEVE Study, Lancet (2023) — <a href="https://doi.org/10.1016/S0140-6736(23)01048-8" target="_blank" rel="noopener noreferrer" style={{ color: COLOR.teal }}>doi.org/10.1016/S0140-6736(23)01048-8</a></li>
              <li>Deal et al. — Hearing Treatment &amp; Cognitive Decline, JAMA (2023) — <a href="https://doi.org/10.1001/jamaoto.2023.3439" target="_blank" rel="noopener noreferrer" style={{ color: COLOR.teal }}>doi.org/10.1001/jamaoto.2023.3439</a></li>
              <li>Hearing Health Foundation — <a href="https://hearinghealthfoundation.org/hearing-loss-brain-health" target="_blank" rel="noopener noreferrer" style={{ color: COLOR.teal }}>Hearing Loss &amp; Brain Health</a></li>
            </ul>
          </Accordion>
        </div>

        {/* ── CTA ── */}
        <div style={{
          marginTop: 32, background: COLOR.card, border: `1px solid ${COLOR.line}`,
          borderRadius: RADIUS.xl, boxShadow: SHADOW.md, padding: '26px 22px', textAlign: 'center',
        }}>
          <div style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 600, color: COLOR.ink }}>
            Ready to move forward?
          </div>
          <div style={{ fontSize: 13.5, color: COLOR.ink2, margin: '8px 0 16px', lineHeight: 1.6 }}>
            Call the clinic to schedule your fitting appointment — we'll take care of the rest.
          </div>
          {phoneHref ? (
            <a href={phoneHref} style={{
              display: 'inline-block', background: COLOR.pine, color: COLOR.card,
              fontWeight: 700, fontSize: 15, textDecoration: 'none',
              borderRadius: RADIUS.md, padding: '13px 30px', boxShadow: SHADOW.sm,
            }}>Call {clinic.phone}</a>
          ) : (
            <div style={{ fontSize: 14, fontWeight: 700, color: COLOR.ink }}>Contact your clinic</div>
          )}
          {clinic?.address && (
            <div style={{ fontSize: 12, color: COLOR.ink3, marginTop: 14 }}>
              {clinic.name} · {clinic.address}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: COLOR.ink3, marginTop: 26, lineHeight: 1.7 }}>
          Prices shown are your cost as quoted on {longDate(q.quoteDate)} and are valid
          through {longDate(expiresAt)}.<br />Generated by Distil CRM.
        </div>
      </div>
    </div>
  )
}
