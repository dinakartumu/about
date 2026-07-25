import { describe, expect, it } from 'vitest';
import {
  MIN_MILES,
  MIN_WALKS,
  boundsOf,
  buildWalkMap,
  decodePolyline,
  fitZoom,
  mercatorX,
  mercatorY,
  monthsSpanned,
  selectWalks,
  simplify,
  type WalkActivity,
} from './walk-map';

/** A short encoded polyline near downtown Berkeley (~37.87, -122.27). */
const BERKELEY_LINE = '_c_gFdvfiVgAAAoBhAA';

const walk = (over: Partial<WalkActivity> = {}): WalkActivity => ({
  sport_type: 'Walk',
  city: 'Berkeley',
  polyline: BERKELEY_LINE,
  distance_mi: 4,
  date: '2022-06-01T10:00:00Z',
  ...over,
});

/** Enough walks to clear both thresholds. */
const enough = (n = MIN_WALKS, over: Partial<WalkActivity> = {}) =>
  Array.from({ length: n }, () => walk(over));

describe('mercator projection', () => {
  it('puts the antimeridian at 0 and the prime meridian at half the world', () => {
    expect(mercatorX(-180, 0)).toBeCloseTo(0, 6);
    expect(mercatorX(0, 0)).toBeCloseTo(256, 6); // 512px tile, so half is 256
    expect(mercatorX(180, 0)).toBeCloseTo(512, 6);
  });

  it('puts the equator at the vertical middle', () => {
    expect(mercatorY(0, 0)).toBeCloseTo(256, 6);
  });

  it('grows y downward as latitude falls', () => {
    expect(mercatorY(40, 10)).toBeLessThan(mercatorY(30, 10));
  });

  it('doubles scale per zoom level', () => {
    expect(mercatorX(10, 5) * 2).toBeCloseTo(mercatorX(10, 6), 6);
    expect(mercatorY(45, 5) * 2).toBeCloseTo(mercatorY(45, 6), 6);
  });
});

describe('decodePolyline', () => {
  it('round-trips a known Google example', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it('returns nothing for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('simplify', () => {
  it('collapses collinear points to the endpoints', () => {
    expect(simplify([[0, 0], [5, 0], [10, 0]], 0.5)).toEqual([[0, 0], [10, 0]]);
  });

  it('keeps a corner that exceeds the tolerance', () => {
    expect(simplify([[0, 0], [5, 9], [10, 0]], 0.5)).toHaveLength(3);
  });

  it('drops a wobble under the tolerance', () => {
    expect(simplify([[0, 0], [5, 0.2], [10, 0]], 1)).toEqual([[0, 0], [10, 0]]);
  });

  it('leaves short inputs and non-positive tolerances alone', () => {
    expect(simplify([[0, 0], [1, 1]], 5)).toEqual([[0, 0], [1, 1]]);
    const pts: [number, number][] = [[0, 0], [5, 0], [10, 0]];
    expect(simplify(pts, 0)).toEqual(pts);
  });
});

describe('boundsOf', () => {
  it('spans every route', () => {
    expect(boundsOf([[[1, 2], [3, 4]], [[-1, 10], [0, 0]]])).toEqual({
      minLat: -1, maxLat: 3, minLng: 0, maxLng: 10,
    });
  });

  it('returns null when there is nothing to bound', () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([[]])).toBeNull();
  });
});

describe('fitZoom', () => {
  const bounds = { minLat: 37.83, maxLat: 37.9, minLng: -122.29, maxLng: -122.23 };

  it('picks a zoom whose projected extent fits inside the padded box', () => {
    const z = fitZoom(bounds, 900, 780, 30);
    const w = mercatorX(bounds.maxLng, z) - mercatorX(bounds.minLng, z);
    const h = mercatorY(bounds.minLat, z) - mercatorY(bounds.maxLat, z);
    expect(w).toBeLessThanOrEqual(900 - 60);
    expect(h).toBeLessThanOrEqual(780 - 60);
  });

  it('picks the highest such zoom — a quarter step more would overflow', () => {
    const z = fitZoom(bounds, 900, 780, 30);
    const w = mercatorX(bounds.maxLng, z + 0.25) - mercatorX(bounds.minLng, z + 0.25);
    const h = mercatorY(bounds.minLat, z + 0.25) - mercatorY(bounds.maxLat, z + 0.25);
    expect(w > 900 - 60 || h > 780 - 60).toBe(true);
  });

  it('zooms out for a wider area', () => {
    const wide = { minLat: 30, maxLat: 45, minLng: -125, maxLng: -110 };
    expect(fitZoom(wide, 900, 780, 30)).toBeLessThan(fitZoom(bounds, 900, 780, 30));
  });
});

describe('monthsSpanned', () => {
  it('counts inclusively across a year boundary', () => {
    // Berkeley: 2022-03 through 2023-05.
    expect(monthsSpanned(['2022-03-06T00:00:00Z', '2023-05-07T00:00:00Z'])).toBe(15);
  });

  it('is 1 within a single month', () => {
    expect(monthsSpanned(['2022-03-01T00:00:00Z', '2022-03-28T00:00:00Z'])).toBe(1);
  });

  it('ignores order', () => {
    expect(monthsSpanned(['2023-01-01T00:00:00Z', '2022-11-01T00:00:00Z'])).toBe(3);
  });

  it('is 0 with no usable dates', () => {
    expect(monthsSpanned([])).toBe(0);
    expect(monthsSpanned(['not a date'])).toBe(0);
  });
});

describe('selectWalks', () => {
  const from = '2022-01-01T00:00:00Z';
  const to = '2022-12-31T23:59:59Z';

  it('keeps walks in the city and window', () => {
    expect(selectWalks([walk()], 'Berkeley', from, to)).toHaveLength(1);
  });

  it('drops other sports', () => {
    expect(selectWalks([walk({ sport_type: 'Run' })], 'Berkeley', from, to)).toEqual([]);
    expect(selectWalks([walk({ sport_type: 'Ride' })], 'Berkeley', from, to)).toEqual([]);
  });

  it('drops other cities, including a null city', () => {
    expect(selectWalks([walk({ city: 'Napa' })], 'Berkeley', from, to)).toEqual([]);
    expect(selectWalks([walk({ city: null })], 'Berkeley', from, to)).toEqual([]);
  });

  it('drops walks outside the window', () => {
    expect(selectWalks([walk({ date: '2021-06-01T00:00:00Z' })], 'Berkeley', from, to)).toEqual([]);
    expect(selectWalks([walk({ date: '2023-06-01T00:00:00Z' })], 'Berkeley', from, to)).toEqual([]);
  });

  it('drops indoor walks with no route', () => {
    expect(selectWalks([walk({ polyline: null })], 'Berkeley', from, to)).toEqual([]);
    expect(selectWalks([walk({ polyline: '' })], 'Berkeley', from, to)).toEqual([]);
  });
});

describe('buildWalkMap', () => {
  const opts = { city: 'Berkeley', from: '2022-01-01T00:00:00Z', to: '2022-12-31T23:59:59Z' };

  it('builds a map once both thresholds are met', () => {
    const map = buildWalkMap(enough(), opts);
    expect(map).not.toBeNull();
    expect(map!.walks).toBe(MIN_WALKS);
    expect(map!.paths).toHaveLength(MIN_WALKS);
    expect(map!.miles).toBeGreaterThanOrEqual(MIN_MILES);
  });

  it('returns null below the walk count, however far those walks went', () => {
    expect(buildWalkMap(enough(MIN_WALKS - 1, { distance_mi: 50 }), opts)).toBeNull();
  });

  it('returns null below the mileage, however many walks', () => {
    expect(buildWalkMap(enough(20, { distance_mi: 0.1 }), opts)).toBeNull();
  });

  it('returns null when nothing matches at all', () => {
    expect(buildWalkMap([], opts)).toBeNull();
    expect(buildWalkMap(enough(), { ...opts, city: 'Nowhere' })).toBeNull();
  });

  it('centres the frame on the routes', () => {
    const map = buildWalkMap(enough(), opts)!;
    const b = boundsOf([decodePolyline(BERKELEY_LINE)])!;
    expect(map.center[0]).toBeCloseTo((b.minLat + b.maxLat) / 2, 6);
    expect(map.center[1]).toBeCloseTo((b.minLng + b.maxLng) / 2, 6);
  });

  it('keeps every projected point inside the image', () => {
    const map = buildWalkMap(enough(), opts)!;
    const coords = map.paths
      .join('')
      .split(/[ML]/)
      .filter(Boolean)
      .map((pair) => pair.trim().split(' ').map(Number));
    expect(coords.length).toBeGreaterThan(0);
    for (const [x, y] of coords) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(map.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(map.height);
    }
  });

  it('emits paths that start with a moveto', () => {
    for (const d of buildWalkMap(enough(), opts)!.paths) expect(d.startsWith('M')).toBe(true);
  });

  it('rounds miles and counts only the matched walks', () => {
    const mixed = [...enough(6, { distance_mi: 2.4 }), walk({ city: 'Napa', distance_mi: 99 })];
    const map = buildWalkMap(mixed, opts)!;
    expect(map.walks).toBe(6);
    expect(map.miles).toBe(14); // 6 * 2.4 = 14.4
  });
});
