-- BLOK 2 (WORKORDER) — Match engine datamodel (van filter naar scoring).
-- GATED block: this lands the DATA MODEL (the niveau-1/2 fields that feed scoring) + the save-RPC
-- plumbing so they can be populated. The full multi-variable SCORING WEIGHTS are a BUSINESS decision
-- and are intentionally NOT wired here — they wait for Leo's sign-off (the BLOK 2 gate). The one
-- working net-value-per-tonne example is the standalone module api/match-economics.js + tests/match.test.js.
--
-- All new columns are NULLABLE with no data-implying defaults, so existing buyer_bcs/farmer_bcs rows
-- and the current match.html filter behave exactly as before. Niveau-3 (concentration / growth /
-- geopolitical complementarity) is DERIVED at match time from existing data — NOT stored here
-- (workorder: "Niet dubbel opslaan").

-- ── Buyer side (niveau 1: transaction, niveau 2: relationship) ──
alter table public.buyer_bcs
  add column if not exists seasonality           text,   -- year_round | seasonal | flexible
  add column if not exists delivery_spec         text,   -- fresh | frozen | canned | dried | any (drives cold-chain + perishability)
  add column if not exists quality_spec          text,   -- variety / dry-matter / grading requirement (free text)
  add column if not exists certification_required text,  -- required cert level (none | globalgap | planetproof | organic | demeter)
  add column if not exists contract_preference   text,   -- multiyear | spot | mixed
  add column if not exists risk_sharing          text,   -- who carries weather/price risk (buyer | shared | farmer)
  add column if not exists traceability_level    text,   -- csrd_ready | partial | none
  add column if not exists buyer_lat             numeric,
  add column if not exists buyer_lon             numeric,
  add column if not exists buyer_location        text;    -- customs area (nl/eu/uk); mirrors the request field

-- ── Farmer side (niveau 1: supply capacity, niveau 2: relationship) ──
alter table public.farmer_bcs
  add column if not exists deliverable_volume_t  numeric, -- tonnes the farm can supply
  add column if not exists harvest_window        text,    -- harvest month(s) / season
  add column if not exists quality_spec          text,    -- variety / dry-matter / grading offered
  add column if not exists certification         text,    -- current cert (none | globalgap | on_the_way | organic | demeter)
  add column if not exists contract_preference   text,    -- multiyear | spot | mixed
  add column if not exists transition_phase      text,    -- conventional | in_transition | regen
  add column if not exists farm_lat              numeric,
  add column if not exists farm_lon              numeric,
  add column if not exists country               text;

comment on column public.buyer_bcs.buyer_location is 'Customs area of the buyer (nl/eu/uk) — used by the match logistics submodule to charge cross-border duty only when farmer and buyer sit in different customs areas.';
comment on column public.farmer_bcs.deliverable_volume_t is 'Tonnes the farm can supply — feeds volume-fit (bundling) in the match engine. NULL until captured.';

-- ── Extend the save RPCs so the new niveau-1/2 columns can be persisted (id excluded; generated/
--    absent fields stay null via jsonb_populate_record). Back-compat: callers that omit the new keys
--    write exactly as before. ──
create or replace function public.save_buyer_bc(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.buyer_bcs
    (user_id, company, sector, crop, region, volume, current_price, net_value, risk_reduction,
     feasibility, verdict, justifiable_farm_price,
     seasonality, delivery_spec, quality_spec, certification_required, contract_preference,
     risk_sharing, traceability_level, buyer_lat, buyer_lon, buyer_location)
  select b.user_id, b.company, b.sector, b.crop, b.region, b.volume, b.current_price, b.net_value,
         b.risk_reduction, b.feasibility, b.verdict, b.justifiable_farm_price,
         b.seasonality, b.delivery_spec, b.quality_spec, b.certification_required, b.contract_preference,
         b.risk_sharing, b.traceability_level, b.buyer_lat, b.buyer_lon, b.buyer_location
  from jsonb_populate_record(null::public.buyer_bcs, p) b;
end; $$;

create or replace function public.save_farmer_bc(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.farmer_bcs
    (user_id, farm_name, region, hectares, soil_type, crops, net_value, verdict,
     deliverable_volume_t, harvest_window, quality_spec, certification, contract_preference,
     transition_phase, farm_lat, farm_lon, country)
  select f.user_id, f.farm_name, f.region, f.hectares, f.soil_type, f.crops, f.net_value, f.verdict,
         f.deliverable_volume_t, f.harvest_window, f.quality_spec, f.certification, f.contract_preference,
         f.transition_phase, f.farm_lat, f.farm_lon, f.country
  from jsonb_populate_record(null::public.farmer_bcs, p) f;
end; $$;

grant execute on function public.save_buyer_bc(jsonb)  to anon, authenticated;
grant execute on function public.save_farmer_bc(jsonb) to anon, authenticated;
