import { PHOTOS_BASE, TRANSFORMS_ENABLED } from './config';

interface TransformOpts {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'scale-down';
}

/** URL for a photo by manifest id (e.g. "la-mesa/DSC04812"), optionally resized. */
export function photoUrl(id: string, opts: TransformOpts = {}): string {
  const path = `photos/${id}.jpg`;
  if (!TRANSFORMS_ENABLED || (!opts.width && !opts.height)) {
    return `${PHOTOS_BASE}/${path}`;
  }
  const params = Object.entries({ ...opts, quality: 82, format: 'auto' })
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return `${PHOTOS_BASE}/cdn-cgi/image/${params}/${path}`;
}

export const PHOTO_WIDTHS = [480, 800, 1200, 1600, 2400];

export function photoSrcset(id: string): string {
  if (!TRANSFORMS_ENABLED) return '';
  return PHOTO_WIDTHS.map((w) => `${photoUrl(id, { width: w })} ${w}w`).join(', ');
}
