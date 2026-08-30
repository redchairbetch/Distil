// Relate one-time courtesy replacement (loss/damage) — AcroForm. Signature
// block and loss narrative details stay with the patient's pen.
export default {
  id: "relate-one-time-courtesy-replacement",
  manufacturer: "relate",
  category: "loss_damage",
  title: "Relate One-Time Courtesy Replacement",
  pdf: "relate/relate-one-time-courtesy-replacement.pdf",
  sha256: "a5b5ce255ac669483c22ed92ace683596eae4f9a5968c6f3780c5553b32fd83d",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: "Text Field 56" },
    { logical: "clinic.name", target: "Text Field 30" },
    { logical: "clinic.street", target: "Text Field 58" },
    { logical: "clinic.city", target: "Text Field 59" },
    { logical: "clinic.billTo", target: "Text Field 62" },
    { logical: "clinic.name", target: "Text Field 63" },
    { logical: "clinic.street", target: "Text Field 31" },
    { logical: "clinic.city", target: "Text Field 64" },
    { logical: "provider.name", target: "Text Field 70" },
    { logical: "clinic.phone", target: "Text Field 71" },
    { logical: "patient.name", target: "Text Field 67" },
    { logical: "po", target: "Text Field 69" },
    { logical: "device.primary.model", target: "Text Field 72" },
    { logical: "device.primary.serial", target: "Text Field 74" },
    { logical: "device.primary.receiver", target: "Text Field 75" },
    { logical: "notes", target: "Text Field 79" },
  ],
};
