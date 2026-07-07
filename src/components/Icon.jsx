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

// Inline line-icon set for Distil's nav + chrome — replaces the emoji glyphs.
// Stroke-based, inherits color (currentColor) and sizing from the parent, so
// an icon picks up the nav item's text color (brass when active, etc.).

const PATHS = {
  dashboard: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/></>,
  users: <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.3a3.2 3.2 0 0 1 0 6.1"/><path d="M17.6 14.7A5.5 5.5 0 0 1 20.5 20"/></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3.5v3M16 3.5v3"/></>,
  chart: <><path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/></>,
  campaign: <><path d="M21 4 3 11l6 2 2 6 10-15Z"/><path d="M9 13l2.6-2.6"/></>,
  book: <><path d="M5 4.5h9.5a2.5 2.5 0 0 1 2.5 2.5V21a2.5 2.5 0 0 0-2.5-2.5H5Z"/><path d="M5 4.5A2.5 2.5 0 0 0 2.5 7v11.5A2.5 2.5 0 0 1 5 16"/></>,
  medal: <><circle cx="12" cy="14.5" r="4.8"/><path d="M8.7 10 6.5 4M15.3 10l2.2-6M9.7 4h4.6"/><path d="m10.2 14.3 1.3 1.3 2.4-2.5"/></>,
  badge: <><rect x="4" y="4.5" width="16" height="15" rx="2.5"/><circle cx="12" cy="10.8" r="2.3"/><path d="M8.6 16.4a3.5 3.5 0 0 1 6.8 0"/><path d="M10 4.5v-.8h4v.8"/></>,
  shield: <><path d="M12 3.5 5 6v5.5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6Z"/><path d="m9.4 11.6 1.9 1.9 3.4-3.7"/></>,
  clipboard: <><rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5v-.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.8H9Z"/><path d="M8.6 10h6.8M8.6 13.5h6.8M8.6 17h4"/></>,
  settings: <><path d="M5 7h9M5 12h14M5 17h7"/><circle cx="17" cy="7" r="2.1"/><circle cx="9" cy="17" r="2.1"/></>,
  inbox: <><path d="M3.5 13 6 5.6A2 2 0 0 1 7.9 4.2h8.2A2 2 0 0 1 18 5.6L20.5 13"/><path d="M3.5 13v5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5"/><path d="M3.5 13h4.2l1.4 2.5h5.8l1.4-2.5h4.2"/></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8a2 2 0 0 1 2-2H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8Z"/><circle cx="8" cy="8" r="1.4"/></>,
  percent: <><path d="M18.5 5.5 5.5 18.5"/><circle cx="7.8" cy="7.8" r="2.3"/><circle cx="16.2" cy="16.2" r="2.3"/></>,
  compare: <><rect x="3" y="4.5" width="8" height="15" rx="1.8"/><rect x="13" y="4.5" width="8" height="15" rx="1.8"/><path d="M5.5 15h3M15.5 10.5h3"/></>,
  pin: <><path d="M12 21.5S5.5 15.8 5.5 10.8a6.5 6.5 0 0 1 13 0c0 5-6.5 10.7-6.5 10.7Z"/><circle cx="12" cy="10.6" r="2.3"/></>,
  archive: <><rect x="3.5" y="4" width="17" height="4" rx="1"/><path d="M5 8v10.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V8"/><path d="M9.6 12h4.8"/></>,
};

export default function Icon({ name, size = 18, strokeWidth = 1.75, style }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }} aria-hidden="true"
    >
      {path}
    </svg>
  );
}
