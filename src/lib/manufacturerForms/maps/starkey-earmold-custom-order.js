// Starkey earmold custom order (specialty molds/earplugs) — flat PDF,
// overlay. Header + patient fill; the specialty product grid stays with the
// pen, mold summary in Special Instructions.
export default {
  id: "starkey-earmold-custom-order",
  manufacturer: "starkey",
  category: "custom_order",
  title: "Starkey Earmold Custom Order (specialty)",
  pdf: "starkey/starkey-earmold-custom-order.pdf",
  sha256: "9e90d9aeb5831a099d368dc60f4fd54d37924cdb8bab078c14b6e7291aef3f13",
  mode: "overlay",
  fields: [
    { logical: "clinic.billTo", page: 0, x: 250, y: 707, size: 8, maxWidth: 70 },
    { logical: "clinic.shipTo", page: 0, x: 552, y: 707, size: 7, maxWidth: 56 },
    { logical: "provider.name", page: 0, x: 55, y: 656, size: 8, maxWidth: 115 },
    { logical: "provider.name", page: 0, x: 365, y: 641, size: 8, maxWidth: 110 },
    { logical: "po", page: 0, x: 50, y: 626, size: 8, maxWidth: 100 },
    { logical: "meta.today", page: 0, x: 200, y: 626, size: 8, maxWidth: 60 },
    { logical: "patient.firstName", page: 0, x: 17, y: 538, size: 9, maxWidth: 170 },
    { logical: "patient.lastName", page: 0, x: 196, y: 538, size: 9, maxWidth: 170 },
    { logical: "earmold.summary", page: 0, x: 25, y: 124, size: 7, maxWidth: 550 },
  ],
};
