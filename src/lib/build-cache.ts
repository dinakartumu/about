/**
 * Build-time response cache for closed years.
 *
 * Most of a build's API calls ask for data that can never change again: 2015's
 * top albums for March are the same on every rebuild, forever. Yet the hourly
 * rebuild refetched all of it, and the cost grew by a year every January —
 * ~900 calls and 8.5 minutes by the time the per-month lists landed.
 *
 * So responses for *closed* years (strictly before the current one) are cached
 * to disk and committed, and the build only talks to the API for the current
 * year. Build time stops scaling with history.
 *
 * Populate or refresh it with:
 *
 *     npm run cache:warm
 *
 * which is just a build with REWIND_CACHE_WRITE=1 — recording real traffic
 * beats maintaining a second list of URLs that would drift from the components.
 *
 * Re-warm when either of these happens:
 *
 *   - After a backfill. "Closed" means "no longer accruing new data", not
 *     "never edited". The Spotify import that added 2013-2017 rewrote history;
 *     a warm cache would have gone on serving the pre-import numbers.
 *   - Each January. The year that just ended is now closed but uncached, so
 *     builds quietly pay for it live until the shard exists.
 *
 * Neither is urgent: a miss falls through to a live fetch, so a stale or
 * absent cache costs build time, never correctness.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'rewind-cache');

/** Recording is opt-in so ordinary builds never write into the repo. */
const WRITE_MODE = process.env.REWIND_CACHE_WRITE === '1';

type YearCache = Record<string, unknown>;

// year -> { path: response }. Loaded lazily, flushed once at exit.
const loaded = new Map<number, YearCache>();
const dirty = new Set<number>();

/**
 * The year a path's data belongs to, or null if it spans years / includes the
 * current one. Only single-closed-year requests are cacheable.
 *
 * Two shapes cover essentially every call the components make: an explicit
 * `from`/`to` window, and `/year/{yyyy}` in the path. Anything else — the
 * all-time genre feed, the wide trends probe used for year navigation — stays
 * live, which is correct: those span the current year.
 */
export function closedYearFor(path: string, currentYear: number): number | null {
  const from = /[?&]from=([^&]+)/.exec(path)?.[1];
  const to = /[?&]to=([^&]+)/.exec(path)?.[1];

  if (from && to) {
    const fromYear = Number(decodeURIComponent(from).slice(0, 4));
    const toYear = Number(decodeURIComponent(to).slice(0, 4));
    if (!Number.isFinite(fromYear) || fromYear !== toYear) return null;
    return fromYear < currentYear ? fromYear : null;
  }

  // No window: only `/year/{yyyy}`-style paths are year-scoped on their own.
  const inPath = /\/year\/(\d{4})(?:[/?]|$)/.exec(path)?.[1];
  if (inPath) {
    const year = Number(inPath);
    return year < currentYear ? year : null;
  }

  return null;
}

function fileFor(year: number): string {
  return join(CACHE_DIR, `${year}.json`);
}

function cacheFor(year: number): YearCache {
  const already = loaded.get(year);
  if (already) return already;

  let data: YearCache = {};
  const file = fileFor(year);
  if (existsSync(file)) {
    try {
      data = JSON.parse(readFileSync(file, 'utf-8')) as YearCache;
    } catch {
      // A corrupt shard just means a slower build, not a broken one.
      data = {};
    }
  }
  loaded.set(year, data);
  return data;
}

/** Cached response for a path, or undefined on a miss. */
export function readCache(path: string, currentYear: number): unknown | undefined {
  const year = closedYearFor(path, currentYear);
  if (year === null) return undefined;
  return cacheFor(year)[path];
}

/** Record a response. No-op unless recording is enabled. */
export function writeCache(path: string, currentYear: number, value: unknown): void {
  if (!WRITE_MODE) return;
  const year = closedYearFor(path, currentYear);
  if (year === null) return;
  cacheFor(year)[path] = value;
  dirty.add(year);
}

export function isWriteMode(): boolean {
  return WRITE_MODE;
}

/**
 * Flush dirty shards. Registered on process exit so a recording build persists
 * whatever it gathered even if a later page fails — sorted keys keep diffs
 * readable across re-warms.
 */
function flush(): void {
  if (dirty.size === 0) return;
  mkdirSync(CACHE_DIR, { recursive: true });
  for (const year of dirty) {
    const data = cacheFor(year);
    const sorted: YearCache = {};
    for (const key of Object.keys(data).sort()) sorted[key] = data[key];
    writeFileSync(fileFor(year), `${JSON.stringify(sorted, null, 0)}\n`);
  }
  dirty.clear();
}

if (WRITE_MODE) process.on('exit', flush);

/** Shard summary for the warm script's report. */
export function cacheStats(): { year: number; entries: number; bytes: number }[] {
  if (!existsSync(CACHE_DIR)) return [];
  return readdirSync(CACHE_DIR)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .map((f) => {
      const raw = readFileSync(join(CACHE_DIR, f), 'utf-8');
      return {
        year: Number(f.slice(0, 4)),
        entries: Object.keys(JSON.parse(raw) as YearCache).length,
        bytes: Buffer.byteLength(raw),
      };
    })
    .sort((a, b) => a.year - b.year);
}
