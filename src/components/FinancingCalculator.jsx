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
import { PRICING_T } from "../i18n/pricing.js";
import {
  FINANCING_TERMS,
  DEFERRED_RETRO_APR,
  fixedSchedule,
  eligibleTerms,
  scheduleForTerm,
} from "../lib/financing.js";

// Patient-facing financing calculator for the pricing reveal (backlog #34, the
// patient slice of #16 §8). Terms + payment math live in lib/financing.js,
// shared with the provider-facing payment-options panel on the Device
// Selection screen — edit the menu there, not here.
//
// Transparency rule (CLAUDE.md / transparent-patient-language): always show the
// real APR and the total cost of financing on interest-bearing plans — never
// just the smallest monthly — and spell out the deferred retroactive charge.

export { FINANCING_TERMS, DEFERRED_RETRO_APR, fixedSchedule };

const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FinancingCalculator({ total, lang = "en" }) {
  const [months, setMonths] = useState(18); // default: longest 0% deferred window
  if (!total || total <= 0) return null;
  const pt = PRICING_T[lang] || PRICING_T.en;

  const eligible = eligibleTerms(total);
  const term = eligible.find((t) => t.months === months) || eligible[0];
  const isDeferred = term.kind === "deferred";
  const sched = scheduleForTerm(total, term);

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #EADFC7" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA39B", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
        {pt.waysComfortable}
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
              {t.months} {pt.mo}
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
          <span style={{ fontSize: 12.5, color: "#54625C" }}>{pt.estimatedFor(term.months)}</span>
        </div>

        {isDeferred ? (
          <div style={{ fontSize: 12.5, color: "#54625C", lineHeight: 1.55 }}>
            <span style={{ color: "#0C4A40", fontWeight: 700 }}>{pt.zeroInterest}</span>
            {pt.zeroInterestRest(money(total), term.months)}
            <div style={{ marginTop: 6, background: "#FBF4E7", border: "1px solid #EADFC7", borderRadius: 8, padding: "8px 11px", color: "#6E4E16", fontSize: 12, lineHeight: 1.5 }}>
              {(() => { const [pre, bold, post] = pt.deferredWarning(term.months, DEFERRED_RETRO_APR);
                return <>{pre}<strong>{bold}</strong>{post}</>; })()}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "#54625C", lineHeight: 1.55 }}>
            {pt.fixedAprPre}<strong>{pt.aprLabel(term.apr)}</strong>{pt.fixedAprPost(term.months)}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, paddingTop: 7, borderTop: "1px solid #F0EDE3" }}>
              <span>{pt.totalOfPayments}</span>
              <span style={{ fontWeight: 700, color: "#16201D" }}>${money(sched.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <span>{pt.interestOver(term.months)}</span>
              <span style={{ fontWeight: 600, color: "#6E4E16" }}>${money(sched.interest)}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: "#9AA39B", marginTop: 8, lineHeight: 1.5 }}>
        {pt.financingFooter(total < 2500)}
      </div>
    </div>
  );
}
