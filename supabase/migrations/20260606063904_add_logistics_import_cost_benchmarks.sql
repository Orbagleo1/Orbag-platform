-- Give FX signals a self-sharpening benchmark target.
-- The detector writes fx_risk signals to LOGISTICS.import_cost.<country> but no such
-- benchmark existed, so they could never be applied. Seed them at the FX baseline; the
-- apply step then tracks them to the live rate daily. FX.EUR_<pair> baselines stay intact
-- so the import-cost risk signal keeps firing against the 2024 reference.
insert into public.intelligence_benchmarks
  (field_path, current_value, unit, source, last_updated_at, last_updated_by, notes)
select v.field_path, v.current_value, 'rate', 'fx-live-tracked', now(), 'migration',
       'Live import FX rate, self-sharpened daily from ECB via apply_intelligence_updates()'
from (values
  ('LOGISTICS.import_cost.turkey_spain',  33.5),
  ('LOGISTICS.import_cost.morocco_egypt', 10.8),
  ('LOGISTICS.import_cost.mixed_global',   1.08)
) as v(field_path, current_value)
where not exists (
  select 1 from public.intelligence_benchmarks b where b.field_path = v.field_path
);
