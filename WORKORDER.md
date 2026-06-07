# Orbag — Werkorder

_Self-contained werkpakket voor Claude Code. Geen iteratie nodig: lees dit volledig, voer uit in de gemarkeerde volgorde, respecteer de gate rules._

**Aangemaakt:** 2026-06-07
**Context:** zie `CLAUDE.md` en `STATUS.md` in deze repo voor architectuur en huidige stand.

---

## Overkoepelend principe (geldt voor ALLES hieronder)

> **Data-integriteit is niet onderhandelbaar.** Nooit één regio's benchmark gebruiken voor een andere regio. Fail loud, geen stille fallbacks. Elke benchmark heeft bronvermelding + verified/unverified status + datum. Niets gaat live als benchmark zonder dat de bron is geverifieerd als betrouwbaar.

Drie strategische redenen achter dit werkpakket (niet hardcoden, wel als toetssteen):
1. Elke analyse is later trainingsdata voor Orbag's eigen adviesproduct → schrijf alles gestructureerd weg, nooit in dode JSON-blobs.
2. Koper is de expansievector → leg vast welke regio's een koper buiten zijn huidige contract inkoopt.
3. Legaliteit van databronnen is een harde eis → geen scraping zonder expliciete open-data licentie.

---

## BLOK 1 — Rapportagestructuur als analytisch fundament

**Doel:** elke buyer- en farmer-analyse wordt zo weggeschreven dat je er later patronen per gewas/regio op kunt herkennen en buyer- en farmer-rapporten aan elkaar kunt koppelen.

### Taken
1. Inspecteer de huidige `reports`-tabel in Supabase. Rapporteer terug: welke velden zitten als losse kolom, en wat verdwijnt in een JSON-blob.
2. Promoveer deze velden naar losse, geïndexeerde kolommen (als ze nu in JSON zitten):
   - `crop` (text)
   - `region` (text)
   - `country` (text)
   - `justified_farm_gate_price` (numeric)
   - `risk_reduction` (numeric)
   - `verdict` (text)
   - `report_type` (enum: `buyer` | `farmer`)
   - `buyer_location` (text — blijft expliciete parameter, los van productieregio)
3. Voeg een koppelsleutel toe waarmee een buyer- en farmer-rapport over hetzelfde gewas+regio aan elkaar gehangen kunnen worden. Voorstel: gegenereerde kolom `match_key = lower(crop) || ':' || lower(region)`. Index erop.
4. Behoud de volledige ruwe input/output JSON in een aparte `raw_payload`-kolom — dode opslag is prima zolang de analytische velden los staan.
5. Zorg dat farmer BC en buyer BC dezelfde veldnamen gebruiken voor crop/region/country, zodat koppeling werkt.

### Gate rule
Niet door naar BLOK 2 voordat een `select` aantoont dat een bestaand buyer-rapport en een (test) farmer-rapport op hetzelfde `match_key` gevonden kunnen worden.

---

## BLOK 2 — Match engine: van filter naar scoring

**Doel:** de huidige crop+regio-overlap is een filter, geen match. Bouw een scoring-engine die per boer-koper-combinatie een nettowaarde per tonne berekent na logistiek.

### Variabelen, drie niveaus

**Niveau 1 — de transactie**
- volume-fit (kan boer leveren / moeten meerdere boeren gebundeld)
- seizoensfit (oogstmoment vs inkoopritme)
- kwaliteitsspec (ras, droge stof, sortering)
- certificering (heeft / in transitie / niet)
- **afstand** (km én geschatte rijtijd én wegtype-factor; bepaalt ook versheid-window)
- **brandstof/transportkost per route** (afgeleide, fluctueert — zelfde pipeline-logica als FX)
- **douane** (binair binnen EU; tarief + certificeringseis + vertragingsrisico + administratieve last bij UK/NA/TR)

**Niveau 2 — de relatie**
- contractbereidheid (meerjarig vs spot)
- risicodeling (wie draagt weer- / prijsrisico)
- traceerbaarheidsniveau (CSRD-geschikt ja/nee)
- transitiefase boer vs tijdslijn koper

**Niveau 3 — strategische fit (afleidbaar uit bestaande data)**
- concentratierisico (heeft koper al een boer in dezelfde regio+gewas → match verlaagt risico dan NIET)
- groeipotentieel (kan boer meegroeien met koper)
- geopolitieke complementariteit (vult NL-boer een risico aan dat koper elders heeft)

### Kernfeature: logistieke kostencalculator als submodule
- Bereken per match de logistieke kost per tonne (transport + brandstof + douane + koelketen waar relevant).
- Trek die af van de `justified_farm_gate_price` → **werkelijke betalingscapaciteit per specifieke boer-koper-combinatie.**
- Output: matches vergelijkbaar op nettowaarde voor de koper, niet alleen op beschikbaarheid.

### Datamodel
- Breid `farmers`- en `buyers`-profieltabellen uit met de velden die niveau 1–2 voeden (volume, seizoen, kwaliteitsspec, certificering, contractvoorkeur, transitiefase, coördinaten voor afstandsberekening).
- Niveau 3 afleiden uit bestaande buyer-BC-risicoprofiel + farmer-BC-capaciteit + intelligence concentratie-data. Niet dubbel opslaan.

### Gate rule
Lever eerst het datamodel + één werkende voorbeeldberekening (nettowaarde per tonne voor één match) op. Wacht op akkoord van Leo voor de volledige scoring-weging wordt ingeregeld — de gewichten zijn een businessbeslissing, geen technische.

---

## BLOK 3 — Landenstructuur klaarzetten voor Europa + Noord-Afrika

**Doel:** code kan morgen heel Europa + NA aan; alleen de benchmarkdata ontbreekt nog. Zet de lege-maar-klare structuur neer zodat een binnenkomende benchmark direct live is zonder nieuwe migratie.

### Taken
1. Vul `intelligence_countries` met alle EU-landen + UK + relevante Noord-Afrikaanse landen (Marokko, Egypte, Tunesië). Per land: ISO-code, naam, valuta, regio-cluster.
2. Voor elk land: lege-maar-klare benchmark-slots in `intelligence_benchmarks` volgens bestaande architectuur. Status `unverified` / leeg tot data binnenkomt.
3. Behoud per land het eigen-benchmark-principe: NL=KWIN-AGV, UK=AHDB, DK=SEGES, PT=COTHN/GPP. Voor nieuwe landen: veld voor de geplande bron, leeg tot ingevuld.

### Gate rule
Geen enkel nieuw land mag een andere landbenchmark als fallback gebruiken. Een land zonder eigen data geeft een expliciete "no benchmark available" — fail loud.

---

## BLOK 4 — Legale databronnen + automatische crawler

**Doel:** n8n gaat dagelijks een prioriteitslijst van bronnen per land af en schrijft signalen naar `pending_review`. Alleen legale, open-data bronnen worden geautomatiseerd.

### Nieuwe tabel: `intelligence_sources`
Kolommen: `id`, `country`, `source_name`, `source_type` (api | rss | scrape), `url`, `license` (text), `scraping_allowed` (boolean, **default false**), `confidence_tier` (high | medium | low | unverified), `notes`.

### Legaliteits-classificatie (hardcoded uitgangspunt)
- **GROEN (mag automatisch, high/medium tier):** officiële open-data API's en portalen — Eurostat, FAO/FAOSTAT, USDA ERS, ECB, World Bank, Open-Meteo, EC DG-AGRI landbouwmarktdata, CBS (NL), ONS (UK), Destatis (DE), INSEE (FR), RVO (NL), AHDB (UK). Downloadbare CSV's van overheidsportalen tellen ook als groen.
- **ORANJE (handmatig beoordelen, default `scraping_allowed=false`):** publiek toegankelijke data zonder expliciete licentie. ToS checken voordat automatisering aangaat.
- **ROOD (nooit automatisch extraheren):** commerciële providers — DCA, Reuters, Bloomberg, betaalde agri-nieuws. Dit zijn bronnen voor Leo als gebruiker, niet voor de crawler.

### Crawler-logica (n8n)
1. Per dag, per land: ga de bronnen af in volgorde **API → RSS → scrape**.
2. Roep alleen bronnen aan met `scraping_allowed=true` (voor scrape-type) OF open-data API/RSS in groene lijst.
3. Schrijf elk resultaat naar `intelligence_updates` als `pending_review`, met volledige bronvermelding (`source_name`, `url`, datum, gemeten context).
4. **Gebruik de `upsert_intelligence_signal()` RPC** — niet de directe POST die er nu nog staat (dit fixt meteen een bekend open item).
5. Apply-stap blijft ongewijzigd: alleen HIGH-confidence + reeds geverifieerde bron gaat automatisch naar benchmark; rest wacht op review; outliers >3× worden geheld + e-mailalert.

### Technische noot
- Scraping NIET op Vercel (serverless timeout). Zet langlopende jobs in Supabase Edge Function of n8n.
- Elke gescrapete prijs zonder context (datum, volume, kwaliteitsklasse) is waardeloos → leg context verplicht vast of verwerp het signaal.

### Gate rule
Crawler mag pas live op een nieuwe bron nadat die bron in `intelligence_sources` staat met expliciete licentie-vermelding. Twijfel = `scraping_allowed=false`. Bij twijfel over legaliteit: stop en vraag Leo.

---

## Bekende open items die dit werkpakket meeneemt
- [x] n8n directe POST → vervangen door `upsert_intelligence_signal()` RPC (BLOK 4)
- [ ] `generate.js` gebruikt nog hardcoded benchmarks → zou `intelligence_benchmarks` moeten queryen. **Niet in dit werkpakket** tenzij tijd over — flag het, raak generate.js niet aan zonder aparte gate.

## Volgorde & afhankelijkheden
1. BLOK 1 eerst (fundament) → gate → 2. BLOK 3 (landenstructuur, onafhankelijk) → 3. BLOK 4 (crawler, leunt op BLOK 3) → 4. BLOK 2 (match engine, leunt op BLOK 1 datamodel) → gate op scoring-gewichten.

## Output verwacht
- Migraties onder `supabase/migrations/` met spreken­de namen.
- Bijgewerkte `STATUS.md` met datum zodra een blok landt.
- Per blok: korte terugkoppeling wat gevonden/gewijzigd is, en welke gate-vraag openstaat voor Leo.
