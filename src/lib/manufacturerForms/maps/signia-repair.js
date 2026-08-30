// Signia repair form — minimal AcroForm header sheet (14 fields; the repair
// detail is handwritten or entered in mySignia). Shipping/child-teen/24-hour
// checkboxes are per-incident and unmapped; the second account box and
// 3rd-party billing / Medicaid fields are ambiguous and left blank.
export default {
  id: "signia-repair",
  manufacturer: "signia",
  category: "repair",
  title: "Signia Repair Form",
  pdf: "signia/signia-repair.pdf",
  sha256: "8e4547be33622ba43c8e6782cc0e685ae85960fb30943fbff23d3ec69e525072",
  mode: "acroform",
  fields: [
    { logical: "clinic.billTo", target: "Account" },
    { logical: "patient.lastFirst", target: "Last First Middle Initial" },
    { logical: "po", target: "undefined_2" },
    { logical: "clinic.phone", target: "Email or" },
    { logical: "provider.name", target: "Contact" },
    { logical: "meta.today", target: "Dte" },
  ],
};
