-- BLOK 4 (WORKORDER) — Legale databronnen + automatische crawler (data foundation).
-- The crawler may only ever touch a source that is REGISTERED here with an explicit licence. This
-- migration creates intelligence_sources, encodes the GREEN/ORANGE/RED legality classification, seeds
-- the legally-clear open-data sources, and exposes the crawler's daily worklist. It does NOT activate
-- any live crawl — going live on a source is Leo-gated (see the gate note below).
--
-- GATE (workorder): "Crawler mag pas live op een nieuwe bron nadat die bron in intelligence_sources
-- staat met expliciete licentie-vermelding. Twijfel = scraping_allowed=false. Bij twijfel over
-- legaliteit: stop en vraag Leo." We make this a HARD DB INVARIANT: scraping_allowed can only be
-- true when a licence is named and the source is not RED (see the check constraint).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.intelligence_sources (
  id               uuid primary key default gen_random_uuid(),
  country          text not null,                       -- intelligence_countries.key, or 'eu'/'global' for pan-regional
  source_name      text not null,
  source_type      text not null check (source_type in ('api','rss','scrape')),
  url              text,
  license          text,                                -- explicit licence string; required before scraping_allowed
  scraping_allowed boolean not null default false,      -- crawler only calls sources where this is true
  confidence_tier  text not null default 'unverified' check (confidence_tier in ('high','medium','low','unverified')),
  legality_class   text not null default 'orange' check (legality_class in ('green','orange','red')),
  signal_types     text[] default '{}',                 -- which intelligence_signal_types this source can feed
  active           boolean not null default true,
  last_crawled_at  timestamptz,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  -- The gate as an invariant: a source can be auto-crawled ONLY if it carries an explicit licence
  -- and is not RED (commercial). RED can never be allowed; ORANGE only after a licence is filled in
  -- (manual ToS check); GREEN ships allowed. Twijfel (no licence) => cannot be allowed.
  constraint intelligence_sources_allowed_requires_licence
    check (scraping_allowed = false or (license is not null and legality_class in ('green','orange'))),
  unique (country, source_name)
);

comment on table public.intelligence_sources is
  'Registry of data sources per country with legality classification. The crawler may ONLY call rows where scraping_allowed=true (GREEN open-data, or ORANGE after a manual ToS/licence check). RED = commercial, never auto-extracted. Adding/allowing a NEW source is Leo-gated.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — anon/authenticated read (parity with the other intelligence_* tables; no secrets here,
--    just public source URLs + licences). No public write: rows are managed by migration / service.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.intelligence_sources enable row level security;
drop policy if exists intelligence_sources_read on public.intelligence_sources;
create policy intelligence_sources_read on public.intelligence_sources
  for select to anon, authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Seed — GREEN (official open-data, may be automated with attribution) + the ORANGE/RED anchors so
--    the crawler's allow/block logic is fully data-driven and auditable. Licences are the real reuse
--    terms of each portal. Only GREEN API/RSS get scraping_allowed=true; scrape-type and ORANGE/RED
--    stay false until a human clears them.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.intelligence_sources
  (country, source_name, source_type, url, license, scraping_allowed, confidence_tier, legality_class, signal_types, notes)
values
  -- GREEN — pan-regional open-data APIs
  ('eu',     'Eurostat',            'api', 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data', 'EC reuse Decision 2011/833/EU — reuse with attribution (CC BY 4.0 equivalent)', true,  'high',   'green', '{}', 'JSON-stat dissemination API; agri prices, production, trade.'),
  ('eu',     'EC DG-AGRI agri-food data portal','api','https://agridata.ec.europa.eu/extensions/DataPortal/home.html','EC reuse Decision 2011/833/EU', true, 'medium','green','{}','EU market observatory prices per sector.'),
  ('eu',     'ECB Statistical Data Warehouse','api','https://data-api.ecb.europa.eu/service/data','ECB free reuse with attribution', true, 'high','green','{fx_rate}','FX EUR_* — already consumed by the FX pipeline.'),
  ('global', 'FAOSTAT',             'api', 'https://fenixservices.fao.org/faostat/api/v1/en/', 'FAO open data — CC BY 4.0', true, 'high','green','{}','Producer prices, yields, production by country/crop.'),
  ('global', 'World Bank Open Data','api', 'https://api.worldbank.org/v2/', 'World Bank Open Data — CC BY 4.0', true, 'high','green','{}','Already used by api/bootstrap-region.js (distance/income/yield proxies).'),
  ('global', 'USDA ERS',            'api', 'https://api.ers.usda.gov/data/', 'US Government public domain (no copyright)', true, 'medium','green','{}','US-centric; commodity outlook, cost-of-production.'),
  ('global', 'Open-Meteo',          'api', 'https://api.open-meteo.com/v1/forecast', 'Open-Meteo — CC BY 4.0 (free reuse)', true, 'high','green','{weather_risk}','Weather — already consumed by the detector for weather_conv signals.'),
  -- GREEN — national statistics offices / agencies
  ('nl', 'CBS StatLine OpenData',   'api', 'https://opendata.cbs.nl/ODataApi/odata/', 'CBS open data — CC BY 4.0', true, 'high','green','{}','NL prices, agri statistics (OData).'),
  ('nl', 'RVO / PDOK open data',    'api', 'https://service.pdok.nl/', 'PDOK / RVO open data — CC0 / open', true, 'high','green','{}','BRP Gewaspercelen — already used by the crop-concentration layer.'),
  ('gb', 'ONS (Office for National Statistics)','api','https://api.beta.ons.gov.uk/v1/','Open Government Licence v3.0', true, 'high','green','{}','UK statistics.'),
  ('de', 'Destatis GENESIS-Online', 'api', 'https://www-genesis.destatis.de/genesisWS/rest/2020/', 'DL-DE/BY-2.0 (Datenlizenz Deutschland — Namensnennung)', true, 'medium','green','{}','DE agri statistics.'),
  ('fr', 'INSEE',                   'api', 'https://api.insee.fr/', 'Licence Ouverte / Open Licence 2.0 (Etalab)', true, 'medium','green','{}','FR statistics.'),
  -- ORANGE — publicly accessible but reuse terms need a manual ToS/licence check before automation
  ('gb', 'AHDB (Farmbench / Grain Market Daily)','scrape','https://ahdb.org.uk/', null, false, 'high','orange','{}','UK national benchmark (planned source for GB). Reuse terms not a blanket open licence — confirm ToS before automating; currently hand-entered into regional_crop_data.'),
  ('dk', 'SEGES',                   'scrape','https://www.seges.dk/', null, false, 'medium','orange','{}','Planned DK national benchmark — licence/ToS to confirm.'),
  ('pt', 'COTHN / GPP',             'scrape','https://www.gpp.pt/', null, false, 'medium','orange','{}','Planned PT national benchmark — licence/ToS to confirm.'),
  -- RED — commercial providers; NEVER auto-extracted (sources for Leo as a user, not for the crawler)
  ('global','DCA (DataCarbon/Agri commercial feeds)','scrape',null,'commercial — proprietary', false,'unverified','red','{}','NEVER auto-extract. For Leo as a user only.'),
  ('global','Reuters',              'scrape', null, 'commercial — proprietary', false,'unverified','red','{}','NEVER auto-extract. For Leo as a user only.'),
  ('global','Bloomberg',            'scrape', null, 'commercial — proprietary', false,'unverified','red','{}','NEVER auto-extract. For Leo as a user only.')
on conflict (country, source_name) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. crawler_source_queue — the crawler's daily worklist. Per country, ordered API -> RSS -> scrape,
--    only the sources that are active AND scraping_allowed (so RED and un-cleared ORANGE never appear).
--    The n8n crawler reads THIS, never a raw source list, and writes each result via the
--    upsert_intelligence_signal() RPC (NOT a direct POST) — full provenance in p_data_sources/p_evidence.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.crawler_source_queue as
select country, source_name, source_type, url, license, confidence_tier, legality_class, signal_types,
       case source_type when 'api' then 1 when 'rss' then 2 when 'scrape' then 3 else 9 end as crawl_order,
       last_crawled_at
from public.intelligence_sources
where active and scraping_allowed
order by country, crawl_order, source_name;

grant select on public.crawler_source_queue to anon, authenticated;
