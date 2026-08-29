// Phonak Return for Credit — FM/Roger equipment (PT600297). AcroForm.
// The "3rd Party Billto" field is insurance third-party billing, not the
// clinic's bill-to account — deliberately unmapped. Return-reason checkboxes
// (numeric names 183-203) are per-incident and unmapped.
export default {
  id: "phonak-fm-return-for-credit",
  manufacturer: "phonak",
  category: "return_credit",
  title: "Phonak Return for Credit — FM/Roger",
  pdf: "phonak/phonak-fm-return-for-credit.pdf",
  sha256: "e4a7b7c952fd8a0bf4bf4a9f6e6fcd89aa3a33a1aa0b7959f53a646cec8f6970",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: "Acct" },
    { logical: "clinic.name", target: "Office" },
    { logical: "clinic.street", target: "Address" },
    { logical: "clinic.cityStateZip", target: "CityState" },
    { logical: "clinic.zip", target: "Zip" },
    { logical: "po", target: "PO" },
    { logical: "meta.today", target: "Date" },
    { logical: "clinic.phone", target: "Office phone" },
    { logical: "provider.name", target: "Office contact" },
    { logical: "patient.lastName", target: "LAST" },
    { logical: "patient.firstName", target: "FIRST" },
    { logical: "device.right.serial", target: "SN" },
    { logical: "device.right.model", target: "Model" },
    { logical: "device.left.serial", target: "SN_2" },
    { logical: "device.left.model", target: "Model_2" },
    { logical: "notes", target: "PLEASE PRINT CLEARLY 1" },
  ],
};
