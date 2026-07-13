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

// Recommendation Engine — Device Selection & Pricing Screen v1.
// Pure module: given audiogram + intake inputs, produces a tier
// recommendation (1-5) with contributing-inputs audit trail and a
// patient-facing rationale sentence. Spec reference: §4.

// ============================================================
// INPUT NORMALIZATION
// ============================================================

// Kiosk submits {_meta, answers: {...flat...}, consent}, but legacy /
// test rows may store flat data at top level. Unwrap to the flat shape.
export function unwrapIntakeAnswers(answersColumn) {
  if (!answersColumn || typeof answersColumn !== 'object') return null
  if (answersColumn.answers && typeof answersColumn.answers === 'object' &&
      (answersColumn._meta || answersColumn.consent)) {
    return answersColumn.answers
  }
  return answersColumn
}

export function normalizeAudiogramInput(audiogramRow, thresholdRows) {
  if (!audiogramRow) return null
  const byEar = { right: {}, left: {} }
  for (const t of (thresholdRows || [])) {
    if (t.test_type !== 'AC') continue
    if (!byEar[t.ear]) continue
    byEar[t.ear][t.frequency] = t.threshold_db
  }
  return {
    ptaLowRight:   avg([byEar.right[500], byEar.right[1000], byEar.right[2000]]),
    ptaLowLeft:    avg([byEar.left[500],  byEar.left[1000],  byEar.left[2000]]),
    ptaHighRight:  avg([byEar.right[2000], byEar.right[4000]]),
    ptaHighLeft:   avg([byEar.left[2000],  byEar.left[4000]]),
    wrsRight:      audiogramRow.unaided_wrs_right ?? null,
    wrsLeft:       audiogramRow.unaided_wrs_left  ?? null,
    configuration: classifyConfiguration(byEar),
  }
}

// Sloping: HF PTA exceeds LF PTA by > 20 dB. Flat: within 10 dB.
function classifyConfiguration(byEar) {
  const lf = avg([byEar.right[500],  byEar.left[500]])
  const hf = avg([byEar.right[4000], byEar.left[4000]])
  if (lf == null || hf == null) return 'unknown'
  const diff = hf - lf
  if (diff > 20) return 'sloping'
  if (diff <= 10) return 'flat'
  return 'mild_slope'
}

// Handles both new (med_noise_occupational / _recreational) and legacy
// (med_noise / med_otherNoise) field names so the engine works for
// intakes submitted before Phase 2's restructuring.
export function normalizeIntakeInput(answersColumn) {
  const a = unwrapIntakeAnswers(answersColumn)
  if (!a) return null
  const SYMPTOMS = [
    'hear_mumble', 'hear_repeat', 'hear_understand', 'hear_noisy',
    'hear_loud', 'hear_tv', 'hear_kids',
  ]
  let yesCount = 0
  let askedCount = 0
  for (const k of SYMPTOMS) {
    if (a[k] === true)  { yesCount++; askedCount++ }
    else if (a[k] === false) { askedCount++ }
  }
  return {
    hearYesCount:      yesCount,
    hearAskedCount:    askedCount,
    hearSymptomsTotal: SYMPTOMS.length,
    selfRating:        typeof a.hear_rating === 'number' ? a.hear_rating : null,
    occupationalNoise: a.med_noise_occupational === true || a.med_noise === true,
    recreationalNoise: a.med_noise_recreational === true ||
                       (typeof a.med_otherNoise === 'string' && a.med_otherNoise.trim().length > 0),
    readyToAddress:    a.hear_ready === true,
    hearUnderstand:    a.hear_understand === true,
    hearNoisy:         a.hear_noisy === true,
  }
}

// ============================================================
// SCORING — spec §4 down-tier rubric
// ============================================================

// Returns { score, contributingInputs }. Higher score = more evidence
// that simpler (lower-tier) technology would suit the patient.
export function scoreDownTier(audio, intake) {
  const contributingInputs = []
  let score = 0

  if (audio) {
    const ptaLow = avg([audio.ptaLowRight, audio.ptaLowLeft])
    if (ptaLow != null && ptaLow < 30) {
      score += 2
      contributingInputs.push({
        input: 'pta_low_mild', points: 2,
        detail: `Bilateral low-freq PTA ${Math.round(ptaLow)} dB HL (< 30)`,
      })
    }
    if (audio.wrsRight != null && audio.wrsLeft != null &&
        audio.wrsRight > 85 && audio.wrsLeft > 85) {
      score += 1
      contributingInputs.push({
        input: 'wrs_strong', points: 1,
        detail: `WRS R ${audio.wrsRight}% / L ${audio.wrsLeft}% (both > 85)`,
      })
    }
    if (audio.configuration === 'flat') {
      score += 1
      contributingInputs.push({
        input: 'flat_configuration', points: 1,
        detail: 'Flat audiometric configuration (no high-freq slope)',
      })
    }
  }

  if (intake) {
    if (intake.hearAskedCount >= 5 && intake.hearYesCount <= 2) {
      score += 2
      contributingInputs.push({
        input: 'low_symptom_count', points: 2,
        detail: `${intake.hearYesCount} of ${intake.hearSymptomsTotal} hearing-symptom questions marked Yes`,
      })
    }
    if (intake.selfRating != null && intake.selfRating >= 8) {
      score += 1
      contributingInputs.push({
        input: 'high_self_rating', points: 1,
        detail: `Self-rated hearing ${intake.selfRating}/10`,
      })
    }
    if (!intake.occupationalNoise && !intake.recreationalNoise) {
      score += 1
      contributingInputs.push({
        input: 'no_noise_exposure', points: 1,
        detail: 'No reported significant occupational or recreational noise exposure',
      })
    }
    if (intake.hearUnderstand === false && intake.hearNoisy === false) {
      score += 1
      contributingInputs.push({
        input: 'no_speech_in_noise_difficulty', points: 1,
        detail: 'Does not report often hearing-without-understanding or noisy-place difficulty',
      })
    }
  } else {
    contributingInputs.push({
      input: 'intake_missing', points: 0,
      detail: 'No intake data — engine uses audiometric-only with top-tier bias',
    })
  }

  return { score, contributingInputs }
}

// Map cumulative score → recommended tier_rank. Spec §4 thresholds:
// 0–4 → top (5), 5–8 → mid (3), 9+ → entry (1). Tunable at pilot.
export function selectTier(score) {
  if (score >= 9) return 1
  if (score >= 5) return 3
  return 5
}

// ============================================================
// RATIONALE GENERATION
// ============================================================

function describeLoss(audio) {
  if (!audio) return null
  const pta = avg([audio.ptaLowRight, audio.ptaLowLeft])
  if (pta == null) return null
  let degree
  if (pta < 30) degree = 'mild hearing loss'
  else if (pta < 55) degree = 'moderate hearing loss'
  else if (pta < 70) degree = 'moderately severe hearing loss'
  else if (pta < 90) degree = 'severe hearing loss'
  else degree = 'profound hearing loss'
  if (audio.configuration === 'sloping') return `sloping high-frequency ${degree}`
  return degree
}

function describeIntake(intake) {
  if (!intake || intake.hearAskedCount < 5) return null
  if (intake.hearYesCount >= 5) return 'the broad range of listening difficulties you described'
  if (intake.hearYesCount >= 3) return 'the specific listening challenges you described'
  return 'the relatively contained listening challenges you reported'
}

// Rationale copy follows the listening-effort frame (listeningSituations.js):
// degraded signal → the brain fills the gaps → that work is felt as fatigue →
// the tier determines who does the separating. Entry-tier rationale must never
// read as "you'll strain, but it's cheap" — it's recommended because the
// patient's demands center on settings where effort stays low anyway.
export function generateRationale(audio, intake, recommendedRank) {
  const loss = describeLoss(audio)
  const listening = describeIntake(intake)

  if (recommendedRank === 5) {
    if (loss && listening) {
      return `Based on your ${loss} and ${listening}, the top-tier device is recommended. Right now your brain is filling in what your ears miss — that work is why listening can leave you drained. This tier's processing separates speech from noise before it reaches you, so your energy goes to the conversation itself.`
    }
    if (loss) {
      return `Based on your ${loss}, the top-tier device is recommended. With this degree of loss, your brain works hard to fill in what your ears miss, and that effort adds up over a day. The top tier shifts that work onto the processor, keeping listening effort low even in demanding places.`
    }
    return `The top-tier device is recommended as the strongest foundation for your hearing care — its processing takes on the work of separating speech from noise, so less of that effort lands on your brain.`
  }

  if (recommendedRank === 3) {
    const base = loss && listening
      ? `Given your ${loss} and ${listening}`
      : loss ? `Given your ${loss}` : `Given what we've reviewed together`
    return `${base}, the mid-tier device is the right fit — it takes on most of the work of separating speech from noise, keeping listening effort modest through a typical day, without paying for processing your routine may not call on.`
  }

  const base = loss && listening
    ? `Based on your ${loss} and ${listening}`
    : loss ? `Based on your ${loss}` : `Based on what we've reviewed together`
  return `${base}, the entry-tier device is well-matched to your needs. Your listening demands center on calmer settings, and restoring what your ears are missing there keeps listening effort low — without features that wouldn't meaningfully change your day-to-day experience.`
}

// ============================================================
// ORCHESTRATION
// ============================================================

// Returns { blocked, reason } if audiogram missing, otherwise:
// { recommendedRank, downTierScore, contributingInputs, rationale,
//   normalizedInputs: { audio, intake } }.
export function runRecommendationEngine(audiogramRow, thresholdRows, intakeAnswersColumn) {
  const audio = normalizeAudiogramInput(audiogramRow, thresholdRows)
  if (!audio) {
    return { blocked: true, reason: 'Audiogram required before recommendation can be generated.' }
  }
  const intake = normalizeIntakeInput(intakeAnswersColumn)
  const { score, contributingInputs } = scoreDownTier(audio, intake)
  const recommendedRank = selectTier(score)
  const rationale = generateRationale(audio, intake, recommendedRank)
  return {
    recommendedRank,
    downTierScore: score,
    contributingInputs,
    rationale,
    normalizedInputs: { audio, intake },
  }
}

function avg(arr) {
  const vals = (arr || []).filter(v => v != null && !Number.isNaN(v))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
