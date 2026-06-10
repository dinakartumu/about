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

  it('formats sub-second exposures of 0.4s and up as decimal seconds', () => {
    expect(toPhotoExif({ ExposureTime: 0.6 }).shutter).toBe('0.6s');
    expect(toPhotoExif({ ExposureTime: 0.8 }).shutter).toBe('0.8s');
  });

  it('formats fast exposures as reciprocal fractions', () => {
    expect(toPhotoExif({ ExposureTime: 0.3333 }).shutter).toBe('1/3');
    expect(toPhotoExif({ ExposureTime: 0.004 }).shutter).toBe('1/250');
  });

  it('keeps fractional apertures', () => {
    expect(toPhotoExif({ FNumber: 2.8 }).aperture).toBe('f/2.8');
  });

  it('rounds apertures to one decimal to absorb APEX float noise', () => {
    expect(toPhotoExif({ FNumber: 1.7999999523162842 }).aperture).toBe('f/1.8');
  });

  it('rounds focal lengths', () => {
    expect(toPhotoExif({ FocalLength: 23.3 }).focal).toBe('23mm');
  });

  it('omits taken for malformed DateTimeOriginal without throwing', () => {
    const exif = toPhotoExif({
      Model: 'X100V',
      ISO: 320,
      DateTimeOriginal: '2026:05:01 10:30:00',
    });
    expect(exif).toEqual({ camera: 'X100V', iso: 320 });
  });

  it('falls back to Make for camera when Model is missing', () => {
    expect(toPhotoExif({ Make: 'FUJIFILM' }).camera).toBe('FUJIFILM');
  });

  it('omits missing fields entirely', () => {
    expect(toPhotoExif({})).toEqual({});
    expect(toPhotoExif(null)).toEqual({});
  });
});
