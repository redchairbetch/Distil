-- 015_product_compendium_schema.sql
-- Product Compendium Phase 1a: extend product_catalog and add receivers/domes/colors/plan-eligibility tables.
-- Additive only. No data seeding, no destructive changes.

-- 1. product_catalog: additive columns
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS parent_platform                text,
  ADD COLUMN IF NOT EXISTS display_generation             text,
  ADD COLUMN IF NOT EXISTS requires_proprietary_software  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at                     timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.product_catalog.parent_platform IS
  'For private-label brands, the parent manufacturer platform (e.g., Relate -> Unitron).';
COMMENT ON COLUMN public.product_catalog.display_generation IS
  'Optional human-facing platform label (e.g., Rexton "Reach Plus"). Falls back to generation when NULL. Does NOT affect getDomeOptions() which still keys on the generation column.';
COMMENT ON COLUMN public.product_catalog.requires_proprietary_software IS
  'True when fitting requires manufacturer-proprietary software (Widex, some Starkey, Beltone).';

-- 2. product_receivers (RIC/BTE)
CREATE TABLE IF NOT EXISTS public.product_receivers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_catalog_id  text NOT NULL REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  receiver_type       text NOT NULL,
  receiver_length     text,
  power_class         text,
  is_default          boolean NOT NULL DEFAULT false,
  active              boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_catalog_id, receiver_type, receiver_length)
);

CREATE INDEX IF NOT EXISTS idx_product_receivers_catalog_active
  ON public.product_receivers (product_catalog_id, active);

-- 3. product_domes
CREATE TABLE IF NOT EXISTS public.product_domes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_catalog_id  text NOT NULL REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  receiver_type       text,
  dome_name           text NOT NULL,
  dome_sizes          text[] NOT NULL DEFAULT '{}'::text[],
  is_default          boolean NOT NULL DEFAULT false,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_domes_catalog
  ON public.product_domes (product_catalog_id, receiver_type);

-- 4. product_colors  (product_catalog.colors[] stays in place during transition)
CREATE TABLE IF NOT EXISTS public.product_colors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_catalog_id  text NOT NULL REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  color_name          text NOT NULL,
  color_hex           text,
  is_default          boolean NOT NULL DEFAULT false,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_catalog_id, color_name)
);

CREATE INDEX IF NOT EXISTS idx_product_colors_catalog
  ON public.product_colors (product_catalog_id);

-- 5. plan_product_eligibility (FK to product_catalog_tier, integer cents)
CREATE TABLE IF NOT EXISTS public.plan_product_eligibility (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                  uuid NOT NULL REFERENCES public.insurance_plans(id) ON DELETE CASCADE,
  product_catalog_tier_id  uuid NOT NULL REFERENCES public.product_catalog_tier(id) ON DELETE CASCADE,
  patient_oop_per_aid      integer NOT NULL,
  subsidy_per_aid          integer,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, product_catalog_tier_id)
);

CREATE INDEX IF NOT EXISTS idx_ppe_plan ON public.plan_product_eligibility (plan_id);
CREATE INDEX IF NOT EXISTS idx_ppe_tier ON public.plan_product_eligibility (product_catalog_tier_id);

-- 6. updated_at triggers: reuse existing public.update_updated_at()
DROP TRIGGER IF EXISTS product_catalog_set_updated_at ON public.product_catalog;
CREATE TRIGGER product_catalog_set_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS ppe_set_updated_at ON public.plan_product_eligibility;
CREATE TRIGGER ppe_set_updated_at
  BEFORE UPDATE ON public.plan_product_eligibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7. RLS: mirror product_catalog (authenticated read, admin write)
ALTER TABLE public.product_receivers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_domes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_colors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_product_eligibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_read_product_receivers ON public.product_receivers
  FOR SELECT TO public
  USING ((SELECT auth.role()) = 'authenticated');

CREATE POLICY admin_manage_product_receivers ON public.product_receivers
  FOR ALL TO public
  USING ((SELECT staff.role FROM staff WHERE staff.id = (SELECT auth.uid())) = 'admin');

CREATE POLICY authenticated_read_product_domes ON public.product_domes
  FOR SELECT TO public
  USING ((SELECT auth.role()) = 'authenticated');

CREATE POLICY admin_manage_product_domes ON public.product_domes
  FOR ALL TO public
  USING ((SELECT staff.role FROM staff WHERE staff.id = (SELECT auth.uid())) = 'admin');

CREATE POLICY authenticated_read_product_colors ON public.product_colors
  FOR SELECT TO public
  USING ((SELECT auth.role()) = 'authenticated');

CREATE POLICY admin_manage_product_colors ON public.product_colors
  FOR ALL TO public
  USING ((SELECT staff.role FROM staff WHERE staff.id = (SELECT auth.uid())) = 'admin');

CREATE POLICY authenticated_read_plan_product_eligibility ON public.plan_product_eligibility
  FOR SELECT TO public
  USING ((SELECT auth.role()) = 'authenticated');

CREATE POLICY admin_manage_plan_product_eligibility ON public.plan_product_eligibility
  FOR ALL TO public
  USING ((SELECT staff.role FROM staff WHERE staff.id = (SELECT auth.uid())) = 'admin');
