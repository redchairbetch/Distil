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

import React from "react";

// ── PATIENT-FACING DISPLAY LANGUAGE TOGGLE ────────────────────────────────────
// Small EN/ES pill pair rendered inside patient-facing surfaces (Consultation
// Mode, Presentation, Pricing Reveal, …) so the provider can flip the display
// language live mid-appointment. Session-only — never writes the patient's
// stored preference. Provider chrome stays English.
export default function LangToggle({ lang, onChange }) {
  return (
    <div style={{display:"inline-flex",border:"1px solid #d1d5db",borderRadius:8,overflow:"hidden",flexShrink:0}}>
      {[["en","EN"],["es","ES"]].map(([l,label])=>(
        <button key={l} onClick={()=>onChange(l)}
          style={{padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",border:"none",fontFamily:"'Sora',sans-serif",letterSpacing:0.5,
            background: lang===l ? "#0a1628" : "#fff",
            color: lang===l ? "#fff" : "#6b7280"}}>
          {label}
        </button>
      ))}
    </div>
  );
}
