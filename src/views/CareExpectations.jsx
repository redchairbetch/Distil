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

const PHASES = [
  {
    when: "First six weeks",
    count: `${adaptationVisits} visits`,
    title: "Adaptation",
    body: "Your brain has to relearn sounds it stopped hearing years ago, so we start you below your full prescription and step the volume up over the first month. We fit you, call you two days in, and fine-tune in the office at two, four, and six weeks. At the four-week visit we measure the sound down in your ear canal to confirm you're getting exactly what your hearing loss calls for — not what the box was set to.",
  },
  {
    when: "Every three months",
    count: `${quarterlyVisits} visits`,
    title: "Cleaning & servicing",
    body: "Hearing aids live in the hardest environment any electronics face: body heat, moisture, and earwax, twelve to sixteen hours a day. Every quarter we deep-clean them, replace the parts that wear out — wax guards, domes, tubing, microphone covers — and check that each aid still puts out what it's supposed to. Most failures give warning before they happen. This visit is where we catch them.",
  },
  {
    when: "Every year",
    count: `${annualExams} exams`,
    title: "Re-testing & recalibration",
    body: "Hearing changes. We re-test yours once a year and reprogram the aids to your current results. Skip it and the aids stay calibrated to ears you no longer have — the fit between the prescription and the loss quietly comes apart, and it usually gets blamed on the hearing aids.",
  },
  {
    when: "Year four and on",
    count: "Renewal",
    title: "Review & what's next",
    body: "Around year four your warranty ends and the technology has moved on. We sit down, look at how you're actually hearing rather than how old the aids are, and decide together whether to keep servicing what you have or move to newer equipment. Whichever you choose, the next stretch of care starts from that visit.",
  },
];

export default function CareExpectations({ bridgeToPlans = true }) {
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
        What treatment looks like from here
      </h3>
      <p style={{
        color: "#374151", fontSize: 13.5, lineHeight: 1.6, margin: "10px 0 0", maxWidth: 860,
      }}>
        For nearly every hearing loss we see, hearing aids are the most effective treatment
        there is. They don't repair the ear — they carry sound to it, shaped to your specific
        loss, every hour you wear them. That makes them medical instruments rather than
        accessories: sensitive electronics, calibrated to your test results, worn all day
        inside a warm and humid ear. Keeping them accurate is our work, and it doesn't
        finish. That's why you leave here with a schedule, not just a pair of hearing aids.
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
          And then it keeps going
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: "rgba(255,255,255,0.92)" }}>
          {totalVisits} visits go on your calendar the day you're fitted — and those are the
          start of the plan, not the whole of it. Hearing loss is permanent and it keeps
          changing; hearing aids are machines, and machines get serviced and eventually
          replaced. So for as long as you wear them, you have a hearing care provider — the
          same way you have a dentist or an eye doctor, and for the same reason. That's what
          today is really about: not buying a device, but starting a treatment relationship
          that stays with you.
        </p>
      </div>

      {/* ── Bridge into the plan cards ─────────────────────── */}
      {bridgeToPlans && (
        <p style={{
          fontSize: 12.5, color: SUBDUED, lineHeight: 1.55, margin: "14px 0 0",
        }}>
          The plans below differ in how that care is paid for — not in whether you need it.
        </p>
      )}
    </div>
  );
}
