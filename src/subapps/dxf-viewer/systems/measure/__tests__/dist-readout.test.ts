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
});
