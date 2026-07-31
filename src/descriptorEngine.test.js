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

import { describe, it, expect } from 'vitest';
import {
  dbToSeverity, severityRank, degreeAxis, configurationAxis, typeAxis,
  symmetryAxis, clarityAxis, wrsCategory, snrLossCategory, describeAudiogram,
  SEVERITY_LADDER,
} from './descriptorEngine.js';

// Synthetic threshold maps. Frequencies match AUDIG_FREQS.
const flatModerate = { 250: 45, 500: 48, 1000: 50, 2000: 50, 4000: 52, 8000: 50 };
const skiSlope = { 250: 15, 500: 15, 1000: 20, 2000: 35, 3000: 65, 4000: 85, 6000: 90, 8000: 95 };
const slopingHF = { 250: 15, 500: 20, 1000: 30, 2000: 45, 4000: 55, 8000: 60 };
const cookieBite = { 250: 15, 500: 25, 1000: 55, 2000: 50, 4000: 20, 8000: 15 };
const rising = { 250: 60, 500: 55, 1000: 40, 2000: 20, 4000: 15, 8000: 15 };
const noiseNotch = { 250: 15, 500: 15, 1000: 20, 2000: 25, 3000: 45, 4000: 55, 6000: 45, 8000: 25 };
const normalHearing = { 250: 10, 500: 10, 1000: 15, 2000: 15, 4000: 20, 8000: 20 };

describe('dbToSeverity — 9-value ladder with 20 dB normal', () => {
  it('treats 20 dB as normal, not mild (MHC rule)', () => {
    expect(dbToSeverity(20)).toBe('normal');
    expect(dbToSeverity(21)).toBe('normal_mild');
  });
  it('maps representative thresholds up the ladder', () => {
    expect(dbToSeverity(35)).toBe('mild');
    expect(dbToSeverity(50)).toBe('moderate');
    expect(dbToSeverity(65)).toBe('moderate_severe');
    expect(dbToSeverity(80)).toBe('severe');
    expect(dbToSeverity(100)).toBe('profound');
  });
  it('returns null for missing input', () => {
    expect(dbToSeverity(null)).toBeNull();
    expect(dbToSeverity(undefined)).toBeNull();
  });
  it('every band label is on the ladder', () => {
    for (const db of [0, 22, 35, 43, 50, 65, 80, 88, 120]) {
      expect(SEVERITY_LADDER).toContain(dbToSeverity(db));
    }
  });
});

describe('degreeAxis — span, not a value', () => {
  it('renders equal endpoints as a single term', () => {
    const d = degreeAxis(flatModerate);
    expect(d.status).toBe('ok');
    expect(d.mildest).toBe(d.worst);
    expect(d.clinical).toMatch(/moderate degree/);
  });
  it('renders unequal endpoints as a sloping range', () => {
    const d = degreeAxis(skiSlope);
    expect(d.mildest).not.toBe(d.worst);
    expect(d.direction).toBe('sloping');
    expect(d.clinical).toMatch(/sloping to/);
    // Worst endpoint reaches the profound tail at 8 kHz.
    expect(severityRank(d.worst)).toBeGreaterThanOrEqual(severityRank('severe'));
  });
  it('flags a rising loss as rising', () => {
    const d = degreeAxis(rising);
    expect(d.direction).toBe('rising');
  });
  it('is absent with fewer than two thresholds', () => {
    expect(degreeAxis({ 500: 40 }).status).toBe('absent');
    expect(degreeAxis(null).status).toBe('absent');
  });
});

describe('configurationAxis — coarse, atypical is first-class', () => {
  it('names a ski-slope', () => {
    expect(configurationAxis(skiSlope).pattern).toBe('ski_slope');
  });
  it('names a sloping high-frequency loss', () => {
    expect(configurationAxis(slopingHF).pattern).toBe('sloping_high_frequency');
  });
  it('names a cookie-bite', () => {
    expect(configurationAxis(cookieBite).pattern).toBe('cookie_bite');
  });
  it('names a rising loss', () => {
    expect(configurationAxis(rising).pattern).toBe('rising');
  });
  it('names a flat loss', () => {
    expect(configurationAxis(flatModerate).pattern).toBe('flat');
  });
  it('carries a noise-notch etiology hint (PROVIDER-ONLY), not a notch shape name', () => {
    const c = configurationAxis(noiseNotch);
    // A notch is a hypothesis, not a patient-facing shape — it rides on the
    // shape name as a provider hint, never as its own classification.
    expect(c.pattern).not.toBe('notch');
    expect(c.etiologyHint).toMatch(/noise exposure/);
    expect(c.etiologyHint).toMatch(/not diagnostic/);
    // The hint is never a patient-facing field.
    expect(c.plain).toBeNull();
  });
  it('returns atypical (not flat) for a shape that fits nothing', () => {
    // Jagged, non-monotonic, no clean slope/bite/notch.
    const messy = { 250: 55, 500: 20, 1000: 60, 2000: 25, 4000: 50, 8000: 30 };
    const c = configurationAxis(messy);
    expect(c.pattern).toBe('atypical');
    expect(c.status).toBe('atypical');
  });
  it('is undetermined (never a default) when octaves are missing', () => {
    expect(configurationAxis({ 250: 20, 8000: 40 }).status).toBe('undetermined');
  });
});

describe('typeAxis — AC–BC gap, BC-missing is degraded not defaulted', () => {
  const ac = { 500: 50, 1000: 55, 2000: 55, 4000: 60 };
  it('sensorineural when air and bone track together', () => {
    const bc = { 500: 48, 1000: 52, 2000: 53, 4000: 58 };
    expect(typeAxis(ac, bc).type).toBe('sensorineural');
  });
  it('conductive when a large gap sits over normal bone', () => {
    const bcNormal = { 500: 5, 1000: 10, 2000: 10, 4000: 15 };
    const acGap = { 500: 45, 1000: 50, 2000: 45, 4000: 50 };
    expect(typeAxis(acGap, bcNormal).type).toBe('conductive');
  });
  it('mixed when a gap sits over elevated bone', () => {
    const bcElevated = { 500: 30, 1000: 35, 2000: 35, 4000: 40 };
    expect(typeAxis(ac, bcElevated).type).toBe('mixed');
  });
  it('is undetermined (not sensorineural) when BC is absent', () => {
    const t = typeAxis(ac, null);
    expect(t.status).toBe('undetermined');
    expect(t.reason).toBe('bc_missing');
    expect(t.type).toBeNull();
  });
});

describe('symmetryAxis — two rules, different thresholds', () => {
  it('symmetric below the narrative threshold', () => {
    const s = symmetryAxis(flatModerate, flatModerate);
    expect(s.separateEars).toBe(false);
    expect(s.referralFlag).toBe(false);
  });
  it('triggers the narrative rule at a 15 dB PTA difference', () => {
    const worse = { 250: 60, 500: 65, 1000: 65, 2000: 68, 4000: 70, 8000: 70 };
    const s = symmetryAxis(worse, flatModerate);
    expect(s.separateEars).toBe(true);
  });
  it('sets the referral flag tighter than the narrative rule', () => {
    // 20 dB at a single frequency: below a 15 dB PTA diff can still flag referral.
    const right = { 250: 15, 500: 20, 1000: 20, 2000: 20, 4000: 45, 8000: 20 };
    const left = { 250: 15, 500: 20, 1000: 20, 2000: 20, 4000: 20, 8000: 20 };
    const s = symmetryAxis(right, left);
    expect(s.referralFlag).toBe(true);
  });
  it('is undetermined when an ear is missing', () => {
    expect(symmetryAxis(flatModerate, null).status).toBe('undetermined');
  });
});

describe('clarity axis — never collapsed into degree', () => {
  it('categorizes WRS and QuickSIN SNR loss', () => {
    expect(wrsCategory(96)).toBe('excellent');
    expect(wrsCategory(40)).toBe('poor');
    expect(wrsCategory(20)).toBe('very_poor');
    expect(snrLossCategory(2)).toBe('normal');
    expect(snrLossCategory(5)).toBe('mild');
    expect(snrLossCategory(12)).toBe('moderate');
    expect(snrLossCategory(20)).toBe('severe');
  });
  it('flags clarity contradicting degree: mild degree, poor discrimination', () => {
    const c = clarityAxis({
      wrsRight: 40, wrsLeft: 90, sinScore: null,
      degreeWorstByEar: { right: 'mild', left: 'mild' },
    });
    expect(c.clarityVsDegree).not.toBeNull();
    expect(c.clarityVsDegree.some(x => x.ear === 'right')).toBe(true);
  });
  it('flags severe SNR loss at a mild degree (the QuickSIN dissociation)', () => {
    const c = clarityAxis({
      wrsRight: 92, wrsLeft: 92, sinScore: 18, sinTest: 'quicksin',
      degreeWorstByEar: { right: 'mild', left: 'mild' },
    });
    expect(c.clarityVsDegree.some(x => x.snrLoss === 'severe')).toBe(true);
  });
  it('reports absent clarity explicitly when nothing was measured', () => {
    const c = clarityAxis({ degreeWorstByEar: { right: 'moderate', left: 'moderate' } });
    expect(c.status).toBe('absent');
    expect(c.reason).toBe('no_clarity_measures');
  });
  it('marks QuickSIN absent without inventing a value', () => {
    const c = clarityAxis({ wrsRight: 88, degreeWorstByEar: { right: 'moderate' } });
    expect(c.snr.status).toBe('absent');
  });
});

describe('describeAudiogram — composition and patient phrasing discipline', () => {
  it('composes a clinical sentence and leaves plain phrasing pending', () => {
    const r = describeAudiogram({
      right: slopingHF, left: slopingHF,
      rightBC: { 500: 18, 1000: 28, 2000: 43, 4000: 53 },
      leftBC: { 500: 18, 1000: 28, 2000: 43, 4000: 53 },
      speech: { unaidedR: 88, unaidedL: 88, sinScore: 4 },
      age: 72, sex: 'male',
    });
    expect(r.ears.right.sentence).toMatch(/high-frequency sensorineural hearing loss/);
    // Patient phrasing is NEVER invented ahead of the corpus.
    expect(r.ears.right.degree.plain).toBeNull();
    expect(r.ears.right.degree.plainPending).toBe(true);
    expect(r.clarity.plain).toBeNull();
    expect(r.overallDegree).toBeTruthy();
  });
  it('does not present ears separately when symmetric', () => {
    const r = describeAudiogram({ right: flatModerate, left: flatModerate });
    expect(r.presentSeparately).toBe(false);
  });
  it('renders type-undetermined in the sentence when BC is missing', () => {
    const r = describeAudiogram({ right: slopingHF, left: slopingHF });
    expect(r.ears.right.sentence).toMatch(/type undetermined — no bone-conduction data/);
  });
  it('surfaces the referral flag for an asymmetric loss', () => {
    const worse = { 250: 60, 500: 65, 1000: 70, 2000: 72, 4000: 75, 8000: 78 };
    const r = describeAudiogram({ right: worse, left: normalHearing });
    expect(r.referralFlag).toBe(true);
    expect(r.presentSeparately).toBe(true);
  });
  it('handles a fully normal audiogram without forcing a loss label', () => {
    const r = describeAudiogram({ right: normalHearing, left: normalHearing });
    expect(r.ears.right.degree.worst).toBe('normal');
  });
});
