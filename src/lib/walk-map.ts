/**
 * Walk routes for a photoset, drawn over a Mapbox basemap.
 *
 * A photoset gathered on foot has a shape: the streets actually walked while
 * the photos were taken. Berkeley's 36 walks trace the flats' grid, the tangle
 * of hill roads and the campus — so the map is the ground those photos came
 * from, not decoration.
 *
 * The basemap is a Mapbox Static Images PNG, fetched once by
 * scripts/build-walk-maps.mjs and served from R2 like any photo. The routes are
 * SVG paths laid over it. Nothing here runs in the browser and no Mapbox token
 * reaches the client: the image is already ours by the time the page builds.
 *
 * Alignment depends on projecting exactly the way Mapbox does — Web Mercator
 * against 512px tiles, about an explicit center and zoom. Get that right and
 * the traces land on the street centrelines; get it subtly wrong and the whole
 * network sits skewed. Hence mercatorX/mercatorY being tested directly.
 */

/** Mapbox GL styles are 512px-tiled; zoom is defined against that, not 256. */
const TILE_SIZE = 512;

/** Strava sport types that count as walking. Runs and rides are another story. */
export const WALK_SPORTS = new Set(['Walk']);

/**
 * Below this a map is a lonely squiggle rather than a portrait of a place.
 * Mileage carries most of the judgement — Fremont has four walks totalling
 * under five miles and reads as noise, while Varanasi has four totalling
 * sixteen and is a real portrait of a compact old city. The walk count only
 * has to rule out a single line pretending to be a map.
 */
export const MIN_WALKS = 3;
export const MIN_MILES = 10;

/** Simplification tolerance in output pixels — visually lossless, ~3x smaller. */
export const SIMPLIFY_TOLERANCE = 0.5;

export type LatLng = [number, number];
export type Point = [number, number];

export interface WalkActivity {
  sport_type: string;
  city: string | null;
  /** Google encoded polyline; absent on indoor activities. */
  polyline: string | null;
  distance_mi: number;
  /** ISO 8601 start time. */
  date: string;
}

export interface WalkMap {
  /** Basemap centre, [lat, lng] — what the Static Images request was made at. */
  center: LatLng;
  zoom: number;
  width: number;
  height: number;
  /** One SVG path per walk, in the basemap's pixel space. */
  paths: string[];
  walks: number;
  miles: number;
  /** Calendar months touched, inclusive. */
  months: number;
}

/** Horizontal Web Mercator world pixel for a longitude at `zoom`. */
export function mercatorX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

/** Vertical Web Mercator world pixel for a latitude at `zoom`. */
export function mercatorY(lat: number, zoom: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE_SIZE * 2 ** zoom;
}

/**
 * Ramer-Douglas-Peucker. Drops points within `tolerance` of the line between
 * the survivors, so straight blocks collapse to two points while corners and
 * switchbacks keep their detail.
 */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3 || tolerance <= 0) return points;

  const first = points[0];
  const last = points[points.length - 1];

  // Squared perpendicular distance to the segment: comparisons only, so the
  // square roots would be wasted work.
  const distSq = (p: Point): number => {
    let [x, y] = first;
    const dx = last[0] - x;
    const dy = last[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) [x, y] = last;
      else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    return (p[0] - x) ** 2 + (p[1] - y) ** 2;
  };

  let worst = 0;
  let worstAt = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distSq(points[i]);
    if (d > worst) {
      worst = d;
      worstAt = i;
    }
  }

  if (worst <= tolerance * tolerance) return [first, last];
  return [
    ...simplify(points.slice(0, worstAt + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(worstAt), tolerance),
  ];
}

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function boundsOf(routes: LatLng[][]): Bounds | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const route of routes) {
    for (const [lat, lng] of route) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  return Number.isFinite(minLat) ? { minLat, maxLat, minLng, maxLng } : null;
}

/**
 * Highest zoom (quarter steps, as Mapbox accepts) at which `bounds` still fits
 * inside width x height less padding. Quarter steps rather than integers
 * because a whole zoom level doubles the scale — too coarse to frame well.
 */
export function fitZoom(bounds: Bounds, width: number, height: number, padding: number): number {
  for (let z = 20; z >= 1; z -= 0.25) {
    const w = mercatorX(bounds.maxLng, z) - mercatorX(bounds.minLng, z);
    const h = mercatorY(bounds.minLat, z) - mercatorY(bounds.maxLat, z);
    if (w <= width - padding * 2 && h <= height - padding * 2) return z;
  }
  return 1;
}

/** Calendar months spanned, inclusive: Mar 2022 through May 2023 is 15. */
export function monthsSpanned(dates: string[]): number {
  const stamps = dates
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .map((d) => d.getTime());
  if (!stamps.length) return 0;
  const first = new Date(Math.min(...stamps));
  const last = new Date(Math.max(...stamps));
  return (
    (last.getUTCFullYear() - first.getUTCFullYear()) * 12 +
    (last.getUTCMonth() - first.getUTCMonth()) +
    1
  );
}

/** Decode a Google encoded polyline (precision 1e-5) to [lat, lng] pairs. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const readDelta = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += readDelta();
    lng += readDelta();
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/** Walks belonging to a set: right sport, right city, inside the photos' span. */
export function selectWalks(
  activities: WalkActivity[],
  city: string,
  from: string,
  to: string
): WalkActivity[] {
  return activities.filter(
    (a) =>
      WALK_SPORTS.has(a.sport_type) &&
      a.city === city &&
      typeof a.polyline === 'string' &&
      a.polyline.length > 0 &&
      a.date >= from &&
      a.date <= to
  );
}

export interface BuildOptions {
  city: string;
  /** Inclusive ISO bounds — the span of the set's photos. */
  from: string;
  to: string;
  width?: number;
  height?: number;
  padding?: number;
  tolerance?: number;
}

/**
 * Select a set's walks and project them into a Mapbox frame, or return null
 * when there isn't enough walking to be worth drawing.
 */
export function buildWalkMap(
  activities: WalkActivity[],
  {
    city,
    from,
    to,
    width = 900,
    height = 780,
    padding = 30,
    tolerance = SIMPLIFY_TOLERANCE,
  }: BuildOptions
): WalkMap | null {
  const matched = selectWalks(activities, city, from, to);
  const miles = matched.reduce((sum, a) => sum + (a.distance_mi || 0), 0);
  if (matched.length < MIN_WALKS || miles < MIN_MILES) return null;

  const routes = matched
    .map((a) => decodePolyline(a.polyline as string))
    .filter((r) => r.length > 1);
  const bounds = boundsOf(routes);
  if (!bounds) return null;

  const zoom = fitZoom(bounds, width, height, padding);
  const center: LatLng = [
    (bounds.minLat + bounds.maxLat) / 2,
    (bounds.minLng + bounds.maxLng) / 2,
  ];
  const originX = mercatorX(center[1], zoom) - width / 2;
  const originY = mercatorY(center[0], zoom) - height / 2;
  const project = ([lat, lng]: LatLng): Point => [
    mercatorX(lng, zoom) - originX,
    mercatorY(lat, zoom) - originY,
  ];

  const paths = routes
    .map((route) => simplify(route.map(project), tolerance))
    .filter((route) => route.length > 1)
    .map((route) =>
      route.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')
    );
  if (!paths.length) return null;

  return {
    center,
    zoom,
    width,
    height,
    paths,
    walks: matched.length,
    miles: Math.round(miles),
    months: monthsSpanned(matched.map((a) => a.date)),
  };
}
