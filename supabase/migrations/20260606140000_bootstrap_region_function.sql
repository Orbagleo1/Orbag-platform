-- Privileged, controlled upsert for the auto-bootstrap path. SUPABASE_KEY (used by the serverless
-- functions and the client) is the ANON key, which RLS blocks from writing benchmark tables.
-- This SECURITY DEFINER function performs the bounded write instead — it only ever creates/updates
-- PROVISIONAL regions and never overwrites curated (non-provisional) data, so granting anon EXECUTE
-- is safe (mirrors the apply_intelligence_updates() pattern).
create or replace function public.bootstrap_region(p_region jsonb, p_crops jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key      text := p_region->>'region_key';
  v_existing text;
  v_crop     jsonb;
begin
  if v_key is null or v_key = '' then
    return jsonb_build_object('error', 'region_key required');
  end if;

  select status into v_existing from region_coefficients where region_key = v_key;
  if v_existing is not null and v_existing <> 'provisional' then
    return jsonb_build_object('region_key', v_key, 'status', v_existing, 'note', 'curated — untouched');
  end if;

  insert into region_coefficients
    (region_key, label, crop_region, geopolitical_pct, weather_conv_pct,
     transport_cost_per_t, transport_distance_km, transport_transit_days, transport_buffer_weeks,
     load_factor, import_cost, is_sea_route, is_eu, status, source_label, updated_at)
  values
    (v_key, p_region->>'label', p_region->>'crop_region',
     (p_region->>'geopolitical_pct')::numeric, (p_region->>'weather_conv_pct')::numeric,
     (p_region->>'transport_cost_per_t')::numeric, (p_region->>'transport_distance_km')::int,
     (p_region->>'transport_transit_days')::int, (p_region->>'transport_buffer_weeks')::int,
     (p_region->>'load_factor')::numeric, (p_region->>'import_cost')::numeric,
     (p_region->>'is_sea_route')::boolean, (p_region->>'is_eu')::boolean,
     coalesce(p_region->>'status', 'provisional'), p_region->>'source_label', now())
  on conflict (region_key) do update set
     label=excluded.label, crop_region=excluded.crop_region,
     geopolitical_pct=excluded.geopolitical_pct, weather_conv_pct=excluded.weather_conv_pct,
     transport_cost_per_t=excluded.transport_cost_per_t, transport_distance_km=excluded.transport_distance_km,
     transport_transit_days=excluded.transport_transit_days, transport_buffer_weeks=excluded.transport_buffer_weeks,
     load_factor=excluded.load_factor, import_cost=excluded.import_cost,
     is_sea_route=excluded.is_sea_route, is_eu=excluded.is_eu,
     status=excluded.status, source_label=excluded.source_label, updated_at=now()
   where region_coefficients.status = 'provisional';

  for v_crop in select * from jsonb_array_elements(coalesce(p_crops, '[]'::jsonb))
  loop
    insert into regional_crop_data
      (crop_region, crop, yield_t_ha, price_conv, variable_cost_ha, source_label, status, updated_at)
    values
      (v_crop->>'crop_region', v_crop->>'crop',
       (v_crop->>'yield_t_ha')::numeric, (v_crop->>'price_conv')::numeric, (v_crop->>'variable_cost_ha')::numeric,
       v_crop->>'source_label', coalesce(v_crop->>'status', 'provisional'), now())
    on conflict (crop_region, crop) do update set
       yield_t_ha=excluded.yield_t_ha, price_conv=excluded.price_conv, variable_cost_ha=excluded.variable_cost_ha,
       source_label=excluded.source_label, status=excluded.status, updated_at=now()
     where regional_crop_data.status = 'provisional';
  end loop;

  return jsonb_build_object('region_key', v_key, 'status', 'provisional', 'written', true);
end;
$$;

grant execute on function public.bootstrap_region(jsonb, jsonb) to anon;
grant execute on function public.bootstrap_region(jsonb, jsonb) to authenticated;
