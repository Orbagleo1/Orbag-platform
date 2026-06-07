-- BLOK 1 (WORKORDER) — Rapportagestructuur als analytisch fundament.
-- Promote the analytical fields out of the report_data JSON blob into typed, indexed columns so
-- patterns per crop/region/country are queryable, and a BUYER report can be linked to a FARMER
-- report over the same crop+country (the match_key). The full raw input/output JSON stays intact
-- in input_data / report_data (the existing dead-storage columns) — nothing is dropped, only added
-- and backfilled. Data-integrity rule: no silent fabrication — an unknown country yields an
-- explicit 'unknown' bucket in match_key (which simply never links), never a guessed benchmark.
--
-- ⚠ DESIGN NOTE for Leo (deviation from the literal workorder formula):
--   The workorder proposed  match_key = lower(crop) || ':' || lower(region).
--   That CANNOT link farmer↔buyer with the live data: the farmer engine writes Dutch crop keys
--   (wintertarwe) and NL provinces (friesland); the buyer engine writes English crop keys (wheat)
--   and supply-preference labels (no_preference / noord_nederland / uk_norfolk). A literal string
--   join therefore matches nothing.
--   Fix that achieves the gate's INTENT (working linkage): canonicalise the crop across both
--   vocabularies (orbag_canonical_crop) and join on crop + COUNTRY (orbag_supply_country), since
--   country is the one dimension both sides share (a Dutch farm and an NL-supply buyer are both
--   'nl'). region stays as a typed column for filtering, but is NOT the join key.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. report_type enum (buyer | farmer)
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'report_type') then
    create type public.report_type as enum ('buyer', 'farmer');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Canonical crop mapping — bridges the farmer (Dutch) and buyer (English) crop vocabularies
--    to ONE canonical English key. Unknown input falls through to the trimmed lower-case value
--    (never guessed into a wrong bucket). Extend as crops are added. IMMUTABLE so a generated
--    column and indexes can use it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.orbag_canonical_crop(c text)
returns text language sql immutable as $$
  select case lower(coalesce(trim(c), ''))
    -- Dutch farmer keys (boer.html checkbox values) -> canonical English
    when 'wintertarwe'            then 'wheat'
    when 'zomertarwe'             then 'wheat'
    when 'tarwe'                  then 'wheat'
    when 'gerst'                  then 'barley'
    when 'haver'                  then 'oats'
    when 'consumptieaardappelen'  then 'potatoes'
    when 'pootaardappelen'        then 'potatoes'
    when 'zetmeelaardappelen'     then 'potatoes'
    when 'aardappelen'            then 'potatoes'
    when 'suikerbieten'           then 'sugar_beet'
    when 'uien'                   then 'onions'
    when 'erwten'                 then 'peas'
    when 'sperziebonen'           then 'green_beans'
    when 'linzen'                 then 'lentils'
    when 'peen'                   then 'carrots'
    when 'winterpeen'             then 'carrots'
    -- English buyer keys (identity / normalise)
    when 'wheat'                  then 'wheat'
    when 'barley'                 then 'barley'
    when 'oats'                   then 'oats'
    when 'potatoes'               then 'potatoes'
    when 'onions'                 then 'onions'
    when 'peas'                   then 'peas'
    when 'green_beans'            then 'green_beans'
    when 'lentils'                then 'lentils'
    when 'carrots'                then 'carrots'
    when 'sugar_beet'             then 'sugar_beet'
    else nullif(lower(trim(c)), '')
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Supply-country normaliser — maps a free-text region/preference label to an ISO-ish country
--    code used as the linkage dimension. Known NL province / supply labels -> 'nl', UK -> 'uk',
--    etc. 'no_preference' resolves to 'nl' (the platform's NL home market — a DOCUMENTED business
--    default, not a data fallback: it fabricates no benchmark). Anything unrecognised -> null
--    (fail-soft: the row simply won't link, and that is visible).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.orbag_supply_country(region text)
returns text language sql immutable as $$
  select case
    when region is null or trim(region) = '' then null
    when lower(region) ~ 'nederland|groningen|friesland|drenthe|flevoland|zeeland|brabant|holland|utrecht|overijssel|gelderland|limburg' then 'nl'
    when lower(region) = 'no_preference' then 'nl'   -- NL home-market default (documented heuristic)
    when lower(region) ~ 'uk|norfolk|britain|england|scotland|wales' then 'uk'
    when lower(region) ~ 'belg' then 'be'
    when lower(region) ~ 'france|frankrijk|beauce' then 'fr'
    when lower(region) ~ 'german|duitsland' then 'de'
    when lower(region) ~ 'moroc|marokko|egypt' then 'ma'
    when lower(region) ~ 'turk|spain|spanje' then 'tr'
    else null
  end;
$$;

-- match_key builder: canonical(first crop) : country. Uses the FIRST crop so the scalar column is
-- meaningful for single-crop buyer rows; multi-crop farmer rows are fully exploded by the
-- report_match_keys view below (one row per crop) for the match engine.
create or replace function public.orbag_match_key(crop text, country text)
returns text language sql immutable as $$
  select public.orbag_canonical_crop(split_part(coalesce(crop, ''), ',', 1))
         || ':' || lower(coalesce(nullif(trim(country), ''), 'unknown'));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Promote analytical fields to typed columns (crop / region / verdict already exist).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.reports
  add column if not exists country                   text,
  add column if not exists buyer_location            text,
  add column if not exists justified_farm_gate_price numeric,
  add column if not exists risk_reduction            numeric,
  add column if not exists report_type               public.report_type;

-- Generated linkage key (depends on crop + country, both regular columns).
alter table public.reports
  add column if not exists match_key text
  generated always as (public.orbag_match_key(crop, country)) stored;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill the existing rows from the JSON blobs (one-off; the API writes these going forward).
-- ─────────────────────────────────────────────────────────────────────────────
update public.reports set
  report_type = case when lower(coalesce(sector, '')) = 'farmer'
                     then 'farmer'::public.report_type
                     else 'buyer'::public.report_type end
where report_type is null;

update public.reports set
  risk_reduction = nullif(report_data->'cfo'->>'risk_reduction', '')::numeric
where risk_reduction is null and report_data ? 'cfo';

update public.reports set
  justified_farm_gate_price = coalesce(
    nullif(report_data->>'justifiable_farm_price', ''),
    nullif(report_data->'cfo'->>'justifiable_farm_price', '')
  )::numeric
where justified_farm_gate_price is null;

update public.reports set
  buyer_location = nullif(input_data->>'buyerLocation', '')
where buyer_location is null;

-- country: farmer rows are Dutch farms -> nl. Buyer rows: explicit farm_country wins, else the
-- normalised supply-preference region, else the sourcing origin, else null (won't link).
update public.reports set country = 'nl'
where country is null and lower(coalesce(sector, '')) = 'farmer';

update public.reports set country = coalesce(
  nullif(input_data->>'farm_country', ''),
  public.orbag_supply_country(region),
  case lower(coalesce(input_data->>'currentSource', ''))
    when 'netherlands' then 'nl' when 'mixed_eu' then 'nl' when 'uk' then 'uk' else null end
)
where country is null and lower(coalesce(sector, '')) <> 'farmer';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Indexes on the promoted columns + the linkage key.
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists reports_crop_idx        on public.reports (crop);
create index if not exists reports_region_idx       on public.reports (region);
create index if not exists reports_country_idx       on public.reports (country);
create index if not exists reports_report_type_idx   on public.reports (report_type);
create index if not exists reports_match_key_idx      on public.reports (match_key);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. report_match_keys — the linkage surface for the match engine (BLOK 2). Explodes multi-crop
--    farmer reports into one row per crop so a farmer growing wheat+potatoes links to BOTH a wheat
--    buyer and a potato buyer. Single-crop buyer rows yield exactly one row.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.report_match_keys as
select r.id          as report_id,
       r.report_type,
       r.company,
       r.country,
       r.region,
       public.orbag_canonical_crop(trim(c)) as crop_canonical,
       public.orbag_canonical_crop(trim(c)) || ':' || lower(coalesce(nullif(trim(r.country), ''), 'unknown')) as match_key,
       r.created_at
from public.reports r,
     lateral unnest(string_to_array(coalesce(r.crop, ''), ',')) as c
where trim(c) <> '';

grant select on public.report_match_keys to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Extend save_report so the API persists the promoted columns going forward (match_key is
--    generated, so it is excluded — jsonb_populate_record maps the rest, id auto-generates).
--    report_type comes in as 'buyer'/'farmer' text and casts to the enum automatically.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.save_report(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.reports
    (company, sector, crop, region, country, volume, current_price, premium, verdict,
     feasibility, price_range, report_type, buyer_location, justified_farm_gate_price,
     risk_reduction, input_data, report_data, created_at)
  select r.company, r.sector, r.crop, r.region, r.country, r.volume, r.current_price, r.premium,
         r.verdict, r.feasibility, r.price_range, r.report_type, r.buyer_location,
         r.justified_farm_gate_price, r.risk_reduction, r.input_data, r.report_data,
         coalesce(r.created_at, now())
  from jsonb_populate_record(null::public.reports, p) r;
end; $$;

grant execute on function public.save_report(jsonb) to anon, authenticated;
