import React from "react";

/* ── Catmull-Rom → Cubic Bézier conversion ────────────────────────── */
function catmullRomPath(pts, tension = 0.35) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension / 3;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension / 3;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension / 3;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension / 3;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/* ── Chart constants ──────────────────────────────────────────────── */
const W = 720, H = 340;
const ML = 18, MR = 20, MT = 32, MB = 84; // MB leaves a band for the warranty bar
const PW = W - ML - MR;  // plot width
const PH = H - MT - MB;  // plot height

const toY = (ability) => MT + (1 - ability) * PH;
const NORMAL = 0.95; // "normal hearing" reference

// Milestones along x-axis (proportional positions within plot area)
const milestones = [
  { label: "Get Hearing\nAids",  xPct: 0.00 },
  { label: "AHT 1",             xPct: 0.20 },
  { label: "AHT 2",             xPct: 0.40 },
  { label: "AHT 3",             xPct: 0.60 },
  { label: "AHT 4",             xPct: 0.78 },
  { label: "Upgrade",           xPct: 1.00 },
];
const msX = (pct) => ML + pct * PW;

// Curve data: [xPct, ability]  — defines the sawtooth shape
const CURVE = [
  [0.00, 0.18],  // before aids — low
  [0.04, 0.40],  // early adaptation
  [0.09, 0.70],  // mid adaptation
  [0.13, 0.90],  // near normal — adaptation peak
  [0.20, 0.70],  // gradual decline → AHT 1
  [0.22, 0.87],  // AHT 1 recalibration bump
  [0.40, 0.64],  // decline → AHT 2
  [0.42, 0.82],  // AHT 2 recalibration
  [0.60, 0.57],  // decline → AHT 3
  [0.62, 0.76],  // AHT 3 recalibration
  [0.78, 0.50],  // decline → AHT 4
  [0.80, 0.71],  // AHT 4 recalibration
  [0.93, 0.48],  // pre-upgrade low
  [0.97, 0.72],  // upgrade mid-rise
  [1.00, 0.92],  // upgrade — back near normal
];

const curvePts = CURVE.map(([xPct, a]) => [msX(xPct), toY(a)]);

// Ability at an arbitrary point along the journey (linear interpolation
// between CURVE points) — used to drop the "you are here" marker on the line.
function abilityAt(xPct) {
  if (xPct <= CURVE[0][0]) return CURVE[0][1];
  const last = CURVE[CURVE.length - 1];
  if (xPct >= last[0]) return last[1];
  for (let i = 0; i < CURVE.length - 1; i++) {
    const [x0, a0] = CURVE[i];
    const [x1, a1] = CURVE[i + 1];
    if (xPct >= x0 && xPct <= x1) {
      return a0 + (a1 - a0) * ((xPct - x0) / (x1 - x0));
    }
  }
  return last[1];
}

/**
 * "Your Hearing Journey" infographic.
 *
 * @param position      0–1, where the patient sits along the 5-year journey
 *                      (0 = just getting hearing aids). Drops a "you are here"
 *                      marker on the trend line.
 * @param warrantyYears length of the warranty period, drawn as a coverage bar
 *                      under the timeline (the full 5-year span = full width).
 */
export default function CareJourney({ position = 0, warrantyYears = 4 }) {
  const pos = Math.max(0, Math.min(1, position));
  const wYears = Math.max(0, Math.min(5, warrantyYears));

  const curvePath = catmullRomPath(curvePts, 0.35);
  // Fill path closes down to bottom of plot area
  const firstPt = curvePts[0];
  const lastPt = curvePts[curvePts.length - 1];
  const fillPath = `${curvePath} L ${lastPt[0]},${toY(0)} L ${firstPt[0]},${toY(0)} Z`;

  const normalY = toY(NORMAL);
  const plotMidY = MT + PH / 2;

  // "You are here" marker — placed on the trend line at the patient's position.
  const posX = msX(pos);
  const posY = toY(abilityAt(pos));
  const posLabelAnchor = pos < 0.12 ? "start" : pos > 0.88 ? "end" : "middle";

  // Warranty coverage bar geometry (sits in the bottom margin band).
  const barY = MT + PH + 50;
  const barH = 9;
  const covW = (wYears / 5) * PW;

  return (
    <div style={{
      background: "#ffffff",
      border: "2px solid #e5e7eb",
      borderRadius: 16,
      padding: "20px 12px 12px",
      marginBottom: 20,
    }}>
      <h3 style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 18,
        fontWeight: 700,
        color: "#111827",
        margin: "0 0 8px 8px",
        letterSpacing: "-0.02em",
      }}>
        Your Hearing Journey
      </h3>
      <p style={{
        color: "#6b7280", fontSize: 12.5, margin: "0 0 12px 8px", lineHeight: 1.4,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        How regular care keeps your hearing at its best over five years.
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id="cjFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
          </linearGradient>
          {/* Trend-line gradient — green near normal hearing, warming through
              yellow and orange to red the further ability drops below it. */}
          <linearGradient id="cjLine" gradientUnits="userSpaceOnUse"
            x1="0" y1={toY(0.95)} x2="0" y2={toY(0.15)}>
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="38%" stopColor="#f59e0b" />
            <stop offset="62%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {/* ── Grid lines ─────────────────────────────────── */}
        {[0.25, 0.50, 0.75].map((a) => (
          <line key={a}
            x1={ML} y1={toY(a)} x2={W - MR} y2={toY(a)}
            stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4"
          />
        ))}

        {/* ── Normal hearing reference ───────────────────── */}
        <line
          x1={ML} y1={normalY} x2={W - MR} y2={normalY}
          stroke="#16a34a" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5"
        />
        <text x={W - MR - 2} y={normalY - 6}
          textAnchor="end" fontSize="10" fontFamily="'DM Sans', sans-serif"
          fill="#16a34a" fontWeight="600" opacity="0.7"
        >
          Normal Hearing
        </text>

        {/* ── Y-axis label ───────────────────────────────── */}
        <text
          x={10} y={plotMidY}
          textAnchor="middle" fontSize="9" fontFamily="'DM Sans', sans-serif"
          fill="#9ca3af" fontWeight="500"
          transform={`rotate(-90, 10, ${plotMidY})`}
        >
          Hearing Ability
        </text>

        {/* ── Gradient fill under curve ──────────────────── */}
        <path d={fillPath} fill="url(#cjFill)" />

        {/* ── Main curve — color shifts with hearing ability ─ */}
        <path
          d={curvePath}
          fill="none" stroke="url(#cjLine)" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"
        />

        {/* ── Milestone markers & labels ─────────────────── */}
        {milestones.map((ms, i) => {
          const x = msX(ms.xPct);
          // Find the curve point closest to this milestone
          const closest = curvePts.reduce((best, pt) =>
            Math.abs(pt[0] - x) < Math.abs(best[0] - x) ? pt : best
          , curvePts[0]);
          const cy = closest[1];
          const bottomY = H - MB + 4;
          const lines = ms.label.split("\n");

          return (
            <g key={i}>
              {/* Vertical tick line */}
              <line
                x1={x} y1={cy + 7} x2={x} y2={bottomY}
                stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 3"
              />
              {/* Circle on curve */}
              <circle cx={x} cy={cy} r="4.5"
                fill="#fff" stroke="url(#cjLine)" strokeWidth="2"
              />
              {/* Label below */}
              {lines.map((ln, li) => (
                <text key={li}
                  x={x} y={bottomY + 10 + li * 12}
                  textAnchor="middle" fontSize="9.5"
                  fontFamily="'DM Sans', sans-serif"
                  fill="#6b7280" fontWeight="600"
                >
                  {ln}
                </text>
              ))}
            </g>
          );
        })}

        {/* ── Upgrade arrow indicator ────────────────────── */}
        <polygon
          points={`${msX(1.0) - 5},${toY(0.92) - 12} ${msX(1.0) + 5},${toY(0.92) - 12} ${msX(1.0)},${toY(0.92) - 20}`}
          fill="#16a34a" opacity="0.7"
        />

        {/* ── "You are here" position marker ─────────────── */}
        <g>
          <circle cx={posX} cy={posY} r="13" fill="#0a1628" opacity="0.12" />
          <circle cx={posX} cy={posY} r="7"
            fill="#0a1628" stroke="#ffffff" strokeWidth="2.5"
          />
          <text
            x={posX} y={posY - 17}
            textAnchor={posLabelAnchor} fontSize="9.5" fontWeight="700"
            fill="#0a1628" fontFamily="'DM Sans', sans-serif"
          >
            You are here
          </text>
        </g>

        {/* ── Warranty coverage bar ──────────────────────── */}
        <text x={ML} y={barY - 9}
          fontSize="10" fontWeight="700" fill="#374151"
          fontFamily="'DM Sans', sans-serif"
        >
          {wYears}-Year Warranty Coverage
        </text>
        <rect x={ML} y={barY} width={PW} height={barH} rx={barH / 2} fill="#f3f4f6" />
        <rect x={ML} y={barY} width={covW} height={barH} rx={barH / 2} fill="#16a34a" />
      </svg>
    </div>
  );
}
