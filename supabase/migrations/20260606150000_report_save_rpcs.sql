-- Least-privilege write layer for report persistence. SUPABASE_KEY (the only key the app holds)
-- is the ANON key, which RLS blocks from writing reports/buyer_bcs/farmer_bcs — so these inserts
-- had been failing silently. Rather than introduce an all-powerful service_role key into the app
-- (a large attack surface), each save goes through a bounded SECURITY DEFINER function that can
-- ONLY insert into its one table, with columns mapped by jsonb_populate_record (id is excluded so
-- the identity column auto-generates). Same pattern as apply_intelligence_updates / bootstrap_region.

create or replace function public.save_report(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.reports
    (company, sector, crop, region, volume, current_price, premium, verdict, feasibility,
     price_range, input_data, report_data, created_at)
  select r.company, r.sector, r.crop, r.region, r.volume, r.current_price, r.premium, r.verdict,
         r.feasibility, r.price_range, r.input_data, r.report_data, coalesce(r.created_at, now())
  from jsonb_populate_record(null::public.reports, p) r;
end; $$;

create or replace function public.save_buyer_bc(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.buyer_bcs
    (user_id, company, sector, crop, region, volume, current_price, net_value, risk_reduction,
     feasibility, verdict, justifiable_farm_price)
  select b.user_id, b.company, b.sector, b.crop, b.region, b.volume, b.current_price, b.net_value,
         b.risk_reduction, b.feasibility, b.verdict, b.justifiable_farm_price
  from jsonb_populate_record(null::public.buyer_bcs, p) b;
end; $$;

create or replace function public.save_farmer_bc(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.farmer_bcs
    (user_id, farm_name, region, hectares, soil_type, crops, net_value, verdict)
  select f.user_id, f.farm_name, f.region, f.hectares, f.soil_type, f.crops, f.net_value, f.verdict
  from jsonb_populate_record(null::public.farmer_bcs, p) f;
end; $$;

grant execute on function public.save_report(jsonb)     to anon, authenticated;
grant execute on function public.save_buyer_bc(jsonb)   to anon, authenticated;
grant execute on function public.save_farmer_bc(jsonb)  to anon, authenticated;
