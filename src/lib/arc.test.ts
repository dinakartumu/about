import { describe, expect, it } from 'vitest';
import { decodePolyline } from './walk-map';
import {
  ARC_SPORTS,
  arcActivities,
  encodePolyline,
  haversineKm,
  type ArcItem,
  type ArcSample,
} from './arc';

/** A few metres apart, on Rue Suffren in Pondicherry's White Town. */
const WHITE_TOWN: [number, number][] = [
  [11.9342, 79.834],
  [11.9345, 79.8342],
  [11.9349, 79.8345],
];

const item = (over: Partial<ArcItem['base']> = {}, trip: Partial<ArcItem['trip']> = {}): ArcItem => ({
  base: {
    id: 'walk-1',
    startDate: '2024-08-04T03:05:00Z',
    endDate: '2024-08-04T03:47:00Z',
    ...over,
  },
  trip: { confirmedActivityType: 2, distance: 3200, ...trip },
});

const samples = (itemId: string, points = WHITE_TOWN): ArcSample[] =>
  points.map(([latitude, longitude], i) => ({
    timelineItemId: itemId,
    date: `2024-08-04T03:0${i}:00Z`,
    latitude,
    longitude,
  }));

const pondicherry = { city: 'Pondicherry', center: [11.9342, 79.834] as [number, number], radiusKm: 20 };

describe('encodePolyline', () => {
  it('round-trips through the decoder at 1e-5 precision', () => {
    const back = decodePolyline(encodePolyline(WHITE_TOWN));
    expect(back).toHaveLength(WHITE_TOWN.length);
    back.forEach(([lat, lng], i) => {
      expect(lat).toBeCloseTo(WHITE_TOWN[i][0], 5);
      expect(lng).toBeCloseTo(WHITE_TOWN[i][1], 5);
    });
  });

  it('handles negative and crossing-zero coordinates', () => {
    const line: [number, number][] = [
      [-37.8, -122.4],
      [0.0001, -0.0001],
      [37.8, 122.4],
    ];
    const back = decodePolyline(encodePolyline(line));
    back.forEach(([lat, lng], i) => {
      expect(lat).toBeCloseTo(line[i][0], 5);
      expect(lng).toBeCloseTo(line[i][1], 5);
    });
  });

  it('is empty for an empty route', () => {
    expect(encodePolyline([])).toBe('');
  });
});

describe('haversineKm', () => {
  it('measures a known separation', () => {
    // Pondicherry bus stand to the promenade, ~2 km apart.
    expect(haversineKm([11.9342, 79.834], [11.9416, 79.8083])).toBeCloseTo(2.9, 0);
  });

  it('is zero for the same point', () => {
    expect(haversineKm([11.9342, 79.834], [11.9342, 79.834])).toBe(0);
  });
});

describe('arcActivities', () => {
  it('turns a walking item and its samples into a walk-map activity', () => {
    const [a] = arcActivities([item()], samples('walk-1'), pondicherry);
    expect(a.sport_type).toBe('Walk');
    expect(a.city).toBe('Pondicherry');
    expect(a.date).toBe('2024-08-04T03:05:00Z');
    expect(a.distance_mi).toBeCloseTo(1.99, 2);
    expect(decodePolyline(a.polyline as string)).toHaveLength(3);
  });

  it('maps the sport types Arc records under its own numbers', () => {
    expect(ARC_SPORTS[2]).toBe('Walk');
    expect(ARC_SPORTS[3]).toBe('Run');
    expect(ARC_SPORTS[4]).toBe('Ride');
  });

  it('drops the modes nobody moved themselves under', () => {
    // 5 is car, 21 a bus. Strava never held these, and a map of them would
    // claim ground that was covered sitting down.
    const drives = [
      item({ id: 'car' }, { confirmedActivityType: 5 }),
      item({ id: 'bus' }, { confirmedActivityType: 21 }),
    ];
    expect(arcActivities(drives, [...samples('car'), ...samples('bus')], pondicherry)).toEqual([]);
  });

  it('falls back to the classified type when nothing was confirmed', () => {
    const guessed = item({ id: 'walk-2' }, { confirmedActivityType: undefined, classifiedActivityType: 2 });
    expect(arcActivities([guessed], samples('walk-2'), pondicherry)).toHaveLength(1);
  });

  it('drops activity outside the radius, however long it was', () => {
    // A Bengaluru walk in the same window: right sport, wrong place.
    const away = samples('walk-1', [
      [12.9716, 77.5946],
      [12.9718, 77.5949],
      [12.972, 77.5952],
    ]);
    expect(arcActivities([item()], away, pondicherry)).toEqual([]);
  });

  it('keeps everything when no centre is given', () => {
    const away = samples('walk-1', [
      [12.9716, 77.5946],
      [12.9718, 77.5949],
    ]);
    expect(arcActivities([item()], away, { city: 'Pondicherry' })).toHaveLength(1);
  });

  it('drops items with too little of a route to draw', () => {
    expect(arcActivities([item()], samples('walk-1', [WHITE_TOWN[0]]), pondicherry)).toEqual([]);
    expect(arcActivities([item()], [], pondicherry)).toEqual([]);
  });

  it('ignores visits, which have no trip at all', () => {
    const visit = { base: { id: 'visit', startDate: '2024-08-04T03:05:00Z', endDate: '2024-08-04T04:00:00Z' } };
    expect(arcActivities([visit as ArcItem], samples('visit'), pondicherry)).toEqual([]);
  });

  it('measures the route itself when Arc recorded no distance', () => {
    const measured = arcActivities([item({}, { distance: undefined })], samples('walk-1'), {
      ...pondicherry,
      minMetres: 0,
    });
    // The three White Town points span ~90 m.
    expect(measured[0].distance_mi).toBeGreaterThan(0);
    expect(measured[0].distance_mi).toBeLessThan(0.2);
  });

  it('drops the fragments Arc cuts out of standing still', () => {
    // Arc records continuously, so a shuffle between two stops becomes its own
    // walking item. Strava never held these, and they drag the frame out.
    const shuffle = item({ id: 'walk-1' }, { distance: 30 });
    expect(arcActivities([shuffle], samples('walk-1'), pondicherry)).toEqual([]);
    expect(arcActivities([shuffle], samples('walk-1'), { ...pondicherry, minMetres: 10 })).toHaveLength(1);
  });

  it('orders each route by time, whatever order the samples arrive in', () => {
    const shuffled = [...samples('walk-1')].reverse();
    const [a] = arcActivities([item()], shuffled, pondicherry);
    const [first] = decodePolyline(a.polyline as string);
    expect(first[0]).toBeCloseTo(WHITE_TOWN[0][0], 5);
  });

  it('skips samples that carry no fix', () => {
    const gappy = [
      ...samples('walk-1'),
      { timelineItemId: 'walk-1', date: '2024-08-04T03:09:00Z' } as ArcSample,
    ];
    expect(decodePolyline(arcActivities([item()], gappy, pondicherry)[0].polyline as string)).toHaveLength(3);
  });
});
