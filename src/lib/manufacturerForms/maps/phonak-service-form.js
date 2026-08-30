// Phonak Service Form (025-1058) — two-page AcroForm, numeric names mapped by
// position. Step 1 mirrors the repair form's customer block; the ~180
// symptom/service checkboxes across both pages are per-incident and unmapped.
// Field 207 is the comments block.
export default {
  id: "phonak-service-form",
  manufacturer: "phonak",
  category: "repair",
  title: "Phonak Service Form",
  pdf: "phonak/phonak-service-form.pdf",
  sha256: "607e404f34fd4c96963bdef6c6fcf1a2d3563ec7ea37cf0a645eea382961b371",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: "1" },
    { logical: "meta.today", target: "2" },
    { logical: "clinic.street", target: "3" },
    { logical: "clinic.city", target: "4" },
    { logical: "clinic.state", target: "5" },
    { logical: "clinic.zip", target: "6" },
    { logical: "clinic.billTo", target: "7" },
    { logical: "clinic.street", target: "8" },
    { logical: "clinic.city", target: "9" },
    { logical: "clinic.state", target: "10" },
    { logical: "clinic.zip", target: "11" },
    { logical: "patient.name", target: "12" },
    { logical: "po", target: "14" },
    { logical: "provider.name", target: "15" },
    { logical: "clinic.phone", target: "16" },
    { logical: "device.primary.modelSerial", target: "17" },
    { logical: "device.primary.receiver", target: "19" },
    { logical: "device.primary.customModelSerial", target: "24" },
    { logical: "notes", target: "207" },
  ],
};
