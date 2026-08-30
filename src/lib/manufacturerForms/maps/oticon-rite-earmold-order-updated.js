// Oticon RITE earmold order ("updated form", More MiniRITE) — flat PDF,
// overlay. Header + patient + instrument fill; mold grid rides
// earmold.summary in Special Instructions.
export default {
  id: "oticon-rite-earmold-order-updated",
  manufacturer: "oticon",
  category: "earmold_order",
  title: "Oticon RITE Earmold Order (More miniRITE)",
  pdf: "oticon/oticon-rite-earmold-order-updated.pdf",
  sha256: "38166417f24f4c81344f037dc6b5ae8b381c3be2e4168ae83e708db1d3d2900f",
  mode: "overlay",
  fields: [
    { logical: "clinic.shipTo", page: 0, x: 118, y: 706, size: 8, maxWidth: 175 },
    { logical: "clinic.name", page: 0, x: 102, y: 690, size: 8, maxWidth: 190 },
    { logical: "clinic.street", page: 0, x: 78, y: 675, size: 8, maxWidth: 215 },
    { logical: "clinic.city", page: 0, x: 60, y: 639, size: 8, maxWidth: 95 },
    { logical: "clinic.state", page: 0, x: 188, y: 639, size: 8, maxWidth: 30 },
    { logical: "clinic.zip", page: 0, x: 242, y: 639, size: 8, maxWidth: 55 },
    { logical: "clinic.phone", page: 0, x: 78, y: 623, size: 8, maxWidth: 130 },
    { logical: "clinic.billTo", page: 0, x: 112, y: 572, size: 8, maxWidth: 180 },
    { logical: "fitting.date", page: 0, x: 245, y: 556, size: 8, maxWidth: 55 },
    { logical: "po", page: 0, x: 112, y: 540, size: 8, maxWidth: 130 },
    { logical: "patient.firstName", page: 0, x: 358, y: 706, size: 8, maxWidth: 180 },
    { logical: "patient.lastName", page: 0, x: 356, y: 690, size: 8, maxWidth: 180 },
    { logical: "device.primary.model", page: 0, x: 72, y: 490, size: 8, maxWidth: 180 },
    { logical: "device.primary.serial", page: 0, x: 128, y: 477, size: 8, maxWidth: 130 },
    { logical: "earmold.summary", page: 0, x: 350, y: 74, size: 7, maxWidth: 230 },
  ],
};
