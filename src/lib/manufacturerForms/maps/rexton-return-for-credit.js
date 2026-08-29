// Rexton Return for Credit — flat scan (no text layer), overlay coordinates
// estimated from the page image and verified with scripts/preview-form-fill.mjs.
// Reason-for-return checkboxes stay with the pen.
export default {
  id: "rexton-return-for-credit",
  manufacturer: "rexton",
  category: "return_credit",
  title: "Rexton Return for Credit",
  pdf: "rexton/rexton-return-for-credit.pdf",
  sha256: "4f17bab4949eaa528b461a3cf44beea534d864dc87f8c596598abbb73fd5e3c4",
  mode: "overlay",
  fields: [
    { logical: "provider.name", page: 0, x: 90, y: 678, size: 8, maxWidth: 180 },
    { logical: "clinic.phone", page: 0, x: 350, y: 678, size: 8, maxWidth: 105 },
    { logical: "meta.today", page: 0, x: 505, y: 678, size: 8, maxWidth: 70 },
    { logical: "clinic.billTo", page: 0, x: 200, y: 651, size: 8, maxWidth: 105 },
    { logical: "clinic.shipTo", page: 0, x: 500, y: 651, size: 8, maxWidth: 85 },
    { logical: "patient.name", page: 0, x: 160, y: 550, size: 8, maxWidth: 150 },
    { logical: "fitting.date", page: 0, x: 160, y: 535, size: 8, maxWidth: 100 },
    { logical: "device.left.serial", page: 0, x: 150, y: 518, size: 8, maxWidth: 65 },
    { logical: "device.left.model", page: 0, x: 255, y: 518, size: 8, maxWidth: 55 },
    { logical: "device.right.serial", page: 0, x: 150, y: 501, size: 8, maxWidth: 65 },
    { logical: "device.right.model", page: 0, x: 255, y: 501, size: 8, maxWidth: 55 },
    { logical: "notes", page: 0, x: 335, y: 540, size: 8, maxWidth: 245 },
  ],
};
