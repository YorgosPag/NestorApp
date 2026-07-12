/**
 * ADR-639 Στάδιο 5 — LOD binary-search instanceCount.
 *
 * On DESC-sorted world lengths, `computeInstanceCount` returns exactly the number of
 * leading segments whose on-screen length (len*scale) ≥ cutoffPx; monotonic in scale;
 * deviceCap clamps; degenerate inputs → 0. N.17-safe (jest only).
 */

import { computeInstanceCount } from '../webgl-line-lod';

const DESC = new Float32Array([10, 8, 5, 3, 1]); // sorted descending, as the builder packs

describe('computeInstanceCount', () => {
  it('draws all when every segment is above cutoff', () => {
    expect(computeInstanceCount(DESC, 1, 0.5)).toBe(5); // min len 1 * 1 = 1 ≥ 0.5
  });

  it('draws none when every segment is below cutoff', () => {
    expect(computeInstanceCount(DESC, 1, 20)).toBe(0); // max 10 < 20
  });

  it('cuts at the first sub-cutoff segment', () => {
    // scale 1, cutoff 4 → [10,8,5] ≥ 4 (3 kept), [3,1] dropped.
    expect(computeInstanceCount(DESC, 1, 4)).toBe(3);
  });

  it('is monotonic in scale (zoom in draws at least as many)', () => {
    // cutoff 4 · lengths [10,8,5,3,1]. scale .5→[5,4,2.5,1.5,.5]→2 · scale 1→3 · scale 2→[20,16,10,6,2]→4.
    const a = computeInstanceCount(DESC, 0.5, 4);
    const b = computeInstanceCount(DESC, 1, 4);
    const c = computeInstanceCount(DESC, 2, 4);
    expect(a).toBe(2);
    expect(b).toBe(3);
    expect(c).toBe(4);
    expect(a).toBeLessThanOrEqual(b);
    expect(b).toBeLessThanOrEqual(c);
  });

  it('respects a device cap', () => {
    expect(computeInstanceCount(DESC, 1, 0.5, 2)).toBe(2);
    expect(computeInstanceCount(DESC, 1, 0.5, 10)).toBe(5); // cap above n → no effect
  });

  it('returns 0 for empty / degenerate scale', () => {
    expect(computeInstanceCount(new Float32Array(0), 1, 1)).toBe(0);
    expect(computeInstanceCount(DESC, 0, 1)).toBe(0);
    expect(computeInstanceCount(DESC, -1, 1)).toBe(0);
  });

  it('cutoff 0 draws EVERY segment — the true "LOD off" (hatch-visibility regression)', () => {
    // Incident 2026-07-12: the manager idled at cutoff=1, which dropped sub-pixel-length
    // segments — silently erasing dense hatch fills (thousands of ~mm LINEs that render
    // sub-pixel at fit-view but form a visible tone) since the DxfRenderer suppresses those
    // owned lines. cutoff=0 is the only pixel-identical idle value: draw ALL owned segments,
    // even zero-length ones, at any scale. Pins IDLE_CUTOFF_PX = 0.
    expect(computeInstanceCount(DESC, 0.001, 0)).toBe(5); // tiny scale → all still drawn
    expect(computeInstanceCount(DESC, 1000, 0)).toBe(5);
    expect(computeInstanceCount(new Float32Array([5, 0, 0]), 1, 0)).toBe(3); // zero-length kept
  });
});
