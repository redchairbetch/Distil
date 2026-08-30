// Oticon RITE/Corda earmold order (H2-2017 legacy form) — flat PDF, overlay.
// Header + patient + instrument fill; mold grid rides earmold.summary.
export default {
  id: "oticon-rite-corda-earmold-order",
  manufacturer: "oticon",
  category: "earmold_order",
  title: "Oticon RITE/Corda Earmold Order (legacy)",
  pdf: "oticon/oticon-rite-corda-earmold-order.pdf",
  sha256: "22b381ce1a770dc3ef24161a3844265ce73fa7086fe0d4e4f119c88ba02b5709",
  mode: "overlay",
  fields: [
    { logical: "meta.today", page: 0, x: 372, y: 714, size: 8, maxWidth: 60 },
    { logical: "fitting.date", page: 0, x: 508, y: 714, size: 8, maxWidth: 60 },
    { logical: "clinic.phoneArea", page: 0, x: 76, y: 683, size: 7, maxWidth: 20 },
    { logical: "clinic.phoneLocal", page: 0, x: 98, y: 683, size: 7, maxWidth: 60 },
    { logical: "po", page: 0, x: 250, y: 683, size: 8, maxWidth: 55 },
    { logical: "clinic.name", page: 0, x: 105, y: 667, size: 8, maxWidth: 195 },
    { logical: "clinic.street", page: 0, x: 74, y: 652, size: 8, maxWidth: 225 },
    { logical: "clinic.city", page: 0, x: 56, y: 636, size: 8, maxWidth: 110 },
    { logical: "patient.firstName", page: 0, x: 368, y: 654, size: 8, maxWidth: 200 },
    { logical: "patient.lastName", page: 0, x: 366, y: 625, size: 8, maxWidth: 200 },
    { logical: "device.primary.model", page: 0, x: 66, y: 509, size: 8, maxWidth: 200 },
    { logical: "device.primary.serial", page: 0, x: 122, y: 493, size: 8, maxWidth: 150 },
    { logical: "earmold.summary", page: 0, x: 384, y: 66, size: 7, maxWidth: 200 },
  ],
};
