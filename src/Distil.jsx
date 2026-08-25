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

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { unwrapIntakeAnswers } from "./recommendationEngine.js";
import Icon from "./components/Icon.jsx";
import ComparisonHub from "./views/ComparisonHub.jsx";
import CouplesComparison from "./views/CouplesComparison.jsx";
import { LegacyDevicePanel } from "./views/LegacyFastPath.jsx";
import { parseDateOnly, fmtDate, warrantyDate, daysUntil, hearingTestCurrent } from "./lib/dates.js";
import { patientMatchesSearch, sortPatients } from "./lib/patientSearch.js";
import { CARE_ARC, buildCareArc } from "./lib/careArc.js";
import { buildTnlRetestAppointment, TNL_RETEST_TYPE } from "./lib/audiogram.js";
import {
  isSideCros, nationsCoverageTier, deriveEarPrice, pickBaselinePerAid,
  directPurchaseLockedTech, resolveClassRetailPerAid, tierMatchedTech,
} from "./lib/pricing.js";

// Body-style images + manufacturer logos now load via lib/catalogConstants.js
// (BODY_STYLE_IMG / MFR_LOGO) and lib/truhearingCatalog.js (TH_BODY_STYLES).
import HealthHistory from "./views/HealthHistory.jsx";
import UpgradeWizard from "./views/UpgradeWizard.jsx";
import IntakeResponsesAccordion from "./views/IntakeResponsesAccordion.jsx";
import TierSelection from "./views/TierSelection.jsx";
import PrompterSidebar from "./components/PrompterSidebar.jsx";
import Reports from "./views/Reports.jsx";
import AudiogramEntry from "./components/AudiogramEntry.jsx";

import TeamAdmin from "./views/TeamAdmin.jsx";
import {
  loadAllPatients,
  searchPatientsGlobal,
  loadArchivedPatients,
  archivePatient,
  unarchivePatient,
  setActiveClinic,
  savePatient,
  loadPunch,
  savePunch,
  loadClinicSettings,
  saveClinicSettings,
  loadProductCatalog,
  loadPendingIntakes,
  subscribeToIntakes,
  acceptIntake as dbAcceptIntake,
  linkIntakeToPatient,
  loadIntakesForPatient,
  createUpgradeCheckinSession,
  createProviderIntake,
  dismissIntake,
  signOut,
  enrollPatientInCampaign,
  loadPatientCampaigns,
  loadInsurancePlansGrouped,
  loadRebatePromos,
  resolveInsurancePlanId,
  loadPricingReveal,
  loadRetailAnchors,
  loadAllRetailAnchors,
  loadProductCatalogTiers,
  saveRetailAnchors,
  updatePatientContact,
  updateInsuranceCoverage,
  updateDeviceFitting,
  updateDeviceSide,
  updatePatientCampaign,
  updateDeliveryDate,
  loadStaffProfile,
  loadTnsOutcomes,
  loadPatientTnsFlag,
  updatePatientStatus,
  convertTnsToActive,
  createPatientDraft,
  createVisit,
  updatePatientAudiology,
  updatePatientDevices,
  updatePatientCarePlan,
  finalizePatient,
  saveAppointmentOutcome,
  createMedicalReferral,
  updateVisit,
  uploadPatientDocument,
  listPatientDocuments,
  getDocumentSignedUrl,
  createQuoteShare,
  recordUpgradeOutcome,
  addAppointment,
  updateAppointment,
  setAppointmentStatus,
  loadQuoteViewSignals,
  logAnalyticsEvent,
  listMessagesForPatient,
  listPatientNotes,
  addPatientNote,
  deletePatientNote,
  uploadSignatureImage,
  updateStaffSignature,
  logPriceAdjustment,
  deletePatientProfile,
  recordRateVerification,
  loadPendingRateVerifications,
  promoteRateVerification,
  dismissRateVerification,
} from "./db.js";
import { downloadPurchaseAgreement } from "./generatePurchaseAgreement.js";
import { downloadReferralPdf } from "./generateReferralPdf.js";
import { buildSafetySnapshot } from "./lib/medicalReferral.js";
import { downloadQuote } from "./generateQuote.js";
import { buildQuoteSharePayload, QUOTE_SHARE_VALID_DAYS } from "./lib/quoteShare.js";

import TnsReasonsPicker from "./components/TnsReasonsPicker.jsx";
import { TNS_TAG_BY_ID } from "./tns_tags.js";
import CreateQuoteModal from "./components/CreateQuoteModal.jsx";
import PurchaseAgreementModal from "./components/PurchaseAgreementModal.jsx";
import SendMessageModal from "./components/SendMessageModal.jsx";
import ContentLibrary from "./views/ContentLibrary.jsx";
import NurturePreview from "./views/NurturePreview.jsx";
import CampaignManager from "./views/CampaignManager.jsx";
import LimaCharlie from "./views/LimaCharlie.jsx";
import FollowUpQueue, { countFollowUpPatients } from "./views/FollowUpQueue.jsx";
import PendingFittings, { countPendingFittings } from "./views/PendingFittings.jsx";
import { warrantyYearsFor, estimateFitDate } from "./lib/pendingFitting.js";
import CommsInbox from "./views/CommsInbox.jsx";
import DueThisWeek from "./views/DueThisWeek.jsx";
import ProvidersAdmin from "./views/ProvidersAdmin.jsx";
import EvidenceReview from "./views/EvidenceReview.jsx";
import NationsCatalog from "./views/NationsCatalog.jsx";
import HearingAidCatalog from "./views/HearingAidCatalog.jsx";
import AdjustmentHistory from "./views/AdjustmentHistory.jsx";
import CloserLocationPicker from "./views/CloserLocationPicker.jsx";
import AdjustPriceModal from "./views/AdjustPriceModal.jsx";
import CloseAppointmentModal, {
  stashPendingOutcome,
  readPendingOutcome,
  clearPendingOutcome,
} from "./views/CloseAppointmentModal.jsx";
import { stashWizardDraft, readWizardDraft, clearWizardDraft } from "./lib/wizardDraft.js";
import UpgradeTrackingCard from "./components/UpgradeTrackingCard.jsx";
import AppointmentSchedule from "./components/AppointmentSchedule.jsx";


// ── EXTRACTED MODULES (backlog #40a — monolith decomposition) ────────────────
// The module-scope constants and helpers that used to live here are now in
// dedicated lib/ modules, imported below. All values are unchanged.
import {
  DEFAULT_CLINIC, BODY_STYLES, cap, BODY_STYLE_IMG, MFR_LOGO,
  CATALOG_DEFAULT, RECEIVER_POWERS, getDomeOptions, VISIT_TYPES,
} from "./lib/catalogConstants.js";
import { INSURANCE_PLANS } from "./lib/insurancePlansSeed.js";
import {
  TH_STYLES, TH_BODY_STYLES, TH_STYLE_TO_BODY, TH_MODELS,
  TH_AVAILABILITY, TH_GAIN_MATRIX, TH_STYLE_COLOR_CATEGORY,
  TH_BATTERY, TH_RECEIVER_STYLES, TH_CROS_STYLES,
} from "./lib/truhearingCatalog.js";
import { getPTA, getPTA4 } from "./lib/audiogram.js";
import { generateCounseling } from "./lib/counseling.js";
import { STEPS, STEP_TO_CHAPTER, CHAPTER_TITLES } from "./lib/wizardSteps.js";
import LangToggle from "./components/LangToggle.jsx";
import { genId, checkRole, downscaleSignature, pickLicenseForClinic } from "./lib/staffUtils.js";
import ClinicSettings from "./views/ClinicSettings.jsx";
import CatalogAdmin from "./views/CatalogAdmin.jsx";
import InsurancePlansAdmin from "./views/InsurancePlansAdmin.jsx";
import RebatesAdmin from "./views/RebatesAdmin.jsx";
import RateVerificationsAdmin from "./views/RateVerificationsAdmin.jsx";
import AdminDenied from "./views/AdminDenied.jsx";
import Dashboard from "./views/Dashboard.jsx";
import Archive from "./views/Archive.jsx";
import PatientDetail from "./views/PatientDetail.jsx";
import ResultsContent from "./components/ResultsContent.jsx";
import WizardSteps from "./views/WizardSteps.jsx";

export default function ProviderCRM({ staffId, clinicId, staffRole, myClinics = [], onClinicSwitched }) {
  const [clinic, setClinic] = useState(DEFAULT_CLINIC);
  const [clinicDraft, setClinicDraft] = useState(DEFAULT_CLINIC);
  const [clinicSaved, setClinicSaved] = useState(false);
  // Patient profile deletion (Settings → Delete Patient Profile, admin only)
  const [deleteSearch, setDeleteSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteDone, setDeleteDone] = useState("");
  // Patient archive (Archive nav view + patient-header Archive/Restore).
  const [archivedPatients, setArchivedPatients] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedSearch, setArchivedSearch] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [view, setView] = useState("dashboard");
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  // Language the patient-facing surfaces render in. Follows the selected
  // patient's stored preference (and the kiosk language on intake accept);
  // the provider can flip it live with the LangToggle. Session-only.
  const [displayLang, setDisplayLang] = useState("en");
  useEffect(() => {
    if (selectedPatient) setDisplayLang(selectedPatient.preferredLanguage === "es" ? "es" : "en");
  }, [selectedPatient?.id, selectedPatient?.preferredLanguage]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [wizardPatientId, setWizardPatientId] = useState(null);
  // The visit (clinical encounter) the wizard is currently saving into. Audiogram
  // and device saves are scoped to it so prior visits' records survive (visits model).
  const [wizardVisitId, setWizardVisitId] = useState(null);
  // Close Appointment disposition modal. null | { source: 'wizard' | 'profile' | 'pending' }.
  // 'pending' re-logs a stashed outcome whose insert previously failed.
  const [closeAppointment, setCloseAppointment] = useState(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [wizardIntake, setWizardIntake] = useState(null);
  // Provider prompter drawer — open by default, toggleable via the handle
  // pinned to the right edge of the screen. Provider-only.
  const [prompterOpen, setPrompterOpen] = useState(true);
  // Bumped after createProviderIntake mints a fresh row, so the loader
  // useEffect re-fires and picks up the new intake without waiting on a
  // step transition.
  const [intakeRefreshKey, setIntakeRefreshKey] = useState(0);
  const [saveToast, setSaveToast] = useState(false);
  const [punchData, setPunchData] = useState({ cleanings: 0, appointments: 0, log: [] });
  const [punchConfirm, setPunchConfirm] = useState(null);
  const [punchSuccess, setPunchSuccess] = useState(null);

  // ── Patient detail inline edit state ─────────────────────────────────────
  // editSection: 'contact' | 'coverage' | 'devices' | 'campaign' | null
  const [editSection,    setEditSection]    = useState(null);
  const [editDraft,      setEditDraft]      = useState(null);
  const [editSaving,     setEditSaving]     = useState(false);
  const [editError,      setEditError]      = useState(null);
  const [editSuccess,    setEditSuccess]    = useState(null);
  const [patientCampaigns, setPatientCampaigns] = useState([]);
  // Per-campaign "show full timeline" toggle (keyed by campaign id) — the
  // delivery list collapses to the next pending step by default (same
  // pattern as AppointmentSchedule) so the profile isn't a wall of rows.
  const [campaignTimelineOpen, setCampaignTimelineOpen] = useState({});
  const [editPlanSearch, setEditPlanSearch] = useState("");
  const [patientDocuments, setPatientDocuments] = useState([]);
  const [patientMessages, setPatientMessages] = useState([]);
  const [expandedMessageId, setExpandedMessageId] = useState(null);
  // Timestamped interaction log (patient_notes) — newest first.
  const [patientNotes, setPatientNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // ── Intake queue state ────────────────────────────────────────────────
  const [pendingIntakes,  setPendingIntakes]  = useState([]);
  const [intakeToast,     setIntakeToast]     = useState(null);
  const [showIntakeQueue, setShowIntakeQueue] = useState(false);
  // Intake currently being matched to an existing patient (annual/upgrade
  // check-ins link to the existing chart instead of spawning a new draft),
  // plus the manual-search box for that match panel.
  const [matchIntake,     setMatchIntake]     = useState(null);
  const [matchSearch,     setMatchSearch]     = useState("");
  // Upgrade check-in handoff code shown to the front desk (Phase 2 prefill).
  const [checkinSession,  setCheckinSession]  = useState(null); // { code, expiresAt, patientName } | null
  const [checkinBusy,     setCheckinBusy]     = useState(false);
  // "Start a New Visit" chooser — the patient whose visit type is being picked
  // (returning-patient flow vs. a full new-patient appointment), or null.
  const [visitTypePicker, setVisitTypePicker] = useState(null);
  const seenIntakeIds = useRef(new Set());

  // ── TNS queue state ───────────────────────────────────────────────
  const [tnsQueue, setTnsQueue] = useState([]);
  const [tnsExpanded, setTnsExpanded] = useState(true);
  const [tnsReasoning, setTnsReasoning] = useState(null); // patient id currently being tagged
  // Patient-profile-side TNS picker visibility (mirrors the dashboard widget,
  // surfaced from the profile header so a TNS patient's reasons can be logged
  // without bouncing back to the dashboard).
  const [profileTnsActive, setProfileTnsActive] = useState(false);
  // Latest tns_outcomes row for the patient currently open in the profile view.
  // Loaded on selection change + refreshed after a save so the chart shows
  // saved reasons inline instead of just the bare "TNS" pill.
  const [patientTnsOutcome, setPatientTnsOutcome] = useState(null);
  // Custom-quote modal — lets the provider pick arbitrary devices + override
  // pricing without touching the patient's saved fitting. Distinct from the
  // existing "Generate Quote" button which uses the saved configuration.
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  // Take-home quote link minted by the wizard's Generate Quote — shown in a
  // dismissible toast so the provider can copy/text it without leaving the
  // wizard. Null when no link is pending.
  const [quoteShareUrl, setQuoteShareUrl] = useState(null);
  const [quoteShareCopied, setQuoteShareCopied] = useState(false);
  // "Notify Patient" modal — sends a one-off Web Push to the patient's Aided
  // app through the send-push edge function.
  const [showSendNotification, setShowSendNotification] = useState(false);

  // Insurance plans from Supabase + retail anchors for pricing reveal.
  // Two anchor sets: signia-class is the default for insurance flows (the
  // recommendation engine maps insurance tiers to signia anchors), and
  // standard-class is the manufacturer-agnostic baseline used by the
  // private-pay flow. Loading both at bootstrap so payType-based branching
  // in TierSelection + pricingRevealData has its data ready.
  const [insurancePlans, setInsurancePlans] = useState([]);
  const [retailAnchors, setRetailAnchors] = useState([]);
  const [retailAnchorsStandard, setRetailAnchorsStandard] = useState([]);
  // Full anchor set keyed by manufacturer_class — used by deriveEarPrice
  // for per-ear pricing resolution on the device-selection step.
  const [retailAnchorsByClass, setRetailAnchorsByClass] = useState({});
  // tier_name → tier_rank lookup per product family. Powers the
  // techLevel → universal rank bridge that deriveEarPrice uses to pick
  // an anchor row within a manufacturer class.
  const [productCatalogTiers, setProductCatalogTiers] = useState([]);
  const [pricingReveal, setPricingReveal] = useState(null);

  // Retail anchors editor (Clinic Settings → Retail Anchors)
  const [anchorsClass, setAnchorsClass] = useState("signia");
  const [anchorsDraft, setAnchorsDraft] = useState([]);
  const [anchorsLoading, setAnchorsLoading] = useState(false);
  const [anchorsSaved, setAnchorsSaved] = useState(false);
  // Tracks which money input is currently focused (so we show raw value while
  // typing, but normalize to 2-decimal display on blur). Key shape: "anchor:i"
  // for anchor rows and "tier:tierName" for catalog tier rows.
  const [focusedMoneyKey, setFocusedMoneyKey] = useState(null);

  // ── Purchase Agreement state ──────────────────────────────────────────
  const [staffProfile, setStaffProfile] = useState(null);
  const [providerSignatureB64, setProviderSignatureB64] = useState(null);
  // True when a stored signature exists but failed to load — PAs generated in
  // that state print the typed provider name, and the provider should know.
  const [sigLoadError, setSigLoadError] = useState(false);
  const [sigBusy, setSigBusy] = useState(false);
  const [sigErr, setSigErr] = useState("");

  // Load the logged-in provider's stored signature as a data URL so it can be
  // embedded in the purchase agreements they generate. Falls back to null,
  // in which case the PA prints the typed provider name instead of an image.
  useEffect(() => {
    const url = staffProfile?.signatureUrl;
    if (!url) { setProviderSignatureB64(null); setSigLoadError(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) throw new Error(`signature fetch ${resp.status}`);
        const blob = await resp.blob();
        const dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(blob);
        });
        if (!cancelled) { setProviderSignatureB64(dataUrl); setSigLoadError(false); }
      } catch (e) {
        // A signature exists on file but couldn't be loaded — the provider
        // needs to know their PAs will fall back to a typed name.
        console.error("Provider signature load failed:", e);
        if (!cancelled) { setProviderSignatureB64(null); setSigLoadError(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [staffProfile?.signatureUrl]);

  const handleSignatureUpload = async (file) => {
    if (!file || !staffId) return;
    setSigErr(""); setSigBusy(true);
    try {
      const dataUrl = await downscaleSignature(file, 600);
      const blob = await (await fetch(dataUrl)).blob();
      const url = await uploadSignatureImage(staffId, blob);
      // The storage path is fixed per staff id, so the public URL is stable
      // across re-uploads — append a version param so a replaced signature
      // isn't served from cache.
      const bustedUrl = `${url}?v=${Date.now()}`;
      await updateStaffSignature(staffId, bustedUrl);
      setProviderSignatureB64(dataUrl);
      setSigLoadError(false);
      setStaffProfile(p => (p ? { ...p, signatureUrl: bustedUrl } : p));
    } catch (e) {
      console.error("Signature upload failed", e);
      setSigErr("Upload failed: " + (e?.message || e?.error || "check the browser console for details."));
    } finally {
      setSigBusy(false);
    }
  };

  // ── Closer dispensing-location override (PR C) ────────────────────────────
  // Event specialists ("closers") dispense under the LOCAL provider at the
  // clinic they're working that day. They pick a location + provider here; that
  // identity (not their own login) flows onto purchase agreements and quotes.
  const [closerClinic, setCloserClinic]       = useState(null);
  const [closerProvider, setCloserProvider]   = useState(null);
  const [closerSignatureB64, setCloserSignatureB64] = useState(null);
  const [showCloserPicker, setShowCloserPicker] = useState(false);

  // Load the picked provider's stored signature as a data URL for the PA.
  useEffect(() => {
    const url = closerProvider?.signature_url;
    if (!url) { setCloserSignatureB64(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(url, { cache: "no-store" });
        const blob = await resp.blob();
        const dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(blob);
        });
        if (!cancelled) setCloserSignatureB64(dataUrl);
      } catch { if (!cancelled) setCloserSignatureB64(null); }
    })();
    return () => { cancelled = true; };
  }, [closerProvider?.signature_url]);

  // Prompt closers to set their dispensing location once the role is known.
  useEffect(() => {
    if (staffRole === "closer" && !closerProvider) setShowCloserPicker(true);
  }, [staffRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Identity printed on PAs/quotes: a closer with a set location uses that
  // clinic's provider + state-matched license; everyone else uses their profile.
  const isCloser = staffRole === "closer";
  const closerNeedsLocation = isCloser && !closerProvider;
  const paClinic = (isCloser && closerClinic) ? closerClinic : (staffProfile?.clinic || clinic);
  const paProvider = (isCloser && closerProvider)
    ? { fullName: closerProvider.full_name, activeLicense: pickLicenseForClinic(closerProvider.licenses, closerClinic?.address), signatureUrl: closerProvider.signature_url || null }
    : { fullName: staffProfile?.fullName || "Provider", activeLicense: staffProfile?.activeLicense || "", signatureUrl: staffProfile?.signatureUrl || null };
  const paSignatureB64 = (isCloser && closerProvider) ? closerSignatureB64 : providerSignatureB64;
  const [showPurchaseAgreement, setShowPurchaseAgreement] = useState(false);
  // Configuration handed off from the Custom Quote's "Purchase Agreement →"
  // button — null when the agreement opens directly from the profile (it
  // then pre-fills from the saved chart).
  const [paPrefill, setPaPrefill] = useState(null);
  const [paSignatureName, setPaSignatureName] = useState("");
  const [paStep, setPaStep] = useState("sign"); // wizard PA: 'review' | 'sign'

  // ── Consultation Mode picker + hearing-test recency gate ─────────────
  // The Consultation Mode button forks: audiogram counseling (the original
  // behavior) or device selection & pricing (the chart-side purchase
  // agreement). Device selection — and any PA — must rest on a hearing test
  // from the last 6 months; a stale or undated test pops a verify warning
  // the provider can attest past (paper test / tested elsewhere).
  const [showConsultPicker, setShowConsultPicker] = useState(false);
  // { action: 'devices', lastTestDate: string|null } | null — non-null = warning open.
  // Action tag rather than a stored callback so there's no stale closure.
  const [testRecencyWarn, setTestRecencyWarn] = useState(null);

  const startAudiogramCounseling = () => {
    setShowConsultPicker(false);
    // Counseling state (draw paths, dim mode) now lives inside ResultsContent
    // (backlog #40b) — a fresh mount starts at the same defaults the old
    // explicit reset set here.
    setView("consultation");
  };
  const proceedAfterTestGate = (action) => {
    setTestRecencyWarn(null);
    if (action === "devices") {
      setView("patient");   // the PA modal mounts inside the patient view only
      setPaPrefill(null);
      setShowPurchaseAgreement(true);
    }
  };
  const requireCurrentHearingTest = (action) => {
    setShowConsultPicker(false);
    const testDate = selectedPatient?.audiology?.testDate ?? null;
    if (hearingTestCurrent(testDate)) { proceedAfterTestGate(action); return; }
    setTestRecencyWarn({ action, lastTestDate: testDate });
  };

  // ── Wizard PA / Quote fork state ─────────────────────────────────────
  const [showWizardPaModal, setShowWizardPaModal] = useState(false);
  const [wizardPaSigned, setWizardPaSigned] = useState(false);
  const [wizardPaSignatureDate, setWizardPaSignatureDate] = useState(null);
  // 'new' (default 8-step flow) | 'upgrade' (established patient routed in
  // from the UpgradeWizard close to pick devices + sign a PA). Upgrade mode
  // lands mid-wizard and must never demote an active patient to TNS.
  const [wizardMode, setWizardMode] = useState("new");
  // Step-5 "Then vs. Now" comparison (collapsed by default) — shown when the
  // intake says the patient already wears hearing aids.
  const [showWizardCompare, setShowWizardCompare] = useState(false);

  // Product catalog state
  const [catalog, setCatalog] = useState(CATALOG_DEFAULT);
  const [catEditId, setCatEditId] = useState(null);      // which entry is open for editing
  const [catDraft, setCatDraft] = useState(null);         // draft of entry being edited
  const [catAddChip, setCatAddChip] = useState({});       // { fieldKey: inputValue } for chip editors
  const [catChipEdit, setCatChipEdit] = useState({ key: null, idx: null, value: "" }); // inline chip rename
  const [catSearch, setCatSearch] = useState("");
  const [catNewEntry, setCatNewEntry] = useState(false);
  const [catSaved, setCatSaved] = useState(false);
  const [catError, setCatError] = useState(null);

  // Insurance plans editor state (Admin → Insurance Plans). The plan data
  // itself lives in `insurancePlans` (declared above) — grouped DB plans
  // shared with the wizard and the coverage editor.
  const [insEditKey, setInsEditKey] = useState(null);   // `${carrier}|${planGroup}` of the open entry, or "__new__"
  const [insDraft, setInsDraft] = useState(null);       // { carrier, planGroup, tpa, notes, active, tiers:[{id?,label,price}], _origRowIds }
  const [insSearch, setInsSearch] = useState("");
  const [insCarrierFilter, setInsCarrierFilter] = useState("All");
  const [insSaved, setInsSaved] = useState(false);
  const [insError, setInsError] = useState(null);

  // Rebate editor state (Admin → Rebates). Promos lazy-load on entering the
  // view. Writes are clinic-scoped (RLS); corporate rows show read-only.
  const [rebatePromos, setRebatePromos] = useState([]);
  const [rebEditId, setRebEditId] = useState(null);   // promo id of the open entry, or "__new__"
  const [rebDraft, setRebDraft] = useState(null);
  const [rebSearch, setRebSearch] = useState("");
  const [rebSaved, setRebSaved] = useState(false);
  const [rebError, setRebError] = useState(null);

  // Lazy-load rebates when the admin opens the Rebates view.
  useEffect(() => {
    if (view !== "rebates") return;
    let cancelled = false;
    (async () => {
      try { const r = await loadRebatePromos(clinicId); if (!cancelled) setRebatePromos(r || []); }
      catch (e) { console.error("loadRebatePromos:", e); }
    })();
    return () => { cancelled = true; };
  }, [view, clinicId]);

  // Rate-verification reconcile state (Admin → Rate Verifications). Pending
  // catalog-hole copays a provider verified by phone, awaiting admin promotion
  // into insurance_plans. Lazy-load on entering the view.
  const [rateVerifications, setRateVerifications] = useState([]);
  const [rvBusyId, setRvBusyId] = useState(null);
  const [rvError, setRvError] = useState(null);
  const refreshRateVerifications = async () => {
    try { const r = await loadPendingRateVerifications(); setRateVerifications(r || []); }
    catch (e) { console.error("loadPendingRateVerifications:", e); }
  };
  useEffect(() => {
    if (view !== "rate-verifications") return;
    refreshRateVerifications();
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  const doPromoteVerification = async (v) => {
    setRvBusyId(v.id); setRvError(null);
    try { await promoteRateVerification(v, staffId); await refreshRateVerifications(); }
    catch (e) { console.error("promoteRateVerification:", e); setRvError(e?.message || "Couldn't promote the rate."); }
    finally { setRvBusyId(null); }
  };
  const doDismissVerification = async (v) => {
    setRvBusyId(v.id); setRvError(null);
    try { await dismissRateVerification(v.id, staffId); await refreshRateVerifications(); }
    catch (e) { console.error("dismissRateVerification:", e); setRvError(e?.message || "Couldn't dismiss."); }
    finally { setRvBusyId(null); }
  };


  const EMPTY_SIDE = () => ({
    style:"", manufacturer:"", generation:"", familyId:"", variant:"",
    techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:"", isCROS:false,
    thModel:"", thBodyStyle:"", faceplateColor:"", shellColor:"", gainMatrix:"", domeCategory:"", domeSize:""
  });

  const BLANK_AUDIOLOGY = () => ({
    rightT:{}, leftT:{}, rightBC:{}, leftBC:{}, rightMask:{}, leftMask:{}, rightBCMask:{}, leftBCMask:{},
    tinnitusRight:false, tinnitusLeft:false, unaidedR:null, unaidedL:null, aidedR:null, aidedL:null,
    wrMclR:null, wrMclL:null, sinBin:null, cctR:null, cctL:null, cctLevelR:null, cctLevelL:null,
  });

  // Canonical blank wizard form — the single source of the form's shape.
  // useState init, startNew, handleAcceptIntake, startUpgradePurchase, and the
  // resume-draft merge all build from this (the inline resets they used to
  // carry had drifted: startNew was missing address/priceOverridePerAid and
  // the TruHearing side keys, and its audiology blank lacked the CCT fields).
  const BLANK_FORM = () => ({
    intakeId: null,
    firstName:"", lastName:"", dob:"", phone:"", email:"", address:"",
    payType:"insurance",
    // Direct Purchase: TruHearing benefit sold private at the TPA tier price on
    // a Signia device. Layered on top of payType:"insurance" (so tier pricing +
    // the care-plan step still run); flips the device cascade to Signia and the
    // billing/reporting to a private, direct_purchase classification.
    directPurchase:false,
    carrier:"", planGroup:"", tpa:"", tier:"", tierPrice:null, priceOverridePerAid:null,
    left: EMPTY_SIDE(),
    right: EMPTY_SIDE(),
    audiology: BLANK_AUDIOLOGY(),
    carePlan:"",
    appointments:[],
    notes:"",
  });

  // New patient form state
  const [form, setForm] = useState(BLANK_FORM);


  const [activeSide, setActiveSide] = useState("left");
  // phonemeDimMode/dimIntensity → components/ResultsContent.jsx (per-instance; backlog #40b).

  // Hearing-sim + drawing-overlay state → components/ResultsContent.jsx (per-instance; backlog #40b).

  // Audiogram PDF/NHAX import now lives in components/AudiogramEntry.jsx.

  // Address autocomplete state
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressOpen, setAddressOpen] = useState(false);
  const addressTimer = useRef(null);
  const addressRef = useRef(null);

  const searchAddress = (query) => {
    clearTimeout(addressTimer.current);
    upd("address", query);
    if (query.length < 4) { setAddressSuggestions([]); setAddressOpen(false); return; }
    addressTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=us&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        setAddressSuggestions(data);
        setAddressOpen(data.length > 0);
      } catch (e) { console.error("Address search:", e); }
    }, 300);
  };

  const selectAddress = (item) => {
    upd("address", item.display_name);
    setAddressOpen(false);
    setAddressSuggestions([]);
  };

  useEffect(() => {
    const close = (e) => { if (addressRef.current && !addressRef.current.contains(e.target)) setAddressOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);


  const upd = (k,v) => setForm(f => ({...f,[k]:v}));
  const updSide = (side, k, v) => setForm(f => ({...f, [side]: {...f[side], [k]: v}}));
  const resetSide = (side, partial={}) => setForm(f => ({...f, [side]: {style:"", manufacturer:"", generation:"", familyId:"", variant:"", techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:"", isCROS:false, thModel:"", faceplateColor:"", shellColor:"", gainMatrix:"", domeCategory:"", domeSize:"", ...partial}}));

  // Private-label (TruHearing Select) plan detection — must be defined before useEffects that reference it
  const isPrivateLabelPlan = (plan) =>
    plan?.tiers?.length > 0 && plan.tiers.every(t => ["Standard","Advanced","Premium"].includes(t.label));
  // DB-sourced plans (grouped, dollar prices, editable in Admin → Insurance
  // Plans) with the inline const as offline/seed fallback — same pattern as
  // CATALOG_DEFAULT. Memoized so earPriceOpts keeps a stable identity.
  const activePlans = useMemo(
    () => (insurancePlans.length ? insurancePlans.filter(p => p.active !== false) : INSURANCE_PLANS),
    [insurancePlans]
  );
  const selectedInsurancePlan = activePlans.find(p => p.carrier === form.carrier && p.planGroup === form.planGroup);
  const isPrivateLabel = form.payType === "insurance" && isPrivateLabelPlan(selectedInsurancePlan);
  // Direct Purchase: a TruHearing (private-label) benefit sold private at the
  // plan tier price on the equivalent Signia device. Routes the device cascade
  // to Signia (rank-locked to the tier) instead of the TruHearing card flow.
  const directPurchaseActive = isPrivateLabel && form.directPurchase === true;
  const privateLabelTiers = isPrivateLabel ? (selectedInsurancePlan?.tiers || []) : [];
  // Nations obligates us to abide by the plan's covered catalog — off-plan
  // devices are flagged and made NON-selectable in the cascade (an exception
  // requires extra written justification, handled out-of-band). A device is
  // off-plan when nationsCoverageTier() returns null for it; a whole family is
  // off-plan when every one of its tech levels is (e.g. Oticon Intent, which
  // Nations doesn't carry). Unlike UHCH (select-then-retail-with-form), Nations
  // blocks the pick up front. `catalog` entries carry the shape the map keys on.
  const isNationsPatient = form.payType === "insurance" && form.tpa === "Nations";
  const nationsFamilyOffPlan = (famEntry) =>
    isNationsPatient && Array.isArray(famEntry?.techLevels) && famEntry.techLevels.length > 0
      && famEntry.techLevels.every(t => nationsCoverageTier(famEntry, t) === null);
  const nationsTechOffPlan = (famEntry, t) =>
    isNationsPatient && nationsCoverageTier(famEntry, t) === null;


  // Quote-open hot-lead signal: { patientId: { viewCount, lastViewedAt } }.
  // Loaded alongside the roster; refreshed with it.
  const [quoteViewSignals, setQuoteViewSignals] = useState({});
  const refreshQuoteSignals = () =>
    loadQuoteViewSignals(clinicId).then(setQuoteViewSignals).catch(() => {});

  useEffect(() => {
    loadAllPatients(clinicId).then(p => { setPatients(p); setLoading(false); });
    refreshQuoteSignals();
    (async () => {
      try {
        if (clinicId) {
          const saved = await loadClinicSettings(clinicId);
          if (saved) { setClinic(saved); setClinicDraft(saved); }
        }
      } catch {}
      try {
        const cat = await loadProductCatalog();
        if (cat?.length) setCatalog(cat);
      } catch {}
      try {
        const plans = await loadInsurancePlansGrouped();
        if (plans?.length) setInsurancePlans(plans);
      } catch {}
      try {
        if (clinicId) {
          // Single query returns all manufacturer classes keyed; we derive
          // signia (insurance default) and standard (private-pay baseline)
          // from that for the TierSelection step which still expects a
          // single array, and pass the full byClass map to deriveEarPrice
          // for per-ear pricing on the device-selection step.
          const byClass = await loadAllRetailAnchors(clinicId);
          if (byClass && Object.keys(byClass).length) {
            setRetailAnchorsByClass(byClass);
            if (byClass.signia?.length) setRetailAnchors(byClass.signia);
            if (byClass.standard?.length) setRetailAnchorsStandard(byClass.standard);
          }
        }
      } catch {}
      try {
        const tiers = await loadProductCatalogTiers();
        if (tiers?.length) setProductCatalogTiers(tiers);
      } catch {}
      try {
        if (staffId) {
          const profile = await loadStaffProfile(staffId);
          if (profile) setStaffProfile(profile);
        }
      } catch {}
    })();
  }, [clinicId]);

  // Load anchors into the editor whenever the manufacturer class changes
  // (also runs on mount once clinicId is known).
  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    setAnchorsLoading(true);
    loadRetailAnchors(clinicId, anchorsClass).then(rows => {
      if (cancelled) return;
      setAnchorsDraft((rows || []).map(r => ({...r})));
      setAnchorsLoading(false);
    });
    return () => { cancelled = true; };
  }, [clinicId, anchorsClass]);


  const refreshPatients = async () => {
    const p = await loadAllPatients(clinicId);
    setPatients(p);
    refreshQuoteSignals(); // fire-and-forget; badge freshness only
  };

  // ── Patient archive ───────────────────────────────────────────────────────
  const refreshArchived = async () => {
    setArchivedLoading(true);
    try {
      setArchivedPatients(await loadArchivedPatients(clinicId));
    } finally {
      setArchivedLoading(false);
    }
  };
  // Lazy-load the archived roster the first time the Archive view is opened.
  useEffect(() => {
    if (view === "archive" && clinicId) refreshArchived();
  }, [view, clinicId]);

  // Archive from the patient detail header. Reversible, so a single confirm —
  // no type-the-name gate like the delete flow. Drops the patient out of the
  // roster and returns to the dashboard.
  const handleArchivePatient = async (p) => {
    if (!p || archiveBusy) return;
    if (!window.confirm(`Archive ${p.name}? They'll be removed from the patient list and search. You can restore them anytime from the Archive.`)) return;
    setArchiveBusy(true);
    try {
      await archivePatient(p.id, staffId);
      setSelectedPatient(null);
      setView("dashboard");
      await refreshPatients();
    } catch (e) {
      console.error("archive patient:", e);
      alert("Could not archive this patient: " + (e?.message || e));
    } finally {
      setArchiveBusy(false);
    }
  };

  // Restore an archived patient back into the active roster.
  const handleRestorePatient = async (p) => {
    if (!p || archiveBusy) return;
    setArchiveBusy(true);
    try {
      await unarchivePatient(p.id);
      await Promise.all([refreshPatients(), refreshArchived()]);
      // If we're viewing the restored chart, reflect the cleared archive stamp.
      setSelectedPatient(cur => cur?.id === p.id ? { ...cur, archivedAt: null, archivedBy: null } : cur);
    } catch (e) {
      console.error("restore patient:", e);
      alert("Could not restore this patient: " + (e?.message || e));
    } finally {
      setArchiveBusy(false);
    }
  };

  // ── Clinic switching (Sycle-style: app operates on one clinic at a time) ──
  const [clinicSwitching, setClinicSwitching] = useState(false);
  const handleClinicSwitch = async (newClinicId) => {
    if (!newClinicId || newClinicId === clinicId) return;
    setClinicSwitching(true);
    try {
      await setActiveClinic(newClinicId);
      // main.jsx re-pulls the staff record; key={activeClinicId} remounts us.
      await onClinicSwitched?.();
    } catch (e) {
      console.error("Clinic switch failed:", e);
      setClinicSwitching(false);
    }
  };

  // ── TNS queue: derive from patients + tns_outcomes ────────────────────────
  useEffect(() => {
    const loadTnsQueue = async () => {
      try {
        const outcomes = await loadTnsOutcomes();
        const taggedIds = new Set(outcomes.map(o => o.patient_id));
        const pending = patients.filter(
          p => p.patientStatus === "tns" && !taggedIds.has(p.id)
        );
        setTnsQueue(pending);
      } catch {}
    };
    loadTnsQueue();
  }, [patients]);

  // Load the latest tns_outcomes row whenever the profile-opened patient
  // changes. Re-fires when patientStatus flips to/from "tns" so the display
  // block appears immediately after "Mark as TNS" without needing a refresh.
  useEffect(() => {
    if (!selectedPatient?.id || selectedPatient.patientStatus !== "tns") {
      setPatientTnsOutcome(null);
      return;
    }
    let cancelled = false;
    loadPatientTnsFlag(selectedPatient.id)
      .then(row => { if (!cancelled) setPatientTnsOutcome(row); })
      .catch(() => { if (!cancelled) setPatientTnsOutcome(null); });
    return () => { cancelled = true; };
  }, [selectedPatient?.id, selectedPatient?.patientStatus]);

  // TNS tag selection + persistence moved into <TnsReasonsPicker/>; this
  // callback fires after a successful save so the dashboard queue can shed
  // the now-tagged patient, the profile picker can collapse, and the
  // chart's saved-reasons block can refresh to show the new row.
  const handleTnsSaved = async (patientId) => {
    setTnsQueue(q => q.filter(p => p.id !== patientId));
    setTnsReasoning(null);
    setProfileTnsActive(false);
    if (selectedPatient?.id === patientId) {
      try {
        const row = await loadPatientTnsFlag(patientId);
        setPatientTnsOutcome(row);
      } catch {}
    }
  };

  // ── Patient detail edit handlers ──────────────────────────────────────────

  const cancelEdit = () => {
    setEditSection(null);
    setEditDraft(null);
    setEditError(null);
    setEditSuccess(null);
  };

  const startEditContact = () => {
    const p = selectedPatient;
    const parts = (p.name || "").trim().split(/\s+/);
    const lastName  = parts.length > 1 ? parts.pop() : "";
    const firstName = parts.join(" ");
    setEditDraft({ firstName, lastName, phone: p.phone || "", email: p.email || "", dob: p.dob || "", payType: p.payType || "insurance", preferredLanguage: p.preferredLanguage || "en", notes: p.notes || "" });
    setEditSection("contact");
    setEditError(null);
    setEditSuccess(null);
  };

  const saveEditContact = async () => {
    setEditSaving(true); setEditError(null);
    try {
      await updatePatientContact(selectedPatient.id, {
        first_name: editDraft.firstName,
        last_name:  editDraft.lastName,
        phone:      editDraft.phone  || null,
        email:      editDraft.email  || null,
        dob:        editDraft.dob    || null,
        pay_type:   editDraft.payType,
        preferred_language: editDraft.preferredLanguage || "en",
        notes:      editDraft.notes  || null,
      });
      const newName = [editDraft.firstName, editDraft.lastName].filter(Boolean).join(" ");
      setSelectedPatient(p => ({ ...p, name: newName, phone: editDraft.phone, email: editDraft.email, dob: editDraft.dob, payType: editDraft.payType, preferredLanguage: editDraft.preferredLanguage, notes: editDraft.notes }));
      setPatients(prev => prev.map(pt => pt.id === selectedPatient.id ? { ...pt, name: newName, phone: editDraft.phone, email: editDraft.email } : pt));
      setEditSuccess("Saved");
      setTimeout(() => { setEditSection(null); setEditSuccess(null); }, 1400);
    } catch (err) {
      setEditError(err?.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const startEditCoverage = () => {
    const p = selectedPatient;
    setEditDraft({
      carrier:        p.insurance?.carrier    || "",
      planGroup:      p.insurance?.planGroup  || "",
      tpa:            p.insurance?.tpa        || "",
      tier:           p.insurance?.tier       || "",
      tierPrice:      p.insurance?.tierPrice  ?? null,
      carePlanType:   p.carePlan              || "",
    });
    setEditPlanSearch("");
    setEditSection("coverage");
    setEditError(null);
    setEditSuccess(null);
  };

  const saveEditCoverage = async () => {
    setEditSaving(true); setEditError(null);
    try {
      const planId = await resolveInsurancePlanId(
        editDraft.carrier, editDraft.planGroup, editDraft.tier
      );
      await updateInsuranceCoverage(
        selectedPatient.id,
        {
          carrier:            editDraft.carrier        || null,
          plan_group:         editDraft.planGroup      || null,
          tpa:                editDraft.tpa            || null,
          tier:               editDraft.tier           || null,
          tier_price_per_aid: editDraft.tierPrice != null ? Math.round(editDraft.tierPrice * 100) : null,
          insurance_plan_id:  planId,
          care_plan_type:     editDraft.carePlanType   || null,
        },
        selectedPatient._ids?.coverageId || null
      );
      setSelectedPatient(p => ({
        ...p,
        carePlan: editDraft.carePlanType,
        insurance: { ...p.insurance, carrier: editDraft.carrier, planGroup: editDraft.planGroup, tpa: editDraft.tpa, tier: editDraft.tier, tierPrice: editDraft.tierPrice },
        _ids: { ...p._ids, coverageId: p._ids?.coverageId || "pending" },
      }));
      setEditSuccess("Saved");
      setTimeout(() => { setEditSection(null); setEditSuccess(null); }, 1400);
    } catch (err) {
      setEditError(err?.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const startEditDevices = () => {
    const d = selectedPatient.devices || {};
    const resolveFamily = (side) => {
      if (!side) return EMPTY_SIDE();
      const match = catalog.find(e =>
        e.family === side.family &&
        e.manufacturer === side.manufacturer &&
        e.generation === side.generation
      );
      return {
        style:          side.style          || "",
        manufacturer:   side.manufacturer   || "",
        generation:     side.generation     || "",
        familyId:       match?.id           || "",
        variant:        side.variant        || "",
        techLevel:      side.techLevel      || "",
        color:          side.color          || "",
        battery:        side.battery        || "",
        receiverLength: side.receiverLength || "",
        receiverPower:  side.receiverPower  || "",
        dome:           side.dome           || "",
        isCROS:         false,
        thModel:        side.thModel        || "",
        faceplateColor: side.faceplateColor || "",
        shellColor:     side.shellColor     || "",
        gainMatrix:     side.gainMatrix     || "",
        domeCategory:   side.domeCategory   || "",
        domeSize:       side.domeSize       || "",
      };
    };
    setEditDraft({
      serialLeft:     d.serialLeft     || "",
      serialRight:    d.serialRight    || "",
      warrantyExpiry: d.warrantyExpiry || "",
      fittingType:    d.fittingType    || "Bilateral",
      left:  resolveFamily(d.left),
      right: resolveFamily(d.right),
    });
    setEditSection("devices");
    setEditError(null);
    setEditSuccess(null);
  };

  const saveEditDevices = async () => {
    setEditSaving(true); setEditError(null);
    try {
      const { fittingId, leftSideId, rightSideId } = selectedPatient._ids || {};
      if (fittingId) {
        await updateDeviceFitting(fittingId, {
          serial_left:     editDraft.serialLeft     || null,
          serial_right:    editDraft.serialRight    || null,
          warranty_expiry: editDraft.warrantyExpiry || null,
          fitting_type:    editDraft.fittingType    || null,
        });
        // The fitting owns the warranty; keep the insurance_coverage mirror in
        // step (same pattern as confirmDeviceFitting) so coverage-driven reads
        // never see a stale date. Mirror only — never create a coverage row
        // just to hold a warranty date.
        if (selectedPatient._ids?.coverageId && selectedPatient._ids.coverageId !== "pending") {
          await updateInsuranceCoverage(
            selectedPatient.id,
            { warranty_expiry: editDraft.warrantyExpiry || null },
            selectedPatient._ids.coverageId
          );
        }
      }
      const buildSideFields = (s) => ({
        manufacturer:    s.manufacturer    || null,
        family:          catalog.find(e => e.id === s.familyId)?.family || s.family || null,
        generation:      s.generation      || null,
        variant:         s.variant         || null,
        tech_level:      s.techLevel       || null,
        style:           s.style           || null,
        color:           s.color           || null,
        battery:         s.battery         || null,
        receiver_length: s.receiverLength  || null,
        receiver_power:  s.receiverPower   || null,
        dome:            s.dome            || null,
        th_model:        s.thModel         || null,
        faceplate_color: s.faceplateColor  || null,
        shell_color:     s.shellColor      || null,
        gain_matrix:     s.gainMatrix      || null,
        dome_category:   s.domeCategory    || null,
        dome_size:       s.domeSize        || null,
      });
      if (leftSideId  && editDraft.left)  await updateDeviceSide(leftSideId,  buildSideFields(editDraft.left));
      if (rightSideId && editDraft.right) await updateDeviceSide(rightSideId, buildSideFields(editDraft.right));
      const resolveLeft = editDraft.left ? { ...editDraft.left, family: catalog.find(e=>e.id===editDraft.left.familyId)?.family || editDraft.left.family || "" } : null;
      const resolveRight = editDraft.right ? { ...editDraft.right, family: catalog.find(e=>e.id===editDraft.right.familyId)?.family || editDraft.right.family || "" } : null;
      setSelectedPatient(p => ({
        ...p,
        devices: { ...p.devices, serialLeft: editDraft.serialLeft, serialRight: editDraft.serialRight, warrantyExpiry: editDraft.warrantyExpiry, fittingType: editDraft.fittingType, left: resolveLeft || p.devices?.left, right: resolveRight || p.devices?.right },
      }));
      setEditSuccess("Saved");
      setTimeout(() => { setEditSection(null); setEditSuccess(null); }, 1400);
    } catch (err) {
      setEditError(err?.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const startEditCampaign = (campaign) => {
    const deliveries = (campaign.campaign_deliveries || [])
      .sort((a, b) => (a.campaign_steps?.step_order ?? 0) - (b.campaign_steps?.step_order ?? 0))
      .map(d => ({ id: d.id, stepOrder: d.campaign_steps?.step_order ?? 0, delayDays: d.campaign_steps?.delay_days ?? 0, channel: d.campaign_steps?.delivery_channel || "", status: d.status, scheduledDate: d.scheduled_date || "" }));
    setEditDraft({ campaignId: campaign.id, status: campaign.status, triggerDate: campaign.trigger_date || "", deliveries });
    setEditSection("campaign");
    setEditError(null);
    setEditSuccess(null);
  };

  const saveEditCampaign = async () => {
    setEditSaving(true); setEditError(null);
    try {
      await updatePatientCampaign(editDraft.campaignId, { status: editDraft.status, trigger_date: editDraft.triggerDate || null });
      for (const d of (editDraft.deliveries || [])) {
        if (d.scheduledDate) await updateDeliveryDate(d.id, d.scheduledDate);
      }
      setPatientCampaigns(prev => prev.map(c => c.id === editDraft.campaignId ? { ...c, status: editDraft.status, trigger_date: editDraft.triggerDate } : c));
      setEditSuccess("Saved");
      setTimeout(() => { setEditSection(null); setEditSuccess(null); }, 1400);
    } catch (err) {
      setEditError(err?.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Intake toast + Supabase Realtime subscription ─────────────────────
  const fireIntakeToast = useCallback((intake) => {
    const id = intake._meta?.intakeId;
    if (!id || seenIntakeIds.current.has(id)) return;
    seenIntakeIds.current.add(id);
    const a = unwrapIntakeAnswers(intake.answers) || {};
    const name = `${a.firstName || ""} ${a.lastName || ""}`.trim() || "New Patient";
    setIntakeToast({ name, intakeId: id });
    let flashing = true;
    const orig = document.title;
    const flashInterval = setInterval(() => {
      document.title = flashing ? `● New Intake — Distil` : orig;
      flashing = !flashing;
    }, 800);
    setTimeout(() => { clearInterval(flashInterval); document.title = orig; }, 12000);
  }, []);

  useEffect(() => {
    loadPendingIntakes().then(pending => {
      setPendingIntakes(pending);
      pending.forEach(fireIntakeToast);
    });
    if (!clinicId) return;
    const unsubscribe = subscribeToIntakes(clinicId, (intake) => {
      setPendingIntakes(prev => [...prev, intake]);
      fireIntakeToast(intake);
    });
    return unsubscribe;
  }, [clinicId, fireIntakeToast]);


  // Load campaigns whenever the patient detail view is opened
  useEffect(() => {
    if (view === "patient" && selectedPatient?.id) {
      setPatientCampaigns([]);
      loadPatientCampaigns(selectedPatient.id).then(setPatientCampaigns).catch(() => {});
    }
    // Reset edit state when navigating away from patient
    if (view !== "patient") {
      setEditSection(null);
      setEditDraft(null);
    }
  }, [view, selectedPatient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load archived documents (quotes, purchase agreements) when viewing a patient.
  // Reloaded after each successful upload via refreshDocuments() so the list
  // updates without a navigation round-trip.
  const refreshDocuments = useCallback(async () => {
    if (!selectedPatient?.id) return;
    try {
      const docs = await listPatientDocuments(selectedPatient.id);
      setPatientDocuments(docs);
    } catch (e) {
      console.error("listPatientDocuments:", e);
    }
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (view === "patient" && selectedPatient?.id) {
      setPatientDocuments([]);
      refreshDocuments();
    }
  }, [view, selectedPatient?.id, refreshDocuments]);

  // Communication history (patient_messages) — Phase 1 surfaces clinic-sent
  // inbox messages with read state; future SMS/email rows will land here too.
  const refreshMessages = useCallback(async () => {
    if (!selectedPatient?.id) return;
    try {
      const msgs = await listMessagesForPatient(selectedPatient.id);
      setPatientMessages(msgs);
    } catch (e) {
      console.error("listMessagesForPatient:", e);
    }
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (view === "patient" && selectedPatient?.id) {
      setPatientMessages([]);
      refreshMessages();
    }
  }, [view, selectedPatient?.id, refreshMessages]);

  // Interaction log — same lifecycle as messages/documents above.
  const refreshNotes = useCallback(async () => {
    if (!selectedPatient?.id) return;
    try {
      const notes = await listPatientNotes(selectedPatient.id);
      setPatientNotes(notes);
    } catch (e) {
      console.error("listPatientNotes:", e);
    }
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (view === "patient" && selectedPatient?.id) {
      setPatientNotes([]);
      setNoteDraft("");
      refreshNotes();
    }
  }, [view, selectedPatient?.id, refreshNotes]);

  const handleAddNote = async () => {
    const body = noteDraft.trim();
    if (!body || !selectedPatient?.id || noteSaving) return;
    setNoteSaving(true);
    try {
      await addPatientNote(selectedPatient.id, { body, staffId, clinicId });
      setNoteDraft("");
      await refreshNotes();
    } catch (e) {
      console.error("addPatientNote:", e);
      alert("Couldn't save the note — check your connection and try again.");
    } finally {
      setNoteSaving(false);
    }
  };

  // Load the most recent intake for the wizard's Health History step.
  // Triggered when the provider arrives at step 1 with a wizardPatientId
  // (which is set on Continue-from-Patient, including the linkIntake call).
  // Re-fetches if the patient changes mid-wizard. Empty result → null,
  // which the HealthHistory view renders as its empty-state placeholder.
  //
  // Kiosk submissions wrap the answers column as { _meta, answers, consent }
  // — consent contains the signature data URL (legal record). We unwrap to
  // the flat shape for rendering but stash the wrapper context so writes
  // re-wrap and preserve _meta + consent on the row.
  // Unwrap a loaded intake row into the wizardIntake shape: flat answers for
  // rendering plus the stashed wrapper so writes re-wrap and preserve
  // _meta + consent. Shared by the step-1 loader and startUpgradePurchase.
  const normalizeWizardIntake = (latest) => {
    if (!latest) return null;
    const raw = latest.answers;
    const isWrapped = raw && typeof raw === "object" && raw.answers
      && typeof raw.answers === "object" && (raw._meta || raw.consent);
    return {
      ...latest,
      answers: isWrapped ? raw.answers : (raw || {}),
      _wrapper: isWrapped ? { _meta: raw._meta, consent: raw.consent } : null,
    };
  };

  useEffect(() => {
    if (step !== 1 || !wizardPatientId) return;
    let cancelled = false;
    loadIntakesForPatient(wizardPatientId).then(intakes => {
      if (cancelled) return;
      setWizardIntake(normalizeWizardIntake(intakes[0]));
    }).catch(e => {
      console.error("loadIntakesForPatient:", e);
      if (!cancelled) setWizardIntake(null);
    });
    return () => { cancelled = true; };
  }, [step, wizardPatientId, intakeRefreshKey]);


  // Reset wizardIntake when the wizard itself resets (back to step 0 with
  // no patient yet, or returning to dashboard). Without this, leftover
  // state from a prior session would briefly flash on the next Health
  // History entry before the loader replaces it.
  useEffect(() => {
    if (!wizardPatientId) setWizardIntake(null);
  }, [wizardPatientId]);

  // ── In-progress appointment draft (resume after navigating away) ────────
  // The wizard session lives in React state only, so Cancel, a sidebar click,
  // or a refresh mid-visit used to lose everything since the last incremental
  // save with no way back in. While the provider is in the wizard, the whole
  // session snapshots to localStorage; the dashboard offers Resume/Discard.
  // Cleared on Close Appointment or explicit discard; expires after ~a clinic
  // day (see lib/wizardDraft.js).
  const [wizardDraft, setWizardDraft] = useState(() => readWizardDraft({ clinicId, staffId }));

  useEffect(() => {
    if (view !== "new") return;
    // A pristine step-0 form isn't worth a resume nag — wait for substance.
    if (!wizardPatientId && !form.firstName && !form.lastName) return;
    const draft = { clinicId, staffId, form, step, wizardPatientId, wizardVisitId, wizardMode, activeSide, wizardPaSigned, wizardPaSignatureDate };
    stashWizardDraft(draft);
    setWizardDraft({ ...draft, savedAt: Date.now() });
  }, [view, form, step, wizardPatientId, wizardVisitId, wizardMode, activeSide, wizardPaSigned, wizardPaSignatureDate, clinicId, staffId]);

  const discardWizardDraft = () => { clearWizardDraft(); setWizardDraft(null); };

  // "saved 2:41 PM" today / "saved Aug 11, 2:41 PM" otherwise — shared by the
  // dashboard and patient-chart resume banners.
  const wizardDraftSavedLabel = (d) => {
    const savedAtDate = d.savedAt ? new Date(d.savedAt) : null;
    if (!savedAtDate) return "moments ago";
    return savedAtDate.toDateString() === new Date().toDateString()
      ? savedAtDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : savedAtDate.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  // Gate for every wizard entry point: seeding a new session overwrites the
  // snapshot, so an unfinished appointment must be explicitly discarded first.
  // Returns true when it's safe to proceed.
  const confirmDiscardWizardDraft = () => {
    const d = wizardDraft || readWizardDraft({ clinicId, staffId });
    if (!d) return true;
    const name = [d.form?.firstName, d.form?.lastName].filter(Boolean).join(" ") || "an unnamed patient";
    const ok = window.confirm(
      `You have an appointment in progress with ${name} (${STEPS[d.step] || "Patient"} step). ` +
      `Starting another will discard that unfinished appointment — the patient record and anything already saved stay on their chart.\n\n` +
      `Discard the in-progress appointment?`
    );
    if (ok) discardWizardDraft();
    return ok;
  };

  // Rebuild the wizard from the stashed snapshot and land on the saved step.
  // The form merges over the canonical blank so a draft stashed before a
  // schema tweak still carries every key the wizard expects.
  const resumeAppointment = () => {
    const d = readWizardDraft({ clinicId, staffId });
    if (!d) { setWizardDraft(null); return; }
    setForm({
      ...BLANK_FORM(),
      ...(d.form || {}),
      left:  { ...EMPTY_SIDE(), ...(d.form?.left  || {}) },
      right: { ...EMPTY_SIDE(), ...(d.form?.right || {}) },
      audiology: { ...BLANK_AUDIOLOGY(), ...(d.form?.audiology || {}) },
    });
    setWizardPatientId(d.wizardPatientId || null);
    setWizardVisitId(d.wizardVisitId || null);
    setWizardMode(d.wizardMode || "new");
    setActiveSide(d.activeSide || "left");
    setWizardPaSigned(!!d.wizardPaSigned);
    setWizardPaSignatureDate(d.wizardPaSignatureDate || null);
    setShowWizardPaModal(false); setShowWizardCompare(false);
    setSaved(false); setSaveError(null); setSaveToast(false);
    // The intake loader only fires when landing on Health History (step 1) —
    // reload explicitly so later steps (prompter, reflection flags) have it.
    setWizardIntake(null);
    if (d.wizardPatientId) {
      loadIntakesForPatient(d.wizardPatientId)
        .then(intakes => setWizardIntake(normalizeWizardIntake(intakes[0])))
        .catch(() => {});
    }
    setStep(Math.min(Math.max(d.step || 0, 0), STEPS.length - 1));
    setView("new");
  };

  // Care plan analytics — fire care_plan_viewed once per (patient, step)
  // when step 4 (Care Plan) mounts. Reset trackers when the patient changes
  // so each session gets fresh view/change events.
  const carePlanViewedRef = useRef(null);
  const carePlanChangeCountRef = useRef(0);
  useEffect(() => {
    carePlanViewedRef.current = null;
    carePlanChangeCountRef.current = 0;
  }, [wizardPatientId]);
  useEffect(() => {
    if (step !== 4 || !wizardPatientId) return;
    const key = `${wizardPatientId}:4`;
    if (carePlanViewedRef.current === key) return;
    carePlanViewedRef.current = key;
    logAnalyticsEvent("care_plan_viewed", {
      patient_id: wizardPatientId,
      provider_id: staffId,
      clinic_id: clinicId,
    });
  }, [step, wizardPatientId, staffId, clinicId]);

  // .main keeps its scroll offset across step swaps — reset it on every step
  // change so long steps (Results, Device Selection) never leave the next step
  // scrolled partway down.
  const mainRef = useRef(null);
  useLayoutEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [step]);

  // A private-label plan runs one of two device cascades: the TruHearing card
  // flow, or — when Direct Purchase is on — the Signia cascade. Clear any side
  // configured in the WRONG cascade for the current mode (also fires when the
  // Direct Purchase toggle flips, swapping which cascade is live).
  useEffect(() => {
    if (!isPrivateLabel) return;
    const wrongMfr = directPurchaseActive
      ? (m) => m === "TruHearing"          // Direct Purchase wants Signia → drop TH sides
      : (m) => m && m !== "TruHearing";    // TruHearing card flow → drop non-TH sides
    setForm(f => ({
      ...f,
      left:  wrongMfr(f.left.manufacturer)  ? EMPTY_SIDE() : f.left,
      right: wrongMfr(f.right.manufacturer) ? EMPTY_SIDE() : f.right,
    }));
  }, [isPrivateLabel, directPurchaseActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync the chosen tier (form.tier) into each side's techLevel for the
  // TruHearing CARD flow only. Direct Purchase locks techLevel per-family from
  // the tier instead (directPurchaseLockedTech + the relock effect), so skip it
  // there — otherwise this would force manufacturer:"TruHearing" onto the
  // Signia sides. If a side has a different tier configured (user went back and
  // changed tier), reset it so the cascade re-derives availability.
  useEffect(() => {
    if (!isPrivateLabel || directPurchaseActive || !form.tier) return;
    setForm(f => {
      const next = { ...f };
      ["left","right"].forEach(side => {
        if (f[side].techLevel === form.tier) return;
        next[side] = { ...EMPTY_SIDE(), manufacturer:"TruHearing", techLevel: form.tier };
      });
      return next;
    });
  }, [isPrivateLabel, form.tier, directPurchaseActive]); // eslint-disable-line react-hooks/exhaustive-deps


  const buildSideRecord = (s) => {
    if (!s.familyId && s.manufacturer !== "TruHearing") return null;
    if (s.manufacturer === "TruHearing" && (!s.techLevel || !s.thModel)) return null;
    if (s.manufacturer === "TruHearing") {
      const thMod = TH_MODELS.find(m => m.id === s.thModel);
      const isRIC = ["ric","ric_bct","sr"].includes(s.style);
      const thGainLabel = s.gainMatrix || s.receiverPower || "";
      const thGainEntry = s.thModel && s.style ? (TH_GAIN_MATRIX[`${s.thModel}|${s.style}`]||[]).find(g=>g.id===s.gainMatrix) : null;
      const thIsEarmold = thGainEntry?.earmold || false;
      const thDome = thIsEarmold ? "Custom Earmold" : (s.domeCategory && s.domeSize ? `${s.domeCategory} ${s.domeSize}` : s.domeCategory || s.dome || "");
      return {
        manufacturer: "TruHearing",
        // Platform generation follows the MODEL, not the tier: TH7→IX,
        // TH6→AX, TH5→X. (Was hardcoded "IX", which mislabeled every
        // TH6/TH5 fitting saved before this fix.)
        generation: thMod?.platform || "",
        family: thMod?.label || "TruHearing Select",
        thModel: s.thModel || "",
        thSeries: thMod?.series || "",
        rechargeable: thMod?.li || false,
        liUpcharge: 0,
        variant: s.isCROS ? "CROS Transmitter" : (s.variant || ""),
        techLevel: s.techLevel, style: s.style || "ric",
        color: "", battery: s.battery || "",
        receiverLength: isRIC ? (s.receiverLength || "") : "",
        receiverPower: isRIC ? thGainLabel : "",
        gainMatrix: s.gainMatrix || "",
        domeCategory: s.domeCategory || "",
        domeSize: s.domeSize || "",
        receiver: isRIC && s.receiverLength && thGainLabel
          ? `Length ${s.receiverLength} · ${thGainLabel}` : "",
        dome: isRIC ? thDome : "",
      };
    }
    const fam = catalog.find(e => e.id === s.familyId);
    const pwrLabel = (RECEIVER_POWERS[s.manufacturer]||[]).find(p=>p.id===s.receiverPower)?.label || s.receiverPower;
    const isEarmold = (RECEIVER_POWERS[s.manufacturer]||[]).find(p=>p.id===s.receiverPower)?.earmold;
    return {
      manufacturer: s.manufacturer, generation: s.generation, family: fam?.family || "",
      variant: s.variant, techLevel: s.techLevel, style: s.style,
      color: s.color, battery: s.battery,
      receiverLength: s.style==="ric" ? s.receiverLength : "",
      receiverPower: s.style==="ric" ? s.receiverPower : "",
      receiver: s.style==="ric" && s.receiverLength && s.receiverPower ? `Length ${s.receiverLength} · ${pwrLabel}` : "",
      // Dome is RIC + IF; non-RIC dome-styles (IF) skip the earmold branch (no receiverPower).
      dome: BODY_STYLES.find(b => b.id === s.style)?.hasDome
              ? (isEarmold ? "Custom Earmold" : s.dome)
              : "",
    };
  };

  // ── Generate Quote PDF from wizard state ─────────────────────────────
  // ── Price Adjustment Authorization (spec §6) ──────────────────────────────
  // Records the adjustment under the logged-in staff id (server-stamped via the
  // RPC) and layers a per-aid override onto the wizard form so the Pricing
  // Reveal, take-home quote, and purchase agreement all reflect the new price
  // for the rest of the session. In-session only; the override clears if the
  // device or tier changes (see effect below).
  const handleConfirmAdjust = async ({ newPrice, reasonCode, reasonText }) => {
    const original = form.priceOverridePerAid ?? form.tierPrice ?? 0;
    if (!wizardPatientId) {
      alert("Save the patient before adjusting the price.");
      return;
    }
    try {
      await logPriceAdjustment({
        patientId: wizardPatientId,
        originalPrice: original,
        adjustedPrice: newPrice,
        reasonCode,
        reasonText,
        // Private pay bundles Complete Care+ into the per-aid price; insurance
        // adjusts the device copay.
        productType: form.payType === "private" ? "bundle" : "device",
      });
      setForm(f => ({ ...f, priceOverridePerAid: newPrice }));
      setShowAdjustModal(false);
    } catch (e) {
      console.error("logPriceAdjustment:", e);
      alert("Could not record the price adjustment: " + (e.message || e));
    }
  };

  const handleGenerateQuote = async () => {
    const leftRec = buildSideRecord(form.left);
    const rightRec = buildSideRecord(form.right);
    const isCROS = [leftRec, rightRec].some(r => r?.variant?.toLowerCase().includes("cros")) || form.left.isCROS || form.right.isCROS;
    const fittingType = leftRec && rightRec ? (isCROS ? "cros_bicros" : "bilateral") : leftRec ? "monaural_left" : "monaural_right";
    const counselingSections = generateCounseling(form.audiology); // returns array of {heading,body} or null
    // TierSelection writes the chosen tier's per-aid price (clinic_retail_anchors
    // for private pay, insurance_plans for insurance) into form.tierPrice.
    // Effective per-aid price — a confirmed Price Adjustment (§6) overrides the
    // catalog/tier price for the rest of the wizard session. Applies to real-aid
    // ears; a CROS transmitter side keeps its fixed unit price.
    const ovr = form.priceOverridePerAid;
    const pricePerAid = (ovr ?? form.tierPrice) || 0;
    // Per-ear prices for CROS-aware totals — null when the side isn't
    // configured. generateQuote falls back to pricePerAid * aidCount
    // when both are null.
    const leftEarP  = leftRec  ? ((ovr != null && leftEarPrice?.source  !== 'cros') ? ovr : (leftEarPrice?.price  ?? pricePerAid)) : null;
    const rightEarP = rightRec ? ((ovr != null && rightEarPrice?.source !== 'cros') ? ovr : (rightEarPrice?.price ?? pricePerAid)) : null;
    if (closerNeedsLocation) { alert("Set your dispensing location in the sidebar first."); setShowCloserPicker(true); return; } const { blob, fileName } = downloadQuote({
      patient: { name: [form.firstName, form.lastName].filter(Boolean).join(" "), phone: form.phone },
      devices: { fittingType, left: leftRec, right: rightRec },
      pricePerAid,
      leftPrice: leftEarP,
      rightPrice: rightEarP,
      selectedCarePlan: form.carePlan || "complete",
      payType: form.payType,
      directPurchase: form.directPurchase,
      tpa: form.tpa,
      carrier: form.carrier,
      audiology: form.audiology,
      counselingSections: counselingSections,
      clinic: paClinic,
      provider: paProvider,
    });

    if (wizardPatientId) {
      let docRow = null;
      try {
        const isBilateral = (fittingType === 'bilateral' || fittingType === 'cros_bicros');
        docRow = await uploadPatientDocument({
          patientId: wizardPatientId,
          clinicId,
          staffId,
          kind: 'quote',
          blob, fileName,
          metadata: {
            fittingType,
            pricePerAid,
            aidCount: isBilateral ? 2 : 1,
            selectedCarePlan: form.carePlan || "complete",
            payType: form.payType,
            carrier: form.carrier || null,
            tpa: form.tpa || null,
            leftFamily: leftRec?.family || null,
            rightFamily: rightRec?.family || null,
          },
        });
      } catch (e) {
        console.error('Archive quote PDF (wizard):', e);
        alert('Quote downloaded, but failed to archive to chart: ' + (e.message || e));
      }

      // Mint the take-home share link (/quote/<token>) — surfaced via the
      // copy-link toast. Non-fatal: the PDF already downloaded (and archived
      // unless the catch above fired), so a failure here only loses the link.
      try {
        const payload = buildQuoteSharePayload({
          patient: { name: [form.firstName, form.lastName].filter(Boolean).join(" ") },
          devices: { fittingType, left: leftRec, right: rightRec },
          pricePerAid,
          leftPrice: leftEarP,
          rightPrice: rightEarP,
          selectedCarePlan: form.carePlan || "complete",
          payType: form.payType,
          directPurchase: form.directPurchase,
          tpa: form.tpa,
          carrier: form.carrier,
          audiology: form.audiology,
          counselingSections,
          provider: { fullName: paProvider?.fullName || "" },
          lang: displayLang,
        });
        const share = await createQuoteShare({
          patientId: wizardPatientId,
          clinicId,
          staffId,
          documentId: docRow?.id || null,
          payload,
          validDays: QUOTE_SHARE_VALID_DAYS,
        });
        setQuoteShareCopied(false);
        setQuoteShareUrl(share.url);
      } catch (e) {
        console.error('Create quote share link (wizard):', e);
      }
    }
  };


  // Commit/finalize the wizard patient — everything the old step-7 save did
  // except navigation, which now belongs to the Close Appointment orchestrator
  // (finalize → outcome → navigate). Throws on failure so the disposition
  // modal can surface the error while the wizard stays alive; returns the
  // locally-built patient object for setSelectedPatient.
  const finalizeWizardPatient = async (deviceDisposition = null) => {
    setSaveError(null);
    const leftRec = buildSideRecord(form.left);
    const rightRec = buildSideRecord(form.right);
    const primary = leftRec || rightRec;
    const isCROS = [leftRec, rightRec].some(r => r?.variant?.toLowerCase().includes("cros"))
      || form.left.isCROS || form.right.isCROS;
    // Lowercased to match the savePatient/createPatientDraft DB convention
    // ('bilateral' | 'cros_bicros' | 'monaural_left' | 'monaural_right'),
    // so the locally-built selectedPatient agrees with the next loadAllPatients.
    const fittingType = leftRec && rightRec ? (isCROS ? "cros_bicros" : "bilateral") : leftRec ? "monaural_left" : "monaural_right";
    // Warranty term captured at signing; the clock starts at fit confirmation.
    // (Private pay bundles Complete Care+, so it gets the 4-year term too —
    // matches the printed agreement's CARE_PLAN_META.)
    const years = warrantyYearsFor(form.payType, form.carePlan);
    // An in-app signed PA and a 'committed' close (provider attesting the
    // patient signed today, e.g. on paper) both mean the sale closed — either
    // way the fitting is PENDING until confirmed from the queue.
    const paCommitted = wizardPaSigned || deviceDisposition === "committed";
    // For a closed sale, warrantyStart is only an ESTIMATE of the fit date
    // (signature + 14 days) shown in the Pending Fittings queue. The
    // authoritative fitting date — and every clock keyed to it — lands when
    // the fitting is confirmed from the queue.
    const warrantyStart = wizardPaSignatureDate
      ? new Date(new Date(wizardPaSignatureDate).getTime() + 14 * 86400000).toISOString().split("T")[0]
      : paCommitted
        ? estimateFitDate(new Date().toISOString().split("T")[0])
        : new Date().toISOString().split("T")[0];

    // Upgrade mode operates on an already-active patient — finalizing without
    // a signed PA (e.g. they took a quote home) must not demote them to TNS.
    // The retention outcome is already recorded by the UpgradeWizard close.
    // A 'committed' device disposition counts like a signed PA: the provider
    // is attesting the patient signed today (e.g. on paper).
    // Tested No Loss: thresholds within normal limits — no sale was ever on
    // the table, so the patient exits as 'tnl' (not 'tns') with an annual
    // retest recall instead of a fitting/warranty record.
    const isTnl = deviceDisposition === "no_hearing_loss" && wizardMode !== "upgrade";
    // Did Not Test: the visit ended before testing (wax removal only, patient
    // declined, etc.) — nothing was ever recommended, so the patient STAYS a
    // prospect. Demoting to 'tns' would poison the tested-not-sold funnel with
    // people who were never tested.
    const isDnt = deviceDisposition === "did_not_test" && wizardMode !== "upgrade";
    // Medical referral: a red-flag condition pauses the sale behind a medical
    // evaluation — nothing was accepted or declined, so the patient STAYS a
    // prospect (like Did Not Test) and no fitting/care plan is written. They
    // return with clearance and pick up where they left off.
    const isReferral = deviceDisposition === "medical_referral" && wizardMode !== "upgrade";
    const finalizeStatus = (wizardPaSigned || deviceDisposition === "committed")
      ? "active"
      : isTnl ? "tnl"
      : (isDnt || isReferral) ? "prospect"
      : (wizardMode === "upgrade" ? "active" : "tns");

    // Incremental save path — patient already exists in DB as draft
    if (wizardPatientId) {
      try {
        const carePlan = (isTnl || isDnt || isReferral) ? null : (form.payType === "insurance" ? form.carePlan : null);
        const privatePay = !isTnl && !isDnt && !isReferral && form.payType === "private" && form.tierPrice != null
          ? { tier: form.tier, tierPrice: form.tierPrice }
          : null;
        // A signed fitting now schedules ONLY the estimated Fitting &
        // Orientation visit — the full 4-year care arc (backlog #5) is
        // generated at fit confirmation from the REAL fitting date, so the
        // whole schedule anchors to the day the devices went on the ears.
        const existingApptKeys = new Set((form.appointments || []).map(a => `${a.type}|${a.date}`));
        const careArc = paCommitted
          ? [{ date: warrantyStart, type: CARE_ARC[0].type, note: CARE_ARC[0].note }]
              .filter(a => !existingApptKeys.has(`${a.type}|${a.date}`))
          : [];
        // TNL path: the annual retest recall IS the follow-up plan (no care
        // arc, no fitting). finalizePatient's type+date guard dedupes a
        // double-finalize, same as the care arc.
        const retestArc = isTnl ? [buildTnlRetestAppointment()] : [];
        const finalizeAppointments = [...(form.appointments || []), ...careArc, ...retestArc];
        await finalizePatient(
          wizardPatientId,
          finalizeStatus,
          // TNL and Did Not Test never fit devices — null keeps finalizePatient
          // away from the fitting/warranty updates AND the fitting-date campaign
          // enrollment (TNL enrolls its campaign off the status instead).
          // A signed PA finalizes as a PENDING fitting: no warranty expiry yet —
          // it's computed from the confirmed fit date in the queue.
          (isTnl || isDnt || isReferral) ? null : { fittingDate: warrantyStart, warrantyExpiry: null },
          carePlan,
          form.notes,
          finalizeAppointments,
          staffId, clinicId,
          privatePay,
          wizardVisitId,
          { directPurchase: !!form.directPurchase, pendingFitting: paCommitted, warrantyYears: paCommitted ? years : null }
        );
        setSaved(true);
        await refreshPatients();
        // Build local patient object for selectedPatient
        return {
          id: wizardPatientId,
          location: clinic.name,
          createdAt: new Date().toISOString(),
          name: [form.firstName, form.lastName].filter(Boolean).join(" "),
          dob: form.dob, phone: form.phone, email: form.email, address: form.address,
          payType: form.payType,
          directPurchase: !!form.directPurchase,
          insurance: form.payType === "insurance" ? { carrier: form.carrier, planGroup: form.planGroup, tpa: form.tpa, tier: form.tier, tierPrice: form.tierPrice } : null,
          privatePay,
          devices: (isTnl || isDnt || isReferral) ? null : { left: leftRec, right: rightRec, fittingType, manufacturer: primary?.manufacturer || "", family: primary?.family || "", techLevel: primary?.techLevel || "", style: primary?.style || "", color: primary?.color || "", battery: primary?.battery || "", fittingDate: warrantyStart, warrantyExpiry: null, pendingFitting: paCommitted, warrantyYears: paCommitted ? years : null, recordedAt: new Date().toISOString(), serialLeft: genId(), serialRight: genId() },
          audiology: form.audiology,
          carePlan: carePlan,
          appointments: finalizeAppointments,
          notes: form.notes,
          patientStatus: finalizeStatus,
        };
      } catch (err) {
        console.error("finalizePatient error:", err);
        setSaveError(err?.message || err?.toString() || "Unknown error — check console");
        throw err;
      }
    }

    // Legacy full-save path (no incremental saves happened)
    const patient = {
      id: genId(),
      location: clinic.name,
      createdAt: new Date().toISOString(),
      name: [form.firstName, form.lastName].filter(Boolean).join(" "),
      dob: form.dob,
      phone: form.phone,
      email: form.email,
      address: form.address,
      payType: form.payType,
      directPurchase: !!form.directPurchase,
      insurance: form.payType === "insurance" ? { carrier: form.carrier, planGroup: form.planGroup, tpa: form.tpa, tier: form.tier, tierPrice: form.tierPrice } : null,
      privatePay: !isTnl && !isDnt && !isReferral && form.payType === "private" && form.tierPrice != null
        ? { tier: form.tier, tierPrice: form.tierPrice }
        : null,
      devices: (isTnl || isDnt || isReferral) ? null : {
        left: leftRec,
        right: rightRec,
        fittingType,
        manufacturer: primary?.manufacturer || "",
        family: primary?.family || "",
        techLevel: primary?.techLevel || "",
        style: primary?.style || "",
        color: primary?.color || "",
        battery: primary?.battery || "",
        fittingDate: warrantyStart,
        warrantyExpiry: null,
        pendingFitting: paCommitted,
        warrantyYears: paCommitted ? years : null,
        serialLeft: genId(),
        serialRight: genId(),
      },
      audiology: form.audiology,
      carePlan: (isTnl || isDnt || isReferral) ? null : (form.payType === "insurance" ? form.carePlan : null),
      appointments: isTnl
        ? [...(form.appointments || []), buildTnlRetestAppointment()]
        : paCommitted
          ? [...(form.appointments || []), { date: warrantyStart, type: CARE_ARC[0].type, note: CARE_ARC[0].note }]
          : form.appointments,
      notes: form.notes,
      patientStatus: finalizeStatus,
    };
    try {
      await savePatient(patient, staffId, clinicId);
      if (form.intakeId) {
        try { await linkIntakeToPatient(form.intakeId, patient.id, clinicId); }
        catch (e) { console.error('linkIntakeToPatient:', e); }
      }
      setSaved(true);
      await refreshPatients();
      return patient;
    } catch (err) {
      console.error("savePatient error:", err);
      // Partial failure: the patient row exists but some sections didn't
      // save. Pull the list so the provider sees the (incomplete) patient
      // and fixes it from the chart — re-saving would create a duplicate.
      if (err?.partial) await refreshPatients();
      setSaveError(err?.message || err?.toString() || "Unknown error — check console");
      throw err;
    }
  };

  // Payer snapshot at the moment of decision. The outcome row stores this
  // verbatim — never derived from the patient record at query time — so a
  // later insurance change can't rewrite historical attach-rate numbers.
  // Accepts anything shaped like the local patient object ({ payType,
  // insurance, privatePay }).
  const buildPayerSnapshot = (p) => {
    if (p?.payType === "private") {
      return {
        payerType: "private_pay",
        payerName: null,
        payerPlanSnapshot: p.privatePay
          ? { private_pay_tier: p.privatePay.tier || null, private_pay_price_per_aid: p.privatePay.tierPrice ?? null }
          : null,
      };
    }
    const ins = p?.insurance || null;
    // Direct Purchase: a TruHearing benefit sold private at the plan price. It's
    // priced and care-planned like a TruHearing sale (keep the tier snapshot so
    // revenue/tier mix work), but billed privately — its own payer type so the
    // reports separate these from real TruHearing referrals.
    if (p?.directPurchase) {
      return {
        payerType: "direct_purchase",
        payerName: ins?.tpa || ins?.carrier || null,
        payerPlanSnapshot: ins
          ? { carrier: ins.carrier || null, plan_group: ins.planGroup || null, tpa: ins.tpa || null, tier: ins.tier || null, tier_price_per_aid: ins.tierPrice ?? null, direct_purchase: true }
          : null,
      };
    }
    return {
      // Non-TPA carriers stay out of the TPA attach-rate denominator.
      payerType: ins?.tpa ? "tpa" : "other_insurance",
      payerName: ins?.tpa || ins?.carrier || null,
      payerPlanSnapshot: ins
        ? { carrier: ins.carrier || null, plan_group: ins.planGroup || null, tpa: ins.tpa || null, tier: ins.tier || null, tier_price_per_aid: ins.tierPrice ?? null }
        : null,
    };
  };

  // Medical referral out (Close Appointment): persist the medical_referrals
  // row, then generate the printable referral document — downloaded for the
  // patient to take to their medical appointment and archived to the chart
  // (Documents card, kind 'medical_referral'). The appointment_outcomes row
  // is already saved by the caller; failures here must not undo the close,
  // so they surface loudly as an alert instead of throwing.
  const recordMedicalReferral = async (patient, referral, visitId = null) => {
    const problems = [];
    try {
      await createMedicalReferral({
        patientId: patient.id,
        clinicId,
        providerId: staffId,
        visitId,
        referralType: referral.referralType,
        reasons: referral.reasons,
        notes: referral.notes,
        referredTo: referral.referredTo,
      });
    } catch (e) {
      console.error("createMedicalReferral:", e);
      problems.push("saving the referral record");
    }
    // Medical-safety battery from the patient's latest intake — answers
    // plus the per-question provider notes. Best-effort: a missing or
    // unloadable intake just omits the section from the document.
    let safety = null;
    try {
      const intakes = await loadIntakesForPatient(patient.id);
      const latest = intakes[0];
      if (latest) {
        const answers = unwrapIntakeAnswers(latest.answers) || {};
        safety = buildSafetySnapshot(answers, latest.providerNotes || {});
      }
    } catch (e) {
      console.error("load intake for referral document:", e);
    }
    let generated = null;
    try {
      const aud = patient.audiology || null;
      const earSummary = (t, wrs) =>
        (getPTA(t) == null && getPTA4(t) == null && wrs == null) ? null
          : { pta: getPTA(t), pta4: getPTA4(t), wrs: wrs ?? null };
      const audiometry = aud
        ? { right: earSummary(aud.rightT, aud.unaidedR), left: earSummary(aud.leftT, aud.unaidedL) }
        : null;
      // Full AC/BC threshold maps for the clinical audiogram panels on the
      // referral (masking flags included — the symbols differ).
      const audiogram = aud
        ? {
            rightT: aud.rightT || {}, leftT: aud.leftT || {},
            rightBC: aud.rightBC || {}, leftBC: aud.leftBC || {},
            rightMask: aud.rightMask || {}, leftMask: aud.leftMask || {},
            rightBCMask: aud.rightBCMask || {}, leftBCMask: aud.leftBCMask || {},
          }
        : null;
      generated = downloadReferralPdf({
        patient: { name: patient.name, dob: patient.dob ? fmtDate(patient.dob) : null, phone: patient.phone },
        clinic: { name: paClinic?.name, address: paClinic?.address, phone: paClinic?.phone },
        provider: paProvider,
        referralType: referral.referralType,
        reasons: referral.reasons,
        notes: referral.notes || "",
        referredTo: referral.referredTo || "",
        audiometry: (audiometry && (audiometry.right || audiometry.left)) ? audiometry : null,
        audiogram,
        safety,
        signatureImageBase64: paSignatureB64,
      });
    } catch (e) {
      console.error("generateReferralPdf:", e);
      problems.push("generating the referral document");
    }
    if (generated) {
      try {
        await uploadPatientDocument({
          patientId: patient.id,
          clinicId,
          staffId,
          kind: "medical_referral",
          blob: generated.blob,
          fileName: generated.fileName,
          metadata: {
            reasons: referral.reasons,
            referral_type: referral.referralType,
            referred_to: referral.referredTo || null,
          },
        });
      } catch (e) {
        console.error("archive referral document:", e);
        problems.push("archiving the document to the chart");
      }
    }
    if (problems.length) {
      window.alert(`Appointment closed, but the medical referral hit a problem: ${problems.join(", ")}. Check the chart before the patient leaves.`);
    }
  };

  // Close Appointment from the wizard. The ordering is load-bearing:
  //   1. finalize the patient — must succeed first, the disposition needs a
  //      patient_id (a failure throws back into the modal; wizard stays put)
  //   2. insert the appointment_outcomes row — on failure the patient still
  //      exists, and the payload is stashed so the profile nags until logged
  //   3. navigate to the new profile
  // Never an orphaned disposition; never a lost patient.
  const handleWizardCloseAppointment = async (fields) => {
    const patient = await finalizeWizardPatient(fields.deviceDisposition);
    const outcome = {
      patientId: patient.id,
      clinicId,
      providerId: staffId,
      visitId: wizardVisitId || null,
      ...buildPayerSnapshot(patient),
      ...fields,
    };
    try {
      await saveAppointmentOutcome(outcome);
      clearPendingOutcome(patient.id);
    } catch (e) {
      console.error("saveAppointmentOutcome (wizard):", e);
      stashPendingOutcome(patient.id, outcome);
    }
    // Medical referral out: referral record + printable document for the
    // patient (best-effort — the close itself already succeeded).
    if (fields.referral) {
      await recordMedicalReferral(patient, fields.referral, wizardVisitId || null);
    }
    // The wizard opened this visit at draft time; the close ends it.
    if (wizardVisitId) {
      try { await updateVisit(wizardVisitId, { status: "completed" }); }
      catch (e) { console.error("close visit:", e); }
    }
    // The appointment is done — the resume snapshot has served its purpose.
    discardWizardDraft();
    setCloseAppointment(null);
    setSelectedPatient(patient);
    setPunchData({ cleanings: 0, appointments: 0, log: [] });
    setView("patient");
  };

  // Close Appointment from the patient profile — same modal, no finalization
  // step. Every close appends a new outcomes row (the table doubles as visit
  // history). When a stashed pending outcome exists, its payer snapshot and
  // visit id are reused so the record reflects the original decision moment.
  const handleProfileCloseAppointment = async (fields) => {
    const p = selectedPatient;
    if (!p) return;
    const pending = readPendingOutcome(p.id);
    const payer = pending
      ? { payerType: pending.payerType, payerName: pending.payerName, payerPlanSnapshot: pending.payerPlanSnapshot }
      : buildPayerSnapshot(p);
    const outcome = {
      patientId: p.id,
      clinicId,
      providerId: staffId,
      visitId: pending?.visitId || null,
      ...payer,
      ...fields,
    };
    await saveAppointmentOutcome(outcome); // throws → modal surfaces the error
    clearPendingOutcome(p.id);
    // Medical referral out: referral record + printable document (best-effort
    // — the outcome row is already saved, so a failure here must not reopen
    // the modal and tempt a duplicate close).
    if (fields.referral) {
      await recordMedicalReferral(p, fields.referral, pending?.visitId || null);
      refreshDocuments?.();
    }
    setCloseAppointment(null);
  };


  const startNew = () => {
    if (!confirmDiscardWizardDraft()) return;
    setForm(BLANK_FORM());
    setActiveSide("left");
    setShowWizardPaModal(false); setWizardPaSigned(false); setWizardPaSignatureDate(null);
    setWizardPatientId(null); setWizardVisitId(null); setSaveToast(false);
    setWizardMode("new"); setShowWizardCompare(false);
    setStep(0); setSaved(false); setView("new");
  };

  // Upgrade purchase (backlog #23, close → devices): seed the wizard from an
  // established patient and land mid-flow so the upgrade reuses the same
  // tier/device/quote/PA machinery as a new fitting. wizardVisitId carries the
  // upgrade visit so the step-5 incremental save writes a NEW visit-scoped
  // device_fittings row (the original fit survives — updatePatientDevices is
  // visit-scoped) and finalize targets only this visit's fitting dates.
  const startUpgradePurchase = (p, { visitId = null, tierOffered = null, tierPrice = null, audiology = null, refreshedPlan = null } = {}) => {
    if (!p) return;
    if (!confirmDiscardWizardDraft()) return;
    const nameParts = String(p.name || "").trim().split(/\s+/);
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");
    // Prefer the audiogram captured during the upgrade visit; fall back to
    // the chart's audiology so Results/Recommendation still have data.
    const hasFreshAudio = audiology
      && (Object.keys(audiology.rightT || {}).length > 0 || Object.keys(audiology.leftT || {}).length > 0);
    // A refreshed-benefit plan verified at the Journey Review overrides the
    // saved coverage for THIS purchase: it seeds the wizard form, which is
    // what gates the device cascade (visibleCatalog on form.tpa / the TH card
    // flow on carrier+planGroup) and pricing. The chart's coverage record is
    // deliberately untouched — that update belongs to the profile's Coverage
    // card.
    const payType = refreshedPlan ? "insurance" : (p.payType || "insurance");
    const cov = refreshedPlan || p.insurance || null;
    const plan = payType === "insurance"
      ? activePlans.find(pl => pl.carrier === cov?.carrier && pl.planGroup === cov?.planGroup)
      : null;
    const privLabel = payType === "insurance" && isPrivateLabelPlan(plan);
    // Tier price: the UpgradeClose hands us its reference price (plan copay or
    // retail anchor); for private-label plans re-resolve from the plan row so
    // the seeded price matches what TierSelection would write.
    const seededTierPrice = tierPrice != null
      ? tierPrice
      : (privLabel && tierOffered ? (plan?.tiers?.find(t => t.label === tierOffered)?.price ?? null) : null);
    setForm({
      ...BLANK_FORM(),
      firstName, lastName,
      dob: p.dob || "", phone: p.phone || "", email: p.email || "", address: p.address || "",
      payType,
      directPurchase: p.directPurchase || false, // preserve a direct-purchase patient's mode on upgrade
      carrier: cov?.carrier || "", planGroup: cov?.planGroup || "", tpa: cov?.tpa || "",
      tier: tierOffered || "", tierPrice: seededTierPrice,
      audiology: hasFreshAudio ? audiology : (p.audiology || BLANK_AUDIOLOGY()),
      notes: p.notes || "",
    });
    setWizardPatientId(p.id);
    setWizardVisitId(visitId);
    setWizardMode("upgrade");
    setShowWizardPaModal(false); setWizardPaSigned(false); setWizardPaSignatureDate(null);
    setActiveSide("left"); setSaved(false); setSaveError(null); setSaveToast(false);
    setShowWizardCompare(false);
    // Load the patient's latest linked intake so step 6's reflection flags and
    // the Then-vs-Now comparison have real data (the step-1 loader won't run —
    // we land past it).
    setWizardIntake(null);
    loadIntakesForPatient(p.id)
      .then(intakes => setWizardIntake(normalizeWizardIntake(intakes[0])))
      .catch(() => {});
    // Care Plan (4) leads the purchase conversation for insurance flows.
    // Private pay bundles Complete Care+ (no Care Plan step) — land on
    // Technology Tier (5) instead.
    setStep(payType === "private" ? 5 : 4);
    setView("new");
  };

  // Established-patient flow (backlog #23): route to the dedicated UpgradeWizard
  // instead of the new-patient 8-step form. The wizard opens its own visit once
  // the provider picks the journey year, so an established patient's baseline
  // (their original fit) is never overwritten.
  const startNewVisitForPatient = (p) => {
    if (!p) return;
    setSelectedPatient(p);
    setView("upgrade");
  };

  // New-patient appointment on an EXISTING chart — the safeguard for an
  // interrupted first visit: the draft patient survived (created at step 0 /
  // intake accept) but the wizard session didn't, so the provider needs a way
  // to run the full 8-step appointment for that chart without creating a
  // duplicate. Seeds the wizard from the chart and sets wizardPatientId, so
  // step 0's Continue skips createPatientDraft; a fresh initial_fit visit
  // scopes this appointment's audiogram/device saves (prior visits' records
  // survive — visits model). The chart's saved audiogram pre-fills Testing so
  // thresholds captured before the interruption don't need re-entry.
  const startNewAppointmentForPatient = async (p) => {
    if (!p) return;
    if (!confirmDiscardWizardDraft()) return;
    const nameParts = String(p.name || "").trim().split(/\s+/);
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");
    setForm({
      ...BLANK_FORM(),
      firstName, lastName,
      dob: p.dob || "", phone: p.phone || "", email: p.email || "", address: p.address || "",
      payType: p.payType || "insurance",
      directPurchase: p.directPurchase || false,
      carrier: p.insurance?.carrier || "", planGroup: p.insurance?.planGroup || "", tpa: p.insurance?.tpa || "",
      tier: p.insurance?.tier || "", tierPrice: p.insurance?.tierPrice ?? null,
      audiology: p.audiology ? { ...BLANK_AUDIOLOGY(), ...p.audiology } : BLANK_AUDIOLOGY(),
      notes: p.notes || "",
    });
    setWizardPatientId(p.id);
    setWizardVisitId(null);
    setActiveSide("left");
    setShowWizardPaModal(false); setWizardPaSigned(false); setWizardPaSignatureDate(null);
    setWizardMode("new"); setShowWizardCompare(false);
    setSaveError(null); setSaveToast(false);
    setVisitTypePicker(null);
    setStep(0); setSaved(false); setView("new");
    // Best-effort: if the visit insert fails, saves fall back to the unscoped
    // legacy path rather than blocking the appointment.
    try {
      const vid = await createVisit(p.id, { clinicId, staffId, visitType: 'initial_fit' });
      setWizardVisitId(vid);
    } catch (e) { console.error("createVisit (new appointment on existing chart):", e); }
  };

  // Mint a short single-use code the front desk reads to a returning patient so
  // the kiosk's annual/upgrade check-in pre-fills last year's answers (Phase 2).
  const handleCreateCheckinCode = async (p) => {
    if (!p || checkinBusy) return;
    setCheckinBusy(true);
    try {
      const { code, expiresAt } = await createUpgradeCheckinSession(p.id, clinicId, staffId);
      setCheckinSession({ code, expiresAt, patientName: p.name });
    } catch (e) {
      console.error("createUpgradeCheckinSession:", e);
      alert(`Couldn't create a check-in code: ${e?.message || "unknown error"}`);
    } finally {
      setCheckinBusy(false);
    }
  };


  // ── Intake queue handlers ────────────────────────────────────────────
  // Accept an intake: immediately persist a draft patient from the intake
  // answers and link intakes.patient_id. We do this at Accept time (not on
  // the Continue button) so if the provider abandons the wizard the record
  // still survives — the intake already captured enough to call it a
  // patient. Link happens synchronously with draft creation to keep the
  // intake queryable by patient_id from the very first save.
  const handleAcceptIntake = async (intake) => {
    if (!confirmDiscardWizardDraft()) return; // intake stays in the queue
    // Patient-facing wizard steps render in the language they chose at the kiosk.
    setDisplayLang(intake._meta?.lang === "es" ? "es" : "en");
    const a = unwrapIntakeAnswers(intake.answers) || {};
    const phone = a.mobilePhone || a.homePhone || a.workPhone || a.phone || "";
    const digits = phone.replace(/\D/g,"").slice(0,10);
    let fmt = digits;
    if (digits.length >= 7) fmt = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    else if (digits.length >= 4) fmt = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    else if (digits.length > 0) fmt = `(${digits}`;

    // Kiosk currently stores DOB as MM/DD/YYYY; patients.dob is DATE so we
    // normalize to ISO. Phase 2 will replace the kiosk's DOB input with
    // three dropdowns that write ISO directly, at which point this regex
    // fallback becomes a no-op for fresh intakes but still handles any
    // in-flight MM/DD/YYYY rows.
    const rawDob = a.dob || "";
    const usDob = rawDob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const isoDob = usDob
      ? `${usDob[3]}-${usDob[1].padStart(2,"0")}-${usDob[2].padStart(2,"0")}`
      : rawDob;

    const address = [a.street, [a.city, a.state].filter(Boolean).join(", "), a.zip]
      .filter(Boolean).join(", ");
    const firstName = a.firstName || "";
    const lastName  = a.lastName  || "";
    const name      = [firstName, lastName].filter(Boolean).join(" ") || "New Patient";
    const payType   = a.payType || "insurance";
    const intakeId  = intake._meta?.intakeId || null;
    const notes     = [a.visitReason, intakeId ? `Intake ID: ${intakeId}` : ""]
      .filter(Boolean).join("\n");

    let newPatientId;
    try {
      newPatientId = await createPatientDraft({
        id: genId(),
        name,
        dob: isoDob,
        phone: fmt,
        email: a.email || "",
        address,
        payType,
        notes,
        // Insurance is deliberately left null — verification happens live
        // during the appointment as a trust-building ritual, not pre-visit.
        insurance: null,
      }, staffId, clinicId);
    } catch (e) {
      console.error("createPatientDraft on intake accept:", e);
      const msg = e?.message || e?.toString() || "Unknown error";
      setSaveError(`Failed to save draft patient from intake: ${msg}`);
      alert(`Couldn't save the patient record from this intake.\n\nError: ${msg}\n\nThe intake is still in the queue — you can try Accept again.`);
      return;
    }

    if (intakeId) {
      try { await linkIntakeToPatient(intakeId, newPatientId, clinicId); }
      catch (e) { console.error("linkIntakeToPatient on intake accept:", e); }
      try { await dbAcceptIntake(intakeId); } catch {}
    }

    // Fresh session seeded from the intake alone — building on BLANK_FORM
    // (not the current form) so a prior abandoned session's audiogram,
    // devices, or notes can never bleed into this patient's chart.
    setForm({
      ...BLANK_FORM(),
      intakeId,
      firstName,
      lastName,
      dob:     isoDob,
      phone:   fmt,
      email:   a.email   || "",
      address,
      payType,
      carrier: a.carrier || "",
      notes,
    });
    setWizardPatientId(newPatientId);
    const vid = await createVisit(newPatientId, { clinicId, staffId, visitType: 'initial_fit' });
    setWizardVisitId(vid);
    setPendingIntakes(prev => prev.filter(i => i._meta?.intakeId !== intakeId));
    setShowIntakeQueue(false);
    setIntakeToast(null);
    setActiveSide("left");
    setShowWizardPaModal(false); setWizardPaSigned(false); setWizardPaSignatureDate(null);
    setWizardMode("new"); setShowWizardCompare(false);
    setStep(0); setSaved(false); setView("new");
    refreshPatients();
  };

  const handleDismissIntake = async (intakeId) => {
    try { await dismissIntake(intakeId); } catch {}
    setPendingIntakes(prev => prev.filter(i => i._meta?.intakeId !== intakeId));
  };

  // Link an annual/upgrade check-in to an EXISTING patient instead of creating
  // a new draft (the create-new path is handleAcceptIntake). Sets
  // intakes.patient_id so the UpgradeWizard's loadLatestUpgradeIntake can read
  // the patient's self-reported readiness, then drops the provider straight into
  // that wizard for the matched patient.
  const handleMatchToPatient = async (intake, patient) => {
    const intakeId = intake?._meta?.intakeId;
    if (!intakeId || !patient) return;
    try {
      await linkIntakeToPatient(intakeId, patient.id, clinicId);
      await dbAcceptIntake(intakeId);
    } catch (e) {
      console.error("handleMatchToPatient:", e);
      alert(`Couldn't link this check-in to ${patient.name}. Please try again.`);
      return;
    }
    setPendingIntakes(prev => prev.filter(i => i._meta?.intakeId !== intakeId));
    setMatchIntake(null);
    setMatchSearch("");
    setShowIntakeQueue(false);
    setIntakeToast(null);
    refreshPatients();
    // Open the established-patient flow for the matched chart — the wizard
    // pre-fills from the check-in we just linked.
    startNewVisitForPatient(patient);
  };


  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState(null);
  const handleSeedPatients = async () => {
    setSeeding(true); setSeedError(null);
    const seeds = [
      {
        id: genId(), location: clinic.name, createdAt: new Date().toISOString(),
        name: "Margaret Thornton", dob: "1948-03-12", phone: "(435) 555-0191", email: "margaret.thornton@email.com",
        payType: "insurance",
        insurance: { carrier: "Humana", planGroup: "Medicare Advantage", tpa: "TruHearing", tier: "Advanced", tierPrice: 0 },
        devices: {
          left: { manufacturer:"Signia", generation:"IX", family:"Pure Charge&Go IX", variant:"Standard", techLevel:"7", style:"ric", color:"Silver", battery:"Rechargeable", receiverLength:"2", receiverPower:"M", receiver:"Length 2 · Medium (M)", dome:"7mm Open" },
          right: { manufacturer:"Signia", generation:"IX", family:"Pure Charge&Go IX", variant:"Standard", techLevel:"7", style:"ric", color:"Silver", battery:"Rechargeable", receiverLength:"2", receiverPower:"M", receiver:"Length 2 · Medium (M)", dome:"7mm Open" },
          fittingType:"Bilateral", manufacturer:"Signia", family:"Pure Charge&Go IX", techLevel:"7", style:"ric", color:"Silver", battery:"Rechargeable",
          fittingDate: "2025-01-15", warrantyExpiry: warrantyDate("2025-01-15", 4), serialLeft: genId(), serialRight: genId(),
        },
        audiology: { rightT:{500:35,1000:40,2000:50,4000:65,8000:70}, leftT:{500:30,1000:40,2000:45,4000:60,8000:65}, rightBC:{}, leftBC:{}, rightMask:{}, leftMask:{}, rightBCMask:{}, leftBCMask:{}, tinnitusRight:false, tinnitusLeft:false, unaidedR:72, unaidedL:78, aidedR:92, aidedL:94, sinBin:7 },
        carePlan: "complete", appointments: [{ date:"2025-01-29", type:"2-Week Follow-Up" },{ date:"2025-02-12", type:"4-Week Follow-Up" }], notes: "Patient reports excellent satisfaction. Prefers telephone streaming.",
      },
      {
        id: genId(), location: clinic.name, createdAt: new Date().toISOString(),
        name: "Robert Hatch", dob: "1955-07-22", phone: "(435) 555-0347", email: "",
        payType: "insurance",
        insurance: { carrier: "DMBA", planGroup: "Deseret Secure; Deseret Alliance", tpa: "TruHearing", tier: "Level 3", tierPrice: 1199 },
        devices: {
          left: { manufacturer:"Signia", generation:"IX", family:"Pure Charge&Go IX", variant:"Standard", techLevel:"5", style:"ric", color:"Graphite", battery:"Rechargeable", receiverLength:"2", receiverPower:"P", receiver:"Length 2 · Power (P)", dome:"Closed Sleeve M" },
          right: { manufacturer:"Signia", generation:"IX", family:"Pure Charge&Go IX", variant:"Standard", techLevel:"5", style:"ric", color:"Graphite", battery:"Rechargeable", receiverLength:"3", receiverPower:"P", receiver:"Length 3 · Power (P)", dome:"Closed Sleeve M" },
          fittingType:"Bilateral", manufacturer:"Signia", family:"Pure Charge&Go IX", techLevel:"5", style:"ric", color:"Graphite", battery:"Rechargeable",
          fittingDate: "2025-03-03", warrantyExpiry: warrantyDate("2025-03-03", 3), serialLeft: genId(), serialRight: genId(),
        },
        audiology: { rightT:{500:45,1000:55,2000:65,4000:75,8000:80}, leftT:{500:50,1000:60,2000:70,4000:80,8000:85}, rightBC:{}, leftBC:{}, rightMask:{}, leftMask:{}, rightBCMask:{}, leftBCMask:{}, tinnitusRight:false, tinnitusLeft:false, unaidedR:58, unaidedL:52, aidedR:84, aidedL:80, sinBin:12 },
        carePlan: "punch", appointments: [], notes: "Moderate-to-severe bilateral. Needs follow-up on left dome fit.",
      },
      {
        id: genId(), location: clinic.name, createdAt: new Date().toISOString(),
        name: "Linda Espinoza", dob: "1962-11-05", phone: "(435) 555-0528", email: "linda.espinoza@gmail.com",
        payType: "private",
        insurance: null,
        devices: {
          left: { manufacturer:"Phonak", generation:"Infinio", family:"Audéo Infinio", variant:"Standard", techLevel:"90", style:"ric", color:"Champagne", battery:"Rechargeable", receiverLength:"1", receiverPower:"S", receiver:"Length 1 · Standard (S)", dome:"Open Dome M" },
          right: { manufacturer:"Phonak", generation:"Infinio", family:"Audéo Infinio", variant:"Standard", techLevel:"90", style:"ric", color:"Champagne", battery:"Rechargeable", receiverLength:"1", receiverPower:"S", receiver:"Length 1 · Standard (S)", dome:"Open Dome M" },
          fittingType:"Bilateral", manufacturer:"Phonak", family:"Audéo Infinio", techLevel:"90", style:"ric", color:"Champagne", battery:"Rechargeable",
          fittingDate: "2024-11-20", warrantyExpiry: warrantyDate("2024-11-20", 4), serialLeft: genId(), serialRight: genId(),
        },
        audiology: { rightT:{500:20,1000:25,2000:35,4000:55,8000:65}, leftT:{500:20,1000:25,2000:30,4000:50,8000:60}, rightBC:{}, leftBC:{}, rightMask:{}, leftMask:{}, rightBCMask:{}, leftBCMask:{}, tinnitusRight:false, tinnitusLeft:false, unaidedR:88, unaidedL:90, aidedR:98, aidedL:98, sinBin:4 },
        carePlan: null, appointments: [{ date:"2025-12-01", type:"Annual Exam" }], notes: "Private pay. High-functioning loss, excellent word recognition. Very tech-savvy.",
      },
    ];
    let errors = [];
    for (const p of seeds) {
      try { await savePatient(p, staffId, clinicId); }
      catch (e) { errors.push(`${p.name}: ${e?.message||e}`); }
    }
    if (errors.length) { setSeedError(errors.join(" | ")); }
    else { await refreshPatients(); }
    setSeeding(false);
  };

  const statsData = useMemo(() => {
    // TNS (tested not sold) and TNL (tested no loss) both sit outside the
    // fitted-patient stats — TNL was never a treatment candidate at all.
    const active = patients.filter(p => p.patientStatus !== "tns" && p.patientStatus !== "tnl");
    const tnsCount = patients.filter(p => p.patientStatus === "tns").length;
    const tnlCount = patients.filter(p => p.patientStatus === "tnl").length;
    return {
      total: patients.length,
      tnsCount,
      tnlCount,
      fittingsThisMonth: active.filter(p => {
        const d = new Date(p.devices?.fittingDate||0);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      warrantiesExpiring: active.filter(p => {
        const days = daysUntil(p.devices?.warrantyExpiry||"");
        return days >= 0 && days <= 90;
      }).length,
      upcomingAppts: active.reduce((acc,p) => acc + (p.appointments||[]).filter(a => daysUntil(a.date) >= 0).length, 0),
    };
  }, [patients]);


  // ── STYLES ────────────────────────────────────────────────────────────────
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sora', sans-serif; background: #F4F1EA; }
    .app { display: flex; height: 100vh; overflow: hidden; }
    /* SIDEBAR */
    .sidebar { width: 260px; background: #0C211E; display: flex; flex-direction: column; flex-shrink: 0; }
    .sidebar-logo { padding: 24px 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .logo-badge { font-size: 10px; font-weight: 600; letter-spacing: 2px; color: #C79A3F; text-transform: uppercase; margin-bottom: 6px; }
    .logo-name { font-size: 18px; font-weight: 700; color: white; line-height: 1.2; }
    .logo-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 3px; }
    .location-select { margin: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 10px; color: white; font-size: 11px; font-family: 'Sora',sans-serif; width: calc(100% - 28px); cursor: pointer; }
    .sidebar-nav { flex: 1; padding: 8px 0; overflow-y: auto; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 20px; cursor: pointer; font-size: 13px; color: rgba(255,255,255,0.5); transition: all 0.15s; border-left: 3px solid transparent; }
    .nav-item:hover { background: rgba(255,255,255,0.05); color: white; }
    .nav-item.active { background: rgba(216,169,63,0.12); color: #D8A93F; border-left-color: #C79A3F; }
    .nav-section-label { padding: 14px 20px 6px; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.3); }
    .nav-icon { width: 20px; display: flex; align-items: center; justify-content: center; }
    .sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.07); font-size: 11px; color: rgba(255,255,255,0.3); }
    /* MAIN */
    .main { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
    .topbar { background: white; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E4E0D5; flex-shrink: 0; }
    .topbar-title { font-size: 20px; font-weight: 700; color: #0a1628; }
    .topbar-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
    .btn-primary { background: #0B4A42; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; display: flex; align-items: center; gap: 8px; transition: background 0.15s; }
    .btn-primary:hover { background: #0E5A50; }
    .btn-primary.green { background: #1B8A7A; }
    .btn-primary.green:hover { background: #0F6E56; }
    .btn-ghost { background: transparent; border: 1px solid #E4E0D5; color: #6b7280; padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: 'Sora',sans-serif; }
    .content { padding: 28px; flex: 1; }
    /* STATS */
    .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 28px; }
    .stat-card { background: white; border-radius: 12px; padding: 20px; border: 1px solid #E4E0D5; box-shadow: 0 1px 2px rgba(16,32,28,0.04), 0 10px 22px -18px rgba(16,32,28,0.4); }
    .stat-icon { font-size: 22px; margin-bottom: 10px; }
    .stat-val { font-size: 32px; font-weight: 700; color: #0a1628; line-height: 1; }
    .stat-label { font-size: 12px; color: #9ca3af; margin-top: 6px; }
    .stat-card.highlight { background: #0B4A42; }
    .stat-card.highlight .stat-val { color: #D8A93F; }
    .stat-card.highlight .stat-label { color: rgba(255,255,255,0.4); }
    /* PATIENT TABLE */
    .table-card { background: white; border-radius: 12px; border: 1px solid #E4E0D5; overflow: hidden; }
    .table-header { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F0EDE3; }
    .table-title { font-size: 14px; font-weight: 600; color: #0a1628; }
    .search-input { border: 1px solid #E4E0D5; border-radius: 8px; padding: 7px 12px; font-size: 13px; font-family: 'Sora',sans-serif; width: 220px; outline: none; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; background: #FAF8F2; }
    td { padding: 12px 16px; font-size: 13px; color: #374151; border-top: 1px solid #F0EDE3; }
    tr:hover td { background: #FAF8F2; cursor: pointer; }
    .patient-name { font-weight: 600; color: #0a1628; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge.insurance { background: #dbeafe; color: #1d4ed8; }
    .badge.private { background: #F4EAD4; color: #6E4E16; }
    .badge.complete { background: #E2EFEA; color: #0C4A40; }
    .badge.punch { background: #e0f2fe; color: #0c4a6e; }
    .badge.paygo { background: #F0EDE3; color: #6b7280; }
    .warranty-bar { height: 4px; background: #E4E0D5; border-radius: 2px; margin-top: 4px; overflow: hidden; width: 80px; }
    .warranty-fill { height: 100%; border-radius: 2px; background: #1B8A7A; }
    .warranty-fill.warn { background: #B5832E; }
    .warranty-fill.exp { background: #C7553C; }
    /* WIZARD */
    .wizard-wrap { max-width: 1140px; }
    .wizard-steps { display: flex; gap: 0; margin-bottom: 32px; }
    .wizard-step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
    .wizard-step:not(:last-child)::after { content:''; position: absolute; top: 14px; left: 50%; width: 100%; height: 2px; background: #E4E0D5; z-index: 0; }
    .wizard-step.done::after { background: #1B8A7A; }
    .step-dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #E4E0D5; background: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #9ca3af; z-index: 1; position: relative; }
    .step-dot.active { border-color: #0B4A42; background: #0B4A42; color: white; }
    .step-dot.done { border-color: #1B8A7A; background: #1B8A7A; color: white; }
    .step-name { font-size: 10px; color: #9ca3af; margin-top: 6px; font-weight: 500; letter-spacing: 0.5px; }
    .step-name.active { color: #16201D; font-weight: 700; }
    .card { background: white; border-radius: 14px; border: 1px solid #E4E0D5; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(16,32,28,0.04), 0 12px 28px -18px rgba(16,32,28,0.4); }
    .card-title { font-size: 16px; font-weight: 700; color: #0a1628; margin-bottom: 20px; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field.full { grid-column: 1/-1; }
    label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
    input, select, textarea { border: 1px solid #E4E0D5; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-family: 'Sora',sans-serif; outline: none; transition: border 0.15s; width: 100%; background: white; }
    input:focus, select:focus, textarea:focus { border-color: #0B4A42; }
    .radio-group { display: flex; gap: 10px; flex-wrap: wrap; }
    .radio-pill { flex: 1; border: 2px solid #E4E0D5; border-radius: 10px; padding: 12px; cursor: pointer; text-align: center; transition: all 0.15s; }
    .radio-pill.active { border-color: #0B4A42; background: #0B4A42; color: white; }
    .radio-pill-label { font-size: 13px; font-weight: 600; }
    .radio-pill-sub { font-size: 11px; opacity: 0.6; margin-top: 2px; }
    /* Manufacturer pills: fixed 140x68 footprint with per-brand logo heights
       tuned to each brand's native aspect, so visual weight is even across
       all eight. Source PNGs for Phonak/Resound/Rexton/Starkey were re-exported
       to trim transparent canvas padding, strip Rexton's solid black
       background, and drop Starkey's "Hearing Technologies" tagline. */
    .radio-group.mfr-group { justify-content: flex-start; }
    .radio-pill.mfr-pill { flex: 0 0 auto; width: 140px; height: 68px; display: flex; align-items: center; justify-content: center; padding: 8px 12px; background: #fff; box-sizing: border-box; }
    .radio-pill.mfr-pill.active { background: #FBF9F3; color: inherit; box-shadow: inset 0 0 0 2px #0B4A42; }
    .radio-pill.mfr-pill img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .radio-pill.mfr-pill img[alt="Oticon"]     { height: 24px; }
    .radio-pill.mfr-pill img[alt="Widex"]      { height: 24px; }
    .radio-pill.mfr-pill img[alt="Phonak"]     { height: 28px; }
    .radio-pill.mfr-pill img[alt="Resound"],
    .radio-pill.mfr-pill img[alt="ReSound"]    { height: 36px; }
    .radio-pill.mfr-pill img[alt="Signia"]     { height: 50px; }
    .radio-pill.mfr-pill img[alt="Starkey"]    { height: 36px; }
    /* TruHearing is square ~1:1 — punch out of the max-height cap so the
       mark renders ~30% larger than the wide wordmarks, matching their
       visual weight in the 140x68 pill. */
    .radio-pill.mfr-pill img[alt="TruHearing"] { height: 52px; max-height: none; }
    .radio-pill.mfr-pill img[alt="Rexton"]     { height: 24px; }
    .plan-select-list { display: flex; flex-direction: column; gap: 8px; }
    .plan-row { border: 2px solid #E4E0D5; border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
    .plan-row:hover { border-color: #9ca3af; }
    .plan-row.active { border-color: #0B4A42; background: #FBF9F3; }
    .plan-row-top { display: flex; justify-content: space-between; }
    .plan-row-name { font-size: 14px; font-weight: 600; color: #0a1628; }
    .plan-row-tpa { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .tier-pills { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .tier-pill { padding: 5px 14px; border-radius: 20px; border: 1px solid #E4E0D5; font-size: 12px; cursor: pointer; transition: all 0.15s; }
    .tier-pill:hover { border-color: #0B4A42; }
    .tier-pill.active { background: #0B4A42; color: white; border-color: #0B4A42; }
    .style-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .style-card { border: 2px solid #E4E0D5; border-radius: 10px; padding: 14px 12px; text-align: center; cursor: pointer; transition: all 0.15s; }
    .style-card:hover { border-color: #9ca3af; }
    .style-card.active { border-color: #0B4A42; background: #FBF9F3; }
    .style-id { font-size: 14px; font-weight: 700; color: #0a1628; }
    .style-desc { font-size: 10px; color: #9ca3af; margin-top: 3px; line-height: 1.3; }
    .color-swatches { display: flex; gap: 8px; flex-wrap: wrap; }
    .color-swatch { padding: 6px 14px; border-radius: 20px; border: 2px solid #E4E0D5; font-size: 12px; cursor: pointer; transition: all 0.15s; }
    .color-swatch.active { border-color: #0B4A42; background: #E2EFEA; color: #0C4A40; font-weight: 700; box-shadow: 0 0 0 1px #0B4A42; }
    .appt-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .appt-row { display: flex; gap: 8px; align-items: center; background: #FAF8F2; border-radius: 8px; padding: 10px 12px; }
    .appt-row span { font-size: 12px; color: #374151; }
    .appt-del { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; margin-left: auto; }
    .add-appt-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; }
    .wizard-nav { display: flex; justify-content: space-between; margin-top: 8px; }
    /* REVIEW */
    .review-section { margin-bottom: 20px; }
    .review-label { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #9ca3af; text-transform: uppercase; margin-bottom: 10px; }
    .review-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F0EDE3; font-size: 13px; }
    .review-key { color: #6b7280; }
    .review-val { font-weight: 600; color: #0a1628; }
    /* PATIENT DETAIL */
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .detail-card { background: white; border-radius: 12px; border: 1px solid #E4E0D5; padding: 20px; }
    .detail-card.full { grid-column: 1/-1; }
    .detail-card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 14px; }
    .detail-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #FAF8F2; font-size: 13px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-key { color: #9ca3af; }
    .detail-val { font-weight: 500; color: #0a1628; }
    .qr-prompt { background: linear-gradient(135deg, #0B4A42, #0E5A50); color: white; border-radius: 14px; padding: 28px; text-align: center; margin-bottom: 20px; }
    .qr-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .qr-sub { font-size: 13px; opacity: 0.65; margin-bottom: 20px; }
    .qr-box { background: white; border-radius: 12px; width: 120px; height: 120px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .qr-id { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; color: #1B8A7A; letter-spacing: 3px; margin-bottom: 4px; }
    .qr-inst { font-size: 12px; opacity: 0.5; }
    .warranty-ring { position: relative; display: inline-flex; align-items: center; justify-content:: center; }
    .empty-state { text-align: center; padding: 60px; color: #9ca3af; }
    .empty-icon { font-size: 48px; margin-bottom: 16px; }
    .empty-title { font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 8px; }
    .empty-sub { font-size: 14px; }
    /* SETTINGS */
    .settings-wrap { max-width: 560px; }
    .settings-section { background: white; border-radius: 14px; border: 1px solid #E4E0D5; padding: 28px; margin-bottom: 20px; }
    .settings-title { font-size: 16px; font-weight: 700; color: #0a1628; margin-bottom: 20px; }
    .settings-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .settings-field:last-child { margin-bottom: 0; }
    .settings-preview { background: #0B4A42; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
    .settings-preview-logo { font-size: 28px; font-weight: 800; color: white; letter-spacing: -0.5px; }
    .settings-preview-sub { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 2px; }
    .color-options { display: flex; gap: 10px; flex-wrap: wrap; }
    .color-option { width: 32px; height: 32px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: all 0.15s; }
    .color-option.active { border-color: #0B4A42; transform: scale(1.15); }
    .save-success { background: #E2EFEA; color: #0C4A40; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .save-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .distil-badge { font-size: 9px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 2px; }
    /* PUNCH CARD */
    .punch-panel { background: linear-gradient(135deg, #0B4A42 0%, #0E5A50 100%); border-radius: 14px; padding: 24px; color: white; }
    .punch-panel-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .punch-panel-title { font-size: 16px; font-weight: 700; }
    .punch-panel-sub { font-size: 12px; opacity: 0.45; margin-top: 3px; }
    .punch-remaining { text-align: right; }
    .punch-remaining-num { font-size: 32px; font-weight: 800; color: #1B8A7A; line-height: 1; }
    .punch-remaining-label { font-size: 10px; opacity: 0.45; margin-top: 2px; letter-spacing: 1px; text-transform: uppercase; }
    .punch-row { margin-bottom: 20px; }
    .punch-row-label { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.45; margin-bottom: 10px; display: flex; justify-content: space-between; }
    .punch-row-label span { color: #1B8A7A; opacity: 1; }
    .punch-dots { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .punch-dot { width: 26px; height: 26px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
    .punch-dot.used { background: #1B8A7A; border-color: #1B8A7A; color: #0a1628; }
    .punch-actions { display: flex; align-items: center; gap: 10px; }
    .punch-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: white; cursor: pointer; font-family: 'Sora',sans-serif; transition: background 0.15s; }
    .punch-btn:hover { background: rgba(255,255,255,0.18); }
    .punch-btn:disabled { opacity: 0.25; cursor: default; }
    .punch-btn.confirm { background: #1B8A7A; color: #0a1628; border-color: #1B8A7A; }
    .punch-btn.confirm:hover { background: #0F6E56; }
    .punch-undo { font-size: 11px; color: rgba(255,255,255,0.3); cursor: pointer; text-decoration: underline; }
    .punch-success { background: rgba(27,138,122,0.15); border: 1px solid rgba(27,138,122,0.3); border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 700; color: #1B8A7A; display: flex; align-items: center; gap: 8px; }
    .punch-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 16px 0; }
    .punch-log-title { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.35; margin-bottom: 10px; }
    .punch-log-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 12px; }
    .punch-log-row:last-child { border-bottom: none; }
    .punch-log-type { opacity: 0.6; }
    .punch-log-date { opacity: 0.35; font-size: 11px; }
    /* CATALOG EDITOR */
    .catalog-wrap { max-width: 860px; }
    .catalog-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 20px; }
    .catalog-search { flex: 1; padding: 9px 14px; border-radius: 8px; border: 1px solid #E4E0D5; font-size: 13px; font-family: 'Sora',sans-serif; }
    .catalog-mfr-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
    .catalog-mfr-tab { padding: 5px 14px; border-radius: 20px; border: 1px solid #E4E0D5; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; background: white; color: #6b7280; }
    .catalog-mfr-tab:hover { border-color: #9ca3af; }
    .catalog-mfr-tab.active { background: #0B4A42; color: white; border-color: #0B4A42; }
    .catalog-entry { background: white; border: 1px solid #E4E0D5; border-radius: 12px; padding: 18px 20px; margin-bottom: 10px; transition: box-shadow 0.15s; }
    .catalog-entry:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    .catalog-entry-header { display: flex; align-items: center; gap: 12px; }
    .catalog-entry-badge { font-size: 10px; font-weight: 700; letter-spacing: 1px; background: #F0EDE3; color: #6b7280; border-radius: 4px; padding: 2px 7px; text-transform: uppercase; }
    .catalog-entry-badge.active-badge { background: #E2EFEA; color: #0C4A40; }
    .catalog-entry-name { font-size: 14px; font-weight: 700; color: #0a1628; flex: 1; }
    .catalog-entry-gen { font-size: 11px; color: #9ca3af; margin-top: 1px; }
    .catalog-entry-actions { display: flex; gap: 6px; }
    .cat-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid #E4E0D5; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; background: white; color: #374151; transition: all 0.12s; }
    .cat-btn:hover { border-color: #9ca3af; background: #FAF8F2; }
    .cat-btn.danger { color: #dc2626; border-color: #fecaca; }
    .cat-btn.danger:hover { background: #fef2f2; }
    .cat-btn.primary { background: #0B4A42; color: white; border-color: #0B4A42; }
    .cat-btn.primary:hover { background: #0E5A50; }
    .catalog-edit-panel { margin-top: 14px; padding-top: 14px; border-top: 1px solid #F0EDE3; display: flex; flex-direction: column; gap: 14px; }
    .cat-field { display: flex; flex-direction: column; gap: 5px; }
    .cat-field label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #9ca3af; }
    .cat-field input, .cat-field textarea, .cat-field select { padding: 8px 12px; border: 1px solid #E4E0D5; border-radius: 8px; font-size: 13px; font-family: 'Sora',sans-serif; }
    .cat-field textarea { resize: vertical; min-height: 58px; }
    .chip-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .chip { display: flex; align-items: center; gap: 4px; background: #F0EDE3; border: 1px solid #E4E0D5; border-radius: 20px; padding: 3px 10px; font-size: 12px; color: #374151; }
    .chip-del { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 13px; line-height: 1; padding: 0; }
    .chip-del:hover { color: #dc2626; }
    .chip-add-input { padding: 4px 10px; border: 1px dashed #d1d5db; border-radius: 20px; font-size: 12px; font-family: 'Sora',sans-serif; width: 130px; }
    .chip-add-input:focus { outline: none; border-color: #0B4A42; }
    .cat-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .catalog-add-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border: 2px dashed #d1d5db; border-radius: 12px; color: #6b7280; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; background: none; width: 100%; font-family: 'Sora',sans-serif; margin-bottom: 16px; }
    .catalog-add-btn:hover { border-color: #0B4A42; color: #0B4A42; background: #FBF9F3; }
    .cat-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .cat-toggle-track { width: 36px; height: 20px; border-radius: 10px; background: #E4E0D5; position: relative; transition: background 0.15s; }
    .cat-toggle-track.on { background: #1B8A7A; }
    .cat-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: white; transition: left 0.15s; }
    .cat-toggle-track.on .cat-toggle-thumb { left: 18px; }
    .cat-toggle-label { font-size: 13px; color: #374151; }
    .cat-save-row { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
    /* AUDIOLOGY */
    .audig-pta-chips { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
    /* SIDE TABS */
    .side-tabs { display: flex; gap: 0; border-radius: 10px; border: 1px solid #E4E0D5; overflow: hidden; margin-bottom: 20px; background: #FAF8F2; }
    .side-tab { flex: 1; padding: 12px 16px; text-align: center; cursor: pointer; transition: all 0.15s; border: none; font-family: 'Sora',sans-serif; font-size: 13px; font-weight: 600; background: transparent; color: #6b7280; }
    .side-tab:not(:last-child) { border-right: 1px solid #E4E0D5; }
    .side-tab.active { background: #0B4A42; color: white; }
    .side-tab.configured { color: #0F6E56; }
    .side-tab.active.configured { background: #0B4A42; color: #D8A93F; }
    .side-tab-label { font-size: 13px; font-weight: 700; }
    .side-tab-sub { font-size: 10px; opacity: 0.65; margin-top: 2px; font-weight: 400; line-height: 1.3; }
    .side-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
    .side-action-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid #E4E0D5; background: white; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; color: #374151; transition: all 0.15s; }
    .side-action-btn:hover { border-color: #9ca3af; background: #FAF8F2; }
    .side-action-btn.cros { border-color: #a5b4fc; color: #4f46e5; background: #eef2ff; }
    .side-action-btn.cros:hover { background: #e0e7ff; }
    /* TWO-COLUMN DEVICE LAYOUT */
    .device-columns { display: grid; grid-template-columns: 1fr 120px 1fr; gap: 0; margin-bottom: 16px; max-width: 1100px; margin-left: auto; margin-right: auto; }
    .device-col { border: 1px solid #E4E0D5; border-radius: 10px; padding: 16px; background: white; min-width: 0; overflow: visible; transition: border-color 0.15s; }
    .device-col.active { border-color: #1B8A7A; box-shadow: 0 0 0 2px rgba(27,138,122,0.15); }
    .device-col-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #F0EDE3; }
    .device-col-header .ear-label { font-size: 14px; font-weight: 700; color: #0a1628; }
    .device-col-header .ear-status { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
    .device-col-header .ear-status.configured { background: #E2EFEA; color: #0C4A40; }
    .device-col-header .ear-status.empty { background: #F0EDE3; color: #9ca3af; }
    .copy-actions { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 0 10px; }
    .copy-btn { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 8px; border: 1px solid #E4E0D5; background: white; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; color: #374151; transition: all 0.15s; white-space: nowrap; }
    .copy-btn:hover { border-color: #9ca3af; background: #FAF8F2; }
    .copy-btn.cros { border-color: #a5b4fc; color: #4f46e5; background: #eef2ff; font-size: 10px; }
    .copy-btn.cros:hover { background: #e0e7ff; }
    .copy-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    @media (max-width: 860px) {
      .device-columns { grid-template-columns: 1fr; }
      .copy-actions { flex-direction: row; padding: 10px 0; }
    }
    /* INTAKE TOAST */
    .intake-toast { position: fixed; bottom: 28px; right: 28px; z-index: 9000; background: #0B4A42; color: white; border-radius: 14px; padding: 16px 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.28); display: flex; align-items: center; gap: 14px; min-width: 300px; animation: slideUp 0.3s ease; }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .intake-toast-dot { width: 10px; height: 10px; border-radius: 50%; background: #1B8A7A; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(27,138,122,0.25); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100% { box-shadow: 0 0 0 3px rgba(27,138,122,0.25); } 50% { box-shadow: 0 0 0 7px rgba(27,138,122,0.1); } }
    .intake-toast-body { flex: 1; }
    .intake-toast-title { font-size: 13px; font-weight: 700; }
    .intake-toast-sub { font-size: 11px; opacity: 0.55; margin-top: 2px; }
    .intake-toast-btn { background: #1B8A7A; color: #0a1628; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Sora',sans-serif; flex-shrink: 0; }
    .intake-toast-btn:hover { background: #22c55e; }
    .intake-toast-dismiss { background: none; border: none; color: rgba(255,255,255,0.35); font-size: 18px; cursor: pointer; padding: 0 0 0 6px; line-height: 1; }
    .intake-toast-dismiss:hover { color: white; }
    /* INTAKE QUEUE MODAL */
    .intake-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .queue-modal-overlay { position: fixed; inset: 0; z-index: 8000; background: rgba(0,0,0,0.5); display: flex; align-items: flex-start; justify-content: flex-end; padding: 20px; }
    .queue-modal { background: white; border-radius: 16px; width: 480px; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
    .queue-modal-header { padding: 20px 24px 16px; border-bottom: 1px solid #F0EDE3; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; border-radius: 16px 16px 0 0; }
    .queue-modal-title { font-size: 16px; font-weight: 700; color: #0a1628; }
    .queue-modal-close { background: none; border: none; font-size: 22px; color: #9ca3af; cursor: pointer; line-height: 1; }
    .queue-card { margin: 12px 16px; background: #FBF9F3; border: 1px solid #E4E0D5; border-radius: 12px; padding: 16px; }
    .queue-card-name { font-size: 15px; font-weight: 700; color: #0a1628; }
    .queue-card-meta { font-size: 11px; color: #9ca3af; margin-top: 3px; }
    .queue-card-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 10px 0; }
    .queue-card-field { font-size: 12px; color: #374151; }
    .queue-card-field span { color: #9ca3af; display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
    .queue-card-actions { display: flex; gap: 8px; margin-top: 12px; }
    .queue-accept { flex: 1; background: #1B8A7A; color: white; border: none; border-radius: 8px; padding: 9px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Sora',sans-serif; }
    .queue-accept:hover { background: #0F6E56; }
    .queue-dismiss { background: white; border: 1px solid #E4E0D5; color: #9ca3af; border-radius: 8px; padding: 9px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; }
    .queue-dismiss:hover { border-color: #9ca3af; color: #374151; }
  `;


  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "tns"
  // Sycle-style search scope: "local" filters this clinic's loaded list
  // client-side; "global" queries the whole patient database server-side.
  const [searchScope, setSearchScope] = useState("local"); // "local" | "global"
  const [globalResults, setGlobalResults] = useState([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  // Roster column sort — null key keeps the load order (newest patient first).
  const [rosterSort, setRosterSort] = useState({ key: null, dir: "asc" });
  const toggleRosterSort = (key) =>
    setRosterSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  useEffect(() => {
    if (searchScope !== "global") return;
    const term = tableSearch.trim();
    if (term.length < 2) { setGlobalResults([]); setGlobalSearching(false); return; }
    setGlobalSearching(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const rows = await searchPatientsGlobal(term);
      if (cancelled) return;
      setGlobalResults(rows);
      setGlobalSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [tableSearch, searchScope]);

  // "Viewed their quote" hot-lead badge — a TNS patient re-reading their
  // share-link quote is the warmest name on the follow-up list.
  const quoteViewBadge = (patientId) => {
    const s = quoteViewSignals[patientId];
    if (!s?.viewCount) return null;
    return (
      <span
        title={`Patient opened their quote link ${s.viewCount} time${s.viewCount === 1 ? "" : "s"} — last ${fmtDate(s.lastViewedAt)}`}
        style={{ background: "#fce7f3", color: "#be185d", borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
        👀 Viewed quote{s.viewCount > 1 ? ` ×${s.viewCount}` : ""}
      </span>
    );
  };

  const filteredPatients = sortPatients(
    (searchScope === "global"
      ? globalResults // server already matched name/phone across all locations
      : patients.filter(p => patientMatchesSearch(p, tableSearch))
    ).filter(p => {
      if (statusFilter === "active") return p.patientStatus !== "tns" && p.patientStatus !== "tnl";
      if (statusFilter === "tns") return p.patientStatus === "tns";
      if (statusFilter === "tnl") return p.patientStatus === "tnl";
      return true;
    }),
    rosterSort.key, rosterSort.dir);


  // ── ARCHIVE VIEW ──────────────────────────────────────────────────────────
  // Searchable list of archived (inactive) patients for the active clinic, each
  // restorable back into the roster. Archived patients are excluded from the
  // dashboard + global search, so this is the only place they surface.
  const archivedFiltered = (() => {
    if (!archivedSearch.trim()) return archivedPatients;
    return archivedPatients.filter(p => patientMatchesSearch(p, archivedSearch));
  })();

  // Archive view → views/Archive.jsx; Patient Dashboard → views/Dashboard.jsx (backlog #40d).


  // ── WIZARD ────────────────────────────────────────────────────────────────
  const [newApptDate, setNewApptDate] = useState("");
  const [newApptType, setNewApptType] = useState(VISIT_TYPES[0]);
  const addAppt = () => {
    if (!newApptDate) return;
    upd("appointments", [...form.appointments, { date: newApptDate, type: newApptType }]);
    setNewApptDate("");
  };


  // Catalog-driven cascade derived values — computed per side
  const activeCatalog = catalog.filter(e => e.active);
  // TPA exclusivity: a product carrying a tpa (e.g. Relate → 'UHCH') is only
  // visible to patients on that TPA; tpa-less products show for everyone. This
  // keeps Relate UHCH-only and TruHearing's rows (tpa:"TruHearing") out of the
  // cascade for private-pay / UHCH / other-insurance patients. TruHearing-plan
  // patients never reach this cascade — they get the TH card flow
  // (isPrivateLabel), which reads TH_MODELS/TH_AVAILABILITY, not the catalog.
  const visibleCatalog = activeCatalog.filter(e => !e.tpa || e.tpa === form.tpa);
  const getSideDerived = (sd) => {
    // Direct Purchase scopes the standard cascade to Signia only, and hides
    // families that don't offer the tier's locked level (Active IX has no 5/3).
    const scope = directPurchaseActive
      ? visibleCatalog.filter(e => e.manufacturer === "Signia")
      : visibleCatalog;
    const availMfrs = [...new Set(scope.filter(e => !sd.style || e.styles.includes(sd.style)).map(e => e.manufacturer))].sort();
    const availGens = [...new Set(scope.filter(e => e.styles.includes(sd.style) && e.manufacturer === sd.manufacturer).map(e => e.generation))];
    let availFamilies = scope.filter(e => e.styles.includes(sd.style) && e.manufacturer === sd.manufacturer && e.generation === sd.generation);
    if (directPurchaseActive) availFamilies = availFamilies.filter(fam => directPurchaseLockedTech(fam, form.tier) != null);
    const selectedFamily = catalog.find(e => e.id === sd.familyId);
    const availColors = selectedFamily?.colors || [];
    const availBatteries = selectedFamily?.battery || [];
    const availPowers = sd.manufacturer ? (RECEIVER_POWERS[sd.manufacturer] || []) : [];
    const availDomes  = sd.manufacturer ? getDomeOptions(sd.manufacturer, sd.generation) : [];
    const selectedPower = availPowers.find(p => p.id === sd.receiverPower);
    const requiresEarmold = selectedPower?.earmold === true;
    const variantRequired = (selectedFamily?.variants?.length || 0) > 1;
    const hasCROSVariant = selectedFamily?.variants?.some(v => v.toLowerCase().includes("cros")) || false;

    // ── TruHearing cascade derived values ──
    const tierLabels = privateLabelTiers.map(t => t.label);

    // Body-style categories available for the selected tech tier (tier-only scope).
    // A category is shown if at least one (model × specific style) in TH_AVAILABILITY maps to it.
    const thAvailBodyStyles = sd.techLevel
      ? TH_BODY_STYLES.filter(b =>
          TH_MODELS.some(m =>
            (TH_AVAILABILITY[`${m.id}|${sd.techLevel}`] || []).some(sid => TH_STYLE_TO_BODY[sid] === b.id)
          )
        )
      : [];

    // Models available for selected tier + body-style category
    const thAvailModels = sd.techLevel && sd.thBodyStyle
      ? TH_MODELS.filter(m =>
          (TH_AVAILABILITY[`${m.id}|${sd.techLevel}`] || []).some(sid => TH_STYLE_TO_BODY[sid] === sd.thBodyStyle)
        )
      : [];

    // Specific TH style variants available for the selected model+tier+body-style
    const thAvailVariants = sd.thModel && sd.techLevel && sd.thBodyStyle
      ? (TH_AVAILABILITY[`${sd.thModel}|${sd.techLevel}`] || [])
          .filter(sid => TH_STYLE_TO_BODY[sid] === sd.thBodyStyle)
          .map(sid => TH_STYLES.find(s => s.id === sid)).filter(Boolean)
      : [];

    // Gain/Matrix for selected model+style
    const thGainOptions = sd.thModel && sd.style
      ? (TH_GAIN_MATRIX[`${sd.thModel}|${sd.style}`] || [])
      : [];

    // Color category
    const thColorCategory = TH_STYLE_COLOR_CATEGORY[sd.style] || null;

    // Battery (auto)
    const thBattery = sd.thModel && sd.style
      ? (TH_BATTERY[`${sd.thModel}|${sd.style}`] || "")
      : "";

    // Is rechargeable?
    const thIsLi = TH_MODELS.find(m => m.id === sd.thModel)?.li || false;

    // Earmold required from gain/matrix selection
    const thSelectedGain = thGainOptions.find(g => g.id === sd.gainMatrix);
    const thRequiresEarmold = thSelectedGain?.earmold === true;

    // Has receiver (RIC/RIC+BCT/SR)
    const thHasReceiver = TH_RECEIVER_STYLES.includes(sd.style);

    // Can this side anchor a CROS fitting? (RIC-form TH aids only — drives
    // the "copy as CROS transmitter" button in the TH card flow.)
    const thHasCROS = TH_CROS_STYLES.includes(sd.style);

    // Pricing
    const thTierPrice = privateLabelTiers.find(t => t.label === sd.techLevel)?.price ?? 0;
    return { availMfrs, availGens, availFamilies, selectedFamily, availColors, availBatteries,
      availPowers, availDomes, selectedPower, requiresEarmold, variantRequired, hasCROSVariant,
      thAvailBodyStyles, thAvailModels, thAvailVariants, thGainOptions, thColorCategory, thBattery, thIsLi,
      thRequiresEarmold, thHasReceiver, thHasCROS, thTierPrice };
  };
  const leftDerived = getSideDerived(form.left);
  const rightDerived = getSideDerived(form.right);

  // ── Pricing Reveal — compute from form state + retail anchors ──
  // TIER_TO_ANCHOR maps universal tier vocabulary (Premium/Advanced/Standard/
  // Level 2/Level 1) plus TruHearing's legacy label set to the canonical
  // anchor slug. Private-pay sources its tier cards directly from the
  // standard-class anchors (labels already match the universal vocabulary)
  // so the map is only strictly needed for insurance flows where plan tier
  // labels can drift (e.g. "Level 7" = Premium-equivalent).
  const TIER_TO_ANCHOR = { "Premium":"select","Level 7":"select","Advanced":"advanced","Level 5":"advanced","Standard":"standard","Level 3":"standard","Level 2":"level2","Level 1":"level1" };

  // Per-ear price resolution. Memoized so device-screen renders don't redo
  // the lookups on every keystroke elsewhere in the form.
  const earPriceOpts = useMemo(
    () => ({ form, catalog, productCatalogTiers, anchorsByClass: retailAnchorsByClass, plans: activePlans }),
    [form, catalog, productCatalogTiers, retailAnchorsByClass, activePlans]
  );
  const leftEarPrice  = useMemo(() => deriveEarPrice(form.left,  earPriceOpts), [form.left,  earPriceOpts]);
  const rightEarPrice = useMemo(() => deriveEarPrice(form.right, earPriceOpts), [form.right, earPriceOpts]);

  // Detect mismatched manufacturers across configured ears so the UI can
  // warn before quote generation. Both ears must have a familyId resolvable
  // to a manufacturer; CROS-side ears are excluded since CROS variants
  // legitimately ride alongside a non-CROS aid of any brand.
  const manufacturerMismatch = useMemo(() => {
    const l = catalog.find(e => e.id === form.left.familyId);
    const r = catalog.find(e => e.id === form.right.familyId);
    if (!l || !r) return false;
    if (isSideCros(form.left) || isSideCros(form.right)) return false;
    return l.manufacturer !== r.manufacturer;
  }, [form.left, form.right, catalog]);

  // Auto-recompute form.tierPrice when the patient picks a device on step 6.
  // Only fires in private-pay mode — insurance copays are fixed by the
  // carrier, manufacturer doesn't change the patient's out-of-pocket. Picks
  // the higher of the two real-aid ears (matched bilateral case: both equal
  // so it doesn't matter; CROS case: the non-CROS ear drives the per-aid
  // baseline; mismatched manufacturer case: the higher one wins and the
  // banner cautions the user). Skips when neither ear has resolved enough
  // to derive a price — preserves the step-4 baseline.
  useEffect(() => {
    const isDeviceDriven = form.payType === 'insurance' && (form.tpa === 'UHCH' || form.tpa === 'Nations');
    if (form.payType !== 'private' && !isDeviceDriven) return;
    if (isDeviceDriven) {
      // Device-driven TPA (UHCH / Nations): the chosen device sets both the
      // per-aid price and the tier label (UHCH: Premium/Standard/Gold/Platinum;
      // Nations: Standard…Specialty; either → "Off-Plan"). The higher-priced ear
      // drives a mismatched fitting (mirrors pickBaselinePerAid).
      const ears = [leftEarPrice, rightEarPrice].filter(e => e && e.source !== 'cros');
      const driver = ears.reduce((a, b) => (b.price != null && b.price > (a?.price ?? -Infinity) ? b : a), null);
      if (!driver) return;
      const nextTier = driver.offPlan ? 'Off-Plan' : (driver.tier || form.tier);
      if (form.tierPrice === driver.price && form.tier === nextTier) return;
      setForm(f => ({ ...f, tierPrice: driver.price, tier: nextTier }));
      return;
    }
    const baseline = pickBaselinePerAid(leftEarPrice, rightEarPrice);
    if (baseline == null) return;
    if (form.tierPrice === baseline) return;
    setForm(f => ({ ...f, tierPrice: baseline }));
  }, [leftEarPrice, rightEarPrice, form.payType, form.tpa, form.tier, form.tierPrice]);

  // A device or tier change invalidates any manual Price Adjustment (§6) — clear
  // the override so an adjusted price never silently rides onto a different
  // device. Effective price then falls back to the catalog-maintained tierPrice.
  useEffect(() => {
    setForm(f => f.priceOverridePerAid == null ? f : { ...f, priceOverridePerAid: null });
  }, [form.left.familyId, form.left.techLevel, form.left.thModel, form.right.familyId, form.right.techLevel, form.right.thModel, form.tier]);

  // Direct Purchase: the TruHearing tier locks the Signia tech level. If the
  // tier changes after a device is picked, re-lock each side (or clear a family
  // that no longer offers that level) so the device and the tier price can't
  // drift apart. Keyed on form.tier only — never on the sides — so it can't loop.
  useEffect(() => {
    if (!directPurchaseActive) return;
    setForm(f => {
      let changed = false;
      const relock = (sd) => {
        if (!sd.familyId) return sd;
        const fam = catalog.find(e => e.id === sd.familyId);
        const locked = directPurchaseLockedTech(fam, f.tier);
        if (locked == null) { changed = true; return { ...sd, familyId:"", variant:"", techLevel:"", color:"", battery:"" }; }
        if (sd.techLevel !== locked) { changed = true; return { ...sd, techLevel: locked }; }
        return sd;
      };
      const left = relock(f.left), right = relock(f.right);
      return changed ? { ...f, left, right } : f;
    });
  }, [directPurchaseActive, form.tier, catalog]);

  // Tier-first (private pay): if the tier changes after a device is picked
  // (back-nav to the Technology Tier step), re-match each configured side's
  // tech level to the new tier so the settled price and the device can't
  // drift apart. Softer than the Direct Purchase relock — a family with no
  // level seeded at the new tier's rank keeps its current level (the per-ear
  // recompute keeps the dollars honest either way). Keyed on form.tier only,
  // never the sides, so a manual level override sticks and nothing loops.
  useEffect(() => {
    if (form.payType !== "private" || !form.tier) return;
    setForm(f => {
      let changed = false;
      const rematch = (sd) => {
        if (!sd.familyId || sd.isCROS) return sd;
        const fam = catalog.find(e => e.id === sd.familyId);
        const matched = tierMatchedTech(fam, f.tier, productCatalogTiers);
        if (matched && sd.techLevel !== matched) { changed = true; return { ...sd, techLevel: matched }; }
        return sd;
      };
      const left = rematch(f.left), right = rematch(f.right);
      return changed ? { ...f, left, right } : f;
    });
  }, [form.payType, form.tier, catalog, productCatalogTiers]);

  // Complex commercial/PPO benefit (coinsurance / deductible / OOP) — an
  // alternative pricing method for non-device-driven insurance patients whose
  // VOB the provider entered. Seeded from the loaded patient's coverage.
  const [cbOpen, setCbOpen] = useState(false);
  const [cbInputs, setCbInputs] = useState(null);
  useEffect(() => {
    const stored = selectedPatient?.insurance?.complexBenefit || null;
    setCbInputs(stored);
    setCbOpen(!!stored);
  }, [selectedPatient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pricingRevealData = useMemo(() => {
    if (form.tierPrice == null || !form.tier) return null;
    // Private-pay uses standard-class anchors (manufacturer-agnostic baseline).
    // Tier was picked straight from this list, so match by label directly —
    // skips the TIER_TO_ANCHOR indirection that was tripping over signia's
    // numeric labels.
    const isPrivatePay = form.payType === "private";
    const anchorSet = isPrivatePay ? retailAnchorsStandard : retailAnchors;
    const anchor = isPrivatePay
      ? anchorSet.find(a => a.label === form.tier)
      : anchorSet.find(a => a.id === TIER_TO_ANCHOR[form.tier]);
    if (!anchor) {
      // On-plan device-driven managed care (Nations; UHCH non-Relate): the
      // billing tier (e.g. Nations "Specialty") has no tier→anchor mapping,
      // but the chosen device DOES have a clinic retail anchor. Resolve it per
      // ear so the patient sees honest savings vs. OUR retail for that exact
      // device (their copay is a real discount off private retail). Off-plan
      // (tier === "Off-Plan") and Relate (→ 'standard' fallback, no real street
      // retail) don't qualify → fall through to the bare device-driven card.
      const isDeviceDrivenOnPlan =
        form.payType === "insurance" &&
        (form.tpa === "UHCH" || form.tpa === "Nations") &&
        form.tier && form.tier !== "Off-Plan";
      if (!isDeviceDrivenOnPlan) return null;
      const lr = resolveClassRetailPerAid(form.left, earPriceOpts);
      const rr = resolveClassRetailPerAid(form.right, earPriceOpts);
      // Every CONFIGURED ear must resolve to an honest per-brand retail. A side
      // with a device but no real anchor (Relate, or a CROS unit) keeps the
      // reveal bare rather than fabricating a comparison.
      const leftOk = !form.left.familyId || (lr && lr.realRetail);
      const rightOk = !form.right.familyId || (rr && rr.realRetail);
      const anyReal = (lr && lr.realRetail) || (rr && rr.realRetail);
      if (!anyReal || !leftOk || !rightOk) return null;
      const dOvr = form.priceOverridePerAid;
      const dApplyOvr = (ep) => (dOvr != null && ep && ep.source !== "cros") ? { ...ep, price: dOvr } : ep;
      const copay = dOvr ?? form.tierPrice;
      const lRetail = lr ? lr.price : null;
      const rRetail = rr ? rr.price : null;
      const retailPair = (lRetail != null || rRetail != null) ? (lRetail || 0) + (rRetail || 0) : null;
      const retailDrv = Math.max(lRetail ?? 0, rRetail ?? 0) || null; // per-aid headline uses the higher ear
      const savingsDrv = retailDrv != null ? retailDrv - copay : null;
      const dLeftEP = dApplyOvr(leftEarPrice);
      const dRightEP = dApplyOvr(rightEarPrice);
      const dlp = dLeftEP?.price ?? null;
      const drp = dRightEP?.price ?? null;
      const dPairTotal = (dlp != null || drp != null) ? (dlp || 0) + (drp || 0) : null;
      return {
        tierLabel: (lr || rr)?.anchorLabel || form.tier,
        retailPerAid: retailDrv,
        copayPerAid: copay,
        savingsPerAid: savingsDrv,
        savingsPct: retailDrv ? Math.round((savingsDrv / retailDrv) * 100) : 0,
        perEar: { left: dLeftEP, right: dRightEP, pairTotal: dPairTotal },
        // Per-ear retail so the reveal totals stay honest for mismatched-brand
        // device-driven fittings (present only on this branch).
        retailPerEar: { left: lRetail, right: rRetail, pairTotal: retailPair },
      };
    }
    const retailPerAid = parseFloat(anchor.price_per_aid);
    // A confirmed Price Adjustment (§6) overrides the per-aid copay for the rest
    // of the session. Applies to real-aid ears; a CROS transmitter side keeps
    // its fixed unit price so its per-ear line stays accurate.
    const ovr = form.priceOverridePerAid;
    const copayPerAid = ovr ?? form.tierPrice;
    const savingsPerAid = retailPerAid - copayPerAid;
    const savingsPct = Math.round((savingsPerAid / retailPerAid) * 100);
    // Per-ear breakdown for the UI to show when ears differ (CROS fittings,
    // mfr mismatch, or unilateral configs). Pair total is the truth for
    // quote/PA when at least one ear resolves.
    const applyOvr = (ep) => (ovr != null && ep && ep.source !== 'cros') ? { ...ep, price: ovr } : ep;
    const leftEP = applyOvr(leftEarPrice);
    const rightEP = applyOvr(rightEarPrice);
    const lp = leftEP?.price ?? null;
    const rp = rightEP?.price ?? null;
    const pairTotal = (lp != null || rp != null)
      ? (lp || 0) + (rp || 0)
      : null;
    return {
      tierLabel: anchor.label,
      retailPerAid,
      copayPerAid,
      savingsPerAid,
      savingsPct,
      perEar: { left: leftEP, right: rightEP, pairTotal },
    };
  }, [form.tier, form.tierPrice, form.priceOverridePerAid, form.payType, form.tpa, earPriceOpts, retailAnchors, retailAnchorsStandard, leftEarPrice, rightEarPrice]);

  // Catalog-hole fix: the provider verified a managed-care copay by phone for a
  // covered-but-unmapped tier. Record it for admin reconcile (needs a saved
  // patient), then patch the in-memory plan so the reveal re-prices immediately
  // — the recompute effect picks up the filled tier and sets form.tierPrice, and
  // the normal wizard save persists it onto this patient's coverage row.
  async function handleVerifyRate(tierLabel, dollars) {
    const cents = Math.round(dollars * 100);
    if (wizardPatientId) {
      await recordRateVerification({
        patientId: wizardPatientId,
        tpa: form.tpa || null,
        carrier: form.carrier,
        planGroup: form.planGroup,
        tierLabel,
        copayPerAid: cents,
      });
    }
    setInsurancePlans(prev => prev.map(p => {
      if (!(p.tpa === form.tpa && p.carrier === form.carrier && p.planGroup === form.planGroup)) return p;
      const tiers = p.tiers || [];
      const idx = tiers.findIndex(t => t.label === tierLabel);
      const nextTiers = idx >= 0
        ? tiers.map((t, i) => i === idx ? { ...t, price: dollars } : t)
        : [...tiers, { label: tierLabel, price: dollars }];
      return { ...p, tiers: nextTiers };
    }));
  }

  // Complex-benefit eligibility: an insurance patient NOT on a device-driven TPA
  // (UHCH-MedSupp / Nations) and not a TruHearing private-label / direct purchase.
  const complexEligible = form.payType === "insurance"
    && form.tpa !== "UHCH" && form.tpa !== "Nations"
    && !isPrivateLabel && !form.directPurchase;
  // Per-aid clinic retail for the configured device — the amount billed to the
  // plan, and the calculator's baseline. Higher ear drives a mismatched pair.
  const complexBaselinePerAid = (() => {
    const l = resolveClassRetailPerAid(form.left, earPriceOpts);
    const r = resolveClassRetailPerAid(form.right, earPriceOpts);
    return Math.max(l?.price ?? 0, r?.price ?? 0) || null;
  })();
  async function handleSaveComplexBenefit(inputs, computedPerAid) {
    setCbInputs(inputs);
    // In-session price so quote / PA / save use the computed patient cost.
    setForm(f => ({ ...f, tierPrice: computedPerAid }));
    // Persist the raw VOB when the patient already has a coverage row (returning
    // insured patient). A brand-new draft prices in-session; the VOB persists on
    // the next coverage save. Never INSERTs here (avoids duplicate coverage rows).
    const coverageId = selectedPatient?._ids?.coverageId || null;
    if (wizardPatientId && coverageId) {
      await updateInsuranceCoverage(wizardPatientId, { complex_benefit: inputs }, coverageId);
    }
  }

  // Device family lookups
  const leftFamily = catalog.find(e => e.id === form.left.familyId);
  const rightFamily = catalog.find(e => e.id === form.right.familyId);

  // Keep sd / otherSide for backward compat with non-step-3 code
  const sd = form[activeSide];
  const otherSide = activeSide === "left" ? "right" : "left";


  const isSideConfigured = (s) => {
    const d = form[s];
    if (d.manufacturer === "TruHearing") {
      // A CROS transmitter side has no receiver — no gain/matrix to pick.
      if (d.isCROS) return !!(d.style && d.techLevel && d.thModel);
      return !!(d.style && d.techLevel && d.thModel && d.gainMatrix);
    }
    return !!(d.familyId && d.techLevel);
  };


  const canProceed = [
    form.firstName && form.lastName && form.dob && form.phone,
    true, // Health History — review-only, always proceedable
    true, // Testing — always skippable
    true, // Results — always skippable
    // Care Plan — leads the treatment conversation; required unless private
    // pay (Complete Care+ is bundled and the step is hidden).
    form.payType === "private" || !!form.carePlan,
    // Technology Tier — required for plans where it applies (private-label
    // TruHearing or private-pay). Other insurance flows skip the choice.
    (isPrivateLabel || form.payType === "private") ? !!form.tier : true,
    (isSideConfigured("left") || isSideConfigured("right")),
    true, // Review — always valid
  ][step];


  // ── Shared Results / Consultation content ────────────────────────────────
  // Used by both wizard Step 2 and Consultation Mode. Accepts audiology data
  // and chief complaint text; renders audiogram + speech banana + phoneme
  // dimming + drawing overlay + hearing sim paragraph + severity/CCT/WRS +
  // dynamic counseling copy. When intake answers are provided (wizard only —
  // Consultation Mode doesn't load the intake), the endorsed hearing
  // complaints re-surface as a carry-forward card, each mapped to the
  // audiometric finding that explains it.
  // Results content (audiogram presentation + counseling) → components/ResultsContent.jsx (backlog #40b).


  // Wizard 8-step renderer → views/WizardSteps.jsx (backlog #40c).


  // Load punch data when patient changes
  useEffect(() => {
    if (selectedPatient?.id) {
      loadPunch(selectedPatient.id).then(setPunchData);
      setPunchConfirm(null);
      setPunchSuccess(null);
    }
  }, [selectedPatient?.id]);


  const handlePunch = async (type) => {
    const key = type === "cleaning" ? "cleanings" : "appointments";
    const limit = type === "cleaning" ? 12 : 16;
    if (punchData[key] >= limit) return;
    const entry = { type, date: new Date().toISOString(), by: location };
    const next = { ...punchData, [key]: punchData[key] + 1, log: [...(punchData.log||[]), entry] };
    await savePunch(selectedPatient.id, next);
    setPunchData(next);
    setPunchConfirm(null);
    setPunchSuccess(type);
    setTimeout(() => setPunchSuccess(null), 2500);
  };


  const handleUndoPunch = async (type) => {
    const key = type === "cleaning" ? "cleanings" : "appointments";
    if (punchData[key] <= 0) return;
    const log = [...(punchData.log||[])];
    // Remove last entry of this type
    const lastIdx = log.map(e=>e.type).lastIndexOf(type);
    if (lastIdx > -1) log.splice(lastIdx, 1);
    const next = { ...punchData, [key]: punchData[key] - 1, log };
    await savePunch(selectedPatient.id, next);
    setPunchData(next);
  };


  // ── SETTINGS ──────────────────────────────────────────────────────────────
  // ACCENT_COLORS + MANUFACTURER_CLASSES → views/ClinicSettings.jsx (backlog #40e).

  const handleClinicSave = async () => {
    setClinic(clinicDraft);
    try { await saveClinicSettings(clinicId, clinicDraft); } catch {}
    setClinicSaved(true);
    setTimeout(() => setClinicSaved(false), 3000);
  };

  const handleSaveAnchors = async () => {
    if (!clinicId) return;
    const result = await saveRetailAnchors(clinicId, anchorsClass, anchorsDraft);
    if (!result?.success) {
      alert("Couldn't save anchors: " + (result?.error?.message || "unknown error — check console"));
      return;
    }
    // Reload to pick up server-normalized values (ids, sort order, etc.)
    const fresh = await loadRetailAnchors(clinicId, anchorsClass);
    setAnchorsDraft((fresh || []).map(r => ({...r})));
    // Refresh the global retailAnchors state if we just edited the class it holds
    // so the pricing reveal sees fresh values without a reload. Bootstrap loads
    // both signia (insurance default) and standard (private-pay baseline).
    if (anchorsClass === "signia") setRetailAnchors(fresh || []);
    if (anchorsClass === "standard") setRetailAnchorsStandard(fresh || []);
    // Keep the byClass map (used by deriveEarPrice) in sync so a clinic
    // editing prices in Settings sees their change reflected on the
    // device-selection screen without a full reload.
    setRetailAnchorsByClass(prev => ({ ...prev, [anchorsClass]: fresh || [] }));
    setAnchorsSaved(true);
    setTimeout(() => setAnchorsSaved(false), 2500);
  };

  const handleDeletePatient = async () => {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deletePatientProfile(deleteTarget.id);
      if (selectedPatient?.id === deleteTarget.id) setSelectedPatient(null);
      setDeleteDone(`${deleteTarget.name}'s profile and all linked records were permanently deleted.`);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      setDeleteSearch("");
      await refreshPatients();
    } catch (e) {
      setDeleteError(e?.message || "Delete failed — check your connection or admin permissions.");
    } finally {
      setDeleteBusy(false);
    }
  };


  // Clinic Settings view → views/ClinicSettings.jsx (backlog #40e).


  // PatientCampaignCard + Patient Detail view → views/PatientDetail.jsx (backlog #40d).


  // ── PRODUCT CATALOG ───────────────────────────────────────────────────────
  const [catMfrFilter, setCatMfrFilter] = useState("All");


  // Chip editor, tier pricing, and catalog handlers → views/CatalogAdmin.jsx (backlog #40e).

  // Product Catalog admin editor → views/CatalogAdmin.jsx; admin-denied fallback → views/AdminDenied.jsx (backlog #40e).


  // Insurance Plans admin editor → views/InsurancePlansAdmin.jsx (backlog #40e).


  // Rebates admin editor → views/RebatesAdmin.jsx (backlog #40e).

  // Rate Verifications admin queue → views/RateVerificationsAdmin.jsx (backlog #40e).


  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>

      {/* ── Closer dispensing-location picker (PR C) ── */}
      {showCloserPicker && (
        <CloserLocationPicker
          onClose={() => setShowCloserPicker(false)}
          onSelect={(c, p) => { setCloserClinic(c); setCloserProvider(p); setShowCloserPicker(false); }}
        />
      )}

      {/* ── Price Adjustment Authorization (spec §6) ── */}
      {showAdjustModal && (
        <AdjustPriceModal
          currentPrice={form.priceOverridePerAid ?? form.tierPrice ?? 0}
          priceUnit="per aid"
          onCancel={() => setShowAdjustModal(false)}
          onConfirm={handleConfirmAdjust}
        />
      )}

      {/* ── Intake toast notification ── */}
      {intakeToast && (
        <div className="intake-toast">
          <div className="intake-toast-dot" />
          <div className="intake-toast-body">
            <div className="intake-toast-title">New intake — {intakeToast.name}</div>
            <div className="intake-toast-sub">Completed kiosk check-in · waiting in queue</div>
          </div>
          <button className="intake-toast-btn" onClick={() => { setShowIntakeQueue(true); setIntakeToast(null); }}>
            View
          </button>
          <button className="intake-toast-dismiss" onClick={() => setIntakeToast(null)}>×</button>
        </div>
      )}

      {/* ── Take-home quote link toast (wizard Generate Quote) ── */}
      {quoteShareUrl && (
        <div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"#0C211E",color:"white",padding:"14px 18px",borderRadius:12,boxShadow:"0 12px 32px rgba(0,0,0,0.35)",fontFamily:"'Sora',sans-serif",display:"flex",alignItems:"center",gap:14,maxWidth:"min(560px, calc(100vw - 32px))"}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Take-home quote link ready</div>
            <div style={{fontSize:11.5,color:"#9AA39B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              Text or email it to the patient — expires in {QUOTE_SHARE_VALID_DAYS} days · {quoteShareUrl}
            </div>
          </div>
          <button
            onClick={() => { try { navigator.clipboard?.writeText(quoteShareUrl); setQuoteShareCopied(true); setTimeout(() => setQuoteShareCopied(false), 2000); } catch {} }}
            style={{background: quoteShareCopied ? "#15803d" : "#1B8A7A",color:"white",border:"none",borderRadius:8,padding:"8px 14px",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
            {quoteShareCopied ? "Copied ✓" : "Copy link"}
          </button>
          <button
            onClick={() => setQuoteShareUrl(null)}
            aria-label="Dismiss"
            style={{background:"none",border:"none",color:"#9AA39B",fontSize:18,cursor:"pointer",padding:2,lineHeight:1,flexShrink:0}}>×</button>
        </div>
      )}

      {/* ── Intake queue modal ── */}
      {checkinSession && (
        <div className="queue-modal-overlay" onClick={() => setCheckinSession(null)}>
          <div className="queue-modal" onClick={e => e.stopPropagation()} style={{maxWidth:440,textAlign:"center"}}>
            <div style={{padding:"28px 28px 24px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>Kiosk Upgrade Check-In</div>
              <h2 style={{margin:"0 0 4px",fontFamily:"'Sora',sans-serif",fontSize:20,color:"#111"}}>{checkinSession.patientName}</h2>
              <p style={{margin:"0 0 18px",color:"#6b7280",fontSize:13,lineHeight:1.5}}>
                On the kiosk, the patient taps <strong>Returning patient</strong>, then enters this code to review last year's answers.
              </p>
              <div style={{fontFamily:"'Sora',monospace",fontSize:38,fontWeight:800,letterSpacing:6,color:"#0f766e",background:"#f0fdfa",border:"2px solid #5eead4",borderRadius:12,padding:"16px 12px",marginBottom:14}}>
                {checkinSession.code}
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:6}}>
                <button
                  onClick={() => { try { navigator.clipboard?.writeText(checkinSession.code); } catch {} }}
                  style={{background:"white",color:"#0f766e",border:"1px solid #0f766e",borderRadius:8,padding:"8px 18px",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                  Copy code
                </button>
                <button
                  onClick={() => setCheckinSession(null)}
                  style={{background:"#0f766e",color:"white",border:"none",borderRadius:8,padding:"8px 18px",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                  Done
                </button>
              </div>
              <p style={{margin:"10px 0 0",color:"#9ca3af",fontSize:11}}>
                Expires in 30 minutes · one-time use
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Start a New Visit — visit-type chooser ─────────────────────── */}
      {visitTypePicker && (
        <div className="queue-modal-overlay" onClick={() => setVisitTypePicker(null)}>
          <div className="queue-modal" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
            <div style={{padding:"28px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>Start a New Visit</div>
              <h2 style={{margin:"0 0 4px",fontFamily:"'Sora',sans-serif",fontSize:20,color:"#111"}}>{visitTypePicker.name}</h2>
              <p style={{margin:"0 0 18px",color:"#6b7280",fontSize:13,lineHeight:1.5}}>What kind of visit is this?</p>
              <button
                onClick={() => { const p = visitTypePicker; setVisitTypePicker(null); startNewVisitForPatient(p); }}
                style={{display:"block",width:"100%",textAlign:"left",background:"#f0fdfa",border:"2px solid #5eead4",borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
                <div style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,color:"#0f766e"}}>Returning Patient Visit</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:2,lineHeight:1.5}}>
                  Annual check, follow-up, or upgrade conversation — the quick-confirm flow for an established patient.
                </div>
              </button>
              <button
                onClick={() => startNewAppointmentForPatient(visitTypePicker)}
                style={{display:"block",width:"100%",textAlign:"left",background:"#eff6ff",border:"2px solid #93c5fd",borderRadius:12,padding:"14px 16px",marginBottom:14,cursor:"pointer"}}>
                <div style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,color:"#1d4ed8"}}>New Patient Appointment</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:2,lineHeight:1.5}}>
                  The full appointment from the top — health history, testing, device selection, care plan — on this
                  patient's existing chart. Use when the first appointment never finished or needs a restart.
                </div>
              </button>
              <div style={{textAlign:"center"}}>
                <button onClick={() => setVisitTypePicker(null)}
                  style={{background:"none",border:"none",color:"#9ca3af",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Consultation Mode chooser — counseling vs. device selection ── */}
      {showConsultPicker && selectedPatient && (
        <div className="queue-modal-overlay" onClick={() => setShowConsultPicker(false)}>
          <div className="queue-modal" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
            <div style={{padding:"28px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>Consultation Mode</div>
              <h2 style={{margin:"0 0 4px",fontFamily:"'Sora',sans-serif",fontSize:20,color:"#111"}}>{selectedPatient.name}</h2>
              <p style={{margin:"0 0 18px",color:"#6b7280",fontSize:13,lineHeight:1.5}}>What are we sitting down for?</p>
              <button
                onClick={startAudiogramCounseling}
                style={{display:"block",width:"100%",textAlign:"left",background:"#f0fdfa",border:"2px solid #5eead4",borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
                <div style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,color:"#0f766e"}}>Audiogram Counseling</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:2,lineHeight:1.5}}>
                  Walk through the hearing test results — familiar sounds, speech banana, word scores.
                </div>
              </button>
              <button
                onClick={() => requireCurrentHearingTest("devices")}
                style={{display:"block",width:"100%",textAlign:"left",background:"#eff6ff",border:"2px solid #93c5fd",borderRadius:12,padding:"14px 16px",marginBottom:14,cursor:"pointer"}}>
                <div style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,color:"#1d4ed8"}}>Device Selection & Pricing</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:2,lineHeight:1.5}}>
                  Pick devices together — filtered by their insurance plan, or standard private-pay
                  pricing — then sign a purchase agreement.
                </div>
              </button>
              <div style={{textAlign:"center"}}>
                <button onClick={() => setShowConsultPicker(false)}
                  style={{background:"none",border:"none",color:"#9ca3af",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Hearing-test recency warning — 6-month rule before device selection ── */}
      {testRecencyWarn && (
        <div className="queue-modal-overlay" onClick={() => setTestRecencyWarn(null)}>
          <div className="queue-modal" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
            <div style={{padding:"28px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#b45309",textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>⚠️ Verify current hearing test</div>
              <h2 style={{margin:"0 0 10px",fontFamily:"'Sora',sans-serif",fontSize:19,color:"#111"}}>
                {testRecencyWarn.lastTestDate
                  ? `Last hearing test: ${fmtDate(testRecencyWarn.lastTestDate)}`
                  : "No dated hearing test is on this chart"}
              </h2>
              <p style={{margin:"0 0 18px",color:"#6b7280",fontSize:13,lineHeight:1.6}}>
                {testRecencyWarn.lastTestDate
                  ? "That was more than 6 months ago. "
                  : ""}
                Device selection and pricing must be based on a hearing test from the
                last 6 months. If a current test is on file elsewhere (paper chart,
                tested at another office), verify it and continue — otherwise run a
                new test first.
              </p>
              <button
                onClick={() => proceedAfterTestGate(testRecencyWarn.action)}
                style={{display:"block",width:"100%",textAlign:"left",background:"#fffbeb",border:"2px solid #fcd34d",borderRadius:12,padding:"14px 16px",marginBottom:14,cursor:"pointer"}}>
                <div style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,color:"#b45309"}}>Hearing test verified — continue</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:2,lineHeight:1.5}}>
                  A test from the last 6 months exists outside this chart. Proceed to device selection.
                </div>
              </button>
              <div style={{textAlign:"center"}}>
                <button onClick={() => setTestRecencyWarn(null)}
                  style={{background:"none",border:"none",color:"#9ca3af",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIntakeQueue && (
        <div className="queue-modal-overlay" onClick={() => setShowIntakeQueue(false)}>
          <div className="queue-modal" onClick={e => e.stopPropagation()}>
            <div className="queue-modal-header">
              <div className="queue-modal-title">
                Intake Queue
                {pendingIntakes.length > 0 && (
                  <span style={{marginLeft:8,background:"#ef4444",color:"white",borderRadius:20,
                    padding:"2px 8px",fontSize:11,fontWeight:700}}>
                    {pendingIntakes.length}
                  </span>
                )}
              </div>
              <button className="queue-modal-close" onClick={() => setShowIntakeQueue(false)}>×</button>
            </div>
            {pendingIntakes.length === 0 ? (
              <div style={{padding:"40px 24px",textAlign:"center",color:"#9ca3af"}}>
                <div style={{fontSize:32,marginBottom:12}}>✓</div>
                <div style={{fontSize:14,fontWeight:600,color:"#374151"}}>Queue is clear</div>
                <div style={{fontSize:12,marginTop:4}}>No pending intakes right now</div>
              </div>
            ) : (
              pendingIntakes.map(intake => {
                const a = unwrapIntakeAnswers(intake.answers) || {};
                const phone = a.mobilePhone || a.homePhone || a.workPhone || a.phone || "";
                const reason = a.visitReason || a.chiefComplaint;
                const submitted = intake._meta?.submittedAt
                  ? new Date(intake._meta.submittedAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})
                  : "—";
                // Annual/upgrade check-ins link to an existing chart (matcher
                // below) instead of creating a new patient draft.
                const isUpgrade = intake.answers?._meta?.intakeType === "upgrade";
                const matchingThis = matchIntake?._meta?.intakeId === intake._meta?.intakeId;
                return (
                  <div className="queue-card" key={intake._meta?.intakeId}>
                    <div className="queue-card-name">
                      {[a.firstName, a.lastName].filter(Boolean).join(" ") || "Unknown"}
                      {isUpgrade && (
                        <span style={{marginLeft:8,background:"#0f766e",color:"white",borderRadius:20,
                          padding:"2px 9px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,verticalAlign:"middle"}}>
                          Annual / Upgrade
                        </span>
                      )}
                      {intake._meta?.lang === "es" && (
                        <span style={{marginLeft:8,background:"#b45309",color:"white",borderRadius:20,
                          padding:"2px 9px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,verticalAlign:"middle"}}
                          title="Intake completed in Spanish">
                          ES
                        </span>
                      )}
                    </div>
                    <div className="queue-card-meta">Submitted {submitted}</div>
                    <div className="queue-card-fields">
                      <div className="queue-card-field"><span>DOB</span>{a.dob || "—"}</div>
                      <div className="queue-card-field"><span>Phone</span>{phone || "—"}</div>
                      <div className="queue-card-field"><span>Coverage</span>{a.payType ? (a.payType === "insurance" ? (a.carrier || "Insurance") : "Private Pay") : "—"}</div>
                      <div className="queue-card-field"><span>Email</span>{a.email || "—"}</div>
                    </div>
                    {reason && (
                      <div style={{fontSize:12,color:"#374151",background:"white",borderRadius:8,
                        padding:"8px 10px",border:"1px solid #F0EDE3",marginBottom:8}}>
                        <span style={{fontSize:10,fontWeight:700,color:"#9ca3af",display:"block",
                          textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>Reason for Visit</span>
                        {reason}
                      </div>
                    )}
                    <div className="queue-card-actions">
                      {isUpgrade ? (
                        <button className="queue-accept" onClick={() => { setMatchIntake(matchingThis ? null : intake); setMatchSearch(""); }}>
                          {matchingThis ? "Close" : "🔗 Match to Patient"}
                        </button>
                      ) : (
                        <button className="queue-accept" onClick={() => handleAcceptIntake(intake)}>
                          ✓ Accept &amp; Start Intake
                        </button>
                      )}
                      <button className="queue-dismiss" onClick={() => handleDismissIntake(intake._meta?.intakeId)}>
                        Dismiss
                      </button>
                    </div>
                    {isUpgrade && matchingThis && (() => {
                      // Candidates: same DOB first (strong key), then last-name
                      // matches, then the manual-search results. De-duplicated by id.
                      const intakeDob = a.dob || "";
                      const lastLc = (a.lastName || "").toLowerCase();
                      const q = matchSearch.trim().toLowerCase();
                      const seen = new Set();
                      const push = (list, p) => { if (p && !seen.has(p.id)) { seen.add(p.id); list.push(p); } };
                      const dobMatches = []; const nameMatches = []; const searchResults = [];
                      patients.forEach(p => {
                        if (intakeDob && p.dob === intakeDob) push(dobMatches, p);
                      });
                      patients.forEach(p => {
                        if (!seen.has(p.id) && lastLc && (p.name || "").toLowerCase().includes(lastLc)) push(nameMatches, p);
                      });
                      if (q) patients.forEach(p => {
                        if (!seen.has(p.id) && ((p.name || "").toLowerCase().includes(q) || (p.dob || "").includes(q))) push(searchResults, p);
                      });
                      const Row = (p, tag) => (
                        <button key={p.id} onClick={() => handleMatchToPatient(intake, p)}
                          style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",textAlign:"left",
                            padding:"9px 12px",marginBottom:6,borderRadius:8,border:"1px solid #e5e7eb",background:"white",cursor:"pointer"}}>
                          <span>
                            <span style={{fontWeight:700,fontSize:13,color:"#111"}}>{p.name}</span>
                            <span style={{fontSize:12,color:"#6b7280",marginLeft:8}}>DOB {p.dob || "—"}</span>
                          </span>
                          {tag && <span style={{fontSize:10,fontWeight:700,color:"#0f766e",background:"#f0fdfa",border:"1px solid #5eead4",borderRadius:12,padding:"1px 8px"}}>{tag}</span>}
                        </button>
                      );
                      return (
                        <div style={{marginTop:8,background:"#FAFAF7",border:"1px solid #F0EDE3",borderRadius:10,padding:"12px 12px 10px"}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>
                            Match to existing patient
                          </div>
                          {dobMatches.length > 0 && (
                            <div style={{marginBottom:8}}>
                              <div style={{fontSize:11,color:"#0f766e",fontWeight:600,marginBottom:6}}>Same date of birth</div>
                              {dobMatches.map(p => Row(p, "DOB match"))}
                            </div>
                          )}
                          {nameMatches.length > 0 && (
                            <div style={{marginBottom:8}}>
                              <div style={{fontSize:11,color:"#6b7280",fontWeight:600,marginBottom:6}}>Same last name</div>
                              {nameMatches.slice(0,5).map(p => Row(p, null))}
                            </div>
                          )}
                          <input type="text" value={matchSearch} onChange={e => setMatchSearch(e.target.value)}
                            placeholder="Search by name or DOB…"
                            style={{width:"100%",boxSizing:"border-box",fontSize:13,padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,marginBottom:8,outline:"none"}} />
                          {q && (searchResults.length > 0
                            ? searchResults.slice(0,8).map(p => Row(p, null))
                            : <div style={{fontSize:12,color:"#9ca3af",padding:"4px 2px 8px"}}>No patients match “{matchSearch}”.</div>)}
                          {dobMatches.length === 0 && nameMatches.length === 0 && !q && (
                            <div style={{fontSize:12,color:"#9ca3af",padding:"2px 2px 8px"}}>No automatic match — search above, or create a new patient.</div>
                          )}
                          <button onClick={() => handleAcceptIntake(intake)}
                            style={{width:"100%",fontSize:12,fontWeight:600,color:"#6b7280",background:"transparent",border:"1px dashed #d1d5db",borderRadius:8,padding:"8px",cursor:"pointer"}}>
                            + Not in the system — create a new patient
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="app">
        <div className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-badge">Distil</div>
            <div className="logo-name">{clinic.name}</div>
            <div className="logo-sub">{clinic.phone}</div>
          </div>
          <div style={{margin:"12px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:2,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",marginBottom:3}}>Clinic</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontWeight:500,lineHeight:1.3}}>{clinic.address}</div>
          </div>
          {isCloser && (
            <div onClick={()=>setShowCloserPicker(true)} title="Set the clinic + provider this is dispensed under"
              style={{margin:"0 14px 12px",background:closerProvider?"rgba(27,138,122,0.1)":"rgba(245,158,11,0.12)",border:`1px solid ${closerProvider?"rgba(27,138,122,0.3)":"rgba(245,158,11,0.45)"}`,borderRadius:8,padding:"8px 10px",cursor:"pointer"}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:2,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",marginBottom:3}}>Dispensing Location</div>
              {closerProvider ? (
                <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",fontWeight:600,lineHeight:1.35}}>
                  {(closerClinic?.name||"").replace("My Hearing Centers – ","")}
                  <div style={{fontWeight:400,color:"rgba(255,255,255,0.55)"}}>under {closerProvider.full_name} · tap to change</div>
                </div>
              ) : (
                <div style={{fontSize:12,color:"#fcd34d",fontWeight:600}}>⚠ Tap to set before closing</div>
              )}
            </div>
          )}
          <div className="sidebar-nav">
            {/* "Schedule" deliberately absent: calendaring was dropped as a product
                decision — clinics have scheduling tools; Distil tracks
                next_appointment_date only. */}
            {[["dashboard","Dashboard","dashboard"],["users","Patients","patients"],["clock","Pending Fittings","pending-fittings"],["bell","Follow-up","followup"],["archive","Archive","archive"],["chart","Reports","reports"],["compare","Compare Devices","compare"],["clipboard","Market Catalog","market-catalog"],["campaign","Campaigns","campaigns"],["book","Content Library","content"],["medal","Lima Charlie","lima-charlie"]].map(([icon,label,id])=>{
              const badge = id === "followup" ? countFollowUpPatients(patients)
                : id === "pending-fittings" ? countPendingFittings(patients)
                : 0;
              return (
              <div key={id} className={`nav-item ${view===id||(id==="dashboard"&&view==="new")||(id==="patients"&&(view==="dashboard"||view==="patient"))?"active":""}`}
                onClick={()=>{
                  if(id==="dashboard"||id==="patients") setView("dashboard");
                  else setView(id);
                }}>
                <span className="nav-icon"><Icon name={icon} size={17}/></span>{label}
                {badge > 0 && (
                  // Teal for pending fittings — sold devices awaiting delivery is
                  // work waiting, not an overdue alarm like the follow-up red.
                  <span style={{marginLeft:"auto",background:id==="pending-fittings"?"#1B8A7A":"#ef4444",color:"white",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>{badge}</span>
                )}
              </div>
            )})}
            {/* Provider reflection tool — own price-adjustment history (spec §6/§11).
                Not admin-gated: anyone who can adjust a price sees their own log. */}
            {checkRole(staffRole, ["provider","closer","admin"]) && (
              <div className={`nav-item ${view==="adjustments"?"active":""}`} onClick={()=>setView("adjustments")}>
                <span className="nav-icon"><Icon name="tag" size={17}/></span>My Adjustments
              </div>
            )}
            {/* Admin group — catalog/config tooling; admin role only (backlog #17).
                Single consolidated group: Providers (#102) + Insurance Plans (#100)
                were separately added and produced two Admin sections on merge. */}
            {checkRole(staffRole, ["admin"]) && <>
              <div className="nav-section-label">Admin</div>
              {[["users","Team","team"],["badge","Providers","providers"],["shield","Insurance Plans","insurance-plans"],["verify","Rate Verifications","rate-verifications"],["percent","Rebates","rebates"],["clipboard","Product Catalog","catalog"],["book","Nations Catalog","nations-catalog"],["book","Evidence Review","evidence"],["settings","Settings","settings"]].map(([icon,label,id])=>(
                <div key={id} className={`nav-item ${view===id?"active":""}`} onClick={()=>setView(id)}>
                  <span className="nav-icon"><Icon name={icon} size={17}/></span>{label}
                </div>
              ))}
            </>}
          </div>
          {/* Intake queue button */}
          <div style={{padding:"12px 14px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
            <button onClick={() => setShowIntakeQueue(true)} style={{
              width:"100%", background:"rgba(27,138,122,0.1)", border:"1px solid rgba(27,138,122,0.25)",
              borderRadius:8, padding:"10px 14px", cursor:"pointer", display:"flex",
              alignItems:"center", justifyContent:"space-between", fontFamily:"'Sora',sans-serif",
            }}>
              <span style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:"#1B8A7A"}}><Icon name="inbox" size={16}/> Intake Queue</span>
              {pendingIntakes.length > 0 && (
                <span style={{background:"#ef4444",color:"white",borderRadius:20,
                  padding:"2px 8px",fontSize:11,fontWeight:700}}>
                  {pendingIntakes.length}
                </span>
              )}
            </button>
          </div>
          {/* Location — active clinic; dropdown when assigned to more than one */}
          <div style={{padding:"0 14px 8px"}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"rgba(255,255,255,0.35)",marginBottom:5,display:"flex",alignItems:"center",gap:6}}>
              <Icon name="pin" size={12}/> Location
            </div>
            {myClinics.length > 1 ? (
              <select
                value={clinicId || ""}
                disabled={clinicSwitching}
                onChange={e => handleClinicSwitch(e.target.value)}
                style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
                  borderRadius:8,padding:"8px 10px",cursor:clinicSwitching?"wait":"pointer",
                  fontFamily:"'Sora',sans-serif",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.85)"}}>
                {myClinics.map(c => (
                  <option key={c.id} value={c.id} style={{color:"#0a1628"}}>
                    {c.name.replace(/^My Hearing Centers\s*[–-]\s*/,"")}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",padding:"2px 0"}}>
                {clinic.name?.replace(/^My Hearing Centers\s*[–-]\s*/,"") || "—"}
              </div>
            )}
          </div>
          <div style={{padding:"0 14px 8px"}}>
            <button onClick={async()=>{try{await signOut();}catch(e){console.error("Sign out failed",e);}}}
              style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:8,padding:"8px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
                fontFamily:"'Sora',sans-serif",fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.5)",
                transition:"all 0.15s"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </div>
          <div className="sidebar-footer">
            Distil · Hearing Care Platform<br/>HIPAA-compliant · v1.0
          </div>
        </div>


        <div className="main" ref={mainRef}>
          {/* Save toast */}
          {saveToast && (
            <div style={{position:"fixed",top:16,right:16,zIndex:9999,background:"#0a1628",color:"#1B8A7A",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:700,fontFamily:"'Sora',sans-serif",boxShadow:"0 4px 20px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",gap:8,animation:"fadeIn 0.2s ease"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B8A7A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </div>
          )}
          {/* ── CLOSE APPOINTMENT — required disposition capture ─────────
              Rendered above the view dispatch so it serves both launch
              points: the wizard's terminal action and the profile button. */}
          {closeAppointment && (() => {
            const isWizard = closeAppointment.source === "wizard";
            const p = isWizard ? null : selectedPatient;
            if (!isWizard && !p) return null;
            const pending = !isWizard ? readPendingOutcome(p.id) : null;
            const payer = isWizard
              ? buildPayerSnapshot({
                  payType: form.payType,
                  directPurchase: form.directPurchase,
                  insurance: form.payType === "insurance"
                    ? { carrier: form.carrier, planGroup: form.planGroup, tpa: form.tpa, tier: form.tier, tierPrice: form.tierPrice }
                    : null,
                  privatePay: form.payType === "private" && form.tierPrice != null
                    ? { tier: form.tier, tierPrice: form.tierPrice }
                    : null,
                })
              : (pending
                  ? { payerType: pending.payerType, payerName: pending.payerName, payerPlanSnapshot: pending.payerPlanSnapshot }
                  : buildPayerSnapshot(p));
            const tierLabel = isWizard ? form.tier : (p?.insurance?.tier || pending?.payerPlanSnapshot?.tier);
            const payerLabel = payer.payerType === "private_pay"
              ? "Private pay"
              : payer.payerType === "direct_purchase"
                ? ["Direct Purchase", tierLabel].filter(Boolean).join(" · ")
                : [payer.payerName || "Insurance", tierLabel].filter(Boolean).join(" · ");
            // Prefills: everything the flow already knows arrives selected so
            // the common path is confirm-and-save.
            let defaults;
            if (pending) {
              defaults = {
                defaultContext: pending.context || "new_fit",
                defaultDevice: pending.deviceDisposition || null,
                defaultDeviceReason: pending.deviceReason || null,
                defaultCarePlan: pending.carePlanDisposition || null,
                defaultCarePlanReason: pending.carePlanReason || null,
                defaultCarePlanSelected: pending.carePlanSelected || null,
                defaultReferral: pending.referral || null,
              };
            } else if (isWizard && closeAppointment.tnl) {
              // Tested No Loss — launched from the Results step's TNL banner.
              // Both layers arrive set; the provider can still override.
              defaults = {
                defaultContext: "new_fit",
                defaultDevice: "no_hearing_loss",
                defaultCarePlan: "not_applicable",
              };
            } else if (isWizard && closeAppointment.didNotTest) {
              // Did Not Test — launched from the Testing step's fork. The
              // reason stays unset on purpose: picking it IS the provider's
              // one required action in this close.
              defaults = {
                defaultContext: "new_fit",
                defaultDevice: "did_not_test",
                defaultCarePlan: "not_applicable",
              };
            } else if (isWizard) {
              // Private pay bundles Complete Care+ with a signed purchase.
              const cpSel = form.payType === "private"
                ? (wizardPaSigned ? "complete" : null)
                : (form.carePlan || null);
              defaults = {
                defaultContext: wizardMode === "upgrade" ? "upgrade" : "new_fit",
                defaultDevice: wizardPaSigned ? "committed" : null,
                defaultCarePlan: cpSel ? "committed" : null,
                defaultCarePlanSelected: cpSel,
              };
            } else {
              const ctx = p.patientStatus === "active" && p.devices ? "care_plan_only" : "new_fit";
              defaults = {
                defaultContext: ctx,
                defaultDevice: ctx === "care_plan_only" ? "not_applicable" : null,
              };
            }
            return (
              <CloseAppointmentModal
                patientName={isWizard ? [form.firstName, form.lastName].filter(Boolean).join(" ") : p.name}
                payerLabel={payerLabel}
                {...defaults}
                onSubmit={isWizard ? handleWizardCloseAppointment : handleProfileCloseAppointment}
                onCancel={() => setCloseAppointment(null)}
              />
            );
          })()}
          {(view === "dashboard" || view === "patients") && (
            <Dashboard {...{
              clinic, clinicId, staffId, patients,
              seedError, seeding, handleSeedPatients, startNew,
              wizardDraft, wizardDraftSavedLabel, discardWizardDraft, resumeAppointment,
              statsData, setSelectedPatient, setView,
              tnsQueue, tnsExpanded, setTnsExpanded, tnsReasoning, setTnsReasoning,
              quoteViewBadge, handleTnsSaved,
              statusFilter, setStatusFilter, searchScope, setSearchScope,
              tableSearch, setTableSearch, filteredPatients, globalSearching,
              rosterSort, toggleRosterSort,
            }} />
          )}
          {view === "archive" && (
            <Archive {...{
              clinic, archivedPatients, archivedFiltered, archivedLoading,
              archivedSearch, setArchivedSearch, archiveBusy, handleRestorePatient,
              setSelectedPatient, setView,
            }} />
          )}
          {view === "patient" && (
            <PatientDetail {...{
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
            }} />
          )}
          {view === "consultation" && (() => {
            const p = selectedPatient;
            if (!p || !p.audiology) return null;
            return (
              <>
                <div className="topbar">
                  <div>
                    <div className="topbar-title">Consultation — {p.name}</div>
                    <div className="topbar-sub">Audiogram counseling tools · {p.id.slice(0,8).toUpperCase()}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn-ghost" onClick={()=>requireCurrentHearingTest("devices")}>Select Devices</button>
                    <button className="btn-ghost" onClick={()=>setView("couples")}>Compare with Partner</button>
                    <button className="btn-ghost" onClick={()=>setView("patient")}>{"\u2190"} Exit Consultation</button>
                  </div>
                </div>
                <div className="content">
                  <div style={{maxWidth:1100,margin:"0 auto"}}>
                    <ResultsContent aud={p.audiology} chiefComplaint={p.notes || ""} displayLang={displayLang} setDisplayLang={setDisplayLang} />
                  </div>
                </div>
              </>
            );
          })()}
          {view === "couples" && selectedPatient && (
            <>
              <div className="topbar">
                <div>
                  <div className="topbar-title">Hearing Comparison {"\u2014"} {selectedPatient.name}</div>
                  <div className="topbar-sub">Side-by-side counseling view</div>
                </div>
                <button className="btn-ghost" onClick={()=>setView("consultation")}>{"\u2190"} Back to Consultation</button>
              </div>
              <div className="content">
                <CouplesComparison patient={selectedPatient} clinicId={clinicId} onExit={()=>setView("consultation")} lang={displayLang} />
              </div>
            </>
          )}
          {view === "compare" && (
            <>
              <div className="topbar">
                <div>
                  <div className="topbar-title">Compare Devices</div>
                  <div className="topbar-sub">Old vs. new performance — a standalone tool, no visit required</div>
                </div>
                <button className="btn-ghost" onClick={()=>setView("dashboard")}>{"←"} Back</button>
              </div>
              <div className="content">
                <ComparisonHub patientId={selectedPatient?.id || null} lang={displayLang} />
              </div>
            </>
          )}
          {view === "settings" && (
            <ClinicSettings {...{
              clinicId, staffId, staffRole,
              clinicSaved, clinicDraft, setClinicDraft, handleClinicSave,
              staffProfile, providerSignatureB64, sigBusy, sigErr, handleSignatureUpload,
              anchorsClass, setAnchorsClass, anchorsLoading, anchorsDraft, setAnchorsDraft,
              anchorsSaved, handleSaveAnchors, focusedMoneyKey, setFocusedMoneyKey,
              patients,
              deleteSearch, setDeleteSearch, deleteTarget, setDeleteTarget,
              deleteConfirmText, setDeleteConfirmText, deleteBusy, deleteError, setDeleteError,
              deleteDone, setDeleteDone, handleDeletePatient,
            }} />
          )}
          {view === "catalog" && (checkRole(staffRole, ["admin"]) ? (
            <CatalogAdmin {...{
              catalog, setCatalog,
              catMfrFilter, setCatMfrFilter, catSearch, setCatSearch,
              catDraft, setCatDraft, catEditId, setCatEditId,
              catNewEntry, setCatNewEntry, catSaved, setCatSaved, catError, setCatError,
              catAddChip, setCatAddChip, catChipEdit, setCatChipEdit,
              focusedMoneyKey, setFocusedMoneyKey,
            }} />
          ) : <AdminDenied />)}
          {view === "providers" && (checkRole(staffRole, ["admin"]) ? <ProvidersAdmin /> : <AdminDenied />)}
          {view === "insurance-plans" && (checkRole(staffRole, ["admin"]) ? (
            <InsurancePlansAdmin {...{
              insurancePlans, setInsurancePlans,
              insEditKey, setInsEditKey, insDraft, setInsDraft,
              insSearch, setInsSearch, insCarrierFilter, setInsCarrierFilter,
              insSaved, setInsSaved, insError, setInsError,
            }} />
          ) : <AdminDenied />)}
          {view === "nations-catalog" && (checkRole(staffRole, ["admin"]) ? <NationsCatalog /> : <AdminDenied />)}
          {view === "evidence" && (checkRole(staffRole, ["admin"]) ? <EvidenceReview staffId={staffId} /> : <AdminDenied />)}
          {view === "market-catalog" && <HearingAidCatalog />}
          {view === "team" && (checkRole(staffRole, ["admin"]) ? <TeamAdmin activeClinicId={clinicId} /> : <AdminDenied />)}
          {view === "adjustments" && <AdjustmentHistory staffId={staffId} patients={patients} />}
          {view === "rebates" && (
            <RebatesAdmin {...{
              clinicId,
              rebatePromos, setRebatePromos,
              rebEditId, setRebEditId, rebDraft, setRebDraft,
              rebSearch, setRebSearch, rebSaved, setRebSaved, rebError, setRebError,
            }} />
          )}
          {view === "rate-verifications" && (checkRole(staffRole, ["admin"]) ? (
            <RateVerificationsAdmin {...{
              rateVerifications, rvError, rvBusyId,
              doPromoteVerification, doDismissVerification,
            }} />
          ) : <AdminDenied />)}
          {view === "campaigns" && <CampaignManager clinicId={clinicId} staffId={staffId} patients={patients} />}
          {view === "content" && <ContentLibrary clinicId={clinicId} staffId={staffId} />}
          {view === "lima-charlie" && <LimaCharlie clinicId={clinicId} staffId={staffId} />}
          {view === "reports" && (
            <div className="content">
              <Reports clinicId={clinicId} clinicName={clinic?.name} staffId={staffId} patients={patients}
                onSelectPatient={(p) => { setSelectedPatient(p); setView("patient"); }} />
            </div>
          )}
          {view === "followup" && (
            <FollowUpQueue
              patients={patients}
              staffId={staffId}
              clinicId={clinicId}
              onSelectPatient={(p) => { setSelectedPatient(p); setView("patient"); }}
              onRefresh={refreshPatients}
            />
          )}
          {view === "pending-fittings" && (
            <PendingFittings
              patients={patients}
              staffId={staffId}
              clinicId={clinicId}
              onSelectPatient={(p) => { setSelectedPatient(p); setView("patient"); }}
              onRefresh={refreshPatients}
            />
          )}
          {view === "upgrade" && selectedPatient && (
            <UpgradeWizard
              patient={selectedPatient}
              clinicId={clinicId}
              staffId={staffId}
              plans={activePlans}
              onExit={() => setView("patient")}
              onCompleted={async () => { await refreshPatients(); setView("patient"); }}
              onProceedToPurchase={(ctx) => {
                // Visit is already saved by the wizard — route straight into
                // the device/PA flow seeded from this chart + visit.
                refreshPatients();
                startUpgradePurchase(selectedPatient, ctx);
              }}
            />
          )}
          {view === "new" && (() => {
            // Private-pay bundles Complete Care+ — no separate Care Plan step.
            // We hide step index 4 from the stepper and skip it in nav. The
            // underlying STEPS indexes are unchanged; everything else still
            // references step === 4 etc. by absolute index.
            const skipCarePlan = form.payType === "private";
            const visibleSteps = skipCarePlan
              ? STEPS.map((s, i) => ({ s, i })).filter(({ i }) => i !== 4)
              : STEPS.map((s, i) => ({ s, i }));
            const visiblePos = visibleSteps.findIndex(({ i }) => i === step);
            // Upgrade purchases start mid-flow on an established patient: Care
            // Plan (4) for insurance, Technology Tier (5) for private pay (Care
            // Plan is bundled/hidden). Steps at or before that entry point
            // aren't valid targets — bail to the profile instead.
            const upgradeEntry = skipCarePlan ? 5 : 4;
            // Click a completed step in the header to jump back to it (forward
            // navigation stays gated by Next / canProceed). Mirror the Back
            // button for upgrade mode.
            const jumpToStep = (target) => {
              if (target >= step) return;
              if (wizardMode === "upgrade" && target <= upgradeEntry) { setView("patient"); return; }
              setStep(target);
            };
            return (
            <>
              <div className="topbar">
                <div>
                  <div className="topbar-title">{wizardMode === "upgrade" ? "Upgrade Purchase" : "New Patient"}</div>
                  <div className="topbar-sub">{wizardMode === "upgrade" ? `${[form.firstName, form.lastName].filter(Boolean).join(" ")} · ` : ""}Step {visiblePos + 1} of {visibleSteps.length} · {STEPS[step]}</div>
                </div>
                <button className="btn-ghost" onClick={()=>setView("dashboard")}>Cancel</button>
              </div>
              <div className="content">
                <div className="wizard-wrap">
                  <div className="wizard-steps">
                    {visibleSteps.map(({ s, i }, pos)=>{
                      const clickable = pos < visiblePos && !(wizardMode === "upgrade" && i <= upgradeEntry);
                      return (
                      <div key={s} className={`wizard-step ${pos<visiblePos?"done":""}`}
                        onClick={clickable ? () => jumpToStep(i) : undefined}
                        style={clickable ? {cursor:"pointer"} : undefined}
                        title={clickable ? `Go back to ${s}` : undefined}>
                        <div className={`step-dot ${i===step?"active":pos<visiblePos?"done":""}`}>{pos<visiblePos?"✓":pos+1}</div>
                        <div className={`step-name ${i===step?"active":""}`}>{s}</div>
                      </div>
                      );
                    })}
                  </div>
                  <WizardSteps {...{
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
                  }} />
                  <PrompterSidebar
                    open={prompterOpen}
                    onToggle={() => setPrompterOpen(o => !o)}
                    chapter={STEP_TO_CHAPTER[step]}
                    chapterTitle={CHAPTER_TITLES[STEP_TO_CHAPTER[step] - 1]}
                    motivationScore={wizardIntake?.motivationScore ?? null}
                    softCommitment={wizardIntake?.softCommitment ?? null}
                    audiology={form.audiology}
                    payType={form.payType}
                    tier={form.tier}
                    carePlan={form.carePlan}
                  />
                  {saveError && (
                    <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"12px 16px",marginBottom:8,fontSize:13,color:"#dc2626"}}>
                      <strong>Save failed:</strong> {saveError}
                      <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>
                        staffId: {staffId||"(none)"} · clinicId: {clinicId||"(none)"}
                      </div>
                    </div>
                  )}
                  {sigLoadError && (
                    <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"12px 16px",marginBottom:8,fontSize:13,color:"#b45309"}}>
                      <strong>Signature unavailable:</strong> your stored signature couldn't be loaded, so agreements generated right now will print your typed name instead of your signature image. Re-upload it in Settings if this keeps happening.
                    </div>
                  )}
                  <div className="wizard-nav">
                    <button className="btn-ghost" onClick={()=>{
                      if (step === 0) { setView("dashboard"); return; }
                      // Upgrade purchases land mid-flow (step 4/5) on an
                      // established patient — the earlier new-patient steps
                      // don't apply, and edits made there (e.g. insurance)
                      // would NOT persist to the saved coverage. Back exits
                      // to the profile instead of walking into that trap;
                      // coverage edits belong in the profile's Coverage card.
                      if (wizardMode === "upgrade" && step <= upgradeEntry) { setView("patient"); return; }
                      // Private-pay skips Care Plan (step 4) — going Back from
                      // Technology Tier (step 5) lands on Results (step 3).
                      if (skipCarePlan && step === 5) { setStep(3); return; }
                      setStep(s=>s-1);
                    }}>
                      {step===0?"Cancel":(wizardMode==="upgrade" && step<=upgradeEntry ? "← Back to Profile" : "← Back")}
                    </button>
                    {step < STEPS.length-1 ? (
                        <button className="btn-primary" disabled={!canProceed} style={{opacity:canProceed?1:0.4}} onClick={async()=>{
                          // Step 0 persists the patient profile before advancing
                          // so an abandoned wizard never loses the patient — a
                          // failure here must surface and block, never be swallowed.
                          if (step === 0 && !wizardPatientId) {
                            const name = [form.firstName, form.lastName].filter(Boolean).join(" ");
                            const ins = form.payType === "insurance" ? { carrier: form.carrier, planGroup: form.planGroup, tpa: form.tpa, tier: form.tier, tierPrice: form.tierPrice } : null;
                            try {
                              const pid = await createPatientDraft({ id: genId(), name, dob: form.dob, phone: form.phone, email: form.email, address: form.address, payType: form.payType, directPurchase: form.directPurchase, notes: form.notes, insurance: ins }, staffId, clinicId);
                              setWizardPatientId(pid);
                              const vid = await createVisit(pid, { clinicId, staffId, visitType: 'initial_fit' });
                              setWizardVisitId(vid);
                              if (form.intakeId) {
                                try { await linkIntakeToPatient(form.intakeId, pid, clinicId); }
                                catch (e) { console.error('linkIntakeToPatient:', e); }
                              }
                              setSaveError(null);
                              setSaveToast(true); setTimeout(()=>setSaveToast(false), 2000);
                            } catch (e) {
                              console.error("createPatientDraft (wizard step 0):", e);
                              setSaveError((e?.message || e?.toString() || "Unknown error") + " — patient profile not saved. Fix the issue and click Continue again.");
                              return;
                            }
                          } else {
                            try {
                              if (step === 2 && wizardPatientId) {
                                await updatePatientAudiology(wizardPatientId, form.audiology, staffId, wizardVisitId);
                                setSaveToast(true); setTimeout(()=>setSaveToast(false), 2000);
                              } else if (step === 4 && wizardPatientId && form.carePlan) {
                                logAnalyticsEvent("care_plan_selected", {
                                  patient_id: wizardPatientId,
                                  provider_id: staffId,
                                  clinic_id: clinicId,
                                  selection: form.carePlan,
                                  change_count: carePlanChangeCountRef.current,
                                });
                                await updatePatientCarePlan(wizardPatientId, form.carePlan);
                                setSaveToast(true); setTimeout(()=>setSaveToast(false), 2000);
                              } else if (step === 6 && wizardPatientId) {
                                const leftRec = buildSideRecord(form.left);
                                const rightRec = buildSideRecord(form.right);
                                const isCROS = [leftRec, rightRec].some(r => r?.variant?.toLowerCase().includes("cros")) || form.left.isCROS || form.right.isCROS;
                                const fittingType = leftRec && rightRec ? (isCROS ? "cros_bicros" : "bilateral") : leftRec ? "monaural_left" : "monaural_right";
                                await updatePatientDevices(wizardPatientId, { left: leftRec, right: rightRec, fittingType, serialLeft: genId(), serialRight: genId() }, staffId, wizardVisitId);
                                setSaveToast(true); setTimeout(()=>setSaveToast(false), 2000);
                              }
                            } catch(e) { console.error("incremental save:", e); }
                          }
                          // Private-pay skips Care Plan — Continue from Results
                          // (step 3) jumps straight to Technology Tier (step 5).
                          setStep(s => (skipCarePlan && s === 3) ? 5 : s + 1);
                        }}>
                          Continue →
                        </button>
                    ) : (
                      <button className="btn-primary green" onClick={()=>setCloseAppointment({ source: "wizard" })}>
                        ✓ Close Appointment
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── WIZARD PURCHASE AGREEMENT — FULL-PAGE REVIEW ────── */}
              {showWizardPaModal && (() => {
                const pName = [form.firstName,form.lastName].filter(Boolean).join(" ");
                const leftRec = buildSideRecord(form.left);
                const rightRec = buildSideRecord(form.right);
                const isCROS = [leftRec,rightRec].some(r=>r?.variant?.toLowerCase().includes("cros")) || form.left.isCROS || form.right.isCROS;
                const fType = leftRec && rightRec ? (isCROS?"cros_bicros":"bilateral") : leftRec?"monaural_left":"monaural_right";
                const ac = (fType==="bilateral"||fType==="cros_bicros")?2:1;
                // Effective per-aid honors a confirmed Price Adjustment (§6).
                const effPerAid = (form.priceOverridePerAid ?? form.tierPrice) || 0;
                const devTotal = effPerAid*ac;
                const cpId = form.carePlan||"complete";
                const cpLabel = cpId==="complete"?"Complete Care+":(cpId==="punch"?"MHC Punch Card":"Standard Billing");
                const cpPrice = cpId==="complete"?1250:(cpId==="punch"?575:0);
                const cpWarranty = cpId==="complete"?4:3;
                const cpDesc = cpId==="complete"?"Unlimited office visits, cleanings, adjustments & triage for the life of your hearing aids · 4-year warranty & loss/damage coverage":(cpId==="punch"?"All visits and cleanings covered for 4 years · 3-year manufacturer warranty":"$65 per visit · Annual exams covered");
                // Private pay bundles the care plan into the per-aid retail price,
                // so the total reflects devices only and the plan renders as "Included".
                const isPrivate = form.payType === 'private';
                const total = devTotal + (isPrivate ? 0 : cpPrice);
                const provName = paProvider.fullName;
                const provLic = paProvider.activeLicense;
                const clinicObj = paClinic;
                const ss = {section:{fontSize:10,fontWeight:700,color:"#0a1628",letterSpacing:0.5,textTransform:"uppercase",marginBottom:6,marginTop:18},body:{fontSize:13,color:"#374151",lineHeight:1.7}};
                return (
                  <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(10,22,40,0.92)",zIndex:9999,overflowY:"auto"}}>
                    <div style={{background:"white",width:700,margin:"0 auto",padding:"40px 48px 80px",boxShadow:"0 0 80px rgba(0,0,0,0.4)"}}>
                      {/* Header */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div>
                          <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:16,color:"#0a1628"}}>MY HEARING CENTERS</div>
                          <div style={{fontSize:11,color:"#6b7280"}}>{clinicObj?.address}  ·  {clinicObj?.phone}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:14,color:"#0a1628"}}>HEARING AID PURCHASE AGREEMENT</div>
                          <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Date: {new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
                        </div>
                        <button onClick={()=>setShowWizardPaModal(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#9ca3af",padding:"0 0 0 12px",lineHeight:1}}>✕</button>
                      </div>
                      <div style={{height:1,background:"#E4E0D5",margin:"12px 0"}}/>

                      {/* Patient */}
                      <div style={ss.section}>Patient Information</div>
                      <div style={{display:"flex",gap:40,fontSize:13,color:"#374151"}}>
                        <div><span style={{color:"#9ca3af",fontSize:11}}>Name</span><br/>{pName}</div>
                        <div><span style={{color:"#9ca3af",fontSize:11}}>Phone</span><br/>{form.phone||"—"}</div>
                        <div><span style={{color:"#9ca3af",fontSize:11}}>Address</span><br/>{form.address||"—"}</div>
                      </div>

                      {/* Devices */}
                      <div style={ss.section}>Device Specifications</div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr style={{background:"#0a1628",color:"white",fontSize:11}}>
                          {["","Manufacturer","Model","Style","Battery","Price"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600}}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {[["Right",rightRec],["Left",leftRec]].map(([label,d],i)=> d && (
                            <tr key={label} style={{background:i%2===0?"#FBF9F3":"white"}}>
                              <td style={{padding:"6px 8px",fontWeight:600,color:"#0a1628"}}>{label}</td>
                              <td style={{padding:"6px 8px"}}>{d.manufacturer||"—"}</td>
                              {/* TruHearing: model alone — the tech level prints once below,
                                  next to pricing (same scheme as the quote + agreement PDFs). */}
                              <td style={{padding:"6px 8px"}}>{(d.manufacturer==="TruHearing" ? [d.family,d.variant] : [d.family,d.variant,d.techLevel]).filter(Boolean).join(" ")||"—"}</td>
                              <td style={{padding:"6px 8px"}}>{d.style||"—"}</td>
                              <td style={{padding:"6px 8px"}}>{d.battery||"—"}</td>
                              <td style={{padding:"6px 8px",fontWeight:700}}>${effPerAid.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                            </tr>
                          ))}
                          {(()=>{
                            const t = [leftRec,rightRec].find(r => r?.manufacturer==="TruHearing" && !/^(CROS|BICROS)/i.test(r?.variant||""))?.techLevel;
                            return t ? (
                              <tr>
                                <td colSpan={6} style={{padding:"4px 8px",fontSize:11,color:"#6b7280"}}>
                                  Technology level: {t} — included in the price shown for each device above.
                                </td>
                              </tr>
                            ) : null;
                          })()}
                          <tr style={{background:"#E4E0D5"}}>
                            <td colSpan={5} style={{padding:"6px 8px",fontWeight:700,color:"#0a1628"}}>Device Total ({ac===2?"pair":"single"})</td>
                            <td style={{padding:"6px 8px",fontWeight:700,color:"#0a1628"}}>${devTotal.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Care Plan */}
                      <div style={ss.section}>{isPrivate ? "Included Care Plan" : "Care Plan"}</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #E4E0D5",borderRadius:8,padding:"10px 14px"}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13,color:"#0a1628"}}>{cpLabel}</div>
                          <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{isPrivate ? "Bundled with your device purchase — no separate charge" : cpDesc}</div>
                        </div>
                        {isPrivate
                          ? <div style={{fontWeight:700,fontSize:14,color:"#15803d"}}>Included</div>
                          : (cpPrice > 0 && <div style={{fontWeight:700,fontSize:14,color:"#0a1628"}}>${cpPrice.toLocaleString('en-US',{minimumFractionDigits:2})}</div>)
                        }
                      </div>

                      {/* Total */}
                      <div style={{background:"#0a1628",borderRadius:8,padding:"12px 16px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{color:"white",fontWeight:700,fontSize:14}}>TOTAL PURCHASE PRICE</div>
                        <div style={{color:"white",fontWeight:800,fontSize:18}}>${total.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
                      </div>

                      {/* Terms */}
                      <div style={ss.section}>Warranty</div>
                      <div style={ss.body}>The manufacturer warrants patient's hearing aid(s) to be free from defects in workmanship and materials for a period of {cpWarranty} year(s) from date of delivery and agrees to make all necessary repairs without charge to patient during the warranty period. The manufacturer provides a one-time loss and damage replacement during the warranty period at a cost of $275 per hearing aid.</div>

                      <div style={ss.section}>100% Satisfaction Guaranteed</div>
                      <div style={ss.body}>Patient has a right to cancel this agreement for any reason within 60 days. Patient is entitled to receive a full refund of any payment made for the hearing aid within 30 days of returning the hearing aid to MHC in normal working condition. MHC may refuse to provide a refund for a hearing aid that has been lost or damaged beyond repair while in the patient's possession.</div>

                      <div style={ss.section}>Patient Responsibility</div>
                      <div style={ss.body}>Patient is responsible to carefully follow all rehabilitation instructions and communicate with the provider on the progress with adjustments. During this time MHC may make any needed adjustments on the hearing aid(s) for the benefit of the patient's listening and hearing comfort. Patient should realize that adjusting to hearing aids is not an overnight experience and may take time. Patient also agrees to allow themselves time to adjust and allows MHC to assist them in their hearing rehabilitation. If MHC believes that, during the rehabilitation period, a different choice of circuitry, model, or choice of hearing aid(s) is better suited to the patient's needs, no extra cost will be incurred by the patient unless an upgrade of quality, model, or style is chosen. Suggested rehabilitation time is a minimum of 30 days. Additional time may be granted subject to approval by MHC.</div>

                      {/* Signature section */}
                      <div style={{height:1,background:"#E4E0D5",margin:"24px 0"}}/>

                      {paStep !== "sign" ? (
                        <div style={{textAlign:"center",padding:"20px 0"}}>
                          <button
                            style={{background:"#15803d",color:"white",border:"none",borderRadius:8,padding:"14px 32px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer"}}
                            onClick={()=>setPaStep("sign")}
                          >
                            Adopt and Sign
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>Patient Signature — Type to Sign</div>
                          <input
                            type="text" placeholder="Type your full legal name" value={paSignatureName} onChange={e=>setPaSignatureName(e.target.value)}
                            style={{width:"100%",padding:"12px 14px",borderRadius:8,border:"1px solid #d1d5db",fontFamily:"'Sora',sans-serif",fontSize:15,boxSizing:"border-box"}}
                          />
                          {paSignatureName.trim().length > 2 && (
                            <div style={{marginTop:12,padding:"14px 18px",background:"#FBF9F3",border:"1px solid #E4E0D5",borderRadius:10}}>
                              <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:6}}>Signature Preview</div>
                              <div style={{fontFamily:"Georgia,serif",fontStyle:"italic",fontSize:28,color:"#0a1628"}}>{paSignatureName}</div>
                            </div>
                          )}
                          <button
                            disabled={paSignatureName.trim().length<=2}
                            style={{width:"100%",marginTop:16,background:paSignatureName.trim().length>2?"#15803d":"#d1d5db",color:"white",border:"none",borderRadius:8,padding:"14px 20px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,cursor:paSignatureName.trim().length>2?"pointer":"not-allowed"}}
                            onClick={async ()=>{
                              const sigDate = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
                              // Effective per-aid price — a confirmed Price Adjustment (§6)
                              // overrides catalog/tier pricing for the session; CROS sides
                              // keep their fixed unit price.
                              const ovr = form.priceOverridePerAid;
                              const pricePerAid = (ovr ?? form.tierPrice) || 0;
                              const isBilateral = (fType === 'bilateral' || fType === 'cros_bicros');
                              const aidCount = isBilateral ? 2 : 1;
                              // Per-ear prices for CROS-aware totals — null when the side isn't
                              // configured so generatePurchaseAgreement falls back to legacy math.
                              const leftEarP  = leftRec  ? ((ovr != null && leftEarPrice?.source  !== 'cros') ? ovr : (leftEarPrice?.price  ?? pricePerAid)) : null;
                              const rightEarP = rightRec ? ((ovr != null && rightEarPrice?.source !== 'cros') ? ovr : (rightEarPrice?.price ?? pricePerAid)) : null;
                              // Private pay bundles the care plan into the per-aid retail price.
                              const isPrivate = form.payType === 'private';
                              const carePlanCost = isPrivate ? 0 : (cpId === 'complete' ? 1250 : cpId === 'punch' ? 575 : 0);
                              if (closerNeedsLocation) { alert("Set your dispensing location in the sidebar before generating a purchase agreement."); setShowCloserPicker(true); return; } const { blob, fileName } = downloadPurchaseAgreement({
                                patient:{name:pName,address:form.address,phone:form.phone,dob:form.dob},
                                devices:{fittingType:fType,left:leftRec,right:rightRec},
                                carePlan:cpId, pricePerAid, payType:form.payType,
                                leftPrice: leftEarP, rightPrice: rightEarP,
                                clinic:clinicObj,
                                provider:{fullName:provName,activeLicense:provLic,signatureUrl:staffProfile?.signatureUrl||null},
                                patientSignature:paSignatureName.trim(), patientSignatureDate:sigDate,
                                deliverySignature:null, deliveryDate:null, signatureImageBase64:paSignatureB64,
                              });
                              if (wizardPatientId) {
                                try {
                                  await uploadPatientDocument({
                                    patientId: wizardPatientId,
                                    clinicId,
                                    staffId,
                                    kind: 'purchase_agreement',
                                    blob, fileName,
                                    metadata: {
                                      carePlan: cpId,
                                      pricePerAid,
                                      aidCount,
                                      deviceTotal: pricePerAid * aidCount,
                                      carePlanCost,
                                      totalPurchasePrice: (pricePerAid * aidCount) + carePlanCost,
                                      fittingType: fType,
                                      payType: form.payType,
                                      patientSignature: paSignatureName.trim(),
                                      includesDelivery: false,
                                      providerName: provName,
                                    },
                                  });
                                } catch (e) {
                                  console.error('Archive purchase agreement (wizard):', e);
                                  alert('Purchase agreement downloaded, but failed to archive to chart: ' + (e.message || e));
                                }
                              }
                              setWizardPaSigned(true);
                              setWizardPaSignatureDate(new Date().toISOString());
                              setShowWizardPaModal(false);
                              setPaStep("review");
                              setStep(7);
                            }}
                          >
                            Sign & Proceed
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
            );
          })()}
        </div>
      </div>
    </>
  );
}