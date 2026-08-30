// Blank manufacturer PDFs, served from docs/manufacturer-forms/ (backlog #42).
//
// docs/ stays the single source-of-record: the lazy glob makes Vite emit each
// referenced PDF as its own hashed asset, fetched on demand — nothing lands in
// the JS bundle and unreferenced PDFs are never shipped. A form rev is a PR
// that replaces the PDF and updates the map's sha256 together; the fill
// engine's hash check makes a swapped-but-unmapped form fail loudly.

const PDF_URLS = import.meta.glob("/docs/manufacturer-forms/*/*.pdf", {
  query: "?url",
  import: "default",
});

// pdfPath is the map's `pdf` field, e.g. "phonak/phonak-repair.pdf".
export async function loadFormBytes(pdfPath) {
  const key = `/docs/manufacturer-forms/${pdfPath}`;
  const loader = PDF_URLS[key];
  if (!loader) throw new Error(`Blank form not found in bundle: ${pdfPath}`);
  const url = await loader();
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch blank form ${pdfPath}: ${resp.status}`);
  return new Uint8Array(await resp.arrayBuffer());
}
