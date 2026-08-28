// Pricing Reveal + Technology Tier + Care Plan translations — English + Spanish.
//
// Consumers: the Pricing Reveal block (Distil.jsx Device Selection step),
// views/TierSelection.jsx, components/CoverageBars.jsx,
// views/CareExpectations.jsx, views/CareJourney.jsx, and
// components/FinancingCalculator.jsx.
//
// Plan tier names (Premium / Advanced / Standard, Level 1/2) are plan
// vocabulary and stay untranslated, as do product names (Complete Care+,
// CareCredit, Allegro) and TPA names. Engine-generated rationale text is
// stored data and renders as-is. Pricing-display domain rules hold in both
// languages: patient cost first, retail only as "full retail value" with
// the savings alongside.

export const PRICING_T = {
  en: {
    // ── Listening environments (shared) ──
    environments: {
      home: "Quiet home / private conversation", tv: "TV / movies", phone: "Phone calls",
      religious: "Religious services", car: "Car (road noise)", restaurant: "Restaurant",
      groups: "Group conversations / meetings", outdoors: "Outdoors / wind", crowds: "Crowds / cocktail / concerts",
    },
    situationLabels: {
      home: "Quiet conversation", tv: "Television", phone: "Phone calls",
      religious: "Religious services", car: "In the car", restaurant: "Restaurants",
      groups: "Group conversations", outdoors: "Outdoors", crowds: "Crowds & gatherings",
    },
    effortSignals: {
      hear_fatigue: "Drained after noisy conversations",
      hear_strain: "Concentrating hard to keep up",
    },
    tierEffort: {
      5: "The processor separates speech from noise before the sound reaches your brain — so your energy goes into the conversation, not into decoding it. Even the hardest rooms take less out of you.",
      3: "Handles most of the separating work for you as rooms shift; your brain pitches in during the loudest moments, and everyday listening stays comfortable.",
      1: "Restores the clarity your ears are missing, and in calm settings that's most of the job; in background noise, your brain still does the work of picking speech apart.",
      0: "Makes quiet, one-on-one conversation easier to follow; in noisy rooms, most of the sorting-out still falls to your brain.",
      "-1": "Brings speech back within reach at home and up close; anywhere noise builds, your brain carries the listening work largely on its own.",
    },

    // ── Coverage bars ──
    mostChallenging: "Your most challenging environments",
    otherEnvironments: "Other environments",
    allEnvironments: "All listening environments",

    // ── Pricing reveal ──
    selectDeviceFirst: "Select a device to see your investment.",
    investmentToday: "Your Investment Today",
    pairTwoAids: "pair (2 aids)",
    perAid: "per aid",
    listJoin: (items) => items.length <= 1 ? (items[0] || "") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1],
    reflectHardest: (text, effort) => `You told us the hardest moments have been ${text}${effort ? " — and that listening there leaves you drained." : " — the places where listening takes the most out of you."}`,
    reflectEffortOnly: "You told us listening takes real work these days — conversations leave you more tired than they should.",
    tierTech: (label) => `${label} Technology`,
    listeningEffort: "Listening effort",
    yourInvestment: "Your investment",
    forBothAids: "for both hearing aids",
    perAidSlash: (amount) => `${amount} / aid`,
    right: "Right", left: "Left", crosUnit: "CROS unit",
    planCovers: "Your plan covers",
    ccIncluded: "(included)",
    fullRetailValue: "Full retail value",
    youSave: (amount) => `You save ${amount}`,
    pctOff: (pct) => `${pct}% off`,
    fiveYearsTitle: "Five years of care, included",
    fiveYearsBody: "Unlimited visits for 5 years · a 4-year repair warranty (your manufacturer's 3 years plus 1 more from us) · cleanings, adjustments, and a check-in call two days after you start.",
    defaultCarePlanNote: "Your default care plan — we'll confirm it together on the next step.",

    // ── Financing calculator ──
    waysComfortable: "Ways to make it comfortable",
    mo: "mo",
    estimatedFor: (months) => `estimated, for ${months} months`,
    zeroInterest: "0% interest",
    zeroInterestRest: (total, months) => ` if the full $${total} is paid within ${months} months — not a penny more.`,
    deferredWarning: (months, apr) => [`If any balance remains after ${months} months, interest is charged `, `back to the purchase date at ${apr}% APR`, `. Best when the balance can be cleared inside the window.`],
    fixedAprPre: "Fixed ", fixedAprPost: (months) => ` over ${months} months.`,
    aprLabel: (apr) => `${apr}% APR`,
    totalOfPayments: "Total of payments",
    interestOver: (months) => `Interest over ${months} months`,
    financingFooter: (small) => `Through CareCredit / Allegro, subject to approval.${small ? " A 60-month plan opens up on purchases of $2,500 or more." : ""} We'll walk the exact terms together — no surprises.`,

    // ── Technology tier step ──
    // No dollars on this step: prices are captured silently on tier select
    // and surface exactly once, at the Pricing Reveal on Device Selection.
    foundOptions: "Here's what we found — and your options",
    basedOn: "Based on what you told us and your hearing test.",
    privateLabelNote: "This choice sets the level of sound processing inside your hearing aids. On the next step you'll pick the model and style; every model comes with the technology level you choose here.",
    privatePayNote: "This choice settles your technology level first. On the next step you'll pick the brand, style, and model — whatever you choose there is matched to the level you select here.",
    fromIntake: "From your intake — where listening takes the most effort",
    computing: "Computing recommendation…",
    processingLabels: { 5: "top-of-the-line", 3: "mid-line", 1: "essential" },
    recommendedProcessing: (label) => `Recommended: ${label} processing`,
    noCharge: "No Charge",
    tpaExplain: (tpa) => `${tpa} works from the specific device rather than a technology level you pick here. On the next step we'll choose the device together — style and fit first, with the investment settled once the device is chosen.`,
    tierUnavailable: "Tier selection isn't available for this plan type. Continue to device selection.",
    recommendedTier: (label) => `Recommended: ${label}`,
    cappedNote: (original, available) => ` The engine flagged a higher tier, but ${original} isn't part of this plan — ${available} is the strongest option available to you.`,
    sourceNoIntake: " Recommendation is grounded in audiometric findings — no intake on file.",
    sourceNoFlags: " Recommendation reflects your audiogram. Your intake answers didn't flag specific listening challenges, which the engine reads as a quieter listening profile.",
    sourceFlagged: (count) => ` Recommendation reflects your audiogram and the ${count === 1 ? "situation" : `${count} situations`} you flagged as taking the most listening effort.`,
    pickManually: " You can still pick a tier manually below.",
    showAllOptions: "Show all options ▾", hideAllOptions: "Hide all options ▴",
    recommendedForYou: "Recommended for you",
    whereShowsUp: "Here's where that shows up, situation by situation:",
    noCoverageChart: "Coverage chart not available for this tier label.",
    selectedTick: "✓ Selected",
    selectTier: (label) => `Select ${label}`,

    // ── Care expectations ──
    careTitle: "What treatment looks like from here",
    careIntro: "For nearly every hearing loss we see, hearing aids are the most effective treatment there is. They don't repair the ear — they carry sound to it, shaped to your specific loss, every hour you wear them. That makes them medical instruments rather than accessories: sensitive electronics, calibrated to your test results, worn all day inside a warm and humid ear. Keeping them accurate is our work, and it doesn't finish. That's why you leave here with a schedule, not just a pair of hearing aids.",
    nVisits: (n) => `${n} visits`,
    nExams: (n) => `${n} exams`,
    renewal: "Renewal",
    phases: [
      { when: "First six weeks", title: "Adaptation",
        body: "Your brain has to relearn sounds it stopped hearing years ago, so we start you below your full prescription and step the volume up over the first month. We fit you, call you two days in, and fine-tune in the office at two, four, and six weeks. At the four-week visit we measure the sound down in your ear canal to confirm you're getting exactly what your hearing loss calls for — not what the box was set to." },
      { when: "Every three months", title: "Cleaning & servicing",
        body: "Hearing aids live in the hardest environment any electronics face: body heat, moisture, and earwax, twelve to sixteen hours a day. Every quarter we deep-clean them, replace the parts that wear out — wax guards, domes, tubing, microphone covers — and check that each aid still puts out what it's supposed to. Most failures give warning before they happen. This visit is where we catch them." },
      { when: "Every year", title: "Re-testing & recalibration",
        body: "Hearing changes. We re-test yours once a year and reprogram the aids to your current results. Skip it and the aids stay calibrated to ears you no longer have — the fit between the prescription and the loss quietly comes apart, and it usually gets blamed on the hearing aids." },
      { when: "Year four and on", title: "Review & what's next",
        body: "Around year four your warranty ends and the technology has moved on. We sit down, look at how you're actually hearing rather than how old the aids are, and decide together whether to keep servicing what you have or move to newer equipment. Whichever you choose, the next stretch of care starts from that visit." },
    ],
    keepsGoing: "And then it keeps going",
    perpetuity: (totalVisits) => `${totalVisits} visits go on your calendar the day you're fitted — and those are the start of the plan, not the whole of it. Hearing loss is permanent and it keeps changing; hearing aids are machines, and machines get serviced and eventually replaced. So for as long as you wear them, you have a hearing care provider — the same way you have a dentist or an eye doctor, and for the same reason. That's what today is really about: not buying a device, but starting a treatment relationship that stays with you.`,
    bridgeToPlans: "The plans below differ in how that care is paid for — not in whether you need it.",

    // ── Care journey chart ──
    journeyTitle: "Your Hearing Journey",
    journeySubtitle: "How regular care keeps your hearing at its best — the first five years of care that continues for as long as you wear hearing aids.",
    normalHearing: "Normal Hearing",
    hearingAbility: "Hearing Ability",
    milestoneGetAids: "Get Hearing\nAids",
    milestoneUpgrade: "Upgrade",
    youAreHere: "You are here",
    warrantyCoverage: (years) => `${years}-Year Warranty Coverage`,
  },

  es: {
    // ── Listening environments (shared) ──
    environments: {
      home: "Casa tranquila / conversación privada", tv: "TV / películas", phone: "Llamadas telefónicas",
      religious: "Servicios religiosos", car: "Auto (ruido de carretera)", restaurant: "Restaurante",
      groups: "Conversaciones en grupo / reuniones", outdoors: "Al aire libre / viento", crowds: "Multitudes / fiestas / conciertos",
    },
    situationLabels: {
      home: "Conversación tranquila", tv: "Televisión", phone: "Llamadas telefónicas",
      religious: "Servicios religiosos", car: "En el auto", restaurant: "Restaurantes",
      groups: "Conversaciones en grupo", outdoors: "Al aire libre", crowds: "Multitudes y reuniones",
    },
    effortSignals: {
      hear_fatigue: "Agotado/a después de conversaciones en ruido",
      hear_strain: "Concentrándose mucho para seguir el hilo",
    },
    tierEffort: {
      5: "El procesador separa el habla del ruido antes de que el sonido llegue a su cerebro — así su energía va a la conversación, no a descifrarla. Incluso los lugares más difíciles le cuestan menos.",
      3: "Hace la mayor parte del trabajo de separación por usted a medida que cambian los ambientes; su cerebro ayuda en los momentos más ruidosos, y la escucha diaria se mantiene cómoda.",
      1: "Restaura la claridad que a sus oídos les falta, y en ambientes tranquilos eso es la mayor parte del trabajo; con ruido de fondo, su cerebro aún hace el trabajo de separar el habla.",
      0: "Hace más fácil seguir una conversación tranquila de uno a uno; en lugares ruidosos, la mayor parte del trabajo de separación aún recae en su cerebro.",
      "-1": "Vuelve a poner el habla a su alcance en casa y de cerca; donde el ruido aumenta, su cerebro carga con el trabajo de escuchar casi por sí solo.",
    },

    // ── Coverage bars ──
    mostChallenging: "Sus ambientes más difíciles",
    otherEnvironments: "Otros ambientes",
    allEnvironments: "Todos los ambientes de escucha",

    // ── Pricing reveal ──
    selectDeviceFirst: "Seleccione un dispositivo para ver su inversión.",
    investmentToday: "Su Inversión de Hoy",
    pairTwoAids: "el par (2 audífonos)",
    perAid: "por audífono",
    listJoin: (items) => items.length <= 1 ? (items[0] || "") : items.slice(0, -1).join(", ") + " y " + items[items.length - 1],
    reflectHardest: (text, effort) => `Usted nos dijo que los momentos más difíciles han sido ${text}${effort ? " — y que escuchar ahí lo/la deja agotado/a." : " — los lugares donde escuchar le exige más."}`,
    reflectEffortOnly: "Usted nos dijo que escuchar cuesta verdadero trabajo últimamente — las conversaciones lo/la dejan más cansado/a de lo que deberían.",
    tierTech: (label) => `Tecnología ${label}`,
    listeningEffort: "Esfuerzo de escucha",
    yourInvestment: "Su inversión",
    forBothAids: "por ambos audífonos",
    perAidSlash: (amount) => `${amount} / audífono`,
    right: "Derecho", left: "Izquierdo", crosUnit: "Unidad CROS",
    planCovers: "Su plan cubre",
    ccIncluded: "(incluido)",
    fullRetailValue: "Valor total de venta",
    youSave: (amount) => `Usted ahorra ${amount}`,
    pctOff: (pct) => `${pct}% de descuento`,
    fiveYearsTitle: "Cinco años de cuidado, incluidos",
    fiveYearsBody: "Visitas ilimitadas por 5 años · garantía de reparación de 4 años (los 3 años del fabricante más 1 adicional de nuestra parte) · limpiezas, ajustes y una llamada de seguimiento dos días después de comenzar.",
    defaultCarePlanNote: "Su plan de cuidado predeterminado — lo confirmaremos juntos en el siguiente paso.",

    // ── Financing calculator ──
    waysComfortable: "Formas de hacerlo cómodo",
    mo: "meses",
    estimatedFor: (months) => `estimado, por ${months} meses`,
    zeroInterest: "0% de interés",
    zeroInterestRest: (total, months) => ` si los $${total} completos se pagan dentro de ${months} meses — ni un centavo más.`,
    deferredWarning: (months, apr) => [`Si queda algún saldo después de ${months} meses, se cobra interés `, `retroactivo a la fecha de compra al ${apr}% APR`, `. Es mejor cuando el saldo puede liquidarse dentro del plazo.`],
    fixedAprPre: "APR fijo de ", fixedAprPost: (months) => ` durante ${months} meses.`,
    aprLabel: (apr) => `${apr}%`,
    totalOfPayments: "Total de pagos",
    interestOver: (months) => `Interés durante ${months} meses`,
    financingFooter: (small) => `A través de CareCredit / Allegro, sujeto a aprobación.${small ? " Un plan de 60 meses está disponible en compras de $2,500 o más." : ""} Revisaremos juntos los términos exactos — sin sorpresas.`,

    // ── Technology tier step ──
    // Sin precios en este paso: el precio se registra silenciosamente al
    // elegir el nivel y aparece una sola vez, en la Revelación de Precio.
    foundOptions: "Esto es lo que encontramos — y sus opciones",
    basedOn: "Basado en lo que usted nos dijo y en su examen de audición.",
    privateLabelNote: "Esta elección establece el nivel de procesamiento de sonido dentro de sus audífonos. En el siguiente paso elegirá el modelo y el estilo; cada modelo viene con el nivel de tecnología que elija aquí.",
    privatePayNote: "Esta elección establece primero su nivel de tecnología. En el siguiente paso elegirá la marca, el estilo y el modelo — lo que elija ahí se ajusta al nivel que seleccione aquí.",
    fromIntake: "De su formulario — donde escuchar exige más esfuerzo",
    computing: "Calculando la recomendación…",
    processingLabels: { 5: "de gama alta", 3: "de gama media", 1: "esencial" },
    recommendedProcessing: (label) => `Recomendado: procesamiento ${label}`,
    noCharge: "Sin Costo",
    tpaExplain: (tpa) => `${tpa} trabaja a partir del dispositivo específico, no de un nivel de tecnología que usted elija aquí. En el siguiente paso elegiremos el dispositivo juntos — primero el estilo y el ajuste, con la inversión definida una vez elegido el dispositivo.`,
    tierUnavailable: "La selección de nivel no está disponible para este tipo de plan. Continúe a la selección de dispositivo.",
    recommendedTier: (label) => `Recomendado: ${label}`,
    cappedNote: (original, available) => ` El sistema señaló un nivel superior, pero ${original} no es parte de este plan — ${available} es la opción más fuerte disponible para usted.`,
    sourceNoIntake: " La recomendación se basa en los hallazgos audiométricos — no hay formulario de admisión en el expediente.",
    sourceNoFlags: " La recomendación refleja su audiograma. Sus respuestas del formulario no señalaron dificultades específicas de escucha, lo que el sistema interpreta como un perfil de escucha más tranquilo.",
    sourceFlagged: (count) => ` La recomendación refleja su audiograma y ${count === 1 ? "la situación que usted señaló" : `las ${count} situaciones que usted señaló`} como las que más esfuerzo de escucha le exigen.`,
    pickManually: " Aún puede elegir un nivel manualmente abajo.",
    showAllOptions: "Ver todas las opciones ▾", hideAllOptions: "Ocultar opciones ▴",
    recommendedForYou: "Recomendado para usted",
    whereShowsUp: "Aquí es donde eso se nota, situación por situación:",
    noCoverageChart: "No hay gráfico de cobertura disponible para este nivel.",
    selectedTick: "✓ Seleccionado",
    selectTier: (label) => `Elegir ${label}`,

    // ── Care expectations ──
    careTitle: "Cómo se ve el tratamiento de aquí en adelante",
    careIntro: "Para casi todas las pérdidas auditivas que atendemos, los audífonos son el tratamiento más efectivo que existe. No reparan el oído — le llevan el sonido, moldeado a su pérdida específica, cada hora que los usa. Eso los hace instrumentos médicos y no accesorios: electrónica delicada, calibrada a los resultados de su examen, usada todo el día dentro de un oído cálido y húmedo. Mantenerlos precisos es nuestro trabajo, y no termina. Por eso usted sale de aquí con un calendario, no solo con un par de audífonos.",
    nVisits: (n) => `${n} visitas`,
    nExams: (n) => `${n} exámenes`,
    renewal: "Renovación",
    phases: [
      { when: "Primeras seis semanas", title: "Adaptación",
        body: "Su cerebro tiene que reaprender sonidos que dejó de oír hace años, así que comenzamos por debajo de su prescripción completa y subimos el volumen gradualmente durante el primer mes. Lo/la adaptamos, lo/la llamamos a los dos días, y hacemos ajustes finos en la oficina a las dos, cuatro y seis semanas. En la visita de la cuarta semana medimos el sonido dentro de su canal auditivo para confirmar que recibe exactamente lo que su pérdida auditiva requiere — no lo que la caja traía configurado." },
      { when: "Cada tres meses", title: "Limpieza y mantenimiento",
        body: "Los audífonos viven en el ambiente más difícil que enfrenta cualquier electrónica: calor corporal, humedad y cerumen, de doce a dieciséis horas al día. Cada trimestre los limpiamos a fondo, reemplazamos las piezas que se desgastan — filtros de cera, domos, tubos, cubiertas de micrófono — y verificamos que cada audífono siga rindiendo como debe. La mayoría de las fallas avisan antes de ocurrir. Esta visita es donde las detectamos." },
      { when: "Cada año", title: "Reevaluación y recalibración",
        body: "La audición cambia. Reevaluamos la suya una vez al año y reprogramamos los audífonos según sus resultados actuales. Si se omite, los audífonos quedan calibrados para oídos que ya no tiene — el ajuste entre la prescripción y la pérdida se descompone silenciosamente, y la culpa suele llevársela el audífono." },
      { when: "Del cuarto año en adelante", title: "Revisión y lo que sigue",
        body: "Alrededor del cuarto año su garantía termina y la tecnología ha avanzado. Nos sentamos, evaluamos cómo está oyendo realmente en lugar de cuántos años tienen los audífonos, y decidimos juntos si seguir dando servicio a lo que tiene o pasar a equipo más nuevo. Elija lo que elija, la siguiente etapa de cuidado comienza en esa visita." },
    ],
    keepsGoing: "Y después continúa",
    perpetuity: (totalVisits) => `${totalVisits} visitas entran a su calendario el día de su adaptación — y son el comienzo del plan, no el plan completo. La pérdida auditiva es permanente y sigue cambiando; los audífonos son máquinas, y las máquinas se mantienen y con el tiempo se reemplazan. Así que mientras los use, usted tiene un proveedor de cuidado auditivo — igual que tiene un dentista o un oftalmólogo, y por la misma razón. De eso se trata realmente el día de hoy: no de comprar un dispositivo, sino de comenzar una relación de tratamiento que lo/la acompaña.`,
    bridgeToPlans: "Los planes de abajo difieren en cómo se paga ese cuidado — no en si usted lo necesita.",

    // ── Care journey chart ──
    journeyTitle: "Su Trayecto Auditivo",
    journeySubtitle: "Cómo el cuidado regular mantiene su audición en su mejor punto — los primeros cinco años de un cuidado que continúa mientras use audífonos.",
    normalHearing: "Audición Normal",
    hearingAbility: "Capacidad Auditiva",
    milestoneGetAids: "Recibe sus\nAudífonos",
    milestoneUpgrade: "Actualización",
    youAreHere: "Usted está aquí",
    warrantyCoverage: (years) => `Cobertura de Garantía de ${years} Años`,
  },
};
