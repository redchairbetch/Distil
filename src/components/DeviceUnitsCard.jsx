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

// After-fit device lifecycle on the chart (backlog #44, phase 5). Lists the
// physical units tied to this patient and runs the moves that happen after
// the fitting: repair (with an optional loaner), return for credit during the
// adaptation period, loss & damage claim with a replacement unit, and a
// serial swap when the manufacturer sends back a different device. Serial
// changes on a fitted unit are mirrored to device_fittings so the chart and
// manufacturer forms stay in step.

import React, { useState } from "react";
import {
  createDeviceUnits, transitionDeviceUnit, updateDeviceUnit, updateDeviceFitting, listUnitEvents,
} from "../db.js";
import { STATUS_BY_ID, TERMINAL, unitLabel } from "../lib/inventory.js";
import { UnitHistory } from "../views/Inventory.jsx";

const todayYmd = () => {
  const d = new Date(); const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function DeviceUnitsCard({ patient, units = [], allUnits = [], clinicId, staffId, onChanged }) {
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [panel, setPanel] = useState(null); // { unitId, kind, serial, note, loanerId }
  const [history, setHistory] = useState({});
  const [showClosed, setShowClosed] = useState(false);

  const p = patient;
  const fittingId = p._ids?.fittingId || null;
  const live = units.filter(u => !TERMINAL.has(u.status));
  const closed = units.filter(u => TERMINAL.has(u.status));
  const loanersOut = units.filter(u => u.status === "loaned_out");
  const shelfLoaners = allUnits.filter(u => u.status === "in_stock" && (u.purpose === "loaner" || u.purpose === "demo"));

  // Patient has aids on the chart but none tracked as units (pre-inventory
  // fit, or a legacy fit) — offer to start tracking them.
  const untracked = !!p.devices && p.devices.fittingStatus === "fitted" && fittingId
    && !units.some(u => u.fitting_id === fittingId);

  const run = async (key, fn) => {
    setBusy(key); setErr(null);
    try { await fn(); setPanel(null); if (onChanged) await onChanged(); }
    catch (e) { setErr(e?.message || "Save failed."); }
    finally { setBusy(null); }
  };

  const mirrorSerial = async (u, serial) => {
    if (u.status === "fitted" && u.fitting_id && u.ear) {
      await updateDeviceFitting(u.fitting_id, { [u.ear === "left" ? "serial_left" : "serial_right"]: serial || null });
    }
  };

  const startTracking = () => run("track", async () => {
    const d = p.devices;
    const ears = d.fittingType === "monaural_left" ? ["left"] : d.fittingType === "monaural_right" ? ["right"] : ["left", "right"].filter(e => d[e] || d.fittingType === "bilateral");
    await createDeviceUnits(clinicId, ears.map(ear => {
      const sd = d[ear] || {};
      return {
        purpose: "patient_order", status: "fitted",
        manufacturer: sd.manufacturer || d.manufacturer || "Unknown",
        family: sd.family || d.family || null, tech_level: sd.techLevel || d.techLevel || null,
        style: sd.style || d.style || null, color: sd.color || null, ear,
        serial_number: (ear === "left" ? d.serialLeft : d.serialRight) || null,
        patient_id: p.id, fitting_id: fittingId,
        side_id: (ear === "left" ? p._ids?.leftSideId : p._ids?.rightSideId) || null,
      };
    }), { staffId, eventType: "fitted", note: "Tracking started from the chart" });
  });

  const submit = (u) => {
    const pn = panel;
    if (pn.kind === "repair") return run(u.id, async () => {
      await transitionDeviceUnit(u, "in_repair", { eventType: "repair_sent", staffId, note: pn.note || null });
      if (pn.loanerId) {
        const loaner = allUnits.find(x => x.id === pn.loanerId);
        if (loaner) await transitionDeviceUnit(loaner, "loaned_out", { eventType: "loaned", staffId, patientId: p.id, note: `Loaner while ${unitLabel(u)} is in repair`, fields: { patient_id: p.id } });
      }
    });
    if (pn.kind === "rfc") return run(u.id, () =>
      transitionDeviceUnit(u, "rfc_pending", { eventType: "rfc_started", staffId, note: pn.note || "Returned during adaptation period" }));
    if (pn.kind === "ld") return run(u.id, async () => {
      await transitionDeviceUnit(u, "lost_damaged", { eventType: "ld_claim", staffId, note: pn.note || null });
      const [rep] = await createDeviceUnits(clinicId, [{
        purpose: "patient_order", status: "on_order",
        manufacturer: u.manufacturer, family: u.family, model: u.model, tech_level: u.tech_level,
        style: u.style, color: u.color, ear: u.ear, product_catalog_id: u.product_catalog_id,
        patient_id: p.id, fitting_id: u.fitting_id, side_id: u.side_id,
        ordered_at: todayYmd(), ld_claims_used: (u.ld_claims_used || 0) + 1,
      }], { staffId, eventType: "ordered", note: `L&D replacement for ${u.serial_number || "unit"}` });
      if (rep) await updateDeviceUnit(u, { replaced_by: rep.id }, { staffId });
    });
    if (pn.kind === "swap") return run(u.id, async () => {
      const serial = pn.serial.trim();
      if (!serial) throw new Error("Enter the new serial number.");
      await updateDeviceUnit(u, { serial_number: serial }, { staffId, note: pn.note || "Manufacturer replaced the device" });
      await mirrorSerial(u, serial);
    });
    if (pn.kind === "receive") return run(u.id, async () => {
      const serial = pn.serial.trim();
      if (!serial) throw new Error("Enter the serial number.");
      // An L&D replacement arrives straight onto the patient's ears.
      const r1 = await transitionDeviceUnit(u, "reserved", { eventType: "received", staffId, fields: { serial_number: serial, received_at: todayYmd() } });
      const r2 = await transitionDeviceUnit(r1, "fitted", { eventType: "fitted", staffId, patientId: p.id });
      await mirrorSerial(r2, serial);
    });
  };

  const backFromRepair = (u) => run(u.id, async () => {
    await transitionDeviceUnit(u, "fitted", { eventType: "repair_returned", staffId });
    if (loanersOut.length && window.confirm(`Return the loaner${loanersOut.length > 1 ? "s" : ""} (${loanersOut.map(l => l.serial_number || "no serial").join(", ")}) to stock now?`)) {
      for (const l of loanersOut) await transitionDeviceUnit(l, "in_stock", { eventType: "loaner_returned", staffId, fields: { patient_id: null } });
    }
  });

  const toggleHistory = async (u) => {
    if (history[u.id]) { setHistory(h => { const n = { ...h }; delete n[u.id]; return n; }); return; }
    setHistory(h => ({ ...h, [u.id]: [] }));
    const ev = await listUnitEvents([u.id]);
    setHistory(h => ({ ...h, [u.id]: ev }));
  };

  if (!units.length && !untracked) return null;

  const open = (u, kind) => { setPanel({ unitId: u.id, kind, serial: "", note: "", loanerId: "" }); setErr(null); };
  const actions = (u) => {
    const a = [];
    if (u.status === "fitted") {
      a.push(["Send for repair", () => open(u, "repair")]);
      a.push(["Swap serial", () => open(u, "swap")]);
      a.push(["Loss & damage", () => open(u, "ld")]);
      a.push(["Return for credit", () => open(u, "rfc")]);
    }
    if (u.status === "in_repair") {
      a.push(["Back from repair", () => backFromRepair(u)]);
      a.push(["Swap serial", () => open(u, "swap")]);
    }
    if (u.status === "on_order") a.push(["Receive & fit", () => open(u, "receive")]);
    if (u.status === "loaned_out") a.push(["Loaner returned", () => run(u.id, () => transitionDeviceUnit(u, "in_stock", { eventType: "loaner_returned", staffId, fields: { patient_id: null } }))]);
    return a;
  };

  const row = (u) => {
    const st = STATUS_BY_ID[u.status];
    return (
      <div key={u.id} style={{ padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: st?.bg, color: st?.color, textTransform: "uppercase" }}>{st?.label}</span>
          <span style={{ color: "#0a1628", fontWeight: 600 }}>{unitLabel(u)}</span>
          {u.purpose === "loaner" && <span style={{ color: "#9333ea", fontWeight: 600 }}>Loaner</span>}
          {u.ld_claims_used > 0 && <span style={{ color: "#991b1b" }}>L&D claim #{u.ld_claims_used}</span>}
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
            {actions(u).map(([label, fn]) => <button key={label} disabled={busy === u.id} onClick={fn} style={btn}>{label}</button>)}
            <button onClick={() => toggleHistory(u)} style={{ ...btn, color: "#6b7280" }}>{history[u.id] ? "Hide" : "History"}</button>
          </span>
        </div>
        {panel?.unitId === u.id && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {(panel.kind === "swap" || panel.kind === "receive") && (
              <input autoFocus value={panel.serial} onChange={e => setPanel(x => ({ ...x, serial: e.target.value }))} placeholder="New serial number" style={inp} />
            )}
            {panel.kind === "repair" && (
              <select value={panel.loanerId} onChange={e => setPanel(x => ({ ...x, loanerId: e.target.value }))} style={inp}>
                <option value="">No loaner</option>
                {shelfLoaners.map(l => <option key={l.id} value={l.id}>Loaner: {unitLabel(l)}</option>)}
              </select>
            )}
            <input value={panel.note} onChange={e => setPanel(x => ({ ...x, note: e.target.value }))}
              placeholder={panel.kind === "repair" ? "Problem / RMA # (optional)" : panel.kind === "ld" ? "What happened (optional)" : "Note (optional)"}
              style={{ ...inp, flex: 1, minWidth: 160 }} />
            <button disabled={busy === u.id} onClick={() => submit(u)} style={{ ...btn, background: "#0a1628", color: "white", borderColor: "#0a1628" }}>
              {busy === u.id ? "Saving…" : panel.kind === "ld" ? "File claim & order replacement" : "Save"}
            </button>
            <button onClick={() => setPanel(null)} style={{ ...btn, color: "#6b7280" }}>Cancel</button>
          </div>
        )}
        {history[u.id] && <UnitHistory events={history[u.id]} />}
      </div>
    );
  };

  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #E4E0D5" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#9ca3af" }}>Devices in inventory</span>
        {err && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{err}</span>}
        {closed.length > 0 && (
          <button onClick={() => setShowClosed(s => !s)} style={{ ...btn, marginLeft: "auto", color: "#6b7280" }}>
            {showClosed ? "Hide" : "Show"} {closed.length} closed
          </button>
        )}
      </div>
      {untracked && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6b7280", padding: "6px 0" }}>
          These aids aren't tracked as inventory units yet — start tracking to log repairs, loaners and claims against their serials.
          <button disabled={busy === "track"} onClick={startTracking} style={{ ...btn, marginLeft: "auto" }}>{busy === "track" ? "Adding…" : "Start tracking"}</button>
        </div>
      )}
      {live.map(row)}
      {showClosed && closed.map(row)}
    </div>
  );
}

const inp = { padding: "5px 8px", border: "1px solid #E4E0D5", borderRadius: 6, fontFamily: "'Sora',sans-serif", fontSize: 12, outline: "none", background: "white" };
const btn = { fontSize: 11, fontWeight: 600, padding: "3px 9px", background: "white", color: "#0a1628", border: "1px solid #E4E0D5", borderRadius: 6, cursor: "pointer", fontFamily: "'Sora',sans-serif" };
