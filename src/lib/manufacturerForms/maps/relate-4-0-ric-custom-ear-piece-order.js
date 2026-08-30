// Relate 4.0 RIC + Custom Ear Piece order — AcroForm, generic names mapped by
// position. The shell-style grid crosses style × receiver gauge (S/M/P/UP);
// the chart doesn't store a Relate gauge, so ticks land in the form's
// M (standard) column — verify gauge on the prefill panel / printed page.
// Receiver length 0-3 ticks from the side's stored receiverLength.
const EARS = [["left", "L"], ["right", "R"]];

// style → M-column (standard gauge) boxes.
const STYLE_M_BOXES = {
  "slimtip-hollow": { L: "Check Box 96", R: "Check Box 97" },
  "slimtip-solid": { L: "Check Box 102", R: "Check Box 104" },
  "cshell": { L: "Check Box 108", R: "Check Box 1010" },
};
const LENGTH_BOXES = {
  "0": { L: "Check Box 1014", R: "Check Box 1015" },
  "1": { L: "Check Box 1016", R: "Check Box 1017" },
  "2": { L: "Check Box 1018", R: "Check Box 1019" },
  "3": { L: "Check Box 1020", R: "Check Box 1021" },
};
const VENT_BOXES = {
  "aov": { L: "Check Box 1039", R: "Check Box 1040" },
  "vari-pressure": { L: "Check Box 1041", R: "Check Box 1042" },
  "vari-small": { L: "Check Box 1043", R: "Check Box 1044" },
  "vari-medium": { L: "Check Box 1045", R: "Check Box 1046" },
  "vari-large": { L: "Check Box 1047", R: "Check Box 1048" },
  "parallel": { L: "Check Box 1049", R: "Check Box 1050" },
  "styled-custom": { L: "Check Box 1051", R: "Check Box 1052" },
  "iros-a": { L: "Check Box 1073", R: "Check Box 1076" },
  "iros-b": { L: "Check Box 1075", R: "Check Box 1077" },
  "none": { L: "Check Box 1078", R: "Check Box 1080" },
};
// Global shell-color boxes (left column of the color list).
const COLOR_BOXES = {
  "pink-26": "Check Box 1024",
  "tan-14": "Check Box 1025",
  "cocoa-22": "Check Box 1026",
  "brown-28": "Check Box 1028",
  "clear-21": "Check Box 1029",
  "blue-red": "Check Box 1030",
  "trans-pink": "Check Box 1031",
  "trans-brown": "Check Box 1032",
};

function grid() {
  const out = [];
  for (const [id, boxes] of Object.entries(STYLE_M_BOXES)) {
    for (const [ear, E] of EARS) {
      out.push({ logical: `earmold.${ear}.style`, type: "checkbox", target: boxes[E],
        equalsAll: { [`earmold.${ear}.style`]: id } });
    }
  }
  for (const [len, boxes] of Object.entries(LENGTH_BOXES)) {
    for (const [ear, E] of EARS) {
      out.push({ logical: `device.${ear}.receiverLength`, type: "checkbox", target: boxes[E],
        equalsAll: { [`device.${ear}.receiverLength`]: len } });
    }
  }
  for (const [id, boxes] of Object.entries(VENT_BOXES)) {
    for (const [ear, E] of EARS) {
      out.push({ logical: `earmold.${ear}.vent`, type: "checkbox", target: boxes[E],
        equalsAll: { [`earmold.${ear}.vent`]: id } });
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
  id: "relate-4-0-ric-custom-ear-piece-order",
  manufacturer: "relate",
  category: "earmold_order",
  title: "Relate 4.0 RIC & Custom Ear Piece Order",
  pdf: "relate/relate-4-0-ric-custom-ear-piece-order.pdf",
  sha256: "85b605ffca500c16379dd09ef5130e3d48deaf3a650296da2e696f827a675fd7",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: "Text Field 1" },
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
    { logical: "audiogram.left.250", target: "Text Field 16" },
    { logical: "audiogram.left.500", target: "Text Field 17" },
    { logical: "audiogram.left.1000", target: "Text Field 18" },
    { logical: "audiogram.left.2000", target: "Text Field 19" },
    { logical: "audiogram.left.3000", target: "Text Field 20" },
    { logical: "audiogram.left.4000", target: "Text Field 21" },
    { logical: "audiogram.right.250", target: "Text Field 22" },
    { logical: "audiogram.right.500", target: "Text Field 23" },
    { logical: "audiogram.right.1000", target: "Text Field 24" },
    { logical: "audiogram.right.2000", target: "Text Field 25" },
    { logical: "audiogram.right.3000", target: "Text Field 26" },
    { logical: "audiogram.right.4000", target: "Text Field 27" },
    { logical: "earmold.summary", target: "Text Field 28" },
    ...grid(),
  ],
};
