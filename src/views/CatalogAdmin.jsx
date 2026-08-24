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

// Product Catalog admin editor (backlog #40e — extracted from Distil.jsx
// renderCatalog + its chip/tier-pricing sub-renderers and handlers). Pure
// render extraction: editor state lives in ProviderCRM and arrives as props
// (drafts persist across view switches, exactly as before).

import React from "react";
import { BODY_STYLES, CATALOG_DEFAULT } from "../lib/catalogConstants.js";
import { formatMoney } from "../lib/format.js";
import { saveCatalogEntry, deleteCatalogEntry, saveProductCatalog } from "../db.js";

const STYLE_OPTS = BODY_STYLES.map(s => s.id);

export default function CatalogAdmin({
  catalog, setCatalog,
  catMfrFilter, setCatMfrFilter, catSearch, setCatSearch,
  catDraft, setCatDraft, catEditId, setCatEditId,
  catNewEntry, setCatNewEntry, catSaved, setCatSaved, catError, setCatError,
  catAddChip, setCatAddChip, catChipEdit, setCatChipEdit,
  focusedMoneyKey, setFocusedMoneyKey,
}) {
  const renderChipEditor = (field, values) => {
    const key = `${catDraft?.id}-${field}`;
    const inputVal = catAddChip[key] || "";

    // For techLevels, every chip change also syncs the parallel `tiers` array
    // (add → append { tierName, msrp:null }, rename → update tierName, delete → drop matching row).
    const applyChange = (mutator) => setCatDraft(d => {
      const nextField = mutator(d[field] || []);
      if (field !== "techLevels") return { ...d, [field]: nextField };
      const oldNames = d[field] || [];
      const tiers = d.tiers || [];
      const keepNames = new Set(nextField);
      // Detect rename: same length, exactly one position differs
      let renamedFrom = null, renamedTo = null;
      if (oldNames.length === nextField.length) {
        const diffs = oldNames.map((n, i) => n !== nextField[i] ? i : -1).filter(i => i >= 0);
        if (diffs.length === 1) { renamedFrom = oldNames[diffs[0]]; renamedTo = nextField[diffs[0]]; }
      }
      let nextTiers = tiers;
      if (renamedFrom !== null) {
        nextTiers = tiers.map(t => t.tierName === renamedFrom ? { ...t, tierName: renamedTo } : t);
      } else {
        // Drop tiers whose name no longer exists, then append rows for any new names
        nextTiers = tiers.filter(t => keepNames.has(t.tierName));
        const have = new Set(nextTiers.map(t => t.tierName));
        for (const n of nextField) if (!have.has(n)) nextTiers.push({ tierName: n, msrp: null });
      }
      return { ...d, [field]: nextField, tiers: nextTiers };
    });

    const commitRename = () => {
      const newVal = catChipEdit.value.trim();
      const oldVal = values[catChipEdit.idx];
      if (newVal && newVal !== oldVal) {
        applyChange(arr => arr.map((v, j) => j === catChipEdit.idx ? newVal : v));
      }
      setCatChipEdit({ key: null, idx: null, value: "" });
    };

    return (
      <div className="chip-row">
        {values.map((v,i) => {
          const isEditing = catChipEdit.key === key && catChipEdit.idx === i;
          if (isEditing) {
            return (
              <input
                key={i}
                className="chip-add-input"
                style={{borderStyle:"solid",borderColor:"#0a1628"}}
                value={catChipEdit.value}
                autoFocus
                onChange={e => setCatChipEdit(c => ({...c, value: e.target.value}))}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                  else if (e.key === "Escape") { e.preventDefault(); setCatChipEdit({ key: null, idx: null, value: "" }); }
                }}
              />
            );
          }
          return (
            <div
              className="chip"
              key={i}
              style={{cursor:"text"}}
              title="Click to rename"
              onClick={() => setCatChipEdit({ key, idx: i, value: v })}
            >
              {v}
              <button
                className="chip-del"
                onClick={e => { e.stopPropagation(); applyChange(arr => arr.filter((_,j)=>j!==i)); }}
              >×</button>
            </div>
          );
        })}
        <input
          className="chip-add-input"
          placeholder="+ add…"
          value={inputVal}
          onChange={e => setCatAddChip(c => ({...c, [key]: e.target.value}))}
          onKeyDown={e => {
            if ((e.key === "Enter" || e.key === ",") && inputVal.trim()) {
              e.preventDefault();
              const v = inputVal.trim();
              applyChange(arr => [...arr, v]);
              setCatAddChip(c => ({...c, [key]: ""}));
            }
          }}
        />
      </div>
    );
  };

  const renderTierPricing = () => {
    const tiers = catDraft?.tiers || [];
    const techLevels = catDraft?.techLevels || [];
    if (!techLevels.length) {
      return <div style={{fontSize:12,color:"#9ca3af"}}>Add tech levels above to set per-tier pricing.</div>;
    }
    return (
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {techLevels.map(name => {
          const idx = tiers.findIndex(t => t.tierName === name);
          const msrp = idx >= 0 ? tiers[idx].msrp : null;
          const fkey = `tier:${name}`;
          const focused = focusedMoneyKey === fkey;
          return (
            <div key={name} style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1,fontSize:13,color:"#374151"}}>{name}</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:13,color:"#9ca3af"}}>$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="—"
                  style={{width:110,padding:"5px 9px",borderRadius:6,border:"1px solid #E4E0D5",fontSize:13,fontFamily:"'Sora',sans-serif",textAlign:"right"}}
                  value={focused ? (msrp ?? "") : formatMoney(msrp)}
                  onFocus={() => setFocusedMoneyKey(fkey)}
                  onBlur={() => setFocusedMoneyKey(null)}
                  onChange={e => {
                    const raw = e.target.value;
                    const next = raw === "" ? null : Math.max(0, Number(raw));
                    setCatDraft(d => {
                      const tiers2 = [...(d.tiers || [])];
                      const i2 = tiers2.findIndex(t => t.tierName === name);
                      if (i2 >= 0) tiers2[i2] = { ...tiers2[i2], msrp: next };
                      else tiers2.push({ tierName: name, msrp: next });
                      return { ...d, tiers: tiers2 };
                    });
                  }}
                />
              </div>
            </div>
          );
        })}
        <div style={{fontSize:11,color:"#9ca3af"}}>MSRP per aid · USD</div>
      </div>
    );
  };

  const allMfrs = [...new Set(catalog.map(e => e.manufacturer))].sort();
  const filteredCatalog = catalog.filter(e => {
    const mfrOk = catMfrFilter === "All" || e.manufacturer === catMfrFilter;
    const searchOk = !catSearch || e.family.toLowerCase().includes(catSearch.toLowerCase()) || e.generation.toLowerCase().includes(catSearch.toLowerCase());
    return mfrOk && searchOk;
  });


  const startNewCatalogEntry = () => {
    const newEntry = {
      id: "entry-" + Date.now(),
      manufacturer: catMfrFilter !== "All" ? catMfrFilter : "",
      generation: "", family: "",
      styles: [], variants: [], techLevels: [], colors: [], battery: [],
      tiers: [],
      active: true, notes: "",
    };
    setCatDraft(newEntry);
    setCatEditId("__new__");
    setCatNewEntry(true);
  };


  const saveEditEntry = async () => {
    setCatError(null);
    try {
      await saveCatalogEntry(catDraft);
    } catch (e) {
      setCatError(e?.message || "Save failed — check your connection or admin permissions.");
      return;
    }
    // Reflect in local state only after the DB write succeeds, so the list never
    // shows a change that didn't actually persist.
    setCatalog(prev => catNewEntry ? [...prev, catDraft] : prev.map(e => e.id === catDraft.id ? catDraft : e));
    // Keep the editor open after save. If this was a brand-new entry, transition
    // it into the "editing existing" rendering path so the panel stays attached to
    // its row in the list instead of vanishing with the New Entry form.
    setCatEditId(catDraft.id);
    setCatNewEntry(false);
    setCatSaved(true);
    setTimeout(() => setCatSaved(false), 2500);
  };


  const deleteEntry = async (id) => {
    if (!window.confirm("Delete this product family? This removes it and its tier pricing.")) return;
    setCatError(null);
    try {
      await deleteCatalogEntry(id);
    } catch (e) {
      setCatError(e?.message || "Delete failed — check your connection or admin permissions.");
      return;
    }
    setCatalog(prev => prev.filter(e => e.id !== id));
    if (catEditId === id) { setCatEditId(null); setCatDraft(null); }
  };


  const toggleActive = async (id) => {
    const item = catalog.find(e => e.id === id);
    if (!item) return;
    const updated = { ...item, active: !item.active };
    setCatError(null);
    try {
      await saveCatalogEntry(updated);
    } catch (e) {
      setCatError(e?.message || "Update failed — check your connection or admin permissions.");
      return;
    }
    setCatalog(prev => prev.map(e => e.id === id ? updated : e));
  };


  const resetToDefaults = async () => {
    if (!window.confirm("Reset catalog to factory defaults? This cannot be undone.")) return;
    setCatError(null);
    try {
      await saveProductCatalog(CATALOG_DEFAULT);
    } catch (e) {
      setCatError(e?.message || "Reset failed — check your connection or admin permissions.");
      return;
    }
    setCatalog(CATALOG_DEFAULT);
    setCatEditId(null); setCatDraft(null); setCatNewEntry(false);
  };

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Product Catalog</div>
          <div className="topbar-sub">{catalog.filter(e=>e.active).length} active families · {catalog.length} total</div>
        </div>
        <button className="cat-btn" style={{fontSize:12,padding:"7px 14px"}} onClick={resetToDefaults}>↺ Reset to Defaults</button>
      </div>
      <div className="content">
        <div className="catalog-wrap">
          <div className="catalog-toolbar">
            <input className="catalog-search" placeholder="Search families…" value={catSearch} onChange={e=>setCatSearch(e.target.value)} />
            <button className="cat-btn primary" onClick={startNewCatalogEntry}>＋ Add Family</button>
          </div>


          <div className="catalog-mfr-tabs">
            {["All",...allMfrs].map(m => (
              <div key={m} className={`catalog-mfr-tab ${catMfrFilter===m?"active":""}`} onClick={()=>setCatMfrFilter(m)}>{m}</div>
            ))}
          </div>


          {/* New entry form at top */}
          {catNewEntry && catDraft && (
            <div className="catalog-entry" style={{border:"2px solid #0a1628"}}>
              <div className="catalog-entry-header">
                <div style={{flex:1,fontWeight:700,color:"#0a1628",fontSize:14}}>New Entry</div>
              </div>
              <div className="catalog-edit-panel">
                {catSaved && <div className="save-success">✓ Saved</div>}
                {catError && <div className="save-error">⚠ {catError}</div>}
                <div className="cat-field-row">
                  <div className="cat-field"><label>Manufacturer</label>
                    <input value={catDraft.manufacturer} onChange={e=>setCatDraft(d=>({...d,manufacturer:e.target.value}))} placeholder="e.g. Signia" />
                  </div>
                  <div className="cat-field"><label>Generation / Platform</label>
                    <input value={catDraft.generation} onChange={e=>setCatDraft(d=>({...d,generation:e.target.value}))} placeholder="e.g. IX" />
                  </div>
                </div>
                <div className="cat-field"><label>Family Name</label>
                  <input value={catDraft.family} onChange={e=>setCatDraft(d=>({...d,family:e.target.value}))} placeholder="e.g. Pure Charge&Go IX" />
                </div>
                <div className="cat-field"><label>Body Styles</label>
                  <div className="chip-row">
                    {STYLE_OPTS.map(s=>(
                      <div key={s} className={`chip ${catDraft.styles.includes(s)?"":"opacity:0.4"}`}
                        style={{cursor:"pointer",background:catDraft.styles.includes(s)?"#0a1628":"#F0EDE3",color:catDraft.styles.includes(s)?"white":"#374151",border:catDraft.styles.includes(s)?"1px solid #0a1628":"1px solid #E4E0D5"}}
                        onClick={()=>setCatDraft(d=>({...d,styles:d.styles.includes(s)?d.styles.filter(x=>x!==s):[...d.styles,s]}))}>
                        {s.toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="cat-field"><label>Variants <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(one per line, Enter to add)</span></label>
                  {renderChipEditor("variants", catDraft.variants)}
                </div>
                <div className="cat-field"><label>Technology Levels</label>
                  {renderChipEditor("techLevels", catDraft.techLevels)}
                </div>
                <div className="cat-field"><label>Pricing per Tier (MSRP per aid)</label>
                  {renderTierPricing()}
                </div>
                <div className="cat-field"><label>Colors</label>
                  {renderChipEditor("colors", catDraft.colors)}
                </div>
                <div className="cat-field"><label>Battery</label>
                  {renderChipEditor("battery", catDraft.battery)}
                </div>
                <div className="cat-field"><label>Notes (internal)</label>
                  <textarea value={catDraft.notes} onChange={e=>setCatDraft(d=>({...d,notes:e.target.value}))} />
                </div>
                <div className="cat-save-row">
                  <button className="cat-btn" onClick={()=>{setCatNewEntry(false);setCatEditId(null);setCatDraft(null);}}>Cancel</button>
                  <button className="cat-btn primary" onClick={saveEditEntry}>Save Entry</button>
                </div>
              </div>
            </div>
          )}


          {filteredCatalog.length === 0 && (
            <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No entries found</div></div>
          )}


          {filteredCatalog.map(entry => {
            const isEditing = catEditId === entry.id && !catNewEntry;
            return (
              <div className="catalog-entry" key={entry.id} style={isEditing?{border:"2px solid #0a1628"}:{}}>
                <div className="catalog-entry-header">
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div className="catalog-entry-name">{entry.family}</div>
                      <span className={`catalog-entry-badge ${entry.active?"active-badge":""}`}>{entry.active?"Active":"Inactive"}</span>
                    </div>
                    <div className="catalog-entry-gen">{entry.manufacturer} · {entry.generation} · {entry.styles.map(s=>s.toUpperCase()).join(", ")} · {entry.techLevels.join(" / ")}</div>
                  </div>
                  <div className="catalog-entry-actions">
                    <button className="cat-btn" onClick={()=>toggleActive(entry.id)}>{entry.active?"Deactivate":"Activate"}</button>
                    <button className="cat-btn" onClick={()=>{
                      if (isEditing) { setCatEditId(null); setCatDraft(null); }
                      else {
                        // Backfill a tier row for any techLevel that doesn't have one yet,
                        // so the pricing grid always shows one input per tech level.
                        const existingTiers = (entry.tiers || []).map(t => ({...t}));
                        const have = new Set(existingTiers.map(t => t.tierName));
                        for (const n of (entry.techLevels || [])) {
                          if (!have.has(n)) existingTiers.push({ tierName: n, msrp: null });
                        }
                        setCatEditId(entry.id);
                        setCatDraft({
                          ...entry,
                          variants:   [...entry.variants],
                          techLevels: [...entry.techLevels],
                          colors:     [...entry.colors],
                          battery:    [...entry.battery],
                          styles:     [...entry.styles],
                          tiers:      existingTiers,
                        });
                      }
                    }}>{isEditing?"Cancel":"Edit"}</button>
                    <button className="cat-btn danger" onClick={()=>deleteEntry(entry.id)}>Delete</button>
                  </div>
                </div>


                {isEditing && catDraft && (
                  <div className="catalog-edit-panel">
                    {catSaved && <div className="save-success">✓ Saved</div>}
                    {catError && <div className="save-error">⚠ {catError}</div>}
                    <div className="cat-field-row">
                      <div className="cat-field"><label>Manufacturer</label>
                        <input value={catDraft.manufacturer} onChange={e=>setCatDraft(d=>({...d,manufacturer:e.target.value}))} />
                      </div>
                      <div className="cat-field"><label>Generation / Platform</label>
                        <input value={catDraft.generation} onChange={e=>setCatDraft(d=>({...d,generation:e.target.value}))} />
                      </div>
                    </div>
                    <div className="cat-field"><label>Family Name</label>
                      <input value={catDraft.family} onChange={e=>setCatDraft(d=>({...d,family:e.target.value}))} />
                    </div>
                    <div className="cat-field"><label>Body Styles</label>
                      <div className="chip-row">
                        {STYLE_OPTS.map(s=>(
                          <div key={s}
                            style={{cursor:"pointer",display:"flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,fontSize:12,border:catDraft.styles.includes(s)?"1px solid #0a1628":"1px solid #E4E0D5",background:catDraft.styles.includes(s)?"#0a1628":"#F0EDE3",color:catDraft.styles.includes(s)?"white":"#374151"}}
                            onClick={()=>setCatDraft(d=>({...d,styles:d.styles.includes(s)?d.styles.filter(x=>x!==s):[...d.styles,s]}))}>
                            {s.toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="cat-field"><label>Variants</label>
                      {renderChipEditor("variants", catDraft.variants)}
                    </div>
                    <div className="cat-field"><label>Technology Levels</label>
                      {renderChipEditor("techLevels", catDraft.techLevels)}
                    </div>
                    <div className="cat-field"><label>Pricing per Tier (MSRP per aid)</label>
                      {renderTierPricing()}
                    </div>
                    <div className="cat-field"><label>Colors</label>
                      {renderChipEditor("colors", catDraft.colors)}
                    </div>
                    <div className="cat-field"><label>Battery</label>
                      {renderChipEditor("battery", catDraft.battery)}
                    </div>
                    <div className="cat-field"><label>Notes (internal)</label>
                      <textarea value={catDraft.notes} onChange={e=>setCatDraft(d=>({...d,notes:e.target.value}))} />
                    </div>
                    <div className="cat-save-row">
                      <button className="cat-btn" onClick={()=>{setCatEditId(null);setCatDraft(null);}}>Cancel</button>
                      <button className="cat-btn primary" onClick={saveEditEntry}>Save Changes</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
