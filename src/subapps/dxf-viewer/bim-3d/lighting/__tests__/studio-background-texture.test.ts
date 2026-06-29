/**
 * Tests for studio-background-texture (ADR-446 §2.1) — the PURE gradient-stop math and the
 * DataTexture shape. The visual orientation is browser-verified by Giorgio.
 */

import * as THREE from 'three';
import {
  studioGradientStops,
  explicitToStops,
  buildStudioBackgroundTexture,
  STUDIO_BG_DELTA,
} from '../studio-background-texture';

describe('studioGradientStops', () => {
  it('keeps the mid stop exactly at the base colour (2D-canvas SSoT parity)', () => {
    expect(studioGradientStops('#404040').mid).toEqual([64, 64, 64]);
  });

  it('makes the top darker and the bottom lighter than the base', () => {
    const { top, mid, bottom } = studioGradientStops('#404040');
    expect(top[0]).toBeLessThan(mid[0]);
    expect(bottom[0]).toBeGreaterThan(mid[0]);
    // Symmetric spread of ±delta around the base.
    const d = Math.round(STUDIO_BG_DELTA * 255);
    expect(mid[0] - top[0]).toBe(d);
    expect(bottom[0] - mid[0]).toBe(d);
  });

  it('clamps a pure-black base: top stays black, bottom eases to grey', () => {
    const { top, mid, bottom } = studioGradientStops('#000000');
    expect(top).toEqual([0, 0, 0]);
    expect(mid).toEqual([0, 0, 0]);
    expect(bottom[0]).toBe(Math.round(STUDIO_BG_DELTA * 255));
  });

  it('accepts rgb()/named input (THREE.Color.set parity)', () => {
    expect(studioGradientStops('rgb(64, 64, 64)').mid).toEqual([64, 64, 64]);
    expect(studioGradientStops('black').mid).toEqual([0, 0, 0]);
  });
});

describe('buildStudioBackgroundTexture', () => {
  it('builds a 1×256 sRGB, non-mipmapped, linear-filtered DataTexture', () => {
    const tex = buildStudioBackgroundTexture('#000000');
    expect(tex.image.width).toBe(1);
    expect(tex.image.height).toBe(256);
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(tex.generateMipmaps).toBe(false);
    expect(tex.minFilter).toBe(THREE.LinearFilter);
    tex.dispose();
  });

  it('runs bottom→top = lighter→darker (row 0 is screen-bottom)', () => {
    const tex = buildStudioBackgroundTexture('#404040');
    const data = tex.image.data as Uint8Array;
    const bottomRow = data[0]; // row 0 red
    const topRow = data[(256 - 1) * 4]; // last row red
    expect(bottomRow).toBeGreaterThan(topRow);
    tex.dispose();
  });
});

describe('explicitToStops (exact Cinema 4D gradient)', () => {
  it('keeps the explicit top/bottom ends and sets mid to their mean', () => {
    // Cinema 4D: GRAD1 #5B5B5B (91) top → GRAD2 #868686 (134) bottom.
    const { top, mid, bottom } = explicitToStops({ top: '#5B5B5B', bottom: '#868686' });
    expect(top).toEqual([91, 91, 91]);
    expect(bottom).toEqual([134, 134, 134]);
    expect(mid).toEqual([113, 113, 113]); // round((91+134)/2)
  });
});

describe('buildStudioBackgroundTexture — explicit stops', () => {
  it('paints the EXACT Cinema 4D stops at the screen ends, ignoring baseHex', () => {
    // baseHex is intentionally black to prove the explicit stops drive the gradient.
    const tex = buildStudioBackgroundTexture('#000000', { top: '#5B5B5B', bottom: '#868686' });
    const data = tex.image.data as Uint8Array;
    expect(data[0]).toBe(134); // row 0 = screen-bottom = #868686
    expect(data[(256 - 1) * 4]).toBe(91); // last row = screen-top = #5B5B5B
    tex.dispose();
  });

  it('is a pure straight line: the mid row sits at the mean of the two ends', () => {
    const tex = buildStudioBackgroundTexture('#000000', { top: '#5B5B5B', bottom: '#868686' });
    const data = tex.image.data as Uint8Array;
    const midRow = data[128 * 4];
    expect(midRow).toBeGreaterThanOrEqual(112);
    expect(midRow).toBeLessThanOrEqual(114);
    tex.dispose();
  });
});
