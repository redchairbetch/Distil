// Drift guard for the manufacturer form registry (backlog #42).
//
// A field map is only trustworthy against the exact PDF bytes it was authored
// for, so this suite fails loudly when: a map's PDF is missing from
// docs/manufacturer-forms/, the PDF's hash no longer matches the map's stamp
// (a manufacturer revved the form — or someone swapped the file), an acroform
// target names a field the PDF doesn't have, or a map references a logical
// key buildFormData never produces (a typo that would silently print blanks).

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { FORM_REGISTRY, FORM_CATEGORIES } from "./registry.js";
import { buildFormData } from "./formData.js";
import { MFR_KEYS } from "../manufacturerKeys.js";

const FORMS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "manufacturer-forms");

// Every logical key the vocabulary can produce, from a fully-populated sample.
const SAMPLE_KEYS = new Set(
  Object.keys(
    buildFormData({
      patient: { name: "Pat Example", dob: "1950-01-01", phone: "(435) 555-0100", email: "p@x.com", address: "1 Way, Town, UT 84770" },
      devices: {
        fittingDate: "2026-01-01", warrantyExpiry: "2030-01-01",
        serialLeft: "L1", serialRight: "R1",
        left: {
          manufacturer: "Signia", family: "Pure", variant: "C&G", techLevel: "7IX", style: "ric", color: "Black", receiverLength: "2", receiverPower: "HP",
          coupling: "earmold", earmoldStyle: "skeleton", earmoldMaterial: "acrylic", earmoldColor: "clear",
          earmoldVent: "standard", earmoldVentSize: "2.0 mm", earmoldCanal: "Long", earmoldNotes: "n",
        },
        right: {
          manufacturer: "Signia", family: "Pure", variant: "C&G", techLevel: "7IX", style: "ric", color: "Black", receiverLength: "2", receiverPower: "HP",
          coupling: "earmold", earmoldStyle: "skeleton", earmoldMaterial: "acrylic", earmoldColor: "clear",
          earmoldVent: "standard", earmoldVentSize: "2.0 mm", earmoldCanal: "Long", earmoldNotes: "n",
        },
      },
      clinic: { name: "Clinic", address: "1 St, Town, UT 84770", phone: "(435) 555-0101" },
      clinicSettings: { fax: "(435) 555-0102", manufacturerAccounts: { signia: { billTo: "1", shipTo: "2" } } },
      provider: { fullName: "Dr. Example", activeLicense: "123" },
      mfrKey: "signia",
      audiology: { rightT: { 1000: 40 }, leftT: { 1000: 45 } },
      extras: { po: "PO1", notes: "n", impressionsEnclosed: true, scanOnFile: false },
    })
  )
);

describe("manufacturer form registry", () => {
  it("has unique ids and canonical manufacturers/categories", () => {
    const ids = FORM_REGISTRY.map((m) => m.id);
    expect(new Set(ids).size, "duplicate map ids").toBe(ids.length);
    for (const m of FORM_REGISTRY) {
      expect(MFR_KEYS, `${m.id}: manufacturer '${m.manufacturer}' not canonical`).toContain(m.manufacturer);
      expect(Object.keys(FORM_CATEGORIES), `${m.id}: unknown category '${m.category}'`).toContain(m.category);
      expect(["acroform", "overlay"], `${m.id}: unknown mode`).toContain(m.mode);
    }
  });

  it("references only logical keys buildFormData produces", () => {
    for (const m of FORM_REGISTRY) {
      for (const f of m.fields) {
        expect(SAMPLE_KEYS.has(f.logical), `${m.id}: unknown logical key '${f.logical}'`).toBe(true);
      }
    }
  });

  for (const m of FORM_REGISTRY) {
    describe(m.id, () => {
      const path = join(FORMS_DIR, m.pdf);
      let bytes;
      it("blank PDF exists and matches the version stamp", () => {
        bytes = readFileSync(path); // throws → missing file fails the test
        const hash = createHash("sha256").update(bytes).digest("hex");
        expect(hash, `${m.pdf} bytes changed — the form was revved; re-verify the map and update sha256`).toBe(m.sha256);
      });

      if (m.mode === "acroform") {
        it("every acroform target exists in the PDF", async () => {
          const doc = await PDFDocument.load(new Uint8Array(readFileSync(path)), { ignoreEncryption: true });
          const names = new Set(doc.getForm().getFields().map((f) => f.getName()));
          for (const f of m.fields) {
            expect(names.has(f.target), `${m.id}: target '${f.target}' not in PDF`).toBe(true);
          }
        });
      } else {
        it("overlay coordinates are inside the page", async () => {
          const doc = await PDFDocument.load(new Uint8Array(readFileSync(path)), { ignoreEncryption: true });
          const pages = doc.getPages();
          for (const f of m.fields) {
            const page = pages[f.page || 0];
            expect(page, `${m.id}: page ${f.page} missing`).toBeTruthy();
            const w = m.viewRotation === 90 ? page.getHeight() : page.getWidth();
            const h = m.viewRotation === 90 ? page.getWidth() : page.getHeight();
            expect(f.x >= 0 && f.x <= w, `${m.id}: ${f.logical} x=${f.x} off-page`).toBe(true);
            expect(f.y >= 0 && f.y <= h, `${m.id}: ${f.logical} y=${f.y} off-page`).toBe(true);
          }
        });
      }
    });
  }
});
