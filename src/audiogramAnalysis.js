// Pure audiogram analysis helpers. Operates on a thresholds object of the
// shape { 250: dB, 500: dB, 1000: dB, ... } per ear.
//
// Severity strings are the canonical allowlist used everywhere downstream
// (db match_min_severity, personalization profile, content matcher).

export const AUDIG_FREQS = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000];

export const SEVERITY_ORDER = ['normal', 'mild', 'moderate', 'mod-severe', 'severe', 'profound'];

export function severityRank(severity) {
  return SEVERITY_ORDER.indexOf(severity);
}

// Returns true if `a` is at least as severe as `floor`.
export function severityAtLeast(a, floor) {
  if (!floor) return true;
  if (!a) return false;
  return severityRank(a) >= severityRank(floor);
}

// Pure-tone average across speech frequencies.
export function getPTA(thresholds) {
  if (!thresholds) return null;
  const freqs = [500, 1000, 2000, 4000];
  const vals = freqs.map(f => thresholds[f]).filter(v => v != null);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : null;
}

// Maps a PTA to a severity bucket. Normal threshold is 20 dB per MHC clinical rules.
export function severityFromPTA(pta) {
  if (pta == null) return null;
  if (pta <= 20) return 'normal';
  if (pta <= 40) return 'mild';
  if (pta <= 55) return 'moderate';
  if (pta <= 70) return 'mod-severe';
  if (pta <= 90) return 'severe';
  return 'profound';
}

// Max threshold across the audiogram - useful when high-frequency loss is
// significant but PTA is misleadingly mild.
export function severityFromWorstThreshold(thresholds) {
  if (!thresholds) return null;
  const vals = Object.values(thresholds).filter(v => v != null);
  if (!vals.length) return null;
  const worst = Math.max(...vals);
  if (worst <= 20) return 'normal';
  if (worst <= 40) return 'mild';
  if (worst <= 55) return 'moderate';
  if (worst <= 70) return 'mod-severe';
  if (worst <= 90) return 'severe';
  return 'profound';
}

// Slope direction from low to high frequency.
//   sloping = high-freq worse (typical age-related loss; feedback-prone)
//   rising  = low-freq worse  (atypical; conductive component)
//   flat    = roughly equal across the spectrum
export function getSlope(thresholds) {
  if (!thresholds || thresholds[500] == null || thresholds[4000] == null) return null;
  const delta = thresholds[4000] - thresholds[500];
  if (delta > 30) return 'sloping';
  if (delta < -10) return 'rising';
  return 'flat';
}

// Audiogram configuration - shape of the loss across frequencies.
//   ski-slope:    sharp drop above 2 kHz (very high-freq loss)
//   high-freq:    moderate sloping high-freq loss
//   cookie-bite:  mid-frequency loss with better lows + highs
//   reverse:      low-freq worse than high
//   flat:         roughly equal across the range
export function getConfiguration(thresholds) {
  if (!thresholds) return null;
  const t500 = thresholds[500], t1k = thresholds[1000];
  const t2k = thresholds[2000], t4k = thresholds[4000];
  if ([t500, t1k, t2k, t4k].some(v => v == null)) return null;

  const lowAvg = (t500 + t1k) / 2;
  const highAvg = (t2k + t4k) / 2;
  const midAvg = t1k;

  // Ski-slope: highs are 40+ dB worse than lows AND highs are at least moderate
  if ((highAvg - lowAvg) >= 40 && highAvg >= 40) return 'ski-slope';
  // High-frequency: clear downward slope
  if ((highAvg - lowAvg) >= 20) return 'high-freq';
  // Cookie-bite: mids worse than both lows and highs by 15+ dB
  if (midAvg - lowAvg >= 15 && midAvg - highAvg >= 15) return 'cookie-bite';
  // Reverse: lows worse than highs by 15+ dB
  if (lowAvg - highAvg >= 15) return 'reverse';
  return 'flat';
}

// Asymmetric loss: PTAs differ by >= 15 dB between ears.
export function isAsymmetric(leftThresholds, rightThresholds) {
  const l = getPTA(leftThresholds), r = getPTA(rightThresholds);
  if (l == null || r == null) return false;
  return Math.abs(l - r) >= 15;
}

// Picks the worse ear's severity. The campaign matcher uses this as the
// patient's overall severity floor for content gating.
export function worseEarSeverity(leftThresholds, rightThresholds) {
  const l = severityFromPTA(getPTA(leftThresholds));
  const r = severityFromPTA(getPTA(rightThresholds));
  if (!l) return r;
  if (!r) return l;
  return severityRank(l) >= severityRank(r) ? l : r;
}
