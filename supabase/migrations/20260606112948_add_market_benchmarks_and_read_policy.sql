-- Live market benchmarks (energy, carbon, freight) — seeded with verified June 2026 values.
-- Refreshed by the intelligence-market edge function where a free feed exists; others are
-- dated reference values updated when a data source is wired.
insert into public.intelligence_benchmarks
  (field_path, current_value, unit, source, last_updated_at, last_updated_by, notes)
select v.field_path, v.current_value, v.unit, v.source, now(), 'migration', v.notes
from (values
  ('MARKET.eua_carbon_eur_t', 77.46, 'eur_per_ton',   'EEX / TradingEconomics', 'as_of 2026-06-06 — EU ETS EUA spot'),
  ('MARKET.cbam_eur_t',       75.36, 'eur_per_ton',   'EU CBAM (EC)',           'as_of 2026-04-07 — first official CBAM price, quarterly'),
  ('MARKET.diesel_eur_l',      2.161,'eur_per_litre', 'EC Weekly Oil Bulletin', 'as_of 2026-06-01 — NL pump diesel'),
  ('MARKET.wci_usd_40ft',   3433.0,  'usd_per_40ft',  'Drewry WCI',             'as_of 2026-06-04 — World Container Index')
) as v(field_path, current_value, unit, source, notes)
where not exists (
  select 1 from public.intelligence_benchmarks b where b.field_path = v.field_path
);

-- Reference benchmarks are non-sensitive; allow read so the buyer report (anon key) can use
-- live diesel/carbon. (User data tables stay locked down.)
drop policy if exists "anon_read_benchmarks" on public.intelligence_benchmarks;
create policy "anon_read_benchmarks" on public.intelligence_benchmarks
  for select to anon using (true);
