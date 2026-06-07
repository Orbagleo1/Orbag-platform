-- Generalize the crop-concentration cache for the WORLDWIDE provider foundation.
-- The cache is keyed by lat/lon, so it is the universal global store for any provider tier. Add
-- provenance columns so cells from different providers (NL BRP parcel data, future global WorldCereal /
-- cropland-proxy) coexist and the engine can surface method + confidence + coverage per farm.

alter table public.crop_concentration_grid add column if not exists source_id   text;  -- provider id, e.g. nl-brp
alter table public.crop_concentration_grid add column if not exists granularity text;  -- crop_type_parcel | crop_group_raster | cropland_only
alter table public.crop_concentration_grid add column if not exists confidence  text;  -- HIGH | MEDIUM | LOW
alter table public.crop_concentration_grid add column if not exists country     text;

-- Backfill the existing NL (Dronten) rows.
update public.crop_concentration_grid
  set source_id = 'nl-brp', granularity = 'crop_type_parcel', confidence = 'HIGH', country = 'nl'
  where source_id is null;

-- Extend the bounded upsert RPC with the provenance fields (back-compatible: absent -> null).
create or replace function public.save_concentration_grid(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crop_concentration_grid
    (crop, grid_lat, grid_lon, cell_km, radius_km, share, level, addon_pct,
     same_crop_ha, total_ha, n_parcels, source_label, brp_year, verified, computed_at,
     source_id, granularity, confidence, country)
  values
    (p->>'crop', (p->>'grid_lat')::float8, (p->>'grid_lon')::float8,
     coalesce((p->>'cell_km')::float8, 5), (p->>'radius_km')::float8,
     (p->>'share')::float8, p->>'level', (p->>'addon_pct')::float8,
     (p->>'same_crop_ha')::float8, (p->>'total_ha')::float8, (p->>'n_parcels')::int,
     p->>'source_label', (p->>'brp_year')::int, coalesce((p->>'verified')::bool, false), now(),
     p->>'source_id', p->>'granularity', p->>'confidence', p->>'country')
  on conflict (crop, grid_lat, grid_lon, radius_km) do update set
     share        = excluded.share,
     level        = excluded.level,
     addon_pct    = excluded.addon_pct,
     same_crop_ha = excluded.same_crop_ha,
     total_ha     = excluded.total_ha,
     n_parcels    = excluded.n_parcels,
     source_label = excluded.source_label,
     brp_year     = excluded.brp_year,
     computed_at  = now(),
     source_id    = excluded.source_id,
     granularity  = excluded.granularity,
     confidence   = excluded.confidence,
     country      = excluded.country;
end;
$$;

grant execute on function public.save_concentration_grid(jsonb) to anon;
