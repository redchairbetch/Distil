import { describe, it, expect } from "vitest";
import {
  BODY_STYLE_STATS, STAT_KEYS,
  POWER_GATE_SEVERE, POWER_GATE_PROFOUND, OCCLUSION_LOW_FREQ_DB, STEEP_SLOPE_DB,
  styleMetrics, recommendBodyStyles,
} from "./bodyStyleRec.js";

// Flat audiogram at one level across the PTA + rule frequencies.
const flat = (db) => ({ 250: db, 500: db, 1000: db, 2000: db, 4000: db });

const aud = (rightT, leftT) => ({ rightT, leftT });

describe("bodyStyleRec — stat table", () => {
  it("covers all seven body styles with all six stats in the 1–5 range", () => {
    const styles = Object.keys(BODY_STYLE_STATS);
    expect(styles.sort()).toEqual(["bte", "cic", "if", "iic", "itc", "ite", "ric"].sort());
    for (const id of styles) {
      for (const { id: stat } of STAT_KEYS) {
        const v = BODY_STYLE_STATS[id][stat];
        expect(v, `${id}.${stat}`).toBeGreaterThanOrEqual(1);
        expect(v, `${id}.${stat}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it("exports the clinical thresholds as plain calibratable numbers", () => {
    expect(POWER_GATE_SEVERE).toBe(70);
    expect(POWER_GATE_PROFOUND).toBe(85);
    expect(OCCLUSION_LOW_FREQ_DB).toBe(30);
    expect(STEEP_SLOPE_DB).toBe(40);
  });
});

describe("bodyStyleRec — metrics", () => {
  it("takes the worse ear's PTA and the better ear's low-frequency average", () => {
    const m = styleMetrics(aud(flat(80), flat(35)));
    expect(m.worsePta).toBe(80);
    expect(m.betterLowAvg).toBe(35);
  });

  it("returns no data (and no annotations) when the audiogram is empty", () => {
    const r = recommendBodyStyles(aud({}, {}));
    expect(r.metrics.hasData).toBe(false);
    expect(r.summary).toBeNull();
    for (const s of Object.values(r.byStyle)) {
      expect(s.status).toBe("ok");
      expect(s.notes).toEqual([]);
    }
  });
});

describe("bodyStyleRec — power gates", () => {
  it("severe-profound loss blocks CIC / IIC / IF as underpowered", () => {
    const r = recommendBodyStyles(aud(flat(90), flat(90)));
    for (const id of ["cic", "iic", "if"]) {
      expect(r.byStyle[id].status, id).toBe("blocked");
      expect(r.byStyle[id].badge, id).toBe("Not enough power");
    }
  });

  it("severe-profound loss flags RIC as HP-receiver-plus-earmold and badges BTE as the power match", () => {
    const r = recommendBodyStyles(aud(flat(90), flat(90)));
    expect(r.byStyle.ric.status).toBe("caution");
    expect(r.byStyle.ric.badge).toBe("HP receiver + earmold");
    expect(r.byStyle.bte.status).toBe("recommended");
    expect(r.byStyle.bte.badge).toBe("Power match");
  });

  it("severe (70–84 dB) loss cautions the small shells without blocking them", () => {
    const r = recommendBodyStyles(aud(flat(75), flat(75)));
    for (const id of ["cic", "iic", "if"]) {
      expect(r.byStyle[id].status, id).toBe("caution");
    }
    expect(r.byStyle.ric.badge).toBe("HP receiver + earmold");
  });

  it("gates on the WORSE ear even when the better ear is mild", () => {
    const r = recommendBodyStyles(aud(flat(30), flat(90)));
    expect(r.byStyle.cic.status).toBe("blocked");
  });

  it("moderate loss leaves every style un-gated", () => {
    const r = recommendBodyStyles(aud(flat(50), flat(50)));
    for (const id of ["ric", "bte", "ite", "itc", "cic", "iic", "if"]) {
      expect(["ok", "caution"]).toContain(r.byStyle[id].status);
      expect(r.byStyle[id].badge).not.toBe("Not enough power");
    }
  });
});

describe("bodyStyleRec — occlusion", () => {
  it("preserved lows (better-ear ≤ 30 dB) caution the closed customs", () => {
    // Lows 20, flat 50s elsewhere → no power gate, occlusion rule fires.
    const ear = { 250: 20, 500: 20, 1000: 50, 2000: 55, 4000: 55 };
    const r = recommendBodyStyles(aud(ear, ear));
    for (const id of ["ite", "itc", "cic", "iic"]) {
      expect(r.byStyle[id].status, id).toBe("caution");
      expect(r.byStyle[id].notes.join(" "), id).toMatch(/occlusion/i);
    }
    // Non-sealing styles carry no occlusion note.
    expect(r.byStyle.ric.notes.join(" ")).not.toMatch(/occlusion/i);
  });

  it("elevated lows raise no occlusion caution", () => {
    const r = recommendBodyStyles(aud(flat(50), flat(50)));
    for (const id of ["ite", "itc", "cic", "iic"]) {
      expect(r.byStyle[id].notes.join(" "), id).not.toMatch(/occlusion/i);
    }
  });
});

describe("bodyStyleRec — steep slope", () => {
  it("a ≥40 dB slope with preserved lows badges RIC as the textbook match", () => {
    const ski = { 250: 15, 500: 20, 1000: 35, 2000: 50, 4000: 65 };
    const r = recommendBodyStyles(aud(ski, ski));
    expect(r.byStyle.ric.status).toBe("recommended");
    expect(r.byStyle.ric.badge).toBe("Textbook match");
  });

  it("a steep slope WITHOUT preserved lows earns no RIC badge", () => {
    const slope = { 250: 40, 500: 45, 1000: 55, 2000: 70, 4000: 90 };
    const r = recommendBodyStyles(aud(slope, slope));
    expect(r.byStyle.ric.badge).not.toBe("Textbook match");
  });
});

describe("bodyStyleRec — narratable summary", () => {
  it("opens with 'From today's test results' and names the power finding when gated", () => {
    const r = recommendBodyStyles(aud(flat(90), flat(90)));
    expect(r.summary).toMatch(/^From today's test results/);
    expect(r.summary).toMatch(/power/i);
  });

  it("still returns a narratable no-restrictions summary for a benign audiogram", () => {
    const r = recommendBodyStyles(aud(flat(45), flat(45)));
    expect(r.summary).toMatch(/^From today's test results/);
    expect(r.summary).toMatch(/no style is ruled out/i);
  });
});
