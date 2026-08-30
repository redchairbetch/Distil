// ReSound BTE custom earmold order (MK604743) — flat PDF, overlay. Header +
// patient fill; mold configuration prints in Special Instructions via
// earmold.summary (tick columns and the audiogram grid stay with the pen).
export default {
  id: "resound-bte-custom-earmold-order",
  manufacturer: "resound",
  category: "earmold_order",
  title: "ReSound BTE Custom Earmold Order",
  pdf: "resound/resound-bte-custom-earmold-order.pdf",
  sha256: "04f69764d3ab51be0cfd86692a3b116691fbe7f1520dc79cad9270cd47dc7abf",
  mode: "overlay",
  fields: [
    { logical: "clinic.shipTo", page: 0, x: 70, y: 697, size: 8, maxWidth: 145 },
    { logical: "meta.today", page: 0, x: 248, y: 697, size: 8, maxWidth: 48 },
    { logical: "clinic.name", page: 0, x: 62, y: 682, size: 8, maxWidth: 230 },
    { logical: "clinic.street", page: 0, x: 62, y: 668, size: 8, maxWidth: 230 },
    { logical: "clinic.city", page: 0, x: 53, y: 653, size: 8, maxWidth: 85 },
    { logical: "clinic.state", page: 0, x: 168, y: 653, size: 8, maxWidth: 30 },
    { logical: "clinic.zip", page: 0, x: 218, y: 653, size: 8, maxWidth: 60 },
    { logical: "clinic.billTo", page: 0, x: 62, y: 638, size: 8, maxWidth: 230 },
    { logical: "po", page: 0, x: 50, y: 624, size: 8, maxWidth: 200 },
    { logical: "patient.lastName", page: 0, x: 62, y: 558, size: 8, maxWidth: 225 },
    { logical: "patient.firstName", page: 0, x: 62, y: 543, size: 8, maxWidth: 225 },
    { logical: "earmold.summary", page: 0, x: 319, y: 152, size: 7, maxWidth: 262 },
  ],
};
