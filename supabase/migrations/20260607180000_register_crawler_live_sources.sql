-- BLOK 4 follow-up — register the crawler's LIVE sources in intelligence_sources so every source the
-- n8n "Orbag Intelligence Crawler" actually calls is in the legality registry (World Bank was already
-- seeded GREEN; GDELT was not). GDELT is open/free with attribution. This does NOT change the crawler;
-- it makes its source list auditable + lets the workflow read crawler_source_queue later.

insert into public.intelligence_sources
  (country, source_name, source_type, url, license, scraping_allowed, confidence_tier, legality_class, signal_types, notes)
values
  ('global', 'GDELT Project', 'api',
   'https://api.gdeltproject.org/api/v2/doc/doc',
   'GDELT Project — open data, free reuse with attribution',
   true, 'low', 'green', '{geopolitical_risk}',
   'Tone/volume of news → geopolitical-risk signal (LOW confidence heuristic). Used live by the n8n crawler.')
on conflict (country, source_name) do update set
  url = excluded.url, license = excluded.license, scraping_allowed = excluded.scraping_allowed,
  confidence_tier = excluded.confidence_tier, legality_class = excluded.legality_class,
  signal_types = excluded.signal_types, notes = excluded.notes, updated_at = now();

-- Tag World Bank as a geopolitical/price signal source it actually feeds (it was generic).
update public.intelligence_sources
set signal_types = '{price_benchmark}', notes = coalesce(notes,'') || ' Used live by the n8n crawler (wheat price index PWHEAMT).'
where country = 'global' and source_name = 'World Bank Open Data';
