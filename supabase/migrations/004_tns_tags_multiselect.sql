-- Migration: 004_tns_tags_multiselect
-- Created: 2026-04-27
-- Description: Replaces the grief-cycle UI's single-value outcome_reason +
--              grief_stage with a flat multi-select tag list (outcome_reasons text[]).
--              Existing rows are seed data and are dropped.

-- Wipe seed data so we can change column shape without backfill
DELETE FROM tns_outcomes;

-- Drop old constraints and columns
ALTER TABLE tns_outcomes
  DROP CONSTRAINT IF EXISTS tns_outcomes_outcome_reason_check,
  DROP CONSTRAINT IF EXISTS tns_outcomes_grief_stage_check,
  DROP COLUMN IF EXISTS outcome_reason,
  DROP COLUMN IF EXISTS grief_stage;

-- Add multi-select reasons array with allowlist + non-empty constraint
ALTER TABLE tns_outcomes
  ADD COLUMN outcome_reasons text[] NOT NULL,
  ADD CONSTRAINT tns_outcomes_outcome_reasons_nonempty
    CHECK (cardinality(outcome_reasons) >= 1),
  ADD CONSTRAINT tns_outcomes_outcome_reasons_allowed
    CHECK (outcome_reasons <@ ARRAY[
      'not_ready',
      'cost',
      'insurance_confusion',
      'vanity',
      'age_stigma',
      'shopping',
      'prior_bad_experience',
      'maintenance_burden',
      'feedback_concern',
      'fear_dependence',
      'needs_research',
      'needs_spouse',
      'tech_overwhelm',
      'wants_otc',
      'procrastination',
      'other'
    ]::text[]);

-- GIN index for tag lookups (e.g. WHERE 'cost' = ANY(outcome_reasons))
CREATE INDEX tns_outcomes_outcome_reasons_idx
  ON tns_outcomes USING GIN (outcome_reasons);
