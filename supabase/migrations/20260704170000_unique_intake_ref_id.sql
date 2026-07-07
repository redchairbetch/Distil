-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Unique backstop for the patient-facing intake reference ID
-- (answers->_meta->intakeId, format MHC-YYYYMMDD-XXXXX). The 5-char random
-- part gives ~60M combinations per day — collisions are rare but possible,
-- and nothing enforced uniqueness until now. The kiosk handles a violation
-- by regenerating the ID and retrying, so this index never surfaces to a
-- patient as a hard failure.
--
-- NOTE: the kiosk's retry logic matches this index by name (/intake_ref/) —
-- if you rename it, update IntakeKiosk.jsx handleSubmit to match.

-- Suffix any pre-existing duplicates (-2, -3, …) so index creation can't fail.
with dupes as (
  select id,
         answers->'_meta'->>'intakeId' as ref,
         row_number() over (partition by answers->'_meta'->>'intakeId' order by id) as rn
  from intakes
  where answers->'_meta'->>'intakeId' is not null
)
update intakes i
set answers = jsonb_set(i.answers, '{_meta,intakeId}', to_jsonb(d.ref || '-' || d.rn::text))
from dupes d
where i.id = d.id and d.rn > 1;

create unique index if not exists intakes_intake_ref_id_uidx
  on intakes ((answers->'_meta'->>'intakeId'))
  where answers->'_meta'->>'intakeId' is not null;
