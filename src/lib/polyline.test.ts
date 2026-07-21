import { describe, expect, it } from 'vitest';
import { decodePolyline, polylineToSvgPath } from './polyline';

// The canonical example from Google's polyline algorithm docs.
const CANONICAL = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
const CANONICAL_POINTS: [number, number][] = [
  [38.5, -120.2],
  [40.7, -120.95],
  [43.252, -126.453],
];

/** Every "x,y" pair in an "M x,y L x,y ..." path string, as numbers. */
function pathCoords(path: string): [number, number][] {
  const pairs = path.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) ?? [];
  return pairs.map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return [x, y];
  });
}

describe('decodePolyline', () => {
  it('decodes the canonical Google example', () => {
    const points = decodePolyline(CANONICAL);
    expect(points).toHaveLength(3);
    points.forEach(([lat, lng], i) => {
      expect(lat).toBeCloseTo(CANONICAL_POINTS[i][0], 5);
      expect(lng).toBeCloseTo(CANONICAL_POINTS[i][1], 5);
    });
  });

  it('decodes an empty string to no points', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('decodes a single point', () => {
    // "_p~iF~ps|U" is the first point of the canonical example alone.
    const points = decodePolyline('_p~iF~ps|U');
    expect(points).toHaveLength(1);
    expect(points[0][0]).toBeCloseTo(38.5, 5);
    expect(points[0][1]).toBeCloseTo(-120.2, 5);
  });
});

describe('polylineToSvgPath', () => {
  it('returns null for fewer than two points', () => {
    expect(polylineToSvgPath([])).toBeNull();
    expect(polylineToSvgPath([[38.5, -120.2]])).toBeNull();
  });

  it('returns null when every point is identical', () => {
    expect(
      polylineToSvgPath([
        [38.5, -120.2],
        [38.5, -120.2],
        [38.5, -120.2],
      ])
    ).toBeNull();
  });

  it('produces an M/L path whose coordinates stay inside the padded box', () => {
    const path = polylineToSvgPath(decodePolyline(CANONICAL));
    expect(path).toMatch(/^M -?\d+(\.\d)?,-?\d+(\.\d)?( L -?\d+(\.\d)?,-?\d+(\.\d)?)+$/);
    const coords = pathCoords(path!);
    expect(coords.length).toBeGreaterThanOrEqual(2);
    for (const [x, y] of coords) {
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThanOrEqual(62);
      expect(y).toBeGreaterThanOrEqual(2);
      expect(y).toBeLessThanOrEqual(38);
    }
  });

  it('fills the padded box along the route’s long axis, preserving aspect', () => {
    // A tall skinny route: latitude span dwarfs longitude span, so the
    // y-extent should span the full padded height while x stays narrow.
    const path = polylineToSvgPath([
      [37.0, -122.0],
      [37.1, -122.001],
    ]);
    const coords = pathCoords(path!);
    const ys = coords.map(([, y]) => y);
    expect(Math.min(...ys)).toBeCloseTo(2, 0);
    expect(Math.max(...ys)).toBeCloseTo(38, 0);
    const xs = coords.map(([x]) => x);
    // Aspect preserved: the x spread must be far narrower than the box.
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(2);
  });

  it('flips latitude so north renders at the top', () => {
    const path = polylineToSvgPath([
      [37.0, -122.0], // south — should land near the bottom (large y)
      [37.1, -122.0], // north — should land near the top (small y)
    ]);
    const coords = pathCoords(path!);
    expect(coords[0][1]).toBeGreaterThan(coords[1][1]);
  });

  it('scales x by cos(midLat) so east-west distance is not exaggerated', () => {
    // At 60°N a degree of longitude is half a degree of latitude. Equal
    // degree spans must render with x-extent ≈ half the y-extent.
    const path = polylineToSvgPath([
      [60.0, 10.0],
      [60.5, 10.5],
    ]);
    const coords = pathCoords(path!);
    const xs = coords.map(([x]) => x);
    const ys = coords.map(([, y]) => y);
    const xSpan = Math.max(...xs) - Math.min(...xs);
    const ySpan = Math.max(...ys) - Math.min(...ys);
    expect(xSpan / ySpan).toBeCloseTo(Math.cos((60.25 * Math.PI) / 180), 1);
  });

  it('downsamples long routes to at most 80 points, keeping the endpoints', () => {
    const points: [number, number][] = [];
    for (let i = 0; i < 500; i++) {
      points.push([37 + i * 0.001, -122 + Math.sin(i / 20) * 0.01]);
    }
    const path = polylineToSvgPath(points);
    const coords = pathCoords(path!);
    expect(coords.length).toBeLessThanOrEqual(80);
    expect(coords.length).toBeGreaterThan(60);
    // Endpoints survive: first point is the south end (bottom), last the north.
    expect(coords[0][1]).toBeCloseTo(38, 0);
    expect(coords[coords.length - 1][1]).toBeCloseTo(2, 0);
  });

  it('rounds coordinates to one decimal place', () => {
    const path = polylineToSvgPath(decodePolyline(CANONICAL));
    for (const pair of path!.match(/-?\d+(?:\.\d+)?/g)!) {
      const decimals = pair.split('.')[1] ?? '';
      expect(decimals.length).toBeLessThanOrEqual(1);
    }
  });

  it('honors custom box dimensions', () => {
    const path = polylineToSvgPath(decodePolyline(CANONICAL), 100, 100, 10);
    const coords = pathCoords(path!);
    for (const [x, y] of coords) {
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(90);
      expect(y).toBeGreaterThanOrEqual(10);
      expect(y).toBeLessThanOrEqual(90);
    }
  });
});
