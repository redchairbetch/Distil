-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: did_not_test_reason_constraints
-- Created: 2026-07-16
-- Description: second half of the Did Not Test path (see 20260716120000).
-- A did_not_test disposition must carry a reason, same iff shape as
-- deferred/declined. Split from the enum-value migration because Postgres
-- forbids using a new enum value in the transaction that added it.

ALTER TABLE appointment_outcomes DROP CONSTRAINT device_reason_iff_deferred_declined;
ALTER TABLE appointment_outcomes ADD CONSTRAINT device_reason_iff_required CHECK (
  (device_disposition IN ('deferred','declined','did_not_test')) = (device_reason IS NOT NULL)
);

-- Kept symmetric with the device layer even though the UI never offers
-- did_not_test on the care-plan layer — a lopsided pair of constraints is a
-- trap for the next migration.
ALTER TABLE appointment_outcomes DROP CONSTRAINT care_plan_reason_iff_deferred_declined;
ALTER TABLE appointment_outcomes ADD CONSTRAINT care_plan_reason_iff_required CHECK (
  (care_plan_disposition IN ('deferred','declined','did_not_test')) = (care_plan_reason IS NOT NULL)
);
