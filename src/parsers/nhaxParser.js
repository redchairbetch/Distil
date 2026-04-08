/**
 * Noah NHAX export parser.
 * Parses binary NHAX files containing HIMSA Standard Audiometric Format data
 * (DataFmtCodeStd=200). Runs entirely client-side using pako for zlib decompression.
 *
 * Returns the same shape as medrxParser so it plugs directly into Distil's
 * form.audiology merge logic.
 *
 * NHAX file format (reverse-engineered from real files):
 * - Custom binary container with zlib-compressed streams
 * - First stream: XML with <Patient> demographics and <Action> elements
 * - Each Action has base64-encoded <PublicData> (36,128 bytes HIMSA binary)
 * - Pure tone data: 10-byte groups at known offsets (206 for left, 652 for right)
 * - Speech data: headers at ~20624/21022, measurement data 206 bytes after header
 */

import pako from "pako";

// Frequencies Distil tracks (must match medrxParser)
const DISTIL_FREQS = new Set([250, 500, 1000, 2000, 3000, 4000, 6000, 8000]);

// Sentinel value in HIMSA binary = "no measurement"
const NO_MEASUREMENT = 0x8001; // 32769

// ── Zlib stream discovery ──────────────────────────────────────

/**
 * Scan a binary buffer for zlib-compressed streams.
 * Zlib headers start with 0x78 followed by 0x01, 0x9C, or 0xDA.
 * Tries pako.inflate first (full zlib), falls back to inflateRaw (skip 2-byte header).
 */
function findZlibStreams(buf) {
  const bytes = new Uint8Array(buf);
  const streams = [];

  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] !== 0x78) continue;
    const next = bytes[i + 1];
    if (next !== 0x01 && next !== 0x9c && next !== 0xda) continue;

    // Try full zlib inflate first, then raw deflate (skip 2-byte header)
    let decompressed = null;
    try {
      decompressed = pako.inflate(bytes.subarray(i));
    } catch {
      try {
        decompressed = pako.inflateRaw(bytes.subarray(i + 2));
      } catch {
        // Not a valid stream at this offset
      }
    }

    if (decompressed && decompressed.length > 0) {
      streams.push(decompressed);
      // Skip past this stream to avoid finding sub-offsets within it
      i += 100;
    }
  }

  return streams;
}

// ── XML parsing ────────────────────────────────────────────────

/**
 * Parse the NHAX XML to extract patient info and session actions.
 * The XML uses attributes on <Patient> for demographics, and
 * <Action> elements contain base64 <PublicData>.
 */
function parseNhaxXml(xmlStr) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, "text/xml");

  // Patient demographics — stored as attributes on <Patient> element
  const patNode = doc.querySelector("Patient");
  const attr = (name) => patNode?.getAttribute(name) || "";
  const patient = {
    firstName: attr("FirstName") || patNode?.querySelector("FirstName")?.textContent?.trim() || "",
    lastName: attr("LastName") || patNode?.querySelector("LastName")?.textContent?.trim() || "",
    dateOfBirth: attr("BirthDate") || attr("DateOfBirth") || patNode?.querySelector("BirthDate, DateOfBirth")?.textContent?.trim() || "",
    gender: attr("Gender") || patNode?.querySelector("Gender")?.textContent?.trim() || "",
    patientId: attr("PatientGUID") || attr("PatientNo") || "",
    email: attr("EMail") || "",
    address: attr("Address1") || "",
    city: attr("City") || "",
    state: attr("Province") || "",
    zip: attr("Zip") || "",
  };

  // Sessions → Actions with PublicData
  const actions = [];
  const actionNodes = doc.querySelectorAll("Action");
  for (const action of actionNodes) {
    const pubData = action.querySelector("PublicData")?.textContent?.trim();
    // Date can be an attribute or the parent Session's CreateDate
    const actionDate = action.getAttribute("CreateDate")
      || action.querySelector("CreateDate")?.textContent?.trim()
      || action.closest("Session")?.getAttribute("CreateDate")
      || "";
    const description = action.getAttribute("Description") || "";
    if (pubData) {
      actions.push({ publicData: pubData, date: actionDate, device: description });
    }
  }

  return { patient, actions };
}

// ── HIMSA binary helpers ───────────────────────────────────────

function u16(dv, offset) {
  return dv.getUint16(offset, true);
}

function s16(dv, offset) {
  return dv.getInt16(offset, true);
}

// ── Pure tone parsing ──────────────────────────────────────────

/**
 * Parse pure tone thresholds from a section of the HIMSA binary.
 * Data is stored as repeating 10-byte groups:
 *   [frequency_u16, threshold_s16, mask1_u16, mask2_u16, flag_u16]
 * Thresholds are in tenths of dB (divide by 10).
 * Sentinel 0x8001 means "no measurement".
 */
function parseToneSection(dv, startOffset, maxEntries) {
  const thresholds = {};
  const masks = {};

  for (let i = 0; i < maxEntries; i++) {
    const off = startOffset + i * 10;
    const freq = u16(dv, off);
    const rawThreshold = u16(dv, off + 2);
    const maskLevel = u16(dv, off + 4);

    // Stop at invalid/sentinel frequency
    if (freq === 0 || freq === NO_MEASUREMENT || freq > 12000) break;
    // Skip unmeasured frequencies
    if (rawThreshold === NO_MEASUREMENT) continue;

    const thresholdDb = s16(dv, off + 2) / 10;

    if (DISTIL_FREQS.has(freq)) {
      thresholds[freq] = Math.round(thresholdDb);
      if (maskLevel !== NO_MEASUREMENT && maskLevel !== 0) {
        masks[freq] = true;
      }
    }
  }

  return { thresholds, masks };
}

/**
 * Find pure tone sections by scanning for clusters of valid frequency data.
 * HIMSA format stores up to 4 sections in order: Left AC, Right AC, Left BC, Right BC.
 * AC sections typically have 10 entries (250-8000 Hz), BC has 3-4 (500-4000 Hz).
 */
function findPureToneSections(dv, length) {
  const sections = [];
  const targetFreqs = new Set([125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000]);

  for (let start = 100; start < Math.min(2000, length - 30); start += 2) {
    const freq = u16(dv, start);
    if (!targetFreqs.has(freq)) continue;

    // Count consecutive valid 10-byte frequency groups
    let validCount = 0;
    for (let probe = start; probe + 9 < Math.min(start + 200, length); probe += 10) {
      const f = u16(dv, probe);
      if (targetFreqs.has(f)) validCount++;
      else break;
    }

    if (validCount >= 3) {
      const section = parseToneSection(dv, start, validCount);
      if (Object.keys(section.thresholds).length >= 3) {
        sections.push(section);
        // Jump past this section
        start += validCount * 10 + 50;
      }
    }
  }

  return sections;
}

// ── Speech audiometry parsing ──────────────────────────────────

/**
 * Parse speech audiometry from the HIMSA binary.
 *
 * Structure (validated against real files):
 * - Header pattern at ~offset 20624 (16-bit values):
 *   [8, 1, 0, 0, 0, 0, 10, 1, ear_code, 1]
 *   Ear codes: 11=left, 12=right, 13=binaural
 *
 * - Measurement data starts 206 bytes after header start.
 *   Each measurement: [level_u16, masking_u16, score_u16, wordCount_u16] = 8 bytes
 *   level in tenths of dB, score in hundredths of percent
 *   Sentinel 0x8001 for masking = no masking applied
 *   Level of 0 or 0x8001 = end of data
 */
function parseSpeechData(dv, length) {
  const results = {
    left: { wrs: null, cct: null },
    right: { wrs: null, cct: null },
    binaural: { wrs: null, cct: null },
  };

  for (let off = 20000; off < length - 220; off += 2) {
    // Match header pattern: [8, 1, 0, 0, 0, 0, 10, 1, earCode, 1]
    if (u16(dv, off) !== 8 || u16(dv, off + 2) !== 1) continue;
    if (u16(dv, off + 4) !== 0 || u16(dv, off + 6) !== 0) continue;
    if (u16(dv, off + 8) !== 0 || u16(dv, off + 10) !== 0) continue;
    if (u16(dv, off + 12) !== 10 || u16(dv, off + 14) !== 1) continue;

    const earCode = u16(dv, off + 16);
    if (earCode < 11 || earCode > 13) continue;

    const earKey = earCode === 11 ? "left" : earCode === 12 ? "right" : "binaural";

    // Measurement data starts 206 bytes after the header
    const dataStart = off + 206;
    if (dataStart + 8 > length) continue;

    const measurements = [];
    for (let m = dataStart; m + 7 < Math.min(dataStart + 80, length); m += 8) {
      const rawLevel = u16(dv, m);
      if (rawLevel === NO_MEASUREMENT || rawLevel === 0) break;

      const rawScore = u16(dv, m + 4);
      const rawWordCount = u16(dv, m + 6);

      measurements.push({
        level: rawLevel / 10,
        score: rawScore / 100,
        wordCount: rawWordCount,
      });
    }

    // Classify: 25-word @ ~45dB = CCT, other = WRS (typically 15 words at MCL)
    for (const m of measurements) {
      if (m.wordCount === 25 && m.level >= 40 && m.level <= 55) {
        results[earKey].cct = {
          score: Math.round(m.score),
          level: Math.round(m.level),
          wordCount: m.wordCount,
        };
      } else if (m.wordCount >= 10 && m.level >= 60) {
        results[earKey].wrs = {
          score: Math.round(m.score),
          level: Math.round(m.level),
          wordCount: m.wordCount,
        };
      }
    }

    // Skip past this section's data region
    off = dataStart + 80;
  }

  return results;
}

// ── Calculated values ──────────────────────────────────────────

function calcPTA(thresholds) {
  const vals = [500, 1000, 2000].map(f => thresholds[f]).filter(v => v != null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function calcHFA(thresholds) {
  const vals = [1000, 2000, 4000].map(f => thresholds[f]).filter(v => v != null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

// ── QuickSIN extraction from PrivateData ───────────────────────

/**
 * Extract QuickSIN SNR Loss from MedRx PrivateData.
 * The PrivateData contains a zlib-compressed binary blob with device metadata.
 * QuickSIN SNR Loss is stored as a float64 at byte offset 132 in the decompressed data.
 * Validated against two patient files: Cindy Yantis (4.5 dB), Verona Hartz (5.5 dB).
 */
function extractQuickSIN(xmlStr) {
  const privMatches = [...xmlStr.matchAll(/<PrivateData>([\s\S]*?)<\/PrivateData>/g)];
  if (privMatches.length === 0) return null;

  // Use the last PrivateData block (most recent session)
  const privB64 = privMatches[privMatches.length - 1][1].trim();
  let privBytes;
  try {
    const binaryStr = atob(privB64);
    privBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) privBytes[i] = binaryStr.charCodeAt(i);
  } catch { return null; }

  // Find and decompress the inner zlib stream (starts ~10 bytes in)
  let inner = null;
  for (let i = 0; i < privBytes.length - 1; i++) {
    if (privBytes[i] !== 0x78) continue;
    const next = privBytes[i + 1];
    if (next !== 0x01 && next !== 0x9c && next !== 0xda) continue;
    try { inner = pako.inflate(privBytes.subarray(i)); break; } catch {
      try { inner = pako.inflateRaw(privBytes.subarray(i + 2)); break; } catch {}
    }
  }
  if (!inner || inner.length < 140) return null;

  // QuickSIN SNR Loss is a float64 at offset 132
  try {
    const dv = new DataView(inner.buffer, inner.byteOffset, inner.byteLength);
    const snr = dv.getFloat64(132, true);
    // Validate: SNR Loss should be 0-30 dB and a clean half-dB value
    if (Number.isFinite(snr) && snr >= 0 && snr <= 30) {
      return Math.round(snr * 2) / 2; // round to nearest 0.5
    }
  } catch {}

  return null;
}

// ── Main entry point ───────────────────────────────────────────

/**
 * Parse a Noah NHAX export file.
 * @param {ArrayBuffer} fileBuffer - Raw bytes from the .nhax file
 * @returns {Object} Same shape as medrxParser: { success, data, importedFields, warnings, patientName, testDate }
 */
export async function parseNHAX(fileBuffer) {
  const warnings = [];

  // 1. Find and decompress zlib streams
  const streams = findZlibStreams(fileBuffer);
  if (streams.length === 0) {
    return { success: false, error: "No compressed data found in NHAX file. The file may be corrupt." };
  }

  // 2. Decode first stream as XML
  let xmlStr;
  try {
    const decoder = new TextDecoder("utf-8");
    xmlStr = decoder.decode(streams[0]);
  } catch {
    return { success: false, error: "Failed to decode NHAX XML content." };
  }

  if (!xmlStr.includes("<Patient") && !xmlStr.includes("<Session")) {
    return { success: false, error: "NHAX file does not contain expected patient/session data." };
  }

  // 3. Parse XML
  const { patient, actions } = parseNhaxXml(xmlStr);
  if (actions.length === 0) {
    return { success: false, error: "No audiometric sessions found in NHAX file." };
  }

  // 4. Use the most recent action
  const latestAction = actions[actions.length - 1];

  // 5. Decode base64 PublicData to binary
  let publicBinary;
  try {
    const binaryStr = atob(latestAction.publicData);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    publicBinary = bytes;
  } catch {
    return { success: false, error: "Failed to decode audiometric data from NHAX session." };
  }

  const dv = new DataView(publicBinary.buffer, publicBinary.byteOffset, publicBinary.byteLength);
  const len = publicBinary.length;

  // 6. Parse pure tone audiometry
  // HIMSA stores up to 4 sections: Left AC, Right AC, Left BC, Right BC
  const toneSections = findPureToneSections(dv, len);

  let leftT = {}, rightT = {};
  let leftMask = {}, rightMask = {};
  let leftBC = {}, rightBC = {};
  let leftBCMask = {}, rightBCMask = {};

  if (toneSections.length >= 2) {
    leftT = toneSections[0].thresholds;
    leftMask = toneSections[0].masks;
    rightT = toneSections[1].thresholds;
    rightMask = toneSections[1].masks;
  } else if (toneSections.length === 1) {
    leftT = toneSections[0].thresholds;
    leftMask = toneSections[0].masks;
    warnings.push("Only one ear's tone data found — assigned to left ear. Verify manually.");
  }

  // Sections 3 and 4 are bone conduction (fewer frequencies, typically 500-4000 Hz)
  if (toneSections.length >= 4) {
    leftBC = toneSections[2].thresholds;
    leftBCMask = toneSections[2].masks;
    rightBC = toneSections[3].thresholds;
    rightBCMask = toneSections[3].masks;
  } else if (toneSections.length === 3) {
    leftBC = toneSections[2].thresholds;
    leftBCMask = toneSections[2].masks;
    warnings.push("Only one ear's bone conduction data found — assigned to left ear.");
  }

  // 7. Extract QuickSIN from PrivateData (MedRx proprietary format)
  const sinBin = extractQuickSIN(xmlStr);

  // 8. Parse speech audiometry
  const speech = parseSpeechData(dv, len);

  // 9. Build output
  const wrMclR = speech.right.wrs?.score ?? null;
  const wrMclL = speech.left.wrs?.score ?? null;
  const cctR = speech.right.cct?.score ?? null;
  const cctL = speech.left.cct?.score ?? null;
  const cctLevelR = speech.right.cct?.level ?? null;
  const cctLevelL = speech.left.cct?.level ?? null;
  const wrBin = speech.binaural.wrs?.score ?? null;
  const cctBin = speech.binaural.cct?.score ?? null;

  if (cctR != null || cctL != null) {
    warnings.push("CCT scores imported from Noah data (25-word test at ~45 dB).");
  }
  if (wrBin != null || cctBin != null) {
    warnings.push(
      `Binaural speech scores found: ${wrBin != null ? `WRS ${wrBin}%` : ""}${cctBin != null ? ` CCT ${cctBin}%` : ""}. Distil tracks per-ear scores — binaural values shown for reference only.`
    );
  }

  const ptaLeft = calcPTA(leftT);
  const ptaRight = calcPTA(rightT);
  const hfaLeft = calcHFA(leftT);
  const hfaRight = calcHFA(rightT);

  const hasThresholds = Object.keys(rightT).length > 0 || Object.keys(leftT).length > 0;
  const hasWr = wrMclR != null || wrMclL != null;
  const hasCct = cctR != null || cctL != null;

  if (!hasThresholds && !hasWr && !hasCct) {
    return { success: false, error: "Noah NHAX file parsed but no audiometric data could be extracted. The session may be empty or in an unexpected format." };
  }

  // Imported field tracking for UI highlighting
  const importedFields = new Set();
  Object.keys(rightT).forEach(f => importedFields.add(`rightT.${f}`));
  Object.keys(leftT).forEach(f => importedFields.add(`leftT.${f}`));
  Object.keys(rightBC).forEach(f => importedFields.add(`rightBC.${f}`));
  Object.keys(leftBC).forEach(f => importedFields.add(`leftBC.${f}`));
  if (wrMclR != null) importedFields.add("wrMclR");
  if (wrMclL != null) importedFields.add("wrMclL");
  if (cctR != null) importedFields.add("cctR");
  if (cctL != null) importedFields.add("cctL");
  if (sinBin != null) importedFields.add("sinBin");

  const patientName = [patient.lastName, patient.firstName].filter(Boolean).join(", ");

  let testDate = latestAction.date || null;
  if (testDate) {
    // Normalize "2024-04-04T11:43:40" → "4/4/2024"
    const d = new Date(testDate);
    if (!isNaN(d.getTime())) {
      testDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    }
  }

  return {
    success: true,
    data: {
      rightT, leftT,
      rightBC, leftBC,
      rightMask, leftMask,
      rightBCMask, leftBCMask,
      wrMclR, wrMclL,
      sinBin,
      cctR, cctL, cctLevelR, cctLevelL,
      _nhaxMeta: {
        ptaLeft, ptaRight, hfaLeft, hfaRight,
        wrBinaural: wrBin,
        cctBinaural: cctBin,
        cctBinauralLevel: speech.binaural.cct?.level ?? null,
        wrLevelR: speech.right.wrs?.level ?? null,
        wrLevelL: speech.left.wrs?.level ?? null,
        device: latestAction.device || null,
        sessionCount: actions.length,
      },
      unaidedR: cctR, unaidedL: cctL,
      aidedR: null, aidedL: null,
      tinnitusRight: null, tinnitusLeft: null,
    },
    importedFields,
    warnings,
    patientName,
    testDate,
  };
}
