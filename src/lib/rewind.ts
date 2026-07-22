/**
 * Build-time data layer for the Rewind API (rewind.dinakartumu.com).
 *
 * The shapers narrow live API JSON down to exactly the fields the pages
 * render; `rewindFetch` is the only function that touches the network and
 * runs solely in Astro frontmatter at build time.
 */

import { decodePolyline, polylineToSvgPath } from './polyline';

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

interface ApiTopVenue {
  venue_name: string;
  count: number;
  icon?: string | null;
  city: string | null;
}

// /v1/places/stats returns its fields at the top level — no `data` wrapper.
// Accepts from/to query params; the top lists then cover only that range.
interface ApiPlacesStatsResponse {
  total?: number;
  unique_venues?: number;
  this_year?: number;
  top_categories?: ApiCountedName[];
  top_cities?: ApiCountedName[];
  top_venues?: ApiTopVenue[];
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

export interface TopVenue {
  name: string;
  city: string | null;
  count: number;
  icon: string | null;
}

export interface PlacesStats {
  total: number;
  uniqueVenues: number;
  thisYear: number;
  topCategories: CountedCategory[];
  topCities: CountedName[];
  topVenues: TopVenue[];
}

/**
 * Headline numbers and top lists from /v1/places/stats — optionally
 * year-scoped via from/to query params. The payload is a top-level object
 * (no `data` wrapper); list items key their label as `category` / `city` /
 * `venue_name` rather than `name`.
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
  if (!Array.isArray(json.top_venues)) {
    throw new Error('places stats response is missing top_venues');
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
    topVenues: json.top_venues.map((v) => {
      if (!v.venue_name) throw new Error('places stats venue entry missing label');
      return { name: v.venue_name, city: v.city ?? null, count: v.count, icon: v.icon ?? null };
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
    total_activities?: number; // every sport, not just runs
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
  sport_type: string; // Strava sport, e.g. "Run", "TrailRun", "Ride", "Walk"
  date: string;
  distance_mi: number;
  duration_s: number;
  pace: string;
  calories: number | null;
  city?: string | null; // reverse-geocoded from the route start
  state?: string | null;
  polyline?: string | null; // Google encoded route; null for gym sessions
  strava_url: string | null;
}

interface ApiActivitiesResponse {
  data?: ApiActivity[];
}

export interface RunningStats {
  totalRuns: number;
  totalActivities: number;
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
  if (typeof json.data.total_activities !== 'number') {
    throw new Error('running stats response has no total_activities field');
  }
  return {
    totalRuns: json.data.total_runs,
    totalActivities: json.data.total_activities,
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
  durationS: number;
  pace: string;
  calories: number | null;
  sport: string; // display label, e.g. "Ride", "Trail Run"
  isRun: boolean; // pace is only meaningful for run-type sports
  place: string | null; // "City, State" — whichever parts exist
  routePath: string | null; // 64x40 SVG path of the GPS route, null without one
  stravaUrl: string | null;
}

/** Strava sport types where a min/mi pace is the natural figure. */
const RUN_SPORTS = new Set(['Run', 'TrailRun', 'VirtualRun']);

/** "TrailRun" → "Trail Run": space out Strava's camel-cased sport types. */
function sportLabel(sportType: string): string {
  return sportType.replace(/([a-z])([A-Z])/g, '$1 $2');
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
    durationS: a.duration_s,
    pace: a.pace,
    calories: a.calories,
    sport: sportLabel(a.sport_type),
    isRun: RUN_SPORTS.has(a.sport_type),
    place: [a.city, a.state].filter(Boolean).join(', ') || null,
    routePath: a.polyline ? polylineToSvgPath(decodePolyline(a.polyline)) : null,
    stravaUrl: a.strava_url,
  }));
}

// Below this a distance is display noise — gym sessions sometimes log a few
// GPS yards, and "Weight Training · 0 mi" reads like a bug.
const MIN_DISPLAY_MI = 0.05;

/**
 * "45 min" under an hour, "1h 7m" past it, "20s" under a minute (a stray
 * 20-second workout would otherwise read "0 min") — a stationary activity's
 * figure.
 */
function fmtStationaryDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes === 0) return `${Math.round(seconds)}s`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
}

/**
 * The right-hand figures for an activity row. Distance sports show
 * "Sport · mi[ · pace]" (pace only for runs with a real pace); stationary
 * sports show "Sport · duration[ · cal]" — e.g. "Weight Training · 45 min
 * · 320 cal" — since "0 mi" carries no information.
 */
export function activityFigures(a: RunActivity): string {
  if (a.distanceMi < MIN_DISPLAY_MI) {
    const parts = [a.sport, fmtStationaryDuration(a.durationS)];
    if (a.calories !== null && a.calories > 0) parts.push(`${Math.round(a.calories)} cal`);
    return parts.join(' · ');
  }
  const parts = [a.sport, `${a.distanceMi} mi`];
  if (a.isRun && a.pace !== '0:00/mi') parts.push(a.pace);
  return parts.join(' · ');
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

// --- Listening chart + sparkline helpers -----------------------------------
// Pure transforms feeding the stacked monthly chart and per-artist sparklines.
// Kept here (not in the .astro component) so they're unit-tested.

/**
 * Blue ramp for the stacked monthly chart, lightest (rank 1) to darkest. Eight
 * shades (Tailwind blue-200..blue-900); artists past the eighth roll into a
 * single darker "Other" segment. Matches the reference listening chart.
 */
export const LISTENING_RAMP = [
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  '#1e3a8a',
] as const;

/** Darker-than-the-ramp fill for the "Other" (long-tail) segment. */
export const LISTENING_OTHER_COLOR = '#1e3a5f';

export interface StackSegment {
  name: string;
  value: number;
  color: string;
}

export interface StackMonth {
  /** Short month name, "Jan".."Dec". */
  label: string;
  /** Total plays that month (0 → a "ghost" month with no data yet). */
  total: number;
  /** Top-artist segments (ramp-colored) plus an optional trailing "Other". */
  segments: StackSegment[];
}

/**
 * Build the 12 stacked month rows from per-month GENRE counts. `monthlyGenres[m]`
 * is that month's genre→count map (0 = Jan .. 11 = Dec; undefined for months
 * with no data); `monthlyTotals[m]` is the month's actual play total.
 *
 * The BAR LENGTH is the play total (so bars are comparable to real scrobble
 * counts), stacked by that month's top `LISTENING_RAMP.length` genres (colored
 * by rank). The trailing "Other" segment fills the gap up to the play total —
 * folding in genres past the ramp, the API's own "Other" bucket, and any plays
 * with no genre tag at all (which is why a month's tagged genres can sum to far
 * less than its plays).
 */
export function buildGenreStacks(
  monthlyGenres: (Record<string, number> | undefined)[],
  monthlyTotals: number[]
): StackMonth[] {
  const topN = LISTENING_RAMP.length;
  const out: StackMonth[] = [];
  for (let m = 0; m < 12; m++) {
    const genres = monthlyGenres[m] ?? {};
    // Rank named genres by count; the API's own "Other" bucket is folded into
    // our trailing Other segment rather than competing for a ramp color.
    const named = Object.entries(genres)
      .filter(([name]) => name !== 'Other')
      .sort((a, b) => b[1] - a[1]);
    const top = named.slice(0, topN);
    const segments: StackSegment[] = top.map(([name, value], i) => ({
      name,
      value,
      color: LISTENING_RAMP[i],
    }));
    const topSum = top.reduce((sum, [, v]) => sum + v, 0);
    const genreSum = named.reduce((sum, [, v]) => sum + v, 0) + (genres['Other'] ?? 0);
    // Bar length is the play total; never clip below the shown genre segments.
    const total = Math.max(monthlyTotals[m] ?? 0, genreSum);
    const otherValue = total - topSum;
    if (otherValue > 0) {
      segments.push({ name: 'Other', value: otherValue, color: LISTENING_OTHER_COLOR });
    }
    out.push({ label: MONTH_ABBREV[m], total, segments });
  }
  return out;
}

/**
 * Per-artist monthly play series for sparklines. For each name, returns a
 * 12-length array (Jan..Dec) of that artist's plays, looked up from each
 * month's top-artist list (0 when the artist isn't in that month's list).
 */
export function buildArtistSparklines(
  monthlyArtists: (TopItem[] | undefined)[],
  names: string[]
): Record<string, number[]> {
  const series: Record<string, number[]> = {};
  for (const name of names) {
    const arr: number[] = [];
    for (let m = 0; m < 12; m++) {
      const found = (monthlyArtists[m] ?? []).find((a) => a.name === name);
      arr.push(found ? found.playcount : 0);
    }
    series[name] = arr;
  }
  return series;
}

/**
 * SVG path `d` for a smoothed sparkline over `values`, fit to a `w`×`h` box.
 * Quadratic segments through the points (higher value → higher on screen).
 * Flat/empty series render as a centered horizontal line.
 */
export function sparklinePath(values: number[], w = 96, h = 16, pad = 1): string {
  if (values.length === 0) return `M 0,${(h / 2).toFixed(2)} L ${w},${(h / 2).toFixed(2)}`;
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);
  const pts = values.map((v, i) => [x(i), y(v)] as const);
  let d = `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const mx = (px + cx) / 2;
    const my = (py + cy) / 2;
    d += ` Q ${px.toFixed(2)},${py.toFixed(2)} ${mx.toFixed(2)},${my.toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0].toFixed(2)},${last[1].toFixed(2)}`;
  return d;
}
