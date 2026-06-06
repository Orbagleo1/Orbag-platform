# Orbag platform

Static HTML demo that generates AI agriculture business-case reports for Dutch farmers and buyers. **No build step, no `package.json`** — each page is a standalone full HTML file with inline `<style>`/`<script>`.

## Structure
- **Pages** (clean URLs via `vercel.json`): `index` (landing), `boer` (farmer intake form), `analyse` (buyer intake form), `cockpit` (dashboard), `match`, `account` (auth + profile), `kennis`, `zaden`.
- **Serverless functions** (`api/`): `generate.js` (buyer report) and `farmer.js` (farmer report). Both call the Anthropic API (`maxDuration` 60s), return JSON, and save the report to Supabase. Errors come back as `{ error: "..." }`. **Model per route:** `farmer.js` uses `claude-sonnet-4-6` (the AI does the transition-economics reasoning from KWIN data); `generate.js` uses `claude-haiku-4-5` (a JS engine computes all numbers — the AI only writes the narrative).
- Each page's CSS lives in a `:root` block of CSS variables — reuse those tokens (`--forest`, `--leaf`, `--creme`, `--radius`, …) when styling, and match the page's existing inline pattern rather than adding external files.

## Stack & services
- **Vercel** — hosting + serverless. Deploy: drag the folder to vercel.com/new, or `vercel` CLI (resolves bare).
- **Supabase** — Postgres storing reports. Project "Project generator" (`wbysgkfsaoyaaatdgics`, West EU). Linked via `supabase/config.toml`.
- **Anthropic API** — generates reports (~€0.01 each).
- **Secrets are Vercel env vars, never in the repo**: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`. So the API routes only work on a deploy (or `vercel dev`), not by opening the HTML file directly.

## CLIs (all authenticated, resolve bare)
`gh` (Orbagleo1), `vercel` (orbagleo1), `supabase`. See `DEPLOY.md` for the full deploy walkthrough.

## Conventions
- The UI is **consistently English** (unified 2026-06-06). New user-facing copy should be English. Dutch place names (Groningen, Noord-Nederland, etc.) and domain terms in parentheses are fine. A NL/EN **language switcher (i18n) is a planned later step** — not built yet.
- When translating, never change `value`/`data-*` attributes or object keys that the API or filters rely on (e.g. crop checkbox values like `wintertarwe` map via `CROP_MAP`); only change the visible labels.
- Number/date formatting: use `en-GB` locale so amounts and months render in English.
- **Auth/role rule:** `profiles.role` (`farmer`/`buyer`) is for **prefill and the default landing page after login only** — it must **never** gate navigation. Pages may require a *session* (redirect to `/account?next=…` when logged out), but must **not** redirect a logged-in user away based on their role. Any logged-in user can run both the farmer (`/boer`) and buyer (`/analyse`) analysis. Personalising a view by role (e.g. which matches to show) is fine; bouncing the user to another page is not.
- Reply to the user in Dutch; they are hands-on and prefer that the setup work is done for them.

## Adding a new region
The buyer engine (`api/generate.js`) selects **crop economics** by *source region* and **logistics/customs** by *source region vs buyer location*. Adding a region means **filling data, not editing calculation logic** — the selection path has no hardcoded region names.

There are three ways to add a region, in order of preference:

1. **Auto-bootstrap (default).** A new country entered at signup (`account.html` → `profiles.country`) fires `/api/bootstrap-region`, which derives a full **provisional** region from World Bank metadata (distance→logistics, EU-27→customs, income→geo-risk proxy, WB cereal yield→crop-yield proxy). It then appears in the `analyse` source dropdown automatically. Price and variable-cost are left null on purpose — the engine falls back to NL means until sharpened. (Verified live on Poland.)

2. **DB rows (primary, to sharpen a region).** The engine reads these live over the hardcoded fallback:
   - `region_coefficients` — one row per source: `region_key`, `geopolitical_pct`, `weather_conv_pct`, `transport_cost_per_t` / `_distance_km` / `_transit_days` / `_buffer_weeks`, `load_factor`, `import_cost`, `is_sea_route`, `is_eu`, `crop_region`.
   - `regional_crop_data` — one row per (crop_region, crop): `yield_t_ha`, `price_conv`, `variable_cost_ha`, `source_label`.

3. **Hardcoded fallback (engine constants, only if you want it to work with an empty DB).** Fill the matching keys: `REGIONAL_CROP_DATA.<cropRegion>` (per-crop `yield_t_ha`/`price_conv`/`variable_cost_ha`/`source_label`), `RISK_PCT.geopolitical.<key>`, `LOGISTICS.transport.<key>`, `LOGISTICS.load_factor.<key>`, `SEA_ROUTES.<key>`, `IS_EU.<key>`, `SOURCE_TO_CROP_REGION.<key>`, and a static `<option>` in the `#currentSource` select in `analyse.html`.

**Pipeline-owned — do NOT hardcode these two:** `RISK_PCT.weather_conv.<key>` and `LOGISTICS.import_cost.<key>` are self-sharpened daily by the intelligence pipeline (`intelligence_benchmarks`). Seed them as benchmark rows, not as engine constants, so the apply-step keeps tuning them.

**Currency:** source coefficients are stored already converted to EUR (the single reporting currency). KWIN/NL is native EUR.

**Buyer location** is a request field (`buyerLocation`, `analyse.html`, default `nl`). `customsCost()` charges import duty only when the source sits in a *different* customs area than the buyer (UK→NL pays GB→EU; UK→UK pays nothing). Missing/unknown defaults to an EU buyer, so existing submissions are unchanged.

**Tests:** `node tests/engine.test.js` runs offline regression fixtures (NL, UK→NL buyer, UK→UK buyer) that lock the current computed numbers. Run before committing any engine change.

_Planned (NOT built): `RISK_PCT` gains a `crop_concentration` component — regional monoculture density feeding pest/disease risk, fed by BRP/LPIS parcel data + Copernicus/Sentinel. See `operations/module-gewasconcentratie.md`._
