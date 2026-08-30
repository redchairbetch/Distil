// Oticon repair form — AcroForm (XFA-flattened names). Column 1 of the device
// block maps to the right ear, column 2 to the left (audiology convention on
// the printed form). The warranty radio group exports the same "Yes" value for
// all four options, so only "Under warranty" is selectable programmatically —
// out-of-warranty stays a pen tick. Repair-reason checkboxes are per-incident
// and deliberately unmapped.
const P = "topmostSubform[0].Page1[0].";

export default {
  id: "oticon-repair",
  manufacturer: "oticon",
  category: "repair",
  title: "Oticon Repair Form",
  pdf: "oticon/oticon-repair.pdf",
  sha256: "6a37561474fa10531fb770c652782ec1fdc5944c6e5481e8c63918df6c15072e",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: `${P}Customer_No[0]` },
    { logical: "clinic.phoneArea", target: `${P}Text1[0]` },
    { logical: "clinic.phoneLocal", target: `${P}undefined[0]` },
    { logical: "po", target: `${P}PO[0]` },
    { logical: "clinic.name", target: `${P}Company_Name[0]` },
    { logical: "clinic.street", target: `${P}Address[0]` },
    { logical: "clinic.city", target: `${P}City[0]` },
    { logical: "clinic.state", target: `${P}State[0]` },
    { logical: "clinic.zip", target: `${P}Zip[0]` },
    { logical: "meta.today", target: `${P}Todays_Date[0]` },
    { logical: "fitting.date", target: `${P}Fitting_Date[0]` },
    { logical: "provider.name", target: `${P}Fitters_Name[0]` },
    { logical: "clinic.billTo", target: `${P}Customer_No_2[0]` },
    { logical: "patient.firstName", target: `${P}First_Name[0]` },
    { logical: "patient.lastName", target: `${P}Last_Name[0]` },
    { logical: "patient.age", target: `${P}Text2[0]` },
    { logical: "device.right.model", target: `${P}Model[0]` },
    { logical: "device.right.style", target: `${P}Style[0]` },
    { logical: "device.right.serial", target: `${P}Serial[0]` },
    { logical: "device.left.model", target: `${P}Model_2[0]` },
    { logical: "device.left.style", target: `${P}Style_2[0]` },
    { logical: "device.left.serial", target: `${P}Serial_2[0]` },
    { logical: "warranty.inWarranty", target: `${P}Radio_Button45[0]`, type: "radio", on: "Yes" },
    { logical: "notes", target: `${P}COMMENTs_1[0]` },
  ],
};
