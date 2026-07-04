/**
 * ADR-508 §move-clearance — arc footprint SSoT test. A moving arc (π.χ. φορά ανοίγματος πόρτας) must
 * expose its ACTUAL swept curve as the clearance footprint, NOT the full disc bbox (center±r). The
 * disc bbox includes the centre corner (the hinge), which typically overlaps the host wall → the
 * neighbor-clearance engine rejects every neighbour as «too close» → zero cyan dims. Sampling the
 * curve (which never contains the centre) restores the thin perp extent → clearance dims appear.
 */
import { resolveEntityFootprintForDims } from '../entity-footprint-for-dims';
import type { Entity } from '../../../types/entities';

describe('resolveEntityFootprintForDims — arc', () => {
  const arc = {
    id: 'arc-1', type: 'arc', center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: 90,
  } as unknown as Entity;

  it('returns the sampled swept curve, NOT a 4-corner disc bbox', () => {
    const fp = resolveEntityFootprintForDims(arc);
    expect(fp).toBeDefined();
    expect(fp!.length).toBeGreaterThan(4); // dense curve sampling ≠ a 4-point bounding box
  });

  it('every footprint point sits ON the circumference (the centre/hinge corner is excluded)', () => {
    const fp = resolveEntityFootprintForDims(arc)!;
    for (const p of fp) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 6);
    }
  });
});
