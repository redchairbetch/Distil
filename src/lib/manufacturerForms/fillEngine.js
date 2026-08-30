// Manufacturer form fill engine (backlog #42). React-free.
//
// fillForm(map, data) loads the blank PDF, verifies its bytes against the
// map's sha256 (a silently revved form must fail loudly, never misprint), then
// fills it in one of two modes:
//   acroform — set real form fields by name (text / checkbox / radio)
//   overlay  — draw vector text at mapped coordinates (flat PDFs; pdf-lib
//              coordinate space, origin bottom-left)
// Map field entries:
//   { logical, target }                          acroform text
//   { logical, target, type:"checkbox" }         checked when value is truthy
//   { logical, target, type:"radio", on }        select `on` when truthy
//   { logical, equals, ... }                     truthy test becomes value === equals
//   { logical, page, x, y, size?, maxWidth? }    overlay text ("X" for booleans)
// `data` is the flat dotted-key object from buildFormData; empty/absent values
// are skipped so an unfilled blank stays blank.

import { PDFDocument, StandardFonts, degrees } from "pdf-lib";

export class FormVersionError extends Error {
  constructor(map, actualHash) {
    super(
      `${map.title}: the blank PDF on file does not match this field map ` +
      `(expected ${map.sha256.slice(0, 12)}…, got ${actualHash.slice(0, 12)}…). ` +
      `The manufacturer likely revved the form — the map must be re-verified before filling.`
    );
    this.name = "FormVersionError";
  }
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isOn(entry, value) {
  if (value == null || value === "") return false;
  if ("equals" in entry) return value === entry.equals;
  return value === true || value === "true" || value === "yes" || value === 1 || (typeof value === "string" && value.trim() !== "" && entry.type !== "text");
}

// Grid checkboxes (style column × option row × ear) fire only when every
// listed logical key matches — e.g. { "earmold.left.style": "skeleton",
// "earmold.left.material": "acrylic" }. An entry with equalsAll ignores
// `logical` for the on-test (it stays as documentation of the primary key).
function isOnAll(entry, data) {
  if (entry.equalsAll) {
    return Object.entries(entry.equalsAll).every(([k, v]) => data[k] === v);
  }
  return isOn(entry, data[entry.logical]);
}

// Browser entry point: loads the bundled blank and enforces the version stamp.
// pdfAssets uses import.meta.glob (Vite-only), so it's imported lazily here to
// keep fillBytes usable from node tooling (scripts/, vitest).
export async function fillForm(map, data) {
  const { loadFormBytes } = await import("./pdfAssets.js");
  const bytes = await loadFormBytes(map.pdf);
  return fillBytes(map, data, bytes, { enforceHash: true });
}

// Core fill over caller-supplied bytes. Node tooling (scripts/) uses this
// directly with fs-read bytes and enforceHash off.
export async function fillBytes(map, data, bytes, { enforceHash = true } = {}) {
  const actualHash = await sha256Hex(bytes);
  if (enforceHash && actualHash !== map.sha256) throw new FormVersionError(map, actualHash);

  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  if (map.mode === "acroform") {
    const form = doc.getForm();
    for (const entry of map.fields) {
      const value = data[entry.logical];
      if (!entry.equalsAll && (value == null || value === "")) continue;
      try {
        if (entry.type === "checkbox") {
          if (isOnAll(entry, data)) form.getCheckBox(entry.target).check();
        } else if (entry.type === "radio") {
          if (isOn(entry, value)) form.getRadioGroup(entry.target).select(entry.on);
        } else {
          const field = form.getTextField(entry.target);
          let text = String(value);
          // Respect the field's maxLength: a truncated value on paper beats a
          // silently dropped one.
          const max = field.getMaxLength?.();
          if (max != null && text.length > max) text = text.slice(0, max);
          field.setText(text);
        }
      } catch (e) {
        // A single bad target must not lose the whole form; the drift test
        // catches these in CI, and the provider can hand-write one blank.
        console.warn(`fillForm ${map.id}: field ${entry.target} — ${e.message}`);
      }
    }
    try { form.updateFieldAppearances(); } catch { /* non-fatal */ }
  } else {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    for (const entry of map.fields) {
      const value = data[entry.logical];
      if (entry.equalsAll) {
        // Grid tick on a flat form: draw an X at the mapped cell when every
        // listed logical key matches.
        if (!isOnAll(entry, data)) continue;
        const page = pages[entry.page || 0];
        if (!page) continue;
        page.drawText("X", { x: entry.x, y: entry.y, size: entry.size || 8, font });
        continue;
      }
      if (value == null || value === "") continue;
      const page = pages[entry.page || 0];
      if (!page) continue;
      const text = value === true ? "X" : String(value);
      if (value === false) continue;
      let size = entry.size || 9;
      if (entry.maxWidth) {
        while (size > 5 && font.widthOfTextAtSize(text, size) > entry.maxWidth) size -= 0.5;
      }
      if (map.viewRotation === 90) {
        // Scanned sideways: content reads upright only after rotating the
        // page 90° CW. Map coordinates are authored in that viewed (portrait)
        // space; transform to raw space and rotate the text to match.
        page.drawText(text, {
          x: entry.y,
          y: page.getHeight() - entry.x,
          size,
          font,
          rotate: degrees(-90),
        });
      } else {
        page.drawText(text, { x: entry.x, y: entry.y, size, font });
      }
    }
  }

  const outBytes = await doc.save();
  return {
    bytes: outBytes,
    blob: new Blob([outBytes], { type: "application/pdf" }),
  };
}
