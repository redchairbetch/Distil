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

// Rate Verifications admin queue (backlog #40e — extracted from Distil.jsx
// renderRateVerifications). Pure render extraction: the pending list and the
// promote/dismiss handlers live in ProviderCRM and arrive as props.

import React from "react";
import { fmtDate } from "../lib/dates.js";

export default function RateVerificationsAdmin({
  rateVerifications, rvError, rvBusyId,
  doPromoteVerification, doDismissVerification,
}) {
  const fmtMoney = (cents) => `$${(cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  return (
      <>
        <div className="topbar">
          <div>
            <div className="topbar-title">Rate Verifications</div>
            <div className="topbar-sub">{rateVerifications.length} pending · provider-verified managed-care copays awaiting promotion into the plan catalog</div>
          </div>
        </div>
        <div className="content">
          <div className="catalog-wrap">
            {rvError && <div className="save-error">⚠ {rvError}</div>}
            {rateVerifications.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <div className="empty-title">No pending rate verifications</div>
                <div className="empty-sub">When a provider verifies a managed-care copay for an un-mapped tier, it appears here to promote into the plan catalog.</div>
              </div>
            )}
            {rateVerifications.map(v => (
              <div className="catalog-entry" key={v.id}>
                <div className="catalog-entry-header">
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div className="catalog-entry-name">{v.carrier} · {v.tier_label}</div>
                      {v.tpa && <span className="catalog-entry-badge">{v.tpa}</span>}
                    </div>
                    <div className="catalog-entry-gen">
                      {v.plan_group} · verified copay <strong>{fmtMoney(v.verified_copay_per_aid)}</strong> / aid · {fmtDate(v.created_at)}
                    </div>
                  </div>
                  <div className="catalog-entry-actions">
                    <button className="cat-btn primary" disabled={rvBusyId===v.id} onClick={()=>doPromoteVerification(v)}>
                      {rvBusyId===v.id ? "…" : "Promote to plan"}
                    </button>
                    <button className="cat-btn" disabled={rvBusyId===v.id} onClick={()=>doDismissVerification(v)}>Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
  );
}
