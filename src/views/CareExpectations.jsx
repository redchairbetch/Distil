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

import React from "react";
import { CARE_ARC } from "../lib/careArc.js";
import { PRICING_T } from "../i18n/pricing.js";

/**
 * "What treatment looks like from here" — the patient-facing explanation of
 * the ongoing care relationship, shown on the Care Plan step (Narrative
 * Thread Chapter 3) between the Hearing Journey infographic and the plan
 * cards.
 *
 * The point of this block is the point of the whole chapter: hearing aids are
 * a treatment, not a purchase. Precision electronics worn all day inside a
 * warm, wet ear, tuned to a loss that keeps changing — so care is continuous,
 * and it doesn't stop at year five. Visit counts are derived from CARE_ARC
 * (the schedule actually written to the calendar at fitting) so the copy can
 * never drift from what the patient is really booked for.
 */

// Visit counts, straight off the care arc that gets scheduled at fitting.
const adaptationVisits = CARE_ARC.filter(v => v.unit !== "months").length;
const quarterlyVisits  = CARE_ARC.filter(v => v.type.startsWith("Quarterly")).length;
const annualExams      = CARE_ARC.filter(v => v.type.startsWith("Annual Exam")).length;
const totalVisits      = CARE_ARC.length;

const NAVY = "#0a1628";
const SUBDUED = "#6b7280";
const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'DM Sans', sans-serif";

export default function CareExpectations({ bridgeToPlans = true, lang = "en" }) {
  const pt = PRICING_T[lang] || PRICING_T.en;
  // Phase copy comes from the i18n dictionary; visit counts stay derived
  // from CARE_ARC so the numbers can never drift from the real schedule.
  const phaseCounts = [pt.nVisits(adaptationVisits), pt.nVisits(quarterlyVisits), pt.nExams(annualExams), pt.renewal];
  const PHASES = pt.phases.map((ph, i) => ({ ...ph, count: phaseCounts[i] }));
  return (
    <div style={{
      background: "#ffffff",
      border: "2px solid #e5e7eb",
      borderRadius: 16,
      padding: "22px 20px 20px",
      marginBottom: 20,
      fontFamily: SANS,
    }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <h3 style={{
        fontFamily: SERIF,
        fontSize: 20,
        fontWeight: 700,
        color: "#111827",
        margin: 0,
        letterSpacing: "-0.02em",
      }}>
        {pt.careTitle}
      </h3>
      <p style={{
        color: "#374151", fontSize: 13.5, lineHeight: 1.6, margin: "10px 0 0", maxWidth: 860,
      }}>
        {pt.careIntro}
      </p>

      {/* ── Four phases of care ────────────────────────────── */}
      <div style={{
        display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch", marginTop: 20,
      }}>
        {PHASES.map((ph, i) => (
          <div key={ph.title} style={{
            flex: "1 1 220px",
            minWidth: 0,
            background: "#FBF9F3",
            border: "1px solid #E4E0D5",
            borderRadius: 12,
            padding: "16px 16px 18px",
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", background: NAVY, color: "#fff",
                fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase", color: SUBDUED,
              }}>
                {ph.when}
              </span>
            </div>

            <div style={{
              fontFamily: SERIF, fontSize: 16, fontWeight: 700, color: "#111827",
              letterSpacing: "-0.01em", lineHeight: 1.25,
            }}>
              {ph.title}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: "#1B8A7A", marginTop: 4,
            }}>
              {ph.count}
            </div>

            <p style={{
              fontSize: 12.5, lineHeight: 1.55, color: "#4b5563", margin: "10px 0 0",
            }}>
              {ph.body}
            </p>
          </div>
        ))}
      </div>

      {/* ── The perpetuity message ─────────────────────────── */}
      <div style={{
        marginTop: 18,
        background: `linear-gradient(135deg, ${NAVY}, #1a3050)`,
        borderRadius: 12,
        padding: "18px 20px",
        color: "#fff",
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 8,
        }}>
          {pt.keepsGoing}
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: "rgba(255,255,255,0.92)" }}>
          {pt.perpetuity(totalVisits)}
        </p>
      </div>

      {/* ── Bridge into the plan cards ─────────────────────── */}
      {bridgeToPlans && (
        <p style={{
          fontSize: 12.5, color: SUBDUED, lineHeight: 1.55, margin: "14px 0 0",
        }}>
          {pt.bridgeToPlans}
        </p>
      )}
    </div>
  );
}
