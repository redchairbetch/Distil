// Relate 4.0 BTE + Earmold order (UHCH private label) — AcroForm, generic
// "Check Box N" names mapped by widget position. Grid ticks route via
// equalsAll on the side's stored earmold state; each row has an L box and an
// R box. The Step-3 new-instrument rows, wax/finish singles and wireless
// accessories are per-incident/pen; earmold.summary lands in Step 6.
const EARS = [["left", "L"], ["right", "R"]];

const STYLE_BOXES = {
  "full-shell-carved": { L: "Check Box 11", R: "Check Box 12" },
  "full-shell-uncarved": { L: "Check Box 13", R: "Check Box 14" },
  "skeleton": { L: "Check Box 15", R: "Check Box 16" },
  "semi-skeleton": { L: "Check Box 17", R: "Check Box 18" },
  "carved-half-shell": { L: "Check Box 19", R: "Check Box 20" },
  "canal-lock": { L: "Check Box 23", R: "Check Box 24" },
  "canal": { L: "Check Box 25", R: "Check Box 26" },
  "cros": { L: "Check Box 27", R: "Check Box 28" },
  "helix-lock": { L: "Check Box 29", R: "Check Box 30" },
  "bte-slimtip-hollow": { L: "Check Box 103", R: "Check Box 105" },
  "bte-slimtip-solid": { L: "Check Box 104", R: "Check Box 106" },
};
const MATERIAL_BOXES = {
  "acrylic": { L: "Check Box 31", R: "Check Box 32" },
  "silicone-s70": { L: "Check Box 33", R: "Check Box 34" },
};
const VENT_BOXES = {
  "aov": { L: "Check Box 40", R: "Check Box 42" },
  "vari-pressure": { L: "Check Box 41", R: "Check Box 43" },
  "vari-small": { L: "Check Box 44", R: "Check Box 45" },
  "vari-medium": { L: "Check Box 46", R: "Check Box 47" },
  "vari-large": { L: "Check Box 48", R: "Check Box 49" },
  "parallel": { L: "Check Box 50", R: "Check Box 51" },
  "styled-custom": { L: "Check Box 52", R: "Check Box 53" },
  "iros-a": { L: "Check Box 95", R: "Check Box 97" },
  "iros-b": { L: "Check Box 96", R: "Check Box 98" },
  "none": { L: "Check Box 99", R: "Check Box 101" },
};
// Global (not per-ear) shell-color boxes.
const COLOR_BOXES = {
  "clear-21-standard": "Check Box 35",
  "translucent-pink-t-": "Check Box 36",
  "translucent-brown-n-": "Check Box 37",
};

function grid() {
  const out = [];
  for (const [table, key] of [[STYLE_BOXES, "style"], [MATERIAL_BOXES, "material"], [VENT_BOXES, "vent"]]) {
    for (const [id, boxes] of Object.entries(table)) {
      for (const [ear, E] of EARS) {
        out.push({ logical: `earmold.${ear}.${key}`, type: "checkbox", target: boxes[E],
          equalsAll: { [`earmold.${ear}.${key}`]: id } });
      }
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
  id: "relate-4-0-bte-earmold-order",
  manufacturer: "relate",
  category: "earmold_order",
  title: "Relate 4.0 BTE & Earmold Order",
  pdf: "relate/relate-4-0-bte-earmold-order.pdf",
  sha256: "d33bd342a0a5643fa74d61497fc03b27086a24a90d3568070068346fc504468f",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: "Text Field 29" },
    { logical: "clinic.name", target: "Text Field 31" },
    { logical: "clinic.street", target: "Text Field 32" },
    { logical: "clinic.city", target: "Text Field 33" },
    { logical: "clinic.state", target: "Text Field 34" },
    { logical: "clinic.zip", target: "Text Field 35" },
    { logical: "po", target: "Text Field 37" },
    { logical: "meta.today", target: "Text Field 39" },
    { logical: "provider.name", target: "Text Field 40" },
    { logical: "patient.firstName", target: "Text Field 42" },
    { logical: "patient.lastName", target: "Text Field 43" },
    // Audiogram grid: Left row above Right row, 250-4000 Hz
    { logical: "audiogram.left.250", target: "Text Field 44" },
    { logical: "audiogram.right.250", target: "Text Field 45" },
    { logical: "audiogram.left.500", target: "Text Field 46" },
    { logical: "audiogram.right.500", target: "Text Field 47" },
    { logical: "audiogram.left.1000", target: "Text Field 48" },
    { logical: "audiogram.right.1000", target: "Text Field 49" },
    { logical: "audiogram.left.2000", target: "Text Field 50" },
    { logical: "audiogram.right.2000", target: "Text Field 51" },
    { logical: "audiogram.left.3000", target: "Text Field 52" },
    { logical: "audiogram.right.3000", target: "Text Field 53" },
    { logical: "audiogram.left.4000", target: "Text Field 54" },
    { logical: "audiogram.right.4000", target: "Text Field 55" },
    { logical: "earmold.summary", target: "Text Field 60" },
    ...grid(),
  ],
};
