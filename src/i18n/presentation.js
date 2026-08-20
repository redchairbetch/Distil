// Health History presentation-mode translations — English + Spanish.
//
// Two consumers:
//   1. IntakePresentation.jsx — the patient-facing walk-through (UI copy
//      plus per-key label maps for the FDA battery, hearing situations,
//      and resistance picks; canonical English lives in lib/intakeReview.js
//      and staff surfaces keep using it directly).
//   2. lib/intakeReview.js — perceptionGapCopy and mapComplaintsToFindings
//      take a lang param and pull their patient-facing sentence templates
//      from here.
//
// Provider-only content (deepening prompts, coaching hints, the "⋯"
// reveal) stays English everywhere.

export const PRES_T = {
  en: {
    titleWithName: (name) => `${name}, let's start with your story`,
    title: "Let's start with your story",
    subtitle: "Everything below came from your answers — let's walk through it together before we test.",

    beatWords: "In your words",
    visitReasonCaption: "— your reason for today's visit",

    beatSafety: "Your medical safety check",
    safetyIntro: "We screen every patient for six medical signs that deserve a doctor's attention before anything else.",
    allClear: "All clear",
    allClearBody: "None of the six apply to you — we're clear to move ahead with testing.",
    flaggedTalk: "Let's talk about this one together — it matters for how we plan your care.",
    discussedWithDoctor: "🩺 Discussed with a doctor",
    unansweredSafety: "A few we didn't get your answer on — let's cover them now:",

    beatSituations: "Where hearing gets hard",
    youToldUsCount: "You told us",
    situationsStruggle: "everyday listening situations are a struggle:",
    noTroubleTitle: "You told us everyday listening isn't giving you much trouble right now.",
    noTroubleBody: "Today's test gives us a baseline either way — hearing is worth tracking like anything else about your health.",
    walkThroughAll: "Let's walk through these together:",
    fewUnanswered: "A few we didn't get your answer on:",

    beatStand: "Where you stand",
    ratingCaption: "How you rate your hearing",
    readyYes: "You told us you're ready to improve your hearing if a loss is found today.",
    readyNo: "You're still weighing it — that's exactly what today is for. No decisions required to get answers.",
    resistanceTitle: "What's made this hard to address before:",
    yes: "Yes", no: "No",

    fdaLabels: {
      med_pain: "Pain or discomfort in your ears",
      med_drain: "Drainage from your ears",
      med_sudden: "A sudden hearing change in the past 90 days",
      med_ring: "Ringing or other sounds in your ears",
      med_dizzy: "Dizziness or vertigo",
      med_full: "Fullness or a blocked feeling",
    },
    restatements: {
      hear_mumble: "People seem to mumble",
      hear_repeat: "Often asking people to repeat themselves",
      hear_understand: "Hearing voices but not making out the words",
      hear_noisy: "Noisy places are a struggle",
      hear_loud: "Told you speak loudly",
      hear_tv: "The TV volume keeps creeping up",
      hear_kids: "Children's voices are hard to catch",
      hear_fatigue: "Conversations in noise leave you drained",
      hear_strain: "Keeping up takes hard concentration",
    },
    resistanceLabels: {
      cost: "Cost or affordability",
      cosmetics: "Cosmetics or appearance",
      denial: "Didn't feel ready",
      bad_experience: "A past bad experience",
      stigma: "Stigma",
      dont_know: "Didn't know where to start",
      fear_dependence: "Fear of becoming dependent",
      other: "Something else",
    },

    gapHighRating: (rating, endorsed, total) => `You rate your hearing ${rating} out of 10 — and you told us ${endorsed} of ${total} everyday situations are a struggle. Let's see what the test says.`,
    gapLowRating: (rating) => `You already sense it — you rate your hearing ${rating} out of 10. Today's test will show us exactly where, and how much.`,
    gapNeutral: (rating) => `You rate your hearing ${rating} out of 10. Today's test gives us the full picture.`,

    sevPhrase: {
      "Normal": "normal", "Mild": "mild", "Moderate": "moderate",
      "Moderately Severe": "moderately severe", "Severe": "severe", "Profound": "profound",
    },
    unexplained: "Today's results don't fully explain this one — it's worth exploring together, because the struggle is real even when the numbers don't show it.",
    clarityKids: "Children's voices sit higher in pitch — exactly the range where your test shows sounds slipping below your hearing. The words aren't quiet; parts of them are missing.",
    clarityHF: "Your test shows high-pitched consonants — S, F, TH, SH — falling below your hearing range. Words lose their edges, so voices sound like mumbling even at normal volume.",
    clarityLoss: (sev) => `A ${sev} loss softens parts of every word before they reach you — the words arrive incomplete, and incomplete words sound unclear.`,
    noiseCCT: (pct) => `At a comfortable volume in quiet, you caught ${pct}% of words. Background noise widens that gap — your brain fills in the missing pieces, and in a busy room there are too many pieces to fill.`,
    noiseLoss: (sev) => `In quiet, context helps you fill the gaps a ${sev} loss creates. Noise takes the context away — that's why busy rooms fall apart first.`,
    effortCost: "That tiredness is measurable: when the signal arrives incomplete, your brain works overtime to reconstruct it. The drained feeling after noisy conversation is the cost of that work.",
    volumeLoud: (sev) => `With a ${sev} loss, your own voice comes back to you quieter than it really is — so you naturally raise it. It isn't a habit; it's your hearing calibrating your volume.`,
    volumeTV: (sev) => `With a ${sev} loss, normal volume settings genuinely aren't loud enough for you. The TV volume isn't a preference — it's audibility.`,
    mixedBoth: "Asking for repeats is usually both problems at once: some sounds arrive too soft to catch, and the high-pitched consonants that define words are missing entirely. Your test shows both.",
    mixedLoss: (sev) => `A ${sev} loss means some words arrive too soft to catch the first time — the repeat request is you buying a second chance at them.`,
    mixedCCT: (pct) => `Your word recognition score explains this: at a comfortable volume you caught ${pct}% of words, so some sentences need a second pass.`,
  },

  es: {
    titleWithName: (name) => `${name}, comencemos con su historia`,
    title: "Comencemos con su historia",
    subtitle: "Todo lo siguiente proviene de sus respuestas — repasémoslo juntos antes de hacer las pruebas.",

    beatWords: "En sus palabras",
    visitReasonCaption: "— su motivo de la visita de hoy",

    beatSafety: "Su revisión de seguridad médica",
    safetyIntro: "Evaluamos a cada paciente por seis señales médicas que merecen la atención de un médico antes que nada.",
    allClear: "Todo despejado",
    allClearBody: "Ninguna de las seis aplica en su caso — podemos avanzar con las pruebas.",
    flaggedTalk: "Hablemos de esto juntos — es importante para planificar su cuidado.",
    discussedWithDoctor: "🩺 Consultado con un médico",
    unansweredSafety: "Algunas que no alcanzamos a preguntarle — cubrámoslas ahora:",

    beatSituations: "Dónde se dificulta oír",
    youToldUsCount: "Usted nos dijo que",
    situationsStruggle: "situaciones cotidianas de escucha le resultan difíciles:",
    noTroubleTitle: "Usted nos dijo que la escucha diaria no le está causando mucho problema por ahora.",
    noTroubleBody: "La prueba de hoy nos da una línea base de todos modos — la audición vale la pena monitorearla como cualquier otro aspecto de su salud.",
    walkThroughAll: "Repasemos estas juntos:",
    fewUnanswered: "Algunas que no alcanzamos a preguntarle:",

    beatStand: "Dónde se encuentra usted",
    ratingCaption: "Cómo califica su audición",
    readyYes: "Usted nos dijo que está listo/a para mejorar su audición si hoy se encuentra una pérdida.",
    readyNo: "Todavía lo está considerando — para eso es exactamente el día de hoy. No se requieren decisiones para obtener respuestas.",
    resistanceTitle: "Lo que ha hecho difícil atender esto antes:",
    yes: "Sí", no: "No",

    fdaLabels: {
      med_pain: "Dolor o molestia en sus oídos",
      med_drain: "Drenaje de sus oídos",
      med_sudden: "Un cambio repentino de audición en los últimos 90 días",
      med_ring: "Zumbido u otros sonidos en sus oídos",
      med_dizzy: "Mareos o vértigo",
      med_full: "Sensación de oído lleno o bloqueado",
    },
    restatements: {
      hear_mumble: "Las personas parecen murmurar",
      hear_repeat: "Pide con frecuencia que le repitan",
      hear_understand: "Oye las voces pero no distingue las palabras",
      hear_noisy: "Los lugares ruidosos son una dificultad",
      hear_loud: "Le han dicho que habla fuerte",
      hear_tv: "El volumen de la TV sigue subiendo",
      hear_kids: "Las voces de los niños son difíciles de captar",
      hear_fatigue: "Las conversaciones en ruido lo/la dejan agotado/a",
      hear_strain: "Mantenerse al día requiere mucha concentración",
    },
    resistanceLabels: {
      cost: "Costo o accesibilidad",
      cosmetics: "Estética o apariencia",
      denial: "No se sentía listo/a",
      bad_experience: "Una mala experiencia previa",
      stigma: "Estigma",
      dont_know: "No sabía por dónde empezar",
      fear_dependence: "Miedo a volverse dependiente",
      other: "Otra cosa",
    },

    gapHighRating: (rating, endorsed, total) => `Usted califica su audición con ${rating} de 10 — y nos dijo que ${endorsed} de ${total} situaciones cotidianas le resultan difíciles. Veamos qué dice la prueba.`,
    gapLowRating: (rating) => `Usted ya lo percibe — califica su audición con ${rating} de 10. La prueba de hoy nos mostrará exactamente dónde, y cuánto.`,
    gapNeutral: (rating) => `Usted califica su audición con ${rating} de 10. La prueba de hoy nos da el panorama completo.`,

    sevPhrase: {
      "Normal": "normal", "Mild": "leve", "Moderate": "moderada",
      "Moderately Severe": "moderadamente severa", "Severe": "severa", "Profound": "profunda",
    },
    unexplained: "Los resultados de hoy no explican esto por completo — vale la pena explorarlo juntos, porque la dificultad es real aunque los números no la muestren.",
    clarityKids: "Las voces de los niños son más agudas — exactamente el rango donde su prueba muestra sonidos que caen por debajo de su audición. Las palabras no están bajas; les faltan partes.",
    clarityHF: "Su prueba muestra que las consonantes agudas — S, F, TH, SH — caen por debajo de su rango auditivo. Las palabras pierden sus bordes, y por eso las voces suenan como murmullos incluso a volumen normal.",
    clarityLoss: (sev) => `Una pérdida ${sev} suaviza partes de cada palabra antes de que le lleguen — las palabras llegan incompletas, y las palabras incompletas suenan poco claras.`,
    noiseCCT: (pct) => `A un volumen cómodo y en silencio, usted captó el ${pct}% de las palabras. El ruido de fondo amplía esa brecha — su cerebro rellena las piezas que faltan, y en un lugar concurrido hay demasiadas piezas que rellenar.`,
    noiseLoss: (sev) => `En silencio, el contexto le ayuda a llenar los vacíos que crea una pérdida ${sev}. El ruido le quita el contexto — por eso los lugares concurridos son lo primero que se complica.`,
    effortCost: "Ese cansancio es medible: cuando la señal llega incompleta, su cerebro trabaja horas extra para reconstruirla. La sensación de agotamiento después de conversar en ruido es el costo de ese trabajo.",
    volumeLoud: (sev) => `Con una pérdida ${sev}, su propia voz le regresa más baja de lo que realmente es — así que naturalmente la sube. No es un hábito; es su audición calibrando su volumen.`,
    volumeTV: (sev) => `Con una pérdida ${sev}, los niveles normales de volumen genuinamente no son suficientes para usted. El volumen de la TV no es una preferencia — es audibilidad.`,
    mixedBoth: "Pedir que le repitan suele ser ambos problemas a la vez: algunos sonidos llegan demasiado suaves para captarlos, y las consonantes agudas que definen las palabras faltan por completo. Su prueba muestra ambos.",
    mixedLoss: (sev) => `Una pérdida ${sev} significa que algunas palabras llegan demasiado suaves para captarlas a la primera — pedir que le repitan es comprarse una segunda oportunidad.`,
    mixedCCT: (pct) => `Su puntaje de reconocimiento de palabras lo explica: a un volumen cómodo captó el ${pct}% de las palabras, así que algunas frases necesitan una segunda pasada.`,
  },
};
