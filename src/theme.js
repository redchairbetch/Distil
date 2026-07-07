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

// ── Distil Design System — "Clinical-luxe" tokens ───────────────────────────
// Single source of truth for color, type, elevation, and shape. Replaces the
// scattered per-file color constants (the Distil.jsx <style> block, the
// DeviceSelection COLOR object, TierSelection's TEAL/RECOMMEND/etc.) as screens
// migrate onto it.
//
// Direction: warm paper canvas · near-black warm ink · pine/teal as the brand ·
// BRASS reserved strictly for VALUE moments (price, savings, premium tier, the
// number that helps the patient). This unifies the CRM with the IntakeKiosk's
// teal (#0A7B8C) and the Login's gold (#EAAC15), which were already pulling in
// this direction. Ties to branding backlog (context.md Distil #11).

export const COLOR = {
  // Surfaces
  paper:     '#F4F1EA', // warm bone canvas (replaces the muddy #1e293b slate)
  paper2:    '#EDE9DF', // recessed wells / hover
  card:      '#FFFFFF',
  cream:     '#FCF8EF', // warm card for the "money" moment in the reveal

  // Ink / text
  ink:       '#16201D', // primary text — near-black, faint warm/teal cast
  ink2:      '#54625C', // secondary
  ink3:      '#9AA39B', // tertiary / muted labels
  line:      '#E4E0D5', // hairline border on paper
  line2:     '#EFECE3', // lightest divider

  // Brand — pine / teal
  sidebar:   '#0C211E', // deep ink-teal sidebar (replaces navy #0a1628)
  pine:      '#0B4A42', // primary deep teal — dark surfaces, primary CTA
  pineHover: '#0E5A50',
  teal:      '#1B8A7A', // interactive teal
  tealSoft:  '#E2EFEA', // teal tint background
  tealInk:   '#0C4A40', // text on tealSoft

  // Value — brass (money / premium / "the helping number" ONLY)
  brass:     '#B5832E',
  brass2:    '#C79A3F', // brighter, for use on dark surfaces
  brassSoft: '#F4EAD4',
  brassInk:  '#6E4E16', // text on brassSoft

  // Semantic
  danger:     '#C7553C', // warranty expired / alerts (warmer than #ef4444)
  dangerSoft: '#F6E4DE',
  dangerInk:  '#9A3A26',
  warn:       '#B5832E', // warranty warning reuses brass
  warnSoft:   '#F4EAD4',
};

export const FONT = {
  display: "'Fraunces', Georgia, serif",    // headings, hero numbers, prices
  ui:      "'Sora', system-ui, sans-serif", // body, labels, controls
  mono:    "'JetBrains Mono', monospace",   // IDs, serials, data
};

// Layered soft shadows — the depth the current flat 1px-border UI is missing.
export const SHADOW = {
  sm: '0 1px 2px rgba(16,32,28,.05), 0 1px 3px rgba(16,32,28,.04)',
  md: '0 1px 2px rgba(16,32,28,.04), 0 12px 28px -18px rgba(16,32,28,.40)',
  lg: '0 8px 16px -8px rgba(16,32,28,.14), 0 24px 48px -20px rgba(16,32,28,.40)',
};

export const RADIUS = { sm: 8, md: 10, lg: 12, xl: 14, pill: 999 };

export const theme = { color: COLOR, font: FONT, shadow: SHADOW, radius: RADIUS };

// CSS custom properties, for injection into existing <style> template strings
// (e.g. Distil.jsx's `styles`). Prepend `${cssVars}` then reference
// var(--dx-paper), var(--dx-pine), var(--dx-brass), etc. Prefixed --dx- to
// avoid collisions with any host/component variables.
export const cssVars = `:root{
  --dx-paper:${COLOR.paper}; --dx-paper2:${COLOR.paper2}; --dx-card:${COLOR.card}; --dx-cream:${COLOR.cream};
  --dx-ink:${COLOR.ink}; --dx-ink2:${COLOR.ink2}; --dx-ink3:${COLOR.ink3};
  --dx-line:${COLOR.line}; --dx-line2:${COLOR.line2};
  --dx-sidebar:${COLOR.sidebar}; --dx-pine:${COLOR.pine}; --dx-pine-hover:${COLOR.pineHover};
  --dx-teal:${COLOR.teal}; --dx-teal-soft:${COLOR.tealSoft}; --dx-teal-ink:${COLOR.tealInk};
  --dx-brass:${COLOR.brass}; --dx-brass2:${COLOR.brass2}; --dx-brass-soft:${COLOR.brassSoft}; --dx-brass-ink:${COLOR.brassInk};
  --dx-danger:${COLOR.danger}; --dx-danger-soft:${COLOR.dangerSoft}; --dx-danger-ink:${COLOR.dangerInk};
  --dx-font-display:${FONT.display}; --dx-font-ui:${FONT.ui}; --dx-font-mono:${FONT.mono};
  --dx-shadow-sm:${SHADOW.sm}; --dx-shadow-md:${SHADOW.md}; --dx-shadow-lg:${SHADOW.lg};
}`;

export default theme;
