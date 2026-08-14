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
import { dueCareVisit, apptDay, apptDaysUntil } from "../lib/appointments.js";
import { fmtDate } from "../lib/dates.js";

// Dashboard "Care Visits Due This Week" card — the day-to-day driver for the
// care arc. Lists patients whose next scheduled visit is due within 7 days or
// recently overdue (same rule as the follow-up queue's care-visit bucket, via
// dueCareVisit). Deliberately a work list, not a calendar.

const MAX_ROWS = 8;

export default function DueThisWeek({ patients, onSelectPatient, onOpenQueue }) {
  const rows = (patients || [])
    .map(p => ({ p, a: dueCareVisit(p.appointments) }))
    .filter(x => x.a)
    .sort((x, y) => apptDaysUntil(x.a.date) - apptDaysUntil(y.a.date));

  if (!rows.length) return null;
  const shown = rows.slice(0, MAX_ROWS);

  const chip = (a) => {
    const dn = apptDaysUntil(a.date);
    const [bg, color, text] =
      dn < 0 ? ["#fef3c7", "#92400e", `${-dn}d overdue`]
      : dn === 0 ? ["#dbeafe", "#1d4ed8", "Today"]
      : ["#ccfbf1", "#0f766e", `In ${dn}d`];
    return <span style={{ background: bg, color, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{text}</span>;
  };

  return (
    <div className="table-card" style={{ marginBottom: 16, borderLeft: "4px solid #0f766e" }}>
      <div className="table-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="table-title" style={{ color: "#0f766e" }}>📅 Care Visits Due This Week</div>
          <span style={{ background: "#ccfbf1", color: "#0f766e", borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
            {rows.length}
          </span>
        </div>
        {onOpenQueue && (
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={onOpenQueue}>
            Follow-up Queue →
          </button>
        )}
      </div>
      <div style={{ padding: "4px 0 8px" }}>
        {shown.map(({ p, a }) => (
          <div key={p.id}
            onClick={() => onSelectPatient && onSelectPatient(p)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px", cursor: onSelectPatient ? "pointer" : "default", borderTop: "1px solid #F0EDE3" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0a1628" }}>{p.name}</span>
              <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
                {a.type || "Care visit"} · {fmtDate(apptDay(a.date))}
              </span>
            </div>
            {p.phone && <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>{p.phone}</span>}
            {chip(a)}
          </div>
        ))}
        {rows.length > MAX_ROWS && (
          <div style={{ padding: "8px 18px", fontSize: 12, color: "#6b7280" }}>
            +{rows.length - MAX_ROWS} more in the Follow-up Queue
          </div>
        )}
      </div>
    </div>
  );
}
