// Cloudflare Image Resizing refuses sources over 100 MP (err 9413) or 70 MB
// (413), so every size the site asks for fails. Stay a little under both.
export const MAX_PIXELS = 98_000_000;
export const MAX_BYTES = 70_000_000;

/**
 * Decide whether a photo must be shrunk before upload.
 * Returns null when it already fits, otherwise { width, height } to resize to,
 * in the same (stored, pre-rotation) orientation as the input.
 */
export function fitWithinLimits({ width, height, bytes }) {
  const pixels = width * height;
  if (pixels <= MAX_PIXELS && bytes <= MAX_BYTES) return null;
  // Over the byte cap alone: re-encoding at full size is enough.
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / pixels));
  return { width: Math.floor(width * scale), height: Math.floor(height * scale) };
}
