// Unitron Vivante Moxi RIC + custom ear piece order — AcroForm (Relate 4.0
// RIC's platform sibling). Style grid crosses style × receiver gauge; ticks
// land per the actual gauge columns (S/M/P/UP) keyed off... the chart stores
// no Unitron gauge, so style ticks land in the M (standard) column — verify
// gauge on the prefill panel. Receiver-length ticks use the side's stored
// receiverLength. Wax/finish/shell-option ticks stay with the pen.
const EARS = [["left", "L"], ["right", "R"]];

const STYLE_M_BOXES = {
  "slimtip-hollow": { L: "Check Box 36", R: "Check Box 37" },
  "slimtip-solid": { L: "Check Box 41", R: "Check Box 44" },
  "cshell": { L: "Check Box 47", R: "Check Box 50" },
};
const LENGTH_BOXES = {
  "0": { L: "Check Box 54", R: "Check Box 55" },
  "1": { L: "Check Box 56", R: "Check Box 57" },
  "2": { L: "Check Box 58", R: "Check Box 59" },
  "3": { L: "Check Box 60", R: "Check Box 61" },
};
const VENT_BOXES = {
  "intellivent": { L: "Check Box 77", R: "Check Box 78" },
  "vari-pressure": { L: "Check Box 79", R: "Check Box 80" },
  "vari-small": { L: "Check Box 81", R: "Check Box 82" },
  "vari-medium": { L: "Check Box 83", R: "Check Box 84" },
  "vari-large": { L: "Check Box 85", R: "Check Box 86" },
  "custom-3l": { L: "Check Box 87", R: "Check Box 88" },
  "none": { L: "Check Box 89", R: "Check Box 90" },
};
const COLOR_BOXES = {
  "pink-26-": "Check Box 64",
  "tan-14-": "Check Box 65",
  "cocoa-22-": "Check Box 66",
  "brown-28-": "Check Box 67",
  "clear-21-default-slimtip": "Check Box 68",
  "blue-red": "Check Box 69",
  "translucent-pink-t-": "Check Box 70",
  "translucent-brown-n-": "Check Box 71",
};

function grid() {
  const out = [];
  for (const [table, key] of [[STYLE_M_BOXES, "style"], [VENT_BOXES, "vent"]]) {
    for (const [id, boxes] of Object.entries(table)) {
      for (const [ear, E] of EARS) {
        out.push({ logical: `earmold.${ear}.${key}`, type: "checkbox", target: boxes[E],
          equalsAll: { [`earmold.${ear}.${key}`]: id } });
      }
    }
  }
  for (const [len, boxes] of Object.entries(LENGTH_BOXES)) {
    for (const [ear, E] of EARS) {
      out.push({ logical: `device.${ear}.receiverLength`, type: "checkbox", target: boxes[E],
        equalsAll: { [`device.${ear}.receiverLength`]: len } });
    }
  }
  for (const [id, target] of Object.entries(COLOR_BOXES)) {
    for (const [ear] of EARS) {
      out.push({ logical: `earmold.${ear}.color`, type: "checkbox", target,
        equalsAll: { [`earmold.${ear}.color`]: id } });
    }
  }
  return out;
}

export default {
  id: "unitron-vivante-moxi-ric-order",
  manufacturer: "unitron",
  category: "earmold_order",
  title: "Unitron Vivante Moxi RIC & Custom Ear Piece Order",
  pdf: "unitron/unitron-vivante-moxi-ric-order.pdf",
  sha256: "44ff3f31c71b3cf7b06fd4cb72988aa9392aa776500b3c0e39b8668db6f998a7",
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
    ...grid(),
  ],
};
