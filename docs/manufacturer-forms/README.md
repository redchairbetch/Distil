# Manufacturer Forms Library

Blank manufacturer paperwork for the devices MHC dispenses — earmold/custom
order forms, repair/service forms, Loss & Damage claims, and Return for
Credit forms. Sourced 2026-08-29 from Kurt's Drive folder
`Distil CRM/Manufacturer Forms` (44 PDFs, all imported). This library is the
raw material for backlog **#42 — Earmold & manufacturer-form engine**
(`src/context.md`): phase (a) scrapes the earmold order forms into an
earmold catalog; phase (b) auto-populates printable copies of these PDFs
with practice + patient order data.

## Fillability

Each file below is marked **fillable** (the PDF carries real AcroForm
fields — a filler like pdf-lib can set them by name) or **flat** (no form
fields — auto-population needs a coordinate-mapped text overlay, or the
pdfjs-dist→jspdf raster route). Field counts come from a pypdf scan at
import. Notable: every Starkey and Rexton form is flat; Signia's RIC 3.0
earmold form is the most heavily structured (1,916 fields); Signia's HP
receiver form is a pure scan (no text layer at all).

When a manufacturer revs a form, replace the file here and re-verify any
field map built against it — maps are version-stamped against the PDF's
SHA-256 (see `src/lib/manufacturerForms/registry.js`; the drift guard in
`registry.test.js` fails on a silent swap). Tooling: `scripts/dump-form-fields.mjs`
prints each PDF's hash + AcroForm field names, `scripts/annotate-form-fields.mjs`
correlates fields with nearby label text (and dumps text-run coordinates for
flat forms), and `scripts/preview-form-fill.mjs` renders a sample-filled copy
for visual verification of overlay maps.

**Known-bad file:** `signia/signia-return-for-credit.pdf` is corrupt (bad
flate stream — renders blank, unreadable by pdfjs). It is excluded from the
form registry until a clean copy is re-sourced from Signia/Drive.

## Index

### Oticon (Demant)
| File | Category | Fields |
|---|---|---|
| `oticon/oticon-sirius-earmold-order.pdf` | Earmold order (Sirius platform, Oct 2025) | fillable · 368 |
| `oticon/oticon-rite-earmold-order-updated.pdf` | Earmold order (More MiniRITE, "updated form") | flat |
| `oticon/oticon-rite-corda-earmold-order.pdf` | Earmold order (RITE Corda, H2-2017) | flat |
| `oticon/oticon-repair.pdf` | Repair | fillable · 111 |
| `oticon/oticon-loss-damage.pdf` | Loss & Damage | flat |
| `oticon/oticon-return-for-credit.pdf` | Return for Credit | fillable · 103 |

Note: the Drive files "Sirius Earmold form.pdf" and "RITE Earmold Order
Form - updated form.pdf" carried no brand in the filename — both were
verified Oticon from embedded logo/product metadata ("Sirius" is Oticon's
platform name, not an earmold lab).

### Phonak (Sonova)
| File | Category | Fields |
|---|---|---|
| `phonak/phonak-service-form.pdf` | Repair/Service (025-1058) | fillable · 208 |
| `phonak/phonak-repair.pdf` | Repair | fillable · 89 |
| `phonak/phonak-loss-damage.pdf` | Loss & Damage | fillable · 30 |
| `phonak/phonak-return-for-credit.pdf` | Return for Credit | fillable · 38 |
| `phonak/phonak-return-for-credit-ld-claim.pdf` | Return for Credit + L&D claim (025-1063) | fillable · 81 |
| `phonak/phonak-fm-return-for-credit.pdf` | Return for Credit — FM/Roger (PT600297) | fillable · 46 |

### Relate (UHCH private label — Unitron)
| File | Category | Fields |
|---|---|---|
| `relate/relate-4-0-ric-custom-ear-piece-order.pdf` | Custom ear piece order (4.0 RIC) | fillable · 125 |
| `relate/relate-4-0-bte-earmold-order.pdf` | Earmold order (4.0 BTE) | fillable · 115 |
| `relate/relate-5-0-ite-r-custom-order.pdf` | Custom order (5.0 ITE-R) | fillable · 120 |
| `relate/relate-5-0-10-nw-omni-order.pdf` | Custom order (5.0 10 NW Omni) | fillable · 69 |
| `relate/relate-one-time-courtesy-replacement.pdf` | One-time courtesy replacement request | fillable · 35 |

### ReSound (GN)
| File | Category | Fields |
|---|---|---|
| `resound/resound-rie-custom-earmold-order.pdf` | Earmold order (RIE) | flat |
| `resound/resound-bte-custom-earmold-order.pdf` | Earmold order (BTE) | flat |
| `resound/resound-customs-order.pdf` | Custom order | fillable · 143 |
| `resound/resound-repair.pdf` | Repair | flat |
| `resound/resound-loss-damage.pdf` | Loss & Damage | flat |

### Rexton (WSA) — all flat
| File | Category | Fields |
|---|---|---|
| `rexton/rexton-custom-order.pdf` | Custom order (SIV-16503-23) | flat |
| `rexton/rexton-repair.pdf` | Repair | flat |
| `rexton/rexton-loss-damage.pdf` | Loss & Damage | flat |
| `rexton/rexton-return-for-credit.pdf` | Return for Credit | flat |

### Signia (WSA)
| File | Category | Fields |
|---|---|---|
| `signia/signia-ric-3-0-custom-earmold-order.pdf` | Earmold order (RIC 3.0, 02/26) | fillable · 1916 |
| `signia/signia-custom-products-order-0925.pdf` | Custom products order (09/25) | fillable · 285 |
| `signia/signia-custom-order-2026.pdf` | Custom order (2026) | flat (1 stray field) |
| `signia/signia-hp-receiver-order.pdf` | HP receiver / cShell order (09/23/2025) | flat — pure scan, no text layer |
| `signia/signia-repair.pdf` | Repair | fillable · 14 |
| `signia/signia-loss-damage.pdf` | Loss & Damage | flat |
| `signia/signia-return-for-credit.pdf` | Return for Credit | flat |

### Starkey — all flat
| File | Category | Fields |
|---|---|---|
| `starkey/starkey-earmold-order.pdf` | Earmold order | flat |
| `starkey/starkey-earmold-custom-order.pdf` | Earmold custom order | flat |
| `starkey/starkey-repair.pdf` | Repair | flat |
| `starkey/starkey-loss-damage.pdf` | Loss & Damage | flat |
| `starkey/starkey-return-for-credit.pdf` | Return for Credit (RFC) | flat |

### Unitron (Sonova)
| File | Category | Fields |
|---|---|---|
| `unitron/unitron-repair.pdf` | Repair | flat |
| `unitron/unitron-repair-ld-rfc.pdf` | Repair + L&D + Return for Credit (combined) | fillable · 82 |

### Widex (WSA)
| File | Category | Fields |
|---|---|---|
| `widex/magnify-custom-order.pdf` | Custom order (Magnify IM/IP/XP/CIC, DFM02MM) | fillable · 301 |
| `widex/widex-repair.pdf` | Repair | fillable · 184 |
| `widex/widex-loss-damage.pdf` | Loss & Damage | fillable · 33 |
| `widex/widex-return-for-credit.pdf` | Return for Credit | fillable · 276 |
