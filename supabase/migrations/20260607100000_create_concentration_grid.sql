-- Crop-concentration precompute cache (todo2 follow-up).
-- The buyer engine cannot compute a 15 km same-crop concentration share inside a 60 s serverless
-- call (a 15 km radius in dense NL ≈ 43k BRP polygons). An OFFLINE precompute (scripts/precompute-
-- concentration.js) does the heavy area-based computation per grid point and stores the result here;
-- the engine then reads the nearest grid cell instantly. Anon-read (parity with the other read-only
-- engine tables); writes go through a bounded SECURITY DEFINER RPC, since SUPABASE_KEY is the anon key.

create table if not exists public.crop_concentration_grid (
  id            bigint generated always as identity primary key,
  crop          text             not null,
  grid_lat      double precision not null,
  grid_lon      double precision not null,
  cell_km       double precision not null default 5,
  radius_km     double precision not null,
  share         double precision not null,
  level         text             not null,
  addon_pct     double precision not null,
  same_crop_ha  double precision,
  total_ha      double precision,
  n_parcels     integer,
  source_label  text,
  brp_year      integer,
  verified      boolean          not null default false,
  computed_at   timestamptz      not null default now(),
  unique (crop, grid_lat, grid_lon, radius_km)
);

create index if not exists idx_concentration_grid_lookup
  on public.crop_concentration_grid (crop, grid_lat, grid_lon);

alter table public.crop_concentration_grid enable row level security;

drop policy if exists "anon read concentration grid" on public.crop_concentration_grid;
create policy "anon read concentration grid"
  on public.crop_concentration_grid for select to anon using (true);

-- Bounded upsert RPC — the anon key cannot insert into the table directly.
create or replace function public.save_concentration_grid(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crop_concentration_grid
    (crop, grid_lat, grid_lon, cell_km, radius_km, share, level, addon_pct,
     same_crop_ha, total_ha, n_parcels, source_label, brp_year, verified, computed_at)
  values
    (p->>'crop', (p->>'grid_lat')::float8, (p->>'grid_lon')::float8,
     coalesce((p->>'cell_km')::float8, 5), (p->>'radius_km')::float8,
     (p->>'share')::float8, p->>'level', (p->>'addon_pct')::float8,
     (p->>'same_crop_ha')::float8, (p->>'total_ha')::float8, (p->>'n_parcels')::int,
     p->>'source_label', (p->>'brp_year')::int, coalesce((p->>'verified')::bool, false), now())
  on conflict (crop, grid_lat, grid_lon, radius_km) do update set
     share        = excluded.share,
     level        = excluded.level,
     addon_pct    = excluded.addon_pct,
     same_crop_ha = excluded.same_crop_ha,
     total_ha     = excluded.total_ha,
     n_parcels    = excluded.n_parcels,
     source_label = excluded.source_label,
     brp_year     = excluded.brp_year,
     computed_at  = now();
end;
$$;

grant execute on function public.save_concentration_grid(jsonb) to anon;
