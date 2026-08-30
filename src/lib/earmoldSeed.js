// Earmold catalog seed (backlog #42 phase a) — hand-transcribed from the
// manufacturer earmold order forms in docs/manufacturer-forms/ (2026-08-29).
//
// The Supabase `earmold_catalog` table is the source of truth; this module is
// the offline/seed fallback (insurancePlansSeed pattern) and the input to
// scripts/gen-earmold-seed-sql.mjs, which emits the idempotent seed migration.
// Keep the two at parity: edit here, regenerate the SQL.
//
// Shape per row (mirrors the table's jsonb groups):
//   id            "mfr|style-id"
//   manufacturer  canonical key (src/lib/manufacturerKeys.js)
//   formId        registry id of the source form (provenance)
//   deviceType    'ric' | 'bte'   — which coupling branch offers it
//   styleId / styleLabel
//   materials     [{ id, label, colors: [{id,label}], notes? }]
//   vents         [{ id, label, sizes?: [], notes? }]
//   canal         { types?: [], lengths?: [] }
//   tubing        { receivers?: [], options?: [] }   (RIC receiver / BTE tube)
//   extras        { retention?, waxguard?, finish?, options?, labeling? }
//   constraintsNote  printed rules the structure can't encode
//   confidence    'high' | 'medium' — medium = per-style availability grid on
//                 the printed form was not fully machine-readable; verify
//                 against the paper before trusting an unusual combination.
//
// Phonak and Unitron have no earmold order forms in the library yet (Kurt
// sourcing) — no rows until they land.

// ── Signia — RIC AND EARMOLD 3.0 ORDER FORM (02/26) ────────────────────────
const SIGNIA_MATERIALS = [
  { id: "acrylic", label: "Acrylic (Hard)", colors: [
    { id: "clear", label: "Clear" }, { id: "rose", label: "Rose" },
    { id: "dark-brown-transparent", label: "Dark Brown Transparent" },
    { id: "beige", label: "Beige" }, { id: "brown", label: "Brown" },
    { id: "mocha", label: "Mocha" },
  ], notes: "Matte or gloss finish" },
  { id: "silicone", label: "Silicone (Soft)", colors: [
    { id: "red-opaque", label: "Red Opaque" }, { id: "orange-opaque", label: "Orange Opaque" },
    { id: "yellow-opaque", label: "Yellow Opaque" }, { id: "blue-opaque", label: "Blue Opaque" },
    { id: "lilac-opaque", label: "Lilac Opaque" }, { id: "black-opaque", label: "Black Opaque" },
    { id: "white-opaque", label: "White Opaque" }, { id: "green-translucent", label: "Green Translucent" },
    { id: "pink-translucent", label: "Pink Translucent" }, { id: "blue-translucent", label: "Blue Translucent" },
    { id: "purple-translucent", label: "Purple Translucent" },
    { id: "red-glitter", label: "Red Glitter" }, { id: "orange-glitter", label: "Orange Glitter" },
    { id: "yellow-glitter", label: "Yellow Glitter" }, { id: "green-glitter", label: "Green Glitter" },
    { id: "blue-glitter", label: "Blue Glitter" }, { id: "purple-glitter", label: "Purple Glitter" },
    { id: "pink-glitter", label: "Pink Glitter" }, { id: "clear-glitter", label: "Clear Glitter" },
  ], notes: "Gloss finish; can swirl up to 3 colors. Not offered for every mold style — verify the printed grid." },
];

const SIGNIA_VENTS = [
  { id: "none", label: "No Vent" },
  { id: "standard", label: "Standard", sizes: ["1.0 mm", "1.2 mm", "1.4 mm", "1.6 mm", "2.0 mm", "2.5 mm", "3.0 mm", "As big as possible"], notes: "Canal type long only" },
  { id: "trench", label: "Trench Vent", notes: "Acrylic only" },
  { id: "open", label: "Open", notes: "Canal type short only" },
  { id: "semi-iros", label: "Semi-IROS", notes: "Acrylic only" },
];

const SIGNIA_CANAL = {
  types: ["Long", "Short"],
  lengths: ["Deep (long canal only)", "Long (long canal only)", "Medium", "Short", "Customer specified"],
};

const SIGNIA_TUBING = {
  receivers: ["S miniReceiver 3.0", "M miniReceiver 3.0", "P miniReceiver 3.0", "Embedded mold (receiver glued; acrylic only)"],
};

const SIGNIA_EXTRAS = {
  waxguard: ["Nanocare (default)", "QuickGuard (long canal + acrylic only)", "Extended Receiver Tube (long canal + acrylic only)"],
  finish: ["Matte", "Gloss"],
  options: ["Removal string / no removal string"],
  labeling: ["R/L side indicator", "Patient name", "Red/Blue color dot"],
};

const SIGNIA_STYLES = [
  ["ric", "RIC"], ["ric-lock", "RIC Lock"], ["foil-ric", "Foil RIC"],
  ["ric-foil-lock", "RIC Foil Lock"], ["canal", "Canal"], ["canal-lock", "Canal Lock"],
  ["canal-foil", "Canal Foil"], ["canal-foil-lock", "Canal Foil Lock"],
  ["half-shell", "Half Shell"], ["helix-lock", "Helix Lock"],
  ["half-shell-foil", "Half Shell Foil"], ["full-shell", "Full Shell"],
  ["skeleton", "Skeleton"], ["skeleton-foil", "Skeleton Foil"],
  ["half-skeleton", "1/2 Skeleton"], ["three-quarter-skeleton", "3/4 Skeleton"],
  ["semi-skeleton", "Semi Skeleton"],
];

const signiaRows = SIGNIA_STYLES.map(([styleId, styleLabel], i) => ({
  id: `signia|${styleId}`,
  manufacturer: "signia",
  formId: "signia-ric-3-0-custom-earmold-order",
  deviceType: "ric",
  styleId, styleLabel,
  materials: SIGNIA_MATERIALS,
  vents: SIGNIA_VENTS,
  canal: SIGNIA_CANAL,
  tubing: SIGNIA_TUBING,
  extras: SIGNIA_EXTRAS,
  constraintsNote: "Per-style availability grid on the printed form gates some material/vent/canal combinations; TruHearing RIC fittings order on this form (TH aids are Signia-built).",
  sortOrder: i,
  confidence: "medium",
}));

// ── Starkey — Earmold Order Form (FORM1123, 6/19) ──────────────────────────
const STARKEY_MATERIALS_BTE = [
  { id: "lucite", label: "Lucite (hard)", colors: [
    "Clear", "White", "Rose Transparent", "Brown", "Tan/Light Brown", "Black", "Red", "Orange",
    "Yellow", "Green", "Blue", "Purple", "Pearl", "Neon Red", "Neon Green", "Neon Yellow",
    "Neon Orange", "Neon Pink", "Swirl (2-3 colors)",
  ].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c })) },
  { id: "digital-sls", label: "Digital SLS (hard)", colors: [
    "Clear", "Rose Transparent", "Black", "Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Brown",
  ].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c })) },
  { id: "hs-silicone-60", label: "High Strength Silicone (60 Shore)", colors: [
    "Clear", "Rose Transparent", "Brown", "Tan/Light Brown", "Black", "Orange", "Yellow", "Green", "Blue",
  ].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c })) },
  { id: "hs-silicone-40", label: "High Strength Silicone (40 Shore)", colors: [
    "Clear", "White", "Rose Transparent", "Brown", "Tan/Light Brown", "Red", "Orange", "Yellow",
    "Green", "Blue", "Purple", "Neon Pink", "Sterling", "Champagne", "Slate", "Onyx",
    "Light Blue", "Light Pink", "Light Purple", "Swirl (2-3 colors)",
  ].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c })) },
  { id: "hs-silicone-flex", label: "High Strength Silicone w/ Flex Canal (60/25 Shore)", colors: [
    "Clear", "Rose Transparent", "Brown", "Tan/Light Brown", "Black", "Orange", "Yellow", "Green", "Purple",
  ].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c })) },
];

const STARKEY_VENTS = [
  { id: "none", label: "No Vent" },
  { id: "small", label: "Small 1.0 mm" },
  { id: "medium", label: "Medium 1.6 mm" },
  { id: "large", label: "Large 2.35 mm" },
  { id: "extra-large", label: "Extra Large >3.0 mm" },
  { id: "select-a-vent", label: "Select-a-Vent 3.37 mm" },
  { id: "iros", label: "IROS" },
  { id: "trench", label: "Trench Vent" },
];

const STARKEY_CANAL = { lengths: ["Short", "Medium", "Long"] };

const STARKEY_TUBING_BTE = {
  options: [
    "13 Regular", "13 Heavy", "13 Extra Heavy", "Snap Connect Tube", "CFA Adaptor & Tube",
    "Barb Lock Tube", "Plastic Tube Lock (13H)", "Dry Tube (13H)", "Gold Tube Lock (13H)",
    "Thin Tube (sizes 1-5+)",
  ],
};

const STARKEY_EXTRAS = {
  options: [
    "Lacquer Finish", "Glitter (limited materials)", "Initials", "String Handle",
    "Gold Plated (Lucite only)", "Helix Lock", "Color Code", "HydraShield®2",
    "Hear Clear™ (SLS only, not RIC)", "Dull Finish",
  ],
};

const STARKEY_BTE_STYLES = [
  ["shell", "Shell"], ["three-quarter-shell", "3/4 Shell"], ["half-shell", "Half Shell"],
  ["canal", "Canal"], ["canal-lock", "Canal Lock"], ["cic-style", "CIC Style"],
  ["skeleton", "Skeleton"], ["semi-skeleton", "Semi-Skeleton"],
];

const starkeyBteRows = STARKEY_BTE_STYLES.map(([styleId, styleLabel], i) => ({
  id: `starkey|${styleId}`,
  manufacturer: "starkey",
  formId: "starkey-earmold-order",
  deviceType: "bte",
  styleId, styleLabel,
  materials: STARKEY_MATERIALS_BTE,
  vents: STARKEY_VENTS,
  canal: STARKEY_CANAL,
  tubing: STARKEY_TUBING_BTE,
  extras: STARKEY_EXTRAS,
  constraintsNote: "Each style available Standard or Thin Tube; flex-canal silicone is BTE-only.",
  sortOrder: i,
  confidence: "high",
}));

const STARKEY_RIC_STYLES = [
  ["hollow-hard", "Hollow Hard (40/50/60)", "Canal, Canal Lock, Skeleton"],
  ["hollow-soft", "Hollow Soft (40/50/60)", "Canal only"],
  ["solid-soft", "Solid Soft (50/60)", "Canal, Canal Lock, Skeleton"],
  ["helix-ric", "Helix RIC (40/50/60)", "Soft, Hard"],
  ["occluded-helix-ric", "Occluded Helix RIC (50/60)", "Soft only"],
];

const starkeyRicRows = STARKEY_RIC_STYLES.map(([styleId, styleLabel, retention], i) => ({
  id: `starkey|${styleId}`,
  manufacturer: "starkey",
  formId: "starkey-earmold-order",
  deviceType: "ric",
  styleId, styleLabel,
  materials: STARKEY_MATERIALS_BTE.filter((m) => m.id !== "lucite" && m.id !== "hs-silicone-flex"),
  vents: STARKEY_VENTS,
  canal: STARKEY_CANAL,
  tubing: { receivers: ["Receiver gauge 40", "Receiver gauge 50", "Receiver gauge 60"] },
  extras: { ...STARKEY_EXTRAS, retention: [retention] },
  constraintsNote: "RIC molds — receiver gauges per the style header; Hear Clear not available in RIC.",
  sortOrder: 100 + i,
  confidence: "high",
}));

// ── Oticon — Sirius miniRITE + BTE Earmold Order (09/25) ───────────────────
const OTICON_RETENTION = ["Micro (9mm)", "Canal (12mm)", "Canal Lock", "Semi-Skeleton", "Half Skeleton", "Skeleton Lock"];
const OTICON_SOFT40_COLORS = ["Transparent", "White", "Black", "Rose", "Orange", "Yellow", "Green", "Red", "Blue"]
  .map((c) => ({ id: c.toLowerCase(), label: c }));
const OTICON_SOFT60_COLORS = [{ id: "transparent", label: "Transparent" }, { id: "pink", label: "Pink" }];

const OTICON_MATERIALS_FULL = [
  { id: "hard-acrylic", label: "Hard Acrylic", colors: [{ id: "transparent", label: "Transparent" }] },
  { id: "soft-60", label: "Soft (Shore 60)", colors: OTICON_SOFT60_COLORS },
  { id: "soft-40", label: "Soft (Shore 40)", colors: OTICON_SOFT40_COLORS },
  { id: "ototherm", label: "OtoTherm™", colors: [{ id: "transparent", label: "Transparent" }] },
];

const OTICON_EXTRAS = {
  finish: ["Hard Coat (standard)", "Soft Coat (hard acrylic only)", "Matte (n/a OtoTherm / MicroShell)"],
  options: ["Canal tips red/blue (hard acrylic)", "L&R on mold", "Heavy removal cord", "Large ball removal cord", "Removal string standard"],
};

const oticonRows = [
  {
    id: "oticon|micromold", manufacturer: "oticon", formId: "oticon-sirius-earmold-order",
    deviceType: "ric", styleId: "micromold", styleLabel: "MicroMold (solid)",
    materials: OTICON_MATERIALS_FULL,
    vents: [
      { id: "max", label: "Max Vent" }, { id: "extra-large", label: "Extra Large >2.4" },
      { id: "large", label: "Large 2.4 (default)" }, { id: "medium", label: "Medium 1.4" },
      { id: "small", label: "Small 0.8" }, { id: "none", label: "No vent" },
    ],
    canal: {}, tubing: { receivers: ["miniFit 60", "miniFit 85"] },
    extras: { ...OTICON_EXTRAS, retention: OTICON_RETENTION, options: [...OTICON_EXTRAS.options, "Speaker/wire length 0-5"] },
    constraintsNote: "Solid mold, hollowed bore — in-office receiver changes. Mild-moderate losses.",
    sortOrder: 0, confidence: "high",
  },
  {
    id: "oticon|litetip", manufacturer: "oticon", formId: "oticon-sirius-earmold-order",
    deviceType: "ric", styleId: "litetip", styleLabel: "LiteTip (hollow)",
    materials: [OTICON_MATERIALS_FULL[0], OTICON_MATERIALS_FULL[3]],
    vents: [
      { id: "max", label: "Max Vent" }, { id: "extra-large", label: "Extra Large 1.5 (default)" },
      { id: "large", label: "Large 1.2" }, { id: "medium", label: "Medium 0.8 (short)" },
      { id: "small", label: "Small 0.7 (long)" }, { id: "none", label: "No vent" },
    ],
    canal: {}, tubing: { receivers: ["miniFit 60", "miniFit 85"] },
    extras: { ...OTICON_EXTRAS, retention: OTICON_RETENTION, options: [...OTICON_EXTRAS.options, "Speaker/wire length 0-5"] },
    constraintsNote: "Hollow like a dome, feels less full. Mild-moderate losses. No silicone.",
    sortOrder: 1, confidence: "high",
  },
  {
    id: "oticon|microshell", manufacturer: "oticon", formId: "oticon-sirius-earmold-order",
    deviceType: "ric", styleId: "microshell", styleLabel: "MicroShell (embedded)",
    materials: [{ id: "hard-acrylic", label: "Hard Acrylic (embedded)", colors: [
      "Transparent", "Beige", "Light Brown", "Medium Brown", "Dark Brown", "Black", "Red/Blue",
    ].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c })) }],
    vents: [
      { id: "max", label: "Max Vent" }, { id: "extra-large", label: "Extra Large >2.4" },
      { id: "large", label: "Large 2.4 (default 60/85)" }, { id: "medium-plus", label: "Medium Plus 1.8" },
      { id: "medium", label: "Medium 1.4 (default 100/105)" }, { id: "small", label: "Small 0.8" },
      { id: "none", label: "No vent" },
    ],
    canal: {}, tubing: { receivers: ["60", "85", "100", "105"] },
    extras: { ...OTICON_EXTRAS, retention: ["Micro (60/85 only)", "Canal (100/105)", "Canal Lock", "Semi-Skeleton", "Half Skeleton", "Skeleton Lock"] },
    constraintsNote: "Receiver & wire fully embedded — speaker cannot be changed in office. Matte finish n/a.",
    sortOrder: 2, confidence: "high",
  },
  {
    id: "oticon|standard-bte", manufacturer: "oticon", formId: "oticon-sirius-earmold-order",
    deviceType: "bte", styleId: "standard-bte", styleLabel: "Standard BTE Mold (#13)",
    materials: OTICON_MATERIALS_FULL,
    vents: [
      { id: "max", label: "Max Vent" }, { id: "large", label: "Large 2.4" },
      { id: "medium", label: "Medium 1.4 (default)" }, { id: "small", label: "Small 0.8" },
      { id: "none", label: "No vent" },
    ],
    canal: {},
    tubing: { options: ["13 Medium (3.1mm)", "13 Heavy (3.3mm)", "Dry tube variant"] },
    extras: { ...OTICON_EXTRAS, retention: ["Canal (12mm)", "Canal Lock", "Semi-Skeleton", "Half Skeleton", "Skeleton Lock", "Half Shell", "Full Shell"] },
    constraintsNote: "Mild to profound losses. Removal string standard.",
    sortOrder: 3, confidence: "high",
  },
  {
    id: "oticon|corda-minifit", manufacturer: "oticon", formId: "oticon-sirius-earmold-order",
    deviceType: "bte", styleId: "corda-minifit", styleLabel: "Corda miniFit (slim tube) Mold",
    materials: OTICON_MATERIALS_FULL,
    vents: [
      { id: "max", label: "Max Vent" }, { id: "extra-large", label: "Extra Large" },
      { id: "large", label: "Large" }, { id: "medium", label: "Medium" },
      { id: "small", label: "Small" }, { id: "none", label: "No vent" },
    ],
    canal: {},
    tubing: { options: ["Tubing length -1 to 4", "Standard 0.9 thickness", "Power 1.3 thickness", "Corda miniFit adapter (yes/no)"] },
    extras: { ...OTICON_EXTRAS, retention: OTICON_RETENTION },
    constraintsNote: "MicroMold (solid) or LiteTip (hollow) variants on the slim tube; LiteTip has no silicone.",
    sortOrder: 4, confidence: "high",
  },
];

// ── ReSound — RIE + BTE Custom Earmold Order (MK604744/MK604743) ───────────
const RESOUND_SHELL_COLORS = [
  { id: "clear", label: "Clear" }, { id: "beige", label: "Beige" },
  { id: "light", label: "Light (hard only)" }, { id: "medium", label: "Medium" },
  { id: "dark", label: "Dark" }, { id: "rose", label: "Rose (hard only)" },
  { id: "earlusion-light", label: "EarLusion Light (hard only)" },
  { id: "espresso", label: "Espresso (hard only)" }, { id: "red-blue", label: "Red/Blue" },
];

const RESOUND_MATERIALS = [
  { id: "hard", label: "Hard (acrylic)", colors: RESOUND_SHELL_COLORS },
  { id: "soft", label: "Soft (silicone)", colors: RESOUND_SHELL_COLORS.filter((c) => !c.label.includes("hard only")), notes: "N/A for Encased" },
];

const RESOUND_RIE_VENTS = [
  { id: "factory", label: "Factory select (default)" },
  { id: "mov", label: "MOV (vent modification recommended)" },
  { id: "sav", label: "SAV" },
  { id: "pressure", label: "Pressure" },
  { id: "none", label: "None" },
];

const RESOUND_CANAL = { lengths: ["Factory select (default)", "As marked"] };

const RESOUND_RIE_EXTRAS = {
  waxguard: ["HF3 (hard only)", "GN Wax Filter (default for Encased)", "Extended Receiver Tube", "None (default for hard)"],
  options: [
    "Vent modification: Factory / Semi-IROS / IROS (n/a Hollow Cavity)",
    "Removal cord", "Blue/Red dots (small/large)", "L/R letters", "Patient identification (12 char)",
    "Canal lock (Encased/Micromold/HC)", "Semi-skeleton lock (Encased)", "Skeleton lock (Encased/HC)",
  ],
};

const RESOUND_RIE_STYLES = [
  ["encased", "Encased", "Hard only; UP receiver Encased-only; n/a with M&RIE; faceplate colors: Light/Beige/Medium/Dark/Espresso/Anthracite/Clear"],
  ["micromold", "MicroMold", null],
  ["hollow-cavity", "Hollow Cavity (HC)", "No vent modification or wax protection"],
  ["half-shell", "Half Shell", null],
  ["semi-skeleton", "Semi-Skeleton", null],
  ["skeleton", "Skeleton", null],
  ["full-shell", "Full Shell", null],
];

const resoundRieRows = RESOUND_RIE_STYLES.map(([styleId, styleLabel, note], i) => ({
  id: `resound|${styleId}`,
  manufacturer: "resound",
  formId: "resound-rie-custom-earmold-order",
  deviceType: "ric",
  styleId, styleLabel,
  materials: styleId === "encased" ? [RESOUND_MATERIALS[0]] : RESOUND_MATERIALS,
  vents: RESOUND_RIE_VENTS,
  canal: RESOUND_CANAL,
  tubing: { receivers: [
    "M&RIE (MM — n/a Encased/CROS)", "Low power (LP)", "Medium power (MP)", "High power (HP)",
    ...(styleId === "encased" ? ["Ultra power (UP — Encased only)"] : []),
  ] },
  extras: RESOUND_RIE_EXTRAS,
  constraintsNote: note || "Nexia/OMNIA/LiNX Quattro/Key platforms; send instrument with order option.",
  sortOrder: i,
  confidence: "high",
}));

const RESOUND_BTE_STYLES = [
  ["canal", "Canal"], ["canal-lock", "Canal Lock"], ["semi-skeleton", "Semi-Skeleton"],
  ["half-shell", "Half Shell"], ["skeleton", "Skeleton"], ["open-skeleton", "Open Skeleton"],
  ["full-shell", "Full Shell"],
];

const resoundBteRows = RESOUND_BTE_STYLES.map(([styleId, styleLabel], i) => ({
  id: `resound|bte-${styleId}`,
  manufacturer: "resound",
  formId: "resound-bte-custom-earmold-order",
  deviceType: "bte",
  styleId: `bte-${styleId}`, styleLabel,
  materials: RESOUND_MATERIALS,
  vents: [
    ...RESOUND_RIE_VENTS.slice(0, 4),
    { id: "none", label: "None (standard for Open Skeleton)" },
  ],
  canal: RESOUND_CANAL,
  tubing: { options: [
    "13 Standard", "13 Standard — dry", "13 Heavy wall", "Thin Tube (+size)",
    "Retention: glue / through (no glue) / elbow (n/a thin) / tube lock metal or plastic (soft only)",
  ] },
  extras: {
    options: [
      "Vent modification: Semi-IROS / IROS",
      "Removal cord (standard for Canal)", "Blue/Red dots (small/large)", "L/R letters", "Patient identification (12 char)",
      "Metal hook (Nexia/OMNIA 88 models)",
    ],
  },
  constraintsNote: null,
  sortOrder: 100 + i,
  confidence: "high",
}));

// ── Relate 4.0 (UHCH private label — Unitron-built) ────────────────────────
const RELATE_SHELL_COLORS = [
  { id: "pink-26", label: "Pink (26) — standard for cShell" },
  { id: "tan-14", label: "Tan (14)" }, { id: "cocoa-22", label: "Cocoa (22)" },
  { id: "brown-28", label: "Brown (28)" },
  { id: "clear-21", label: "Clear (21) — default SlimTip; only silicone color" },
  { id: "blue-red", label: "Blue/Red" }, { id: "trans-pink", label: "Translucent Pink (T)" },
  { id: "trans-brown", label: "Translucent Brown (N)" },
];

const RELATE_VENTS = [
  { id: "aov", label: "AOV Acoustically Optimized (audiogram required)" },
  { id: "vari-pressure", label: "Vari-Vent Pressure 1.2 mm (S12)" },
  { id: "vari-small", label: "Vari-Vent Small 2.0 mm (S20)" },
  { id: "vari-medium", label: "Vari-Vent Medium 2.5 mm (S25)" },
  { id: "vari-large", label: "Vari-Vent Large 3.0 mm (S30)" },
  { id: "parallel", label: "Parallel (circular) 1.2 mm" },
  { id: "styled-custom", label: "Styled/Custom large (3L)" },
  { id: "iros-a", label: "IROS A / Semi-IROS / 3.0 mm" },
  { id: "iros-b", label: "IROS B / Full-IROS / 3.0 mm" },
  { id: "none", label: "No vent (X)" },
];

const RELATE_RIC_EXTRAS = {
  waxguard: ["None", "UH wax guard (CS — standard for cShell)", "Extended Receiver Tube (cShell only)", "Wax Spring (cShell only)"],
  finish: ["Gloss (standard)", "No Lacquer (acrylic Clear-21/Pink-26/Cocoa-22 only)"],
  options: ["Removal filament (RF)", "Canal lock (CL — matches shell color)", "Skeleton lock (SL — matches shell color)"],
};

const relateRicRows = [
  {
    id: "relate|slimtip-hollow", manufacturer: "relate", formId: "relate-4-0-ric-custom-ear-piece-order",
    deviceType: "ric", styleId: "slimtip-hollow", styleLabel: "SlimTip, Hollow (Acrylic)",
    materials: [{ id: "acrylic", label: "Acrylic", colors: RELATE_SHELL_COLORS }],
    vents: RELATE_VENTS, canal: {},
    tubing: { receivers: ["S (111/46)", "M (114/50) — standard", "P (122/58)"], options: ["Receiver length 0-3"] },
    extras: RELATE_RIC_EXTRAS,
    constraintsNote: "UP receiver not available — cShell required for UP.",
    sortOrder: 0, confidence: "high",
  },
  {
    id: "relate|slimtip-solid", manufacturer: "relate", formId: "relate-4-0-ric-custom-ear-piece-order",
    deviceType: "ric", styleId: "slimtip-solid", styleLabel: "SlimTip, Solid (Silicone)",
    materials: [{ id: "silicone", label: "Silicone", colors: [RELATE_SHELL_COLORS[4]] }],
    vents: RELATE_VENTS, canal: {},
    tubing: { receivers: ["S (111/46)", "M (114/50) — standard", "P (122/58)"], options: ["Receiver length 0-3"] },
    extras: RELATE_RIC_EXTRAS,
    constraintsNote: "Clear (21) is the only silicone color. UP not available.",
    sortOrder: 1, confidence: "high",
  },
  {
    id: "relate|cshell", manufacturer: "relate", formId: "relate-4-0-ric-custom-ear-piece-order",
    deviceType: "ric", styleId: "cshell", styleLabel: "cShell (Acrylic)",
    materials: [{ id: "acrylic", label: "Acrylic", colors: RELATE_SHELL_COLORS, notes: "Faceplate colors: Pink/Tan/Cocoa/Brown/Clear (13)" }],
    vents: RELATE_VENTS, canal: {},
    tubing: { receivers: ["S (111/46)", "M (114/50) — standard", "P (122/58)", "UP (130/67) — cShell only"], options: ["Receiver length 0-3"] },
    extras: RELATE_RIC_EXTRAS,
    constraintsNote: "Required for UP receivers.",
    sortOrder: 2, confidence: "high",
  },
];

const RELATE_BTE_STYLES = [
  ["full-shell-carved", "Full Shell Carved (SC)"], ["full-shell-uncarved", "Full Shell Uncarved (SU)"],
  ["skeleton", "Skeleton (SK)"], ["semi-skeleton", "Semi Skeleton (SS)"],
  ["carved-half-shell", "Carved Half Shell (HC)"], ["canal-lock", "Canal Lock (CL)"],
  ["canal", "Canal (CU)"], ["cros", "CROS (CB)"], ["helix-lock", "Helix Lock"],
  ["bte-slimtip-hollow", "SlimTip, Hollow (Acrylic)"], ["bte-slimtip-solid", "SlimTip, Soft Solid (Silicone)"],
];

const RELATE_BTE_SILICONE_COLORS = [
  "Clear (21) — standard", "Translucent Pink (T)", "Translucent Brown (N)",
  "Black (06)", "Blue (07)", "Purple (08)", "Red (10)", "Orange (11)", "Green (17)",
  "White (19)", "Yellow (20)", "Flamingo Pink (5B)", "Jungle Green (2B)",
  "Galactic Blue Metallic (1B)", "Star Dust Silver Metallic (3B)", "Magic Pink Metallic (4B)",
].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c }));

const relateBteRows = RELATE_BTE_STYLES.map(([styleId, styleLabel], i) => ({
  id: `relate|${styleId}`,
  manufacturer: "relate",
  formId: "relate-4-0-bte-earmold-order",
  deviceType: "bte",
  styleId, styleLabel,
  materials: [
    { id: "acrylic", label: "Acrylic (AC)", colors: RELATE_BTE_SILICONE_COLORS.slice(0, 3) },
    { id: "silicone-s70", label: "Silicone (S70)", colors: RELATE_BTE_SILICONE_COLORS, notes: "Specialty/metallic colors silicone only; not available on SlimTip soft solid" },
  ],
  vents: RELATE_VENTS,
  canal: {},
  tubing: { options: [
    "13 Regular (13M — standard for acrylic)", "13 Thick wall (13T — standard for silicone)",
    "13 Dry wall (13D)", "Slim tube length 00-3 (SlimTips only)",
  ] },
  extras: {
    finish: ["Gloss (standard)", "No Lacquer (acrylic Clear-21/Pink-26/Cocoa-22 only)"],
    options: ["Removal filament (RF)", "Canal lock (CL — matches shell color)"],
  },
  constraintsNote: "UHCH-exclusive private label (Unitron-built).",
  sortOrder: 100 + i,
  confidence: "high",
}));

// ── Phonak (Sonova) — earmold + SlimTip/cShell 6.0 forms (added 2026-08-30) ─
const SONOVA_SILICONE_COLORS = [
  "Clear (21) — standard", "Translucent Pink (T)", "Translucent Brown (N)",
  "Black (06)", "Blue (07)", "Purple (08)", "Red (10)", "Orange (11)", "Green (17)",
  "White (19)", "Yellow (20)", "Flamingo Pink (5B)", "Jungle Green (2B)",
  "Galactic Blue Metallic (1B)", "Star Dust Silver Metallic (3B)", "Magic Pink Metallic (4B)",
].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c }));

const PHONAK_BTE_MATERIALS = [
  { id: "acrylic", label: "Acrylic (AC)", colors: SONOVA_SILICONE_COLORS.slice(0, 3) },
  { id: "silicone-s70", label: "Silicone (S70)", colors: SONOVA_SILICONE_COLORS, notes: "Solid/metallic colors silicone only" },
];

const PHONAK_VENTS = [
  { id: "aov", label: "AOV Acoustically Optimized (audiogram required)" },
  { id: "large-sav", label: "Large SAV" },
  { id: "iros-a", label: "IROS A / Semi-IROS" },
  { id: "large-p30", label: "Large 3.0 mm (P30)" },
  { id: "medium-p25", label: "Medium 2.5 mm (P25)" },
  { id: "small-p20", label: "Small 2.0 mm (P20)" },
  { id: "pressure-p12", label: "Pressure 1.2 mm (P12)" },
  { id: "none", label: "No vent" },
];

const PHONAK_BTE_STYLES = [
  ["cros", "CROS (CB)"], ["canal-lock", "Canal Lock (CL)"], ["canal", "Canal (CU)"],
  ["semi-skeleton", "Semi Skeleton (SS)"], ["skeleton", "Skeleton (SK)"],
  ["half-shell", "Half Shell (HC)"], ["full-shell-carved", "Carved Full Shell (SC)"],
  ["full-shell-uncarved", "Standard Full Shell (SU)"], ["helix-lock", "Helix Lock"],
];

const phonakBteRows = PHONAK_BTE_STYLES.map(([styleId, styleLabel], i) => ({
  id: `phonak|${styleId}`,
  manufacturer: "phonak",
  formId: "phonak-earmold-order",
  deviceType: "bte",
  styleId, styleLabel,
  materials: PHONAK_BTE_MATERIALS,
  vents: PHONAK_VENTS,
  canal: { lengths: ["Short", "Medium (default)", "Long", "Cut as marked"] },
  tubing: { options: ["13 Regular (13M — standard for acrylic)", "13 Thick wall (13T — standard for silicone)", "13 Dry (13D)", "QuickSnap", "Tube Lock"] },
  extras: { options: ["Helix lock", "Removal line", "Color dot", "No-glue tubing"] },
  constraintsNote: null,
  sortOrder: i,
  confidence: "high",
}));

const PHONAK_RIC_SHARED = {
  vents: [
    { id: "aov", label: "AOV Acoustically Optimized (standard)" },
    { id: "customer-mm", label: "Customer-specific vent (mm)" },
    { id: "none", label: "No vent" },
  ],
  canal: {},
  tubing: { receivers: ["S receiver 6.0", "M receiver 6.0 — standard", "P receiver 6.0"], options: ["Receiver length 00-3 (2 standard; 00 n/a Titanium/CROS)", "Vent style: cavity (standard) / regular"] },
  extras: { options: ["Helix lock (not silicone)", "Canal lock", "Skeleton lock", "Removal line (standard)"] },
};

const phonakRicRows = [
  {
    id: "phonak|slimtip-acrylic", manufacturer: "phonak", formId: "phonak-slim-tip-cros-tip-6-0-order",
    deviceType: "ric", styleId: "slimtip-acrylic", styleLabel: "SlimTip 6.0, Acrylic (hollow)",
    materials: [{ id: "acrylic", label: "Acrylic", colors: [
      "Clear (21) — standard", "Tan (14)", "Cocoa (22)", "Pink (26)", "Brown (28)", "Blue/Red",
    ].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c })) }],
    ...PHONAK_RIC_SHARED,
    constraintsNote: "6.0 receivers — Infinio hearing aids or newer; NOT backward compatible with Lumity (use the Lumity/Paradise custom ear piece form). CeruStop wax protection in tip.",
    sortOrder: 100, confidence: "high",
  },
  {
    id: "phonak|slimtip-silicone", manufacturer: "phonak", formId: "phonak-slim-tip-cros-tip-6-0-order",
    deviceType: "ric", styleId: "slimtip-silicone", styleLabel: "SlimTip 6.0, Silicone (solid)",
    materials: [{ id: "silicone", label: "Silicone", colors: [{ id: "transparent", label: "Transparent" }] }],
    ...PHONAK_RIC_SHARED,
    constraintsNote: "Transparent only; no helix lock. 6.0 receivers (Infinio or newer).",
    sortOrder: 101, confidence: "high",
  },
  {
    id: "phonak|slimtip-titanium", manufacturer: "phonak", formId: "phonak-slim-tip-cros-tip-6-0-order",
    deviceType: "ric", styleId: "slimtip-titanium", styleLabel: "SlimTip 6.0, Titanium AV",
    materials: [{ id: "titanium", label: "Titanium", colors: [{ id: "titanium-gray-u0", label: "Titanium Gray (U0)" }] }],
    ...PHONAK_RIC_SHARED,
    constraintsNote: "MAV receiver only; length 00 not available; Extended Receiver Saver option. 6.0 (Infinio or newer).",
    sortOrder: 102, confidence: "high",
  },
  {
    id: "phonak|cros-tip", manufacturer: "phonak", formId: "phonak-slim-tip-cros-tip-6-0-order",
    deviceType: "ric", styleId: "cros-tip", styleLabel: "CROS Tip 6.0 (hollow)",
    materials: [{ id: "acrylic", label: "Acrylic", colors: [
      "Clear (21) — standard", "Tan (14)", "Cocoa (22)", "Pink (26)", "Brown (28)", "Blue/Red",
    ].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c })) }],
    ...PHONAK_RIC_SHARED,
    constraintsNote: "CROS transmitter side tip — no wax filter, no receiver. cShell 6.0 orders use the separate cShell form.",
    sortOrder: 103, confidence: "high",
  },
  {
    id: "phonak|cshell-acrylic", manufacturer: "phonak", formId: "phonak-cshell-6-0-order",
    deviceType: "ric", styleId: "cshell-acrylic", styleLabel: "cShell 6.0, Acrylic",
    materials: [{ id: "acrylic", label: "Acrylic", colors: [
      "Clear (21) — standard", "Tan (14)", "Cocoa (22)", "Pink (26)", "Brown (28)", "Blue/Red",
    ].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c })) }],
    ...PHONAK_RIC_SHARED,
    constraintsNote: "Full custom shell for 6.0 receivers (Infinio or newer) — required for UP.",
    sortOrder: 104, confidence: "high",
  },
  {
    id: "phonak|cshell-titanium", manufacturer: "phonak", formId: "phonak-cshell-6-0-order",
    deviceType: "ric", styleId: "cshell-titanium", styleLabel: "cShell 6.0, Titanium",
    materials: [{ id: "titanium", label: "Titanium", colors: [{ id: "titanium-gray-u0", label: "Titanium Gray (U0)" }] }],
    ...PHONAK_RIC_SHARED,
    constraintsNote: "Ultra-thin titanium shell for 6.0 receivers (Infinio or newer).",
    sortOrder: 105, confidence: "high",
  },
];

// ── Unitron Vivante — Moxi RIC + Stride BTE order forms (added 2026-08-30) ──
const UNITRON_RIC_SHARED = {
  vents: [
    { id: "intellivent", label: "IntelliVent (audiogram required)" },
    { id: "vari-pressure", label: "Vari-Vent Pressure 1.2 mm (S12)" },
    { id: "vari-small", label: "Vari-Vent Small 2.0 mm (S20)" },
    { id: "vari-medium", label: "Vari-Vent Medium 2.5 mm (S25)" },
    { id: "vari-large", label: "Vari-Vent Large 3.0 mm (S30)" },
    { id: "custom-3l", label: "Custom large (3L)" },
    { id: "none", label: "No vent (X)" },
  ],
  canal: {},
  extras: {
    waxguard: ["None", "Wax guard (standard for cShell)", "Extended Receiver Tube (cShell)", "Wax Spring (cShell)"],
    finish: ["Gloss (standard)", "No Lacquer"],
    options: ["Removal filament (RF)", "Canal lock (CL)", "Skeleton lock (SL)"],
  },
};
const UNITRON_SHELL_COLORS = [
  "Pink (26)", "Tan (14)", "Cocoa (22)", "Brown (28)", "Clear (21) — default SlimTip",
  "Blue/Red", "Translucent Pink (T)", "Translucent Brown (N)",
].map((c) => ({ id: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: c }));

const unitronRicRows = [
  ["slimtip-hollow", "SlimTip, Hollow (Acrylic)", [{ id: "acrylic", label: "Acrylic", colors: UNITRON_SHELL_COLORS }], "UP not available — cShell required."],
  ["slimtip-solid", "SlimTip, Solid (Silicone)", [{ id: "silicone", label: "Silicone", colors: [UNITRON_SHELL_COLORS[4]] }], "Clear (21) is the only silicone color."],
  ["cshell", "cShell (Acrylic)", [{ id: "acrylic", label: "Acrylic", colors: UNITRON_SHELL_COLORS, notes: "Faceplate colors: Pink/Tan/Cocoa/Brown/Clear" }], "Required for UP (132/71) receivers."],
].map(([styleId, styleLabel, materials, note], i) => ({
  id: `unitron|${styleId}`,
  manufacturer: "unitron",
  formId: "unitron-vivante-moxi-ric-order",
  deviceType: "ric",
  styleId, styleLabel, materials,
  ...UNITRON_RIC_SHARED,
  tubing: { receivers: ["S (111/47)", "M (114/51) — standard", "P (122/59)", "UP (132/71) — cShell only"], options: ["Receiver length 0-3"] },
  constraintsNote: `Vivante Moxi platform. ${note}`,
  sortOrder: i,
  confidence: "high",
}));

const UNITRON_BTE_STYLES = [
  ["full-shell-carved", "Full Shell Carved (SC)"], ["full-shell-uncarved", "Full Shell Uncarved (SU)"],
  ["skeleton", "Skeleton (SK)"], ["semi-skeleton", "Semi Skeleton (SS)"],
  ["carved-half-shell", "Carved Half Shell (HC)"], ["canal-lock", "Canal Lock (CL)"],
  ["canal", "Canal (CU)"], ["cros", "CROS (CB)"], ["helix-lock", "Helix Lock"],
];
const unitronBteRows = UNITRON_BTE_STYLES.map(([styleId, styleLabel], i) => ({
  id: `unitron|bte-${styleId}`,
  manufacturer: "unitron",
  formId: "unitron-vivante-stride-bte-order",
  deviceType: "bte",
  styleId: `bte-${styleId}`, styleLabel,
  materials: [
    { id: "acrylic", label: "Acrylic (AC)", colors: SONOVA_SILICONE_COLORS.slice(0, 3) },
    { id: "silicone-s70", label: "Silicone (S70)", colors: SONOVA_SILICONE_COLORS, notes: "Solid/metallic colors silicone only" },
  ],
  // The Stride BTE form rev keeps the wider vent list the Moxi RIC rev dropped.
  vents: [
    ...UNITRON_RIC_SHARED.vents.filter(v => v.id !== "custom-3l" && v.id !== "none"),
    { id: "parallel", label: "Parallel (circular) 1.2 mm" },
    { id: "styled-custom", label: "Styled/Custom (3L)" },
    { id: "iros-a", label: "IROS A / Semi-IROS / 3.0 mm" },
    { id: "iros-b", label: "IROS B / Full-IROS / 3.0 mm" },
    { id: "none", label: "No vent (X)" },
  ],
  canal: {},
  tubing: { options: ["13 Regular (13M — standard for acrylic)", "13 Thick wall (13T — standard for silicone)", "13 Dry (13D)"] },
  extras: {
    finish: ["Gloss (standard)", "No Lacquer"],
    options: ["Removal filament (RF)", "Canal lock (CL)"],
  },
  constraintsNote: "Vivante Stride platform.",
  sortOrder: 100 + i,
  confidence: "high",
}));

// ── Widex Moment — RIC/BTE custom ear-tip + RITE earmold (added 2026-08-30) ─
const WIDEX_HARD_COLORS = [
  { id: "beige", label: "Beige" }, { id: "medium-brown", label: "Medium Brown" }, { id: "clear", label: "Clear" },
];
const WIDEX_TIP_VENTS = [
  { id: "none", label: "Straight — No Vent" },
  { id: "xs", label: "Straight XS" }, { id: "s", label: "Straight S" },
  { id: "m", label: "Straight M" }, { id: "l", label: "Straight L" },
  { id: "xl", label: "Straight XL" }, { id: "xxl", label: "Straight XXL" },
  { id: "max", label: "Max Vent" }, { id: "open", label: "Open (no venting needed)" },
  { id: "trench", label: "Trench (default/optimized for soft molds)" },
  { id: "optimized", label: "Vent Optimized for Anatomy/Audiogram (default)" },
];
const WIDEX_TIP_EXTRAS = {
  options: [
    "Soft/Hard/Nano hypoallergenic coat", "Retention ring", "Thick removal line",
    "Canal lock A-G (canal / extended canal / concha / half skeleton / skeleton / helix / full shell)",
    "Wire/thin-tube length 0-4",
  ],
};

const widexRows = [
  ...[
    ["open-hard", "Open Hard (S&M receivers only)", "both"],
    ["hard-hollow", "Hard Hollow", "both"],
    ["hard-extended", "Hard Extended (solid; Hard Clear only)", "both"],
    ["soft-tip", "Soft (Clear)", "both"],
    ["embedded-hard", "Embedded Hard (receiver built in)", "ric"],
    ["modular-hard", "Modular Hard (RIC 312 D only)", "ric"],
  ].map(([styleId, styleLabel, deviceType], i) => ({
    id: `widex|${styleId}`,
    manufacturer: "widex",
    formId: "widex-moment-ric-bte-order",
    deviceType, styleId, styleLabel,
    materials: styleId === "soft-tip"
      ? [{ id: "soft", label: "Soft", colors: [{ id: "clear", label: "Clear" }] }]
      : [{ id: "hard", label: "Hard (acrylic)", colors: styleId === "hard-extended" || styleId.includes("modular") || styleId.includes("embedded") ? [WIDEX_HARD_COLORS[2]] : WIDEX_HARD_COLORS }],
    vents: WIDEX_TIP_VENTS,
    canal: {},
    tubing: { receivers: ["sRIC R D: V.2 M / V.2 P (+ V.2 HP embedded)", "RIC 312 D / RIC 10: S / M / P (+ HP 312 D)", "Thin tube V.2 0.9mm / 1.4mm (BTE R D / BTE 13 D)"] },
    extras: WIDEX_TIP_EXTRAS,
    constraintsNote: "Moment platform custom ear-tips (CAMISHA). Modular length -1 to 5.",
    sortOrder: i,
    confidence: "high",
  })),
  ...[
    ["rite-hard-half", "RITE Earmold — Hard 1/2 Shell"],
    ["rite-hard-three-quarter", "RITE Earmold — Hard 3/4 Shell"],
    ["rite-hard-full", "RITE Earmold — Hard Full Shell"],
    ["rite-soft-three-quarter", "RITE Earmold — Soft 3/4 Shell"],
    ["rite-soft-full", "RITE Earmold — Soft Full Shell"],
  ].map(([styleId, styleLabel], i) => ({
    id: `widex|${styleId}`,
    manufacturer: "widex",
    formId: "widex-moment-ric-bte-order",
    deviceType: "ric",
    styleId, styleLabel,
    materials: styleId.includes("soft")
      ? [{ id: "soft", label: "Soft", colors: [{ id: "clear", label: "Clear" }] }]
      : [{ id: "hard", label: "Hard (acrylic)", colors: WIDEX_HARD_COLORS }],
    vents: WIDEX_TIP_VENTS,
    canal: {},
    tubing: { receivers: ["HP (hard only)", "Wired HP (soft only)"] },
    extras: { options: ["Output extender (hard shell)", "Hypoallergenic coats", "Removal notch (hard)", "Removal line", "Retention ring", "Wire length 0-5"] },
    constraintsNote: "RITE power earmold — RIC 312 D only, not sRIC R D.",
    sortOrder: 100 + i,
    confidence: "high",
  })),
];

export const EARMOLD_SEED = [
  ...phonakBteRows,
  ...phonakRicRows,
  ...unitronRicRows,
  ...unitronBteRows,
  ...widexRows,
  ...signiaRows,
  ...starkeyBteRows,
  ...starkeyRicRows,
  ...oticonRows,
  ...resoundRieRows,
  ...resoundBteRows,
  ...relateRicRows,
  ...relateBteRows,
];
