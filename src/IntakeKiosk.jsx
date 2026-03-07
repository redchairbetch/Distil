import { useState, useRef, useEffect, useCallback } from "react";

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
    dob: "Date of Birth (MM / DD / YYYY)", age: "Age",
    genderLabel: "Gender", male: "Male", female: "Female", preferNotSay: "Prefer not to say",

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
    medQ_noise: "Do you have a history of working around loud noises?",
    noiseDescribe: "Please describe:",
    medQ_otherNoise: "What other loud noises have you been exposed to? (optional)",

    hearQ_tested: "Have you had your hearing tested before?",
    testedWhen: "When was your last hearing test?",
    testedResults: "What were the results?",
    hearQ_bestEar: "In which ear is your hearing the best?",
    right: "Right", left: "Left", same: "Same",
    hearQ_mumble: "Have you noticed that people seem to mumble?",
    hearQ_repeat: "Do you frequently ask people to repeat what they've said?",
    hearQ_understand: "Do you sometimes hear someone speaking but not understand them?",
    hearQ_noisy: "Do you find it difficult to hear in noisy places?",
    hearQ_loud: "Have you been told that you speak loudly?",
    hearQ_tv: "Have you been told you turn the TV volume too loud?",
    hearQ_kids: "Do you have difficulty understanding children's voices?",
    hearQ_other: "What else should we know about your hearing challenges? (optional)",
    otherChallengesPlaceholder: "Describe any other hearing challenges…",
    hearQ_rating: "On a scale of 1 to 10, how well do you think you hear?",
    poor: "1 — Poor", excellent: "10 — Excellent",
    hearQ_ready: "If a hearing loss is diagnosed, are you ready to improve your hearing?",
    hearQ_prevented: "What has prevented you from addressing your hearing challenges? (optional)",
    hearQ_changed: "What has changed that you are now ready for help? (optional)",

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
    dob: "Fecha de Nacimiento (MM / DD / AAAA)", age: "Edad",
    genderLabel: "Género", male: "Masculino", female: "Femenino", preferNotSay: "Prefiero no decir",

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
    medQ_noise: "¿Tiene antecedentes de trabajo con ruidos fuertes?",
    noiseDescribe: "Por favor describa:",
    medQ_otherNoise: "¿A qué otros ruidos fuertes ha estado expuesto? (opcional)",

    hearQ_tested: "¿Le han examinado la audición anteriormente?",
    testedWhen: "¿Cuándo fue su última prueba de audición?",
    testedResults: "¿Cuáles fueron los resultados?",
    hearQ_bestEar: "¿En qué oído escucha mejor?",
    right: "Derecho", left: "Izquierdo", same: "Igual",
    hearQ_mumble: "¿Ha notado que las personas parecen murmurar?",
    hearQ_repeat: "¿Con frecuencia pide a las personas que repitan lo que han dicho?",
    hearQ_understand: "¿A veces escucha a alguien hablar pero no lo entiende?",
    hearQ_noisy: "¿Le resulta difícil escuchar en lugares ruidosos?",
    hearQ_loud: "¿Le han dicho que habla muy fuerte?",
    hearQ_tv: "¿Le han dicho que sube demasiado el volumen del televisor?",
    hearQ_kids: "¿Tiene dificultad para entender las voces de los niños?",
    hearQ_other: "¿Qué más debemos saber sobre sus dificultades auditivas? (opcional)",
    otherChallengesPlaceholder: "Describa cualquier dificultad auditiva adicional…",
    hearQ_rating: "En una escala del 1 al 10, ¿qué tan bien cree que escucha?",
    poor: "1 — Malo", excellent: "10 — Excelente",
    hearQ_ready: "Si se diagnostica pérdida auditiva, ¿está listo/a para mejorar su audición?",
    hearQ_prevented: "¿Qué le ha impedido abordar sus problemas de audición? (opcional)",
    hearQ_changed: "¿Qué ha cambiado para que ahora esté listo/a para recibir ayuda? (opcional)",

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

// ── Step definitions ───────────────────────────────────────────────────────────
// type: welcome | form | yesno | multiChoice | text | scale | aids | scrollConsent | signature | thanks
const STEPS = [
  { id: "welcome", type: "welcome" },
  { id: "name", type: "form", title: "nameTitle", sec: "secPersonal", fields: [
    { key: "firstName", label: "firstName", req: true, width: "50%" },
    { key: "mi", label: "mi", req: false, width: "20%" },
    { key: "lastName", label: "lastName", req: true, width: "100%" },
  ]},
  { id: "dob_gender", type: "form", title: "dobTitle", sec: "secPersonal", fields: [
    { key: "dob", label: "dob", req: true, width: "60%" },
    { key: "age", label: "age", req: false, width: "30%", type: "number" },
    { key: "gender", label: "genderLabel", req: true, type: "radio", options: ["male","female","preferNotSay"], width: "100%" },
  ]},
  { id: "address", type: "form", title: "addressTitle", sec: "secPersonal", fields: [
    { key: "street", label: "street", req: true, width: "70%" },
    { key: "apt", label: "apt", req: false, width: "25%" },
    { key: "city", label: "city", req: true, width: "50%" },
    { key: "state", label: "state", req: true, width: "20%" },
    { key: "zip", label: "zip", req: true, width: "25%" },
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
    { key: "spouseDob", label: "spouseDob", req: false, width: "45%" },
    { key: "emergencyName", label: "emergencyName", req: true, width: "55%" },
    { key: "emergencyPhone", label: "emergencyPhone", req: true, width: "40%", type: "tel" },
    { key: "pcp", label: "pcp", req: false, width: "100%" },
  ]},
  { id: "visit", type: "form", title: "visitTitle", sec: "secPersonal", fields: [
    { key: "visitReason", label: "visitReason", req: false, type: "textarea", width: "100%" },
    { key: "referral", label: "referral", req: false, width: "100%" },
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
  { id: "med_family", type: "text", sec: "secMedical", qKey: "medQ_family", ansKey: "med_family", phKey: "familyPlaceholder", req: false },
  { id: "med_noise", type: "yesno", sec: "secMedical", qKey: "medQ_noise", ansKey: "med_noise",
    followUp: { key: "med_noise_desc", label: "noiseDescribe", showIf: true } },
  { id: "med_otherNoise", type: "text", sec: "secMedical", qKey: "medQ_otherNoise", ansKey: "med_otherNoise", req: false },
  { id: "hear_tested", type: "yesno", sec: "secHearing", qKey: "hearQ_tested", ansKey: "hear_tested",
    followUps: [
      { key: "hear_tested_when", label: "testedWhen", showIf: true },
      { key: "hear_tested_results", label: "testedResults", showIf: true },
    ]},
  { id: "hear_best", type: "multiChoice", sec: "secHearing", qKey: "hearQ_bestEar", ansKey: "hear_best", options: ["right","left","same"] },
  { id: "hear_mumble", type: "yesno", sec: "secHearing", qKey: "hearQ_mumble", ansKey: "hear_mumble" },
  { id: "hear_repeat", type: "yesno", sec: "secHearing", qKey: "hearQ_repeat", ansKey: "hear_repeat" },
  { id: "hear_understand", type: "yesno", sec: "secHearing", qKey: "hearQ_understand", ansKey: "hear_understand" },
  { id: "hear_noisy", type: "yesno", sec: "secHearing", qKey: "hearQ_noisy", ansKey: "hear_noisy" },
  { id: "hear_loud", type: "yesno", sec: "secHearing", qKey: "hearQ_loud", ansKey: "hear_loud" },
  { id: "hear_tv", type: "yesno", sec: "secHearing", qKey: "hearQ_tv", ansKey: "hear_tv" },
  { id: "hear_kids", type: "yesno", sec: "secHearing", qKey: "hearQ_kids", ansKey: "hear_kids" },
  { id: "hear_other", type: "text", sec: "secHearing", qKey: "hearQ_other", ansKey: "hear_other", phKey: "otherChallengesPlaceholder", req: false },
  { id: "hear_rating", type: "scale", sec: "secHearing", qKey: "hearQ_rating", ansKey: "hear_rating" },
  { id: "hear_ready", type: "yesno", sec: "secHearing", qKey: "hearQ_ready", ansKey: "hear_ready",
    followUp: { key: "hear_changed", label: "hearQ_changed", showIf: true, optional: true } },
  { id: "hear_prevented", type: "text", sec: "secHearing", qKey: "hearQ_prevented", ansKey: "hear_prevented", req: false },
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
  @media print { body { margin: 0; padding: 10px; } }
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
  <div class="field"><label>Date of Birth</label><div class="val">${val("dob")}</div></div>
  <div class="field"><label>Age</label><div class="val">${val("age")}</div></div>
  <div class="field"><label>Gender</label><div class="val">${val("gender")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Address</label><div class="val">${val("street")} ${val("apt") !== "—" ? val("apt") : ""}, ${val("city")}, ${val("state")} ${val("zip")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Home Phone</label><div class="val">${val("homePhone")}</div></div>
  <div class="field"><label>Mobile Phone</label><div class="val">${val("mobilePhone")}</div></div>
  <div class="field"><label>Email</label><div class="val">${val("email")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Spouse</label><div class="val">${val("spouseName")}</div></div>
  <div class="field"><label>Spouse Phone</label><div class="val">${val("spousePhone")}</div></div>
  <div class="field"><label>Emergency Contact</label><div class="val">${val("emergencyName")} — ${val("emergencyPhone")}</div></div>
</div>
<div class="row">
  <div class="field"><label>Primary Care Physician</label><div class="val">${val("pcp")}</div></div>
  <div class="field"><label>Reason for Visit</label><div class="val">${val("visitReason")}</div></div>
  <div class="field"><label>Referred By</label><div class="val">${val("referral")}</div></div>
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
  ["History of working around loud noises?", "med_noise"],
].map(([q,k]) => `<div class="ynrow"><div class="ynq">${q}${answers[k+"_type"] ? " — "+answers[k+"_type"] : ""}${answers["med_doctor_when"] && k === "med_doctor" ? " ("+answers["med_doctor_when"]+")" : ""}${answers["med_noise_desc"] && k === "med_noise" ? " ("+answers["med_noise_desc"]+")" : ""}</div><div class="yna">${yn(k)}</div></div>`).join("")}
<div class="row" style="margin-top:8px">
  <div class="field"><label>Family with hearing loss/aids</label><div class="val">${val("med_family")}</div></div>
  <div class="field"><label>Other loud noise exposure</label><div class="val">${val("med_otherNoise")}</div></div>
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
  ["Ready to improve if loss diagnosed?", "hear_ready"],
].map(([q,k]) => `<div class="ynrow"><div class="ynq">${q}${answers["hear_tested_when"] && k === "hear_tested" ? " — Last tested: "+answers["hear_tested_when"]+(answers["hear_tested_results"] ? ", Results: "+answers["hear_tested_results"] : "") : ""}</div><div class="yna">${yn(k)}</div></div>`).join("")}
<div class="row" style="margin-top:8px">
  <div class="field"><label>Best ear</label><div class="val">${val("hear_best")}</div></div>
  <div class="field"><label>Self-rated hearing (1–10)</label><div class="val">${val("hear_rating")}</div></div>
  <div class="field"><label>Other challenges</label><div class="val">${val("hear_other")}</div></div>
</div>
<div class="row">
  <div class="field"><label>What has prevented addressing hearing</label><div class="val">${val("hear_prevented")}</div></div>
  <div class="field"><label>What has changed</label><div class="val">${val("hear_changed")}</div></div>
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

<div class="sig-section">
  <p class="cert-text">By signing below, I certify that the information I provided above is accurate and correct to the best of my knowledge. I further acknowledge that I have read and understand the privacy policy and I consent to the use of the information for business purposes. I understand that a copy of this policy will be presented to me upon request.</p>
  ${signatureDataUrl ? `<img class="sig-img" src="${signatureDataUrl}" alt="Patient Signature" />` : ""}
  <div class="row" style="margin-top:8px">
    <div class="field"><label>Authorized Signature</label><div class="val">&nbsp;</div></div>
    <div class="field"><label>Date</label><div class="val">${new Date(timestamp).toLocaleDateString()}</div></div>
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

function FieldInput({ field, t, value, onChange, error }) {
  const lbl = t[field.label] || field.label;
  const st = { width: field.width || "100%", boxSizing: "border-box" };
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
  return (
    <div style={{ ...st, marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{lbl}</label>
      <input type={field.type || "text"} value={value || ""} onChange={e => onChange(e.target.value)}
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
    const canvas = signatureRef.current;
    const sigDataUrl = canvas ? canvas.toDataURL("image/png") : null;
    const timestamp = new Date().toISOString();
    const record = { _meta: { intakeId, submittedAt: timestamp, lang, status: "pending" }, answers, consent: { privacyAgreed: answers.privacyAgreed, insuranceAgreed: answers.insuranceAgreed, signedAt: timestamp, signatureDataUrl: sigDataUrl } };
    // Save to shared storage
    try { await window.storage.set(`intake:${intakeId}`, JSON.stringify(record), true); } catch (e) { console.error("Storage error:", e); }
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
          <FieldInput key={f.key} field={f} t={t} value={answers[f.key]} onChange={v => setAnswer(f.key, v)} error={errors[f.key]} />
        ))}
      </div>
      <NavButtons onBack={goBack} onNext={goNext} nextLabel={t.next} backLabel={t.back} stepIdx={stepIdx} />
    </>
  );

  if (step.type === "yesno") {
    const hasFollowUp = (step.followUp || step.followUps) && answers[step.ansKey] === true;
    const followUps = step.followUps || (step.followUp ? [step.followUp] : []);
    return card(
      <>
        {step.sec && <SectionBadge label={t[step.sec]} />}
        <h2 style={{ fontFamily: serif, fontSize: 26, color: C.text, margin: "0 0 32px", lineHeight: 1.35 }}>{t[step.qKey]}</h2>
        {!hasFollowUp ? (
          <div style={{ display: "flex", gap: 16 }}>
            {["yes","no"].map(opt => (
              <button key={opt} onClick={() => autoAdvance(step.ansKey, opt === "yes")}
                style={{ flex: 1, padding: "28px 16px", fontSize: 24, fontWeight: 800, color: opt === "yes" ? "#fff" : C.text, background: opt === "yes" ? C.teal : C.tealL, border: "none", borderRadius: 16, cursor: "pointer", fontFamily: font, transition: "all 0.15s", transform: answers[step.ansKey] === (opt === "yes") ? "scale(0.97)" : "scale(1)" }}>
                {t[opt]}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              {["yes","no"].map(opt => (
                <button key={opt} onClick={() => setAnswer(step.ansKey, opt === "yes")}
                  style={{ flex: 1, padding: "22px 16px", fontSize: 20, fontWeight: 800, color: answers[step.ansKey] === (opt==="yes") ? "#fff" : C.text, background: answers[step.ansKey] === (opt==="yes") ? C.teal : C.tealL, border: `2px solid ${answers[step.ansKey] === (opt==="yes") ? C.teal : "transparent"}`, borderRadius: 14, cursor: "pointer", fontFamily: font, transition: "all 0.15s" }}>
                  {t[opt]}
                </button>
              ))}
            </div>
            {followUps.filter(fu => !fu.type || fu.type !== "radio").map(fu => (
              <div key={fu.key} style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{t[fu.label]}</label>
                <input type="text" value={answers[fu.key] || ""} onChange={e => setAnswer(fu.key, e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: "12px 14px", border: `2px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: font, outline: "none" }} />
              </div>
            ))}
            {followUps.filter(fu => fu.type === "radio").map(fu => (
              <div key={fu.key} style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{t[fu.label]}</label>
                <div style={{ display: "flex", gap: 12 }}>
                  {fu.options.map(opt => (
                    <button key={opt} onClick={() => setAnswer(fu.key, t[opt] || opt)}
                      style={{ padding: "12px 22px", borderRadius: 10, border: `2px solid ${answers[fu.key] === (t[opt]||opt) ? C.teal : C.border}`, background: answers[fu.key] === (t[opt]||opt) ? C.tealL : "#fff", color: answers[fu.key] === (t[opt]||opt) ? C.tealD : C.text, fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: font }}>
                      {t[opt] || opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <NavButtons onBack={goBack} onNext={goNext} nextLabel={t.continue_} backLabel={t.back} stepIdx={stepIdx} />
          </>
        )}
        {!hasFollowUp && stepIdx > 1 && (
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
