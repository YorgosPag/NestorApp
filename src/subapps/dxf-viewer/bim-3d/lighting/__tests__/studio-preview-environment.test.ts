/**
 * Tests for studio-preview-environment (ADR-687) — the pure procedural HDR studio env:
 * DataTexture shape + the softbox/gradient math (neutral, HDR softboxes, top brighter than
 * bottom). The visual result is browser-verified by Giorgio.
 */

import * as THREE from 'three';
import { buildStudioPreviewEnvTexture } from '../studio-preview-environment';

const WIDTH = 512;
const HEIGHT = 256;
const px = (data: Float32Array, row: number, col: number): number => data[(row * WIDTH + col) * 4];

describe('buildStudioPreviewEnvTexture', () => {
  it('builds a 512×256 FloatType equirectangular-reflection DataTexture', () => {
    const tex = buildStudioPreviewEnvTexture();
    expect(tex.image.width).toBe(WIDTH);
    expect(tex.image.height).toBe(HEIGHT);
    expect(tex.type).toBe(THREE.FloatType);
    expect(tex.mapping).toBe(THREE.EquirectangularReflectionMapping);
    tex.dispose();
  });

  it('is neutral: R === G === B at every sampled pixel (no colour cast on the material)', () => {
    const tex = buildStudioPreviewEnvTexture();
    const data = tex.image.data as Float32Array;
    for (const [row, col] of [[10, 10], [183, 143], [200, 340]] as const) {
      const i = (row * WIDTH + col) * 4;
      expect(data[i]).toBeCloseTo(data[i + 1], 6);
      expect(data[i + 1]).toBeCloseTo(data[i + 2], 6);
    }
    tex.dispose();
  });

  it('carries genuine HDR softboxes: the key-panel core exceeds 1.0 (bright reflections)', () => {
    const tex = buildStudioPreviewEnvTexture();
    const data = tex.image.data as Float32Array;
    // Key softbox center: u=0.28, v=0.72 → col≈143, row≈183.
    expect(px(data, 183, 143)).toBeGreaterThan(1);
    tex.dispose();
  });

  it('lights from above: the surround is brighter near the zenith than near the floor', () => {
    const tex = buildStudioPreviewEnvTexture();
    const data = tex.image.data as Float32Array;
    // Column 486 (u≈0.95) sits clear of every softbox → pure surround gradient.
    const nearZenith = px(data, HEIGHT - 12, 486);
    const nearFloor = px(data, 12, 486);
    expect(nearZenith).toBeGreaterThan(nearFloor);
    tex.dispose();
  });
});
