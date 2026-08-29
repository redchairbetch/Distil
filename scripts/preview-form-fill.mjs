#!/usr/bin/env node
// Distil — fill a manufacturer form map with labeled sample data and write the
// result PDF for visual verification. This is the tuning loop for overlay
// (flat-PDF) coordinate maps.
//
// Usage:
//   node scripts/preview-form-fill.mjs <map-id> [outDir]        # sample fill
//   node scripts/preview-form-fill.mjs <map-id> [outDir] --grid # coordinate grid
//
// --grid stamps "x,y" labels on a 50pt lattice instead of sample data — use it
// to calibrate a scan's coordinate space (including viewRotation transforms).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { FORM_REGISTRY } from "../src/lib/manufacturerForms/registry.js";
import { fillBytes } from "../src/lib/manufacturerForms/fillEngine.js";

const [mapId, outDirArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const grid = process.argv.includes("--grid");
const outDir = outDirArg || join(import.meta.dirname, "..", ".preview-forms");

const map = FORM_REGISTRY.find((m) => m.id === mapId);
if (!map) {
  console.error(`Unknown map id "${mapId}". Known: ${FORM_REGISTRY.map((m) => m.id).join(", ")}`);
  process.exit(1);
}

const bytes = readFileSync(join(import.meta.dirname, "..", "docs", "manufacturer-forms", map.pdf));

let effectiveMap = map;
let data;
if (grid) {
  const fields = [];
  for (let x = 0; x <= 620; x += 50) {
    for (let y = 0; y <= 840; y += 50) {
      fields.push({ logical: `g${x}_${y}`, page: 0, x, y, size: 6 });
    }
  }
  effectiveMap = { ...map, mode: "overlay", fields };
  data = Object.fromEntries(fields.map((f) => [f.logical, f.logical.slice(1).replace("_", ",")]));
} else {
  // Label every mapped logical key with its own name so misplacements are
  // self-identifying on the page.
  data = {};
  for (const f of map.fields) {
    data[f.logical] =
      f.type === "checkbox" || f.type === "radio" ? true
      : `«${f.logical}»`;
  }
  // booleans that route sections
  for (const k of Object.keys(data)) {
    if (k.startsWith("warranty.in") || k.endsWith("isBteFamily") || k.endsWith("isCustom")) data[k] = true;
    if (k.endsWith("styleBucket")) data[k] = "iic_cic";
  }
}

const { bytes: out } = await fillBytes(effectiveMap, data, new Uint8Array(bytes), { enforceHash: false });
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${map.id}${grid ? ".grid" : ""}.preview.pdf`);
writeFileSync(outPath, out);
console.log(outPath);
