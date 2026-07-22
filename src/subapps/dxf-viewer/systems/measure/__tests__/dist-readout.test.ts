/**
 * ADR-680 — dist-readout: per-segment lengths/midpoints + running total + non-empty labels.
 */
import { computeDistReadout } from '../dist-readout';

describe('computeDistReadout', () => {
  it('computes per-segment lengths, midpoints and running total (3-4-5)', () => {
    const r = computeDistReadout([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }], 'mm');
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0].length).toBeCloseTo(3);
    expect(r.segments[1].length).toBeCloseTo(4);
    expect(r.segments[0].mid).toEqual({ x: 1.5, y: 0 });
    expect(r.segments[1].mid).toEqual({ x: 3, y: 2 });
    expect(r.total).toBeCloseTo(7);
    expect(r.segments[0].label.length).toBeGreaterThan(0);
    expect(r.totalLabel.length).toBeGreaterThan(0);
  });

  it('returns no segments for a single point', () => {
    const r = computeDistReadout([{ x: 1, y: 1 }], 'mm');
    expect(r.segments).toHaveLength(0);
    expect(r.total).toBe(0);
  });

  it('returns empty for no points', () => {
    const r = computeDistReadout([], 'mm');
    expect(r.segments).toHaveLength(0);
    expect(r.total).toBe(0);
  });

  it('computes a pure vertical 3D length (z only) — column height', () => {
    const r = computeDistReadout([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 3 }], 'mm');
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].length).toBeCloseTo(3);
    expect(r.segments[0].mid).toEqual({ x: 0, y: 0, z: 1.5 });
  });

  it('computes a 3D diagonal (3-4-12-13 over x,y,z)', () => {
    // hypot(3,4)=5 on the plan, then hypot(5,12)=13 with the z rise.
    const r = computeDistReadout([{ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 12 }], 'mm');
    expect(r.segments[0].length).toBeCloseTo(13);
    expect(r.segments[0].mid).toEqual({ x: 1.5, y: 2, z: 6 });
  });

  it('is backward-compatible: absent z behaves as z=0 (planar length + 2D mid)', () => {
    const r = computeDistReadout([{ x: 0, y: 0 }, { x: 3, y: 4 }], 'mm');
    expect(r.segments[0].length).toBeCloseTo(5);
    expect(r.segments[0].mid).toEqual({ x: 1.5, y: 2 }); // no z key when midpoint elevation is 0
  });
});
