# Device Image Manifest

Every device photo in this folder is named `<image_key>.webp` (`.png`/`.jpg` also
work). The `image_key` values live in three Supabase tables — `product_catalog`
(wizard), `device_platforms` (LegacyFastPath / CapabilityComparison), and
`legacy_device` (Then-vs-Now trade-in reference) — and are **shared wherever the
physical shell is identical**: tech levels and colors share one photo, and
white-labels reuse the donor image (KS9 → `phonak-audeo-marvel`, TruHearing →
its Signia/Rexton donor where applicable). Drop a correctly named file here and
every row carrying that key picks it up on the next build. A missing file is
safe: the UI renders its existing body-style silhouette (or nothing) instead.

**89 keys cover all 173 catalog rows.** Ship them in any order — partial
coverage degrades gracefully.

## File spec

- Square, device on transparent or white background, no watermark, no retailer branding
- ~800×800 px, WebP preferred (run `scripts/normalize-device-images.sh` on raw
  downloads to get this automatically)
- One hero color per shell — pick the most-dispensed color, consistency matters
  more than completeness
- Source from manufacturer press/media portals or the pro portals we're
  credentialed for — not image search. Verify usage rights before anything
  ships patient-facing.

## Fast path: the 2026 catalog URL map

`scripts/device-image-sources.tsv` maps 55 of these keys to image URLs curated
from the US Hearing Aid Catalog 2026 reference page (manufacturer CDN product
renders where available). `scripts/fetch-device-images.sh` downloads and
normalizes them in one shot — run it on a machine with open internet (the
Claude Code cloud sandbox blocks these CDNs), then visually vet before
committing: a handful of sources are lifestyle photos, not packshots.

Not covered by that map (source manually): all Widex keys (brand absent from
the catalog), older generations (`signia-pure-nx`/`-x`/`-ux`, `oticon-opn`,
`starkey-livio`, `resound-linx-quattro`, `rexton-my-core`), `phonak-naida-infinio`,
`rexton-reach-sr`, `rexton-bicore-bte`, `starkey-genesis-bte`, `resound-key-custom`,
`jabra-enhance-select`, `sennheiser-all-day-clear`, `th5-bte`, `th5-bte-sp`,
`th5-if`, `th19-bte`, `th-custom-ite`, and the remaining OTC tail (Apple, Eargo,
Sony, Lexie, HP).

## Sourcing checklist

### TruHearing — provider portal (portal product pages / Winter 2025 catalog PDF)
| Key | Covers |
|---|---|
| `th7-ric` | TH7 RIC LI Adv/Prem · platform TH7 |
| `th7-sr` | TH7 Slim RIC LI Prem |
| `th7-if` | TH7 Instant Fit LI Prem |
| `th-custom-cic` | TH7 custom CIC + IIC, all tiers |
| `th-custom-ite` | TH7 custom ITC + TH6 custom LI (ITE/HS/ITC) |
| `th6-ric` | TH6 RIC Std/Adv/Prem (312 + LI) · platform TH6 |
| `th6-sr` | TH6 Slim RIC LI Prem |
| `th5-if` | TH5 Instant Fit Adv/Prem |
| `th5-bte` | TH5 Standard/Power BTE, hook + thin tube, Adv/Prem · platform TH5 |
| `th5-bte-sp` | TH5 Super Power BTE Adv/Prem |
| `th19-bte` | TH 19 legacy line (comparison catalog only) |

### Signia — WSA brand portal / signia-pro.com (in-house for MHC)
| Key | Covers |
|---|---|
| `signia-pure-ix` | Pure Charge&Go IX · platform IX |
| `signia-pure-ax` | Pure Charge&Go AX · platform AX · legacy Pure 7AX |
| `signia-pure-312-ax` | Pure 312 AX |
| `signia-pure-ux` | Pure Charge&Go UX (custom catalog entry) |
| `signia-pure-nx` | platform Nx · legacy Pure 7Nx · Costco KS8 |
| `signia-pure-x` | platform X (comparison catalog only) |
| `signia-styletto` | Styletto IX + AX |
| `signia-motion` | Motion Charge&Go IX + AX |
| `signia-silk` | Silk Charge&Go IX |
| `signia-active` | Active IX / Active Pro IX |
| `signia-insio-ite` | Insio ITE — IX + Charge&Go AX |
| `signia-insio-itc` | Insio ITC — IX + Charge&Go AX |
| `signia-insio-cic` | Insio CIC — IX + Charge&Go AX |
| `signia-insio-iic` | Insio IIC IX |

### Rexton — rexton.com pro portal (WSA)
| Key | Covers |
|---|---|
| `rexton-reach-ric` | Reach R / R Plus · platform Reach |
| `rexton-reach-sr` | Reach Style Line (Slim RIC) |
| `rexton-inox-cic` | Reach + BiCore inoX CIC |
| `rexton-bicore-ric` | BiCore R-Li / R 312 · platform BiCore |
| `rexton-bicore-sr` | BiCore Slim RIC |
| `rexton-bicore-bte` | BiCore BTE |
| `rexton-custom` | BiCore Custom Li |
| `rexton-motion-core` | platform Motion Core (M-Core, comparison only) |
| `rexton-my-core` | platform My Core (Stellar/Emerald 8C era, comparison only) |

### Phonak — phonak.com press / phonakpro
| Key | Covers |
|---|---|
| `phonak-audeo-infinio` | Audéo Infinio · platform Infinio |
| `phonak-sphere-infinio` | Audéo Sphere Infinio |
| `phonak-audeo-infinio-ultra` | platform Infinio Ultra |
| `phonak-audeo-lumity` | Audéo Lumity · platform Lumity · legacy L90 |
| `phonak-audeo-paradise` | platform Paradise · legacy P90 · Costco KS10 |
| `phonak-audeo-marvel` | platform Marvel · legacy M90 · Costco KS9 |
| `phonak-naida-infinio` | Naída Infinio |
| `phonak-naida-lumity` | Naída Lumity |
| `phonak-virto` | Virto Infinio customs |

### Oticon — oticon.com press
| Key | Covers |
|---|---|
| `oticon-intent` | Intent · platform Intent |
| `oticon-real` | Real · platform Real |
| `oticon-more` | platform More · legacy More 1 |
| `oticon-opn` | platform Opn S · legacy Opn 1 |
| `oticon-own` | Own / Own Intent customs |
| `oticon-xceed` | Xceed power BTE |
| `oticon-zeal` | platform Zeal (NXT instant-fit, comparison only) |

### ReSound — resound.com press
| Key | Covers |
|---|---|
| `resound-vivia` | Vivia · platform Vivia |
| `resound-nexia-ric` | Nexia RIE · platform Nexia · legacy Nexia 9 |
| `resound-nexia-custom` | Nexia customs |
| `resound-omnia` | platform OMNIA (comparison only) |
| `resound-one` | platform ONE · legacy ONE 9 |
| `resound-linx-quattro` | platform LiNX Quattro (comparison only) |
| `resound-key-ric` | Key RIC/BTE |
| `resound-key-custom` | Key customs |
| `resound-savi` | Savi |
| `resound-enzo-q` | ENZO Q super power |

### Starkey — starkey.com press
| Key | Covers |
|---|---|
| `starkey-genesis-ric` | Genesis AI / Edge AI / Omega AI RICs (shared shell) · legacy Genesis AI 24 |
| `starkey-genesis-bte` | Genesis AI / Edge AI / Omega AI BTEs |
| `starkey-genesis-custom` | Genesis AI / Edge AI / Omega AI customs |
| `starkey-evolv-ai` | platform Evolv AI (comparison only) |
| `starkey-livio` | platforms Livio / Livio AI / Livio Edge AI · legacy Livio AI 2400 |
| `starkey-g-series` | platform G Series AI (Costco, comparison only) |

### Widex — WSA brand portal
| Key | Covers |
|---|---|
| `widex-moment-ric` | platform Moment RIC · legacy Moment 440 |
| `widex-moment-sheer` | Moment Sheer sRIC · legacy Sheer 440 |
| `widex-moment-bte` | Moment BTE |
| `widex-moment-custom` | Moment customs |
| `widex-smartric` | platform SmartRIC (comparison only) |
| `widex-allure` | platform Allure (comparison only) |
| `widex-evoke` | platform Evoke (comparison only) |

### Relate (UHCH exclusive line) — TruHearing/UHCH portal
| Key | Covers |
|---|---|
| `relate-ric` | Relate 4.0 + 5.0 RIC |
| `relate-bte` | Relate 4.0 BTE |
| `relate-custom` | Relate 5.0 customs |

### Comparison-catalog only (press pages; lower priority)
| Key | Covers |
|---|---|
| `unitron-moxi` | Unitron Discover / Blu / Vivante / Smile (Moxi shell) |
| `philips-hearlink` | Philips HearLink 9010–9050 (miniRITE shell) |
| `jabra-enhance-pro` | Jabra Enhance Pro 10 / 20 / 30 |
| `jabra-enhance-select` | Jabra Enhance Select (OTC) |
| `apple-airpods-pro-2` | AirPods Pro 2 hearing-aid feature |
| `eargo-cic` | Eargo 7 + 8 |
| `eargo-link` | Link by Eargo |
| `sony-cre-c10` / `sony-cre-c20` / `sony-cre-e10` | Sony OTC line |
| `sennheiser-all-day-clear` | Sennheiser All-Day Clear |
| `lexie-b` | Lexie B1 / B2 (Bose) |
| `hp-hearing-pro` | HP Hearing Pro |

### Known gaps (deliberately no key)
- `legacy_device` row `costco-ks7` — Signia primax-era Rexton clone; no clean
  press imagery survives. Silhouette fallback covers it.
