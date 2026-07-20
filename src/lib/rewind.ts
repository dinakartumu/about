/**
 * Build-time data layer for the Rewind API (rewind.dinakartumu.com).
 *
 * The shapers narrow live API JSON down to exactly the fields the pages
 * render; `rewindFetch` is the only function that touches the network and
 * runs solely in Astro frontmatter at build time.
 */

const REWIND_BASE = 'https://rewind.dinakartumu.com';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_ABBREV = MONTH_NAMES.map((m) => m.slice(0, 3));

export interface MonthRange {
  label: string;
  from: string;
  to: string;
}

export interface ShapedImage {
  url: string;
  dominantColor: string;
}

export interface TopItem {
  rank: number;
  name: string;
  detail: string;
  playcount: number;
  image: ShapedImage | null;
  link: string | null;
}

export interface RecentWatch {
  title: string;
  year: number | null;
  image: ShapedImage | null;
  stars: string;
  watchedDate: string;
  tmdbUrl: string | null;
  rewatch: boolean;
}

// Raw API shapes — only the fields we read.
interface ApiImage {
  cdn_url: string;
  dominant_color: string;
}

interface ApiTopItem {
  rank: number;
  name: string;
  detail: string;
  playcount: number;
  image: ApiImage | null;
  apple_music_url: string | null;
}

interface ApiTopListResponse {
  data: ApiTopItem[];
}

interface ApiWatchEntry {
  movie: {
    title: string;
    year: number | null;
    image: ApiImage | null;
    tmdb_id: number | null;
  };
  watched_at: string;
  user_rating: number | null;
  rewatch: boolean;
}

interface ApiRecentWatchesResponse {
  data: ApiWatchEntry[];
}

interface ApiYearRollup {
  year: number;
  total_scrobbles?: number;
}

/**
 * Month options for the listening dropdown: an "All months" entry spanning
 * the year, then each elapsed month of `year` newest first. UTC throughout.
 */
export function monthRanges(year: number, now: Date): MonthRange[] {
  const lastMonth =
    year < now.getUTCFullYear() ? 11 : year > now.getUTCFullYear() ? -1 : now.getUTCMonth();

  const ranges: MonthRange[] = [
    {
      label: 'All months',
      from: `${year}-01-01T00:00:00.000Z`,
      to: `${year}-12-31T23:59:59.999Z`,
    },
  ];
  for (let m = lastMonth; m >= 0; m--) {
    ranges.push({
      label: MONTH_NAMES[m],
      from: new Date(Date.UTC(year, m, 1)).toISOString(),
      to: new Date(Date.UTC(year, m + 1, 0, 23, 59, 59, 999)).toISOString(),
    });
  }
  return ranges;
}

/** Five-star string from a 1-10 rating, rounded to the nearest half. Null → ''. */
export function starsFor(rating: number | null): string {
  if (rating === null) return '';
  const halves = Math.round(rating); // rating/2 stars * 2 halves per star
  const full = Math.floor(halves / 2);
  const half = halves % 2;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
}

/** "Watched Jul 16, 2026" from an ISO timestamp, using the UTC date. */
export function fmtWatchDate(iso: string): string {
  const d = new Date(iso);
  return `Watched ${MONTH_ABBREV[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function shapeImage(image: ApiImage | null): ShapedImage | null {
  return image ? { url: image.cdn_url, dominantColor: image.dominant_color } : null;
}

/** Narrow a /v1/listening/top/* response to the fields the page renders. */
export function shapeTopList(json: ApiTopListResponse): TopItem[] {
  return json.data.map((item) => ({
    rank: item.rank,
    name: item.name,
    detail: item.detail,
    playcount: item.playcount,
    image: shapeImage(item.image),
    link: item.apple_music_url ?? null,
  }));
}

/** Narrow a /v1/watching/recent response to the fields the page renders. */
export function shapeRecentWatches(json: ApiRecentWatchesResponse): RecentWatch[] {
  return json.data.map((entry) => ({
    title: entry.movie.title,
    year: entry.movie.year,
    image: shapeImage(entry.movie.image),
    stars: starsFor(entry.user_rating),
    watchedDate: fmtWatchDate(entry.watched_at),
    tmdbUrl: entry.movie.tmdb_id
      ? `https://www.themoviedb.org/movie/${entry.movie.tmdb_id}`
      : null,
    rewatch: entry.rewatch,
  }));
}

/**
 * Headline numbers from /v1/listening/year/{year}. The rollup is a top-level
 * object (no `data` wrapper) whose play total is `total_scrobbles`.
 */
export function yearHeadline(json: ApiYearRollup): { year: number; totalPlays: number } {
  if (typeof json.total_scrobbles !== 'number') {
    throw new Error('listening year rollup has no total_scrobbles field');
  }
  return { year: json.year, totalPlays: json.total_scrobbles };
}

/** Build-time fetch: throws on a missing key or any non-200, naming the path. */
export async function rewindFetch<T = unknown>(path: string): Promise<T> {
  const key = import.meta.env.REWIND_API_KEY;
  if (!key) {
    throw new Error(`REWIND_API_KEY is not set (needed for ${path})`);
  }
  const res = await fetch(`${REWIND_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`Rewind API ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}
