// Phonak BTE earmold order — AcroForm. Page 0 header/patient/audiogram
// (Sonova convention: Left row above Right); page 1 carries the full per-ear
// grid with unique box numbers: style, canal length, material, venting,
// color. Tubing, options, warranty and the Naída/Sky device grid stay with
// the pen; earmold.summary lands in Notes.
const EARS = [["left", "L"], ["right", "R"]];

const GRID = {
  style: {
    "cros": { L: "125", R: "125a" },
    "canal-lock": { L: "126", R: "127" },
    "canal": { L: "128", R: "129" },
    "semi-skeleton": { L: "130", R: "131" },
    "skeleton": { L: "132", R: "133" },
    "half-shell": { L: "134", R: "135" },
    "full-shell-carved": { L: "136", R: "137" },
    "full-shell-uncarved": { L: "138", R: "139" },
    "helix-lock": { L: "140", R: "141" },
  },
  canal: {
    "Short": { L: "142", R: "143" },
    "Medium (default)": { L: "144", R: "145" },
    "Long": { L: "146", R: "147" },
    "Cut as marked": { L: "148", R: "149" },
  },
  material: {
    "acrylic": { L: "170", R: "171" },
    "silicone-s70": { L: "172", R: "173" },
  },
  vent: {
    "aov": { L: "174", R: "175" },
    "large-sav": { L: "176", R: "177" },
    "iros-a": { L: "178", R: "179" },
    "large-p30": { L: "180", R: "181" },
    "medium-p25": { L: "182", R: "183" },
    "small-p20": { L: "184", R: "185" },
    "pressure-p12": { L: "186", R: "187" },
    "none": { L: "188", R: "189" },
  },
  color: {
    "clear-21-standard": { L: "160", R: "161" },
    "translucent-brown-n-": { L: "162", R: "163" }, // printed "Light Brown [N]"
    "translucent-pink-t-": { L: "164", R: "165" },  // printed "Rose Tint [T]"
  },
};

function grid() {
  const out = [];
  for (const [key, table] of Object.entries(GRID)) {
    for (const [id, boxes] of Object.entries(table)) {
      for (const [ear, E] of EARS) {
        out.push({ logical: `earmold.${ear}.${key}`, type: "checkbox", target: boxes[E],
          equalsAll: { [`earmold.${ear}.${key}`]: id } });
      }
    }
  }
  return out;
}

export default {
  id: "phonak-earmold-order",
  manufacturer: "phonak",
  category: "earmold_order",
  title: "Phonak BTE Earmold Order",
  pdf: "phonak/phonak-earmold-order.pdf",
  sha256: "86160b80fbbe52e53d140491af55704457df3fee48237bdf54d0d7ba81e2c71d",
  mode: "acroform",
  fields: [
    { logical: "meta.today", target: "1" },
    { logical: "clinic.shipTo", target: "2" },
    { logical: "clinic.street", target: "3" },
    { logical: "clinic.city", target: "4" },
    { logical: "clinic.state", target: "5" },
    { logical: "clinic.zip", target: "6" },
    { logical: "clinic.billTo", target: "7" },
    { logical: "po", target: "9" },
    { logical: "provider.name", target: "10" },
    { logical: "clinic.phone", target: "11" },
    { logical: "patient.lastName", target: "16" },
    { logical: "patient.firstName", target: "17a" },
    { logical: "patient.age", target: "18a" },
    ...[250, 500, 1000, 2000, 3000, 4000].flatMap((f, i) => [
      { logical: `audiogram.left.${f}`, target: String(22 + i) },
      { logical: `audiogram.right.${f}`, target: i === 5 ? "33a" : String(28 + i) },
    ]),
    { logical: "earmold.summary", target: "Notes 2" },
    ...grid(),
  ],
};
