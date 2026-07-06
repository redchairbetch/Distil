import { useState, useRef, useEffect, useCallback } from "react";
import { submitIntake, uploadPatientDocument, redeemUpgradeCheckinCode, genIntakeId } from "./db.js";
import { generateIntakePdf } from "./generateIntakePdf.js";

// Manufacturer logos for the current-hearing-aids brand picker. Only the
// lines MHC sees most often carry a logo; everything else routes through the
// "Other" text reveal.
import logoOticon from "./assets/logos/Oticon.png";
import logoPhonak from "./assets/logos/Phonak.png";
import logoResound from "./assets/logos/Resound.png";
import logoRexton from "./assets/logos/Rexton.png";
import logoSignia from "./assets/logos/Signia.png";
import logoStarkey from "./assets/logos/Starkey.png";
import logoWidex from "./assets/logos/Widex.png";

// MHC logo for the intake-PDF header. Resolved via import.meta.glob so the
// build picks up whichever extension lives in src/assets/logos/MHC.* —
// drop a PNG/SVG/JPG with that base name and it's used automatically.
// Prefers PNG over SVG when both are present — jsPDF embeds a raster
// image more predictably than a vector at the small header size.
const MHC_LOGO_URL = (() => {
  const matches = import.meta.glob('./assets/logos/MHC.*', {
    eager: true, query: '?url', import: 'default',
  });
  const order = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
  for (const ext of order) {
    const hit = Object.entries(matches).find(([k]) => k.toLowerCase().endsWith(ext));
    if (hit) return hit[1];
  }
  return null;
})();

// Convert the bundled logo URL to a data URL so jsPDF can embed it via
// addImage at PDF-generation time without a separate network round-trip.
// Returns null on failure — generateIntakePdf falls back to a text
// wordmark in that case.
async function imageUrlToDataUrl(url) {
  if (!url) return null;
  try {
    const blob = await fetch(url).then(r => r.ok ? r.blob() : Promise.reject(new Error('logo fetch failed')));
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Intake logo load failed, falling back to text wordmark:', e);
    return null;
  }
}

// Clinic ID is set via environment variable so the kiosk knows
// which clinic to write intakes to without requiring a login.
// Add VITE_CLINIC_ID=your-clinic-uuid to your .env file.
const KIOSK_CLINIC_ID = import.meta.env.VITE_CLINIC_ID;

// Visit mode can be forced via the launch URL — front desk opens
// /intake?visit=upgrade (or ?visit=annual) for a returning patient so the
// kiosk skips the new-vs-returning picker and goes straight to the check-in.
// Absent the param, the welcome screen offers the choice (the "Both" entry
// point). Phase 2 will extend this param into a prefill token so last year's
// answers can be reviewed; for now it only selects the flow.
const KIOSK_FORCED_MODE = (() => {
  try {
    const v = new URLSearchParams(window.location.search).get("visit");
    return v === "upgrade" || v === "annual" ? "upgrade" : null;
  } catch {
    return null;
  }
})();

// ── Font Load ──────────────────────────────────────────────────────────────────
const _fl = document.createElement("link");
_fl.rel = "stylesheet";
_fl.href = "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Nunito:wght@400;500;600;700;800&display=swap";
document.head.appendChild(_fl);

// ── Brand ──────────────────────────────────────────────────────────────────────
const C = {
  bg: "#F5F2ED", card: "#FFFFFF", teal: "#0A7B8C", tealL: "#E3F4F6",
  tealD: "#075E6D", text: "#1A2B2D", muted: "#5A7274",
  border: "#D0DCDE", gold: "#D4924A", red: "#C0392B",
};
const font = "'Nunito', sans-serif";
const serif = "'DM Serif Display', serif";

// ── Static lookups ─────────────────────────────────────────────────────────────
// US states stored as 2-letter codes; display is the full name.
// Ordered A→Z; DC + territories appended so they're easy to find.
const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
  ["DC","District of Columbia"],["PR","Puerto Rico"],["VI","U.S. Virgin Islands"],["GU","Guam"],
];

// Auto-format (XXX) XXX-XXXX as the user types. Stores the formatted string
// (not raw digits) so the intake PDF prints phones correctly without extra work.
function formatPhone(raw = "") {
  const digits = String(raw).replace(/\D/g, "").slice(0, 10);
  if (digits.length >= 7) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length >= 4) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  if (digits.length > 0)  return `(${digits}`;
  return "";
}

// Parse ISO YYYY-MM-DD into {month, day, year} strings (or "" parts) so the
// three DOB dropdowns can render their current selection on back-navigation.
function parseIsoDob(iso = "") {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { year: "", month: "", day: "" };
  return { year: m[1], month: String(parseInt(m[2], 10)), day: String(parseInt(m[3], 10)) };
}

// Year range for the DOB Year dropdown — patients span infants (rare) up to
// centenarians. Current year down to 99 years back is generous but finite.
function dobYearRange() {
  const now = new Date().getFullYear();
  const years = [];
  for (let y = now; y >= now - 99; y--) years.push(y);
  return years;
}

// ── Translations ───────────────────────────────────────────────────────────────
const T = {
  en: {
    langPrompt: "Please select your preferred language to begin:",
    begin: "Let's Begin →",
    next: "Next →", back: "← Back", yes: "Yes", no: "No",
    continue_: "Continue →", skip: "Skip", submit: "Submit Form",
    required: "This field is required.",
    scrollFirst: "Please scroll to the bottom before continuing.",
    sigRequired: "Signature is required.",
    secPersonal: "About You", secMedical: "Medical History",
    secHearing: "Hearing History", secConsent: "Privacy & Consent",

    welcomeTitle: "Welcome to", welcomeBrand: "My Hearing Centers",
    welcomeBody: "This form takes about 5–7 minutes to complete.\nPlease answer all questions as honestly and completely as possible — your responses help us provide the best care for you.",

    nameTitle: "Let's start with your name.",
    firstName: "First Name", mi: "M.I. (optional)", lastName: "Last Name",

    dobTitle: "Date of birth & gender",
    dob: "Date of Birth", age: "Age",
    dobMonth: "Month", dobDay: "Day", dobYear: "Year",
    months: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    genderLabel: "Gender", male: "Male", female: "Female", preferNotSay: "Prefer not to say",
    selectPrompt: "Select…",
    otherDescribe: "Please describe (optional)",

    addressTitle: "What is your home address?",
    street: "Street Address", apt: "Apt # (optional)", city: "City", state: "State", zip: "Zip Code",

    contactTitle: "How can we reach you?",
    homePhone: "Home Phone (optional)", mobilePhone: "Mobile Phone",
    mobileType: "Mobile type:", iPhone: "iPhone", android: "Android", otherDevice: "Other",
    email: "Email Address", workPhone: "Work Phone (optional)",

    emergencyTitle: "Emergency contact & physician",
    spouseName: "Spouse's Name (optional)", spousePhone: "Spouse's Phone (optional)",
    spouseDob: "Spouse's Date of Birth (optional)",
    emergencyName: "Emergency Contact Name", emergencyPhone: "Emergency Contact Phone",
    pcp: "Primary Care Physician (optional)",

    visitTitle: "A couple more things…",
    visitReason: "What is your reason for today's visit? (optional)",
    referral: "How did you hear about our practice? (optional)",
    ref_current_patient: "Current patient",
    ref_friend_family: "Friend or family referral",
    ref_doctor: "Doctor referral",
    ref_google: "Google search",
    ref_social: "Social media",
    ref_tv_radio: "TV or radio",
    ref_direct_mail: "Direct mail",
    ref_event: "Event or health fair",
    ref_walkin: "Walk-in",
    ref_other: "Other",
    referrerNamePrompt: "Who referred you? (their name)",

    medQ_pain: "Do you have pain or discomfort in your ear(s)?",
    medQ_drain: "Do you have any drainage in your ear(s)?",
    medQ_sudden: "Have you had a sudden or rapid loss of hearing in the past 90 days?",
    medQ_ring: "Do you notice a ringing or other type of sounds in your ears?",
    medQ_dizzy: "Do you have acute or recurring dizziness or vertigo?",
    medQ_full: "Do your ears feel full or blocked?",
    medQ_doctor: "Have you seen your doctor regarding any of the above?",
    medQ_doctor_when: "When did you see your doctor?",
    medQ_surgery: "Have you ever had ear surgery?",
    medQ_thinner: "Are you taking blood thinning medication?",
    medQ_diabetic: "Are you diabetic?",
    diabeticType: "Which type?", type1: "Type I", type2: "Type II",
    medQ_family: "Who in your family has hearing loss and/or wears hearing aids?",
    familyPlaceholder: "e.g. Mother, Father, 2 Brothers, 1 Sister…",
    fam_mother: "Mother",
    fam_father: "Father",
    fam_grandparent_maternal: "Maternal grandparent",
    fam_grandparent_paternal: "Paternal grandparent",
    fam_siblings: "Siblings",
    fam_children: "Children",
    fam_aunt_uncle: "Aunt or uncle",
    fam_none: "None known",
    fam_unsure: "Unsure",
    medQ_noise_occupational: "Have you had significant occupational noise exposure? (construction, factory, military, aviation, etc.)",
    medQ_noise_recreational: "Have you had significant recreational noise exposure? (concerts, motorsports, firearms, power tools, etc.)",
    noiseDescribe: "Which kinds?",
    noise_construction: "Construction",
    noise_military: "Military",
    noise_aviation: "Aviation",
    noise_machinery: "Loud machinery at work",
    noise_firearms: "Firearms or hunting",
    noise_power_tools: "Power tools",
    noise_motorcycles: "Motorcycles or ATVs",
    noise_concerts: "Concerts or live music",
    noise_lawn: "Lawn or yard equipment",
    noise_woodworking: "Woodworking",
    noise_other: "Other",

    hearQ_tested: "Have you had your hearing tested before?",
    testedWhen: "When was your last hearing test?",
    testedResults: "What were the results?",
    normal: "Normal hearing",
    mild: "Mild loss",
    moderate: "Moderate loss",
    severe: "Severe loss",
    hearQ_aidsRecommended: "Were you advised to consider hearing aids?",
    hearQ_bestEar: "In which ear is your hearing the best?",
    right: "Right", left: "Left", same: "Same",
    hearQ_mumble: "Have you noticed that people seem to mumble?",
    hearQ_repeat: "Do you frequently ask people to repeat what they've said?",
    hearQ_understand: "Do you often hear someone speaking but not understand them?",
    hearQ_noisy: "Do you find it difficult to understand in noisy places?",
    hearQ_loud: "Have you been told that you speak loudly?",
    hearQ_tv: "Have you been told you turn the TV volume too loud?",
    hearQ_kids: "Do you have difficulty understanding children's voices?",
    hearQ_other: "What else should we know about your hearing challenges? (optional)",
    otherChallengesPlaceholder: "Describe any other hearing challenges…",
    hearQ_rating: "On a scale of 1 to 10, how well do you think you hear?",
    poor: "1 — Poor", excellent: "10 — Excellent",
    hearQ_ready: "If a hearing loss is diagnosed, are you ready to improve your hearing?",
    hearQ_prevented: "What has prevented you from addressing your hearing challenges? (optional)",
    resist_cost: "Cost or affordability",
    resist_cosmetics: "Cosmetics or appearance",
    resist_denial: "Didn't feel ready",
    resist_bad_experience: "Past bad experience",
    resist_stigma: "Stigma",
    resist_dont_know: "Didn't know where to start",
    resist_fear_dependence: "Fear of becoming dependent",
    resist_other: "Other",

    aidsTitle: "Do you currently wear hearing aids?",
    aidsWhichEar: "Which ear(s) do you wear a hearing aid in?",
    aidsBoth: "Both", aidsRight: "Right", aidsLeft: "Left",
    aidsHowOften: "How often do you wear your hearing aid(s)?",
    aidsHowOld: "How old are your current hearing aid(s)?",
    aidsBrand: "Brand", aidsStyle: "Style", aidsCost: "Cost",
    aidsSatisfied: "Are you hearing as well as you should with your current aids?",
    aidsWhyNot: "If not, why not? (optional)",
    aidsSatisfRating: "Satisfaction rating (1–10):",
    aidsFreq_never: "Never",
    aidsFreq_1_3: "1–3 days a week",
    aidsFreq_3_5: "3–5 days a week",
    aidsFreq_fulltime: "Full-time",
    aidsAge_1_2: "1–2 years",
    aidsAge_3_4: "3–4 years",
    aidsAge_5_plus: "5+ years",
    aidsBrandTitle: "What brand are your current hearing aids?",
    aidsBrandNotSure: "Not sure",
    aidsBrandOther: "Other brand",
    aidsBrandOtherPrompt: "Type the brand name",
    aidsSatisfTitle: "How satisfied are you with your current hearing aids?",

    privacyTitle: "Privacy Policy",
    privacyScrollNote: "Please scroll through the entire policy before continuing.",
    privacyIntro: "Our office is fully committed to compliance with HIPAA guidelines by:",
    privacyBullets: [
      "Providing appropriate security for your patient records.",
      "Protecting the privacy of your patient's medical information.",
      "Providing our patients with proper access to their medical records, after a signed release is obtained.",
      "Handling patient information and billing processes in compliance with national HIPAA standards.",
      "Not providing patient data to outside marketers, or to pharmaceutical companies for purpose of research.",
    ],
    privacyAgreeLabel: "I have read and agree to the Privacy Policy",

    insTitle: "Insurance Billing Acknowledgment",
    insScrollNote: "Please scroll through the entire acknowledgment before continuing.",
    insText: "I understand I am responsible for my deductible, co-pays, and/or money my insurance company says that I owe. I authorize the release of any medical information to my personal physician and to the insurance company if needed to process any claims and benefits either to myself or to the party who accepts assignment.\n\nI authorize payment of medical benefits to be made directly to My Hearing Centers for services rendered. This authorization shall remain in effect until otherwise stated in writing.\n\nBy signature below, I acknowledge that I have read and fully understand the above statements and I give approval for use of my information and digital signature in electronic order processing, should I decide to purchase hearing devices.",
    insAgreeLabel: "I have read and agree to the Insurance Billing terms",

    sigTitle: "Your Signature",
    sigCert: "By signing below, I certify that the information I provided above is accurate and correct to the best of my knowledge. I further acknowledge that I have read and understand the privacy policy and I consent to the use of the information for business purposes. I understand that a copy of this policy will be presented to me upon request.",
    sigClear: "Clear", sigHere: "Sign here →",

    tyTitle: "Thank You!", tyBrand: "My Hearing Centers",
    tyBody: "Your intake form has been received and saved. Please return this iPad to the front desk — we'll be right with you.",
    tyId: "Intake Reference ID:",

    // ── Draft restore & submit states ──
    draftTitle: "Pick up where you left off?",
    draftBody: "A form was started on this device but wasn't finished. Would you like to continue it, or start a new one?",
    draftContinue: "Continue my form",
    draftStartOver: "Start a new form",
    submitting: "Submitting…",
    submitFailed: "We couldn't submit your form. Your answers are saved on this device — please hand the iPad to the front desk.",

    // ── Mode picker (new patient vs. returning) ──
    modePromptTitle: "Welcome back — or welcome in.",
    modePromptBody: "Are you a new patient, or returning for an annual or upgrade visit?",
    modeNew: "I'm a new patient",
    modeNewDesc: "First visit — full intake form.",
    modeReturning: "I'm a returning patient",
    modeReturningDesc: "Annual check-in or upgrade visit — a few quick questions.",

    // ── Upgrade / returning-visit flow ──
    secUpgReturning: "Returning Visit",
    secUpgCheckin: "Annual Check-In",
    upgWelcomeTitle: "Welcome back to",
    upgWelcomeBody: "Good to see you again. This quick check-in takes about 2–3 minutes and helps us pick up right where we left off — just confirm a few details and tell us how your hearing has been this year.",
    upgCodePrompt: "Have a check-in code from the front desk?",
    upgCodePlaceholder: "Enter your code",
    upgCodeLoad: "Load My Info",
    upgCodeLoading: "Loading…",
    upgCodeLoaded: "✓ Your information is loaded — tap Begin to review it.",
    upgCodeErrorGeneric: "We couldn't find that code. Please check it, or continue without one.",
    upgCodeErrorExpired: "That code has expired. Please ask the front desk for a new one.",
    upgCodeErrorUsed: "That code was already used. Please ask the front desk for a new one.",
    upgIdentityTitle: "Let's confirm who you are.",
    upgDobTitle: "And your date of birth?",
    upgContactTitle: "Has your contact information changed?",
    upgContactNote: "Only fill in what's changed since your last visit — leave the rest blank.",
    upgContactOtherLabel: "Other updates (address, emergency contact, physician…)",
    upgInsuranceQ: "Has your insurance changed since your last visit?",
    upgInsuranceNewLabel: "Your new insurance carrier",
    upgInsCarrierLabel: "Your insurance carrier",
    upgInsOther: "Other",
    upgInsOtherPlaceholder: "Type your carrier's name",
    upgInsPlanLabel: "Your plan (type or pick)",
    upgInsPlanPlaceholder: "Plan name from your card, or pick a type",
    upgSatisfactionQ: "Overall, how satisfied are you with your current hearing aids?",
    upgSatisfPoor: "1 — Not satisfied", upgSatisfGood: "10 — Very satisfied",
    upgEnvironmentsQ: "Where are you struggling now that wasn't a problem before?",
    upgEnvNote: "Select all that apply — or skip if nothing's changed.",
    upgFeatureGapsQ: "Which of these would you want in new hearing aids?",
    upgFeatNote: "Select any that interest you.",
    upgIssuesQ: "Are your current hearing aids giving you any of these problems?",
    upgIssuesNote: "Select all that apply.",
    upgNotesQ: "Anything else about how your hearing has changed this year?",
    upgNotesPlaceholder: "Tell us anything else you'd like your provider to know…",
    upgSigCert: "By signing below, I confirm that the information I provided today is accurate and current to the best of my knowledge. I further acknowledge that I have read and understand the Privacy Policy and the Insurance Billing acknowledgment above, and I consent to the use of my information for business purposes. I understand that a copy of these policies will be presented to me upon request.",
    upgTyBody: "Thank you — your check-in has been received. Please return this iPad to the front desk; your provider will review your answers before your visit.",

    upgEnv_restaurants: "Restaurants or noisy places",
    upgEnv_groups: "Groups & meetings",
    upgEnv_phone: "Phone calls",
    upgEnv_tv: "Television",
    upgEnv_one_on_one: "One-on-one conversations",
    upgEnv_car: "In the car",
    upgEnv_outdoors: "Outdoors / wind",
    upgEnv_worship: "Place of worship",
    upgEnv_music: "Music",

    upgFeat_rechargeable: "Rechargeable batteries",
    upgFeat_phone_stream: "Stream phone calls",
    upgFeat_tv_stream: "Stream TV",
    upgFeat_hands_free: "Hands-free calls",
    upgFeat_app_control: "Control from a phone app",
    upgFeat_fall_detection: "Fall detection",
    upgFeat_tinnitus: "Ringing (tinnitus) relief",
    upgFeat_noise: "Better hearing in noise",

    upgIssue_feedback: "Whistling or feedback",
    upgIssue_low_volume: "Not loud enough",
    upgIssue_streaming_fails: "Streaming drops or fails",
    upgIssue_comfort: "Uncomfortable fit",
    upgIssue_frequent_repairs: "Frequent repairs",
    upgIssue_wont_charge: "Won't hold a charge",
    upgIssue_not_wearing: "I rarely wear them",
  },
  es: {
    langPrompt: "Por favor seleccione su idioma preferido para comenzar:",
    begin: "Comencemos →",
    next: "Siguiente →", back: "← Atrás", yes: "Sí", no: "No",
    continue_: "Continuar →", skip: "Omitir", submit: "Enviar Formulario",
    required: "Este campo es obligatorio.",
    scrollFirst: "Por favor desplace hacia abajo antes de continuar.",
    sigRequired: "Se requiere firma.",
    secPersonal: "Sobre Usted", secMedical: "Historia Médica",
    secHearing: "Historia Auditiva", secConsent: "Privacidad y Consentimiento",

    welcomeTitle: "Bienvenido a", welcomeBrand: "My Hearing Centers",
    welcomeBody: "Este formulario tarda aproximadamente 5–7 minutos en completarse.\nPor favor responda todas las preguntas de forma honesta y completa — sus respuestas nos ayudan a brindarle la mejor atención.",

    nameTitle: "Comencemos con su nombre.",
    firstName: "Nombre", mi: "Inicial (opcional)", lastName: "Apellido",

    dobTitle: "Fecha de nacimiento y género",
    dob: "Fecha de Nacimiento", age: "Edad",
    dobMonth: "Mes", dobDay: "Día", dobYear: "Año",
    months: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
    genderLabel: "Género", male: "Masculino", female: "Femenino", preferNotSay: "Prefiero no decir",
    selectPrompt: "Seleccione…",
    otherDescribe: "Por favor describa (opcional)",

    addressTitle: "¿Cuál es su dirección de casa?",
    street: "Dirección", apt: "Apto # (opcional)", city: "Ciudad", state: "Estado", zip: "Código Postal",

    contactTitle: "¿Cómo podemos comunicarnos con usted?",
    homePhone: "Teléfono de Casa (opcional)", mobilePhone: "Teléfono Móvil",
    mobileType: "Tipo de móvil:", iPhone: "iPhone", android: "Android", otherDevice: "Otro",
    email: "Correo Electrónico", workPhone: "Teléfono de Trabajo (opcional)",

    emergencyTitle: "Contacto de emergencia y médico",
    spouseName: "Nombre del Cónyuge (opcional)", spousePhone: "Teléfono del Cónyuge (opcional)",
    spouseDob: "Fecha de Nacimiento del Cónyuge (opcional)",
    emergencyName: "Nombre del Contacto de Emergencia", emergencyPhone: "Teléfono de Emergencia",
    pcp: "Médico de Cabecera (opcional)",

    visitTitle: "Un par de cosas más…",
    visitReason: "¿Cuál es el motivo de su visita de hoy? (opcional)",
    referral: "¿Cómo se enteró de nuestra práctica? (opcional)",
    ref_current_patient: "Paciente actual",
    ref_friend_family: "Referencia de amigo o familiar",
    ref_doctor: "Referencia de médico",
    ref_google: "Búsqueda en Google",
    ref_social: "Redes sociales",
    ref_tv_radio: "TV o radio",
    ref_direct_mail: "Correo directo",
    ref_event: "Evento o feria de salud",
    ref_walkin: "Sin cita previa",
    ref_other: "Otro",
    referrerNamePrompt: "¿Quién lo/la recomendó? (su nombre)",

    medQ_pain: "¿Tiene dolor o molestia en su(s) oído(s)?",
    medQ_drain: "¿Tiene algún drenaje en su(s) oído(s)?",
    medQ_sudden: "¿Ha tenido una pérdida de audición repentina o rápida en los últimos 90 días?",
    medQ_ring: "¿Nota un zumbido u otro tipo de sonidos en sus oídos?",
    medQ_dizzy: "¿Tiene mareos agudos o recurrentes o vértigo?",
    medQ_full: "¿Siente sus oídos llenos o bloqueados?",
    medQ_doctor: "¿Ha consultado a su médico sobre alguno de lo anterior?",
    medQ_doctor_when: "¿Cuándo consultó a su médico?",
    medQ_surgery: "¿Alguna vez ha tenido cirugía de oído?",
    medQ_thinner: "¿Está tomando medicamentos anticoagulantes?",
    medQ_diabetic: "¿Es diabético/a?",
    diabeticType: "¿Qué tipo?", type1: "Tipo I", type2: "Tipo II",
    medQ_family: "¿Quién en su familia tiene pérdida auditiva y/o usa audífonos?",
    familyPlaceholder: "Ej. Madre, Padre, 2 Hermanos, 1 Hermana…",
    fam_mother: "Madre",
    fam_father: "Padre",
    fam_grandparent_maternal: "Abuelo/a materno/a",
    fam_grandparent_paternal: "Abuelo/a paterno/a",
    fam_siblings: "Hermanos/as",
    fam_children: "Hijos/as",
    fam_aunt_uncle: "Tío/a",
    fam_none: "Ninguno conocido",
    fam_unsure: "No estoy seguro/a",
    medQ_noise_occupational: "¿Ha tenido exposición significativa a ruido en el trabajo? (construcción, fábrica, militar, aviación, etc.)",
    medQ_noise_recreational: "¿Ha tenido exposición significativa a ruido recreativo? (conciertos, deportes de motor, armas de fuego, herramientas eléctricas, etc.)",
    noiseDescribe: "¿Qué tipos?",
    noise_construction: "Construcción",
    noise_military: "Militar",
    noise_aviation: "Aviación",
    noise_machinery: "Maquinaria ruidosa en el trabajo",
    noise_firearms: "Armas de fuego o caza",
    noise_power_tools: "Herramientas eléctricas",
    noise_motorcycles: "Motocicletas o cuatrimotos",
    noise_concerts: "Conciertos o música en vivo",
    noise_lawn: "Equipo de jardín",
    noise_woodworking: "Carpintería",
    noise_other: "Otro",

    hearQ_tested: "¿Le han examinado la audición anteriormente?",
    testedWhen: "¿Cuándo fue su última prueba de audición?",
    testedResults: "¿Cuáles fueron los resultados?",
    normal: "Audición normal",
    mild: "Pérdida leve",
    moderate: "Pérdida moderada",
    severe: "Pérdida severa",
    hearQ_aidsRecommended: "¿Le aconsejaron considerar audífonos?",
    hearQ_bestEar: "¿En qué oído escucha mejor?",
    right: "Derecho", left: "Izquierdo", same: "Igual",
    hearQ_mumble: "¿Ha notado que las personas parecen murmurar?",
    hearQ_repeat: "¿Con frecuencia pide a las personas que repitan lo que han dicho?",
    hearQ_understand: "¿A menudo escucha a alguien hablar pero no lo entiende?",
    hearQ_noisy: "¿Le resulta difícil entender en lugares ruidosos?",
    hearQ_loud: "¿Le han dicho que habla muy fuerte?",
    hearQ_tv: "¿Le han dicho que sube demasiado el volumen del televisor?",
    hearQ_kids: "¿Tiene dificultad para entender las voces de los niños?",
    hearQ_other: "¿Qué más debemos saber sobre sus dificultades auditivas? (opcional)",
    otherChallengesPlaceholder: "Describa cualquier dificultad auditiva adicional…",
    hearQ_rating: "En una escala del 1 al 10, ¿qué tan bien cree que escucha?",
    poor: "1 — Malo", excellent: "10 — Excelente",
    hearQ_ready: "Si se diagnostica pérdida auditiva, ¿está listo/a para mejorar su audición?",
    hearQ_prevented: "¿Qué le ha impedido abordar sus problemas de audición? (opcional)",
    resist_cost: "Costo o accesibilidad",
    resist_cosmetics: "Estética o apariencia",
    resist_denial: "No me sentía listo/a",
    resist_bad_experience: "Mala experiencia previa",
    resist_stigma: "Estigma",
    resist_dont_know: "No sabía por dónde empezar",
    resist_fear_dependence: "Miedo a la dependencia",
    resist_other: "Otro",

    aidsTitle: "¿Usa actualmente audífonos?",
    aidsWhichEar: "¿En qué oído(s) usa el audífono?",
    aidsBoth: "Ambos", aidsRight: "Derecho", aidsLeft: "Izquierdo",
    aidsHowOften: "¿Con qué frecuencia los usa?",
    aidsHowOld: "¿Qué tan viejos son sus audífonos actuales?",
    aidsBrand: "Marca", aidsStyle: "Estilo", aidsCost: "Costo",
    aidsSatisfied: "¿Está escuchando tan bien como debería con sus audífonos?",
    aidsWhyNot: "Si no, ¿por qué no? (opcional)",
    aidsSatisfRating: "Calificación de satisfacción (1–10):",
    aidsFreq_never: "Nunca",
    aidsFreq_1_3: "1–3 días por semana",
    aidsFreq_3_5: "3–5 días por semana",
    aidsFreq_fulltime: "Todo el tiempo",
    aidsAge_1_2: "1–2 años",
    aidsAge_3_4: "3–4 años",
    aidsAge_5_plus: "5+ años",
    aidsBrandTitle: "¿De qué marca son sus audífonos actuales?",
    aidsBrandNotSure: "No estoy seguro/a",
    aidsBrandOther: "Otra marca",
    aidsBrandOtherPrompt: "Escriba el nombre de la marca",
    aidsSatisfTitle: "¿Qué tan satisfecho está con sus audífonos actuales?",

    privacyTitle: "Política de Privacidad",
    privacyScrollNote: "Por favor desplace hacia abajo para leer la política completa antes de continuar.",
    privacyIntro: "Nuestra oficina está totalmente comprometida con el cumplimiento de las pautas de HIPAA al:",
    privacyBullets: [
      "Proporcionar seguridad apropiada para sus registros de pacientes.",
      "Proteger la privacidad de la información médica de nuestros pacientes.",
      "Proporcionar a nuestros pacientes el acceso adecuado a sus registros médicos, después de obtener una autorización firmada.",
      "Manejar la información del paciente y los procesos de facturación en cumplimiento con los estándares nacionales de HIPAA.",
      "No proporcionar datos de pacientes a comercializadores externos, ni a compañías farmacéuticas con fines de investigación.",
    ],
    privacyAgreeLabel: "He leído y acepto la Política de Privacidad",

    insTitle: "Reconocimiento de Seguro y Facturación",
    insScrollNote: "Por favor desplace hacia abajo para leer el reconocimiento completo antes de continuar.",
    insText: "Entiendo que soy responsable de mi deducible, copagos y/o dinero que mi compañía de seguros diga que debo. Autorizo la divulgación de cualquier información médica a mi médico personal y a la compañía de seguros si es necesario para procesar cualquier reclamación y beneficios ya sea para mí mismo o para la parte que acepta la cesión.\n\nAutorizo el pago de beneficios médicos directamente a My Hearing Centers por los servicios prestados. Esta autorización permanecerá en vigor hasta que se indique lo contrario por escrito.\n\nAl firmar a continuación, reconozco que he leído y entendido completamente las declaraciones anteriores y doy mi aprobación para el uso de mi información y firma digital en el procesamiento de pedidos electrónicos, si decido comprar dispositivos auditivos.",
    insAgreeLabel: "He leído y acepto los términos de Seguro y Facturación",

    sigTitle: "Su Firma",
    sigCert: "Al firmar a continuación, certifico que la información que proporcioné anteriormente es precisa y correcta según mi leal saber y entender. Además, reconozco que he leído y entiendo la política de privacidad y doy mi consentimiento para el uso de la información para fines comerciales. Entiendo que se me presentará una copia de esta política cuando la solicite.",
    sigClear: "Borrar", sigHere: "Firme aquí →",

    tyTitle: "¡Gracias!", tyBrand: "My Hearing Centers",
    tyBody: "Su formulario de admisión ha sido recibido y guardado. Por favor devuelva este iPad a la recepción — en un momento estaremos con usted.",
    tyId: "ID de Referencia:",

    // ── Restauración de borrador y estados de envío ──
    draftTitle: "¿Continuar donde lo dejó?",
    draftBody: "Se comenzó un formulario en este dispositivo pero no se terminó. ¿Desea continuarlo o comenzar uno nuevo?",
    draftContinue: "Continuar mi formulario",
    draftStartOver: "Comenzar un formulario nuevo",
    submitting: "Enviando…",
    submitFailed: "No pudimos enviar su formulario. Sus respuestas están guardadas en este dispositivo — por favor entregue el iPad a la recepción.",

    // ── Selección de modo (paciente nuevo vs. paciente que regresa) ──
    modePromptTitle: "Bienvenido de nuevo — o bienvenido.",
    modePromptBody: "¿Es usted un paciente nuevo o regresa para una visita anual o de actualización?",
    modeNew: "Soy un paciente nuevo",
    modeNewDesc: "Primera visita — formulario completo.",
    modeReturning: "Soy un paciente que regresa",
    modeReturningDesc: "Revisión anual o visita de actualización — unas preguntas rápidas.",

    // ── Flujo de visita de seguimiento / actualización ──
    secUpgReturning: "Visita de Seguimiento",
    secUpgCheckin: "Revisión Anual",
    upgWelcomeTitle: "Bienvenido de nuevo a",
    upgWelcomeBody: "Qué gusto verlo de nuevo. Esta revisión rápida toma unos 2–3 minutos y nos ayuda a continuar donde lo dejamos — solo confirme algunos datos y cuéntenos cómo ha estado su audición este año.",
    upgCodePrompt: "¿Tiene un código de registro de la recepción?",
    upgCodePlaceholder: "Ingrese su código",
    upgCodeLoad: "Cargar Mi Información",
    upgCodeLoading: "Cargando…",
    upgCodeLoaded: "✓ Su información está cargada — toque Comencemos para revisarla.",
    upgCodeErrorGeneric: "No encontramos ese código. Verifíquelo o continúe sin él.",
    upgCodeErrorExpired: "Ese código ha expirado. Pídale uno nuevo a la recepción.",
    upgCodeErrorUsed: "Ese código ya fue utilizado. Pídale uno nuevo a la recepción.",
    upgIdentityTitle: "Confirmemos quién es usted.",
    upgDobTitle: "¿Y su fecha de nacimiento?",
    upgContactTitle: "¿Ha cambiado su información de contacto?",
    upgContactNote: "Complete solo lo que haya cambiado desde su última visita — deje el resto en blanco.",
    upgContactOtherLabel: "Otras actualizaciones (dirección, contacto de emergencia, médico…)",
    upgInsuranceQ: "¿Ha cambiado su seguro desde su última visita?",
    upgInsuranceNewLabel: "Su nueva compañía de seguros",
    upgInsCarrierLabel: "Su compañía de seguros",
    upgInsOther: "Otra",
    upgInsOtherPlaceholder: "Escriba el nombre de su seguro",
    upgInsPlanLabel: "Su plan (escriba o elija)",
    upgInsPlanPlaceholder: "Nombre del plan de su tarjeta, o elija un tipo",
    upgSatisfactionQ: "En general, ¿qué tan satisfecho está con sus audífonos actuales?",
    upgSatisfPoor: "1 — Nada satisfecho", upgSatisfGood: "10 — Muy satisfecho",
    upgEnvironmentsQ: "¿Dónde tiene dificultades ahora que antes no eran un problema?",
    upgEnvNote: "Seleccione todas las que correspondan — u omita si nada ha cambiado.",
    upgFeatureGapsQ: "¿Cuáles de estas funciones le gustaría tener en nuevos audífonos?",
    upgFeatNote: "Seleccione las que le interesen.",
    upgIssuesQ: "¿Sus audífonos actuales le están dando alguno de estos problemas?",
    upgIssuesNote: "Seleccione todos los que correspondan.",
    upgNotesQ: "¿Algo más sobre cómo ha cambiado su audición este año?",
    upgNotesPlaceholder: "Cuéntenos cualquier otra cosa que quiera que su proveedor sepa…",
    upgSigCert: "Al firmar a continuación, confirmo que la información que proporcioné hoy es precisa y actual según mi leal saber y entender. Además, reconozco que he leído y entiendo la Política de Privacidad y el Reconocimiento de Seguro y Facturación anteriores, y doy mi consentimiento para el uso de mi información para fines comerciales. Entiendo que se me presentará una copia de estas políticas cuando la solicite.",
    upgTyBody: "Gracias — su revisión ha sido recibida. Por favor devuelva este iPad a la recepción; su proveedor revisará sus respuestas antes de su visita.",

    upgEnv_restaurants: "Restaurantes o lugares ruidosos",
    upgEnv_groups: "Grupos y reuniones",
    upgEnv_phone: "Llamadas telefónicas",
    upgEnv_tv: "Televisión",
    upgEnv_one_on_one: "Conversaciones uno a uno",
    upgEnv_car: "En el automóvil",
    upgEnv_outdoors: "Al aire libre / viento",
    upgEnv_worship: "Lugar de culto",
    upgEnv_music: "Música",

    upgFeat_rechargeable: "Baterías recargables",
    upgFeat_phone_stream: "Transmitir llamadas telefónicas",
    upgFeat_tv_stream: "Transmitir televisión",
    upgFeat_hands_free: "Llamadas con manos libres",
    upgFeat_app_control: "Control desde una aplicación",
    upgFeat_fall_detection: "Detección de caídas",
    upgFeat_tinnitus: "Alivio del zumbido (tinnitus)",
    upgFeat_noise: "Mejor audición en ruido",

    upgIssue_feedback: "Silbido o retroalimentación",
    upgIssue_low_volume: "No suenan lo suficientemente fuerte",
    upgIssue_streaming_fails: "La transmisión se corta o falla",
    upgIssue_comfort: "Ajuste incómodo",
    upgIssue_frequent_repairs: "Reparaciones frecuentes",
    upgIssue_wont_charge: "No mantienen la carga",
    upgIssue_not_wearing: "Rara vez los uso",
  },
};

// ── Option tables ─────────────────────────────────────────────────────────────
// Stored keys are stable across translations and consumed by generateIntakePdf +
// the provider-side Health History step. Display names come from the
// translation dictionaries via the paired translation key.
const REFERRAL_OPTIONS = [
  ["current_patient","ref_current_patient"],["friend_family","ref_friend_family"],
  ["doctor","ref_doctor"],["google","ref_google"],["social","ref_social"],
  ["tv_radio","ref_tv_radio"],["direct_mail","ref_direct_mail"],
  ["event","ref_event"],["walkin","ref_walkin"],["other","ref_other"],
];
const FAMILY_OPTIONS = [
  ["mother","fam_mother"],["father","fam_father"],
  ["grandparent_maternal","fam_grandparent_maternal"],["grandparent_paternal","fam_grandparent_paternal"],
  ["siblings","fam_siblings"],["children","fam_children"],["aunt_uncle","fam_aunt_uncle"],
  ["none","fam_none"],["unsure","fam_unsure"],
];
// Occupational noise sources are workplace-flavored: construction, military,
// aviation, heavy machinery. Power tools, lawn equipment, and woodworking
// stay since they show up in landscaping / carpentry / maintenance jobs.
const NOISE_OPTIONS_OCCUPATIONAL = [
  ["construction","noise_construction"],["military","noise_military"],
  ["aviation","noise_aviation"],["machinery","noise_machinery"],
  ["power_tools","noise_power_tools"],["lawn","noise_lawn"],
  ["woodworking","noise_woodworking"],["other","noise_other"],
];
// Recreational excludes workplace-only "loud machinery at work" — doesn't
// belong to a hobby. Firearms/hunting, motorcycles, concerts are the
// typical recreational culprits.
const NOISE_OPTIONS_RECREATIONAL = [
  ["firearms","noise_firearms"],["motorcycles","noise_motorcycles"],
  ["concerts","noise_concerts"],["power_tools","noise_power_tools"],
  ["lawn","noise_lawn"],["woodworking","noise_woodworking"],
  ["other","noise_other"],
];
const RESISTANCE_OPTIONS = [
  ["cost","resist_cost"],["cosmetics","resist_cosmetics"],["denial","resist_denial"],
  ["bad_experience","resist_bad_experience"],["stigma","resist_stigma"],
  ["dont_know","resist_dont_know"],["fear_dependence","resist_fear_dependence"],
  ["other","resist_other"],
];

// ── Current-hearing-aids detail options ───────────────────────────────────────
// [storageKey, translationKey] pairs — kiosk stores the stable key, the PDF and
// provider Health History map it back to a label. Frequency and age are fixed
// ranges (no free text). Brand stores the manufacturer name directly (a proper
// noun) with the logo shown on the button; "Other" reveals a text field.
const AIDS_EAR_OPTIONS  = [["both","aidsBoth"],["right","aidsRight"],["left","aidsLeft"]];
const AIDS_FREQ_OPTIONS = [["never","aidsFreq_never"],["1_3","aidsFreq_1_3"],["3_5","aidsFreq_3_5"],["fulltime","aidsFreq_fulltime"]];
const AIDS_AGE_OPTIONS  = [["1_2","aidsAge_1_2"],["3_4","aidsAge_3_4"],["5_plus","aidsAge_5_plus"]];
const AIDS_BRAND_OPTIONS = [
  ["Phonak", logoPhonak], ["Oticon", logoOticon], ["Signia", logoSignia],
  ["ReSound", logoResound], ["Starkey", logoStarkey], ["Widex", logoWidex],
  ["Rexton", logoRexton],
];

// ── Upgrade / annual check-in option tables ───────────────────────────────────
// Storage keys deliberately MATCH the provider-side scoring model
// (upgradeReadiness.js: STRUGGLE_ENVIRONMENTS / FEATURE_GAPS / PERFORMANCE_TAGS)
// so a kiosk submission maps 1:1 into the UpgradeWizard REVIEW step with no
// translation table. Display labels are bilingual via the paired translation key.
const UPG_ENVIRONMENT_OPTIONS = [
  ["restaurants","upgEnv_restaurants"],["groups","upgEnv_groups"],["phone","upgEnv_phone"],
  ["tv","upgEnv_tv"],["one_on_one","upgEnv_one_on_one"],["car","upgEnv_car"],
  ["outdoors","upgEnv_outdoors"],["worship","upgEnv_worship"],["music","upgEnv_music"],
];
const UPG_FEATURE_OPTIONS = [
  ["rechargeable","upgFeat_rechargeable"],["phone_stream","upgFeat_phone_stream"],
  ["tv_stream","upgFeat_tv_stream"],["hands_free","upgFeat_hands_free"],
  ["app_control","upgFeat_app_control"],["fall_detection","upgFeat_fall_detection"],
  ["tinnitus","upgFeat_tinnitus"],["noise","upgFeat_noise"],
];
const UPG_ISSUE_OPTIONS = [
  ["feedback","upgIssue_feedback"],["low_volume","upgIssue_low_volume"],
  ["streaming_fails","upgIssue_streaming_fails"],["comfort","upgIssue_comfort"],
  ["frequent_repairs","upgIssue_frequent_repairs"],["wont_charge","upgIssue_wont_charge"],
  ["not_wearing","upgIssue_not_wearing"],
];

// ── Step definitions ───────────────────────────────────────────────────────────
// type: welcome | form | yesno | multiChoice | multiSelect | text | scale | aids | scrollConsent | signature | thanks
const STEPS = [
  { id: "welcome", type: "welcome" },
  { id: "name", type: "form", title: "nameTitle", sec: "secPersonal", fields: [
    { key: "firstName", label: "firstName", req: true, width: "50%" },
    { key: "mi", label: "mi", req: false, width: "20%" },
    { key: "lastName", label: "lastName", req: true, width: "100%" },
  ]},
  { id: "dob_gender", type: "form", title: "dobTitle", sec: "secPersonal", fields: [
    { key: "dob", label: "dob", req: true, width: "100%", type: "dob" },
    { key: "gender", label: "genderLabel", req: true, type: "radio", options: ["male","female","preferNotSay"], width: "100%" },
  ]},
  { id: "address", type: "form", title: "addressTitle", sec: "secPersonal", fields: [
    { key: "street", label: "street", req: true, width: "70%" },
    { key: "apt", label: "apt", req: false, width: "25%" },
    { key: "city", label: "city", req: true, width: "50%" },
    { key: "state", label: "state", req: true, width: "42%", type: "state" },
    { key: "zip", label: "zip", req: true, width: "100%" },
  ]},
  { id: "contact", type: "form", title: "contactTitle", sec: "secPersonal", fields: [
    { key: "homePhone", label: "homePhone", req: false, width: "48%", type: "tel" },
    { key: "mobilePhone", label: "mobilePhone", req: true, width: "48%", type: "tel" },
    { key: "mobileType", label: "mobileType", req: false, type: "radio", options: ["iPhone","android","otherDevice"], width: "100%" },
    { key: "email", label: "email", req: true, width: "100%", type: "email" },
    { key: "workPhone", label: "workPhone", req: false, width: "48%", type: "tel" },
  ]},
  { id: "emergency", type: "form", title: "emergencyTitle", sec: "secPersonal", fields: [
    { key: "spouseName", label: "spouseName", req: false, width: "55%" },
    { key: "spousePhone", label: "spousePhone", req: false, width: "40%", type: "tel" },
    { key: "spouseDob", label: "spouseDob", req: false, width: "100%", type: "dob" },
    { key: "emergencyName", label: "emergencyName", req: true, width: "55%" },
    { key: "emergencyPhone", label: "emergencyPhone", req: true, width: "40%", type: "tel" },
    { key: "pcp", label: "pcp", req: false, width: "100%" },
  ]},
  { id: "visit", type: "form", title: "visitTitle", sec: "secPersonal", fields: [
    { key: "visitReason", label: "visitReason", req: false, type: "textarea", width: "100%" },
    { key: "referralSource", label: "referral", req: false, type: "buttonGrid", width: "100%",
      options: REFERRAL_OPTIONS, reveals: [
        { when: "other",         valueKey: "referralOther", placeholder: "otherDescribe" },
        { when: "friend_family", valueKey: "referrerName",  placeholder: "referrerNamePrompt" },
      ] },
  ]},
  { id: "med_pain", type: "yesno", sec: "secMedical", qKey: "medQ_pain", ansKey: "med_pain" },
  { id: "med_drain", type: "yesno", sec: "secMedical", qKey: "medQ_drain", ansKey: "med_drain" },
  { id: "med_sudden", type: "yesno", sec: "secMedical", qKey: "medQ_sudden", ansKey: "med_sudden" },
  { id: "med_ring", type: "yesno", sec: "secMedical", qKey: "medQ_ring", ansKey: "med_ring" },
  { id: "med_dizzy", type: "yesno", sec: "secMedical", qKey: "medQ_dizzy", ansKey: "med_dizzy" },
  { id: "med_full", type: "yesno", sec: "secMedical", qKey: "medQ_full", ansKey: "med_full" },
  { id: "med_doctor", type: "yesno", sec: "secMedical", qKey: "medQ_doctor", ansKey: "med_doctor",
    followUp: { key: "med_doctor_when", label: "medQ_doctor_when", showIf: true } },
  { id: "med_surgery", type: "yesno", sec: "secMedical", qKey: "medQ_surgery", ansKey: "med_surgery" },
  { id: "med_thinner", type: "yesno", sec: "secMedical", qKey: "medQ_thinner", ansKey: "med_thinner" },
  { id: "med_diabetic", type: "yesno", sec: "secMedical", qKey: "medQ_diabetic", ansKey: "med_diabetic",
    followUp: { key: "med_diabetic_type", label: "diabeticType", type: "radio", options: ["type1","type2"], showIf: true } },
  { id: "med_family", type: "multiSelect", sec: "secMedical", qKey: "medQ_family", ansKey: "medFamilyHistory",
    options: FAMILY_OPTIONS, mutuallyExclusive: ["none","unsure"], req: false },
  { id: "med_noise_occupational", type: "yesno", sec: "secMedical", qKey: "medQ_noise_occupational", ansKey: "med_noise_occupational",
    followUp: { key: "med_noise_occupational_types", label: "noiseDescribe", showIf: true, type: "multiSelect",
      options: NOISE_OPTIONS_OCCUPATIONAL, otherKey: "other", otherValueKey: "med_noise_occupational_other" } },
  { id: "med_noise_recreational", type: "yesno", sec: "secMedical", qKey: "medQ_noise_recreational", ansKey: "med_noise_recreational",
    followUp: { key: "med_noise_recreational_types", label: "noiseDescribe", showIf: true, type: "multiSelect",
      options: NOISE_OPTIONS_RECREATIONAL, otherKey: "other", otherValueKey: "med_noise_recreational_other" } },
  { id: "hear_tested", type: "yesno", sec: "secHearing", qKey: "hearQ_tested", ansKey: "hear_tested",
    followUps: [
      { key: "hear_tested_when", label: "testedWhen", showIf: true, type: "yearSelect" },
      { key: "hear_tested_results", label: "testedResults", showIf: true, type: "radio",
        options: ["normal","mild","moderate","severe"] },
    ]},
  { id: "hear_aids_recommended", type: "yesno", sec: "secHearing",
    qKey: "hearQ_aidsRecommended", ansKey: "hear_aids_recommended", conditional: "hear_tested" },
  { id: "hear_best", type: "multiChoice", sec: "secHearing", qKey: "hearQ_bestEar", ansKey: "hear_best", options: ["right","left","same"] },
  { id: "hear_mumble", type: "yesno", sec: "secHearing", qKey: "hearQ_mumble", ansKey: "hear_mumble" },
  { id: "hear_repeat", type: "yesno", sec: "secHearing", qKey: "hearQ_repeat", ansKey: "hear_repeat" },
  { id: "hear_understand", type: "yesno", sec: "secHearing", qKey: "hearQ_understand", ansKey: "hear_understand" },
  { id: "hear_noisy", type: "yesno", sec: "secHearing", qKey: "hearQ_noisy", ansKey: "hear_noisy" },
  { id: "hear_loud", type: "yesno", sec: "secHearing", qKey: "hearQ_loud", ansKey: "hear_loud" },
  { id: "hear_tv", type: "yesno", sec: "secHearing", qKey: "hearQ_tv", ansKey: "hear_tv" },
  { id: "hear_kids", type: "yesno", sec: "secHearing", qKey: "hearQ_kids", ansKey: "hear_kids" },
  { id: "hear_rating", type: "scale", sec: "secHearing", qKey: "hearQ_rating", ansKey: "hear_rating" },
  { id: "hear_ready", type: "yesno", sec: "secHearing", qKey: "hearQ_ready", ansKey: "hear_ready" },
  { id: "hear_prevented", type: "multiSelect", sec: "secHearing", qKey: "hearQ_prevented", ansKey: "resistancePoints",
    options: RESISTANCE_OPTIONS, otherKey: "other", otherValueKey: "resistancePointsOther", req: false },
  { id: "aids_q", type: "yesno", sec: "secHearing", qKey: "aidsTitle", ansKey: "aids_q" },
  // Current-aid detail — one question per screen, gated on aids_q === true.
  { id: "aids_ear", type: "multiChoice", sec: "secHearing", qKey: "aidsWhichEar", ansKey: "aids_ear",
    options: AIDS_EAR_OPTIONS, conditional: "aids_q" },
  { id: "aids_howOften", type: "multiChoice", sec: "secHearing", qKey: "aidsHowOften", ansKey: "aids_howOften",
    options: AIDS_FREQ_OPTIONS, conditional: "aids_q" },
  { id: "aids_howOld", type: "multiChoice", sec: "secHearing", qKey: "aidsHowOld", ansKey: "aids_howOld",
    options: AIDS_AGE_OPTIONS, conditional: "aids_q" },
  { id: "aids_brand", type: "brandSelect", sec: "secHearing", qKey: "aidsBrandTitle", ansKey: "aids_brand",
    options: AIDS_BRAND_OPTIONS, conditional: "aids_q" },
  { id: "aids_satisfRating", type: "scale", sec: "secHearing", qKey: "aidsSatisfTitle", ansKey: "aids_satisfRating",
    lowKey: "upgSatisfPoor", highKey: "upgSatisfGood", conditional: "aids_q" },
  { id: "privacy", type: "scrollConsent", sec: "secConsent", contentKey: "privacy" },
  { id: "insurance", type: "scrollConsent", sec: "secConsent", contentKey: "insurance" },
  { id: "signature", type: "signature", sec: "secConsent" },
  { id: "thanks", type: "thanks" },
];

// Carrier brands shown as pick buttons on the returning-patient "insurance
// changed?" step. This is a CHANGE FLAG for the provider (who re-verifies live
// in the appointment — insurance verification deliberately stays out of the
// kiosk), not a coverage lookup, so it lists the umbrella brands a patient
// recognizes off their card rather than the internal plan-group rows. "Other"
// reveals a free-text field for anything off-list.
const INSURANCE_CARRIERS = [
  "UnitedHealthcare", "Humana", "Anthem", "Blue Cross Blue Shield", "Aetna",
  "Cigna", "Kaiser Permanente", "Regence", "Providence", "Select Health",
  "Devoted Health", "Highmark", "Medical Mutual", "SCAN",
];

// Patient-recognizable plan categories offered as a type-or-pick datalist for
// the plan field. Not the internal plan-group codes (jargon to a patient) — the
// patient types their plan name from the card or picks the closest category.
const INSURANCE_PLAN_TYPES = [
  "Medicare Advantage", "Medicare Supplement", "Medicaid",
  "PPO", "HMO", "Employer / Commercial", "VA / TriWest", "Not sure",
];

// ── Upgrade / annual returning-patient flow ───────────────────────────────────
// A short check-in for established patients (backlog #23, kiosk side). Reuses the
// same step renderers as the new-patient flow. Captures identity (to match the
// existing chart), any contact/insurance changes, and the patient-facing
// upgrade-readiness questionnaire. The structured readiness lands on the intake
// (handleSubmit) where the provider's UpgradeWizard reads it. Returning patients
// re-sign the Privacy Policy + Insurance Billing acknowledgment every year at
// their annual/upgrade visit (same scrollConsent screens as the new-patient
// flow), so the chart carries a fresh dated signature each year — the accuracy
// attestation on the signature screen is a supplement, not a replacement.
const UPGRADE_STEPS = [
  { id: "welcome", type: "welcome" },
  { id: "name", type: "form", title: "upgIdentityTitle", sec: "secUpgReturning", fields: [
    { key: "firstName", label: "firstName", req: true, width: "50%" },
    { key: "mi", label: "mi", req: false, width: "20%" },
    { key: "lastName", label: "lastName", req: true, width: "100%" },
  ]},
  { id: "dob", type: "form", title: "upgDobTitle", sec: "secUpgReturning", fields: [
    { key: "dob", label: "dob", req: true, width: "100%", type: "dob" },
  ]},
  { id: "contact_update", type: "form", title: "upgContactTitle", note: "upgContactNote", sec: "secUpgReturning", fields: [
    { key: "mobilePhone", label: "mobilePhone", req: false, width: "48%", type: "tel" },
    { key: "email", label: "email", req: false, width: "48%", type: "email" },
    { key: "upg_contact_other", label: "upgContactOtherLabel", req: false, type: "textarea", width: "100%" },
  ]},
  { id: "upg_insurance", type: "yesno", sec: "secUpgReturning", qKey: "upgInsuranceQ", ansKey: "upg_insurance_changed",
    followUp: { key: "upg_insurance_new", type: "insurance", showIf: true,
      carrierKey: "upg_insurance_carrier", carrierOtherKey: "upg_insurance_carrier_other", planKey: "upg_insurance_plan" } },
  { id: "upg_satisfaction", type: "scale", sec: "secUpgCheckin", qKey: "upgSatisfactionQ", ansKey: "upg_satisfaction",
    lowKey: "upgSatisfPoor", highKey: "upgSatisfGood" },
  { id: "upg_environments", type: "multiSelect", sec: "secUpgCheckin", qKey: "upgEnvironmentsQ", note: "upgEnvNote",
    ansKey: "upg_environments", options: UPG_ENVIRONMENT_OPTIONS, req: false },
  { id: "upg_issues", type: "multiSelect", sec: "secUpgCheckin", qKey: "upgIssuesQ", note: "upgIssuesNote",
    ansKey: "upg_issues", options: UPG_ISSUE_OPTIONS, req: false },
  { id: "upg_featureGaps", type: "multiSelect", sec: "secUpgCheckin", qKey: "upgFeatureGapsQ", note: "upgFeatNote",
    ansKey: "upg_featureGaps", options: UPG_FEATURE_OPTIONS, req: false },
  { id: "upg_notes", type: "text", sec: "secUpgCheckin", qKey: "upgNotesQ", ansKey: "upg_notes", phKey: "upgNotesPlaceholder", req: false },
  // Annual re-sign: returning patients read + agree to the Privacy Policy and
  // Insurance Billing acknowledgment each visit, then sign. Same scrollConsent
  // renderer + consent state keys (privacyAgreed / insuranceAgreed) as the
  // new-patient flow, so handleSubmit's consent payload and the archived PDF
  // pick them up with no extra wiring.
  { id: "privacy", type: "scrollConsent", sec: "secConsent", contentKey: "privacy" },
  { id: "insurance", type: "scrollConsent", sec: "secConsent", contentKey: "insurance" },
  { id: "signature", type: "signature", sec: "secConsent" },
  { id: "thanks", type: "thanks" },
];

// ── Draft persistence ──────────────────────────────────────────────────────────
// In-progress answers survive a refresh, a tablet sleep, or a network drop:
// the form state is mirrored to localStorage (debounced) and offered back via
// a "continue where you left off?" prompt on reload. This is PHI on a shared
// kiosk device, so the draft is aggressively short-lived — wiped on successful
// submit, on explicit "start a new form", and by a 30-minute idle reset (which
// also clears an abandoned half-finished form off the screen before the next
// patient picks up the iPad).
const DRAFT_KEY = "distil.kioskDraft.v1";
const DRAFT_TTL_MS = 30 * 60 * 1000;   // draft older than this is stale — discard
const IDLE_RESET_MS = 30 * 60 * 1000;  // no activity this long → reset kiosk
const THANKS_RESET_MS = 90 * 1000;     // thank-you screen → fresh kiosk for the next patient

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1 || !d.lang || !d.mode || !d.answers || typeof d.savedAt !== "number") return null;
    if (Date.now() - d.savedAt > DRAFT_TTL_MS) { localStorage.removeItem(DRAFT_KEY); return null; }
    return d;
  } catch { return null; }
}
function writeDraft(draft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage full/blocked — draft is best-effort */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// Clinic info for the intake-PDF header. Pulled from build-time env vars so
// each kiosk deployment can be branded to its host clinic without a DB
// round-trip (the kiosk runs anon and the clinic record is per-clinic, not
// per-kiosk-instance). Falls back to a blank line when unset — header still
// renders cleanly, just without the address/phone block.
const CLINIC_INFO = {
  name:    import.meta.env.VITE_CLINIC_NAME    || "",
  address: import.meta.env.VITE_CLINIC_ADDRESS || "",
  phone:   import.meta.env.VITE_CLINIC_PHONE   || "",
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function ProgressBar({ pct }) {
  return (
    <div style={{ height: 5, background: C.border, borderRadius: 3, marginBottom: 28 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: C.teal, borderRadius: 3, transition: "width 0.4s ease" }} />
    </div>
  );
}

function SectionBadge({ label }) {
  return (
    <span style={{ display: "inline-block", padding: "4px 12px", background: C.tealL, color: C.teal, borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
      {label}
    </span>
  );
}

// ── DOB dropdowns ──────────────────────────────────────────────────────────────
// Three <select>s (Month / Day / Year) instead of a native date picker. The
// calendar widget forces elderly patients to swipe back through 60+ years of
// months which is brutal on a kiosk; dropdowns jump straight to the value.
// Stores the combined value as ISO YYYY-MM-DD (empty string until all three
// are filled) so the DB DATE column and provider-side handlers can consume
// it directly without further normalization.
function DobDropdowns({ value, onChange, t, error }) {
  // The three dropdowns live in LOCAL state, not derived from the parent's
  // ISO value. Previously we re-derived `parts` from `value` every render,
  // but `value` is only set to a real ISO once all three parts are filled —
  // which meant picking Month first would fire onChange("") (since Day and
  // Year were still empty), zeroing the stored value, and the next render
  // would pull an empty Month back out of `value`. Visually the user saw
  // each selection erase the previous one. Local state keeps partial state
  // until the user finishes entering a full date.
  const [parts, setParts] = useState(() => parseIsoDob(value));
  // Sync from parent when it changes externally (e.g., back nav restoring a
  // previously-completed DOB). Safe to run on every change of `value` since
  // we only overwrite parts when the incoming ISO genuinely parses.
  useEffect(() => {
    const next = parseIsoDob(value);
    if (next.year || next.month || next.day) setParts(next);
  }, [value]);
  const update = (k, v) => {
    const next = { ...parts, [k]: v };
    setParts(next);
    if (next.year && next.month && next.day) {
      const iso = `${next.year}-${String(next.month).padStart(2,"0")}-${String(next.day).padStart(2,"0")}`;
      onChange(iso);
    } else {
      // Partial selection — clear the stored ISO so validation still flags
      // this field as incomplete rather than accepting a half-filled date.
      onChange("");
    }
  };
  // width: 100% because native <select> sizes to content by default;
  // without this the dropdowns shrink to fit the placeholder text and
  // leave the flex children visibly empty on the right.
  const selectStyle = {
    width: "100%", boxSizing: "border-box",
    fontSize: 17, padding: "12px 10px",
    border: `2px solid ${error ? C.red : C.border}`, borderRadius: 10,
    color: C.text, fontFamily: font, background: "#fff", outline: "none",
  };
  const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 };
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1.4 }}>
        <label style={labelStyle}>{t.dobMonth}</label>
        <select value={parts.month} onChange={e => update("month", e.target.value)} style={selectStyle}>
          <option value="">{t.selectPrompt}</option>
          {t.months.map((name, i) => <option key={i+1} value={i+1}>{name}</option>)}
        </select>
      </div>
      <div style={{ flex: 1 }}>
        <label style={labelStyle}>{t.dobDay}</label>
        <select value={parts.day} onChange={e => update("day", e.target.value)} style={selectStyle}>
          <option value="">{t.selectPrompt}</option>
          {Array.from({length: 31}, (_, i) => i+1).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div style={{ flex: 1.2 }}>
        <label style={labelStyle}>{t.dobYear}</label>
        <select value={parts.year} onChange={e => update("year", e.target.value)} style={selectStyle}>
          <option value="">{t.selectPrompt}</option>
          {dobYearRange().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── State dropdown ─────────────────────────────────────────────────────────────
// Stores 2-letter code; displays the full state name. Defaults to UT since
// MHC is Utah-based — sets only when the field is empty so it doesn't stomp
// a user who's already chosen another state.
function StateDropdown({ value, onChange, error }) {
  useEffect(() => { if (!value) onChange("UT"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <select value={value || ""} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: "12px 14px", border: `2px solid ${error ? C.red : C.border}`, borderRadius: 10, color: C.text, fontFamily: font, background: "#fff", outline: "none" }}>
      {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  );
}

// ── Single-select button grid (with optional conditional text reveals) ────────
// Used for the referral source. Options live in `options` as [storageKey,
// translationKey] pairs; selection writes storageKey to value. `reveals` is a
// list of { when, valueKey, placeholder }: when the selected option matches a
// `when`, a freeform text input appears writing to answers[valueKey] — e.g.
// "Other" → describe, "Friend or family referral" → name the referrer.
function ButtonGrid({ options, value, onChange, reveals = [], answers, setAnswer, t }) {
  // Single-select, so at most one reveal is active at a time.
  const activeReveal = reveals.find(r => r.when === value);
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {options.map(([key, tKey]) => {
          const selected = value === key;
          return (
            <button key={key} type="button" onClick={() => onChange(key)}
              style={{ padding: "12px 18px", borderRadius: 10, border: `2px solid ${selected ? C.teal : C.border}`, background: selected ? C.tealL : "#fff", color: selected ? C.tealD : C.text, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: font, transition: "all 0.15s" }}>
              {t[tKey] || tKey}
            </button>
          );
        })}
      </div>
      {activeReveal && (
        <div style={{ marginTop: 12 }}>
          <input type="text" value={answers?.[activeReveal.valueKey] || ""}
            onChange={e => setAnswer(activeReveal.valueKey, e.target.value)}
            placeholder={t[activeReveal.placeholder] || ""}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 16, padding: "10px 14px", border: `2px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none" }} />
        </div>
      )}
    </>
  );
}

// ── Multi-select button grid (with optional "other" freeform) ─────────────────
// Shared by family history, noise exposure types, and resistance points.
// `mutuallyExclusive` keys (like "none" / "unsure" on family history) clear
// all other selections when chosen, and get cleared when any other key is
// chosen. Stores selections as an array of storage keys.
function MultiSelectGrid({ options, value, onChange, otherKey, otherValue, onOtherChange, t, mutuallyExclusive = [] }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (key) => {
    let next;
    if (mutuallyExclusive.includes(key)) {
      next = selected.includes(key) ? [] : [key];
    } else if (selected.includes(key)) {
      next = selected.filter(k => k !== key);
    } else {
      next = [...selected.filter(k => !mutuallyExclusive.includes(k)), key];
    }
    onChange(next);
  };
  const showOther = otherKey && selected.includes(otherKey);
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {options.map(([key, tKey]) => {
          const isSelected = selected.includes(key);
          return (
            <button key={key} type="button" onClick={() => toggle(key)}
              style={{ padding: "12px 18px", borderRadius: 10, border: `2px solid ${isSelected ? C.teal : C.border}`, background: isSelected ? C.tealL : "#fff", color: isSelected ? C.tealD : C.text, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: font, transition: "all 0.15s" }}>
              {isSelected ? "✓ " : ""}{t[tKey] || tKey}
            </button>
          );
        })}
      </div>
      {showOther && (
        <div style={{ marginTop: 12 }}>
          <input type="text" value={otherValue || ""} onChange={e => onOtherChange(e.target.value)}
            placeholder={t.otherDescribe}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 16, padding: "10px 14px", border: `2px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none" }} />
        </div>
      )}
    </>
  );
}

function FieldInput({ field, t, value, onChange, error, answers, setAnswer }) {
  const lbl = t[field.label] || field.label;
  const st = { width: field.width || "100%", boxSizing: "border-box" };
  if (field.type === "dob") {
    return (
      <div style={{ ...st, marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{lbl}</label>
        <DobDropdowns value={value} onChange={onChange} t={t} error={error} />
        {error && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{error}</p>}
      </div>
    );
  }
  if (field.type === "state") {
    return (
      <div style={{ ...st, marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{lbl}</label>
        <StateDropdown value={value} onChange={onChange} error={error} />
        {error && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{error}</p>}
      </div>
    );
  }
  if (field.type === "buttonGrid") {
    return (
      <div style={{ ...st, marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{lbl}</label>
        <ButtonGrid options={field.options} value={value} onChange={onChange}
          reveals={field.reveals}
          answers={answers}
          setAnswer={setAnswer}
          t={t} />
        {error && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{error}</p>}
      </div>
    );
  }
  if (field.type === "radio") {
    return (
      <div style={{ ...st, marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{lbl}</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {field.options.map(opt => (
            <button key={opt} onClick={() => onChange(opt)}
              style={{ padding: "10px 18px", borderRadius: 10, border: `2px solid ${value === opt ? C.teal : C.border}`, background: value === opt ? C.tealL : "#fff", color: value === opt ? C.tealD : C.text, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: font, transition: "all 0.15s" }}>
              {t[opt] || opt}
            </button>
          ))}
        </div>
        {error && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{error}</p>}
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div style={{ ...st, marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{lbl}</label>
        <textarea value={value || ""} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: "12px 14px", border: `2px solid ${error ? C.red : C.border}`, borderRadius: 10, color: C.text, fontFamily: font, minHeight: 90, resize: "vertical", outline: "none" }} />
        {error && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{error}</p>}
      </div>
    );
  }
  const isPhone = field.type === "tel";
  return (
    <div style={{ ...st, marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{lbl}</label>
      <input
        type={field.type || "text"}
        inputMode={isPhone ? "tel" : undefined}
        value={value || ""}
        onChange={e => onChange(isPhone ? formatPhone(e.target.value) : e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: "12px 14px", border: `2px solid ${error ? C.red : C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none" }} />
      {error && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel, backLabel, stepIdx, nextDisabled = false }) {
  return (
    <div style={{ display: "flex", justifyContent: stepIdx > 1 ? "space-between" : "flex-end", marginTop: 28, gap: 12 }}>
      {stepIdx > 1 && <button onClick={onBack} style={{ padding: "13px 24px", fontSize: 15, fontWeight: 700, color: C.muted, background: "transparent", border: `2px solid ${C.border}`, borderRadius: 12, cursor: "pointer", fontFamily: font }}>{backLabel}</button>}
      <button onClick={onNext} disabled={nextDisabled} style={{ padding: "14px 36px", fontSize: 17, fontWeight: 800, color: "#fff", background: C.teal, border: "none", borderRadius: 12, cursor: nextDisabled ? "default" : "pointer", opacity: nextDisabled ? 0.6 : 1, fontFamily: font, letterSpacing: "0.02em" }}>{nextLabel}</button>
    </div>
  );
}

// ── Consent Screen (proper component to avoid hooks-in-conditional violation) ──
// requireScroll: the insurance acknowledgment is long enough to genuinely
// overflow its box, so it keeps the scroll-to-bottom gate. The privacy policy
// (intro + five bullets) fits on screen — it renders in full with no scroll
// container and the agree checkbox unlocked immediately.
function ConsentScreen({ t, isPrivacy, scrolled, agreed, onScroll, onToggleAgree, onBack, onNext, stepIdx, requireScroll = true }) {
  const scrollRef = useRef(null);
  const handleScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 10) onScroll();
  };
  const gateOpen = !requireScroll || scrolled;
  return (
    <>
      <SectionBadge label={t.secConsent} />
      <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: requireScroll ? "0 0 6px" : "0 0 14px" }}>{isPrivacy ? t.privacyTitle : t.insTitle}</h2>
      {requireScroll && <p style={{ fontSize: 13, color: C.gold, fontWeight: 700, marginBottom: 14 }}>⬇ {isPrivacy ? t.privacyScrollNote : t.insScrollNote}</p>}
      <div ref={scrollRef} onScroll={requireScroll ? handleScroll : undefined}
        style={{ ...(requireScroll ? { maxHeight: 280, overflowY: "scroll" } : {}), padding: "20px", background: "#FAFAFA", border: `2px solid ${C.border}`, borderRadius: 12, marginBottom: 20, fontSize: 15, lineHeight: 1.7, color: C.text }}>
        {isPrivacy ? (
          <>
            <p style={{ marginTop: 0 }}>{t.privacyIntro}</p>
            <ul style={{ paddingLeft: 20 }}>{t.privacyBullets.map((b, i) => <li key={i} style={{ marginBottom: 8 }}>{b}</li>)}</ul>
          </>
        ) : (
          t.insText.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
        )}
      </div>
      <button onClick={onToggleAgree} disabled={!gateOpen}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", background: agreed ? C.tealL : gateOpen ? "#fff" : "#f5f5f5", border: `2px solid ${agreed ? C.teal : C.border}`, borderRadius: 12, cursor: gateOpen ? "pointer" : "not-allowed", marginBottom: 16, textAlign: "left", fontFamily: font, transition: "all 0.2s" }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${agreed ? C.teal : C.border}`, background: agreed ? C.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {agreed && <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>✓</span>}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: agreed ? C.tealD : gateOpen ? C.text : C.muted }}>{isPrivacy ? t.privacyAgreeLabel : t.insAgreeLabel}</span>
      </button>
      {!gateOpen && <p style={{ fontSize: 13, color: C.gold, textAlign: "center", marginBottom: 12 }}>⬇ {t.scrollFirst}</p>}
      <NavButtons onBack={onBack} onNext={onNext} nextLabel={t.continue_} backLabel={t.back} stepIdx={stepIdx} />
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function IntakeKiosk() {
  const [lang, setLang] = useState(null);
  // null until chosen (or forced via ?visit=upgrade): "new" | "upgrade".
  const [mode, setMode] = useState(KIOSK_FORCED_MODE);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [hasSignature, setHasSignature] = useState(false);
  // Settable so the idle/thanks resets can mint a fresh ID for the next
  // patient, and so a display-ID collision retry can swap in the final ID.
  const [intakeId, setIntakeId] = useState(genIntakeId);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // An unfinished form found in localStorage on load — held here until the
  // patient chooses "continue" or "start a new form" on the restore prompt.
  const [pendingDraft, setPendingDraft] = useState(readDraft);
  // Returning-patient check-in code (Phase 2 prefill): the code the patient
  // types on the upgrade welcome screen, and the redeem status.
  const [codeInput, setCodeInput] = useState("");
  const [prefill, setPrefill] = useState({ status: "idle", message: "" }); // idle|loading|loaded|error
  const signatureRef = useRef(null);
  const isDrawing = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const t = lang ? T[lang] : T.en;
  const isUpgrade = mode === "upgrade";
  const activeSteps = isUpgrade ? UPGRADE_STEPS : STEPS;

  // Filter steps (skip aids_detail if aids_q === false)
  const visibleSteps = activeSteps.filter(s => {
    if (s.conditional) return answers[s.conditional] === true;
    return true;
  });
  const totalSteps = visibleSteps.length - 2; // exclude welcome + thanks from count
  const step = visibleSteps[stepIdx] || visibleSteps[0];
  const progressPct = stepIdx <= 1 ? 0 : Math.min(100, Math.round(((stepIdx - 1) / (totalSteps - 1)) * 100));

  const setAnswer = (key, val) => setAnswers(prev => ({ ...prev, [key]: val }));

  // Full reset — back to the language screen with clean state and a fresh
  // intake ID. Used by the idle sweep and the post-thank-you timer so the
  // kiosk is always ready for the next patient without a manual refresh.
  const resetKiosk = () => {
    clearDraft();
    setPendingDraft(null);
    setLang(null);
    setMode(KIOSK_FORCED_MODE);
    setStepIdx(0);
    setAnswers({});
    setErrors({});
    setHasSignature(false);
    setSubmitted(false);
    setSubmitting(false);
    setCodeInput("");
    setPrefill({ status: "idle", message: "" });
    setIntakeId(genIntakeId());
    lastActivityRef.current = Date.now();
  };

  // Resume the saved draft: restore language/mode/answers, clamp the step
  // index against the steps its answers make visible (never past the
  // signature step), and keep the original intake reference ID.
  const restoreDraft = () => {
    const d = pendingDraft;
    setPendingDraft(null);
    if (!d) return;
    const steps = (d.mode === "upgrade" ? UPGRADE_STEPS : STEPS)
      .filter(s => !s.conditional || d.answers?.[s.conditional] === true);
    const maxIdx = Math.max(1, steps.length - 2);
    setLang(d.lang);
    setMode(d.mode);
    setAnswers(d.answers || {});
    setStepIdx(Math.min(Math.max(1, d.stepIdx || 1), maxIdx));
    if (d.intakeId) setIntakeId(d.intakeId);
    lastActivityRef.current = Date.now();
  };

  // Mirror in-progress state to localStorage (debounced) once the patient is
  // past the welcome screen. Every write also stamps the activity clock for
  // the idle sweep. The signature canvas is deliberately NOT drafted — on
  // restore the patient re-signs, which is the correct legal posture anyway.
  useEffect(() => {
    lastActivityRef.current = Date.now();
    if (!lang || !mode || submitted || stepIdx < 1 || pendingDraft) return;
    const timer = setTimeout(() => {
      writeDraft({ v: 1, savedAt: Date.now(), lang, mode, stepIdx, answers, intakeId });
    }, 400);
    return () => clearTimeout(timer);
  }, [answers, stepIdx, lang, mode, intakeId, submitted, pendingDraft]);

  // Idle sweep: an untouched in-progress form (or an unanswered restore
  // prompt) resets after 30 minutes so the next patient never sees the
  // previous patient's answers.
  useEffect(() => {
    const iv = setInterval(() => {
      if (!lang && !pendingDraft) return; // language screen is already "reset"
      if (Date.now() - lastActivityRef.current > IDLE_RESET_MS) resetKiosk();
    }, 60 * 1000);
    return () => clearInterval(iv);
  }, [lang, pendingDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a successful submit, roll back to the language screen on a timer —
  // the front desk no longer needs to refresh the iPad between patients.
  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(resetKiosk, THANKS_RESET_MS);
    return () => clearTimeout(timer);
  }, [submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redeem a front-desk check-in code → seed identity, contact, and last year's
  // readiness so the patient reviews (not retypes). On failure, show a specific,
  // friendly message keyed to the edge function's error code.
  const handleLoadCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setPrefill({ status: "loading", message: "" });
    const result = await redeemUpgradeCheckinCode(code);
    if (result?.error) {
      const msg = result.error === "expired" ? t.upgCodeErrorExpired
        : result.error === "already_used" ? t.upgCodeErrorUsed
        : t.upgCodeErrorGeneric;
      setPrefill({ status: "error", message: msg });
      return;
    }
    const p = result?.payload || {};
    setAnswers(prev => ({
      ...prev,
      ...(p.patient?.firstName ? { firstName: p.patient.firstName } : {}),
      ...(p.patient?.lastName  ? { lastName:  p.patient.lastName  } : {}),
      ...(p.patient?.dob       ? { dob:       p.patient.dob       } : {}),
      ...(p.contact?.mobilePhone ? { mobilePhone: p.contact.mobilePhone } : {}),
      ...(p.contact?.email       ? { email:       p.contact.email       } : {}),
      ...(p.readiness?.satisfaction != null ? { upg_satisfaction: p.readiness.satisfaction } : {}),
      ...(Array.isArray(p.readiness?.environments) ? { upg_environments: p.readiness.environments } : {}),
      ...(Array.isArray(p.readiness?.featureGaps)  ? { upg_featureGaps:  p.readiness.featureGaps  } : {}),
      ...(Array.isArray(p.readiness?.issues)       ? { upg_issues:       p.readiness.issues       } : {}),
    }));
    setPrefill({ status: "loaded", message: t.upgCodeLoaded });
  };

  const validate = () => {
    if (step.type === "form") {
      const errs = {};
      step.fields.forEach(f => {
        if (f.req && !answers[f.key]) errs[f.key] = t.required;
      });
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }
    if (step.type === "signature") {
      if (!hasSignature) { setErrors({ sig: t.sigRequired }); return false; }
    }
    return true;
  };

  const goNext = () => {
    if (!validate()) return;
    setErrors({});
    if (stepIdx < visibleSteps.length - 1) setStepIdx(i => i + 1);
  };
  const goBack = () => { setErrors({}); if (stepIdx > 0) setStepIdx(i => i - 1); };

  const autoAdvance = (key, val) => {
    setAnswer(key, val);
    setTimeout(() => setStepIdx(i => i + 1), 300);
  };

  // Signature pad
  const getPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };
  const startDraw = useCallback((e) => {
    e.preventDefault();
    const canvas = signatureRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const p = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    isDrawing.current = true;
  }, []);
  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = signatureRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const p = getPos(e, canvas);
    ctx.lineTo(p.x, p.y); ctx.strokeStyle = C.text; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke();
    setHasSignature(true);
  }, []);
  const endDraw = useCallback(() => { isDrawing.current = false; }, []);
  const clearSig = () => {
    const canvas = signatureRef.current; if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmit = async () => {
    if (submitting) return; // double-tap guard — a second tap mid-flight would insert a duplicate row
    if (!hasSignature) { setErrors({ sig: t.sigRequired }); return; }
    // Guard: if the kiosk was built without VITE_CLINIC_ID, refuse to
    // proceed rather than letting the user sign and think they're done.
    // The insert would silently fail on a NOT-NULL clinic_id and the
    // intake would never reach the provider's queue — as happened once
    // on a preview deployment that had no env vars wired up.
    if (!KIOSK_CLINIC_ID) {
      setErrors({ sig: "Kiosk configuration error: clinic ID is not set. Please notify the front desk." });
      return;
    }
    setSubmitting(true);
    setErrors({});
    const canvas = signatureRef.current;
    const sigDataUrl = canvas ? canvas.toDataURL("image/png") : null;
    const timestamp = new Date().toISOString();
    // Mint the intake row's UUID client-side so we can archive the signed PDF
    // under the same id without needing RETURNING (anon role has no SELECT
    // policy on intakes — see submitIntake comment).
    const intakeRowId = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : null;
    // Returning-visit flow attaches a structured upgradeReadiness object whose
    // keys mirror the provider-side scoring model (upgradeReadiness.js), so the
    // UpgradeWizard REVIEW step can pre-fill from it without remapping.
    const wrappedAnswers = isUpgrade
      ? {
          ...answers,
          upgradeReadiness: {
            satisfaction:    answers.upg_satisfaction ?? null,
            environments:    answers.upg_environments || [],
            featureGaps:     answers.upg_featureGaps || [],
            issues:          answers.upg_issues || [],
            notes:           answers.upg_notes || "",
            insuranceChanged: answers.upg_insurance_changed ?? null,
            insuranceNew:    answers.upg_insurance_new || "",
          },
        }
      : answers;
    // The display ID is rebuilt into the payload each attempt so a unique-
    // index collision can swap in a regenerated one without re-signing.
    const makePayload = (displayId) => ({
      _meta: { intakeId: displayId, submittedAt: timestamp, lang, status: "pending", intakeType: isUpgrade ? "upgrade" : "new" },
      answers: wrappedAnswers,
      consent: { privacyAgreed: answers.privacyAgreed, insuranceAgreed: answers.insuranceAgreed, signedAt: timestamp, signatureDataUrl: sigDataUrl }
    });
    // Submit with retry — a patient standing at the kiosk should never lose
    // their form to one network blip. Two unique-violation cases are handled
    // specially: a PK conflict on a retry means the FIRST attempt actually
    // landed and only its response was lost (treat as success — same row
    // UUID every attempt makes the insert idempotent); a display-ID conflict
    // means a same-day MHC-ref collision (regenerate and go again).
    let displayId = intakeId;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await submitIntake(makePayload(displayId), KIOSK_CLINIC_ID, intakeRowId);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        const msg = String(e?.message || "");
        const isUnique = e?.code === "23505" || /duplicate key/i.test(msg);
        if (isUnique && attempt > 0 && /intakes_pkey/i.test(msg)) { lastErr = null; break; }
        if (isUnique && /intake_ref/i.test(msg)) displayId = genIntakeId();
        console.error(`Intake submit error (attempt ${attempt + 1}):`, e);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    if (lastErr) {
      setErrors({ sig: `${t.submitFailed} (${lastErr?.message || "network error"})` });
      setSubmitting(false);
      return; // draft stays in localStorage — nothing is lost
    }
    // The intake row is safely in the queue — the draft has served its purpose.
    clearDraft();
    if (displayId !== intakeId) setIntakeId(displayId);
    // Render the signed intake as a text-selectable PDF: generateIntakePdf
    // lays the fields out directly with jsPDF so the archived copy is
    // searchable and copy-pasteable. Logo + signature embed as images;
    // every field value is real text. The PDF is archived straight to
    // patient_documents (it lands on the patient's chart when the intake is
    // matched — linkIntakeToPatient backfills patient_id) rather than popping
    // a download on the kiosk: the chart copy is the compliance record, and
    // an iPad download the patient can't retrieve was just noise.
    const logoDataUrl = await imageUrlToDataUrl(MHC_LOGO_URL);
    const doc = generateIntakePdf({
      answers, intakeId: displayId, signatureDataUrl: sigDataUrl, timestamp, lang, T,
      logoDataUrl, clinic: CLINIC_INFO,
      intakeType: isUpgrade ? "upgrade" : "new",
      lookups: {
        referral: REFERRAL_OPTIONS,
        family: FAMILY_OPTIONS,
        noiseOccupational: NOISE_OPTIONS_OCCUPATIONAL,
        noiseRecreational: NOISE_OPTIONS_RECREATIONAL,
        resistance: RESISTANCE_OPTIONS,
        states: US_STATES,
        aidsEar: AIDS_EAR_OPTIONS,
        aidsFreq: AIDS_FREQ_OPTIONS,
        aidsAge: AIDS_AGE_OPTIONS,
        upgEnvironments: UPG_ENVIRONMENT_OPTIONS,
        upgFeatures: UPG_FEATURE_OPTIONS,
        upgIssues: UPG_ISSUE_OPTIONS,
      },
    });
    const fileName = `Intake_${answers.lastName || "Patient"}_${answers.firstName || ""}_${new Date().toLocaleDateString("en-US").replace(/\//g,"-")}.pdf`;
    const pdfBlob = doc.output("blob");
    // Archive to the chart. returnRow:false skips the .select() chain so
    // PostgREST issues a plain INSERT instead of INSERT...RETURNING — anon
    // has no SELECT policy on patient_documents, and RETURNING would fail
    // the SELECT RLS check on the new row (same workaround as submitIntake).
    // One retry on failure (each attempt gets a fresh timestamped storage
    // path, so a retry never collides); if both fail we still show the
    // thank-you — the intake row itself (answers + signature data URL) is
    // already saved, so the PDF can be regenerated provider-side.
    if (intakeRowId) {
      const archivePdf = () => uploadPatientDocument({
        clinicId: KIOSK_CLINIC_ID,
        intakeId: intakeRowId,
        kind: "kiosk_intake",
        blob: pdfBlob, fileName,
        returnRow: false,
        metadata: {
          intakeRefId: displayId,
          submittedAt: timestamp,
          lang,
          firstName: answers.firstName || null,
          lastName: answers.lastName || null,
          dob: answers.dob || null,
          privacyAgreed: !!answers.privacyAgreed,
          insuranceAgreed: !!answers.insuranceAgreed,
        },
      });
      try {
        await archivePdf();
      } catch (e) {
        console.error("Archive kiosk intake PDF (attempt 1):", e);
        try { await archivePdf(); }
        catch (e2) { console.error("Archive kiosk intake PDF (attempt 2):", e2); }
      }
    }
    setSubmitting(false);
    setSubmitted(true);
    setStepIdx(visibleSteps.findIndex(s => s.type === "thanks"));
  };

  // ── Draft Restore Prompt ─────────────────────────────────────────────────────
  // An unfinished form was found on this device (refresh, tablet sleep, or a
  // network drop mid-intake). Offer to continue it — rendered in the draft's
  // own language since the language screen hasn't been reached yet.
  if (pendingDraft) {
    const dt = T[pendingDraft.lang] || T.en;
    return (
      <div style={{ fontFamily: font, backgroundColor: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: C.card, borderRadius: 20, padding: "48px 40px", maxWidth: 520, width: "100%", boxShadow: "0 4px 30px rgba(10,123,140,0.10)", textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.teal, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>)) MY HEARING CENTERS</div>
          <h1 style={{ fontFamily: serif, fontSize: 28, color: C.text, margin: "0 0 12px" }}>{dt.draftTitle}</h1>
          <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.6, marginBottom: 32 }}>{dt.draftBody}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <button onClick={restoreDraft}
              style={{ padding: "20px 16px", fontSize: 19, fontWeight: 800, color: "#fff", background: C.teal, border: "none", borderRadius: 14, cursor: "pointer", fontFamily: font, letterSpacing: "0.02em" }}
              onMouseOver={e => e.target.style.background = C.tealD} onMouseOut={e => e.target.style.background = C.teal}>
              {dt.draftContinue}
            </button>
            <button onClick={() => { clearDraft(); setPendingDraft(null); }}
              style={{ padding: "16px 16px", fontSize: 16, fontWeight: 700, color: C.muted, background: "transparent", border: `2px solid ${C.border}`, borderRadius: 14, cursor: "pointer", fontFamily: font }}>
              {dt.draftStartOver}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Language Select ──────────────────────────────────────────────────────────
  if (!lang) {
    return (
      <div style={{ fontFamily: font, backgroundColor: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: C.card, borderRadius: 20, padding: "48px 40px", maxWidth: 520, width: "100%", boxShadow: "0 4px 30px rgba(10,123,140,0.10)", textAlign: "center" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.teal, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>)) MY HEARING CENTERS</div>
            <h1 style={{ fontFamily: serif, fontSize: 30, color: C.text, margin: "0 0 12px" }}>Welcome</h1>
            <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.6 }}>Please select your preferred language to begin.</p>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {["en", "es"].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ flex: 1, padding: "22px 16px", fontSize: 20, fontWeight: 800, color: "#fff", background: C.teal, border: "none", borderRadius: 14, cursor: "pointer", fontFamily: font, letterSpacing: "0.02em", transition: "background 0.15s" }}
                onMouseOver={e => e.target.style.background = C.tealD} onMouseOut={e => e.target.style.background = C.teal}>
                {l === "en" ? "🇺🇸  English" : "🇪🇸  Español"}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Mode Select (new vs. returning) ──────────────────────────────────────────
  // Shown only when the launch URL didn't force a mode (?visit=upgrade). The
  // "Both" entry point: front desk can pre-set the URL, or a walk-in self-selects.
  if (!mode) {
    return (
      <div style={{ fontFamily: font, backgroundColor: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: C.card, borderRadius: 20, padding: "48px 40px", maxWidth: 560, width: "100%", boxShadow: "0 4px 30px rgba(10,123,140,0.10)", textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.teal, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>)) MY HEARING CENTERS</div>
          <h1 style={{ fontFamily: serif, fontSize: 28, color: C.text, margin: "0 0 12px" }}>{t.modePromptTitle}</h1>
          <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.6, marginBottom: 32 }}>{t.modePromptBody}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[["new","modeNew","modeNewDesc"],["upgrade","modeReturning","modeReturningDesc"]].map(([m, titleKey, descKey]) => (
              <button key={m} onClick={() => { setMode(m); setStepIdx(0); }}
                style={{ padding: "20px 22px", borderRadius: 14, border: `2px solid ${C.border}`, background: "#fff", cursor: "pointer", fontFamily: font, textAlign: "left", transition: "all 0.15s" }}
                onMouseOver={e => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.background = C.tealL; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "#fff"; }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: C.tealD, marginBottom: 4 }}>{t[titleKey]}</div>
                <div style={{ fontSize: 14, color: C.muted }}>{t[descKey]}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Card Wrapper ─────────────────────────────────────────────────────────────
  const card = (children, noPad = false) => (
    <div style={{ fontFamily: font, backgroundColor: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ background: C.card, borderRadius: 20, padding: noPad ? 0 : "36px 36px 32px", maxWidth: 620, width: "100%", boxShadow: "0 4px 30px rgba(10,123,140,0.09)" }}>
        {step.type !== "welcome" && step.type !== "thanks" && <ProgressBar pct={progressPct} />}
        {children}
      </div>
    </div>
  );

  // ── Step Renderers ───────────────────────────────────────────────────────────
  if (step.type === "welcome") return card(
    <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.teal, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>)) MY HEARING CENTERS</div>
      <h1 style={{ fontFamily: serif, fontSize: 34, color: C.text, margin: "0 0 16px", lineHeight: 1.2 }}>{isUpgrade ? t.upgWelcomeTitle : t.welcomeTitle}<br /><span style={{ color: C.teal }}>{t.welcomeBrand}</span></h1>
      <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: isUpgrade ? 24 : 36, maxWidth: 460, margin: isUpgrade ? "0 auto 24px" : "0 auto 36px" }}>{isUpgrade ? t.upgWelcomeBody : t.welcomeBody}</p>
      {isUpgrade && (
        <div style={{ maxWidth: 420, margin: "0 auto 28px", background: C.tealL, borderRadius: 14, padding: "18px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.tealD, marginBottom: 10 }}>{t.upgCodePrompt}</div>
          {prefill.status === "loaded" ? (
            <div style={{ fontSize: 15, fontWeight: 700, color: C.teal, padding: "6px 0" }}>{prefill.message}</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10 }}>
                <input type="text" value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase())}
                  placeholder={t.upgCodePlaceholder} autoCapitalize="characters"
                  style={{ flex: 1, boxSizing: "border-box", fontSize: 18, fontWeight: 700, letterSpacing: 3, textAlign: "center", padding: "12px 10px", border: `2px solid ${prefill.status === "error" ? C.red : C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none", textTransform: "uppercase" }} />
                <button onClick={handleLoadCode}
                  disabled={prefill.status === "loading" || !codeInput.trim()}
                  style={{ padding: "12px 18px", fontSize: 15, fontWeight: 800, color: "#fff", background: C.teal, border: "none", borderRadius: 10, cursor: (prefill.status === "loading" || !codeInput.trim()) ? "default" : "pointer", opacity: (prefill.status === "loading" || !codeInput.trim()) ? 0.5 : 1, fontFamily: font, whiteSpace: "nowrap" }}>
                  {prefill.status === "loading" ? t.upgCodeLoading : t.upgCodeLoad}
                </button>
              </div>
              {prefill.status === "error" && (
                <div style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{prefill.message}</div>
              )}
            </>
          )}
        </div>
      )}
      <button onClick={() => setStepIdx(1)} style={{ padding: "16px 48px", fontSize: 19, fontWeight: 800, color: "#fff", background: C.teal, border: "none", borderRadius: 14, cursor: "pointer", fontFamily: font, letterSpacing: "0.03em" }}
        onMouseOver={e => e.target.style.background = C.tealD} onMouseOut={e => e.target.style.background = C.teal}>{t.begin}</button>
    </div>
  );

  if (step.type === "thanks") return card(
    <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.tealL, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 32 }}>✓</span>
      </div>
      <h1 style={{ fontFamily: serif, fontSize: 34, color: C.teal, margin: "0 0 12px" }}>{t.tyTitle}</h1>
      <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.7, marginBottom: 28 }}>{isUpgrade ? t.upgTyBody : t.tyBody}</p>
      <div style={{ background: C.tealL, borderRadius: 12, padding: "14px 20px", display: "inline-block" }}>
        <p style={{ fontSize: 13, color: C.teal, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.tyId}</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: C.tealD, margin: 0, fontFamily: "monospace" }}>{intakeId}</p>
      </div>
    </div>
  );

  if (step.type === "form") return card(
    <>
      {step.sec && <SectionBadge label={t[step.sec]} />}
      <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: step.note ? "0 0 8px" : "0 0 24px", lineHeight: 1.3 }}>{t[step.title]}</h2>
      {step.note && <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.6, margin: "0 0 24px" }}>{t[step.note]}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 16px" }}>
        {step.fields.map(f => (
          <FieldInput key={f.key} field={f} t={t} value={answers[f.key]} onChange={v => setAnswer(f.key, v)} error={errors[f.key]} answers={answers} setAnswer={setAnswer} />
        ))}
      </div>
      <NavButtons onBack={goBack} onNext={goNext} nextLabel={t.next} backLabel={t.back} stepIdx={stepIdx} />
    </>
  );

  if (step.type === "yesno") {
    // Auto-advance semantics with follow-ups:
    //   - No step has a follow-up → both Yes/No auto-advance (fast path).
    //   - Step has a follow-up, user taps No → auto-advance (nothing to fill).
    //   - Step has a follow-up, user taps Yes → do NOT auto-advance; reveal
    //     the follow-up and wait for the user to tap Continue.
    // The earlier "always-manual" fix stopped the Yes-skips-follow-up bug but
    // made No require a needless Continue click too.
    const followUps = step.followUps || (step.followUp ? [step.followUp] : []);
    const stepHasFollowUp = followUps.length > 0;
    const followUpVisible = stepHasFollowUp && answers[step.ansKey] === true;
    return card(
      <>
        {step.sec && <SectionBadge label={t[step.sec]} />}
        <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: "0 0 32px", lineHeight: 1.35 }}>{t[step.qKey]}</h2>
        {!followUpVisible ? (
          <div style={{ display: "flex", gap: 16 }}>
            {["yes","no"].map(opt => {
              const selectsYesWithFollowUp = stepHasFollowUp && opt === "yes";
              const onClick = selectsYesWithFollowUp
                ? () => setAnswer(step.ansKey, true)
                : () => autoAdvance(step.ansKey, opt === "yes");
              return (
                <button key={opt} onClick={onClick}
                  style={{ flex: 1, padding: "28px 16px", fontSize: 24, fontWeight: 800, color: opt === "yes" ? "#fff" : C.text, background: opt === "yes" ? C.teal : C.tealL, border: "none", borderRadius: 16, cursor: "pointer", fontFamily: font, transition: "all 0.15s", transform: answers[step.ansKey] === (opt === "yes") ? "scale(0.97)" : "scale(1)" }}>
                  {t[opt]}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              {["yes","no"].map(opt => (
                <button key={opt}
                  onClick={opt === "no" ? () => autoAdvance(step.ansKey, false) : () => setAnswer(step.ansKey, true)}
                  style={{ flex: 1, padding: "22px 16px", fontSize: 20, fontWeight: 800, color: answers[step.ansKey] === (opt==="yes") ? "#fff" : C.text, background: answers[step.ansKey] === (opt==="yes") ? C.teal : C.tealL, border: `2px solid ${answers[step.ansKey] === (opt==="yes") ? C.teal : "transparent"}`, borderRadius: 14, cursor: "pointer", fontFamily: font, transition: "all 0.15s" }}>
                  {t[opt]}
                </button>
              ))}
            </div>
            {followUpVisible && followUps.filter(fu => !fu.type || fu.type === "text").map(fu => (
              <div key={fu.key} style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{t[fu.label]}</label>
                <input type="text" value={answers[fu.key] || ""} onChange={e => setAnswer(fu.key, e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: "12px 14px", border: `2px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none" }} />
              </div>
            ))}
            {followUpVisible && followUps.filter(fu => fu.type === "insurance").map(fu => {
              const carrier = answers[fu.carrierKey] || "";
              const isOther = carrier === "__other__";
              const carrierOther = answers[fu.carrierOtherKey] || "";
              const plan = answers[fu.planKey] || "";
              const labelStyle = { display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 };
              const inputStyle = { width: "100%", boxSizing: "border-box", fontSize: 17, padding: "12px 14px", border: `2px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none", background: "#fff" };
              const pill = (sel) => ({ padding: "12px 20px", borderRadius: 10, border: `2px solid ${sel ? C.teal : C.border}`, background: sel ? C.tealL : "#fff", color: sel ? C.tealD : C.text, fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: font });
              // Keep the combined back-compat string (upg_insurance_new) in sync
              // so the submit payload, PDF, and provider view read one
              // human-readable "Carrier — Plan" without any downstream changes.
              const update = (patch) => setAnswers(prev => {
                const c = patch.carrier !== undefined ? patch.carrier : (prev[fu.carrierKey] || "");
                const co = patch.carrierOther !== undefined ? patch.carrierOther : (prev[fu.carrierOtherKey] || "");
                const pl = patch.plan !== undefined ? patch.plan : (prev[fu.planKey] || "");
                const carrierName = c === "__other__" ? co : c;
                const combined = [carrierName, pl].map(s => (s || "").trim()).filter(Boolean).join(" — ");
                return { ...prev, [fu.carrierKey]: c, [fu.carrierOtherKey]: co, [fu.planKey]: pl, [fu.key]: combined };
              });
              return (
                <div key={fu.key} style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>{t.upgInsCarrierLabel}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: isOther ? 12 : 22 }}>
                    {INSURANCE_CARRIERS.map(name => (
                      <button key={name} onClick={() => update({ carrier: name })} style={pill(carrier === name)}>{name}</button>
                    ))}
                    <button onClick={() => update({ carrier: "__other__" })} style={pill(isOther)}>{t.upgInsOther}</button>
                  </div>
                  {isOther && (
                    <input type="text" value={carrierOther} onChange={e => update({ carrierOther: e.target.value })}
                      placeholder={t.upgInsOtherPlaceholder} style={{ ...inputStyle, marginBottom: 22 }} />
                  )}
                  <label style={labelStyle}>{t.upgInsPlanLabel}</label>
                  <input type="text" list="upg-ins-plan-options" value={plan} onChange={e => update({ plan: e.target.value })}
                    placeholder={t.upgInsPlanPlaceholder} style={inputStyle} />
                  <datalist id="upg-ins-plan-options">
                    {INSURANCE_PLAN_TYPES.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
              );
            })}
            {followUpVisible && followUps.filter(fu => fu.type === "radio").map(fu => (
              <div key={fu.key} style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{t[fu.label]}</label>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {fu.options.map(opt => (
                    <button key={opt} onClick={() => setAnswer(fu.key, opt)}
                      style={{ padding: "12px 22px", borderRadius: 10, border: `2px solid ${answers[fu.key] === opt ? C.teal : C.border}`, background: answers[fu.key] === opt ? C.tealL : "#fff", color: answers[fu.key] === opt ? C.tealD : C.text, fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: font }}>
                      {t[opt] || opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {followUpVisible && followUps.filter(fu => fu.type === "yearSelect").map(fu => {
              const currentYear = new Date().getFullYear();
              const years = Array.from({ length: 70 }, (_, i) => currentYear - i);
              return (
                <div key={fu.key} style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{t[fu.label]}</label>
                  <select value={answers[fu.key] || ""} onChange={e => setAnswer(fu.key, e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: "12px 14px", border: `2px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none", background: "#fff" }}>
                    <option value="">—</option>
                    {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                </div>
              );
            })}
            {followUpVisible && followUps.filter(fu => fu.type === "multiSelect").map(fu => (
              <div key={fu.key} style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{t[fu.label]}</label>
                <MultiSelectGrid
                  options={fu.options}
                  value={answers[fu.key]}
                  onChange={v => setAnswer(fu.key, v)}
                  otherKey={fu.otherKey}
                  otherValue={answers[fu.otherValueKey]}
                  onOtherChange={v => setAnswer(fu.otherValueKey, v)}
                  t={t}
                />
              </div>
            ))}
            <NavButtons onBack={goBack} onNext={goNext} nextLabel={t.continue_} backLabel={t.back} stepIdx={stepIdx} />
          </>
        )}
        {!followUpVisible && stepIdx > 1 && (
          <div style={{ marginTop: 20 }}>
            <button onClick={goBack} style={{ padding: "10px 20px", fontSize: 14, fontWeight: 700, color: C.muted, background: "transparent", border: `2px solid ${C.border}`, borderRadius: 10, cursor: "pointer", fontFamily: font }}>{t.back}</button>
          </div>
        )}
      </>
    );
  }

  if (step.type === "multiChoice") return card(
    <>
      {step.sec && <SectionBadge label={t[step.sec]} />}
      <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: "0 0 32px", lineHeight: 1.35 }}>{t[step.qKey]}</h2>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Options are either plain strings (opt === storage key === translation
            key) or [storageKey, translationKey] pairs. */}
        {step.options.map(o => {
          const [oKey, oTKey] = Array.isArray(o) ? o : [o, o];
          const selected = answers[step.ansKey] === oKey;
          return (
            <button key={oKey} onClick={() => { setAnswer(step.ansKey, oKey); setTimeout(() => setStepIdx(i => i+1), 300); }}
              style={{ flex: 1, minWidth: 120, padding: "24px 16px", fontSize: 20, fontWeight: 800, borderRadius: 16, border: `3px solid ${selected ? C.teal : C.border}`, background: selected ? C.tealL : "#fff", color: selected ? C.tealD : C.text, cursor: "pointer", fontFamily: font, transition: "all 0.15s" }}>
              {t[oTKey] || oTKey}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 20 }}>
        <button onClick={goBack} style={{ padding: "10px 20px", fontSize: 14, fontWeight: 700, color: C.muted, background: "transparent", border: `2px solid ${C.border}`, borderRadius: 10, cursor: "pointer", fontFamily: font }}>{t.back}</button>
      </div>
    </>
  );

  if (step.type === "brandSelect") {
    const current = answers[step.ansKey] || "";
    const isOther = !!answers.aids_brand_isOther;
    const pill = (selected) => ({ padding: "14px 22px", borderRadius: 12, border: `2px solid ${selected ? C.teal : C.border}`, background: selected ? C.tealL : "#fff", color: selected ? C.tealD : C.text, fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: font });
    return card(
      <>
        {step.sec && <SectionBadge label={t[step.sec]} />}
        <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: "0 0 24px", lineHeight: 1.35 }}>{t[step.qKey]}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {step.options.map(([name, logo]) => {
            const selected = !isOther && current === name;
            return (
              <button key={name} type="button"
                onClick={() => { setAnswer("aids_brand_isOther", false); setAnswer(step.ansKey, name); }}
                title={name}
                style={{ width: 140, height: 76, display: "flex", alignItems: "center", justifyContent: "center", padding: 14, borderRadius: 12, border: `2px solid ${selected ? C.teal : C.border}`, background: selected ? C.tealL : "#fff", cursor: "pointer" }}>
                <img src={logo} alt={name} style={{ maxWidth: "100%", maxHeight: 40, objectFit: "contain" }} />
              </button>
            );
          })}
          <button type="button" onClick={() => { setAnswer("aids_brand_isOther", false); setAnswer(step.ansKey, "Not sure"); }}
            style={pill(!isOther && current === "Not sure")}>{t.aidsBrandNotSure}</button>
          <button type="button" onClick={() => { setAnswer("aids_brand_isOther", true); setAnswer(step.ansKey, ""); }}
            style={pill(isOther)}>{t.aidsBrandOther}</button>
        </div>
        {isOther && (
          <div style={{ marginTop: 14 }}>
            <input type="text" value={current} onChange={e => setAnswer(step.ansKey, e.target.value)}
              placeholder={t.aidsBrandOtherPrompt} autoFocus
              style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: "12px 14px", border: `2px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none" }} />
          </div>
        )}
        <NavButtons onBack={goBack} onNext={goNext} nextLabel={t.next} backLabel={t.back} stepIdx={stepIdx} />
      </>
    );
  }

  if (step.type === "multiSelect") return card(
    <>
      {step.sec && <SectionBadge label={t[step.sec]} />}
      <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: step.note ? "0 0 8px" : "0 0 24px", lineHeight: 1.35 }}>{t[step.qKey]}</h2>
      {step.note && <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.6, margin: "0 0 20px" }}>{t[step.note]}</p>}
      <MultiSelectGrid
        options={step.options}
        value={answers[step.ansKey]}
        onChange={v => setAnswer(step.ansKey, v)}
        otherKey={step.otherKey}
        otherValue={answers[step.otherValueKey]}
        onOtherChange={v => setAnswer(step.otherValueKey, v)}
        t={t}
        mutuallyExclusive={step.mutuallyExclusive || []}
      />
      <NavButtons onBack={goBack} onNext={goNext} nextLabel={step.req === false ? t.next : t.next} backLabel={t.back} stepIdx={stepIdx} />
    </>
  );

  if (step.type === "text") return card(
    <>
      {step.sec && <SectionBadge label={t[step.sec]} />}
      <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: "0 0 24px", lineHeight: 1.35 }}>{t[step.qKey]}</h2>
      <textarea value={answers[step.ansKey] || ""} onChange={e => setAnswer(step.ansKey, e.target.value)}
        placeholder={step.phKey ? t[step.phKey] : ""}
        rows={4}
        style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: "14px 16px", border: `2px solid ${C.border}`, borderRadius: 12, color: C.text, fontFamily: font, outline: "none", resize: "vertical" }} />
      <NavButtons onBack={goBack} onNext={goNext} nextLabel={step.req === false ? (answers[step.ansKey] ? t.next : t.skip) : t.next} backLabel={t.back} stepIdx={stepIdx} />
    </>
  );

  if (step.type === "scale") return card(
    <>
      {step.sec && <SectionBadge label={t[step.sec]} />}
      <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: "0 0 8px", lineHeight: 1.35 }}>{t[step.qKey]}</h2>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 16 }}>
        <span>{t[step.lowKey] || t.poor}</span><span>{t[step.highKey] || t.excellent}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 28 }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} onClick={() => { setAnswer(step.ansKey, n); setTimeout(() => setStepIdx(i => i+1), 300); }}
            style={{ width: 52, height: 52, borderRadius: 12, border: `3px solid ${answers[step.ansKey] === n ? C.teal : C.border}`, background: answers[step.ansKey] === n ? C.teal : "#fff", color: answers[step.ansKey] === n ? "#fff" : C.text, fontSize: 20, fontWeight: 800, cursor: "pointer", fontFamily: font, transition: "all 0.15s" }}>
            {n}
          </button>
        ))}
      </div>
      <div><button onClick={goBack} style={{ padding: "10px 20px", fontSize: 14, fontWeight: 700, color: C.muted, background: "transparent", border: `2px solid ${C.border}`, borderRadius: 10, cursor: "pointer", fontFamily: font }}>{t.back}</button></div>
    </>
  );

  if (step.type === "scrollConsent") {
    const isPrivacy = step.contentKey === "privacy";
    const scrolledKey = isPrivacy ? "privacyScrolled" : "insScrolled";
    const agreedKey = isPrivacy ? "privacyAgreed" : "insuranceAgreed";
    const scrolled = !!answers[scrolledKey];
    const agreed = !!answers[agreedKey];
    // Both consents fit on screen on the kiosk iPad — render them in full
    // and let the patient agree without a scroll-to-bottom gate.
    const requireScroll = false;
    return card(
      <ConsentScreen
        t={t} isPrivacy={isPrivacy} scrolled={scrolled} agreed={agreed}
        requireScroll={requireScroll}
        onScroll={() => setAnswer(scrolledKey, true)}
        onToggleAgree={() => { if (!requireScroll || scrolled) setAnswer(agreedKey, !agreed); }}
        onBack={goBack}
        onNext={() => { if (agreed) goNext(); }}
        stepIdx={stepIdx}
      />
    );
  }

  if (step.type === "signature") return card(
    <>
      <SectionBadge label={t.secConsent} />
      <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: "0 0 12px" }}>{t.sigTitle}</h2>
      <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.65, marginBottom: 20 }}>{isUpgrade ? t.upgSigCert : t.sigCert}</p>
      <div style={{ border: `2px solid ${errors.sig ? C.red : C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 8, background: "#FDFDFD", position: "relative" }}>
        {!hasSignature && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: C.border, fontSize: 16, fontWeight: 600, pointerEvents: "none", userSelect: "none" }}>{t.sigHere}</div>}
        <canvas ref={signatureRef} width={548} height={150} style={{ display: "block", touchAction: "none", cursor: "crosshair" }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        {errors.sig && <p style={{ color: C.red, fontSize: 13, margin: 0 }}>{errors.sig}</p>}
        <button onClick={clearSig} style={{ marginLeft: "auto", padding: "8px 18px", fontSize: 13, fontWeight: 700, color: C.muted, background: "transparent", border: `2px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: font }}>{t.sigClear}</button>
      </div>
      <NavButtons onBack={goBack} onNext={handleSubmit} nextLabel={submitting ? t.submitting : t.submit} backLabel={t.back} stepIdx={stepIdx} nextDisabled={submitting} />
    </>
  );

  return null;
}
