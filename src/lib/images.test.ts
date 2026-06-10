import { describe, expect, it } from 'vitest';
import { PHOTO_WIDTHS, photoSrcset, photoUrl } from './images';

// These tests assume src/lib/config.ts has:
//   PHOTOS_BASE = 'https://photos.tumudinakar.com'
//   TRANSFORMS_ENABLED = true
const BASE = 'https://photos.tumudinakar.com';

describe('photoUrl', () => {
  it('returns the plain photo URL when no width/height is given', () => {
    expect(photoUrl('la-mesa/DSC04812')).toBe(`${BASE}/photos/la-mesa/DSC04812.jpg`);
  });

  it('returns a cdn-cgi transform URL when a width is given', () => {
    expect(photoUrl('la-mesa/DSC04812', { width: 480 })).toBe(
      `${BASE}/cdn-cgi/image/width=480,quality=82,format=auto/photos/la-mesa/DSC04812.jpg`
    );
  });

  it('URL-encodes path segments in the plain URL', () => {
    expect(photoUrl('la mesa/DSC 001')).toBe(`${BASE}/photos/la%20mesa/DSC%20001.jpg`);
  });

  it('URL-encodes path segments in the transform URL', () => {
    expect(photoUrl('la mesa/DSC 001', { width: 480 })).toBe(
      `${BASE}/cdn-cgi/image/width=480,quality=82,format=auto/photos/la%20mesa/DSC%20001.jpg`
    );
  });

  it('omits undefined option values from transform params', () => {
    const url = photoUrl('la-mesa/DSC04812', { width: undefined, height: 500 });
    expect(url).not.toContain('undefined');
    expect(url).toBe(
      `${BASE}/cdn-cgi/image/height=500,quality=82,format=auto/photos/la-mesa/DSC04812.jpg`
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
