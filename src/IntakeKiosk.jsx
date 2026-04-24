import { useState, useRef, useEffect, useCallback } from "react";
import { submitIntake } from "./db.js";

// Clinic ID is set via environment variable so the kiosk knows
// which clinic to write intakes to without requiring a login.
// Add VITE_CLINIC_ID=your-clinic-uuid to your .env file.
const KIOSK_CLINIC_ID = import.meta.env.VITE_CLINIC_ID;

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
// (not raw digits) so generateHTML prints phones correctly without extra work.
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
    tyDownload: "Download Your Copy (PDF)",
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
    tyDownload: "Descargar Su Copia (PDF)",
  },
};

// ── Option tables ─────────────────────────────────────────────────────────────
// Stored keys are stable across translations and consumed by generateHTML +
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
      options: REFERRAL_OPTIONS, otherKey: "other", otherValueKey: "referralOther" },
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
  { id: "aids_detail", type: "aids", sec: "secHearing", conditional: "aids_q" },
  { id: "privacy", type: "scrollConsent", sec: "secConsent", contentKey: "privacy" },
  { id: "insurance", type: "scrollConsent", sec: "secConsent", contentKey: "insurance" },
  { id: "signature", type: "signature", sec: "secConsent" },
  { id: "thanks", type: "thanks" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function genIntakeId() {
  const d = new Date();
  const datePart = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.random().toString(36).substring(2,7).toUpperCase();
  return `MHC-${datePart}-${rand}`;
}

function generateHTML(answers, intakeId, signatureDataUrl, timestamp, t) {
  const yn = (key) => answers[key] === true ? "Yes" : answers[key] === false ? "No" : "—";
  const val = (key) => answers[key] || "—";
  // DOB is stored as ISO YYYY-MM-DD — format as MM/DD/YYYY for the printed
  // intake since that's what providers expect to scan quickly on paper.
  const dobDisplay = (() => {
    const p = parseIsoDob(answers.dob || "");
    if (!p.year || !p.month || !p.day) return "—";
    return `${String(p.month).padStart(2,"0")}/${String(p.day).padStart(2,"0")}/${p.year}`;
  })();
  const spouseDobDisplay = (() => {
    const p = parseIsoDob(answers.spouseDob || "");
    if (!p.year || !p.month || !p.day) return "—";
    return `${String(p.month).padStart(2,"0")}/${String(p.day).padStart(2,"0")}/${p.year}`;
  })();
  // State is stored as 2-letter code; render the full name so the printed
  // intake reads naturally.
  const stateDisplay = (() => {
    const code = answers.state;
    if (!code) return "";
    const found = US_STATES.find(([c]) => c === code);
    return found ? found[1] : code;
  })();
  // Referral: render the selected source name + freeform "other" text when
  // the user picked "Other".
  const referralDisplay = (() => {
    const src = answers.referralSource;
    if (!src) return "—";
    const found = REFERRAL_OPTIONS.find(([k]) => k === src);
    const name = found ? (t[found[1]] || found[1]) : src;
    if (src === "other" && answers.referralOther) return `${name} — ${answers.referralOther}`;
    return name;
  })();
  // Multi-select arrays → comma-separated list of translated names, with
  // "other" freeform text appended when present.
  const multiDisplay = (arrKey, options, otherKey, otherValueKey) => {
    const arr = Array.isArray(answers[arrKey]) ? answers[arrKey] : [];
    if (!arr.length) return "—";
    const names = arr
      .filter(k => k !== otherKey)
      .map(k => {
        const found = options.find(([kk]) => kk === k);
        return found ? (t[found[1]] || found[1]) : k;
      });
    if (arr.includes(otherKey)) {
      const otherName = options.find(([k]) => k === otherKey);
      const label = otherName ? (t[otherName[1]] || otherName[1]) : "Other";
      const extra = answers[otherValueKey] ? `${label} (${answers[otherValueKey]})` : label;
      names.push(extra);
    }
    return names.join(", ");
  };
  const familyDisplay     = multiDisplay("medFamilyHistory", FAMILY_OPTIONS, null, null);
  const occupNoiseDisplay = multiDisplay("med_noise_occupational_types", NOISE_OPTIONS_OCCUPATIONAL, "other", "med_noise_occupational_other");
  const recNoiseDisplay   = multiDisplay("med_noise_recreational_types", NOISE_OPTIONS_RECREATIONAL, "other", "med_noise_recreational_other");
  const resistanceDisplay = multiDisplay("resistancePoints", RESISTANCE_OPTIONS, "other", "resistancePointsOther");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><title>Patient Intake — ${val("firstName")} ${val("lastName")}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0A7B8C; padding-bottom: 12px; margin-bottom: 16px; }
  .logo-text { font-size: 20px; font-weight: bold; color: #0A7B8C; }
  .logo-sub { font-size: 10px; color: #555; }
  .meta { text-align: right; font-size: 11px; color: #555; }
  h2 { font-size: 13px; color: #0A7B8C; border-bottom: 1px solid #D0DCDE; padding-bottom: 4px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; }
  .row { display: flex; gap: 16px; margin-bottom: 6px; }
  .field { flex: 1; }
  .field label { display: block; font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .field .val { font-size: 12px; color: #111; border-bottom: 1px solid #ccc; padding-bottom: 2px; min-height: 16px; }
  .ynrow { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #eee; }
  .ynq { flex: 1; font-size: 11px; }
  .yna { font-size: 11px; font-weight: bold; color: #0A7B8C; width: 40px; text-align: right; }
  .sig-section { margin-top: 20px; border-top: 2px solid #0A7B8C; padding-top: 12px; }
  .sig-img { border: 1px solid #ccc; max-width: 300px; height: 80px; }
  .cert-text { font-size: 10px; color: #444; line-height: 1.5; margin-bottom: 10px; }
  /* Consent page — starts on a fresh sheet via page-break-before. Content
     flows naturally from top (privacy) → insurance → signature at the end
     of whatever space it takes. Previous attempts at bottom-anchoring the
     signature with flex + min-height caused overflow and extra blank
     pages; natural flow stays under one letter page every time. */
  .consent-page { page-break-before: always; }
  .consent-section { margin-bottom: 18px; }
  .consent-section h3 { font-size: 13px; color: #0A7B8C; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #D0DCDE; padding-bottom: 4px; }
  .consent-section p { font-size: 11px; line-height: 1.55; color: #333; margin: 6px 0; }
  .consent-section ul { font-size: 11px; line-height: 1.55; color: #333; padding-left: 20px; margin: 6px 0; }
  .consent-section li { margin-bottom: 4px; }
  @page { margin: 15mm; size: letter; }
  @media print { body { margin: 0; padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo-text">)) MY HEARING CENTERS</div>
    <div class="logo-sub">We Change Lives Through Better Hearing</div>
  </div>
  <div class="meta">
    <div><strong>PATIENT INTAKE FORM</strong></div>
    <div>Sycle ID: ___________</div>
    <div>Intake ID: ${intakeId}</div>
    <div>Date: ${new Date(timestamp).toLocaleDateString()}</div>
  </div>
</div>

<h2>Patient Information</h2>
<div class="row">
  <div class="field"><label>First Name</label><div class="val">${val("firstName")}</div></div>
  <div class="field"><label>M.I.</label><div class="val">${val("mi")}</div></div>
  <div class="field"><label>Last Name</label><div class="val">${val("lastName")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Date of Birth</label><div class="val">${dobDisplay}</div></div>
  <div class="field"><label>Gender</label><div class="val">${val("gender")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Address</label><div class="val">${val("street")} ${val("apt") !== "—" ? val("apt") : ""}, ${val("city")}, ${stateDisplay} ${val("zip")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Home Phone</label><div class="val">${val("homePhone")}</div></div>
  <div class="field"><label>Mobile Phone</label><div class="val">${val("mobilePhone")}</div></div>
  <div class="field"><label>Email</label><div class="val">${val("email")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Spouse</label><div class="val">${val("spouseName")}</div></div>
  <div class="field"><label>Spouse DOB</label><div class="val">${spouseDobDisplay}</div></div>
  <div class="field"><label>Spouse Phone</label><div class="val">${val("spousePhone")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Emergency Contact</label><div class="val">${val("emergencyName")} — ${val("emergencyPhone")}</div></div>
  <div class="field"><label>Primary Care Physician</label><div class="val">${val("pcp")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Reason for Visit</label><div class="val">${val("visitReason")}</div></div>
  <div class="field"><label>Referred By</label><div class="val">${referralDisplay}</div></div>
</div>

<h2>Medical History</h2>
${[
  ["Do you have pain or discomfort in your ear(s)?", "med_pain"],
  ["Do you have any drainage in your ear(s)?", "med_drain"],
  ["Sudden or rapid hearing loss in past 90 days?", "med_sudden"],
  ["Ringing or other sounds in your ears?", "med_ring"],
  ["Acute or recurring dizziness or vertigo?", "med_dizzy"],
  ["Do your ears feel full or blocked?", "med_full"],
  ["Seen a doctor regarding the above?", "med_doctor"],
  ["Ever had ear surgery?", "med_surgery"],
  ["Taking blood thinning medication?", "med_thinner"],
  ["Are you diabetic?", "med_diabetic"],
  ["Significant occupational noise exposure?", "med_noise_occupational"],
  ["Significant recreational noise exposure?", "med_noise_recreational"],
].map(([q,k]) => `<div class="ynrow"><div class="ynq">${q}${answers["med_diabetic_type"] && k === "med_diabetic" ? " — "+answers["med_diabetic_type"] : ""}${answers["med_doctor_when"] && k === "med_doctor" ? " ("+answers["med_doctor_when"]+")" : ""}${k === "med_noise_occupational" && occupNoiseDisplay !== "—" ? " — "+occupNoiseDisplay : ""}${k === "med_noise_recreational" && recNoiseDisplay !== "—" ? " — "+recNoiseDisplay : ""}</div><div class="yna">${yn(k)}</div></div>`).join("")}
<div class="row" style="margin-top:8px">
  <div class="field"><label>Family with hearing loss/aids</label><div class="val">${familyDisplay}</div></div>
</div>

<h2>Hearing History</h2>
${[
  ["Had hearing tested before?", "hear_tested"],
  ["People seem to mumble?", "hear_mumble"],
  ["Frequently ask people to repeat?", "hear_repeat"],
  ["Hear speaking but don't understand?", "hear_understand"],
  ["Difficult to hear in noisy places?", "hear_noisy"],
  ["Told you speak loudly?", "hear_loud"],
  ["Told you turn TV too loud?", "hear_tv"],
  ["Difficulty with children's voices?", "hear_kids"],
  ["Were aids recommended?", "hear_aids_recommended"],
  ["Ready to improve if loss diagnosed?", "hear_ready"],
].map(([q,k]) => {
  let suffix = "";
  if (k === "hear_tested" && answers["hear_tested_when"]) {
    const sevKey = answers["hear_tested_results"];
    const sevLabel = sevKey ? (t[sevKey] || sevKey) : null;
    suffix = " — Last tested: " + answers["hear_tested_when"] + (sevLabel ? ", Results: " + sevLabel : "");
  }
  return `<div class="ynrow"><div class="ynq">${q}${suffix}</div><div class="yna">${yn(k)}</div></div>`;
}).join("")}
<div class="row" style="margin-top:8px">
  <div class="field"><label>Best ear</label><div class="val">${val("hear_best")}</div></div>
  <div class="field"><label>Self-rated hearing (1–10)</label><div class="val">${val("hear_rating")}</div></div>
</div>
<div class="row">
  <div class="field"><label>What has prevented addressing hearing</label><div class="val">${resistanceDisplay}</div></div>
</div>

${answers.aids_q ? `
<h2>Current Hearing Aids</h2>
<div class="row">
  <div class="field"><label>Which ear(s)</label><div class="val">${val("aids_ear")}</div></div>
  <div class="field"><label>How often worn</label><div class="val">${val("aids_howOften")}</div></div>
  <div class="field"><label>Age of aids</label><div class="val">${val("aids_howOld")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Brand</label><div class="val">${val("aids_brand")}</div></div>
  <div class="field"><label>Style</label><div class="val">${val("aids_style")}</div></div>
  <div class="field"><label>Cost</label><div class="val">${val("aids_cost")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Hearing well with current aids?</label><div class="val">${yn("aids_satisfied")}</div></div>
  <div class="field"><label>If not, why?</label><div class="val">${val("aids_whyNot")}</div></div>
  <div class="field"><label>Satisfaction rating (1–10)</label><div class="val">${val("aids_satisfRating")}</div></div>
</div>` : ""}

<!-- Page 2: consent verbiage + signature. The clinic keeps this printed
     alongside the patient's record so the signed acknowledgment is
     archival, not just clicked-through-and-lost. English regardless of
     kiosk language since it's for the clinic's files. -->
<div class="consent-page">
  <div class="consent-section">
    <h3>${T.en.privacyTitle}</h3>
    <p>${T.en.privacyIntro}</p>
    <ul>${T.en.privacyBullets.map(b => `<li>${b}</li>`).join("")}</ul>
  </div>
  <div class="consent-section">
    <h3>${T.en.insTitle}</h3>
    ${T.en.insText.split("\n\n").map(p => `<p>${p}</p>`).join("")}
  </div>
  <div class="sig-section">
    <p class="cert-text">${T.en.sigCert}</p>
    ${signatureDataUrl ? `<img class="sig-img" src="${signatureDataUrl}" alt="Patient Signature" />` : ""}
    <div class="row" style="margin-top:8px">
      <div class="field"><label>Authorized Signature</label><div class="val">&nbsp;</div></div>
      <div class="field"><label>Date</label><div class="val">${new Date(timestamp).toLocaleDateString()}</div></div>
    </div>
  </div>
</div>
</body></html>`;
}

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

// ── Single-select button grid (with optional "other" freeform) ────────────────
// Used for the referral source. Options live in `options` as [storageKey,
// translationKey] pairs; selection writes storageKey to value; picking the
// "other"-flagged key reveals a text input that writes to otherValue.
function ButtonGrid({ options, value, onChange, otherKey, otherValue, onOtherChange, t }) {
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
      {value === otherKey && (
        <div style={{ marginTop: 12 }}>
          <input type="text" value={otherValue || ""} onChange={e => onOtherChange(e.target.value)}
            placeholder={t.otherDescribe}
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
          otherKey={field.otherKey}
          otherValue={answers?.[field.otherValueKey]}
          onOtherChange={v => setAnswer(field.otherValueKey, v)}
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
            <button key={opt} onClick={() => onChange(t[opt] || opt)}
              style={{ padding: "10px 18px", borderRadius: 10, border: `2px solid ${value === (t[opt] || opt) ? C.teal : C.border}`, background: value === (t[opt] || opt) ? C.tealL : "#fff", color: value === (t[opt] || opt) ? C.tealD : C.text, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: font, transition: "all 0.15s" }}>
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

function NavButtons({ onBack, onNext, nextLabel, backLabel, stepIdx }) {
  return (
    <div style={{ display: "flex", justifyContent: stepIdx > 1 ? "space-between" : "flex-end", marginTop: 28, gap: 12 }}>
      {stepIdx > 1 && <button onClick={onBack} style={{ padding: "13px 24px", fontSize: 15, fontWeight: 700, color: C.muted, background: "transparent", border: `2px solid ${C.border}`, borderRadius: 12, cursor: "pointer", fontFamily: font }}>{backLabel}</button>}
      <button onClick={onNext} style={{ padding: "14px 36px", fontSize: 17, fontWeight: 800, color: "#fff", background: C.teal, border: "none", borderRadius: 12, cursor: "pointer", fontFamily: font, letterSpacing: "0.02em" }}>{nextLabel}</button>
    </div>
  );
}

// ── Consent Screen (proper component to avoid hooks-in-conditional violation) ──
function ConsentScreen({ t, isPrivacy, scrolled, agreed, onScroll, onToggleAgree, onBack, onNext, stepIdx }) {
  const scrollRef = useRef(null);
  const handleScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 10) onScroll();
  };
  return (
    <>
      <SectionBadge label={t.secConsent} />
      <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: "0 0 6px" }}>{isPrivacy ? t.privacyTitle : t.insTitle}</h2>
      <p style={{ fontSize: 13, color: C.gold, fontWeight: 700, marginBottom: 14 }}>⬇ {isPrivacy ? t.privacyScrollNote : t.insScrollNote}</p>
      <div ref={scrollRef} onScroll={handleScroll}
        style={{ maxHeight: 280, overflowY: "scroll", padding: "20px", background: "#FAFAFA", border: `2px solid ${C.border}`, borderRadius: 12, marginBottom: 20, fontSize: 15, lineHeight: 1.7, color: C.text }}>
        {isPrivacy ? (
          <>
            <p style={{ marginTop: 0 }}>{t.privacyIntro}</p>
            <ul style={{ paddingLeft: 20 }}>{t.privacyBullets.map((b, i) => <li key={i} style={{ marginBottom: 8 }}>{b}</li>)}</ul>
          </>
        ) : (
          t.insText.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
        )}
      </div>
      <button onClick={onToggleAgree} disabled={!scrolled}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", background: agreed ? C.tealL : scrolled ? "#fff" : "#f5f5f5", border: `2px solid ${agreed ? C.teal : C.border}`, borderRadius: 12, cursor: scrolled ? "pointer" : "not-allowed", marginBottom: 16, textAlign: "left", fontFamily: font, transition: "all 0.2s" }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${agreed ? C.teal : C.border}`, background: agreed ? C.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {agreed && <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>✓</span>}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: agreed ? C.tealD : scrolled ? C.text : C.muted }}>{isPrivacy ? t.privacyAgreeLabel : t.insAgreeLabel}</span>
      </button>
      {!scrolled && <p style={{ fontSize: 13, color: C.gold, textAlign: "center", marginBottom: 12 }}>⬇ {t.scrollFirst}</p>}
      <NavButtons onBack={onBack} onNext={onNext} nextLabel={t.continue_} backLabel={t.back} stepIdx={stepIdx} />
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function IntakeKiosk() {
  const [lang, setLang] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [hasSignature, setHasSignature] = useState(false);
  const [intakeId] = useState(genIntakeId);
  const [submitted, setSubmitted] = useState(false);
  const signatureRef = useRef(null);
  const isDrawing = useRef(false);
  const t = lang ? T[lang] : T.en;

  // Filter steps (skip aids_detail if aids_q === false)
  const visibleSteps = STEPS.filter(s => {
    if (s.conditional) return answers[s.conditional] === true;
    return true;
  });
  const totalSteps = visibleSteps.length - 2; // exclude welcome + thanks from count
  const step = visibleSteps[stepIdx] || visibleSteps[0];
  const progressPct = stepIdx <= 1 ? 0 : Math.min(100, Math.round(((stepIdx - 1) / (totalSteps - 1)) * 100));

  const setAnswer = (key, val) => setAnswers(prev => ({ ...prev, [key]: val }));

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
    const canvas = signatureRef.current;
    const sigDataUrl = canvas ? canvas.toDataURL("image/png") : null;
    const timestamp = new Date().toISOString();
    // Submit intake to Supabase. If this throws, surface the error so the
    // user doesn't see the Thank-You screen with a record that doesn't exist.
    try {
      const payload = {
        _meta: { intakeId, submittedAt: timestamp, lang, status: "pending" },
        answers,
        consent: { privacyAgreed: answers.privacyAgreed, insuranceAgreed: answers.insuranceAgreed, signedAt: timestamp, signatureDataUrl: sigDataUrl }
      };
      await submitIntake(payload, KIOSK_CLINIC_ID);
    } catch (e) {
      console.error("Intake submit error:", e);
      setErrors({ sig: `Submission failed: ${e?.message || "unknown error"}. Please notify the front desk.` });
      return;
    }
    // Download HTML "PDF"
    const html = generateHTML(answers, intakeId, sigDataUrl, timestamp, t);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Intake_${answers.lastName || "Patient"}_${answers.firstName || ""}_${new Date().toLocaleDateString("en-US").replace(/\//g,"-")}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setSubmitted(true);
    setStepIdx(visibleSteps.findIndex(s => s.type === "thanks"));
  };

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
      <h1 style={{ fontFamily: serif, fontSize: 34, color: C.text, margin: "0 0 16px", lineHeight: 1.2 }}>{t.welcomeTitle}<br /><span style={{ color: C.teal }}>{t.welcomeBrand}</span></h1>
      <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: 36, maxWidth: 460, margin: "0 auto 36px" }}>{t.welcomeBody}</p>
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
      <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.7, marginBottom: 28 }}>{t.tyBody}</p>
      <div style={{ background: C.tealL, borderRadius: 12, padding: "14px 20px", display: "inline-block" }}>
        <p style={{ fontSize: 13, color: C.teal, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.tyId}</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: C.tealD, margin: 0, fontFamily: "monospace" }}>{intakeId}</p>
      </div>
    </div>
  );

  if (step.type === "form") return card(
    <>
      {step.sec && <SectionBadge label={t[step.sec]} />}
      <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: "0 0 24px", lineHeight: 1.3 }}>{t[step.title]}</h2>
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
        {step.options.map(opt => (
          <button key={opt} onClick={() => { setAnswer(step.ansKey, t[opt]||opt); setTimeout(() => setStepIdx(i => i+1), 300); }}
            style={{ flex: 1, minWidth: 120, padding: "24px 16px", fontSize: 20, fontWeight: 800, borderRadius: 16, border: `3px solid ${answers[step.ansKey] === (t[opt]||opt) ? C.teal : C.border}`, background: answers[step.ansKey] === (t[opt]||opt) ? C.tealL : "#fff", color: answers[step.ansKey] === (t[opt]||opt) ? C.tealD : C.text, cursor: "pointer", fontFamily: font, transition: "all 0.15s" }}>
            {t[opt] || opt}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <button onClick={goBack} style={{ padding: "10px 20px", fontSize: 14, fontWeight: 700, color: C.muted, background: "transparent", border: `2px solid ${C.border}`, borderRadius: 10, cursor: "pointer", fontFamily: font }}>{t.back}</button>
      </div>
    </>
  );

  if (step.type === "multiSelect") return card(
    <>
      {step.sec && <SectionBadge label={t[step.sec]} />}
      <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: "0 0 24px", lineHeight: 1.35 }}>{t[step.qKey]}</h2>
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
        <span>{t.poor}</span><span>{t.excellent}</span>
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

  if (step.type === "aids") return card(
    <>
      {step.sec && <SectionBadge label={t[step.sec]} />}
      <h2 style={{ fontFamily: serif, fontSize: 24, color: C.text, margin: "0 0 24px", lineHeight: 1.3 }}>Tell us about your current hearing aids.</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 16px" }}>
        <div style={{ width: "100%", marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{t.aidsWhichEar}</label>
          <div style={{ display: "flex", gap: 10 }}>
            {["aidsBoth","aidsRight","aidsLeft"].map(opt => (
              <button key={opt} onClick={() => setAnswer("aids_ear", t[opt])}
                style={{ padding: "10px 18px", borderRadius: 10, border: `2px solid ${answers.aids_ear === t[opt] ? C.teal : C.border}`, background: answers.aids_ear === t[opt] ? C.tealL : "#fff", color: answers.aids_ear === t[opt] ? C.tealD : C.text, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: font }}>
                {t[opt]}
              </button>
            ))}
          </div>
        </div>
        {[["aids_howOften","aidsHowOften","50%"],["aids_howOld","aidsHowOld","45%"],["aids_brand","aidsBrand","50%"],["aids_style","aidsStyle","45%"],["aids_cost","aidsCost","30%"]].map(([k,lk,w]) => (
          <div key={k} style={{ width: w, marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{t[lk]}</label>
            <input type="text" value={answers[k] || ""} onChange={e => setAnswer(k, e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: "12px 14px", border: `2px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none" }} />
          </div>
        ))}
        <div style={{ width: "100%", marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{t.aidsSatisfied}</label>
          <div style={{ display: "flex", gap: 12 }}>
            {["yes","no"].map(opt => (
              <button key={opt} onClick={() => setAnswer("aids_satisfied", opt === "yes")}
                style={{ padding: "12px 28px", borderRadius: 10, border: `2px solid ${answers.aids_satisfied === (opt==="yes") ? C.teal : C.border}`, background: answers.aids_satisfied === (opt==="yes") ? C.tealL : "#fff", color: answers.aids_satisfied === (opt==="yes") ? C.tealD : C.text, fontWeight: 700, fontSize: 17, cursor: "pointer", fontFamily: font }}>
                {t[opt]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: "100%", marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{t.aidsWhyNot}</label>
          <input type="text" value={answers.aids_whyNot || ""} onChange={e => setAnswer("aids_whyNot", e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: "12px 14px", border: `2px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none" }} />
        </div>
        <div style={{ width: "100%", marginBottom: 4 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>{t.aidsSatisfRating}</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setAnswer("aids_satisfRating", n)}
                style={{ width: 48, height: 48, borderRadius: 10, border: `3px solid ${answers.aids_satisfRating === n ? C.teal : C.border}`, background: answers.aids_satisfRating === n ? C.teal : "#fff", color: answers.aids_satisfRating === n ? "#fff" : C.text, fontSize: 18, fontWeight: 800, cursor: "pointer", fontFamily: font }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <NavButtons onBack={goBack} onNext={goNext} nextLabel={t.next} backLabel={t.back} stepIdx={stepIdx} />
    </>
  );

  if (step.type === "scrollConsent") {
    const isPrivacy = step.contentKey === "privacy";
    const scrolledKey = isPrivacy ? "privacyScrolled" : "insScrolled";
    const agreedKey = isPrivacy ? "privacyAgreed" : "insuranceAgreed";
    const scrolled = !!answers[scrolledKey];
    const agreed = !!answers[agreedKey];
    return card(
      <ConsentScreen
        t={t} isPrivacy={isPrivacy} scrolled={scrolled} agreed={agreed}
        onScroll={() => setAnswer(scrolledKey, true)}
        onToggleAgree={() => { if (scrolled) setAnswer(agreedKey, !agreed); }}
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
      <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.65, marginBottom: 20 }}>{t.sigCert}</p>
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
      <NavButtons onBack={goBack} onNext={handleSubmit} nextLabel={t.submit} backLabel={t.back} stepIdx={stepIdx} />
    </>
  );

  return null;
}
