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

// Patient Detail view (backlog #40d — extracted from Distil.jsx
// renderPatientDetail + PatientCampaignCard). Pure render extraction: chart
// state, edit drafts, and every handler live in ProviderCRM and arrive as
// props (see the destructure below), so behavior is unchanged.

import React, { useState, useEffect } from "react";
import Icon from "../components/Icon.jsx";
import AppointmentSchedule from "../components/AppointmentSchedule.jsx";
import UpgradeTrackingCard from "../components/UpgradeTrackingCard.jsx";
import CreateQuoteModal from "../components/CreateQuoteModal.jsx";
import PurchaseAgreementModal from "../components/PurchaseAgreementModal.jsx";
import SendMessageModal from "../components/SendMessageModal.jsx";
import FormsModal from "../components/FormsModal.jsx";
import TnsReasonsPicker from "../components/TnsReasonsPicker.jsx";
import { AudigramSVG, getDegreeName } from "../components/AudiogramSVG.jsx";
import IntakeResponsesAccordion from "./IntakeResponsesAccordion.jsx";
import NurturePreview from "./NurturePreview.jsx";
import { LegacyDevicePanel } from "./LegacyFastPath.jsx";
import { readPendingOutcome } from "./CloseAppointmentModal.jsx";
import { BODY_STYLES, CARE_PLANS, RECEIVER_LENGTHS, RECEIVER_POWERS, VISIT_TYPES } from "../lib/catalogConstants.js";
import { STEPS } from "../lib/wizardSteps.js";
import { getPTA, getPTA4, TNL_RETEST_TYPE } from "../lib/audiogram.js";
import { generateCounseling } from "../lib/counseling.js";
import { checkRole } from "../lib/staffUtils.js";
import { fmtDate, daysUntil } from "../lib/dates.js";
import { deriveEarPrice } from "../lib/pricing.js";
import { TNS_TAG_BY_ID } from "../tns_tags.js";
import {
  loadPatientCampaigns,
  getDocumentSignedUrl,
  deletePatientNote,
  recordUpgradeOutcome,
  addAppointment,
  updateAppointment,
  setAppointmentStatus,
  updatePatientStatus,
} from "../db.js";

function PatientCampaignCard({ patient, staffId: sid }) {
    const [campaigns, setCampaigns] = useState([]);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
      if (patient?.id) loadPatientCampaigns(patient.id).then(c => { setCampaigns(c); setLoaded(true); });
    }, [patient?.id]);
    if (!loaded) return null;
    const CAT_COLORS = { welcome:"#16a34a", education:"#1d4ed8", maintenance:"#92400e", lima_charlie:"#4338ca", upgrade:"#be185d", general:"#6b7280" };
    return (
      <div className="detail-card full">
        <div className="detail-card-title">Campaign Journey</div>
        {campaigns.length === 0 ? (
          <div style={{color:"#9ca3af",fontSize:13,padding:"12px 0"}}>No active campaigns. Patient will be auto-enrolled when saved with device data.</div>
        ) : campaigns.map(c => {
          const deliveries = c.campaign_deliveries || [];
          const delivered = deliveries.filter(d => d.status === "delivered").length;
          const total = deliveries.length;
          const pct = total ? (delivered / total) * 100 : 0;
          const next = deliveries.filter(d => d.status === "pending").sort((a,b) => a.scheduled_date.localeCompare(b.scheduled_date))[0];
          return (
            <div key={c.id} style={{marginBottom:16,padding:14,background:"#FAF8F2",borderRadius:10,border:"1px solid #E4E0D5"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:13,color:"#0a1628"}}>{c.campaign_templates?.name || "Campaign"}</div>
                <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:12,
                  background:c.status==="active"?"#dcfce7":c.status==="paused"?"#fef3c7":"#F0EDE3",
                  color:c.status==="active"?"#16a34a":c.status==="paused"?"#92400e":"#6b7280"}}>{c.status}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{flex:1,height:4,background:"#E4E0D5",borderRadius:2,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:"#16a34a",borderRadius:2}} />
                </div>
                <span style={{fontSize:11,color:"#9ca3af",whiteSpace:"nowrap"}}>{delivered}/{total} delivered</span>
              </div>
              {next && (
                <div style={{fontSize:11,color:"#6b7280"}}>
                  Next: <strong>{next.campaign_steps?.campaign_content?.title || "—"}</strong> on {fmtDate(next.scheduled_date)}
                </div>
              )}
              {/* Recent timeline */}
              <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:4}}>
                {deliveries.slice(0, 12).map((d, i) => {
                  const cat = d.campaign_steps?.campaign_content?.category || "general";
                  return (
                    <div key={i} title={`${d.campaign_steps?.campaign_content?.title || ""} (${d.status})`} style={{
                      width:8,height:8,borderRadius:"50%",
                      background: d.status==="delivered" ? (CAT_COLORS[cat] || "#6b7280") : d.status==="pending" ? "#E4E0D5" : "#fecaca",
                    }} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

export default function PatientDetail(props) {
  const {
    selectedPatient, setSelectedPatient, setView, clinic, clinicId, staffId, staffRole,
    myClinics, staffProfile, catalog, activePlans, productCatalogTiers, retailAnchorsByClass,
    clinicSwitching, handleClinicSwitch,
    archiveBusy, handleArchivePatient, handleRestorePatient,
    checkinBusy, handleCreateCheckinCode,
    profileTnsActive, setProfileTnsActive, patientTnsOutcome, handleTnsSaved,
    wizardDraft, wizardDraftSavedLabel, discardWizardDraft, resumeAppointment,
    setCloseAppointment, setVisitTypePicker, setShowConsultPicker,
    showCreateQuote, setShowCreateQuote,
    showPurchaseAgreement, setShowPurchaseAgreement, paPrefill, setPaPrefill,
    paClinic, paProvider, paSignatureB64, closerNeedsLocation, setShowCloserPicker,
    showSendNotification, setShowSendNotification,
    requireCurrentHearingTest, refreshPatients,
    editSection, editDraft, setEditDraft, editSaving, editError, editSuccess,
    editPlanSearch, setEditPlanSearch,
    startEditContact, startEditCoverage, startEditDevices, startEditCampaign,
    saveEditContact, saveEditCoverage, saveEditDevices, saveEditCampaign, cancelEdit,
    getSideDerived,
    punchData, punchConfirm, setPunchConfirm, punchSuccess, handlePunch, handleUndoPunch,
    patientCampaigns, campaignTimelineOpen, setCampaignTimelineOpen,
    patientDocuments, setPatientDocuments, refreshDocuments,
    patientMessages, expandedMessageId, setExpandedMessageId, refreshMessages,
    patientNotes, noteDraft, setNoteDraft, noteSaving, handleAddNote, refreshNotes,
  } = props;
    // Manufacturer Forms modal (backlog #42) — used only from this view, so
    // its visibility stays local rather than lifted to ProviderCRM.
    const [showForms, setShowForms] = useState(false);
    const p = selectedPatient;
    if (!p) return null;
    const days = daysUntil(p.devices?.warrantyExpiry||"");
    const aidedUrl = `${window.location.origin}/aided?pid=${encodeURIComponent(p.id)}`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(aidedUrl)}`;
    // Opened from an all-locations search: chart belongs to another clinic.
    const otherClinic = p.clinicId && clinicId && p.clinicId !== clinicId;
    const assignedElsewhere = otherClinic && myClinics.some(c => c.id === p.clinicId);
    return (
      <>
        {otherClinic && (
          <div style={{background:"#eef2ff",borderBottom:"1px solid #c7d2fe",padding:"8px 28px",fontSize:12,fontWeight:600,color:"#3730a3",display:"flex",alignItems:"center",gap:10}}>
            <Icon name="pin" size={14}/>
            This patient belongs to {p.location || "another clinic"}. Changes save to that clinic's records{assignedElsewhere ? "" : " — you are not assigned there, so edits will be blocked"}.
            {assignedElsewhere && (
              <button className="btn-ghost" style={{fontSize:11,marginLeft:"auto"}} disabled={clinicSwitching}
                onClick={() => handleClinicSwitch(p.clinicId)}>
                {clinicSwitching ? "Switching…" : `Switch to ${(p.location||"").replace(/^My Hearing Centers\s*[–-]\s*/,"") || "that clinic"}`}
              </button>
            )}
          </div>
        )}
        <div className="topbar">
          <div>
            <div className="topbar-title">{p.name}</div>
            <div className="topbar-sub">Patient ID: {p.id.slice(0,8).toUpperCase()} · {p.location} · Added {fmtDate(p.createdAt)}</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {p.patientStatus === "tns" ? (
              <>
                <span style={{background:"#fef3c7",color:"#92400e",borderRadius:99,padding:"4px 12px",fontSize:11,fontWeight:700}}>TNS</span>
                <button
                  className="btn-ghost"
                  style={{fontSize:11,color:"#b45309"}}
                  onClick={() => setProfileTnsActive(a => !a)}
                >
                  {profileTnsActive ? "Cancel" : "Tag Reasons"}
                </button>
              </>
            ) : p.patientStatus === "tnl" ? (
              <span style={{background:"#dbeafe",color:"#1d4ed8",borderRadius:99,padding:"4px 12px",fontSize:11,fontWeight:700}} title="Tested No Loss — hearing within normal limits at last test">TNL</span>
            ) : (
              <button
                className="btn-ghost"
                style={{fontSize:11,color:"#b45309"}}
                onClick={async () => {
                  try {
                    await updatePatientStatus(p.id, "tns");
                    setSelectedPatient({...p, patientStatus: "tns"});
                    setProfileTnsActive(true);
                    await refreshPatients();
                  } catch (e) { console.error("mark TNS:", e); }
                }}
              >
                Mark as TNS
              </button>
            )}
            <button
              style={{background:"#0B4A42",color:"white",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
              onClick={() => setCloseAppointment({ source: readPendingOutcome(p.id) ? "pending" : "profile" })}
              title="Close this appointment — log how today's visit ended"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Close Appointment
            </button>
            <button
              style={{background:"#0f766e",color:"white",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
              onClick={() => setVisitTypePicker(p)}
              title="Start a new visit — choose a returning-patient visit or a full new-patient appointment"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Start a New Visit
            </button>
            <button
              style={{background:"white",color:"#0f766e",border:"1px solid #0f766e",borderRadius:8,padding:"8px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:checkinBusy?"default":"pointer",opacity:checkinBusy?0.6:1,display:"flex",alignItems:"center",gap:6}}
              disabled={checkinBusy}
              onClick={() => handleCreateCheckinCode(p)}
              title="Generate a code the patient enters on the kiosk to review last year's answers before the visit"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"/></svg>
              {checkinBusy ? "Generating…" : "Kiosk Check-In Code"}
            </button>
            {p.audiology && (getPTA(p.audiology.rightT)!=null || getPTA(p.audiology.leftT)!=null) && (
              <button
                style={{background:"#4f46e5",color:"white",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
                onClick={() => setShowConsultPicker(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Consultation Mode
              </button>
            )}
            {/* "Generate Quote" (saved-config quote) removed — Custom Quote is
                now the single quote entry point so every printed quote is
                anchored to clinic retail pricing with any discount documented. */}
            <button
              style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:8,padding:"8px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
              onClick={() => setShowCreateQuote(true)}
              title="Custom quote — pick any devices, override pricing, archive to chart"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Custom Quote
            </button>
            <button
              style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
              onClick={() => requireCurrentHearingTest("devices")}
              title="Pick devices, pricing, and care plan, sign, and save the agreed configuration to the chart"
            >
              <span style={{fontSize:14}}>📄</span> Generate Purchase Agreement
            </button>
            <button
              style={{background:"#f1f5f9",color:"#475569",border:"1px solid #cbd5e1",borderRadius:8,padding:"8px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
              onClick={() => setShowSendNotification(true)}
              title="Send a message to this patient's Aided inbox (and push, if enabled)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Send Message
            </button>
            {p.archivedAt ? (
              <button
                style={{background:"#0f766e",color:"white",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:archiveBusy?"wait":"pointer",opacity:archiveBusy?0.6:1,display:"flex",alignItems:"center",gap:6}}
                disabled={archiveBusy}
                onClick={() => handleRestorePatient(p)}
                title="Restore this patient to the active list"
              >
                <Icon name="archive" size={15}/> {archiveBusy ? "Restoring\u2026" : "Restore"}
              </button>
            ) : (
              <button
                className="btn-ghost"
                style={{fontSize:12,display:"flex",alignItems:"center",gap:6,color:"#6b7280"}}
                disabled={archiveBusy}
                onClick={() => handleArchivePatient(p)}
                title="Archive \u2014 remove from the patient list & search (reversible)"
              >
                <Icon name="archive" size={15}/> {archiveBusy ? "Archiving\u2026" : "Archive"}
              </button>
            )}
            <button className="btn-ghost" onClick={()=>setView(p.archivedAt ? "archive" : "dashboard")}>{"\u2190"} Back</button>
          </div>
        </div>

        {/* Archived-chart banner: this patient is inactive; offer a one-tap
            restore right at the top of the chart. */}
        {p.archivedAt && (
          <div style={{background:"#f1f5f9",borderBottom:"1px solid #cbd5e1",padding:"8px 28px",fontSize:12,fontWeight:600,color:"#475569",display:"flex",alignItems:"center",gap:10}}>
            <Icon name="archive" size={14}/>
            Archived {fmtDate(p.archivedAt)} {"\u2014"} hidden from the patient list &amp; search.
            <button className="btn-ghost" style={{fontSize:11,marginLeft:"auto",color:"#0f766e"}} disabled={archiveBusy}
              onClick={() => handleRestorePatient(p)}>
              {archiveBusy ? "Restoring\u2026" : "Restore to active list"}
            </button>
          </div>
        )}

        {/* In-progress appointment for THIS patient — the same snapshot the
            dashboard offers (lib/wizardDraft.js), surfaced on the chart so
            navigating away mid-visit always has a way back in from here. */}
        {wizardDraft?.wizardPatientId === p.id && (
          <div style={{ margin: "12px 24px 0" }}>
            <div className="table-card" style={{ borderLeft: "4px solid #2563eb", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0a1628" }}>
                  {"⏸"} Appointment in progress
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {wizardDraft.wizardMode === "upgrade" ? "Upgrade purchase" : "New patient"} · {STEPS[wizardDraft.step] || "Patient"} step · saved {wizardDraftSavedLabel(wizardDraft)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => {
                  if (window.confirm(`Discard the in-progress appointment with ${p.name}? Anything already saved stays on this chart.`)) discardWizardDraft();
                }}>Discard</button>
                <button className="btn-primary" onClick={resumeAppointment}>Resume appointment →</button>
              </div>
            </div>
          </div>
        )}

        {/* Disposition-missing nag — the patient was finalized but the outcome
            insert failed (see handleWizardCloseAppointment). Stays until the
            stashed disposition is logged. */}
        {readPendingOutcome(p.id) && (
          <div style={{ margin: "12px 24px 0" }}>
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"12px 18px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#92400e",textTransform:"uppercase",letterSpacing:"0.06em"}}>Disposition missing</span>
              <span style={{fontSize:12,color:"#92400e",flex:1,minWidth:200}}>
                The last appointment was closed but its outcome didn't save. Log it now so the visit counts.
              </span>
              <button
                style={{background:"#B5832E",color:"white",border:"none",borderRadius:8,padding:"7px 14px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer"}}
                onClick={() => setCloseAppointment({ source: "pending" })}
              >
                Log Disposition
              </button>
            </div>
          </div>
        )}

        {p.patientStatus === "tnl" && (() => {
          // Next scheduled annual retest — the TNL path's whole follow-up plan.
          const upcoming = (p.appointments || [])
            .filter(a => a.type === TNL_RETEST_TYPE && daysUntil(a.date) >= 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
          return (
            <div style={{ margin: "12px 24px 0" }}>
              <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"12px 18px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <span style={{fontSize:12,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase",letterSpacing:"0.06em"}}>Tested No Loss</span>
                <span style={{fontSize:12,color:"#1e40af",flex:1,minWidth:200}}>
                  Hearing within normal limits at the last test — the audiogram below is their baseline.
                  {upcoming
                    ? ` Annual retest scheduled ${fmtDate(upcoming.date)}.`
                    : " No upcoming retest on the schedule — consider adding one."}
                </span>
              </div>
            </div>
          );
        })()}

        {p.patientStatus === "tns" && patientTnsOutcome && !profileTnsActive && (
          <div style={{ margin: "12px 24px 0" }}>
            <div style={{
              background: "#fffbeb", padding: "14px 18px",
              borderRadius: 8, border: "1px solid #fde68a",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  TNS Reasons
                </div>
                <div style={{ fontSize: 11, color: "#92400e" }}>
                  Tagged {fmtDate(patientTnsOutcome.created_at)}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(patientTnsOutcome.outcome_reasons || []).map(rid => {
                  const tag = TNS_TAG_BY_ID[rid];
                  if (!tag) return null;
                  return (
                    <span key={rid} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", background: "#fef3c7",
                      border: "1px solid #fde68a", borderRadius: 99,
                      fontSize: 12, fontWeight: 600, color: "#92400e",
                    }}>
                      <span>{tag.emoji}</span> {tag.label}
                    </span>
                  );
                })}
              </div>
              {patientTnsOutcome.outcome_notes && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#78350f", fontStyle: "italic" }}>
                  "{patientTnsOutcome.outcome_notes}"
                </div>
              )}
            </div>
          </div>
        )}

        {profileTnsActive && (
          <div style={{ margin: "12px 24px 0" }}>
            <TnsReasonsPicker
              patientId={p.id}
              patientName={p.name}
              clinicId={clinicId}
              staffId={staffId}
              onSaved={() => handleTnsSaved(p.id)}
              onCancel={() => setProfileTnsActive(false)}
            />
          </div>
        )}

        {showCreateQuote && (
          <CreateQuoteModal
            patient={p}
            clinic={staffProfile?.clinic || clinic}
            staffProfile={staffProfile}
            clinicId={clinicId}
            staffId={staffId}
            catalog={catalog}
            insurancePlans={activePlans}
            productCatalogTiers={productCatalogTiers}
            anchorsByClass={retailAnchorsByClass}
            resolveRetailPerAid={(side) => {
              // Clinic retail anchor for a device side — manufacturer class ×
              // tech-level rank, the same resolution private-pay deriveEarPrice
              // uses. Lets the Custom Quote anchor discounts to clinic retail
              // regardless of the patient's pay type.
              if (!side || !side.familyId || !side.techLevel) return null;
              const ep = deriveEarPrice(side, {
                form: { payType: "private" },
                catalog,
                productCatalogTiers,
                anchorsByClass: retailAnchorsByClass,
                plans: activePlans,
              });
              return ep && ep.price != null ? ep.price : null;
            }}
            onClose={() => setShowCreateQuote(false)}
            onArchived={() => { refreshDocuments?.(); }}
            onConvertToAgreement={(state) => {
              setShowCreateQuote(false);
              setPaPrefill(state);
              setShowPurchaseAgreement(true);
            }}
          />
        )}

        {showForms && (
          <FormsModal
            patient={p}
            clinic={paClinic}
            provider={paProvider}
            clinicId={clinicId}
            staffId={staffId}
            onClose={() => setShowForms(false)}
            onArchived={() => { refreshDocuments?.(); }}
          />
        )}

        {showSendNotification && (
          <SendMessageModal
            patient={p}
            staffId={staffId}
            clinicId={clinicId}
            onClose={() => setShowSendNotification(false)}
            onSent={() => { refreshMessages?.(); }}
          />
        )}

        {/* ── PURCHASE AGREEMENT MODAL ──────────────────────────────────── */}
        {showPurchaseAgreement && (
          <PurchaseAgreementModal
            patient={p}
            clinic={paClinic}
            provider={paProvider}
            signatureImageBase64={paSignatureB64}
            clinicId={clinicId}
            staffId={staffId}
            catalog={catalog}
            insurancePlans={activePlans}
            productCatalogTiers={productCatalogTiers}
            anchorsByClass={retailAnchorsByClass}
            resolveRetailPerAid={(side) => {
              // Clinic retail anchor for a device side — same resolution the
              // Custom Quote uses, so agreement discounts anchor to the real
              // clinic price regardless of the patient's pay type.
              if (!side || !side.familyId || !side.techLevel) return null;
              const ep = deriveEarPrice(side, {
                form: { payType: "private" },
                catalog,
                productCatalogTiers,
                anchorsByClass: retailAnchorsByClass,
                plans: activePlans,
              });
              return ep && ep.price != null ? ep.price : null;
            }}
            initialState={paPrefill}
            closerNeedsLocation={closerNeedsLocation}
            onNeedLocation={() => { alert("Set your dispensing location in the sidebar before generating a purchase agreement."); setShowCloserPicker(true); }}
            onClose={() => { setShowPurchaseAgreement(false); setPaPrefill(null); }}
            onArchived={() => { refreshDocuments?.(); }}
            onChartSaved={async (patch) => {
              // Optimistic merge so the open chart reflects the agreement
              // immediately; the roster refresh pulls the canonical rows.
              setSelectedPatient({ ...p, ...patch });
              try { await refreshPatients(); } catch (e) { console.error("refreshPatients:", e); }
            }}
          />
        )}

        <div className="content">
          {p.patientStatus === "tns" && (
            <div style={{
              background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,
              padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10
            }}>
              <span style={{fontSize:18}}>{"\u{1F4CB}"}</span>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#92400e"}}>Quote Only {"\u2014"} No Purchase Agreement Signed</div>
                <div style={{fontSize:11,color:"#b45309"}}>This patient received a quote but has not committed. Devices shown are quoted, not fitted.</div>
              </div>
            </div>
          )}
          <div className="qr-prompt">
            <div className="qr-title">Patient App QR Code</div>
            <div className="qr-sub">Patient scans this to load their profile in the Aided companion app</div>
            <div className="qr-box">
              <img src={qrImgUrl} alt="QR code to open Aided patient app" width={100} height={100} style={{borderRadius:4}} />
            </div>
            <div className="qr-id">{p.id.slice(0,8).toUpperCase()}</div>
            <div className="qr-inst">Patient ID · Scan to open Aided</div>
          </div>


          <div className="detail-grid">
            {/* ── CONTACT INFORMATION ─────────────────────────────────────── */}
            <div className="detail-card">
              <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
                <div className="detail-card-title" style={{marginBottom:0}}>Contact Information</div>
                {editSection !== "contact" && checkRole(staffRole, ["care_coordinator","provider","closer","admin"]) && (
                  <button className="btn-ghost" style={{marginLeft:"auto",fontSize:11,padding:"4px 10px"}} onClick={startEditContact}>Edit</button>
                )}
              </div>
              {editSection === "contact" ? (
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>First Name</label><input value={editDraft.firstName} onChange={e=>setEditDraft(d=>({...d,firstName:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Last Name</label><input value={editDraft.lastName} onChange={e=>setEditDraft(d=>({...d,lastName:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Date of Birth</label><input type="date" value={editDraft.dob} onChange={e=>setEditDraft(d=>({...d,dob:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Phone</label><input value={editDraft.phone} onChange={e=>setEditDraft(d=>({...d,phone:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Email</label><input value={editDraft.email} onChange={e=>setEditDraft(d=>({...d,email:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:6}}>Pay Type</label>
                    <div style={{display:"flex",gap:8}}>
                      {[["insurance","Insurance"],["private","Private Pay"]].map(([val,label])=>(
                        <div key={val} onClick={()=>setEditDraft(d=>({...d,payType:val}))} style={{flex:1,border:`2px solid ${editDraft.payType===val?"#0a1628":"#E4E0D5"}`,borderRadius:10,padding:"10px",cursor:"pointer",textAlign:"center",background:editDraft.payType===val?"#FBF9F3":"white",transition:"all 0.15s"}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#0a1628"}}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:6}}>Preferred Language</label>
                    <div style={{display:"flex",gap:8}}>
                      {[["en","English"],["es","Español"]].map(([val,label])=>(
                        <div key={val} onClick={()=>setEditDraft(d=>({...d,preferredLanguage:val}))} style={{flex:1,border:`2px solid ${editDraft.preferredLanguage===val?"#0a1628":"#E4E0D5"}`,borderRadius:10,padding:"10px",cursor:"pointer",textAlign:"center",background:editDraft.preferredLanguage===val?"#FBF9F3":"white",transition:"all 0.15s"}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#0a1628"}}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{marginBottom:4}}>
                    <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Notes</label>
                    <textarea value={editDraft.notes} onChange={e=>setEditDraft(d=>({...d,notes:e.target.value}))} rows={3} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box"}} />
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
                    <button onClick={saveEditContact} disabled={editSaving} style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 18px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:editSaving?"wait":"pointer",opacity:editSaving?0.7:1}}>{editSaving?"Saving…":"Save Changes"}</button>
                    <button onClick={cancelEdit} style={{background:"none",border:"1px solid #E4E0D5",borderRadius:8,padding:"8px 14px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",color:"#6b7280"}}>Cancel</button>
                    {editError && <span style={{fontSize:12,color:"#ef4444"}}>{editError}</span>}
                    {editSuccess && <span style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✓ {editSuccess}</span>}
                  </div>
                </div>
              ) : (
                <div>
                  {[["Name",p.name],["Date of Birth",p.dob?fmtDate(p.dob):"—"],["Phone",p.phone||"—"],["Email",p.email||"—"]].map(([k,v])=>(
                    <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v}</span></div>
                  ))}
                  {p.payType && <div className="detail-row"><span className="detail-key">Pay Type</span><span className="detail-val">{p.payType==="insurance"?"Insurance":"Private Pay"}</span></div>}
                  <div className="detail-row"><span className="detail-key">Language</span><span className="detail-val">{p.preferredLanguage==="es"?"Español":"English"}</span></div>
                  {p.notes && <div className="detail-row"><span className="detail-key">Notes</span><span className="detail-val" style={{whiteSpace:"pre-wrap"}}>{p.notes}</span></div>}
                </div>
              )}
            </div>

            {/* ── COVERAGE ────────────────────────────────────────────────── */}
            <div className="detail-card">
              <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
                <div className="detail-card-title" style={{marginBottom:0}}>Coverage</div>
                {editSection !== "coverage" && checkRole(staffRole, ["care_coordinator","provider","closer","admin"]) && (
                  <button className="btn-ghost" style={{marginLeft:"auto",fontSize:11,padding:"4px 10px"}} onClick={startEditCoverage}>Edit</button>
                )}
              </div>
              {editSection === "coverage" ? (
                <div>
                  {/* Insurance plan search — reuses same component pattern as Step 0 of new patient form */}
                  <div style={{background:"#FBF9F3",border:"1px solid #E4E0D5",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:10}}>Insurance Plan Search</div>
                    <input
                      placeholder="Search carrier or plan name…"
                      value={editPlanSearch}
                      onChange={e=>setEditPlanSearch(e.target.value)}
                      style={{width:"100%",marginBottom:8,padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}
                    />
                    <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:5,paddingRight:2}}>
                      {activePlans
                        .filter(plan=>{const q=(editPlanSearch||"").toLowerCase();return !q||plan.carrier.toLowerCase().includes(q)||plan.planGroup.toLowerCase().includes(q)||(plan.tpa||"").toLowerCase().includes(q);})
                        .sort((a,b)=>a.planGroup.localeCompare(b.planGroup))
                        .slice(0,30)
                        .map(plan=>(
                          <div key={`${plan.carrier}:${plan.planGroup}`}
                            className={`plan-row ${editDraft.planGroup===plan.planGroup&&editDraft.carrier===plan.carrier?"active":""}`}
                            onClick={()=>setEditDraft(d=>({...d,carrier:plan.carrier,planGroup:plan.planGroup,tpa:plan.tpa||"",tier:"",tierPrice:null}))}>
                            <div className="plan-row-name">{plan.planGroup}</div>
                            <div className="plan-row-tpa">{plan.carrier}{plan.tpa ? ` · via ${plan.tpa}` : " · direct"}</div>
                          </div>
                        ))}
                    </div>
                    {editDraft.planGroup && (
                      <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #E4E0D5",display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>TPA</span>
                        <span style={{fontSize:13,fontWeight:600,color:"#374151",background:"#F0EDE3",borderRadius:6,padding:"3px 10px"}}>{editDraft.tpa || "None — direct"}</span>
                        <button style={{marginLeft:"auto",fontSize:11,color:"#9ca3af",background:"none",border:"none",cursor:"pointer",padding:0}}
                          onClick={()=>setEditDraft(d=>({...d,carrier:"",planGroup:"",tpa:"",tier:"",tierPrice:null}))}>✕ Clear</button>
                      </div>
                    )}
                  </div>
                  {/* Individual field overrides */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Carrier</label><input value={editDraft.carrier} onChange={e=>setEditDraft(d=>({...d,carrier:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>TPA</label><input value={editDraft.tpa} onChange={e=>setEditDraft(d=>({...d,tpa:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Tier</label><input value={editDraft.tier} onChange={e=>setEditDraft(d=>({...d,tier:e.target.value}))} placeholder="e.g. Level 3" style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Copay ($/aid)</label><input type="number" value={editDraft.tierPrice??""} onChange={e=>setEditDraft(d=>({...d,tierPrice:e.target.value?Number(e.target.value):null}))} placeholder="e.g. 999" style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    {/* Warranty is owned by the fitting — edit it in Device Specifications.
                        Editing it here too used to write insurance_coverage only, silently
                        diverging from the device_fittings value the chart displays. */}
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Warranty Expiry</label>
                      <div style={{padding:"8px 10px",border:"1px dashed #E4E0D5",borderRadius:8,fontSize:13,color:"#6b7280",background:"#FBF9F3"}}>
                        {p.devices?.warrantyExpiry ? fmtDate(p.devices.warrantyExpiry) : "—"} <span style={{fontSize:11,color:"#9ca3af"}}>· edit under Device Specifications</span>
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Care Plan</label>
                      <select value={editDraft.carePlanType} onChange={e=>setEditDraft(d=>({...d,carePlanType:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",background:"white",boxSizing:"border-box"}}>
                        <option value="">— None —</option>
                        {CARE_PLANS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
                    <button onClick={saveEditCoverage} disabled={editSaving} style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 18px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:editSaving?"wait":"pointer",opacity:editSaving?0.7:1}}>{editSaving?"Saving…":"Save Changes"}</button>
                    <button onClick={cancelEdit} style={{background:"none",border:"1px solid #E4E0D5",borderRadius:8,padding:"8px 14px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",color:"#6b7280"}}>Cancel</button>
                    {editError && <span style={{fontSize:12,color:"#ef4444"}}>{editError}</span>}
                    {editSuccess && <span style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✓ {editSuccess}</span>}
                  </div>
                </div>
              ) : (
                <div>
                  {p.payType==="insurance" ? (<>
                    {[
                      ["Carrier",p.insurance?.carrier],["Plan",p.insurance?.planGroup],["TPA",p.insurance?.tpa],["Tier",p.insurance?.tier],["Copay",p.insurance?.tierPrice!=null?`$${p.insurance.tierPrice.toLocaleString()}/aid`:null]
                    ].map(([k,v])=>(
                      <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v||"—"}</span></div>
                    ))}
                    <div className="detail-row"><span className="detail-key">Care Plan</span><span className="detail-val">{CARE_PLANS.find(c=>c.id===p.carePlan)?.label||"—"}</span></div>
                  </>) : (<>
                    {[
                      ["Type","Private Pay"],
                      ["Tier",p.privatePay?.tier],
                      ["Per aid",p.privatePay?.tierPrice!=null?`$${p.privatePay.tierPrice.toLocaleString()}/aid`:null],
                      ["Care Plan","Complete Care+ included"],
                    ].map(([k,v])=>(
                      <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v||"—"}</span></div>
                    ))}
                  </>)}
                  {p.devices?.warrantyExpiry && <div className="detail-row"><span className="detail-key">Warranty Expiry</span><span className="detail-val">{fmtDate(p.devices.warrantyExpiry)}</span></div>}
                </div>
              )}
            </div>

            {/* ── DEVICE SPECIFICATIONS ────────────────────────────────────── */}
            <div className="detail-card full">
              <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
                <div className="detail-card-title" style={{marginBottom:0}}>{p.patientStatus === "tns" ? "Quoted Devices" : "Device Specifications"}</div>
                {editSection !== "devices" && checkRole(staffRole, ["provider","closer","admin"]) && (
                  <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                    {p.devices && p.devices.fittingStatus !== "cancelled" && (
                      <button className="btn-ghost" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setShowForms(true)}>Forms</button>
                    )}
                    <button className="btn-ghost" style={{fontSize:11,padding:"4px 10px"}} onClick={startEditDevices}>Edit</button>
                  </div>
                )}
              </div>
              {p.devices?.pendingFitting && (
                <div style={{display:"flex",alignItems:"center",gap:10,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                  <Icon name="clock" size={16}/>
                  <div style={{fontSize:12,color:"#92400e",lineHeight:1.5,flex:1}}>
                    <strong>Fitting pending.</strong> Agreement signed {p.devices.recordedAt ? fmtDate(p.devices.recordedAt) : "—"} · estimated fitting {fmtDate(p.devices.fittingDate)}.
                    The warranty, care schedule, and nurture campaigns start when the fitting is confirmed.
                  </div>
                  <button className="btn-ghost" style={{fontSize:11,padding:"5px 12px",whiteSpace:"nowrap"}} onClick={()=>setView("pending-fittings")}>
                    Open Pending Fittings
                  </button>
                </div>
              )}
              {/* Only surfaces when the cancelled sale is the chart's sole fitting
                  (assemblePatient prefers live rows) — i.e. a first-time purchaser
                  who rescinded before delivery. */}
              {p.devices?.fittingStatus === "cancelled" && (
                <div style={{display:"flex",alignItems:"center",gap:10,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                  <div style={{fontSize:12,color:"#6b7280",lineHeight:1.5,flex:1}}>
                    <strong>Sale cancelled before fitting</strong>{p.devices.cancelledAt ? ` on ${fmtDate(p.devices.cancelledAt)}` : ""}
                    {p.devices.cancelReason ? ` — ${p.devices.cancelReason.replace(/_/g," ")}` : ""}. The devices below are the
                    configuration from the cancelled agreement; no warranty applies. See the Notes card for details.
                  </div>
                </div>
              )}
              {editSection === "devices" ? (
                <div>
                  {/* Fitting-level fields */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:8}}>Fitting Info</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                      <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Fitting Type</label>
                        <select value={editDraft.fittingType} onChange={e=>setEditDraft(d=>({...d,fittingType:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",background:"white",boxSizing:"border-box"}}>
                          {["Bilateral","Monaural Left","Monaural Right","CROS/BiCROS"].map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Serial (L)</label><input value={editDraft.serialLeft} onChange={e=>setEditDraft(d=>({...d,serialLeft:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                      <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Serial (R)</label><input value={editDraft.serialRight} onChange={e=>setEditDraft(d=>({...d,serialRight:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                      <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Warranty Expiry</label><input type="date" value={editDraft.warrantyExpiry} onChange={e=>setEditDraft(d=>({...d,warrantyExpiry:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    </div>
                  </div>
                  {/* Per-side device fields — cascading dropdowns */}
                  {[["left","👂 Left Ear"],["right","Right Ear 👂"]].map(([side, sideLabel])=>{
                    const sd = editDraft[side] || {};
                    const hasSide = !!(side==="left" ? selectedPatient._ids?.leftSideId : selectedPatient._ids?.rightSideId);
                    if (!hasSide && !sd.manufacturer && !sd.style) return null;
                    const derived = getSideDerived(sd);
                    const { availMfrs, availGens, availFamilies, selectedFamily, availColors, availBatteries, availPowers, availDomes } = derived;
                    const requiresEarmold = availPowers.find(p=>p.id===sd.receiverPower)?.earmold === true;
                    const variantRequired = (selectedFamily?.variants?.length || 0) > 1;
                    const selSty = {width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",background:"white",boxSizing:"border-box"};
                    const lblSty = {fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4};
                    const updSD = (updates) => setEditDraft(d=>({...d,[side]:{...d[side],...updates}}));
                    return (
                      <div key={side} style={{marginBottom:14,paddingBottom:14,borderTop:"1px solid #F0EDE3",paddingTop:14}}>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:8}}>{sideLabel}</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>

                          {/* Body Style */}
                          <div><label style={lblSty}>Body Style</label>
                            <select value={sd.style||""} onChange={e=>updSD({style:e.target.value,manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:""})} style={selSty}>
                              <option value="">Select…</option>
                              {BODY_STYLES.map(bs=><option key={bs.id} value={bs.id}>{bs.label}</option>)}
                            </select>
                          </div>

                          {/* Manufacturer */}
                          <div><label style={lblSty}>Manufacturer</label>
                            <select value={sd.manufacturer||""} onChange={e=>updSD({manufacturer:e.target.value,generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:""})} style={selSty} disabled={!sd.style}>
                              <option value="">Select…</option>
                              {availMfrs.map(m=><option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>

                          {/* Platform / Generation */}
                          <div><label style={lblSty}>Platform</label>
                            <select value={sd.generation||""} onChange={e=>updSD({generation:e.target.value,familyId:"",variant:"",techLevel:"",color:"",battery:""})} style={selSty} disabled={!sd.manufacturer}>
                              <option value="">Select…</option>
                              {availGens.map(g=><option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>

                          {/* Model Family */}
                          <div><label style={lblSty}>Model Family</label>
                            <select value={sd.familyId||""} onChange={e=>{
                              const fam = catalog.find(f=>f.id===e.target.value);
                              const autoVar = fam?.variants?.length===1 ? fam.variants[0] : "";
                              const autoBat = fam?.battery?.length===1 ? fam.battery[0] : "";
                              updSD({familyId:e.target.value,variant:autoVar,techLevel:"",color:"",battery:autoBat});
                            }} style={selSty} disabled={!sd.generation}>
                              <option value="">Select…</option>
                              {availFamilies.map(fam=><option key={fam.id} value={fam.id}>{fam.family}</option>)}
                            </select>
                          </div>

                          {/* Variant (only if multiple) */}
                          {variantRequired && (
                            <div><label style={lblSty}>Variant</label>
                              <select value={sd.variant||""} onChange={e=>updSD({variant:e.target.value})} style={selSty}>
                                <option value="">Select…</option>
                                {selectedFamily.variants.map(v=><option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                          )}

                          {/* Tech Level */}
                          <div><label style={lblSty}>Tech Level</label>
                            <select value={sd.techLevel||""} onChange={e=>updSD({techLevel:e.target.value})} style={selSty} disabled={!sd.familyId}>
                              <option value="">Select…</option>
                              {(selectedFamily?.techLevels||[]).map(t=><option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>

                          {/* Color */}
                          {availColors.length > 0 && (
                            <div><label style={lblSty}>Color</label>
                              <select value={sd.color||""} onChange={e=>updSD({color:e.target.value})} style={selSty}>
                                <option value="">Select…</option>
                                {availColors.map(c=><option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          )}

                          {/* Battery (only if multiple) */}
                          {availBatteries.length > 1 && (
                            <div><label style={lblSty}>Battery</label>
                              <select value={sd.battery||""} onChange={e=>updSD({battery:e.target.value})} style={selSty}>
                                <option value="">Select…</option>
                                {availBatteries.map(b=><option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                          )}

                          {/* RIC: Receiver Length, Power, Dome */}
                          {sd.style === "ric" && sd.techLevel && (<>
                            <div><label style={lblSty}>Receiver Length</label>
                              <select value={sd.receiverLength||""} onChange={e=>updSD({receiverLength:e.target.value})} style={selSty}>
                                <option value="">Select…</option>
                                {RECEIVER_LENGTHS.map(l=><option key={l} value={l}>{l}</option>)}
                              </select>
                            </div>
                            <div><label style={lblSty}>Receiver Power</label>
                              <select value={sd.receiverPower||""} onChange={e=>{updSD({receiverPower:e.target.value,dome:""});}} style={selSty}>
                                <option value="">Select…</option>
                                {availPowers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                              </select>
                            </div>
                            {sd.receiverPower && !requiresEarmold && (
                              <div><label style={lblSty}>Dome / Coupling</label>
                                <select value={sd.dome||""} onChange={e=>updSD({dome:e.target.value})} style={selSty}>
                                  <option value="">Select…</option>
                                  {availDomes.map(dm=><option key={dm} value={dm}>{dm}</option>)}
                                </select>
                              </div>
                            )}
                            {sd.receiverPower && requiresEarmold && (
                              <div style={{display:"flex",alignItems:"center",fontSize:12,color:"#854d0e",fontWeight:600,background:"#fef9c3",borderRadius:8,padding:"8px 12px"}}>
                                Earmold required
                              </div>
                            )}
                          </>)}

                          {/* IF: Dome only, no receiver */}
                          {sd.style === "if" && sd.techLevel && availDomes.length > 0 && (
                            <div><label style={lblSty}>Dome / Coupling</label>
                              <select value={sd.dome||""} onChange={e=>updSD({dome:e.target.value})} style={selSty}>
                                <option value="">Select…</option>
                                {availDomes.map(dm=><option key={dm} value={dm}>{dm}</option>)}
                              </select>
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
                    <button onClick={saveEditDevices} disabled={editSaving} style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 18px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:editSaving?"wait":"pointer",opacity:editSaving?0.7:1}}>{editSaving?"Saving…":"Save Changes"}</button>
                    <button onClick={cancelEdit} style={{background:"none",border:"1px solid #E4E0D5",borderRadius:8,padding:"8px 14px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",color:"#6b7280"}}>Cancel</button>
                    {editError && <span style={{fontSize:12,color:"#ef4444"}}>{editError}</span>}
                    {editSuccess && <span style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✓ {editSuccess}</span>}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>Fitting Type</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#0a1628",background:"#F0EDE3",borderRadius:6,padding:"2px 8px"}}>{p.devices?.fittingType||"Bilateral"}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  {[p.devices?.left, p.devices?.right].map((side, idx) => {
                    const sideLabel = idx===0 ? "👂 Left Ear" : "Right Ear 👂";
                    if (!side) return (
                      <div key={idx}><div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:6,paddingBottom:4,borderBottom:"1px solid #E4E0D5"}}>{sideLabel}</div><div style={{color:"#9ca3af",fontSize:13,padding:"8px 0"}}>Not configured</div></div>
                    );
                    const isTH = side.manufacturer === "TruHearing";
                    const pwrLabel = isTH
                      ? (side.gainMatrix || side.receiverPower || "—")
                      : ((RECEIVER_POWERS[side.manufacturer]||[]).find(pw=>pw.id===side.receiverPower)?.label || side.receiverPower || "—");
                    // Stored coupling wins (#42a) — assembleSide shims legacy
                    // 'Custom Earmold' dome rows to coupling='earmold'. The
                    // receiver-power fallback covers pre-#42a standard-catalog
                    // sides; TH sides previously hardcoded isEm=false here
                    // (inconsistent with the wizard review) — the stored
                    // coupling now answers for both flows.
                    const isEm = side.coupling
                      ? side.coupling === "earmold"
                      : (isTH ? false : (RECEIVER_POWERS[side.manufacturer]||[]).find(pw=>pw.id===side.receiverPower)?.earmold);
                    const emVal = "Custom Earmold" + (side.earmoldStyle
                      ? ` — ${[side.earmoldStyle, side.earmoldMaterial, side.earmoldVent && `${side.earmoldVent} vent`].filter(Boolean).join(" · ")}`
                      : "");
                    const domeVal = isEm ? emVal
                      : isTH
                      ? (side.domeCategory && side.domeSize ? `${side.domeCategory} ${side.domeSize}` : side.domeCategory || side.dome || "N/A")
                      : (side.dome || "N/A");
                    return (
                      <div key={idx}>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:6,paddingBottom:4,borderBottom:"1px solid #E4E0D5"}}>{sideLabel}</div>
                        {[["Manufacturer",side.manufacturer],["Model",side.family||"—"],["Tech Level",side.techLevel||"—"],["Body Style",BODY_STYLES.find(s=>s.id===side.style)?.label||side.style],["Color",side.color||"N/A"],["Battery",side.battery||"—"],
                          ...(side.style==="ric"||side.style==="ric_bct"||side.style==="sr" ? [["Receiver Length",side.receiverLength||"—"],["Receiver Power",pwrLabel]] : []),
                          ...(BODY_STYLES.find(b=>b.id===side.style)?.hasDome||side.style==="ric_bct"||side.style==="sr" ? [["Dome / Coupling",domeVal]] : []),
                        ].map(([k,v])=>(
                          <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v||"—"}</span></div>
                        ))}
                      </div>
                    );
                  })}
                  </div>
                  <div style={{borderTop:"1px solid #F0EDE3",paddingTop:12,display:"grid",gridTemplateColumns:"1fr 1fr"}}>
                    {[["Serial (L)",p.devices?.serialLeft],["Serial (R)",p.devices?.serialRight],
                      ["Fitting Date",p.devices?.pendingFitting ? `Est. ${fmtDate(p.devices?.fittingDate)} — not yet fit` : fmtDate(p.devices?.fittingDate||p.createdAt)],
                      ["Warranty Expires",p.devices?.warrantyExpiry ? fmtDate(p.devices.warrantyExpiry) : (p.devices?.pendingFitting ? `${p.devices?.warrantyYears||3} years from fit date` : null)],
                      ["Warranty Status",p.devices?.warrantyExpiry ? (days<0?"Expired":`${days} days remaining`) : (p.devices?.pendingFitting ? "Starts at fitting" : null)]].map(([k,v])=>(
                      <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val" style={k==="Warranty Status"&&p.devices?.warrantyExpiry?{color:days<0?"#ef4444":days<90?"#f59e0b":"#16a34a"}:{}}>{v||"—"}</span></div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* ── PRIOR / OUTSIDE DEVICES — legacy fast-path + What's-Changed ── */}
            <LegacyDevicePanel patientId={p.id} staffId={staffId} />
            {/* ── AUDIOGRAM & EDUCATION PANEL ── */}
            {p.audiology && (getPTA(p.audiology.rightT)!=null || getPTA(p.audiology.leftT)!=null || p.audiology.unaidedR!=null || p.audiology.cctR!=null || p.audiology.cctL!=null || p.audiology.sinBin!=null) && (() => {
              const aud = p.audiology;
              const sections = generateCounseling(aud);
              const rPTA = getPTA(aud.rightT);
              const lPTA = getPTA(aud.leftT);
              const rPTA4 = getPTA4(aud.rightT);
              const lPTA4 = getPTA4(aud.leftT);
              return (
                <>
                  {/* Audiogram display — two-column: scores left, chart right */}
                  <div className="detail-card full">
                    <div className="detail-card-title">Hearing Evaluation</div>
                    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:16}}>
                      {/* Left column: score cards stacked */}
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {rPTA!=null&&(
                          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#dc2626",marginBottom:2}}>Right PTA</div>
                            <div style={{fontSize:20,fontWeight:800,color:"#0a1628",lineHeight:1}}>{rPTA} <span style={{fontSize:10,fontWeight:400,color:"#9ca3af"}}>dB HL</span></div>
                            <div style={{fontSize:10,color:"#dc2626",fontWeight:600,marginTop:2}}>{getDegreeName(rPTA4)}</div>
                            {rPTA4!=null&&<div style={{fontSize:9,color:"#9ca3af",marginTop:2}}>PTA4 {rPTA4} dB</div>}
                          </div>
                        )}
                        {lPTA!=null&&(
                          <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#2563eb",marginBottom:2}}>Left PTA</div>
                            <div style={{fontSize:20,fontWeight:800,color:"#0a1628",lineHeight:1}}>{lPTA} <span style={{fontSize:10,fontWeight:400,color:"#9ca3af"}}>dB HL</span></div>
                            <div style={{fontSize:10,color:"#2563eb",fontWeight:600,marginTop:2}}>{getDegreeName(lPTA4)}</div>
                            {lPTA4!=null&&<div style={{fontSize:9,color:"#9ca3af",marginTop:2}}>PTA4 {lPTA4} dB</div>}
                          </div>
                        )}
                        {(aud.unaidedR!=null||aud.unaidedL!=null)&&(
                          <div style={{background:"#FAF8F2",border:"1px solid #E4E0D5",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:2}}>CCT Unaided</div>
                            {aud.unaidedR!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>R: {aud.unaidedR}%</div>}
                            {aud.unaidedL!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>L: {aud.unaidedL}%</div>}
                          </div>
                        )}
                        {(aud.wrMclR!=null||aud.wrMclL!=null)&&(
                          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#16a34a",marginBottom:2}}>WR @ MCL</div>
                            {aud.wrMclR!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>R: {aud.wrMclR}%</div>}
                            {aud.wrMclL!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>L: {aud.wrMclL}%</div>}
                          </div>
                        )}
                        {(aud.cctR!=null||aud.cctL!=null)&&(
                          <div style={{background:"#fdf4ff",border:"1px solid #e9d5ff",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#7c3aed",marginBottom:2}}>CCT @ 45dB</div>
                            {aud.cctR!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>R: {aud.cctR}%
                              <span style={{fontSize:10,fontWeight:400,color:aud.cctR>=70?"#16a34a":aud.cctR>=50?"#ca8a04":"#dc2626",marginLeft:6}}>
                                {aud.cctR>=70?"Good":aud.cctR>=50?"Reduced":"Poor"}
                              </span>
                            </div>}
                            {aud.cctL!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>L: {aud.cctL}%
                              <span style={{fontSize:10,fontWeight:400,color:aud.cctL>=70?"#16a34a":aud.cctL>=50?"#ca8a04":"#dc2626",marginLeft:6}}>
                                {aud.cctL>=70?"Good":aud.cctL>=50?"Reduced":"Poor"}
                              </span>
                            </div>}
                          </div>
                        )}
                        {(aud.aidedR!=null||aud.aidedL!=null)&&(
                          <div style={{background:"#FAF8F2",border:"1px solid #E4E0D5",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:2}}>WRS @ MCL</div>
                            {aud.aidedR!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>R: {aud.aidedR}%</div>}
                            {aud.aidedL!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>L: {aud.aidedL}%</div>}
                          </div>
                        )}
                        {aud.sinBin!=null&&(
                          <div style={{background:"#FAF8F2",border:"1px solid #E4E0D5",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:2}}>QuickSIN</div>
                            <div style={{fontSize:20,fontWeight:800,color:"#0a1628",lineHeight:1}}>{aud.sinBin} <span style={{fontSize:10,fontWeight:400,color:"#9ca3af"}}>dB SNR</span></div>
                            <div style={{fontSize:10,fontWeight:600,marginTop:2,
                              color:aud.sinBin<=2?"#16a34a":aud.sinBin<=7?"#ca8a04":aud.sinBin<=15?"#ea580c":"#dc2626"}}>
                              {aud.sinBin<=2?"Near-normal":aud.sinBin<=7?"Mild":aud.sinBin<=15?"Moderate":"Severe"}
                            </div>
                          </div>
                        )}
                        {(aud.tinnitusRight||aud.tinnitusLeft)&&(
                          <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#92400e",marginBottom:2}}>Tinnitus</div>
                            <div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>
                              {aud.tinnitusRight&&aud.tinnitusLeft?"Bilateral":aud.tinnitusRight?"Right":"Left"}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Right column: audiogram chart */}
                      <div style={{background:"#fafafa",border:"1px solid #E4E0D5",borderRadius:10,padding:"12px 8px"}}>
                        <AudigramSVG rightT={aud.rightT||{}} leftT={aud.leftT||{}} rightBC={aud.rightBC||{}} leftBC={aud.leftBC||{}} rightMask={aud.rightMask||{}} leftMask={aud.leftMask||{}} rightBCMask={aud.rightBCMask||{}} leftBCMask={aud.leftBCMask||{}} interactive={false}/>
                      </div>
                    </div>
                  </div>


                </>
              );
            })()}


            <AppointmentSchedule
              appointments={p.appointments}
              visitTypes={VISIT_TYPES}
              onAdd={async (fields) => {
                const row = await addAppointment(selectedPatient.id, clinicId, fields, staffId);
                setSelectedPatient(sp => ({ ...sp, appointments: [...(sp.appointments || []), row] }));
                await refreshPatients();
              }}
              onUpdate={async (id, fields) => {
                await updateAppointment(id, fields);
                setSelectedPatient(sp => ({ ...sp, appointments: sp.appointments.map(a => a.id === id ? { ...a, ...fields } : a) }));
                await refreshPatients();
              }}
              onSetStatus={async (id, status) => {
                await setAppointmentStatus(id, status);
                setSelectedPatient(sp => ({ ...sp, appointments: sp.appointments.map(a => a.id === id ? { ...a, status } : a) }));
                await refreshPatients();
              }}
            />


            {/* ── PERSONALIZATION PREVIEW (read-only) ──────────────────────────────── */}
            {patientCampaigns.length > 0 && patientCampaigns.map(campaign => (
              <NurturePreview
                key={`prev-${campaign.id}`}
                patientId={selectedPatient.id}
                clinicId={clinicId}
                campaign={campaign}
              />
            ))}
            {/* ── DOCUMENTS ───────────────────────────────────────────────────────── */}
            {/* Archived PDFs: quotes, purchase agreements, kiosk intake receipts.   */}
            {/* Signed URLs are short-lived (1h); the card calls refreshDocuments    */}
            {/* after each upload and on patient-detail entry.                       */}
            {patientDocuments.length > 0 && (
              <div className="detail-card full">
                <div className="detail-card-title">Documents</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {patientDocuments.map(d => {
                    const kindLabel = d.kind === 'purchase_agreement' ? 'Purchase Agreement'
                                    : d.kind === 'kiosk_intake' ? 'Intake Form'
                                    : d.kind === 'medical_referral' ? 'Medical Referral'
                                    : d.kind === 'manufacturer_form' ? 'Manufacturer Form'
                                    : 'Quote';
                    const kindColor = d.kind === 'purchase_agreement' ? '#0a1628'
                                    : d.kind === 'kiosk_intake' ? '#7c3aed'
                                    : d.kind === 'medical_referral' ? '#be123c'
                                    : d.kind === 'manufacturer_form' ? '#b45309'
                                    : '#15803d';
                    const kindBg    = d.kind === 'purchase_agreement' ? '#e2e8f0'
                                    : d.kind === 'kiosk_intake' ? '#ede9fe'
                                    : d.kind === 'medical_referral' ? '#ffe4e6'
                                    : d.kind === 'manufacturer_form' ? '#fef3c7'
                                    : '#dcfce7';
                    const sizeKb = d.byte_size ? Math.round(d.byte_size / 1024) : null;
                    return (
                      <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#FAF8F2",borderRadius:8,border:"1px solid #E4E0D5"}}>
                        <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:kindBg,color:kindColor,letterSpacing:0.4,textTransform:"uppercase"}}>{kindLabel}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#0a1628",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.file_name}</div>
                          <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>
                            {fmtDate(d.created_at)}{sizeKb ? ` · ${sizeKb} KB` : ""}
                          </div>
                        </div>
                        {d.signedUrl ? (
                          <a href={d.signedUrl} target="_blank" rel="noopener noreferrer"
                             onClick={async (e) => {
                               // Signed URLs expire 1h after fetch. If the page has been
                               // open longer than ~50min, re-sign on click so the link
                               // doesn't 401. Background the refresh into a new tab to
                               // avoid hijacking middle-click / Ctrl+click behavior.
                               const ageMs = Date.now() - (d.signedUrlAt || 0);
                               if (ageMs <= 50 * 60 * 1000) return;
                               e.preventDefault();
                               try {
                                 const fresh = await getDocumentSignedUrl(d.storage_path);
                                 if (fresh) {
                                   setPatientDocuments(rows => rows.map(r =>
                                     r.id === d.id ? { ...r, signedUrl: fresh, signedUrlAt: Date.now() } : r
                                   ));
                                   window.open(fresh, "_blank", "noopener,noreferrer");
                                 }
                               } catch (err) {
                                 console.error("getDocumentSignedUrl:", err);
                               }
                             }}
                             style={{fontSize:12,fontWeight:600,color:"#0a1628",background:"white",border:"1px solid #E4E0D5",borderRadius:6,padding:"6px 12px",textDecoration:"none"}}>
                            Open ↗
                          </a>
                        ) : (
                          <span style={{fontSize:11,color:"#9ca3af"}}>link expired</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── NOTES (interaction log) ────────────────────────────────────────── */}
            {/* Timestamped, append-only log of interactions: call attempts,         */}
            {/* voicemails, walk-ins, device drop-offs. Author + timestamp are       */}
            {/* stamped server-side; entries can be deleted (active clinic only)     */}
            {/* but never edited, so the log stays a trustworthy record.             */}
            <div className="detail-card full">
              <div style={{display:"flex",alignItems:"center",marginBottom:14}}>
                <div className="detail-card-title" style={{marginBottom:0}}>Notes</div>
                <div style={{marginLeft:"auto",fontSize:11,color:"#9ca3af"}}>
                  {patientNotes.length} entr{patientNotes.length === 1 ? "y" : "ies"}
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:12}}>
                <textarea
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddNote(); } }}
                  placeholder="Log an interaction — call attempt, voicemail, walk-in, device drop-off…"
                  rows={2}
                  style={{flex:1,fontFamily:"inherit",fontSize:13,lineHeight:1.5,padding:"10px 12px",border:"1px solid #E4E0D5",borderRadius:8,resize:"vertical",background:"#FAF8F2",color:"#0a1628"}}
                />
                <button
                  disabled={noteSaving || !noteDraft.trim()}
                  onClick={handleAddNote}
                  title="Add a timestamped note to this patient's log (Ctrl+Enter)"
                  style={{background:"#0f766e",color:"white",border:"none",borderRadius:8,padding:"10px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:(noteSaving || !noteDraft.trim())?"default":"pointer",opacity:(noteSaving || !noteDraft.trim())?0.5:1,whiteSpace:"nowrap"}}
                >
                  {noteSaving ? "Saving…" : "Add Note"}
                </button>
              </div>
              {patientNotes.length === 0 ? (
                <div style={{fontSize:13,color:"#9ca3af",fontStyle:"italic",padding:"4px 0"}}>
                  No notes yet. Entries are timestamped automatically.
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {patientNotes.map(n => (
                    <div key={n.id} style={{padding:"10px 14px",background:"#FAF8F2",borderRadius:8,border:"1px solid #E4E0D5"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#9ca3af"}}>
                          {fmtDate(n.createdAt)} · {new Date(n.createdAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}
                          {n.staffName ? <span style={{fontWeight:400}}> · {n.staffName}</span> : null}
                        </div>
                        <button
                          title="Delete this note"
                          onClick={async () => {
                            if (!window.confirm("Delete this note? The log is append-only — deleted entries can't be recovered.")) return;
                            try {
                              await deletePatientNote(n.id);
                              await refreshNotes();
                            } catch (e) { console.error("deletePatientNote:", e); }
                          }}
                          style={{marginLeft:"auto",background:"none",border:"none",color:"#cbd5e1",fontSize:14,cursor:"pointer",padding:"0 2px",lineHeight:1}}
                        >
                          ×
                        </button>
                      </div>
                      <div style={{fontSize:13,color:"#374151",lineHeight:1.55,marginTop:4,whiteSpace:"pre-wrap"}}>{n.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── COMMUNICATION ──────────────────────────────────────────────────── */}
            {/* Inbox messages we've sent to the patient's Aided app. Each row       */}
            {/* shows title, sent timestamp, push delivery, and read state. Click    */}
            {/* to expand the full body. Subsumes future SMS / email rows.           */}
            <div className="detail-card full">
              <div style={{display:"flex",alignItems:"center",marginBottom:14}}>
                <div className="detail-card-title" style={{marginBottom:0}}>Communication</div>
                <div style={{marginLeft:"auto",fontSize:11,color:"#9ca3af"}}>
                  {patientMessages.length} message{patientMessages.length === 1 ? "" : "s"}
                </div>
              </div>
              {patientMessages.length === 0 ? (
                <div style={{fontSize:13,color:"#9ca3af",fontStyle:"italic",padding:"4px 0"}}>
                  No messages sent yet. Use "Send Message" above to start one.
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {patientMessages.map(m => {
                    const expanded = expandedMessageId === m.id;
                    const pushed = !!m.push_fired_at;
                    const fromPatient = m.sender_role === "patient";
                    // read_at semantics flip with direction: on clinic-sent
                    // rows it's "patient read it"; on patient-sent rows it's
                    // "clinic handled it" (see migration 20260705120000).
                    const readBadge = fromPatient
                      ? (m.read_at
                          ? { label: `Handled ${fmtDate(m.read_at)}`, bg: "#dcfce7", color: "#15803d" }
                          : { label: "New from patient",              bg: "#dbeafe", color: "#1e40af" })
                      : m.read_at
                        ? { label: `Read ${fmtDate(m.read_at)}`, bg: "#dcfce7", color: "#15803d" }
                        : pushed
                          ? { label: "Delivered · unread",       bg: "#fef3c7", color: "#92400e" }
                          : { label: "Inbox only · unread",      bg: "#e0e7ff", color: "#3730a3" };
                    return (
                      <div key={m.id}
                        onClick={() => setExpandedMessageId(expanded ? null : m.id)}
                        style={{padding:"12px 14px",background:fromPatient?"#f0f7ff":"#FAF8F2",borderRadius:8,border:`1px solid ${fromPatient?"#bfdbfe":"#E4E0D5"}`,cursor:"pointer",transition:"background 0.15s"}}
                      >
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:"#0a1628",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {fromPatient ? "Message from patient" : m.title}
                            </div>
                            <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>
                              {fromPatient
                                ? `Received ${fmtDate(m.created_at)} · ${m.channel === "email" ? "email" : "Aided app"}`
                                : <>Sent {fmtDate(m.created_at)}{pushed && m.push_sent_count > 0 ? ` · pushed to ${m.push_sent_count} device${m.push_sent_count === 1 ? "" : "s"}` : ""}</>}
                            </div>
                          </div>
                          <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,background:readBadge.bg,color:readBadge.color,letterSpacing:0.4,textTransform:"uppercase",whiteSpace:"nowrap"}}>
                            {readBadge.label}
                          </span>
                          <span style={{fontSize:11,color:"#9ca3af",marginLeft:4}}>{expanded ? "▲" : "▼"}</span>
                        </div>
                        {expanded && (
                          <div style={{fontSize:13,color:"#374151",lineHeight:1.55,marginTop:10,paddingTop:10,borderTop:"1px dashed #E4E0D5",whiteSpace:"pre-wrap"}}>
                            {m.body}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── UPGRADE TRACKING ─────────────────────────────────────────────────── */}
            {/* Year-4 / off-warranty conversation outcome. Surfaces in the           */}
            {/* follow-up queue's "off warranty · no upgrade conversation" bucket;    */}
            {/* logging an outcome here removes the patient from that bucket.        */}
            {selectedPatient.devices && (
              <UpgradeTrackingCard
                patient={selectedPatient}
                onSave={async (fields) => {
                  await recordUpgradeOutcome(selectedPatient.id, fields);
                  setSelectedPatient(p => ({
                    ...p,
                    ...(fields.tierOffered !== undefined ? { upgradeTierOffered: fields.tierOffered } : {}),
                    ...(fields.outcome !== undefined ? { upgradeOutcome: fields.outcome } : {}),
                    ...(fields.donationRecipient !== undefined ? { donationRecipient: fields.donationRecipient } : {}),
                  }));
                  await refreshPatients();
                }}
              />
            )}


            {/* ── CAMPAIGN JOURNEY ─────────────────────────────────────────────────── */}
            {patientCampaigns.length > 0 && patientCampaigns.map(campaign => {
              const deliveries = (campaign.campaign_deliveries || [])
                .sort((a,b) => (a.campaign_steps?.step_order ?? 0) - (b.campaign_steps?.step_order ?? 0));
              const completedCount = deliveries.filter(d => d.status === "sent" || d.status === "delivered").length;
              const totalCount = deliveries.length;
              const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
              const isEditingThis = editSection === "campaign" && editDraft?.campaignId === campaign.id;
              return (
                <div key={campaign.id} className="detail-card full">
                  <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
                    <div className="detail-card-title" style={{marginBottom:0}}>
                      Nurture Campaign
                      <span style={{fontSize:11,fontWeight:400,color:"#9ca3af",marginLeft:8}}>{campaign.campaign_templates?.name || "Campaign"}</span>
                    </div>
                    {!isEditingThis && checkRole(staffRole, ["care_coordinator","admin"]) && (
                      <button className="btn-ghost" style={{marginLeft:"auto",fontSize:11,padding:"4px 10px"}} onClick={()=>startEditCampaign(campaign)}>Edit</button>
                    )}
                  </div>

                  {isEditingThis ? (
                    <div>
                      {/* Status control */}
                      <div style={{marginBottom:14}}>
                        <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:6}}>Campaign Status</label>
                        <div style={{display:"flex",gap:8}}>
                          {[["active","▶ Active"],["paused","⏸ Paused"],["cancelled","✕ Cancelled"]].map(([val,label])=>(
                            <div key={val} onClick={()=>setEditDraft(d=>({...d,status:val}))} style={{padding:"8px 16px",border:`2px solid ${editDraft.status===val?"#0a1628":"#E4E0D5"}`,borderRadius:10,cursor:"pointer",background:editDraft.status===val?"#FBF9F3":"white",transition:"all 0.15s",fontSize:13,fontWeight:600,color:editDraft.status===val?"#0a1628":"#6b7280"}}>
                              {label}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Trigger date */}
                      <div style={{marginBottom:14}}>
                        <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Trigger Date (campaign start anchor)</label>
                        <input type="date" value={editDraft.triggerDate} onChange={e=>setEditDraft(d=>({...d,triggerDate:e.target.value}))} style={{padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none"}} />
                        <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>Changing this date shifts all pending deliveries forward or backward relative to their original schedule.</div>
                      </div>
                      {/* Per-delivery scheduled dates */}
                      {editDraft.deliveries?.length > 0 && (
                        <div style={{marginBottom:14}}>
                          <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:8}}>Delivery Schedule</label>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {editDraft.deliveries.map((d,i) => (
                              <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#FAF8F2",borderRadius:8,border:"1px solid #E4E0D5"}}>
                                <span style={{fontSize:11,fontWeight:700,color:"#9ca3af",width:20,flexShrink:0}}>#{d.stepOrder}</span>
                                <span style={{fontSize:12,color:"#374151",flex:1}}>{d.channel || "Message"} · Day {d.delayDays}</span>
                                <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,fontWeight:600,background:d.status==="sent"||d.status==="delivered"?"#dcfce7":d.status==="pending"?"#fef9c3":"#fee2e2",color:d.status==="sent"||d.status==="delivered"?"#16a34a":d.status==="pending"?"#854d0e":"#dc2626"}}>{d.status}</span>
                                <input type="date" value={d.scheduledDate} onChange={e=>{const ds=[...editDraft.deliveries];ds[i]={...ds[i],scheduledDate:e.target.value};setEditDraft(dd=>({...dd,deliveries:ds}));}} style={{padding:"5px 8px",border:"1px solid #E4E0D5",borderRadius:6,fontFamily:"'Sora',sans-serif",fontSize:12,outline:"none"}} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
                        <button onClick={saveEditCampaign} disabled={editSaving} style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 18px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:editSaving?"wait":"pointer",opacity:editSaving?0.7:1}}>{editSaving?"Saving…":"Save Changes"}</button>
                        <button onClick={cancelEdit} style={{background:"none",border:"1px solid #E4E0D5",borderRadius:8,padding:"8px 14px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",color:"#6b7280"}}>Cancel</button>
                        {editError && <span style={{fontSize:12,color:"#ef4444"}}>{editError}</span>}
                        {editSuccess && <span style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✓ {editSuccess}</span>}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Status + progress bar */}
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                        <span style={{fontSize:12,fontWeight:700,padding:"3px 12px",borderRadius:20,border:"1px solid",background:campaign.status==="active"?"#dcfce7":campaign.status==="paused"?"#fef9c3":"#F0EDE3",color:campaign.status==="active"?"#16a34a":campaign.status==="paused"?"#854d0e":"#6b7280",borderColor:campaign.status==="active"?"#bbf7d0":campaign.status==="paused"?"#fde68a":"#E4E0D5"}}>
                          {campaign.status==="active"?"▶ Active":campaign.status==="paused"?"⏸ Paused":"✕ Cancelled"}
                        </span>
                        <span style={{fontSize:12,color:"#6b7280"}}>{completedCount} of {totalCount} steps completed</span>
                        {campaign.trigger_date && <span style={{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}>Started {fmtDate(campaign.trigger_date)}</span>}
                      </div>
                      {totalCount > 0 && (
                        <div style={{background:"#F0EDE3",borderRadius:20,height:6,marginBottom:14,overflow:"hidden"}}>
                          <div style={{height:"100%",background:"#16a34a",borderRadius:20,width:`${progressPct}%`,transition:"width 0.3s"}} />
                        </div>
                      )}
                      {/* Delivery timeline — collapsed to the next pending step by
                          default (AppointmentSchedule pattern); expands to the full arc. */}
                      {deliveries.length > 0 && (() => {
                        const nextPending = deliveries.find(d => d.status === "pending") || null;
                        const open = !!campaignTimelineOpen[campaign.id];
                        const shown = open ? deliveries : (nextPending ? [nextPending] : []);
                        const hiddenCount = deliveries.length - shown.length;
                        return (
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {shown.map(d => (
                              <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#FAF8F2",borderRadius:8,border:"1px solid #E4E0D5"}}>
                                <div style={{width:20,height:20,borderRadius:"50%",background:d.status==="sent"||d.status==="delivered"?"#16a34a":d.status==="pending"?"#E4E0D5":"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                  {(d.status==="sent"||d.status==="delivered") && <span style={{color:"white",fontSize:10,fontWeight:700}}>✓</span>}
                                </div>
                                <span style={{fontSize:12,color:"#374151",flex:1}}>
                                  {d.campaign_steps?.delivery_channel || "Message"} · Day {d.campaign_steps?.delay_days ?? "?"}
                                  {!open && nextPending && d.id === nextPending.id && (
                                    <span style={{marginLeft:6,fontSize:9,fontWeight:700,color:"#854d0e",background:"#fef9c3",borderRadius:4,padding:"1px 5px",letterSpacing:0.5}}>NEXT</span>
                                  )}
                                </span>
                                <span style={{fontSize:11,color:"#9ca3af"}}>{d.scheduled_date ? fmtDate(d.scheduled_date) : "—"}</span>
                                <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,fontWeight:600,background:d.status==="sent"||d.status==="delivered"?"#dcfce7":d.status==="pending"?"#fef9c3":"#fee2e2",color:d.status==="sent"||d.status==="delivered"?"#16a34a":d.status==="pending"?"#854d0e":"#dc2626"}}>{d.status}</span>
                              </div>
                            ))}
                            {(hiddenCount > 0 || open) && (
                              <button
                                onClick={() => setCampaignTimelineOpen(prev => ({ ...prev, [campaign.id]: !open }))}
                                style={{background:"none",border:"none",color:"#1d4ed8",fontFamily:"'Sora',sans-serif",fontSize:11,fontWeight:600,cursor:"pointer",padding:"2px 0 0",textAlign:"left"}}>
                                {open ? "Show less" : `Show full timeline (${hiddenCount} more)`}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}

            {/* PUNCH CARD PANEL — only for punch plan patients */}
            {p.carePlan === "punch" && (() => {
              const cleanLeft = 12 - punchData.cleanings;
              const apptLeft = 16 - punchData.appointments;
              const totalLeft = cleanLeft + apptLeft;
              const recentLog = [...(punchData.log||[])].reverse().slice(0, 6);
              return (
                <div className="detail-card full">
                  <div className="detail-card-title">Punch Card</div>
                  <div className="punch-panel">
                    <div className="punch-panel-header">
                      <div>
                        <div className="punch-panel-title">MHC Punch Card</div>
                        <div className="punch-panel-sub">Log a visit during the appointment · Patient sees balance update live</div>
                      </div>
                      <div className="punch-remaining">
                        <div className="punch-remaining-num">{totalLeft}</div>
                        <div className="punch-remaining-label">visits left</div>
                      </div>
                    </div>


                    {/* CLEANINGS */}
                    <div className="punch-row">
                      <div className="punch-row-label">
                        🧹 Cleanings
                        <span>{punchData.cleanings}/12 used · {cleanLeft} remaining</span>
                      </div>
                      <div className="punch-dots">
                        {Array.from({length:12},(_,i)=>(
                          <div key={i} className={`punch-dot ${i < punchData.cleanings ? "used":""}`}>{i < punchData.cleanings ? "✓":""}</div>
                        ))}
                      </div>
                      <div className="punch-actions">
                        {punchSuccess === "cleaning" ? (
                          <div className="punch-success">✓ Cleaning visit punched!</div>
                        ) : punchConfirm === "cleaning" ? (
                          <>
                            <button className="punch-btn confirm" onClick={()=>handlePunch("cleaning")}>Confirm punch</button>
                            <button className="punch-btn" onClick={()=>setPunchConfirm(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className="punch-btn" disabled={cleanLeft === 0} onClick={()=>setPunchConfirm("cleaning")}>
                              {cleanLeft === 0 ? "All used" : "Punch cleaning visit"}
                            </button>
                            {punchData.cleanings > 0 && <span className="punch-undo" onClick={()=>handleUndoPunch("cleaning")}>undo last</span>}
                          </>
                        )}
                      </div>
                    </div>


                    <div className="punch-divider" />


                    {/* APPOINTMENTS */}
                    <div className="punch-row" style={{marginBottom:0}}>
                      <div className="punch-row-label">
                        📅 Appointments
                        <span>{punchData.appointments}/16 used · {apptLeft} remaining</span>
                      </div>
                      <div className="punch-dots">
                        {Array.from({length:16},(_,i)=>(
                          <div key={i} className={`punch-dot ${i < punchData.appointments ? "used":""}`}>{i < punchData.appointments ? "✓":""}</div>
                        ))}
                      </div>
                      <div className="punch-actions">
                        {punchSuccess === "appointment" ? (
                          <div className="punch-success">✓ Appointment visit punched!</div>
                        ) : punchConfirm === "appointment" ? (
                          <>
                            <button className="punch-btn confirm" onClick={()=>handlePunch("appointment")}>Confirm punch</button>
                            <button className="punch-btn" onClick={()=>setPunchConfirm(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className="punch-btn" disabled={apptLeft === 0} onClick={()=>setPunchConfirm("appointment")}>
                              {apptLeft === 0 ? "All used" : "Punch appointment visit"}
                            </button>
                            {punchData.appointments > 0 && <span className="punch-undo" onClick={()=>handleUndoPunch("appointment")}>undo last</span>}
                          </>
                        )}
                      </div>
                    </div>


                    {/* VISIT LOG */}
                    {recentLog.length > 0 && (
                      <>
                        <div className="punch-divider" />
                        <div className="punch-log-title">Recent Visit Log</div>
                        {recentLog.map((entry,i)=>(
                          <div className="punch-log-row" key={i}>
                            <span className="punch-log-type">{entry.type === "cleaning" ? "🧹 Cleaning" : "📅 Appointment"}</span>
                            <span className="punch-log-date">{new Date(entry.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}</span>
                          </div>
                        ))}
                      </>
                    )}


                    {totalLeft === 0 && (
                      <div style={{marginTop:16,background:"rgba(27,138,122,0.1)",border:"1px solid rgba(27,138,122,0.2)",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#1B8A7A",fontWeight:600,textAlign:"center"}}>
                        All 28 visits used · Discuss renewal options with patient
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── INTAKE RESPONSES ─────────────────────────────────────── */}
            <IntakeResponsesAccordion patientId={p.id} />
          </div>
        </div>
      </>
    );
}
