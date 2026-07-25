import { describe, expect, it } from 'vitest';
import { yearLabel } from './photoset';

const shot = (taken: string) => ({ exif: { taken } });

describe('yearLabel', () => {
  it('returns a single year when every photo was shot in it', () => {
    expect(yearLabel([shot('2023-03-28T10:17:28.000Z'), shot('2023-03-30T07:32:16.000Z')], '2023-03-30')).toBe('2023');
  });

  it('returns a span when the set crosses a year boundary', () => {
    // Berkeley: Mar 2022 through May 2023.
    expect(yearLabel([shot('2022-03-06T01:00:00.000Z'), shot('2023-05-07T01:00:00.000Z')], '2023-05-07')).toBe('2022–2023');
  });

  it('uses the earliest and latest year, not the first and last photo', () => {
    const outOfOrder = [shot('2023-01-01T00:00:00.000Z'), shot('2021-06-01T00:00:00.000Z'), shot('2022-06-01T00:00:00.000Z')];
    expect(yearLabel(outOfOrder, '2023-01-01')).toBe('2021–2023');
  });

  it('ignores photos with no capture time', () => {
    expect(yearLabel([shot('2023-04-01T00:00:00.000Z'), {}, { exif: undefined }], '2023-04-01')).toBe('2023');
  });

  it('still finds the span when only some photos carry a capture time', () => {
    expect(yearLabel([shot('2022-04-01T00:00:00.000Z'), {}, shot('2023-04-01T00:00:00.000Z')], '2023-04-01')).toBe('2022–2023');
  });

  it("falls back to the manifest date when no photo has a capture time", () => {
    expect(yearLabel([{}, { exif: {} }], '2019-08-01')).toBe('2019');
  });

  it('falls back to the manifest date for an empty set', () => {
    expect(yearLabel([], '2020-01-01')).toBe('2020');
  });

  it('skips malformed capture times rather than rendering them', () => {
    expect(yearLabel([shot('not-a-date'), shot('2024-02-02T00:00:00.000Z')], '2024-02-02')).toBe('2024');
  });

  it('separates a span with an en dash, not a hyphen', () => {
    const label = yearLabel([shot('2022-01-01T00:00:00.000Z'), shot('2023-01-01T00:00:00.000Z')], '2023-01-01');
    expect(label).toContain('–');
    expect(label).not.toContain('-');
  });
});
