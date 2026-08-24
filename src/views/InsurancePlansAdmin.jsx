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

// Insurance Plans admin editor (backlog #40e — extracted from Distil.jsx
// renderInsurancePlans / renderPlanEditPanel + handlers). Pure render
// extraction: editor state lives in ProviderCRM and arrives as props.

import React from "react";
import {
  loadInsurancePlansGrouped, saveInsurancePlanGroup, deleteInsurancePlanGroup,
  PLAN_TIER_LABELS,
} from "../db.js";

export default function InsurancePlansAdmin({
  insurancePlans, setInsurancePlans,
  insEditKey, setInsEditKey, insDraft, setInsDraft,
  insSearch, setInsSearch, insCarrierFilter, setInsCarrierFilter,
  insSaved, setInsSaved, insError, setInsError,
}) {
  const planKey = (p) => `${p.carrier}|${p.planGroup}`;

  const refreshInsurancePlans = async () => {
    try {
      const plans = await loadInsurancePlansGrouped();
      setInsurancePlans(plans || []);
    } catch (e) {
      console.error("refreshInsurancePlans:", e);
    }
  };

  const startNewInsurancePlan = () => {
    setInsDraft({
      carrier: insCarrierFilter !== "All" ? insCarrierFilter : "",
      planGroup: "",
      tpa: "TruHearing",
      notes: "",
      active: true,
      // Advanced + Premium is the dominant TruHearing pattern — pre-seed those rows.
      tiers: [{ label: "Advanced", price: null }, { label: "Premium", price: null }],
      _origRowIds: [],
    });
    setInsEditKey("__new__");
    setInsError(null);
  };

  const startEditInsurancePlan = (plan) => {
    setInsDraft({
      carrier: plan.carrier,
      planGroup: plan.planGroup,
      tpa: plan.tpa || "",
      notes: plan.notes || "",
      active: plan.active !== false,
      tiers: (plan.tiers || []).map(t => ({ ...t })),
      _origRowIds: (plan.tiers || []).map(t => t.id).filter(Boolean),
    });
    setInsEditKey(planKey(plan));
    setInsError(null);
  };

  const saveInsurancePlanDraft = async () => {
    setInsError(null);
    const d = insDraft;
    if (!d) return;
    if (!d.carrier?.trim() || !d.planGroup?.trim()) { setInsError("Carrier and plan group are required."); return; }
    const tiers = (d.tiers || []).filter(t => t.label && t.price !== null && t.price !== "");
    if (!tiers.length) { setInsError("Add at least one tier with a copay."); return; }
    const seen = new Set();
    for (const t of tiers) {
      if (seen.has(t.label)) { setInsError(`Tier "${t.label}" appears twice — each label can be used once per plan.`); return; }
      seen.add(t.label);
    }
    let saved;
    try {
      saved = await saveInsurancePlanGroup({ ...d, tiers }, d._origRowIds);
    } catch (e) {
      setInsError(e?.message || "Save failed — check your connection or admin permissions.");
      return;
    }
    // Re-key the open panel (covers new entries and renames) and fold the
    // DB-assigned row ids back into the draft so a follow-up save updates
    // rows instead of re-inserting them.
    const idByLabel = Object.fromEntries((saved || []).map(r => [r.tier_label, r.id]));
    setInsDraft(prev => prev ? {
      ...prev,
      tiers: tiers.map(t => ({ ...t, id: t.id || idByLabel[t.label] || null })),
      _origRowIds: (saved || []).map(r => r.id),
    } : prev);
    setInsEditKey(planKey(d));
    setInsSaved(true);
    setTimeout(() => setInsSaved(false), 2500);
    await refreshInsurancePlans();
  };

  const toggleInsurancePlanActive = async (plan) => {
    setInsError(null);
    try {
      await saveInsurancePlanGroup(
        { ...plan, active: !plan.active },
        (plan.tiers || []).map(t => t.id).filter(Boolean)
      );
    } catch (e) {
      setInsError(e?.message || "Update failed — check your connection or admin permissions.");
      return;
    }
    await refreshInsurancePlans();
  };

  const deleteInsurancePlanEntry = async (plan) => {
    if (!window.confirm(`Delete ${plan.carrier} — ${plan.planGroup} (all tiers)? If a patient is linked to this plan the delete is blocked; deactivate it instead.`)) return;
    setInsError(null);
    try {
      await deleteInsurancePlanGroup((plan.tiers || []).map(t => t.id).filter(Boolean));
    } catch (e) {
      setInsError(e?.message || "Delete failed — check your connection or admin permissions.");
      return;
    }
    if (insEditKey === planKey(plan)) { setInsEditKey(null); setInsDraft(null); }
    await refreshInsurancePlans();
  };

  const updateInsDraftTier = (idx, patch) => {
    setInsDraft(d => ({ ...d, tiers: d.tiers.map((t, i) => i === idx ? { ...t, ...patch } : t) }));
  };

  const insSelectStyle = { padding:"8px 12px", border:"1px solid #E4E0D5", borderRadius:8, fontSize:13, background:"white", fontFamily:"inherit" };

  const renderPlanEditPanel = (isNew) => (
    <div className="catalog-edit-panel">
      {insSaved && <div className="save-success">✓ Saved</div>}
      {insError && <div className="save-error">⚠ {insError}</div>}
      <div className="cat-field-row">
        <div className="cat-field"><label>Carrier</label>
          <input value={insDraft.carrier} onChange={e=>setInsDraft(d=>({...d,carrier:e.target.value}))} placeholder="e.g. Humana" />
        </div>
        <div className="cat-field"><label>TPA</label>
          <select value={insDraft.tpa} onChange={e=>setInsDraft(d=>({...d,tpa:e.target.value}))} style={insSelectStyle}>
            <option value="TruHearing">TruHearing</option>
            <option value="UHCH">UHCH</option>
            <option value="Nations">Nations</option>
            <option value="">— None / direct —</option>
          </select>
        </div>
      </div>
      <div className="cat-field"><label>Plan Group</label>
        <input value={insDraft.planGroup} onChange={e=>setInsDraft(d=>({...d,planGroup:e.target.value}))} placeholder="e.g. Gold Plus HMO" />
      </div>
      <div className="cat-field"><label>Tiers & Copays ($ per aid)</label>
        {insDraft.tiers.map((t, i) => (
          <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
            <select value={t.label} onChange={e=>updateInsDraftTier(i,{label:e.target.value})} style={{...insSelectStyle,flex:1}}>
              <option value="">— Tier —</option>
              {PLAN_TIER_LABELS.map(l=><option key={l} value={l}>{l}</option>)}
            </select>
            <input type="number" min="0" step="1" value={t.price ?? ""} placeholder="$ / aid"
              onChange={e=>updateInsDraftTier(i,{price:e.target.value === "" ? null : Number(e.target.value)})}
              style={{width:110}} />
            <button className="cat-btn danger" onClick={()=>setInsDraft(d=>({...d,tiers:d.tiers.filter((_,j)=>j!==i)}))}>✕</button>
          </div>
        ))}
        <button className="cat-btn" style={{alignSelf:"flex-start"}} onClick={()=>setInsDraft(d=>({...d,tiers:[...d.tiers,{label:"",price:null}]}))}>＋ Add Tier</button>
        <div style={{fontSize:11,color:"#9ca3af",marginTop:6}}>
          $0 copays are valid (fully covered tiers). Retail-anchor links are derived automatically for TruHearing plans.
        </div>
      </div>
      <div className="cat-field"><label>Notes (internal)</label>
        <textarea value={insDraft.notes} onChange={e=>setInsDraft(d=>({...d,notes:e.target.value}))} />
      </div>
      <div className="cat-save-row">
        <button className="cat-btn" onClick={()=>{setInsEditKey(null);setInsDraft(null);setInsError(null);}}>Cancel</button>
        <button className="cat-btn primary" onClick={saveInsurancePlanDraft}>{isNew?"Save Plan":"Save Changes"}</button>
      </div>
    </div>
  );

    const planCarriers = [...new Set(insurancePlans.map(p => p.carrier))].sort();
    const filteredPlans = insurancePlans.filter(p => {
      const carrierOk = insCarrierFilter === "All" || p.carrier === insCarrierFilter;
      const q = insSearch.toLowerCase();
      const searchOk = !q || p.carrier.toLowerCase().includes(q) || p.planGroup.toLowerCase().includes(q) || (p.tpa||"").toLowerCase().includes(q);
      return carrierOk && searchOk;
    });
  return (
      <>
        <div className="topbar">
          <div>
            <div className="topbar-title">Insurance Plans</div>
            <div className="topbar-sub">{insurancePlans.filter(p=>p.active).length} active plans · {insurancePlans.length} total · feeds the wizard and coverage editor</div>
          </div>
        </div>
        <div className="content">
          <div className="catalog-wrap">
            <div className="catalog-toolbar">
              <input className="catalog-search" placeholder="Search carrier, plan, or TPA…" value={insSearch} onChange={e=>setInsSearch(e.target.value)} />
              <button className="cat-btn primary" onClick={startNewInsurancePlan}>＋ Add Plan</button>
            </div>

            <div className="catalog-mfr-tabs">
              {["All",...planCarriers].map(c => (
                <div key={c} className={`catalog-mfr-tab ${insCarrierFilter===c?"active":""}`} onClick={()=>setInsCarrierFilter(c)}>{c}</div>
              ))}
            </div>

            {/* Toggle/delete errors when no edit panel is open */}
            {insError && !insDraft && <div className="save-error">⚠ {insError}</div>}

            {insEditKey === "__new__" && insDraft && (
              <div className="catalog-entry" style={{border:"2px solid #0a1628"}}>
                <div className="catalog-entry-header">
                  <div style={{flex:1,fontWeight:700,color:"#0a1628",fontSize:14}}>New Plan</div>
                </div>
                {renderPlanEditPanel(true)}
              </div>
            )}

            {insurancePlans.length === 0 && (
              <div className="empty-state"><div className="empty-icon">🛡️</div><div className="empty-title">No plans loaded from the database</div></div>
            )}
            {insurancePlans.length > 0 && filteredPlans.length === 0 && (
              <div className="empty-state"><div className="empty-icon">🛡️</div><div className="empty-title">No plans match</div></div>
            )}

            {filteredPlans.map(plan => {
              const key = planKey(plan);
              const isEditing = insEditKey === key;
              return (
                <div className="catalog-entry" key={key} style={isEditing?{border:"2px solid #0a1628"}:{}}>
                  <div className="catalog-entry-header">
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div className="catalog-entry-name">{plan.planGroup}</div>
                        <span className={`catalog-entry-badge ${plan.active?"active-badge":""}`}>{plan.active?"Active":"Inactive"}</span>
                      </div>
                      <div className="catalog-entry-gen">
                        {plan.carrier} · via {plan.tpa || "—"} · {plan.tiers.map(t=>`${t.label} $${(t.price??0).toLocaleString()}`).join(" / ")}
                      </div>
                    </div>
                    <div className="catalog-entry-actions">
                      <button className="cat-btn" onClick={()=>toggleInsurancePlanActive(plan)}>{plan.active?"Deactivate":"Activate"}</button>
                      <button className="cat-btn" onClick={()=>{ if (isEditing) { setInsEditKey(null); setInsDraft(null); } else startEditInsurancePlan(plan); }}>{isEditing?"Cancel":"Edit"}</button>
                      <button className="cat-btn danger" onClick={()=>deleteInsurancePlanEntry(plan)}>Delete</button>
                    </div>
                  </div>
                  {isEditing && insDraft && renderPlanEditPanel(false)}
                </div>
              );
            })}
          </div>
        </div>
      </>
  );
}
