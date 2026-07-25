import { describe, expect, it } from 'vitest';
import { layOutSections, sectionId, toRows } from './photo-layout';

const portrait = (n: number) => ({ id: `p${n}`, width: 100, height: 200 });
const landscape = (n: number) => ({ id: `l${n}`, width: 200, height: 100 });

/** Flatten a row list to "id@globalIndex" pairs, one string per row. */
const shape = <P extends { id: string }>(rows: { photos: { photo: P; index: number }[] }[]) =>
  rows.map((r) => r.photos.map((p) => `${p.photo.id}@${p.index}`).join('+'));

describe('sectionId', () => {
  it('slugifies a title', () => {
    expect(sectionId('Little free libraries')).toBe('little-free-libraries');
  });

  it('collapses punctuation and trims stray dashes', () => {
    expect(sectionId('Alley steps & hill paths')).toBe('alley-steps-hill-paths');
    expect(sectionId('  Sunsets!  ')).toBe('sunsets');
  });
});

describe('toRows', () => {
  it('pairs adjacent portraits', () => {
    expect(shape(toRows([portrait(1), portrait(2)]))).toEqual(['p1@0+p2@1']);
  });

  it('leaves landscapes alone', () => {
    expect(shape(toRows([landscape(1), landscape(2)]))).toEqual(['l1@0', 'l2@1']);
  });

  it('does not pair a portrait with a following landscape', () => {
    expect(shape(toRows([portrait(1), landscape(1)]))).toEqual(['p1@0', 'l1@1']);
  });

  it('leaves an odd trailing portrait on its own row', () => {
    expect(shape(toRows([portrait(1), portrait(2), portrait(3)]))).toEqual(['p1@0+p2@1', 'p3@2']);
  });

  it('treats an exactly square photo as landscape', () => {
    const square = { id: 's1', width: 100, height: 100 };
    expect(shape(toRows([square, portrait(1)]))).toEqual(['s1@0', 'p1@1']);
  });

  it('offsets indices so they address the full photo array', () => {
    expect(shape(toRows([portrait(1), portrait(2)], 10))).toEqual(['p1@10+p2@11']);
  });

  it('returns nothing for no photos', () => {
    expect(toRows([])).toEqual([]);
  });
});

describe('layOutSections', () => {
  const six = [portrait(1), portrait(2), landscape(1), portrait(3), portrait(4), landscape(2)];

  it('returns one untitled run when there are no sections', () => {
    const out = layOutSections(six);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBeNull();
    expect(out[0].id).toBeNull();
    expect(shape(out[0].rows)).toEqual(['p1@0+p2@1', 'l1@2', 'p3@3+p4@4', 'l2@5']);
  });

  it('treats an empty sections array the same as none', () => {
    expect(layOutSections(six, [])).toEqual(layOutSections(six));
  });

  it('splits into the declared runs and keeps indices global', () => {
    const out = layOutSections(six, [
      { title: 'First', count: 3 },
      { title: 'Second', count: 3 },
    ]);
    expect(out.map((s) => s.title)).toEqual(['First', 'Second']);
    expect(out.map((s) => s.id)).toEqual(['first', 'second']);
    expect(shape(out[0].rows)).toEqual(['p1@0+p2@1', 'l1@2']);
    expect(shape(out[1].rows)).toEqual(['p3@3+p4@4', 'l2@5']);
  });

  it('never pairs portraits across a section boundary', () => {
    // p2 and p3 are adjacent portraits, but a heading falls between them.
    const out = layOutSections(six, [
      { title: 'First', count: 2 },
      { title: 'Second', count: 4 },
    ]);
    expect(shape(out[0].rows)).toEqual(['p1@0+p2@1']);
    expect(shape(out[1].rows)).toEqual(['l1@2', 'p3@3+p4@4', 'l2@5']);
  });

  it('puts photos past the last section into a trailing untitled run', () => {
    // What a re-import looks like: mergeManifest appends, counts go stale.
    const out = layOutSections(six, [{ title: 'First', count: 3 }]);
    expect(out.map((s) => s.title)).toEqual(['First', null]);
    expect(shape(out[1].rows)).toEqual(['p3@3+p4@4', 'l2@5']);
  });

  it('clips a section that overruns the end', () => {
    const out = layOutSections(six, [{ title: 'Greedy', count: 99 }]);
    expect(out).toHaveLength(1);
    expect(shape(out[0].rows)).toEqual(['p1@0+p2@1', 'l1@2', 'p3@3+p4@4', 'l2@5']);
  });

  it('drops sections declared entirely past the end', () => {
    const out = layOutSections(six, [
      { title: 'Real', count: 6 },
      { title: 'Phantom', count: 4 },
    ]);
    expect(out.map((s) => s.title)).toEqual(['Real']);
  });

  it('covers every photo exactly once', () => {
    const out = layOutSections(six, [
      { title: 'A', count: 2 },
      { title: 'B', count: 1 },
      { title: 'C', count: 3 },
    ]);
    const indices = out.flatMap((s) => s.rows.flatMap((r) => r.photos.map((p) => p.index)));
    expect(indices).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
