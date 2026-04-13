import { useState, useEffect } from "react";
import { loadCampaignTemplates, loadAllActiveCampaigns, saveCampaignTemplate } from "../db.js";
import CampaignDetail from "./CampaignDetail.jsx";

export default function CampaignManager({ clinicId, staffId, patients }) {
  const [templates, setTemplates] = useState([]);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null); // null = list, object = detail
  const [tab, setTab] = useState("templates"); // "templates" | "enrollments"

  useEffect(() => {
    if (clinicId) {
      loadCampaignTemplates(clinicId).then(setTemplates);
      loadAllActiveCampaigns().then(setActiveCampaigns);
    }
  }, [clinicId]);

  const handleNewTemplate = async () => {
    const t = await saveCampaignTemplate({
      clinic_id: clinicId,
      name: "New Campaign",
      description: "",
      trigger_type: "fitting_date",
      created_by: staffId,
    });
    setTemplates(prev => [{ ...t, campaign_steps: [] }, ...prev]);
    setSelectedTemplate({ ...t, campaign_steps: [] });
  };

  const handleToggleActive = async (template) => {
    const updated = await saveCampaignTemplate({ ...template, active: !template.active });
    setTemplates(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
  };

  const handleBack = () => {
    // Refresh templates when coming back from detail
    loadCampaignTemplates(clinicId).then(setTemplates);
    setSelectedTemplate(null);
  };

  // ── Detail view ──
  if (selectedTemplate) {
    return (
      <CampaignDetail
        template={selectedTemplate}
        clinicId={clinicId}
        staffId={staffId}
        patients={patients}
        onBack={handleBack}
      />
    );
  }

  // ── List view ──
  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Campaign Manager</div>
          <div className="topbar-sub">{templates.length} template{templates.length !== 1 ? "s" : ""} · {activeCampaigns.length} active enrollment{activeCampaigns.length !== 1 ? "s" : ""}</div>
        </div>
        <button className="btn-primary" onClick={handleNewTemplate}>+ New Template</button>
      </div>
      <div className="content">
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[["templates", "Templates"], ["enrollments", "Active Enrollments"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: "1px solid", cursor: "pointer", fontFamily: "'Sora',sans-serif",
              background: tab === id ? "#0a1628" : "white",
              color: tab === id ? "white" : "#6b7280",
              borderColor: tab === id ? "#0a1628" : "#e5e7eb",
            }}>{label}</button>
          ))}
        </div>

        {tab === "templates" && (
          <>
            {templates.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>No campaigns yet</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Create a campaign template to start nurturing patients.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {templates.map(t => {
                  const stepCount = t.campaign_steps?.length || 0;
                  const triggerLabel = { fitting_date: "Fitting Date", manual: "Manual", warranty_expiry: "Warranty Expiry", tns: "Treatment Not Started" }[t.trigger_type] || t.trigger_type;
                  return (
                    <div key={t.id} className="card" style={{ padding: 20, cursor: "pointer", transition: "box-shadow 0.15s", opacity: t.active ? 1 : 0.5 }}
                      onClick={() => setSelectedTemplate(t)}
                      onMouseOver={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"}
                      onMouseOut={e => e.currentTarget.style.boxShadow = "none"}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#0a1628" }}>{t.name}</div>
                          {t.description && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{t.description}</div>}
                        </div>
                        <button onClick={e => { e.stopPropagation(); handleToggleActive(t); }}
                          style={{
                            background: t.active ? "#dcfce7" : "#f3f4f6",
                            color: t.active ? "#16a34a" : "#9ca3af",
                            border: "none", borderRadius: 12, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                          }}>
                          {t.active ? "Active" : "Paused"}
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6b7280" }}>
                        <span>📋 {stepCount} step{stepCount !== 1 ? "s" : ""}</span>
                        <span>🎯 {triggerLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "enrollments" && (
          <div className="table-card">
            <div className="table-header">
              <div className="table-title">Active Patient Campaigns</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Campaign</th>
                  <th>Progress</th>
                  <th>Next Delivery</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeCampaigns.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>No active enrollments</td></tr>
                ) : (
                  activeCampaigns.map(c => {
                    const deliveries = c.campaign_deliveries || [];
                    const delivered = deliveries.filter(d => d.status === "delivered").length;
                    const total = deliveries.length;
                    const next = deliveries.filter(d => d.status === "pending").sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0];
                    const name = c.patients ? [c.patients.first_name, c.patients.last_name].filter(Boolean).join(" ") : "Unknown";
                    return (
                      <tr key={c.id}>
                        <td><span className="patient-name">{name}</span></td>
                        <td>{c.campaign_templates?.name || "—"}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 60, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ width: `${total ? (delivered / total) * 100 : 0}%`, height: "100%", background: "#16a34a", borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>{delivered}/{total}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>{next?.scheduled_date || "—"}</td>
                        <td>
                          <span className="badge complete" style={{ fontSize: 10 }}>{c.status}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
