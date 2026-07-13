-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Nations catalog completeness: add the ReSound value lines (Key, Savi) and the
-- Nations-covered legacy Oticon Own that were missing from product_catalog, so
-- Nations patients can pick their no-OOP options (Key 3 / Savi 2 land in the
-- Standard tier). All are Nations-only (tpa = 'Nations' → visibleCatalog shows
-- them only to Nations patients, like Relate is to UHCH). On-plan pricing
-- resolves via nationsCoverageTier (extended in lib/pricing.js), so no
-- product_catalog_tier rows are needed. Tiers verified against the
-- NationsBenefits Hearing Aids Pricing Catalog.

insert into public.product_catalog
  (id, manufacturer, family, generation, styles, tech_levels, variants, battery_options, colors, tpa, active, notes)
values
  ('res-key-ric', 'Resound', 'Key', 'Key',
   array['ric','bte'], array['4','3'], array['Standard'],
   array['Rechargeable','Size 312','Size 13'],
   array['Silver','Champagne','Rose Gold','Dark Brown','Carbon Black','Ivory'],
   'Nations', true,
   'Nations value line (Nations-only). Key 3 → Standard tier, Key 4 → Select. A no-OOP option on Aetna MA. RIC/BTE forms.'),
  ('res-key-custom', 'Resound', 'Key Custom', 'Key',
   array['itc','ite'], array['4','3'], array['Standard'],
   array['Size 312','Size 10','Size 13'],
   array['Tan','Light Brown','Medium Brown','Dark Brown','Black'],
   'Nations', true,
   'Nations value line customs (Nations-only). Key 3/4 custom → Superior Plus.'),
  ('res-savi-ric', 'Resound', 'Savi', 'Savi',
   array['ric','bte'], array['3','2'], array['Standard'],
   array['Rechargeable','Size 312','Size 13'],
   array['Silver','Champagne','Rose Gold','Dark Brown','Carbon Black','Ivory'],
   'Nations', true,
   'Nations value line (Nations-only). Savi 2 → Standard, Savi 3 → Select. A no-OOP option. Customs excluded per clinic.'),
  ('oti-own', 'Oticon', 'Own', 'Own',
   array['cic','iic','itc','ite'], array['1','2','3','4','5'], array['Standard'],
   array['Size 312','Size 10','Size 13'],
   array['Tan','Light Brown','Medium Brown','Dark Brown','Black'],
   'Nations', true,
   'Nations-covered legacy Own custom line (pre-Intent, Nations-only). Own 1/2 → Specialty, 3 → Advanced Plus, 4/5 → Superior Plus. Distinct from oti-own-intent.')
on conflict (id) do nothing;
