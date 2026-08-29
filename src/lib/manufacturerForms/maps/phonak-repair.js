// Phonak Repair — AcroForm with bare numeric field names, mapped by widget
// position (scripts/annotate-form-fields.mjs). Device Information has separate
// RIC (17) / BTE (19) / Custom Product (23) model+serial blanks — the
// style-conditional logical keys route the chart's device to the right one.
// Step 3 service-plan / repair-reason checkboxes are per-incident and unmapped.
export default {
  id: "phonak-repair",
  manufacturer: "phonak",
  category: "repair",
  title: "Phonak Repair Form",
  pdf: "phonak/phonak-repair.pdf",
  sha256: "5487baba4977a60e9cd9e95ae9225748e5f2a0963be8e62deb4a51e4070430c2",
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
    { logical: "device.primary.ricModelSerial", target: "17" },
    { logical: "device.primary.receiver", target: "18" },
    { logical: "device.primary.bteModelSerial", target: "19" },
    { logical: "device.primary.customModelSerial", target: "23" },
    { logical: "notes", target: "89" },
  ],
};
