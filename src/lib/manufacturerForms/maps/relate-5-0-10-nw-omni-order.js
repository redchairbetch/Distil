// Relate 5.0 10 NW Omni custom order — AcroForm. Custom-shell product:
// header + patient + audiogram + side/tech-level ticks; shell/power options
// stay with the pen, Notes carries the coupling summary when one exists.
const FREQS = [250, 500, 1000, 2000, 3000, 4000];

export default {
  id: "relate-5-0-10-nw-omni-order",
  manufacturer: "relate",
  category: "custom_order",
  title: "Relate 5.0 10 NW Omni Custom Order",
  pdf: "relate/relate-5-0-10-nw-omni-order.pdf",
  sha256: "28cc838f80e3414cbaefcc1e8ea27095c237a59c24553a859843f9124ab64541",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: "1 ship to account" },
    { logical: "clinic.street", target: "2 address" },
    { logical: "clinic.city", target: "3 city" },
    { logical: "clinic.state", target: "4 state" },
    { logical: "clinic.zip", target: "5 zip" },
    { logical: "clinic.billTo", target: "6 bill to account" },
    { logical: "meta.today", target: "7 date" },
    { logical: "po", target: "8 purchase order number" },
    { logical: "provider.name", target: "9 contact name" },
    { logical: "clinic.phone", target: "10 phone number" },
    { logical: "patient.lastName", target: "12 last name" },
    { logical: "patient.firstName", target: "13 first name" },
    { logical: "patient.dob", target: "14 date of birth" },
    { logical: "patient.age", target: "15 age" },
    ...FREQS.flatMap((f, i) => [
      { logical: `audiogram.left.${f}`, target: String(16 + i) },
      { logical: `audiogram.right.${f}`, target: String(22 + i) },
    ]),
    { logical: "device.left.manufacturer", type: "checkbox", target: "28" },
    { logical: "device.right.manufacturer", type: "checkbox", target: "29" },
    { logical: "device.primary.techLevel", type: "checkbox", target: "Platinum", equalsAll: { "device.primary.techLevel": "Platinum" } },
    { logical: "device.primary.techLevel", type: "checkbox", target: "Gold", equalsAll: { "device.primary.techLevel": "Gold" } },
    { logical: "earmold.summary", target: "Notes" },
  ],
};
