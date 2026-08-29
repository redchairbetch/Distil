// Starkey Loss & Damage — flat PDF, overlay. Account block is Bill-to /
// Ship-to value columns beside row labels; the attestation block (client name,
// street, city) is the patient's. Loss date, signatures and replacement
// section are per-incident and left to the pen.
export default {
  id: "starkey-loss-damage",
  manufacturer: "starkey",
  category: "loss_damage",
  title: "Starkey Loss & Damage Affidavit",
  pdf: "starkey/starkey-loss-damage.pdf",
  sha256: "689ba88384b138f020a6d7c5efcf78e5aa5871e51c9b0440a184377ed5f9a22c",
  mode: "overlay",
  fields: [
    { logical: "clinic.billTo", page: 0, x: 178, y: 625, size: 8, maxWidth: 120 },
    { logical: "clinic.shipTo", page: 0, x: 348, y: 625, size: 8, maxWidth: 120 },
    { logical: "device.serials", page: 0, x: 125, y: 598, size: 8, maxWidth: 300 },
    { logical: "clinic.address", page: 0, x: 125, y: 571, size: 8, maxWidth: 350 },
    { logical: "patient.name", page: 0, x: 39, y: 295, size: 9, maxWidth: 250 },
    { logical: "patient.address", page: 0, x: 39, y: 242, size: 8, maxWidth: 350 },
  ],
};
