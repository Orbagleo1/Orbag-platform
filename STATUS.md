# Orbag — project status

_Living progress doc. Connected to the claude.ai Orbag Project via the GitHub connector so "where we are" is always visible there._

**Last updated:** 2026-06-07 (crop-concentration: offline BRP precompute so the 15 km case computes live from cache; literature-calibrated agronomy knobs; live BRP source; earlier today: buyer-location request field + engine regression fixtures + "Adding a new region" docs; all deployed and verified live on orbag.online)

Legend: ✅ done & verified · 🟡 in progress · ⬜ planned / backlog

---

## 1. Platform & UI
- ✅ **English-consistent UI** across all pages (`boer`, `account`, `cockpit`, `zaden` translated; data/API keys untouched; `en-GB` date/number locale).
- ✅ **Auth/role fix** — `profiles.role` only drives prefill + default landing page, never gates navigation; any logged-in user can run both farmer and buyer analysis.
- ✅ **My Account role switch** so buyers see buyer company info.
- ✅ **Report bug fixes** in the buyer/farmer flows.
- ⬜ **Language switcher (NL/EN i18n)** — deliberately deferred; target audience is Dutch, so a switcher is the eventual goal. Not built yet.

## 2. Self-sharpening intelligence pipeline (Supabase)
The core automated system. Daily closed loop, no human needed in the normal case:

```
04:30 UTC  detect  →  intelligence-fx-weather   (ECB FX + Open-Meteo) writes signals (pending_review)
04:35 UTC  market  →  intelligence-market       refreshes MARKET.* (diesel via CBS, gated)
04:45 UTC  apply   →  apply_intelligence_updates() sharpens benchmarks, dedupes, holds outliers
04:50 UTC  notify  →  notify-held-signals        emails an alert when a signal is held
```

- ✅ **Detector** (`intelligence-fx-weather`, edge fn) — scheduled via pg_cron job `orbag-intelligence-fx-weather-daily`.
- ✅ **Apply step** (`apply_intelligence_updates()`, plpgsql, SECURITY DEFINER) — pg_cron job `orbag-intelligence-apply-daily`. Applies newest HIGH-confidence signal per `field_path` to `intelligence_benchmarks`, supersedes duplicates.
- ✅ **Guardrails** (autonomy + safety): HIGH-confidence only; `pct` values clamped 0–1; moves beyond 3× are **held** for manual review instead of applied. Verified with a synthetic outlier.
- ✅ **Weather self-sharpening** → `RISK_PCT.weather_conv.<country>` benchmarks.
- ✅ **FX self-sharpening** → new `LOGISTICS.import_cost.<country>` benchmarks track the live ECB rate, while `FX.EUR_*` 2024 baselines stay intact so the import-cost risk signal keeps firing.
- ✅ **Audit log** `intelligence_apply_log` — one row per run, `held_details` lists every guardrail-blocked outlier with reason.
- ✅ **Email alerts** via Resend → `leojansen@orbag.nl`, from `alerts@orbag.nl`. Fires only when something is held. **Verified end-to-end** (domain verified, secret set, test alert delivered).

## 3. Buyer business-case engine (`api/generate.js`)
JS engine computes every number; Haiku only writes the narrative (two-call design).
- ✅ **Coefficient calibration via deep research** — shock scenarios (Hormuz/Red Sea/energy) sourced to EIA/IRU/Eurostat/Drewry/ITF-OECD; logistics layer calibrated, **CO₂ + fuel mode-split road/sea** (CE Delft/GLEC/Eurostat); fuel intensity sourced; spoilage/packaging/returns confirmed unsourced and labelled LOW (no public primary exists).
- ✅ **Regional crop-data layer** — KWIN relabelled **NL-only quality table** (tare/defect/nitrate/dm); `REGIONAL_CROP_DATA` overrides yield/price/variable-cost per production region. `cropCoefficients()` merges them, per-field null-safe.
- ✅ **UK/Norfolk source** added (AHDB Farmbench / Grain Market Daily) + a two-click **Bolwick demo preset**; benchmark source label surfaced in the report KPIs and narrative.
- ✅ **Buyer-vs-farm separation** — production data is tied to where the crop is grown; logistics + customs are a function of the buyer (`customsCost()` gates import duty by EU-membership vs the buyer), so UK→NL pays the GB→EU charge while UK→UK would not.
- ✅ **Buyer location is a request field** (`buyerLocation` in `analyse.html`, default NL) — `customsCost()` is buyer-aware so UK→NL pays the GB→EU duty (€45/t) while UK→UK pays none. Back-compat: missing/unknown ⇒ EU buyer, so existing submissions are byte-identical. Live-verified end-to-end on orbag.online.
- ✅ **Engine regression fixtures** (`tests/engine.test.js`, run `node tests/engine.test.js`) — offline, no network; lock the computed nl / uk→nl / uk→uk numbers so a future change can't silently shift an existing farm's figures. Run before any engine change.
- ✅ **Crop-concentration risk layer** (todo2, `crop_concentration`) — same-crop area share within a per-crop pest radius → low/medium/high risk add-on. Enrichment: activates only when the request carries `farm_lat`/`farm_lon` (fixtures unaffected). NL source = **live BRP (PDOK/RVO WFS)** with a density preflight — computes live on feasible radii, defers with the exact parcel count where too dense (15 km in Flevoland ≈ 43k parcels → offline precompute needed; PDOK WFS has no server-side crop filter). Dronten example set drives offline tests (`node tests/concentration.test.js`). NDVI/Sentinel deferred. uk/dk/pt parcel sources are fail-loud stubs.
- ✅ **Offline BRP precompute** (`scripts/precompute-concentration.js` + `crop_concentration_grid` table + `save_concentration_grid` RPC, migration `create_concentration_grid`) — downloads BRP once (paged), computes the true area-based share per grid point, caches it. The engine reads the nearest cell FIRST, so the **15 km case now computes live from cache** instead of deferring (PDOK WFS can't return 46k polygons in one serverless call). Seeded for the Dronten area (potatoes); real 15 km share there ≈ 16% (low), 34.8k parcels. Widen `GRID_N` / re-run at other centres to extend; full-NL scale → PostGIS bulk-load later. Re-run yearly (BRP is annual).
- ✅ **Concentration agronomy knobs calibrated** (still `verified:false`) — **radius** potatoes 15 km, MEDIUM confidence (≥16 km late-blight separation + 10–20 km wind dispersal; Firester 2018 / APS / Hannukkala 2007); **threshold curve** is a three-level step model (justified: invasion is a percolation phenomenon, critical host fraction ~0.33–0.41), positions MEDIUM (`medium 0.30 / high 0.50`), add-on magnitudes (1/3/6%) LOW/expert-prior. Each carries source + confidence in code; validate with a plant pathologist before treating as real.

## 4. International & self-bootstrapping regions
Adding a country is a DB row (or an auto-bootstrap), not a code deploy.
- ✅ **DB-backed regions** — `region_coefficients` (risk + logistics + customs per source) and `regional_crop_data` (yield/price/cost per region), anon-read, seeded 1:1 from the old hardcoded values. Engine reads them live (`getRegionalData` + `buildRegions`) with the hardcoded constants as a **fallback** — never breaks if the DB is empty/unreachable. Verified: no-DB result byte-identical to before; DB overrides picked up live.
- ✅ **Auto-bootstrap** (`api/bootstrap-region.js`) — a new country resolves via World Bank metadata → a full **provisional** region: great-circle distance→logistics, EU-27 lookup→customs, income level→geo-risk proxy, WB cereal yield→crop yield proxy. **Verified live on Poland** (0 data → working buyer BC in minutes, transparently labelled provisional).
- ✅ **Signup trigger** — `account.html` captures Country → fire-and-forget `/api/bootstrap-region` (non-blocking); `profiles.country` column added. `analyse.html` populates the source dropdown from the DB so a new region is immediately selectable.
- ✅ **Write architecture (least-privilege)** — `SUPABASE_KEY` is the ANON key and is the only key in the app **by design** (no all-powerful service_role key = no such attack surface). All privileged writes go through bounded `SECURITY DEFINER` RPCs: `save_report` / `save_buyer_bc` / `save_farmer_bc`, `bootstrap_region`. This **fixed silent report-save failures** (anon could not insert into `reports`/`buyer_bcs`/`farmer_bcs`) — verified a report row now persists live.

## 5. Infrastructure & ops
- ✅ Supabase project "Project generator" (`wbysgkfsaoyaaatdgics`, West EU).
- ✅ 3 pg_cron jobs active (detect / apply / notify).
- ✅ Secret `RESEND_API_KEY` set in Supabase; `orbag.nl` verified as Resend sender domain.
- ✅ CLIs (`gh`, `vercel`, `supabase`) authenticated and resolving bare.

## 6. Repo & deploy
- ✅ All work committed and pushed to `github.com/Orbagleo1/Orbag-platform` (main).
- ✅ Migrations under `supabase/migrations/` now include the regional layer: `create_regional_data_tables`, `add_country_to_profiles`, `bootstrap_region_function`, `report_save_rpcs` (all applied to the remote + committed).
- ✅ Serverless: `api/generate.js` (buyer), `api/farmer.js` (farmer), `api/bootstrap-region.js` (new-region auto-bootstrap).
- ✅ **Engine test harness** — `tests/engine.test.js` (run `node tests/engine.test.js`, no deps): offline regression fixtures locking the nl / uk→nl / uk→uk computed numbers. Briefing docs for autonomous sessions live under `operations/`.
- 🟡 **Partial migration history in repo** — session migrations are committed; 7 earlier ones exist only in the remote DB. Run `supabase db pull` for a full baseline.

---

## Backlog / next steps
- ⬜ **Sharpen provisional regions** — upgrade auto-bootstrapped regions from `provisional` → `active`: per-crop yield/price/variable-cost via FAOSTAT/Statista (through the Hanze library) + the deep-research harness. Bootstrap leaves price/variable-cost null on purpose (engine falls back to NL meanwhile).
- ⬜ **Rate-limit the public RPCs** (`save_*`, `bootstrap_region`) — they are anon-callable (parity with the already-public `/api/generate`); add edge rate-limiting before scale.
- ⬜ Optional: unlock the **regen baseline** (currently NL-locked) so a non-NL farm can be modelled as the regen target, not just the incumbent source.
- ⬜ Language switcher (NL/EN i18n).
- ⬜ `supabase db pull` to capture the 7 earlier migrations into the repo for a full baseline.
- ⬜ Optional: held-count badge in the cockpit dashboard.
- ⬜ Optional: weekly summary email (not just held-alerts).
- ⬜ Optional: `reply_to` on the alert email (left out in a revert).
- ⬜ Optional: "cool-down" on weather risk so it can't drift up indefinitely during a long drought.
- ⬜ Account hygiene: remove the stray `orbag.eu` domain from the Vercel "orbag" team — it is not in the code, not a project domain, and not serving anything (live runs on `orbag.online`); the CLI reports "no access", so it needs the Vercel dashboard (Team → Settings → Domains).

---

_Maintenance: update this file (and the date above) whenever a milestone lands, then commit. The connected claude.ai Project reads it from GitHub._
