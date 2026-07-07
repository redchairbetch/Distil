-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- 007_add_intake_assessment_fields.sql
-- Narrative Thread UX (backlog #8) — PR 1: Chapter intro pattern + Chapter 1 enhancements.
-- Adds two provider-assessed fields captured during the Health History wizard step:
--   motivation_score (1-10) and soft_commitment ('high'|'medium'|'low'|'unknown').
-- Both columns are nullable so existing intake rows are unaffected, and live on
-- intakes (not patients) so each new visit captures fresh scores alongside the
-- chief_complaint already stored in answers.

ALTER TABLE intakes
  ADD COLUMN motivation_score integer,
  ADD COLUMN soft_commitment  text;

ALTER TABLE intakes
  ADD CONSTRAINT motivation_score_range CHECK (motivation_score IS NULL OR motivation_score BETWEEN 1 AND 10),
  ADD CONSTRAINT soft_commitment_enum   CHECK (soft_commitment IS NULL OR soft_commitment IN ('high','medium','low','unknown'));

COMMENT ON COLUMN intakes.motivation_score IS 'Provider-assessed motivation 1-10, set during Chapter 1 / Health History review.';
COMMENT ON COLUMN intakes.soft_commitment  IS 'Provider-assessed soft commitment: high | medium | low | unknown. Captured during Chapter 1.';
