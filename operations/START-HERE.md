# START HERE — autonomous build session

> ✅ **This run is COMPLETE** (regional data-source infrastructure shipped). This file is kept as
> the historical session brief. For the **current** state and what to do next, read `STATUS.md`
> (the living progress doc) and `OPEN-VOOR-JOU.md` (what's blocked on the user). Several later runs
> have landed on top (CFO view, farmer BC engine, crop-concentration, workorder BLOK 1-4, bug-audit).

You are running autonomously. Build the regional data-source infrastructure
for the Orbag buyer engine. Work end-to-end, commit, and deploy when the
acceptance checks pass. Reply in Dutch in any summary (the user prefers it).

## Read in this order before touching code
1. `CLAUDE.md` — project architecture, conventions, standing rules.
2. `STATUS.md` — what already exists, especially the Supabase intelligence
   pipeline (FX + weather self-sharpening). This matters: some fields you
   touch are pipeline-owned.
3. `todo.md` — the full task spec for this run. This is your work order.
4. `module-gewasconcentratie.md` — a FUTURE module. Do NOT build it. You only
   reserve a one-line backlog hook for it (see todo.md §A.3).

## Hard standing rules (violating these breaks the deploy)
- **CommonJS only** (`module.exports`). ESM (`export default`/`export const`)
  causes FUNCTION_INVOCATION_FAILED on Vercel. Never use it.
- **No build step, no package.json.** Pages are standalone HTML with inline
  style/script. Match the existing inline pattern; reuse the `:root` CSS
  tokens (`--forest`, `--leaf`, `--creme`, `--radius`).
- **Two-call design stays intact:** `generate.js` = JS computes all numbers,
  `claude-haiku-4-5` writes narrative only. Do not move logic into the AI call.
- **Never change `value`/`data-*` attributes or object keys** the API/filters
  rely on (e.g. crop keys via `CROP_MAP`). Only change visible labels.
- **Do not commit raw AHDB/KWIN datasets** — derived coefficients with
  attribution only (usage-terms).
- For large HTML edits, `grep -n` to locate lines before viewing/editing.

## The agreed data split (do not deviate)
- Crop economics (yield/cost/price) → new `REGIONAL_CROP_DATA` in the engine.
- `RISK_PCT.weather_conv.<region>` and `LOGISTICS.import_cost.<region>`
  → Supabase `intelligence_benchmarks` (pipeline-owned). Seed rows only;
  do not hardcode these two in engine code.
- `geopolitical`, `transport`, `load_factor`, `SEA_ROUTES`, EU/non-EU status
  → engine code.

## Definition of done
All acceptance checks in `todo.md §I` pass, committed with a clear message,
deployed, live `analyse` still runs a report end-to-end. Then produce the
report-back in `todo.md §J` (key figures for `nl` and `uk`/NL-buyer + a
one-line note on anything held or skipped).

## If you get stuck
If a step is genuinely blocked (e.g. a pipeline `field_path` collision, or a
missing credential), do NOT force it or invent a workaround that violates the
rules above. Skip that step, finish everything else, and report what was
blocked and why in the §J summary.
