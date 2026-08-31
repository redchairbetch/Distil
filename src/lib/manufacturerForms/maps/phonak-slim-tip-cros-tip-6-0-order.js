// Phonak SlimTip / CROS Tip 6.0 order — AcroForm (Infinio-and-newer
// receivers; Lumity/Paradise orders use their own form). Style ticks are
// per-ear; receiver gauge, vent style, locks and the Audéo device grid stay
// with the pen. AOV is the form's standard vent — its single box ticks when
// either ear selects it.
export default {
  id: "phonak-slim-tip-cros-tip-6-0-order",
  manufacturer: "phonak",
  category: "earmold_order",
  title: "Phonak SlimTip & CROS Tip 6.0 Order",
  pdf: "phonak/phonak-slim-tip-cros-tip-6-0-order.pdf",
  sha256: "5f92d5a547c4c70f636f5e19e4c18f425ee968f660035a3637516660b1445898",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: "1" },
    { logical: "clinic.street", target: "2" },
    { logical: "clinic.city", target: "3" },
    { logical: "clinic.state", target: "4" },
    { logical: "clinic.zip", target: "5" },
    { logical: "clinic.billTo", target: "6" },
    { logical: "fitting.date", target: "8" },
    { logical: "po", target: "9" },
    { logical: "provider.name", target: "10" },
    { logical: "clinic.phone", target: "11" },
    { logical: "patient.lastName", target: "13" },
    { logical: "patient.firstName", target: "14" },
    { logical: "patient.age", target: "15" },
    ...[250, 500, 1000, 2000, 3000, 4000].flatMap((f, i) => [
      { logical: `audiogram.left.${f}`, target: String(17 + i) },
      { logical: `audiogram.right.${f}`, target: String(23 + i) },
    ]),
    { logical: "earmold.left.style", type: "checkbox", target: "37", equalsAll: { "earmold.left.style": "slimtip-acrylic" } },
    { logical: "earmold.right.style", type: "checkbox", target: "40", equalsAll: { "earmold.right.style": "slimtip-acrylic" } },
    { logical: "earmold.left.style", type: "checkbox", target: "41", equalsAll: { "earmold.left.style": "slimtip-silicone" } },
    { logical: "earmold.right.style", type: "checkbox", target: "42", equalsAll: { "earmold.right.style": "slimtip-silicone" } },
    { logical: "earmold.left.style", type: "checkbox", target: "43", equalsAll: { "earmold.left.style": "slimtip-titanium" } },
    { logical: "earmold.right.style", type: "checkbox", target: "46", equalsAll: { "earmold.right.style": "slimtip-titanium" } },
    { logical: "earmold.left.style", type: "checkbox", target: "47", equalsAll: { "earmold.left.style": "cros-tip" } },
    { logical: "earmold.right.style", type: "checkbox", target: "52", equalsAll: { "earmold.right.style": "cros-tip" } },
    { logical: "earmold.left.vent", type: "checkbox", target: "65", equalsAll: { "earmold.left.vent": "aov" } },
    { logical: "earmold.right.vent", type: "checkbox", target: "65", equalsAll: { "earmold.right.vent": "aov" } },
    { logical: "earmold.summary", target: "114" },
  ],
};
