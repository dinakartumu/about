# Listening page for dinakartumu.com

**Date:** 2026-07-20
**Status:** Approved

## Goal

A `/listening` page modeled on pdugan.com/listening, showing music listening
stats from the personal Rewind API (`https://rewind.dinakartumu.com`), on the
existing static Astro site with zero client-side API calls.

## Page structure

New `src/pages/listening.astro` using the existing layout shell, with
"Listening" added to the site nav. Sections, top to bottom:

1. Headline: "N plays in {year}" with a month dropdown ("all months" default).
2. Top Artists — ranked list of 10, artwork thumbnails, play counts.
3. Top Albums — horizontally scrollable cover row.
4. Top Tracks — numbered list with play counts.

Entries link to Apple Music where the API provides URLs (Apple Music
enrichment), otherwise unlinked. Artwork loads from the Rewind image proxy
with the thumbhash dominant color as loading background.

## Data flow

Build-time only. `src/lib/rewind.ts` fetches with `REWIND_API_KEY` (encrypted
Pages build env var, read-only key minted for this purpose):

- `GET /v1/listening/stats` — headline count
- `GET /v1/listening/top/artists|albums|tracks` — full year + one call per
  elapsed month (`from`/`to` params)

Per-month results are embedded as a JSON island; a few lines of vanilla JS
swap the rendered lists when the dropdown changes. No framework, no browser
network requests, no key in the client.

## Freshness

Cloudflare Pages deploy hook for the `about` project, curled by a GitHub
Actions cron (`.github/workflows/rebuild.yml`) daily at 12:00 UTC — ~30
builds/month against the 500/month Pages cap. Any git push also refreshes.
Staleness ceiling: one day.

Rewind's `revalidation_hooks` mechanism was considered and rejected: it fires
on every sync (listening syncs every 15 minutes) with no throttle, which
would exhaust the Pages build quota.

## Secrets

- `REWIND_API_KEY` (read-only, build-scoped) — Pages build env var.
- Deploy hook URL — GitHub Actions secret `PAGES_DEPLOY_HOOK`.
- Both recorded in the 1Password "Rewind API" item.

## Failure behavior

API unreachable at build time → the build throws and fails; Cloudflare keeps
serving the last successful deployment. The failed GitHub Action is the
alert.

## Testing

Vitest (already in the repo) covers the pure shaping functions in
`src/lib/rewind.ts` against fixture JSON: month bucketing, ranking, Apple
Music link fallback. The page is verified with a local `astro build` against
the live API before first push.

## Addendum: /movies page

Added at the user's direction, same architecture (build-time fetch, daily
rebuild). Modeled on pdugan.com/watching, trimmed to the data this instance
has (no written reviews — Trakt ratings only):

1. Stats header — three metrics from `GET /v1/watching/stats`:
   "{total_movies} Films · {movies_this_year} This Year ·
   {total_watch_time_hours} Hours".
2. Recently watched — poster grid from `GET /v1/watching/recent?limit=24`;
   each tile shows the poster (image proxy URL, dominant-color background
   while loading, title-card fallback when image is null), star rating
   derived from user_rating (1-10 halved to a 5-star scale), and watch date.
   Tiles link to TMDB via tmdb_id.
3. No month dropdown on this page (recent grid is inherently fresh).

Nav gains both entries: Listening, Movies.
