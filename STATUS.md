# Orbag — project status

_Living progress doc. Connected to the claude.ai Orbag Project via the GitHub connector so "where we are" is always visible there._

**Last updated:** 2026-06-06 (self-bootstrapping regions — DB-backed regional layer + auto-bootstrap for new countries, verified live on Poland)

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

## 3. Infrastructure & ops
- ✅ Supabase project "Project generator" (`wbysgkfsaoyaaatdgics`, West EU).
- ✅ 3 pg_cron jobs active (detect / apply / notify).
- ✅ Secret `RESEND_API_KEY` set in Supabase; `orbag.nl` verified as Resend sender domain.
- ✅ CLIs (`gh`, `vercel`, `supabase`) authenticated and resolving bare.

## 4. Repo & deploy
- ✅ All work committed and pushed to `github.com/Orbagleo1/Orbag-platform` (main).
- ✅ `CLAUDE.md` (project context), 4 intelligence migrations under `supabase/migrations/`, and `notify-held-signals` source under `supabase/functions/`.
- 🟡 **Partial migration history in repo** — the 4 session migrations are committed; 7 earlier ones exist only in the remote DB. Run `supabase db pull` for a full baseline.

---

## Backlog / next steps
- ⬜ Language switcher (NL/EN i18n).
- ⬜ `supabase db pull` to capture the 7 earlier migrations into the repo for a full baseline.
- ⬜ Optional: held-count badge in the cockpit dashboard.
- ⬜ Optional: weekly summary email (not just held-alerts).
- ⬜ Optional: `reply_to` on the alert email (left out in a revert).
- ⬜ Optional: "cool-down" on weather risk so it can't drift up indefinitely during a long drought.

---

_Maintenance: update this file (and the date above) whenever a milestone lands, then commit. The connected claude.ai Project reads it from GitHub._
