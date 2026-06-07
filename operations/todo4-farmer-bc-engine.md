# TODO 4 — Farmer BC inhaalslag: deterministische transitie-engine + consistentie-audit

**Run order:** Aparte run, ná todo3. Lees `START-HERE.md`, `CLAUDE.md`, `STATUS.md`,
`todo.md` (buyer-engine als architectuur-referentie) eerst. Zelfde standing rules:
CommonJS (`module.exports`, geen ESM), geen build step / geen package.json, grep-first
bij grote HTML-edits, geen ruwe datasets committen, reply in Dutch in samenvattingen.
**Scope = optie 1: alles in één keer** (engine + data + meerjarig model + scenario's +
net_value opslaan + tests + opgewaardeerde `boer.html` + consistentie-audit + deploy).

---

## Context — waarom de farmer BC achterloopt
De buyer BC (`api/generate.js`) heeft een **deterministische JS-rekenengine**: JS rekent
elk getal, de AI (Haiku) schrijft alleen narrative (two-call design), met gestructureerde
benchmarkdata, regio-laag, scenario's, sensitivity, regressie-fixtures en de nieuwe CFO-view.

De farmer BC (`api/farmer.js`) doet het tegenovergestelde: **één Sonnet-call rekent ÉN
schrijft**. KWIN is een tekst-blob; alle getallen (inkomen, besparing, payback, carbon,
scenario's) zijn **AI-geproduceerd** → niet-deterministisch, hallucinatiegevoelig, niet
testbaar, niet regressie-vergrendeld. `farmer_bcs.net_value` wordt als `null` opgeslagen →
de match-engine is blind voor de boer-economie. Er zijn geen tests. Terwijl de boer-economie
juist **moeilijker** is: het is een **meerjarig transitie-cashflowmodel** (opbrengstdip jaar
1-2, input-afbouw, premie-opbouw, transitie-capex, payback), geen enkel-jaars delta.

**Doel:** breng de farmer BC op het architectuurniveau van de buyer — JS rekent, AI schrijft —
en dicht tegelijk de invoer/rapport-inconsistenties (zie §G).

---

## A. Gestructureerde benchmarkdata (vervang de tekst-blob)
1. Maak een `KWIN_FARMER` object, gekeyed op de **bestaande** `boer.html` crop-checkbox
   `value`s (NIET wijzigen — ze gaan naar opslag/match): `wintertarwe, pootaardappelen,
   suikerbieten, consumptieaardappelen, uien, gerst, haver, erwten, sperziebonen`.
   Per gewas, in EUR, met `source_label` + `verified`:
   - `yield_t_ha`, `price_conv` (€/t), `variable_cost_ha`, `fert_cost_share` (deel van
     variabele kosten dat kunstmest/gewasbescherming is)
   - `regen_premium_pct` (regen-meerprijs boven gangbaar), `regen_yield_factor` (steady-state
     opbrengst t.o.v. gangbaar, vaak <1), `transition_yield_dip_pct` (jaar 1-2 dip)
   - `input_saving_ha` (kunstmest −40-60% + gewasbescherming −30-50%, afgeleid van
     `fert_cost_share` × kosten), `carbon_eur_ha`
   - `verified:true` alleen waar echt gesourcet (wintertarwe/uien/aardappel uit KWIN-AGV
     2024); `gerst` en de regen-premies/dips zijn deels niet in de blob → `verified:false`
     met een `// SOURCE`/aanname-comment (parallel aan de concentratie-knoppen).
2. Markeer de **transitie-economie-aannames** (dip-%, premie-opbouwjaren, carbon, capex)
   als expliciete, gemarkeerde knoppen bovenaan (`TRANSITION_MODEL`), elk `verified:false`
   "voorlopige aanname, agronomische/economische validatie vereist" — niet verstopt in de
   berekening. Een plantenpatholoog/agro-econoom ijkt ze later.

## B. Meerjarige transitie-engine (de kern)
3. Nieuwe `calculateFarmer(d, mkt)` (pure functie, testbaar, geen netwerk) die per gewas in
   de **bedrijfs-gewasmix** een **jaar-voor-jaar traject** over een horizon (default 7 jaar)
   berekent:
   - gangbaar baseline saldo/ha = `yield×price − cost`
   - regen-traject/ha per jaar: opbrengst (dip jaar 1-2 → herstel naar `regen_yield_factor`),
     input-besparing (ramp-up), regen-premie (ramp-up over de transitiejaren), carbon
   - transitie-capex (eenmalig jaar 1-2, €/ha)
   - aggregeer naar bedrijfsniveau (per-gewas × ha-aandeel; bij ontbrekende mix: gelijk
     verdeeld over `totalHa`)
4. Afgeleide uitkomsten in JS (NIET door de AI):
   - `regen_income_ha` (steady-state), `current_income_ha`, `input_saving_ha`, `carbon_ha`
   - **cumulatieve cashflow** → `payback_year` (jaar waarin cumulatief regen ≥ cumulatief
     gangbaar, capex terugverdiend)
   - `max_income_drop_ha` (slechtste transitiejaar t.o.v. baseline) — vergelijk met de
     `incomeDrop`-tolerantie van de gebruiker
   - `net_value` (zie §D), `verdict` + `verdict_reason` **in JS bepaald**: GO als payback ≤
     `payback`-doel én max dip ≤ tolerantie; CONDITIONAL_GO als grensgeval; NO_GO anders.

## C. Framing (kans + kosten van stilzitten)
5. Toon zowel de **regen-upside** (hoger saldo, premie, carbon, minder input) als een
   **"cost of waiting"** — krimpende gangbare marge + stijgende inputkosten die niet-
   transitie jaarlijks kost — symmetrisch met de buyer-CFO-view. De cost-of-waiting-
   parameters zijn aannames → `verified:false`, expliciet en uitschakelbaar. (Bevestig met
   de gebruiker of dit frame mee mag; zo niet, lever alleen de opportunity-kant.)

## D. Output-contract (spiegel het buyer `cfo`-blok)
6. De farmer-report-JSON krijgt een numeriek blok met **rauwe getallen** (geen €-strings):
   `kpis` (numeriek), `cashflow[]` (per jaar: `year, conventional_ha, regen_ha, capex_ha,
   cumulative_delta`), `payback_year`, `max_income_drop_ha`, `regen_income_ha`,
   `current_income_ha`, `input_saving_ha`, `carbon_ha`, `net_value`, per-gewas breakdown,
   `verdict`, `verdict_reason`.
7. **Persisteer `net_value`** in `farmer_bcs` via `save_farmer_bc` (nu `null`). Definitie:
   jaarlijkse steady-state regen-meerwaarde t.o.v. gangbaar (× bedrijf) voor match-pariteit
   met de buyer `net_value`, plus de cumulatieve horizon-meerwaarde apart.

## E. AI schrijft alleen narrative
8. Splits `buildPrompt` in een **narrative-only** prompt (zoals `generate.js`
   `buildNarrativePrompt`): geef de AI de **berekende** getallen; vraag alléén proza terug
   (`income_analysis`, `input_analysis`, scenario-notes, `crop_recommendations`,
   `next_steps`, `orbag_note`, `verdict_reason`-tekst). `verdict` en de getallen komen uit JS.
   Model blijft `claude-sonnet-4-6`. Two-call/narrative-design intact, geen logica in de AI.

## F. boer.html render-upgrade
9. `renderReport()` toont het **berekende model**: behoud de KPI-grid (nu echte getallen),
   voeg toe: een **meerjaren-transitiestrook/cashflow** (jaar-voor-jaar gangbaar vs regen),
   een **payback-marker**, een **inkomensdip-callout** (slechtste jaar vs tolerantie), en de
   kans/cost-of-waiting-framing (§C). Print-vriendelijk (`@media print` uitbreiden, kleuren
   via `print-color-adjust:exact`). Hergebruik bestaande tokens/`.section`/`.kpi-card`.
   Getalformat consistent met het buyer-rapport.

## G. ⚠ Consistentie- & invoer-dekkingsaudit (expliciete bug-focus)
**Regel: elke variabele in het rapport/engine moet herleidbaar zijn naar een invoer die de
gebruiker echt kan opgeven — of berekend/afgeleid zijn en als zodanig gelabeld. Geen
"wees-variabelen".** Gevonden mismatches om te fixen:
10. **Certificering** — staat in `boer.html` (`currentCert`) + het rapport, maar niet in My
    Account. Voeg een certificeringsveld toe aan het farmer-profiel (`account.html`) +
    persisteer in `profiles` + prefill `boer.html`. (Of, met onderbouwing, verwijder het uit
    het rapport — maar toevoegen heeft de voorkeur.)
11. **Gewas-vocabulaire** — `account.html` slaat farmer-crops op met **buyer-sleutels**
    (`wheat, potatoes, …`); `boer.html` + de engine gebruiken **Nederlandse** sleutels
    (`wintertarwe, …`). Unificeer op de **farmer (NL)** vocab voor het farmer-profiel zodat
    profiel-crops correct prefillen én de engine voeden. Lever een **migratienotitie/mapping**
    voor bestaande farmer-profielen (verander geen waarde waar match/opslag op leunt zonder
    map). Houd buyer-profielen op buyer-sleutels (profiel is rolspecifiek).
12. **Regio + grondsoort** — lijn de `account.html`-opties uit met `boer.html`
    (`noord_groningen` vs `other_nl`; grondsoort-labels) zodat prefill matcht. Eén bron van
    waarheid voor de opties.
13. **Ontbrekende farmer-velden in het profiel** — overweeg inkomen, kunstmestkosten,
    ambitie, zorg, inkomensdaling-tolerantie, payback-doel, jaren-op-land te persisteren +
    prefillen (minimaal certificering; de rest waar zinnig). Wat niet in het profiel hoort,
    blijft een formulierveld — maar niets in het rapport mag verwijzen naar iets dat nergens
    invoerbaar is.
14. Loop het hele pad **profiel → prefill → formulier → `farmer.js`-input → rapport** na en
    rapporteer elke resterende wees-variabele in §L.

## H. Fail loud, nooit stil terugvallen
15. Onbekend gewas/regio → expliciete, gestructureerde error (zoals buyer §D), geen stille
    NL-default. Aanwezig-maar-onverified rekent door, maar surface `verified:false` in de
    output zodat de caller het weet.

## I. Tests / regressieveiligheid
16. `tests/farmer.test.js` (offline, geen netwerk, geen deps — zoals `engine.test.js`):
    fixtures die de berekende getallen vastzetten voor een baseline-bedrijf (default
    Groningen, wintertarwe+suikerbieten, 85 ha) — verdict, payback_year, regen_income_ha,
    max_income_drop_ha, net_value. Documenteer hoe te draaien. `engine.test.js` blijft groen.

## J. Buiten scope (deze run NIET doen)
- De buyer-engine (`api/generate.js`) aanraken.
- Live externe databronnen ophalen — gebruik KWIN + onderbouwde/gemarkeerde coëfficiënten;
  echte bronnen (FAOSTAT/Statista via Hanze) voor `gerst`/premies zijn een vervolg.
- NDVI/Sentinel; multi-crop weging buiten de bedrijfs-gewasmix; regen-baseline unlock.

## K. Acceptatie vóór deploy
- Een baseline farmer-run reproduceert de fixture-getallen (test groen).
- Getallen komen uit JS (deterministisch): twee identieke runs geven identieke getallen.
- `net_value` wordt opgeslagen in `farmer_bcs` (niet meer `null`).
- Certificering is selecteerbaar in My Account en prefilt `boer.html`.
- Profiel-crops/regio/grond prefillen `boer.html` correct (vocab uitgelijnd).
- Onbekend gewas/regio faalt loud met structured error.
- `node tests/farmer.test.js` + `node tests/engine.test.js` groen.
- Commit, deploy, live `boer` draait een rapport end-to-end op orbag.online.

## L. Report back (Dutch)
- Bevestig de deterministische engine: toon voor de baseline de payback, regen-inkomen/ha,
  max inkomensdip en net_value.
- Som elke gefixte inconsistentie op (certificering, gewas/regio/grond-vocab, opgeslagen
  net_value) + elke resterende wees-variabele.
- Bevestig dat de buyer-engine en alle bestaande fixtures ongewijzigd/groen zijn.
- Eén regel over alles wat is overgeslagen, aangehouden of een gebruikersbeslissing vraagt.

---

## STATUS (afgerond 2026-06-07) — gebouwd, getest, gedeployed
- ✅ **§A/B Deterministische engine** — `api/farmer.js` herschreven: `KWIN_FARMER` (9 gewassen,
  EUR, `verified`-flags; gerst/suikerbieten-premie/uien-kosten als `verified:false`) +
  `TRANSITION_MODEL`-knoppen (horizon 7 jr, transitie 3 jr, dip-jaren 2, dip 10%, input-reductie
  45%, capex €225/ha, cost-of-waiting) → `calculateFarmer()` rekent een jaar-voor-jaar cashflow,
  payback-jaar, slechtste-jaar-dip, steady-state regen-inkomen en net_value. **Alle getallen in
  JS**, AI schrijft alleen narrative.
- ✅ **§C Framing** — cost-of-waiting overlay (gangbare marge-erosie + input-inflatie) naast de
  regen-upside, expliciet `verified:false`, in de view getoond als "the cost of waiting".
- ✅ **§D Output + net_value** — report draagt `model` (cashflow, payback, per-crop, etc.) +
  `net_value`; **`farmer_bcs.net_value` wordt nu opgeslagen** (was `null`).
- ✅ **§E AI = narrative-only** — `buildNarrativePrompt` geeft de AI de berekende getallen;
  verdict + cijfers komen uit JS. Model blijft `claude-sonnet-4-6`.
- ✅ **§F boer.html** — meerjaren-cashflowstrook (gangbaar vs regen + payback-marker), per-crop
  transparantietabel, dip-callout vs tolerantie, cost-of-waiting-callout, headline-drieluik;
  print-uitbreiding + `nl-NL`.
- ✅ **§G Consistentie-audit (de bug-focus):**
  - **Certificering** toegevoegd aan My Account (`profiles.certification`, migratie
    `add_certification_to_profiles`) → opgeslagen + prefilt `boer.html`. ✓ (precies het voorbeeld)
  - **Grondsoort + regio** geverifieerd: prefill matcht al (grond identiek; regio via `REGION_MAP`).
  - **Gewas-vocab NIET omgezet** — bewust: `match.html` matcht op `profiles.crops` met
    **buyer-sleutels** tegen `buyer_bcs.crop`; omzetten zou de match breken. De bridge via
    `CROP_MAP` is correct.
- ✅ **§I Tests** — `tests/farmer.test.js` (baseline Groningen tarwe+biet 85 ha: verdict
  CONDITIONAL_GO, regen €1.263/ha, payback jr 3, dip €185/ha, net_value €39.313/jr) +
  determinisme + fail-loud. `engine.test.js` + `concentration.test.js` blijven groen.
- ⚠ **Open punten / gebruikersbeslissing:**
  1. **Cost-of-waiting frame** stond default AAN (symmetrie met buyer); zeg het als je 'm uit wilt.
  2. **Suikerbieten/gerst** zitten niet in de buyer-match-vocab (buyer-engine kent ze niet) — een
     boer met die gewassen is wel door te rekenen maar niet te matchen tot de buyer-vocab uitbreidt.
  3. **Agronomie/economie-knoppen** allemaal `verified:false` — laten ijken door een agro-econoom.
  4. `CROP_MAP.carrots → 'wortel'` is een dode mapping (geen checkbox/engine-crop) — onschadelijk,
     genoteerd.
