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
import { parseMedRxPdf } from './medrxParser.js';

// Text shaped exactly like pdfjs extraction of a real Avant AUDX report
// (both ears side-by-side per line, BC tested across the full 500–4k window).
// Patient details are fictional.
const FULL_REPORT = `MedRx Doe, Jane 8/4/2026 9:42:39 AM Page 1
Doe, Jane
Male, 9/23/1960 (65 y.o.)
Audiometry
Right 125 250 500 750 1k 1.5k 2k 3k 4k 6k 8k Left 125 250 500 750 1k 1.5k 2k 3k 4k 6k 8k
AC 30 45 45 40 45 40 45 40 45 50 AC 25 40 40 35 40 40 60 50 60 65
BC 25 20 20 20 30 30 35 BC 15 15 5 30 35 45 50
Mask Oppos 40 50 50 50 Mask Oppos 35 35 35 35 60 60
1 Air Conduction, AI=26%, PTA=42, HFA=40
AC SRT WR WR, Aided MCL UCL
2 Bone Conduction, PTA=25, HFA=28
40dB 96% at 80dB
3 Air Conduction, AI=31%, PTA=38, HFA=42 Left
4 Bone Conduction, PTA=18, HFA=30
Right 40dB 100% at 80dB
QuickSIN
SNR Loss Unaided SNR Loss Aided (LP-HFE) Unaided (LP-HFE) Aided
Both 7.5
`;

describe('parseMedRxPdf', () => {
  it('parses patient name and test date from the header', () => {
    const result = parseMedRxPdf(FULL_REPORT);
    expect(result.success).toBe(true);
    expect(result.patientName).toBe('Doe, Jane');
    expect(result.testDate).toBe('8/4/2026');
  });

  it('right-aligns AC thresholds to the frequency header (125 Hz untested)', () => {
    const { data } = parseMedRxPdf(FULL_REPORT);
    // 10 AC values against 11 header freqs → first value belongs to 250 Hz
    expect(data.rightT).toEqual({
      250: 30, 500: 45, 750: 45, 1000: 40, 1500: 45,
      2000: 40, 3000: 45, 4000: 40, 6000: 45, 8000: 50,
    });
    expect(data.leftT).toEqual({
      250: 25, 500: 40, 750: 40, 1000: 35, 1500: 40,
      2000: 40, 3000: 60, 4000: 50, 6000: 60, 8000: 65,
    });
  });

  it('aligns BC thresholds to the 500–4000 Hz window, not the full header', () => {
    const { data } = parseMedRxPdf(FULL_REPORT);
    // 7 BC values = 500, 750, 1k, 1.5k, 2k, 3k, 4k. Right-aligning against the
    // 11-freq AC header would wrongly start BC at 1k and put values at 6k/8k.
    expect(data.rightBC).toEqual({
      500: 25, 750: 20, 1000: 20, 1500: 20, 2000: 30, 3000: 30, 4000: 35,
    });
    expect(data.leftBC).toEqual({
      500: 15, 750: 15, 1000: 5, 1500: 30, 2000: 35, 3000: 45, 4000: 50,
    });
  });

  it('never places BC thresholds outside 500–4000 Hz', () => {
    const { data } = parseMedRxPdf(FULL_REPORT);
    for (const ear of [data.rightBC, data.leftBC]) {
      for (const f of Object.keys(ear).map(Number)) {
        expect(f).toBeGreaterThanOrEqual(500);
        expect(f).toBeLessThanOrEqual(4000);
      }
    }
  });

  it('warns when a BC row does not fill the 500–4000 Hz window', () => {
    const partial = `MedRx Doe, Jane 8/4/2026 9:42:39 AM Page 1
Right 125 250 500 750 1k 1.5k 2k 3k 4k 6k 8k
AC 30 45 45 40 45 40 45 40 45 50
BC 25 20 20 30
`;
    const result = parseMedRxPdf(partial);
    expect(result.success).toBe(true);
    // Left-anchored at 500 Hz: 500, 750, 1k, 1.5k
    expect(result.data.rightBC).toEqual({ 500: 25, 750: 20, 1000: 20, 1500: 30 });
    expect(result.warnings.some(w => /BC row had 4 values/.test(w))).toBe(true);
  });

  it('parses QuickSIN binaural score', () => {
    const { data } = parseMedRxPdf(FULL_REPORT);
    expect(data.sinBin).toBe(7.5);
  });

  it('marks imported BC fields for highlighting', () => {
    const { importedFields } = parseMedRxPdf(FULL_REPORT);
    expect(importedFields.has('rightBC.500')).toBe(true);
    expect(importedFields.has('leftBC.500')).toBe(true);
    expect(importedFields.has('rightBC.8000')).toBe(false);
  });
});
