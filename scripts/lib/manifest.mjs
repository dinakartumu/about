const byCapture = (a, b) =>
  (a.exif?.taken ?? '9999').localeCompare(b.exif?.taken ?? '9999') || a.id.localeCompare(b.id);

function latestDate(photos) {
  const taken = photos.map((p) => p.exif?.taken).filter(Boolean).sort();
  return taken.length ? taken[taken.length - 1].slice(0, 10) : new Date().toISOString().slice(0, 10);
}

/**
 * Merge a fresh folder scan into an existing manifest (or create one).
 * Preserves hand-edited title/description/cover/order; only manages the photo list.
 */
export function mergeManifest(existing, scanned, { prune = false } = {}) {
  const sorted = [...scanned].sort(byCapture);

  if (!existing) {
    return {
      title: '',
      slug: '',
      description: '',
      cover: sorted[0]?.id ?? '',
      date: latestDate(sorted),
      photos: sorted,
    };
  }

  const scannedById = new Map(sorted.map((p) => [p.id, p]));
  const kept = existing.photos
    .filter((p) => !prune || scannedById.has(p.id))
    .map((p) => scannedById.get(p.id) ?? p);
  const keptIds = new Set(kept.map((p) => p.id));
  const added = sorted.filter((p) => !keptIds.has(p.id));

  const manifest = { ...existing, photos: [...kept, ...added] };
  if (!manifest.photos.some((p) => p.id === manifest.cover)) {
    manifest.cover = manifest.photos[0]?.id ?? '';
  }
  return manifest;
}
