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
import { markFollowUpContacted, clearFollowUp, FOLLOW_UP_OUTCOMES } from "../db.js";
import { parseDateOnly, daysUntil as libDaysUntil } from "../lib/dates.js";
import { dueCareVisit, apptDay, apptDaysUntil } from "../lib/appointments.js";

// Cooldown after a contact attempt: patient stays out of the queue for this
// many days even if they still match a bucket. Now varies by what the
// attempt produced — a voicemail deserves a retry within days, while a
// decline shouldn't nag for months. Default covers legacy rows contacted
// before outcomes existed.
const CONTACTED_COOLDOWN_DAYS = 14;
const OUTCOME_COOLDOWN_DAYS = {
  reached:   14,
  voicemail: 3,
  no_answer: 3,
  scheduled: 30, // the booked visit resurfaces via the care-visit bucket
  declined:  90,
};

// Priority order is also display order. Higher-urgency buckets sort first.
// Exported (with classify) so Reports counts the queue with the SAME rules
// this view renders — one source of truth for what "needs follow-up" means.
export const BUCKETS = [
  {
    key: "care_visit_due",
    label: "Care visit due (this week)",
    color: "#0f766e",
    bg: "#ccfbf1",
    icon: "📅",
    blurb: "A scheduled care visit is due within 7 days or recently overdue. Confirm they're coming in — then mark the visit completed on their chart. (Visits more than 30 days overdue are left to chart cleanup, not chased here.)",
  },
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

// Day math routes through lib/dates so bare 'YYYY-MM-DD' values (warranty
// expiry, fitting dates — Postgres `date` columns) are read in local time.
// The previous local helpers parsed them as UTC midnight, skewing counts and
// rendering dates a day early in negative-offset timezones.
function daysFromNow(iso) {
  if (!iso) return null;
  const d = libDaysUntil(iso);
  return Number.isNaN(d) ? null : d;
}
function daysSince(iso) {
  const d = daysFromNow(iso);
  return d == null ? null : -d;
}
function fmtShort(iso) {
  if (!iso) return "—";
  const d = parseDateOnly(iso) || new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Returns the set of bucket keys this patient matches, plus the primary
// bucket (first match in BUCKETS order). Patients with a recent contacted
// stamp are silenced and return [].
export function classify(p) {
  if (p.followUpStatus === "contacted" && p.followUpContactedAt) {
    const since = daysSince(p.followUpContactedAt);
    const cooldown = OUTCOME_COOLDOWN_DAYS[p.followUpOutcome] ?? CONTACTED_COOLDOWN_DAYS;
    if (since != null && since < cooldown) return { matched: [], primary: null };
  }

  const matched = [];
  const warrantyExpiry = p.devices?.warrantyExpiry || null;
  // Only a CONFIRMED fitting's date counts as "fit": pending sales carry an
  // estimated date (they live in the Pending Fittings queue, not here) and
  // cancelled sales were never fit at all.
  const fittingDate = (p.devices?.fittingStatus ?? "fitted") === "fitted"
    ? (p.devices?.fittingDate || null)
    : null;

  // A scheduled care-arc visit due within 7 days or overdue ≤30 days.
  // Completion tracking on the chart is what clears this bucket.
  if (dueCareVisit(p.appointments)) matched.push("care_visit_due");

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
    case "care_visit_due": {
      const a = dueCareVisit(p.appointments);
      return a ? apptDaysUntil(a.date) : 0; // most overdue first
    }
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

export default function FollowUpQueue({ patients, staffId, clinicId, onSelectPatient, onRefresh }) {
  const [busyId, setBusyId] = useState(null);
  const [filter,  setFilter]  = useState("all"); // "all" or a bucket key
  // Outcome picker state — which patient row is being logged, and the draft.
  const [loggingId, setLoggingId] = useState(null);
  const [outcomeDraft, setOutcomeDraft] = useState("reached");
  const [noteDraft, setNoteDraft] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);

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
    setErrorMsg(null);
    try {
      await markFollowUpContacted(patientId, {
        outcome: outcomeDraft,
        note: noteDraft.trim() || null,
        staffId,
        clinicId,
      });
      setLoggingId(null);
      setNoteDraft("");
      if (onRefresh) await onRefresh();
    } catch (err) {
      setErrorMsg(err?.message || "Save failed — the contact was NOT recorded.");
    } finally { setBusyId(null); }
  };

  const handleClear = async (patientId) => {
    setBusyId(patientId);
    setErrorMsg(null);
    try {
      await clearFollowUp(patientId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      setErrorMsg(err?.message || "Reset failed.");
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
        Logging a contact silences the patient for a stretch that matches the outcome —
        voicemail/no-answer resurface in {OUTCOME_COOLDOWN_DAYS.voicemail} days, reached in {OUTCOME_COOLDOWN_DAYS.reached},
        scheduled in {OUTCOME_COOLDOWN_DAYS.scheduled}, declined in {OUTCOME_COOLDOWN_DAYS.declined}.
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
                const lastContact = p.followUpContactedAt ? daysSince(p.followUpContactedAt) : null;
                const lastOutcomeLabel = FOLLOW_UP_OUTCOMES.find(o => o.id === p.followUpOutcome)?.label;
                return (
                  <div key={p.id} style={{
                    padding: "12px 16px",
                    background: "white", border: "1px solid #e5e7eb", borderRadius: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        flex: 1, minWidth: 0, cursor: onSelectPatient ? "pointer" : "default",
                      }} onClick={() => onSelectPatient && onSelectPatient(p)}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0a1628" }}>{p.name || "—"}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                          {detail}
                          {p.phone ? ` · ${p.phone}` : ""}
                        </div>
                        {lastContact != null && (
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                            Last outreach {lastContact === 0 ? "today" : `${lastContact}d ago`}
                            {lastOutcomeLabel ? ` — ${lastOutcomeLabel.toLowerCase()}` : ""}
                            {p.followUpNotes ? ` · “${p.followUpNotes}”` : ""}
                          </div>
                        )}
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
                        {p.followUpStatus === "contacted" && (
                          <button disabled={busyId === p.id} onClick={() => handleClear(p.id)}
                            style={chipBtn("#6b7280")}>
                            Reset
                          </button>
                        )}
                        {loggingId === p.id ? (
                          <button onClick={() => { setLoggingId(null); setErrorMsg(null); }}
                            style={chipBtn("#6b7280")}>
                            Close
                          </button>
                        ) : (
                          <button disabled={busyId === p.id}
                            onClick={() => { setLoggingId(p.id); setOutcomeDraft("reached"); setNoteDraft(""); setErrorMsg(null); }}
                            style={chipBtn("#0a1628")}>
                            Log contact
                          </button>
                        )}
                      </div>
                    </div>
                    {loggingId === p.id && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select value={outcomeDraft} onChange={e => setOutcomeDraft(e.target.value)}
                          style={{ padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "'Sora',sans-serif", background: "white" }}>
                          {FOLLOW_UP_OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                        <input type="text" placeholder="Note (optional)" value={noteDraft}
                          onChange={e => setNoteDraft(e.target.value)}
                          style={{ flex: 1, minWidth: 160, padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "'Sora',sans-serif" }} />
                        <button disabled={busyId === p.id} onClick={() => handleContacted(p.id)}
                          style={{ ...chipBtn("white"), background: "#0a1628", borderColor: "#0a1628" }}>
                          {busyId === p.id ? "Saving…" : "Save"}
                        </button>
                        {errorMsg && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{errorMsg}</span>}
                      </div>
                    )}
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
    case "care_visit_due": {
      const a = dueCareVisit(p.appointments);
      if (!a) return "";
      const dn = apptDaysUntil(a.date);
      const when = dn < 0 ? `was ${fmtShort(apptDay(a.date))} (${-dn}d overdue)`
        : dn === 0 ? "due today"
        : `due ${fmtShort(apptDay(a.date))} (in ${dn}d)`;
      return `${a.type || "Care visit"} · ${when}`;
    }
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
