# TODO 2 — Crop-concentration risk layer (NL/Dronten example, built for any farm)

**Run order:** This is a SEPARATE run, AFTER `todo.md` (the regional
data-source infrastructure) is done and deployed. Read `START-HERE.md`,
`CLAUDE.md`, `STATUS.md` and `module-gewasconcentratie.md` first. Same standing
rules apply (CommonJS, no build step, two-call design intact, grep-first,
no raw datasets committed, reply in Dutch in summaries).

**Goal:** Add a new risk component `crop_concentration` to the buyer engine.
It measures how much a crop forms a monoculture in the landscape around a
farm — higher concentration → higher pest/disease pressure → higher risk
add-on. Build the PIPELINE INFRASTRUCTURE with NL/Dronten + potatoes as the
worked example, structured so other farms/countries are a matter of filling
data, not rewriting logic.

This is risk data, not sustainability data — it sharpens the risk profile of
a source, consistent with the supply-chain-risk-engine positioning.

---

## Critical principle — separate infrastructure from biological assumptions

The pipeline logic (read parcels → cluster within a radius → compute
concentration share → map to a risk add-on) is yours to build and test.

But two inputs are AGRONOMY, not engineering, and are NOT yet validated:
- the pest-spread **radius** per crop,
- the concentration→risk **thresholds**.

These MUST be explicit, clearly-marked parameters at the top of the module,
each with `verified: false` and a comment "voorlopige aanname, agronomische
validatie vereist". Do NOT bury them in the calculation. They are knobs the
user fills later with a plant-pathologist. Never present them as established
biology.

## A. Pipeline architecture (build, test, NL example)

1. New module/section computing `crop_concentration` for a farm, taking:
   - `farm_lat`, `farm_lon` (parameters — see §C; Dronten is just the
     example value, the function must accept any coordinate)
   - `crop`
   - a parcel dataset (see §B)
   Steps: place a radius around the farm → find parcels of the same crop
   within it → compute the concentration share (same-crop area ÷ total
   agricultural area in radius) → map to a risk add-on via the threshold
   model (§D).

2. Output must carry `verified:false` and a `source_label` for the parcel
   data, and surface the concentration share AND the resulting add-on
   separately, so the reasoning is transparent (and CFO-explainable).

3. Wire `crop_concentration` into `RISK_PCT` as an additional component
   WITHOUT breaking existing risk math or the `todo.md` regression fixtures.
   It should be additive and switchable (a farm with no parcel data simply
   omits this component — fail-soft for THIS layer is acceptable because it's
   an enrichment, but mark it clearly as "concentration data unavailable",
   never silently zero it as if concentration were low).

## B. Data source — example first, real BRP as a self-attempted follow-up

4. **First:** build and test against a small, hand-placed example parcel set
   around Dronten, Flevoland (≈ 52.53 N, 5.72 E) — a handful of parcels with
   crop + geometry/centroid, enough to exercise radius, clustering, share,
   and the threshold model. Mark it `source_label: "voorbeelddata Dronten (handmatig)"`,
   `verified:false`. Do NOT commit any real BRP dataset.

5. **Then, in the same run, ATTEMPT the real source automatically:** try to
   connect NL BRP (Basisregistratie Gewaspercelen) via PDOK/RVO open data
   (API or download). 
   - If it SUCCEEDS: implement it as the real parcel source for NL, keep the
     example set as a test fixture, and report that BRP is live.
   - If it FAILS or is too heavy to finish cleanly: stop, keep the example
     data in place, and report exactly what blocked it (endpoint, format,
     auth, geo-processing need) in the §G summary so it can be tackled next.
   Do NOT force a fragile half-integration. Either it works and is implemented,
   or it's cleanly deferred with a precise blocker note.

## C. Built for any farm / any country (infrastructure, not Dronten-only)

6. `farm_lat`/`farm_lon` are parameters; Dronten is only the example value.
7. Parcel-source selection is keyed by country/region (like `REGIONAL_CROP_DATA`):
   `nl` → BRP. Add commented empty stubs for `uk`, `dk`, `pt` parcel sources
   with a TODO that LPIS availability/coverage per country is UNVERIFIED and
   must be checked before use (do not assume EU-wide coverage). Fail loud for
   unfilled countries.

## D. Concentration → risk model (simple, defensible)

8. Use a THREE-LEVEL THRESHOLD model, not a continuous curve:
   low / medium / high concentration → a fixed risk add-on each. It must be
   explainable to a CFO in one sentence (e.g. "above X% same-crop share within
   the pest radius, we raise the risk add-on to Y%"). Thresholds + add-on
   values are the `verified:false` agronomy knobs from the principle above.
   Seed with placeholder values clearly marked as provisional.

## E. Radius

9. Pest-spread radius is per crop (and ideally per crop-pest), NOT a fixed
   distance. For this run implement it as a per-crop parameter with potatoes
   filled as the example (provisional value, `verified:false`, comment that
   late blight / phytophthora is wind-borne with a larger effective radius
   than soil-borne pests). Structure it so a crop-pest table can replace the
   single per-crop value later.

## F. Out of scope (do NOT attempt this run)
- NDVI/Sentinel (the weekly vitality signal) — that's a later, separate
  enrichment. This run is parcel-based concentration only.
- Multi-crop, regen-baseline unlock (still deferred from todo.md).

## G. Report back (Dutch)
- Bevestig dat de pijplijn werkt op de Dronten-voorbeelddata: toon de
  concentratie-share en de resulterende risico-opslag.
- Meld de uitkomst van de BRP-poging: live geïmplementeerd, of uitgesteld met
  precieze blocker.
- Bevestig dat de bestaande risk-math en de todo.md-fixtures nog kloppen.
- Eén regel over alles wat is overgeslagen of aangehouden.
