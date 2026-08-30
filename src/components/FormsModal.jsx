// Manufacturer Forms modal (backlog #42, phase c) — generate a filled copy of
// a manufacturer's own repair / L&D / Return-for-Credit PDF from chart data.
//
// Flow: pick manufacturer (derived from the saved fitting) → pick a form →
// review/edit the prefill panel (exactly the values that land on paper) →
// Generate. The filled PDF opens for print, downloads, and archives to
// patient_documents (kind 'manufacturer_form') — archive failures surface as
// warnings and never block the paper (PurchaseAgreementModal convention).

import React, { useEffect, useMemo, useState } from "react";
import { FORM_REGISTRY, FORM_CATEGORIES, getFormsFor } from "../lib/manufacturerForms/registry.js";
import { fillForm, FormVersionError } from "../lib/manufacturerForms/fillEngine.js";
import { buildFormData, LOGICAL_LABELS } from "../lib/manufacturerForms/formData.js";
import { MFR_KEYS, MFR_DISPLAY, normalizeMfr } from "../lib/manufacturerKeys.js";
import { loadClinicSettings, uploadPatientDocument } from "../db.js";

const C = {
  ink: "#0a1628",
  muted: "#6b7280",
  line: "#e5e7eb",
  bgSoft: "#f9fafb",
  accent: "#1d4ed8",
  amber: "#92400e",
  amberBg: "#fffbeb",
  amberLine: "#fde68a",
};

const inputStyle = {
  width: "100%", padding: "7px 9px",
  border: `1px solid ${C.line}`, borderRadius: 6,
  fontSize: 12.5, color: C.ink, boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle = {
  display: "block",
  fontSize: 10.5, fontWeight: 600, color: C.muted,
  textTransform: "uppercase", letterSpacing: "0.04em",
  marginBottom: 3,
};

const chipStyle = (active) => ({
  padding: "5px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
  border: `1px solid ${active ? C.accent : C.line}`,
  background: active ? "#eff6ff" : "white",
  color: active ? C.accent : C.ink,
  fontWeight: active ? 600 : 400,
});

export default function FormsModal({ patient, clinic, provider, clinicId, staffId, onClose, onArchived }) {
  const devices = patient?.devices || null;
  const [clinicSettings, setClinicSettings] = useState(null);
  const [mfrKey, setMfrKey] = useState(null);
  const [formId, setFormId] = useState(null);
  const [data, setData] = useState(null);
  const [showAllMfrs, setShowAllMfrs] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { fileName, url, warnings }

  useEffect(() => {
    let live = true;
    loadClinicSettings(clinicId).then((s) => { if (live) setClinicSettings(s || {}); });
    return () => { live = false; };
  }, [clinicId]);

  // Manufacturers on the chart's current fitting, canonicalized.
  const chartMfrs = useMemo(() => {
    const keys = [devices?.left?.manufacturer, devices?.right?.manufacturer]
      .map(normalizeMfr)
      .filter(Boolean);
    return [...new Set(keys)];
  }, [devices]);

  const activeMfr = mfrKey || chartMfrs[0] || null;
  // Earmold/custom order forms surface only when a side actually carries an
  // earmold coupling — a repair doesn't need the order catalog in the way.
  const hasEarmold = devices?.left?.coupling === "earmold" || devices?.right?.coupling === "earmold";
  const forms = (activeMfr ? getFormsFor(activeMfr) : [])
    .filter((m) => hasEarmold || (m.category !== "earmold_order" && m.category !== "custom_order"));
  const selectedForm = FORM_REGISTRY.find((m) => m.id === formId) || null;

  // Logical keys the selected map actually uses, deduped in map order.
  const panelKeys = useMemo(() => {
    if (!selectedForm) return [];
    return [...new Set(selectedForm.fields.map((f) => f.logical))];
  }, [selectedForm]);

  const pickForm = (map) => {
    setFormId(map.id);
    setError(null);
    setResult(null);
    setData(
      buildFormData({
        patient,
        devices,
        clinic,
        clinicSettings,
        provider,
        mfrKey: map.manufacturer,
        audiology: patient?.audiology || null,
      })
    );
  };

  const missingAccount =
    selectedForm && data &&
    panelKeys.some((k) => (k === "clinic.billTo" || k === "clinic.shipTo") && !data[k]);

  const handleGenerate = async () => {
    if (!selectedForm || !data || generating) return;
    setGenerating(true);
    setError(null);
    const warnings = [];
    try {
      const { blob } = await fillForm(selectedForm, data);
      const last = (data["patient.lastName"] || patient?.name || "patient").replace(/\s+/g, "_");
      const first = (data["patient.firstName"] || "").replace(/\s+/g, "_");
      const date = new Date().toISOString().split("T")[0];
      const fileName = [last, first, selectedForm.id, date].filter(Boolean).join("_") + ".pdf";
      const url = URL.createObjectURL(blob);

      try {
        await uploadPatientDocument({
          patientId: patient.id,
          clinicId,
          staffId,
          kind: "manufacturer_form",
          blob,
          fileName,
          metadata: {
            formId: selectedForm.id,
            manufacturer: selectedForm.manufacturer,
            category: selectedForm.category,
            sha256: selectedForm.sha256,
          },
        });
        onArchived?.();
      } catch (e) {
        console.error("FormsModal archive:", e);
        warnings.push("The form generated but could not be archived to the patient's documents. Print/download still works.");
      }

      setResult({ fileName, url, blob, warnings });
    } catch (e) {
      console.error("FormsModal generate:", e);
      setError(
        e instanceof FormVersionError
          ? e.message
          : `Could not generate the form: ${e.message}`
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.fileName;
    a.click();
  };

  const handlePrint = () => {
    if (!result) return;
    window.open(result.url, "_blank");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,22,40,0.5)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: 30, zIndex: 1000, overflowY: "auto",
    }}>
      <div style={{
        background: "white", borderRadius: 12, maxWidth: 640, width: "100%",
        boxShadow: "0 24px 60px rgba(0,0,0,0.25)", fontFamily: "'Sora', sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "18px 26px", borderBottom: `1px solid ${C.line}` }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>Manufacturer Forms</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {patient?.name} — repair, loss &amp; damage, and return paperwork
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 22, color: C.muted, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 26 }}>
          {/* Manufacturer picker */}
          <label style={labelStyle}>Manufacturer</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {(showAllMfrs || !chartMfrs.length ? MFR_KEYS : chartMfrs).map((k) => (
              <button key={k} style={chipStyle(k === activeMfr)} onClick={() => { setMfrKey(k); setFormId(null); setResult(null); setError(null); }}>
                {MFR_DISPLAY[k]}
              </button>
            ))}
            {chartMfrs.length > 0 && !showAllMfrs && (
              <button style={chipStyle(false)} title="Show every manufacturer" onClick={() => setShowAllMfrs(true)}>…</button>
            )}
          </div>

          {/* Form picker */}
          {activeMfr && (
            <>
              <label style={labelStyle}>Form</label>
              {forms.length === 0 && (
                <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>
                  No {MFR_DISPLAY[activeMfr]} forms are in the library yet.
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {forms.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => pickForm(m)}
                    style={{
                      textAlign: "left", padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${formId === m.id ? C.accent : C.line}`,
                      background: formId === m.id ? "#eff6ff" : "white",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{m.title}</span>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{FORM_CATEGORIES[m.category]}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Prefill panel */}
          {selectedForm && data && (
            <>
              <label style={labelStyle}>What prints on the form</label>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>
                Edit anything before generating — blanks stay blank for the pen.
                Service reasons and checkbox selections are marked by hand after printing.
              </div>
              {missingAccount && (
                <div style={{ background: C.amberBg, border: `1px solid ${C.amberLine}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.amber, marginBottom: 10 }}>
                  No {MFR_DISPLAY[selectedForm.manufacturer]} account number on file — set bill-to / ship-to numbers in Clinic Settings, or type them below.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px", marginBottom: 16 }}>
                {panelKeys.map((k) => {
                  const v = data[k];
                  if (typeof v === "boolean") {
                    return (
                      <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.ink }}>
                        <input type="checkbox" checked={v} onChange={(e) => setData({ ...data, [k]: e.target.checked })} />
                        {LOGICAL_LABELS[k] || k}
                      </label>
                    );
                  }
                  return (
                    <div key={k}>
                      <label style={labelStyle}>{LOGICAL_LABELS[k] || k}</label>
                      <input
                        style={inputStyle}
                        value={v ?? ""}
                        onChange={(e) => setData({ ...data, [k]: e.target.value })}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#991b1b", marginBottom: 12 }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#166534", marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>Generated {result.fileName}</div>
              {result.warnings.map((w, i) => (
                <div key={i} style={{ color: C.amber, marginTop: 4 }}>⚠ {w}</div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
            <button className="btn-ghost" style={{ fontSize: 12, padding: "8px 16px" }} onClick={onClose}>Close</button>
            {result ? (
              <>
                <button className="btn-ghost" style={{ fontSize: 12, padding: "8px 16px" }} onClick={handleDownload}>Download</button>
                <button
                  style={{ fontSize: 12, padding: "8px 18px", background: C.accent, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
                  onClick={handlePrint}
                >Open &amp; Print</button>
              </>
            ) : (
              <button
                disabled={!selectedForm || generating}
                style={{
                  fontSize: 12, padding: "8px 18px", border: "none", borderRadius: 8, fontWeight: 600,
                  background: selectedForm && !generating ? C.accent : C.line,
                  color: selectedForm && !generating ? "white" : C.muted,
                  cursor: selectedForm && !generating ? "pointer" : "default",
                }}
                onClick={handleGenerate}
              >{generating ? "Generating…" : "Generate Form"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
