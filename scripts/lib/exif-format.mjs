export function formatShutter(t) {
  if (t >= 0.4) return `${Number(t)}s`;
  return `1/${Math.round(1 / t)}`;
}

/** Map raw exifr output to the manifest's exif shape. Missing fields are omitted. */
export function toPhotoExif(raw) {
  if (!raw) return {};
  const exif = {};
  if (raw.Model) exif.camera = raw.Model;
  else if (raw.Make) exif.camera = raw.Make;
  if (raw.LensModel) exif.lens = raw.LensModel;
  if (raw.FocalLength) exif.focal = `${Math.round(raw.FocalLength)}mm`;
  if (raw.FNumber) exif.aperture = `f/${Math.round(raw.FNumber * 10) / 10}`;
  if (raw.ExposureTime) exif.shutter = formatShutter(raw.ExposureTime);
  if (raw.ISO) exif.iso = raw.ISO;
  if (raw.DateTimeOriginal) {
    const d = new Date(raw.DateTimeOriginal);
    if (Number.isFinite(d.getTime())) exif.taken = d.toISOString();
  }
  return exif;
}
