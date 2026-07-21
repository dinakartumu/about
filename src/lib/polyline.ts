/**
 * Google encoded polyline → tiny SVG route path, for the activity-row
 * thumbnails. Hand-implemented decoder (the algorithm is ~15 lines — not
 * worth a dependency) plus a projector that fits the route into a small
 * viewBox with aspect preserved.
 */

/**
 * Decode a Google encoded polyline (precision 1e-5) to [lat, lng] pairs.
 * Each coordinate is a delta from the previous one, zigzag-encoded in
 * base-64-ish 5-bit chunks offset by 63.
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
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
    points.push([lat * 1e-5, lng * 1e-5]);
  }
  return points;
}

/** Most points an emitted path keeps — plenty for a 64x40 thumbnail. */
const MAX_PATH_POINTS = 80;

/** Round to one decimal — sub-0.05px precision is dead weight in the HTML. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Project [lat, lng] points into a width x height box as an SVG path string
 * ("M x,y L x,y ..."). Equirectangular projection with a cos(midLat) x-scale
 * so east-west distances aren't exaggerated at high latitudes; the route is
 * scaled to fit inside the padding preserving aspect, centered on both axes,
 * and downsampled to at most 80 points. Returns null when there's nothing to
 * draw: fewer than two points, or zero geographic extent.
 */
export function polylineToSvgPath(
  points: [number, number][],
  width = 64,
  height = 40,
  padding = 2
): string | null {
  if (points.length < 2) return null;

  // Downsample evenly, always keeping the first and last point.
  let sampled = points;
  if (points.length > MAX_PATH_POINTS) {
    const step = (points.length - 1) / (MAX_PATH_POINTS - 1);
    sampled = [];
    for (let i = 0; i < MAX_PATH_POINTS; i++) {
      sampled.push(points[Math.round(i * step)]);
    }
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lat] of sampled) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const xScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  // x east, y south (SVG y grows downward, latitude grows upward).
  const projected = sampled.map(([lat, lng]): [number, number] => [lng * xScale, -lat]);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of projected) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX === 0 && spanY === 0) return null;

  const innerW = width - 2 * padding;
  const innerH = height - 2 * padding;
  const scale = Math.min(
    spanX > 0 ? innerW / spanX : Infinity,
    spanY > 0 ? innerH / spanY : Infinity
  );
  const offsetX = padding + (innerW - spanX * scale) / 2;
  const offsetY = padding + (innerH - spanY * scale) / 2;

  const coords = projected.map(
    ([x, y]) => `${round1((x - minX) * scale + offsetX)},${round1((y - minY) * scale + offsetY)}`
  );
  return `M ${coords[0]} L ${coords.slice(1).join(' L ')}`;
}
