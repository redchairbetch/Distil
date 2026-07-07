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

import React, { useMemo, useState } from "react";
import { markFollowUpContacted, clearFollowUp } from "../db.js";

// Cooldown after a "Mark contacted" action: patient stays out of the queue
// for this many days even if they still match a bucket. Tuned long enough
// that a one-off touch silences the nag, short enough that real follow-up
// gaps re-surface within the same care cycle.
const CONTACTED_COOLDOWN_DAYS = 14;

// Priority order is also display order. Higher-urgency buckets sort first.
// Exported (with classify) so Reports counts the queue with the SAME rules
// this view renders — one source of truth for what "needs follow-up" means.
export const BUCKETS = [
  {
    key: "warranty_expiring",
    label: "Warranty expiring (< 90 days)",
    color: "#dc2626",
    bg: "#fee2e2",
    icon: "⏱",
    blurb: "Devices coming off warranty soon. Get them in for a check before coverage lapses.",
  },
  {
    key: "off_warranty_no_upgrade",
    label: "Off warranty · no upgrade conversation",
    color: "#b45309",
    bg: "#fef3c7",
    icon: "💬",
    blurb: "Warranty has lapsed and no upgrade outcome is on record. Time for the year-4+ conversation.",
  },
  {
    key: "fit_no_return",
    label: "Fit but never returned",
    color: "#7c3aed",
    bg: "#ede9fe",
    icon: "↩",
    blurb: "Fit more than 30 days ago and never logged a follow-up visit. Check in.",
  },
  {
    key: "stale_visit",
    label: "No visit in 12+ months",
    color: "#1d4ed8",
    bg: "#dbeafe",
    icon: "📭",
    blurb: "Active patients we haven't seen in over a year.",
  },
];

const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / DAY);
}
function daysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((Date.now() - t) / DAY);
}
function fmtShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Returns the set of bucket keys this patient matches, plus the primary
// bucket (first match in BUCKETS order). Patients with a recent contacted
// stamp are silenced and return [].
export function classify(p) {
  if (p.followUpStatus === "contacted" && p.followUpContactedAt) {
    const since = daysSince(p.followUpContactedAt);
    if (since != null && since < CONTACTED_COOLDOWN_DAYS) return { matched: [], primary: null };
  }

  const matched = [];
  const warrantyExpiry = p.devices?.warrantyExpiry || null;
  const fittingDate    = p.devices?.fittingDate    || null;

  // Warranty expiring within 90 days (and not already expired)
  if (warrantyExpiry) {
    const dn = daysFromNow(warrantyExpiry);
    if (dn != null && dn >= 0 && dn <= 90) matched.push("warranty_expiring");
  }

  // Warranty already lapsed AND no upgrade conversation logged
  if (warrantyExpiry) {
    const dn = daysFromNow(warrantyExpiry);
    if (dn != null && dn < 0 && !p.upgradeOutcome) matched.push("off_warranty_no_upgrade");
  }

  // Fit (has fitting date >30d ago) but no logged visit
  if (fittingDate && !p.lastVisitDate) {
    const ds = daysSince(fittingDate);
    if (ds != null && ds > 30) matched.push("fit_no_return");
  }

  // Active patient, last visit > 12mo ago. Skip if already flagged elsewhere.
  if (p.patientStatus === "active" && p.lastVisitDate) {
    const ds = daysSince(p.lastVisitDate);
    if (ds != null && ds > 365 && matched.length === 0) matched.push("stale_visit");
  }

  const order = BUCKETS.map(b => b.key);
  matched.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return { matched, primary: matched[0] || null };
}

// Within a bucket, sort by the most urgent timestamp for that bucket.
function sortKeyFor(bucketKey, p) {
  switch (bucketKey) {
    case "warranty_expiring":       return new Date(p.devices?.warrantyExpiry || 0).getTime();
    case "off_warranty_no_upgrade": return new Date(p.devices?.warrantyExpiry || 0).getTime();
    case "fit_no_return":           return new Date(p.devices?.fittingDate || 0).getTime();
    case "stale_visit":             return new Date(p.lastVisitDate || 0).getTime();
    default:                        return 0;
  }
}

// Cheap count for the sidebar badge — just runs classify() and tallies
// patients with at least one matching bucket (post-cooldown).
export function countFollowUpPatients(patients) {
  let n = 0;
  for (const p of patients || []) {
    const { primary } = classify(p);
    if (primary) n++;
  }
  return n;
}

export default function FollowUpQueue({ patients, onSelectPatient, onRefresh }) {
  const [busyId, setBusyId] = useState(null);
  const [filter,  setFilter]  = useState("all"); // "all" or a bucket key

  const grouped = useMemo(() => {
    const out = Object.fromEntries(BUCKETS.map(b => [b.key, []]));
    for (const p of patients || []) {
      const { matched, primary } = classify(p);
      if (!primary) continue;
      out[primary].push({ ...p, _matched: matched });
    }
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => sortKeyFor(k, a) - sortKeyFor(k, b));
    }
    return out;
  }, [patients]);

  const totalCount = BUCKETS.reduce((sum, b) => sum + grouped[b.key].length, 0);

  const handleContacted = async (patientId) => {
    setBusyId(patientId);
    try {
      await markFollowUpContacted(patientId);
      if (onRefresh) await onRefresh();
    } finally { setBusyId(null); }
  };

  const handleClear = async (patientId) => {
    setBusyId(patientId);
    try {
      await clearFollowUp(patientId);
      if (onRefresh) await onRefresh();
    } finally { setBusyId(null); }
  };

  const visibleBuckets = filter === "all"
    ? BUCKETS
    : BUCKETS.filter(b => b.key === filter);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0a1628", margin: 0, fontFamily: "'Sora',sans-serif" }}>
          Follow-up Queue
        </h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {totalCount} {totalCount === 1 ? "patient" : "patients"} need outreach
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Patients are silenced for {CONTACTED_COOLDOWN_DAYS} days after you mark them contacted.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <button onClick={() => setFilter("all")}
          style={{
            padding: "6px 14px",
            border: filter === "all" ? "2px solid #0a1628" : "1px solid #e5e7eb",
            borderRadius: 20, background: filter === "all" ? "#0a1628" : "white",
            color: filter === "all" ? "white" : "#0a1628",
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Sora',sans-serif",
          }}>
          All ({totalCount})
        </button>
        {BUCKETS.map(b => {
          const count = grouped[b.key].length;
          const active = filter === b.key;
          return (
            <button key={b.key} onClick={() => setFilter(b.key)}
              style={{
                padding: "6px 14px",
                border: active ? `2px solid ${b.color}` : "1px solid #e5e7eb",
                borderRadius: 20, background: active ? b.bg : "white",
                color: active ? b.color : "#374151",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Sora',sans-serif",
              }}>
              {b.icon} {b.label.replace(/ \(.+\)/, "")} ({count})
            </button>
          );
        })}
      </div>

      {totalCount === 0 && (
        <div style={{
          padding: 32, textAlign: "center", color: "#6b7280", fontSize: 14,
          background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12,
        }}>
          ✓ Queue is clear. No patients matching follow-up criteria right now.
        </div>
      )}

      {visibleBuckets.map(bucket => {
        const rows = grouped[bucket.key];
        if (!rows.length) return null;
        return (
          <div key={bucket.key} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
                background: bucket.bg, color: bucket.color, letterSpacing: 0.4, textTransform: "uppercase",
              }}>{bucket.icon} {bucket.label}</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{rows.length}</span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>{bucket.blurb}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map(p => {
                const detail = bucketDetail(bucket.key, p);
                const others = (p._matched || []).filter(k => k !== bucket.key);
                return (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                    background: "white", border: "1px solid #e5e7eb", borderRadius: 10,
                  }}>
                    <div style={{
                      flex: 1, minWidth: 0, cursor: onSelectPatient ? "pointer" : "default",
                    }} onClick={() => onSelectPatient && onSelectPatient(p)}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0a1628" }}>{p.name || "—"}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        {detail}
                        {p.phone ? ` · ${p.phone}` : ""}
                      </div>
                      {others.length > 0 && (
                        <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {others.map(k => {
                            const b = BUCKETS.find(x => x.key === k);
                            return (
                              <span key={k} style={{
                                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                                background: b.bg, color: b.color,
                              }}>also: {b.label.replace(/ \(.+\)/, "")}</span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {p.followUpStatus === "contacted" ? (
                        <button disabled={busyId === p.id} onClick={() => handleClear(p.id)}
                          style={chipBtn("#6b7280")}>
                          Reset
                        </button>
                      ) : (
                        <button disabled={busyId === p.id} onClick={() => handleContacted(p.id)}
                          style={chipBtn("#0a1628")}>
                          Mark contacted
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function chipBtn(color) {
  return {
    fontSize: 12, fontWeight: 600, padding: "6px 12px",
    background: "white", color, border: `1px solid ${color}`,
    borderRadius: 6, cursor: "pointer", fontFamily: "'Sora',sans-serif",
  };
}

function bucketDetail(key, p) {
  switch (key) {
    case "warranty_expiring": {
      const dn = daysFromNow(p.devices?.warrantyExpiry);
      return `Warranty expires ${fmtShort(p.devices?.warrantyExpiry)} (${dn} ${dn === 1 ? "day" : "days"})`;
    }
    case "off_warranty_no_upgrade": {
      const ds = daysSince(p.devices?.warrantyExpiry);
      return `Warranty lapsed ${ds} ${ds === 1 ? "day" : "days"} ago · no upgrade outcome logged`;
    }
    case "fit_no_return": {
      const ds = daysSince(p.devices?.fittingDate);
      return `Fit ${fmtShort(p.devices?.fittingDate)} (${ds} ${ds === 1 ? "day" : "days"} ago) · 0 visits logged`;
    }
    case "stale_visit": {
      const ds = daysSince(p.lastVisitDate);
      return `Last visit ${fmtShort(p.lastVisitDate)} (${ds} ${ds === 1 ? "day" : "days"} ago)`;
    }
    default:
      return "";
  }
}
