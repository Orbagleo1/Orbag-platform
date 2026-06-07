# TODO 3 — CFO-rapport view (cost-of-inaction zichtbaar maken)

**Run order:** Aparte run, ná `todo.md` (regionale databron-infra) en
`todo2-gewasconcentratie.md`. Lees eerst `START-HERE.md`, `CLAUDE.md`,
`STATUS.md`. Zelfde standing rules (CommonJS, geen build step, two-call design
intact — `generate.js` rekent, `claude-haiku-4-5` schrijft narrative; grep-first
bij grote HTML-edits; geen ruwe datasets; reply in Dutch in samenvattingen).

---

## Context
De buyer BC-engine in `api/generate.js` berekent al **zeven risicolagen**
(geopolitical, weather, quality/recall, price volatility, CSRD, supplier
concentration, nitrate) via de `layers`-array in de `calculate()`-functie, plus
logistics, processing, carbon en justifiable_farm_price. Maar `analyse.html`
toont deze **niet** in het rapport — het toont alleen feasibility / prijs /
matching farms.

## Doel
Voeg een **CFO-rapport view** toe die het *cost-of-inaction*-argument zichtbaar
maakt. De engine-data bestaat al; dit gaat om **output + rendering**, niet om
nieuwe berekeningen.

---

## TAAK 1 — `generate.js`: JSON-respons compleet maken
Check of deze velden er al in zitten; voeg toe zo niet:
- `layers[]`: elk met `{ layer, current, regen, reduction, basis }`
- `current_total`, `regen_total`, `risk_reduction`
- `logistics.annual_saving`, `carbon.buyer_share_30pct`, `prem_annual`
- `net_value`, `justifiable_farm_price`
- `verdict`, `verdict_reason`

Pas de **Haiku-prompt** aan zodat `verdict_reason` het cost-of-inaction framet:
> één zin die begint met wat stilzitten jaarlijks kost.

## TAAK 2 — `analyse.html`, `renderReport()`: secties toevoegen
In **deze volgorde, BOVEN** de bestaande feasibility-sectie:

1. **Headline** — drie getallen naast elkaar:
   - "Cost of inaction" (`current_total`, **rood**)
   - "Regen exposure" (`regen_total`, **groen**)
   - "Net value" (`net_value`, **groen**)
2. **Verdict-bar** (bestaat al — behouden)
3. **NIEUW "The seven risk layers"** — tabel: `layer | basis | current | regen |
   saving`, met **totaalregel**. `current` in rood, `regen` + `saving` in groen.
4. **NIEUW "From risk reduction to net value"** — brug:
   `+risk_reduction, +logistics, +carbon, −premium = net_value`
   (donkergroene balk).
5. **Justified farm gate price** (bestaat al als key-number — behouden,
   **verplaatsen** naar ná de brug).
6. **NIEUW callout "The CFO argument in one line"**.

Behoud de bestaande supply/pricing-analysis secties eronder. Gebruik de
bestaande CSS-tokens (`--forest`, `--leaf`, `--mint`, `--red-l`, `.section`,
`.kpi-card`).

## Stijl
- Print-vriendelijk: bestaande `@media print` uitbreiden zodat de nieuwe secties
  meekomen.
- Getallen via `toLocaleString('nl-NL')`.

## Lever
Complete gewijzigde `generate.js` en `analyse.html`, **geen snippets**.

---

## STATUS (afgerond 2026-06-07) — gebouwd, getest, gedeployed
- ✅ **TASK 1** — `api/generate.js`: de report-JSON draagt nu een compact `cfo`-blok met de
  rauwe getallen (`current_total`, `regen_total`, `risk_reduction`, `net_value`, `prem_annual`,
  `proc_annual`, `logistics_annual_saving`, `carbon_buyer_share`, `justifiable_farm_price`,
  `layers[]` met `{layer, basis, current, regen, reduction, saving}`). `justifiable_farm_price`
  staat nu ook top-level en wordt één keer berekend (hergebruikt door de buyer_bc-save).
  Haiku-prompt herschreven: `verdict_reason` begint met de cost-of-inaction (current_total/yr).
- ✅ **TASK 2** — `analyse.html` `renderReport()`: nieuwe CFO-view bovenaan in de gevraagde
  volgorde — headline-drieluik (cost of inaction rood / regen exposure groen / net value groen),
  verdict-bar, "The seven risk layers"-tabel met totaalregel, "From risk reduction to net value"-
  brug (donkergroene resultaatbalk), justified farm-gate price key-number, CFO-callout. Bestaande
  supply/pricing/processing/logistics/scenario-secties blijven eronder. Nieuwe CFO-CSS + `@media
  print` uitgebreid (kleuren via `print-color-adjust:exact`, secties `break-inside:avoid`). Getallen
  via `toLocaleString('nl-NL')`.
- ⚠ **Afwijking van de spec (bewust, voor correctheid):** de brug-rekensom in de taak
  (`+risk_reduction +logistics +carbon −premium`) telt NIET op naar de engine-`net_value`. De engine
  rekent `net_value = risk_reduction + processing + logistics − premium` (carbon zit er NIET in,
  processing wél). De brug is daarom arithmetisch correct gebouwd (telt exact op naar net_value) en
  carbon wordt als losse "extra upside, niet meegeteld in net value" onder de brug getoond.
- ✅ **Tests** — `node tests/engine.test.js` + `node tests/concentration.test.js` blijven groen;
  brug-rekensom geverifieerd (net_value == risk_reduction + proc + logistics − premium).
