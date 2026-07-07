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

import { useState } from "react";

// Patient-facing financing calculator for the pricing reveal (backlog #34, the
// patient slice of #16 §8). Terms are the clinic's CareCredit / Allegro menu:
//   • 6 / 12 / 18 mo — DEFERRED INTEREST: 0% *only* if the full balance is paid
//     within the promo window; otherwise interest is charged retroactively from
//     the purchase date at 32.99% APR (the deferred-interest "gotcha").
//   • 24 / 36 / 48 mo — fixed installment APRs.
//   • 60 mo — fixed, only on purchases of $2,500+.
//
// Transparency rule (CLAUDE.md / transparent-patient-language): always show the
// real APR and the total cost of financing on interest-bearing plans — never
// just the smallest monthly — and spell out the deferred retroactive charge.

export const FINANCING_TERMS = [
  { months: 6,  kind: "deferred", apr: 0 },
  { months: 12, kind: "deferred", apr: 0 },
  { months: 18, kind: "deferred", apr: 0 },
  { months: 24, kind: "fixed", apr: 17.90 },
  { months: 36, kind: "fixed", apr: 18.90 },
  { months: 48, kind: "fixed", apr: 19.90 },
  { months: 60, kind: "fixed", apr: 20.90, minTotal: 2500 },
];
export const DEFERRED_RETRO_APR = 32.99;

const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Standard amortized monthly payment: M = P·r / (1 − (1+r)^−n), r = APR/12.
// Returns { monthly, total, interest }.
export function fixedSchedule(principal, apr, months) {
  const r = apr / 1200;
  const monthly = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
  const total = monthly * months;
  return { monthly, total, interest: total - principal };
}

export default function FinancingCalculator({ total }) {
  const [months, setMonths] = useState(18); // default: longest 0% deferred window
  if (!total || total <= 0) return null;

  const eligible = FINANCING_TERMS.filter((t) => !t.minTotal || total >= t.minTotal);
  const term = eligible.find((t) => t.months === months) || eligible[0];
  const isDeferred = term.kind === "deferred";
  const sched = isDeferred
    ? { monthly: total / term.months, total, interest: 0 }
    : fixedSchedule(total, term.apr, term.months);

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #EADFC7" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA39B", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
        Ways to make it comfortable
      </div>

      {/* Term selector */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {eligible.map((t) => {
          const on = t.months === term.months;
          return (
            <button
              key={t.months}
              onClick={() => setMonths(t.months)}
              style={{
                border: `1px solid ${on ? "#0B4A42" : "#E4E0D5"}`,
                background: on ? "#0B4A42" : "#fff",
                color: on ? "#fff" : "#54625C",
                borderRadius: 9, padding: "7px 11px", cursor: "pointer",
                fontFamily: "'Sora',sans-serif", fontSize: 12.5, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {t.months} mo
              <span style={{
                fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 8,
                background: on ? "rgba(255,255,255,0.18)" : (t.kind === "deferred" ? "#E2EFEA" : "#F0EDE3"),
                color: on ? "#fff" : (t.kind === "deferred" ? "#0C4A40" : "#6b7280"),
              }}>
                {t.kind === "deferred" ? "0%*" : `${t.apr}%`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected term detail */}
      <div style={{ background: "#fff", border: "1px solid #E4E0D5", borderRadius: 11, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 8 }}>
          <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 26, fontWeight: 600, color: "#16201D", whiteSpace: "nowrap" }}>
            ${money(sched.monthly)}<span style={{ fontSize: 14 }}>/mo</span>
          </span>
          <span style={{ fontSize: 12.5, color: "#54625C" }}>estimated, for {term.months} months</span>
        </div>

        {isDeferred ? (
          <div style={{ fontSize: 12.5, color: "#54625C", lineHeight: 1.55 }}>
            <span style={{ color: "#0C4A40", fontWeight: 700 }}>0% interest</span> if the full
            {" "}${money(total)} is paid within {term.months} months — not a penny more.
            <div style={{ marginTop: 6, background: "#FBF4E7", border: "1px solid #EADFC7", borderRadius: 8, padding: "8px 11px", color: "#6E4E16", fontSize: 12, lineHeight: 1.5 }}>
              If any balance remains after {term.months} months, interest is charged
              {" "}<strong>back to the purchase date at {DEFERRED_RETRO_APR}% APR</strong>. Best when
              the balance can be cleared inside the window.
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "#54625C", lineHeight: 1.55 }}>
            Fixed <strong>{term.apr}% APR</strong> over {term.months} months.
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, paddingTop: 7, borderTop: "1px solid #F0EDE3" }}>
              <span>Total of payments</span>
              <span style={{ fontWeight: 700, color: "#16201D" }}>${money(sched.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <span>Interest over {term.months} months</span>
              <span style={{ fontWeight: 600, color: "#6E4E16" }}>${money(sched.interest)}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: "#9AA39B", marginTop: 8, lineHeight: 1.5 }}>
        Through CareCredit / Allegro, subject to approval.
        {total < 2500 ? " A 60-month plan opens up on purchases of $2,500 or more." : ""}
        {" "}We'll walk the exact terms together — no surprises.
      </div>
    </div>
  );
}
