// Unitron combined Repair + L&D + Return-for-Credit — AcroForm with semantic
// names. Several fields span both pages as multi-widget fields (same name on
// p0 and p1), so one fill lands on both. The Type-of-Service / receiver /
// rechargeable checkbox groups are multi-widget with shared names — export
// values are unreliable, per-incident anyway, so unmapped. Notes maps to both
// pages' comment areas (Text48 = repair page, Notes = return page); only the
// page in use ships.
export default {
  id: "unitron-repair-ld-rfc",
  manufacturer: "unitron",
  category: "repair",
  title: "Unitron Repair / L&D / Return for Credit",
  pdf: "unitron/unitron-repair-ld-rfc.pdf",
  sha256: "ae73da360570160190879cb40a52406d38176f3431e4a0aabd319f72e7715215",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: "Ship to account number" },
    { logical: "clinic.name", target: "Account name" },
    { logical: "clinic.street", target: "Address" },
    { logical: "clinic.city", target: "City" },
    { logical: "clinic.state", target: "State" },
    { logical: "clinic.zip", target: "Zip code" },
    { logical: "po", target: "Purchase Order Number" },
    { logical: "provider.name", target: "Contact Name" },
    { logical: "provider.name", target: "Contact name" },
    { logical: "meta.today", target: "Date" },
    { logical: "clinic.phone", target: "Phone" },
    { logical: "patient.firstName", target: "First" },
    { logical: "patient.lastName", target: "Last" },
    { logical: "device.primary.model", target: "Model" },
    { logical: "device.primary.serial", target: "Serial number 1" },
    { logical: "device.primary.serial", target: "Serial number" },
    { logical: "notes", target: "Text48" },
    { logical: "notes", target: "Notes" },
  ],
};
