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
  selectActivities,
  simplify,
  tally,
  tripWindow,
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

describe('tripWindow', () => {
  it('widens to whole UTC days', () => {
    expect(tripWindow(['2025-05-27T13:38:18.000Z', '2025-06-04T04:54:11.000Z'])).toEqual({
      from: '2025-05-27T00:00:00.000Z',
      to: '2025-06-04T23:59:59.999Z',
    });
  });

  it('covers activity later on the last day than the final photo', () => {
    // Triund began 2025-06-04T07:05:42Z; the last frame was 04:54:11Z.
    const w = tripWindow(['2025-05-27T13:38:18.000Z', '2025-06-04T04:54:11.000Z']);
    expect('2025-06-04T07:05:42Z' >= w.from && '2025-06-04T07:05:42Z' <= w.to).toBe(true);
  });

  it('ignores order', () => {
    expect(tripWindow(['2025-06-04T00:00:00.000Z', '2025-05-27T00:00:00.000Z']).from)
      .toBe('2025-05-27T00:00:00.000Z');
  });

  it('handles a single day', () => {
    expect(tripWindow(['2025-06-04T12:00:00.000Z'])).toEqual({
      from: '2025-06-04T00:00:00.000Z',
      to: '2025-06-04T23:59:59.999Z',
    });
  });

  it('is null with nothing to go on', () => {
    expect(tripWindow([])).toBeNull();
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

describe('selectActivities', () => {
  const from = '2022-01-01T00:00:00Z';
  const to = '2022-12-31T23:59:59Z';
  const sel = (acts, match) => selectActivities(acts, match, from, to);

  it('keeps walks in the city and window by default', () => {
    expect(sel([walk()], { city: 'Berkeley' })).toHaveLength(1);
  });

  it('drops other sports unless asked for', () => {
    expect(sel([walk({ sport_type: 'Ride' })], { city: 'Berkeley' })).toEqual([]);
    expect(sel([walk({ sport_type: 'Ride' })], { city: 'Berkeley', sports: ['Ride'] })).toHaveLength(1);
  });

  it('takes every sport when asked for all', () => {
    const mixed = [walk(), walk({ sport_type: 'Ride' }), walk({ sport_type: 'Workout' })];
    expect(sel(mixed, { city: 'Berkeley', sports: 'all' })).toHaveLength(3);
  });

  it('matches on state when a trip roamed a region', () => {
    // Goa: activity spread across Mapusa, Calangute and Panjim.
    const goa = [
      walk({ city: 'Mapusa', state: 'Goa', sport_type: 'Ride' }),
      walk({ city: 'Calangute', state: 'Goa', sport_type: 'Ride' }),
      walk({ city: 'Panjim', state: 'Goa' }),
    ];
    expect(sel(goa, { state: 'Goa', sports: 'all' })).toHaveLength(3);
    expect(sel(goa, { city: 'Goa', sports: 'all' })).toEqual([]);
  });

  it('matches several cities when a city is labelled by neighbourhood', () => {
    // San Francisco: Strava files the same trip under Noe Valley, the Mission
    // and Parkside, and the state is all of California.
    const sf = [
      walk({ city: 'Noe Valley', state: 'California' }),
      walk({ city: 'Mission District', state: 'California' }),
      walk({ city: 'Parkside', state: 'California' }),
      walk({ city: 'Berkeley', state: 'California' }),
    ];
    expect(sel(sf, { city: ['Noe Valley', 'Mission District', 'Parkside'] })).toHaveLength(3);
  });

  it('matches nothing for an empty city list', () => {
    expect(sel([walk()], { city: [] })).toEqual([]);
  });

  it('matches nothing when given no place at all', () => {
    expect(sel([walk()], {})).toEqual([]);
  });

  it('drops other cities, including a null city', () => {
    expect(sel([walk({ city: 'Napa' })], { city: 'Berkeley' })).toEqual([]);
    expect(sel([walk({ city: null })], { city: 'Berkeley' })).toEqual([]);
  });

  it('drops activities outside the window', () => {
    expect(sel([walk({ date: '2021-06-01T00:00:00Z' })], { city: 'Berkeley' })).toEqual([]);
    expect(sel([walk({ date: '2023-06-01T00:00:00Z' })], { city: 'Berkeley' })).toEqual([]);
  });

  it('drops indoor activities with no route', () => {
    expect(sel([walk({ polyline: null })], { city: 'Berkeley' })).toEqual([]);
    expect(sel([walk({ polyline: '' })], { city: 'Berkeley' })).toEqual([]);
  });
});

describe('tally', () => {
  it('counts and sums per sport, largest first', () => {
    expect(tally([
      walk({ sport_type: 'Ride', distance_mi: 10 }),
      walk({ sport_type: 'Ride', distance_mi: 10 }),
      walk({ sport_type: 'Walk', distance_mi: 3 }),
    ])).toEqual([
      { sport: 'Ride', count: 2, miles: 20 },
      { sport: 'Walk', count: 1, miles: 3 },
    ]);
  });

  it('is empty for no activities', () => {
    expect(tally([])).toEqual([]);
  });
});

describe('buildWalkMap', () => {
  const opts = { city: 'Berkeley', from: '2022-01-01T00:00:00Z', to: '2022-12-31T23:59:59Z' };
  const ds = (m) => m.paths.map((p) => p.d);

  it('builds a map once both thresholds are met', () => {
    const map = buildWalkMap(enough(), opts);
    expect(map).not.toBeNull();
    expect(map.activities).toBe(MIN_WALKS);
    expect(map.paths).toHaveLength(MIN_WALKS);
    expect(map.miles).toBeGreaterThanOrEqual(MIN_MILES);
  });

  it('returns null below the activity count, however far those went', () => {
    expect(buildWalkMap(enough(MIN_WALKS - 1, { distance_mi: 50 }), opts)).toBeNull();
  });

  it('returns null below the mileage, however many activities', () => {
    expect(buildWalkMap(enough(20, { distance_mi: 0.1 }), opts)).toBeNull();
  });

  it('returns null when nothing matches at all', () => {
    expect(buildWalkMap([], opts)).toBeNull();
    expect(buildWalkMap(enough(), { ...opts, city: 'Nowhere' })).toBeNull();
  });

  it('marks a walking-only set both footOnly and walkOnly', () => {
    const map = buildWalkMap(enough(), opts);
    expect(map.footOnly).toBe(true);
    expect(map.walkOnly).toBe(true);
  });

  it('is footOnly but not walkOnly once hikes or runs are in', () => {
    const map = buildWalkMap([...enough(4), ...enough(4, { sport_type: 'Hike' })], opts);
    expect(map.footOnly).toBe(true);
    expect(map.walkOnly).toBe(false);
  });

  it('is neither once wheels are involved', () => {
    const mixed = [...enough(4), ...enough(4, { sport_type: 'Ride' })];
    const map = buildWalkMap(mixed, { ...opts, sports: 'all' });
    expect(map.footOnly).toBe(false);
    expect(map.walkOnly).toBe(false);
  });

  it('takes hikes and runs by default, not just walks', () => {
    const onFoot = [...enough(2), ...enough(2, { sport_type: 'Hike' }), ...enough(2, { sport_type: 'Run' })];
    expect(buildWalkMap(onFoot, opts).activities).toBe(6);
    // ...but still not rides.
    expect(buildWalkMap([...onFoot, walk({ sport_type: 'Ride' })], opts).activities).toBe(6);
  });

  it('tags each path with whether it was on foot', () => {
    const mixed = [...enough(4), ...enough(4, { sport_type: 'Ride' })];
    const map = buildWalkMap(mixed, { ...opts, sports: 'all' });
    expect(map.paths.filter((p) => p.foot)).toHaveLength(4);
    expect(map.paths.filter((p) => !p.foot)).toHaveLength(4);
  });

  it('breaks the total down by sport', () => {
    const mixed = [...enough(4, { distance_mi: 5 }), ...enough(6, { sport_type: 'Ride', distance_mi: 10 })];
    const map = buildWalkMap(mixed, { ...opts, sports: 'all' });
    expect(map.breakdown).toEqual([
      { sport: 'Ride', count: 6, miles: 60 },
      { sport: 'Walk', count: 4, miles: 20 },
    ]);
    expect(map.activities).toBe(10);
    expect(map.miles).toBe(80);
  });

  it('centres the frame on the routes', () => {
    const map = buildWalkMap(enough(), opts);
    const b = boundsOf([decodePolyline(BERKELEY_LINE)]);
    expect(map.center[0]).toBeCloseTo((b.minLat + b.maxLat) / 2, 6);
    expect(map.center[1]).toBeCloseTo((b.minLng + b.maxLng) / 2, 6);
  });

  it('keeps every projected point inside the image', () => {
    const map = buildWalkMap(enough(), opts);
    const coords = ds(map).join('').split(/[ML]/).filter(Boolean)
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
    for (const d of ds(buildWalkMap(enough(), opts))) expect(d.startsWith('M')).toBe(true);
  });

  it('rounds miles and counts only the matched activities', () => {
    const mixed = [...enough(6, { distance_mi: 2.4 }), walk({ city: 'Napa', distance_mi: 99 })];
    const map = buildWalkMap(mixed, opts);
    expect(map.activities).toBe(6);
    expect(map.miles).toBe(14); // 6 * 2.4 = 14.4
  });
});
