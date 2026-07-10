/**
 * ADR-531 Φ5b.4 — tests για τον BIM mapper `TekPlaneRecord` → `SlabEntity` (πλάκα).
 */

import { tekPlaneToSlabEntity } from '../tek-plane-to-slab';
import type { TekPlaneRecord } from '../tek-import-types';

// Ορθογώνια πλάκα 5×5m, πάχος 0.15m (footprint όπως το δείγμα ΠΛΑΚΑ.tek + κλείσιμο 4ης κορυφής).
const PLANE: TekPlaneRecord = {
  vertices: [
    { x: 3.7, y: 8.6 }, { x: 8.7, y: 8.6 },
    { x: 8.7, y: 13.6 }, { x: 3.7, y: 13.6 },
  ],
  widthM: 0.15,
  elevationM: 0,
  color: 'BC80FC',
};

describe('tekPlaneToSlabEntity (ADR-531 Φ5b.4)', () => {
  const { slab, warnings } = tekPlaneToSlabEntity(PLANE, 'level-0', 'mm');

  it('παράγει BIM SlabEntity με σωστό πάχος/χρώμα/footprint', () => {
    expect(slab).not.toBeNull();
    expect(slab?.type).toBe('slab');
    expect(slab?.params.thickness).toBeCloseTo(150, 1); // mm (width 0.15m)
    expect(slab?.params.outline.vertices).toHaveLength(4);
    expect(slab?.color).toBe('#BC80FC');
    expect(warnings).toHaveLength(0);
  });

  it('Y-flip: το footprint αντιστρέφεται σε canvas Y-down (μέτρα→scene mm)', () => {
    const v0 = slab?.params.outline.vertices[0];
    expect(v0?.x).toBeCloseTo(3700, 1); // 3.7m → 3700mm
    expect(v0?.y).toBeCloseTo(-8600, 1); // 8.6m Y-up → −8600 canvas Y-down
  });

  // ADR-526 Φ6 — οι stair-generated πλάκες («ψωμιά» μπετού) έχουν elev1=0 αλλά πραγματικό Z στις
  // κορυφές· χωρίς fallback καταρρέουν όλες στο z=0.
  it('elev1=0 + baseElevationM → στάθμη από το πραγματικό Z του polygon', () => {
    const res = tekPlaneToSlabEntity({ ...PLANE, elevationM: 0, baseElevationM: 2.6735 }, 'level-0', 'mm');
    expect(res.slab?.params.levelElevation).toBeCloseTo(2673.5, 0);
  });

  it('elev1 ορισμένο υπερισχύει του baseElevationM (κανονική πλάκα αμετάβλητη)', () => {
    const res = tekPlaneToSlabEntity({ ...PLANE, elevationM: 3, baseElevationM: 0 }, 'level-0', 'mm');
    expect(res.slab?.params.levelElevation).toBeCloseTo(3000, 0);
  });
});
