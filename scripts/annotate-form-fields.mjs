#!/usr/bin/env node
// Distil — manufacturer form field annotator (backlog #42).
// Field names on many manufacturer PDFs are opaque ("57", "Check_Box12"), so a
// name dump alone can't be mapped to meaning. This script correlates every
// AcroForm widget's rectangle with the page's text runs (pdfjs) and prints, per
// field, the nearest label text to its left and directly above — which is
// almost always the printed caption for that blank. For flat PDFs (no AcroForm)
// it prints all text runs with coordinates instead: the raw material for an
// overlay map (pdf-lib coordinates, origin bottom-left, same space as printed).
//
// Usage:
//   node scripts/annotate-form-fields.mjs phonak-repair
//   node scripts/annotate-form-fields.mjs starkey            # flat → text runs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PDFDocument, PDFName } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const ROOT = join(import.meta.dirname, "..", "docs", "manufacturer-forms");
const filters = process.argv.slice(2).map((s) => s.toLowerCase());
if (!filters.length) {
  console.error("Pass at least one filename substring filter (this output is per-form and long).");
  process.exit(1);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.toLowerCase().endsWith(".pdf")) yield p;
  }
}

async function textRuns(bytes) {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(
      tc.items
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({ str: it.str.trim(), x: it.transform[4], y: it.transform[5], w: it.width, h: it.height }))
    );
  }
  await doc.destroy();
  return pages;
}

for (const path of walk(ROOT)) {
  const rel = relative(ROOT, path).replaceAll("\\", "/");
  if (!filters.some((f) => rel.toLowerCase().includes(f))) continue;

  const bytes = readFileSync(path);
  let runs = [];
  try {
    runs = await textRuns(bytes);
  } catch (e) {
    console.log(`\n=== ${rel}\n  TEXT EXTRACTION FAILED (${e.message}) — overlay coordinates must come from visual inspection.`);
  }
  const doc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
  const pages = doc.getPages();
  const pageIndexByRef = new Map(pages.map((p, i) => [p.ref.toString(), i]));

  let fields = [];
  try {
    fields = doc.getForm().getFields();
  } catch { /* flat */ }

  console.log(`\n=== ${rel} (${fields.length} fields)`);

  if (!fields.length) {
    runs.forEach((items, pi) => {
      console.log(`  --- page ${pi} text runs (x,y = pdf-lib coords) ---`);
      for (const it of items) console.log(`    (${it.x.toFixed(0)},${it.y.toFixed(0)}) w=${it.w.toFixed(0)} ${JSON.stringify(it.str)}`);
    });
    continue;
  }

  for (const f of fields) {
    for (const w of f.acroField.getWidgets()) {
      const rect = w.getRectangle();
      // widget page: /P entry when present, else scan page annots
      let pi = -1;
      const pRef = w.dict.get(PDFName.of("P"));
      if (pRef) pi = pageIndexByRef.get(pRef.toString()) ?? -1;
      if (pi < 0) {
        pi = pages.findIndex((pg) => {
          const annots = pg.node.Annots();
          if (!annots) return false;
          for (let i = 0; i < annots.size(); i++) if (annots.get(i) === w.ref || annots.get(i)?.toString() === w.ref?.toString()) return true;
          return false;
        });
      }
      const items = runs[pi] ?? [];
      const midY = rect.y + rect.height / 2;
      const left = items
        .filter((it) => Math.abs(it.y - rect.y) < 7 || Math.abs(it.y + it.h / 2 - midY) < 7)
        .filter((it) => it.x + it.w <= rect.x + 3)
        .sort((a, b) => (rect.x - (a.x + a.w)) - (rect.x - (b.x + b.w)))[0];
      const above = items
        .filter((it) => it.y > rect.y + rect.height - 2 && it.y < rect.y + rect.height + 16)
        .filter((it) => it.x < rect.x + rect.width && it.x + it.w > rect.x - 4)
        .sort((a, b) => a.y - b.y)[0];
      const inside = items
        .filter((it) => it.x >= rect.x - 2 && it.x <= rect.x + rect.width && it.y >= rect.y - 2 && it.y <= rect.y + rect.height + 2)[0];
      // checkbox/radio labels usually sit to the right of the box
      const right = rect.width < 16
        ? items
            .filter((it) => Math.abs(it.y - rect.y) < 6 || Math.abs(it.y + it.h / 2 - midY) < 6)
            .filter((it) => it.x >= rect.x + rect.width - 2 && it.x - (rect.x + rect.width) < 120)
            .sort((a, b) => a.x - b.x)[0]
        : null;
      const label = [
        left ? `left=${JSON.stringify(left.str)}` : "",
        right ? `right=${JSON.stringify(right.str)}` : "",
        above ? `above=${JSON.stringify(above.str)}` : "",
        inside ? `in=${JSON.stringify(inside.str)}` : "",
      ].filter(Boolean).join(" ");
      console.log(
        `  p${pi} (${rect.x.toFixed(0)},${rect.y.toFixed(0)} ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}) ${JSON.stringify(f.getName())} ${label}`
      );
    }
  }
}
