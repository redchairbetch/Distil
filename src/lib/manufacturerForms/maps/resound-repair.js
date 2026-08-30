// ReSound Repair — flat PDF with text layer, overlay. Warranty checkbox
// ("Instrument still under warranty") maps from chart warranty state; the
// symptom checklist stays with the pen.
export default {
  id: "resound-repair",
  manufacturer: "resound",
  category: "repair",
  title: "ReSound Repair Form",
  pdf: "resound/resound-repair.pdf",
  sha256: "868c95968b45929d3528987dbe7a1811fe44d57c13714de877f043af15742d2b",
  mode: "overlay",
  fields: [
    { logical: "clinic.shipTo", page: 0, x: 250, y: 668, size: 8, maxWidth: 170 },
    { logical: "clinic.name", page: 0, x: 70, y: 643, size: 8, maxWidth: 205 },
    { logical: "clinic.street", page: 0, x: 70, y: 621, size: 8, maxWidth: 200 },
    { logical: "clinic.cityStateZip", page: 0, x: 78, y: 579, size: 8, maxWidth: 195 },
    { logical: "po", page: 0, x: 58, y: 537, size: 8, maxWidth: 100 },
    { logical: "meta.today", page: 0, x: 65, y: 468, size: 8, maxWidth: 70 },
    { logical: "clinic.phone", page: 0, x: 210, y: 468, size: 8, maxWidth: 65 },
    { logical: "provider.name", page: 0, x: 100, y: 447, size: 8, maxWidth: 170 },
    { logical: "patient.lastName", page: 0, x: 75, y: 375, size: 9, maxWidth: 180 },
    { logical: "patient.firstName", page: 0, x: 75, y: 357, size: 9, maxWidth: 180 },
    { logical: "device.left.serial", page: 0, x: 362, y: 726, size: 8, maxWidth: 108 },
    { logical: "device.left.model", page: 0, x: 512, y: 726, size: 8, maxWidth: 76 },
    { logical: "device.right.serial", page: 0, x: 362, y: 706, size: 8, maxWidth: 108 },
    { logical: "device.right.model", page: 0, x: 512, y: 706, size: 8, maxWidth: 76 },
    { logical: "warranty.inWarranty", page: 0, x: 41, y: 230, size: 9 },
    { logical: "notes", page: 0, x: 39, y: 97, size: 8, maxWidth: 250 },
  ],
};
