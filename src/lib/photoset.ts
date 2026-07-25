/** Just enough of a photo for the year label; real photos carry id/width/height. */
export interface Dated {
  exif?: { taken?: string } | undefined;
}

/** En dash, the conventional separator for a range of years. */
const RANGE = '–';

/**
 * The year (or span of years) a photoset was shot, for display on its card.
 *
 * The manifest's own `date` is a single day — the latest capture — because it
 * exists to sort sets against each other. That makes it a poor label for a set
 * gathered over more than one year: Berkeley runs Mar 2022 to May 2023 but
 * would read simply "2023".
 *
 * So read the span off the photos themselves and fall back to `date` only when
 * no photo carries a capture time.
 */
export function yearLabel(photos: Dated[], date: string): string {
  const years = photos
    .map((p) => p.exif?.taken)
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.slice(0, 4))
    .filter((y) => /^\d{4}$/.test(y))
    .sort();

  if (!years.length) return date.slice(0, 4);

  const first = years[0];
  const last = years[years.length - 1];
  return first === last ? first : `${first}${RANGE}${last}`;
}
