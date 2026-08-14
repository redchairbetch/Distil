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
import { fmtDate } from "../lib/dates.js";

// Upgrade Tracking card (patient chart) — year-4 / off-warranty conversation
// outcome. Logging an outcome removes the patient from the follow-up queue's
// "off warranty · no upgrade conversation" bucket.
//
// Extracted from Distil.jsx's renderPatientDetail. The fields save on
// blur/change; a failed write previously vanished into console.error while
// the UI looked saved — this card owns its save status so failures stay
// visible and the entered value isn't lost.

const inputSty = { width: "100%", padding: "8px 10px", border: "1px solid #E4E0D5", borderRadius: 6, fontSize: 13, fontFamily: "'Sora',sans-serif" };
const labelSty = { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#9ca3af", display: "block", marginBottom: 6 };

export default function UpgradeTrackingCard({ patient, onSave }) {
  const [status, setStatus] = useState(null); // null | "saving" | "saved" | {error}
  // Sticky select value so a failed outcome save doesn't snap the dropdown
  // back to the stored value while the error is showing.
  const [outcomeDraft, setOutcomeDraft] = useState(null);

  const save = async (fields) => {
    setStatus("saving");
    try {
      await onSave(fields);
      setOutcomeDraft(null);
      setStatus("saved");
      setTimeout(() => setStatus(s => (s === "saved" ? null : s)), 2000);
    } catch (err) {
      setStatus({ error: err?.message || "Save failed" });
    }
  };

  return (
    <div className="detail-card full">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div className="detail-card-title">Upgrade Tracking</div>
        {status === "saving" && <span style={{ fontSize: 11, color: "#9ca3af" }}>Saving…</span>}
        {status === "saved" && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ Saved</span>}
        {status?.error && (
          <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>
            Save failed — {status.error}. Your entry is still in the field; click away to retry.
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div>
          <label style={labelSty}>Care plan start</label>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0a1628", padding: "8px 0" }}>
            {patient.carePlanStartDate ? fmtDate(patient.carePlanStartDate) : <span style={{ color: "#9ca3af", fontWeight: 400 }}>—</span>}
          </div>
        </div>
        <div>
          <label style={labelSty}>Tier offered</label>
          <input
            type="text"
            placeholder="e.g. Premium IX"
            defaultValue={patient.upgradeTierOffered || ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v === (patient.upgradeTierOffered || "")) return;
              save({ tierOffered: v });
            }}
            style={inputSty}
          />
        </div>
        <div>
          <label style={labelSty}>Outcome</label>
          <select
            value={outcomeDraft ?? patient.upgradeOutcome ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setOutcomeDraft(v);
              save({
                outcome: v,
                // Wipe donation recipient if outcome moves off "donated"
                ...(v !== "donated" ? { donationRecipient: "" } : {}),
              });
            }}
            style={{ ...inputSty, background: "white" }}
          >
            <option value="">— not yet discussed —</option>
            <option value="pending">Pending — conversation started</option>
            <option value="declined">Declined upgrade</option>
            <option value="upgraded">Upgraded</option>
            <option value="reprogrammed">Reprogrammed (kept devices)</option>
            <option value="donated">Donated old aids</option>
          </select>
        </div>
      </div>
      {((outcomeDraft ?? patient.upgradeOutcome) === "donated" || patient.donationRecipient) && (
        <div style={{ marginTop: 14 }}>
          <label style={labelSty}>Donation recipient</label>
          <input
            type="text"
            placeholder="Recipient name or organization"
            defaultValue={patient.donationRecipient || ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v === (patient.donationRecipient || "")) return;
              save({ donationRecipient: v });
            }}
            style={inputSty}
          />
        </div>
      )}
    </div>
  );
}
