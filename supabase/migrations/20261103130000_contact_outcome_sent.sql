-- Call-list escalation (backlog #43, phase 2): after repeated unanswered
-- calls the provider sends a letter/text. That attempt has no "answer" to
-- record, so it gets its own outcome: 'sent'.
alter table public.patient_contacts drop constraint if exists patient_contacts_outcome_check;
alter table public.patient_contacts add constraint patient_contacts_outcome_check
  check (outcome in ('reached', 'voicemail', 'no_answer', 'scheduled', 'declined', 'sent'));
