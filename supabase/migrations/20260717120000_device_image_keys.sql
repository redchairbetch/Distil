-- Device product images: image_key names a bundled asset in src/assets/devices/
-- (<image_key>.webp / .png — see src/deviceImages.js and src/assets/devices/MANIFEST.md).
-- One key = one physical shell. Keys are deliberately SHARED across rows and
-- across all three device tables wherever the housing is identical (tech levels
-- and colors don't change the shell; white-labels like KS9→Phonak Marvel and
-- TruHearing→Signia reuse the donor image), so ~90 sourced photos cover all
-- 173 catalog rows. NULL = no photo; the UI falls back to its existing
-- body-style silhouette rendering, so partial coverage degrades gracefully.

alter table public.product_catalog  add column if not exists image_key text;
alter table public.device_platforms add column if not exists image_key text;
alter table public.legacy_device    add column if not exists image_key text;

comment on column public.product_catalog.image_key  is 'Filename stem of the bundled device photo in src/assets/devices/. Shared across rows with the same shell. NULL = silhouette fallback.';
comment on column public.device_platforms.image_key is 'Filename stem of the bundled device photo in src/assets/devices/. Shared across rows with the same shell. NULL = silhouette fallback.';
comment on column public.legacy_device.image_key    is 'Filename stem of the bundled device photo in src/assets/devices/. Shared across rows with the same shell. NULL = silhouette fallback.';

-- ── product_catalog (wizard device selection) ────────────────────────────────
update public.product_catalog as pc set image_key = v.k from (values
  ('th7-ric-li-adv','th7-ric'), ('th7-ric-li-prem','th7-ric'),
  ('th7-sr-li-prem','th7-sr'),
  ('th7-if-li-prem','th7-if'),
  ('th7-custom-cic','th-custom-cic'), ('th7-custom-cic-prem','th-custom-cic'), ('th7-custom-cic-std','th-custom-cic'),
  ('th7-custom-iic','th-custom-cic'), ('th7-custom-iic-prem','th-custom-cic'), ('th7-custom-iic-std','th-custom-cic'),
  ('th7-custom-itc','th-custom-ite'), ('th7-custom-itc-std','th-custom-ite'),
  ('th6-custom-li-adv','th-custom-ite'), ('th6-custom-li-prem','th-custom-ite'),
  ('th6-ric-adv','th6-ric'), ('th6-ric-prem','th6-ric'), ('th6-ric-std','th6-ric'),
  ('th6-sr-li-prem','th6-sr'),
  ('th5-if-adv','th5-if'), ('th5-if-prem','th5-if'),
  ('th5-bte-std-hook-adv','th5-bte'), ('th5-bte-std-hook-prem','th5-bte'),
  ('th5-bte-std-thin-adv','th5-bte'), ('th5-bte-std-thin-prem','th5-bte'),
  ('th5-bte-pwr-hook-adv','th5-bte'), ('th5-bte-pwr-hook-prem','th5-bte'),
  ('th5-bte-pwr-thin-adv','th5-bte'), ('th5-bte-pwr-thin-prem','th5-bte'),
  ('th5-bte-sp-adv','th5-bte-sp'), ('th5-bte-sp-prem','th5-bte-sp'),
  ('sig-pure-ix','signia-pure-ix'), ('sig-pure-ax','signia-pure-ax'),
  ('sig-pure312-ax','signia-pure-312-ax'), ('entry-1777555930890','signia-pure-ux'),
  ('sig-styletto-ix','signia-styletto'), ('sig-styletto-ax','signia-styletto'),
  ('sig-motion-ix','signia-motion'), ('sig-motion-ax','signia-motion'),
  ('sig-silk-ix','signia-silk'), ('sig-active-ix','signia-active'),
  ('sig-insio-ite-ix','signia-insio-ite'), ('sig-insio-cg-ax-ite','signia-insio-ite'),
  ('sig-insio-itc-ix','signia-insio-itc'), ('sig-insio-cg-ax-itc','signia-insio-itc'),
  ('sig-insio-cic-ix','signia-insio-cic'), ('sig-insio-cg-ax-cic','signia-insio-cic'),
  ('sig-insio-iic-ix','signia-insio-iic'),
  ('rex-reach-plus','rexton-reach-ric'), ('rex-reach-r','rexton-reach-ric'),
  ('rex-reach-styleline','rexton-reach-sr'),
  ('rex-reach-inox-cic','rexton-inox-cic'), ('rex-bicore-inox-cic','rexton-inox-cic'),
  ('rex-bicore','rexton-bicore-ric'), ('rex-bicore-r312','rexton-bicore-ric'),
  ('rex-bicore-slim-ric','rexton-bicore-sr'), ('rex-bicore-bte','rexton-bicore-bte'),
  ('rex-bicore-custom','rexton-custom'),
  ('pho-audeo-infinio','phonak-audeo-infinio'), ('pho-sphere-infinio','phonak-sphere-infinio'),
  ('pho-audeo-lumity','phonak-audeo-lumity'),
  ('pho-naida-infinio','phonak-naida-infinio'), ('pho-naida-lumity','phonak-naida-lumity'),
  ('pho-virto-infinio','phonak-virto'),
  ('oti-intent','oticon-intent'), ('oti-real','oticon-real'),
  ('oti-own','oticon-own'), ('oti-own-intent','oticon-own'), ('oti-xceed','oticon-xceed'),
  ('res-vivia','resound-vivia'), ('res-nexia-ric','resound-nexia-ric'),
  ('res-nexia-custom','resound-nexia-custom'),
  ('res-key-ric','resound-key-ric'), ('res-key-custom','resound-key-custom'),
  ('res-savi-ric','resound-savi'), ('res-enzo-q','resound-enzo-q'),
  ('sta-genesis-ric','starkey-genesis-ric'), ('sta-edge-ai-ric','starkey-genesis-ric'), ('sta-omega-ai-ric','starkey-genesis-ric'),
  ('sta-genesis-bte','starkey-genesis-bte'), ('sta-edge-ai-bte','starkey-genesis-bte'), ('sta-omega-ai-bte','starkey-genesis-bte'),
  ('sta-genesis-custom','starkey-genesis-custom'), ('sta-edge-ai-custom','starkey-genesis-custom'), ('sta-omega-ai-custom','starkey-genesis-custom'),
  ('wid-moment-sheer','widex-moment-sheer'), ('wid-moment-bte','widex-moment-bte'), ('wid-moment-custom','widex-moment-custom'),
  ('relate-40-ric','relate-ric'), ('relate-50-ric','relate-ric'),
  ('relate-40-bte','relate-bte'), ('relate-50-custom','relate-custom')
) as v(id, k) where pc.id = v.id;

-- ── device_platforms (generational research catalog — LegacyFastPath /
--    CapabilityComparison). Matched on manufacturer + platform_name because
--    ids are UUIDs. White-label platforms reuse the donor manufacturer's key.
update public.device_platforms as dp set image_key = v.k from (values
  ('Apple','AirPods Pro 2 (Hearing Aid feature)','apple-airpods-pro-2'),
  ('Eargo','Eargo 8','eargo-cic'), ('Eargo','Eargo 7','eargo-cic'), ('Eargo','Link by Eargo','eargo-link'),
  ('HP','Hearing Pro','hp-hearing-pro'),
  ('Jabra','Enhance Pro 10','jabra-enhance-pro'), ('Jabra','Enhance Pro 20','jabra-enhance-pro'),
  ('Jabra','Enhance Pro 30','jabra-enhance-pro'), ('Jabra','Enhance Select','jabra-enhance-select'),
  ('Kirkland Signature','KS9','phonak-audeo-marvel'), ('Kirkland Signature','KS10','phonak-audeo-paradise'),
  ('Lexie','B1','lexie-b'), ('Lexie','B2','lexie-b'),
  ('Oticon','Opn S','oticon-opn'), ('Oticon','More','oticon-more'), ('Oticon','Real','oticon-real'),
  ('Oticon','Intent','oticon-intent'), ('Oticon','Zeal','oticon-zeal'),
  ('Philips','HearLink 9010','philips-hearlink'), ('Philips','HearLink 9030','philips-hearlink'),
  ('Philips','HearLink 9040','philips-hearlink'), ('Philips','HearLink 9050','philips-hearlink'),
  ('Phonak','Marvel','phonak-audeo-marvel'), ('Phonak','Paradise','phonak-audeo-paradise'),
  ('Phonak','Lumity','phonak-audeo-lumity'), ('Phonak','Infinio','phonak-audeo-infinio'),
  ('Phonak','Infinio Ultra','phonak-audeo-infinio-ultra'),
  ('ReSound','LiNX Quattro','resound-linx-quattro'), ('ReSound','ONE','resound-one'),
  ('ReSound','OMNIA','resound-omnia'), ('ReSound','Nexia','resound-nexia-ric'), ('ReSound','Vivia','resound-vivia'),
  ('Rexton','My Core','rexton-my-core'), ('Rexton','Motion Core','rexton-motion-core'),
  ('Rexton','BiCore','rexton-bicore-ric'), ('Rexton','Reach','rexton-reach-ric'),
  ('Sennheiser','All-Day Clear','sennheiser-all-day-clear'),
  ('Signia','Nx','signia-pure-nx'), ('Signia','X','signia-pure-x'),
  ('Signia','AX','signia-pure-ax'), ('Signia','IX','signia-pure-ix'),
  ('Sony','CRE-C10','sony-cre-c10'), ('Sony','CRE-C20','sony-cre-c20'), ('Sony','CRE-E10','sony-cre-e10'),
  ('Starkey','Livio','starkey-livio'), ('Starkey','Livio AI','starkey-livio'), ('Starkey','Livio Edge AI','starkey-livio'),
  ('Starkey','Evolv AI','starkey-evolv-ai'),
  ('Starkey','Genesis AI','starkey-genesis-ric'), ('Starkey','Edge AI','starkey-genesis-ric'),
  ('Starkey','Omega AI','starkey-genesis-ric'), ('Starkey','G Series AI','starkey-g-series'),
  ('TruHearing','TH5','th5-bte'), ('TruHearing','TH6','th6-ric'),
  ('TruHearing','TH7','th7-ric'), ('TruHearing','TH 19','th19-bte'),
  ('Unitron','Discover','unitron-moxi'), ('Unitron','Blu','unitron-moxi'),
  ('Unitron','Vivante','unitron-moxi'), ('Unitron','Smile','unitron-moxi'),
  ('Widex','Evoke','widex-evoke'), ('Widex','Moment','widex-moment-ric'),
  ('Widex','Moment Sheer','widex-moment-sheer'), ('Widex','SmartRIC','widex-smartric'), ('Widex','Allure','widex-allure')
) as v(mfr, pname, k) where dp.manufacturer = v.mfr and dp.platform_name = v.pname;

-- ── legacy_device (curated trade-in reference — Then vs Now old side).
--    costco-ks7 is left NULL: Signia primax-era Rexton clone with no press
--    imagery still in circulation; silhouette fallback covers it.
update public.legacy_device as ld set image_key = v.k from (values
  ('costco-ks8','signia-pure-nx'),
  ('costco-ks9','phonak-audeo-marvel'), ('costco-ks10','phonak-audeo-paradise'),
  ('phonak-audeo-marvel-m90','phonak-audeo-marvel'),
  ('phonak-audeo-paradise-p90','phonak-audeo-paradise'),
  ('phonak-audeo-lumity-l90','phonak-audeo-lumity'),
  ('signia-pure-7nx','signia-pure-nx'), ('signia-pure-7ax','signia-pure-ax'),
  ('oticon-opn-1','oticon-opn'), ('oticon-more-1','oticon-more'),
  ('resound-one-9','resound-one'), ('resound-nexia-9','resound-nexia-ric'),
  ('starkey-livio-ai-2400','starkey-livio'), ('starkey-genesis-ai-24','starkey-genesis-ric'),
  ('widex-moment-440','widex-moment-ric'), ('widex-moment-sheer-440','widex-moment-sheer')
) as v(id, k) where ld.id = v.id;
