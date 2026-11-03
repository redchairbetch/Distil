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
import {
  confirmDeviceFitting, cancelPendingFitting,
  createDeviceUnits, transitionDeviceUnit, fitUnitsForFitting, unwindUnitsForFitting,
} from "../db.js";
import { rfcDeadline, unitMatchesSide, unitLabel, STATUS_BY_ID } from "../lib/inventory.js";
import { buildCareArc } from "../lib/careArc.js";
import { FITTING_OVERDUE_DAYS, CANCEL_REASONS } from "../lib/pendingFitting.js";

// Patients whose purchase agreement is signed but whose devices haven't been
// delivered/fit yet. Confirming the fitting here is what officially starts
// the clocks: warranty expiry, the 4-year care arc, and nurture-campaign
// enrollment all anchor to the confirmed fit date.

const DAY = 24 * 60 * 60 * 1000;

function daysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY);
}
function fmtShort(iso) {
  if (!iso) return "—";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function todayISO() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const FITTING_TYPE_LABELS = {
  bilateral: "Bilateral",
  monaural_left: "Left only",
  monaural_right: "Right only",
  cros_bicros: "CROS/BiCROS",
};

const CARE_PLAN_LABELS = {
  complete: "Complete Care+",
  punch: "Punch Card (legacy)",
  paygo: "Standard Billing",
};

function deviceSummary(p) {
  const d = p.devices || {};
  const model = [d.manufacturer, d.family, d.techLevel].filter(Boolean).join(" ");
  const type = FITTING_TYPE_LABELS[d.fittingType] || d.fittingType || "";
  return [model || "Devices TBD", type].filter(Boolean).join(" · ");
}

function carePlanLabel(p) {
  if (p.payType === "private") return "Complete Care+ (bundled)";
  return CARE_PLAN_LABELS[p.carePlan] || null;
}

// Sidebar badge count — one source of truth for what "awaiting fitting" means.
export function countPendingFittings(patients) {
  let n = 0;
  for (const p of patients || []) {
    if (p.devices?.pendingFitting) n++;
  }
  return n;
}

// Which ears a fitting needs physical units for. CROS/BiCROS is two units
// (aid + transmitter) — whichever sides are on record.
export function earsFor(p) {
  const d = p.devices || {};
  if (d.fittingType === "monaural_left") return ["left"];
  if (d.fittingType === "monaural_right") return ["right"];
  const ears = ["left", "right"].filter(e => d[e]);
  return ears.length ? ears : ["left", "right"];
}

export default function PendingFittings({ patients, staffId, clinicId, onSelectPatient, onRefresh, units = [], onRefreshUnits, manufacturerAccounts = {} }) {
  const [busyId, setBusyId] = useState(null);
  const [fitDates, setFitDates] = useState({});   // patientId -> chosen fit date
  const [notice, setNotice] = useState(null);      // { kind: 'ok'|'warn'|'error', text }
  const [cancelingId, setCancelingId] = useState(null);  // patientId with the cancel panel open
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");

  const rows = useMemo(() => {
    return (patients || [])
      .filter(p => p.devices?.pendingFitting)
      .sort((a, b) => String(a.devices?.fittingDate || "").localeCompare(String(b.devices?.fittingDate || "")));
  }, [patients]);

  const today = todayISO();

  const unitsFor = (p) => units.filter(u => p._ids?.fittingId && u.fitting_id === p._ids.fittingId);

  const handleConfirm = async (p) => {
    const fitDate = fitDates[p.id] || today;
    if (!p._ids?.fittingId) {
      setNotice({ kind: "error", text: `${p.name}: no fitting record id on the chart — refresh and try again.` });
      return;
    }
    // Soft gate: confirming without serials is allowed (devices fit from a
    // loaner, inventory not set up yet) but shouldn't happen by accident.
    const linked = unitsFor(p);
    const missing = earsFor(p).filter(e => !linked.some(u => u.ear === e && u.serial_number && ["reserved", "in_stock"].includes(u.status)));
    if (missing.length && !window.confirm(`No received device with a serial for the ${missing.join(" and ")} ear${missing.length > 1 ? "s" : ""}. Confirm the fitting anyway? (You can add serials on the chart later.)`)) return;
    setBusyId(p.id);
    setNotice(null);
    try {
      // Full care arc from the REAL fit date. The offset-0 entry is the visit
      // that just happened — mark it completed (or let the re-dated
      // placeholder absorb it via the dedupe guard).
      const arc = buildCareArc(fitDate).map(a =>
        a.date === fitDate && a.type === "Fitting & Orientation" ? { ...a, status: "completed" } : a
      );
      const res = await confirmDeviceFitting({
        fittingId: p._ids.fittingId,
        patientId: p.id,
        fitDate,
        staffId,
        clinicId,
        appointments: arc,
      });
      const inv = await fitUnitsForFitting(p._ids.fittingId, linked, { staffId, patientId: p.id });
      const warnings = [...(res.warnings || []), ...inv.warnings];
      if (onRefreshUnits) onRefreshUnits();
      if (warnings.length) {
        setNotice({
          kind: "warn",
          text: `${p.name}: fitting confirmed and warranty set through ${fmtShort(res.warrantyExpiry)}, but these didn't save — ${warnings.join("; ")}. Check the chart.`,
        });
      } else {
        setNotice({
          kind: "ok",
          text: `${p.name}: fitting confirmed for ${fmtShort(fitDate)}. Warranty runs through ${fmtShort(res.warrantyExpiry)} (${res.warrantyYears} years); care schedule and nurture campaign started.`,
        });
      }
      if (onRefresh) await onRefresh();
    } catch (e) {
      console.error("confirmDeviceFitting:", e);
      setNotice({ kind: "error", text: `${p.name}: confirming the fitting failed — ${e?.message || e}` });
    } finally {
      setBusyId(null);
    }
  };

  const openCancel = (p) => {
    setCancelingId(p.id);
    setCancelReason("");
    setCancelNote("");
    setNotice(null);
  };

  const handleCancel = async (p) => {
    if (!cancelReason) return;
    if (!p._ids?.fittingId) {
      setNotice({ kind: "error", text: `${p.name}: no fitting record id on the chart — refresh and try again.` });
      return;
    }
    setBusyId(p.id);
    setNotice(null);
    try {
      const res = await cancelPendingFitting({
        fittingId: p._ids.fittingId,
        patientId: p.id,
        reason: cancelReason,
        note: cancelNote,
        staffId,
        clinicId,
      });
      const inv = await unwindUnitsForFitting(p._ids.fittingId, unitsFor(p), { staffId, note: `Sale cancelled: ${cancelReason}` });
      if (inv.warnings.length) res.warnings = [...(res.warnings || []), ...inv.warnings];
      if (onRefreshUnits) onRefreshUnits();
      const reasonLabel = CANCEL_REASONS.find(r => r.id === cancelReason)?.label || cancelReason;
      let text = `${p.name}: sale cancelled (${reasonLabel}).`
        + (res.revertedToTns ? " Patient returned to tested-not-sold." : " Patient keeps their current devices on record.");
      if (res.warnings?.length) text += ` These didn't save — ${res.warnings.join("; ")}. Check the chart.`;
      setNotice({ kind: res.warnings?.length ? "warn" : "ok", text });
      setCancelingId(null);
      if (onRefresh) await onRefresh();
    } catch (e) {
      console.error("cancelPendingFitting:", e);
      setNotice({ kind: "error", text: `${p.name}: cancelling the sale failed — ${e?.message || e}` });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0a1628", margin: 0, fontFamily: "'Sora',sans-serif" }}>
          Pending Fittings
        </h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {rows.length} {rows.length === 1 ? "patient" : "patients"} awaiting device delivery
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Signed purchase agreements whose devices haven't been fit yet. Confirming the fitting records the
        official fit date — warranty, care schedule, and nurture campaigns all start from that date.
      </div>

      {notice && (
        <div style={{
          padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 500,
          background: notice.kind === "ok" ? "#ecfdf5" : notice.kind === "warn" ? "#fffbeb" : "#fef2f2",
          border: `1px solid ${notice.kind === "ok" ? "#a7f3d0" : notice.kind === "warn" ? "#fde68a" : "#fecaca"}`,
          color: notice.kind === "ok" ? "#065f46" : notice.kind === "warn" ? "#92400e" : "#991b1b",
        }}>
          {notice.text}
        </div>
      )}

      {rows.length === 0 && (
        <div style={{
          padding: 32, textAlign: "center", color: "#6b7280", fontSize: 14,
          background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12,
        }}>
          ✓ Queue is clear. Every signed agreement has been fit.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(p => {
          const signedAt = p.devices?.recordedAt || null;
          const waiting = daysSince(signedAt);
          const overdue = waiting != null && waiting > FITTING_OVERDUE_DAYS;
          const estDate = p.devices?.fittingDate || null;
          const planLabel = carePlanLabel(p);
          const chosenDate = fitDates[p.id] || today;
          const futureDate = chosenDate > today;
          const canceling = cancelingId === p.id;
          return (
            <div key={p.id} style={{
              padding: "14px 16px",
              background: "white", border: `1px solid ${overdue ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 10,
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0, cursor: onSelectPatient ? "pointer" : "default" }}
                onClick={() => onSelectPatient && onSelectPatient(p)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#0a1628" }}>{p.name || "—"}</span>
                  {overdue && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
                      background: "#fee2e2", color: "#dc2626", textTransform: "uppercase", letterSpacing: 0.4,
                    }}>
                      {waiting} days since signing — check order status
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                  {deviceSummary(p)}
                  {p.phone ? ` · ${p.phone}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                  Agreement signed {fmtShort(signedAt)}
                  {waiting != null ? ` (${waiting} ${waiting === 1 ? "day" : "days"} ago)` : ""}
                  {estDate ? ` · est. fitting ${fmtShort(estDate)}` : ""}
                  {planLabel ? ` · ${planLabel}` : ""}
                  {p.devices?.warrantyYears ? ` · ${p.devices.warrantyYears}-yr warranty from fit date` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div>
                  <label style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6,
                    color: "#9ca3af", display: "block", marginBottom: 3,
                  }}>Fit date</label>
                  <input type="date" value={chosenDate} max={today}
                    onChange={e => setFitDates(d => ({ ...d, [p.id]: e.target.value }))}
                    style={{
                      padding: "7px 10px", border: "1px solid #E4E0D5", borderRadius: 8,
                      fontFamily: "'Sora',sans-serif", fontSize: 13, outline: "none",
                    }} />
                </div>
                <button
                  disabled={busyId === p.id || futureDate || !chosenDate}
                  onClick={() => handleConfirm(p)}
                  title={futureDate ? "The fit date can't be in the future — confirm once the fitting has happened." : undefined}
                  style={{
                    alignSelf: "flex-end",
                    fontSize: 12, fontWeight: 700, padding: "9px 16px", marginTop: 16,
                    background: busyId === p.id || futureDate ? "#9ca3af" : "#1B8A7A",
                    color: "white", border: "none", borderRadius: 8,
                    cursor: busyId === p.id || futureDate ? "not-allowed" : "pointer",
                    fontFamily: "'Sora',sans-serif",
                  }}>
                  {busyId === p.id ? "Confirming…" : "Confirm Fitting"}
                </button>
                <button
                  disabled={busyId === p.id}
                  onClick={() => canceling ? setCancelingId(null) : openCancel(p)}
                  style={{
                    alignSelf: "flex-end",
                    fontSize: 12, fontWeight: 600, padding: "9px 12px", marginTop: 16,
                    background: "white", color: "#6b7280", border: "1px solid #e5e7eb",
                    borderRadius: 8, cursor: "pointer", fontFamily: "'Sora',sans-serif",
                  }}>
                  {canceling ? "Keep Sale" : "Cancel Sale"}
                </button>
              </div>
            </div>

            <DeviceUnitsPanel
              p={p}
              linked={unitsFor(p)}
              stock={units.filter(u => u.status === "in_stock")}
              clinicId={clinicId}
              staffId={staffId}
              manufacturerAccounts={manufacturerAccounts}
              onChanged={onRefreshUnits}
            />

            {canceling && (
              <div style={{
                marginTop: 12, paddingTop: 12, borderTop: "1px solid #f3f4f6",
                display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap",
              }}>
                <div style={{ flex: "0 0 auto" }}>
                  <label style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6,
                    color: "#9ca3af", display: "block", marginBottom: 3,
                  }}>Reason</label>
                  <select value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                    style={{
                      padding: "8px 10px", border: "1px solid #E4E0D5", borderRadius: 8,
                      fontFamily: "'Sora',sans-serif", fontSize: 13, outline: "none", background: "white",
                    }}>
                    <option value="">Select a reason…</option>
                    {CANCEL_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <label style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6,
                    color: "#9ca3af", display: "block", marginBottom: 3,
                  }}>Note (optional)</label>
                  <input value={cancelNote} onChange={e => setCancelNote(e.target.value)}
                    placeholder="Anything worth remembering about why"
                    style={{
                      width: "100%", padding: "8px 10px", border: "1px solid #E4E0D5", borderRadius: 8,
                      fontFamily: "'Sora',sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box",
                    }} />
                </div>
                <button
                  disabled={busyId === p.id || !cancelReason}
                  onClick={() => handleCancel(p)}
                  style={{
                    fontSize: 12, fontWeight: 700, padding: "9px 16px",
                    background: busyId === p.id || !cancelReason ? "#9ca3af" : "#dc2626",
                    color: "white", border: "none", borderRadius: 8,
                    cursor: busyId === p.id || !cancelReason ? "not-allowed" : "pointer",
                    fontFamily: "'Sora',sans-serif",
                  }}>
                  {busyId === p.id ? "Cancelling…" : "Cancel This Sale"}
                </button>
                <div style={{ flexBasis: "100%", fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>
                  The signed agreement stays on the chart as a record. A first-time purchaser returns to
                  tested-not-sold; an established patient keeps their current devices. A note is logged automatically.
                </div>
              </div>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Devices for this sale: order → receive (serial) → ready to fit ──────────
function DeviceUnitsPanel({ p, linked, stock, clinicId, staffId, manufacturerAccounts, onChanged }) {
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [serials, setSerials] = useState({});   // ear -> draft serial
  const [assigning, setAssigning] = useState(null); // ear with the stock picker open
  const ears = earsFor(p);
  const fittingId = p._ids?.fittingId;
  const sideFor = ear => p.devices?.[ear] ? { ...p.devices[ear], ear } : { manufacturer: p.devices?.manufacturer, family: p.devices?.family, techLevel: p.devices?.techLevel, ear };
  const sideIdFor = ear => (ear === "left" ? p._ids?.leftSideId : p._ids?.rightSideId) || null;

  const run = async (key, fn) => {
    setBusy(key); setErr(null);
    try { await fn(); if (onChanged) await onChanged(); }
    catch (e) { setErr(e?.message || "Save failed."); }
    finally { setBusy(null); }
  };

  const order = (earList) => run("order", () => createDeviceUnits(clinicId, earList.map(ear => {
    const sd = sideFor(ear);
    return {
      purpose: "patient_order", status: "on_order",
      manufacturer: sd.manufacturer || p.devices?.manufacturer || "Unknown",
      family: sd.family || null, tech_level: sd.techLevel || null, style: sd.style || null,
      color: sd.color || null, ear,
      patient_id: p.id, fitting_id: fittingId, side_id: sideIdFor(ear),
      ordered_at: todayISO(),
    };
  }), { staffId, eventType: "ordered" }));

  const receive = (u) => run(u.id, () => {
    const serial = (serials[u.ear] || "").trim();
    if (!serial) throw new Error("Enter the serial number first.");
    const recv = todayISO();
    return transitionDeviceUnit(u, "reserved", {
      eventType: "received", staffId,
      fields: { serial_number: serial, received_at: recv, rfc_deadline: rfcDeadline(recv, u.manufacturer, manufacturerAccounts) },
    });
  });

  const assign = (ear, unit) => run(unit.id, async () => {
    await transitionDeviceUnit(unit, "reserved", {
      eventType: "reserved", staffId, patientId: p.id,
      fields: { patient_id: p.id, fitting_id: fittingId, side_id: sideIdFor(ear), ear: unit.ear || ear },
    });
    setAssigning(null);
  });

  if (!fittingId) return null;
  const unordered = ears.filter(e => !linked.some(u => u.ear === e && !["retired", "returned_for_credit", "lost_damaged"].includes(u.status)));

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#9ca3af" }}>Devices</span>
        {unordered.length > 1 && (
          <button disabled={!!busy} onClick={() => order(unordered)} style={pfBtn("#1d4ed8")}>{busy === "order" ? "Ordering…" : `Order ${unordered.length === 2 ? "both" : "all"}`}</button>
        )}
        {err && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{err}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {ears.map(ear => {
          const u = linked.find(x => x.ear === ear && !["retired", "returned_for_credit", "lost_damaged"].includes(x.status));
          const st = u ? STATUS_BY_ID[u.status] : null;
          const matches = stock.filter(s => unitMatchesSide(s, sideFor(ear)));
          return (
            <div key={ear} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
              <span style={{ width: 44, fontWeight: 700, color: ear === "left" ? "#1d4ed8" : "#dc2626" }}>{ear === "left" ? "Left" : "Right"}</span>
              {!u && (
                <>
                  <span style={{ color: "#9ca3af" }}>Not ordered</span>
                  <button disabled={!!busy} onClick={() => order([ear])} style={pfBtn("#1d4ed8")}>Order</button>
                  <button disabled={!!busy} onClick={() => setAssigning(assigning === ear ? null : ear)} style={pfBtn("#0f766e")}>
                    From stock{matches.length ? ` (${matches.length} match)` : ""}
                  </button>
                  {assigning === ear && (
                    <select defaultValue="" onChange={e => { const unit = stock.find(s => s.id === e.target.value); if (unit) assign(ear, unit); }} style={pfInput}>
                      <option value="" disabled>Pick a unit…</option>
                      {matches.length > 0 && <optgroup label="Matches this fitting">{matches.map(s => <option key={s.id} value={s.id}>{unitLabel(s)}</option>)}</optgroup>}
                      <optgroup label="All in stock">{stock.filter(s => !matches.includes(s)).map(s => <option key={s.id} value={s.id}>{unitLabel(s)}</option>)}</optgroup>
                    </select>
                  )}
                </>
              )}
              {u && (
                <>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: st?.bg, color: st?.color, textTransform: "uppercase" }}>{st?.label}</span>
                  <span style={{ color: "#374151" }}>{unitLabel(u)}</span>
                  {u.status === "on_order" && (
                    <>
                      <input value={serials[ear] || ""} onChange={e => setSerials(s => ({ ...s, [ear]: e.target.value }))} placeholder="Serial on arrival" style={pfInput} />
                      <button disabled={busy === u.id} onClick={() => receive(u)} style={pfBtn("#7c3aed")}>{busy === u.id ? "Saving…" : "Receive"}</button>
                    </>
                  )}
                  {u.status === "reserved" && <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ Ready to fit</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const pfInput = { padding: "5px 8px", border: "1px solid #E4E0D5", borderRadius: 6, fontFamily: "'Sora',sans-serif", fontSize: 12, outline: "none", background: "white" };
function pfBtn(color) {
  return { fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "white", color, border: `1px solid ${color}`, borderRadius: 6, cursor: "pointer", fontFamily: "'Sora',sans-serif" };
}
