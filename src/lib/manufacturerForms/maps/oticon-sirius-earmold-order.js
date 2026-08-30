// Oticon Sirius earmold order — AcroForm with fully semantic field names
// (p0 = miniRITE molds: MicroMold/LiteTip/MicroShell; p1 = BTE molds:
// Standard #13 + Corda miniFit). Grid checkboxes are generated from compact
// tables: each tick fires via equalsAll on the side's stored earmold state
// (style column × material/vent row × ear). Retention, fitting level, tubing
// length and finish aren't per-side chart state — they ride in the
// Special Instructions summary (earmold.summary) and the pen. Corda molds
// tick under the "MicroMold Corda" column (the form's solid default).
// registry.test.js verifies every generated target exists in the PDF.

const HEADER = [
  { logical: "clinic.shipTo", target: "Ship to Account" },
  { logical: "clinic.name", target: "Account Name" },
  { logical: "clinic.street", target: "Address_2" },
  { logical: "clinic.cityStateZip", target: "Address_3" },
  { logical: "clinic.city", target: "City" },
  { logical: "clinic.state", target: "State" },
  { logical: "clinic.zip", target: "Zip" },
  { logical: "clinic.phone", target: "Phone" },
  { logical: "provider.name", target: "Contact Name" },
  { logical: "clinic.billTo", target: "Bill to Account" },
  { logical: "meta.today", target: "Date" },
  { logical: "fitting.date", target: "Fitting Date" },
  { logical: "po", target: "Purchase Order" },
  { logical: "patient.firstName", target: "Step 2 Patient Information" },
  { logical: "patient.lastName", target: "undefined" },
  { logical: "patient.age", target: "Age" },
  { logical: "device.primary.model", target: "Model" },
  { logical: "device.primary.style", target: "Style" },
  { logical: "device.primary.serial", target: "Serial  if existing" },
  { logical: "device.primary.color", target: "Color" },
  { logical: "earmold.summary", target: "Special Instructions  miniRITE" },
];

const HEADER_P1 = [
  { logical: "clinic.shipTo", target: "Ship To Information" },
  { logical: "clinic.name", target: "clinicName" },
  { logical: "clinic.street", target: "clinicAddress" },
  { logical: "clinic.city", target: "clinicCity" },
  { logical: "clinic.state", target: "clinicProvince" },
  { logical: "clinic.zip", target: "clinicPostalCode" },
  { logical: "clinic.phone", target: "clinicPhoneNumber" },
  { logical: "provider.name", target: "ContactName" },
  { logical: "clinic.billTo", target: "Bill to Information" },
  { logical: "meta.today", target: "Todays Date" },
  { logical: "fitting.date", target: "orderPurchaseDate" },
  { logical: "po", target: "orderPurchaseNumber" },
  { logical: "patient.firstName", target: "patientGivenName" },
  { logical: "patient.lastName", target: "patientSurname" },
  { logical: "patient.age", target: "patientAge" },
  { logical: "device.primary.model", target: "BTE Model" },
  { logical: "device.primary.style", target: "BTE Style" },
  { logical: "device.primary.serial", target: "BTE Serial  if existing" },
  { logical: "device.primary.color", target: "BTE Color" },
  { logical: "earmold.summary", target: "Special Instructions BTE" },
];

const AUDIOGRAM = [
  ...["250", "500", "1k", "2k", "3k", "4k", "6k"].map((f, i) => ({
    logical: `audiogram.right.${[250, 500, 1000, 2000, 3000, 4000, 6000][i]}`, target: `${f}AC Right`,
  })),
  ...["250", "500", "1k", "2k", "3k", "4k", "6k"].map((f, i) => ({
    logical: `audiogram.left.${[250, 500, 1000, 2000, 3000, 4000, 6000][i]}`, target: `${f}AC Left`,
  })),
  ...["250", "500", "1k", "2k", "3k", "4k", "6k"].map((f, i) => ({
    logical: `audiogram.right.${[250, 500, 1000, 2000, 3000, 4000, 6000][i]}`, target: `ac right ${f}`,
  })),
  ...["250", "500", "1k", "2k", "3k", "4k", "6k"].map((f, i) => ({
    logical: `audiogram.left.${[250, 500, 1000, 2000, 3000, 4000, 6000][i]}`, target: `ac left ${f}`,
  })),
];

// styleId → { material row name fragments, vent row name fragments } per ear.
// Target pattern: `${prefix} ${row} ${R|L}` with the column's exact spelling.
const GRID = [
  { style: "micromold", prefix: "MicroMold",
    materials: { "hard-acrylic": "Hard Acrylic", "soft-60": "Soft shore 60", "soft-40": "Soft shore 40", "ototherm": "OtoTherm" },
    vents: { max: "MaxVent", "extra-large": "Xlrg", large: "Lrg", medium: "Medium", small: "Small", none: "NoVent" } },
  { style: "litetip", prefix: "LiteTip",
    materials: { "hard-acrylic": "Hard Acrylic", ototherm: { R: "OtoTherm", L: "Hard OtoTherm" } },
    vents: { max: "MaxVent", "extra-large": "Vent Xlrg", large: "Vent lrg", medium: "Vent Med", small: "Vent Small", none: "NoVent" } },
  { style: "microshell", prefix: "MicroShell",
    materials: {},
    vents: { max: "MaxVent", "extra-large": "XlrgVent", large: "LrgVent", "medium-plus": "MedPlusVent", medium: "MedVent", small: "SmlVent", none: "NoVent" } },
  { style: "standard-bte", prefix: "BTE Mold", ventPrefix: "BTE mold",
    materials: { "hard-acrylic": "Hrd Acrylic", "soft-60": "Soft60", "soft-40": "Soft40", ototherm: "OtoTherm" },
    vents: { max: "Vent Max", large: "Vent Lrg", medium: "Vent Med", small: "Vent Sm", none: "No Vent" } },
  { style: "corda-minifit", prefix: "MicroMold Corda",
    materials: { "hard-acrylic": "Hrd Acrylic", ototherm: "OtoTherm" },
    vents: { max: "Vent Max", "extra-large": "Vent XL", large: "Vent Lrg", medium: "Vent Med", small: "Vent Sm", none: "No Vent" } },
];

// Global (not per-ear) color checkboxes; tick when either ear's mold matches.
const COLORS = [
  ...["Transparent", "White", "Black", "Rose", "Orange", "Yellow", "Green", "Red", "Blue"].map((c) => ({
    material: "soft-40", color: c.toLowerCase(), target: c })),
  { material: "soft-60", color: "transparent", target: "Transparent shore 60" },
  { material: "soft-60", color: "pink", target: "Pink shore 60" },
];
const MICROSHELL_COLORS = [
  ["transparent", "Transparent MicroShell detect only"],
  ["beige", "Beige MicroShell detect only"],
  ["light-brown", "Light Brown MicroShell detect only"],
  ["medium-brown", "Medium BrownMicroShell detect only"], // sic — the PDF's field name has no space
  ["dark-brown", "Dark Brown MicroShell detect only"],
  ["black", "Black MicroShell detect only"],
  ["red-blue", "RedBlue MicroShell detect only"],
];

function gridFields() {
  const out = [];
  const EARS = [["right", "R"], ["left", "L"]];
  for (const col of GRID) {
    for (const [ear, E] of EARS) {
      const style = { [`earmold.${ear}.style`]: col.style };
      for (const [matId, frag] of Object.entries(col.materials)) {
        const f = typeof frag === "string" ? frag : frag[E];
        out.push({
          logical: `earmold.${ear}.material`, type: "checkbox",
          target: `${col.prefix} ${f} ${E}`,
          equalsAll: { ...style, [`earmold.${ear}.material`]: matId },
        });
      }
      for (const [ventId, frag] of Object.entries(col.vents)) {
        out.push({
          logical: `earmold.${ear}.vent`, type: "checkbox",
          target: `${col.ventPrefix || col.prefix} ${frag} ${E}`,
          equalsAll: { ...style, [`earmold.${ear}.vent`]: ventId },
        });
      }
    }
  }
  for (const [ear] of [["right"], ["left"]]) {
    for (const c of COLORS) {
      out.push({
        logical: `earmold.${ear}.color`, type: "checkbox", target: c.target,
        equalsAll: { [`earmold.${ear}.material`]: c.material, [`earmold.${ear}.color`]: c.color },
      });
    }
    for (const [colorId, target] of MICROSHELL_COLORS) {
      out.push({
        logical: `earmold.${ear}.color`, type: "checkbox", target,
        equalsAll: { [`earmold.${ear}.style`]: "microshell", [`earmold.${ear}.color`]: colorId },
      });
    }
  }
  return out;
}

export default {
  id: "oticon-sirius-earmold-order",
  manufacturer: "oticon",
  category: "earmold_order",
  title: "Oticon Sirius Earmold Order",
  pdf: "oticon/oticon-sirius-earmold-order.pdf",
  sha256: "c97d3718d648becc12a0d9dc3df2070b514f9fb1132bb984f8435904918b653e",
  mode: "acroform",
  fields: [...HEADER, ...HEADER_P1, ...AUDIOGRAM, ...gridFields()],
};
