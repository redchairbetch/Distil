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

// Follow-up Queue + Call List (backlog #2, #43). The rules (buckets, cooldowns,
// scripts, escalation, coverage) live in lib/recall.js; this view renders them.
//
//   List mode  — every bucket, every patient, log a contact inline.
//   Call mode  — one patient at a time in priority order: phone, script,
//                attempt history, one-tap outcomes, auto-advance.
//
// Coverage banners at the top close the recall gaps: pre-Distil (legacy)
// fits get their remaining care arc, TNS patients get an annual retest —
// both inserted as DUE appointments so they flow into "Visit due".

import React, { useEffect, useMemo, useState } from "react";
import {
  markFollowUpContacted, clearFollowUp, FOLLOW_UP_OUTCOMES,
  loadClinicContacts, insertDueAppointments, setAppointmentBooked,
  addAppointment, updatePatientStatus,
} from "../db.js";
import {
  BUCKETS, classify, countFollowUpPatients, OUTCOME_COOLDOWN_DAYS,
  sortKeyFor, bucketDetail, bucketAppointment, scriptFor,
  unansweredStreak, ESCALATE_AFTER,
  legacyNeedsArc, remainingArcFor, tnsNeedsRetest, tnsRetestFor,
} from "../lib/recall.js";

// Re-exported so existing importers (Distil.jsx badge, Reports) keep working.
export { BUCKETS, classify, countFollowUpPatients };

const CONTACT_HISTORY_DAYS = 180;

function daysAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export default function FollowUpQueue({ patients, staffId, clinicId, clinicName, onSelectPatient, onRefresh }) {
  const [mode, setMode]       = useState("list"); // "list" | "call"
  const [filter, setFilter]   = useState("all");
  const [busyId, setBusyId]   = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [contacts, setContacts] = useState({}); // patientId → rows newest-first
  const [coverageBusy, setCoverageBusy] = useState(null);
  const [coverageMsg, setCoverageMsg]   = useState(null);
  // List-mode inline logger
  const [loggingId, setLoggingId] = useState(null);
  // Call mode
  const [callIdx, setCallIdx] = useState(0);
  const [skipped, setSkipped] = useState(() => new Set());

  const refreshContacts = async () => {
    if (!clinicId) return;
    const since = new Date(Date.now() - CONTACT_HISTORY_DAYS * 86400000).toISOString();
    const rows = await loadClinicContacts(clinicId, since);
    const by = {};
    for (const r of rows) (by[r.patient_id] ||= []).push(r);
    setContacts(by);
  };
  useEffect(() => { refreshContacts(); }, [clinicId]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const out = Object.fromEntries(BUCKETS.map(b => [b.key, []]));
    for (const p of patients || []) {
      const { matched, primary } = classify(p);
      if (!primary) continue;
      out[primary].push({ ...p, _matched: matched, _bucket: primary });
    }
    for (const k of Object.keys(out)) out[k].sort((a, b) => sortKeyFor(k, a) - sortKeyFor(k, b));
    return out;
  }, [patients]);

  const totalCount = BUCKETS.reduce((sum, b) => sum + grouped[b.key].length, 0);
  const visibleBuckets = filter === "all" ? BUCKETS : BUCKETS.filter(b => b.key === filter);
  const callQueue = useMemo(
    () => visibleBuckets.flatMap(b => grouped[b.key]).filter(p => !skipped.has(p.id)),
    [grouped, filter, skipped] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const legacyGaps = useMemo(() => (patients || []).filter(p => legacyNeedsArc(p)), [patients]);
  const tnsGaps    = useMemo(() => (patients || []).filter(p => tnsNeedsRetest(p)), [patients]);

  // One logging path for both modes. "Visit scheduled" with a date books the
  // bucket's appointment (or adds a booked visit when the bucket has none).
  const logOutcome = async (p, { outcome, note, channel = "call", bookDate }) => {
    setBusyId(p.id);
    setErrorMsg(null);
    try {
      if (outcome === "scheduled" && bookDate) {
        const appt = bucketAppointment(p._bucket, p);
        if (appt?.id) await setAppointmentBooked(appt.id, true, bookDate);
        else await addAppointment(p.id, clinicId, { date: bookDate, type: "Follow-up Visit", isBooked: true }, staffId);
      }
      await markFollowUpContacted(p.id, {
        outcome, note: note?.trim() || null, staffId, clinicId, channel, reason: p._bucket,
      });
      setLoggingId(null);
      await Promise.all([refreshContacts(), onRefresh ? onRefresh() : null]);
      return true;
    } catch (err) {
      setErrorMsg(err?.message || "Save failed — the contact was NOT recorded.");
      return false;
    } finally { setBusyId(null); }
  };

  const markLapsed = async (p) => {
    if (!window.confirm(`Mark ${p.name || "this patient"} as lapsed? They'll leave the outreach queue until their status changes.`)) return;
    setBusyId(p.id);
    try { await updatePatientStatus(p.id, "lapsed"); if (onRefresh) await onRefresh(); }
    catch (err) { setErrorMsg(err?.message || "Status change failed."); }
    finally { setBusyId(null); }
  };

  const handleClear = async (patientId) => {
    setBusyId(patientId);
    setErrorMsg(null);
    try { await clearFollowUp(patientId); if (onRefresh) await onRefresh(); }
    catch (err) { setErrorMsg(err?.message || "Reset failed."); }
    finally { setBusyId(null); }
  };

  const runCoverage = async (kind) => {
    const list = kind === "legacy" ? legacyGaps : tnsGaps;
    const label = kind === "legacy" ? "legacy fits onto their care arc" : "annual retests for TNS patients";
    if (!window.confirm(`Schedule ${list.length} ${label}? Visits are added as DUE (not booked) — you book them as you call.`)) return;
    setCoverageBusy(kind);
    setCoverageMsg(null);
    let done = 0, rows = 0, failed = 0;
    for (const p of list) {
      try {
        const appts = kind === "legacy" ? remainingArcFor(p.devices?.fittingDate) : [tnsRetestFor(p)];
        rows += await insertDueAppointments(p.id, p.clinicId || clinicId, staffId, appts);
        done++;
      } catch (e) { console.error("coverage:", e); failed++; }
    }
    setCoverageMsg(`${done} patient${done === 1 ? "" : "s"} scheduled (${rows} visits added)${failed ? ` · ${failed} failed — see console` : ""}.`);
    setCoverageBusy(null);
    if (onRefresh) await onRefresh();
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0a1628", margin: 0, fontFamily: "'Sora',sans-serif" }}>
          Follow-up Queue
        </h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {totalCount} {totalCount === 1 ? "patient" : "patients"} need outreach
        </span>
        <div style={{ marginLeft: "auto", display: "inline-flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          {[["list", "List"], ["call", "📞 Call list"]].map(([k, l]) => (
            <button key={k} onClick={() => { setMode(k); setCallIdx(0); setSkipped(new Set()); }}
              style={{ padding: "6px 14px", border: "none", background: mode === k ? "#0a1628" : "white", color: mode === k ? "white" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Sora',sans-serif" }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Logging a contact silences the patient for a stretch that matches the outcome —
        voicemail/no-answer resurface in {OUTCOME_COOLDOWN_DAYS.voicemail} days, reached in {OUTCOME_COOLDOWN_DAYS.reached},
        scheduled in {OUTCOME_COOLDOWN_DAYS.scheduled}, declined in {OUTCOME_COOLDOWN_DAYS.declined}.
        Do-not-contact and lapsed patients never appear.
      </div>

      {(legacyGaps.length > 0 || tnsGaps.length > 0 || coverageMsg) && (
        <div style={{ background: "#FBF9F3", border: "1px solid #E4E0D5", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.6 }}>Recall coverage</div>
          {legacyGaps.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#374151" }}>
              <span style={{ flex: 1 }}><b>{legacyGaps.length}</b> pre-Distil fit{legacyGaps.length === 1 ? "" : "s"} with no care schedule. Add the rest of their 4-year care arc (future visits only).</span>
              <button disabled={!!coverageBusy} onClick={() => runCoverage("legacy")} style={chipBtn("#0f766e")}>
                {coverageBusy === "legacy" ? "Scheduling…" : "Enroll in care arc"}
              </button>
            </div>
          )}
          {tnsGaps.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#374151" }}>
              <span style={{ flex: 1 }}><b>{tnsGaps.length}</b> tested-not-treated patient{tnsGaps.length === 1 ? "" : "s"} with nothing on the books. Schedule an annual retest (one year from their last test, or now if that's passed).</span>
              <button disabled={!!coverageBusy} onClick={() => runCoverage("tns")} style={chipBtn("#0f766e")}>
                {coverageBusy === "tns" ? "Scheduling…" : "Schedule retests"}
              </button>
            </div>
          )}
          {coverageMsg && <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ {coverageMsg}</div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <button onClick={() => { setFilter("all"); setCallIdx(0); }} style={filterBtn(filter === "all", "#0a1628", "#0a1628", true)}>
          All ({totalCount})
        </button>
        {BUCKETS.map(b => {
          const count = grouped[b.key].length;
          if (!count && filter !== b.key) return null;
          return (
            <button key={b.key} onClick={() => { setFilter(b.key); setCallIdx(0); }} style={filterBtn(filter === b.key, b.color, b.bg)}>
              {b.icon} {b.label.replace(/ \(.+\)/, "")} ({count})
            </button>
          );
        })}
      </div>

      {errorMsg && <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, marginBottom: 12 }}>{errorMsg}</div>}

      {totalCount === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "#6b7280", fontSize: 14, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12 }}>
          ✓ Queue is clear. No patients matching follow-up criteria right now.
        </div>
      )}

      {mode === "call" && totalCount > 0 && (
        <CallCard
          queue={callQueue}
          idx={Math.min(callIdx, Math.max(0, callQueue.length - 1))}
          setIdx={setCallIdx}
          onSkip={(p) => setSkipped(s => new Set([...s, p.id]))}
          contacts={contacts}
          clinicName={clinicName}
          busyId={busyId}
          onLog={logOutcome}
          onLapse={markLapsed}
          onSelectPatient={onSelectPatient}
        />
      )}

      {mode === "list" && visibleBuckets.map(bucket => {
        const rows = grouped[bucket.key];
        if (!rows.length) return null;
        return (
          <div key={bucket.key} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: bucket.bg, color: bucket.color, letterSpacing: 0.4, textTransform: "uppercase" }}>
                {bucket.icon} {bucket.label}
              </span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{rows.length}</span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>{bucket.blurb}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map(p => {
                const others = (p._matched || []).filter(k => k !== bucket.key);
                const history = contacts[p.id] || [];
                const streak = unansweredStreak(history);
                const lastContact = p.followUpContactedAt ? daysAgo(p.followUpContactedAt) : null;
                const lastOutcomeLabel = FOLLOW_UP_OUTCOMES.find(o => o.id === p.followUpOutcome)?.label;
                return (
                  <div key={p.id} style={{ padding: "12px 16px", background: "white", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 0, cursor: onSelectPatient ? "pointer" : "default" }} onClick={() => onSelectPatient && onSelectPatient(p)}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0a1628" }}>{p.name || "—"}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                          {bucketDetail(bucket.key, p)}
                          {p.phone ? ` · ${p.phone}` : ""}
                          {p.contactPreference ? ` · prefers ${p.contactPreference}` : ""}
                        </div>
                        {lastContact != null && (
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                            Last outreach {lastContact === 0 ? "today" : `${lastContact}d ago`}
                            {lastOutcomeLabel ? ` — ${lastOutcomeLabel.toLowerCase()}` : ""}
                            {p.followUpNotes ? ` · “${p.followUpNotes}”` : ""}
                          </div>
                        )}
                        {(others.length > 0 || streak > 0) && (
                          <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {streak > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: streak >= ESCALATE_AFTER ? "#fee2e2" : "#f3f4f6", color: streak >= ESCALATE_AFTER ? "#b91c1c" : "#6b7280" }}>
                                {streak} unanswered {streak === 1 ? "attempt" : "attempts"}
                              </span>
                            )}
                            {others.map(k => {
                              const b = BUCKETS.find(x => x.key === k);
                              return <span key={k} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: b.bg, color: b.color }}>also: {b.label.replace(/ \(.+\)/, "")}</span>;
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {p.followUpStatus === "contacted" && (
                          <button disabled={busyId === p.id} onClick={() => handleClear(p.id)} style={chipBtn("#6b7280")}>Reset</button>
                        )}
                        {loggingId === p.id
                          ? <button onClick={() => { setLoggingId(null); setErrorMsg(null); }} style={chipBtn("#6b7280")}>Close</button>
                          : <button disabled={busyId === p.id} onClick={() => { setLoggingId(p.id); setErrorMsg(null); }} style={chipBtn("#0a1628")}>Log contact</button>}
                      </div>
                    </div>
                    {streak >= ESCALATE_AFTER && (
                      <EscalationStrip p={p} busy={busyId === p.id} onLog={logOutcome} onLapse={markLapsed} />
                    )}
                    {loggingId === p.id && (
                      <InlineLogger p={p} busy={busyId === p.id} onLog={logOutcome} />
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

// ── Inline outcome logger (list mode) ───────────────────────────────────────
function InlineLogger({ p, busy, onLog }) {
  const [outcome, setOutcome] = useState("reached");
  const [note, setNote] = useState("");
  const [bookDate, setBookDate] = useState("");
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select value={outcome} onChange={e => setOutcome(e.target.value)} style={inputSty}>
        {FOLLOW_UP_OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      {outcome === "scheduled" && (
        <input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} title="Booked visit date (optional)" style={inputSty} />
      )}
      <input type="text" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} style={{ ...inputSty, flex: 1, minWidth: 160 }} />
      <button disabled={busy} onClick={() => onLog(p, { outcome, note, bookDate, channel: outcome === "sent" ? "letter" : "call" })}
        style={{ ...chipBtn("white"), background: "#0a1628", borderColor: "#0a1628" }}>
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

// ── Escalation (3+ unanswered) ──────────────────────────────────────────────
function EscalationStrip({ p, busy, onLog, onLapse }) {
  return (
    <div style={{ marginTop: 10, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "#991b1b", flex: 1, minWidth: 200 }}>
        {ESCALATE_AFTER}+ calls without an answer. Send a letter or text — or mark them lapsed if they've moved on.
      </span>
      <button disabled={busy} onClick={() => onLog(p, { outcome: "sent", channel: "letter", note: "Letter sent after unanswered calls" })} style={chipBtn("#991b1b")}>Letter sent</button>
      <button disabled={busy} onClick={() => onLog(p, { outcome: "sent", channel: "text", note: "Text sent after unanswered calls" })} style={chipBtn("#991b1b")}>Text sent</button>
      <button disabled={busy} onClick={() => onLapse(p)} style={chipBtn("#6b7280")}>Mark lapsed</button>
    </div>
  );
}

// ── Call mode: one patient at a time ────────────────────────────────────────
function CallCard({ queue, idx, setIdx, onSkip, contacts, clinicName, busyId, onLog, onLapse, onSelectPatient }) {
  const [note, setNote] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [booking, setBooking] = useState(false);
  const p = queue[idx];
  useEffect(() => { setNote(""); setBookDate(""); setBooking(false); }, [p?.id]);

  if (!p) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#16a34a", fontSize: 15, fontWeight: 600, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12 }}>
        ✓ End of the call list. Nice work.
      </div>
    );
  }
  const bucket = BUCKETS.find(b => b.key === p._bucket);
  const history = contacts[p.id] || [];
  const streak = unansweredStreak(history);
  const busy = busyId === p.id;
  // After a log, the patient drops out of the queue (cooldown), so the same
  // index now points at the next patient — no manual advance needed.
  const log = async (outcome, extra = {}) => {
    await onLog(p, { outcome, note, ...extra });
  };
  const outcomeBtn = (id, label, color) => (
    <button key={id} disabled={busy} onClick={() => id === "scheduled" ? setBooking(true) : log(id)}
      style={{ flex: "1 1 130px", padding: "12px 10px", borderRadius: 10, border: `1px solid ${color}`, background: "white", color, fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", fontFamily: "'Sora',sans-serif" }}>
      {label}
    </button>
  );

  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 24, maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: bucket.bg, color: bucket.color, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {bucket.icon} {bucket.label}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>{idx + 1} of {queue.length}</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#0a1628", cursor: "pointer" }} onClick={() => onSelectPatient && onSelectPatient(p)} title="Open chart">{p.name || "—"}</div>
        {p.phone
          ? <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} style={{ fontSize: 18, fontWeight: 700, color: "#0f766e", textDecoration: "none" }}>📞 {p.phone}</a>
          : <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>No phone on file{p.email ? ` · ${p.email}` : ""}</span>}
        {p.contactPreference && <span style={{ fontSize: 12, color: "#6b7280" }}>prefers {p.contactPreference}</span>}
      </div>
      <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>{bucketDetail(p._bucket, p)}</div>

      <div style={{ marginTop: 14, padding: "12px 14px", background: "#FBF9F3", borderLeft: `3px solid ${bucket.color}`, borderRadius: 6, fontSize: 14, color: "#1f2937", lineHeight: 1.5 }}>
        {scriptFor(p._bucket, p, clinicName || "the clinic")}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
        {history.length === 0 ? "No outreach logged yet." : (
          <>
            {history.length} attempt{history.length === 1 ? "" : "s"} in the last {CONTACT_HISTORY_DAYS} days
            {streak > 0 && <b style={{ color: streak >= ESCALATE_AFTER ? "#b91c1c" : "#6b7280" }}> · {streak} unanswered in a row</b>}
            {" · last: "}{FOLLOW_UP_OUTCOMES.find(o => o.id === history[0].outcome)?.label.toLowerCase()} {daysAgo(history[0].created_at) === 0 ? "today" : `${daysAgo(history[0].created_at)}d ago`}
          </>
        )}
      </div>

      {streak >= ESCALATE_AFTER && <EscalationStrip p={p} busy={busy} onLog={onLog} onLapse={onLapse} />}

      <input type="text" placeholder="Note (optional) — logged with the outcome" value={note} onChange={e => setNote(e.target.value)}
        style={{ ...inputSty, width: "100%", marginTop: 14, boxSizing: "border-box", padding: "10px 12px", fontSize: 13 }} />

      {booking ? (
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 10, background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f766e" }}>Booked for</span>
          <input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} style={inputSty} />
          <button disabled={busy || !bookDate} onClick={() => log("scheduled", { bookDate })} style={{ ...chipBtn("white"), background: "#0f766e", borderColor: "#0f766e" }}>
            {busy ? "Saving…" : "Save booking"}
          </button>
          <button disabled={busy} onClick={() => log("scheduled")} style={chipBtn("#0f766e")} title="Log as scheduled without a date in Distil">No date</button>
          <button onClick={() => setBooking(false)} style={chipBtn("#6b7280")}>Back</button>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {outcomeBtn("scheduled", "📅 Booked", "#0f766e")}
          {outcomeBtn("reached", "Reached", "#1d4ed8")}
          {outcomeBtn("voicemail", "Voicemail", "#b45309")}
          {outcomeBtn("no_answer", "No answer", "#6b7280")}
          {outcomeBtn("declined", "Declined", "#b91c1c")}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button disabled={idx === 0} onClick={() => setIdx(Math.max(0, idx - 1))} style={chipBtn("#6b7280")}>← Prev</button>
        <button onClick={() => onSkip(p)} style={chipBtn("#6b7280")} title="Skip for this session (nothing logged)">Skip</button>
        <button disabled={idx >= queue.length - 1} onClick={() => setIdx(idx + 1)} style={chipBtn("#6b7280")}>Next →</button>
      </div>
    </div>
  );
}

const inputSty = { padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "'Sora',sans-serif", background: "white" };

function chipBtn(color) {
  return {
    fontSize: 12, fontWeight: 600, padding: "6px 12px",
    background: "white", color, border: `1px solid ${color}`,
    borderRadius: 6, cursor: "pointer", fontFamily: "'Sora',sans-serif",
  };
}

function filterBtn(active, color, bg, solid = false) {
  return {
    padding: "6px 14px",
    border: active ? `2px solid ${color}` : "1px solid #e5e7eb",
    borderRadius: 20,
    background: active ? (solid ? color : bg) : "white",
    color: active ? (solid ? "white" : color) : "#374151",
    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Sora',sans-serif",
  };
}
