import { describe, it, expect } from 'vitest';
import { toPhotoExif } from './exif-format.mjs';

describe('toPhotoExif', () => {
  it('formats a full EXIF record', () => {
    const exif = toPhotoExif({
      Model: 'X100V',
      LensModel: 'XF23mmF2',
      FocalLength: 23,
      FNumber: 8,
      ExposureTime: 0.004,
      ISO: 320,
      DateTimeOriginal: new Date('2026-05-01T10:30:00Z'),
    });
    expect(exif).toEqual({
      camera: 'X100V',
      lens: 'XF23mmF2',
      focal: '23mm',
      aperture: 'f/8',
      shutter: '1/250',
      iso: 320,
      taken: '2026-05-01T10:30:00.000Z',
    });
  });

  it('formats slow shutter speeds in seconds', () => {
    expect(toPhotoExif({ ExposureTime: 2.5 }).shutter).toBe('2.5s');
    expect(toPhotoExif({ ExposureTime: 1 }).shutter).toBe('1s');
  });

  it('keeps fractional apertures', () => {
    expect(toPhotoExif({ FNumber: 2.8 }).aperture).toBe('f/2.8');
  });

  it('rounds focal lengths', () => {
    expect(toPhotoExif({ FocalLength: 23.3 }).focal).toBe('23mm');
  });

  it('omits missing fields entirely', () => {
    expect(toPhotoExif({})).toEqual({});
    expect(toPhotoExif(null)).toEqual({});
  });
});
