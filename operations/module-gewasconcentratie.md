# Module-concept: Regionale gewasconcentratie als risicolaag

_Status: concept, niet ingepland. Aparte run, ná de regionale databron-
infrastructuur (todo.md). Dit document is om morgen mee verder te denken._

## Kern in één zin
De engine krijgt een nieuwe risicocomponent die meet hoe sterk een gewas in
de regio rond een boerderij een monocultuur vormt — want hoe groter de
concentratie, hoe hoger de plaag- en ziektedruk en de kans op een regionale
oogstmislukking die de hele aanvoer raakt.

## Waarom dit de engine versterkt (geen nieuw product)
Dit is **risicodata, geen duurzaamheidsdata**. Het past in de bestaande
`RISK_PCT`-structuur als een extra component, voorlopig werknaam
`crop_concentration`. Voor een CFO vertaalt het naar iets bekends:
supplier-/aanvoerconcentratierisico, maar dan op landschapsniveau in plaats
van op leveranciersniveau. Geen enkele bestaande benchmark (KWIN, AHDB) bevat
dit — het is een laag die alleen Orbag legt, en die direct in de
"supply chain risk engine"-positionering valt.

Toepassing: het scherpt het risicoprofiel van een **bron** aan. Voorbeeld:
een Norfolk-aardappelteler in een gebied met zeer hoge aardappel-dichtheid
krijgt een hogere risico-opslag dan dezelfde teelt in een gemengd gebied.
Het is dus een versterking van de bestaande berekening, niet een losse
regiokaart-feature.

## Databronnen (grotendeels openbaar)

### Perceelregistratie — "wat staat er"
- **NL:** BRP (Basisregistratie Gewaspercelen) — per perceel het geteelde
  gewas, openbaar.
- **EU breder:** LPIS-data uit het Gemeenschappelijk Landbouwbeleid
  (GSA/IACS). Per lidstaat vergelijkbaar; dekking en detailniveau verschillen.
- Hiermee bereken je: % van het areaal binnen straal X km dat hetzelfde
  gewas teelt → een directe monocultuur-/concentratiemaat.

### Satelliet — "hoe staat het ervoor"
- **Copernicus / Sentinel-2** (gratis, EU): gewasclassificatie + vitaliteit
  (NDVI) over een heel gebied, niet alleen één perceel.
- Afgeleide EU crop type maps als versnelling t.o.v. ruwe beelden verwerken.
- Voegt toe: niet alleen wélk gewas, maar de conditie/stress in de regio —
  een vroege indicator van zich opbouwende druk.

## Eerlijke kanttekening (scope)
Dit is een **eigen datapijplijn**, geen coëfficiënt die je toevoegt:
BRP/LPIS uitlezen, percelen geografisch clusteren, Sentinel-beelden verwerken,
plus opslag en onderhoud. Daarom bewust losgetrokken van de huidige bouw —
anders verwatert de scope van de regionale databron-infrastructuur die nu af
moet.

## Haakje in de huidige architectuur
In de "Adding a new region"-sectie of backlog van `CLAUDE.md` één notitie:
`RISK_PCT` krijgt later een component `crop_concentration`, gevoed door
BRP/LPIS + Sentinel. Zo houdt de engine die nu gebouwd wordt er ruimte voor,
zonder dat er nu iets van gebouwd hoeft te worden.

## Open vragen voor morgen
1. Straal/granulariteit: op welke afstand (5/10/25 km?) meet je concentratie,
   en is dat gewasafhankelijk (plaag-verspreidingsafstand verschilt per
   gewas/plaag)?
2. Hoe vertaal je concentratie → risico-opslag? Lineair, drempelwaarde, of
   gewasspecifieke curve? Vereist een onderbouwing die je aan een CFO kunt
   uitleggen.
3. Dekking buiten NL: hoe uniform is LPIS-data over de Kempen-regio's
   (UK post-Brexit, DK, PT)? Bepaalt of dit EU-breed of eerst NL/UK werkt.
4. Verversingsritme: perceelregistratie is jaarlijks, NDVI is wekelijks —
   welke cadans wil de engine?
5. Is dit voor het eerstvolgende doel een **werkende** laag, of een
   **visie-component** om te tonen? (Als visie: sterk pitch-materiaal zonder
   dat de pijplijn al af hoeft.)
