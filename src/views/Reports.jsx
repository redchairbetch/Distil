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

import React, { useEffect, useMemo, useState } from "react";
import { loadAppointmentOutcomes, loadFittingTypesForVisits, loadPriceAdjustmentHistory } from "../db.js";
import {
  computeReportStats, computeAdjustmentStats, computeFollowUpStats,
  selectOutcomeDrill, selectFollowUpDrill, selectAdjustmentDrill,
  toCsv,
} from "../lib/reportStats.js";
import { BUCKETS, classify } from "./FollowUpQueue.jsx";
import { ADJUST_REASON_CODES } from "./AdjustPriceModal.jsx";

// Reports v1 (sprint PR 4). Reads what the app already records — every metric
// here derives from appointment_outcomes payer SNAPSHOTS (never the live
// patient record), so a later insurance change can't rewrite July's numbers.
// Headline: TPA care-plan attach rate + device close rate / revenue lift.
//
// v2 (this branch): every stat is selectable. Clicking a card, bar, or number
// opens a detail page listing the exact patients/transactions behind it — a
// pure client-side filter of the rows already loaded (no refetch), so a detail
// page can never disagree with the card it came from.

const RANGES = [
  { key: "month",   label: "This month" },
  { key: "30d",     label: "Last 30 days" },
  { key: "quarter", label: "This quarter" },
  { key: "ytd",     label: "Year to date" },
  { key: "all",     label: "All time" },
];
const RANGE_LABELS = Object.fromEntries(RANGES.map(r => [r.key, r.label]));

function rangeToFrom(key) {
  const now = new Date();
  if (key === "month")   return new Date(now.getFullYear(), now.getMonth(), 1);
  if (key === "30d")     return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  if (key === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (key === "ytd")     return new Date(now.getFullYear(), 0, 1);
  return null; // all time
}

const DISPOSITION_LABELS = {
  committed: "Committed", deferred: "Deferred", declined: "Declined",
  no_decision: "No decision", not_a_candidate: "Not a candidate", not_applicable: "N/A",
};
const DISPOSITION_COLORS = {
  committed: "#0d9488", deferred: "#b45309", declined: "#dc2626",
  no_decision: "#6b7280", not_a_candidate: "#7c3aed", not_applicable: "#9ca3af",
};
const REASON_LABELS = {
  price_budget: "Price / budget",
  spouse_family_consult: "Spouse or family consult",
  wants_to_think: "Wants to think it over",
  no_perceived_need: "No perceived need",
  shopping_second_opinion: "Shopping / second opinion",
  insurance_benefit_issue: "Insurance benefit issue",
  health_life_circumstances: "Health / life circumstances",
  satisfied_with_current_devices: "Satisfied with current devices",
};
const CONTEXT_LABELS = { new_fit: "New fittings", upgrade: "Upgrades", care_plan_only: "Care-plan only" };
const CONTEXT_LABELS_SHORT = { new_fit: "New fit", upgrade: "Upgrade", care_plan_only: "Care plan" };
const PAYER_LABELS = { tpa: "TPA", direct_purchase: "Direct Purchase", other_insurance: "Other insurance", private_pay: "Private pay" };
const CARE_PLAN_LABELS = { complete: "Complete Care+", punch: "MHC Punch Card", paygo: "Standard Billing" };
const ADJ_REASON_LABELS = Object.fromEntries(ADJUST_REASON_CODES.map(r => [r.code, r.label]));

const BUCKET_LABELS = Object.fromEntries(BUCKETS.map(b => [b.key, b.label]));
const BUCKET_COLORS = Object.fromEntries(BUCKETS.map(b => [b.key, b.color]));
const BUCKET_BLURBS = Object.fromEntries(BUCKETS.map(b => [b.key, b.blurb]));

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = (n) => (n == null || Number.isNaN(Number(n)) ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = (r) => (r == null ? "—" : `${Math.round(r * 100)}%`);
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function displayName(name, id) {
  return name || (id ? `Patient ${String(id).slice(0, 8).toUpperCase()}` : "");
}

// ── CSV export ──────────────────────────────────────────────────────────
function downloadText(filename, text) {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" }); // BOM so Excel reads UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "report";
}

// Build the CSV text for a detail selection. Dollars are raw numbers (not
// formatted) so they're spreadsheet-ready; labels match the on-screen tables.
function buildCsv(shape, rows, { patientName } = {}) {
  if (shape === "transactions") {
    const headers = ["Patient", "Closed", "Context", "Device outcome", "Device reason", "Care plan", "Payer", "Payer name", "Tier", "Device revenue", "Care plan revenue", "Total revenue", "Bilateral assumed"];
    const records = rows.map(r => [
      displayName(r.patientName, r.patientId),
      fmtDate(r.closedAt),
      CONTEXT_LABELS_SHORT[r.context] || r.context || "",
      DISPOSITION_LABELS[r.deviceDisposition] || r.deviceDisposition || "",
      r.deviceReason ? (REASON_LABELS[r.deviceReason] || r.deviceReason) : "",
      r.carePlanDisposition === "committed"
        ? (CARE_PLAN_LABELS[r.carePlanSelected] || r.carePlanSelected || "Committed")
        : (DISPOSITION_LABELS[r.carePlanDisposition] || r.carePlanDisposition || ""),
      PAYER_LABELS[r.payerType] || r.payerType || "",
      r.payerName || "",
      r.tier || "",
      r.deviceRevenue || 0,
      r.carePlanRevenue || 0,
      r.revenue || 0,
      r.aidsEstimated ? "yes" : "",
    ]);
    return toCsv(headers, records);
  }
  if (shape === "patients") {
    const headers = ["Patient", "Bucket", "Warranty expiry", "Fitting date", "Last visit", "Contacted", "Outcome logged", "Committed"];
    const records = rows.map(r => [
      displayName(r.name, r.id),
      r.bucket ? (BUCKET_LABELS[r.bucket] || r.bucket) : "",
      fmtDate(r.warrantyExpiry), fmtDate(r.fittingDate), fmtDate(r.lastVisitDate), fmtDate(r.contactedAt),
      r.withOutcome ? "yes" : "", r.committed ? "yes" : "",
    ]);
    return toCsv(headers, records);
  }
  // adjustments
  const headers = ["When", "Patient", "Reason", "Note", "Original", "Adjusted", "Change"];
  const records = rows.map(r => {
    const orig = r.original_price != null ? Number(r.original_price) : null;
    const adj = r.adjusted_price != null ? Number(r.adjusted_price) : null;
    const amount = r.delta_amount != null ? Number(r.delta_amount) : (orig != null && adj != null ? adj - orig : null);
    const ts = r.created_at || r.timestamp || r.logged_at || r.inserted_at || null;
    return [
      fmtDate(ts),
      (patientName && patientName(r.patient_id)) || displayName(null, r.patient_id),
      ADJ_REASON_LABELS[r.reason_code] || r.reason_code || "",
      r.reason_text || "",
      orig == null ? "" : orig, adj == null ? "" : adj, amount == null ? "" : amount,
    ];
  });
  return toCsv(headers, records);
}

// ── Clickable primitives ────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = "#0d9488", onClick }) {
  const [hover, setHover] = useState(false);
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{
        flex: "1 1 180px", background: "#fff",
        border: `1px solid ${clickable && hover ? accent : "#e5e7eb"}`,
        borderRadius: 12, padding: "18px 20px",
        cursor: clickable ? "pointer" : "default",
        boxShadow: clickable && hover ? "0 2px 10px rgba(15,23,42,0.08)" : "none",
        transition: "border-color 120ms ease, box-shadow 120ms ease",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{sub}</div>}
      {clickable && (
        <div style={{ fontSize: 11, fontWeight: 700, color: hover ? accent : "#9ca3af", marginTop: 8, transition: "color 120ms ease" }}>
          View patients →
        </div>
      )}
    </div>
  );
}

// One horizontal bar row — clickable when onSelect is supplied.
function BarRow({ label, n, max, color, total, onSelect }) {
  const [hover, setHover] = useState(false);
  const clickable = !!onSelect;
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } } : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        cursor: clickable ? "pointer" : "default",
        background: clickable && hover ? "#f9fafb" : "transparent",
        borderRadius: 6, padding: "2px 4px", margin: "0 -4px",
      }}
    >
      <div style={{ width: 200, fontSize: 13, color: clickable && hover ? "#111827" : "#374151", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 6, height: 18, position: "relative" }}>
        <div style={{ width: `${(n / max) * 100}%`, minWidth: 4, height: "100%", borderRadius: 6, background: color || "#0d9488", opacity: 0.85 }} />
      </div>
      <div style={{ width: 70, fontSize: 13, fontWeight: 700, color: "#111827", textAlign: "right", flexShrink: 0 }}>
        {n}{total ? <span style={{ color: "#9ca3af", fontWeight: 500 }}> · {Math.round((n / total) * 100)}%</span> : null}
      </div>
    </div>
  );
}

// Horizontal count bars for a {key: count} map. Sorted descending. onSelect(key)
// makes each bar drill into its slice.
function BarList({ counts, labels = {}, colors = {}, total, onSelect }) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <div style={{ fontSize: 13, color: "#9ca3af" }}>Nothing in this range.</div>;
  const max = Math.max(...entries.map(([, n]) => n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map(([key, n]) => (
        <BarRow key={key} label={labels[key] || key} n={n} max={max} color={colors[key]} total={total}
          onSelect={onSelect ? () => onSelect(key) : undefined} />
      ))}
    </div>
  );
}

function Section({ title, blurb, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: blurb ? 2 : 14 }}>{title}</div>
      {blurb && <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>{blurb}</div>}
      {children}
    </div>
  );
}

// A number in the follow-up / adjustment "at a glance" strips, made clickable.
function StatNumber({ value, label, color = "#111827", onClick }) {
  const [hover, setHover] = useState(false);
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{
        cursor: clickable ? "pointer" : "default",
        borderBottom: clickable ? `2px solid ${hover ? color : "transparent"}` : "none",
        transition: "border-color 120ms ease",
      }}
    >
      <strong style={{ fontSize: 18, color }}>{value}</strong> {label}
    </div>
  );
}

// ── Drill descriptor ────────────────────────────────────────────────────
// Turns a drill {source, kind, value} into its title/blurb/table-shape using
// the same label maps the dashboard uses.
function describe(drill) {
  const { source, kind, value } = drill;
  if (source === "followup") {
    if (kind === "followup_bucket")     return { title: BUCKET_LABELS[value] || value, blurb: BUCKET_BLURBS[value] || "Patients in this follow-up bucket.", shape: "patients" };
    if (kind === "followup_contacted")  return { title: "Patients contacted", blurb: "Follow-up patients you logged a contact for in this range.", shape: "patients" };
    if (kind === "followup_withOutcome")return { title: "Contacted → reached an outcome", blurb: "Contacted patients whose chart logged an outcome after the contact.", shape: "patients" };
    if (kind === "followup_committed")  return { title: "Contacted → committed", blurb: "Contacted patients who committed to devices after the contact.", shape: "patients" };
  }
  if (source === "adjustments") {
    if (kind === "adjust_reason") return { title: `${ADJ_REASON_LABELS[value] || value} adjustments`, blurb: "Your price adjustments logged for this reason in range.", shape: "adjustments" };
    return { title: "Your price adjustments", blurb: "Every price adjustment you logged in this range.", shape: "adjustments" };
  }
  // outcomes
  const shape = "transactions";
  switch (kind) {
    case "all":                return { title: "All outcomes logged", blurb: "Every disposition recorded in this range.", shape };
    case "close_rate":         return { title: "Device close rate", blurb: "Decidable outcomes — committed, deferred, declined, no-decision. Committed counts as a close.", shape };
    case "committed":          return { title: "Committed device outcomes", blurb: "Patients who committed to devices in this range.", shape };
    case "revenue":            return { title: "Committed revenue", blurb: "Committed outcomes with a priced payer snapshot.", shape };
    case "tpa_attach":         return { title: "TPA care-plan attach", blurb: "TPA device commits where a care plan was in play. Attach = care plan committed.", shape };
    case "device_disposition": return { title: `${DISPOSITION_LABELS[value] || value} outcomes`, blurb: "Outcomes with this device disposition.", shape };
    case "device_reason":      return { title: `Deferred / declined — ${REASON_LABELS[value] || value}`, blurb: "Device outcomes recorded with this reason.", shape };
    case "careplan_payer":     return { title: `${PAYER_LABELS[value] || value} — care-plan attach`, blurb: "Committed device commits for this payer where a care plan was in play.", shape };
    case "careplan_selected":  return { title: `${CARE_PLAN_LABELS[value] || value} selected`, blurb: "Patients who committed to this care plan.", shape };
    case "tier":               return { title: `${value} tier — commits`, blurb: "Committed outcomes at this tier (from the payer snapshot).", shape };
    default:                   return { title: "Details", blurb: "", shape };
  }
}

// ── Detail tables ───────────────────────────────────────────────────────
const th = { textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", padding: "10px 12px", whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb" };
const td = { fontSize: 13, color: "#374151", padding: "11px 12px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", verticalAlign: "top" };

function Pill({ children, color, bg }) {
  return <span style={{ display: "inline-block", background: bg, color, borderRadius: 6, padding: "2px 8px", fontSize: 11.5, fontWeight: 600 }}>{children}</span>;
}

function PatientCell({ name, id, clinicName, onOpen }) {
  const openable = !!onOpen;
  return (
    <div
      onClick={openable ? onOpen : undefined}
      role={openable ? "button" : undefined}
      tabIndex={openable ? 0 : undefined}
      onKeyDown={openable ? (e) => { if (e.key === "Enter") { e.preventDefault(); onOpen(); } } : undefined}
      style={{ cursor: openable ? "pointer" : "default", color: openable ? "#0f766e" : "#111827", fontWeight: 600, textDecoration: openable ? "underline" : "none", textUnderlineOffset: 2 }}
    >
      {name || (id ? `Patient ${String(id).slice(0, 8).toUpperCase()}` : "—")}
      {clinicName && <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, textDecoration: "none" }}>{clinicName}</div>}
    </div>
  );
}

function TransactionsTable({ rows, scope, onOpenPatient, patientOpenable }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 860 }}>
        <thead>
          <tr>
            <th style={th}>Patient</th>
            <th style={th}>Closed</th>
            <th style={th}>Context</th>
            <th style={th}>Device</th>
            <th style={th}>Care plan</th>
            <th style={th}>Payer</th>
            <th style={th}>Tier</th>
            <th style={{ ...th, textAlign: "right" }}>Revenue</th>
            <th style={th}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const carePlan = r.carePlanDisposition === "committed"
              ? (CARE_PLAN_LABELS[r.carePlanSelected] || r.carePlanSelected || "Committed")
              : (DISPOSITION_LABELS[r.carePlanDisposition] || r.carePlanDisposition || "—");
            const reason = r.deviceReason ? REASON_LABELS[r.deviceReason]
              : r.carePlanReason ? `Care plan: ${REASON_LABELS[r.carePlanReason]}` : "—";
            return (
              <tr key={r.id}>
                <td style={td}>
                  <PatientCell name={r.patientName} id={r.patientId} clinicName={scope === "org" ? r.clinicName : null}
                    onOpen={onOpenPatient && patientOpenable?.(r.patientId) ? () => onOpenPatient(r.patientId) : undefined} />
                </td>
                <td style={{ ...td, color: "#6b7280" }}>{fmtDate(r.closedAt)}</td>
                <td style={td}>{CONTEXT_LABELS_SHORT[r.context] || r.context}</td>
                <td style={td}>
                  <Pill color="#fff" bg={DISPOSITION_COLORS[r.deviceDisposition] || "#6b7280"}>{DISPOSITION_LABELS[r.deviceDisposition] || r.deviceDisposition}</Pill>
                </td>
                <td style={td}>{carePlan}</td>
                <td style={td}>
                  {PAYER_LABELS[r.payerType] || r.payerType}
                  {r.payerName && <span style={{ color: "#9ca3af" }}> · {r.payerName}</span>}
                </td>
                <td style={td}>{r.tier || "—"}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#111827" }}>
                  {r.revenue > 0 ? usd.format(r.revenue) : "—"}
                  {r.aidsEstimated && <span title="Bilateral assumed — no fitting linked" style={{ color: "#b45309", fontWeight: 500 }}> *</span>}
                  {r.carePlanRevenue > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed" }}>incl. {usd.format(r.carePlanRevenue)} care plan</div>
                  )}
                </td>
                <td style={{ ...td, whiteSpace: "normal", minWidth: 150 }}>{reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PatientsTable({ rows, onOpenPatient, patientOpenable }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
        <thead>
          <tr>
            <th style={th}>Patient</th>
            <th style={th}>Bucket</th>
            <th style={th}>Warranty</th>
            <th style={th}>Fitting</th>
            <th style={th}>Last visit</th>
            <th style={th}>Contacted</th>
            <th style={th}>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={td}>
                <PatientCell name={r.name} id={r.id} onOpen={onOpenPatient && patientOpenable?.(r.id) ? () => onOpenPatient(r.id) : undefined} />
              </td>
              <td style={td}>{r.bucket ? <Pill color={BUCKET_COLORS[r.bucket] || "#374151"} bg="#f3f4f6">{BUCKET_LABELS[r.bucket] || r.bucket}</Pill> : "—"}</td>
              <td style={{ ...td, color: "#6b7280" }}>{fmtDate(r.warrantyExpiry)}</td>
              <td style={{ ...td, color: "#6b7280" }}>{fmtDate(r.fittingDate)}</td>
              <td style={{ ...td, color: "#6b7280" }}>{fmtDate(r.lastVisitDate)}</td>
              <td style={{ ...td, color: "#6b7280" }}>{fmtDate(r.contactedAt)}</td>
              <td style={td}>
                {r.committed ? <Pill color="#fff" bg="#0d9488">Committed</Pill>
                  : r.withOutcome ? <Pill color="#374151" bg="#f3f4f6">Outcome logged</Pill>
                  : <span style={{ color: "#9ca3af" }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdjustmentsTable({ rows, patientName, onOpenPatient, patientOpenable }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
        <thead>
          <tr>
            <th style={th}>When</th>
            <th style={th}>Patient</th>
            <th style={th}>Reason</th>
            <th style={{ ...th, textAlign: "right" }}>Original</th>
            <th style={{ ...th, textAlign: "right" }}>Adjusted</th>
            <th style={{ ...th, textAlign: "right" }}>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const orig = r.original_price != null ? Number(r.original_price) : null;
            const adj = r.adjusted_price != null ? Number(r.adjusted_price) : null;
            const amount = r.delta_amount != null ? Number(r.delta_amount) : (orig != null && adj != null ? adj - orig : null);
            const isDiscount = amount != null && amount < 0;
            const ts = r.created_at || r.timestamp || r.logged_at || r.inserted_at || null;
            const name = patientName ? patientName(r.patient_id) : null;
            return (
              <tr key={r.id}>
                <td style={{ ...td, color: "#6b7280" }}>{fmtDate(ts)}</td>
                <td style={td}>
                  <PatientCell name={name} id={r.patient_id}
                    onOpen={onOpenPatient && patientOpenable?.(r.patient_id) ? () => onOpenPatient(r.patient_id) : undefined} />
                </td>
                <td style={td}>
                  <Pill color="#0f766e" bg="#f0fdfa">{ADJ_REASON_LABELS[r.reason_code] || r.reason_code || "—"}</Pill>
                  {r.reason_text && <div style={{ marginTop: 4, fontSize: 11.5, color: "#9ca3af", fontStyle: "italic", whiteSpace: "normal", maxWidth: 260 }}>{r.reason_text}</div>}
                </td>
                <td style={{ ...td, textAlign: "right", color: "#6b7280" }}>{usd2(orig)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{usd2(adj)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700, color: isDiscount ? "#0d9488" : "#dc2626" }}>
                  {amount == null ? "—" : `${amount < 0 ? "−" : "+"}${usd2(Math.abs(amount)).slice(1)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Detail page ─────────────────────────────────────────────────────────
function metricChips(drill, sel) {
  const { source, kind } = drill;
  if (source === "outcomes") {
    if (kind === "close_rate")  return [["Committed", sel.committed], ["Decidable", sel.count], ["Close rate", pct(sel.rate)]];
    if (kind === "tpa_attach" || kind === "careplan_payer")
      return [["Attached", sel.attached], ["Candidates", sel.count], ["Attach rate", pct(sel.count ? sel.attached / sel.count : null)]];
    if (kind === "revenue") {
      const device = sel.rows.reduce((s, r) => s + (r.deviceRevenue || 0), 0);
      const care = sel.rows.reduce((s, r) => s + (r.carePlanRevenue || 0), 0);
      return [["Total revenue", usd.format(sel.revenue)], ["Devices", usd.format(device)], ["Care plans", usd.format(care)], ["Revenue lines", sel.count]];
    }
    const chips = [["Outcomes", sel.count]];
    if (sel.committed) chips.push(["Committed", sel.committed]);
    if (sel.revenue)   chips.push(["Revenue", usd.format(sel.revenue)]);
    return chips;
  }
  if (source === "followup") {
    const chips = [["Patients", sel.count]];
    const committed = sel.rows.filter(r => r.committed).length;
    if (kind !== "followup_committed" && committed) chips.push(["Committed", committed]);
    return chips;
  }
  // adjustments
  const totalDiscount = sel.rows.reduce((s, r) => {
    const orig = r.original_price != null ? Number(r.original_price) : null;
    const adj = r.adjusted_price != null ? Number(r.adjusted_price) : null;
    const amount = r.delta_amount != null ? Number(r.delta_amount) : (orig != null && adj != null ? adj - orig : 0);
    return s + (amount < 0 ? -amount : 0);
  }, 0);
  return [["Adjustments", sel.count], ["Discounted", usd.format(totalDiscount)]];
}

function ReportDetail({ drill, selection, rangeLabel, scopeLabel, scope, onBack, onOpenPatient, patientOpenable, patientName }) {
  const { title, blurb, shape } = describe(drill);
  const chips = metricChips(drill, selection);
  const [exportHover, setExportHover] = useState(false);

  const exportCsv = () => {
    const text = buildCsv(shape, selection.rows, { patientName });
    downloadText(`${slug(title)}_${slug(rangeLabel)}_${slug(scopeLabel)}.csv`, text);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1060, margin: "0 auto", width: "100%" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <button onClick={onBack}
            style={{ background: "none", border: "none", color: "#0f766e", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            ← Back to Reports
          </button>
          <button onClick={exportCsv} disabled={selection.count === 0}
            onMouseEnter={() => setExportHover(true)} onMouseLeave={() => setExportHover(false)}
            title={selection.count === 0 ? "Nothing to export" : "Download these rows as a CSV"}
            style={{
              marginLeft: "auto", padding: "7px 14px", fontSize: 13, fontWeight: 700, borderRadius: 8,
              border: `1px solid ${selection.count === 0 ? "#e5e7eb" : "#0d9488"}`,
              background: selection.count === 0 ? "#f9fafb" : (exportHover ? "#0d9488" : "#f0fdfa"),
              color: selection.count === 0 ? "#9ca3af" : (exportHover ? "#fff" : "#0f766e"),
              cursor: selection.count === 0 ? "not-allowed" : "pointer",
              transition: "background 120ms ease, color 120ms ease",
            }}>
            ↓ Export CSV
          </button>
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>{title}</h2>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{blurb}</div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{rangeLabel} · {scopeLabel} · {selection.count} {selection.count === 1 ? "record" : "records"}</div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {chips.map(([label, value]) => (
          <div key={label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 18px", minWidth: 120 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      {selection.count === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #d1d5db", borderRadius: 12, padding: "32px 24px", textAlign: "center", fontSize: 14, color: "#9ca3af" }}>
          No records behind this number in the current range and scope.
        </div>
      ) : shape === "transactions" ? (
        <TransactionsTable rows={selection.rows} scope={scope} onOpenPatient={onOpenPatient} patientOpenable={patientOpenable} />
      ) : shape === "patients" ? (
        <PatientsTable rows={selection.rows} onOpenPatient={onOpenPatient} patientOpenable={patientOpenable} />
      ) : (
        <AdjustmentsTable rows={selection.rows} patientName={patientName} onOpenPatient={onOpenPatient} patientOpenable={patientOpenable} />
      )}

      {shape === "transactions" && selection.rows.some(r => r.aidsEstimated) && (
        <div style={{ fontSize: 11.5, color: "#9ca3af" }}>* Revenue assumes a bilateral fitting — no device fitting was linked to this outcome.</div>
      )}
    </div>
  );
}

export default function Reports({ clinicId, clinicName, staffId, patients = [], onSelectPatient }) {
  const [range, setRange] = useState("month");
  const [scope, setScope] = useState("clinic"); // 'clinic' | 'org'
  const [outcomes, setOutcomes] = useState(null);
  const [fittingTypes, setFittingTypes] = useState({});
  const [adjustments, setAdjustments] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState(null); // { source, kind, value } or null

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const from = rangeToFrom(range);
        const rows = await loadAppointmentOutcomes({
          clinicId: scope === "clinic" ? clinicId : null,
          from: from ? from.toISOString() : null,
        });
        const ftMap = await loadFittingTypesForVisits(rows.map(r => r.visit_id));
        if (cancelled) return;
        setOutcomes(rows);
        setFittingTypes(ftMap);
      } catch (e) {
        console.error("Reports load failed:", e);
        if (!cancelled) setError(e?.message || "Failed to load report data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range, scope, clinicId]);

  // Price adjustments are provider-scoped by RLS — this is the signed-in
  // provider's own log, filtered to the range client-side.
  useEffect(() => {
    let cancelled = false;
    loadPriceAdjustmentHistory(staffId).then(rows => { if (!cancelled) setAdjustments(rows); });
    return () => { cancelled = true; };
  }, [staffId]);

  // Leaving a range/scope invalidates the drill's underlying rows — close it.
  useEffect(() => { setDrill(null); }, [range, scope]);

  const stats = useMemo(
    () => (outcomes ? computeReportStats(outcomes, fittingTypes) : null),
    [outcomes, fittingTypes]
  );
  const adjInRange = useMemo(() => {
    const from = rangeToFrom(range);
    return from
      ? adjustments.filter(r => {
          const ts = r.created_at || r.timestamp || null;
          return ts ? new Date(ts) >= from : true;
        })
      : adjustments;
  }, [adjustments, range]);
  const adjStats = useMemo(() => computeAdjustmentStats(adjInRange), [adjInRange]);

  const followUp = useMemo(
    () => computeFollowUpStats(patients, outcomes || [], { from: rangeToFrom(range), classify }),
    [patients, outcomes, range]
  );

  // patient_id → the assembled patient object (active-clinic list). Lets a
  // drilled row open the chart when the patient is in the loaded list.
  const patientById = useMemo(() => {
    const m = {};
    for (const p of patients) m[p.id] = p;
    return m;
  }, [patients]);
  const adjPatientName = useMemo(() => {
    const byId = {};
    for (const p of patients) byId[p.id] = p.name || null;
    return (id) => byId[id] || null;
  }, [patients]);

  // A drilled row can open the chart only when we hold that patient's object
  // (the list is active-clinic scoped, so org-wide rows from other clinics
  // stay plain text). patientOpenable gates the link affordance per row.
  const patientOpenable = (id) => !!(onSelectPatient && patientById[id]);
  const openPatient = onSelectPatient
    ? (id) => { const p = patientById[id]; if (p) onSelectPatient(p); }
    : undefined;

  // The computed selection behind the open drill.
  const selection = useMemo(() => {
    if (!drill) return null;
    if (drill.source === "outcomes")     return selectOutcomeDrill(outcomes || [], drill, fittingTypes);
    if (drill.source === "followup")     return selectFollowUpDrill(patients, drill, { classify, from: rangeToFrom(range), outcomes: outcomes || [] });
    if (drill.source === "adjustments")  return selectAdjustmentDrill(adjInRange, drill, {});
    return null;
  }, [drill, outcomes, fittingTypes, patients, range, adjInRange]);

  const tpa = stats?.carePlan.byPayer.tpa;
  const seg = (active) => ({
    padding: "7px 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: "pointer",
    border: `1px solid ${active ? "#0d9488" : "#e5e7eb"}`,
    background: active ? "#f0fdfa" : "#fff", color: active ? "#0f766e" : "#6b7280",
  });

  const open = (source, kind, value = null) => setDrill({ source, kind, value });

  // ── Detail view ──
  if (drill && selection) {
    return (
      <ReportDetail
        drill={drill}
        selection={selection}
        scope={scope}
        rangeLabel={RANGE_LABELS[range]}
        scopeLabel={scope === "clinic" ? (clinicName || "This clinic") : "All locations"}
        onBack={() => setDrill(null)}
        onOpenPatient={openPatient}
        patientOpenable={patientOpenable}
        patientName={adjPatientName}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1060, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Reports</h2>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            Outcomes recorded at close — payer details are snapshotted at the moment of decision. Select any stat to see the patients behind it.
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={range} onChange={e => setRange(e.target.value)}
            style={{ padding: "7px 10px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid #e5e7eb", color: "#374151", background: "#fff" }}>
            {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <button style={seg(scope === "clinic")} onClick={() => setScope("clinic")}>{clinicName || "This clinic"}</button>
          <button style={seg(scope === "org")} onClick={() => setScope("org")}>All locations</button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>
          <strong>Couldn't load report data:</strong> {error}
        </div>
      )}

      {loading && <div style={{ fontSize: 14, color: "#6b7280", padding: "24px 0" }}>Loading outcomes…</div>}

      {!loading && !error && stats && stats.total === 0 && (
        <div style={{ background: "#fff", border: "1px dashed #d1d5db", borderRadius: 12, padding: "36px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 4 }}>No closed appointments in this range yet</div>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>
            Outcomes appear here as appointments are closed with a disposition. Try a wider date range or All locations.
          </div>
        </div>
      )}

      {!loading && !error && stats && stats.total > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Device close rate" value={pct(stats.closeRate.rate)}
              sub={`${stats.closeRate.closed} committed of ${stats.closeRate.denominator} decidable`}
              onClick={() => open("outcomes", "close_rate")} />
            <StatCard label="TPA care-plan attach" value={pct(tpa?.rate)}
              sub={tpa?.candidates ? `${tpa.attached} of ${tpa.candidates} TPA device commits` : "No TPA device commits in range"}
              accent="#7c3aed"
              onClick={() => open("outcomes", "tpa_attach")} />
            <StatCard label="Committed revenue" value={usd.format(stats.revenue.committedRevenue)}
              sub={`${usd.format(stats.revenue.deviceRevenue)} devices · ${usd.format(stats.revenue.carePlanRevenue)} care plans` +
                (stats.revenue.unpricedCount ? ` · ${stats.revenue.unpricedCount} unpriced` : "")}
              accent="#0369a1"
              onClick={() => open("outcomes", "revenue")} />
            <StatCard label="Outcomes logged" value={stats.total}
              sub={Object.entries(stats.byContext).map(([k, v]) => `${CONTEXT_LABELS[k] || k}: ${pct(v.rate)}`).join(" · ")}
              accent="#374151"
              onClick={() => open("outcomes", "all")} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
            <Section title="Outcome mix" blurb="Device-layer disposition of every outcome in range. Select a slice for its patients.">
              <BarList counts={stats.deviceMix} labels={DISPOSITION_LABELS} colors={DISPOSITION_COLORS} total={stats.total}
                onSelect={(k) => open("outcomes", "device_disposition", k)} />
            </Section>

            <Section title="Why patients deferred or declined" blurb="Device-layer reasons (required on deferrals and declines).">
              <BarList counts={stats.deviceReasons} labels={REASON_LABELS}
                onSelect={(k) => open("outcomes", "device_reason", k)} />
            </Section>

            <Section title="Care-plan attach by payer"
              blurb="Among committed device outcomes where a care plan was in play. Select a payer for its patients.">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(stats.carePlan.byPayer).map(([k, v]) => (
                  <div key={k}
                    onClick={() => open("outcomes", "careplan_payer", k)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open("outcomes", "careplan_payer", k); } }}
                    style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", borderRadius: 6, padding: "2px 4px", margin: "0 -4px" }}>
                    <div style={{ width: 200, color: "#374151", flexShrink: 0 }}>{PAYER_LABELS[k]}</div>
                    <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 6, height: 18 }}>
                      <div style={{ width: `${(v.rate || 0) * 100}%`, minWidth: v.candidates ? 4 : 0, height: "100%", borderRadius: 6, background: "#7c3aed", opacity: 0.85 }} />
                    </div>
                    <div style={{ width: 110, fontWeight: 700, color: "#111827", textAlign: "right", flexShrink: 0 }}>
                      {pct(v.rate)}<span style={{ color: "#9ca3af", fontWeight: 500 }}> · {v.attached}/{v.candidates}</span>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  Overall: {pct(stats.carePlan.overall.rate)} ({stats.carePlan.overall.attached} of {stats.carePlan.overall.candidates})
                </div>
              </div>
            </Section>

            <Section title="Care plans selected" blurb="Which plan committed patients chose.">
              <BarList counts={stats.carePlan.selectedMix} labels={CARE_PLAN_LABELS}
                onSelect={(k) => open("outcomes", "careplan_selected", k)} />
            </Section>

            <Section title="Tier mix on commits" blurb="From the payer snapshot at close.">
              <BarList counts={stats.revenue.tierMix} total={Object.values(stats.revenue.tierMix).reduce((a, b) => a + b, 0)}
                onSelect={(k) => open("outcomes", "tier", k)} />
            </Section>

            <Section title="Follow-up queue & conversions"
              blurb="Queue counts are the current snapshot; conversions count outcomes logged after a contact in this range.">
              <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#374151", marginBottom: 14, flexWrap: "wrap" }}>
                <StatNumber value={followUp.contacted} label="contacted" onClick={() => open("followup", "followup_contacted")} />
                <StatNumber value={followUp.withOutcome} label="reached an outcome" onClick={() => open("followup", "followup_withOutcome")} />
                <StatNumber value={followUp.committed} label="committed" color="#0d9488" onClick={() => open("followup", "followup_committed")} />
              </div>
              <BarList counts={followUp.buckets} labels={BUCKET_LABELS} colors={BUCKET_COLORS}
                onSelect={(k) => open("followup", "followup_bucket", k)} />
            </Section>

            <Section title="Your price adjustments"
              blurb="Adjustments you logged in this range (each provider sees their own). Select a reason for the line items.">
              {adjStats.count === 0 ? (
                <div style={{ fontSize: 13, color: "#9ca3af" }}>No adjustments logged in this range.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#374151" }}>
                    <StatNumber value={adjStats.count} label="adjustments" onClick={() => open("adjustments", "adjust_all")} />
                    <div><strong style={{ fontSize: 18 }}>{usd.format(adjStats.totalDiscount)}</strong> total discounted</div>
                    <div><strong style={{ fontSize: 18 }}>{adjStats.avgPercent == null ? "—" : `${Math.abs(adjStats.avgPercent).toFixed(1)}%`}</strong> avg discount</div>
                  </div>
                  <BarList counts={adjStats.byReason} labels={ADJ_REASON_LABELS}
                    onSelect={(k) => open("adjustments", "adjust_reason", k)} />
                </div>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
