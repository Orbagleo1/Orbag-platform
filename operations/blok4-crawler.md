# BLOK 4 — Legale databronnen + crawler (contract)

_Workorder BLOK 4. Data foundation landed 2026-06-07. The live crawl is **Leo-gated** — see gates below._

## Wat er staat (DB)
- **`intelligence_sources`** — bronregister per land met legaliteitsclassificatie. Kolommen: `country`, `source_name`, `source_type` (`api`|`rss`|`scrape`), `url`, `license`, `scraping_allowed` (default **false**), `confidence_tier` (`high`|`medium`|`low`|`unverified`), `legality_class` (`green`|`orange`|`red`), `signal_types[]`, `active`, `last_crawled_at`, `notes`.
- **Harde invariant** (`intelligence_sources_allowed_requires_licence`): `scraping_allowed=true` kan ALLEEN met een ingevulde `license` én `legality_class IN ('green','orange')`. **ROOD kan nooit toegestaan worden** — DB-geweigerd (geverifieerd: een UPDATE die Reuters probeert toe te staan faalt met een check violation).
- **`crawler_source_queue`** (view) — de dagelijkse worklist: per land, geordend **API → RSS → scrape**, alleen `active AND scraping_allowed`. ROOD en niet-vrijgegeven ORANJE verschijnen hier nooit.

## Legaliteitsclassificatie (geseed)
- **GROEN (12, automatisch, high/medium):** Eurostat, EC DG-AGRI, ECB, FAOSTAT, World Bank, USDA ERS, Open-Meteo, CBS (NL), RVO/PDOK (NL), ONS (UK), Destatis (DE), INSEE (FR). Elk met expliciete open-licentie (CC BY 4.0 / EC reuse 2011/833/EU / OGL v3.0 / DL-DE-BY-2.0 / Etalab / public domain).
- **ORANJE (3, default niet toegestaan):** AHDB (UK), SEGES (DK), COTHN/GPP (PT) — publiek toegankelijke nationale benchmarkbronnen, maar reuse-voorwaarden vereisen een handmatige ToS/licentiecheck vóór automatisering. Nu nog handmatig in `regional_crop_data`.
- **ROOD (3, nooit automatisch):** DCA, Reuters, Bloomberg — commercieel/proprietary. Bronnen voor Leo als gebruiker, niet voor de crawler.

## Crawler-contract (n8n)
De n8n-workflow **leest `crawler_source_queue`** (nooit een ruwe bronlijst) en schrijft elk signaal weg via de **`upsert_intelligence_signal()` RPC** — **niet** via een directe POST naar `intelligence_updates`:

```
upsert_intelligence_signal(
  p_country, p_signal_type, p_field_path,
  p_current_value, p_suggested_value, p_delta_pct,
  p_confidence,                 -- 'HIGH'|'MEDIUM'|'LOW'
  p_evidence,                   -- mensleesbare onderbouwing
  p_sample_headlines := '[]',
  p_data_sources   := '[{"source_name":..,"url":..,"date":..,"context":..}]',  -- VERPLICHTE provenance
  p_generated_by   := 'n8n-crawler'
)
```

Regels:
1. Per dag, per land: `crawl_order` volgen (API → RSS → scrape).
2. Elke gemeten waarde ZONDER context (datum, volume, kwaliteitsklasse) → verwerpen; context is verplicht in `p_data_sources`/`p_evidence`.
3. Alles landt als `pending_review`. De **apply-stap blijft ongewijzigd** (`apply_intelligence_updates()`): alleen HIGH-confidence + reeds geverifieerde bron gaat automatisch naar benchmark; outliers >3× worden geheld + e-mailalert.
4. Scraping NIET op Vercel (serverless timeout) — langlopende jobs horen in n8n of een Supabase Edge Function.

## Status n8n-workflow (KLNN5WeBC8ZE4GUI)
- ✅ **POST→RPC afgerond (2026-06-07).** De node "Supabase opslaan" deed nog een directe POST naar `/rest/v1/intelligence_updates` (het werkorder-vinkje klopte niet). Nu: `POST …/rpc/upsert_intelligence_signal` met de juiste `p_*`-parameters + `p_generated_by:"n8n-crawler"`. "Splitsen voor Supabase" stuurt `sample_headlines`/`data_sources` als echte arrays (jsonb i.p.v. stringified). "Digest samenstellen" leest nu uit de split-node (de RPC geeft alleen `{id, action}` terug). RPC-mapping end-to-end geverifieerd via SQL.
- ✅ **Benchmark-drift fix.** "Signalen analyseren" haalt `current_value` nu **live** uit `intelligence_benchmarks` (i.p.v. een bevroren hardcoded snapshot), defensief: élke fout valt terug op de snapshot, dus de dagrun kan er nooit op breken. `data_sources` vermeldt `intelligence_benchmarks (live)` wanneer gebruikt.
- ✅ **Live bronnen geregistreerd.** GDELT + World Bank staan nu in `intelligence_sources` (groen, toegestaan) — élke bron die de crawler echt aanroept is legaliteit-getrackt.

## Open gates / follow-ups ⛔
1. **Crawler live zetten op een NIEUWE bron** mag pas nadat die in `intelligence_sources` staat mét expliciete licentie. Twijfel = `scraping_allowed=false` / vraag Leo. GROEN is vrij; ORANJE (AHDB/SEGES/COTHN-GPP) wacht op jouw ToS-akkoord.
2. **Credential-hardening (handmatige stap):** de anon-key staat hardcoded in de node-headers. De n8n-MCP kan **geen credential aanmaken** (alleen koppelen). Maak in n8n één *Header Auth*-credential (headernaam `apikey`, waarde = anon-key); geef mij de credential-ID of zeg dat 'ie klaarstaat, dan koppel ik 'm aan "Supabase opslaan" en strip ik de hardcoded headers. (Publieke anon-key, dus geen lek — wel netter.)
3. **Volledige bron-uitbreiding:** de crawler draait nog op GDELT + World Bank + de 5 legacy buckets. Hem laten lezen uit `crawler_source_queue` en per groene bron (Eurostat/FAOSTAT/CBS…) een extractor toevoegen is incrementeel werk per bron — losse iteratie.
