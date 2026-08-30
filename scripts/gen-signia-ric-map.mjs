#!/usr/bin/env node
// Distil — generate the Signia RIC 3.0 earmold-order field map (backlog #42b).
//
// The form has 1,916 AcroForm fields with opaque serial names ("Check Box
// 1803010147"), laid out as a 17-style × option-row × R/L grid. This script
// reconstructs meaning positionally: style column bands come from the style
// header labels (pdfjs text runs), option rows from their printed labels
// segmented by section header, and each checkbox widget (pdf-lib rect) is
// assigned to (style column, ear) by x within its row. Output is the static
// map module, committed at src/lib/manufacturerForms/maps/ — regenerate only
// when Signia revs the form.
//
//   node scripts/gen-signia-ric-map.mjs > src/lib/manufacturerForms/maps/signia-ric-3-0-custom-earmold-order.js

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFName, PDFCheckBox, PDFTextField } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const PDF_PATH = join(import.meta.dirname, "..", "docs", "manufacturer-forms", "signia", "signia-ric-3-0-custom-earmold-order.pdf");
const bytes = readFileSync(PDF_PATH);
const sha256 = createHash("sha256").update(bytes).digest("hex");

// ── collect text runs (p0 only — the earmold page) ─────────────────────────
const pj = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
const page1 = await pj.getPage(1);
const tc = await page1.getTextContent();
const runs = tc.items.filter((it) => it.str?.trim()).map((it) => ({ str: it.str.trim(), x: it.transform[4], y: it.transform[5], w: it.width }));
await pj.destroy();

const find = (str, opts = {}) => runs.filter((r) => r.str === str && (opts.yMin == null || r.y >= opts.yMin) && (opts.yMax == null || r.y <= opts.yMax));
const one = (str, opts) => {
  const m = find(str, opts);
  if (m.length !== 1) throw new Error(`label "${str}" matched ${m.length} runs${opts ? ` in ${JSON.stringify(opts)}` : ""}: ${m.map((r) => `(${r.x.toFixed(0)},${r.y.toFixed(0)})`).join(" ")}`);
  return m[0];
};

// ── collect widgets ─────────────────────────────────────────────────────────
const doc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
const pages = doc.getPages();
const pageRef0 = pages[0].ref.toString();
const boxes = []; // checkboxes on p0
const texts = []; // text fields on p0
for (const f of doc.getForm().getFields()) {
  for (const w of f.acroField.getWidgets()) {
    const pRef = w.dict.get(PDFName.of("P"))?.toString();
    if (pRef !== pageRef0) continue;
    const r = w.getRectangle();
    const rec = { name: f.getName(), x: r.x, y: r.y, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    if (f instanceof PDFCheckBox) boxes.push(rec);
    else if (f instanceof PDFTextField) texts.push(rec);
  }
}

// ── style columns from the header labels ────────────────────────────────────
// Header row label texts, left→right, with their catalog style ids. Several
// labels are split across two text runs ("RIC" over "Lock") — anchor on the
// distinct first-line runs in the header band and order by x.
const STYLE_IDS = [
  "ric", "ric-lock", "foil-ric", "ric-foil-lock", "canal", "canal-lock",
  "canal-foil", "canal-foil-lock", "half-shell", "helix-lock",
  "half-shell-foil", "full-shell", "skeleton", "skeleton-foil",
  "half-skeleton", "three-quarter-skeleton", "semi-skeleton",
];

// Band template: the row with the most checkboxes (S miniReceiver — all 17
// styles × R/L = 34). Cluster its boxes into 17 pairs by x gaps.
const sMini = one("S miniReceiver 3.0");
const templateRow = boxes.filter((b) => Math.abs(b.cy - (sMini.y + 3)) < 6).sort((a, b) => a.cx - b.cx);
if (templateRow.length !== 34) throw new Error(`template row has ${templateRow.length} boxes, expected 34`);
const bands = []; // [{styleId, rx, lx}]
for (let i = 0; i < 17; i++) {
  bands.push({ styleId: STYLE_IDS[i], rx: templateRow[2 * i].cx, lx: templateRow[2 * i + 1].cx });
}

// Assign a box to (styleId, ear) by nearest band center.
function assign(box) {
  let best = null;
  for (const b of bands) {
    for (const [ear, x] of [["right", b.rx], ["left", b.lx]]) {
      const d = Math.abs(box.cx - x);
      if (!best || d < best.d) best = { styleId: b.styleId, ear, d };
    }
  }
  if (best.d > 6) return null; // outside the grid (color table, remake, etc.)
  return best;
}

// ── option rows, segmented by section ───────────────────────────────────────
// [sectionHeader, rows: [label, key, value]]  key: material|vent|ventSize|canal
const SECTIONS = [
  ["Material", [
    ["Acrylic (Hard)", "material", "acrylic"],
    ["Silicone (Soft)", "material", "silicone"],
  ]],
  ["Vent Type", [
    ["No Vent", "vent", "none"],
    ["Standard", "vent", "standard"],
    ["Trench Vent", "vent", "trench"],
    ["Open", "vent", "open"],
    ["Semi-Iros", "vent", "semi-iros"],
  ]],
  ["Vent Size for Standard Vent Type", [
    ["1.0 mm", "ventSize", "1.0 mm"],
    ["1.2 mm", "ventSize", "1.2 mm"],
    ["1.4 mm", "ventSize", "1.4 mm"],
    ["1.6 mm", "ventSize", "1.6 mm"],
    ["2.0 mm", "ventSize", "2.0 mm"],
    ["2.5 mm", "ventSize", "2.5 mm"],
    ["3.0 mm", "ventSize", "3.0 mm"],
    ["As big as possible", "ventSize", "As big as possible"],
  ]],
  ["Canal length", [
    ["Deep", "canal", "Deep (long canal only)"],
    ["Long", "canal", "Long (long canal only)"],
    ["Medium", "canal", "Medium"],
    ["Short", "canal", "Short"],
    ["Customer Specified", "canal", "Customer specified"],
  ]],
];

const sectionYs = SECTIONS.map(([header]) => one(header).y);

const entries = [];
let skipped = 0;
SECTIONS.forEach(([header, rows], si) => {
  const yTop = sectionYs[si];
  const yBottom = si + 1 < sectionYs.length ? sectionYs[si + 1] : 0;
  for (const [label, key, value] of rows) {
    // Row label within this section's band (labels sit in the left gutter).
    const cands = find(label, { yMax: yTop - 1, yMin: yBottom + 1 }).filter((r) => r.x < 160);
    if (cands.length !== 1) throw new Error(`row "${label}" in section "${header}": ${cands.length} candidates`);
    const rowY = cands[0].y;
    const rowBoxes = boxes.filter((b) => Math.abs(b.cy - (rowY + 3)) < 5);
    for (const b of rowBoxes) {
      const a = assign(b);
      if (!a) { skipped++; continue; }
      entries.push({
        logical: `earmold.${a.ear}.${key === "canal" ? "canal" : key === "ventSize" ? "ventSize" : key}`,
        type: "checkbox",
        target: b.name,
        equalsAll: {
          [`earmold.${a.ear}.style`]: a.styleId,
          [`earmold.${a.ear}.${key === "canal" ? "canal" : key === "ventSize" ? "ventSize" : key}`]: value,
        },
      });
    }
  }
});

// ── color table (not style-gated): each color label + its R,L boxes ────────
const COLORS = [
  ["Clear", "clear"], ["Beige", "beige"], ["Rose", "rose"], ["Brown", "brown"],
  ["Dark Brown Transparent*", "dark-brown-transparent"], ["Mocha*", "mocha"],
  ["Red Opaque", "red-opaque"], ["Purple Translucent", "purple-translucent"],
  ["Orange Opaque", "orange-opaque"], ["Red Glitter", "red-glitter"],
  ["Yellow Opaque", "yellow-opaque"], ["Orange Glitter", "orange-glitter"],
  ["Blue Opaque", "blue-opaque"], ["Yellow Glitter", "yellow-glitter"],
  ["Lilac Opaque", "lilac-opaque"], ["Green Glitter", "green-glitter"],
  ["Black Opaque", "black-opaque"], ["Blue Glitter", "blue-glitter"],
  ["White Opaque", "white-opaque"], ["Purple Glitter", "purple-glitter"],
  ["Green Translucent", "green-translucent"], ["Pink Glitter", "pink-glitter"],
  ["Pink Translucent", "pink-translucent"], ["Clear Glitter", "clear-glitter"],
  ["Blue Translucent", "blue-translucent"],
];
let colorMisses = [];
for (const [label, colorId] of COLORS) {
  // Labels may render as one run or split ("Mocha" + "*") — match by prefix
  // on the first word, then confirm the full label starts at that run.
  const first = label.split(" ")[0].replace("*", "");
  const cands = runs.filter((r) => r.y < 260 && (r.str === label || r.str.replace("*", "") === label.replace("*", "") || r.str.startsWith(first)))
    .filter((r) => r.str.replace("*", "").startsWith(first));
  let matched = false;
  for (const lab of cands) {
    const pair = boxes
      .filter((b) => Math.abs(b.cy - (lab.y + 3)) < 5 && b.cx > lab.x + 4 && b.cx < lab.x + lab.w + 80)
      .sort((a, b2) => a.cx - b2.cx)
      .slice(0, 2);
    if (pair.length !== 2) continue;
    // Guard against matching a longer label that merely shares the prefix
    // (e.g. "Blue Opaque" vs "Blue Translucent"): require the run's text to
    // be the label minus the asterisk.
    if (lab.str.replace("*", "").trim() !== label.replace("*", "").trim()) continue;
    entries.push({ logical: "earmold.right.color", type: "checkbox", target: pair[0].name, equalsAll: { "earmold.right.color": colorId } });
    entries.push({ logical: "earmold.left.color", type: "checkbox", target: pair[1].name, equalsAll: { "earmold.left.color": colorId } });
    matched = true;
  }
  if (!matched) colorMisses.push(label);
}
if (colorMisses.length) console.error(`color rows not matched (pen + summary cover them): ${colorMisses.join(", ")}`);

// ── header text fields by position ──────────────────────────────────────────
// From the printed layout: Bill To (~55,690), Ship To (~400,690), Contact
// (~660?,...) etc. Match each text field to the nearest known label.
const TEXT_TARGETS = [
  ["Bill To", "clinic.billTo"],
  ["Ship To", "clinic.shipTo"],
  ["Contact Name", "provider.name"],
  ["P.O. No.", "po"],
  ["Patient Information", "patient.lastFirst"],
  ["Medicaid ID#", null],
  ["Date", "meta.today"],
];
const headerEntries = [];
for (const [label, logical] of TEXT_TARGETS) {
  if (!logical) continue;
  const labs = find(label, { yMin: 640 });
  if (!labs.length) continue;
  const lab = labs.sort((a, b) => b.y - a.y)[0];
  const tf = texts
    .filter((t) => Math.abs(t.cy - (lab.y + 4)) < 12 && t.x >= lab.x - 4)
    .sort((a, b) => (a.x - lab.x) - (b.x - lab.x))[0];
  if (tf) headerEntries.push({ logical, target: tf.name });
}
// Email or Phone # field + special instructions (largest multiline near bottom-left)
const emailLab = find("Email or")[0];
if (emailLab) {
  const tf = texts.filter((t) => Math.abs(t.cy - (emailLab.y + 0)) < 14 && t.x > emailLab.x).sort((a, b) => a.x - b.x)[0];
  if (tf) headerEntries.push({ logical: "clinic.phone", target: tf.name });
}
const si = find("Special instructions:")[0];
if (si) {
  const tf = texts.filter((t) => t.cy < si.y && t.cy > si.y - 60).sort((a, b) => b.cy - a.cy)[0];
  if (tf) headerEntries.push({ logical: "earmold.summary", target: tf.name });
}

console.error(`grid entries: ${entries.length}, header: ${headerEntries.length}, skipped off-grid boxes: ${skipped}`);

// ── emit the map module ─────────────────────────────────────────────────────
const lines = [];
lines.push(`// Signia RIC AND EARMOLD 3.0 order — GENERATED by scripts/gen-signia-ric-map.mjs.`);
lines.push(`// 1,916 opaque AcroForm fields decoded positionally: 17 style columns × R/L`);
lines.push(`// × material/vent/vent-size/canal rows, plus the per-ear color tables and`);
lines.push(`// header text fields. Do not edit by hand — rerun the generator when Signia`);
lines.push(`// revs the form. Receiver row (S/M/P), waxguard, finish, labeling, remake and`);
lines.push(`// the page-2 RIC device order stay with the pen; earmold.summary lands in`);
lines.push(`// Special instructions so the lab always gets the complete order in prose.`);
lines.push(`export default {`);
lines.push(`  id: "signia-ric-3-0-custom-earmold-order",`);
lines.push(`  manufacturer: "signia",`);
lines.push(`  category: "earmold_order",`);
lines.push(`  title: "Signia RIC & Earmold 3.0 Order",`);
lines.push(`  pdf: "signia/signia-ric-3-0-custom-earmold-order.pdf",`);
lines.push(`  sha256: "${sha256}",`);
lines.push(`  mode: "acroform",`);
lines.push(`  fields: [`);
for (const e of headerEntries) {
  lines.push(`    { logical: ${JSON.stringify(e.logical)}, target: ${JSON.stringify(e.target)} },`);
}
for (const e of entries) {
  lines.push(`    { logical: ${JSON.stringify(e.logical)}, type: "checkbox", target: ${JSON.stringify(e.target)}, equalsAll: ${JSON.stringify(e.equalsAll)} },`);
}
lines.push(`  ],`);
lines.push(`};`);
console.log(lines.join("\n"));
