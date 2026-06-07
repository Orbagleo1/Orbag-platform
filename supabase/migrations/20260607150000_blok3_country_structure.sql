-- BLOK 3 (WORKORDER) — Landenstructuur klaarzetten voor Europa + Noord-Afrika.
-- Goal: the code can already handle all of Europe + North Africa; only the benchmark DATA is
-- missing. This migration lays down the empty-but-ready COUNTRY structure so an incoming benchmark
-- is live without a new migration. It fills DATA + a fail-loud status surface; it does NOT touch
-- calculation logic (generate.js stays out of scope — see the workorder open item).
--
-- PRIME DIRECTIVE (gate): no country may borrow another country's benchmark as a fallback. A country
-- without its own data must yield an explicit "no benchmark available" — fail loud. We honour this at
-- the DATA layer: we do NOT insert placeholder benchmark rows into intelligence_benchmarks
-- (current_value is NOT NULL, so any placeholder would be a FABRICATED number — exactly what the
-- directive forbids). Instead the ABSENCE of a real benchmark row IS the "no benchmark available"
-- state, surfaced explicitly by the country_benchmark_status view below.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend intelligence_countries into a real country registry.
--    region_cluster is DESCRIPTIVE metadata only (display / grouping) — it must NEVER be used to
--    borrow another country's benchmark. engine_region_key links a country to the source/crop_region
--    key the engine already uses (nl -> 'nl', gb -> 'uk'); for new countries it defaults to the ISO.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.intelligence_countries
  add column if not exists iso_code                 text,
  add column if not exists currency                 text,
  add column if not exists region_cluster           text,
  add column if not exists benchmark_source_planned text,
  add column if not exists engine_region_key        text;

comment on column public.intelligence_countries.region_cluster is
  'Descriptive grouping only (eu_west / eu_north / eu_south / eu_east / eu_central / uk / north_africa). MUST NOT be used to borrow another country''s benchmark — fail loud instead.';
comment on column public.intelligence_countries.benchmark_source_planned is
  'The planned NATIONAL benchmark source for this country (NL=KWIN-AGV, UK=AHDB, DK=SEGES, PT=COTHN/GPP). NULL/UNASSIGNED until chosen. Per-country own-benchmark principle.';
comment on column public.intelligence_countries.engine_region_key is
  'The source/crop_region key the engine uses for this country (nl->nl, gb->uk). Defaults to ISO for new countries (no engine data yet -> fail-loud "no benchmark available").';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Seed EU-27 + UK + Morocco/Egypt/Tunisia. rotation_active=false so they do NOT enter the daily
--    crawl rotation until a source is wired (BLOK 4). Centroid lat/lon (lat/lon are NOT NULL and feed
--    Open-Meteo when a country is later activated). fx_pair set for non-EUR currencies so the FX
--    pipeline can track EUR_<ccy> once activated. key = ISO (lower); distinct from the legacy region
--    buckets (netherlands, morocco_egypt, …) which stay untouched.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.intelligence_countries
  (key, label, latitude, longitude, fx_pair, rotation_active, display_order,
   iso_code, currency, region_cluster, benchmark_source_planned, engine_region_key, notes)
values
  -- EU-27
  ('at','Austria',        47.6,  14.1, null,  false, 110, 'AT','EUR','eu_central','UNASSIGNED','at', null),
  ('be','Belgium',        50.6,   4.6, null,  false, 111, 'BE','EUR','eu_west',   'UNASSIGNED','be', null),
  ('bg','Bulgaria',       42.7,  25.3, 'BGN', false, 112, 'BG','BGN','eu_east',   'UNASSIGNED','bg', null),
  ('hr','Croatia',        45.1,  15.5, null,  false, 113, 'HR','EUR','eu_south',  'UNASSIGNED','hr', null),
  ('cy','Cyprus',         35.1,  33.4, null,  false, 114, 'CY','EUR','eu_south',  'UNASSIGNED','cy', null),
  ('cz','Czechia',        49.8,  15.5, 'CZK', false, 115, 'CZ','CZK','eu_central','UNASSIGNED','cz', null),
  ('dk','Denmark',        56.0,   9.5, 'DKK', false, 116, 'DK','DKK','eu_north',  'SEGES','dk', null),
  ('ee','Estonia',        58.6,  25.0, null,  false, 117, 'EE','EUR','eu_north',  'UNASSIGNED','ee', null),
  ('fi','Finland',        64.0,  26.0, null,  false, 118, 'FI','EUR','eu_north',  'UNASSIGNED','fi', null),
  ('fr','France',         46.6,   2.5, null,  false, 119, 'FR','EUR','eu_west',   'UNASSIGNED','fr', null),
  ('de','Germany',        51.2,  10.4, null,  false, 120, 'DE','EUR','eu_central','UNASSIGNED','de', null),
  ('gr','Greece',         39.1,  22.9, null,  false, 121, 'GR','EUR','eu_south',  'UNASSIGNED','gr', null),
  ('hu','Hungary',        47.2,  19.5, 'HUF', false, 122, 'HU','HUF','eu_east',   'UNASSIGNED','hu', null),
  ('ie','Ireland',        53.2,  -8.2, null,  false, 123, 'IE','EUR','eu_west',   'UNASSIGNED','ie', null),
  ('it','Italy',          42.8,  12.6, null,  false, 124, 'IT','EUR','eu_south',  'UNASSIGNED','it', null),
  ('lv','Latvia',         56.9,  24.6, null,  false, 125, 'LV','EUR','eu_north',  'UNASSIGNED','lv', null),
  ('lt','Lithuania',      55.2,  23.9, null,  false, 126, 'LT','EUR','eu_north',  'UNASSIGNED','lt', null),
  ('lu','Luxembourg',     49.8,   6.1, null,  false, 127, 'LU','EUR','eu_west',   'UNASSIGNED','lu', null),
  ('mt','Malta',          35.9,  14.4, null,  false, 128, 'MT','EUR','eu_south',  'UNASSIGNED','mt', null),
  ('nl','Netherlands',    52.2,   5.3, null,  false, 129, 'NL','EUR','eu_west',   'KWIN-AGV (WUR/BIJ12)','nl', 'Own verified benchmark live (KWIN-AGV via regional_crop_data nl).'),
  ('pl','Poland',         52.0,  19.1, 'PLN', false, 130, 'PL','PLN','eu_east',   'UNASSIGNED','pl', 'Auto-bootstrap verified provisional region exists; national benchmark source still to assign.'),
  ('pt','Portugal',       39.6,  -8.0, null,  false, 131, 'PT','EUR','eu_south',  'COTHN/GPP','pt', null),
  ('ro','Romania',        45.9,  24.9, 'RON', false, 132, 'RO','RON','eu_east',   'UNASSIGNED','ro', null),
  ('sk','Slovakia',       48.7,  19.7, null,  false, 133, 'SK','EUR','eu_central','UNASSIGNED','sk', null),
  ('si','Slovenia',       46.1,  14.8, null,  false, 134, 'SI','EUR','eu_south',  'UNASSIGNED','si', null),
  ('es','Spain',          40.2,  -3.7, null,  false, 135, 'ES','EUR','eu_south',  'UNASSIGNED','es', null),
  ('se','Sweden',         62.0,  15.0, 'SEK', false, 136, 'SE','SEK','eu_north',  'UNASSIGNED','se', null),
  -- UK
  ('gb','United Kingdom', 54.0,  -2.0, 'GBP', false, 140, 'GB','GBP','uk',        'AHDB','uk', 'Engine region key = uk (uk_norfolk crop data live, AHDB Farmbench).'),
  -- North Africa
  ('ma','Morocco',        31.8,  -7.1, 'MAD', false, 150, 'MA','MAD','north_africa','UNASSIGNED','ma', 'Part of the morocco_egypt legacy bucket; per-country benchmark still to source.'),
  ('eg','Egypt',          26.8,  30.8, 'EGP', false, 151, 'EG','EGP','north_africa','UNASSIGNED','eg', 'Part of the morocco_egypt legacy bucket; per-country benchmark still to source.'),
  ('tn','Tunisia',        34.0,   9.5, 'TND', false, 152, 'TN','TND','north_africa','UNASSIGNED','tn', null)
on conflict (key) do update set
  label                    = excluded.label,
  latitude                 = excluded.latitude,
  longitude                = excluded.longitude,
  fx_pair                  = excluded.fx_pair,
  iso_code                 = excluded.iso_code,
  currency                 = excluded.currency,
  region_cluster           = excluded.region_cluster,
  benchmark_source_planned = excluded.benchmark_source_planned,
  engine_region_key        = excluded.engine_region_key,
  updated_at               = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. country_benchmark_status — the fail-loud surface. For each registered country it reports whether
--    it has its OWN benchmark (a regional_crop_data row for its engine_region_key, or a country-scoped
--    intelligence_benchmarks field_path) and, if not, an EXPLICIT "no benchmark available" naming the
--    planned source. This is what the gate demands: a country without data never silently borrows
--    another's — it is visibly unavailable.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.country_benchmark_status as
with own as (
  select c.key,
         exists (
           select 1 from public.regional_crop_data rcd
           where rcd.crop_region = c.engine_region_key
              or rcd.crop_region like c.engine_region_key || '\_%'
         )
         or exists (
           select 1 from public.intelligence_benchmarks b
           where b.field_path like '%.' || c.engine_region_key
              or b.field_path like '%.' || c.engine_region_key || '.%'
         ) as has_own
  from public.intelligence_countries c
  where c.iso_code is not null
)
select c.key, c.iso_code, c.label, c.currency, c.region_cluster,
       c.engine_region_key, c.benchmark_source_planned, c.rotation_active,
       o.has_own as has_own_benchmark,
       case when o.has_own
            then 'own benchmark available (source: ' || coalesce(c.benchmark_source_planned, 'see regional_crop_data') || ')'
            else 'no benchmark available — planned source: ' || coalesce(nullif(c.benchmark_source_planned,'UNASSIGNED'), 'UNASSIGNED')
                 || ' — FAIL LOUD: do NOT fall back to another country'
       end as benchmark_status
from public.intelligence_countries c
join own o on o.key = c.key
order by c.region_cluster, c.label;

grant select on public.country_benchmark_status to anon, authenticated;
