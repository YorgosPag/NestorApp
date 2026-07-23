/**
 * Tests for preview-backdrop-texture (ADR-687) — the pure diagonal stripe math + DataTexture
 * shape. The visual result is browser-verified by Giorgio.
 */

import * as THREE from 'three';
import { buildDiagonalStripeBackdropTexture } from '../preview-backdrop-texture';

const SIZE = 256;
const r = (data: Uint8Array, x: number, y: number): number => data[(y * SIZE + x) * 4];

describe('buildDiagonalStripeBackdropTexture', () => {
  it('builds a 256×256 sRGB DataTexture', () => {
    const tex = buildDiagonalStripeBackdropTexture();
    expect(tex.image.width).toBe(SIZE);
    expect(tex.image.height).toBe(SIZE);
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
    tex.dispose();
  });

  it('is neutral grey and uses exactly the two documented stops', () => {
    const tex = buildDiagonalStripeBackdropTexture();
    const data = tex.image.data as Uint8Array;
    for (const [x, y] of [[0, 0], [18, 0], [100, 40]] as const) {
      const i = (y * SIZE + x) * 4;
      expect(data[i]).toBe(data[i + 1]); // R === G
      expect(data[i + 1]).toBe(data[i + 2]); // G === B
      expect([0x5b, 0x86]).toContain(data[i]); // one of the two greys
    }
    tex.dispose();
  });

  it('alternates dark→light across the period (0x5b core, 0x86 band)', () => {
    const tex = buildDiagonalStripeBackdropTexture();
    const data = tex.image.data as Uint8Array;
    expect(r(data, 0, 0)).toBe(0x5b); // (x+y)=0 → dark band
    expect(r(data, 18, 0)).toBe(0x86); // (x+y)=18 → light band
    tex.dispose();
  });

  it('runs at 45°: pixels on the same x+y diagonal share a band', () => {
    const tex = buildDiagonalStripeBackdropTexture();
    const data = tex.image.data as Uint8Array;
    expect(r(data, 5, 5)).toBe(r(data, 0, 10)); // both x+y=10
    expect(r(data, 12, 12)).toBe(r(data, 20, 4)); // both x+y=24
    tex.dispose();
  });
});
