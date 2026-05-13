-- 009_add_analytics_events.sql
-- Lightweight event sink for in-app product analytics. First consumers are
-- care_plan_viewed / care_plan_changed / care_plan_selected on the Care
-- Plan selection step (Distil.jsx step 6). Payload is jsonb so future
-- event shapes don't require schema changes.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name  text        NOT NULL,
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_event_name_created_at_idx
  ON public.analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_payload_patient_id_idx
  ON public.analytics_events ((payload->>'patient_id'));

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Authenticated staff may insert events that name themselves as the
-- provider. The payload provider_id must equal auth.uid().
CREATE POLICY "analytics_events_insert_own_provider"
  ON public.analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK ((payload->>'provider_id') = auth.uid()::text);

-- Staff can read events for their own clinic. Care-plan events store
-- clinic_id in the payload; this policy joins staff -> clinics for the gate.
CREATE POLICY "analytics_events_select_own_clinic"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (
    (payload->>'clinic_id') IN (
      SELECT s.clinic_id::text
      FROM public.staff s
      WHERE s.id = auth.uid()
    )
  );

COMMENT ON TABLE public.analytics_events IS 'Product analytics events. Payload is jsonb; query by event_name and payload->>''key''.';
