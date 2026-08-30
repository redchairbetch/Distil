// Unitron Vivante Stride BTE + earmold order — AcroForm. The shell-style,
// material and color grids use multi-widget shared-name fields ("Shell style
// L") that behave like radios pdf-lib can't target per-widget — those ride
// the earmold.summary in Step 6 and the pen. Vents have unique names and
// tick per ear.
const EARS = [["left", "L"], ["right", "R"]];

const VENT_BOXES = {
  "intellivent": { L: "Check Box 77", R: "Check Box 78" },
  "vari-pressure": { L: "Check Box 79", R: "Check Box 80" },
  "vari-small": { L: "Check Box 81", R: "Check Box 82" },
  "vari-medium": { L: "Check Box 83", R: "Check Box 84" },
  "vari-large": { L: "Check Box 85", R: "Check Box 86" },
  "parallel": { L: "Check Box 87", R: "Check Box 88" },
  "styled-custom": { L: "Check Box 110", R: "Check Box 111" },
  "iros-a": { L: "Check Box 89", R: "Check Box 90" },
  "iros-b": { L: "Check Box 112", R: "Check Box 113" },
  "none": { L: "Check Box 114", R: "Check Box 115" },
};

export default {
  id: "unitron-vivante-stride-bte-order",
  manufacturer: "unitron",
  category: "earmold_order",
  title: "Unitron Vivante Stride BTE & Earmold Order",
  pdf: "unitron/unitron-vivante-stride-bte-order.pdf",
  sha256: "05cc9c271ab8e18ddfce0a2c2bc603be44e1ba6122416ed7be12ef5c42526e60",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: "Text Field 2" },
    { logical: "clinic.name", target: "Text Field 3" },
    { logical: "clinic.street", target: "Text Field 4" },
    { logical: "clinic.city", target: "Text Field 5" },
    { logical: "clinic.state", target: "Text Field 6" },
    { logical: "clinic.zip", target: "Text Field 7" },
    { logical: "po", target: "Text Field 9" },
    { logical: "meta.today", target: "Text Field 11" },
    { logical: "provider.name", target: "Text Field 12" },
    { logical: "patient.firstName", target: "Text Field 14" },
    { logical: "patient.lastName", target: "Text Field 15" },
    ...[250, 500, 1000, 2000, 3000, 4000].flatMap((f, i) => [
      { logical: `audiogram.left.${f}`, target: `Text Field ${16 + i}` },
      { logical: `audiogram.right.${f}`, target: `Text Field ${22 + i}` },
    ]),
    { logical: "earmold.summary", target: "Text Field 28" },
    ...Object.entries(VENT_BOXES).flatMap(([id, boxes]) =>
      EARS.map(([ear, E]) => ({
        logical: `earmold.${ear}.vent`, type: "checkbox", target: boxes[E],
        equalsAll: { [`earmold.${ear}.vent`]: id },
      }))
    ),
  ],
};
