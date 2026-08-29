// Canonical manufacturer keys (backlog #42).
//
// Manufacturer names in the app are display strings with inconsistent casing
// ("Resound" in RECEIVER_POWERS, "ReSound" in MFR_LOGO). Every #42 surface —
// the form registry, earmold_catalog rows, clinics.manufacturer_accounts keys —
// keys on the lowercase canonical form and normalizes display strings at the
// boundary. TruHearing devices are Signia-built: for earmold/forms purposes
// they resolve to the signia key (Kurt, 2026-08-29).

export const MFR_KEYS = [
  "signia",
  "rexton",
  "phonak",
  "oticon",
  "resound",
  "starkey",
  "widex",
  "unitron",
  "relate",
];

export const MFR_DISPLAY = {
  signia: "Signia",
  rexton: "Rexton",
  phonak: "Phonak",
  oticon: "Oticon",
  resound: "ReSound",
  starkey: "Starkey",
  widex: "Widex",
  unitron: "Unitron",
  relate: "Relate",
};

const ALIASES = {
  truhearing: "signia",
};

// Display string (any casing) → canonical key, or null if unknown.
export function normalizeMfr(name) {
  if (!name) return null;
  const k = String(name).trim().toLowerCase().replace(/\s+/g, "");
  if (MFR_KEYS.includes(k)) return k;
  return ALIASES[k] || null;
}
