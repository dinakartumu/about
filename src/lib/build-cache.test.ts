import { describe, expect, it } from 'vitest';
import { closedYearFor } from './build-cache';

// 2026 is "now" for every case below.
const NOW = 2026;

describe('closedYearFor', () => {
  it('caches a from/to window inside a past year', () => {
    const path =
      '/v1/listening/top/albums?from=2015-03-01T00%3A00%3A00.000Z&to=2015-03-31T23%3A59%3A59.999Z&limit=12';
    expect(closedYearFor(path, NOW)).toBe(2015);
  });

  it('does not cache the current year', () => {
    const path =
      '/v1/listening/top/albums?from=2026-03-01T00%3A00%3A00.000Z&to=2026-03-31T23%3A59%3A59.999Z';
    expect(closedYearFor(path, NOW)).toBeNull();
  });

  it('does not cache a window spanning two years', () => {
    const path =
      '/v1/places/trends?from=2015-01-01T00%3A00%3A00.000Z&to=2016-12-31T23%3A59%3A59.999Z';
    expect(closedYearFor(path, NOW)).toBeNull();
  });

  // The wide trends probe drives year navigation and always reaches "now", so
  // caching it would freeze the year list at whatever year it was warmed in.
  it('does not cache a window ending in the current year', () => {
    const path =
      '/v1/places/trends?from=2013-01-01T00%3A00%3A00.000Z&to=2026-12-31T23%3A59%3A59.999Z';
    expect(closedYearFor(path, NOW)).toBeNull();
  });

  it('caches a /year/{yyyy} path for a past year', () => {
    expect(closedYearFor('/v1/listening/year/2015', NOW)).toBe(2015);
  });

  it('does not cache /year/{yyyy} for the current year', () => {
    expect(closedYearFor('/v1/listening/year/2026', NOW)).toBeNull();
  });

  // No window and no year segment means it spans everything, including data
  // still being written today.
  it('does not cache a windowless path', () => {
    expect(closedYearFor('/v1/listening/genres', NOW)).toBeNull();
  });

  it('handles unencoded timestamps', () => {
    const path = '/v1/places/stats?from=2014-01-01T00:00:00.000Z&to=2014-12-31T23:59:59.999Z';
    expect(closedYearFor(path, NOW)).toBe(2014);
  });

  it('rejects a malformed from value rather than guessing a year', () => {
    expect(closedYearFor('/v1/listening/trends?from=nonsense&to=alsobad', NOW)).toBeNull();
  });

  it('keeps distinct months of the same year on one shard', () => {
    const jan = '/v1/places/stats?from=2015-01-01T00:00:00.000Z&to=2015-01-31T23:59:59.999Z';
    const feb = '/v1/places/stats?from=2015-02-01T00:00:00.000Z&to=2015-02-28T23:59:59.999Z';
    expect(closedYearFor(jan, NOW)).toBe(closedYearFor(feb, NOW));
  });
});
