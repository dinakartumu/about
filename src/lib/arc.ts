/**
 * Arc timeline data, shaped like the Strava activities the walk maps run on.
 *
 * Strava only holds what was deliberately recorded, and some of the ground a
 * set was made on never was: Pondicherry was three days of walking with the
 * app closed. Arc recorded it anyway — it runs continuously — so the walks
 * exist, just in a different shape. This turns them into `WalkActivity`s so
 * the rest of the pipeline neither knows nor cares which app remembered.
 *
 * Two things Arc doesn't give us that Strava does. There is no city label, so
 * a set says where it was with a centre and a radius and everything outside is
 * dropped — without it, a window that spans months would sweep in walks from
 * every other city in it. And there is no route geometry: a trip is joined to
 * its GPS samples by id, which is why samples come in alongside the items.
 *
 * Only the modes moved under one's own power are converted. Arc logs cars,
 * buses and planes too, and a map of those would claim ground covered sitting
 * down — Strava was never able to make that claim, and neither should this.
 */
import type { LatLng, WalkActivity } from './walk-map';

/** Arc's activity numbers, for the modes worth drawing, in Strava's words. */
export const ARC_SPORTS: Record<number, string> = {
  2: 'Walk',
  3: 'Run',
  4: 'Ride',
};

/** Mean earth radius, km — the usual sphere, good to ~0.5% for our distances. */
const EARTH_KM = 6371;

/**
 * Shorter than this and it isn't a walk.
 *
 * Arc records continuously, so it cuts a thirty-metre shuffle between two
 * stops into its own walking item — something Strava, which only holds what
 * was deliberately started, never produced. They contribute nothing to the
 * mileage but they do stretch the frame: two such fragments, one 9 km out,
 * pushed Pondicherry's White Town into a corner of its own map.
 */
export const MIN_ARC_METRES = 100;

/** One Arc timeline item. A visit has no `trip`; a trip is what we can draw. */
export interface ArcItem {
  base: {
    id: string;
    startDate: string;
    endDate: string;
  };
  trip?: {
    /** What the mode was corrected to, when it was corrected at all. */
    confirmedActivityType?: number;
    /** What Arc thought it was. Used only when nothing was confirmed. */
    classifiedActivityType?: number;
    /** Metres, as Arc measured them along the route. */
    distance?: number;
  };
}

/** One GPS fix. Arc records these continuously; `timelineItemId` joins them. */
export interface ArcSample {
  timelineItemId?: string;
  date: string;
  latitude?: number;
  longitude?: number;
}

export interface ArcOptions {
  /** The city label to file these under, so `selectActivities` can match. */
  city: string;
  /** The state label, for a set that matches on region rather than town. */
  state?: string | null;
  /** Where the set was. Omit to keep every route, wherever it ran. */
  center?: LatLng;
  /** How far from `center` still counts as the same trip. */
  radiusKm?: number;
  /** Shortest route worth keeping, in metres. See `MIN_ARC_METRES`. */
  minMetres?: number;
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Google's encoded polyline, the inverse of `decodePolyline`.
 *
 * Arc stores routes as loose samples while Strava hands over an encoded line,
 * and the map draws the Strava shape — so encoding here is what lets one
 * renderer serve both.
 */
export function encodePolyline(points: LatLng[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = '';

  const chunk = (value: number): void => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>>= 5;
    }
    out += String.fromCharCode(v + 63);
  };

  for (const [lat, lng] of points) {
    const e5Lat = Math.round(lat * 1e5);
    const e5Lng = Math.round(lng * 1e5);
    chunk(e5Lat - lastLat);
    chunk(e5Lng - lastLng);
    lastLat = e5Lat;
    lastLng = e5Lng;
  }
  return out;
}

/** Metres along a route, for the trips Arc left without a distance. */
function routeMetres(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]) * 1000;
  return total;
}

/** The mean of a route's points — what the radius test is made against. */
function centroid(points: LatLng[]): LatLng {
  const lat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return [lat, lng];
}

/**
 * Arc items and their samples, as activities the walk maps can select and draw.
 */
export function arcActivities(
  items: ArcItem[],
  samples: ArcSample[],
  { city, state = null, center, radiusKm, minMetres = MIN_ARC_METRES }: ArcOptions
): WalkActivity[] {
  const routes = new Map<string, ArcSample[]>();
  for (const s of samples) {
    if (!s.timelineItemId || s.latitude === undefined || s.longitude === undefined) continue;
    const route = routes.get(s.timelineItemId);
    if (route) route.push(s);
    else routes.set(s.timelineItemId, [s]);
  }

  const activities: WalkActivity[] = [];
  for (const item of items) {
    const trip = item.trip;
    if (!trip) continue;
    const sport = ARC_SPORTS[trip.confirmedActivityType ?? trip.classifiedActivityType ?? -1];
    if (!sport) continue;

    const route = routes.get(item.base.id);
    if (!route || route.length < 2) continue;
    // Samples arrive in file order, which is not always time order.
    const points: LatLng[] = [...route]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => [s.latitude as number, s.longitude as number]);

    if (center && radiusKm !== undefined && haversineKm(centroid(points), center) > radiusKm) {
      continue;
    }

    const metres = trip.distance ?? routeMetres(points);
    if (metres < minMetres) continue;

    activities.push({
      sport_type: sport,
      city,
      state,
      polyline: encodePolyline(points),
      distance_mi: metres / 1609.34,
      date: item.base.startDate,
    });
  }
  return activities;
}
