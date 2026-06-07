# Open voor jou — wat ik níét zelf kan

_Living checklist. Alles wat klaarstaat maar op jou wacht: een credential, een dashboard-actie,
externe expertise, betaalde data, of een productbeslissing. Per punt staat exact wat ik van je
nodig heb om verder te kunnen. Zeg **"pak punt X op"** en ik ga ermee aan de slag._

_Laatst bijgewerkt: 2026-06-07. Bron: STATUS.md backlog + todo2 §I + todo3 + todo4 + WORKORDER BLOK 1-4._

---

## 1. Inloggen / credentials (ik heb een token van je nodig)

- [ ] **CDSE openEO device-login** — om de gewasconcentratie-dekking uit te rollen (nu alleen
  Dronten/NL-grid/Kempen/FR-testpunt) en meer CLMS-gewascodes te valideren. De precompute draait
  op een CDSE device-flow-token dat verloopt.
  **Wat ik nodig heb:** log in op CDSE openEO en zet het token op de afgesproken plek
  (`<tmp>/cdse_token.json`), of doe de device-flow samen met mij. Dan draai ik de one-call
  precompute over de regio's die jij wilt. _Productie zelf heeft dit NIET nodig (leest alleen cache)._
  → todo2 §I.1 / §I.2

- [ ] **n8n Header Auth-credential maken (crawler-hardening).** De anon-key staat hardcoded in de
  node-headers van de "Orbag Intelligence Crawler". De n8n-MCP kan **geen credential aanmaken**
  (alleen koppelen). **Wat ik nodig heb:** maak in n8n één *Header Auth*-credential — Header Name
  `apikey`, Value = de anon-key — en zeg "credential staat klaar". Dan koppel ik 'm aan "Supabase
  opslaan" en haal ik de hardcoded `apikey`/`Authorization`-headers eruit. (Publieke anon-key, dus
  geen lek — wel netter.) → WORKORDER BLOK 4 / `operations/blok4-crawler.md`

## 2. Dashboard-acties (alleen via een web-UI, CLI heeft geen toegang)

- [ ] **Sentinel Hub OAuth-secret roteren** — de SH client-secret is ooit in een chat gedeeld.
  Roteer 'm in het **CDSE-dashboard**. (openEO gebruikt 'm niet, maar opruimen is netjes.)
  → todo2 §I.4
- [ ] **Stray `orbag.eu`-domein verwijderen uit het Vercel "orbag"-team** — staat niet in de code,
  is geen projectdomein, serveert niks (live draait op `orbag.online`). De CLI meldt "no access",
  dus dit moet via het **Vercel-dashboard** (Team → Settings → Domains).
  → STATUS backlog

## 3. Externe expertise / validatie (vakkennis die ik niet kan leveren)

- [ ] **Plantenpatholoog — gewasconcentratie-knoppen ijken.** Straal per gewas, drempelcurve en
  opslag-magnitudes staan nu allemaal `verified:false` (literatuur-onderbouwd maar niet gevalideerd).
  **Wat ik nodig heb:** laat een plantenpatholoog de waarden bevestigen/bijstellen; idealiter een
  per-(gewas,plaag)-tabel. Geef me de uitkomst en ik verwerk 'm. → todo2 §I.7
- [ ] **Agro-econoom — farmer transitiemodel ijken.** De `TRANSITION_MODEL`-knoppen (opbrengstdip,
  premie-/input-ramp, transitie-capex, cost-of-waiting) zijn `verified:false`-aannames.
  **Wat ik nodig heb:** een agro-econoom die opbrengstdip-%, premie-opbouw en capex per gewas
  bevestigt. → todo4

## 4. Betaalde data via de Hanze-bibliotheek (jouw login nodig; fetch-and-hand-off)

- [ ] **Provisionele regio's aanscherpen → "active".** Auto-gebootstrapte landen (bv. Polen)
  draaien op proxies; prijs/variabele-kosten zijn bewust null (engine valt terug op NL).
  **Wat ik nodig heb:** per-gewas yield/prijs/variabele-kosten uit FAOSTAT/Statista via jouw
  Hanze-toegang. Geef me de bron/PDF en ik vul de DB-rijen. → STATUS backlog
- [ ] **Farmer-benchmark-gaten dichten.** Nu `verified:false`: **gerst** (niet in KWIN), de
  **regen-premie van suikerbieten**, en de **uien-variabele-kosten**.
  **Wat ik nodig heb:** echte cijfers (KWIN/WUR/FAOSTAT/Statista) zodat ik de schattingen vervang
  en op `verified:true` zet. → todo4 open punt 3

## 5. Productbeslissingen die ik van je nodig heb vóór ik bouw

- [ ] **Cost-of-waiting frame in de farmer BC — aan of uit?** Staat nu **default AAN** (symmetrisch
  met de buyer "cost of inaction"); alle aannames `verified:false`, met één vlag uit te zetten.
  → todo4 open punt 1
- [ ] **Buyer-engine uitbreiden naar suikerbieten & gerst?** Een boer met die gewassen is nu wél
  door te rekenen, maar **niet te matchen** (de buyer-engine/match-vocab kent ze niet). Uitbreiden
  raakt de buyer-engine — wil je dat? → todo4 open punt 2
- [ ] **Regen-baseline ontgrendelen?** Nu NL-locked; ontgrendelen laat een niet-NL bedrijf als
  regen-doel modelleren i.p.v. alleen als bron. → STATUS backlog
- [ ] **Taalswitcher NL/EN — prioriteit?** Bewust uitgesteld; ik kan 'm bouwen zodra je 'm wilt.
  → STATUS backlog
- [ ] **Match-engine scoring-gewichten (WORKORDER BLOK 2-gate).** Datamodel + voorbeeldberekening
  (nettowaarde per tonne na logistiek) staan klaar. De **weging** over niveau 1-3 (volume-fit,
  seizoen, kwaliteit, certificering, contract, concentratie, groei, geopolitieke complementariteit)
  is een **businessbeslissing**. **Wat ik nodig heb:** geef de gewichten/prioriteiten (of zeg "stel
  een voorzet voor"), dan regel ik de ranking in `match.html` in. → WORKORDER BLOK 2
- [ ] **ToS-akkoord oranje databronnen.** AHDB / SEGES / COTHN-GPP staan als ORANJE in
  `intelligence_sources` (`scraping_allowed=false`). De crawler mag ze pas automatisch raadplegen na
  een licentie/ToS-check. **Wat ik nodig heb:** jouw go (of de bevestigde reuse-voorwaarden) per
  bron, dan zet ik 'm op groen/toegestaan. → WORKORDER BLOK 4

---

## Wat ik wél zelf kan (staat klaar, geen blokkade — alleen jouw "go")
Deze hoeven niet op jou te wachten qua kunnen, alleen qua prioriteit; zeg het woord:
- Public RPC's (`save_*`, `bootstrap_region`) rate-limiten vóór schaal. (STATUS backlog)
- `supabase db pull` om de 7 oudere migraties in de repo te baseline-en. (STATUS backlog)
- Restant farmer-profiel-prefill (inkomen, kunstmestkosten, ambitie, etc.) persisteren. (todo4)
- Held-count badge / wekelijkse samenvattingsmail / weather-cooldown. (STATUS backlog, optioneel)
- Crawler-bron-uitbreiding: per groene bron (Eurostat/FAOSTAT/CBS…) een echte extractor bouwen op
  `crawler_source_queue`. Fundament staat; per bron is het losse engineering. (WORKORDER BLOK 4)

_Gebruik: zeg "pak punt X op" of "wat staat er open?" en ik werk uit dit document._
