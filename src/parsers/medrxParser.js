/**
 * MedRx Avant AUDX PDF text parser.
 * Takes raw text extracted from a MedRx PDF and returns structured audiometric data
 * shaped to merge directly into Distil's form.audiology state.
 */

const FREQ_MAP = {
  '125': 125, '250': 250, '500': 500, '750': 750,
  '1k': 1000, '1.5k': 1500, '2k': 2000,
  '3k': 3000, '4k': 4000, '6k': 6000, '8k': 8000,
};

// Only keep frequencies Distil tracks
const DISTIL_FREQS = new Set([250, 500, 1000, 2000, 3000, 4000, 6000, 8000]);

/**
 * Parse a frequency header line like "Right 125 250 500 750 1k 1.5k 2k 3k 4k 6k 8k"
 * Returns array of mapped frequency numbers in order.
 */
function parseFreqHeader(line) {
  const tokens = line.trim().split(/\s+/);
  // Skip the first token (ear label like "Right" or "Left")
  return tokens.slice(1).map(t => FREQ_MAP[t.toLowerCase()] ?? null);
}

/**
 * Parse a threshold row like "AC 40 20 15 15 20 25 30 45 70 75"
 * Returns array of numeric values (null for empty/missing).
 */
function parseThresholdRow(line) {
  const tokens = line.trim().split(/\s+/);
  // Skip the first token (test type label like "AC" or "BC")
  return tokens.slice(1).map(t => {
    const n = Number(t);
    return isNaN(n) ? null : n;
  });
}

/**
 * Build a frequency→threshold map from parallel freq and value arrays,
 * filtered to only Distil-tracked frequencies.
 * When there are fewer values than frequencies (e.g. 125 Hz untested),
 * values are right-aligned to the frequency array — untested frequencies
 * are assumed to be at the low end, which matches clinical practice.
 */
function buildThresholdMap(freqs, values) {
  const offset = Math.max(0, freqs.length - values.length);
  const map = {};
  for (let i = 0; i < values.length; i++) {
    const fi = i + offset;
    if (fi < freqs.length && freqs[fi] != null && values[i] != null && DISTIL_FREQS.has(freqs[fi])) {
      map[freqs[fi]] = values[i];
    }
  }
  return map;
}

/**
 * Parse WR line like "100% at 70dB" or "NR" → percentage number or null
 */
function parseWrScore(line) {
  const m = line.match(/(\d+)\s*%/);
  return m ? Number(m[1]) : null;
}

/**
 * Main parser. Takes the full text extracted from a MedRx PDF page.
 * Returns { success, data, warnings, patientName, testDate, error }
 */
export function parseMedRxPdf(text) {
  const warnings = [];

  // Relaxed validation: accept if text contains "MedRx" OR "Avant" OR "AUDX"
  // (clinic logos/headers can push the "MedRx" token onto a different line
  // or merge it with other text, so we check multiple identifiers)
  const isMedRx = /MedRx|Avant|AUDX/i.test(text);
  if (!isMedRx) {
    return { success: false, error: 'This does not appear to be a MedRx report. The PDF text does not contain the MedRx identifier.' };
  }

  // Split text into lines, then expand combined Right/Left lines.
  // MedRx PDFs render both ears side-by-side at the same y-position,
  // producing: "Right 125 250 ... 8k Left 125 250 ... 8k"
  // followed by: "AC 40 20 ... 75 AC 45 25 ... 75"
  // We need to split AND interleave: Right header, Right AC, Left header, Left AC
  //
  // Pre-processing: strip common non-data prefixes that clinic logos/headers
  // can inject onto audiometric data lines (e.g. "My Hearing Centers Right 125...")
  const rawLines = text.split('\n').map(l => {
    let s = l.trim();
    // If a line contains "Right <digits>" or "Left <digits>" but doesn't START with it,
    // extract from the Right/Left token onward (logo text got prepended)
    const earMatch = s.match(/^.+?\b((?:Right|Left)\s+\d)/i);
    if (earMatch && earMatch.index === 0 && !s.startsWith(earMatch[1])) {
      s = s.slice(s.indexOf(earMatch[1]));
    }
    // Same for AC/BC rows: strip anything before the first "AC" or "BC" token
    if (!/^(AC|BC)\b/i.test(s)) {
      const acBcMatch = s.match(/\b(AC|BC)\s+[-\d]/i);
      if (acBcMatch) {
        const prefix = s.slice(0, acBcMatch.index).trim();
        // Only strip if the prefix doesn't look like data (contains letters, not "AC"/"BC")
        if (prefix && !/^(Right|Left|AC|BC)\b/i.test(prefix) && /[a-zA-Z]/.test(prefix)) {
          s = s.slice(acBcMatch.index);
        }
      }
    }
    return s;
  }).filter(Boolean);
  const lines = [];

  /** Try to split a line with two AC or BC tokens: "AC ... AC ..." → [first, second] */
  function splitDualTestRow(line, prefix) {
    const re = new RegExp(`\\d\\s+${prefix}\\b`, 'i');
    const idx = line.search(re);
    if (idx < 0) return null;
    // Find the second prefix token after the matched digit
    const searchFrom = idx + 1;
    let splitAt = line.indexOf(prefix, searchFrom);
    if (splitAt < 0) splitAt = line.indexOf(prefix.toLowerCase(), searchFrom);
    if (splitAt < 0) return null;
    return [line.slice(0, splitAt).trim(), line.slice(splitAt).trim()];
  }

  for (let li = 0; li < rawLines.length; li++) {
    const line = rawLines[li];

    // Detect combined frequency header: "Right ... Left ..."
    const leftIdx = line.search(/\bLeft\s+\d/i);
    if (/^Right\s+\d/i.test(line) && leftIdx > 0) {
      const rightHeader = line.slice(0, leftIdx).trim();
      const leftHeader = line.slice(leftIdx).trim();

      // Check if the NEXT line is a combined AC row, and interleave
      const nextLine = rawLines[li + 1] || '';
      const acParts = /^AC\b/i.test(nextLine) ? splitDualTestRow(nextLine, 'AC') : null;

      if (acParts) {
        // Interleave: Right header → Right AC → Left header → Left AC
        lines.push(rightHeader);
        lines.push(acParts[0]);
        lines.push(leftHeader);
        lines.push(acParts[1]);
        li++; // skip the AC line, we already consumed it

        // Also check for a combined BC row after the AC row
        const bcLine = rawLines[li + 1] || '';
        const bcParts = /^BC\b/i.test(bcLine) ? splitDualTestRow(bcLine, 'BC') : null;
        if (bcParts) {
          // Insert BC rows right after their respective headers+AC
          lines.splice(lines.length - 2, 0, bcParts[0]); // after right AC
          lines.push(bcParts[1]); // after left AC
          li++; // skip the BC line
        }
      } else {
        // No combined AC row follows — just split the headers
        lines.push(rightHeader);
        lines.push(leftHeader);
      }
      continue;
    }

    lines.push(line);
  }

  // Extract patient name and test date from header
  // Pattern: "MedRx LastName, FirstName M/D/YYYY H:MM:SS AM/PM Page N"
  let patientName = null;
  let testDate = null;
  const headerLine = lines.find(l => l.startsWith('MedRx'));
  if (headerLine) {
    const hMatch = headerLine.match(/MedRx\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (hMatch) {
      patientName = hMatch[1].trim();
      testDate = hMatch[2];
    }
  }

  // Parse audiometric thresholds
  // Find "Right" and "Left" frequency header lines followed by AC/BC rows
  const rightT = {}, leftT = {}, rightBC = {}, leftBC = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect frequency header for an ear
    // Must start with "Right" or "Left" and contain known frequency tokens (125, 250, etc.)
    // This avoids matching WR lines like "Right 100% at 70dB"
    const hasFreqTokens = /\b(250|500|1k|2k)\b/i.test(line);
    const isRight = hasFreqTokens && /^Right\s+\d/.test(line);
    const isLeft = hasFreqTokens && /^Left\s+\d/.test(line);

    if (!isRight && !isLeft) continue;

    const freqs = parseFreqHeader(line);
    const ear = isRight ? 'right' : 'left';
    const tMap = ear === 'right' ? rightT : leftT;
    const bcMap = ear === 'right' ? rightBC : leftBC;

    // Look at subsequent lines for AC/BC rows — stop at the next ear header
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const nextLine = lines[j];
      // Stop if we hit another ear's frequency header
      if (/^(Right|Left)\s+\d/i.test(nextLine)) break;
      if (/^AC\b/i.test(nextLine)) {
        const values = parseThresholdRow(nextLine);
        Object.assign(tMap, buildThresholdMap(freqs, values));
      } else if (/^BC\b/i.test(nextLine)) {
        const values = parseThresholdRow(nextLine);
        Object.assign(bcMap, buildThresholdMap(freqs, values));
      }
    }
  }

  // Parse Word Recognition scores
  // Look for lines like "Left 100% at 70dB" or "Right 96% at 65dB" in the WR section
  // Try multiple section header patterns — logo text can merge with or split the header
  let wrMclR = null, wrMclL = null;
  let wrSectionIdx = lines.findIndex(l => /\bSRT\b/.test(l) && /\bWR\b/.test(l));
  if (wrSectionIdx === -1) wrSectionIdx = lines.findIndex(l => /\bWR\b/.test(l) && /\b(SRT|Speech)\b/i.test(l));
  if (wrSectionIdx === -1) wrSectionIdx = lines.findIndex(l => /\bSRT\b/.test(l));
  if (wrSectionIdx !== -1) {
    for (let i = wrSectionIdx + 1; i < Math.min(wrSectionIdx + 15, lines.length); i++) {
      const l = lines[i];
      // Match "Right" anywhere in line (logo text may prefix), but only if it has a % score
      if (/\bRight\b/i.test(l) && /\d+\s*%/.test(l)) wrMclR = wrMclR ?? parseWrScore(l);
      if (/\bLeft\b/i.test(l) && /\d+\s*%/.test(l))  wrMclL = wrMclL ?? parseWrScore(l);
      // Stop if we hit the next section
      if (/QuickSIN/i.test(l)) break;
    }
  }

  if (wrMclR != null || wrMclL != null) {
    warnings.push('WR scores from MedRx are at patient MCL, not the 45 dB CCT protocol. Imported into "WR at MCL" fields.');
  }

  // Parse QuickSIN
  let sinBin = null;
  const qsIdx = lines.findIndex(l => /QuickSIN/i.test(l));
  if (qsIdx !== -1) {
    for (let i = qsIdx + 1; i < Math.min(qsIdx + 10, lines.length); i++) {
      const l = lines[i];
      // Look for "Both" row with a number
      if (/^Both\b/i.test(l)) {
        const m = l.match(/Both\s+([\d.]+)/i);
        if (m) sinBin = Number(m[1]);
      }
      // Also check Left/Right individual scores
      if (/^Left\b/i.test(l) && sinBin == null) {
        const m = l.match(/Left\s+([\d.]+)/i);
        if (m) warnings.push(`QuickSIN left ear: ${m[1]} dB (Distil tracks binaural only — not imported)`);
      }
      if (/^Right\b/i.test(l) && sinBin == null) {
        const m = l.match(/Right\s+([\d.]+)/i);
        if (m) warnings.push(`QuickSIN right ear: ${m[1]} dB (Distil tracks binaural only — not imported)`);
      }
    }
  }

  // Check if we got any useful data
  const hasThresholds = Object.keys(rightT).length > 0 || Object.keys(leftT).length > 0;
  const hasWr = wrMclR != null || wrMclL != null;
  const hasSin = sinBin != null;

  if (!hasThresholds && !hasWr && !hasSin) {
    return { success: false, error: 'MedRx report detected but no audiometric data could be parsed. The report may be empty or in an unexpected format.' };
  }

  // Build the set of imported field paths for highlighting
  const importedFields = new Set();
  Object.keys(rightT).forEach(f => importedFields.add(`rightT.${f}`));
  Object.keys(leftT).forEach(f => importedFields.add(`leftT.${f}`));
  Object.keys(rightBC).forEach(f => importedFields.add(`rightBC.${f}`));
  Object.keys(leftBC).forEach(f => importedFields.add(`leftBC.${f}`));
  if (wrMclR != null) importedFields.add('wrMclR');
  if (wrMclL != null) importedFields.add('wrMclL');
  if (sinBin != null) importedFields.add('sinBin');

  return {
    success: true,
    data: {
      rightT, leftT, rightBC, leftBC,
      rightMask: {}, leftMask: {}, rightBCMask: {}, leftBCMask: {},
      wrMclR, wrMclL,
      sinBin,
      // Don't touch these — clinician enters manually
      unaidedR: null, unaidedL: null,
      aidedR: null, aidedL: null,
      tinnitusRight: null, tinnitusLeft: null,
    },
    importedFields,
    warnings,
    patientName,
    testDate,
  };
}
