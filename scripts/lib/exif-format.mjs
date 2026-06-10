export function formatShutter(t) {
  if (t >= 1) return `${Number(t)}s`;
  return `1/${Math.round(1 / t)}`;
}

/** Map raw exifr output to the manifest's exif shape. Missing fields are omitted. */
export function toPhotoExif(raw) {
  if (!raw) return {};
  const exif = {};
  if (raw.Model) exif.camera = raw.Model;
  if (raw.LensModel) exif.lens = raw.LensModel;
  if (raw.FocalLength) exif.focal = `${Math.round(raw.FocalLength)}mm`;
  if (raw.FNumber) exif.aperture = `f/${Number(raw.FNumber)}`;
  if (raw.ExposureTime) exif.shutter = formatShutter(raw.ExposureTime);
  if (raw.ISO) exif.iso = raw.ISO;
  if (raw.DateTimeOriginal) exif.taken = new Date(raw.DateTimeOriginal).toISOString();
  return exif;
}
