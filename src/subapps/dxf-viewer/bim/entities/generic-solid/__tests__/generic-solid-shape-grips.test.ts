/**
 * ADR-684 Φ4-A — unit tests για τις per-shape radial reshape λαβές
 * (`getGenericSolidShapeReshapeGrips` + `applyGenericSolidShapeReshape`).
 *
 * Επιβεβαιώνει: (α) ποιες λαβές εκπέμπει κάθε σχήμα + πού κάθονται (world +X), (β) το drag γράφει το
 * σωστό πεδίο ακτίνας με 1:1 tracking + clamp, (γ) box/pyramid → καμία radial λαβή, (δ) μη-radial kind
 * → `null` (fall-through στον centred-box adapter).
 */

import {
  getGenericSolidShapeReshapeGrips,
  applyGenericSolidShapeReshape,
} from '../generic-solid-shape-grips';
import type { GenericSolidEntity, GenericSolidParams, GenericSolidShape } from '../generic-solid-types';

const mkParams = (shape: GenericSolidShape): GenericSolidParams => ({
  kind: 'generic',
  shape,
  position: { x: 100, y: 200, z: 0 },
  rotationDeg: 0,
  mountingElevationMm: 0,
  sceneUnits: 'mm',
});

const mkEntity = (shape: GenericSolidShape): GenericSolidEntity =>
  ({ id: 'gsol-1', type: 'generic-solid', params: mkParams(shape) } as unknown as GenericSolidEntity);

const kindOf = (g: { gripKind?: { on: string; kind: string } }) => g.gripKind?.kind;

describe('getGenericSolidShapeReshapeGrips — emission ανά σχήμα', () => {
  it('σφαίρα/κύλινδρος/δίσκος/πρίσμα → 1 radius λαβή στην περιφέρεια (+X)', () => {
    for (const shape of [
      { kind: 'sphere', radiusMm: 150 },
      { kind: 'cylinder', radiusMm: 150, heightMm: 500 },
      { kind: 'disc', radiusMm: 150, thicknessMm: 20 },
      { kind: 'prism', radiusMm: 150, heightMm: 400, sides: 6 },
    ] as const satisfies readonly GenericSolidShape[]) {
      const grips = getGenericSolidShapeReshapeGrips(mkEntity(shape));
      expect(grips).toHaveLength(1);
      expect(kindOf(grips[0])).toBe('generic-solid-radius');
      // +X σε απόσταση radiusMm · scale(mm=1) = 150 από το κέντρο (100, 200)
      expect(grips[0].position).toEqual({ x: 250, y: 200 });
    }
  });

  it('κώνος → radius λαβή στην κάτω ακτίνα (radiusBottomMm)', () => {
    const grips = getGenericSolidShapeReshapeGrips(mkEntity({ kind: 'cone', radiusBottomMm: 120, radiusTopMm: 0, heightMm: 300 }));
    expect(grips).toHaveLength(1);
    expect(kindOf(grips[0])).toBe('generic-solid-radius');
    expect(grips[0].position).toEqual({ x: 220, y: 200 });
  });

  it('κουλούρι → δύο ομοαξονικές λαβές: major (r) + tube (major+tube)', () => {
    const grips = getGenericSolidShapeReshapeGrips(mkEntity({ kind: 'torus', majorRadiusMm: 250, tubeRadiusMm: 75 }));
    expect(grips.map(kindOf)).toEqual(['generic-solid-major', 'generic-solid-tube']);
    expect(grips[0].position).toEqual({ x: 350, y: 200 }); // 100 + 250
    expect(grips[1].position).toEqual({ x: 425, y: 200 }); // 100 + 250 + 75
    // διακριτοί δείκτες λαβών (δεν συγκρούονται)
    expect(new Set(grips.map((g) => g.gripIndex)).size).toBe(2);
  });

  it('box/pyramid → καμία radial λαβή (ορθογώνιο ίχνος → corners/editor)', () => {
    expect(getGenericSolidShapeReshapeGrips(mkEntity({ kind: 'box', widthMm: 500, depthMm: 500, heightMm: 500 }))).toEqual([]);
    expect(getGenericSolidShapeReshapeGrips(mkEntity({ kind: 'pyramid', baseWidthMm: 500, baseDepthMm: 500, heightMm: 500 }))).toEqual([]);
  });

  it('scene units ≠ mm → η θέση κλιμακώνεται (cm: ×0.1)', () => {
    const params = { ...mkParams({ kind: 'sphere', radiusMm: 150 }), sceneUnits: 'cm' as const };
    const grips = getGenericSolidShapeReshapeGrips({ id: 'gsol-1', type: 'generic-solid', params } as unknown as GenericSolidEntity);
    // 150 mm · 0.1 = 15 scene units
    expect(grips[0].position).toEqual({ x: 115, y: 200 });
  });
});

describe('applyGenericSolidShapeReshape — drag transform', () => {
  it('radius grip → μεγαλώνει το radiusMm 1:1 με το delta.x', () => {
    const next = applyGenericSolidShapeReshape('generic-solid-radius', mkParams({ kind: 'sphere', radiusMm: 150 }), { x: 50, y: 0 });
    expect(next?.shape).toEqual({ kind: 'sphere', radiusMm: 200 });
  });

  it('cone radius grip → γράφει radiusBottomMm (όχι radiusTopMm)', () => {
    const next = applyGenericSolidShapeReshape('generic-solid-radius', mkParams({ kind: 'cone', radiusBottomMm: 120, radiusTopMm: 40, heightMm: 300 }), { x: 30, y: 0 });
    expect(next?.shape).toEqual({ kind: 'cone', radiusBottomMm: 150, radiusTopMm: 40, heightMm: 300 });
  });

  it('torus major/tube grips → γράφουν το αντίστοιχο πεδίο ανεξάρτητα', () => {
    const base = mkParams({ kind: 'torus', majorRadiusMm: 250, tubeRadiusMm: 75 });
    expect(applyGenericSolidShapeReshape('generic-solid-major', base, { x: 50, y: 0 })?.shape).toEqual({ kind: 'torus', majorRadiusMm: 300, tubeRadiusMm: 75 });
    expect(applyGenericSolidShapeReshape('generic-solid-tube', base, { x: 25, y: 0 })?.shape).toEqual({ kind: 'torus', majorRadiusMm: 250, tubeRadiusMm: 100 });
  });

  it('clamp στο MIN — δεν πέφτει κάτω από εκφυλισμό', () => {
    const next = applyGenericSolidShapeReshape('generic-solid-radius', mkParams({ kind: 'sphere', radiusMm: 150 }), { x: -1000, y: 0 });
    expect(next?.shape.kind).toBe('sphere');
    expect((next?.shape as { radiusMm: number }).radiusMm).toBeGreaterThan(0);
  });

  it('scene units cm → το delta μετατρέπεται σε mm (÷scale)', () => {
    const params = { ...mkParams({ kind: 'sphere', radiusMm: 150 }), sceneUnits: 'cm' as const };
    // delta.x = 5 scene units ÷ 0.1 = 50 mm
    const next = applyGenericSolidShapeReshape('generic-solid-radius', params, { x: 5, y: 0 });
    expect((next?.shape as { radiusMm: number }).radiusMm).toBeCloseTo(200, 6);
  });

  it('μη-radial kind (move/rotation/corner) → null (fall-through)', () => {
    const p = mkParams({ kind: 'sphere', radiusMm: 150 });
    expect(applyGenericSolidShapeReshape('generic-solid-move', p, { x: 10, y: 0 })).toBeNull();
    expect(applyGenericSolidShapeReshape('generic-solid-corner-ne', p, { x: 10, y: 0 })).toBeNull();
  });

  it('radial kind σε λάθος σχήμα (radius σε box) → null', () => {
    const p = mkParams({ kind: 'box', widthMm: 500, depthMm: 500, heightMm: 500 });
    expect(applyGenericSolidShapeReshape('generic-solid-radius', p, { x: 10, y: 0 })).toBeNull();
    expect(applyGenericSolidShapeReshape('generic-solid-major', p, { x: 10, y: 0 })).toBeNull();
  });
});
