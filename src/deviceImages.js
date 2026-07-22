/*!
 * Distil — hearing clinic patient management & intake system
 *
 * Copyright (c) 2026 Kurt Mooney. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL. This source code is the exclusive property of
 * the copyright holder. Unauthorized copying, distribution, modification, or
 * use of this file, in whole or in part, via any medium, is strictly
 * prohibited without the prior written permission of the copyright holder.
 * See the LICENSE file at the repository root for full terms.
 */

// ── deviceImages.js — device product-photo resolver ──────────────────────────
// Maps an image_key (from product_catalog / device_platforms / legacy_device)
// to a bundled photo in src/assets/devices/. Drop a file named <image_key>.webp
// (or .png/.jpg) into that folder and every catalog row sharing the key picks
// it up on the next build — no code change. Keys are shell-level: tech levels
// and colors share one photo, and white-labels reuse the donor image (KS9 →
// phonak-audeo-marvel). See src/assets/devices/MANIFEST.md for the full key
// list and sourcing notes.
//
// deviceImageUrl() returns null for a missing key or file, and callers render
// nothing (or their existing body-style silhouette) in that case — partial
// coverage must never break a layout.

const DEVICE_IMAGE_FILES = import.meta.glob(
  './assets/devices/*.{png,webp,jpg,jpeg}',
  { eager: true, import: 'default' }
)

const byKey = {}
for (const [path, url] of Object.entries(DEVICE_IMAGE_FILES)) {
  const stem = path.replace(/^.*\//, '').replace(/\.[^.]+$/, '')
  byKey[stem] = url
}

export function deviceImageUrl(imageKey) {
  return imageKey ? (byKey[imageKey] ?? null) : null
}

// How many keys currently have a shipped asset — handy for the manifest
// checklist and any future admin "coverage" indicator.
export function deviceImageCount() {
  return Object.keys(byKey).length
}
