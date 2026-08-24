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

// Rebates admin editor (backlog #40e — extracted from Distil.jsx
// renderRebates / renderRebateEditPanel + handlers). Pure render extraction:
// editor state lives in ProviderCRM and arrives as props. Writes stay
// clinic-scoped (RLS); corporate rows render read-only.

import React from "react";
import { loadRebatePromos, saveRebatePromo, deleteRebatePromo } from "../db.js";
import {
  REBATE_TYPE_OPTS, REBATE_DISCOUNT_OPTS, REBATE_MFR_OPTS, REBATE_ATTR_OPTS,
  REBATE_TIER_OPTS,
} from "../lib/rebateOptions.js";
import { cap } from "../lib/catalogConstants.js";
import { fmtDate } from "../lib/dates.js";

export default function RebatesAdmin({
  clinicId,
  rebatePromos, setRebatePromos,
  rebEditId, setRebEditId, rebDraft, setRebDraft,
  rebSearch, setRebSearch, rebSaved, setRebSaved, rebError, setRebError,
}) {
  const refreshRebates = async () => {
    try { setRebatePromos(await loadRebatePromos(clinicId) || []); }
    catch (e) { console.error("refreshRebates:", e); }
  };

  const promoStatus = (p) => {
    if (!p.active) return { label: "Inactive", cls: "" };
    const now = Date.now();
    const from = p.activeFrom ? new Date(p.activeFrom).getTime() : null;
    const to   = p.activeTo   ? new Date(p.activeTo).getTime()   : null;
    if (from && now < from) return { label: "Scheduled", cls: "" };
    if (to && now > to)     return { label: "Expired",   cls: "" };
    return { label: "Active now", cls: "active-badge" };
  };

  const startNewRebate = () => {
    const today = new Date().toISOString().slice(0, 10);
    setRebDraft({
      name: "", type: "seasonal_promo",
      scopeManufacturer: "", scopeDeviceFamily: "", scopeTierRank: "", scopePatientAttribute: "",
      discountType: "flat_amount", discountValue: "",
      activeFrom: today, activeTo: today, active: true,
    });
    setRebEditId("__new__");
    setRebError(null);
  };

  const startEditRebate = (p) => {
    setRebDraft({
      id: p.id, name: p.name, type: p.type,
      scopeManufacturer: p.scopeManufacturer || "", scopeDeviceFamily: p.scopeDeviceFamily || "",
      scopeTierRank: p.scopeTierRank ?? "", scopePatientAttribute: p.scopePatientAttribute || "",
      discountType: p.discountType, discountValue: p.discountValue ?? "",
      activeFrom: (p.activeFrom || "").slice(0, 10), activeTo: (p.activeTo || "").slice(0, 10),
      active: p.active !== false,
    });
    setRebEditId(p.id);
    setRebError(null);
  };

  const saveRebateDraft = async () => {
    setRebError(null);
    const d = rebDraft;
    if (!d) return;
    if (!d.name?.trim()) { setRebError("Name is required."); return; }
    if (d.discountValue === "" || d.discountValue == null || isNaN(Number(d.discountValue))) { setRebError("Enter a discount value."); return; }
    if (Number(d.discountValue) < 0) { setRebError("Discount value can't be negative."); return; }
    if (d.discountType === "percentage" && Number(d.discountValue) > 100) { setRebError("A percentage can't exceed 100."); return; }
    if (!d.activeFrom || !d.activeTo) { setRebError("Set both start and end dates."); return; }
    if (d.activeTo < d.activeFrom) { setRebError("End date can't be before the start date."); return; }
    let saved;
    try {
      saved = await saveRebatePromo({
        id: d.id,
        clinicId,                       // RLS: writes must be clinic-scoped
        name: d.name.trim(),
        type: d.type,
        scopeManufacturer: d.scopeManufacturer || null,
        scopeDeviceFamily: d.scopeDeviceFamily?.trim() || null,
        scopeTierRank: d.scopeTierRank === "" ? null : Number(d.scopeTierRank),
        scopePatientAttribute: d.scopePatientAttribute || null,
        discountType: d.discountType,
        discountValue: Number(d.discountValue),
        activeFrom: `${d.activeFrom}T00:00:00`,
        activeTo: `${d.activeTo}T23:59:59`,
        active: d.active,
      });
    } catch (e) {
      setRebError(e?.message || "Save failed — check your connection or admin permissions.");
      return;
    }
    setRebDraft(prev => prev ? { ...prev, id: saved.id } : prev);
    setRebEditId(saved.id);
    setRebSaved(true);
    setTimeout(() => setRebSaved(false), 2500);
    await refreshRebates();
  };

  const toggleRebateActive = async (p) => {
    setRebError(null);
    try {
      await saveRebatePromo({ ...p, clinicId: p.clinicId || clinicId, active: !p.active });
    } catch (e) {
      setRebError(e?.message || "Update failed — check your connection or admin permissions.");
      return;
    }
    await refreshRebates();
  };

  const deleteRebate = async (p) => {
    if (!window.confirm(`Delete rebate "${p.name}"? If it's already attached to a purchase the delete is blocked — deactivate it instead.`)) return;
    setRebError(null);
    try {
      await deleteRebatePromo(p.id);
    } catch (e) {
      setRebError(e?.message || "Delete failed — it may be attached to a purchase; deactivate instead.");
      return;
    }
    if (rebEditId === p.id) { setRebEditId(null); setRebDraft(null); }
    await refreshRebates();
  };

  const rebSelectStyle = { padding:"8px 12px", border:"1px solid #E4E0D5", borderRadius:8, fontSize:13, background:"white", fontFamily:"inherit" };
  const fmtRebateDisc = (p) => p.discountType === "percentage" ? `${p.discountValue}% off`
    : p.discountType === "override_price" ? `$${Number(p.discountValue).toLocaleString()} set price`
    : `$${Number(p.discountValue).toLocaleString()} off`;
  const rebateScopeSummary = (p) => {
    const parts = [];
    if (p.scopeManufacturer) parts.push(cap(p.scopeManufacturer));
    if (p.scopeTierRank != null) parts.push(`Tier ${p.scopeTierRank}`);
    if (p.scopeDeviceFamily) parts.push(p.scopeDeviceFamily);
    if (p.scopePatientAttribute) parts.push(`if ${p.scopePatientAttribute}`);
    return parts.length ? parts.join(" · ") : "All devices";
  };

  const renderRebateEditPanel = (isNew) => (
    <div className="catalog-edit-panel">
      {rebSaved && <div className="save-success">✓ Saved</div>}
      {rebError && <div className="save-error">⚠ {rebError}</div>}
      <div className="cat-field"><label>Name</label>
        <input value={rebDraft.name} onChange={e=>setRebDraft(d=>({...d,name:e.target.value}))} placeholder="e.g. Spring Signia Event" />
      </div>
      <div className="cat-field-row">
        <div className="cat-field"><label>Type</label>
          <select value={rebDraft.type} onChange={e=>setRebDraft(d=>({...d,type:e.target.value}))} style={rebSelectStyle}>
            {REBATE_TYPE_OPTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="cat-field"><label>Discount</label>
          <div style={{display:"flex",gap:8}}>
            <select value={rebDraft.discountType} onChange={e=>setRebDraft(d=>({...d,discountType:e.target.value}))} style={{...rebSelectStyle,flex:1}}>
              {REBATE_DISCOUNT_OPTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            <input type="number" min="0" step="1" value={rebDraft.discountValue}
              onChange={e=>setRebDraft(d=>({...d,discountValue:e.target.value}))}
              placeholder={rebDraft.discountType==="percentage"?"%":"$"} style={{width:90}} />
          </div>
        </div>
      </div>
      <div className="cat-field"><label>Applies to (leave blank for any)</label>
        <div className="cat-field-row">
          <div className="cat-field"><label style={{fontWeight:400,fontSize:11}}>Manufacturer</label>
            <select value={rebDraft.scopeManufacturer} onChange={e=>setRebDraft(d=>({...d,scopeManufacturer:e.target.value}))} style={rebSelectStyle}>
              <option value="">— Any —</option>
              {REBATE_MFR_OPTS.map(m=><option key={m} value={m}>{cap(m)}</option>)}
            </select>
          </div>
          <div className="cat-field"><label style={{fontWeight:400,fontSize:11}}>Tier</label>
            <select value={rebDraft.scopeTierRank} onChange={e=>setRebDraft(d=>({...d,scopeTierRank:e.target.value}))} style={rebSelectStyle}>
              <option value="">— Any —</option>
              {REBATE_TIER_OPTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="cat-field-row">
          <div className="cat-field"><label style={{fontWeight:400,fontSize:11}}>Device family (optional catalog id)</label>
            <input value={rebDraft.scopeDeviceFamily} onChange={e=>setRebDraft(d=>({...d,scopeDeviceFamily:e.target.value}))} placeholder="e.g. rex-reach-plus" />
          </div>
          <div className="cat-field"><label style={{fontWeight:400,fontSize:11}}>Patient qualifier</label>
            <select value={rebDraft.scopePatientAttribute} onChange={e=>setRebDraft(d=>({...d,scopePatientAttribute:e.target.value}))} style={rebSelectStyle}>
              <option value="">— None —</option>
              {REBATE_ATTR_OPTS.map(a=><option key={a} value={a}>{cap(a)}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="cat-field-row">
        <div className="cat-field"><label>Active from</label>
          <input type="date" value={rebDraft.activeFrom} onChange={e=>setRebDraft(d=>({...d,activeFrom:e.target.value}))} />
        </div>
        <div className="cat-field"><label>Active through</label>
          <input type="date" value={rebDraft.activeTo} onChange={e=>setRebDraft(d=>({...d,activeTo:e.target.value}))} />
        </div>
      </div>
      <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>
        Patient qualifiers (veteran / hardship / loyalty) aren't auto-verified — the patient panel shows an "if you qualify" note and the provider confirms eligibility.
      </div>
      <div className="cat-save-row">
        <button className="cat-btn" onClick={()=>{setRebEditId(null);setRebDraft(null);setRebError(null);}}>Cancel</button>
        <button className="cat-btn primary" onClick={saveRebateDraft}>{isNew?"Save Rebate":"Save Changes"}</button>
      </div>
    </div>
  );

    const q = rebSearch.toLowerCase();
    const filtered = rebatePromos.filter(p =>
      !q || p.name.toLowerCase().includes(q) || (p.scopeManufacturer||"").toLowerCase().includes(q) || (p.type||"").toLowerCase().includes(q));
    const activeNow = rebatePromos.filter(p => promoStatus(p).label === "Active now").length;
  return (
      <>
        <div className="topbar">
          <div>
            <div className="topbar-title">Rebates</div>
            <div className="topbar-sub">{activeNow} active now · {rebatePromos.length} total · surfaced on the device-selection screen</div>
          </div>
        </div>
        <div className="content">
          <div className="catalog-wrap">
            <div className="catalog-toolbar">
              <input className="catalog-search" placeholder="Search name, manufacturer, or type…" value={rebSearch} onChange={e=>setRebSearch(e.target.value)} />
              <button className="cat-btn primary" onClick={startNewRebate}>＋ Add Rebate</button>
            </div>

            {rebError && !rebDraft && <div className="save-error">⚠ {rebError}</div>}

            {rebEditId === "__new__" && rebDraft && (
              <div className="catalog-entry" style={{border:"2px solid #0a1628"}}>
                <div className="catalog-entry-header">
                  <div style={{flex:1,fontWeight:700,color:"#0a1628",fontSize:14}}>New Rebate</div>
                </div>
                {renderRebateEditPanel(true)}
              </div>
            )}

            {rebatePromos.length === 0 && (
              <div className="empty-state"><div className="empty-icon">🏷️</div><div className="empty-title">No rebates yet</div><div className="empty-sub">Add one to surface savings on the device-selection screen.</div></div>
            )}
            {rebatePromos.length > 0 && filtered.length === 0 && (
              <div className="empty-state"><div className="empty-icon">🏷️</div><div className="empty-title">No rebates match</div></div>
            )}

            {filtered.map(p => {
              const isEditing = rebEditId === p.id;
              const st = promoStatus(p);
              const corporate = !p.clinicId;
              return (
                <div className="catalog-entry" key={p.id} style={isEditing?{border:"2px solid #0a1628"}:{}}>
                  <div className="catalog-entry-header">
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div className="catalog-entry-name">{p.name}</div>
                        <span className={`catalog-entry-badge ${st.cls}`}>{st.label}</span>
                        {corporate && <span className="catalog-entry-badge">Corporate</span>}
                      </div>
                      <div className="catalog-entry-gen">
                        {fmtRebateDisc(p)} · {rebateScopeSummary(p)} · {fmtDate(p.activeFrom)}–{fmtDate(p.activeTo)}
                      </div>
                    </div>
                    <div className="catalog-entry-actions">
                      {corporate ? (
                        <span style={{fontSize:11,color:"#9ca3af",alignSelf:"center"}}>read-only (corporate)</span>
                      ) : (<>
                        <button className="cat-btn" onClick={()=>toggleRebateActive(p)}>{p.active?"Deactivate":"Activate"}</button>
                        <button className="cat-btn" onClick={()=>{ if (isEditing) { setRebEditId(null); setRebDraft(null); } else startEditRebate(p); }}>{isEditing?"Cancel":"Edit"}</button>
                        <button className="cat-btn danger" onClick={()=>deleteRebate(p)}>Delete</button>
                      </>)}
                    </div>
                  </div>
                  {isEditing && rebDraft && renderRebateEditPanel(false)}
                </div>
              );
            })}
          </div>
        </div>
      </>
  );
}
