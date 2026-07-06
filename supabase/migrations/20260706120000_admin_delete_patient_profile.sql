-- Admin patient-profile deletion (Admin → Settings → Delete Patient Profile).
--
-- patients has never had a DELETE policy, so profile deletion was impossible
-- from the client — RLS silently blocked it for every role. Rather than adding
-- a broad DELETE policy and rewiring the three FKs that don't cascade
-- (appointment_outcomes, price_adjustment_log, lima_charlie_donations — all
-- audit-style tables whose delete semantics shouldn't change globally),
-- deletion goes through a single SECURITY DEFINER RPC that verifies the caller
-- is an admin, clears the non-cascading child rows for that one patient, and
-- deletes the patient row.
--
-- Every other child table cascades via its existing FK (verified against the
-- live schema): appointments, audiograms (+thresholds), device_fittings
-- (+sides), insurance_coverage, kiosk_upgrade_sessions, lima_charlie_events,
-- notification_log, patient_achievements, patient_campaigns (+deliveries),
-- patient_documents, patient_messages, punch_cards (+usage),
-- purchase_configuration (+line items), push_subscriptions,
-- recommendation_engine_output, tns_outcomes, upgrade_assessments,
-- va_episodes, visits. intakes.patient_id is ON DELETE SET NULL, so intake
-- history survives unlinked.
--
-- Two grandchild FKs are NO ACTION (lima_charlie_events.fitting_id →
-- device_fittings, appointment_outcomes.visit_id → visits). Both are satisfied
-- because NO ACTION defers its check to end of statement: the patient's
-- lima_charlie_events rows cascade away in the same DELETE statement as their
-- fittings, and the patient's appointment_outcomes rows are removed explicitly
-- before visits cascade.

create or replace function public.delete_patient_profile(p_patient_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select role from public.staff where id = (select auth.uid())) is distinct from 'admin' then
    raise exception 'only admins may delete patient profiles';
  end if;

  if not exists (select 1 from public.patients where id = p_patient_id) then
    raise exception 'patient not found';
  end if;

  -- Children whose FK to patients does not cascade (audit-style tables).
  delete from public.appointment_outcomes   where patient_id = p_patient_id;
  delete from public.price_adjustment_log   where patient_id = p_patient_id;
  delete from public.lima_charlie_donations where patient_id = p_patient_id;

  -- Everything else cascades from here (see header comment).
  delete from public.patients where id = p_patient_id;
end $$;

revoke all on function public.delete_patient_profile(uuid) from public, anon;
grant execute on function public.delete_patient_profile(uuid) to authenticated;

-- Storage: staff have SELECT/INSERT on the patient-documents bucket but no
-- DELETE, so a deleted patient's archived files would orphan. Admin-only
-- delete, scoped to the bucket. db.js removes the files via the storage API
-- (best-effort) before calling the RPC, while the patient_documents rows
-- holding the storage paths still exist.
drop policy if exists admin_delete_patient_documents_storage on storage.objects;
create policy admin_delete_patient_documents_storage
  on storage.objects
  for delete
  using (
    bucket_id = 'patient-documents'
    and (select role from public.staff where id = (select auth.uid())) = 'admin'
  );
