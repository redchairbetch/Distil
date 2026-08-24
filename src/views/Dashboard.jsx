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

// Patient Dashboard view (backlog #40d — extracted from Distil.jsx
// renderDashboard). Pure render extraction: roster state, filters, the TNS
// queue, and all handlers live in ProviderCRM and arrive as props.

import React from "react";
import DueThisWeek from "./DueThisWeek.jsx";
import CommsInbox from "./CommsInbox.jsx";
import TnsReasonsPicker from "../components/TnsReasonsPicker.jsx";
import { fmtDate, daysUntil } from "../lib/dates.js";
import { summarizeAudiogram } from "../lib/audiogram.js";
import { CARE_PLANS } from "../lib/catalogConstants.js";
import { STEPS } from "../lib/wizardSteps.js";

export default function Dashboard({
  clinic, clinicId, staffId, patients,
  seedError, seeding, handleSeedPatients, startNew,
  wizardDraft, wizardDraftSavedLabel, discardWizardDraft, resumeAppointment,
  statsData, setSelectedPatient, setView,
  tnsQueue, tnsExpanded, setTnsExpanded, tnsReasoning, setTnsReasoning,
  quoteViewBadge, handleTnsSaved,
  statusFilter, setStatusFilter, searchScope, setSearchScope,
  tableSearch, setTableSearch, filteredPatients, globalSearching,
  rosterSort, toggleRosterSort,
}) {
  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Patient Dashboard</div>
          <div className="topbar-sub">{clinic.name} · {patients.length} active patients</div>
          {seedError && <div style={{fontSize:11,color:"#dc2626",marginTop:4}}>Seed error: {seedError}</div>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {patients.length === 0 && (
            <button className="btn-ghost" style={{fontSize:12}} onClick={handleSeedPatients} disabled={seeding}>
              {seeding ? "Seeding…" : "🌱 Add Test Patients"}
            </button>
          )}
          <button className="btn-primary green" onClick={startNew}>＋ New Patient</button>
        </div>
      </div>
      <div className="content">
        {/* ── In-progress appointment (resume/discard) ─────────────────── */}
        {wizardDraft && (() => {
          const dName = [wizardDraft.form?.firstName, wizardDraft.form?.lastName].filter(Boolean).join(" ") || "Unnamed patient";
          const savedLabel = wizardDraftSavedLabel(wizardDraft);
          return (
            <div className="table-card" style={{ marginBottom: 16, borderLeft: "4px solid #2563eb", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0a1628" }}>
                  {"⏸"} Appointment in progress — {dName}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {wizardDraft.wizardMode === "upgrade" ? "Upgrade purchase" : "New patient"} · {STEPS[wizardDraft.step] || "Patient"} step · saved {savedLabel}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => {
                  if (window.confirm(`Discard the in-progress appointment with ${dName}? The patient record and anything already saved stay on their chart.`)) discardWizardDraft();
                }}>Discard</button>
                <button className="btn-primary" onClick={resumeAppointment}>Resume →</button>
              </div>
            </div>
          );
        })()}
        <div className="stats-grid">
          <div className="stat-card highlight">
            <div className="stat-icon">👥</div>
            <div className="stat-val">{statsData.total}</div>
            <div className="stat-label">Total Patients{statsData.tnsCount > 0 && <span style={{fontSize:10,color:"#d97706",fontWeight:400}}> ({statsData.tnsCount} TNS)</span>}{statsData.tnlCount > 0 && <span style={{fontSize:10,color:"#1d4ed8",fontWeight:400}}> ({statsData.tnlCount} TNL)</span>}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎧</div>
            <div className="stat-val">{statsData.fittingsThisMonth}</div>
            <div className="stat-label">Fittings This Month</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-val">{statsData.upcomingAppts}</div>
            <div className="stat-label">Upcoming Appointments</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-val">{statsData.warrantiesExpiring}</div>
            <div className="stat-label">Warranties Expiring (90d)</div>
          </div>
        </div>

        {/* ── Care visits due this week (care-arc work list) ───────────── */}
        <DueThisWeek
          patients={patients}
          onSelectPatient={(p) => { setSelectedPatient(p); setView("patient"); }}
          onOpenQueue={() => setView("followup")}
        />

        {/* ── Patient Messages (two-way comms inbox) ───────────────────── */}
        {/* Aided replies (and, later, ingested email replies) awaiting a   */}
        {/* response. Front desk or provider replies via SendMessageModal.  */}
        <CommsInbox
          clinicId={clinicId}
          staffId={staffId}
          patients={patients}
          onOpenPatient={(p) => { setSelectedPatient(p); setView("patient"); }}
        />

        {/* ── TNS Pending Follow-ups Queue ─────────────────────────────── */}
        {tnsQueue.length > 0 && (
          <div className="table-card" style={{ marginBottom: 16, borderLeft: "4px solid #f59e0b" }}>
            <div
              className="table-header"
              style={{ cursor: "pointer" }}
              onClick={() => setTnsExpanded(e => !e)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="table-title" style={{ color: "#b45309" }}>
                  {"\u{1F552}"} Pending Follow-ups
                </div>
                <span style={{
                  background: "#fef3c7", color: "#92400e",
                  borderRadius: 99, padding: "2px 10px",
                  fontSize: 12, fontWeight: 700
                }}>
                  {tnsQueue.length}
                </span>
              </div>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                {tnsExpanded ? "\u25B2 Collapse" : "\u25BC Expand"}
              </span>
            </div>

            {tnsExpanded && (
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Audiometric Summary</th>
                    <th>Insurance</th>
                    <th>Quote Amount</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tnsQueue.map(p => {
                    const audio = summarizeAudiogram(p);
                    const isTagging = tnsReasoning === p.id;
                    return (
                      <React.Fragment key={p.id}>
                        <tr
                          onClick={() => { setSelectedPatient(p); setView("patient"); }}
                          style={{ cursor: "pointer", background: isTagging ? "#fffbeb" : "white" }}
                        >
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div className="patient-name">{p.name}</div>
                              {quoteViewBadge(p.id)}
                            </div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>{p.phone}</div>
                          </td>
                          <td>
                            {audio ? (
                              <>
                                <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
                                  {audio.severity}
                                </div>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>{audio.wrs}</div>
                              </>
                            ) : (
                              <span style={{ fontSize: 12, color: "#9ca3af" }}>No audiogram</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${p.payType === "insurance" ? "insurance" : "private"}`}>
                              {p.payType === "insurance" ? p.insurance?.carrier || "Insurance" : "Private Pay"}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                              {"\u2014"}
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: "#6b7280" }}>
                            {fmtDate(p.createdAt)}
                          </td>
                          <td>
                            <button
                              className="btn-primary green"
                              style={{
                                fontSize: 12,
                                padding: "6px 14px",
                                background: isTagging ? "#f59e0b" : undefined
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTnsReasoning(isTagging ? null : p.id);
                              }}
                            >
                              {isTagging ? "Cancel" : "Tag Reasons"}
                            </button>
                          </td>
                        </tr>

                        {isTagging && (
                          <tr key={`${p.id}-reasons`} onClick={(e) => e.stopPropagation()}>
                            <td colSpan={6} style={{ padding: 0 }}>
                              <TnsReasonsPicker
                                patientId={p.id}
                                patientName={p.name}
                                clinicId={clinicId}
                                staffId={staffId}
                                onSaved={() => handleTnsSaved(p.id)}
                                onCancel={() => setTnsReasoning(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="table-card">
          <div className="table-header">
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div className="table-title">Patients</div>
              <div style={{display:"flex",gap:4}}>
                {[["all","All"],["active","Active"],["tns","TNS"],["tnl","TNL"]].map(([val,label])=>(
                  <button key={val} onClick={()=>setStatusFilter(val)} style={{
                    padding:"3px 10px",fontSize:11,fontWeight:600,borderRadius:99,border:"none",cursor:"pointer",
                    background: statusFilter===val ? (val==="tns"?"#fef3c7":val==="tnl"?"#dbeafe":"#dcfce7") : "#F0EDE3",
                    color: statusFilter===val ? (val==="tns"?"#92400e":val==="tnl"?"#1d4ed8":"#15803d") : "#6b7280",
                  }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {/* Sycle-style scope: search this clinic or the whole database */}
              <div style={{display:"flex",gap:4}}>
                {[["local","This Clinic"],["global","All Locations"]].map(([val,label])=>(
                  <button key={val} onClick={()=>setSearchScope(val)} style={{
                    padding:"3px 10px",fontSize:11,fontWeight:600,borderRadius:99,border:"none",cursor:"pointer",
                    background: searchScope===val ? "#0a1628" : "#F0EDE3",
                    color: searchScope===val ? "#fff" : "#6b7280",
                  }}>{label}</button>
                ))}
              </div>
              <input className="search-input" placeholder={searchScope==="global" ? "Search all locations\u2026" : "Name, phone, or device\u2026"} value={tableSearch} onChange={e => setTableSearch(e.target.value)} />
            </div>
          </div>
          {filteredPatients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎧</div>
              {searchScope === "global" ? (
                <>
                  <div className="empty-title">{globalSearching ? "Searching all locations…" : tableSearch.trim().length < 2 ? "Search the complete patient database" : "No matches across any location"}</div>
                  <div className="empty-sub">{tableSearch.trim().length < 2 ? "Type at least 2 characters of a name or phone number." : "Check spelling, or try a phone number."}</div>
                </>
              ) : (
                <>
                  <div className="empty-title">No patients yet</div>
                  <div className="empty-sub">Click "New Patient" to add your first patient record.</div>
                </>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  {[["name","Patient"],["device","Device"],["coverage","Coverage"],["carePlan","Care Plan"],["warranty","Warranty"],["fitting","Fitting Date"]].map(([key,label])=>(
                    <th key={key} onClick={()=>toggleRosterSort(key)} style={{cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}
                        title={`Sort by ${label.toLowerCase()}`}>
                      {label}
                      <span style={{marginLeft:4,fontSize:9,color:rosterSort.key===key?"#0a1628":"#d1d5db"}}>
                        {rosterSort.key===key ? (rosterSort.dir==="asc"?"▲":"▼") : "▲▼"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(p => {
                  const isTns = p.patientStatus === "tns";
                  const isTnl = p.patientStatus === "tnl";
                  const days = daysUntil(p.devices?.warrantyExpiry||"");
                  const total = p.carePlan === "complete" ? 4 * 365 : 3 * 365;
                  const pct = Math.max(0, Math.min(100, (days / total) * 100));
                  const fillClass = days < 90 ? "exp" : days < 360 ? "warn" : "";
                  return (
                    <tr key={p.id} onClick={() => { setSelectedPatient(p); setView("patient"); }} style={isTns ? {borderLeft:"3px solid #f59e0b"} : isTnl ? {borderLeft:"3px solid #3b82f6"} : undefined}>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div className="patient-name">{p.name}</div>
                          {isTns && <span style={{background:"#fef3c7",color:"#92400e",borderRadius:99,padding:"1px 7px",fontSize:10,fontWeight:700}}>TNS</span>}
                          {isTnl && <span style={{background:"#dbeafe",color:"#1d4ed8",borderRadius:99,padding:"1px 7px",fontSize:10,fontWeight:700}}>TNL</span>}
                          {quoteViewBadge(p.id)}
                          {searchScope === "global" && p.location && (
                            <span style={{background:p.clinicId===clinicId?"#dcfce7":"#e0e7ff",color:p.clinicId===clinicId?"#15803d":"#3730a3",borderRadius:99,padding:"1px 7px",fontSize:10,fontWeight:700}}>
                              {p.location.replace(/^My Hearing Centers\s*[–-]\s*/,"")}
                            </span>
                          )}
                        </div>
                        <div style={{fontSize:11,color:"#9ca3af"}}>{p.phone}</div>
                      </td>
                      <td>
                        <div style={{fontWeight:500}}>{p.devices?.manufacturer} {p.devices?.family||p.devices?.model}</div>
                        <div style={{fontSize:11,color:"#9ca3af"}}>{p.devices?.fittingType||"Bilateral"} · {p.devices?.techLevel||""} {p.devices?.color ? "· "+p.devices.color : ""}</div>
                      </td>
                      <td>
                        <span className={`badge ${p.payType === "insurance" ? "insurance" : "private"}`}>
                          {p.payType === "insurance" ? p.insurance?.carrier || "Insurance" : "Private Pay"}
                        </span>
                      </td>
                      <td>
                        {isTns
                          ? <span style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>Quoted</span>
                          : isTnl
                          ? <span style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>Annual retest</span>
                          : <span className={`badge ${p.carePlan}`}>{CARE_PLANS.find(c=>c.id===p.carePlan)?.label||p.carePlan}</span>
                        }
                      </td>
                      <td>
                        {isTns ? (
                          <div style={{fontSize:12,color:"#d97706",fontWeight:600}}>Quoted</div>
                        ) : isTnl ? (
                          <div style={{fontSize:12,color:"#1d4ed8",fontWeight:600}}>No loss</div>
                        ) : p.devices?.pendingFitting ? (
                          <div style={{fontSize:12,color:"#1B8A7A",fontWeight:600}}>Awaiting fitting</div>
                        ) : (
                          <>
                            <div style={{fontSize:12,color: days<90?"#ef4444":days<360?"#f59e0b":"#16a34a",fontWeight:600}}>
                              {days < 0 ? "Expired" : `${days}d left`}
                            </div>
                            <div className="warranty-bar"><div className={`warranty-fill ${fillClass}`} style={{width:`${pct}%`}} /></div>
                          </>
                        )}
                      </td>
                      <td style={{fontSize:12,color:"#6b7280"}}>
                        {isTns
                          ? <span style={{color:"#d97706"}}>Quote {fmtDate(p.createdAt)}</span>
                          : isTnl
                          ? <span style={{color:"#1d4ed8"}}>Tested {fmtDate(p.createdAt)}</span>
                          : p.devices?.pendingFitting
                          ? <span style={{color:"#1B8A7A"}}>Est. fit {fmtDate(p.devices?.fittingDate)}</span>
                          : fmtDate(p.devices?.fittingDate||p.createdAt)
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
