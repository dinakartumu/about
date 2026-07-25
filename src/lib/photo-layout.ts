/** Minimal shape the layout cares about — real photos carry id/exif too. */
export interface Sized {
  width: number;
  height: number;
}

/** A named run of consecutive photos, declared on the photoset manifest. */
export interface Section {
  title: string;
  count: number;
}

export interface Row<P> {
  photos: { photo: P; index: number }[];
}

export interface LaidOutSection<P> {
  /** null for photos that fall outside any declared section. */
  title: string | null;
  /** Anchor id, null when there is no title. */
  id: string | null;
  rows: Row<P>[];
}

const isPortrait = (p: Sized) => p.height > p.width;

/** "Little free libraries" -> "little-free-libraries" */
export function sectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Group adjacent portraits into pairs; landscapes stand alone.
 *
 * `offset` is where this run starts in the full photo array — the returned
 * indices stay global so they keep addressing the flat lightbox list.
 */
export function toRows<P extends Sized>(photos: P[], offset = 0): Row<P>[] {
  const rows: Row<P>[] = [];
  for (let i = 0; i < photos.length; i++) {
    if (isPortrait(photos[i]) && i + 1 < photos.length && isPortrait(photos[i + 1])) {
      rows.push({
        photos: [
          { photo: photos[i], index: offset + i },
          { photo: photos[i + 1], index: offset + i + 1 },
        ],
      });
      i++;
    } else {
      rows.push({ photos: [{ photo: photos[i], index: offset + i }] });
    }
  }
  return rows;
}

/**
 * Split a photoset into its declared sections, ready to render.
 *
 * Sets without sections come back as a single untitled run, so they lay out
 * exactly as they did before sections existed. Portrait pairing is done per
 * section, never across a heading.
 *
 * Counts are advisory, not load-bearing: photos past the last declared section
 * become a trailing untitled run, and a section reaching past the end is
 * clipped. That matters because `mergeManifest` appends newly imported photos
 * to the end — a re-import should render them unlabelled, not disappear them.
 */
export function layOutSections<P extends Sized>(
  photos: P[],
  sections?: Section[]
): LaidOutSection<P>[] {
  if (!sections?.length) {
    return [{ title: null, id: null, rows: toRows(photos) }];
  }

  const out: LaidOutSection<P>[] = [];
  let at = 0;
  for (const section of sections) {
    if (at >= photos.length) break; // declared past the end — nothing left to show
    const run = photos.slice(at, at + section.count);
    out.push({ title: section.title, id: sectionId(section.title), rows: toRows(run, at) });
    at += run.length;
  }
  if (at < photos.length) {
    out.push({ title: null, id: null, rows: toRows(photos.slice(at), at) });
  }
  return out;
}
