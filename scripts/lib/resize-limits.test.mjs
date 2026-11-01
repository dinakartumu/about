import { describe, it, expect } from 'vitest';
import { fitWithinLimits, MAX_PIXELS } from './resize-limits.mjs';

describe('fitWithinLimits', () => {
  it('leaves an ordinary photo alone', () => {
    expect(fitWithinLimits({ width: 7728, height: 5152, bytes: 23_000_000 })).toBeNull();
  });

  it('shrinks a pano over the pixel cap, keeping its shape', () => {
    const fit = fitWithinLimits({ width: 20472, height: 7076, bytes: 127_000_000 });
    expect(fit.width * fit.height).toBeLessThanOrEqual(MAX_PIXELS);
    expect(fit.width / fit.height).toBeCloseTo(20472 / 7076, 2);
  });

  it('re-encodes at full size when only the file is too heavy', () => {
    expect(fitWithinLimits({ width: 9000, height: 6000, bytes: 80_000_000 })).toEqual({ width: 9000, height: 6000 });
  });
});
