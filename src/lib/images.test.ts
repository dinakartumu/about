import { describe, expect, it } from 'vitest';
import { PHOTO_WIDTHS, photoSrcset, photoUrl } from './images';

// These tests assume src/lib/config.ts has:
//   PHOTOS_BASE = 'https://photos.dinakartumu.com'
//   TRANSFORMS_ENABLED = true
const BASE = 'https://photos.dinakartumu.com';

describe('photoUrl', () => {
  it('returns the plain photo URL when no width/height is given', () => {
    expect(photoUrl('la-mesa/DSC04812')).toBe(`${BASE}/photos/la-mesa/DSC04812.jpg`);
  });

  // Param order below is defaults-then-opts because photoUrl spreads opts last so
  // callers can override format (see the format test). Cloudflare ignores order.
  it('returns a cdn-cgi transform URL when a width is given', () => {
    expect(photoUrl('la-mesa/DSC04812', { width: 480 })).toBe(
      `${BASE}/cdn-cgi/image/quality=82,format=auto,width=480/photos/la-mesa/DSC04812.jpg`
    );
  });

  it('URL-encodes path segments in the plain URL', () => {
    expect(photoUrl('la mesa/DSC 001')).toBe(`${BASE}/photos/la%20mesa/DSC%20001.jpg`);
  });

  it('URL-encodes path segments in the transform URL', () => {
    expect(photoUrl('la mesa/DSC 001', { width: 480 })).toBe(
      `${BASE}/cdn-cgi/image/quality=82,format=auto,width=480/photos/la%20mesa/DSC%20001.jpg`
    );
  });

  it('omits undefined option values from transform params', () => {
    const url = photoUrl('la-mesa/DSC04812', { width: undefined, height: 500 });
    expect(url).not.toContain('undefined');
    expect(url).toBe(
      `${BASE}/cdn-cgi/image/quality=82,format=auto,height=500/photos/la-mesa/DSC04812.jpg`
    );
  });

  // Guards the reason opts is spread after the defaults: OG images must be able to
  // force jpeg, since format=auto serves AVIF and X rejects it for link cards.
  it('lets a caller override the default format', () => {
    expect(photoUrl('la-mesa/DSC04812', { width: 1200, format: 'jpeg' })).toContain(
      'format=jpeg'
    );
    expect(photoUrl('la-mesa/DSC04812', { width: 1200, format: 'jpeg' })).not.toContain(
      'format=auto'
    );
  });
});

describe('photoSrcset', () => {
  it('emits one comma-separated entry per width with width descriptors', () => {
    const entries = photoSrcset('la-mesa/DSC04812').split(', ');
    expect(entries).toHaveLength(PHOTO_WIDTHS.length);
    expect(entries[0]).toContain('width=480');
    expect(entries[0].endsWith(' 480w')).toBe(true);
    expect(entries[entries.length - 1].endsWith(' 2400w')).toBe(true);
  });

  it('includes fit=scale-down in every variant to prevent upscaling', () => {
    const entries = photoSrcset('la-mesa/DSC04812').split(', ');
    for (const entry of entries) {
      expect(entry).toContain('fit=scale-down');
    }
  });

  it('URL-encodes ids in srcset entries', () => {
    expect(photoSrcset('la mesa/DSC 001')).toContain('/photos/la%20mesa/DSC%20001.jpg 480w');
  });
});
