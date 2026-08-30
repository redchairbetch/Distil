// Starkey earmold order — flat PDF, overlay (text-run coordinates via
// scripts/annotate-form-fields.mjs; verify with preview-form-fill). Page 0 is
// the working copy; page 1 repeats the layout as a specialty/copy page and is
// left blank. BTE mold styles tick their "Standard" circle when either ear's
// mold matches (the printed style list isn't per-ear; venting/canal are).
// Materials, colors and the RIC mold block are finer than the overlay can
// safely tick — they ride in SPECIAL INSTRUCTIONS via earmold.summary.
const FREQ_X = { 250: 89, 500: 116, 750: 143, 1000: 172, 2000: 199, 3000: 226, 4000: 253, 6000: 280, 8000: 307 };

const STYLE_Y = {
  "shell": 282, "three-quarter-shell": 259, "half-shell": 235, "canal": 212,
  "canal-lock": 188, "cic-style": 165, "skeleton": 141, "semi-skeleton": 118,
};
const VENT_Y = { none: 547, small: 524, medium: 497, large: 470, "extra-large": 443, "select-a-vent": 416, iros: 385, trench: 362 };
const CANAL_Y = { Short: 532, Medium: 460, Long: 388 };

function ticks() {
  const out = [];
  for (const ear of ["left", "right"]) {
    for (const [id, y] of Object.entries(STYLE_Y)) {
      out.push({ logical: `earmold.${ear}.style`, page: 0, x: 96, y: y + 1, size: 8,
        equalsAll: { [`earmold.${ear}.style`]: id } });
    }
    for (const [id, y] of Object.entries(CANAL_Y)) {
      out.push({ logical: `earmold.${ear}.canal`, page: 0, x: 569, y, size: 8,
        equalsAll: { [`earmold.${ear}.canal`]: id } });
    }
  }
  for (const [id, y] of Object.entries(VENT_Y)) {
    out.push({ logical: "earmold.left.vent", page: 0, x: 492, y, size: 8,
      equalsAll: { "earmold.left.vent": id } });
    out.push({ logical: "earmold.right.vent", page: 0, x: 509, y, size: 8,
      equalsAll: { "earmold.right.vent": id } });
  }
  return out;
}

export default {
  id: "starkey-earmold-order",
  manufacturer: "starkey",
  category: "earmold_order",
  title: "Starkey Earmold Order",
  pdf: "starkey/starkey-earmold-order.pdf",
  sha256: "a0eef0e414bae95ea6d5e332c0b0cab102b142c5f1b3402b74ada3dbc33d5c4b",
  mode: "overlay",
  fields: [
    { logical: "patient.firstName", page: 0, x: 75, y: 676, size: 8, maxWidth: 130 },
    { logical: "patient.lastName", page: 0, x: 272, y: 676, size: 8, maxWidth: 130 },
    { logical: "meta.today", page: 0, x: 432, y: 676, size: 8, maxWidth: 55 },
    { logical: "device.primary.manufacturer", page: 0, x: 128, y: 658, size: 7, maxWidth: 58 },
    { logical: "device.primary.model", page: 0, x: 222, y: 658, size: 7, maxWidth: 95 },
    { logical: "loss.severity", page: 0, x: 356, y: 656, size: 8, equalsAll: { "loss.severity": "Moderate" } },
    { logical: "loss.severity", page: 0, x: 398, y: 656, size: 8, equalsAll: { "loss.severity": "Moderately Severe" } },
    { logical: "loss.severity", page: 0, x: 398, y: 656, size: 8, equalsAll: { "loss.severity": "Severe" } },
    { logical: "loss.severity", page: 0, x: 429, y: 656, size: 8, equalsAll: { "loss.severity": "Profound" } },
    { logical: "clinic.billTo", page: 0, x: 150, y: 645, size: 8, maxWidth: 140 },
    { logical: "clinic.shipTo", page: 0, x: 455, y: 645, size: 8, maxWidth: 130 },
    { logical: "provider.name", page: 0, x: 45, y: 630, size: 8, maxWidth: 235 },
    { logical: "provider.name", page: 0, x: 335, y: 630, size: 8, maxWidth: 245 },
    { logical: "clinic.fax", page: 0, x: 203, y: 620, size: 8, maxWidth: 80 },
    { logical: "po", page: 0, x: 55, y: 600, size: 8, maxWidth: 120 },
    ...Object.entries(FREQ_X).flatMap(([f, x]) => [
      { logical: `audiogram.right.${f}`, page: 0, x, y: 566, size: 7, maxWidth: 22 },
      { logical: `audiogram.left.${f}`, page: 0, x, y: 530, size: 7, maxWidth: 22 },
    ]),
    { logical: "earmold.summary", page: 0, x: 330, y: 70, size: 7, maxWidth: 262 },
    ...ticks(),
  ],
};
