// Widex Moment RIC & BTE order (DFM01M) — AcroForm. Header, patient,
// audiogram (250-4k, 500 required), and the RITE-earmold HA serials fill;
// the Step-8 custom-ear-tip grids use ~337 generically-named checkboxes and
// ride the pen + earmold.summary (Special Instructions) for v1. Device,
// tech-level, color and accessory steps are per-sale and unmapped.
export default {
  id: "widex-moment-ric-bte-order",
  manufacturer: "widex",
  category: "earmold_order",
  title: "Widex Moment RIC & BTE Order",
  pdf: "widex/widex-moment-ric-bte-order.pdf",
  sha256: "c14f5ae490cd99f0bf8d17a36238a18c6fb051e0c069a020774687005e157bd0",
  mode: "acroform",
  fields: [
    { logical: "clinic.billTo", target: "Text Field 2" },
    { logical: "clinic.shipTo", target: "Text Field 3" },
    { logical: "clinic.address", target: "Text Field 4" },
    { logical: "po", target: "Text Field 5" },
    { logical: "clinic.city", target: "Text Field 6" },
    { logical: "clinic.state", target: "Text Field 7" },
    { logical: "clinic.zip", target: "Text Field 8" },
    { logical: "provider.name", target: "Text Field 9" },
    { logical: "clinic.phone", target: "Text Field 10" },
    { logical: "fitting.date", target: "Text Field 12" },
    { logical: "patient.firstName", target: "Text Field 13" },
    { logical: "patient.lastName", target: "Text Field 14" },
    { logical: "device.right.serial", target: "Text Field 33" },
    { logical: "device.left.serial", target: "Text Field 34" },
    ...[250, 500, 1000, 2000, 3000, 4000].flatMap((f, i) => [
      { logical: `audiogram.right.${f}`, target: `Text Field ${21 + i}` },
      { logical: `audiogram.left.${f}`, target: `Text Field ${27 + i}` },
    ]),
    { logical: "earmold.summary", target: "Text Field 71" },
  ],
};
