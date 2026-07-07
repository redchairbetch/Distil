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

// ── LegacyFastPath — front-desk device record in under two minutes ───────────
// A returning patient with zero Distil history gets a usable record: fit date,
// device (manufacturer → platform → level cascade off the live catalog, with a
// free-text fallback), warranty. Saves a device_fittings row with
// record_source='legacy_fastpath' — enough to drive the comparison screen
// immediately and surface in future follow-up queues.
//
// The cascade doubles as catalog validation: a device the front desk can't
// find is a catalog gap, which is why the free-text fallback nudges toward
// writing down exactly what's printed on the aid. Deliberately NOT blocked on
// audiogram presence — prior-audiogram ingestion is the Avant parser's job.
import React, { useState, useEffect, useMemo } from "react";
import { COLOR, FONT } from "../theme.js";
import { loadDeviceCatalog, createLegacyFastpathFitting, loadNewestCatalogFitting } from "../catalog.js";
import { indexCatalog } from "../catalogComparison.js";
import CapabilityComparison, { DeviceCascade, tierDisplayLabel } from "./CapabilityComparison.jsx";

const today = () => new Date().toISOString().split("T")[0];

// ── LegacyDevicePanel — the patient-profile home for all of this ─────────────
// Self-contained (state, loads, layout) so Distil.jsx mounts it with one line.
// Shows the newest catalog-linked device record, opens the fast-path form to
// create one, and opens the What's-Changed comparison — which a fresh record
// drives immediately.
export function LegacyDevicePanel({ patientId, staffId = null }) {
  const [record, setRecord] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!patientId) return undefined;
    loadNewestCatalogFitting(patientId).then(r => alive && setRecord(r)).catch(() => {});
    loadDeviceCatalog().then(c => alive && setCatalog(c)).catch(() => {});
    return () => { alive = false; };
  }, [patientId]);

  const idx = useMemo(
    () => (catalog ? indexCatalog(catalog.platforms, catalog.tiers) : null),
    [catalog]
  );
  const platform = record?.platform_id && idx ? idx.platformsById.get(record.platform_id) : null;
  const tier = record?.tier_id && idx ? idx.tiersById.get(record.tier_id) : null;
  const deviceLabel = record
    ? (platform
        ? [platform.manufacturer, platform.platformName, tier ? tierDisplayLabel(tier.tierDesignation) : null].filter(Boolean).join(" ")
        : record.device_freetext || "Device on record")
    : null;

  return (
    <div className="detail-card full">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="detail-card-title" style={{ marginBottom: 0 }}>Prior / Outside Devices</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
            onClick={() => { setShowForm(v => !v); setShowCompare(false); }}>
            {record ? "Update record" : "Add quick record"}
          </button>
          {record && (
            <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => { setShowCompare(v => !v); setShowForm(false); }}>
              {showCompare ? "Hide comparison" : "What's changed →"}
            </button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 13, color: COLOR.ink2, marginTop: 8 }}>
        {record
          ? <>On record: <strong style={{ color: COLOR.ink }}>{deviceLabel}</strong>
              {record.fitting_date ? ` · fit ${record.fitting_date}` : ""}
              {record.record_source === "legacy_fastpath" ? " · front-desk record" : ""}</>
          : "No outside/prior device on record — a quick record takes under two minutes and drives the comparison screen."}
      </div>
      {showForm && (
        <div style={{ marginTop: 12 }}>
          <LegacyFastPath patientId={patientId} staffId={staffId}
            onClose={() => setShowForm(false)}
            onSaved={row => { setRecord(row); setShowForm(false); setShowCompare(true); }} />
        </div>
      )}
      {showCompare && record && (
        <div style={{ marginTop: 12 }}>
          <CapabilityComparison variant="embedded" patientId={patientId}
            patientDeviceRef={record.platform_id
              ? { platformId: record.platform_id, tierId: record.tier_id || "", freetext: null }
              : { platformId: "", tierId: "", freetext: record.device_freetext }} />
        </div>
      )}
    </div>
  );
}

export default function LegacyFastPath({ patientId, staffId = null, onSaved = null, onClose = null }) {
  const [catalog, setCatalog] = useState(null);
  const [device, setDevice] = useState({ manufacturer: "", platformId: "", tierId: "" });
  const [useFreetext, setUseFreetext] = useState(false);
  const [freetext, setFreetext] = useState("");
  const [fitDate, setFitDate] = useState(today());
  const [warranty, setWarranty] = useState("");
  const [fittingType, setFittingType] = useState("bilateral");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    loadDeviceCatalog().then(c => alive && setCatalog(c)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const idx = useMemo(
    () => (catalog ? indexCatalog(catalog.platforms, catalog.tiers) : null),
    [catalog]
  );

  const canSave = !!patientId && !!fitDate && !saving &&
    (useFreetext ? freetext.trim().length > 0 : !!device.platformId);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const row = await createLegacyFastpathFitting({
        patientId,
        enteredBy: staffId,
        fitDate,
        fittingType,
        platformId: useFreetext ? null : device.platformId || null,
        tierId: useFreetext ? null : device.tierId || null,
        deviceFreetext: useFreetext ? freetext.trim() : null,
        warrantyExpiry: warranty || null,
      });
      onSaved?.(row);
    } catch (e) {
      setError("Couldn't save the record — try again.");
    } finally {
      setSaving(false);
    }
  }

  const field = { width: "100%", padding: "8px 10px", border: `1px solid ${COLOR.line}`,
    borderRadius: 8, fontSize: 13, color: COLOR.ink, background: COLOR.card, boxSizing: "border-box" };
  const label = { fontSize: 11, fontWeight: 700, color: COLOR.ink2, textTransform: "uppercase",
    letterSpacing: "0.05em", marginBottom: 4, display: "block" };

  return (
    <div style={{ fontFamily: FONT.ui, background: COLOR.paper, border: `1px solid ${COLOR.line}`,
      borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: COLOR.ink }}>
            Current devices — quick record
          </div>
          <div style={{ fontSize: 12, color: COLOR.ink2 }}>
            For returning patients fit elsewhere or before Distil. Drives the comparison screen right away.
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: "transparent", border: "none",
            color: COLOR.ink3, cursor: "pointer", fontSize: 12 }}>Close</button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <span style={label}>Device</span>
          {!useFreetext ? (
            idx
              ? <DeviceCascade idx={idx} value={device} onChange={setDevice} allowEmptyTier />
              : <div style={{ fontSize: 12, color: COLOR.ink3 }}>Loading catalog…</div>
          ) : (
            <input style={field} autoFocus value={freetext} onChange={e => setFreetext(e.target.value)}
              placeholder="Exactly what's printed on the aid — brand, model, anything legible" />
          )}
          <button onClick={() => setUseFreetext(v => !v)} style={{ background: "transparent",
            border: "none", color: COLOR.teal, cursor: "pointer", fontSize: 12, fontWeight: 600,
            padding: "6px 0 0" }}>
            {useFreetext ? "Back to the catalog picker" : "Can't find it? Write it in"}
          </button>
          {useFreetext && (
            <div style={{ fontSize: 11, color: COLOR.ink3 }}>
              A device the picker can't find is a catalog gap — the written-in text flags it for review.
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <span style={label}>Fit date (approximate is fine)</span>
            <input type="date" style={field} value={fitDate} onChange={e => setFitDate(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <span style={label}>Warranty expires (if known)</span>
            <input type="date" style={field} value={warranty} onChange={e => setWarranty(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <span style={label}>Fit</span>
            <select style={field} value={fittingType} onChange={e => setFittingType(e.target.value)}>
              <option value="bilateral">Both ears</option>
              <option value="monaural_left">Left only</option>
              <option value="monaural_right">Right only</option>
              <option value="cros_bicros">CROS / BiCROS</option>
            </select>
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: COLOR.dangerInk }}>{error}</div>}

        <div>
          <button onClick={save} disabled={!canSave} style={{ background: canSave ? COLOR.pine : COLOR.paper2,
            color: canSave ? "#fff" : COLOR.ink3, border: "none", borderRadius: 8,
            padding: "9px 16px", cursor: canSave ? "pointer" : "default", fontWeight: 600, fontSize: 13 }}>
            {saving ? "Saving…" : "Save device record"}
          </button>
        </div>
      </div>
    </div>
  );
}
