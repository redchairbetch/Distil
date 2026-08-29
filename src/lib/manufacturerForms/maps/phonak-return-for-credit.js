// Phonak Return for Credit — AcroForm, numeric names mapped by position.
// Instrument 1 = right ear, Instrument 2 = left (audiology convention).
// Return-reason checkboxes and invoice fields are per-incident and unmapped.
export default {
  id: "phonak-return-for-credit",
  manufacturer: "phonak",
  category: "return_credit",
  title: "Phonak Return for Credit",
  pdf: "phonak/phonak-return-for-credit.pdf",
  sha256: "552864465e577a6f48e32a75387f6a3f6dce06910ebbb245fa7101103d8b57cc",
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
    { logical: "device.right.model", target: "27" },
    { logical: "device.right.serial", target: "28" },
    { logical: "patient.name", target: "29" },
    { logical: "device.left.model", target: "30" },
    { logical: "device.left.serial", target: "31" },
    { logical: "patient.name", target: "32" },
  ],
};
