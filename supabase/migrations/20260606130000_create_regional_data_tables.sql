-- Regional benchmark layer: moves the hardcoded REGIONAL_CROP_DATA / RISK_PCT / LOGISTICS
-- region tables out of api/generate.js into the database, so a new region becomes an INSERT
-- (or an auto-bootstrap) instead of a code deploy. The engine reads these live with the
-- hardcoded JS as a fallback, so behaviour is unchanged when the tables are empty/unreachable.

-- ── region_coefficients: per source region (currentSource) — risk + logistics + customs ──
create table if not exists public.region_coefficients (
  region_key              text primary key,          -- matches currentSource (e.g. 'uk', 'netherlands')
  label                   text,
  crop_region             text,                       -- which regional_crop_data region this source uses
  geopolitical_pct        numeric,
  weather_conv_pct        numeric,
  transport_cost_per_t    numeric,
  transport_distance_km   integer,
  transport_transit_days  integer,
  transport_buffer_weeks  integer,
  load_factor             numeric,
  import_cost             numeric,
  is_sea_route            boolean default false,
  is_eu                   boolean default false,
  status                  text default 'active',      -- active | provisional | review
  source_label            text,
  updated_at              timestamptz default now()
);

-- ── regional_crop_data: per production region + crop — yield / price / variable cost ──
create table if not exists public.regional_crop_data (
  id                bigint generated always as identity primary key,
  crop_region       text not null,                    -- e.g. 'nl', 'uk_norfolk'
  crop              text not null,
  yield_t_ha        numeric,
  price_conv        numeric,                           -- conventional, EUR/t
  variable_cost_ha  numeric,                           -- EUR/ha
  source_label      text,
  status            text default 'active',             -- active | provisional | unverified
  updated_at        timestamptz default now(),
  unique (crop_region, crop)
);

-- Reference data (non-sensitive) — allow anon read so the buyer report can use it live.
alter table public.region_coefficients enable row level security;
alter table public.regional_crop_data  enable row level security;
drop policy if exists "anon_read_region_coefficients" on public.region_coefficients;
create policy "anon_read_region_coefficients" on public.region_coefficients for select to anon using (true);
drop policy if exists "anon_read_regional_crop_data" on public.regional_crop_data;
create policy "anon_read_regional_crop_data" on public.regional_crop_data for select to anon using (true);

-- ── Seed: migrate the current hardcoded regions 1:1 (idempotent) ──
insert into public.region_coefficients
  (region_key, label, crop_region, geopolitical_pct, weather_conv_pct,
   transport_cost_per_t, transport_distance_km, transport_transit_days, transport_buffer_weeks,
   load_factor, import_cost, is_sea_route, is_eu, status, source_label)
values
  ('netherlands',  'Netherlands only',            'nl',         0.02,  0.20,  8, 120,  1, 1, 0.75,  0, false, true,  'active', 'Orbag baseline 2024'),
  ('mixed_eu',     'Mixed EU countries',          'nl',         0.045, 0.18, 22, 900,  3, 2, 0.82,  0, false, true,  'active', 'Orbag baseline 2024'),
  ('morocco_egypt','Morocco / Egypt (N. Africa)', 'nl',         0.15,  0.30, 68, 3400, 14,4, 0.78, 18, true,  false, 'active', 'WUR 2024 / JRC MARS'),
  ('turkey_spain', 'Turkey / Spain (S. Europe)',  'nl',         0.08,  0.22, 42, 2200, 8, 3, 0.80,  0, true,  false, 'active', 'Orbag baseline 2024'),
  ('mixed_global', 'Mixed global (3+ countries)', 'nl',         0.115, 0.25, 75, 4000, 18,5, 0.78, 22, true,  false, 'active', 'Orbag baseline 2024'),
  ('uk',           'United Kingdom (Norfolk)',    'uk_norfolk', 0.04,  0.22, 30, 480,  2, 2, 0.82, 45, true,  false, 'active', 'AHDB / Orbag 2024/25')
on conflict (region_key) do nothing;

insert into public.regional_crop_data
  (crop_region, crop, yield_t_ha, price_conv, variable_cost_ha, source_label, status)
values
  ('nl','green_beans',10.0, 330, 2100, 'KWIN-AGV 2024', 'active'),
  ('nl','wheat',       9.4, 230, 1400, 'KWIN-AGV 2024', 'active'),
  ('nl','potatoes',   49.5, 170, 3300, 'KWIN-AGV 2024', 'active'),
  ('nl','onions',     47.0, 130, 8507, 'KWIN-AGV 2024', 'active'),
  ('nl','lentils',     4.5, 420, 1000, 'KWIN-AGV 2024', 'active'),
  ('nl','oats',        5.2, 210,  950, 'KWIN-AGV 2024', 'active'),
  ('nl','peas',        5.0, 420, 1000, 'KWIN-AGV 2024', 'active'),
  ('nl','carrots',    80.0, 100, 2200, 'KWIN-AGV 2024', 'active'),
  ('uk_norfolk','wheat',    8.0, 235,  670, 'AHDB Farmbench / Grain Market Daily 2024/25', 'active'),
  ('uk_norfolk','potatoes',45.0, 230, 2350, 'AHDB Farmbench / Grain Market Daily 2024/25', 'active'),
  ('uk_norfolk','peas',     4.2, 280,  290, 'AHDB Farmbench / Grain Market Daily 2024/25', 'active')
on conflict (crop_region, crop) do nothing;
