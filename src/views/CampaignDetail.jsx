import { useState, useEffect } from "react";
import {
  loadCampaignContent,
  saveCampaignTemplate,
  saveCampaignSteps,
  enrollPatientInCampaign,
  loadPatientCampaigns,
} from "../db.js";

const CHANNELS = ["in_app", "push", "email", "sms"];
const CHANNEL_ICONS = { in_app: "📱", push: "🔔", email: "📧", sms: "💬" };
const TRIGGER_TYPES = [
  { id: "fitting_date", label: "Fitting Date" },
  { id: "warranty_expiry", label: "Warranty Expiry" },
  { id: "manual", label: "Manual Trigger" },
];

export default function CampaignDetail({ template, clinicId, staffId, patients, onBack }) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [triggerType, setTriggerType] = useState(template.trigger_type);
  const [steps, setSteps] = useState(
    (template.campaign_steps || []).map(s => ({
      id: s.id,
      content_id: s.content_id,
      delay_days: s.delay_days,
      delivery_channel: s.delivery_channel,
      contentTitle: s.campaign_content?.title || "",
    }))
  );
  const [contentLibrary, setContentLibrary] = useState([]);
  const [saving, setSaving] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollPatientId, setEnrollPatientId] = useState("");
  const [enrollDate, setEnrollDate] = useState("");

  useEffect(() => {
    if (clinicId) loadCampaignContent(clinicId).then(setContentLibrary);
  }, [clinicId]);

  const addStep = () => {
    setSteps(prev => [...prev, {
      id: null,
      content_id: contentLibrary[0]?.id || "",
      delay_days: prev.length ? (prev[prev.length - 1].delay_days + 30) : 1,
      delivery_channel: "in_app",
      contentTitle: contentLibrary[0]?.title || "",
    }]);
  };

  const removeStep = (idx) => setSteps(prev => prev.filter((_, i) => i !== idx));

  const updateStep = (idx, field, value) => {
    setSteps(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const updated = { ...s, [field]: value };
      if (field === "content_id") {
        const found = contentLibrary.find(c => c.id === value);
        updated.contentTitle = found?.title || "";
      }
      return updated;
    }));
  };

  const moveStep = (idx, dir) => {
    setSteps(prev => {
      const arr = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= arr.length) return arr;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCampaignTemplate({ id: template.id, clinic_id: clinicId, name, description, trigger_type: triggerType, created_by: staffId });
      await saveCampaignSteps(template.id, steps.map(s => ({
        content_id: s.content_id,
        delay_days: s.delay_days,
        delivery_channel: s.delivery_channel,
      })));
    } catch (e) {
      console.error("Save campaign error:", e);
    }
    setSaving(false);
  };

  const handleEnroll = async () => {
    if (!enrollPatientId || !enrollDate) return;
    try {
      await enrollPatientInCampaign(enrollPatientId, template.id, enrollDate, staffId);
      setEnrollOpen(false);
      setEnrollPatientId("");
      setEnrollDate("");
    } catch (e) {
      console.error("Enroll error:", e);
    }
  };

  const formatDays = (days) => {
    if (days < 7) return `Day ${days}`;
    if (days < 30) return `Week ${Math.round(days / 7)}`;
    if (days < 365) return `Month ${Math.round(days / 30)}`;
    return `Year ${(days / 365).toFixed(1)}`;
  };

  return (
    <>
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-ghost" onClick={onBack}>← Back</button>
          <div>
            <div className="topbar-title">{name || "Campaign Template"}</div>
            <div className="topbar-sub">{steps.length} step{steps.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={() => setEnrollOpen(true)}>Enroll Patient</button>
          <button className="btn-primary green" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Campaign"}
          </button>
        </div>
      </div>
      <div className="content">
        <div style={{ maxWidth: 800 }}>
          {/* Template settings */}
          <div className="card">
            <div className="card-title">Campaign Settings</div>
            <div className="field-grid">
              <div className="field">
                <label>Campaign Name</label>
                <input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>Trigger Type</label>
                <select value={triggerType} onChange={e => setTriggerType(e.target.value)}>
                  {TRIGGER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="field full">
                <label>Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this campaign does..." />
              </div>
            </div>
          </div>

          {/* Timeline builder */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Campaign Timeline</div>
              <button className="btn-primary" onClick={addStep} style={{ fontSize: 12, padding: "6px 14px" }}>+ Add Step</button>
            </div>

            {steps.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                <div style={{ fontSize: 13 }}>No steps yet. Add your first touchpoint.</div>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                {/* Vertical timeline line */}
                <div style={{ position: "absolute", left: 18, top: 16, bottom: 16, width: 2, background: "#e5e7eb" }} />

                {steps.map((step, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 16, marginBottom: 16, position: "relative" }}>
                    {/* Timeline dot */}
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%", background: "white", border: "2px solid #e5e7eb",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, zIndex: 1,
                    }}>
                      {CHANNEL_ICONS[step.delivery_channel]}
                    </div>

                    {/* Step card */}
                    <div style={{
                      flex: 1, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14,
                      display: "flex", flexDirection: "column", gap: 10,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1 }}>
                          {formatDays(step.delay_days)}
                        </span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", padding: 2 }}>▲</button>
                          <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", padding: 2 }}>▼</button>
                          <button onClick={() => removeStep(idx)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#ef4444", padding: 2 }}>×</button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 0.5 }}>
                          <label style={{ fontSize: 10 }}>Day Offset</label>
                          <input type="number" min={1} value={step.delay_days}
                            onChange={e => updateStep(idx, "delay_days", parseInt(e.target.value) || 1)}
                            style={{ padding: "6px 8px", fontSize: 13 }} />
                        </div>
                        <div style={{ flex: 0.5 }}>
                          <label style={{ fontSize: 10 }}>Channel</label>
                          <select value={step.delivery_channel}
                            onChange={e => updateStep(idx, "delivery_channel", e.target.value)}
                            style={{ padding: "6px 8px", fontSize: 13 }}>
                            {CHANNELS.map(ch => <option key={ch} value={ch}>{CHANNEL_ICONS[ch]} {ch.replace("_", " ")}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10 }}>Content</label>
                          <select value={step.content_id}
                            onChange={e => updateStep(idx, "content_id", e.target.value)}
                            style={{ padding: "6px 8px", fontSize: 13 }}>
                            <option value="">— Select content —</option>
                            {contentLibrary.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enroll patient modal */}
          {enrollOpen && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
            }} onClick={() => setEnrollOpen(false)}>
              <div style={{ background: "white", borderRadius: 14, padding: 28, width: 400 }} onClick={e => e.stopPropagation()}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Enroll Patient</div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Patient</label>
                  <select value={enrollPatientId} onChange={e => setEnrollPatientId(e.target.value)}>
                    <option value="">— Select —</option>
                    {(patients || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label>Trigger Date</label>
                  <input type="date" value={enrollDate} onChange={e => setEnrollDate(e.target.value)} />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => setEnrollOpen(false)}>Cancel</button>
                  <button className="btn-primary green" onClick={handleEnroll} disabled={!enrollPatientId || !enrollDate}>Enroll</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
