-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: 005_campaign_personalization
-- Created: 2026-04-27
-- Description: Adds structured match criteria to campaign_content so the
--              personalization engine can swap content within fixed step
--              sequences based on patient tags + age + audiogram severity.
--              Also drops the now-dead nurture_enrollment table (superseded
--              by patient_campaigns / campaign_deliveries).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Add match criteria to campaign_content
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE campaign_content
  ADD COLUMN match_tags         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN match_min_age      int,
  ADD COLUMN match_min_severity text
    CHECK (match_min_severity IS NULL OR match_min_severity IN
      ('mild', 'moderate', 'mod-severe', 'severe', 'profound')),
  ADD COLUMN match_exclude_tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX campaign_content_match_tags_idx
  ON campaign_content USING GIN (match_tags);
CREATE INDEX campaign_content_match_exclude_tags_idx
  ON campaign_content USING GIN (match_exclude_tags);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Hand-tag ~20 highest-leverage TNS items
-- ═══════════════════════════════════════════════════════════════════════════
-- Keyed by title so both clinic copies update in one statement.
-- Items not updated here keep empty match_tags = generic content (low score
-- baseline; used as filler when no targeted match exists for a step).

-- ── COST REFRAME (5 items) ────────────────────────────────────────────────
UPDATE campaign_content SET match_tags = ARRAY['cost', 'insurance_confusion']
  WHERE title = 'Your Insurance May Cover More Than You Think';

UPDATE campaign_content SET match_tags = ARRAY['cost'],
                            match_exclude_tags = ARRAY['needs_research']
  WHERE title = 'Financing Options Available';

UPDATE campaign_content SET match_tags = ARRAY['cost'],
                            match_min_severity = 'moderate'
  WHERE title = 'The Real Cost of NOT Treating Hearing Loss';

UPDATE campaign_content SET match_tags = ARRAY['cost'],
                            match_min_age = 60
  WHERE title = 'Investment in Yourself';

UPDATE campaign_content SET match_tags = ARRAY['cost', 'insurance_confusion']
  WHERE title = 'Understanding Your Hearing Benefit';

-- ── BRAIN HEALTH (4 items) ────────────────────────────────────────────────
-- Cognitive-decline content lands on older patients with at least moderate loss.
UPDATE campaign_content SET match_min_age = 60, match_min_severity = 'moderate'
  WHERE title = 'The Hidden Connection: Hearing Loss and Cognitive Decline';

UPDATE campaign_content SET match_min_age = 65, match_min_severity = 'moderate'
  WHERE title = 'What Happens When Hearing Loss Goes Untreated';

UPDATE campaign_content SET match_tags = ARRAY['needs_research'],
                            match_min_age = 55
  WHERE title = '48% — A Number Worth Knowing';

UPDATE campaign_content SET match_min_severity = 'mild'
  WHERE title = 'The Auditory Deprivation Effect';

-- ── MYTH BUSTING (5 items) ────────────────────────────────────────────────
UPDATE campaign_content SET match_tags = ARRAY['vanity', 'age_stigma']
  WHERE title = 'Myth: "Hearing Aids Make You Look Old"';

UPDATE campaign_content SET match_tags = ARRAY['not_ready', 'procrastination']
  WHERE title = 'Myth: "My Hearing Isn''t Bad Enough for Hearing Aids"';

UPDATE campaign_content SET match_tags = ARRAY['not_ready', 'procrastination']
  WHERE title = 'Myth: "I''ll Just Turn Up the TV"';

UPDATE campaign_content SET match_tags = ARRAY['vanity', 'age_stigma']
  WHERE title = 'Nobody Notices';

UPDATE campaign_content SET match_tags = ARRAY['needs_spouse']
  WHERE title = 'The "My Uncle" Problem';

-- ── TECHNOLOGY (4 items) ──────────────────────────────────────────────────
UPDATE campaign_content SET match_tags = ARRAY['feedback_concern', 'prior_bad_experience']
  WHERE title = 'These Aren''t Your Grandfather''s Hearing Aids';

UPDATE campaign_content SET match_tags = ARRAY['vanity', 'age_stigma']
  WHERE title = 'Invisible, Discreet, and Powerful';

UPDATE campaign_content SET match_tags = ARRAY['maintenance_burden']
  WHERE title = 'No More Tiny Batteries';

UPDATE campaign_content SET match_tags = ARRAY['tech_overwhelm', 'wants_otc']
  WHERE title = 'Bluetooth Built In';

-- ── SOCIAL PROOF (2 items) ────────────────────────────────────────────────
UPDATE campaign_content SET match_tags = ARRAY['needs_spouse']
  WHERE title = 'The Spousal Perspective';

UPDATE campaign_content SET match_tags = ARRAY['needs_spouse']
  WHERE title = 'It''s Not Just About You';

-- ── BONUS / DEEP DIVES (3 items) ──────────────────────────────────────────
UPDATE campaign_content SET match_tags = ARRAY['wants_otc']
  WHERE title = 'Deep Dive: "OTC Hearing Aids Are Cheaper"';

UPDATE campaign_content SET match_tags = ARRAY['tech_overwhelm']
  WHERE title = 'Deep Dive: "Hearing Aids Are Complicated"';

UPDATE campaign_content SET match_tags = ARRAY['age_under_60', 'not_ready']
  WHERE title = 'Deep Dive: "I''m Too Young for Hearing Aids"';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Drop dead nurture_enrollment system
-- ═══════════════════════════════════════════════════════════════════════════
-- Superseded by patient_campaigns + campaign_deliveries (the working pipeline).
-- The 13 existing rows are stale orphans from an older flow.
DROP TABLE IF EXISTS nurture_enrollment;
