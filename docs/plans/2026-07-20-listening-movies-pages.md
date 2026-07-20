# Listening + Movies Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven execution) to implement this plan task-by-task.

**Goal:** `/listening` and `/movies` pages on dinakartumu.com, built at deploy time from the personal Rewind API, refreshed daily by a deploy-hook cron.

**Architecture:** Static Astro 5 site (no adapter). All API calls happen in frontmatter at build time using `REWIND_API_KEY` from the build env. Per-month listening data is embedded as a JSON island and swapped by a few lines of vanilla JS. Design doc: `docs/plans/2026-07-20-listening-page-design.md` (including the movies addendum).

**Tech Stack:** Astro 5, TypeScript, Vitest (see `src/lib/images.test.ts` for house test style). Site conventions: `src/layouts/Layout.astro` shell, `src/components/Nav.astro`, scoped styles inside `.astro` files, minimal client JS.

**API facts (verified against the live instance):**

- Base URL `https://rewind.dinakartumu.com`, header `Authorization: Bearer ${REWIND_API_KEY}`.
- `GET /v1/listening/top/artists|albums|tracks?from=<ISO>&to=<ISO>&limit=N` → `{ data: [...], pagination }`. Items include `name`, `playcount`, nullable `image` (`{ url, thumbhash, dominant_color, accent_color }`), and (artists/albums/tracks vary) `apple_music_url`-style links — the implementer must inspect one real response per endpoint and type accordingly.
- `GET /v1/listening/year/{year}` → yearly rollup; use it for the "N plays in {year}" headline (verify the field name by calling it; if the endpoint 404s or lacks a total, fall back to summing `/v1/listening/calendar` or use `stats.total_scrobbles` — implementer's judgment, but the headline must reflect the displayed year, not all-time).
- `GET /v1/watching/stats` → `{ data: { total_movies, movies_this_year, total_watch_time_hours, ... } }`.
- `GET /v1/watching/recent?limit=24` → `{ data: [ { movie: { id, title, year, tmdb_id, image }, watched_at, user_rating (1-10 | null), rewatch, ... } ] }`. `image` may be null (posters still processing) — must render a graceful title-card fallback.
- Image URLs in responses already point at `https://cdn.dinakartumu.com` including `/cdn-cgi/image/` transform variants; use them as-is, never construct CDN paths by hand.
- The build must FAIL (throw) on any non-200 API response — never publish a page with silently missing sections.

**Env:** `REWIND_API_KEY` is available locally in `/Users/dinakartumu/Development/rewind/.claude/worktrees/trakt-watching/.dev.vars` for local build verification (`REWIND_API_KEY=... npm run build`). Never commit it.

---

### Task 1: Data layer — `src/lib/rewind.ts` with tests

TDD. Create `src/lib/rewind.test.ts` first with fixture-based tests, then implement.

Pure functions (testable without network):

- `monthRanges(year, now)` → array of `{ label: 'March', from, to }` for elapsed months of `year`, newest first, plus an `all` entry. Timezone-safe (UTC).
- `starsFor(rating: number | null)` → `'★★★★☆'`-style string from a 1-10 rating halved to 5 stars (round to nearest half; half stars render as `½` or a partial glyph — implementer's choice, test locks it). Null → ''.
- `fmtWatchDate(iso)` → `Watched Jul 16, 2026`.
- Response shapers: `shapeTopList(json)`, `shapeRecentWatches(json)` — narrow the API JSON to exactly the fields the pages render (title/name, playcount, image url + dominant_color, outbound link with Apple Music/TMDB fallback logic). Tests feed fixture JSON captured from the live API (store trimmed fixtures under `src/lib/__fixtures__/`).

Fetch layer (thin, not unit-tested): `rewindFetch(path)` reads `import.meta.env.REWIND_API_KEY`, throws on missing key or non-200 with a message naming the path.

Gates: `npm test` green (29 baseline + new), `npx astro check` if configured (else tsc via astro). Commit: `feat: rewind api data layer`.

### Task 2: `/listening` page

- `src/pages/listening.astro`: frontmatter fetches year headline + top artists/albums/tracks for "all" plus each elapsed month (use `monthRanges`), renders the four sections per the design; embeds the per-month JSON in `<script type="application/json" id="listening-data">`; ~30 lines of inline `<script>` for the dropdown swap (no framework).
- Layout: match the site's existing typography/spacing (read `about.astro` and `Layout.astro` first; reuse CSS custom properties). Artwork `<img>` tags: `loading="lazy"`, `style="background:{dominant_color}"`, fixed aspect ratio.
- Add "Listening" to `src/components/Nav.astro`.
- Verify: `REWIND_API_KEY=<from .dev.vars> npm run build` succeeds and `dist/listening/index.html` contains a real artist name. Commit: `feat: listening page`.

### Task 3: `/movies` page

- `src/pages/movies.astro` per the design addendum: stats header (three metrics), recently-watched poster grid (24 tiles, poster or title-card fallback, stars, watch date, TMDB link). Add "Movies" to Nav.
- Same build verification (dist/movies/index.html contains a real movie title). Commit: `feat: movies page`.

### Task 4: Daily rebuild workflow

- `.github/workflows/rebuild.yml`: `on: schedule: - cron: '0 12 * * *'` plus `workflow_dispatch`; single step `curl -fsS -X POST "$PAGES_DEPLOY_HOOK"` with the hook from `secrets.PAGES_DEPLOY_HOOK`. Fail loudly if the secret is unset. Commit: `feat: daily rebuild cron`.

### Task 5: Full verification

`npm test`, full `npm run build` with the key, spot-check both dist pages' HTML (headline number, no 'undefined'/'null' strings, image srcs point at cdn.dinakartumu.com). Do NOT push — the orchestrator handles infra (Pages env var, deploy hook, GH secret) and the merge.
