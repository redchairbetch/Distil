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

// Nurture campaign personalization engine.
//
// Architecture: the campaign template defines a fixed step sequence with
// lifecycle phases. For each step we keep the original timing/channel but
// SWAP the content for the best match against the patient's profile.
//
// derivePatientProfile() builds a flat normalized profile from raw DB inputs.
// scoreContent() applies hard filters and returns a numeric score.
// personalizeDeliveries() walks the patient's pending deliveries and picks
// the best alternate per step from the same-phase content pool.

import {
  getPTA, getSlope, getConfiguration,
  worseEarSeverity, severityFromPTA, severityFromWorstThreshold,
  severityRank, severityAtLeast, isAsymmetric,
} from './audiogramAnalysis.js';

// ── Intake → TNS tag mapping ──────────────────────────────────────────────
// The intake form's `resistancePoints` uses an older ID scheme; map onto the
// canonical TNS tag IDs so both sources contribute to the same effective set.
const INTAKE_RESISTANCE_TO_TAG = {
  cost:            'cost',
  cosmetics:       'vanity',
  denial:          'not_ready',
  bad_experience:  'prior_bad_experience',
  stigma:          'age_stigma',
  dont_know:       'needs_research',
  fear_dependence: 'fear_dependence',
  // 'other' intentionally not mapped — it has no actionable signal
};

function calcAge(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

function ageBandTag(age) {
  if (age == null) return null;
  if (age < 60) return 'age_under_60';
  if (age < 75) return 'age_60_to_75';
  return 'age_over_75';
}

// Convert raw threshold rows from the DB into per-ear { freq: dB } maps.
// Air conduction only - bone conduction is medical, not nurture-relevant.
function thresholdsByEar(rows) {
  const left = {}, right = {};
  for (const r of (rows || [])) {
    if (r.test_type && r.test_type !== 'air') continue;
    if (r.ear === 'left')  left[r.frequency]  = r.threshold_db;
    if (r.ear === 'right') right[r.frequency] = r.threshold_db;
  }
  return { left, right };
}

// Unwrap the kiosk { _meta, answers, consent } envelope when present.
function unwrapIntake(intakeAnswers) {
  if (!intakeAnswers) return null;
  if (intakeAnswers.answers && typeof intakeAnswers.answers === 'object') {
    return intakeAnswers.answers;
  }
  return intakeAnswers;
}

// ── Profile derivation ────────────────────────────────────────────────────
// Builds the normalized profile object the matcher consumes. All fields
// are flat - tags is the union of (TNS outcome tags) + (intake resistance,
// remapped) + (derived attribute tags from age / audiogram / aids history).
export function buildProfile({ patient, audiogram, thresholds, intake, tnsOutcome }) {
  const age = calcAge(patient?.dob);
  const inner = unwrapIntake(intake?.answers);
  const ears = thresholdsByEar(thresholds);

  const leftPTA  = getPTA(ears.left);
  const rightPTA = getPTA(ears.right);
  const severity = worseEarSeverity(ears.left, ears.right);
  const slope    = getSlope(ears.left) || getSlope(ears.right);
  const config   = getConfiguration(ears.left) || getConfiguration(ears.right);

  const wrsR = audiogram?.unaided_wrs_right;
  const wrsL = audiogram?.unaided_wrs_left;
  const wrsLow = (wrsR != null && wrsR < 80) || (wrsL != null && wrsL < 80);

  // Tag union — start with TNS outcome tags, layer intake mappings, then
  // derived attribute tags from clinical state.
  const tags = new Set();
  for (const t of (tnsOutcome?.outcome_reasons || [])) tags.add(t);
  for (const r of (inner?.resistancePoints || [])) {
    const mapped = INTAKE_RESISTANCE_TO_TAG[r];
    if (mapped) tags.add(mapped);
  }

  // Derived attribute tags — synthesized so content can match without
  // needing dedicated schema columns for each dimension.
  const ageTag = ageBandTag(age);
  if (ageTag) tags.add(ageTag);

  if (slope === 'sloping')      tags.add('slope_sloping');
  if (slope === 'flat')         tags.add('slope_flat');
  if (slope === 'rising')       tags.add('slope_rising');
  if (config === 'ski-slope' || config === 'high-freq') tags.add('high_freq_loss');
  if (isAsymmetric(ears.left, ears.right)) tags.add('asymmetric');

  if (wrsLow) tags.add('low_wrs');
  if (audiogram?.tinnitus_left || audiogram?.tinnitus_right || inner?.med_ring) {
    tags.add('tinnitus');
  }

  if (inner?.aids_q) tags.add('prior_aids_user');
  if (inner?.med_noise_occupational) tags.add('noise_occupational');
  if (inner?.med_noise_recreational) tags.add('noise_recreational');

  // hear_ready === false is the strongest "still in denial" signal we have
  // beyond explicit TNS tagging.
  if (inner?.hear_ready === false) tags.add('not_ready');

  return {
    patientId:       patient?.id,
    age,
    ageBand:         ageTag,
    severity,                                // 'mild' | 'moderate' | etc
    slope,                                   // 'sloping' | 'flat' | 'rising'
    configuration:   config,
    asymmetric:      isAsymmetric(ears.left, ears.right),
    leftPTA, rightPTA,
    wrsRight:        wrsR ?? null,
    wrsLeft:         wrsL ?? null,
    wrsLow,
    selfRating:      inner?.hear_rating ?? null,
    hearReady:       inner?.hear_ready ?? null,
    priorAids:       !!inner?.aids_q,
    payType:         patient?.pay_type || null,
    tags:            Array.from(tags),
    // Source attribution — handy for the preview UI's "why this content?"
    sources: {
      tnsTags:      tnsOutcome?.outcome_reasons || [],
      intakeTags:   (inner?.resistancePoints || []).map(r => INTAKE_RESISTANCE_TO_TAG[r]).filter(Boolean),
      hasAudiogram: !!audiogram?.id,
      hasIntake:    !!inner,
    },
  };
}

// ── Content scoring ───────────────────────────────────────────────────────
// Hard filters return -Infinity (item is excluded entirely).
// Otherwise base score 1.0, plus +2 per matched tag.
// Items with no positive criteria get a 0.5 baseline (generic filler).
//
// Returns { score, matched, why } where matched is the list of criteria
// that fired and why is a human-readable string for the preview UI.
export function scoreContent(content, profile) {
  const matched = [];
  const tagSet = new Set(profile.tags);

  // Hard exclude
  if (content.match_exclude_tags && content.match_exclude_tags.length) {
    for (const t of content.match_exclude_tags) {
      if (tagSet.has(t)) {
        return { score: -Infinity, matched: [], why: `excluded by tag: ${t}` };
      }
    }
  }

  // Hard filter: minimum age
  if (content.match_min_age != null) {
    if (profile.age == null || profile.age < content.match_min_age) {
      return { score: -Infinity, matched: [], why: `requires age ${content.match_min_age}+` };
    }
    matched.push(`age≥${content.match_min_age}`);
  }

  // Hard filter: minimum severity
  if (content.match_min_severity) {
    if (!severityAtLeast(profile.severity, content.match_min_severity)) {
      return {
        score: -Infinity, matched: [],
        why: `requires ${content.match_min_severity}+ loss (patient: ${profile.severity || 'unknown'})`,
      };
    }
    matched.push(`severity≥${content.match_min_severity}`);
  }

  // Tag overlap — additive scoring
  let tagBonus = 0;
  if (content.match_tags && content.match_tags.length) {
    for (const t of content.match_tags) {
      if (tagSet.has(t)) {
        tagBonus += 2;
        matched.push(`tag:${t}`);
      }
    }
  }

  // No positive criteria at all → generic content, low baseline
  const hasAnyPositive =
    (content.match_tags && content.match_tags.length) ||
    content.match_min_age != null ||
    content.match_min_severity != null;

  let score;
  if (!hasAnyPositive) {
    score = 0.5;
  } else if (tagBonus === 0 && (content.match_tags?.length || 0) > 0) {
    // Targeted at tags the patient doesn't have — score 1.0 (passed filters
    // but no positive match). Will lose to better-matched alternates.
    score = 1.0;
  } else {
    score = 1.0 + tagBonus;
  }

  return {
    score,
    matched,
    why: matched.length
      ? `matched: ${matched.join(', ')}`
      : (hasAnyPositive ? 'targeted but no tag overlap' : 'generic content'),
  };
}

// ── Per-step content selection ────────────────────────────────────────────
// Given a step's current content and a pool of alternatives in the same
// lifecycle phase, return the recommendation:
//   { recommended, currentScore, alternates: [...] }
// Sorted descending by score; ties broken by preferring the existing content.
export function selectForStep(currentContent, samePhasePool, profile) {
  const candidates = samePhasePool.map(c => ({
    content: c,
    ...scoreContent(c, profile),
  })).filter(c => c.score > -Infinity);

  // Always include the current content as a candidate even if it scored
  // -Infinity above (we want to show why it lost in the rationale).
  if (currentContent && !candidates.find(c => c.content.id === currentContent.id)) {
    candidates.push({
      content: currentContent,
      ...scoreContent(currentContent, profile),
    });
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie: prefer current content (no churn for equal matches)
    if (a.content.id === currentContent?.id) return -1;
    if (b.content.id === currentContent?.id) return 1;
    return 0;
  });

  const recommended = candidates[0];
  const currentScored = candidates.find(c => c.content.id === currentContent?.id);

  return {
    recommended: recommended?.content || currentContent,
    recommendedScore: recommended?.score ?? 0,
    recommendedWhy: recommended?.why || '',
    currentScore: currentScored?.score ?? null,
    swap: recommended && currentContent && recommended.content.id !== currentContent.id,
    alternates: candidates.slice(0, 4).map(c => ({
      id:    c.content.id,
      title: c.content.title,
      score: c.score,
      why:   c.why,
    })),
  };
}

// ── Whole-campaign personalization ────────────────────────────────────────
// Walks each delivery in a patient's enrolled campaign, looks up the
// content pool for that delivery's lifecycle phase, and produces a
// per-delivery recommendation.
//
// deliveries: rows from campaign_deliveries with nested campaign_steps →
//             campaign_content. Same shape as loadPatientCampaigns returns.
// contentPool: full clinic-scoped list of campaign_content rows with the
//              new match_* columns hydrated.
export function personalizeDeliveries(deliveries, profile, contentPool) {
  return (deliveries || []).map(delivery => {
    const step = delivery.campaign_steps;
    const currentContent = step?.campaign_content || null;
    const phase = currentContent?.lifecycle_phase;
    const pool = phase
      ? contentPool.filter(c => c.lifecycle_phase === phase)
      : [];

    const sel = selectForStep(currentContent, pool, profile);

    return {
      deliveryId:      delivery.id,
      scheduledDate:   delivery.scheduled_date,
      status:          delivery.status,
      stepOrder:       step?.step_order,
      delayDays:       step?.delay_days,
      channel:         step?.delivery_channel,
      phase,
      current: currentContent && {
        id:    currentContent.id,
        title: currentContent.title,
        score: sel.currentScore,
      },
      recommended: sel.recommended && {
        id:    sel.recommended.id,
        title: sel.recommended.title,
        body:  sel.recommended.body,
        score: sel.recommendedScore,
      },
      swap:        sel.swap,
      rationale:   sel.recommendedWhy,
      alternates:  sel.alternates,
    };
  });
}
