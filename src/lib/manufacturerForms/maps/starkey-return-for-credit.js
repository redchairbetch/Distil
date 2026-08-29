// Starkey Return for Credit — flat PDF, overlay. Return-reason area is
// per-incident and left to the pen.
export default {
  id: "starkey-return-for-credit",
  manufacturer: "starkey",
  category: "return_credit",
  title: "Starkey Return for Credit",
  pdf: "starkey/starkey-return-for-credit.pdf",
  sha256: "4d48d83e5a116958933b45a2af9aea8f051f3e24ac218636565a4f21a9cbc04c",
  mode: "overlay",
  fields: [
    { logical: "clinic.billTo", page: 0, x: 252, y: 706, size: 8, maxWidth: 70 },
    { logical: "clinic.shipTo", page: 0, x: 552, y: 706, size: 7, maxWidth: 56 },
    { logical: "clinic.address", page: 0, x: 58, y: 687, size: 8, maxWidth: 245 },
    { logical: "clinic.address", page: 0, x: 365, y: 687, size: 8, maxWidth: 240 },
    { logical: "meta.today", page: 0, x: 502, y: 619, size: 8, maxWidth: 70 },
    { logical: "patient.name", page: 0, x: 85, y: 532, size: 8, maxWidth: 200 },
    { logical: "device.left.serial", page: 0, x: 85, y: 509, size: 8, maxWidth: 130 },
    { logical: "device.right.serial", page: 0, x: 300, y: 509, size: 8, maxWidth: 130 },
    { logical: "notes", page: 0, x: 25, y: 405, size: 8, maxWidth: 550 },
  ],
};
