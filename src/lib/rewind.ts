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
  rating: number | null;
  watchedDate: string;
  tmdbUrl: string | null;
  rewatch: boolean;
}

// Raw API shapes — only the fields we read.
interface ApiImage {
  cdn_url: string;
  dominant_color: string | null; // null until color extraction has run
}

interface ApiTopItem {
  rank: number;
  name: string;
  detail: string;
  playcount: number;
  image: ApiImage | null;
  url: string; // Last.fm URL; empty string on artists/albums
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

interface ApiWatchingStatsResponse {
  data?: {
    total_movies: number;
    movies_this_year: number;
    total_watch_time_hours: number;
  };
}

interface ApiCountedName {
  category?: string;
  city?: string;
  count: number;
}

// /v1/places/stats returns its fields at the top level — no `data` wrapper.
interface ApiPlacesStatsResponse {
  total?: number;
  unique_venues?: number;
  this_year?: number;
  top_categories?: ApiCountedName[];
  top_cities?: ApiCountedName[];
}

interface ApiCheckin {
  venue_name: string;
  venue_category: string;
  venue_city: string | null;
  venue_country: string | null;
  checked_in_at: string;
  shout: string | null;
}

interface ApiRecentCheckinsResponse {
  data?: ApiCheckin[];
}

interface ApiYearRollup {
  year: number;
  total_scrobbles?: number;
}

// /v1/*/trends bucket: listening keys the number `value`, watching and
// places key it `count`. Exactly one of the two is present.
interface ApiTrendBucket {
  period: string; // "YYYY-MM"
  value?: number;
  count?: number;
}

interface ApiTrendsResponse {
  data?: ApiTrendBucket[];
}

/** First year with a Last.fm account — the earliest listening year page. */
export const LISTENING_FIRST_YEAR = 2016;

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

/** "Jul 16, 2026" from an ISO timestamp, using the UTC date. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_ABBREV[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Watched Jul 16, 2026" from an ISO timestamp, using the UTC date. */
export function fmtWatchDate(iso: string): string {
  return `Watched ${fmtDate(iso)}`;
}

/** Neutral backdrop used until the API has extracted a dominant color. */
const FALLBACK_DOMINANT_COLOR = '#1a1a1a';

function shapeImage(image: ApiImage | null): ShapedImage | null {
  return image
    ? { url: image.cdn_url, dominantColor: image.dominant_color ?? FALLBACK_DOMINANT_COLOR }
    : null;
}

/** Narrow a /v1/listening/top/* response to the fields the page renders. */
export function shapeTopList(json: ApiTopListResponse): TopItem[] {
  return json.data.map((item) => ({
    rank: item.rank,
    name: item.name,
    detail: item.detail,
    playcount: item.playcount,
    image: shapeImage(item.image),
    // || deliberately: url is an empty string (not null) on artists/albums.
    link: item.apple_music_url || item.url || null,
  }));
}

/** Narrow a /v1/watching/recent response to the fields the page renders. */
export function shapeRecentWatches(json: ApiRecentWatchesResponse): RecentWatch[] {
  return json.data.map((entry) => ({
    title: entry.movie.title,
    year: entry.movie.year,
    image: shapeImage(entry.movie.image),
    stars: starsFor(entry.user_rating),
    rating: entry.user_rating != null ? entry.user_rating / 2 : null,
    watchedDate: fmtWatchDate(entry.watched_at),
    tmdbUrl: entry.movie.tmdb_id
      ? `https://www.themoviedb.org/movie/${entry.movie.tmdb_id}`
      : null,
    rewatch: entry.rewatch,
  }));
}

export interface WatchingStats {
  totalMovies: number;
  moviesThisYear: number;
  totalHours: number;
}

/** Headline numbers from /v1/watching/stats. */
export function shapeWatchingStats(json: ApiWatchingStatsResponse): WatchingStats {
  if (!json.data) {
    throw new Error('watching stats response has no data object');
  }
  return {
    totalMovies: json.data.total_movies,
    moviesThisYear: json.data.movies_this_year,
    totalHours: json.data.total_watch_time_hours,
  };
}

export interface CountedName {
  name: string;
  count: number;
}

export interface PlacesStats {
  total: number;
  uniqueVenues: number;
  thisYear: number;
  topCategories: CountedName[];
  topCities: CountedName[];
}

/**
 * Headline numbers and top lists from /v1/places/stats. The payload is a
 * top-level object (no `data` wrapper); list items key their label as
 * `category` / `city` rather than `name`.
 */
export function shapePlacesStats(json: ApiPlacesStatsResponse): PlacesStats {
  if (
    typeof json.total !== 'number' ||
    typeof json.unique_venues !== 'number' ||
    typeof json.this_year !== 'number'
  ) {
    throw new Error('places stats response is missing total/unique_venues/this_year');
  }
  if (!Array.isArray(json.top_categories) || !Array.isArray(json.top_cities)) {
    throw new Error('places stats response is missing top_categories/top_cities');
  }
  return {
    total: json.total,
    uniqueVenues: json.unique_venues,
    thisYear: json.this_year,
    topCategories: json.top_categories.map((c) => {
      if (!c.category) throw new Error('places stats category entry missing label');
      return { name: c.category, count: c.count };
    }),
    topCities: json.top_cities.map((c) => {
      if (!c.city) throw new Error('places stats city entry missing label');
      return { name: c.city, count: c.count };
    }),
  };
}

export interface RecentCheckin {
  venueName: string;
  category: string;
  place: string;
  date: string;
  shout: string | null;
}

/** Narrow a /v1/places/recent response to the fields the page renders. */
export function shapeRecentCheckins(json: ApiRecentCheckinsResponse): RecentCheckin[] {
  if (!Array.isArray(json.data)) {
    throw new Error('places recent response has no data array');
  }
  return json.data.map((entry) => ({
    venueName: entry.venue_name,
    category: entry.venue_category,
    place: [entry.venue_city, entry.venue_country].filter(Boolean).join(', '),
    date: fmtDate(entry.checked_in_at),
    shout: entry.shout,
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

export interface TrendPoint {
  label: string; // short month name, "Jan".."Dec"
  value: number;
}

/**
 * Monthly points for the year chart from a trends response (the /v1 listening,
 * watching, and places trends endpoints share this shape). Normalizes
 * the `value` (listening) and `count` (watching, places) keys and zero-fills
 * every month of `year` — Jan..Dec for past years, Jan..the current UTC month
 * for the current year, nothing for years that have not started.
 */
export function shapeTrends(json: ApiTrendsResponse, year: number, now: Date): TrendPoint[] {
  if (!Array.isArray(json.data)) {
    throw new Error('trends response has no data array');
  }
  const lastMonth =
    year < now.getUTCFullYear() ? 11 : year > now.getUTCFullYear() ? -1 : now.getUTCMonth();

  const byMonth = new Map<number, number>();
  for (const bucket of json.data) {
    const month = Number(bucket.period.slice(5, 7)) - 1;
    if (month >= 0 && month <= 11) {
      byMonth.set(month, bucket.value ?? bucket.count ?? 0);
    }
  }

  const points: TrendPoint[] = [];
  for (let m = 0; m <= lastMonth; m++) {
    points.push({ label: MONTH_ABBREV[m], value: byMonth.get(m) ?? 0 });
  }
  return points;
}

/**
 * Chart summary for the BarChart aria-label, e.g. "Monthly plays, peak May
 * 835". Falls back to "no data" when every point is zero.
 */
export function trendsAriaLabel(points: TrendPoint[], noun: string): string {
  let peak: TrendPoint | null = null;
  for (const p of points) {
    if (p.value > 0 && (!peak || p.value > peak.value)) peak = p;
  }
  if (!peak) return `Monthly ${noun}, no data`;
  const fullMonth = MONTH_NAMES[MONTH_ABBREV.indexOf(peak.label)] ?? peak.label;
  return `Monthly ${noun}, peak ${fullMonth} ${peak.value.toLocaleString('en-US')}`;
}

// The API allows 60 requests per key per sliding 60s window. The year pages
// make ~75 calls per build, so pace requests client-side: track recent send
// times and wait for the window to open before exceeding a safety margin.
const RATE_LIMIT = 50;
const RATE_WINDOW_MS = 61_000;
const sentAt: number[] = [];

async function waitForRateWindow(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (sentAt.length > 0 && now - sentAt[0] >= RATE_WINDOW_MS) sentAt.shift();
    if (sentAt.length < RATE_LIMIT) {
      sentAt.push(now);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, RATE_WINDOW_MS - (now - sentAt[0]) + 100));
  }
}

// Build-time memo: /listening/ and /listening/{currentYear}/ render the same
// data, so identical GETs are deduped for the life of the build process.
const fetchCache = new Map<string, Promise<unknown>>();

/** Build-time fetch: throws on a missing key or any non-200, naming the path. */
export function rewindFetch<T = unknown>(path: string): Promise<T> {
  const cached = fetchCache.get(path);
  if (cached) return cached as Promise<T>;

  const request = (async () => {
    const key = import.meta.env.REWIND_API_KEY;
    if (!key) {
      throw new Error(`REWIND_API_KEY is not set (needed for ${path})`);
    }
    await waitForRateWindow();
    const res = await fetch(`${REWIND_BASE}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      throw new Error(`Rewind API ${res.status} on ${path}`);
    }
    return res.json() as Promise<T>;
  })();

  // A failed request is not cached — a retry within the same build may succeed.
  fetchCache.set(
    path,
    request.catch((err) => {
      fetchCache.delete(path);
      throw err;
    })
  );
  return fetchCache.get(path) as Promise<T>;
}
