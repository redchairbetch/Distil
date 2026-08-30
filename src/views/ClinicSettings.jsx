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

// Clinic Settings view (backlog #40e — extracted from Distil.jsx renderSettings).
// Pure render extraction: all state and the multi-state handlers (clinic save,
// anchors save, signature upload, patient delete) stay in ProviderCRM and
// arrive as props, so behavior is unchanged.

import React from "react";
import { checkRole } from "../lib/staffUtils.js";
import { formatMoney } from "../lib/format.js";
import { seedDefaultCampaign, backfillCampaignEnrollment } from "../db.js";
import { MFR_KEYS, MFR_DISPLAY } from "../lib/manufacturerKeys.js";

const ACCENT_COLORS = [
  { label:"Green",   value:"#16a34a" },
  { label:"Blue",    value:"#2563eb" },
  { label:"Violet",  value:"#7c3aed" },
  { label:"Rose",    value:"#e11d48" },
  { label:"Amber",   value:"#d97706" },
  { label:"Teal",    value:"#0d9488" },
];

// Beltone deliberately excluded — we lack proprietary auth (Rexton-only per CLAUDE.md).
// 'standard' is the manufacturer-agnostic retail tier for clinic-wide pricing
// (kept first so existing legacy rows are immediately visible/editable).
const MANUFACTURER_CLASSES = [
  { value:"standard", label:"Standard (general retail)" },
  { value:"signia",   label:"Signia"  },
  { value:"rexton",   label:"Rexton"  },
  { value:"phonak",   label:"Phonak"  },
  { value:"oticon",   label:"Oticon"  },
  { value:"starkey",  label:"Starkey" },
  { value:"widex",    label:"Widex"   },
];

export default function ClinicSettings({
  clinicId, staffId, staffRole,
  clinicSaved, clinicDraft, setClinicDraft, handleClinicSave,
  staffProfile, providerSignatureB64, sigBusy, sigErr, handleSignatureUpload,
  anchorsClass, setAnchorsClass, anchorsLoading, anchorsDraft, setAnchorsDraft,
  anchorsSaved, handleSaveAnchors, focusedMoneyKey, setFocusedMoneyKey,
  patients,
  deleteSearch, setDeleteSearch, deleteTarget, setDeleteTarget,
  deleteConfirmText, setDeleteConfirmText, deleteBusy, deleteError, setDeleteError,
  deleteDone, setDeleteDone, handleDeletePatient,
}) {
  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Clinic Settings</div>
          <div className="topbar-sub">Customize how Distil appears to your team and patients</div>
        </div>
      </div>
      <div className="content">
        <div className="settings-wrap">
          {clinicSaved && <div className="save-success">✓ Settings saved — patient app updated</div>}


          <div className="settings-section">
            <div className="settings-title">Clinic Preview</div>
            <div className="settings-preview">
              <div>
                <div className="distil-badge">Distil</div>
                <div className="settings-preview-logo">{clinicDraft.name || "Your Clinic"}</div>
                <div className="settings-preview-sub">{clinicDraft.address}</div>
              </div>
              <div style={{marginLeft:"auto",width:16,height:16,borderRadius:"50%",background:clinicDraft.accent,flexShrink:0}} />
            </div>


            <div className="settings-field">
              <label>Clinic Name</label>
              <input value={clinicDraft.name} onChange={e=>setClinicDraft(d=>({...d,name:e.target.value}))} placeholder="Your Hearing Clinic" />
            </div>
            <div className="settings-field">
              <label>Address</label>
              <input value={clinicDraft.address} onChange={e=>setClinicDraft(d=>({...d,address:e.target.value}))} placeholder="123 Main St, City, ST 00000" />
            </div>
            <div className="settings-field">
              <label>Phone</label>
              <input value={clinicDraft.phone} onChange={e=>setClinicDraft(d=>({...d,phone:e.target.value}))} placeholder="(555) 555-5555" />
            </div>
            <div className="settings-field">
              <label>Fax</label>
              <input value={clinicDraft.fax || ""} onChange={e=>setClinicDraft(d=>({...d,fax:e.target.value}))} placeholder="(555) 555-5556" />
            </div>
            <div className="settings-field">
              <label>Accent Color</label>
              <div className="color-options">
                {ACCENT_COLORS.map(c=>(
                  <div key={c.value} className={`color-option ${clinicDraft.accent===c.value?"active":""}`}
                    style={{background:c.value}} title={c.label}
                    onClick={()=>setClinicDraft(d=>({...d,accent:c.value}))} />
                ))}
              </div>
            </div>
          </div>


          <div className="settings-section">
            <div className="settings-title">My Signature</div>
            <div style={{fontSize:12,color:"#9ca3af",marginBottom:12}}>
              Appears on the purchase agreements you generate.{staffProfile?.activeLicense ? ` License on file: ${staffProfile.activeLicense}.` : ""}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
              <div style={{width:240,height:90,border:"1px solid #E4E0D5",borderRadius:10,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                {providerSignatureB64
                  ? <img src={providerSignatureB64} alt="Your signature" style={{maxWidth:"92%",maxHeight:"80%",objectFit:"contain"}} />
                  : <span style={{fontSize:12,color:"#cbd5e1"}}>No signature yet</span>}
              </div>
              <div>
                <label className="btn-primary" style={{cursor:sigBusy?"wait":"pointer",display:"inline-block"}}>
                  {sigBusy ? "Uploading…" : providerSignatureB64 ? "Replace Signature" : "Upload Signature"}
                  <input type="file" accept="image/png,image/jpeg" style={{display:"none"}} disabled={sigBusy}
                    onChange={e=>{ const f=e.target.files?.[0]; if(f) handleSignatureUpload(f); e.target.value=""; }} />
                </label>
                <div style={{fontSize:11,color:"#9ca3af",marginTop:6,maxWidth:240}}>PNG or JPG on a white background. We scale it down automatically.</div>
                {sigErr && <div style={{fontSize:12,color:"#ef4444",marginTop:6}}>{sigErr}</div>}
              </div>
            </div>
          </div>


          <div className="settings-section">
            <div className="settings-title">Manufacturer Accounts</div>
            <div style={{fontSize:12,color:"#9ca3af",marginBottom:12,lineHeight:1.5}}>
              Bill-to and ship-to account numbers per manufacturer. These auto-fill the
              repair, loss &amp; damage, and order forms generated from a patient's chart.
              Leave a manufacturer blank if you don't hold an account. Saved with Save Settings below.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"110px 1fr 1fr",gap:"6px 10px",alignItems:"center",fontSize:10,color:"#9ca3af",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>
              <div></div><div>Bill-to account #</div><div>Ship-to account #</div>
            </div>
            {MFR_KEYS.map(k => {
              const acct = clinicDraft.manufacturerAccounts?.[k] || {};
              const setAcct = (field, value) => setClinicDraft(d => ({
                ...d,
                manufacturerAccounts: {
                  ...(d.manufacturerAccounts || {}),
                  [k]: { ...(d.manufacturerAccounts?.[k] || {}), [field]: value },
                },
              }));
              const cellStyle = {padding:"6px 10px",borderRadius:6,border:"1px solid #E4E0D5",fontSize:13,fontFamily:"'Sora',sans-serif"};
              return (
                <div key={k} style={{display:"grid",gridTemplateColumns:"110px 1fr 1fr",gap:"6px 10px",alignItems:"center",marginTop:6}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#374151"}}>{MFR_DISPLAY[k]}</div>
                  <input style={cellStyle} value={acct.billTo || ""} onChange={e=>setAcct("billTo", e.target.value)} placeholder="—" />
                  <input style={cellStyle} value={acct.shipTo || ""} onChange={e=>setAcct("shipTo", e.target.value)} placeholder="same as bill-to" />
                </div>
              );
            })}
          </div>


          <div className="settings-section">
            <div className="settings-title">Campaign Administration</div>
            <div style={{fontSize:12,color:"#9ca3af",marginBottom:12}}>Set up the default nurture campaign and backfill existing patients.</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button className="btn-primary" onClick={async ()=>{
                const result = await seedDefaultCampaign(clinicId, staffId);
                if (result) alert("Default campaign seeded! Check the Campaigns view.");
                else alert("Campaign already exists or error occurred.");
              }}>Seed Default Campaign</button>
              <button className="btn-ghost" onClick={async ()=>{
                const result = await backfillCampaignEnrollment(clinicId, staffId);
                alert(`Backfill complete: ${result.enrolled} enrolled, ${result.skipped} skipped.${result.error ? ' ' + result.error : ''}`);
              }}>Backfill Existing Patients</button>
            </div>
          </div>


          <div className="settings-section">
            <div className="settings-title">Retail Anchors</div>
            <div style={{fontSize:12,color:"#9ca3af",marginBottom:14}}>
              Per-tier retail price per aid, by manufacturer class. Drives the "full retail value" anchor on the patient pricing reveal.
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <label style={{fontSize:12,color:"#6b7280",fontWeight:500}}>Manufacturer class</label>
              <select
                value={anchorsClass}
                onChange={e => setAnchorsClass(e.target.value)}
                style={{padding:"6px 10px",borderRadius:6,border:"1px solid #E4E0D5",fontSize:13,fontFamily:"'Sora',sans-serif",background:"white"}}
              >
                {MANUFACTURER_CLASSES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {anchorsLoading ? (
              <div style={{fontSize:12,color:"#9ca3af",padding:"10px 4px"}}>Loading…</div>
            ) : (
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 150px 30px",gap:10,fontSize:10,color:"#9ca3af",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8,padding:"0 4px"}}>
                  <div>Tier label</div>
                  <div style={{textAlign:"right"}}>Price/aid (USD)</div>
                  <div></div>
                </div>
                {anchorsDraft.length === 0 && (
                  <div style={{fontSize:12,color:"#9ca3af",padding:"10px 4px"}}>No anchors set for this manufacturer class yet.</div>
                )}
                {anchorsDraft.map((a, i) => {
                  const fkey = `anchor:${i}`;
                  const focused = focusedMoneyKey === fkey;
                  return (
                    <div key={a.id || `new-${i}`} style={{display:"grid",gridTemplateColumns:"1fr 150px 30px",gap:10,marginBottom:8,alignItems:"center"}}>
                      <input
                        value={a.label || ""}
                        placeholder="e.g. Premium 7"
                        onChange={e => {
                          const v = e.target.value;
                          setAnchorsDraft(d => d.map((row, j) => j === i ? {...row, label: v} : row));
                        }}
                        style={{padding:"6px 10px",borderRadius:6,border:"1px solid #E4E0D5",fontSize:13,fontFamily:"'Sora',sans-serif"}}
                      />
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:13,color:"#9ca3af"}}>$</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={focused ? (a.price_per_aid ?? "") : formatMoney(a.price_per_aid)}
                          placeholder="—"
                          onFocus={() => setFocusedMoneyKey(fkey)}
                          onBlur={() => setFocusedMoneyKey(null)}
                          onChange={e => {
                            const raw = e.target.value;
                            const next = raw === "" ? null : Math.max(0, Number(raw));
                            setAnchorsDraft(d => d.map((row, j) => j === i ? {...row, price_per_aid: next} : row));
                          }}
                          style={{flex:1,padding:"6px 10px",borderRadius:6,border:"1px solid #E4E0D5",fontSize:13,fontFamily:"'Sora',sans-serif",textAlign:"right"}}
                        />
                      </div>
                      <button
                        onClick={() => setAnchorsDraft(d => d.filter((_, j) => j !== i))}
                        style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:18,padding:0,lineHeight:1}}
                        title="Delete row"
                      >×</button>
                    </div>
                  );
                })}
                <button
                  className="btn-ghost"
                  style={{marginTop:6}}
                  onClick={() => setAnchorsDraft(d => [...d, { label: "", price_per_aid: null }])}
                >＋ Add Anchor</button>
                <div style={{fontSize:11,color:"#9ca3af",marginTop:10}}>Display order matches the order shown above — saved automatically.</div>
                <div style={{display:"flex",gap:10,marginTop:14,alignItems:"center"}}>
                  <button className="btn-primary" onClick={handleSaveAnchors}>Save Anchors</button>
                  {anchorsSaved && <div style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✓ Saved</div>}
                </div>
              </>
            )}
          </div>


          {/* Danger zone — admin-only. The delete_patient_profile RPC re-checks
              the admin role server-side; this gate is just UI. */}
          {checkRole(staffRole, ["admin"]) && (
            <div className="settings-section" style={{border:"1px solid #fecaca"}}>
              <div className="settings-title" style={{color:"#b91c1c"}}>Delete Patient Profile</div>
              <div style={{fontSize:12,color:"#9ca3af",marginBottom:14,lineHeight:1.5}}>
                Permanently removes a patient and every linked record — visits, audiograms,
                device fittings, insurance, purchases, messages, campaign enrollment, and
                archived documents. This cannot be undone.
              </div>
              {deleteDone && (
                <div style={{fontSize:12,color:"#16a34a",fontWeight:600,marginBottom:12}}>✓ {deleteDone}</div>
              )}
              {!deleteTarget ? (
                <>
                  <div className="settings-field">
                    <label>Find patient</label>
                    <input value={deleteSearch}
                      onChange={e=>{ setDeleteSearch(e.target.value); setDeleteDone(""); }}
                      placeholder="Search this clinic by patient name…" />
                  </div>
                  {deleteSearch.trim().length >= 2 && (() => {
                    const term = deleteSearch.trim().toLowerCase();
                    const matches = patients.filter(p => (p.name || "").toLowerCase().includes(term)).slice(0, 6);
                    return matches.length === 0 ? (
                      <div style={{fontSize:12,color:"#9ca3af",padding:"4px 2px"}}>No matching patients in this clinic.</div>
                    ) : (
                      <div style={{border:"1px solid #E4E0D5",borderRadius:10,overflow:"hidden"}}>
                        {matches.map(p => (
                          <div key={p.id}
                            onClick={()=>{ setDeleteTarget(p); setDeleteConfirmText(""); setDeleteError(""); setDeleteDone(""); }}
                            style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #F0EDE4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div>
                              <div style={{fontSize:13,fontWeight:600,color:"#0a1628"}}>{p.name}</div>
                              <div style={{fontSize:11,color:"#9ca3af"}}>{[p.dob && `DOB ${p.dob}`, p.phone].filter(Boolean).join(" · ") || "no contact info"}</div>
                            </div>
                            <span style={{fontSize:11,color:"#b91c1c",fontWeight:700}}>Select</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>{deleteTarget.name}</div>
                    <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>
                      {[deleteTarget.dob && `DOB ${deleteTarget.dob}`, deleteTarget.phone, deleteTarget.patientStatus].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="settings-field">
                    <label>Type the patient's full name to confirm</label>
                    <input value={deleteConfirmText}
                      onChange={e=>setDeleteConfirmText(e.target.value)}
                      placeholder={deleteTarget.name} autoFocus />
                  </div>
                  {deleteError && (
                    <div style={{fontSize:12,color:"#b91c1c",fontWeight:600,marginBottom:10}}>{deleteError}</div>
                  )}
                  <div style={{display:"flex",gap:10}}>
                    <button className="btn-ghost" disabled={deleteBusy}
                      onClick={()=>{ setDeleteTarget(null); setDeleteConfirmText(""); setDeleteError(""); }}>
                      Cancel
                    </button>
                    <button
                      disabled={deleteBusy || deleteConfirmText.trim().toLowerCase() !== (deleteTarget.name || "").trim().toLowerCase()}
                      onClick={handleDeletePatient}
                      style={{
                        background: deleteBusy ? "#fca5a5" : "#dc2626", color:"white", border:"none",
                        borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:700,
                        fontFamily:"'Sora',sans-serif",
                        cursor: deleteBusy ? "wait" : "pointer",
                        opacity: deleteConfirmText.trim().toLowerCase() !== (deleteTarget.name || "").trim().toLowerCase() ? 0.45 : 1,
                      }}>
                      {deleteBusy ? "Deleting…" : "Permanently Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}


          <div className="settings-section">
            <div className="settings-title">About Distil</div>
            {[["Version","1.0 Prototype"],["Patient App","Aided"],["Noah Integration","Coming soon — Noah ES API"],["Data & Privacy","Encrypted cloud database (Supabase) · row-level security scoped per clinic"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #F0EDE3",fontSize:13}}>
                <span style={{color:"#9ca3af"}}>{k}</span>
                <span style={{fontWeight:500,color:"#374151"}}>{v}</span>
              </div>
            ))}
          </div>


          <button className="btn-primary green" onClick={handleClinicSave} style={{width:"100%",justifyContent:"center"}}>
            Save Settings
          </button>
        </div>
      </div>
    </>
  );
}
