// Signia Loss/Damage Replacement Purchase — flat scan (no text layer),
// overlay coordinates estimated from the page image and verified with
// scripts/preview-form-fill.mjs. Page is 612x787. Hearing-threshold grid,
// receiver strength/length ticks, cause-of-loss and signatures stay with the
// pen (thresholds join the PR-3 audiogram namespace).
export default {
  id: "signia-loss-damage",
  manufacturer: "signia",
  category: "loss_damage",
  title: "Signia Loss/Damage Replacement",
  pdf: "signia/signia-loss-damage.pdf",
  sha256: "a5f827a748c07bf943fcbdf0182347653d4316ced209b029f1c4cf0ceb5a772f",
  mode: "overlay",
  fields: [
    // Warranty Holder (patient)
    { logical: "patient.name", page: 0, x: 75, y: 596, size: 9, maxWidth: 190 },
    { logical: "patient.address", page: 0, x: 315, y: 596, size: 8, maxWidth: 250 },
    // Hearing Care Professional (clinic)
    { logical: "provider.name", page: 0, x: 75, y: 500, size: 8, maxWidth: 190 },
    { logical: "clinic.street", page: 0, x: 315, y: 500, size: 8, maxWidth: 250 },
    { logical: "clinic.city", page: 0, x: 70, y: 479, size: 8, maxWidth: 150 },
    { logical: "clinic.state", page: 0, x: 305, y: 479, size: 8, maxWidth: 30 },
    { logical: "clinic.zip", page: 0, x: 358, y: 479, size: 8, maxWidth: 55 },
    { logical: "clinic.phone", page: 0, x: 452, y: 479, size: 8, maxWidth: 110 },
    { logical: "clinic.billTo", page: 0, x: 80, y: 458, size: 8, maxWidth: 150 },
    { logical: "po", page: 0, x: 305, y: 458, size: 8, maxWidth: 120 },
    // Hearing Instrument Information
    { logical: "device.primary.model", page: 0, x: 110, y: 402, size: 8, maxWidth: 150 },
    { logical: "device.serials", page: 0, x: 118, y: 381, size: 8, maxWidth: 145 },
    { logical: "device.primary.color", page: 0, x: 135, y: 360, size: 8, maxWidth: 125 },
  ],
};
