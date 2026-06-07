# TODO — Regional data-source infrastructure for the buyer engine

**Goal:** Restructure the buyer BC-engine (`api/generate.js`) so it can run a
business case for *any* farm, by selecting the correct regional data source
from (source region, buyer location, crop). This is infrastructure, not a
single demo. Van Lanschot Kempen farms (Norfolk UK, NL) are the first filled
regions; other regions are left as empty-but-ready slots.

Read `CLAUDE.md` and `STATUS.md` first. Respect the existing architecture:
no build step, standalone HTML pages, CommonJS only (ESM crashes Vercel),
two-call design (`generate.js` = JS computes numbers + `claude-haiku-4-5`
writes narrative; do not touch the narrative call).

You may commit and deploy yourself when the acceptance checks pass.

---

## A. Core architecture — the regional data layer

1. Create a `REGIONAL_CROP_DATA` object keyed by region. Each region holds
   per-crop coefficients. Migrate the existing KWIN crops under region key
   `nl`. Each crop entry carries, at minimum:
   - `yield_t_ha`, `variable_cost_ha`, `price_ton`
   - `currency` (e.g. `EUR`, `GBP`) — see §C
   - `source_label` (e.g. `"KWIN-AGV 2024"`)
   - `source_date` (e.g. `"2024"` / `"harvest 2024/25, retrieved 2026-06"`)
   - `verified` (boolean: true only for genuinely sourced figures)

2. The engine selects crop data by **source region**, logistics/customs by
   **buyer location vs source region** (see §B), and crop within the region.
   Adding a new region must mean *filling one data block*, not editing engine
   logic. Keep the selection logic generic — no hardcoded region names in the
   calculation path.

3. **Extensibility contract** — add a short section to `CLAUDE.md` titled
   "Adding a new region" that documents exactly which keys to fill
   (`REGIONAL_CROP_DATA.<region>`, the `RISK_PCT` / `LOGISTICS` /
   `SEA_ROUTES` entries, the form `<option>`s) so a future session can add
   Denmark/Portugal without re-deriving the design.
   In the same section, add a one-line backlog note (do NOT build it now):
   "Planned: `RISK_PCT` gains a `crop_concentration` component — regional
   monoculture density feeding pest/disease risk, fed by BRP/LPIS parcel data
   + Copernicus/Sentinel. See module-gewasconcentratie.md." This only reserves
   the concept in the architecture; no code for it in this run.

## B. Buyer location as an explicit parameter

4. Buyer location must be an **input**, not hardcoded NL. Cross-border
   logic (customs, sea-leg, ferry) is a function of **source region vs buyer
   location**: a UK farm selling to a UK buyer incurs no customs; a UK farm
   selling to an NL buyer does. Build the structure to support this even if
   the form initially exposes only an NL buyer. Add the buyer-location field
   to `analyse.html` (default NL) without breaking existing submissions.

## C. Currency

5. Data sources carry their own `currency`. The engine converts **once,
   centrally**, to a single reporting currency (EUR). Reuse the live ECB rate
   the intelligence pipeline already maintains (`FX.EUR_*`); do not introduce
   a second FX source. NL/KWIN stays EUR (no conversion).

## D. Fail loud, never fall back silently

6. Remove silent fallbacks (unknown crop → `green_beans`, unknown region →
   NL defaults). If verified data for (crop, region) is missing, the engine
   returns an explicit, structured error (e.g.
   `{ error: "No data source for crop 'X' in region 'Y'" }`) instead of
   computing a misleading number. Unverified-but-present coefficients may
   compute, but must surface their `verified:false` status in the engine
   output so the caller knows.

## E. Filled regions

### NL (`nl`)
7. Migrate existing KWIN crops as-is, `currency: EUR`,
   `source_label: "KWIN-AGV 2024"`, `verified` only where genuinely sourced
   (wheat/onions true; the others stay `verified:false`).

### UK / Norfolk (`uk`)
8. Add region `uk` with `currency: GBP`,
   `source_label: "AHDB Farmbench / Grain Market Daily, harvest 2024/25, retrieved 2026-06"`,
   `verified: false` (derived from AHDB publications, not the raw dataset).
   Coefficients (GBP, convert to EUR centrally per §C):
   - `wheat`:    yield 8.0,  price 199,  variable_cost 560
   - `potatoes`: yield 45.0, price 195,  variable_cost 2000
   - `peas`:     yield 4.2,  price 235,  variable_cost 245

9. Add `uk` to the buyer-location/source layers with these traceable values
   (mark each with a `// SOURCE` comment). **Route via the intelligence
   pipeline where it already owns the field**, per the agreed split:
   - **Engine code:** `RISK_PCT.geopolitical.uk = 0.04` (stable OECD);
     `LOGISTICS.transport.uk = { cost_per_ton: 30, distance_km: 480, transit_days: 2, buffer_weeks: 2 }`
     (Stena Harwich–Hook short-sea + road); `LOGISTICS.load_factor.uk = 0.82`;
     `SEA_ROUTES.uk = true`; mark UK **non-EU** (customs/SPS apply).
   - **Supabase `intelligence_benchmarks` (pipeline-owned, do NOT hardcode in engine):**
     `RISK_PCT.weather_conv.uk` (seed ≈ 0.22, higher rainfall variability than NL);
     `LOGISTICS.import_cost.uk` (seed ≈ 45 EUR/ton, post-Brexit BTOM/Common User Charge + SPS).
     Insert these as seed rows so the daily apply-step can sharpen them;
     confirm they don't collide with existing `field_path` rows.

## F. Empty-but-ready slots

10. Add commented, empty region stubs for `dk` (SEGES) and `pt` (COTHN/GPP)
    in `REGIONAL_CROP_DATA` and the source/logistics layers, with a TODO note
    that data is not yet sourced. The engine must treat them as "missing data"
    (fail loud per §D) until filled — never approximate them from NL/UK.

## G. Tests / regression safety

11. Add a lightweight test fixture per filled region (`nl`, `uk`): a fixed
    input → expected engine output (the computed numbers, not the narrative).
    Run them before committing so a future change can't silently shift an
    existing farm's figures. Document how to run them.

## H. Out of scope (deliberately deferred — do NOT attempt)

- Multi-crop weighted mix (one crop per run stays the rule).
- Unlocking the NL-fixed regenerative baseline.
- Raw source datasets: use derived coefficients with attribution only;
  do **not** commit any raw AHDB/KWIN table to the repo (usage-terms).

## I. Acceptance checks before deploy

- An NL run reproduces today's numbers (fixture passes).
- A UK-source run with an NL buyer computes, applies customs + sea-leg, and
  reports `verified:false` with the AHDB source label.
- A UK-source run with a UK buyer applies **no** customs.
- An unknown (crop, region) fails loud with a structured error.
- `CLAUDE.md` has the "Adding a new region" section.
- Commit with a clear message; deploy; confirm the live site still serves
  `analyse` and runs a report end-to-end.

## J. Report back

After deploy, output for `nl` and `uk` (NL buyer) the key figures
(net value, risk reduction, justified farm gate price) so the numbers can be
sanity-checked, plus a one-line note on anything held or skipped.

---

## Follow-on work (separate runs)
- **Crop-concentration risk layer** — built and deployed as a worldwide, tiered
  provider infrastructure (NL BRP / EU CLMS / global WorldCover). Its status and
  open follow-ups live in `todo2-gewasconcentratie.md` (§H status, §I open points).
