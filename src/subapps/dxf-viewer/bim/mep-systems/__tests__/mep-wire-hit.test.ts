/**
 * mep-wire-hit — pure circuit-wire hit-test tests (Revit "click a wire to select it").
 */

import { hitTestCircuitWirePaths, selectCircuitsInMarquee, type WorldBounds } from '../mep-wire-hit';
import type { CircuitWirePath } from '../mep-wire-routing';

/** A straight two-point wire at y=0 from x0→x1 (zMm ignored by the 2D hit-test). */
function wire(systemId: string, x0: number, x1: number, y = 0): CircuitWirePath {
  return {
    systemId,
    colorHex: '#1e88e5',
    style: 'straight',
    points: [
      { x: x0, y, zMm: 0 },
      { x: x1, y, zMm: 0 },
    ],
  };
}

describe('hitTestCircuitWirePaths', () => {
  it('returns the systemId when the point is on the wire (within tolerance)', () => {
    const paths = [wire('circuit-1', 0, 10)];
    expect(hitTestCircuitWirePaths({ x: 5, y: 0.2 }, paths, 1)).toBe('circuit-1');
  });

  it('returns null when the point is farther than the tolerance', () => {
    const paths = [wire('circuit-1', 0, 10)];
    expect(hitTestCircuitWirePaths({ x: 5, y: 5 }, paths, 1)).toBeNull();
  });

  it('picks the nearest circuit when several wires are present', () => {
    const paths = [wire('far', 0, 10, 0), wire('near', 0, 10, 8)];
    // Point sits next to the y=8 wire → its circuit wins over the y=0 one.
    expect(hitTestCircuitWirePaths({ x: 5, y: 7.9 }, paths, 1)).toBe('near');
  });

  it('hits anywhere along a multi-segment (L-shaped) run', () => {
    const elbow: CircuitWirePath = {
      systemId: 'circuit-L',
      colorHex: '#1e88e5',
      style: 'straight',
      points: [
        { x: 0, y: 0, zMm: 0 },
        { x: 10, y: 0, zMm: 0 },
        { x: 10, y: 10, zMm: 0 },
      ],
    };
    expect(hitTestCircuitWirePaths({ x: 10, y: 5 }, [elbow], 1)).toBe('circuit-L');
  });

  it('returns null for an empty path list', () => {
    expect(hitTestCircuitWirePaths({ x: 0, y: 0 }, [], 1)).toBeNull();
  });
});

describe('selectCircuitsInMarquee', () => {
  /** Box covering x∈[0,10], y∈[0,10]. */
  const box: WorldBounds = { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } };

  describe('window (fully enclosed)', () => {
    it('selects a wire whose every vertex is inside the box', () => {
      const paths = [wire('inside', 2, 8, 5)];
      expect(selectCircuitsInMarquee(box, false, paths)).toEqual(['inside']);
    });

    it('rejects a wire that sticks out of the box', () => {
      const paths = [wire('partial', 2, 15, 5)]; // x=15 is outside
      expect(selectCircuitsInMarquee(box, false, paths)).toEqual([]);
    });

    it('rejects a wire that merely crosses the box (window ≠ crossing)', () => {
      const paths = [wire('crosser', -5, 15, 5)]; // passes through, endpoints outside
      expect(selectCircuitsInMarquee(box, false, paths)).toEqual([]);
    });
  });

  describe('crossing (touches)', () => {
    it('selects a wire with a vertex inside the box', () => {
      const paths = [wire('endpoint-in', -5, 5, 5)]; // (5,5) inside
      expect(selectCircuitsInMarquee(box, true, paths)).toEqual(['endpoint-in']);
    });

    it('selects a wire that crosses a box edge with both endpoints outside', () => {
      const paths = [wire('crosser', -5, 15, 5)];
      expect(selectCircuitsInMarquee(box, true, paths)).toEqual(['crosser']);
    });

    it('rejects a wire entirely outside the box', () => {
      const paths = [wire('away', 20, 30, 5)];
      expect(selectCircuitsInMarquee(box, true, paths)).toEqual([]);
    });
  });

  it('returns every matching circuit in paint order (top-most last)', () => {
    const paths = [wire('a', 2, 8, 3), wire('b', 2, 8, 7)];
    expect(selectCircuitsInMarquee(box, false, paths)).toEqual(['a', 'b']);
  });

  it('returns an empty array for no paths', () => {
    expect(selectCircuitsInMarquee(box, true, [])).toEqual([]);
  });
});
