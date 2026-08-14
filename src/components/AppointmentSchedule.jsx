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
import { fmtDate } from "../lib/dates.js";
import { apptDay, apptDaysUntil, partitionAppointments } from "../lib/appointments.js";

// Patient-detail appointment schedule (extracted from Distil.jsx). Collapsed
// to the next visit by default; expands to the full arc. Rows are now
// actionable: mark complete, edit date/type/note, cancel (and restore a
// cancelled row). Completion feeds the follow-up queue's care-visit bucket —
// the care arc only drives work if visits can be checked off.
//
// Not a calendar: this stays a work list over the appointments table.

const btnSty = { background: "none", border: "1px solid #E4E0D5", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Sora',sans-serif", color: "#374151" };
const inputSty = { padding: "6px 8px", border: "1px solid #E4E0D5", borderRadius: 6, fontSize: 12, fontFamily: "'Sora',sans-serif", outline: "none", boxSizing: "border-box" };

export default function AppointmentSchedule({ appointments, visitTypes = [], onAdd, onUpdate, onSetStatus }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(null); // appt id | "new" | null
  const [draft, setDraft] = useState({ date: "", type: "", note: "" });
  const [saveState, setSaveState] = useState(null); // null | "saving" | "saved" | {error}
  const canEdit = !!(onUpdate && onSetStatus);

  if (!appointments?.length && !onAdd) return null;

  const { overdue, next, upcoming, history } = partitionAppointments(appointments || []);
  const restUpcoming = upcoming.slice(1);
  const hiddenCount = restUpcoming.length + history.length;

  const run = async (fn) => {
    setSaveState("saving");
    try {
      await fn();
      setSaveState("saved");
      setTimeout(() => setSaveState(s => (s === "saved" ? null : s)), 2000);
      return true;
    } catch (err) {
      setSaveState({ error: err?.message || "Save failed" });
      return false;
    }
  };

  const startEdit = (a) => {
    setDraft({ date: apptDay(a.date), type: a.type || "", note: a.note || "" });
    setEditing(a.id);
  };
  const startAdd = () => {
    setDraft({ date: "", type: visitTypes[0] || "", note: "" });
    setEditing("new");
  };
  const saveDraft = async () => {
    if (!draft.date) return;
    const ok = await run(() =>
      editing === "new"
        ? onAdd({ date: draft.date, type: draft.type || null, note: draft.note })
        : onUpdate(editing, { date: draft.date, type: draft.type, note: draft.note })
    );
    if (ok) setEditing(null);
  };

  const relHint = (dateStr) => {
    const d = apptDaysUntil(dateStr);
    return d <= 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
  };

  const actions = (a) => canEdit && a.id && editing !== a.id && (
    <span style={{ display: "inline-flex", gap: 4, marginLeft: 8, whiteSpace: "nowrap" }}>
      {(!a.status || a.status === "scheduled") && (
        <>
          <button style={{ ...btnSty, color: "#16a34a", borderColor: "#bbf7d0" }} title="Mark completed"
            onClick={() => run(() => onSetStatus(a.id, "completed"))}>✓</button>
          <button style={btnSty} title="Edit" onClick={() => startEdit(a)}>✎</button>
          <button style={{ ...btnSty, color: "#ef4444" }} title="Cancel appointment"
            onClick={() => { if (window.confirm(`Cancel ${a.type || "this appointment"} on ${fmtDate(apptDay(a.date))}?`)) run(() => onSetStatus(a.id, "cancelled")); }}>✕</button>
        </>
      )}
      {a.status === "cancelled" && (
        <button style={btnSty} title="Restore to scheduled" onClick={() => run(() => onSetStatus(a.id, "scheduled"))}>Restore</button>
      )}
      {a.status === "completed" && (
        <button style={btnSty} title="Reopen as scheduled" onClick={() => run(() => onSetStatus(a.id, "scheduled"))}>Reopen</button>
      )}
    </span>
  );

  const editor = (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap", background: "#FBF9F3", border: "1px solid #E4E0D5", borderRadius: 8, padding: 8, margin: "6px 0" }}>
      <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} style={inputSty} />
      <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} style={{ ...inputSty, background: "white" }}>
        {draft.type && !visitTypes.includes(draft.type) && <option value={draft.type}>{draft.type}</option>}
        {visitTypes.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input type="text" placeholder="Note (optional)" value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} style={{ ...inputSty, flex: 1, minWidth: 140 }} />
      <button style={{ ...btnSty, background: "#0a1628", color: "white", border: "none", padding: "6px 12px" }} disabled={!draft.date || saveState === "saving"} onClick={saveDraft}>
        {saveState === "saving" ? "Saving…" : "Save"}
      </button>
      <button style={{ ...btnSty, padding: "6px 10px" }} onClick={() => setEditing(null)}>Cancel</button>
    </div>
  );

  const row = (a, key, muted) => (
    <div className="detail-row" key={key} style={{ alignItems: "center" }}>
      <span className="detail-key" style={muted ? { color: "#9ca3af" } : undefined}>
        {a.type}
        {a.status === "completed" && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#16a34a", background: "#dcfce7", borderRadius: 4, padding: "1px 5px" }}>DONE</span>}
        {a.status === "cancelled" && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", borderRadius: 4, padding: "1px 5px" }}>CANCELLED</span>}
      </span>
      <span className="detail-val" style={muted ? { color: "#9ca3af" } : undefined}>
        {fmtDate(apptDay(a.date))}
        {actions(a)}
      </span>
    </div>
  );

  return (
    <div className="detail-card full">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div className="detail-card-title">
          Appointment Schedule{upcoming.length > 0 ? ` · ${upcoming.length} upcoming` : ""}
        </div>
        {saveState === "saved" && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ Saved</span>}
        {saveState?.error && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>Save failed — {saveState.error}</span>}
        {canEdit && onAdd && editing == null && (
          <button style={{ ...btnSty, marginLeft: "auto" }} onClick={startAdd}>+ Add</button>
        )}
      </div>
      {editing === "new" && editor}
      {overdue.length > 0 && (
        <div style={{ background: "#fffbeb", borderLeft: "3px solid #f59e0b", borderRadius: 4, padding: "6px 8px", margin: "3px 0" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#92400e", marginBottom: 2 }}>
            Overdue — complete, move, or cancel
          </div>
          {overdue.map((a, i) => (
            editing === a.id ? <div key={`o${i}`}>{editor}</div> : (
              <div key={`o${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "2px 0" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>{a.type}</span>
                <span style={{ fontSize: 12, color: "#92400e", whiteSpace: "nowrap" }}>
                  {fmtDate(apptDay(a.date))}
                  <span style={{ marginLeft: 4, fontSize: 10 }}>({-apptDaysUntil(a.date)}d ago)</span>
                  {actions(a)}
                </span>
              </div>
            )
          ))}
        </div>
      )}
      {next ? (
        editing === next.id ? editor : (
          <div style={{ background: "#eff6ff", borderLeft: "3px solid #1d4ed8", borderRadius: 4, padding: "6px 8px", margin: "3px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0a1628" }}>
                {next.type}
                <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#1d4ed8", background: "#dbeafe", borderRadius: 4, padding: "1px 5px", letterSpacing: 0.5 }}>NEXT</span>
              </span>
              <span style={{ fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>
                {fmtDate(apptDay(next.date))}
                <span style={{ marginLeft: 6, fontSize: 11, color: "#6b7280" }}>({relHint(next.date)})</span>
                {actions(next)}
              </span>
            </div>
            {next.note && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, lineHeight: 1.4 }}>{next.note}</div>}
          </div>
        )
      ) : (
        overdue.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af", padding: "4px 0" }}>No upcoming appointments.</div>
      )}
      {expanded && (
        <>
          {restUpcoming.map((a, i) => (editing === a.id ? <div key={`u${i}`}>{editor}</div> : row(a, `u${i}`, false)))}
          {history.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#9ca3af", margin: "10px 0 2px" }}>Past</div>
              {history.map((a, i) => row(a, `p${i}`, true))}
            </>
          )}
        </>
      )}
      {hiddenCount > 0 && (
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: "none", border: "none", color: "#1d4ed8", fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "6px 0 0" }}>
          {expanded ? "Show less" : `Show full schedule (${hiddenCount} more)`}
        </button>
      )}
    </div>
  );
}
