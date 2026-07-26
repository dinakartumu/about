import { describe, expect, it } from 'vitest';
import { isoWeekKey, monthKey, windowKeys } from './arc-source.mjs';

describe('isoWeekKey', () => {
  it('names the week the Pondicherry walks fall in', () => {
    // The backup files them under 2024-W31 and 2024-W32.
    expect(isoWeekKey('2024-08-03T04:00:00Z')).toBe('2024-W31');
    expect(isoWeekKey('2024-08-05T04:00:00Z')).toBe('2024-W32');
  });

  it('gives late December to the next year when the week belongs to it', () => {
    // 2024-12-30 is a Monday, and its Thursday is in 2025.
    expect(isoWeekKey('2024-12-30T00:00:00Z')).toBe('2025-W01');
    // 2013-12-27 is a Friday whose Thursday is still 2013 — Arc's first file.
    expect(isoWeekKey('2013-12-27T00:00:00Z')).toBe('2013-W52');
  });

  it('keeps a Sunday in the week it ends, not the one it precedes', () => {
    // Sunday 2024-08-04 closes W31; Monday the 5th opens W32.
    expect(isoWeekKey('2024-08-04T23:00:00Z')).toBe('2024-W31');
    expect(isoWeekKey('2024-08-05T01:00:00Z')).toBe('2024-W32');
  });
});

describe('monthKey', () => {
  it('names the calendar month', () => {
    expect(monthKey('2024-08-03T04:00:00Z')).toBe('2024-08');
  });
});

describe('windowKeys', () => {
  it('covers a short trip with both of its weeks', () => {
    const { months, weeks } = windowKeys('2024-08-03T02:42:34Z', '2024-08-05T02:36:39Z');
    expect(months).toEqual(['2024-08']);
    expect(weeks).toEqual(['2024-W31', '2024-W32']);
  });

  it('spans month and year boundaries', () => {
    const { months } = windowKeys('2022-11-28T00:00:00Z', '2023-01-03T00:00:00Z');
    expect(months).toEqual(['2022-11', '2022-12', '2023-01']);
  });

  it('reaches a day either side, for a walk that straddles midnight UTC', () => {
    const { months } = windowKeys('2024-08-01T00:30:00Z', '2024-08-01T23:30:00Z');
    expect(months).toEqual(['2024-07', '2024-08']);
  });

  it('handles a window that starts and ends in the same hour', () => {
    const { weeks } = windowKeys('2024-08-03T10:00:00Z', '2024-08-03T10:30:00Z');
    expect(weeks).toContain('2024-W31');
  });
});
