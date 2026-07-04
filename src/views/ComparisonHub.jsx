// ── ComparisonHub — one home for both device-comparison tools ────────────────
// Two ways to tell the upgrade story, one screen:
//   • "What's changed" — the catalog-driven two-delta story (platform
//     generations + technology level, manufacturer-named capabilities,
//     no percentages patient-side). CapabilityComparison.jsx.
//   • "Environment coverage" — the original Then-vs-Now coverage bars across
//     the nine listening environments. DeviceComparison.jsx.
// Exists so Distil.jsx / main.jsx wiring stays a one-line mount.
import React, { useState } from "react";
import { COLOR, FONT } from "../theme.js";
import CapabilityComparison from "./CapabilityComparison.jsx";
import DeviceComparison from "./DeviceComparison.jsx";

export default function ComparisonHub({ patientId = null, providerMode = false }) {
  const [tab, setTab] = useState("capability");
  const tabs = [
    ["capability", "What's changed"],
    ["coverage", "Environment coverage"],
  ];
  return (
    <div style={{ fontFamily: FONT.ui }}>
      <div style={{ display: "flex", gap: 6, maxWidth: 860, margin: "0 auto", padding: "16px 20px 0" }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: tab === id ? COLOR.card : "transparent",
            border: `1px solid ${tab === id ? COLOR.line : "transparent"}`,
            borderBottomColor: tab === id ? COLOR.card : "transparent",
            borderRadius: "10px 10px 0 0", padding: "8px 16px", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: tab === id ? COLOR.ink : COLOR.ink2 }}>
            {label}
          </button>
        ))}
      </div>
      {tab === "capability"
        ? <CapabilityComparison variant="standalone" patientId={patientId} providerMode={providerMode} />
        : <DeviceComparison variant="standalone" />}
    </div>
  );
}
