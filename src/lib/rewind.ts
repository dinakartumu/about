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
  icon?: string | null; // Foursquare category glyph on top_categories entries
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
  venue_icon?: string | null; // 64px gray-on-transparent Foursquare PNG
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

/**
 * Earliest listening year page. The Last.fm account was registered 2016-08
 * but has no 2016 scrobbles, so the pages start at 2017 — bump this back
 * if backfilled 2016 data ever appears.
 */
export const LISTENING_FIRST_YEAR = 2017;

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

export interface CountedCategory extends CountedName {
  icon: string | null;
}

export interface PlacesStats {
  total: number;
  uniqueVenues: number;
  thisYear: number;
  topCategories: CountedCategory[];
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
      return { name: c.category, count: c.count, icon: c.icon ?? null };
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
  icon: string | null;
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
    icon: entry.venue_icon ?? null,
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
 * the `value` (listening) and `count` (watching, places) keys, ignores
 * buckets outside `year` (so a wide multi-year probe can be sliced per
 * year), and zero-fills every month of `year` — Jan..Dec for past years,
 * Jan..the current UTC month for the current year, nothing for years that
 * have not started.
 */
export function shapeTrends(json: ApiTrendsResponse, year: number, now: Date): TrendPoint[] {
  if (!Array.isArray(json.data)) {
    throw new Error('trends response has no data array');
  }
  const lastMonth =
    year < now.getUTCFullYear() ? 11 : year > now.getUTCFullYear() ? -1 : now.getUTCMonth();

  const byMonth = new Map<number, number>();
  for (const bucket of json.data) {
    if (Number(bucket.period.slice(0, 4)) !== year) continue;
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
 * Path of the wide trends probe for a domain: one request spanning 2000
 * through the current year. Built by a shared helper so getStaticPaths and
 * the page components produce the identical URL and hit the fetch memo.
 */
export function wideTrendsPath(domain: 'watching' | 'places', currentYear: number): string {
  const from = encodeURIComponent('2000-01-01T00:00:00Z');
  const to = encodeURIComponent(`${currentYear}-12-31T23:59:59Z`);
  return `/v1/${domain}/trends?from=${from}&to=${to}`;
}

/**
 * Earliest year present in a trends response. Used with a wide from/to probe
 * to find a domain's first year of history for the year navigation.
 */
export function trendsFirstYear(json: ApiTrendsResponse): number {
  if (!Array.isArray(json.data)) {
    throw new Error('trends response has no data array');
  }
  if (json.data.length === 0) {
    throw new Error('trends response is empty — cannot derive a first year');
  }
  return Math.min(...json.data.map((bucket) => Number(bucket.period.slice(0, 4))));
}

// /v1/watching/year/{year} rollup — only the fields we read. Its monthly
// buckets key the month "YYYY-MM" as `month` rather than `period`.
interface ApiWatchingYearResponse {
  year: number;
  total_movies?: number;
  monthly?: { month: string; count: number }[];
}

export interface WatchingYear {
  year: number;
  totalMovies: number;
  monthly: { period: string; count: number }[];
}

/**
 * Film count and monthly buckets from the /v1/watching/year/{year} rollup.
 * The buckets are normalized to the trends shape so shapeTrends can chart
 * them directly.
 */
export function shapeWatchingYear(json: ApiWatchingYearResponse): WatchingYear {
  if (typeof json.total_movies !== 'number') {
    throw new Error('watching year rollup has no total_movies field');
  }
  if (!Array.isArray(json.monthly)) {
    throw new Error('watching year rollup has no monthly array');
  }
  return {
    year: json.year,
    totalMovies: json.total_movies,
    monthly: json.monthly.map((m) => ({ period: m.month, count: m.count })),
  };
}

/** "3h 9m" / "45m" from a second count, minutes rounded. */
export function fmtDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Raw running API shapes — only the fields we read.
interface ApiRunningStatsResponse {
  data?: {
    total_runs: number;
    total_distance_mi: number;
    total_duration: string; // "68:18:44" (H:MM:SS) or "9:05" (M:SS)
    avg_pace: string | null;
  };
}

interface ApiRunningYearSummary {
  year: number;
  total_runs: number;
  total_distance_mi: number;
  total_duration_s: number;
  avg_pace: string | null;
}

interface ApiRunningYearsResponse {
  data?: ApiRunningYearSummary[];
}

interface ApiRunningYearRollup {
  year: number;
  monthly?: { month: string; runs: number }[];
}

interface ApiActivity {
  name: string;
  date: string;
  distance_mi: number;
  pace: string;
  strava_url: string | null;
}

interface ApiActivitiesResponse {
  data?: ApiActivity[];
}

export interface RunningStats {
  totalRuns: number;
  totalMiles: number;
  totalDurationS: number;
  avgPace: string | null;
}

/** Parse a "H:MM:SS" or "M:SS" duration string to seconds. */
function parseDuration(duration: string): number {
  const parts = duration.split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) {
    throw new Error(`unparseable running duration "${duration}"`);
  }
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Lifetime headline numbers from /v1/running/stats. */
export function shapeRunningStats(json: ApiRunningStatsResponse): RunningStats {
  if (!json.data) {
    throw new Error('running stats response has no data object');
  }
  return {
    totalRuns: json.data.total_runs,
    totalMiles: json.data.total_distance_mi,
    totalDurationS: parseDuration(json.data.total_duration),
    avgPace: json.data.avg_pace,
  };
}

export interface RunningYearSummary {
  year: number;
  totalRuns: number;
  totalMiles: number;
  totalDurationS: number;
  avgPace: string | null;
}

/**
 * Per-year summaries from /v1/running/stats/years. Years without runs are
 * absent from the list — a year page missing here renders its empty state.
 */
export function shapeRunningYears(json: ApiRunningYearsResponse): RunningYearSummary[] {
  if (!Array.isArray(json.data)) {
    throw new Error('running years response has no data array');
  }
  return json.data.map((y) => ({
    year: y.year,
    totalRuns: y.total_runs,
    totalMiles: y.total_distance_mi,
    totalDurationS: y.total_duration_s,
    avgPace: y.avg_pace,
  }));
}

/**
 * Monthly run-count points from the /v1/running/year/{year} rollup, via
 * shapeTrends for the same zero-filling as every other chart.
 */
export function runningMonthlyPoints(
  json: ApiRunningYearRollup,
  year: number,
  now: Date
): TrendPoint[] {
  if (!Array.isArray(json.monthly)) {
    throw new Error('running year rollup has no monthly array');
  }
  return shapeTrends(
    { data: json.monthly.map((m) => ({ period: m.month, count: m.runs })) },
    year,
    now
  );
}

export interface RunActivity {
  name: string;
  date: string;
  distanceMi: number;
  pace: string;
  stravaUrl: string | null;
}

/** Narrow a /v1/running/activities response to the fields the page renders. */
export function shapeActivities(json: ApiActivitiesResponse): RunActivity[] {
  if (!Array.isArray(json.data)) {
    throw new Error('running activities response has no data array');
  }
  return json.data.map((a) => ({
    name: a.name,
    date: fmtDate(a.date),
    distanceMi: a.distance_mi,
    pace: a.pace,
    stravaUrl: a.strava_url,
  }));
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

// The API allows 60 requests per key per sliding 60s window. Builds make on
// the order of 100-200 API calls (and the count grows with each new year
// page), so pace requests client-side: track recent send times and wait for
// the window to open before exceeding a safety margin. The 50-per-61s budget
// stays under the key's 60 rpm limit.
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
