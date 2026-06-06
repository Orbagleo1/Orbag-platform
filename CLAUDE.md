# Orbag platform

Static HTML demo that generates AI agriculture business-case reports for Dutch farmers and buyers. **No build step, no `package.json`** — each page is a standalone full HTML file with inline `<style>`/`<script>`.

## Structure
- **Pages** (clean URLs via `vercel.json`): `index` (landing), `boer` (farmer intake form), `analyse` (buyer intake form), `cockpit` (dashboard), `match`, `account` (auth + profile), `kennis`, `zaden`.
- **Serverless functions** (`api/`): `generate.js` (buyer report) and `farmer.js` (farmer report). Both call the Anthropic API (`claude-sonnet-4-6`, `maxDuration` 60s), return JSON, and save the report to Supabase. Errors come back as `{ error: "..." }`.
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
- Reply to the user in Dutch; they are hands-on and prefer that the setup work is done for them.
