// Oticon Loss & Damage (Replacement Claim) — flat XFA remnant, overlay.
// Layout mirrors the fillable Oticon RFC. Signatures and threshold grids are
// left to the pen.
export default {
  id: "oticon-loss-damage",
  manufacturer: "oticon",
  category: "loss_damage",
  title: "Oticon Loss & Damage Replacement Claim",
  pdf: "oticon/oticon-loss-damage.pdf",
  sha256: "fc9dee02cf834e94b3b5d745e667b99a0b37b8d602be69d98dbf61cb7bdb9248",
  mode: "overlay",
  fields: [
    { logical: "clinic.shipTo", page: 0, x: 135, y: 708, size: 8, maxWidth: 130 },
    { logical: "clinic.phoneArea", page: 0, x: 78, y: 677, size: 7, maxWidth: 18 },
    { logical: "clinic.phoneLocal", page: 0, x: 98, y: 677, size: 7, maxWidth: 55 },
    { logical: "po", page: 0, x: 245, y: 677, size: 7, maxWidth: 55 },
    { logical: "provider.name", page: 0, x: 383, y: 710, size: 8, maxWidth: 195 },
    { logical: "clinic.name", page: 0, x: 105, y: 661, size: 8, maxWidth: 190 },
    { logical: "clinic.street", page: 0, x: 75, y: 645, size: 8, maxWidth: 220 },
    { logical: "clinic.city", page: 0, x: 58, y: 628, size: 8, maxWidth: 110 },
    { logical: "clinic.state", page: 0, x: 205, y: 628, size: 8, maxWidth: 35 },
    { logical: "clinic.zip", page: 0, x: 263, y: 628, size: 8, maxWidth: 45 },
    { logical: "clinic.billTo", page: 0, x: 118, y: 583, size: 8, maxWidth: 130 },
    { logical: "patient.firstName", page: 0, x: 370, y: 660, size: 9, maxWidth: 180 },
    { logical: "patient.lastName", page: 0, x: 370, y: 631, size: 9, maxWidth: 200 },
    { logical: "device.primary.model", page: 0, x: 78, y: 530, size: 8, maxWidth: 240 },
    { logical: "device.right.serial", page: 0, x: 112, y: 512, size: 8, maxWidth: 200 },
    { logical: "device.left.serial", page: 0, x: 112, y: 494, size: 8, maxWidth: 200 },
    { logical: "meta.today", page: 0, x: 95, y: 96, size: 8, maxWidth: 60 },
    { logical: "notes", page: 0, x: 55, y: 170, size: 8, maxWidth: 520 },
  ],
};
