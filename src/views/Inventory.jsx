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

// Serialized device inventory (backlog #44). One row per physical aid.
// Patient orders are created from Pending Fittings; this screen adds shelf
// stock / loaners / demos, receives orders, and runs the non-patient moves
// (loan out, return for credit, credit received). Rules: lib/inventory.js.

import React, { useEffect, useMemo, useState } from "react";
import {
  createDeviceUnits, transitionDeviceUnit, updateDeviceUnit, listUnitEvents,
} from "../db.js";
import {
  UNIT_STATUSES, STATUS_BY_ID, PURPOSES, EVENT_LABELS, TERMINAL,
  inventoryAlerts, rfcDeadline, unitLabel,
} from "../lib/inventory.js";
import { MFR_DISPLAY } from "../lib/manufacturerKeys.js";
import { fmtDate } from "../lib/dates.js";

const TABS = [
  { key: "attention", label: "Needs attention" },
  { key: "on_order",  label: "On order",  statuses: ["on_order"] },
  { key: "received",  label: "Reserved",  statuses: ["reserved"] },
  { key: "stock",     label: "In stock",  statuses: ["in_stock"] },
  { key: "loaned",    label: "Loaners out", statuses: ["loaned_out"] },
  { key: "repair",    label: "In repair", statuses: ["in_repair"] },
  { key: "rfc",       label: "Return for credit", statuses: ["rfc_pending"] },
  { key: "fitted",    label: "Fitted",    statuses: ["fitted"] },
  { key: "closed",    label: "Closed",    statuses: ["returned_for_credit", "lost_damaged", "retired"] },
];

const todayYmd = () => {
  const d = new Date(); const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function countInventoryAlerts(units) {
  return inventoryAlerts(units || []).length;
}

const EMPTY_DRAFT = { purpose: "stock", manufacturer: "", family: "", tech_level: "", style: "", color: "", ear: "", serial_number: "", order_ref: "", ordered_at: "", cost: "", received: true };

export default function Inventory({ units = [], onRefresh, clinicId, staffId, patients = [], manufacturerAccounts = {}, onSelectPatient }) {
  const [tab, setTab] = useState("attention");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [openId, setOpenId] = useState(null); // unit row with an action panel open
  const [panel, setPanel] = useState(null);   // { kind, ... }
  const [history, setHistory] = useState({}); // unitId → events
  const [search, setSearch] = useState("");

  const alerts = useMemo(() => inventoryAlerts(units), [units]);
  const patientName = useMemo(() => Object.fromEntries(patients.map(p => [p.id, p.name])), [patients]);
  const counts = useMemo(() => {
    const c = {};
    for (const t of TABS) c[t.key] = t.statuses ? units.filter(u => t.statuses.includes(u.status)).length : alerts.length;
    return c;
  }, [units, alerts]);

  const rows = useMemo(() => {
    const t = TABS.find(x => x.key === tab);
    let list = tab === "attention" ? alerts.map(a => ({ ...a.unit, _alert: a })) : units.filter(u => t.statuses.includes(u.status));
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(u => [unitLabel(u), u.order_ref, patientName[u.patient_id]].join(" ").toLowerCase().includes(q));
    return list;
  }, [tab, units, alerts, search, patientName]);

  const run = async (key, fn) => {
    setBusy(key); setErr(null);
    try { await fn(); setOpenId(null); setPanel(null); if (onRefresh) await onRefresh(); }
    catch (e) { setErr(e?.message || "Save failed."); }
    finally { setBusy(null); }
  };

  const addUnit = () => run("add", async () => {
    if (!draft.manufacturer) throw new Error("Manufacturer is required.");
    const received = draft.received && draft.serial_number.trim();
    const recvDate = received ? todayYmd() : null;
    await createDeviceUnits(clinicId, [{
      purpose: draft.purpose,
      status: received ? "in_stock" : "on_order",
      manufacturer: draft.manufacturer,
      family: draft.family || null,
      tech_level: draft.tech_level || null,
      style: draft.style || null,
      color: draft.color || null,
      ear: draft.ear || null,
      serial_number: draft.serial_number.trim() || null,
      order_ref: draft.order_ref || null,
      ordered_at: draft.ordered_at || (received ? null : todayYmd()),
      received_at: recvDate,
      rfc_deadline: received && draft.purpose === "stock" ? rfcDeadline(recvDate, draft.manufacturer, manufacturerAccounts) : null,
      unit_cost_cents: draft.cost ? Math.round(Number(draft.cost) * 100) : null,
    }], { staffId, eventType: received ? "received" : "ordered" });
    setDraft(EMPTY_DRAFT); setAdding(false);
  });

  const toggleHistory = async (u) => {
    if (history[u.id]) { setHistory(h => { const n = { ...h }; delete n[u.id]; return n; }); return; }
    const ev = await listUnitEvents([u.id]);
    setHistory(h => ({ ...h, [u.id]: ev }));
  };

  const actionsFor = (u) => {
    const A = [];
    const open = (kind, extra = {}) => () => { setOpenId(u.id); setPanel({ kind, serial: u.serial_number || "", date: todayYmd(), patientId: "", note: "", ...extra }); setErr(null); };
    if (u.status === "on_order") {
      A.push(["Receive", open("receive")]);
      A.push(["Cancel order", () => window.confirm("Cancel this order? The unit is retired with an 'order cancelled' note.") &&
        run(u.id, () => transitionDeviceUnit(u, "retired", { eventType: "order_cancelled", staffId }))]);
    }
    if (u.status === "reserved") {
      A.push(["Release to stock", () => run(u.id, () => transitionDeviceUnit(u, "in_stock", { eventType: "unreserved", staffId, fields: { patient_id: null, fitting_id: null, side_id: null, purpose: "stock" } }))]);
      A.push(["Return for credit", open("rfc")]);
    }
    if (u.status === "in_stock") {
      A.push(["Loan out", open("loan")]);
      A.push(["Return for credit", open("rfc")]);
      A.push(["Retire", () => window.confirm("Retire this unit from inventory?") && run(u.id, () => transitionDeviceUnit(u, "retired", { eventType: "retired", staffId }))]);
    }
    if (u.status === "loaned_out") {
      A.push(["Loaner returned", () => run(u.id, () => transitionDeviceUnit(u, "in_stock", { eventType: "loaner_returned", staffId, fields: { patient_id: null } }))]);
      A.push(["Lost / damaged", () => window.confirm("Mark this loaner lost or damaged?") && run(u.id, () => transitionDeviceUnit(u, "lost_damaged", { eventType: "ld_claim", staffId }))]);
    }
    if (u.status === "in_repair") {
      A.push(["Back from repair", () => run(u.id, () => transitionDeviceUnit(u, u.patient_id ? "fitted" : "in_stock", { eventType: "repair_returned", staffId }))]);
    }
    if (u.status === "rfc_pending") {
      A.push(["Credit received", () => run(u.id, () => transitionDeviceUnit(u, "returned_for_credit", { eventType: "credited", staffId }))]);
      A.push(["Cancel return", () => run(u.id, () => transitionDeviceUnit(u, "in_stock", { eventType: "rfc_cancelled", staffId, fields: { patient_id: null, fitting_id: null, side_id: null } }))]);
    }
    if (!TERMINAL.has(u.status)) A.push(["Edit serial", open("serial")]);
    return A;
  };

  const submitPanel = (u) => {
    const pn = panel;
    if (pn.kind === "receive") return run(u.id, async () => {
      const serial = pn.serial.trim();
      if (!serial) throw new Error("Enter the serial number (scan it if you have a barcode reader).");
      await transitionDeviceUnit(u, u.patient_id ? "reserved" : "in_stock", {
        eventType: "received", staffId, note: pn.note || null,
        fields: { serial_number: serial, received_at: pn.date, rfc_deadline: rfcDeadline(pn.date, u.manufacturer, manufacturerAccounts) },
      });
    });
    if (pn.kind === "loan") return run(u.id, async () => {
      if (!pn.patientId) throw new Error("Pick the patient taking the loaner.");
      await transitionDeviceUnit(u, "loaned_out", { eventType: "loaned", staffId, patientId: pn.patientId, note: pn.note || null, fields: { patient_id: pn.patientId } });
    });
    if (pn.kind === "rfc") return run(u.id, () =>
      transitionDeviceUnit(u, "rfc_pending", { eventType: "rfc_started", staffId, note: pn.note || null }));
    if (pn.kind === "serial") return run(u.id, () =>
      updateDeviceUnit(u, { serial_number: pn.serial.trim() || null }, { staffId, note: pn.note || null }));
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0a1628", margin: 0, fontFamily: "'Sora',sans-serif" }}>Inventory</h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{units.filter(u => !TERMINAL.has(u.status)).length} active units</span>
        <button onClick={() => { setAdding(a => !a); setErr(null); }} style={{ ...btn("#0a1628", true), marginLeft: "auto" }}>{adding ? "Close" : "+ Add unit"}</button>
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Every serialized device, from order to fit to repair or credit. Patient orders start from Pending Fittings;
        add shelf stock, loaners and demo units here. Return-for-credit window: {manufacturerAccounts && Object.values(manufacturerAccounts).some(a => a?.rfc_days) ? "per manufacturer (Settings)" : "60 days from receipt"}.
      </div>

      {adding && (
        <div style={{ background: "#FBF9F3", border: "1px solid #E4E0D5", borderRadius: 10, padding: 14, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8 }}>
            <Field label="Purpose"><select value={draft.purpose} onChange={e => setDraft(d => ({ ...d, purpose: e.target.value }))} style={inp}>{PURPOSES.filter(p => p.id !== "patient_order").map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
            <Field label="Manufacturer *"><select value={draft.manufacturer} onChange={e => setDraft(d => ({ ...d, manufacturer: e.target.value }))} style={inp}><option value="">—</option>{Object.values(MFR_DISPLAY).map(m => <option key={m} value={m}>{m}</option>)}</select></Field>
            <Field label="Family / model"><input value={draft.family} onChange={e => setDraft(d => ({ ...d, family: e.target.value }))} style={inp} placeholder="e.g. Pure Charge&Go IX" /></Field>
            <Field label="Tech level"><input value={draft.tech_level} onChange={e => setDraft(d => ({ ...d, tech_level: e.target.value }))} style={inp} placeholder="e.g. 7IX" /></Field>
            <Field label="Style"><input value={draft.style} onChange={e => setDraft(d => ({ ...d, style: e.target.value }))} style={inp} placeholder="RIC / BTE / ITE…" /></Field>
            <Field label="Color"><input value={draft.color} onChange={e => setDraft(d => ({ ...d, color: e.target.value }))} style={inp} /></Field>
            <Field label="Ear"><select value={draft.ear} onChange={e => setDraft(d => ({ ...d, ear: e.target.value }))} style={inp}><option value="">Either / n.a.</option><option value="left">Left</option><option value="right">Right</option></select></Field>
            <Field label="Serial number"><input value={draft.serial_number} onChange={e => setDraft(d => ({ ...d, serial_number: e.target.value }))} style={inp} placeholder="Scan or type" /></Field>
            <Field label="Order / PO #"><input value={draft.order_ref} onChange={e => setDraft(d => ({ ...d, order_ref: e.target.value }))} style={inp} /></Field>
            <Field label="Unit cost ($)"><input type="number" min="0" step="0.01" value={draft.cost} onChange={e => setDraft(d => ({ ...d, cost: e.target.value }))} style={inp} /></Field>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={draft.received} onChange={e => setDraft(d => ({ ...d, received: e.target.checked }))} />
              Already on hand (needs a serial) — otherwise added as on order
            </label>
            <button disabled={busy === "add"} onClick={addUnit} style={{ ...btn("#0a1628", true), marginLeft: "auto" }}>{busy === "add" ? "Saving…" : "Add to inventory"}</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Sora',sans-serif",
            border: tab === t.key ? "2px solid #0a1628" : "1px solid #e5e7eb",
            background: tab === t.key ? "#0a1628" : "white", color: tab === t.key ? "white" : (t.key === "attention" && counts.attention ? "#b91c1c" : "#374151"),
          }}>{t.label} ({counts[t.key]})</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search serial, model, patient, PO…" style={{ ...inp, marginLeft: "auto", minWidth: 220 }} />
      </div>

      {err && <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, marginBottom: 10 }}>{err}</div>}

      {rows.length === 0 && (
        <div style={{ padding: 28, textAlign: "center", color: "#6b7280", fontSize: 14, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12 }}>
          {tab === "attention" ? "✓ Nothing needs attention." : "No units here."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(u => {
          const st = STATUS_BY_ID[u.status];
          const pName = patientName[u.patient_id];
          return (
            <div key={u.id + (u._alert?.kind || "")} style={{ padding: "12px 16px", background: "white", border: `1px solid ${u._alert ? "#fecaca" : "#e5e7eb"}`, borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: st?.bg, color: st?.color, textTransform: "uppercase", whiteSpace: "nowrap" }}>{st?.label}</span>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0a1628" }}>{unitLabel(u)}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {PURPOSES.find(p => p.id === u.purpose)?.label}
                    {pName && <> · <span style={{ color: "#0f766e", cursor: onSelectPatient ? "pointer" : "default", fontWeight: 600 }} onClick={() => { const p = patients.find(x => x.id === u.patient_id); if (p && onSelectPatient) onSelectPatient(p); }}>{pName}</span></>}
                    {u.order_ref && ` · PO ${u.order_ref}`}
                    {u.ordered_at && u.status === "on_order" && ` · ordered ${fmtDate(u.ordered_at)}`}
                    {u.received_at && ` · received ${fmtDate(u.received_at)}`}
                    {u.rfc_deadline && !TERMINAL.has(u.status) && ` · RFC by ${fmtDate(u.rfc_deadline)}`}
                  </div>
                  {u._alert && <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600, marginTop: 3 }}>⚠ {u._alert.label}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {actionsFor(u).map(([label, fn]) => (
                    <button key={label} disabled={busy === u.id} onClick={fn} style={btn("#0a1628")}>{label}</button>
                  ))}
                  <button onClick={() => toggleHistory(u)} style={btn("#6b7280")}>{history[u.id] ? "Hide history" : "History"}</button>
                </div>
              </div>

              {openId === u.id && panel && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {(panel.kind === "receive" || panel.kind === "serial") && (
                    <input autoFocus value={panel.serial} onChange={e => setPanel(p => ({ ...p, serial: e.target.value }))} placeholder="Serial number" style={{ ...inp, minWidth: 180 }} />
                  )}
                  {panel.kind === "receive" && (
                    <label style={{ fontSize: 12, color: "#6b7280" }}>Received <input type="date" value={panel.date} onChange={e => setPanel(p => ({ ...p, date: e.target.value }))} style={inp} /></label>
                  )}
                  {panel.kind === "loan" && (
                    <select value={panel.patientId} onChange={e => setPanel(p => ({ ...p, patientId: e.target.value }))} style={{ ...inp, minWidth: 200 }}>
                      <option value="">Loan to patient…</option>
                      {patients.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                  <input value={panel.note} onChange={e => setPanel(p => ({ ...p, note: e.target.value }))} placeholder={panel.kind === "rfc" ? "Reason / RMA # (optional)" : "Note (optional)"} style={{ ...inp, flex: 1, minWidth: 160 }} />
                  <button disabled={busy === u.id} onClick={() => submitPanel(u)} style={btn("#0a1628", true)}>{busy === u.id ? "Saving…" : "Save"}</button>
                  <button onClick={() => { setOpenId(null); setPanel(null); }} style={btn("#6b7280")}>Cancel</button>
                </div>
              )}

              {history[u.id] && <UnitHistory events={history[u.id]} patientName={patientName} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UnitHistory({ events = [], patientName = {} }) {
  if (!events.length) return <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>No history yet.</div>;
  return (
    <div style={{ marginTop: 10, borderLeft: "2px solid #E4E0D5", paddingLeft: 12, display: "flex", flexDirection: "column", gap: 6 }}>
      {events.map(e => (
        <div key={e.id} style={{ fontSize: 12, color: "#374151" }}>
          <b>{EVENT_LABELS[e.event_type] || e.event_type}</b>
          <span style={{ color: "#9ca3af" }}> · {new Date(e.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          {e.patient_id && patientName[e.patient_id] && <span style={{ color: "#6b7280" }}> · {patientName[e.patient_id]}</span>}
          {e.event_type === "serial_updated" && <span style={{ color: "#6b7280" }}> · {e.meta?.from || "none"} → {e.meta?.to || "none"}</span>}
          {e.note && <span style={{ color: "#6b7280" }}> · “{e.note}”</span>}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", letterSpacing: 0.8, marginBottom: 3 }}>{label}</div>
      <div style={{ display: "grid" }}>{children}</div>
    </div>
  );
}

const inp = { padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "'Sora',sans-serif", background: "white", boxSizing: "border-box" };
function btn(color, solid = false) {
  return { fontSize: 12, fontWeight: 600, padding: "6px 12px", background: solid ? color : "white", color: solid ? "white" : color, border: `1px solid ${color}`, borderRadius: 6, cursor: "pointer", fontFamily: "'Sora',sans-serif", whiteSpace: "nowrap" };
}
