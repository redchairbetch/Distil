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

// New-patient wizard — the 8-step renderer (backlog #40c — extracted from
// Distil.jsx renderStep). Pure render extraction: the wizard form, derived
// pricing, and every handler live in ProviderCRM and arrive as props, exactly
// as the closure saw them, so behavior is unchanged. The step chrome
// (progress bar, nav buttons, PA modal) stays in Distil.jsx.

import React from "react";
import AudiogramEntry from "../components/AudiogramEntry.jsx";
import BodyStylePicker from "../components/BodyStylePicker.jsx";
import CommitmentChecklist from "../components/CommitmentChecklist.jsx";
import ComplexBenefitCalculator from "../components/ComplexBenefitCalculator.jsx";
import FinancingCalculator from "../components/FinancingCalculator.jsx";
import LangToggle from "../components/LangToggle.jsx";
import EarmoldPicker from "../components/EarmoldPicker.jsx";
import ResultsContent from "../components/ResultsContent.jsx";
import VerifyRateCard from "../components/VerifyRateCard.jsx";
import CareExpectations from "./CareExpectations.jsx";
import CareJourney from "./CareJourney.jsx";
import DeviceComparison, { techLevelToRank } from "./DeviceComparison.jsx";
import HealthHistory from "./HealthHistory.jsx";
import TierSelection from "./TierSelection.jsx";
import {
  BODY_STYLES, BODY_STYLE_IMG, CARE_PLANS, COLOR_HEX_MAP, MFR_LOGO,
  RECEIVER_LENGTHS, RECEIVER_POWERS, getMultiToneColors,
} from "../lib/catalogConstants.js";
import {
  TH_MODELS, TH_PLATFORM_NOTE, TH_AVAILABILITY, TH_GAIN_MATRIX, TH_COLORS,
  TH_BATTERY, TH_DOMES, TH_STYLE_TO_BODY, TH_TIER_BLURBS,
} from "../lib/truhearingCatalog.js";
import {
  CROS_PRICE_PER_UNIT, directPurchaseLockedTech, findAnchorForRank,
  findTierRank, manufacturerToClass, nationsCoverageTier, tierMatchedTech,
  uhchCoverageTier,
} from "../lib/pricing.js";
import { computeComplexBenefit } from "../lib/complexBenefit.js";
import { isTestedNoLoss } from "../lib/audiogram.js";
import {
  ENVIRONMENTS, SITUATION_LABEL, TIER_EFFORT_COPY,
  flaggedEnvironments, flaggedEffortSignals,
} from "../listeningSituations.js";
import { PRICING_T } from "../i18n/pricing.js";
import { rankFromTierLabel } from "../deviceComparison.js";
import { unwrapIntakeAnswers } from "../recommendationEngine.js";
import { deviceImageUrl } from "../deviceImages.js";
import {
  createProviderIntake, logAnalyticsEvent, updateIntakeAnswers,
  updateIntakeAssessment, updateIntakeProviderNotes,
} from "../db.js";

// ── Coupling UI (#42a) — dome vs custom earmold, per ear ────────────────────
// Explicit stored state on the side (s.coupling); an HP/earmold receiver
// locks the choice to earmold. Selecting a chip clears the other branch's
// fields so a stale dome never rides along with a mold order (and vice versa).
function CouplingChips({ side, s, updSide, requiresEarmold }) {
  const effective = s.coupling || (requiresEarmold ? "earmold" : "dome");
  const pick = (val) => {
    updSide(side, "coupling", val);
    if (val === "earmold") { updSide(side, "dome", ""); updSide(side, "domeCategory", ""); updSide(side, "domeSize", ""); }
    else for (const k of ["earmoldStyle","earmoldMaterial","earmoldColor","earmoldVent","earmoldVentSize","earmoldCanal","earmoldNotes"]) updSide(side, k, "");
  };
  const chip = (val, label, disabled) => (
    <button type="button" disabled={disabled}
      onClick={() => !disabled && pick(val)}
      title={disabled ? "This receiver power requires a custom earmold" : undefined}
      style={{
        padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:600,
        border:`1.5px solid ${effective===val ? "#0B4A42" : "#E4E0D5"}`,
        background: effective===val ? "#E7F1EE" : "white",
        color: disabled ? "#c4bfb2" : effective===val ? "#0B4A42" : "#6b7280",
        cursor: disabled ? "not-allowed" : "pointer",
      }}>
      {label}
    </button>
  );
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
      <span style={{fontSize:11, fontWeight:700, color:"#8B8577", textTransform:"uppercase", letterSpacing:"0.05em"}}>Coupling</span>
      {chip("dome", "Standard Dome", requiresEarmold)}
      {chip("earmold", "Custom Earmold", false)}
    </div>
  );
}

// Standard-catalog coupling block: chips + the dome select or earmold picker.
function CouplingSection({ side, s, updSide, requiresEarmold, availDomes, deviceType }) {
  const effective = s.coupling || (requiresEarmold ? "earmold" : "dome");
  return (
    <div className="field" style={{marginBottom:0, marginTop:12}}>
      <CouplingChips side={side} s={s} updSide={updSide} requiresEarmold={requiresEarmold} />
      {effective === "earmold" ? (
        <EarmoldPicker side={side} sd={s} updSide={updSide} deviceType={deviceType} />
      ) : deviceType === "ric" ? (
        <>
          <label>Dome Type</label>
          <select value={s.dome} onChange={e=>updSide(side,"dome",e.target.value)}>
            <option value="">Select…</option>
            {availDomes.map(dm=><option key={dm}>{dm}</option>)}
          </select>
        </>
      ) : (
        <div style={{fontSize:12, color:"#6b7280"}}>Slim-tube / standard tubing coupling — no custom mold ordered.</div>
      )}
    </div>
  );
}

export default function WizardSteps(props) {
  const {
    step, form, setForm, upd, updSide, resetSide, isSideConfigured,
    activeSide, setActiveSide, wizardMode, wizardPatientId, wizardIntake, setWizardIntake,
    wizardPaSigned, setIntakeRefreshKey,
    clinicId, staffId, displayLang, setDisplayLang,
    catalog, activePlans, productCatalogTiers,
    retailAnchors, retailAnchorsStandard, retailAnchorsByClass,
    leftDerived, rightDerived, leftEarPrice, rightEarPrice,
    pricingRevealData, privateLabelTiers, selectedInsurancePlan,
    directPurchaseActive, isPrivateLabel, isNationsPatient,
    nationsFamilyOffPlan, nationsTechOffPlan, manufacturerMismatch,
    complexEligible, complexBaselinePerAid, cbOpen, setCbOpen, cbInputs,
    handleSaveComplexBenefit, handleVerifyRate, handleGenerateQuote,
    addressSuggestions, addressOpen, setAddressOpen, addressRef,
    searchAddress, selectAddress,
    carePlanChangeCountRef,
    showWizardCompare, setShowWizardCompare,
    setShowWizardPaModal, setPaStep, setPaSignatureName, setShowAdjustModal,
    setCloseAppointment,
  } = props;
  // Which ear's body-style grid is expanded for a per-ear change (the CROS /
  // asymmetric-fit escape hatch). null = both ears show the compact chip.
  // Hook lives above the step returns so it runs on every render path.
  const [expandedStyleGrid, setExpandedStyleGrid] = React.useState(null);
    if (step === 0) return (
      <div className="card">
        <div className="card-title">Patient Information</div>
        <div className="field-grid">
          <div className="field"><label>First Name *</label><input value={form.firstName} onChange={e=>upd("firstName",e.target.value)} placeholder="Jane" /></div>
          <div className="field"><label>Last Name *</label><input value={form.lastName} onChange={e=>upd("lastName",e.target.value)} placeholder="Smith" /></div>
          <div className="field"><label>Date of Birth *</label><input type="date" value={form.dob} onChange={e=>upd("dob",e.target.value)} /></div>
          <div className="field"><label>Phone *</label><input value={form.phone} onChange={e=>{
            const digits = e.target.value.replace(/\D/g,"").slice(0,10);
            let fmt = digits;
            if (digits.length >= 7) fmt = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
            else if (digits.length >= 4) fmt = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
            else if (digits.length > 0) fmt = `(${digits}`;
            upd("phone", fmt);
          }} placeholder="(555) 555-5555" /></div>
          <div className="field full"><label>Email</label><input value={form.email} onChange={e=>upd("email",e.target.value)} placeholder="patient@email.com" /></div>
          <div className="field full" ref={addressRef} style={{position:"relative"}}>
            <label>Address</label>
            <input value={form.address} onChange={e=>searchAddress(e.target.value)} onFocus={()=>{ if (addressSuggestions.length) setAddressOpen(true); }} placeholder="Start typing an address..." autoComplete="off" />
            {addressOpen && addressSuggestions.length > 0 && (
              <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"white",border:"1px solid #E4E0D5",borderRadius:8,marginTop:4,boxShadow:"0 4px 12px rgba(0,0,0,0.1)",maxHeight:220,overflowY:"auto"}}>
                {addressSuggestions.map((s,i)=>(
                  <div key={i} onClick={()=>selectAddress(s)} style={{padding:"10px 14px",fontSize:13,cursor:"pointer",borderBottom:i<addressSuggestions.length-1?"1px solid #F0EDE3":"none",color:"#0a1628",lineHeight:1.4}}
                    onMouseOver={e=>e.currentTarget.style.background="#FAF8F2"} onMouseOut={e=>e.currentTarget.style.background="white"}>
                    {s.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="field full"><label>Payment Type</label>
            <div className="radio-group">
              {["insurance","private"].map(t => (
                <div key={t} className={`radio-pill ${form.payType===t?"active":""}`} onClick={()=>{
                  // Private-pay bundles Complete Care+ (4-yr warranty / 5-yr unlimited
                  // visits) into the device price, so we preset the carePlan here
                  // and skip the dedicated Care Plan wizard step. carePlan is
                  // saved as null in the DB for private-pay (finalizeWizardPatient nulls it),
                  // but the form state needs "complete" so the wizard PA modal,
                  // Review step, and downstream displays render correctly.
                  setForm(f => ({
                    ...f,
                    payType: t,
                    directPurchase: t === "private" ? false : f.directPurchase, // insurance-mode concept only
                    carePlan: t === "private" ? "complete" : (f.carePlan === "complete" && f.payType === "private" ? "" : f.carePlan),
                  }));
                }}>
                  <div className="radio-pill-label">{t==="insurance"?"Insurance":"Private Pay"}</div>
                  <div className="radio-pill-sub">{t==="insurance"?"Carrier + TPA plan":"Complete Care+ included"}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Inline insurance plan search when Insurance selected */}
          {form.payType === "insurance" && (
            <div className="field full" style={{marginTop:4}}>
              <div style={{background:"#FBF9F3",border:"1px solid #E4E0D5",borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:12}}>Insurance Plan</div>
                <input
                  placeholder="Search by carrier or plan name…"
                  value={form._planSearch||""}
                  onChange={e=>upd("_planSearch",e.target.value)}
                  style={{width:"100%",marginBottom:10,fontSize:13}}
                />
                <div style={{maxHeight:220,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,paddingRight:4}}>
                  {activePlans
                    .filter(p=>{
                      const q=(form._planSearch||"").toLowerCase();
                      return !q||p.carrier.toLowerCase().includes(q)||p.planGroup.toLowerCase().includes(q)||p.tpa.toLowerCase().includes(q);
                    })
                    .sort((a,b)=>a.planGroup.localeCompare(b.planGroup))
                    .map(plan=>(
                      <div key={`${plan.carrier}:${plan.planGroup}`}
                        className={`plan-row ${form.planGroup===plan.planGroup&&form.carrier===plan.carrier?"active":""}`}
                        onClick={()=>{
                          upd("planGroup",plan.planGroup);
                          upd("carrier",plan.carrier);
                          upd("tpa",plan.tpa);
                          upd("tier","");
                          upd("tierPrice",null);
                          upd("directPurchase",false); // re-confirm per plan
                        }}>
                        <div className="plan-row-name">{plan.planGroup}</div>
                        <div className="plan-row-tpa">{plan.carrier}{plan.tpa ? ` · via ${plan.tpa}` : " · direct"}</div>
                      </div>
                    ))
                  }
                </div>
                {form.planGroup && (
                  <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #E4E0D5",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>TPA</span>
                    <span style={{fontSize:13,fontWeight:600,color:"#374151",background:"#F0EDE3",borderRadius:6,padding:"3px 10px"}}>{form.tpa || "None — direct"}</span>
                    <button style={{marginLeft:"auto",fontSize:11,color:"#9ca3af",background:"none",border:"none",cursor:"pointer",padding:0}}
                      onClick={()=>{upd("planGroup","");upd("carrier","");upd("tpa","");upd("tier","");upd("tierPrice",null);upd("directPurchase",false);}}>
                      ✕ Clear
                    </button>
                  </div>
                )}
                {/* Direct Purchase fork — only on private-label (TruHearing) plans.
                    Sell privately at the plan's tier price on the equivalent
                    Signia device (see directPurchaseLockedTech / buildPayerSnapshot). */}
                {form.planGroup && isPrivateLabel && (
                  <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #E4E0D5"}}>
                    <div
                      onClick={()=>upd("directPurchase", !form.directPurchase)}
                      style={{
                        display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",
                        border:`2px solid ${form.directPurchase?"#0B4A42":"#E4E0D5"}`,
                        background:form.directPurchase?"#FBF9F3":"#fff",
                        borderRadius:10,padding:"12px 14px",
                      }}>
                      <div style={{
                        width:18,height:18,borderRadius:4,flexShrink:0,marginTop:1,
                        border:`2px solid ${form.directPurchase?"#0B4A42":"#9ca3af"}`,
                        background:form.directPurchase?"#0B4A42":"#fff",
                        color:"#fff",fontSize:12,fontWeight:800,lineHeight:"14px",textAlign:"center",
                      }}>{form.directPurchase?"✓":""}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>Direct Purchase — sell at plan price on Signia</div>
                        <div style={{fontSize:12,color:"#6b7280",marginTop:3,lineHeight:1.45}}>
                          For a patient who has this TruHearing benefit but wasn't referred here. Same tier pricing, but the device list becomes the equivalent Signia portfolio and it's billed as a private purchase (care plan still applies).
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
    if (step === 1) {
      // Health History — review intake responses with the patient. The
      // intake is loaded by the useEffect on entering this step. Per-field
      // edits write back to the JSONB columns immediately on blur via the
      // two callbacks; local state is updated optimistically so the UI
      // reflects the change without waiting on the round-trip.
      const intakeId = wizardIntake?._meta?.intakeId;
      return (
        <HealthHistory
          intake={wizardIntake}
          lang={displayLang}
          langControl={<LangToggle lang={displayLang} onChange={setDisplayLang} />}
          onUpdateAnswer={async (key, value) => {
            if (!intakeId) return;
            const nextAnswers = { ...(wizardIntake.answers || {}), [key]: value };
            setWizardIntake(prev => prev ? { ...prev, answers: nextAnswers } : prev);
            // Re-wrap with _meta + consent if the row was wrapped, so the
            // signature image and submission metadata aren't clobbered.
            const persisted = wizardIntake._wrapper
              ? { ...wizardIntake._wrapper, answers: nextAnswers }
              : nextAnswers;
            try { await updateIntakeAnswers(intakeId, persisted); }
            catch (e) { console.error("updateIntakeAnswers:", e); }
          }}
          onUpdateNote={async (key, text) => {
            if (!intakeId) return;
            const nextNotes = { ...(wizardIntake.providerNotes || {}), [key]: text };
            setWizardIntake(prev => prev ? { ...prev, providerNotes: nextNotes } : prev);
            try { await updateIntakeProviderNotes(intakeId, nextNotes); }
            catch (e) { console.error("updateIntakeProviderNotes:", e); }
          }}
          onUpdateAssessment={async (fields) => {
            if (!intakeId) return;
            // Optimistic local update so the prompter sidebar reflects the
            // motivation / soft-commitment values the provider just set.
            setWizardIntake(prev => prev ? {
              ...prev,
              ...('motivationScore' in fields ? { motivationScore: fields.motivationScore } : {}),
              ...('softCommitment'  in fields ? { softCommitment:  fields.softCommitment  } : {}),
            } : prev);
            try { await updateIntakeAssessment(intakeId, fields); }
            catch (e) { console.error("updateIntakeAssessment:", e); }
          }}
          onStartGuidedConversation={
            wizardPatientId && clinicId
              ? async () => {
                  await createProviderIntake(wizardPatientId, clinicId);
                  // Bump the refresh key — the loader useEffect re-fires
                  // and the new intake row pops in as the editable surface.
                  setIntakeRefreshKey(k => k + 1);
                }
              : undefined
          }
        />
      );
    }
    if (step === 2) {
      // Did Not Test fork — the visit ended before any testing happened (e.g.
      // the patient booked the slot just for wax removal). Offered only while
      // the audiogram is still untouched: the moment a threshold goes in,
      // they tested and the fork disappears. The profile is already saved
      // (step-0 draft); the fork closes the appointment with a did_not_test
      // disposition + reason and skips tier/device/care-plan entirely, so the
      // patient exits as a prospect. Upgrade purchases land mid-flow and never
      // render this step, but the guard keeps that invariant explicit.
      const a = form.audiology || {};
      const noTestData = Object.keys(a.rightT || {}).length === 0 && Object.keys(a.leftT || {}).length === 0
        && Object.keys(a.rightBC || {}).length === 0 && Object.keys(a.leftBC || {}).length === 0
        && a.unaidedR == null && a.unaidedL == null;
      return (
        <>
          <AudiogramEntry value={form.audiology} onChange={(a)=>upd("audiology", a)} />
          {wizardMode !== "upgrade" && noTestData && (
            <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:"14px 20px",marginTop:16,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:280}}>
                <div style={{fontSize:12,fontWeight:700,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>
                  No Test This Visit?
                </div>
                <div style={{fontSize:13,color:"#6b7280",lineHeight:1.5}}>
                  If the appointment ended before testing — wax removal only, patient declined, medical issue —
                  close it here with the reason. The profile is already saved, and the remaining steps are skipped.
                </div>
              </div>
              <button
                style={{background:"white",color:"#374151",border:"1px solid #d1d5db",borderRadius:8,padding:"10px 18px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}
                onClick={() => setCloseAppointment({ source: "wizard", didNotTest: true })}
              >
                Did Not Test — Close Visit
              </button>
            </div>
          )}
        </>
      );
    }
    if (step === 3) {
      // Tested No Loss suggestion — auto-detected from the entered thresholds
      // (both ears tested, everything ≤ 20 dB), provider confirms. Upgrade
      // visits are excluded: an established wearer's flow is retention, and a
      // now-normal audiogram there deserves a human conversation, not a badge.
      const suggestTnl = wizardMode !== "upgrade" && isTestedNoLoss(form.audiology);
      return (
        <>
          {suggestTnl && (
            <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"16px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:280}}>
                <div style={{fontSize:12,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>
                  Hearing Within Normal Limits
                </div>
                <div style={{fontSize:13,color:"#1e40af",lineHeight:1.5}}>
                  Every entered threshold is at or below 20 dB in both ears. If word recognition and history agree,
                  close this visit as <strong>Tested No Loss</strong> — today's audiogram is saved as their baseline
                  and an annual retest is scheduled automatically. If something still concerns you, Continue proceeds
                  to treatment planning as usual.
                </div>
              </div>
              <button
                style={{background:"#1d4ed8",color:"white",border:"none",borderRadius:8,padding:"10px 18px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}
                onClick={() => setCloseAppointment({ source: "wizard", tnl: true })}
              >
                ✓ Close as Tested No Loss
              </button>
            </div>
          )}
          <ResultsContent aud={form.audiology} chiefComplaint={form.notes || ""} intakeAnswers={wizardIntake?.answers || null} displayLang={displayLang} setDisplayLang={setDisplayLang} />
        </>
      );
    }
    if (step === 5) {
      // Technology Tier — patient picks Standard / Advanced / Premium
      // (or whatever subset the plan covers) BEFORE Device Selection.
      // Engine recommendation auto-selects on entry; provider override
      // is sticky. Selection writes to form.tier + form.tierPrice.
      return (
        <TierSelection
          patientId={wizardPatientId}
          clinicId={clinicId}
          selectedTier={form.tier}
          onSelectTier={(label, price) => setForm(f => ({ ...f, tier: label, tierPrice: price }))}
          planTiers={privateLabelTiers}
          payType={form.payType}
          isPrivateLabel={isPrivateLabel}
          retailAnchors={form.payType === "private" ? retailAnchorsStandard : retailAnchors}
          intakeAnswers={wizardIntake?.answers || null}
          tierBlurbs={TH_TIER_BLURBS}
          deviceDrivenTpa={form.payType === "insurance" && (form.tpa === "UHCH" || form.tpa === "Nations") ? form.tpa : null}
          deviceDrivenTiers={selectedInsurancePlan?.tiers || []}
          lang={displayLang}
        />
      );
    }
    if (step === 6) {

      // $3,997.50 → "3,997.50", $850 → "850" — whole dollars stay clean.
      const moneyLabel = (p) => p.toLocaleString("en-US",
        Number.isInteger(p) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Per-level price for the tech-level pills — surfaces the price
      // consequence of each level BEFORE it's picked, so overriding the
      // tier-matched default is an eyes-open price decision. Flat-copay
      // insurance (TruHearing / Direct Purchase — tierPrice fixed by the
      // plan) returns null: the level doesn't change what the patient pays.
      const techLevelPriceInfo = (fam, t) => {
        if (!fam) return null;
        if (form.payType === "insurance" && form.tpa === "UHCH") {
          const covTier = uhchCoverageTier(fam.manufacturer, t);
          if (!covTier) {
            // Off-plan → the patient buys at standard retail (with the
            // acknowledgement form) — show that price, flagged.
            const rank = findTierRank(productCatalogTiers, fam.id, t);
            let anchor = findAnchorForRank(retailAnchorsByClass?.[manufacturerToClass(fam.manufacturer)], rank);
            if (!anchor) anchor = findAnchorForRank(retailAnchorsByClass?.standard, rank);
            return anchor ? { price: parseFloat(anchor.price_per_aid), offPlan: true } : null;
          }
          const p = selectedInsurancePlan?.tiers?.find(x => x.label === covTier)?.price;
          return p != null ? { price: p } : null;
        }
        if (isNationsPatient) {
          const covTier = nationsCoverageTier(fam, t);
          if (!covTier) return null; // off-plan pills are already blocked red
          const p = selectedInsurancePlan?.tiers?.find(x => x.label === covTier)?.price;
          return p != null ? { price: p } : null;
        }
        if (form.payType === "private" || (form.payType === "insurance" && form.tierPrice == null)) {
          const rank = findTierRank(productCatalogTiers, fam.id, t);
          if (rank == null) return null;
          const cls = form.payType === "private" ? manufacturerToClass(fam.manufacturer) : "standard";
          let anchor = findAnchorForRank(retailAnchorsByClass?.[cls], rank);
          if (!anchor) anchor = findAnchorForRank(retailAnchorsByClass?.standard, rank);
          return anchor ? { price: parseFloat(anchor.price_per_aid) } : null;
        }
        return null;
      };

      const renderSideColumn = (side) => {
        const s = form[side];
        const d = side === "left" ? leftDerived : rightDerived;
        const { availMfrs, availGens, availFamilies, selectedFamily, availColors, availBatteries,
          availPowers, availDomes, requiresEarmold, variantRequired } = d;
        // Direct Purchase runs the STANDARD (Signia) cascade, not the TruHearing
        // card flow; the tier locks the Signia tech level (see dpLockedTech).
        const showStd = !isPrivateLabel || directPurchaseActive;
        const showTH  = isPrivateLabel && !directPurchaseActive;
        const dpLockedTech = directPurchaseActive ? directPurchaseLockedTech(selectedFamily, form.tier) : null;

        return (
          <div className={`device-col ${activeSide===side?"active":""}`} onClick={()=>setActiveSide(side)}>
            <div className="device-col-header">
              <span className="ear-label">{side==="left"?"👂 Left Ear":"Right Ear 👂"}</span>
              <span className={`ear-status ${isSideConfigured(side)?"configured":"empty"}`}>
                {isSideConfigured(side)?"Configured":"Not set"}
              </span>
            </div>

            {/* ── Tier-first: the price was settled on the Technology Tier step;
                this banner carries it into the cascade so Body Style opens with
                the investment already framed (mirrors the TruHearing locked-tier
                chip). Private pay only — flat-copay insurance shows its price in
                the reveal, and device-driven TPAs price by the device below. ── */}
            {showStd && !directPurchaseActive && form.payType === "private" && form.tier && (
              <div style={{background:"#FBF9F3",border:"1px solid #E4E0D5",borderRadius:8,padding:"10px 14px",marginBottom:16}}>
                {/* Price deliberately absent — it was captured on tier select
                    and surfaces once, at the Pricing Reveal below. */}
                <span style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>
                  {form.tier} technology
                </span>
                <span style={{fontSize:12,color:"#6b7280"}}> — chosen in Technology Tier</span>
                <div style={{fontSize:11.5,color:"#6b7280",marginTop:5,lineHeight:1.45}}>
                  Pick the style and brand below — each model's technology level is matched to this
                  choice automatically, so that decision stays settled while you choose the fit.
                </div>
              </div>
            )}

            {/* ── 1. Body Style (standard catalog + Direct Purchase — TH uses its
                own picker below). The shared picker above seeds both ears, so
                this collapses to a compact chip with a per-ear "Change" escape
                hatch (CROS / asymmetric fits); Change expands the full grid for
                this ear only. ── */}
            {showStd && (s.style && expandedStyleGrid !== side ? (
              <div className="field" style={{marginBottom:16}}><label>Body Style</label>
                <div style={{display:"flex",alignItems:"center",gap:10,border:"1px solid #E4E0D5",background:"#FBF9F3",borderRadius:10,padding:"8px 12px"}}>
                  {BODY_STYLE_IMG[s.style] && (
                    <img src={BODY_STYLE_IMG[s.style]} alt="" style={{width:34,height:34,objectFit:"contain",flexShrink:0}} />
                  )}
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>{BODY_STYLES.find(b=>b.id===s.style)?.label || s.style}</div>
                    <div style={{fontSize:11,color:"#6b7280"}}>{BODY_STYLES.find(b=>b.id===s.style)?.desc || ""}</div>
                  </div>
                  <button className="side-action-btn" style={{marginLeft:"auto",flexShrink:0}}
                    onClick={(e)=>{ e.stopPropagation(); setExpandedStyleGrid(side); }}>
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div className="field" style={{marginBottom:16}}><label>Body Style</label>
                <div className="style-grid">
                  {BODY_STYLES.map(bs=>(
                    <div key={bs.id} className={`style-card ${s.style===bs.id?"active":""}`}
                      onClick={()=>{ resetSide(side, directPurchaseActive ? {style:bs.id, manufacturer:"Signia"} : {style:bs.id}); setExpandedStyleGrid(null); }}>
                      {BODY_STYLE_IMG[bs.id] && (
                        <img src={BODY_STYLE_IMG[bs.id]} alt={bs.label}
                          style={{display:"block",margin:"0 auto 6px",width:56,height:56,objectFit:"contain",opacity:s.style===bs.id?1:0.5}} />
                      )}
                      <div className="style-id">{bs.label}</div>
                      <div className="style-desc">{bs.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* ── 2–6. Standard catalog cascade (also Direct Purchase, Signia-locked) ── */}
            {showStd && (<>
              {/* Direct Purchase locks the manufacturer to Signia — show it as a
                  read-only chip instead of a one-option picker. */}
              {directPurchaseActive && s.style && (
                <div className="field" style={{marginBottom:16}}><label>Manufacturer</label>
                  <div style={{display:"inline-flex",alignItems:"center",gap:8,border:"2px solid #0B4A42",background:"#FBF9F3",borderRadius:8,padding:"8px 12px"}}>
                    {MFR_LOGO["Signia"] ? <img src={MFR_LOGO["Signia"]} alt="Signia" style={{height:20}} /> : <span style={{fontWeight:700}}>Signia</span>}
                    <span style={{fontSize:12,color:"#6b7280"}}>matched to the TruHearing portfolio</span>
                  </div>
                </div>
              )}
              {!directPurchaseActive && s.style && availMfrs.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Manufacturer</label>
                  <div className="radio-group mfr-group">
                    {availMfrs.map(m=>(
                      <div key={m} className={`radio-pill mfr-pill ${s.manufacturer===m?"active":""}`}
                        onClick={()=>setForm(f=>({...f,[side]:{...f[side],manufacturer:m,generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:""}}))}>
                        {MFR_LOGO[m]
                          ? <img src={MFR_LOGO[m]} alt={m} />
                          : <div className="radio-pill-label">{m}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {s.manufacturer && availGens.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Platform / Generation</label>
                  <div className="radio-group">
                    {availGens.map(g=>(
                      <div key={g} className={`radio-pill ${s.generation===g?"active":""}`}
                        onClick={()=>setForm(f=>({...f,[side]:{...f[side],generation:g,familyId:"",variant:"",techLevel:"",color:"",battery:""}}))}>
                        <div className="radio-pill-label">{g}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {s.generation && availFamilies.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Model Family</label>
                  <div className="plan-select-list">
                    {availFamilies.map(fam=>{
                      const famOff = nationsFamilyOffPlan(fam);
                      return (
                      <div key={fam.id} className={`plan-row ${s.familyId===fam.id?"active":""}`}
                        title={famOff ? "Not covered by the patient's NationsBenefits plan" : undefined}
                        style={famOff ? {opacity:0.6,cursor:"not-allowed",background:"#fef2f2",borderColor:"#fecaca"} : undefined}
                        onClick={famOff ? undefined : ()=>{
                          const autoVar = fam.variants.length===1 ? fam.variants[0] : "";
                          const autoBat = fam.battery.length===1 ? fam.battery[0] : "";
                          // Direct Purchase locks the tech level to the tier's rank;
                          // private pay pre-matches it to the tier settled on the
                          // Technology Tier step (override stays possible below).
                          const lockTech = directPurchaseActive
                            ? (directPurchaseLockedTech(fam, form.tier) || "")
                            : form.payType === "private"
                              ? (tierMatchedTech(fam, form.tier, productCatalogTiers) || "")
                              : "";
                          setForm(f=>({...f,[side]:{...f[side],familyId:fam.id,variant:autoVar,techLevel:lockTech,color:"",battery:autoBat}}));
                        }}>
                        <div className="plan-row-top">
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            {deviceImageUrl(fam.imageKey) && (
                              <img src={deviceImageUrl(fam.imageKey)} alt=""
                                style={{width:44,height:44,objectFit:"contain",flexShrink:0,opacity:famOff?0.5:1}} />
                            )}
                            <div>
                              <div className="plan-row-name" style={famOff ? {color:"#b91c1c"} : undefined}>
                                {fam.family}{famOff ? " *" : ""}
                              </div>
                              {famOff && <div style={{fontSize:11,color:"#b91c1c",marginTop:2}}>Not available on this plan</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {selectedFamily && selectedFamily.variants.length > 1 && (
                <div className="field" style={{marginBottom:16}}><label>Variant</label>
                  <div className="radio-group">
                    {selectedFamily.variants.map(v=>(
                      <div key={v} className={`radio-pill ${s.variant===v?"active":""}`} onClick={()=>updSide(side,"variant",v)}>
                        <div className="radio-pill-label">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedFamily && (s.variant || !variantRequired) && (directPurchaseActive ? (
                <div className="field" style={{marginBottom:16}}><label>Technology Level</label>
                  <div style={{display:"inline-flex",alignItems:"center",gap:8,border:"2px solid #0B4A42",background:"#FBF9F3",borderRadius:8,padding:"8px 12px"}}>
                    <span style={{fontSize:14,fontWeight:700,color:"#0a1628"}}>{selectedFamily.techLevelLabels?.[dpLockedTech] || dpLockedTech || "—"}</span>
                    <span style={{fontSize:12,color:"#6b7280"}}>locked to {form.tier}</span>
                  </div>
                  <div style={{fontSize:11.5,color:"#6b7280",marginTop:6}}>
                    Matched to the {form.tier} tier price. Change the tier on the Technology Tier step to unlock a different level.
                  </div>
                </div>
              ) : (
                <div className="field" style={{marginBottom:16}}><label>Technology Level</label>
                  <div className="radio-group">
                    {[...selectedFamily.techLevels].sort((a,b)=>{
                      const na=parseFloat(a),nb=parseFloat(b);
                      return(!isNaN(na)&&!isNaN(nb))?na-nb:a.localeCompare(b);
                    }).map(t=>{
                      const techOff = nationsTechOffPlan(selectedFamily, t);
                      const pInfo = techOff ? null : techLevelPriceInfo(selectedFamily, t);
                      return (
                      <div key={t} className={`radio-pill ${s.techLevel===t?"active":""}`}
                        title={techOff ? "Not covered by the patient's NationsBenefits plan" : undefined}
                        style={techOff ? {opacity:0.6,cursor:"not-allowed",color:"#b91c1c",background:"#fef2f2",borderColor:"#fecaca"} : undefined}
                        onClick={techOff ? undefined : ()=>updSide(side,"techLevel",t)}>
                        <div className="radio-pill-label">{(selectedFamily.techLevelLabels?.[t] || t)}{techOff ? " *" : ""}</div>
                        {pInfo && (
                          <div className="radio-pill-sub">
                            {pInfo.price === 0 ? "No Charge" : `$${moneyLabel(pInfo.price)}/aid`}{pInfo.offPlan ? " retail — off-plan" : ""}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                  {form.payType === "private" && form.tier && s.techLevel
                    && tierMatchedTech(selectedFamily, form.tier, productCatalogTiers) === s.techLevel && (
                    <div style={{fontSize:11.5,color:"#6b7280",marginTop:8}}>
                      Matched to your {form.tier} choice from the Technology Tier step — picking a different level changes the price.
                    </div>
                  )}
                  {isNationsPatient && selectedFamily.techLevels.some(t => nationsCoverageTier(selectedFamily, t) === null) && (
                    <div style={{fontSize:11.5,color:"#b91c1c",marginTop:8}}>
                      * Not covered by the patient's NationsBenefits plan.
                    </div>
                  )}
                </div>
              ))}
            </>)}

            {/* ── Private-label: CROS transmitter side. The cascade collapses to
                a summary card — the transmitter mirrors the aid it was copied
                from (model/color) and has no receiver, gain, or dome of its
                own. Removing it restores the blank TH cascade for this ear. ── */}
            {showTH && s.isCROS && (
              <div style={{background:"#eef2ff",border:"1px solid #a5b4fc",borderRadius:8,padding:"14px 16px",marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,color:"#4f46e5",marginBottom:4}}>📡 CROS Transmitter</div>
                <div style={{fontSize:12.5,color:"#374151",lineHeight:1.5}}>
                  {(TH_MODELS.find(m=>m.id===s.thModel)?.label || "TruHearing")} CROS unit{s.color ? ` · ${s.color}` : ""} — picks up sound on this side and routes it to the aid on the other ear.
                </div>
                <button className="side-action-btn" style={{marginTop:10}}
                  onClick={(e)=>{ e.stopPropagation(); resetSide(side, {manufacturer:"TruHearing", techLevel:form.tier}); }}>
                  ✕ Remove CROS transmitter
                </button>
              </div>
            )}

            {/* ── Private-label: TruHearing cascade (skipped for Direct Purchase) ── */}
            {/* Tier was chosen in the Technology Tier wizard step (4); this
                cascade now starts at Body Style. The chosen tier flows into
                each side via form.tier → s.techLevel sync (see useEffect). */}
            {showTH && !s.isCROS && (<>
              {/* Locked technology-level chip — the tech level was decided on
                  the Technology Tier step (form.tier → techLevel sync effect);
                  this is context, not a picker, so the cascade below reads as
                  "pick the model/style" rather than picking the tier again. */}
              {s.techLevel && (
                <div className="field" style={{marginBottom:16}}><label>Technology Level</label>
                  <div style={{display:"inline-flex",alignItems:"center",gap:8,border:"2px solid #0B4A42",background:"#FBF9F3",borderRadius:8,padding:"8px 12px"}}>
                    <span style={{fontSize:14,fontWeight:700,color:"#0a1628"}}>{s.techLevel} technology</span>
                    <span style={{fontSize:12,color:"#6b7280"}}>chosen in Technology Tier</span>
                  </div>
                  <div style={{fontSize:11.5,color:"#6b7280",marginTop:6}}>
                    Every model below comes with {s.techLevel}-level processing at this price. The model number is the platform generation — how recent the chip inside is — not a different technology level.
                  </div>
                </div>
              )}

              {/* Body Style — seeded by the shared picker above; compact chip
                  with a per-ear "Change" escape hatch, same as the standard
                  flow. */}
              {s.techLevel && d.thAvailBodyStyles.length > 0 && (s.thBodyStyle && expandedStyleGrid !== side ? (
                <div className="field" style={{marginBottom:16}}><label>Body Style</label>
                  <div style={{display:"flex",alignItems:"center",gap:10,border:"1px solid #E4E0D5",background:"#FBF9F3",borderRadius:10,padding:"8px 12px"}}>
                    {(d.thAvailBodyStyles.find(b=>b.id===s.thBodyStyle)?.img) && (
                      <img src={d.thAvailBodyStyles.find(b=>b.id===s.thBodyStyle).img} alt="" style={{width:34,height:34,objectFit:"contain",flexShrink:0}} />
                    )}
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>{d.thAvailBodyStyles.find(b=>b.id===s.thBodyStyle)?.label || s.thBodyStyle}</div>
                      <div style={{fontSize:11,color:"#6b7280"}}>{d.thAvailBodyStyles.find(b=>b.id===s.thBodyStyle)?.desc || ""}</div>
                    </div>
                    <button className="side-action-btn" style={{marginLeft:"auto",flexShrink:0}}
                      onClick={(e)=>{ e.stopPropagation(); setExpandedStyleGrid(side); }}>
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div className="field" style={{marginBottom:16}}><label>Body Style</label>
                  <div className="style-grid">
                    {d.thAvailBodyStyles.map(bs=>(
                      <div key={bs.id} className={`style-card ${s.thBodyStyle===bs.id?"active":""}`}
                        onClick={()=>{ setForm(f=>({...f,[side]:{...f[side], thBodyStyle:bs.id, thModel:"", style:"", color:"", faceplateColor:"", shellColor:"", gainMatrix:"", battery:"", receiverLength:"", receiverPower:"", dome:"", domeCategory:"", domeSize:""}})); setExpandedStyleGrid(null); }}>
                        {bs.img && (
                          <img src={bs.img} alt={bs.label}
                            style={{display:"block",margin:"0 auto 6px",width:56,height:56,objectFit:"contain",opacity:s.thBodyStyle===bs.id?1:0.5}} />
                        )}
                        <div className="style-id">{bs.label}</div>
                        <div className="style-desc">{bs.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* 3. Model */}
              {s.thBodyStyle && d.thAvailModels.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Model</label>
                  <div className="radio-group" style={{flexWrap:"wrap"}}>
                    {d.thAvailModels.map(m=>{
                      // If this model+body-style resolves to exactly one specific TH style,
                      // auto-select it (battery/gain/shell too) so no variant sub-picker is needed.
                      const variantIds = (TH_AVAILABILITY[`${m.id}|${s.techLevel}`] || [])
                        .filter(sid => TH_STYLE_TO_BODY[sid] === s.thBodyStyle);
                      const autoStyle = variantIds.length === 1 ? variantIds[0] : "";
                      const autoBattery = autoStyle ? (TH_BATTERY[`${m.id}|${autoStyle}`] || "") : "";
                      const autoGainOpts = autoStyle ? (TH_GAIN_MATRIX[`${m.id}|${autoStyle}`] || []) : [];
                      const autoGain = autoGainOpts.length === 1 ? autoGainOpts[0].id : "";
                      const autoShell = autoStyle === "if" ? "Red/Blue" : "";
                      return (
                        <div key={m.id} className={`radio-pill ${s.thModel===m.id?"active":""}`}
                          onClick={()=>setForm(f=>({...f,[side]:{...f[side], thModel:m.id, style:autoStyle, color:"", faceplateColor:"", shellColor:autoShell, gainMatrix:autoGain, battery:autoBattery, receiverLength:"", receiverPower:"", dome:"", domeCategory:"", domeSize:"", familyId:"", variant:"", generation:""}}))}>
                          <div className="radio-pill-label">{m.label}</div>
                          {/* Platform subtitle — the number is the generation,
                              not a tier; without this it invites a false
                              Signia-style "7 = top tier" reading. */}
                          <div className="radio-pill-sub">{TH_PLATFORM_NOTE[m.platform] || ""}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Variant — only shown when one body-style category maps to multiple specific TH styles (e.g. BTE → S/P/SP, RIC → RIC/RIC+BCT/SR, ITE → HS/FS) */}
              {s.thModel && d.thAvailVariants.length > 1 && (
                <div className="field" style={{marginBottom:16}}><label>Variant</label>
                  <div className="radio-group" style={{flexWrap:"wrap"}}>
                    {d.thAvailVariants.map(st=>{
                      const autoBattery = TH_BATTERY[`${s.thModel}|${st.id}`] || "";
                      const autoGainOptions = TH_GAIN_MATRIX[`${s.thModel}|${st.id}`] || [];
                      const autoGain = autoGainOptions.length === 1 ? autoGainOptions[0].id : "";
                      const autoShell = st.id === "if" ? "Red/Blue" : "";
                      return (
                        <div key={st.id} className={`radio-pill ${s.style===st.id?"active":""}`}
                          onClick={()=>setForm(f=>({...f,[side]:{...f[side], style:st.id, color:"", faceplateColor:"", shellColor:autoShell, gainMatrix:autoGain, battery:autoBattery, receiverLength:"", receiverPower:"", dome:"", domeCategory:"", domeSize:""}}))}>
                          <div className="radio-pill-label">{st.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Color — conditional by style category */}
              {s.style && d.thColorCategory === "ric_bte" && (
                <div className="field" style={{marginBottom:16}}><label>Color</label>
                  <div className="color-swatches">
                    {TH_COLORS.ric_bte.map(c=>(
                      <div key={c} className={`color-swatch ${s.color===c?"active":""}`} onClick={()=>updSide(side,"color",c)} style={{display:"flex",alignItems:"center",gap:6}}>
                        {(()=>{const mt=getMultiToneColors(c);const hex=COLOR_HEX_MAP[c];if(mt)return(
                          <svg width="16" height="16" viewBox="0 0 16 16" style={{flexShrink:0}}><clipPath id={`mt${side}${c.replace(/\W/g,"")}`}><circle cx="8" cy="8" r="7"/></clipPath><g clipPath={`url(#mt${side}${c.replace(/\W/g,"")})`}><rect x="0" y="0" width="8" height="16" fill={mt[0]}/><rect x="8" y="0" width="8" height="16" fill={mt[1]}/></g><circle cx="8" cy="8" r="7" fill="none" stroke="#d1d5db" strokeWidth="1"/></svg>
                        );if(hex)return(<span style={{display:"inline-block",width:16,height:16,borderRadius:"50%",background:hex,border:"1px solid #d1d5db",flexShrink:0}}/>);return null;})()}
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {s.style && d.thColorCategory === "slim_ric" && (
                <div className="field" style={{marginBottom:16}}><label>Color</label>
                  <div className="color-swatches">
                    {TH_COLORS.slim_ric.map(c=>(
                      <div key={c} className={`color-swatch ${s.color===c?"active":""}`} onClick={()=>updSide(side,"color",c)} style={{display:"flex",alignItems:"center",gap:6}}>
                        {(()=>{const mt=getMultiToneColors(c);const hex=COLOR_HEX_MAP[c];if(mt)return(
                          <svg width="16" height="16" viewBox="0 0 16 16" style={{flexShrink:0}}><clipPath id={`mt${side}${c.replace(/\W/g,"")}`}><circle cx="8" cy="8" r="7"/></clipPath><g clipPath={`url(#mt${side}${c.replace(/\W/g,"")})`}><rect x="0" y="0" width="8" height="16" fill={mt[0]}/><rect x="8" y="0" width="8" height="16" fill={mt[1]}/></g><circle cx="8" cy="8" r="7" fill="none" stroke="#d1d5db" strokeWidth="1"/></svg>
                        );if(hex)return(<span style={{display:"inline-block",width:16,height:16,borderRadius:"50%",background:hex,border:"1px solid #d1d5db",flexShrink:0}}/>);return null;})()}
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {s.style && d.thColorCategory === "if" && (
                <div className="field-grid" style={{marginBottom:16}}>
                  <div className="field"><label>Faceplate Color</label>
                    <select value={s.faceplateColor} onChange={e=>updSide(side,"faceplateColor",e.target.value)}>
                      <option value="">Select...</option>
                      {TH_COLORS.if_faceplate.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Shell Color</label>
                    <select value={s.shellColor} onChange={e=>updSide(side,"shellColor",e.target.value)} disabled={true}>
                      <option value="Red/Blue">Red/Blue</option>
                    </select>
                  </div>
                </div>
              )}
              {s.style && d.thColorCategory === "custom" && (
                <div className="field-grid" style={{marginBottom:16}}>
                  <div className="field"><label>Faceplate Color</label>
                    <select value={s.faceplateColor} onChange={e=>updSide(side,"faceplateColor",e.target.value)}>
                      <option value="">Select...</option>
                      {TH_COLORS.custom_faceplate.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Shell Color</label>
                    <select value={s.shellColor} onChange={e=>updSide(side,"shellColor",e.target.value)}>
                      <option value="">Select...</option>
                      {TH_COLORS.custom_shell.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* 5. Battery Type (auto-populated, read-only) */}
              {s.style && d.thBattery && (
                <div className="field" style={{marginBottom:16}}><label>Battery Type</label>
                  <div style={{padding:"8px 12px",background:"#FAF8F2",border:"1px solid #E4E0D5",borderRadius:8,fontSize:13,color:"#374151"}}>
                    {d.thBattery}
                  </div>
                </div>
              )}

              {/* 6. Receiver Length (RIC/RIC+BCT/SR only) */}
              {s.style && d.thHasReceiver && (
                <div className="field" style={{marginBottom:16}}><label>Receiver Length</label>
                  <select value={s.receiverLength} onChange={e=>updSide(side,"receiverLength",e.target.value)}>
                    <option value="">Select...</option>
                    {RECEIVER_LENGTHS.map(l=><option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}

              {/* 7. Gain/Matrix */}
              {s.style && d.thGainOptions.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Receiver Gain / Matrix</label>
                  {d.thGainOptions.length === 1 ? (
                    <div style={{padding:"8px 12px",background:"#FAF8F2",border:"1px solid #E4E0D5",borderRadius:8,fontSize:13,color:"#374151"}}>
                      {d.thGainOptions[0].label}
                    </div>
                  ) : (
                    <select value={s.gainMatrix} onChange={e=>updSide(side,"gainMatrix",e.target.value)}>
                      <option value="">Select...</option>
                      {d.thGainOptions.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* 8. Coupling — domes or custom earmold (RIC/RIC+BCT/SR).
                  TH aids are Signia-built, so the earmold picker resolves to
                  the Signia catalog + order form (Kurt, 2026-08-29). */}
              {s.style && d.thHasReceiver && s.gainMatrix && (
                (s.coupling || (d.thRequiresEarmold ? "earmold" : "dome")) === "earmold" ? (
                  <div style={{marginBottom:16}}>
                    <CouplingChips side={side} s={s} updSide={updSide} requiresEarmold={d.thRequiresEarmold} />
                    <EarmoldPicker side={side} sd={s} updSide={updSide} deviceType="ric" />
                  </div>
                ) : (
                  <div style={{marginBottom:16}}>
                    <CouplingChips side={side} s={s} updSide={updSide} requiresEarmold={d.thRequiresEarmold} />
                    <div className="field-grid" style={{marginBottom:0}}>
                      <div className="field"><label>Dome Category</label>
                        <select value={s.domeCategory} onChange={e=>setForm(f=>({...f,[side]:{...f[side], domeCategory:e.target.value, domeSize:""}}))}>
                          <option value="">Select...</option>
                          {Object.keys(TH_DOMES).map(cat=><option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                      {s.domeCategory && TH_DOMES[s.domeCategory] && (
                        <div className="field"><label>Dome Size</label>
                          <select value={s.domeSize} onChange={e=>updSide(side,"domeSize",e.target.value)}>
                            <option value="">Select...</option>
                            {TH_DOMES[s.domeCategory].map(sz=><option key={sz} value={sz}>{sz}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </>)}

            {/* ── 7–8. Color / Battery (standard catalog + Direct Purchase) ── */}
            {showStd && (<>
              {s.techLevel && availColors.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>{selectedFamily?.faceplate ? "Faceplate Color" : "Color"}</label>
                  <div className="color-swatches">
                    {availColors.map(c=>(
                      <div key={c} className={`color-swatch ${s.color===c?"active":""}`} onClick={()=>updSide(side,"color",c)} style={{display:"flex",alignItems:"center",gap:6}}>
                        {(()=>{const mt=getMultiToneColors(c);const hex=COLOR_HEX_MAP[c];if(mt)return(
                          <svg width="16" height="16" viewBox="0 0 16 16" style={{flexShrink:0}}><clipPath id={`mt${side}${c.replace(/\W/g,"")}`}><circle cx="8" cy="8" r="7"/></clipPath><g clipPath={`url(#mt${side}${c.replace(/\W/g,"")})`}><rect x="0" y="0" width="8" height="16" fill={mt[0]}/><rect x="8" y="0" width="8" height="16" fill={mt[1]}/></g><circle cx="8" cy="8" r="7" fill="none" stroke="#d1d5db" strokeWidth="1"/></svg>
                        );if(hex)return(<span style={{display:"inline-block",width:16,height:16,borderRadius:"50%",background:hex,border:"1px solid #d1d5db",flexShrink:0}}/>);return null;})()}
                        {c}
                      </div>
                    ))}
                  </div>
                  {selectedFamily?.faceplate && (
                    <div style={{fontSize:11,color:"#6b7280",marginTop:8,display:"flex",alignItems:"center",gap:6}}>
                      <span style={{width:11,height:11,borderRadius:"50%",flexShrink:0,border:"1px solid #d1d5db",background: side==="left" ? "#2563eb" : "#dc2626"}} />
                      Shell: {side==="left" ? "Blue (left ear)" : "Red (right ear)"} — fixed by side, not selectable.
                    </div>
                  )}
                </div>
              )}
              {s.techLevel && availBatteries.length > 1 && (
                <div className="field" style={{marginBottom:16}}><label>Battery Type</label>
                  <div className="radio-group">
                    {availBatteries.map(b=>(
                      <div key={b} className={`radio-pill ${s.battery===b?"active":""}`} onClick={()=>updSide(side,"battery",b)}>
                        <div className="radio-pill-label">{b}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>)}

            {/* ── 9. Receiver + Dome (RIC — standard catalog + Direct Purchase) ── */}
            {showStd && s.style === "ric" && s.techLevel && availPowers.length > 0 && (
              <>
                <div style={{height:1,background:"#F0EDE3",margin:"4px 0 16px"}} />
                <div className="field-grid" style={{marginBottom:0}}>
                  <div className="field"><label>Receiver Length</label>
                    <select value={s.receiverLength} onChange={e=>updSide(side,"receiverLength",e.target.value)}>
                      <option value="">Select…</option>
                      {RECEIVER_LENGTHS.map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Receiver Power</label>
                    <select value={s.receiverPower} onChange={e=>{
                      const pw=e.target.value;
                      updSide(side,"receiverPower",pw);
                      // An HP/earmold power auto-suggests the earmold coupling
                      // and clears the now-inapplicable dome (#42a).
                      if((RECEIVER_POWERS[s.manufacturer]||[]).find(p=>p.id===pw)?.earmold){ updSide(side,"dome",""); updSide(side,"coupling","earmold"); }
                    }}>
                      <option value="">Select…</option>
                      {availPowers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                {s.receiverPower && (
                  <CouplingSection side={side} s={s} updSide={updSide}
                    requiresEarmold={requiresEarmold} availDomes={availDomes} deviceType="ric" />
                )}
              </>
            )}

            {/* ── BTE coupling — traditional BTEs couple via tube + earmold (#42a) ── */}
            {showStd && s.style === "bte" && s.techLevel && (
              <>
                <div style={{height:1,background:"#F0EDE3",margin:"4px 0 16px"}} />
                <CouplingSection side={side} s={s} updSide={updSide}
                  requiresEarmold={false} availDomes={availDomes} deviceType="bte" />
              </>
            )}

            {/* ── IF (Instant Fit) — Dome only, no separate receiver ── */}
            {showStd && s.style === "if" && s.techLevel && availDomes.length > 0 && (
              <>
                <div style={{height:1,background:"#F0EDE3",margin:"4px 0 16px"}} />
                <div className="field" style={{marginBottom:0}}>
                  <label>Dome Type</label>
                  <select value={s.dome} onChange={e=>updSide(side,"dome",e.target.value)}>
                    <option value="">Select…</option>
                    {availDomes.map(dm=><option key={dm}>{dm}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        );
      };

      const leftConfigured = isSideConfigured("left");
      const rightConfigured = isSideConfigured("right");
      // TH card flow sides never carry a familyId, so hasCROSVariant (catalog-
      // derived) is always false there — CROS availability comes from the TH
      // config instead (RIC-form aids). A side that is itself a transmitter
      // can't anchor another CROS.
      const thCardFlow = isPrivateLabel && !directPurchaseActive;
      const leftHasCROS  = thCardFlow ? (leftDerived.thHasCROS  && !form.left.isCROS)  : leftDerived.hasCROSVariant;
      const rightHasCROS = thCardFlow ? (rightDerived.thHasCROS && !form.right.isCROS) : rightDerived.hasCROSVariant;
      // Copy `src` onto the opposite side as a CROS transmitter. TH flow flags
      // isCROS and strips receiver/gain/dome (transmitters have none); the
      // standard catalog flow keeps its variant-string mechanism.
      // A CROS transmitter never takes an earmold — coupling + mold fields
      // are stripped along with the receiver/dome (#42a).
      const CROS_STRIP = { coupling:"", earmoldStyle:"", earmoldMaterial:"", earmoldColor:"", earmoldVent:"", earmoldVentSize:"", earmoldCanal:"", earmoldNotes:"" };
      const copyAsCros = (src, targetSide) => {
        if (thCardFlow) {
          setForm(f=>({...f,[targetSide]:{...src, isCROS:true, variant:"", gainMatrix:"", receiverLength:"", receiverPower:"", dome:"", domeCategory:"", domeSize:"", ...CROS_STRIP}}));
        } else {
          const crosFam = catalog.find(e => e.id === src.familyId);
          const crosVariant = crosFam?.variants.find(v=>v.toLowerCase().includes("cros")) || "CROS";
          setForm(f=>({...f,[targetSide]:{...src, variant:crosVariant, receiverLength:"", receiverPower:"", dome:"", ...CROS_STRIP}}));
        }
        setActiveSide(targetSide);
      };

      // ── Style-first picker (both catalogs) ───────────────────────────────
      // Opens the step: real Signia packshots + stat bars + audiogram engine
      // guidance, one click seeds both ears. The TH flow scopes the cards to
      // what the chosen tier allows; per-ear "Change" chips below stay the
      // escape hatch for CROS and asymmetric fits.
      const pickerStyles = thCardFlow
        ? leftDerived.thAvailBodyStyles
        : BODY_STYLES.map(bs => ({ id: bs.id, label: bs.label, desc: bs.desc, img: BODY_STYLE_IMG[bs.id] }));
      const pickerSelected = thCardFlow
        ? (form.left.thBodyStyle && form.left.thBodyStyle === form.right.thBodyStyle ? form.left.thBodyStyle : null)
        : (form.left.style && form.left.style === form.right.style ? form.left.style : null);
      // couplingId (dome|earmold) arrives from the picker's coupling fork
      // (#42a) as a suggested default for both ears. A style-only pick
      // (couplingId undefined) keeps any coupling already chosen.
      const seedBothEars = (id, couplingId) => {
        if (thCardFlow) {
          // Mirrors the per-ear TH grid's reset (keeps techLevel, wipes the
          // downstream cascade) — applied to both ears in one update.
          const wipe = { thBodyStyle:id, thModel:"", style:"", color:"", faceplateColor:"", shellColor:"", gainMatrix:"", battery:"", receiverLength:"", receiverPower:"", dome:"", domeCategory:"", domeSize:"", isCROS:false };
          if (couplingId !== undefined) wipe.coupling = couplingId;
          setForm(f => ({ ...f, left:{...f.left, ...wipe}, right:{...f.right, ...wipe} }));
        } else if (couplingId !== undefined && (form.left.style === id || form.right.style === id)) {
          // Coupling click after the style is already seeded — set coupling
          // without wiping the cascade the provider may have started.
          setForm(f => ({ ...f,
            left: f.left.style === id ? { ...f.left, coupling: couplingId } : f.left,
            right: f.right.style === id ? { ...f.right, coupling: couplingId } : f.right,
          }));
        } else {
          const seed = directPurchaseActive ? { style:id, manufacturer:"Signia" } : { style:id };
          if (couplingId !== undefined) seed.coupling = couplingId;
          resetSide("left", seed);
          resetSide("right", seed);
        }
        setExpandedStyleGrid(null);
      };
      const anyStyleChosen = thCardFlow
        ? !!(form.left.thBodyStyle || form.right.thBodyStyle || form.left.isCROS || form.right.isCROS)
        : !!(form.left.style || form.right.style);
      // TH flow with no tier picked yet has no style list — fall back to the
      // ungated per-ear columns rather than a dead end.
      const showPicker = pickerStyles.length > 0;

      return (
        <>
          <div className="card">
            <div className="card-title">Treatment Options</div>

            {isPrivateLabel && !directPurchaseActive && (
              <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#1e40af",fontWeight:600}}>
                🏷️ TruHearing Select — choose technology tier, model, and style to configure the device.
              </div>
            )}
            {directPurchaseActive && (
              <div style={{background:"#FBF9F3",border:"1px solid #E4E0D5",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#0B4A42",fontWeight:600}}>
                🔁 Direct Purchase — Signia portfolio at the {form.tier || "selected"} tier price. Tech level is locked to the tier.
              </div>
            )}

            {showPicker && (
              <BodyStylePicker
                styles={pickerStyles}
                selectedId={pickerSelected}
                selectedCoupling={form.left.coupling || form.right.coupling || ""}
                onSelect={seedBothEars}
                audiology={form.audiology}
                subtitle={thCardFlow ? "Every style shown is covered at the chosen tier — one click sets both ears." : undefined}
              />
            )}

            {/* Ear columns appear once a style is chosen (or immediately when
                the picker can't render, e.g. TH flow before a tier exists). */}
            {(!showPicker || anyStyleChosen) && (
            <div className="device-columns">
              {/* ── Left Column ── */}
              {renderSideColumn("left")}

              {/* ── Center Copy Buttons ── */}
              <div className="copy-actions">
                <button className="copy-btn" disabled={!leftConfigured}
                  onClick={()=>{ setForm(f=>({...f,right:{...f.left}})); setActiveSide("right"); }}
                  title="Copy left ear settings to right ear">
                  Copy to Right →
                </button>
                {leftHasCROS && (
                  <button className="copy-btn cros" disabled={!leftConfigured}
                    onClick={()=>copyAsCros(form.left, "right")}
                    title="Copy as CROS transmitter to right ear">
                    📡 CROS →
                  </button>
                )}
                <div style={{height:1,width:24,background:"#E4E0D5",margin:"4px 0"}} />
                <button className="copy-btn" disabled={!rightConfigured}
                  onClick={()=>{ setForm(f=>({...f,left:{...f.right}})); setActiveSide("left"); }}
                  title="Copy right ear settings to left ear">
                  ← Copy to Left
                </button>
                {rightHasCROS && (
                  <button className="copy-btn cros" disabled={!rightConfigured}
                    onClick={()=>copyAsCros(form.right, "left")}
                    title="Copy as CROS transmitter to left ear">
                    ← CROS 📡
                  </button>
                )}
              </div>

              {/* ── Right Column ── */}
              {renderSideColumn("right")}
            </div>
            )}

            {/* ── Mismatched-manufacturer caution ── */}
            {manufacturerMismatch && (
              <div style={{background:"#fef9c3",border:"1px solid #fde047",borderRadius:8,padding:"10px 14px",marginTop:12,fontSize:13,color:"#854d0e"}}>
                <strong>Mixed-manufacturer fitting flagged.</strong>{" "}
                Left and right ears are configured with different manufacturers. Per-ear pricing below
                reflects each device's anchor; verify this is intentional before generating the quote.
              </div>
            )}

            {/* ── Pricing Reveal ── */}
            {(() => {
              const bothDone = leftConfigured && rightConfigured;
              const anyConfigured = leftConfigured || rightConfigured;

              // Complex commercial/PPO benefit takes precedence for eligible
              // insurance patients once the provider opens the VOB calculator
              // (or the patient already has one saved). Prices from the device
              // retail baseline; financing follows the computed patient total.
              if (complexEligible && (cbOpen || cbInputs)) {
                const cbResult = (cbInputs && complexBaselinePerAid)
                  ? computeComplexBenefit({ baselinePerAid: complexBaselinePerAid, fittingType: bothDone ? 'binaural' : 'monaural', inputs: cbInputs })
                  : null;
                return (
                  <>
                    <ComplexBenefitCalculator
                      baselinePerAid={complexBaselinePerAid}
                      fittingType={bothDone ? 'binaural' : 'monaural'}
                      initial={cbInputs}
                      onSave={handleSaveComplexBenefit}
                      onCancel={cbInputs ? null : () => setCbOpen(false)}
                    />
                    {cbResult && cbResult.patientTotal > 0 && <FinancingCalculator total={cbResult.patientTotal} lang={displayLang} />}
                  </>
                );
              }

              // UHCH Relate (Gold/Platinum) and off-plan devices have no retail
              // anchor → pricingRevealData is null, but they DO have a price.
              // Render the investment without a savings badge (Kurt: Relate has
              // no street retail to anchor against); off-plan additionally shows
              // the acknowledgement-form flag and bills standard retail.
              const pt = PRICING_T[displayLang] || PRICING_T.en;
              const isDeviceDrivenTpa = form.tpa === 'UHCH' || form.tpa === 'Nations';
              const tpaName = form.tpa === 'Nations' ? 'NationsBenefits' : 'UHCH';
              // Insurance selected but no plan chosen → the device is priced at
              // standard retail (deriveEarPrice 'insurance-standard'); show that
              // flat price (no plan copay/savings to anchor) rather than a blank
              // screen. Gate on a resolved ear price, not form.tierPrice, which
              // the wizard never sets for a no-plan patient.
              const isInsuranceNoPlan = form.payType === 'insurance' && !isDeviceDrivenTpa && !selectedInsurancePlan;
              const anyEarPriced = (leftEarPrice?.price != null) || (rightEarPrice?.price != null);
              if ((isDeviceDrivenTpa || isInsuranceNoPlan) && anyConfigured && anyEarPriced && !pricingRevealData) {
                const fmt2 = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const ovr = form.priceOverridePerAid;
                const lp = (ovr != null && leftEarPrice?.source  !== 'cros') ? ovr : (leftEarPrice?.price  ?? null);
                const rp = (ovr != null && rightEarPrice?.source !== 'cros') ? ovr : (rightEarPrice?.price ?? null);
                const offPlan = !!(leftEarPrice?.offPlan || rightEarPrice?.offPlan);
                const pairTotal = (lp != null || rp != null) ? (lp || 0) + (rp || 0) : null;
                const investment = (bothDone && pairTotal != null) ? pairTotal : ((ovr ?? form.tierPrice) ?? lp ?? rp ?? 0);
                return (
                  <div style={{background: offPlan ? "#fff7ed" : "#f0fdf4", border:`1px solid ${offPlan ? "#fed7aa" : "#bbf7d0"}`, borderRadius:12, padding:"20px 24px", marginTop:12}}>
                    {offPlan && (
                      <div style={{background:"#fffbeb",border:"1px solid #fde047",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12.5,color:"#854d0e",lineHeight:1.5}}>
                        <strong>⚠ Not on the {tpaName} plan.</strong> This device can't be ordered through the {tpaName} portal. The patient may purchase it at standard retail only after signing an insurance acknowledgement form.
                      </div>
                    )}
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>
                      {offPlan ? "Standard Retail · Off-Plan" : isInsuranceNoPlan ? "Standard Retail" : pt.investmentToday}
                    </div>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <span style={{fontSize:28,fontWeight:800,color:"#0a1628"}}>${fmt2(investment)}</span>
                      <span style={{fontSize:12,color:"#6b7280"}}>{bothDone ? pt.pairTwoAids : pt.perAid}</span>
                    </div>
                    {!offPlan && (
                      <div style={{fontSize:12,color:"#6b7280",marginTop:6}}>
                        {isInsuranceNoPlan
                          ? 'No insurance plan selected — showing standard retail. Add the plan to apply benefits.'
                          : form.tpa === 'Nations'
                            ? `${form.tier || 'Nations'} tier · NationsBenefits flat-rate copay.`
                            : 'Relate value pricing under UHCH — no separate retail comparison applies.'}
                      </div>
                    )}
                  </div>
                );
              }

              // Catalog hole: an on-plan device-driven tier (Nations / UHCH)
              // whose copay hasn't been reverse-engineered yet. Offer an inline
              // "verify rate" input instead of the dead placeholder below.
              const verifyEar = (leftConfigured && leftEarPrice?.requiresVerification) ? leftEarPrice
                : (rightConfigured && rightEarPrice?.requiresVerification) ? rightEarPrice : null;
              if (verifyEar) {
                const vTpaName = form.tpa === 'Nations' ? 'NationsBenefits' : (form.tpa === 'UHCH' ? 'UHCH' : (form.tpa || 'the plan'));
                return (
                  <VerifyRateCard
                    tpaName={vTpaName}
                    tier={verifyEar.tier}
                    onSave={(dollars) => handleVerifyRate(verifyEar.tier, dollars)}
                  />
                );
              }

              // Hold the reveal until a device is configured — tier alone (set
              // on the prior step) only yields the bare baseline, not a real price.
              if (!pricingRevealData || form.tierPrice == null || !anyConfigured) {
                return (
                  <div style={{background:"#FCF8EF",border:"1px solid #EADFC7",borderRadius:14,padding:"22px 24px",marginTop:12,textAlign:"center",color:"#9AA39B",fontSize:13,fontFamily:"'Sora',sans-serif"}}>
                    {pt.selectDeviceFirst}
                  </div>
                );
              }

              const { tierLabel, retailPerAid, copayPerAid, savingsPerAid, savingsPct, perEar, retailPerEar } = pricingRevealData;
              // Per-aid until both ears configured, then snap to pair. Avoids
              // the $0 headline when no device side has been picked yet.
              const multiplier = bothDone ? 2 : 1;
              // CROS-aware totals: when one ear is a CROS/BICROS unit the pair
              // total is (real aid price + $1,250), not 2 x aid price. Use the
              // per-ear breakdown when both ears resolve; otherwise fall back
              // to the simple copay x multiplier so unilateral fittings and
              // pre-device-pick states still render a sane headline.
              const hasPerEarPair = bothDone && perEar?.pairTotal != null;
              const investmentDisplay = hasPerEarPair ? perEar.pairTotal : copayPerAid * multiplier;
              const isPrivatePay = form.payType === "private";
              const hasCrosSide = perEar?.left?.source === 'cros' || perEar?.right?.source === 'cros';
              // Private pay carries no insurance discount on the device — the
              // price the patient pays IS the device's full retail, so device
              // retail == investment and the only value-add is the bundled
              // Complete Care+. Insurance keeps the real retail-vs-copay anchor:
              // for CROS fittings full retail = aid retail + $1,250 (CROS has no
              // markup); otherwise it's the per-aid anchor times the aid count.
              const retailDisplay = isPrivatePay
                ? investmentDisplay
                : (retailPerEar && bothDone && retailPerEar.pairTotal != null)
                    // Device-driven (Nations / UHCH non-Relate): per-ear retail
                    // sum keeps mismatched-brand fittings honest.
                    ? retailPerEar.pairTotal
                    : ((bothDone && hasCrosSide)
                        ? retailPerAid + CROS_PRICE_PER_UNIT
                        : retailPerAid * multiplier);
              const planCoversDisplay = retailDisplay - investmentDisplay;
              // Private-pay bundles Complete Care+ at no charge. Its $1,250 value
              // takes the "Plan covers" line (there's no insurance plan in private
              // pay) and folds into the retail/savings totals. Insurance keeps CC+
              // as a separate step-6 care-plan choice (ccPlusValue = 0 here).
              const CC_PLUS_VALUE = 1250;
              const ccPlusValue = isPrivatePay ? CC_PLUS_VALUE : 0;
              const retailWithCare = retailDisplay + ccPlusValue;
              const planCoversWithCare = planCoversDisplay + ccPlusValue;
              const savingsWithCare = Math.max(0, planCoversWithCare);
              const savingsPctDisplay = isPrivatePay
                ? (retailWithCare > 0 ? Math.round((savingsWithCare / retailWithCare) * 100) : 0)
                : savingsPct;
              // Anchor prices end in $.50 (e.g. 4997.50). Default toLocaleString
              // drops trailing zeros — "$4,997.5" — so force two decimals to
              // match the quote/PA output ([Distil.jsx:7542+] uses the same).
              const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              // Strip "Intake ID:" trace lines that intake conversion appends to notes.
              const chiefComplaint = (form.notes || "")
                .split("\n")
                .filter(line => !/^Intake ID:/i.test(line.trim()))
                .join("\n")
                .trim();

              // Structured reflection from intake answers — "you told us the hardest
              // moments are X, Y, Z" — replaces the free-text provider-notes quote.
              // Effort signals (drained / concentrating hard) shape the closing
              // clause; they can also carry the reflection alone when no
              // environments were flagged.
              const reflectAnswers = unwrapIntakeAnswers(wizardIntake?.answers) || null;
              const reflectFlags = flaggedEnvironments(reflectAnswers);
              const reflectEffort = flaggedEffortSignals(reflectAnswers).length > 0;
              const reflectSits = ENVIRONMENTS.filter(e => reflectFlags.has(e.id)).map(e => (pt.situationLabels[e.id] || SITUATION_LABEL[e.id] || e.label).toLowerCase());
              const reflectText = reflectSits.length === 0 ? null : pt.listJoin(reflectSits);

              return (
                <div style={{background:"#FCF8EF",border:"1px solid #EADFC7",borderRadius:14,padding:"22px 24px",marginTop:12,fontFamily:"'Sora',sans-serif",boxShadow:"0 1px 2px rgba(16,32,28,.04),0 14px 30px -22px rgba(120,90,30,.4)"}}>
                  {/* What the patient told us — structured from their intake
                      answers, falling back to the provider-notes quote when
                      nothing was flagged. */}
                  {reflectText ? (
                    <div style={{fontSize:13.5,color:"#54625C",fontStyle:"italic",borderLeft:"3px solid #B5832E",paddingLeft:13,marginBottom:16,lineHeight:1.55}}>
                      {pt.reflectHardest(reflectText, reflectEffort)}
                    </div>
                  ) : reflectEffort ? (
                    <div style={{fontSize:13.5,color:"#54625C",fontStyle:"italic",borderLeft:"3px solid #B5832E",paddingLeft:13,marginBottom:16,lineHeight:1.55}}>
                      {pt.reflectEffortOnly}
                    </div>
                  ) : chiefComplaint ? (
                    <div style={{fontSize:13.5,color:"#54625C",fontStyle:"italic",borderLeft:"3px solid #B5832E",paddingLeft:13,marginBottom:16,lineHeight:1.55}}>
                      "{chiefComplaint}"
                    </div>
                  ) : null}

                  {/* Technology tier label + display-language toggle */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#B5832E"}}>
                      {pt.tierTech(tierLabel)}
                    </div>
                    <LangToggle lang={displayLang} onChange={setDisplayLang} />
                  </div>

                  {/* Listening-effort framing — who does the work of separating
                      speech from noise at this tier (the counseling pivot away
                      from a hobby checklist). "Listening effort" is the one
                      consistent label across screens. Keyed off the tier
                      label's rank; silent if unmapped. */}
                  {(() => {
                    const effRank = rankFromTierLabel(tierLabel);
                    const eff = effRank != null ? (pt.tierEffort[effRank] || TIER_EFFORT_COPY[effRank]) : null;
                    return eff ? (
                      <div style={{fontSize:12.5,lineHeight:1.55,color:"#54625C",marginBottom:14}}>
                        <span style={{fontWeight:700,color:"#B5832E"}}>{pt.listeningEffort} · </span>{eff}
                      </div>
                    ) : null;
                  })()}

                  {/* Your investment — cost first, stated plainly, in the display serif */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#9AA39B",textTransform:"uppercase",letterSpacing:0.6,marginBottom:5}}>{pt.yourInvestment}</div>
                    <div style={{display:"flex",alignItems:"baseline",gap:9}}>
                      <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:38,fontWeight:600,color:"#16201D",lineHeight:1}}>${fmt(investmentDisplay)}</span>
                      <span style={{fontSize:12.5,color:"#54625C"}}>{bothDone ? pt.forBothAids : pt.perAid}</span>
                    </div>
                    {/* Per-aid toggle / per-ear breakdown. Shows the
                        simple "$X / aid" when ears match, and a labeled
                        per-ear breakdown when CROS or manufacturer
                        mismatch makes the two ears differ. */}
                    {bothDone && (() => {
                      const lp = perEar?.left?.price ?? null;
                      const rp = perEar?.right?.price ?? null;
                      const earsDiffer = lp != null && rp != null && lp !== rp;
                      if (!earsDiffer) {
                        return (
                          <div style={{fontSize:12,color:"#9AA39B",marginTop:3}}>
                            {pt.perAidSlash(`$${fmt(copayPerAid)}`)}
                          </div>
                        );
                      }
                      const leftFam  = catalog.find(e => e.id === form.left.familyId);
                      const rightFam = catalog.find(e => e.id === form.right.familyId);
                      const leftLabel  = perEar.left.source === 'cros' ? pt.crosUnit : (leftFam?.family || '—');
                      const rightLabel = perEar.right.source === 'cros' ? pt.crosUnit : (rightFam?.family || '—');
                      return (
                        <div style={{marginTop:8,fontSize:12,color:"#54625C"}}>
                          <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
                            <span>{pt.right} · {rightLabel}</span>
                            <span style={{fontWeight:600}}>${fmt(rp)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
                            <span>{pt.left} · {leftLabel}</span>
                            <span style={{fontWeight:600}}>${fmt(lp)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Insurance: plan coverage. Private pay: the bundled Complete
                      Care+ value takes this line — there is no insurance plan.
                      Brass carries the value (the number that helps them). */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderTop:"1px solid #EADFC7",fontSize:13}}>
                    {isPrivatePay ? (
                      <span style={{color:"#54625C",display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:"#1B8A7A",fontWeight:700}}>✓</span> Complete Care+ <span style={{color:"#9AA39B"}}>{pt.ccIncluded}</span>
                      </span>
                    ) : (
                      <span style={{color:"#54625C"}}>{pt.planCovers}</span>
                    )}
                    <span style={{fontWeight:700,color:"#6E4E16"}}>${fmt(planCoversWithCare)}</span>
                  </div>

                  {/* Full retail value — never shown without the savings beside it */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderTop:"1px solid #EADFC7",fontSize:13}}>
                    <span style={{color:"#9AA39B"}}>{pt.fullRetailValue}</span>
                    <span style={{color:"#9AA39B",textDecoration:"line-through"}}>${fmt(retailWithCare)}</span>
                  </div>

                  {/* Savings — the helping number, in brass */}
                  <div style={{background:"#F4EAD4",borderRadius:9,padding:"11px 14px",marginTop:10,display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>
                    <span style={{fontSize:13.5,fontWeight:700,color:"#6E4E16"}}>
                      {pt.youSave(`$${fmt(savingsWithCare)}`)}
                    </span>
                    <span style={{background:"#B5832E",color:"white",borderRadius:20,padding:"2px 11px",fontSize:11,fontWeight:700}}>
                      {pt.pctOff(savingsPctDisplay)}
                    </span>
                  </div>

                  {/* Complete Care+ — transparent terms, stated plainly ("5 years",
                      not "lifetime"). Bundled for private pay; the opt-out default
                      care plan for insurance (confirmed on the step-6 care-plan step). */}
                  <div style={{marginTop:16,background:"#0B4A42",borderRadius:11,padding:"15px 17px",color:"#fff"}}>
                    <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,fontWeight:600,marginBottom:6}}>{pt.fiveYearsTitle}</div>
                    <div style={{fontSize:12.5,lineHeight:1.6,color:"rgba(255,255,255,0.82)"}}>
                      {pt.fiveYearsBody}
                    </div>
                    {!isPrivatePay && (
                      <div style={{fontSize:11.5,lineHeight:1.5,color:"rgba(255,255,255,0.6)",marginTop:8}}>
                        {pt.defaultCarePlanNote}
                      </div>
                    )}
                  </div>

                  {/* Comfortable monthly options — interactive CareCredit / Allegro
                      calculator: deferred-interest (6/12/18) vs fixed-APR
                      (24/36/48/60) terms, with real APR + total cost shown. */}
                  <FinancingCalculator total={investmentDisplay} lang={displayLang} />
                </div>
              );
            })()}
            {complexEligible && !cbOpen && !cbInputs && (
              <button type="button" onClick={() => setCbOpen(true)}
                style={{marginTop:12,background:"none",border:"1px dashed #EADFC7",borderRadius:8,padding:"8px 12px",color:"#B5832E",fontSize:12,fontWeight:600,cursor:"pointer",width:"100%",fontFamily:"'Sora',sans-serif"}}>
                Coinsurance / deductible plan? Enter the VOB →
              </button>
            )}
          </div>
          {/* Then vs. Now — when the intake says the patient already wears
              hearing aids, offer the old-vs-new comparator right on Device
              Selection. Old side seeds from the intake's current-aids answers
              (provider refines via the picker); new side tracks the device
              being configured above. */}
          {(() => {
            const ia = unwrapIntakeAnswers(wizardIntake?.answers) || {};
            const hasCurrentAids = ia.aids_q === true || !!ia.aids_brand;
            if (!hasCurrentAids) return null;
            // Age free-text ("5 years", "2019") → release-year estimate. Tier
            // unknown from intake → Advanced-class assumption; the honesty
            // footnote + picker cover the confirm-at-point-of-use rule.
            const ageNum = parseInt(String(ia.aids_howOld || "").match(/\d+/)?.[0] ?? "", 10);
            const nowYear = new Date().getFullYear();
            const estYear = !Number.isFinite(ageNum) ? null : (ageNum > 1900 ? ageNum : nowYear - ageNum);
            const intakeOld = {
              kind: "intake",
              display: [ia.aids_brand, ia.aids_style].filter(Boolean).join(" ") || "Current hearing aids",
              sub: [ia.aids_howOld ? `~${ia.aids_howOld}` : null, "from intake — confirm"].filter(Boolean).join(" · "),
              tierRank: 3,
              releaseYear: estYear,
              directionalMic: null, bluetoothStreaming: null, rechargeable: null, telecoil: null,
            };
            const src = isSideConfigured("left") ? form.left : isSideConfigured("right") ? form.right : null;
            let proposedNew = null;
            if (src) {
              const fam = catalog.find(e => e.id === src.familyId);
              const rank = techLevelToRank(src.techLevel) ?? rankFromTierLabel(src.techLevel) ?? rankFromTierLabel(form.tier);
              proposedNew = {
                kind: "wizard",
                display: src.manufacturer === "TruHearing"
                  ? `TruHearing Select ${src.techLevel}`
                  : [src.manufacturer, fam?.family, src.techLevel].filter(Boolean).join(" "),
                sub: "Selected in this fitting",
                tierRank: rank,
                releaseYear: null, // current generation — no era penalty
                directionalMic: rank != null && rank >= 3 ? "beamforming" : "adaptive",
                bluetoothStreaming: true, rechargeable: true, telecoil: null,
              };
            }
            const compFlags = flaggedEnvironments(ia);
            return (
              <div className="card" style={{ marginTop: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="card-title" style={{ marginBottom: 2 }}>Then vs. Now</div>
                    <div style={{ fontSize: 12.5, color: "#6b7280" }}>
                      {[ia.aids_brand, ia.aids_howOld ? `about ${ia.aids_howOld} old` : null].filter(Boolean).join(" · ") || "Wears hearing aids today"} — show what the new technology changes.
                    </div>
                  </div>
                  <button className="btn-ghost" onClick={() => setShowWizardCompare(v => !v)}>
                    {showWizardCompare ? "Hide comparison" : "Compare with current aids"}
                  </button>
                </div>
                {showWizardCompare && (
                  <div style={{ marginTop: 16 }}>
                    <DeviceComparison variant="embedded" initialOld={intakeOld} proposedNew={proposedNew} flaggedEnvs={compFlags} lang={displayLang} />
                  </div>
                )}
              </div>
            );
          })()}
          {/* ── Investment summary + close fork ──────────────────────────
              Care Plan (step 4) now precedes devices, so Device Selection is
              the last stop before Review: the total investment and the
              PA/quote fork surface here once a side is configured. */}
          {(isSideConfigured("left") || isSideConfigured("right")) && (() => {
            const leftOk  = isSideConfigured("left");
            const rightOk = isSideConfigured("right");
            const aidCount = (leftOk ? 1 : 0) + (rightOk ? 1 : 0);
            // CROS-aware per-aid + pair totals. Falls back to tierPrice * aidCount
            // when per-ear pricing hasn't resolved. Effective per-aid honors a
            // confirmed Price Adjustment (§6); CROS sides keep their unit price.
            const ovr = form.priceOverridePerAid;
            const effPerAid = ovr ?? form.tierPrice;
            const leftEarP  = leftOk  ? ((ovr != null && leftEarPrice?.source  !== 'cros') ? ovr : (leftEarPrice?.price  ?? effPerAid)) : null;
            const rightEarP = rightOk ? ((ovr != null && rightEarPrice?.source !== 'cros') ? ovr : (rightEarPrice?.price ?? effPerAid)) : null;
            const perEarSum = (leftEarP || 0) + (rightEarP || 0);
            const aidTotal = perEarSum > 0 ? perEarSum : (effPerAid != null ? effPerAid * aidCount : null);
            // Standard Billing has no upfront commitment — $65/visit billed as
            // care is delivered, so grand total = device total only.
            const cpCostFor = (id) => id === "paygo" ? 0 : id === "punch" ? 575 : 1250;
            const selectedPlan = CARE_PLANS.find(c => c.id === form.carePlan);
            const cpCost = form.carePlan ? cpCostFor(form.carePlan) : null;
            const grandTotal = aidTotal != null && cpCost != null
              ? aidTotal + cpCost
              : aidTotal != null ? aidTotal
              : cpCost != null ? cpCost
              : null;
            return (
              <div className="card" style={{marginTop:24}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:10}}>Total Patient Investment</div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                  {aidTotal != null && (
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#374151"}}>
                      <span>Hearing aids ({aidCount} aid{aidCount!==1?"s":""}{form.tier ? ` · ${form.tier}` : form.payType === "private" ? " · Private Pay" : ""})</span>
                      <span style={{fontWeight:600}}>{aidTotal===0?"No Charge":`$${aidTotal.toLocaleString()}`}</span>
                    </div>
                  )}
                  {form.carePlan && (
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#374151"}}>
                      <span>{selectedPlan?.label}</span>
                      <span style={{fontWeight:600}}>
                        {form.carePlan==="paygo" ? "$65 per visit" : `$${cpCost.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{background:"linear-gradient(135deg,#0a1628,#1a3050)",borderRadius:12,padding:"18px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"rgba(255,255,255,0.45)"}}>Total Investment</div>
                    {aidCount===1 && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>One ear · configure second to update</div>}
                    {form.carePlan==="paygo" && (
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>
                        care plan billed per visit
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:32,fontWeight:800,color:"#1B8A7A",lineHeight:1}}>
                      {grandTotal===0?"No Charge":`$${grandTotal.toLocaleString()}`}
                    </div>
                  </div>
                </div>
                <div style={{marginTop:20,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
                  <div style={{display:"flex",gap:12,width:"100%",justifyContent:"center",flexWrap:"wrap"}}>
                    <button
                      style={{background:"#0B4A42",color:"white",border:"none",borderRadius:9,padding:"12px 24px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:"0 8px 18px -8px rgba(11,74,66,0.7)"}}
                      onClick={()=>{ setPaSignatureName(""); setPaStep("review"); setShowWizardPaModal(true); }}
                    >
                      Sign Purchase Agreement
                    </button>
                    <button
                      style={{background:"#fff",color:"#54625C",border:"1px solid #E4E0D5",borderRadius:9,padding:"12px 24px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}
                      onClick={handleGenerateQuote}
                    >
                      Generate Quote
                    </button>
                    <button
                      style={{background: form.priceOverridePerAid != null ? "#F4EAD4" : "#fff", color: form.priceOverridePerAid != null ? "#6E4E16" : "#54625C", border:`1px solid ${form.priceOverridePerAid != null ? "#EADFC7" : "#E4E0D5"}`, borderRadius:9, padding:"12px 24px", fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer"}}
                      onClick={()=>setShowAdjustModal(true)}
                    >
                      {form.priceOverridePerAid != null ? "Price Adjusted" : "Adjust Price"}
                    </button>
                  </div>
                  {form.tpa === "TruHearing" && (
                    <a
                      href="https://echo.truhearing.com/#/auth/login"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{display:"flex",alignItems:"center",gap:8,background:"#7c3aed",color:"white",border:"none",borderRadius:8,padding:"10px 22px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",textDecoration:"none"}}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      TruHearing Provider Login
                    </a>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      );
    }
    if (step === 4) {
      // Care Plan leads the treatment conversation (before tier or devices):
      // the patient commits to how success works — the ongoing care
      // relationship — and the hearing aids follow as a foregone conclusion.
      // Device totals and the PA/quote fork live at the end of Device
      // Selection (step 6), once devices actually exist.

      // Three peer options. Internal ids ('paygo' | 'punch' | 'complete')
      // are preserved for downstream code; only the patient-facing labels
      // change here.
      const CARE_PLAN_OPTIONS = [
        {
          id: "paygo",
          title: "Standard Billing",
          flag: null,
          price: "$65 per visit",
          bestFor: "Best for patients who prefer to pay only when they need care",
          items: [
            "Three-year manufacturer warranty",
            "No upfront commitment",
            "Pay per visit as needed",
          ],
        },
        {
          id: "punch",
          title: "MHC Punch Card",
          flag: "most savings",
          price: "$575 prepaid (save $400)",
          bestFor: "Best for low-maintenance ears and predictable care needs",
          items: [
            "Three-year manufacturer warranty",
            "Prepaid visit package",
            "Locked-in visit pricing",
          ],
        },
        {
          id: "complete",
          title: "Complete Care+",
          flag: "most coverage",
          price: "$1,250",
          bestFor: "Best for active lifestyles, moisture or wax-prone ears, maximum protection",
          items: [
            "Four-year warranty (extended year included)",
            "Four-year loss & damage coverage",
            "Unlimited visits for the life of your aids",
            "Priority scheduling",
          ],
        },
      ];

      const handleCarePlanSelect = (newId) => {
        const fromId = form.carePlan || null;
        if (fromId === newId) return;
        carePlanChangeCountRef.current += 1;
        logAnalyticsEvent("care_plan_changed", {
          patient_id: wizardPatientId,
          provider_id: staffId,
          clinic_id: clinicId,
          from_selection: fromId,
          to_selection: newId,
          change_count: carePlanChangeCountRef.current,
        });
        upd("carePlan", newId);
      };

      return (
        <>
          {/* Care journey visualization */}
          <CareJourney lang={displayLang} />

          {/* What ongoing treatment actually looks like — the lifetime care
              relationship, explained before the patient picks how to pay for
              it. Visit counts derive from CARE_ARC. */}
          <CareExpectations bridgeToPlans={form.payType !== "private"} lang={displayLang} />

          {/* Plan selector — three peer options, no pre-selection */}
          <div className="card">
            {form.payType !== "private" && (<>
            <div style={{marginBottom:20,fontFamily:"'DM Sans',sans-serif"}}>
              <h2 style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:24,fontWeight:700,color:"#111827",margin:0,letterSpacing:"-0.02em"}}>Choose your care plan</h2>
              <p style={{color:"#6b7280",fontSize:13,margin:"6px 0 0",lineHeight:1.5}}>Success with hearing aids comes from ongoing care. Pick the option that fits how you want to receive it — then we'll choose your technology together.</p>
            </div>

            <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"stretch"}}>
              {CARE_PLAN_OPTIONS.map(opt => {
                const selected = form.carePlan === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={()=>handleCarePlanSelect(opt.id)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    onKeyDown={(e)=>{ if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCarePlanSelect(opt.id); } }}
                    style={{
                      flex:"1 1 260px",
                      minWidth:0,
                      display:"flex",
                      flexDirection:"column",
                      background:"#fff",
                      border: selected ? "2px solid #0a1628" : "1.5px solid #E4E0D5",
                      borderRadius:14,
                      padding:"22px 20px 18px",
                      cursor:"pointer",
                      transition:"border-color 0.2s ease, box-shadow 0.2s ease",
                      boxShadow: selected ? "0 4px 18px rgba(10,22,40,0.08)" : "0 1px 2px rgba(0,0,0,0.03)",
                      fontFamily:"'DM Sans',sans-serif",
                      position:"relative",
                    }}
                  >
                    {/* Title + flag row */}
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",paddingRight:28}}>
                      <h3 style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:20,fontWeight:700,color:"#111827",margin:0,letterSpacing:"-0.01em"}}>{opt.title}</h3>
                      {opt.flag && (
                        <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"#6b7280",background:"#F0EDE3",padding:"3px 8px",borderRadius:4,whiteSpace:"nowrap"}}>{opt.flag}</span>
                      )}
                    </div>

                    {/* Price */}
                    <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:26,fontWeight:700,color:"#0a1628",lineHeight:1.1,marginTop:14}}>
                      {opt.price}
                    </div>

                    {/* Best-for */}
                    <div style={{fontStyle:"italic",fontSize:12,color:"#6b7280",marginTop:8,lineHeight:1.5}}>
                      {opt.bestFor}
                    </div>

                    {/* Items */}
                    <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:7,flexGrow:1}}>
                      {opt.items.map(item => (
                        <div key={item} style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:13,color:"#374151",lineHeight:1.45}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:3}}><polyline points="20 6 9 17 4 12"/></svg>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>

                    {/* Selection indicator */}
                    <div style={{position:"absolute",top:18,right:18,width:18,height:18,borderRadius:"50%",border: selected ? "2px solid #0a1628" : "2px solid #d1d5db",display:"flex",alignItems:"center",justifyContent:"center",transition:"border-color 0.2s ease",background:"#fff"}}>
                      {selected && <div style={{width:9,height:9,borderRadius:"50%",background:"#0a1628"}}/>}
                    </div>
                  </div>
                );
              })}
            </div>
            </>)}
          </div>
        </>
      );
    }
    if (step === 7) {
      const ReviewSide = ({side, label}) => {
        const d = form[side];
        const fam = catalog.find(e => e.id === d.familyId);
        const isTH = d.manufacturer === "TruHearing";
        if (!d.familyId && !isTH) return (
          <div className="review-row"><span className="review-key">{label}</span><span className="review-val" style={{color:"#9ca3af"}}>Not configured</span></div>
        );
        if (isTH && (!d.techLevel || !d.thModel)) return (
          <div className="review-row"><span className="review-key">{label}</span><span className="review-val" style={{color:"#9ca3af"}}>Not configured</span></div>
        );
        const pwrLabel = isTH
          ? ((TH_GAIN_MATRIX[`${d.thModel}|${d.style}`]||[]).find(g=>g.id===d.gainMatrix)?.label || d.gainMatrix || "—")
          : ((RECEIVER_POWERS[d.manufacturer]||[]).find(p=>p.id===d.receiverPower)?.label || "—");
        // Stored coupling wins; the receiver/gain derivation is only the
        // legacy fallback for sides saved before #42a.
        const isEm = d.coupling
          ? d.coupling === "earmold"
          : (isTH
            ? ((TH_GAIN_MATRIX[`${d.thModel}|${d.style}`]||[]).find(g=>g.id===d.gainMatrix)?.earmold || false)
            : ((RECEIVER_POWERS[d.manufacturer]||[]).find(p=>p.id===d.receiverPower)?.earmold || false));
        // Earmold summary from the catalog selection — "Custom Earmold — Skeleton · acrylic · standard vent"
        const emSummary = "Custom Earmold" + (d.earmoldStyle
          ? ` — ${[d.earmoldStyle, d.earmoldMaterial, d.earmoldColor, d.earmoldVent && `${d.earmoldVent} vent`].filter(Boolean).join(" · ")}`
          : " (details TBD)");
        const thDome = isEm ? emSummary : (d.domeCategory && d.domeSize ? `${d.domeCategory} ${d.domeSize}` : d.domeCategory || d.dome || "—");
        const styleLabel = BODY_STYLES.find(s=>s.id===d.style)?.label || d.style || "—";
        const thMod = TH_MODELS.find(m => m.id === d.thModel);
        // Platform generation follows the MODEL (TH7→IX, TH6→AX, TH5→X);
        // fam/generation fallbacks cover legacy sides saved outside the card flow.
        const thGen = thMod?.platform || fam?.generation || d.generation || "";
        const isLi = isTH ? (thMod?.li || false) : (fam?.rechargeable || false);
        const thHasReceiver = ["ric","ric_bct","sr"].includes(d.style);
        const planTierPrice = activePlans.find(p=>p.carrier===form.carrier&&p.planGroup===form.planGroup)
          ?.tiers?.find(t=>t.label===d.techLevel)?.price ?? null;
        return (
          <>
            <div className="review-row" style={{background:"#FBF9F3",borderRadius:6,padding:"6px 10px",margin:"4px 0"}}>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>{label}</span>
            </div>
            {[
              [d.manufacturer, "Manufacturer"],
              [isTH ? (thGen ? `${thGen} platform · TruHearing Select` : "TruHearing Select") : d.generation, "Platform"],
              [isTH ? (thMod?.label || "TruHearing Select") : (fam?.family||""), "Model Family"],
              ...(isTH ? [
                [styleLabel, "Body Style"],
                ...(d.variant ? [[d.variant, "Variant / Style"]] : []),
                [d.isCROS ? "CROS Transmitter" : "Standard", "CROS"],
                [isLi ? "Rechargeable (Li-Ion)" : (d.battery||"—"), "Battery"],
                // A CROS transmitter has no receiver/gain/dome of its own.
                ...(thHasReceiver && !d.isCROS ? [
                  [d.receiverLength||"—", "Receiver Length"],
                  [pwrLabel, "Receiver Power"],
                  [thDome, "Dome / Coupling"],
                ] : []),
                // Technology level prints ONCE, adjacent to Patient Cost —
                // the model rows above stay tier-free (same scheme as the
                // quote and purchase-agreement PDFs).
                [d.techLevel, "Technology Level"],
              ] : [
                [d.variant||"—", "Variant"],
                [d.color||"N/A", "Color"],
                [d.battery||"N/A", "Battery"],
              ]),
              ...(isTH ? [] : [[d.techLevel, "Tech Level"]]),
              ...(!isTH && d.style==="ric" ? [
                [d.receiverLength||"—", "Receiver Length"],
                [pwrLabel, "Receiver Power"],
              ] : []),
              ...(!isTH && (BODY_STYLES.find(b=>b.id===d.style)?.hasDome || d.style === "bte") ? [
                [isEm ? emSummary : (d.dome||"—"), "Dome / Coupling"],
              ] : []),
            ].map(([v,k])=>(
              <div className="review-row" key={k}><span className="review-key">{k}</span><span className="review-val">{v}</span></div>
            ))}
            {isTH && d.isCROS ? (
              // TruHearing CROS transmitter: bills at the coordinating
              // technology-level instrument price (the tier copay), per Kurt.
              <div className="review-row" style={{background:"#eef2ff",borderRadius:6,padding:"6px 10px",marginTop:4}}>
                <span className="review-key">Patient Cost</span>
                <span className="review-val" style={{fontWeight:700,color:"#4f46e5"}}>
                  {(() => { const p = planTierPrice ?? form.tierPrice; return p == null ? "—" : p === 0 ? "No Charge" : `$${p.toLocaleString()} / CROS unit`; })()}
                </span>
              </div>
            ) : isTH && planTierPrice !== null && (
              <div className="review-row" style={{background:"#f0fdf4",borderRadius:6,padding:"6px 10px",marginTop:4}}>
                <span className="review-key">Patient Cost</span>
                <span className="review-val" style={{fontWeight:700,color:"#15803d"}}>
                  {planTierPrice === 0 ? "No Charge" : `$${planTierPrice.toLocaleString()} / aid`}
                </span>
              </div>
            )}
          </>
        );
      };
      return (
        <div className="card">
          <div className="card-title">Commitment</div>
          <div className="review-section">
            <div className="review-label">Patient</div>
            {[[[form.firstName,form.lastName].filter(Boolean).join(" "),"Name"],[form.dob,"Date of Birth"],[form.phone,"Phone"],[form.email||"—","Email"]].map(([v,k])=>(
              <div className="review-row" key={k}><span className="review-key">{k}</span><span className="review-val">{v}</span></div>
            ))}
          </div>
          <div className="review-section">
            <div className="review-label">Coverage</div>
            {form.payType==="insurance" ? (
              [[form.carrier,"Carrier"],[form.planGroup,"Plan"],[form.tpa,"TPA"],[CARE_PLANS.find(c=>c.id===form.carePlan)?.label||"","Care Plan"]].map(([v,k])=>(
                <div className="review-row" key={k}><span className="review-key">{k}</span><span className="review-val">{v}</span></div>
              ))
            ) : (
              <div className="review-row"><span className="review-key">Type</span><span className="review-val">Private Pay · Complete Care+ included</span></div>
            )}
          </div>
          <div className="review-section">
            <div className="review-label">Devices</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><ReviewSide side="left" label="👂 Left Ear" /></div>
              <div><ReviewSide side="right" label="Right Ear 👂" /></div>
            </div>
          </div>
          {wizardPaSigned && (
            <div style={{background:"#ecfdf5",border:"1px solid #bbf7d0",borderRadius:8,padding:"12px 16px",marginTop:12,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>✓</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#15803d"}}>Purchase Agreement signed</div>
                <div style={{fontSize:11,color:"#16a34a"}}>Warranty begins 14 days from signature date</div>
              </div>
            </div>
          )}
          <div className="field" style={{marginTop:16}}><label>Notes</label><textarea value={form.notes} onChange={e=>upd("notes",e.target.value)} rows={3} placeholder="Special considerations, follow-up notes, etc." /></div>
          <CommitmentChecklist />
        </div>
      );
    }
}
