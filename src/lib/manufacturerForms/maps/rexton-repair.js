// Rexton Repair — flat scan on a landscape page with the form content
// rotated 90° (viewRotation): coordinates are authored in the upright
// portrait view (595 x 842) and the engine transforms + rotates the text.
// Estimated from the page image; verified with scripts/preview-form-fill.mjs.
// Reason-for-service grid and warranty ticks stay with the pen.
export default {
  id: "rexton-repair",
  manufacturer: "rexton",
  category: "repair",
  title: "Rexton Repair Form",
  pdf: "rexton/rexton-repair.pdf",
  sha256: "a6d0be9a6f0ab7fbd3377d076cb2d1d2a07a44524ee750ac489a71e5d7d9fec1",
  mode: "overlay",
  viewRotation: 90,
  fields: [
    { logical: "clinic.billTo", page: 0, x: 100, y: 700, size: 8, maxWidth: 95 },
    { logical: "clinic.billTo", page: 0, x: 95, y: 650, size: 8, maxWidth: 95 },
    { logical: "meta.today", page: 0, x: 260, y: 700, size: 8, maxWidth: 50 },
    { logical: "clinic.shipTo", page: 0, x: 210, y: 650, size: 8, maxWidth: 85 },
    { logical: "po", page: 0, x: 85, y: 600, size: 8, maxWidth: 100 },
    { logical: "provider.name", page: 0, x: 95, y: 550, size: 8, maxWidth: 145 },
    { logical: "clinic.phone", page: 0, x: 185, y: 600, size: 8, maxWidth: 105 },
    { logical: "patient.lastName", page: 0, x: 398, y: 700, size: 8, maxWidth: 48 },
    { logical: "patient.firstName", page: 0, x: 500, y: 700, size: 8, maxWidth: 60 },
    { logical: "device.left.serial", page: 0, x: 415, y: 650, size: 8, maxWidth: 120 },
    { logical: "device.right.serial", page: 0, x: 415, y: 600, size: 8, maxWidth: 120 },
    { logical: "warranty.inWarranty", page: 0, x: 294, y: 499, size: 9 },
  ],
};
