-- 016_fix_active_pro_silk_body_styles.sql
-- Backlog #29: Active Pro IX is instant-fit, not RIC. Silk Charge&Go IX is
-- organizationally instant-fit too. Flip product_catalog.styles to ['if'] for
-- both rows. Frontend BODY_STYLES + BODY_STYLE_IMG add 'if' (hasReceiver:false)
-- in the same PR; the existing TruHearing TH_BODY_STYLES already had IF.
--
-- No sig-silk-ax row exists in product_catalog (the AX entry is CATALOG_DEFAULT-only).
UPDATE public.product_catalog
SET    styles = ARRAY['if']::text[]
WHERE  id IN ('sig-active-ix', 'sig-silk-ix')
  AND  styles IS DISTINCT FROM ARRAY['if']::text[];
