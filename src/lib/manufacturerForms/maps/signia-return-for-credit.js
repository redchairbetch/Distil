// Signia Return for Credit (SI-22269) — AcroForm. Replaces the corrupt flat
// SI form that shipped with the original library import. Return-reason
// checkboxes and the signature field are per-incident and unmapped.
export default {
  id: "signia-return-for-credit",
  manufacturer: "signia",
  category: "return_credit",
  title: "Signia Return for Credit",
  pdf: "signia/signia-return-for-credit.pdf",
  sha256: "44911f918ffd86d20a68678e9df91849e419ad4a945d5494d70e3d0584a1ddc9",
  mode: "acroform",
  fields: [
    { logical: "clinic.billTo", target: "Text Field 2" },
    { logical: "clinic.shipTo", target: "Text Field 90" },
    { logical: "clinic.name", target: "Text Field 82" },
    { logical: "clinic.name", target: "Text Field 91" },
    { logical: "clinic.address", target: "Text Field 83" },
    { logical: "clinic.address", target: "Text Field 92" },
    { logical: "clinic.phone", target: "Text Field 85" },
    { logical: "patient.name", target: "Text Field 88" },
    { logical: "provider.name", target: "Text Field 89" },
    { logical: "device.left.model", target: "Text Field 67" },
    { logical: "device.left.serial", target: "Text Field 72" },
    { logical: "device.right.model", target: "Text Field 68" },
    { logical: "device.right.serial", target: "Text Field 73" },
  ],
};
