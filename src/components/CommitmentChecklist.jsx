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

import { useState } from "react";

// CommitmentChecklist — provider close checklist on the final wizard
// step (Narrative Thread Chapter 5). Intentionally not persisted: it's
// an in-the-room prompt for the close conversation, not chart data, so
// checked state resets when the step unmounts.

const ITEMS = [
  "Treatment plan reviewed with the patient",
  "Fitting date confirmed and what to expect explained",
  "Day-2 follow-up call scheduled before the patient leaves",
  "Adaptation period set — realistic week-one expectations",
  "Warranty timeline walked through, anchored to the fitting date",
  "Care plan coverage reviewed — cleanings, follow-ups, loss & damage",
  "Patient's remaining questions answered",
];

const NAVY = "#0a1628";
const BORDER = "#e5e7eb";
const SUBDUED = "#6b7280";
const TEAL = "#0A7B8C";
const PANEL_BG = "#f8fafc";

export default function CommitmentChecklist() {
  const [checked, setChecked] = useState({});
  const done = ITEMS.reduce((n, _, i) => (checked[i] ? n + 1 : n), 0);
  const allDone = done === ITEMS.length;

  return (
    <div style={{ marginTop: 16, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", background: PANEL_BG, borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEAL }}>
          Provider Checklist
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: allDone ? "#15803d" : SUBDUED }}>
          {done}/{ITEMS.length}
        </span>
      </div>
      <div style={{ padding: "2px 14px" }}>
        {ITEMS.map((item, i) => (
          <label key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0",
            borderBottom: i < ITEMS.length - 1 ? "1px solid #f1f5f9" : "none",
            cursor: "pointer",
          }}>
            <input
              type="checkbox"
              checked={!!checked[i]}
              onChange={() => setChecked(c => ({ ...c, [i]: !c[i] }))}
              style={{ marginTop: 1, width: 16, height: 16, accentColor: TEAL, cursor: "pointer", flexShrink: 0 }}
            />
            <span style={{
              fontSize: 13, lineHeight: 1.45,
              color: checked[i] ? SUBDUED : NAVY,
              textDecoration: checked[i] ? "line-through" : "none",
            }}>
              {item}
            </span>
          </label>
        ))}
      </div>
      <div style={{
        padding: "8px 14px", background: PANEL_BG, borderTop: `1px solid ${BORDER}`,
        fontSize: 10, color: SUBDUED,
      }}>
        Provider reference — not part of the patient record.
      </div>
    </div>
  );
}
