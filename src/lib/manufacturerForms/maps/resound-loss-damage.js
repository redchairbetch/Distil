// ReSound Loss & Damage — flat PDF with text layer, overlay.
export default {
  id: "resound-loss-damage",
  manufacturer: "resound",
  category: "loss_damage",
  title: "ReSound Loss & Damage",
  pdf: "resound/resound-loss-damage.pdf",
  sha256: "fe2127b5444ed273bc4ff9a5a5cba9f62ec83b16c44e1a4c098f2c8953ca7d5c",
  mode: "overlay",
  fields: [
    { logical: "clinic.name", page: 0, x: 78, y: 640, size: 8, maxWidth: 235 },
    { logical: "clinic.street", page: 0, x: 115, y: 620, size: 8, maxWidth: 195 },
    { logical: "clinic.cityStateZip", page: 0, x: 125, y: 584, size: 8, maxWidth: 185 },
    { logical: "po", page: 0, x: 100, y: 545, size: 8, maxWidth: 100 },
    { logical: "meta.today", page: 0, x: 60, y: 448, size: 8, maxWidth: 75 },
    { logical: "clinic.phone", page: 0, x: 205, y: 448, size: 8, maxWidth: 105 },
    { logical: "provider.name", page: 0, x: 95, y: 427, size: 8, maxWidth: 215 },
    { logical: "patient.lastName", page: 0, x: 65, y: 325, size: 9, maxWidth: 200 },
    { logical: "patient.firstName", page: 0, x: 65, y: 307, size: 9, maxWidth: 200 },
    { logical: "device.left.serial", page: 0, x: 110, y: 212, size: 8, maxWidth: 150 },
    { logical: "device.right.serial", page: 0, x: 110, y: 180, size: 8, maxWidth: 150 },
  ],
};
