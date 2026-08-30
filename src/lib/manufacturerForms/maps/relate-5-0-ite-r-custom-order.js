// Relate 5.0 ITE-R custom order — AcroForm, two identical pages (p0/p1 have
// separate field sets; both header blocks fill). Custom-shell product: shell
// build options aren't chart state, so this map fills header + patient +
// audiogram + side/tech-level ticks; shell details ride the pen and the
// Notes box gets the coupling summary when one exists.
const HEADER = [
  ["ship to account", "1 ship to account", "clinic.shipTo"],
  ["address", "2 address", "clinic.street"],
  ["city", "3 city", "clinic.city"],
  ["state", "4 state", "clinic.state"],
  ["zip", "5 zip", "clinic.zip"],
  ["bill to account", "6 bill to account", "clinic.billTo"],
  ["date", "7 date", "meta.today"],
  ["purchase order number", "8 purchase order number", "po"],
  ["contact name", "9 contact name", "provider.name"],
  ["phone number", "10 phone number", "clinic.phone"],
  ["last name", "12 last name", "patient.lastName"],
  ["first name", "13 first name", "patient.firstName"],
  ["date of birth", "14 date of birth", "patient.dob"],
  ["age", "15 age", "patient.age"],
];

const FREQS = [250, 500, 1000, 2000, 3000, 4000];

export default {
  id: "relate-5-0-ite-r-custom-order",
  manufacturer: "relate",
  category: "custom_order",
  title: "Relate 5.0 ITE-R Custom Order",
  pdf: "relate/relate-5-0-ite-r-custom-order.pdf",
  sha256: "5f7ad8aad1b3a56019f8ef288db68c93d75af60fef77ac100f8e79dba54f7671",
  mode: "acroform",
  fields: [
    ...HEADER.flatMap(([p0, p1, logical]) => [
      { logical, target: p0 },
      { logical, target: p1 },
    ]),
    // Audiogram — top row L, bottom row R; p1's right-row 4K field is "88" (sic)
    ...FREQS.flatMap((f, i) => [
      { logical: `audiogram.left.${f}`, target: String(22 + i) },
      { logical: `audiogram.right.${f}`, target: String(28 + i) },
      { logical: `audiogram.left.${f}`, target: String(56 + i) },
      { logical: `audiogram.right.${f}`, target: ["62", "63", "64", "65", "66", "88"][i] },
    ]),
    // Side + technology level (p0)
    { logical: "device.left.manufacturer", type: "checkbox", target: "35" },
    { logical: "device.right.manufacturer", type: "checkbox", target: "36" },
    { logical: "device.primary.techLevel", type: "checkbox", target: "37", equalsAll: { "device.primary.techLevel": "Platinum" } },
    { logical: "device.primary.techLevel", type: "checkbox", target: "38", equalsAll: { "device.primary.techLevel": "Gold" } },
    { logical: "earmold.summary", target: "143" },
  ],
};
