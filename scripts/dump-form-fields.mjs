#!/usr/bin/env node
// Distil — manufacturer form field dumper (backlog #42).
// Walks docs/manufacturer-forms/**/*.pdf and prints, per PDF: the SHA-256 of its
// bytes (the version stamp every field map must carry), page sizes, and — for
// AcroForm PDFs — every field name, its type, and, for radio groups / checkboxes,
// the export values pdf-lib needs to select an option. Radio export values are
// not guessable from the visible form, so mapping is impossible without this dump.
//
// Usage:
//   node scripts/dump-form-fields.mjs                     # all 44 PDFs, summary only
//   node scripts/dump-form-fields.mjs phonak-repair       # full field dump for matching files
//   node scripts/dump-form-fields.mjs signia rexton       # multiple substring filters

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList, PDFSignature } from "pdf-lib";

const ROOT = join(import.meta.dirname, "..", "docs", "manufacturer-forms");
const filters = process.argv.slice(2).map((s) => s.toLowerCase());

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.toLowerCase().endsWith(".pdf")) yield p;
  }
}

function fieldType(f) {
  if (f instanceof PDFTextField) return "text";
  if (f instanceof PDFCheckBox) return "checkbox";
  if (f instanceof PDFRadioGroup) return "radio";
  if (f instanceof PDFDropdown) return "dropdown";
  if (f instanceof PDFOptionList) return "optionlist";
  if (f instanceof PDFSignature) return "signature";
  return "other";
}

for (const path of walk(ROOT)) {
  const rel = relative(ROOT, path).replaceAll("\\", "/");
  if (filters.length && !filters.some((f) => rel.toLowerCase().includes(f))) continue;

  const bytes = readFileSync(path);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  let doc;
  try {
    doc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
  } catch (e) {
    console.log(`\n=== ${rel}\n  sha256: ${sha256}\n  LOAD FAILED: ${e.message}`);
    continue;
  }

  const pages = doc.getPages().map((p, i) => `p${i}:${Math.round(p.getWidth())}x${Math.round(p.getHeight())}`);
  let fields = [];
  try {
    fields = doc.getForm().getFields();
  } catch { /* no AcroForm */ }

  console.log(`\n=== ${rel}`);
  console.log(`  sha256: ${sha256}`);
  console.log(`  pages: ${pages.join(" ")}  fields: ${fields.length}`);

  if (!filters.length) continue; // summary mode

  for (const f of fields) {
    const t = fieldType(f);
    let extra = "";
    if (t === "radio") extra = `  options=[${f.getOptions().join(" | ")}]`;
    else if (t === "checkbox") {
      // export value ("on" state) lives on the widget's appearance states
      try {
        const states = f.acroField.getWidgets().flatMap((w) => {
          const ap = w.getAppearances()?.normal;
          return ap && "keys" in ap ? ap.keys().map((k) => k.decodeText()) : [];
        });
        const on = [...new Set(states.filter((s) => s !== "Off"))];
        if (on.length) extra = `  on=[${on.join(" | ")}]`;
      } catch { /* leave blank */ }
    } else if (t === "dropdown" || t === "optionlist") extra = `  options=[${f.getOptions().join(" | ")}]`;
    else if (t === "text" && f.isMultiline?.()) extra = "  multiline";
    console.log(`    [${t}] ${JSON.stringify(f.getName())}${extra}`);
  }
}
