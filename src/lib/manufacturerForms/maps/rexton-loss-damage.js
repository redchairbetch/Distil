// Rexton Loss & Damage — flat PDF with text layer, overlay. The warranty
// holder is the patient; the office block carries the account. Signatures
// stay with the pen.
export default {
  id: "rexton-loss-damage",
  manufacturer: "rexton",
  category: "loss_damage",
  title: "Rexton Loss & Damage",
  pdf: "rexton/rexton-loss-damage.pdf",
  sha256: "6b9255953667930f308189ea5568504de2215f59b5e5e50d533b70175ce6fa99",
  mode: "overlay",
  fields: [
    { logical: "patient.name", page: 0, x: 65, y: 629, size: 9, maxWidth: 250 },
    { logical: "clinic.name", page: 0, x: 65, y: 540, size: 8, maxWidth: 300 },
    { logical: "clinic.billTo", page: 0, x: 445, y: 540, size: 8, maxWidth: 130 },
    { logical: "clinic.address", page: 0, x: 75, y: 511, size: 8, maxWidth: 320 },
    { logical: "clinic.city", page: 0, x: 55, y: 481, size: 8, maxWidth: 150 },
    { logical: "clinic.phone", page: 0, x: 430, y: 481, size: 8, maxWidth: 140 },
    { logical: "device.primary.model", page: 0, x: 75, y: 395, size: 8, maxWidth: 220 },
    { logical: "device.left.serial", page: 0, x: 418, y: 395, size: 8, maxWidth: 65 },
    { logical: "device.right.serial", page: 0, x: 520, y: 395, size: 8, maxWidth: 65 },
  ],
};
