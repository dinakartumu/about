import { describe, it, expect } from 'vitest';
import { mergeManifest } from './manifest.mjs';

const photo = (id, taken, extra = {}) => ({
  id,
  width: 6000,
  height: 4000,
  exif: { taken },
  ...extra,
});

describe('mergeManifest', () => {
  it('creates a new manifest sorted by capture time', () => {
    const scanned = [photo('la-mesa/b', '2026-05-02T10:00:00'), photo('la-mesa/a', '2026-05-01T10:00:00')];
    const m = mergeManifest(null, scanned);
    expect(m.photos.map((p) => p.id)).toEqual(['la-mesa/a', 'la-mesa/b']);
    expect(m.cover).toBe('la-mesa/a');
    expect(m.date).toBe('2026-05-02');
  });

  it('preserves existing order, metadata, and cover on re-import', () => {
    const existing = {
      title: 'La Mesa', slug: 'la-mesa', description: 'Spring', cover: 'la-mesa/b',
      date: '2026-05-02',
      photos: [photo('la-mesa/b', '2026-05-02T10:00:00'), photo('la-mesa/a', '2026-05-01T10:00:00')],
    };
    const scanned = [photo('la-mesa/a', '2026-05-01T10:00:00'), photo('la-mesa/b', '2026-05-02T10:00:00')];
    const m = mergeManifest(existing, scanned);
    expect(m.title).toBe('La Mesa');
    expect(m.description).toBe('Spring');
    expect(m.cover).toBe('la-mesa/b');
    expect(m.photos.map((p) => p.id)).toEqual(['la-mesa/b', 'la-mesa/a']);
  });

  it('appends new photos at the end, sorted by capture time', () => {
    const existing = {
      title: 'La Mesa', slug: 'la-mesa', description: '', cover: 'la-mesa/a', date: '2026-05-01',
      photos: [photo('la-mesa/a', '2026-05-01T10:00:00')],
    };
    const scanned = [
      photo('la-mesa/c', '2026-05-03T10:00:00'),
      photo('la-mesa/a', '2026-05-01T10:00:00'),
      photo('la-mesa/b', '2026-05-02T10:00:00'),
    ];
    const m = mergeManifest(existing, scanned);
    expect(m.photos.map((p) => p.id)).toEqual(['la-mesa/a', 'la-mesa/b', 'la-mesa/c']);
  });

  it('updates dimensions/exif of existing photos from the new scan', () => {
    const existing = {
      title: 'X', slug: 'x', description: '', cover: 'x/a', date: '2026-05-01',
      photos: [photo('x/a', '2026-05-01T10:00:00', { width: 100, height: 100 })],
    };
    const scanned = [photo('x/a', '2026-05-01T10:00:00')];
    const m = mergeManifest(existing, scanned);
    expect(m.photos[0].width).toBe(6000);
  });

  it('keeps photos missing from the scan unless prune is set', () => {
    const existing = {
      title: 'X', slug: 'x', description: '', cover: 'x/gone', date: '2026-05-01',
      photos: [photo('x/gone', '2026-05-01T10:00:00'), photo('x/kept', '2026-05-02T10:00:00')],
    };
    const scanned = [photo('x/kept', '2026-05-02T10:00:00')];
    expect(mergeManifest(existing, scanned).photos).toHaveLength(2);
    const pruned = mergeManifest(existing, scanned, { prune: true });
    expect(pruned.photos.map((p) => p.id)).toEqual(['x/kept']);
    expect(pruned.cover).toBe('x/kept'); // cover reset when pruned away
  });

  it('handles photos with no capture time (sorted last, by id)', () => {
    const scanned = [photo('x/b', undefined), photo('x/a', '2026-05-01T10:00:00')];
    const m = mergeManifest(null, scanned);
    expect(m.photos[0].id).toBe('x/a');
  });
});
