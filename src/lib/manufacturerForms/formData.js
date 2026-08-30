// Logical field vocabulary for manufacturer forms (backlog #42). React-free.
//
// buildFormData flattens chart + clinic + provider state into the dotted-key
// object every field map draws from. Maps reference only these keys; the
// FormsModal renders the same object as an editable prefill panel, so what the
// provider sees in the panel is exactly what lands on paper. Values here are
// best-effort defaults — a blank is always legal (the engine skips empties).

import { MFR_DISPLAY, normalizeMfr } from "../manufacturerKeys.js";
import { EARMOLD_SEED } from "../earmoldSeed.js";

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d)) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};

// "1234 N Hearing Ave, St. George, UT 84770" → parts, best-effort. Forms with
// separate city/state/zip blanks use these; the free-text address is the
// fallback when the tail doesn't parse.
function parseAddress(address) {
  const m = /^(.*?),\s*([^,]+?),\s*([A-Za-z]{2})\.?\s+(\d{5}(?:-\d{4})?)\s*$/.exec(address || "");
  if (!m) return { street: address || "", city: "", state: "", zip: "" };
  return { street: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), zip: m[4] };
}

// "(435) 555-0142" / "435-555-0142" → { area, local }
function splitPhone(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) return { area: digits.slice(0, 3), local: `${digits.slice(3, 6)}-${digits.slice(6)}` };
  return { area: "", local: phone || "" };
}

// Earmold namespace for one side (backlog #42b). Raw catalog ids feed the
// grid checkboxes (equalsAll routing); labels resolved from the seed build
// the human-readable summary that always lands in Special Instructions —
// the lab gets a complete order even where a grid tick isn't mapped.
function earmoldEntries(prefix, side) {
  if (!side || side.coupling !== "earmold") return {};
  const mfrKey = normalizeMfr(side.manufacturer);
  const row = EARMOLD_SEED.find((r) => r.manufacturer === mfrKey && r.styleId === side.earmoldStyle) || null;
  const material = row?.materials?.find((m) => m.id === side.earmoldMaterial) || null;
  const color = material?.colors?.find((c) => c.id === side.earmoldColor) || null;
  const vent = row?.vents?.find((v) => v.id === side.earmoldVent) || null;
  const summary = [
    row?.styleLabel || side.earmoldStyle,
    material?.label || side.earmoldMaterial,
    color?.label || side.earmoldColor,
    vent ? `${vent.label} vent` : side.earmoldVent && `${side.earmoldVent} vent`,
    side.earmoldVentSize,
    side.earmoldCanal && `${side.earmoldCanal} canal`,
    side.earmoldNotes,
  ].filter(Boolean).join(" · ");
  return {
    [`${prefix}.style`]: side.earmoldStyle || "",
    [`${prefix}.styleLabel`]: row?.styleLabel || side.earmoldStyle || "",
    [`${prefix}.material`]: side.earmoldMaterial || "",
    [`${prefix}.materialLabel`]: material?.label || side.earmoldMaterial || "",
    [`${prefix}.color`]: side.earmoldColor || "",
    [`${prefix}.colorLabel`]: color?.label || side.earmoldColor || "",
    [`${prefix}.vent`]: side.earmoldVent || "",
    [`${prefix}.ventLabel`]: vent?.label || side.earmoldVent || "",
    [`${prefix}.ventSize`]: side.earmoldVentSize || "",
    [`${prefix}.canal`]: side.earmoldCanal || "",
    [`${prefix}.notes`]: side.earmoldNotes || "",
    [`${prefix}.summary`]: summary,
  };
}

const AUDIO_FREQS = [250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000];

function audiogramEntries(audiology) {
  const out = {};
  for (const [prefix, map] of [["audiogram.right", audiology?.rightT], ["audiogram.left", audiology?.leftT]]) {
    for (const f of AUDIO_FREQS) {
      const v = map?.[f];
      out[`${prefix}.${f}`] = v == null ? "" : String(v);
    }
  }
  const worst = Math.max(0, ...AUDIO_FREQS.flatMap((f) => [audiology?.rightT?.[f], audiology?.leftT?.[f]]).filter((v) => v != null));
  out["loss.severity"] =
    !worst ? "" : worst <= 20 ? "Normal" : worst <= 40 ? "Mild" : worst <= 55 ? "Moderate" : worst <= 70 ? "Moderately Severe" : worst <= 90 ? "Severe" : "Profound";
  return out;
}

function ageFromDob(dob) {
  if (!dob) return "";
  const d = new Date(dob.length <= 10 ? dob + "T00:00:00" : dob);
  if (isNaN(d)) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? String(age) : "";
}

const RIC_STYLES = ["ric", "ric_bct", "sr"];
const CUSTOM_STYLES = ["ite", "itc", "cic", "iic", "if"];

function sideEntries(prefix, side, serial) {
  if (!side) return {};
  const model = [side.family, side.variant].filter(Boolean).join(" ");
  const modelName = side.thModel ? side.thModel : model;
  const modelSerial = [modelName, serial].filter(Boolean).join(" / ");
  const style = (side.style || "").toLowerCase();
  return {
    // Style-conditional model/serial lines: forms with separate RIC / BTE /
    // custom-product blanks map each; only the matching one carries a value,
    // and the engine skips empties, so the data routes itself.
    [`${prefix}.modelSerial`]: modelSerial,
    [`${prefix}.ricModelSerial`]: RIC_STYLES.includes(style) ? modelSerial : "",
    [`${prefix}.bteModelSerial`]: style === "bte" ? modelSerial : "",
    [`${prefix}.customModelSerial`]: CUSTOM_STYLES.includes(style) ? modelSerial : "",
    // Section routers for forms split into BTE-family vs custom blocks
    // (Widex L&D et al). styleBucket pairs with a map entry's `equals`.
    [`${prefix}.styleBucket`]:
      style === "iic" || style === "cic" ? "iic_cic"
      : style === "itc" ? "itc"
      : style === "ite" ? "ite"
      : style === "if" ? "if"
      : style === "bte" ? "bte"
      : RIC_STYLES.includes(style) ? "ric" : "",
    [`${prefix}.isBteFamily`]: style === "bte" || RIC_STYLES.includes(style) ? true : "",
    [`${prefix}.isCustom`]: CUSTOM_STYLES.includes(style) ? true : "",
    [`${prefix}.bteFamilyModel`]: style === "bte" || RIC_STYLES.includes(style) ? modelName : "",
    [`${prefix}.bteFamilySerial`]: style === "bte" || RIC_STYLES.includes(style) ? (serial || "") : "",
    [`${prefix}.customModel`]: CUSTOM_STYLES.includes(style) ? modelName : "",
    [`${prefix}.customSerial`]: CUSTOM_STYLES.includes(style) ? (serial || "") : "",
    [`${prefix}.manufacturer`]: MFR_DISPLAY[side.manufacturer?.toLowerCase?.()] || side.manufacturer || "",
    [`${prefix}.model`]: side.thModel ? side.thModel : model,
    [`${prefix}.techLevel`]: side.techLevel || "",
    [`${prefix}.style`]: (side.style || "").toUpperCase(),
    [`${prefix}.color`]: side.color || side.faceplateColor || "",
    [`${prefix}.serial`]: serial || "",
    [`${prefix}.receiver`]: [side.receiverLength, side.receiverPower].filter(Boolean).join(" / "),
    [`${prefix}.receiverLength`]: side.receiverLength || "",
  };
}

// patient: assembled patient row; devices: patient.devices (may be null);
// clinicSettings: loadClinicSettings result (name/address/phone/fax/manufacturerAccounts);
// clinic/provider: the paClinic/paProvider pair every PDF surface uses;
// mfrKey: canonical manufacturer key the form belongs to; extras: {po, notes, …}.
export function buildFormData({ patient, devices, clinic, clinicSettings, provider, mfrKey, audiology = null, extras = {} }) {
  const name = patient?.name || "";
  const sp = name.indexOf(" ");
  const firstName = sp > 0 ? name.slice(0, sp) : name;
  const lastName = sp > 0 ? name.slice(sp + 1) : "";

  const accounts = clinicSettings?.manufacturerAccounts || {};
  const acct = accounts[mfrKey] || {};

  const warrantyExpiry = devices?.warrantyExpiry || "";
  const inWarranty = warrantyExpiry ? new Date(warrantyExpiry + "T23:59:59") >= new Date() : "";

  const left = devices?.left || null;
  const right = devices?.right || null;
  const primary = right || left;
  const primarySerial = right ? devices?.serialRight : devices?.serialLeft;

  const clinicAddress = clinicSettings?.address || clinic?.address || "";
  const addr = parseAddress(clinicAddress);
  const phone = splitPhone(clinicSettings?.phone || clinic?.phone || "");
  const emLeft = earmoldEntries("earmold.left", left);
  const emRight = earmoldEntries("earmold.right", right);

  return {
    "patient.name": name,
    "patient.firstName": firstName,
    "patient.lastName": lastName,
    "patient.lastFirst": lastName ? `${lastName}, ${firstName}` : firstName,
    "patient.dob": fmtDate(patient?.dob),
    "patient.age": ageFromDob(patient?.dob),
    "patient.phone": patient?.phone || "",
    "patient.email": patient?.email || "",
    "patient.address": patient?.address || "",

    ...sideEntries("device.left", left, devices?.serialLeft),
    ...sideEntries("device.right", right, devices?.serialRight),
    ...sideEntries("device.primary", primary, primarySerial),

    "device.serials": [
      devices?.serialRight ? `R: ${devices.serialRight}` : "",
      devices?.serialLeft ? `L: ${devices.serialLeft}` : "",
    ].filter(Boolean).join("   "),

    // Earmold order namespaces (#42b)
    ...emLeft,
    ...emRight,
    "earmold.summary": [
      emRight["earmold.right.summary"] && `R: ${emRight["earmold.right.summary"]}`,
      emLeft["earmold.left.summary"] && `L: ${emLeft["earmold.left.summary"]}`,
    ].filter(Boolean).join("  |  "),
    ...audiogramEntries(audiology),
    "hearingAid.makeModel": primary
      ? `${MFR_DISPLAY[normalizeMfr(primary.manufacturer)] || primary.manufacturer || ""} ${primary.thModel || [primary.family, primary.variant].filter(Boolean).join(" ")}`.trim()
      : "",
    "impressions.enclosed": extras.impressionsEnclosed ?? false,
    "impressions.scanOnFile": extras.scanOnFile ?? false,

    "fitting.date": fmtDate(devices?.fittingDate),
    "warranty.expiry": fmtDate(warrantyExpiry),
    "warranty.inWarranty": inWarranty === "" ? "" : inWarranty,
    "warranty.outOfWarranty": inWarranty === "" ? "" : !inWarranty,

    "clinic.name": clinicSettings?.name || clinic?.name || "",
    "clinic.address": clinicAddress,
    "clinic.street": addr.street,
    "clinic.city": addr.city,
    "clinic.state": addr.state,
    "clinic.zip": addr.zip,
    "clinic.cityStateZip": [addr.city, [addr.state, addr.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    "clinic.phone": clinicSettings?.phone || clinic?.phone || "",
    "clinic.phoneArea": phone.area,
    "clinic.phoneLocal": phone.local,
    "clinic.fax": clinicSettings?.fax || "",
    "clinic.billTo": acct.billTo || "",
    "clinic.shipTo": acct.shipTo || acct.billTo || "",

    "provider.name": provider?.fullName || "",
    "provider.license": provider?.activeLicense || "",

    "meta.today": fmtDate(new Date().toISOString()),
    "po": extras.po || "",
    "notes": extras.notes || "",
  };
}

// Human labels for the FormsModal's editable prefill panel, keyed by logical
// prefix. Only keys a form's map actually uses are shown.
export const LOGICAL_LABELS = {
  "patient.name": "Patient name",
  "patient.firstName": "Patient first name",
  "patient.lastName": "Patient last name",
  "patient.dob": "Patient DOB",
  "patient.age": "Patient age",
  "patient.phone": "Patient phone",
  "patient.email": "Patient email",
  "patient.address": "Patient address",
  "device.left.manufacturer": "Left — manufacturer",
  "device.left.model": "Left — model",
  "device.left.techLevel": "Left — tech level",
  "device.left.style": "Left — style",
  "device.left.color": "Left — color",
  "device.left.serial": "Left — serial #",
  "device.left.receiver": "Left — receiver",
  "device.right.manufacturer": "Right — manufacturer",
  "device.right.model": "Right — model",
  "device.right.techLevel": "Right — tech level",
  "device.right.style": "Right — style",
  "device.right.color": "Right — color",
  "device.right.serial": "Right — serial #",
  "device.right.receiver": "Right — receiver",
  "device.primary.manufacturer": "Device — manufacturer",
  "device.primary.model": "Device — model",
  "device.primary.techLevel": "Device — tech level",
  "device.primary.style": "Device — style",
  "device.primary.color": "Device — color",
  "device.primary.serial": "Device — serial #",
  "device.primary.receiver": "Device — receiver",
  "device.left.receiverLength": "Left — receiver length",
  "device.right.receiverLength": "Right — receiver length",
  "device.primary.receiverLength": "Device — receiver length",
  "device.left.modelSerial": "Left — model / serial",
  "device.right.modelSerial": "Right — model / serial",
  "device.primary.modelSerial": "Device — model / serial",
  "device.primary.ricModelSerial": "RIC — model / serial",
  "device.primary.bteModelSerial": "BTE — model / serial",
  "device.primary.customModelSerial": "Custom — model / serial",
  "patient.lastFirst": "Patient (Last, First)",
  "device.primary.styleBucket": "Device — style bucket",
  "device.primary.isBteFamily": "Device is BTE/RIC",
  "device.primary.isCustom": "Device is custom",
  "device.primary.bteFamilyModel": "BTE/RIC — model",
  "device.primary.bteFamilySerial": "BTE/RIC — serial #",
  "device.primary.customModel": "Custom — model",
  "device.primary.customSerial": "Custom — serial #",
  "device.serials": "Serial numbers (R / L)",
  "fitting.date": "Fitting date",
  "warranty.expiry": "Warranty expires",
  "warranty.inWarranty": "In warranty",
  "warranty.outOfWarranty": "Out of warranty",
  "clinic.name": "Clinic name",
  "clinic.address": "Clinic address",
  "clinic.street": "Clinic street",
  "clinic.city": "Clinic city",
  "clinic.state": "Clinic state",
  "clinic.zip": "Clinic ZIP",
  "clinic.cityStateZip": "Clinic city/state/ZIP",
  "clinic.phone": "Clinic phone",
  "clinic.phoneArea": "Clinic phone area code",
  "clinic.phoneLocal": "Clinic phone number",
  "clinic.fax": "Clinic fax",
  "clinic.billTo": "Bill-to account #",
  "clinic.shipTo": "Ship-to account #",
  "provider.name": "Provider name",
  "provider.license": "Provider license",
  "meta.today": "Today's date",
  "po": "P.O. number",
  "notes": "Comments / special instructions",
  ...Object.fromEntries(["left", "right"].flatMap((ear) => {
    const E = ear === "left" ? "Left" : "Right";
    return [
      [`earmold.${ear}.style`, `${E} mold — style`],
      [`earmold.${ear}.styleLabel`, `${E} mold — style name`],
      [`earmold.${ear}.material`, `${E} mold — material`],
      [`earmold.${ear}.materialLabel`, `${E} mold — material name`],
      [`earmold.${ear}.color`, `${E} mold — color`],
      [`earmold.${ear}.colorLabel`, `${E} mold — color name`],
      [`earmold.${ear}.vent`, `${E} mold — vent`],
      [`earmold.${ear}.ventLabel`, `${E} mold — vent name`],
      [`earmold.${ear}.ventSize`, `${E} mold — vent size`],
      [`earmold.${ear}.canal`, `${E} mold — canal`],
      [`earmold.${ear}.notes`, `${E} mold — notes`],
      [`earmold.${ear}.summary`, `${E} mold — order summary`],
    ];
  })),
  "earmold.summary": "Mold order summary (both ears)",
  ...Object.fromEntries([250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000].flatMap((f) => [
    [`audiogram.right.${f}`, `AC Right ${f} Hz`],
    [`audiogram.left.${f}`, `AC Left ${f} Hz`],
  ])),
  "loss.severity": "Hearing loss severity",
  "hearingAid.makeModel": "Hearing aid make/model",
  "impressions.enclosed": "Impressions enclosed",
  "impressions.scanOnFile": "Scan on file",
};
