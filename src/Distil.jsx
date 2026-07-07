import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { unwrapIntakeAnswers } from "./recommendationEngine.js";
import { ENVIRONMENTS, SITUATION_LABEL, flaggedEnvironments } from "./listeningSituations.js";
import Icon from "./components/Icon.jsx";
import FinancingCalculator from "./components/FinancingCalculator.jsx";
import DeviceComparison, { techLevelToRank } from "./views/DeviceComparison.jsx";
import ComparisonHub from "./views/ComparisonHub.jsx";
import { LegacyDevicePanel } from "./views/LegacyFastPath.jsx";
import { rankFromTierLabel } from "./deviceComparison.js";
import { parseDateOnly, fmtDate, warrantyDate, daysUntil } from "./lib/dates.js";
import { CARE_ARC, buildCareArc } from "./lib/careArc.js";
import {
  CROS_PRICE_PER_UNIT, isSideCros, manufacturerToClass, uhchCoverageTier,
  nationsCoverageTier, findTierRank, findAnchorForRank, deriveEarPrice, pickBaselinePerAid,
} from "./lib/pricing.js";

// ── Body style images ──
import imgRIC from "./assets/body-styles/RIC.png";
import imgBTE from "./assets/body-styles/bte.png";
import imgITE from "./assets/body-styles/ITE.png";
import imgITC from "./assets/body-styles/ITC.png";
import imgCIC from "./assets/body-styles/cic.png";
import imgIIC from "./assets/body-styles/IIC.png";
import hearingSimUrl from "./assets/audio/hearing-sim.m4a";

// ── Manufacturer logos ──
import logoOticon from "./assets/logos/Oticon.png";
import logoPhonak from "./assets/logos/Phonak.png";
import logoResound from "./assets/logos/Resound.png";
import logoRexton from "./assets/logos/Rexton.png";
import logoSignia from "./assets/logos/Signia.png";
import logoStarkey from "./assets/logos/Starkey.png";
import logoTruHearing from "./assets/logos/TruHearing.png";
import logoWidex from "./assets/logos/Widex.png";
import CareJourney from "./views/CareJourney.jsx";
import HealthHistory from "./views/HealthHistory.jsx";
import UpgradeWizard from "./views/UpgradeWizard.jsx";
import IntakeResponsesAccordion from "./views/IntakeResponsesAccordion.jsx";
import TierSelection from "./views/TierSelection.jsx";
import PrompterSidebar from "./components/PrompterSidebar.jsx";
import CommitmentChecklist from "./components/CommitmentChecklist.jsx";
import Reports from "./views/Reports.jsx";
import { AudigramSVG, getDegreeName, PHONEMES, interpolateThreshold } from "./components/AudiogramSVG.jsx";
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
  saveProductCatalog,
  saveCatalogEntry,
  deleteCatalogEntry,
  loadPendingIntakes,
  subscribeToIntakes,
  acceptIntake as dbAcceptIntake,
  linkIntakeToPatient,
  loadIntakesForPatient,
  createUpgradeCheckinSession,
  updateIntakeAnswers,
  updateIntakeProviderNotes,
  updateIntakeAssessment,
  createProviderIntake,
  dismissIntake,
  signOut,
  enrollPatientInCampaign,
  loadPatientCampaigns,
  seedDefaultCampaign,
  backfillCampaignEnrollment,
  loadInsurancePlansGrouped,
  saveInsurancePlanGroup,
  deleteInsurancePlanGroup,
  loadRebatePromos,
  saveRebatePromo,
  deleteRebatePromo,
  PLAN_TIER_LABELS,
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
  updateVisit,
  uploadPatientDocument,
  listPatientDocuments,
  getDocumentSignedUrl,
  recordUpgradeOutcome,
  logAnalyticsEvent,
  listMessagesForPatient,
  uploadSignatureImage,
  updateStaffSignature,
  logPriceAdjustment,
  deletePatientProfile,
} from "./db.js";
import { downloadPurchaseAgreement } from "./generatePurchaseAgreement.js";
import { downloadQuote } from "./generateQuote.js";

import TnsReasonsPicker from "./components/TnsReasonsPicker.jsx";
import { TNS_TAG_BY_ID } from "./tns_tags.js";
import CreateQuoteModal from "./components/CreateQuoteModal.jsx";
import SendMessageModal from "./components/SendMessageModal.jsx";
import ContentLibrary from "./views/ContentLibrary.jsx";
import NurturePreview from "./views/NurturePreview.jsx";
import CampaignManager from "./views/CampaignManager.jsx";
import LimaCharlie from "./views/LimaCharlie.jsx";
import FollowUpQueue, { countFollowUpPatients } from "./views/FollowUpQueue.jsx";
import CommsInbox from "./views/CommsInbox.jsx";
import ProvidersAdmin from "./views/ProvidersAdmin.jsx";
import AdjustmentHistory from "./views/AdjustmentHistory.jsx";
import CloserLocationPicker from "./views/CloserLocationPicker.jsx";
import AdjustPriceModal from "./views/AdjustPriceModal.jsx";
import CloseAppointmentModal, {
  stashPendingOutcome,
  readPendingOutcome,
  clearPendingOutcome,
} from "./views/CloseAppointmentModal.jsx";


// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const DEFAULT_CLINIC = {
  name: "My Hearing Centers",
  address: "1234 N Hearing Ave, Phoenix, AZ 85012",
  phone: "(602) 555-0100",
  accent: "#16a34a", // green
};


// Source of truth: Supabase insurance_plans table — editable in Admin →
// Insurance Plans, consumed via loadInsurancePlansGrouped(). This array is
// the offline/seed fallback if the DB load fails; verified at full parity
// with the table (85/85 plans, all tiers + prices) on 2026-06-10.
const INSURANCE_PLANS = [
  { carrier:"Anthem", planGroup:"Prefix XMM", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Anthem", planGroup:"MediBlue Access PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Anthem", planGroup:"Preferred Provider Option", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Anthem", planGroup:"Prefix EAU", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"BCBS", planGroup:"BCBS Montana Medicare Advantage PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Arkansas Medipak", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Prefix PBHF", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Prefix XCM", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"AR Blue Medicare Saver Choice PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Prefix MCMAB", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Medicare Advantage Optimum PPO MT", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS Idaho", planGroup:"Prefix XMM Idaho", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS Idaho", planGroup:"Prefix XMA Idaho", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Prefix X2B Idaho", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"TN Blue Advantage Garnet", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"BCBS of Michigan Prefix XYL", tpa:"TruHearing", tiers:[{label:"Standard",price:399}, {label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"BCBS", planGroup:"Blue Care Plus TN", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"BCBS of Idaho", planGroup:"Idaho Medicaid Plus", tpa:"TruHearing", tiers:[{label:"Standard",price:399}, {label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"BCBS of Michigan", planGroup:"Prefix XYL", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"CareSource Ohio", planGroup:"Dual Advantage Medicare/Medicaid", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"CIGNA", planGroup:"True Choice Medicare PPO MNPS; Cigna Med Adv Health Spring products", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Devoted Health", planGroup:"Prime Ohio HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:199}, {label:"Premium",price:499}] },
  { carrier:"Devoted Health", planGroup:"Premium Ohio HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:199}, {label:"Premium",price:499}] },
  { carrier:"Devoted Health", planGroup:"Choice Extra Ohio PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Devoted Health", planGroup:"Core TN HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Devoted Health", planGroup:"Choice Ohio PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Devoted Health", planGroup:"Core OH HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Devoted Health", planGroup:"Ohio Giveback HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"Devoted Health", planGroup:"Dual Plus OH", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}, {label:"Premium",price:299}] },
  { carrier:"DMBA", planGroup:"Deseret Secure", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"DMBA", planGroup:"Deseret Alliance", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Highmark", planGroup:"Prefix T3B", tpa:"TruHearing", tiers:[{label:"Advanced",price:99}, {label:"Premium",price:399}] },
  { carrier:"Highmark", planGroup:"Prefix HRT", tpa:"TruHearing", tiers:[{label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"Highmark", planGroup:"Prefix HRF", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Highmark", planGroup:"Prefix C4K", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:799}] },
  { carrier:"Highmark", planGroup:"Prefix ZWD", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"USAA Honor Giveback PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Humana Essentials Plus Giveback PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"USAA Honor PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Humana Choice Giveback PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Humana Cleveland Clinic Preferred HMO-POS", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Full Access PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Total Complete HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"USAA Honor Giveback HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Humana", planGroup:"Choice PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:299}, {label:"Premium",price:599}] },
  { carrier:"Humana", planGroup:"Value Plus PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Humana", planGroup:"Dual Select HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Humana", planGroup:"Dual Select PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Humana", planGroup:"Gold Plus HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Gold Plus Diabetes and Heart HMO CSNP", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Value Choice PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Humana Choice Diabetes and Heart PPO C-SNP", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Humana", planGroup:"Gold Plus Diabetes HMO CSNP", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Gold Plus Giveback HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Humana Medicare", planGroup:"Humana Medicare Employer PPO Board of Pensions", tpa:"TruHearing", tiers:[{label:"Advanced",price:99}, {label:"Premium",price:399}] },
  { carrier:"Medical Mutual", planGroup:"Medicare Advantage Plans", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Moda", planGroup:"Medicare Supplement", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Moda", planGroup:"Moda Health Central PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"Pacific Source", planGroup:"Medicare Advantage", tpa:"TruHearing", tiers:[{label:"Standard",price:599}, {label:"Advanced",price:799}, {label:"Premium",price:999}] },
  { carrier:"Primetime Health", planGroup:"Medicare Advantage HMO", tpa:"TruHearing", tiers:[{label:"Standard",price:599}, {label:"Advanced",price:799}, {label:"Premium",price:999}] },
  { carrier:"Providence", planGroup:"Choice Plan", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Providence", planGroup:"Medicare Advantage", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Providence", planGroup:"Medicare Flex", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Providence", planGroup:"Providence Medicare Align HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Regence", planGroup:"Prefix ZVX", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Prefix ZVW", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Prefix ZVH", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Prefix ZVU", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Prefix ZHO", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Medicare Supplement Bridge Plan G Prefix YVO", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"SCAN", planGroup:"Prefix 40028942101", tpa:"TruHearing", tiers:[{label:"Advanced",price:450}, {label:"Premium",price:750}] },
  { carrier:"SCAN", planGroup:"Prefix 40045778801", tpa:"TruHearing", tiers:[{label:"Advanced",price:450}, {label:"Premium",price:750}] },
  { carrier:"SCAN", planGroup:"Prefix 40010939801", tpa:"TruHearing", tiers:[{label:"Advanced",price:450}, {label:"Premium",price:750}] },
  { carrier:"SCAN", planGroup:"SCAN Classic HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:550}, {label:"Premium",price:850}] },
  { carrier:"SCAN", planGroup:"SCAN Venture HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:550}, {label:"Premium",price:850}] },
  { carrier:"Select Health Advantage", planGroup:"Medicare Advantage", tpa:"TruHearing", tiers:[{label:"Standard",price:99}, {label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Select Health", planGroup:"Medicare Kroger HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare Choice PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare Essential HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare Classic HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Summit Health", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"UMR", planGroup:"Teachers Health Trust", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Wellpoint / Amerigroup", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  // United Healthcare Hearing — single generic Medicare Supplement plan. NOT a
  // private-label plan (Gold/Platinum tiers keep isPrivateLabelPlan false), so it
  // uses the generic device cascade. Prices in DOLLARS (per-aid). The patient's
  // actual copay is device-driven via UHCH_COVERAGE: a mainstream device resolves
  // to Premium/Standard, a Relate device to Platinum/Gold, off-plan → retail.
  { carrier:"United Healthcare Hearing", planGroup:"Medicare Supplement", tpa:"UHCH", tiers:[{label:"Premium",price:1649}, {label:"Standard",price:1299}, {label:"Platinum",price:1249}, {label:"Gold",price:949}] },
  // NationsBenefits (Nations Hearing) — single generic plan nested under Aetna
  // (~90% of MHC's Nations patients). Device-driven flat copay, same shape as
  // UHCH: the chosen device resolves to a Nations tier via NATIONS_COVERAGE
  // (lib/pricing.js), and that tier's flat per-aid price IS the patient cost.
  // Nations keeps its own 6-rung ladder; prices in DOLLARS per aid. Devices
  // outside Nations' catalog → standard retail + acknowledgement form (see
  // deriveEarPrice 'nations-offplan'). Seed/offline fallback — the live values
  // come from the insurance_plans table (Aetna · Nations Hearing · tpa=Nations).
  { carrier:"Aetna", planGroup:"Nations Hearing", tpa:"Nations", tiers:[{label:"Standard",price:600}, {label:"Select",price:800}, {label:"Superior Plus",price:1150}, {label:"Advanced",price:1450}, {label:"Advanced Plus",price:1625}, {label:"Specialty",price:2000}] },
];


const BODY_STYLES = [
  { id:"ric", label:"RIC / miniRITE", desc:"Receiver-in-canal · Most popular", hasReceiver:true,  hasColor:true,  hasDome:true  },
  { id:"bte", label:"BTE", desc:"Behind-the-ear · Maximum power",              hasReceiver:false, hasColor:true,  hasDome:false },
  { id:"ite", label:"ITE", desc:"In-the-ear · Full shell",                     hasReceiver:false, hasColor:false, hasDome:false },
  { id:"itc", label:"ITC", desc:"In-the-canal · Half shell",                   hasReceiver:false, hasColor:false, hasDome:false },
  { id:"cic", label:"CIC", desc:"Completely-in-canal",                          hasReceiver:false, hasColor:false, hasDome:false },
  { id:"iic", label:"IIC", desc:"Invisible-in-canal",                           hasReceiver:false, hasColor:false, hasDome:false },
  { id:"if",  label:"IF",  desc:"Instant Fit · Dome only, no separate receiver", hasReceiver:false, hasColor:true,  hasDome:true  },
];
const SKIN_TONES = ["Light Beige","Medium Beige","Medium-Dark Beige","Dark Beige","Invisible Matte"];

// ── Rebate editor option sets (Admin → Rebates) ──────────────────────────────
// Values mirror the rebate_promo CHECK constraints exactly — changing a value
// here without the DB constraint (and vice versa) will bounce the save.
const REBATE_TYPE_OPTS = [
  ["seasonal_promo", "Seasonal promotion"],
  ["manufacturer_rebate", "Manufacturer rebate"],
  ["qualifying_program", "Qualifying program"],
];
const REBATE_DISCOUNT_OPTS = [
  ["flat_amount", "$ off (flat amount)"],
  ["percentage", "% off"],
  ["override_price", "Set promo price ($)"],
];
const REBATE_MFR_OPTS = ["signia","phonak","oticon","starkey","resound","widex","rexton","truhearing","other"];
const REBATE_ATTR_OPTS = ["veteran","hardship","loyalty","other"];
const REBATE_TIER_OPTS = [[5,"Premium (5)"],[4,"Advanced (4)"],[3,"Standard (3)"],[2,"Level 2 (2)"],[1,"Level 1 (1)"]];
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;


// ── BODY STYLE IMAGE LOOKUP ──────────────────────────────────────────────────
const BODY_STYLE_IMG = { ric:imgRIC, bte:imgBTE, ite:imgITE, itc:imgITC, cic:imgCIC, iic:imgIIC, if:imgIIC };

// ── MANUFACTURER LOGO LOOKUP ─────────────────────────────────────────────────
const MFR_LOGO = {
  "Oticon":logoOticon, "Phonak":logoPhonak, "Resound":logoResound, "ReSound":logoResound,
  "Rexton":logoRexton, "Signia":logoSignia, "Starkey":logoStarkey,
  "TruHearing":logoTruHearing, "Widex":logoWidex,
};


// ── COLOR HEX MAP ────────────────────────────────────────────────────────────
// Maps hearing aid color names → hex values for visual swatches
const COLOR_HEX_MAP = {
  // ── Neutrals (shared across many brands) ──
  "Black":            "#1a1a1a",
  "Graphite":         "#4a4a4a",
  "Silver":           "#b0b0b0",
  "Beige":            "#d4b896",
  "Dark Brown":       "#4a2c17",
  "Deep Brown":       "#3d1f0e",
  "Sandy Brown":      "#c4a47a",
  "Dark Champagne":   "#b89f7a",
  "Champagne":        "#d4c5a0",
  "Mocha":            "#6b4226",
  "Brown":            "#6b3e26",
  "Chestnut":         "#7b3f00",
  "Tan":              "#c8a882",

  // ── Signia specific ──
  "Pearl White":      "#f0ece4",
  "Fine Gold":        "#c5a55a",
  "Rose Gold":        "#c49a8a",
  "Galactic Blue":    "#2a4b7c",
  "Pearl Pink":       "#e8c4c4",
  "Sporty Red":       "#c0392b",
  "Turquoise":        "#40b5ad",
  "Cosmic Blue":      "#1a3a5c",
  "Snow White":       "#f5f0ea",

  // ── Signia multi-tone (primary color used) ──
  "Black/Black Gloss":"#1a1a1a",
  "Black/Graphite":   "#1a1a1a",
  "Black/Silver":     "#1a1a1a",
  "Black/Chrome":     "#1a1a1a",
  "Black/White":      "#1a1a1a",
  "Black/Champagne":  "#1a1a1a",
  "Cosmic Blue/Rose Gold":"#1a3a5c",
  "Snow White/Rose Gold":"#f5f0ea",
  "Snow White/Silver":"#f5f0ea",
  "Snow White/Snow White Gloss":"#f5f0ea",
  "White/White":      "#f5f0ea",
  "White/Champagne":  "#f5f0ea",
  "Sterling Silver":  "#c0c0c0",
  "White":            "#f5f0ea",

  // ── Oticon specific ──
  "Steel Blue":       "#4682b4",
  "Dust Rose":        "#c4918a",
  "Cobalt Black":     "#1c1c2e",
  "Midnight Black":   "#1a1a2e",
  "Terracotta":       "#c67044",
  "Silver Grey":      "#a8a8a8",
  "Steel Grey":       "#6e6e6e",
  "Chroma Beige":     "#c8b898",

  // ── Phonak specific ──
  "Sand Beige":       "#d4c4a0",
  "Sandalwood":       "#a67b5b",
  "Slate":            "#6e7b8b",
  "Khaki":            "#b8a88a",
  "Anthracite":       "#383838",
  "Cinnamon":         "#8b4513",

  // ── ReSound specific ──
  "Warm Beige":       "#d4b88c",
  "Dark Granite":     "#4a4a50",
  "Sterling":         "#b8b8c0",

  // ── Starkey specific ──
  "Carbon Black":     "#1e1e1e",
  "Sandstone":        "#c4b090",
  "Pewter":           "#8e8e8e",
  "Pearl":            "#e8e0d4",
  "Dark Silver":      "#808088",
  "Brushed Titanium": "#9a9a9a",
  "Ivory":            "#eae0cc",

  // ── Widex specific ──

  // ── Rexton (shares Signia palette mostly) ──

  // ── TruHearing specific ──
  "Granite":          "#6b6b6b",

  // ── Skin tones (ITE/ITC/CIC/IIC) ──
  "Light Beige":      "#e8d4b8",
  "Medium Beige":     "#cdb08a",
  "Medium-Dark Beige":"#b08c60",
  "Dark Beige":       "#8c6840",
  "Invisible Matte":  "#c4a880",

  // ── TruHearing faceplate/shell ──
  "Red/Blue":         "#c0392b",
};

// Extract the secondary color from multi-tone names like "Black/Silver"
function getMultiToneColors(name){
  if(!name.includes("/"))return null;
  const parts=name.split("/").map(s=>s.trim());
  const c1=COLOR_HEX_MAP[parts[0]]||"#888";
  const c2=COLOR_HEX_MAP[parts[1]]||"#888";
  return[c1,c2];
}


// ── PRODUCT CATALOG SEED ──────────────────────────────────────────────────────
// Loaded into storage on first launch. Editable via the Product Catalog screen.
// Schema: { id, manufacturer, generation, family, styles[], variants[],
//           techLevels[], colors[], battery[], active, notes }
const CATALOG_DEFAULT = [
  // ── RELATE (UHCH-exclusive private-label Unitron) — staged inactive ───────
  // tpa:"UHCH" keeps these visible only to UHCH patients (see visibleCatalog).
  // active:false until the exclusivity filter ships; flip on at go-live.
  { id:"relate-40-ric", manufacturer:"Relate", generation:"4.0",
    family:"Relate 4.0 RIC", styles:["ric"], variants:[],
    techLevels:["Platinum","Gold"], colors:[],
    battery:["Rechargeable (Li-Ion)","Size 312"], tpa:"UHCH", active:false, notes:"UHCH-exclusive. Staged inactive until exclusivity filter deploys." },
  { id:"relate-40-bte", manufacturer:"Relate", generation:"4.0",
    family:"Relate 4.0 BTE", styles:["bte"], variants:["Standard BTE","UP BTE"],
    techLevels:["Platinum","Gold"], colors:[],
    battery:["Rechargeable (Li-Ion)"], tpa:"UHCH", active:false, notes:"UHCH-exclusive. Staged inactive." },
  { id:"relate-50-ric", manufacturer:"Relate", generation:"5.0",
    family:"Relate 5.0 RIC", styles:["ric"], variants:[],
    techLevels:["Platinum","Gold"], colors:[],
    battery:["Rechargeable (Li-Ion)"], tpa:"UHCH", active:false, notes:"UHCH-exclusive. Staged inactive." },
  { id:"relate-50-custom", manufacturer:"Relate", generation:"5.0",
    family:"Relate 5.0 Custom", styles:["ite","itc","cic"], variants:[],
    techLevels:["Platinum","Gold"], colors:[],
    battery:["Rechargeable (Li-Ion)","Size 10"], tpa:"UHCH", active:false, notes:"UHCH-exclusive. Staged inactive." },

  // ── SIGNIA IX (2023–present) ─────────────────────────────────────────────
  { id:"sig-pure-ix", manufacturer:"Signia", generation:"IX",
    family:"Pure Charge&Go IX", styles:["ric"],
    variants:["Standard","T (Telecoil)","BCT (Bluetooth Classic)","CROS"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"BCT & T variants launched Feb 2025." },


  { id:"sig-styletto-ix", manufacturer:"Signia", generation:"IX",
    family:"Styletto IX", styles:["ric"],
    variants:["Standard","CROS"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Black/Black Gloss","Black/Graphite","Black/Silver","Cosmic Blue/Rose Gold","Snow White/Rose Gold","Snow White/Silver","Snow White/Snow White Gloss"],
    battery:["Rechargeable"], active:true, notes:"Slim RIC. Launched March 2024." },


  { id:"sig-motion-ix", manufacturer:"Signia", generation:"IX",
    family:"Motion Charge&Go IX", styles:["bte"],
    variants:["M (Medium)","P (Power)","SP (Super Power)"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Black","Beige","Dark Champagne","Deep Brown","Fine Gold","Galactic Blue","Graphite","Pearl Pink","Pearl White","Rose Gold","Sandy Brown","Silver","Sporty Red","Turquoise"],
    battery:["Rechargeable"], active:true, notes:"SP for severe-profound. All variants include telecoil." },


  { id:"sig-silk-ix", manufacturer:"Signia", generation:"IX",
    family:"Silk Charge&Go IX", styles:["if"],
    variants:["Standard","CROS"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Black","Mocha"], faceplate:true,
    battery:["Rechargeable"], active:true, notes:"Instant-fit. No Bluetooth streaming. Faceplate Black/Mocha; shell red (right)/blue (left)." },


  { id:"sig-insio-iic-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX IIC", styles:["iic"],
    variants:["Standard"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Mocha","Black","Deep Brown"],
    battery:["Size 10"], active:true, notes:"Launched Dec 2024. Binaural OneMic Directionality 2.0." },


  { id:"sig-insio-cic-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX CIC", styles:["cic"],
    variants:["Standard","Rechargeable (Insio C&G IX)"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Mocha","Black","Deep Brown"],
    battery:["Size 10","Rechargeable"], active:true, notes:"Rechargeable CIC variant is world's first. Launched 2024." },


  { id:"sig-insio-itc-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX ITC", styles:["itc"],
    variants:["Standard"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:SKIN_TONES,
    battery:["Size 312"], active:true, notes:"Launched Aug 2025." },


  { id:"sig-insio-ite-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX ITE", styles:["ite"],
    variants:["Standard"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:SKIN_TONES,
    battery:["Size 13"], active:true, notes:"Launched Aug 2025." },


  { id:"sig-active-ix", manufacturer:"Signia", generation:"IX",
    family:"Active IX", styles:["if"],
    variants:[],
    techLevels:["7IX","1IX"],
    techLevelLabels:{ "7IX":"Active Pro IX (7IX — full feature set)", "1IX":"Active IX (1IX — entry level)" },
    colors:["Black","White","Champagne"],
    battery:["Rechargeable"], active:true, notes:"Earbud-style instant fit. Active Pro scored top 5% at HearAdvisor." },


  // ── SIGNIA AX (2021–present, still dispensed) ────────────────────────────
  { id:"sig-pure-ax", manufacturer:"Signia", generation:"AX",
    family:"Pure Charge&Go AX", styles:["ric"],
    variants:["Standard","T (Telecoil)","CROS"],
    techLevels:["7AX","5AX","3AX","2AX","1AX"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"Launched May 2021. Still widely dispensed." },


  { id:"sig-pure312-ax", manufacturer:"Signia", generation:"AX",
    family:"Pure 312 AX", styles:["ric"],
    variants:["Standard","T (Telecoil)"],
    techLevels:["7AX","5AX","3AX","2AX","1AX"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Size 312"], active:true, notes:"Disposable battery RIC option on AX platform." },


  { id:"sig-styletto-ax", manufacturer:"Signia", generation:"AX",
    family:"Styletto AX", styles:["ric"],
    variants:["Standard","CROS"],
    techLevels:["7AX","5AX","3AX","2AX","1AX"],
    colors:["Black/Chrome","Black/White","Black/Champagne","Sterling Silver","White/White","White/Champagne","Cosmic Blue"],
    battery:["Rechargeable"], active:true, notes:"Slim RIC on AX platform. Colors approximate — verify with rep." },


  { id:"sig-motion-ax", manufacturer:"Signia", generation:"AX",
    family:"Motion Charge&Go AX", styles:["bte"],
    variants:["M (Medium)","P (Power)","SP (Super Power)"],
    techLevels:["7AX","5AX","3AX","2AX","1AX"],
    colors:["Black","Beige","Dark Champagne","Deep Brown","Graphite","Pearl White","Rose Gold","Sandy Brown","Silver"],
    battery:["Rechargeable"], active:true, notes:"" },


  { id:"sig-silk-ax", manufacturer:"Signia", generation:"AX",
    family:"Silk Charge&Go AX", styles:["if"],
    variants:["Standard"],
    techLevels:["7AX","5AX","3AX"],
    colors:["Black","Mocha"], faceplate:true,
    battery:["Rechargeable"], active:true, notes:"Instant-fit on AX platform. Faceplate Black/Mocha; shell red (right)/blue (left)." },


  { id:"sig-insio-cg-ax-ite", manufacturer:"Signia", generation:"AX",
    family:"Insio Charge&Go AX ITE", styles:["ite"],
    variants:["Standard"],
    techLevels:["7AX","5AX","3AX"],
    colors:SKIN_TONES,
    battery:["Rechargeable"], active:true, notes:"Rechargeable custom ITE — still active line alongside IX customs." },


  { id:"sig-insio-cg-ax-itc", manufacturer:"Signia", generation:"AX",
    family:"Insio Charge&Go AX ITC", styles:["itc"],
    variants:["Standard"],
    techLevels:["7AX","5AX","3AX"],
    colors:SKIN_TONES,
    battery:["Rechargeable"], active:true, notes:"Rechargeable custom ITC — still active line." },


  // ── PHONAK Infinio (2024–present) ────────────────────────────────────────
  { id:"pho-sphere-infinio", manufacturer:"Phonak", generation:"Infinio",
    family:"Audéo Sphere Infinio", styles:["ric"],
    variants:["Ultra Sphere","Sphere","Standard"],
    techLevels:["90","70","50"],
    colors:["Silver","Champagne","Sandalwood","Slate","Midnight Black","Chestnut","Beige"],
    battery:["Rechargeable"], active:true, notes:"Ultra Sphere = dual-chip AI noise. Launched Aug 2024." },


  { id:"pho-audeo-infinio", manufacturer:"Phonak", generation:"Infinio",
    family:"Audéo Infinio", styles:["ric"],
    variants:["Standard","RT (Rechargeable + Telecoil)","312 (Size 312)","CROS"],
    techLevels:["90","70","50","30"],
    colors:["Silver","Champagne","Sandalwood","Slate","Midnight Black","Chestnut","Beige"],
    battery:["Rechargeable","Size 312"], active:true, notes:"" },


  { id:"pho-naida-infinio", manufacturer:"Phonak", generation:"Infinio",
    family:"Naída Infinio", styles:["bte"],
    variants:["P","UP","SP"],
    techLevels:["90","70","50","30"],
    colors:["Silver","Beige","Anthracite","Brown","Cinnamon"],
    battery:["Rechargeable","Size 13","Size 675"], active:true, notes:"Power BTE. P/UP/SP receiver variants." },


  { id:"pho-virto-infinio", manufacturer:"Phonak", generation:"Infinio",
    family:"Virto Infinio", styles:["ite","itc","cic","iic"],
    variants:["Standard","Titanium (IIC only)"],
    techLevels:["90","70","50"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13"], active:true, notes:"Titanium IIC is ultra-small and durable." },


  // ── PHONAK Lumity (2022–present) ─────────────────────────────────────────
  { id:"pho-audeo-lumity", manufacturer:"Phonak", generation:"Lumity",
    family:"Audéo Lumity", styles:["ric"],
    variants:["Standard","Life (waterproof)","RT (Rechargeable + Telecoil)","312","CROS"],
    techLevels:["90","70","50","30"],
    colors:["Silver","Champagne","Sandalwood","Slate","Midnight Black","Chestnut","Beige","Khaki"],
    battery:["Rechargeable","Size 312"], active:true, notes:"Life variant is IP68 waterproof." },


  { id:"pho-naida-lumity", manufacturer:"Phonak", generation:"Lumity",
    family:"Naída Lumity", styles:["bte"],
    variants:["P","UP"],
    techLevels:["90","70","50","30"],
    colors:["Silver","Beige","Anthracite","Brown"],
    battery:["Rechargeable","Size 13","Size 675"], active:true, notes:"" },


  // ── OTICON Intent (2024–present) ─────────────────────────────────────────
  { id:"oti-intent", manufacturer:"Oticon", generation:"Intent",
    family:"Intent", styles:["ric"],
    variants:["miniRITE R","miniRITE R T (Telecoil)","mRITE R (more power)","CROS"],
    techLevels:["1","2","3","4"],
    colors:["Silver","Chestnut","Dust Rose","Champagne","Midnight Black","Beige","Steel Blue"],
    battery:["Rechargeable"], active:true, notes:"Intent 1 = premium, scales down to 4. mRITE R for moderate-severe loss." },


  { id:"oti-own-intent", manufacturer:"Oticon", generation:"Intent",
    family:"Own", styles:["ite","itc","cic","iic"],
    variants:["Standard"],
    techLevels:["1","2","3","4"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13"], active:true, notes:"Custom styles on Intent platform." },


  { id:"oti-xceed", manufacturer:"Oticon", generation:"Intent",
    family:"Xceed", styles:["bte"],
    variants:["SP","UP"],
    techLevels:["1","2","3"],
    colors:["Silver","Beige","Dark Brown","Cobalt Black"],
    battery:["Rechargeable","Size 13","Size 675"], active:true, notes:"Super/Ultra power BTE." },


  // ── OTICON Real (2023) ───────────────────────────────────────────────────
  { id:"oti-real", manufacturer:"Oticon", generation:"Real",
    family:"Real", styles:["ric"],
    variants:["miniRITE R","miniRITE R T (Telecoil)","mRITE R","CROS"],
    techLevels:["1","2","3"],
    colors:["Silver","Chestnut","Dust Rose","Champagne","Midnight Black","Beige"],
    battery:["Rechargeable"], active:true, notes:"Previous generation, still dispensed. 1 = premium, scales down." },


  // ── STARKEY Genesis AI (2023–present) ────────────────────────────────────
  { id:"sta-genesis-ric", manufacturer:"Starkey", generation:"Genesis AI",
    family:"Genesis AI mRIC R", styles:["ric"],
    variants:["Standard","Omega AI (smaller form)"],
    techLevels:["24","20","16","12"],
    colors:["Silver","Black","Rose Gold","Champagne","Mocha","Brushed Titanium","Pewter"],
    battery:["Rechargeable","Size 312"], active:true, notes:"Omega AI launched 2025 — adds AI fall detection." },


  { id:"sta-genesis-bte", manufacturer:"Starkey", generation:"Genesis AI",
    family:"Genesis AI BTE", styles:["bte"],
    variants:["Standard","Power"],
    techLevels:["24","20","16","12"],
    colors:["Silver","Black","Beige","Dark Brown"],
    battery:["Rechargeable","Size 13"], active:true, notes:"" },


  { id:"sta-genesis-custom", manufacturer:"Starkey", generation:"Genesis AI",
    family:"Genesis AI Custom", styles:["ite","itc","cic","iic"],
    variants:["ITE","ITC","CIC","IIC","IIC Rechargeable"],
    techLevels:["24","20","16","12"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13","Rechargeable"], active:true, notes:"" },


  // ── WIDEX Moment (current) ───────────────────────────────────────────────
  { id:"wid-moment-sheer", manufacturer:"Widex", generation:"Moment",
    family:"Moment Sheer", styles:["ric"],
    variants:["sRIC RD (Rechargeable)","312 D (Size 312)","CROS"],
    techLevels:["440","330","220","110"],
    colors:["Silver","Dark Silver","Rose Gold","Pearl","Carbon Black","Sandstone","Champagne","Pewter"],
    battery:["Rechargeable","Size 312"], active:true, notes:"" },


  { id:"wid-moment-bte", manufacturer:"Widex", generation:"Moment",
    family:"Moment BTE", styles:["bte"],
    variants:["Power","Super Power"],
    techLevels:["440","330","220","110"],
    colors:["Silver","Dark Silver","Beige","Carbon Black"],
    battery:["Rechargeable","Size 13"], active:true, notes:"" },


  { id:"wid-moment-custom", manufacturer:"Widex", generation:"Moment",
    family:"Moment Custom", styles:["ite","itc","cic","iic"],
    variants:["ITE","ITC","CIC","IIC"],
    techLevels:["440","330","220","110"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13"], active:true, notes:"" },


  // ── RESOUND Nexia / Vivia (current) ──────────────────────────────────────
  { id:"res-vivia", manufacturer:"Resound", generation:"Nexia",
    family:"Vivia microRIE", styles:["ric"],
    variants:["Standard","MultiMic+"],
    techLevels:["9","7","5","3"],
    colors:["Silver","Champagne","Rose Gold","Chestnut","Carbon Black","Ivory","Slate"],
    battery:["Rechargeable"], active:true, notes:"Launched 2024. Successor to Nexia RIC. One of smallest RICs available." },


  { id:"res-nexia-ric", manufacturer:"Resound", generation:"Nexia",
    family:"Nexia RIE", styles:["ric"],
    variants:["Standard","CROS","BICROS"],
    techLevels:["9","7","5","3"],
    colors:["Silver","Champagne","Rose Gold","Dark Brown","Carbon Black","Ivory"],
    battery:["Rechargeable","Size 312"], active:true, notes:"" },


  { id:"res-enzo-q", manufacturer:"Resound", generation:"Nexia",
    family:"ENZO Q", styles:["bte"],
    variants:["Standard","CROS"],
    techLevels:["9","7","5","3"],
    colors:["Silver","Beige","Dark Brown","Anthracite"],
    battery:["Rechargeable","Size 13","Size 675"], active:true, notes:"Super power BTE." },


  { id:"res-nexia-custom", manufacturer:"Resound", generation:"Nexia",
    family:"Nexia Custom", styles:["ite","itc","cic","iic"],
    variants:["ITE","ITC","CIC"],
    techLevels:["9","7","5","3"],
    colors:SKIN_TONES,
    battery:["Size 13","Size 312","Size 10"], active:true, notes:"" },


  // ── REXTON (WSAudiology sister brand to Signia) ───────────────────────────
  // Rexton (WSAudiology's value brand; Rexton-only per CLAUDE.md — no Beltone
  // proprietary auth). `generation` (IX / AX) is kept purely as the dome key —
  // getDomeOptions routes Rexton through the Signia Gen-3 sleeve set. The
  // patient-facing platform name (Reach / BiCore) lives in the DB's
  // display_generation column and is rendered on the #16 device screen, not
  // from this fallback. MHC dispenses tech levels 80/60/40/20 only (no 30).
  // Mirrors migration 023 — keep in sync (this is a fallback; the live screen
  // reads the DB via loadProductCatalog).
  { id:"rex-reach-plus", manufacturer:"Rexton", generation:"IX",
    family:"Reach R Plus", styles:["ric"],
    variants:["Standard","T (Telecoil)","BC (Bluetooth Classic)","CROS"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"Reach platform (current). Sister product to Signia Pure BCT IX." },
  { id:"rex-reach-r", manufacturer:"Rexton", generation:"IX",
    family:"Reach R", styles:["ric"],
    variants:["Standard","T (Telecoil)","CROS"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"Reach platform (current). Standard RIC." },
  { id:"rex-reach-styleline", manufacturer:"Rexton", generation:"IX",
    family:"Reach Style Line", styles:["ric"],
    variants:["Standard"],
    techLevels:["80","60","40"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"Reach platform (current). Slim-RIC form factor. Premium tiers only." },
  { id:"rex-reach-inox-cic", manufacturer:"Rexton", generation:"IX",
    family:"Reach inoX CIC", styles:["if"],
    variants:["Standard"],
    techLevels:["80","60","40"],
    colors:["Beige","Brown","Black"],
    battery:["Rechargeable"], active:true, notes:"Reach platform (current). Instant-fit CIC. No direct wireless audio streaming. Premium tiers only." },


  { id:"rex-bicore", manufacturer:"Rexton", generation:"AX",
    family:"BiCore R-Li", styles:["ric"],
    variants:["Standard","T (Telecoil)","CROS"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Silver","Pearl White","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"BiCore platform (predecessor). Lithium-ion RIC; R-Li T adds telecoil." },
  { id:"rex-bicore-r312", manufacturer:"Rexton", generation:"AX",
    family:"BiCore R 312", styles:["ric"],
    variants:["Standard","CROS"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Silver","Pearl White","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Size 312"], active:true, notes:"BiCore platform (predecessor). Size 312 zinc-air RIC." },
  { id:"rex-bicore-slim-ric", manufacturer:"Rexton", generation:"AX",
    family:"BiCore Slim-RIC", styles:["ric"],
    variants:["Standard"],
    techLevels:["80","60","40"],
    colors:["Black","Graphite","Silver","Pearl White","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"BiCore platform (predecessor). Slim-RIC form factor. Premium tiers only." },
  { id:"rex-bicore-bte", manufacturer:"Rexton", generation:"AX",
    family:"BiCore BTE", styles:["bte"],
    variants:["M","P","HP"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Silver","Pearl White","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"BiCore platform (predecessor). Standard/Power BTE (M/P/HP)." },
  { id:"rex-bicore-custom", manufacturer:"Rexton", generation:"AX",
    family:"BiCore Custom", styles:["ite","itc"],
    variants:["ITE","ITC"],
    techLevels:["80","60","40","20"],
    colors:[],
    battery:["Rechargeable"], active:true, notes:"BiCore platform (predecessor). Custom ITE/ITC, rechargeable." },
  { id:"rex-bicore-inox-cic", manufacturer:"Rexton", generation:"AX",
    family:"BiCore inoX Click CIC", styles:["if"],
    variants:["Standard"],
    techLevels:["80","60","40"],
    colors:["Beige","Brown","Black"],
    battery:["Size 10"], active:true, notes:"BiCore platform (predecessor). Instant-fit Click CIC, size 10 zinc-air. No direct wireless streaming. Premium tiers only." },


  // ── TRUHEARING (Private-label Signia IX platform) ─────────────────────────
  // ── TRUHEARING SELECT (Private-label WSAudiology products) ─────────────────
  // Plan tier → product (one-to-one): "Premium"→TH7 Premium (48ch·IX), "Advanced"→TH6 Advanced (32ch·AX), "Standard"→TH5 (X)
  // TH5 BTE is always available regardless of plan tier — the plan price covers whatever the clinician fits.

  // ── TH7 Premium · Signia IX · 48ch ── planTierKey:"Premium" ──────────────
  { id:"th7-prem-ric-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — RIC Rechargeable", styles:["ric"],
    variants:["Standard","CROS"], techLevels:["Premium"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · IX platform · Rechargeable Li-Ion." },

  { id:"th7-prem-sr-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — SR Rechargeable (Super Power RIC)", styles:["ric"],
    variants:["Standard"], techLevels:["Premium"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · IX · Super-power RIC · Rechargeable Li-Ion. For severe-profound loss." },

  { id:"th7-prem-if-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — Instant Fit Rechargeable", styles:["ite"],
    variants:["Standard"], techLevels:["Premium"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · IX · IF Li-Ion custom · Rechargeable Li-Ion." },

  { id:"th7-prem-custom", manufacturer:"TruHearing", tpa:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — Custom (IIC / CIC / ITC)", styles:["ite","itc","cic","iic"],
    variants:["IIC","CIC","ITC / HS / FS"], techLevels:["Premium"],
    rechargeable:false, liUpcharge:0,
    battery:["Size 10","Size 312"], active:true,
    notes:"48ch · IX · Non-wireless custom. No Li-Ion upcharge." },

  // ── TH6 Advanced · Signia AX · 32ch ── planTierKey:"Advanced" ────────────
  { id:"th6-adv-ric-312", manufacturer:"TruHearing", tpa:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — RIC 312", styles:["ric"],
    variants:["Standard","CROS"], techLevels:["Advanced"],
    rechargeable:false, liUpcharge:0,
    battery:["Size 312"], active:true,
    notes:"32ch · AX platform · Non-rechargeable RIC. No Li-Ion upcharge." },

  { id:"th6-adv-ric-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — RIC Rechargeable", styles:["ric"],
    variants:["Standard","CROS"], techLevels:["Advanced"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · AX platform · Rechargeable Li-Ion." },

  { id:"th6-adv-sr-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — SR Rechargeable (Super Power RIC)", styles:["ric"],
    variants:["Standard"], techLevels:["Advanced"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · AX · Super-power RIC · Rechargeable Li-Ion. Severe-profound loss." },

  { id:"th6-adv-custom-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — Custom Rechargeable (ITC)", styles:["ite","itc"],
    variants:["ITC / HS / FS"], techLevels:["Advanced"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · AX · ITC Li-Ion custom · Rechargeable Li-Ion." },

  // ── TH5 · Signia X ── planTierKey:"Standard"; BTE always available ────────
  { id:"th5-if", manufacturer:"TruHearing", tpa:"TruHearing", generation:"X",
    thSeries:"TH5", planTierKey:"Standard",
    family:"TH5 Premium — Instant Fit", styles:["ite"],
    variants:["Standard"], techLevels:["Standard"],
    rechargeable:false, liUpcharge:0,
    battery:["Size 10"], active:true,
    notes:"48ch · X platform · Non-wireless IF custom. No Li-Ion upcharge." },

  { id:"th5-bte-adv-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"X",
    thSeries:"TH5", planTierKey:"Standard",
    family:"TH5 Advanced — BTE Rechargeable (32ch)", styles:["bte"],
    variants:["Standard BTE (Thin-tube)","Standard BTE (Earhook)","Power BTE (Thin-tube)","Power BTE (Earhook)","SP BTE"],
    techLevels:["Standard"], rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · X platform · BTE Li-Ion · Rechargeable Li-Ion. Always available regardless of plan tier." },

  { id:"th5-bte-prem-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"X",
    thSeries:"TH5", planTierKey:"Standard",
    family:"TH5 Premium — BTE Rechargeable (48ch)", styles:["bte"],
    variants:["Standard BTE (Thin-tube)","Standard BTE (Earhook)","Power BTE (Thin-tube)","Power BTE (Earhook)","SP BTE"],
    techLevels:["Standard"], rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · X platform · BTE Li-Ion · Rechargeable Li-Ion. Always available regardless of plan tier." },
];
const RECEIVER_LENGTHS = ["0","1","2","3","4","5"];


// ── TRUHEARING DEVICE CONFIG ──────────────────────────────────────────────────
// Encodes the TruHearing website's model/tier/style availability, gain/matrix
// options, color schemes, battery types, and dome options. Drives the private-label
// cascade in Step 3 to mirror the TruHearing ordering portal exactly.

const TH_STYLES = [
  { id:"if",     label:"IF (Instant Fit)" },
  { id:"iic",    label:"IIC (Invisible In the Canal)" },
  { id:"cic",    label:"CIC (Completely In the Canal)" },
  { id:"itc",    label:"ITC (In The Canal)" },
  { id:"hs",     label:"HS (Half Shell)" },
  { id:"fs",     label:"FS (Full Shell)" },
  { id:"s_bte",  label:"S BTE (Standard Behind The Ear)" },
  { id:"p_bte",  label:"P BTE (Power Behind The Ear)" },
  { id:"sp_bte", label:"SP BTE (Super Power Behind The Ear)" },
  { id:"ric",    label:"RIC (Receiver In Canal)" },
  { id:"ric_bct",label:"RIC + BCT" },
  { id:"sr",     label:"SR (Slim RIC)" },
];

// Body-style categories for the TH card picker. Borrows private-pay imagery
// (BODY_STYLE_IMG). IF uses the IIC image. Each category maps to one or more
// specific TH_STYLES ids — when multiple, a Variant sub-picker appears after Model.
const TH_BODY_STYLES = [
  { id:"ric", label:"RIC", desc:"Receiver-in-canal · Most popular", img:imgRIC, thStyleIds:["ric","ric_bct","sr"] },
  { id:"bte", label:"BTE", desc:"Behind-the-ear · Maximum power",    img:imgBTE, thStyleIds:["s_bte","p_bte","sp_bte"] },
  { id:"ite", label:"ITE", desc:"In-the-ear · Full / half shell",    img:imgITE, thStyleIds:["hs","fs"] },
  { id:"itc", label:"ITC", desc:"In-the-canal · Half shell",         img:imgITC, thStyleIds:["itc"] },
  { id:"cic", label:"CIC", desc:"Completely-in-canal",                img:imgCIC, thStyleIds:["cic"] },
  { id:"iic", label:"IIC", desc:"Invisible-in-canal",                 img:imgIIC, thStyleIds:["iic"] },
  { id:"if",  label:"IF",  desc:"Instant Fit",                        img:imgIIC, thStyleIds:["if"] },
];
const TH_STYLE_TO_BODY = Object.fromEntries(
  TH_BODY_STYLES.flatMap(b => b.thStyleIds.map(sid => [sid, b.id]))
);

const TH_MODELS = [
  { id:"th7",   label:"TruHearing 7",    li:false },
  { id:"th7li", label:"TruHearing 7 Li", li:true },
  { id:"th6",   label:"TruHearing 6",    li:false },
  { id:"th6li", label:"TruHearing 6 Li", li:true },
  { id:"th5",   label:"TruHearing 5",    li:false },
  { id:"th5li", label:"TruHearing 5 Li", li:true },
];

// model|techLevel → [style IDs]
const TH_AVAILABILITY = {
  "th7|Standard":   ["iic","cic"],
  "th7|Advanced":   ["cic","itc","hs","fs"],
  "th7|Premium":    ["iic","cic","itc","hs","fs"],
  "th7li|Advanced": ["ric","ric_bct"],
  "th7li|Premium":  ["ric","ric_bct","sr","if"],
  "th6|Standard":   ["ric"],
  "th6|Advanced":   ["ric"],
  "th6|Premium":    ["ric"],
  "th6li|Advanced": ["itc","hs","fs"],
  "th6li|Premium":  ["itc","hs","fs","sr"],
  "th5|Premium":    ["if"],
  "th5li|Advanced": ["s_bte","p_bte","sp_bte"],
  "th5li|Premium":  ["s_bte","p_bte","sp_bte"],
};

// model+style → gain/matrix options; earmold:true means HP encased earmold
const TH_GAIN_MATRIX = {
  "th7|iic":       [{id:"113/50 (S)", label:"113/50 (S)"}],
  "th7|cic":       [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th7|itc":       [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th7|hs":        [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th7|fs":        [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th7li|ric":     [{id:"110/46 (S)", label:"110/46 (S)"},{id:"119/60 (M)", label:"119/60 (M)"},{id:"122/65 (P)", label:"122/65 (P)"},{id:"131/75 (HP)", label:"131/75 (HP)", earmold:true}],
  "th7li|ric_bct": [{id:"110/46 (S)", label:"110/46 (S)"},{id:"119/60 (M)", label:"119/60 (M)"},{id:"122/65 (P)", label:"122/65 (P)"},{id:"131/75 (HP)", label:"131/75 (HP)", earmold:true}],
  "th7li|sr":      [{id:"110/46 (S)", label:"110/46 (S)"},{id:"119/60 (M)", label:"119/60 (M)"},{id:"122/65 (P)", label:"122/65 (P)"}],
  "th7li|if":      [{id:"114/50", label:"114/50"}],
  "th6|ric":       [{id:"110/46 (S)", label:"110/46 (S)"},{id:"119/60 (M)", label:"119/60 (M)"},{id:"122/65 (P)", label:"122/65 (P)"},{id:"131/75 (HP)", label:"131/75 (HP)", earmold:true}],
  "th6li|itc":     [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th6li|hs":      [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th6li|fs":      [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th6li|sr":      [{id:"110/46 (S)", label:"110/46 (S)"},{id:"119/60 (M)", label:"119/60 (M)"},{id:"122/65 (P)", label:"122/65 (P)"}],
  "th5|if":        [{id:"113/50", label:"113/50"}],
  "th5li|s_bte":   [{id:"125/50 Thin-Tube", label:"125/50 Thin-Tube"},{id:"133/60 Earhook", label:"133/60 Earhook"}],
  "th5li|p_bte":   [{id:"130/66 Thin-Tube", label:"130/66 Thin-Tube"},{id:"135/77 Earhook", label:"135/77 Earhook"}],
  "th5li|sp_bte":  [{id:"140/82 Earhook", label:"140/82 Earhook"}],
};

// Color schemes by style category
const TH_COLORS = {
  ric_bte:  ["Beige","Dark Brown","Black","Granite","Sandy Brown"],
  slim_ric: ["Snow White/Rose Gold","Cosmic Blue/Rose Gold","Black/Silver","White","Black"],
  if_faceplate: ["Mocha","Black"],
  if_shell: ["Red/Blue"],
  custom_faceplate: ["Beige","Tan","Mocha","Brown","Dark Brown","Black"],
  custom_shell: ["Beige","Tan","Mocha","Brown","Dark Brown","Black"],
};

// Which style category each TH style belongs to (for color logic)
const TH_STYLE_COLOR_CATEGORY = {
  ric:"ric_bte", ric_bct:"ric_bte", s_bte:"ric_bte", p_bte:"ric_bte", sp_bte:"ric_bte",
  sr:"slim_ric",
  if:"if",
  iic:"custom", cic:"custom", itc:"custom", hs:"custom", fs:"custom",
};

// Battery type auto-determined by model+style
const TH_BATTERY = {
  "th7|iic":"Size 10 (Disposable)", "th7|cic":"Size 10 (Disposable)",
  "th7|itc":"Size 312 (Disposable)", "th7|hs":"Size 312 (Disposable)", "th7|fs":"Size 312 (Disposable)",
  "th7li|ric":"Rechargeable (Li-Ion)", "th7li|ric_bct":"Rechargeable (Li-Ion)", "th7li|sr":"Rechargeable (Li-Ion)", "th7li|if":"Rechargeable (Li-Ion)",
  "th6|ric":"Size 312 (Disposable)",
  "th6li|itc":"Rechargeable (Li-Ion)", "th6li|hs":"Rechargeable (Li-Ion)", "th6li|fs":"Rechargeable (Li-Ion)", "th6li|sr":"Rechargeable (Li-Ion)",
  "th5|if":"Size 10 (Disposable)",
  "th5li|s_bte":"Rechargeable (Li-Ion)", "th5li|p_bte":"Rechargeable (Li-Ion)", "th5li|sp_bte":"Rechargeable (Li-Ion)",
};

// TruHearing dome options — two-step: category → sizes
const TH_DOMES = {
  "Open":   ["5mm","7mm","10mm"],
  "Tulip":  ["8mm","12mm"],
  "Vented": ["XS","S","M","L","XL"],
  "Closed": ["XS","S","M","L","XL"],
  "Power":  ["XS","S","M","L","XL"],
};

// Styles that show receiver length + dome selection
const TH_RECEIVER_STYLES = ["ric","ric_bct","sr"];

// Patient-facing benefit copy for TruHearing tier rows. Each tier is framed
// as capable on its own; the next tier adds capability in noisier / more
// complex listening environments. Avoid disparaging lower tiers.
const TH_TIER_BLURBS = {
  Standard: "Clear, automatic hearing for quieter, one-on-one settings — home, small groups, TV.",
  Advanced: "Adds active noise management and directional focus — restaurants, gatherings, and conversations over background noise become easier to follow.",
  Premium:  "The most sophisticated processing offered — effortless clarity in the hardest listening environments, with richer spatial awareness, steadier streaming, and the lowest listening effort across a full day."
};


// Per-manufacturer receiver power options. earmold:true = auto-requires earmold, no dome
const RECEIVER_POWERS = {
  Signia:  [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  TruHearing:[{id:"S", label:"Standard (S)",   earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  Rexton:  [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  Phonak:  [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  Unitron: [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  Oticon:  [{id:"60", label:"60 Gain",        earmold:false},
            {id:"85", label:"85 Gain",         earmold:false},
            {id:"100",label:"100 Gain",        earmold:false},
            {id:"105",label:"105 Gain (Earmold)",earmold:true}],
  Resound: [{id:"LP",label:"Low Power (LP)",  earmold:false},
            {id:"MP",label:"Medium Power (MP)",earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:false},
            {id:"UP",label:"Ultra Power (UP)", earmold:true }],
  Starkey: [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  Widex:   [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
};


// Signia/Rexton receiver generation sets:
//   2.0 (X, NX, PX): Click Sleeves + Vented Sleeves
//   3.0 (AX, IX):    Sized open/tulip domes + Vented/Closed/Power sleeves
const SIGNIA_DOMES_GEN2 = [
  "Click Sleeve Open XS","Click Sleeve Open S","Click Sleeve Open M","Click Sleeve Open L",
  "Click Sleeve Closed XS","Click Sleeve Closed S","Click Sleeve Closed M","Click Sleeve Closed L",
  "Click Sleeve Power S","Click Sleeve Power M","Click Sleeve Power L",
  "Vented Sleeve XS","Vented Sleeve S","Vented Sleeve M","Vented Sleeve L",
];
const SIGNIA_DOMES_GEN3 = [
  "5mm Open","7mm Open","10mm Open",
  "7mm Tulip","10mm Tulip",
  "Vented Sleeve XS","Vented Sleeve S","Vented Sleeve M","Vented Sleeve L",
  "Closed Sleeve XS","Closed Sleeve S","Closed Sleeve M","Closed Sleeve L",
  "Power Sleeve XS","Power Sleeve S","Power Sleeve M","Power Sleeve L",
];
const SIGNIA_GEN3_PLATFORMS = ["AX","IX"];


// Returns dome options for a given manufacturer + generation
function getDomeOptions(manufacturer, generation) {
  if (manufacturer === "Signia" || manufacturer === "Rexton" || manufacturer === "TruHearing") {
    return SIGNIA_GEN3_PLATFORMS.includes(generation) ? SIGNIA_DOMES_GEN3 : SIGNIA_DOMES_GEN2;
  }
  const DOME_MAP = {
    Phonak:  ["Open Dome S","Open Dome M","Open Dome L",
              "Closed Dome S","Closed Dome M","Closed Dome L",
              "Vented Dome S","Vented Dome M","Vented Dome L",
              "Power Dome M","Power Dome L"],
    Unitron: ["Open Dome S","Open Dome M","Open Dome L",
              "Closed Dome S","Closed Dome M","Closed Dome L",
              "Vented Dome S","Vented Dome M","Vented Dome L",
              "Power Dome M","Power Dome L"],
    Oticon:  ["Open BasePad S","Open BasePad M","Open BasePad L",
              "Closed BasePad S","Closed BasePad M","Closed BasePad L",
              "Double BasePad S","Double BasePad M","Double BasePad L",
              "Power BasePad S","Power BasePad M"],
    Resound: ["Open Dome S","Open Dome M","Open Dome L",
              "Tulip Dome S","Tulip Dome M","Tulip Dome L",
              "Closed Dome S","Closed Dome M","Closed Dome L",
              "Power Dome S","Power Dome M","Power Dome L"],
    Starkey: ["Open Dome S","Open Dome M","Open Dome L",
              "Closed Dome S","Closed Dome M","Closed Dome L",
              "Power Dome M","Power Dome L"],
    Widex:   ["Open Dome S","Open Dome M","Open Dome L",
              "Tulip Dome S","Tulip Dome M",
              "Closed Dome S","Closed Dome M","Closed Dome L"],
  };
  return DOME_MAP[manufacturer] || [];
}
// Internal IDs preserved for backward compatibility with existing patient
// records and downstream code (quote/PA generation, db.js, seed data).
// Labels reflect the current Care Plan screen vocabulary.
const CARE_PLANS = [
  { id:"paygo", label:"Standard Billing", price:"$65 per visit" },
  { id:"complete", label:"Complete Care+", price:"$1,250" },
  { id:"punch", label:"MHC Punch Card", price:"$575" },
];
const VISIT_TYPES = ["New Fitting","2-Week Follow-Up","4-Week Follow-Up","Quarterly Clean & Check","Annual Exam","Triage / Adjustment","Repair Appointment","Other"];
// CARE_ARC + buildCareArc now live in lib/careArc.js (imported above).

const summarizeAudiogram = (p) => {
  if (!p.audiology) return null;
  const { rightT, leftT } = p.audiology;
  const avgThreshold = (ear) => {
    if (!ear) return null;
    const freqs = [1000, 2000, 4000];
    const vals = freqs.map(f => ear[f]).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const classify = (avg) => {
    if (avg === null) return "\u2014";
    if (avg <= 25) return "Normal";
    if (avg <= 40) return "Mild";
    if (avg <= 55) return "Moderate";
    if (avg <= 70) return "Mod-Severe";
    if (avg <= 90) return "Severe";
    return "Profound";
  };
  const rAvg = avgThreshold(rightT);
  const lAvg = avgThreshold(leftT);
  const wrsR = p.audiology.unaidedR ? `${p.audiology.unaidedR}%` : "\u2014";
  const wrsL = p.audiology.unaidedL ? `${p.audiology.unaidedL}%` : "\u2014";
  return {
    severity: `${classify(rAvg)} R \u00B7 ${classify(lAvg)} L`,
    wrs: `WRS ${wrsR} R / ${wrsL} L`,
  };
};

function genId() { return crypto.randomUUID(); }
// parseDateOnly / fmtDate / warrantyDate / daysUntil now live in lib/dates.js
// (imported above) so the date math is unit-testable.


// ── AUDIOGRAM CONSTANTS ───────────────────────────────────────────────────────
const AUDIG_FREQS = [250,500,1000,2000,3000,4000,6000,8000];
function getPTA(t){
  const fs=[500,1000,2000,4000];
  const v=fs.map(f=>t?.[f]).filter(x=>x!=null);
  return v.length?Math.round(v.reduce((a,b)=>a+b)/v.length):null;
}
function getSlope(t){
  if(!t||t[500]==null||t[4000]==null)return"";
  return(t[4000]-t[500])>30?"sloping":(t[4000]-t[500])<-10?"rising":"flat";
}


// ── WORST-THRESHOLD SEVERITY (Change 4) ──────────────────────────────────────
function getWorstThresholdSeverity(thresholds){
  if(!thresholds)return null;
  const vals=Object.values(thresholds).filter(v=>v!=null);
  if(!vals.length)return null;
  const worst=Math.max(...vals);
  if(worst<=20)return"Normal"; if(worst<=40)return"Mild";
  if(worst<=55)return"Moderate"; if(worst<=70)return"Moderately Severe";
  if(worst<=90)return"Severe"; return"Profound";
}
function getWorstThreshold(thresholds){
  if(!thresholds)return null;
  const vals=Object.values(thresholds).filter(v=>v!=null);
  return vals.length?Math.max(...vals):null;
}


// freqToSvgX + interpolateThreshold now live in components/AudiogramSVG.jsx
// (interpolateThreshold imported above for the hearing-sim + results render).


// ── HEARING-LOSS SIMULATION (Web Audio) ──────────────────────────────────────
// A biquad peaking bank attenuates each octave band by the patient's hearing
// loss at that frequency, so a normal-hearing listener hears roughly what the
// patient hears. Drives the A/B "your hearing" mode on the results screen and is
// kept consistent with the phoneme-dimming logic so audio + dimmed text agree.
const SIM_BANDS = [250, 500, 1000, 2000, 4000, 8000];
const SIM_NORMAL_DB = 20;   // domain rule: normal hearing threshold = 20 dB
const SIM_MAX_ATTEN = 55;   // cap per band so it never goes fully silent

// Threshold driving a band's attenuation for the selected ear. 'both' uses the
// worse ear per band — matching the dimming paragraph's "inaudible if either ear
// misses it" rule, so the audio tells the same story as the dimmed text.
function simBandThreshold(aud, freq, ear) {
  const r = interpolateThreshold(aud?.rightT, freq);
  const l = interpolateThreshold(aud?.leftT, freq);
  if (ear === "right") return r;
  if (ear === "left") return l;
  if (r == null) return l;
  if (l == null) return r;
  return Math.max(r, l);
}
function simAttenForBand(aud, freq, ear) {
  const thr = simBandThreshold(aud, freq, ear);
  if (thr == null) return 0;
  return Math.max(0, Math.min(SIM_MAX_ATTEN, thr - SIM_NORMAL_DB));
}


// SPEECH_BANANA_* + PHONEMES now live in components/AudiogramSVG.jsx (PHONEMES
// imported above for the results render). HIGH_FREQ_CONSONANTS stays — only the
// results render's missing-sounds copy uses it.
const HIGH_FREQ_CONSONANTS=['s','th','f','sh','ch','k','t','p'];

// Pre-annotated paragraph for hearing simulation. Each segment: {t:text, ph:phoneme|null}
// Paragraph intentionally loads high-frequency consonants (s,f,th,sh,ch,k,p).
const HEARING_SIM_TEXT = [
  // "Can you hear me? "
  {t:"C",ph:"k"},{t:"a",ph:"a"},{t:"n",ph:"n"},{t:" "},
  {t:"y",ph:"j"},{t:"ou",ph:"u"},{t:" "},
  {t:"h",ph:"h"},{t:"ea",ph:"i"},{t:"r",ph:"r"},{t:" "},
  {t:"m",ph:"m"},{t:"e",ph:"i"},{t:"?"},{t:" "},
  // "My wife says I keep the television too loud, "
  {t:"M",ph:"m"},{t:"y",ph:"a"},{t:" "},
  {t:"w",ph:"v"},{t:"i",ph:"a"},{t:"f",ph:"f"},{t:"e"},{t:" "},
  {t:"s",ph:"s"},{t:"a",ph:"e"},{t:"y",ph:"i"},{t:"s",ph:"z"},{t:" "},
  {t:"I",ph:"a"},{t:" "},
  {t:"k",ph:"k"},{t:"ee",ph:"i"},{t:"p",ph:"p"},{t:" "},
  {t:"th",ph:"th"},{t:"e",ph:"e"},{t:" "},
  {t:"t",ph:"t"},{t:"e",ph:"e"},{t:"l",ph:"l"},{t:"e",ph:"e"},{t:"v",ph:"v"},{t:"i",ph:"i"},{t:"s",ph:"z"},{t:"i",ph:"i"},{t:"o",ph:"o"},{t:"n",ph:"n"},{t:" "},
  {t:"t",ph:"t"},{t:"oo",ph:"u"},{t:" "},
  {t:"l",ph:"l"},{t:"ou",ph:"o"},{t:"d",ph:"d"},{t:","},{t:" "},
  // "but the sound seems fine to me. "
  {t:"b",ph:"b"},{t:"u",ph:"u"},{t:"t",ph:"t"},{t:" "},
  {t:"th",ph:"th"},{t:"e",ph:"e"},{t:" "},
  {t:"s",ph:"s"},{t:"ou",ph:"o"},{t:"n",ph:"n"},{t:"d",ph:"d"},{t:" "},
  {t:"s",ph:"s"},{t:"ee",ph:"i"},{t:"m",ph:"m"},{t:"s",ph:"z"},{t:" "},
  {t:"f",ph:"f"},{t:"i",ph:"a"},{t:"n",ph:"n"},{t:"e"},{t:" "},
  {t:"t",ph:"t"},{t:"o",ph:"u"},{t:" "},
  {t:"m",ph:"m"},{t:"e",ph:"i"},{t:"."},{t:" "},
  // "She thinks I should get my hearing checked. "
  {t:"Sh",ph:"sh"},{t:"e",ph:"i"},{t:" "},
  {t:"th",ph:"th"},{t:"i",ph:"i"},{t:"n",ph:"n"},{t:"k",ph:"k"},{t:"s",ph:"s"},{t:" "},
  {t:"I",ph:"a"},{t:" "},
  {t:"sh",ph:"sh"},{t:"ou",ph:"u"},{t:"l",ph:"l"},{t:"d",ph:"d"},{t:" "},
  {t:"g",ph:"g"},{t:"e",ph:"e"},{t:"t",ph:"t"},{t:" "},
  {t:"m",ph:"m"},{t:"y",ph:"a"},{t:" "},
  {t:"h",ph:"h"},{t:"ea",ph:"i"},{t:"r",ph:"r"},{t:"i",ph:"i"},{t:"n",ph:"n"},{t:"g",ph:"g"},{t:" "},
  {t:"ch",ph:"ch"},{t:"e",ph:"e"},{t:"ck",ph:"k"},{t:"e",ph:"e"},{t:"d",ph:"d"},{t:"."},{t:" "},
  // "I can hear people speaking, "
  {t:"I",ph:"a"},{t:" "},
  {t:"c",ph:"k"},{t:"a",ph:"a"},{t:"n",ph:"n"},{t:" "},
  {t:"h",ph:"h"},{t:"ea",ph:"i"},{t:"r",ph:"r"},{t:" "},
  {t:"p",ph:"p"},{t:"eo",ph:"i"},{t:"p",ph:"p"},{t:"l",ph:"l"},{t:"e",ph:"e"},{t:" "},
  {t:"s",ph:"s"},{t:"p",ph:"p"},{t:"ea",ph:"i"},{t:"k",ph:"k"},{t:"i",ph:"i"},{t:"n",ph:"n"},{t:"g",ph:"g"},{t:","},{t:" "},
  // "but sometimes the words just aren't clear "
  {t:"b",ph:"b"},{t:"u",ph:"u"},{t:"t",ph:"t"},{t:" "},
  {t:"s",ph:"s"},{t:"o",ph:"o"},{t:"m",ph:"m"},{t:"e",ph:"e"},{t:"t",ph:"t"},{t:"i",ph:"a"},{t:"m",ph:"m"},{t:"e",ph:"e"},{t:"s",ph:"z"},{t:" "},
  {t:"th",ph:"th"},{t:"e",ph:"e"},{t:" "},
  {t:"w",ph:"v"},{t:"or",ph:"r"},{t:"d",ph:"d"},{t:"s",ph:"z"},{t:" "},
  {t:"j",ph:"j"},{t:"u",ph:"u"},{t:"s",ph:"s"},{t:"t",ph:"t"},{t:" "},
  {t:"a",ph:"a"},{t:"r",ph:"r"},{t:"e",ph:"e"},{t:"n",ph:"n"},{t:"'t"},{t:" "},
  {t:"c",ph:"k"},{t:"l",ph:"l"},{t:"ea",ph:"i"},{t:"r",ph:"r"},{t:" "},
  // "— especially in a restaurant "
  {t:"\u2014"},{t:" "},
  {t:"e",ph:"e"},{t:"s",ph:"s"},{t:"p",ph:"p"},{t:"e",ph:"e"},{t:"ci",ph:"sh"},{t:"a",ph:"a"},{t:"ll",ph:"l"},{t:"y",ph:"i"},{t:" "},
  {t:"i",ph:"i"},{t:"n",ph:"n"},{t:" "},
  {t:"a",ph:"a"},{t:" "},
  {t:"r",ph:"r"},{t:"e",ph:"e"},{t:"s",ph:"s"},{t:"t",ph:"t"},{t:"au",ph:"o"},{t:"r",ph:"r"},{t:"a",ph:"a"},{t:"n",ph:"n"},{t:"t",ph:"t"},{t:" "},
  // "or when the kids are talking fast."
  {t:"or",ph:"r"},{t:" "},
  {t:"wh",ph:"v"},{t:"e",ph:"e"},{t:"n",ph:"n"},{t:" "},
  {t:"th",ph:"th"},{t:"e",ph:"e"},{t:" "},
  {t:"k",ph:"k"},{t:"i",ph:"i"},{t:"d",ph:"d"},{t:"s",ph:"z"},{t:" "},
  {t:"a",ph:"a"},{t:"r",ph:"r"},{t:"e"},{t:" "},
  {t:"t",ph:"t"},{t:"a",ph:"a"},{t:"l",ph:"l"},{t:"k",ph:"k"},{t:"i",ph:"i"},{t:"n",ph:"n"},{t:"g",ph:"g"},{t:" "},
  {t:"f",ph:"f"},{t:"a",ph:"a"},{t:"s",ph:"s"},{t:"t",ph:"t"},{t:"."},
];


// AudigramSVG now lives in components/AudiogramSVG.jsx (imported above) — shared
// by the new-patient results render and the AudiogramEntry component.


// ── COUNSELING NARRATIVE GENERATOR ─────────────────────────────────────────
function generateCounseling(aud){
  if(!aud)return null;
  const rPTA=getPTA(aud.rightT), lPTA=getPTA(aud.leftT);
  const rDeg=getDegreeName(rPTA), lDeg=getDegreeName(lPTA);
  const rSlope=getSlope(aud.rightT), lSlope=getSlope(aud.leftT);
  const hasPT=rPTA!=null||lPTA!=null;
  const hasCCT=aud.unaidedR!=null||aud.unaidedL!=null;
  const hasAided=aud.aidedR!=null||aud.aidedL!=null;
  const hasSIN=aud.sinBin!=null;
  if(!hasPT&&!hasCCT&&!hasSIN)return null;


  const slopeSentence=slope=>slope==="sloping"
    ?" The loss drops significantly toward the high frequencies — this affects the consonants that carry meaning (S, F, TH, SH, K), which is why speech often sounds muffled even when it's loud enough.":"";


  const ptaSection=()=>{
    if(!hasPT)return null;
    const both=rDeg&&lDeg;
    const desc=both&&rDeg===lDeg
      ?`a ${rDeg.toLowerCase()} hearing loss in both ears`
      :[rDeg&&`a ${rDeg.toLowerCase()} loss in the right ear`,lDeg&&`a ${lDeg.toLowerCase()} loss in the left ear`].filter(Boolean).join(" and ");
    const maxPTA=Math.max(rPTA??0,lPTA??0);
    return{
      heading:"What your audiogram shows",
      body:`Your results indicate ${desc}.${slopeSentence(rSlope)} Sounds need to be approximately ${maxPTA} dB louder than normal before they register clearly — that's not a small gap. What we're looking at here isn't just "needing the TV up a bit." This is the measurable reason conversations feel like work.`
    };
  };


  const cctSection=()=>{
    if(!hasCCT)return null;
    const r=aud.unaidedR, l=aud.unaidedL;
    const worst=Math.min(r??100,l??100);
    const gap=100-worst;
    const earStr=r!=null&&l!=null?`right (${r}%) and left (${l}%)`
      :r!=null?`right ear: ${r}%`:`left ear: ${l}%`;
    return{
      heading:"How your loss affects word clarity",
      body:`At 45 dB — the softest level at which someone with normal hearing scores 100% on this assessment — you scored ${earStr}. Think of this as the audiological equivalent of the 20/20 line at an eye exam. The ${gap}% gap${gap>25?" isn't subtle — it represents real, measurable difficulty with everyday speech clarity. Not volume, but clarity. Letters and words that sound similar become genuinely hard to separate.":gap>10?" shows meaningful impact on speech clarity, particularly in less-than-ideal conditions.":" reflects very good word recognition ability given the degree of loss."}`
    };
  };


  const aidedSection=()=>{
    if(!hasAided)return null;
    const r=aud.aidedR, l=aud.aidedL;
    const ur=aud.unaidedR, ul=aud.unaidedL;
    const rDelta=r!=null&&ur!=null?r-ur:null;
    const lDelta=l!=null&&ul!=null?l-ul:null;
    const bestDelta=Math.max(rDelta??0,lDelta??0);
    const earStr=r!=null&&l!=null?`right (${r}%) and left (${l}%)`
      :r!=null?`right ear: ${r}%`:`left ear: ${l}%`;
    return{
      heading:"Your potential with correction",
      body:`At your most comfortable listening level — with properly fitted amplification — you scored ${earStr} on speech recognition. ${(r??0)>=85||(l??0)>=85?"This is an excellent result. Your word recognition potential is strong, which means you'll adapt well and get substantial benefit from treatment.":((r??0)>=70||(l??0)>=70)?"This is a solid result and reflects good potential with hearing aids.":"This score, combined with your audiogram, helps us select technology that best suits your pattern of loss."}`
    };
  };


  const sinSection=()=>{
    if(!hasSIN)return null;
    const snr=aud.sinBin;
    if(snr==null)return null;
    const label=snr<=2?"near-normal":snr<=7?"mild":snr<=15?"moderate":"severe";
    const body=snr<=2
      ?`Your ability to separate speech from background noise is near-normal — you have a real advantage here compared to most patients I see. Noisy environments may still feel tiring, but technology will provide meaningful support.`
      :snr<=7
      ?`You need about ${snr} dB more signal-to-noise separation than someone with normal hearing. This quantifies exactly why restaurants, meetings, and group conversations feel like hard work — your auditory system is doing extra processing just to keep up. Modern hearing aids with directional processing and noise management can recover a meaningful portion of this gap.`
      :snr<=15
      ?`You need ${snr} dB more separation between speech and noise than normal — this is a significant deficit that explains why noisy environments feel genuinely exhausting, not just inconvenient. Most patients are relieved to have this validated. Premium technology with advanced noise management provides real improvement, though complex environments will remain the hardest situation regardless of technology.`
      :`With an SNR Loss of ${snr} dB, competing noise creates serious difficulty that goes well beyond what most people experience. Understanding this upfront is important — it sets honest expectations. What technology does here is reduce fatigue, extend your effective range, and make the best situations better. That's a meaningful quality-of-life change even if the hardest environments remain hard.`;
    return{heading:`Background noise: ${label} difficulty (${snr} dB SNR Loss)`,body};
  };


  return[ptaSection(),cctSection(),aidedSection(),sinSection()].filter(Boolean);
}


// ── WIZARD STEPS ──────────────────────────────────────────────────────────────
const STEPS = ["Patient","Health History","Testing","Results","Technology Tier","Device Selection","Care Plan","Commitment"];

// Narrative Thread (backlog #8) — each wizard step belongs to one of five
// chapters. Used to key the provider prompter sidebar to the current chapter.
const STEP_TO_CHAPTER = [1, 1, 2, 2, 3, 3, 4, 5];
const CHAPTER_TITLES = ["Patient story", "Evidence", "Recommendation", "Investment", "Commitment"];


// ── ROLE CHECK UTILITY ─────────────────────────────────────────────────────────
// Role categories: 'care_coordinator' | 'provider' | 'closer' | 'admin'
// This is UI gating (defense-in-depth). The real enforcement is in Postgres RLS:
// catalog (product_catalog/product_catalog_tier), pricing (clinic_retail_anchors)
// and insurance_plans writes are all admin-only, and a trigger blocks non-admins
// from self-escalating their staff.role — see migration
// 20260624000000_harden_admin_rls_catalog_and_staff_role.sql.
function checkRole(staffRole, allowedRoles) {
  return Array.isArray(allowedRoles) && allowedRoles.includes(staffRole);
}


// Downscale a signature image file to a compact PNG data URL. Signatures are
// line art, so a 600px-wide PNG is plenty and keeps both storage and the
// signature embedded in every purchase-agreement PDF small. Returns a data: URL.
function downscaleSignature(file, maxW = 600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}


// Pick the license matching a clinic's state from a {STATE: number} map,
// mirroring loadStaffProfile's resolution. Falls back to the first license.
// Used to print the right state license when a closer dispenses under a local
// provider at the event clinic.
function pickLicenseForClinic(licenses, address) {
  const parts = (address || "").split(",").map(s => s.trim());
  const stateZip = parts[parts.length - 1] || "";
  const m = stateZip.match(/\b([A-Z]{2})\b/);
  const state = m ? m[1] : null;
  const lic = licenses || {};
  return (state && lic[state]) ? lic[state] : (Object.values(lic)[0] || "");
}


// Per-ear pricing (CROS_PRICE_PER_UNIT, isSideCros, manufacturerToClass,
// uhchCoverageTier, findTierRank, findAnchorForRank, deriveEarPrice,
// pickBaselinePerAid) now lives in lib/pricing.js (imported above) so the
// money math is unit-testable.

// Patient-detail appointment list — collapsed to the next visit by default; expands to the full arc (backlog #5).
function AppointmentSchedule({ appointments }) {
  const [expanded, setExpanded] = useState(false);
  if (!appointments?.length) return null;
  const sorted = [...appointments].sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcoming = sorted.filter(a => daysUntil(a.date) >= 0);
  const past = sorted.filter(a => daysUntil(a.date) < 0).reverse();
  const next = upcoming[0] || null;
  const restUpcoming = upcoming.slice(1);
  const hiddenCount = restUpcoming.length + past.length;
  const relHint = (dateStr) => {
    const d = daysUntil(dateStr);
    return d <= 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
  };
  const row = (a, key, muted) => (
    <div className="detail-row" key={key}>
      <span className="detail-key" style={muted ? { color: "#9ca3af" } : undefined}>{a.type}</span>
      <span className="detail-val" style={muted ? { color: "#9ca3af" } : undefined}>{fmtDate(a.date)}</span>
    </div>
  );
  return (
    <div className="detail-card full">
      <div className="detail-card-title">
        Appointment Schedule{upcoming.length > 0 ? ` · ${upcoming.length} upcoming` : ""}
      </div>
      {next ? (
        <div style={{ background: "#eff6ff", borderLeft: "3px solid #1d4ed8", borderRadius: 4, padding: "6px 8px", margin: "3px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0a1628" }}>
              {next.type}
              <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#1d4ed8", background: "#dbeafe", borderRadius: 4, padding: "1px 5px", letterSpacing: 0.5 }}>NEXT</span>
            </span>
            <span style={{ fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>
              {fmtDate(next.date)}
              <span style={{ marginLeft: 6, fontSize: 11, color: "#6b7280" }}>({relHint(next.date)})</span>
            </span>
          </div>
          {next.note && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, lineHeight: 1.4 }}>{next.note}</div>}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#9ca3af", padding: "4px 0" }}>No upcoming appointments.</div>
      )}
      {expanded && (
        <>
          {restUpcoming.map((a, i) => row(a, `u${i}`, false))}
          {past.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#9ca3af", margin: "10px 0 2px" }}>Past</div>
              {past.map((a, i) => row(a, `p${i}`, true))}
            </>
          )}
        </>
      )}
      {hiddenCount > 0 && (
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: "none", border: "none", color: "#1d4ed8", fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "6px 0 0" }}>
          {expanded ? "Show less" : `Show full schedule (${hiddenCount} more)`}
        </button>
      )}
    </div>
  );
}

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
  const [paSignatureName, setPaSignatureName] = useState("");
  const [paStep, setPaStep] = useState("sign"); // 'sign' | 'delivery' | 'done'
  const [paDeliveryName, setPaDeliveryName] = useState("");
  const [paDeliveryDate, setPaDeliveryDate] = useState("");

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


  const EMPTY_SIDE = () => ({
    style:"", manufacturer:"", generation:"", familyId:"", variant:"",
    techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:"", isCROS:false,
    thModel:"", thBodyStyle:"", faceplateColor:"", shellColor:"", gainMatrix:"", domeCategory:"", domeSize:""
  });


  // New patient form state
  const [form, setForm] = useState({
    intakeId: null,
    firstName:"", lastName:"", dob:"", phone:"", email:"", address:"",
    payType:"insurance",
    carrier:"", planGroup:"", tpa:"", tier:"", tierPrice:null, priceOverridePerAid:null,
    left: {style:"", manufacturer:"", generation:"", familyId:"", variant:"", techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:"", isCROS:false, thModel:"", thBodyStyle:"", faceplateColor:"", shellColor:"", gainMatrix:"", domeCategory:"", domeSize:""},
    right: {style:"", manufacturer:"", generation:"", familyId:"", variant:"", techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:"", isCROS:false, thModel:"", thBodyStyle:"", faceplateColor:"", shellColor:"", gainMatrix:"", domeCategory:"", domeSize:""},
    audiology: { rightT:{}, leftT:{}, rightBC:{}, leftBC:{}, rightMask:{}, leftMask:{}, rightBCMask:{}, leftBCMask:{}, tinnitusRight:false, tinnitusLeft:false, unaidedR:null, unaidedL:null, aidedR:null, aidedL:null, wrMclR:null, wrMclL:null, sinBin:null, cctR:null, cctL:null, cctLevelR:null, cctLevelL:null },
    carePlan:"",
    appointments:[],
    notes:"",
  });


  const [activeSide, setActiveSide] = useState("left");
  const [phonemeDimMode, setPhonemeDimMode] = useState("both");
  const [dimIntensity, setDimIntensity] = useState(75); // 0 = no dimming, 100 = full fade

  // ── Hearing-loss simulation (audio) ──
  const [simPlaying, setSimPlaying] = useState(false);
  const [simMode, setSimMode] = useState("yours"); // 'typical' | 'yours'
  const audioCtxRef = useRef(null);
  const simBufferRef = useRef(null);   // decoded AudioBuffer (fetched once)
  const simSourceRef = useRef(null);   // current AudioBufferSourceNode
  const simFiltersRef = useRef([]);    // current BiquadFilterNode bank
  const simAudRef = useRef(null);      // audiology snapshot driving the live bank

  const applySimGains = useCallback(() => {
    const ctx = audioCtxRef.current, filters = simFiltersRef.current;
    if (!ctx || !filters.length) return;
    filters.forEach((flt, i) => {
      const atten = simMode === "yours" ? simAttenForBand(simAudRef.current, SIM_BANDS[i], phonemeDimMode) : 0;
      flt.gain.setTargetAtTime(-atten, ctx.currentTime, 0.04);
    });
  }, [simMode, phonemeDimMode]);

  const stopHearingSim = useCallback(() => {
    try { simSourceRef.current?.stop(); } catch (e) { /* already stopped */ }
    simSourceRef.current = null;
    setSimPlaying(false);
  }, []);

  const playHearingSim = useCallback(async (aud) => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      if (!simBufferRef.current) {
        const bytes = await (await fetch(hearingSimUrl)).arrayBuffer();
        simBufferRef.current = await ctx.decodeAudioData(bytes);
      }
      try { simSourceRef.current?.stop(); } catch (e) { /* none playing */ }
      simAudRef.current = aud;
      const src = ctx.createBufferSource();
      src.buffer = simBufferRef.current;
      // Peaking filter bank — one per octave band, attenuated by that band's loss.
      const filters = SIM_BANDS.map((f) => {
        const flt = ctx.createBiquadFilter();
        flt.type = "peaking";
        flt.frequency.value = f;
        flt.Q.value = 1.0;
        flt.gain.value = simMode === "yours" ? -simAttenForBand(aud, f, phonemeDimMode) : 0;
        return flt;
      });
      let node = src;
      filters.forEach((flt) => { node.connect(flt); node = flt; });
      node.connect(ctx.destination);
      simFiltersRef.current = filters;
      simSourceRef.current = src;
      src.onended = () => { if (simSourceRef.current === src) { simSourceRef.current = null; setSimPlaying(false); } };
      setSimPlaying(true);
      src.start();
    } catch (e) {
      console.error("hearing sim playback:", e);
      alert("Could not play the hearing simulation: " + (e.message || e));
      setSimPlaying(false);
    }
  }, [simMode, phonemeDimMode]);

  // Live-update the bank when the A/B mode or ear changes mid-playback so the
  // audio always agrees with the on-screen dimming.
  useEffect(() => { if (simPlaying) applySimGains(); }, [simMode, phonemeDimMode, simPlaying, applySimGains]);

  // Tear down audio on unmount.
  useEffect(() => () => {
    try { simSourceRef.current?.stop(); } catch (e) { /* noop */ }
    try { audioCtxRef.current?.close?.(); } catch (e) { /* noop */ }
  }, []);

  // Audiogram drawing overlay state
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [drawPaths, setDrawPaths] = useState([]);       // [{points, color, width}]
  const [drawColor, setDrawColor] = useState("#dc2626");
  const drawCanvasRef = useRef(null);
  const drawingRef = useRef(false);                      // is pointer currently down
  const currentPathRef = useRef(null);                   // in-progress path

  const redrawCanvas = useCallback((paths, inProgress) => {
    const c = drawCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    const renderPath = (p) => {
      if (!p || p.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) ctx.lineTo(p.points[i].x, p.points[i].y);
      ctx.stroke();
    };
    paths.forEach(renderPath);
    if (inProgress) renderPath(inProgress);
  }, []);

  const getCanvasPoint = useCallback((e) => {
    const c = drawCanvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }, []);

  const onDrawPointerDown = useCallback((e) => {
    e.preventDefault();
    drawingRef.current = true;
    const pt = getCanvasPoint(e);
    currentPathRef.current = { points: [pt], color: drawColor, width: 3 };
    drawCanvasRef.current?.setPointerCapture(e.pointerId);
  }, [drawColor, getCanvasPoint]);

  const onDrawPointerMove = useCallback((e) => {
    if (!drawingRef.current || !currentPathRef.current) return;
    e.preventDefault();
    currentPathRef.current.points.push(getCanvasPoint(e));
    redrawCanvas(drawPaths, currentPathRef.current);
  }, [drawPaths, getCanvasPoint, redrawCanvas]);

  const onDrawPointerUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const finishedPath = currentPathRef.current;
    currentPathRef.current = null;
    if (finishedPath && finishedPath.points.length >= 2) {
      setDrawPaths(prev => [...prev, finishedPath]);
      redrawCanvas([...drawPaths, finishedPath], null);
    }
  }, [drawPaths, redrawCanvas]);

  // Resize canvas to match container
  useEffect(() => {
    if (!drawingEnabled) return;
    const c = drawCanvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = parent.offsetWidth * dpr;
      c.height = parent.offsetHeight * dpr;
      c.style.width = parent.offsetWidth + "px";
      c.style.height = parent.offsetHeight + "px";
      redrawCanvas(drawPaths, null);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [drawingEnabled, drawPaths, redrawCanvas]);

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


  useEffect(() => {
    loadAllPatients(clinicId).then(p => { setPatients(p); setLoading(false); });
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
    setEditDraft({ firstName, lastName, phone: p.phone || "", email: p.email || "", dob: p.dob || "", payType: p.payType || "insurance", notes: p.notes || "" });
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
        notes:      editDraft.notes  || null,
      });
      const newName = [editDraft.firstName, editDraft.lastName].filter(Boolean).join(" ");
      setSelectedPatient(p => ({ ...p, name: newName, phone: editDraft.phone, email: editDraft.email, dob: editDraft.dob, payType: editDraft.payType, notes: editDraft.notes }));
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
      warrantyExpiry: p.devices?.warrantyExpiry || "",
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
          warranty_expiry:    editDraft.warrantyExpiry || null,
        },
        selectedPatient._ids?.coverageId || null
      );
      setSelectedPatient(p => ({
        ...p,
        carePlan: editDraft.carePlanType,
        insurance: { ...p.insurance, carrier: editDraft.carrier, planGroup: editDraft.planGroup, tpa: editDraft.tpa, tier: editDraft.tier, tierPrice: editDraft.tierPrice },
        devices: p.devices ? { ...p.devices, warrantyExpiry: editDraft.warrantyExpiry } : p.devices,
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

  // Care plan analytics — fire care_plan_viewed once per (patient, step)
  // when step 6 mounts. Reset trackers when the patient changes so each
  // session gets fresh view/change events.
  const carePlanViewedRef = useRef(null);
  const carePlanChangeCountRef = useRef(0);
  useEffect(() => {
    carePlanViewedRef.current = null;
    carePlanChangeCountRef.current = 0;
  }, [wizardPatientId]);
  useEffect(() => {
    if (step !== 6 || !wizardPatientId) return;
    const key = `${wizardPatientId}:6`;
    if (carePlanViewedRef.current === key) return;
    carePlanViewedRef.current = key;
    logAnalyticsEvent("care_plan_viewed", {
      patient_id: wizardPatientId,
      provider_id: staffId,
      clinic_id: clinicId,
    });
  }, [step, wizardPatientId, staffId, clinicId]);

  // .main keeps its scroll offset across step swaps — reset it when Care Plan (6) loads.
  const mainRef = useRef(null);
  useLayoutEffect(() => {
    if (step === 6) mainRef.current?.scrollTo(0, 0);
  }, [step]);

  // Clear non-TruHearing device selections when a private-label plan is chosen
  useEffect(() => {
    if (!isPrivateLabel) return;
    const emptySide = {style:"",manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:"",isCROS:false};
    setForm(f => ({
      ...f,
      left:  (f.left.manufacturer && f.left.manufacturer !== "TruHearing")  ? {...emptySide} : f.left,
      right: (f.right.manufacturer && f.right.manufacturer !== "TruHearing") ? {...emptySide} : f.right,
    }));
  }, [isPrivateLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync the chosen tier (form.tier from the Technology Tier wizard step)
  // into each side's techLevel when entering Device Selection. If a side
  // already has a different tier configured (e.g. user went back and
  // changed tier), reset the side so the cascade re-derives availability
  // for the new tier.
  useEffect(() => {
    if (!isPrivateLabel || !form.tier) return;
    setForm(f => {
      const next = { ...f };
      ["left","right"].forEach(side => {
        if (f[side].techLevel === form.tier) return;
        next[side] = { ...EMPTY_SIDE(), manufacturer:"TruHearing", techLevel: form.tier };
      });
      return next;
    });
  }, [isPrivateLabel, form.tier]); // eslint-disable-line react-hooks/exhaustive-deps


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
        generation: "IX",
        family: thMod?.label || "TruHearing Select",
        thModel: s.thModel || "",
        thSeries: "",
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
      tpa: form.tpa,
      carrier: form.carrier,
      audiology: form.audiology,
      counselingSections: counselingSections,
      clinic: paClinic,
      provider: paProvider,
    });

    if (wizardPatientId) {
      try {
        const isBilateral = (fittingType === 'bilateral' || fittingType === 'cros_bicros');
        await uploadPatientDocument({
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
    const years = form.payType === "insurance" && form.carePlan === "complete" ? 4 : 3;
    const warrantyStart = wizardPaSignatureDate
      ? new Date(new Date(wizardPaSignatureDate).getTime() + 14 * 86400000).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Upgrade mode operates on an already-active patient — finalizing without
    // a signed PA (e.g. they took a quote home) must not demote them to TNS.
    // The retention outcome is already recorded by the UpgradeWizard close.
    // A 'committed' device disposition counts like a signed PA: the provider
    // is attesting the patient signed today (e.g. on paper).
    const finalizeStatus = (wizardPaSigned || deviceDisposition === "committed")
      ? "active"
      : (wizardMode === "upgrade" ? "active" : "tns");

    // Incremental save path — patient already exists in DB as draft
    if (wizardPatientId) {
      try {
        const carePlan = form.payType === "insurance" ? form.carePlan : null;
        const privatePay = form.payType === "private" && form.tierPrice != null
          ? { tier: form.tier, tierPrice: form.tierPrice }
          : null;
        // Regimented care arc — full 4-year schedule auto-generated at finalize for a signed fitting (backlog #5).
        const existingApptKeys = new Set((form.appointments || []).map(a => `${a.type}|${a.date}`));
        const careArc = wizardPaSigned
          ? buildCareArc(warrantyStart).filter(a => !existingApptKeys.has(`${a.type}|${a.date}`))
          : [];
        const finalizeAppointments = [...(form.appointments || []), ...careArc];
        await finalizePatient(
          wizardPatientId,
          finalizeStatus,
          { fittingDate: warrantyStart, warrantyExpiry: wizardPaSigned ? warrantyDate(warrantyStart, years) : null },
          carePlan,
          form.notes,
          finalizeAppointments,
          staffId, clinicId,
          privatePay,
          wizardVisitId
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
          insurance: form.payType === "insurance" ? { carrier: form.carrier, planGroup: form.planGroup, tpa: form.tpa, tier: form.tier, tierPrice: form.tierPrice } : null,
          privatePay,
          devices: { left: leftRec, right: rightRec, fittingType, manufacturer: primary?.manufacturer || "", family: primary?.family || "", techLevel: primary?.techLevel || "", style: primary?.style || "", color: primary?.color || "", battery: primary?.battery || "", fittingDate: warrantyStart, warrantyExpiry: wizardPaSigned ? warrantyDate(warrantyStart, years) : null, serialLeft: genId(), serialRight: genId() },
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
      insurance: form.payType === "insurance" ? { carrier: form.carrier, planGroup: form.planGroup, tpa: form.tpa, tier: form.tier, tierPrice: form.tierPrice } : null,
      privatePay: form.payType === "private" && form.tierPrice != null
        ? { tier: form.tier, tierPrice: form.tierPrice }
        : null,
      devices: {
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
        warrantyExpiry: wizardPaSigned ? warrantyDate(warrantyStart, years) : null,
        serialLeft: genId(),
        serialRight: genId(),
      },
      audiology: form.audiology,
      carePlan: form.payType === "insurance" ? form.carePlan : null,
      appointments: form.appointments,
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
    return {
      // Non-TPA carriers stay out of the TPA attach-rate denominator.
      payerType: ins?.tpa ? "tpa" : "other_insurance",
      payerName: ins?.tpa || ins?.carrier || null,
      payerPlanSnapshot: ins
        ? { carrier: ins.carrier || null, plan_group: ins.planGroup || null, tpa: ins.tpa || null, tier: ins.tier || null, tier_price_per_aid: ins.tierPrice ?? null }
        : null,
    };
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
    // The wizard opened this visit at draft time; the close ends it.
    if (wizardVisitId) {
      try { await updateVisit(wizardVisitId, { status: "completed" }); }
      catch (e) { console.error("close visit:", e); }
    }
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
    setCloseAppointment(null);
  };


  const startNew = () => {
    setForm({ intakeId:null,firstName:"",lastName:"",dob:"",phone:"",email:"",payType:"insurance",carrier:"",planGroup:"",tpa:"",tier:"",tierPrice:null,left:{style:"",manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:"",isCROS:false},right:{style:"",manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:"",isCROS:false},audiology:{rightT:{},leftT:{},rightBC:{},leftBC:{},rightMask:{},leftMask:{},rightBCMask:{},leftBCMask:{},tinnitusRight:false,tinnitusLeft:false,unaidedR:null,unaidedL:null,aidedR:null,aidedL:null,wrMclR:null,wrMclL:null,sinBin:null},carePlan:"",appointments:[],notes:"" });
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
  const startUpgradePurchase = (p, { visitId = null, tierOffered = null, tierPrice = null, audiology = null } = {}) => {
    if (!p) return;
    const nameParts = String(p.name || "").trim().split(/\s+/);
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");
    // Prefer the audiogram captured during the upgrade visit; fall back to
    // the chart's audiology so Results/Recommendation still have data.
    const hasFreshAudio = audiology
      && (Object.keys(audiology.rightT || {}).length > 0 || Object.keys(audiology.leftT || {}).length > 0);
    const plan = p.payType === "insurance"
      ? activePlans.find(pl => pl.carrier === p.insurance?.carrier && pl.planGroup === p.insurance?.planGroup)
      : null;
    const privLabel = p.payType === "insurance" && isPrivateLabelPlan(plan);
    // Tier price: the UpgradeClose hands us its reference price (plan copay or
    // retail anchor); for private-label plans re-resolve from the plan row so
    // the seeded price matches what TierSelection would write.
    const seededTierPrice = tierPrice != null
      ? tierPrice
      : (privLabel && tierOffered ? (plan?.tiers?.find(t => t.label === tierOffered)?.price ?? null) : null);
    setForm({
      intakeId: null,
      firstName, lastName,
      dob: p.dob || "", phone: p.phone || "", email: p.email || "", address: p.address || "",
      payType: p.payType || "insurance",
      carrier: p.insurance?.carrier || "", planGroup: p.insurance?.planGroup || "", tpa: p.insurance?.tpa || "",
      tier: tierOffered || "", tierPrice: seededTierPrice,
      left: EMPTY_SIDE(), right: EMPTY_SIDE(),
      audiology: hasFreshAudio ? audiology : (p.audiology || {rightT:{},leftT:{},rightBC:{},leftBC:{},rightMask:{},leftMask:{},rightBCMask:{},leftBCMask:{},tinnitusRight:false,tinnitusLeft:false,unaidedR:null,unaidedL:null,aidedR:null,aidedL:null,wrMclR:null,wrMclL:null,sinBin:null}),
      carePlan: "", appointments: [], notes: p.notes || "",
    });
    setWizardPatientId(p.id);
    setWizardVisitId(visitId);
    setWizardMode("upgrade");
    setShowWizardPaModal(false); setWizardPaSigned(false); setWizardPaSignatureDate(null);
    setActiveSide("left"); setSaved(false); setSaveError(null); setSaveToast(false);
    setShowWizardCompare(false);
    // Load the patient's latest linked intake so step 5's reflection flags and
    // the Then-vs-Now comparison have real data (the step-1 loader won't run —
    // we land past it).
    setWizardIntake(null);
    loadIntakesForPatient(p.id)
      .then(intakes => setWizardIntake(normalizeWizardIntake(intakes[0])))
      .catch(() => {});
    // Technology Tier only applies to private-label + private-pay flows;
    // regular insurance renders that step empty, so land on Device Selection.
    setStep((privLabel || p.payType === "private") ? 4 : 5);
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

    setForm(f => ({
      ...f,
      intakeId,
      firstName,
      lastName,
      dob:     isoDob,
      phone:   fmt,
      email:   a.email   || "",
      address,
      payType,
      carrier: a.carrier || "",
      notes:   [f.notes, notes].filter(Boolean).join("\n"),
    }));
    setWizardPatientId(newPatientId);
    const vid = await createVisit(newPatientId, { clinicId, staffId, visitType: 'initial_fit' });
    setWizardVisitId(vid);
    setPendingIntakes(prev => prev.filter(i => i._meta?.intakeId !== intakeId));
    setShowIntakeQueue(false);
    setIntakeToast(null);
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
    const active = patients.filter(p => p.patientStatus !== "tns");
    const tnsCount = patients.length - active.length;
    return {
      total: patients.length,
      tnsCount,
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

  const filteredPatients = (searchScope === "global"
    ? globalResults // server already matched name/phone across all locations
    : patients.filter(p =>
        p.name?.toLowerCase().includes(tableSearch.toLowerCase()) ||
        p.devices?.manufacturer?.toLowerCase().includes(tableSearch.toLowerCase()))
  ).filter(p => {
    if (statusFilter === "active") return p.patientStatus !== "tns";
    if (statusFilter === "tns") return p.patientStatus === "tns";
    return true;
  });


  // ── ARCHIVE VIEW ──────────────────────────────────────────────────────────
  // Searchable list of archived (inactive) patients for the active clinic, each
  // restorable back into the roster. Archived patients are excluded from the
  // dashboard + global search, so this is the only place they surface.
  const archivedFiltered = (() => {
    const t = archivedSearch.trim().toLowerCase();
    if (!t) return archivedPatients;
    return archivedPatients.filter(p =>
      p.name?.toLowerCase().includes(t) ||
      p.phone?.toLowerCase().includes(t) ||
      p.devices?.manufacturer?.toLowerCase().includes(t)
    );
  })();

  const renderArchive = () => (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Archive</div>
          <div className="topbar-sub">{clinic.name} · {archivedPatients.length} archived patient{archivedPatients.length === 1 ? "" : "s"}</div>
        </div>
      </div>
      <div className="content">
        <div className="table-card">
          <div className="table-header">
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div className="table-title">Archived Patients</div>
              <span style={{fontSize:11,color:"#9ca3af"}}>Inactive — hidden from the patient list &amp; search</span>
            </div>
            <input className="search-input" placeholder="Search archive…" value={archivedSearch} onChange={e => setArchivedSearch(e.target.value)} />
          </div>
          {archivedLoading ? (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="archive" size={40}/></div>
              <div className="empty-title">Loading archive…</div>
            </div>
          ) : archivedFiltered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="archive" size={40}/></div>
              {archivedPatients.length === 0 ? (
                <>
                  <div className="empty-title">Nothing archived</div>
                  <div className="empty-sub">Archive a patient from their profile to move them here.</div>
                </>
              ) : (
                <>
                  <div className="empty-title">No matches</div>
                  <div className="empty-sub">No archived patient matches “{archivedSearch.trim()}”.</div>
                </>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Patient</th><th>Device</th><th>Coverage</th><th>Status</th><th>Archived</th><th></th>
                </tr>
              </thead>
              <tbody>
                {archivedFiltered.map(p => {
                  const isTns = p.patientStatus === "tns";
                  return (
                    <tr key={p.id} onClick={() => { setSelectedPatient(p); setView("patient"); }} style={{cursor:"pointer"}}>
                      <td>
                        <div className="patient-name">{p.name}</div>
                        <div style={{fontSize:11,color:"#9ca3af"}}>{p.phone}</div>
                      </td>
                      <td>
                        <div style={{fontWeight:500}}>{p.devices?.manufacturer} {p.devices?.family||p.devices?.model}</div>
                        <div style={{fontSize:11,color:"#9ca3af"}}>{p.devices?.techLevel||"—"}</div>
                      </td>
                      <td>
                        <span className={`badge ${p.payType === "insurance" ? "insurance" : "private"}`}>
                          {p.payType === "insurance" ? p.insurance?.carrier || "Insurance" : "Private Pay"}
                        </span>
                      </td>
                      <td>
                        <span style={{background:isTns?"#fef3c7":"#F0EDE3",color:isTns?"#92400e":"#6b7280",borderRadius:99,padding:"1px 9px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.4}}>
                          {p.patientStatus}
                        </span>
                      </td>
                      <td style={{fontSize:12,color:"#6b7280"}}>{p.archivedAt ? fmtDate(p.archivedAt) : "—"}</td>
                      <td>
                        <button
                          className="btn-ghost"
                          style={{fontSize:12,padding:"6px 14px",color:"#0f766e",fontWeight:600}}
                          disabled={archiveBusy}
                          onClick={(e) => { e.stopPropagation(); handleRestorePatient(p); }}
                        >
                          {archiveBusy ? "Restoring…" : "↩ Restore"}
                        </button>
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

  const renderDashboard = () => (
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
        <div className="stats-grid">
          <div className="stat-card highlight">
            <div className="stat-icon">👥</div>
            <div className="stat-val">{statsData.total}</div>
            <div className="stat-label">Total Patients{statsData.tnsCount > 0 && <span style={{fontSize:10,color:"#d97706",fontWeight:400}}> ({statsData.tnsCount} TNS)</span>}</div>
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
                            <div className="patient-name">{p.name}</div>
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
                {[["all","All"],["active","Active"],["tns","TNS"]].map(([val,label])=>(
                  <button key={val} onClick={()=>setStatusFilter(val)} style={{
                    padding:"3px 10px",fontSize:11,fontWeight:600,borderRadius:99,border:"none",cursor:"pointer",
                    background: statusFilter===val ? (val==="tns"?"#fef3c7":"#dcfce7") : "#F0EDE3",
                    color: statusFilter===val ? (val==="tns"?"#92400e":"#15803d") : "#6b7280",
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
              <input className="search-input" placeholder={searchScope==="global" ? "Search all locations\u2026" : "Search patients\u2026"} value={tableSearch} onChange={e => setTableSearch(e.target.value)} />
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
                  <th>Patient</th><th>Device</th><th>Coverage</th><th>Care Plan</th><th>Warranty</th><th>Fitting Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(p => {
                  const isTns = p.patientStatus === "tns";
                  const days = daysUntil(p.devices?.warrantyExpiry||"");
                  const total = p.carePlan === "complete" ? 4 * 365 : 3 * 365;
                  const pct = Math.max(0, Math.min(100, (days / total) * 100));
                  const fillClass = days < 90 ? "exp" : days < 360 ? "warn" : "";
                  return (
                    <tr key={p.id} onClick={() => { setSelectedPatient(p); setView("patient"); }} style={isTns ? {borderLeft:"3px solid #f59e0b"} : undefined}>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div className="patient-name">{p.name}</div>
                          {isTns && <span style={{background:"#fef3c7",color:"#92400e",borderRadius:99,padding:"1px 7px",fontSize:10,fontWeight:700}}>TNS</span>}
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
                          : <span className={`badge ${p.carePlan}`}>{CARE_PLANS.find(c=>c.id===p.carePlan)?.label||p.carePlan}</span>
                        }
                      </td>
                      <td>
                        {isTns ? (
                          <div style={{fontSize:12,color:"#d97706",fontWeight:600}}>Quoted</div>
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
    const availMfrs = [...new Set(visibleCatalog.filter(e => !sd.style || e.styles.includes(sd.style)).map(e => e.manufacturer))].sort();
    const availGens = [...new Set(visibleCatalog.filter(e => e.styles.includes(sd.style) && e.manufacturer === sd.manufacturer).map(e => e.generation))];
    const availFamilies = visibleCatalog.filter(e => e.styles.includes(sd.style) && e.manufacturer === sd.manufacturer && e.generation === sd.generation);
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

    // Pricing
    const thTierPrice = privateLabelTiers.find(t => t.label === sd.techLevel)?.price ?? 0;
    return { availMfrs, availGens, availFamilies, selectedFamily, availColors, availBatteries,
      availPowers, availDomes, selectedPower, requiresEarmold, variantRequired, hasCROSVariant,
      thAvailBodyStyles, thAvailModels, thAvailVariants, thGainOptions, thColorCategory, thBattery, thIsLi,
      thRequiresEarmold, thHasReceiver, thTierPrice };
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

  // Auto-recompute form.tierPrice when the patient picks a device on step 5.
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
    if (!anchor) return null;
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
  }, [form.tier, form.tierPrice, form.priceOverridePerAid, form.payType, retailAnchors, retailAnchorsStandard, leftEarPrice, rightEarPrice]);

  // Device family lookups
  const leftFamily = catalog.find(e => e.id === form.left.familyId);
  const rightFamily = catalog.find(e => e.id === form.right.familyId);

  // Keep sd / otherSide for backward compat with non-step-3 code
  const sd = form[activeSide];
  const otherSide = activeSide === "left" ? "right" : "left";


  const isSideConfigured = (s) => {
    const d = form[s];
    if (d.manufacturer === "TruHearing") return !!(d.style && d.techLevel && d.thModel && d.gainMatrix);
    return !!(d.familyId && d.techLevel);
  };


  const canProceed = [
    form.firstName && form.lastName && form.dob && form.phone,
    true, // Health History — review-only, always proceedable
    true, // Testing — always skippable
    true, // Results — always skippable
    // Technology Tier — required for plans where it applies (private-label
    // TruHearing or private-pay). Other insurance flows skip the choice.
    (isPrivateLabel || form.payType === "private") ? !!form.tier : true,
    (isSideConfigured("left") || isSideConfigured("right")),
    form.payType === "private" || !!form.carePlan,
    true, // Review — always valid
  ][step];


  // ── Shared Results / Consultation content ────────────────────────────────
  // Used by both wizard Step 2 and Consultation Mode. Accepts audiology data
  // and chief complaint text; renders audiogram + speech banana + phoneme
  // dimming + drawing overlay + hearing sim paragraph + severity/CCT/WRS +
  // dynamic counseling copy.
  const renderResultsContent = (aud, chiefComplaint) => {
    if (!aud) return null;
    const rPTA = getPTA(aud.rightT);
    const lPTA = getPTA(aud.leftT);
    const hasThresholds = rPTA!=null || lPTA!=null;
    const hasAnyData = hasThresholds || aud.unaidedR!=null || aud.unaidedL!=null || aud.cctR!=null || aud.cctL!=null || aud.wrMclR!=null || aud.wrMclL!=null || aud.sinBin!=null;

    const rSeverity = getWorstThresholdSeverity(aud.rightT);
    const lSeverity = getWorstThresholdSeverity(aud.leftT);
    const severityRank = s => ["Normal","Mild","Moderate","Moderately Severe","Severe","Profound"].indexOf(s);
    const overallSeverity = (rSeverity && lSeverity)
      ? (severityRank(rSeverity) >= severityRank(lSeverity) ? rSeverity : lSeverity)
      : (rSeverity || lSeverity);

    const cctR = aud.cctR ?? aud.unaidedR, cctL = aud.cctL ?? aud.unaidedL;
    const cctDefR = cctR!=null ? 100-cctR : null;
    const cctDefL = cctL!=null ? 100-cctL : null;
    const worseCCT = (cctR!=null && cctL!=null) ? Math.min(cctR, cctL) : (cctR ?? cctL);
    const cctColor = v => v==null ? "#9ca3af" : v>=90 ? "#16a34a" : v>=75 ? "#f59e0b" : "#dc2626";

    const computeInaudible = (thresholds, dimMode) => {
      return PHONEMES.map(ph => {
        const rThr = interpolateThreshold(aud.rightT, ph.freq);
        const lThr = interpolateThreshold(aud.leftT, ph.freq);
        const rIn = rThr!=null && rThr > ph.db;
        const lIn = lThr!=null && lThr > ph.db;
        let inaudible = false;
        if(dimMode==="right") inaudible = rIn;
        else if(dimMode==="left") inaudible = lIn;
        else inaudible = rIn || lIn;
        return inaudible ? ph.label : null;
      }).filter(Boolean);
    };
    const inaudibleBoth = computeInaudible(null, "both");
    const highFreqInaudible = inaudibleBoth.filter(l => HIGH_FREQ_CONSONANTS.includes(l));

    const findingSentence = {
      "Normal": "Your hearing thresholds are within the normal range.",
      "Mild": "You have a mild hearing loss \u2014 most noticeable in quiet or reverberant rooms.",
      "Moderate": "You have a moderate hearing loss affecting everyday conversation.",
      "Moderately Severe": "You have a moderately severe hearing loss. Unaided conversation requires significant effort.",
      "Severe": "You have a severe hearing loss. Unaided speech understanding is substantially compromised.",
      "Profound": "You have a profound hearing loss. Unaided communication is extremely limited.",
    }[overallSeverity] || null;

    const clarityGapCopy = (() => {
      if(worseCCT==null || worseCCT >= 90) return null;
      const deficit = 100 - worseCCT;
      if(worseCCT >= 75) return "Even at a comfortable volume, your ability to understand speech clearly is mildly reduced.";
      if(worseCCT >= 60) return `At a level where someone with normal hearing scores 100%, you scored ${worseCCT}%. That ${deficit}-point gap is the difference between hearing and understanding.`;
      return "Your word recognition deficit is significant. You are likely missing large portions of conversation even when sound is loud enough to hear.";
    })();

    const missingCopy = (() => {
      if(!hasThresholds) return null;
      const n = highFreqInaudible.length;
      if(n >= 5) return "The sounds you\u2019re missing most \u2014 S, F, TH, SH \u2014 are the consonants that define word endings and questions. Without them, speech sounds muffled rather than quiet.";
      if(n >= 3) return "Several high-frequency consonants are in your inaudible range. This explains why some words sound unclear even when the volume seems fine.";
      if(n >= 1) return "A small number of high-frequency sounds fall just outside your hearing range \u2014 likely subtle, but present.";
      return null;
    })();

    return (
      <>
        {hasThresholds && (
          <div className="card">
            <div className="card-title">Your Audiogram</div>
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              {["left","both","right"].map(mode=>(
                <button key={mode} onClick={()=>setPhonemeDimMode(mode)}
                  style={{padding:"5px 14px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",
                    border:phonemeDimMode===mode?"2px solid #6366f1":"1px solid #d1d5db",
                    background:phonemeDimMode===mode?"#eef2ff":"#fff",
                    color:phonemeDimMode===mode?"#4f46e5":mode==="right"?"#dc2626":mode==="left"?"#2563eb":"#374151"}}>
                  {mode==="left"?"Left":mode==="right"?"Right":"Both"}
                </button>
              ))}
              <span style={{fontSize:11,color:"#9ca3af",alignSelf:"center",marginLeft:4}}>Phoneme dimming ear</span>

              <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
                <button onClick={()=>setDrawingEnabled(!drawingEnabled)}
                  style={{padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4,
                    border:drawingEnabled?"2px solid #f59e0b":"1px solid #d1d5db",
                    background:drawingEnabled?"#fffbeb":"#fff",
                    color:drawingEnabled?"#b45309":"#6b7280"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  Draw
                </button>
                {drawingEnabled && <>
                  {[["#dc2626","Red"],["#2563eb","Blue"],["#1e293b","Black"]].map(([c,label])=>(
                    <button key={c} onClick={()=>setDrawColor(c)} title={label}
                      style={{width:20,height:20,borderRadius:"50%",border:drawColor===c?"3px solid #f59e0b":"2px solid #d1d5db",background:c,cursor:"pointer",padding:0,flexShrink:0}}/>
                  ))}
                  <button onClick={()=>setDrawPaths(prev=>prev.slice(0,-1))} disabled={drawPaths.length===0} title="Undo"
                    style={{padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,cursor:drawPaths.length?"pointer":"default",border:"1px solid #d1d5db",background:"#fff",color:drawPaths.length?"#6b7280":"#d1d5db",display:"flex",alignItems:"center",gap:3}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                  </button>
                  <button onClick={()=>setDrawPaths([])} disabled={drawPaths.length===0} title="Clear all"
                    style={{padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,cursor:drawPaths.length?"pointer":"default",border:"1px solid #d1d5db",background:"#fff",color:drawPaths.length?"#6b7280":"#d1d5db",display:"flex",alignItems:"center",gap:3}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </>}
              </div>
            </div>
            <div style={{position:"relative",background:"#fafafa",border:"1px solid #E4E0D5",borderRadius:10,padding:"12px 8px",marginBottom:14}}>
              <AudigramSVG rightT={aud.rightT||{}} leftT={aud.leftT||{}} rightBC={aud.rightBC||{}} leftBC={aud.leftBC||{}} rightMask={aud.rightMask||{}} leftMask={aud.leftMask||{}} rightBCMask={aud.rightBCMask||{}} leftBCMask={aud.leftBCMask||{}} interactive={false} showBanana={true} phonemeDimMode={phonemeDimMode} dimIntensity={dimIntensity}/>
              {drawingEnabled && (
                <canvas
                  ref={drawCanvasRef}
                  onPointerDown={onDrawPointerDown}
                  onPointerMove={onDrawPointerMove}
                  onPointerUp={onDrawPointerUp}
                  onPointerLeave={onDrawPointerUp}
                  style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",cursor:"crosshair",touchAction:"none",borderRadius:10}}
                />
              )}
              {!drawingEnabled && drawPaths.length > 0 && (
                <canvas
                  ref={el=>{if(el){drawCanvasRef.current=el;const p=el.parentElement;const dpr=window.devicePixelRatio||1;el.width=p.offsetWidth*dpr;el.height=p.offsetHeight*dpr;el.style.width=p.offsetWidth+"px";el.style.height=p.offsetHeight+"px";redrawCanvas(drawPaths,null);}}}
                  style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",borderRadius:10}}
                />
              )}
            </div>

            {/* Hearing Simulation Paragraph */}
            <div style={{margin:"0 0 16px",padding:"16px 20px",background:"#fff",border:"1px solid #E4E0D5",borderRadius:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>What speech sounds like with your hearing</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:10,color:"#9ca3af",fontWeight:600}}>Dim</span>
                  <input type="range" min="0" max="100" value={dimIntensity} onChange={e=>setDimIntensity(Number(e.target.value))}
                    style={{width:100,accentColor:"#6366f1",cursor:"pointer"}}/>
                  <span style={{fontSize:10,color:"#9ca3af",fontWeight:600,minWidth:28}}>{dimIntensity}%</span>
                </div>
              </div>
              {/* A/B hearing simulation — plays the sentence through the patient's
                  audiogram (Web Audio biquad bank); uses the ear selector above. */}
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:14,paddingBottom:14,borderBottom:"1px solid #F0EDE3"}}>
                <button onClick={()=> simPlaying ? stopHearingSim() : playHearingSim(aud)}
                  style={{display:"flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",
                    background: simPlaying ? "#dc2626" : "#4f46e5", color:"#fff", fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13}}>
                  <span style={{fontSize:12}}>{simPlaying ? "■" : "▶"}</span>
                  {simPlaying ? "Stop" : "Hear this"}
                </button>
                <div style={{display:"inline-flex",border:"1px solid #d1d5db",borderRadius:8,overflow:"hidden"}}>
                  {[["typical","Typical hearing"],["yours","Your hearing"]].map(([m,label])=>(
                    <button key={m} onClick={()=>setSimMode(m)}
                      style={{padding:"7px 13px",fontSize:12,fontWeight:600,cursor:"pointer",border:"none",fontFamily:"'Sora',sans-serif",
                        background: simMode===m ? (m==="yours" ? "#4f46e5" : "#0a1628") : "#fff",
                        color: simMode===m ? "#fff" : "#6b7280"}}>
                      {label}
                    </button>
                  ))}
                </div>
                <span style={{fontSize:11,color:"#9ca3af"}}>
                  {simPlaying ? "Toggle to compare — same clip, your audiogram applied" : "Plays the sentence through your hearing loss"}
                </span>
              </div>
              <p style={{fontSize:16,lineHeight:2,fontFamily:"'DM Sans',sans-serif",margin:0,letterSpacing:"0.01em"}}>
                {HEARING_SIM_TEXT.map((seg,i) => {
                  if (!seg.ph) return <span key={i}>{seg.t}</span>;
                  const ph = PHONEMES.find(p => p.label === seg.ph);
                  if (!ph) return <span key={i}>{seg.t}</span>;
                  const rThr = interpolateThreshold(aud.rightT, ph.freq);
                  const lThr = interpolateThreshold(aud.leftT, ph.freq);
                  const rIn = rThr != null && rThr > ph.db;
                  const lIn = lThr != null && lThr > ph.db;
                  const rBorder = rThr != null && !rIn && rThr > ph.db - 5;
                  const lBorder = lThr != null && !lIn && lThr > ph.db - 5;
                  let inaudible = false, borderline = false;
                  if (phonemeDimMode === "right") { inaudible = rIn; borderline = !inaudible && rBorder; }
                  else if (phonemeDimMode === "left") { inaudible = lIn; borderline = !inaudible && lBorder; }
                  else { inaudible = rIn || lIn; borderline = !inaudible && (rBorder || lBorder); }
                  const t = dimIntensity / 100;
                  const base = [30, 41, 59]; // #1e293b
                  const inaudTarget = [229, 231, 235]; // #E4E0D5
                  const borderTarget = [176, 181, 189]; // #b0b5bd
                  const lerp = (a,b,f) => Math.round(a + (b - a) * f);
                  const color = inaudible
                    ? `rgb(${lerp(base[0],inaudTarget[0],t)},${lerp(base[1],inaudTarget[1],t)},${lerp(base[2],inaudTarget[2],t)})`
                    : borderline
                    ? `rgb(${lerp(base[0],borderTarget[0],t)},${lerp(base[1],borderTarget[1],t)},${lerp(base[2],borderTarget[2],t)})`
                    : "#1e293b";
                  return <span key={i} style={{color,transition:"color 0.3s ease"}}>{seg.t}</span>;
                })}
              </p>
            </div>

            {/* Severity per ear */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
              {rSeverity&&(
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#dc2626",marginBottom:2}}>Right Ear</div>
                  <div style={{fontSize:16,fontWeight:800,color:"#0a1628"}}>{rSeverity}</div>
                </div>
              )}
              {lSeverity&&(
                <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#2563eb",marginBottom:2}}>Left Ear</div>
                  <div style={{fontSize:16,fontWeight:800,color:"#0a1628"}}>{lSeverity}</div>
                </div>
              )}
              {aud.sinBin!=null&&(
                <div style={{background:"#FAF8F2",border:"1px solid #E4E0D5",borderRadius:8,padding:"10px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:2}}>QuickSIN SNR Loss</div>
                  <div style={{fontSize:18,fontWeight:800,color:"#0a1628"}}>{aud.sinBin} <span style={{fontSize:11,color:"#9ca3af",fontWeight:400}}>dB</span></div>
                  <div style={{fontSize:11,fontWeight:600,marginTop:2,
                    color:aud.sinBin<=2?"#16a34a":aud.sinBin<=7?"#ca8a04":aud.sinBin<=15?"#ea580c":"#dc2626"}}>
                    {aud.sinBin<=2?"Near-normal":aud.sinBin<=7?"Mild":aud.sinBin<=15?"Moderate":"Severe"} difficulty in noise
                  </div>
                </div>
              )}
              {(aud.tinnitusRight||aud.tinnitusLeft)&&(
                <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,padding:"10px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#92400e",marginBottom:2}}>Tinnitus</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>
                    {aud.tinnitusRight&&aud.tinnitusLeft?"Bilateral":aud.tinnitusRight?"Right Ear":"Left Ear"}
                  </div>
                </div>
              )}
            </div>

            {/* CCT + WRS @ MCL Scorecard */}
            {(cctR!=null||cctL!=null||aud.wrMclR!=null||aud.wrMclL!=null) && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#dc2626",marginBottom:10}}>Right Ear</div>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:3}}>CCT Score</div>
                    <div style={{fontSize:22,fontWeight:800,color:cctColor(cctR)}}>{cctR!=null?`${cctR}%`:"\u2014"}</div>
                    {cctDefR!=null&&cctDefR>0&&(
                      <div style={{fontSize:12,fontWeight:700,color:"#dc2626",marginTop:2}}>{cctDefR} pts below normal</div>
                    )}
                    <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>California Consonant Test @ 45 dB</div>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:3}}>WRS @ MCL</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#0a1628"}}>{aud.wrMclR!=null?`${aud.wrMclR}%`:"\u2014"}</div>
                    <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>Word recognition at comfortable volume</div>
                  </div>
                </div>
                <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#2563eb",marginBottom:10}}>Left Ear</div>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:3}}>CCT Score</div>
                    <div style={{fontSize:22,fontWeight:800,color:cctColor(cctL)}}>{cctL!=null?`${cctL}%`:"\u2014"}</div>
                    {cctDefL!=null&&cctDefL>0&&(
                      <div style={{fontSize:12,fontWeight:700,color:"#dc2626",marginTop:2}}>{cctDefL} pts below normal</div>
                    )}
                    <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>California Consonant Test @ 45 dB</div>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:3}}>WRS @ MCL</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#0a1628"}}>{aud.wrMclL!=null?`${aud.wrMclL}%`:"\u2014"}</div>
                    <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>Word recognition at comfortable volume</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Counseling Copy */}
        {hasAnyData && (
          <div className="card">
            <div className="card-title">Understanding Your Results</div>
            {findingSentence && (
              <div style={{fontSize:14,color:"#0a1628",fontWeight:600,lineHeight:1.7,marginBottom:16}}>
                {findingSentence}
              </div>
            )}
            {clarityGapCopy && (
              <div style={{fontSize:13,color:"#374151",lineHeight:1.75,marginBottom:16}}>
                {clarityGapCopy}
              </div>
            )}
            {missingCopy && (
              <div style={{fontSize:13,color:"#374151",lineHeight:1.75,marginBottom:16}}>
                {missingCopy}
              </div>
            )}
            <div style={{fontSize:13,color:"#6b7280",fontWeight:500,lineHeight:1.7,paddingTop:8,borderTop:"1px solid #F0EDE3"}}>
              Below, you'll see how treatment addresses each of these gaps.
            </div>
          </div>
        )}

        {!hasAnyData && (
          <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"#9ca3af"}}>
            <div style={{fontSize:40,marginBottom:12}}>📋</div>
            <div style={{fontSize:16,fontWeight:600,color:"#374151",marginBottom:8}}>No test data recorded yet</div>
            <div style={{fontSize:13}}>Go back to the Testing step to enter audiogram and speech scores, or continue to treatment options.</div>
          </div>
        )}
      </>
    );
  };


  const renderStep = () => {
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
                        }}>
                        <div className="plan-row-name">{plan.planGroup}</div>
                        <div className="plan-row-tpa">{plan.carrier} · via {plan.tpa}</div>
                      </div>
                    ))
                  }
                </div>
                {form.planGroup && (
                  <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #E4E0D5",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>TPA</span>
                    <span style={{fontSize:13,fontWeight:600,color:"#374151",background:"#F0EDE3",borderRadius:6,padding:"3px 10px"}}>{form.tpa}</span>
                    <button style={{marginLeft:"auto",fontSize:11,color:"#9ca3af",background:"none",border:"none",cursor:"pointer",padding:0}}
                      onClick={()=>{upd("planGroup","");upd("carrier","");upd("tpa","");upd("tier","");upd("tierPrice",null);}}>
                      ✕ Clear
                    </button>
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
      return <AudiogramEntry value={form.audiology} onChange={(a)=>upd("audiology", a)} />;
    }
    if (step === 3) {
      return renderResultsContent(form.audiology, form.notes || "");
    }
    if (step === 4) {
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
        />
      );
    }
    if (step === 5) {

      const renderSideColumn = (side) => {
        const s = form[side];
        const d = side === "left" ? leftDerived : rightDerived;
        const { availMfrs, availGens, availFamilies, selectedFamily, availColors, availBatteries,
          availPowers, availDomes, requiresEarmold, variantRequired } = d;

        return (
          <div className={`device-col ${activeSide===side?"active":""}`} onClick={()=>setActiveSide(side)}>
            <div className="device-col-header">
              <span className="ear-label">{side==="left"?"👂 Left Ear":"Right Ear 👂"}</span>
              <span className={`ear-status ${isSideConfigured(side)?"configured":"empty"}`}>
                {isSideConfigured(side)?"Configured":"Not set"}
              </span>
            </div>

            {/* ── 1. Body Style (standard catalog only — TH uses its own style picker) ── */}
            {!isPrivateLabel && (
              <div className="field" style={{marginBottom:16}}><label>Body Style</label>
                <div className="style-grid">
                  {BODY_STYLES.map(bs=>(
                    <div key={bs.id} className={`style-card ${s.style===bs.id?"active":""}`}
                      onClick={()=>resetSide(side,{style:bs.id})}>
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
            )}

            {/* ── 2–6. Standard catalog cascade ── */}
            {!isPrivateLabel && (<>
              {s.style && availMfrs.length > 0 && (
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
                        title={famOff ? "Not available on the Nations Hearing plan" : undefined}
                        style={famOff ? {opacity:0.6,cursor:"not-allowed",background:"#fef2f2",borderColor:"#fecaca"} : undefined}
                        onClick={famOff ? undefined : ()=>{
                          const autoVar = fam.variants.length===1 ? fam.variants[0] : "";
                          const autoBat = fam.battery.length===1 ? fam.battery[0] : "";
                          setForm(f=>({...f,[side]:{...f[side],familyId:fam.id,variant:autoVar,techLevel:"",color:"",battery:autoBat}}));
                        }}>
                        <div className="plan-row-top">
                          <div>
                            <div className="plan-row-name" style={famOff ? {color:"#b91c1c"} : undefined}>
                              {fam.family}{famOff ? " *" : ""}
                            </div>
                            {famOff && <div style={{fontSize:11,color:"#b91c1c",marginTop:2}}>Not available on this plan</div>}
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
              {selectedFamily && (s.variant || !variantRequired) && (
                <div className="field" style={{marginBottom:16}}><label>Technology Level</label>
                  <div className="radio-group">
                    {[...selectedFamily.techLevels].sort((a,b)=>{
                      const na=parseFloat(a),nb=parseFloat(b);
                      return(!isNaN(na)&&!isNaN(nb))?na-nb:a.localeCompare(b);
                    }).map(t=>{
                      const techOff = nationsTechOffPlan(selectedFamily, t);
                      return (
                      <div key={t} className={`radio-pill ${s.techLevel===t?"active":""}`}
                        title={techOff ? "Not available on the Nations Hearing plan" : undefined}
                        style={techOff ? {opacity:0.6,cursor:"not-allowed",color:"#b91c1c",background:"#fef2f2",borderColor:"#fecaca"} : undefined}
                        onClick={techOff ? undefined : ()=>updSide(side,"techLevel",t)}>
                        <div className="radio-pill-label">{(selectedFamily.techLevelLabels?.[t] || t)}{techOff ? " *" : ""}</div>
                      </div>
                      );
                    })}
                  </div>
                  {isNationsPatient && selectedFamily.techLevels.some(t => nationsCoverageTier(selectedFamily, t) === null) && (
                    <div style={{fontSize:11.5,color:"#b91c1c",marginTop:8}}>
                      * Not available on the Nations Hearing plan.
                    </div>
                  )}
                </div>
              )}
            </>)}

            {/* ── Private-label: TruHearing cascade ── */}
            {/* Tier was chosen in the Technology Tier wizard step (4); this
                cascade now starts at Body Style. The chosen tier flows into
                each side via form.tier → s.techLevel sync (see useEffect). */}
            {isPrivateLabel && (<>
              {/* Body Style (card grid — mirrors private-pay imagery) */}
              {s.techLevel && d.thAvailBodyStyles.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Body Style</label>
                  <div className="style-grid">
                    {d.thAvailBodyStyles.map(bs=>(
                      <div key={bs.id} className={`style-card ${s.thBodyStyle===bs.id?"active":""}`}
                        onClick={()=>setForm(f=>({...f,[side]:{...f[side], thBodyStyle:bs.id, thModel:"", style:"", color:"", faceplateColor:"", shellColor:"", gainMatrix:"", battery:"", receiverLength:"", receiverPower:"", dome:"", domeCategory:"", domeSize:""}}))}>
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
              )}

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

              {/* 8. Domes (RIC/RIC+BCT/SR — not for earmold) */}
              {s.style && d.thHasReceiver && s.gainMatrix && (
                d.thRequiresEarmold ? (
                  <div style={{background:"#fef9c3",border:"1px solid #fde047",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#854d0e",fontWeight:600}}>
                    🦻 Earmold required — dome not applicable (HP encased receiver)
                  </div>
                ) : (
                  <div className="field-grid" style={{marginBottom:16}}>
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
                )
              )}
            </>)}

            {/* ── 7–8. Color / Battery (standard catalog only) ── */}
            {!isPrivateLabel && (<>
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

            {/* ── 9. Receiver + Dome (RIC — standard catalog only) ── */}
            {!isPrivateLabel && s.style === "ric" && s.techLevel && availPowers.length > 0 && (
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
                      if((RECEIVER_POWERS[s.manufacturer]||[]).find(p=>p.id===pw)?.earmold) updSide(side,"dome","");
                    }}>
                      <option value="">Select…</option>
                      {availPowers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                {s.receiverPower && (
                  <div className="field" style={{marginBottom:0,marginTop:12}}>
                    {requiresEarmold ? (
                      <div style={{background:"#fef9c3",border:"1px solid #fde047",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#854d0e",fontWeight:600}}>
                        🦻 Earmold required — dome not applicable
                      </div>
                    ) : (
                      <><label>Dome Type</label>
                        <select value={s.dome} onChange={e=>updSide(side,"dome",e.target.value)}>
                          <option value="">Select…</option>
                          {availDomes.map(dm=><option key={dm}>{dm}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── IF (Instant Fit) — Dome only, no separate receiver ── */}
            {!isPrivateLabel && s.style === "if" && s.techLevel && availDomes.length > 0 && (
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
      const leftHasCROS = leftDerived.hasCROSVariant;
      const rightHasCROS = rightDerived.hasCROSVariant;

      return (
        <>
          <div className="card">
            <div className="card-title">Treatment Options</div>

            {isPrivateLabel && (
              <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#1e40af",fontWeight:600}}>
                🏷️ TruHearing Select — choose technology tier, model, and style to configure the device.
              </div>
            )}

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
                    onClick={()=>{
                      const src = form.left;
                      const crosFam = catalog.find(e => e.id === src.familyId);
                      const crosVariant = crosFam?.variants.find(v=>v.toLowerCase().includes("cros")) || "CROS";
                      setForm(f=>({...f,right:{...src, variant:crosVariant, receiverLength:"", receiverPower:"", dome:""}}));
                      setActiveSide("right");
                    }}
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
                    onClick={()=>{
                      const src = form.right;
                      const crosFam = catalog.find(e => e.id === src.familyId);
                      const crosVariant = crosFam?.variants.find(v=>v.toLowerCase().includes("cros")) || "CROS";
                      setForm(f=>({...f,left:{...src, variant:crosVariant, receiverLength:"", receiverPower:"", dome:""}}));
                      setActiveSide("left");
                    }}
                    title="Copy as CROS transmitter to left ear">
                    ← CROS 📡
                  </button>
                )}
              </div>

              {/* ── Right Column ── */}
              {renderSideColumn("right")}
            </div>

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

              // UHCH Relate (Gold/Platinum) and off-plan devices have no retail
              // anchor → pricingRevealData is null, but they DO have a price.
              // Render the investment without a savings badge (Kurt: Relate has
              // no street retail to anchor against); off-plan additionally shows
              // the acknowledgement-form flag and bills standard retail.
              const isDeviceDrivenTpa = form.tpa === 'UHCH' || form.tpa === 'Nations';
              const tpaName = form.tpa === 'Nations' ? 'Nations Hearing' : 'UHCH';
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
                      {offPlan ? "Standard Retail · Off-Plan" : isInsuranceNoPlan ? "Standard Retail" : "Your Investment Today"}
                    </div>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <span style={{fontSize:28,fontWeight:800,color:"#0a1628"}}>${fmt2(investment)}</span>
                      <span style={{fontSize:12,color:"#6b7280"}}>{bothDone ? "pair (2 aids)" : "per aid"}</span>
                    </div>
                    {!offPlan && (
                      <div style={{fontSize:12,color:"#6b7280",marginTop:6}}>
                        {isInsuranceNoPlan
                          ? 'No insurance plan selected — showing standard retail. Add the plan to apply benefits.'
                          : form.tpa === 'Nations'
                            ? `${form.tier || 'Nations'} tier · Nations Hearing flat-rate copay.`
                            : 'Relate value pricing under UHCH — no separate retail comparison applies.'}
                      </div>
                    )}
                  </div>
                );
              }

              // Hold the reveal until a device is configured — tier alone (set
              // on the prior step) only yields the bare baseline, not a real price.
              if (!pricingRevealData || form.tierPrice == null || !anyConfigured) {
                return (
                  <div style={{background:"#FCF8EF",border:"1px solid #EADFC7",borderRadius:14,padding:"22px 24px",marginTop:12,textAlign:"center",color:"#9AA39B",fontSize:13,fontFamily:"'Sora',sans-serif"}}>
                    Select a device to see your investment.
                  </div>
                );
              }

              const { tierLabel, retailPerAid, copayPerAid, savingsPerAid, savingsPct, perEar } = pricingRevealData;
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
              const reflectFlags = flaggedEnvironments(unwrapIntakeAnswers(wizardIntake?.answers) || null);
              const reflectSits = ENVIRONMENTS.filter(e => reflectFlags.has(e.id)).map(e => (SITUATION_LABEL[e.id] || e.label).toLowerCase());
              const reflectText = reflectSits.length === 0 ? null
                : reflectSits.length === 1 ? reflectSits[0]
                : reflectSits.slice(0, -1).join(", ") + " and " + reflectSits[reflectSits.length - 1];

              return (
                <div style={{background:"#FCF8EF",border:"1px solid #EADFC7",borderRadius:14,padding:"22px 24px",marginTop:12,fontFamily:"'Sora',sans-serif",boxShadow:"0 1px 2px rgba(16,32,28,.04),0 14px 30px -22px rgba(120,90,30,.4)"}}>
                  {/* What the patient told us — structured from their intake
                      answers, falling back to the provider-notes quote when
                      nothing was flagged. */}
                  {reflectText ? (
                    <div style={{fontSize:13.5,color:"#54625C",fontStyle:"italic",borderLeft:"3px solid #B5832E",paddingLeft:13,marginBottom:16,lineHeight:1.55}}>
                      You told us the hardest moments have been {reflectText}.
                    </div>
                  ) : chiefComplaint ? (
                    <div style={{fontSize:13.5,color:"#54625C",fontStyle:"italic",borderLeft:"3px solid #B5832E",paddingLeft:13,marginBottom:16,lineHeight:1.55}}>
                      "{chiefComplaint}"
                    </div>
                  ) : null}

                  {/* Technology tier label */}
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#B5832E",marginBottom:12}}>
                    {tierLabel} Technology
                  </div>

                  {/* Your investment — cost first, stated plainly, in the display serif */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#9AA39B",textTransform:"uppercase",letterSpacing:0.6,marginBottom:5}}>Your investment</div>
                    <div style={{display:"flex",alignItems:"baseline",gap:9}}>
                      <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:38,fontWeight:600,color:"#16201D",lineHeight:1}}>${fmt(investmentDisplay)}</span>
                      <span style={{fontSize:12.5,color:"#54625C"}}>{bothDone ? "for both hearing aids" : "per aid"}</span>
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
                            ${fmt(copayPerAid)} / aid
                          </div>
                        );
                      }
                      const leftFam  = catalog.find(e => e.id === form.left.familyId);
                      const rightFam = catalog.find(e => e.id === form.right.familyId);
                      const leftLabel  = perEar.left.source === 'cros' ? 'CROS unit' : (leftFam?.family || '—');
                      const rightLabel = perEar.right.source === 'cros' ? 'CROS unit' : (rightFam?.family || '—');
                      return (
                        <div style={{marginTop:8,fontSize:12,color:"#54625C"}}>
                          <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
                            <span>Right · {rightLabel}</span>
                            <span style={{fontWeight:600}}>${fmt(rp)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
                            <span>Left · {leftLabel}</span>
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
                        <span style={{color:"#1B8A7A",fontWeight:700}}>✓</span> Complete Care+ <span style={{color:"#9AA39B"}}>(included)</span>
                      </span>
                    ) : (
                      <span style={{color:"#54625C"}}>Your plan covers</span>
                    )}
                    <span style={{fontWeight:700,color:"#6E4E16"}}>${fmt(planCoversWithCare)}</span>
                  </div>

                  {/* Full retail value — never shown without the savings beside it */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderTop:"1px solid #EADFC7",fontSize:13}}>
                    <span style={{color:"#9AA39B"}}>Full retail value</span>
                    <span style={{color:"#9AA39B",textDecoration:"line-through"}}>${fmt(retailWithCare)}</span>
                  </div>

                  {/* Savings — the helping number, in brass */}
                  <div style={{background:"#F4EAD4",borderRadius:9,padding:"11px 14px",marginTop:10,display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>
                    <span style={{fontSize:13.5,fontWeight:700,color:"#6E4E16"}}>
                      You save ${fmt(savingsWithCare)}
                    </span>
                    <span style={{background:"#B5832E",color:"white",borderRadius:20,padding:"2px 11px",fontSize:11,fontWeight:700}}>
                      {savingsPctDisplay}% off
                    </span>
                  </div>

                  {/* Complete Care+ — transparent terms, stated plainly ("5 years",
                      not "lifetime"). Bundled for private pay; the opt-out default
                      care plan for insurance (confirmed on the step-6 care-plan step). */}
                  <div style={{marginTop:16,background:"#0B4A42",borderRadius:11,padding:"15px 17px",color:"#fff"}}>
                    <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,fontWeight:600,marginBottom:6}}>Five years of care, included</div>
                    <div style={{fontSize:12.5,lineHeight:1.6,color:"rgba(255,255,255,0.82)"}}>
                      Unlimited visits for 5 years · a 4-year repair warranty (your manufacturer's 3 years plus 1 more from us) · cleanings, adjustments, and a check-in call two days after you start.
                    </div>
                    {!isPrivatePay && (
                      <div style={{fontSize:11.5,lineHeight:1.5,color:"rgba(255,255,255,0.6)",marginTop:8}}>
                        Your default care plan — we'll confirm it together on the next step.
                      </div>
                    )}
                  </div>

                  {/* Comfortable monthly options — interactive CareCredit / Allegro
                      calculator: deferred-interest (6/12/18) vs fixed-APR
                      (24/36/48/60) terms, with real APR + total cost shown. */}
                  <FinancingCalculator total={investmentDisplay} />
                </div>
              );
            })()}
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
                    <DeviceComparison variant="embedded" initialOld={intakeOld} proposedNew={proposedNew} flaggedEnvs={compFlags} />
                  </div>
                )}
              </div>
            );
          })()}
          {/* Private-pay skips the step-6 Care Plan fork — surface PA + Quote here instead. */}
          {form.payType === "private" && (isSideConfigured("left") || isSideConfigured("right")) && (
            <div style={{marginTop:24,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
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
            </div>
          )}
        </>
      );
    }
    if (step === 6) {
      const leftOk  = isSideConfigured("left");
      const rightOk = isSideConfigured("right");
      const aidCount = (leftOk ? 1 : 0) + (rightOk ? 1 : 0);
      // CROS-aware per-aid + pair totals. Falls back to tierPrice * aidCount
      // when per-ear pricing hasn't resolved (rare — happens when device
      // info isn't enough to pick an anchor row).
      // Effective per-aid honors a confirmed Price Adjustment (§6); CROS sides keep their unit price.
      const ovr = form.priceOverridePerAid;
      const effPerAid = ovr ?? form.tierPrice;
      const leftEarP  = leftOk  ? ((ovr != null && leftEarPrice?.source  !== 'cros') ? ovr : (leftEarPrice?.price  ?? effPerAid)) : null;
      const rightEarP = rightOk ? ((ovr != null && rightEarPrice?.source !== 'cros') ? ovr : (rightEarPrice?.price ?? effPerAid)) : null;
      const perEarSum = (leftEarP || 0) + (rightEarP || 0);
      const aidBase = perEarSum > 0
        ? perEarSum
        : (effPerAid != null ? effPerAid * aidCount : null);
      const aidTotal = aidBase;
      const perAidFor = (side) => side === 'left' ? leftEarP : side === 'right' ? rightEarP : effPerAid;
      const isTruHearing = form.tpa === "TruHearing";
      const isTruHearingTPA = isTruHearing;

      // Standard Billing has no upfront commitment — $65/visit billed as
      // care is delivered, so grand total = device total only.
      const cpCostFor = (id) =>
        id === "paygo"    ? 0
        : id === "punch"  ? 575
        : 1250;

      const DeviceSummary = () => {
        if (!leftOk && !rightOk) return null;
        const renderSide = (side, label) => {
          const d = form[side];
          if (!isSideConfigured(side)) return null;
          const fam = catalog.find(e => e.id === d.familyId);
          const name = d.manufacturer === "TruHearing"
            ? `TruHearing Select · ${d.techLevel}`
            : `${fam?.family || ""} · ${d.techLevel}`;
          const sidePrice = perAidFor(side);
          return (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #F0EDE3"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#0a1628"}}>{label}</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:1}}>{name}</div>
              </div>
              {sidePrice != null && (
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#0a1628"}}>
                    {sidePrice===0?"No Charge":`$${sidePrice.toLocaleString()}`}
                  </div>
                  <div style={{fontSize:10,color:"#9ca3af"}}>per aid</div>
                </div>
              )}
            </div>
          );
        };
        return (
          <div style={{background:"#FBF9F3",border:"1px solid #E4E0D5",borderRadius:10,padding:"14px 16px",marginBottom:20}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:8}}>Selected Devices</div>
            {renderSide("left","👂 Left Ear")}
            {renderSide("right","Right Ear 👂")}
            {aidBase != null && (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,paddingTop:10,borderTop:"2px solid #E4E0D5"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>Device Total</div>
                    <div style={{fontSize:11,color:"#6b7280"}}>{aidCount} aid{aidCount!==1?"s":""}{form.tier ? ` · ${form.tier} tier` : form.payType === "private" ? " · Private Pay" : ""}</div>
                  </div>
                  <div style={{background:"#0a1628",color:"white",borderRadius:8,padding:"8px 16px",textAlign:"right"}}>
                    <div style={{fontSize:20,fontWeight:800,lineHeight:1}}>
                      {aidTotal===0?"No Charge":`$${aidTotal.toLocaleString()}`}
                    </div>
                    {aidCount===1 && <div style={{fontSize:10,opacity:0.6,marginTop:2}}>one ear · add second to update</div>}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      };

      const selectedPlan = CARE_PLANS.find(c => c.id === form.carePlan);
      const cpCost = form.carePlan ? cpCostFor(form.carePlan) : null;
      const grandTotal = aidTotal != null && cpCost != null
        ? aidTotal + cpCost
        : aidTotal != null ? aidTotal
        : cpCost != null ? cpCost
        : null;

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

      const fireCarePlanSelected = () => {
        if (!form.carePlan) return;
        logAnalyticsEvent("care_plan_selected", {
          patient_id: wizardPatientId,
          provider_id: staffId,
          clinic_id: clinicId,
          selection: form.carePlan,
          change_count: carePlanChangeCountRef.current,
        });
      };

      return (
        <>
          {/* Device summary */}
          <DeviceSummary />

          {/* Care journey visualization */}
          <CareJourney />

          {/* Plan selector — three peer options, no pre-selection */}
          <div className="card">
            {form.payType !== "private" && (<>
            <div style={{marginBottom:20,fontFamily:"'DM Sans',sans-serif"}}>
              <h2 style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:24,fontWeight:700,color:"#111827",margin:0,letterSpacing:"-0.02em"}}>Choose your care plan</h2>
              <p style={{color:"#6b7280",fontSize:13,margin:"6px 0 0",lineHeight:1.5}}>Three options. Pick the one that fits how you want to receive ongoing care.</p>
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

            {/* Total investment */}
            {(aidTotal != null || form.carePlan) && (
              <div style={{marginTop:20,borderTop:"2px solid #E4E0D5",paddingTop:16}}>
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
                        {form.carePlan==="paygo"
                          ? "$65 per visit"
                          : `$${cpCost.toLocaleString()}`}
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
              </div>
            )}

            {/* ── Fork: Sign PA / Generate Quote / Continue ────────── */}
            <div style={{marginTop:24,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
              <div style={{display:"flex",gap:12,width:"100%",justifyContent:"center",flexWrap:"wrap"}}>
                <button
                  disabled={!(form.payType === "private" || !!form.carePlan)}
                  style={{background:"#15803d",color:"white",border:"none",borderRadius:8,padding:"12px 24px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",opacity:(form.payType === "private" || !!form.carePlan)?1:0.4,display:"flex",alignItems:"center",gap:8}}
                  onClick={()=>{ fireCarePlanSelected(); setPaSignatureName(""); setPaStep("review"); setShowWizardPaModal(true); }}
                >
                  <span style={{fontSize:16}}>📝</span> Sign Purchase Agreement
                </button>
                <button
                  disabled={!(form.payType === "private" || !!form.carePlan)}
                  style={{background:"#1e40af",color:"white",border:"none",borderRadius:8,padding:"12px 24px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",opacity:(form.payType === "private" || !!form.carePlan)?1:0.4,display:"flex",alignItems:"center",gap:8}}
                  onClick={()=>{ fireCarePlanSelected(); handleGenerateQuote(); }}
                >
                  <span style={{fontSize:16}}>📄</span> Generate Quote
                </button>
                <button
                  disabled={!(form.payType === "private" || !!form.carePlan)}
                  style={{background: form.priceOverridePerAid != null ? "#f0fdf4" : "#fff", color: form.priceOverridePerAid != null ? "#15803d" : "#374151", border:`1px solid ${form.priceOverridePerAid != null ? "#bbf7d0" : "#d1d5db"}`, borderRadius:8, padding:"12px 24px", fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", opacity:(form.payType === "private" || !!form.carePlan)?1:0.4, display:"flex", alignItems:"center", gap:8}}
                  onClick={()=>setShowAdjustModal(true)}
                >
                  <span style={{fontSize:16}}>🏷️</span> {form.priceOverridePerAid != null ? "Price Adjusted" : "Adjust Price"}
                </button>
              </div>
              {isTruHearingTPA && (
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
              <button
                disabled={!(form.payType === "private" || !!form.carePlan)}
                style={{background:"none",border:"none",color:"#9ca3af",fontFamily:"'Sora',sans-serif",fontSize:12,cursor:"pointer",padding:"4px 12px",opacity:(form.payType === "private" || !!form.carePlan)?1:0.4}}
                onClick={async()=>{
                  fireCarePlanSelected();
                  if (wizardPatientId && form.carePlan) { try { await updatePatientCarePlan(wizardPatientId, form.carePlan); setSaveToast(true); setTimeout(()=>setSaveToast(false), 2000); } catch(e) { console.error("care plan save:", e); } }
                  setStep(7);
                }}
              >
                Continue to review →
              </button>
            </div>
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
        const isEm = isTH
          ? ((TH_GAIN_MATRIX[`${d.thModel}|${d.style}`]||[]).find(g=>g.id===d.gainMatrix)?.earmold || false)
          : ((RECEIVER_POWERS[d.manufacturer]||[]).find(p=>p.id===d.receiverPower)?.earmold || false);
        const thDome = isEm ? "Custom Earmold" : (d.domeCategory && d.domeSize ? `${d.domeCategory} ${d.domeSize}` : d.domeCategory || d.dome || "—");
        const styleLabel = BODY_STYLES.find(s=>s.id===d.style)?.label || d.style || "—";
        const thMod = TH_MODELS.find(m => m.id === d.thModel);
        const thGen = fam?.generation || d.generation || "";
        const thSeries = fam?.thSeries || "";
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
              [isTH ? (thGen ? `${thGen} TruHearing Select` : "TruHearing Select") : d.generation, "Platform"],
              [isTH ? (thMod?.label || "TruHearing Select") : (fam?.family||""), "Model Family"],
              ...(isTH ? [
                [thSeries ? `${thSeries} · ${d.techLevel}` : d.techLevel, "Series / Tier"],
                [styleLabel, "Body Style"],
                ...(d.variant ? [[d.variant, "Variant / Style"]] : []),
                [d.isCROS ? "CROS Transmitter" : "Standard", "CROS"],
                [isLi ? "Rechargeable (Li-Ion)" : (d.battery||"—"), "Battery"],
                ...(thHasReceiver ? [
                  [d.receiverLength||"—", "Receiver Length"],
                  [pwrLabel, "Receiver Power"],
                  [thDome, "Dome / Coupling"],
                ] : []),
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
              ...(!isTH && BODY_STYLES.find(b=>b.id===d.style)?.hasDome ? [
                [isEm?"Custom Earmold":(d.dome||"—"), "Dome / Coupling"],
              ] : []),
            ].map(([v,k])=>(
              <div className="review-row" key={k}><span className="review-key">{k}</span><span className="review-val">{v}</span></div>
            ))}
            {isTH && planTierPrice !== null && (
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
    };


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


  const renderSettings = () => (
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
            {[["Version","1.0 Prototype"],["Patient App","Aided"],["Noah Integration","Coming soon — Noah ES API"],["HIPAA","Data stored locally in this session"]].map(([k,v])=>(
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


  // ── PATIENT CAMPAIGN CARD (embedded in patient detail) ────────────────────
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

  // ── PATIENT DETAIL ────────────────────────────────────────────────────────
  const renderPatientDetail = () => {
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
              onClick={() => startNewVisitForPatient(p)}
              title="Start a new visit — opens the upgrade flow for this established patient"
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
                onClick={() => { setDrawPaths([]); setDrawingEnabled(false); setPhonemeDimMode("both"); setView("consultation"); }}
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
            {p.devices && (p.carePlan || p.payType === "private") && (
              <button
                style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
                onClick={() => { setPaSignatureName(""); setPaDeliveryName(""); setPaDeliveryDate(""); setPaStep("sign"); setShowPurchaseAgreement(true); }}
              >
                <span style={{fontSize:14}}>📄</span> Generate Purchase Agreement
              </button>
            )}
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
            insurancePlans={insurancePlans}
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
        {showPurchaseAgreement && (() => {
          const cpId = p.carePlan;
          const hasDevices = p.devices?.left || p.devices?.right;
          const canGenerate = paSignatureName.trim().length > 2;
          // Private pay reads from the snapshot persisted at finalize.
          // Legacy records (pre-migration) fall back to the historical $2,750.
          const isPrivate = p.payType === 'private';
          const pricePerAid = isPrivate
            ? (p.privatePay?.tierPrice || 2750)
            : (p.insurance?.tierPrice || 0);
          const isBilateral = (p.devices?.fittingType === 'bilateral' || p.devices?.fittingType === 'cros_bicros');
          const aidCount = isBilateral ? 2 : 1;
          // Private pay bundles the care plan into the per-aid retail price.
          const carePlanCost = isPrivate ? 0 : (cpId === 'complete' ? 1250 : cpId === 'punch' ? 575 : 0);
          // CROS sides flat at $1,250; non-CROS sides use the snapshotted
          // pricePerAid. deviceTotal becomes the true pair total under CROS.
          const sideHasCros = (s) => !!s && /^(CROS|BICROS)/i.test(s.variant || '');
          const leftEarP  = p.devices?.left  ? (sideHasCros(p.devices.left)  ? CROS_PRICE_PER_UNIT : pricePerAid) : null;
          const rightEarP = p.devices?.right ? (sideHasCros(p.devices.right) ? CROS_PRICE_PER_UNIT : pricePerAid) : null;
          const deviceTotal = (leftEarP || 0) + (rightEarP || 0) || pricePerAid * aidCount;
          const totalPurchasePrice = deviceTotal + carePlanCost;

          const handleGeneratePDF = async (includeDelivery = false) => {
            if (closerNeedsLocation) { alert("Set your dispensing location in the sidebar before generating a purchase agreement."); setShowCloserPicker(true); return; } const { blob, fileName } = downloadPurchaseAgreement({
              patient: { name: p.name, address: p.address, phone: p.phone, dob: p.dob },
              devices: {
                fittingType: p.devices?.fittingType || 'bilateral',
                left: p.devices?.left || null,
                right: p.devices?.right || null,
              },
              carePlan: cpId,
              pricePerAid,
              leftPrice: leftEarP,
              rightPrice: rightEarP,
              payType: p.payType,
              clinic: paClinic,
              provider: paProvider,
              patientSignature: paSignatureName.trim(),
              patientSignatureDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
              deliverySignature: includeDelivery ? paDeliveryName.trim() || null : null,
              deliveryDate: includeDelivery ? paDeliveryDate || null : null,
              signatureImageBase64: paSignatureB64,
            });

            // Always archive to chart — paper trail required for compliance.
            try {
              await uploadPatientDocument({
                patientId: p.id,
                clinicId,
                staffId,
                kind: 'purchase_agreement',
                blob, fileName,
                metadata: {
                  carePlan: cpId,
                  pricePerAid,
                  aidCount,
                  deviceTotal,
                  carePlanCost,
                  totalPurchasePrice,
                  fittingType: p.devices?.fittingType || 'bilateral',
                  payType: p.payType,
                  patientSignature: paSignatureName.trim(),
                  includesDelivery: includeDelivery,
                  deliverySignature: includeDelivery ? (paDeliveryName.trim() || null) : null,
                  deliveryDate: includeDelivery ? (paDeliveryDate || null) : null,
                  providerName: paProvider.fullName || null,
                },
              });
              await refreshDocuments();
            } catch (e) {
              console.error('Archive purchase agreement:', e);
              alert('Purchase agreement downloaded, but failed to archive to chart: ' + (e.message || e));
            }

            // Convert TNS patient to active when PA is signed
            if (p.patientStatus === "tns") {
              try {
                const years = p.payType === "insurance" && p.carePlan === "complete" ? 4 : 3;
                await convertTnsToActive(p.id, years);
                const fittingDate = new Date().toISOString().split("T")[0];
                const expiry = new Date();
                expiry.setFullYear(expiry.getFullYear() + years);
                const warrantyExpiry = expiry.toISOString().split("T")[0];
                const updated = {
                  ...p,
                  patientStatus: "active",
                  devices: { ...p.devices, fittingDate, warrantyExpiry },
                };
                setSelectedPatient(updated);
                await refreshPatients();
              } catch (e) { console.error("convertTnsToActive:", e); }
            }
            setShowPurchaseAgreement(false);
          };

          return (
            <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(10,22,40,0.55)",backdropFilter:"blur(4px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowPurchaseAgreement(false)}>
              <div style={{background:"white",borderRadius:16,padding:32,width:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <div>
                    <div style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:18,color:"#0a1628"}}>Purchase Agreement</div>
                    <div style={{fontFamily:"'Sora',sans-serif",fontSize:12,color:"#6b7280",marginTop:2}}>{p.name}</div>
                  </div>
                  <button onClick={()=>setShowPurchaseAgreement(false)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9ca3af",padding:4}}>✕</button>
                </div>

                {/* Summary */}
                <div style={{background:"#FBF9F3",borderRadius:10,padding:16,marginBottom:20,border:"1px solid #E4E0D5"}}>
                  <div style={{fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:11,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,marginBottom:8}}>Agreement Summary</div>
                  {hasDevices && (
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,color:"#374151"}}>{p.devices?.left?.manufacturer || p.devices?.right?.manufacturer} {p.devices?.left?.family || p.devices?.right?.family} ({isBilateral ? 'pair' : 'single'})</span>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,fontWeight:600,color:"#0a1628"}}>${deviceTotal.toLocaleString('en-US',{minimumFractionDigits:2})}</span>
                    </div>
                  )}
                  {cpId && cpId !== 'paygo' && (
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,color:"#374151"}}>{cpId === 'complete' ? 'Complete Care+' : 'MHC Punch Card'}</span>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,fontWeight:600,color: isPrivate ? '#15803d' : '#0a1628'}}>{isPrivate ? 'Included' : (cpId === 'complete' ? '$1,250.00' : '$575.00')}</span>
                    </div>
                  )}
                  {cpId === 'paygo' && (
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,color:"#6b7280",fontStyle:"italic"}}>Standard Billing ($65 per visit)</span>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,color:"#6b7280"}}>$0.00</span>
                    </div>
                  )}
                  <div style={{borderTop:"1px solid #E4E0D5",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontFamily:"'Sora',sans-serif",fontSize:14,fontWeight:700,color:"#0a1628"}}>Total</span>
                    <span style={{fontFamily:"'Sora',sans-serif",fontSize:14,fontWeight:700,color:"#0a1628"}}>${totalPurchasePrice.toLocaleString('en-US',{minimumFractionDigits:2})}</span>
                  </div>
                </div>

                {paStep === "sign" && (
                  <>
                    {/* Adopt and Sign */}
                    <div style={{marginBottom:20}}>
                      <div style={{fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:11,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,marginBottom:8}}>Patient Signature — Adopt and Sign</div>
                      <div style={{fontFamily:"'Sora',sans-serif",fontSize:12,color:"#6b7280",marginBottom:10}}>Type your full legal name to electronically sign this agreement.</div>
                      <input
                        value={paSignatureName}
                        onChange={e => setPaSignatureName(e.target.value)}
                        placeholder="Full legal name"
                        autoFocus
                        style={{width:"100%",padding:"12px 14px",border:"1px solid #E4E0D5",borderRadius:10,fontFamily:"'Sora',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"}}
                      />
                      {paSignatureName.trim().length > 2 && (
                        <div style={{marginTop:12,padding:"14px 18px",background:"#FBF9F3",borderRadius:10,border:"1px dashed #d1d5db"}}>
                          <div style={{fontFamily:"'Georgia','Times New Roman',serif",fontSize:24,fontStyle:"italic",color:"#0a1628",letterSpacing:0.5}}>{paSignatureName}</div>
                          <div style={{fontFamily:"'Sora',sans-serif",fontSize:10,color:"#9ca3af",marginTop:4}}>Electronic signature preview</div>
                        </div>
                      )}
                    </div>

                    <div style={{display:"flex",gap:10}}>
                      <button
                        disabled={!canGenerate}
                        onClick={() => handleGeneratePDF(false)}
                        style={{flex:1,background:canGenerate?"#0a1628":"#d1d5db",color:"white",border:"none",borderRadius:10,padding:"12px 20px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,cursor:canGenerate?"pointer":"not-allowed",transition:"all 0.15s"}}
                      >
                        Adopt, Sign & Download
                      </button>
                      <button
                        onClick={() => setPaStep("delivery")}
                        style={{background:"none",border:"1px solid #E4E0D5",borderRadius:10,padding:"12px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",color:"#6b7280",whiteSpace:"nowrap"}}
                      >
                        + Delivery
                      </button>
                    </div>
                  </>
                )}

                {paStep === "delivery" && (
                  <>
                    {/* Show patient signature as confirmed */}
                    <div style={{background:"#ecfdf5",borderRadius:10,padding:12,marginBottom:16,border:"1px solid #a7f3d0",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:"#16a34a",fontSize:16}}>✓</span>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,color:"#065f46"}}>Purchase signed by {paSignatureName}</span>
                    </div>

                    <div style={{marginBottom:16}}>
                      <div style={{fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:11,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,marginBottom:8}}>Delivery Acknowledgement</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <div>
                          <label style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#6b7280",display:"block",marginBottom:4}}>Patient Name</label>
                          <input
                            value={paDeliveryName}
                            onChange={e => setPaDeliveryName(e.target.value)}
                            placeholder="Full legal name"
                            autoFocus
                            style={{width:"100%",padding:"10px 12px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}
                          />
                        </div>
                        <div>
                          <label style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#6b7280",display:"block",marginBottom:4}}>Delivery Date</label>
                          <input
                            type="date"
                            value={paDeliveryDate}
                            onChange={e => setPaDeliveryDate(e.target.value)}
                            style={{width:"100%",padding:"10px 12px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{display:"flex",gap:10}}>
                      <button
                        onClick={() => setPaStep("sign")}
                        style={{background:"none",border:"1px solid #E4E0D5",borderRadius:10,padding:"12px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",color:"#6b7280"}}
                      >
                        ← Back
                      </button>
                      <button
                        onClick={() => handleGeneratePDF(true)}
                        disabled={!paDeliveryName.trim() || !paDeliveryDate}
                        style={{flex:1,background:(paDeliveryName.trim()&&paDeliveryDate)?"#0a1628":"#d1d5db",color:"white",border:"none",borderRadius:10,padding:"12px 20px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,cursor:(paDeliveryName.trim()&&paDeliveryDate)?"pointer":"not-allowed",transition:"all 0.15s"}}
                      >
                        Sign & Download with Delivery
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

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
                            <div className="plan-row-tpa">{plan.carrier} · via {plan.tpa}</div>
                          </div>
                        ))}
                    </div>
                    {editDraft.planGroup && (
                      <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #E4E0D5",display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>TPA</span>
                        <span style={{fontSize:13,fontWeight:600,color:"#374151",background:"#F0EDE3",borderRadius:6,padding:"3px 10px"}}>{editDraft.tpa}</span>
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
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Warranty Expiry</label><input type="date" value={editDraft.warrantyExpiry} onChange={e=>setEditDraft(d=>({...d,warrantyExpiry:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
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
                  <button className="btn-ghost" style={{marginLeft:"auto",fontSize:11,padding:"4px 10px"}} onClick={startEditDevices}>Edit</button>
                )}
              </div>
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
                    const isEm = isTH
                      ? false
                      : (RECEIVER_POWERS[side.manufacturer]||[]).find(pw=>pw.id===side.receiverPower)?.earmold;
                    const domeVal = isTH
                      ? (side.domeCategory && side.domeSize ? `${side.domeCategory} ${side.domeSize}` : side.domeCategory || side.dome || "N/A")
                      : (isEm ? "Custom Earmold" : (side.dome || "N/A"));
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
                    {[["Serial (L)",p.devices?.serialLeft],["Serial (R)",p.devices?.serialRight],["Fitting Date",fmtDate(p.devices?.fittingDate||p.createdAt)],["Warranty Expires",fmtDate(p.devices?.warrantyExpiry)],["Warranty Status",days<0?"Expired":`${days} days remaining`]].map(([k,v])=>(
                      <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val" style={k==="Warranty Status"?{color:days<0?"#ef4444":days<90?"#f59e0b":"#16a34a"}:{}}>{v||"—"}</span></div>
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
                            <div style={{fontSize:10,color:"#dc2626",fontWeight:600,marginTop:2}}>{getDegreeName(rPTA)}</div>
                          </div>
                        )}
                        {lPTA!=null&&(
                          <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#2563eb",marginBottom:2}}>Left PTA</div>
                            <div style={{fontSize:20,fontWeight:800,color:"#0a1628",lineHeight:1}}>{lPTA} <span style={{fontSize:10,fontWeight:400,color:"#9ca3af"}}>dB HL</span></div>
                            <div style={{fontSize:10,color:"#2563eb",fontWeight:600,marginTop:2}}>{getDegreeName(lPTA)}</div>
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


            <AppointmentSchedule appointments={p.appointments} />


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
                                    : 'Quote';
                    const kindColor = d.kind === 'purchase_agreement' ? '#0a1628'
                                    : d.kind === 'kiosk_intake' ? '#7c3aed'
                                    : '#15803d';
                    const kindBg    = d.kind === 'purchase_agreement' ? '#e2e8f0'
                                    : d.kind === 'kiosk_intake' ? '#ede9fe'
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
              <div className="detail-card full">
                <div className="detail-card-title">Upgrade Tracking</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#9ca3af",display:"block",marginBottom:6}}>Care plan start</label>
                    <div style={{fontSize:13,fontWeight:600,color:"#0a1628",padding:"8px 0"}}>
                      {selectedPatient.carePlanStartDate ? fmtDate(selectedPatient.carePlanStartDate) : <span style={{color:"#9ca3af",fontWeight:400}}>—</span>}
                    </div>
                  </div>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#9ca3af",display:"block",marginBottom:6}}>Tier offered</label>
                    <input
                      type="text"
                      placeholder="e.g. Premium IX"
                      defaultValue={selectedPatient.upgradeTierOffered || ""}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        if (v === (selectedPatient.upgradeTierOffered || "")) return;
                        try {
                          await recordUpgradeOutcome(selectedPatient.id, { tierOffered: v });
                          await refreshPatients();
                          setSaveToast(true); setTimeout(()=>setSaveToast(false), 2000);
                        } catch (err) { console.error("recordUpgradeOutcome tier:", err); }
                      }}
                      style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:6,fontSize:13,fontFamily:"'Sora',sans-serif"}}
                    />
                  </div>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#9ca3af",display:"block",marginBottom:6}}>Outcome</label>
                    <select
                      value={selectedPatient.upgradeOutcome || ""}
                      onChange={async (e) => {
                        const v = e.target.value;
                        try {
                          await recordUpgradeOutcome(selectedPatient.id, {
                            outcome: v,
                            // Wipe donation recipient if outcome moves off "donated"
                            ...(v !== "donated" ? { donationRecipient: "" } : {}),
                          });
                          await refreshPatients();
                          setSaveToast(true); setTimeout(()=>setSaveToast(false), 2000);
                        } catch (err) { console.error("recordUpgradeOutcome outcome:", err); }
                      }}
                      style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:6,fontSize:13,fontFamily:"'Sora',sans-serif",background:"white"}}
                    >
                      <option value="">— not yet discussed —</option>
                      <option value="pending">Pending — conversation started</option>
                      <option value="declined">Declined upgrade</option>
                      <option value="upgraded">Upgraded</option>
                      <option value="reprogrammed">Reprogrammed (kept devices)</option>
                      <option value="donated">Donated old aids</option>
                    </select>
                  </div>
                </div>
                {(selectedPatient.upgradeOutcome === "donated" || selectedPatient.donationRecipient) && (
                  <div style={{marginTop:14}}>
                    <label style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#9ca3af",display:"block",marginBottom:6}}>Donation recipient</label>
                    <input
                      type="text"
                      placeholder="Recipient name or organization"
                      defaultValue={selectedPatient.donationRecipient || ""}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        if (v === (selectedPatient.donationRecipient || "")) return;
                        try {
                          await recordUpgradeOutcome(selectedPatient.id, { donationRecipient: v });
                          await refreshPatients();
                          setSaveToast(true); setTimeout(()=>setSaveToast(false), 2000);
                        } catch (err) { console.error("recordUpgradeOutcome donation:", err); }
                      }}
                      style={{width:"100%",padding:"8px 10px",border:"1px solid #E4E0D5",borderRadius:6,fontSize:13,fontFamily:"'Sora',sans-serif"}}
                    />
                  </div>
                )}
              </div>
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
  };


  // ── PRODUCT CATALOG ───────────────────────────────────────────────────────
  const [catMfrFilter, setCatMfrFilter] = useState("All");


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


  // Money display: show raw value while editing, format to 2 decimals when blurred.
  const formatMoney = (v) => (v == null || v === "" ? "" : Number(v).toFixed(2));

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


  const STYLE_OPTS = BODY_STYLES.map(s => s.id);


  // Defense-in-depth fallback for the admin-only views. The nav already hides
  // these for non-admins (and RLS rejects the writes), but guard the render
  // sites too so a non-admin who reaches the view by any other path sees this
  // instead of the editor.
  const renderAdminDenied = () => (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Admin access required</div>
          <div className="topbar-sub">This area is restricted to administrators.</div>
        </div>
      </div>
      <div className="content">
        <div style={{maxWidth:560,margin:"48px auto",textAlign:"center",color:"#6b7280"}}>
          <div style={{fontSize:40,marginBottom:12}}>🔒</div>
          <div style={{fontSize:15,fontWeight:600,color:"#374151",marginBottom:6}}>You don't have access to this page</div>
          <div style={{fontSize:13}}>Catalog, pricing, insurance plans, and provider management are limited to admin accounts. Contact your administrator if you need access.</div>
        </div>
      </div>
    </>
  );


  const renderCatalog = () => (
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


  // ── INSURANCE PLANS EDITOR (Admin) ──────────────────────────────────────
  // Mirrors the Product Catalog editor pattern: draft state, DB write first,
  // local refresh after success, .save-success / .save-error banners. Edits
  // land in `insurancePlans`, which also feeds the wizard's plan picker and
  // the coverage editor via activePlans.
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

  const renderInsurancePlans = () => {
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
  };


  // ── REBATES EDITOR (Admin → Rebates) ────────────────────────────────────
  // Mirrors the Insurance Plans editor. Feeds the §5 "Available Rebates" panel
  // on the device-selection screen (loadActiveRebates). Writes are clinic-
  // scoped per RLS; corporate (clinic_id null) rows render read-only.
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

  const renderRebates = () => {
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
  };


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
            {[["dashboard","Dashboard","dashboard"],["users","Patients","patients"],["bell","Follow-up","followup"],["archive","Archive","archive"],["chart","Reports","reports"],["compare","Compare Devices","compare"],["campaign","Campaigns","campaigns"],["book","Content Library","content"],["medal","Lima Charlie","lima-charlie"]].map(([icon,label,id])=>{
              const badge = id === "followup" ? countFollowUpPatients(patients) : 0;
              return (
              <div key={id} className={`nav-item ${view===id||(id==="dashboard"&&view==="new")||(id==="patients"&&(view==="dashboard"||view==="patient"))?"active":""}`}
                onClick={()=>{
                  if(id==="dashboard"||id==="patients") setView("dashboard");
                  else setView(id);
                }}>
                <span className="nav-icon"><Icon name={icon} size={17}/></span>{label}
                {badge > 0 && (
                  <span style={{marginLeft:"auto",background:"#ef4444",color:"white",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>{badge}</span>
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
              {[["users","Team","team"],["badge","Providers","providers"],["shield","Insurance Plans","insurance-plans"],["percent","Rebates","rebates"],["clipboard","Product Catalog","catalog"],["settings","Settings","settings"]].map(([icon,label,id])=>(
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
          {(view === "dashboard" || view === "patients") && renderDashboard()}
          {view === "archive" && renderArchive()}
          {view === "patient" && renderPatientDetail()}
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
                  <button className="btn-ghost" onClick={()=>setView("patient")}>{"\u2190"} Exit Consultation</button>
                </div>
                <div className="content">
                  <div style={{maxWidth:1100,margin:"0 auto"}}>
                    {renderResultsContent(p.audiology, p.notes || "")}
                  </div>
                </div>
              </>
            );
          })()}
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
                <ComparisonHub patientId={selectedPatient?.id || null} />
              </div>
            </>
          )}
          {view === "settings" && renderSettings()}
          {view === "catalog" && (checkRole(staffRole, ["admin"]) ? renderCatalog() : renderAdminDenied())}
          {view === "providers" && (checkRole(staffRole, ["admin"]) ? <ProvidersAdmin /> : renderAdminDenied())}
          {view === "insurance-plans" && (checkRole(staffRole, ["admin"]) ? renderInsurancePlans() : renderAdminDenied())}
          {view === "team" && (checkRole(staffRole, ["admin"]) ? <TeamAdmin activeClinicId={clinicId} /> : renderAdminDenied())}
          {view === "adjustments" && <AdjustmentHistory staffId={staffId} patients={patients} />}
          {view === "rebates" && renderRebates()}
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
              onSelectPatient={(p) => { setSelectedPatient(p); setView("patient"); }}
              onRefresh={refreshPatients}
            />
          )}
          {view === "upgrade" && selectedPatient && (
            <UpgradeWizard
              patient={selectedPatient}
              clinicId={clinicId}
              staffId={staffId}
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
            // We hide step index 6 from the stepper and skip it in nav. The
            // underlying STEPS indexes are unchanged; everything else still
            // references step === 6 etc. by absolute index.
            const skipCarePlan = form.payType === "private";
            const visibleSteps = skipCarePlan
              ? STEPS.map((s, i) => ({ s, i })).filter(({ i }) => i !== 6)
              : STEPS.map((s, i) => ({ s, i }));
            const visiblePos = visibleSteps.findIndex(({ i }) => i === step);
            // Click a completed step in the header to jump back to it (forward
            // navigation stays gated by Next / canProceed). Upgrade purchases
            // start mid-flow on an established patient, so the earlier new-patient
            // steps (≤4) aren't jump targets — mirror the Back button and bail to
            // the profile rather than entering them.
            const jumpToStep = (target) => {
              if (target >= step) return;
              if (wizardMode === "upgrade" && target <= 4) { setView("patient"); return; }
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
                      const clickable = pos < visiblePos && !(wizardMode === "upgrade" && i <= 4);
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
                  {renderStep()}
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
                      if (wizardMode === "upgrade" && step <= 4) { setView("patient"); return; }
                      // Private-pay skips Care Plan (step 6) — going Back from
                      // Review (step 7) lands on Device Selection (step 5).
                      if (skipCarePlan && step === 7) { setStep(5); return; }
                      setStep(s=>s-1);
                    }}>
                      {step===0?"Cancel":(wizardMode==="upgrade" && step<=4 ? "← Back to Profile" : "← Back")}
                    </button>
                    {step < STEPS.length-1 ? (
                      step === 6 ? null : (
                        <button className="btn-primary" disabled={!canProceed} style={{opacity:canProceed?1:0.4}} onClick={async()=>{
                          // Step 0 persists the patient profile before advancing
                          // so an abandoned wizard never loses the patient — a
                          // failure here must surface and block, never be swallowed.
                          if (step === 0 && !wizardPatientId) {
                            const name = [form.firstName, form.lastName].filter(Boolean).join(" ");
                            const ins = form.payType === "insurance" ? { carrier: form.carrier, planGroup: form.planGroup, tpa: form.tpa, tier: form.tier, tierPrice: form.tierPrice } : null;
                            try {
                              const pid = await createPatientDraft({ id: genId(), name, dob: form.dob, phone: form.phone, email: form.email, address: form.address, payType: form.payType, notes: form.notes, insurance: ins }, staffId, clinicId);
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
                              } else if (step === 5 && wizardPatientId) {
                                const leftRec = buildSideRecord(form.left);
                                const rightRec = buildSideRecord(form.right);
                                const isCROS = [leftRec, rightRec].some(r => r?.variant?.toLowerCase().includes("cros")) || form.left.isCROS || form.right.isCROS;
                                const fittingType = leftRec && rightRec ? (isCROS ? "cros_bicros" : "bilateral") : leftRec ? "monaural_left" : "monaural_right";
                                await updatePatientDevices(wizardPatientId, { left: leftRec, right: rightRec, fittingType, serialLeft: genId(), serialRight: genId() }, staffId, wizardVisitId);
                                setSaveToast(true); setTimeout(()=>setSaveToast(false), 2000);
                              }
                            } catch(e) { console.error("incremental save:", e); }
                          }
                          // Private-pay skips Care Plan — Continue from Device
                          // Selection (step 5) jumps straight to Review (step 7).
                          setStep(s => (skipCarePlan && s === 5) ? 7 : s + 1);
                        }}>
                          Continue →
                        </button>
                      )
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
                              <td style={{padding:"6px 8px"}}>{[d.family,d.variant,d.techLevel].filter(Boolean).join(" ")||"—"}</td>
                              <td style={{padding:"6px 8px"}}>{d.style||"—"}</td>
                              <td style={{padding:"6px 8px"}}>{d.battery||"—"}</td>
                              <td style={{padding:"6px 8px",fontWeight:700}}>${effPerAid.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                            </tr>
                          ))}
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