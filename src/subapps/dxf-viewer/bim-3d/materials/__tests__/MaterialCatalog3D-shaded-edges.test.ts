/**
 * ADR-375 Phase C.7 — "Shaded with Edges" depth bias guard.
 *
 * The BIM 3D edge overlays (LineSegments2) are coplanar with the solid faces at
 * every hard corner and are depth-tested. Without a face-side `polygonOffset` the
 * faces win the depth contest and the dark edges vanish (z-fighting) — the
 * flat-shaded "no pencil edges" look. Revit "Shaded with Edges" pushes the shaded
 * faces slightly back so the edges always win.
 *
 * This guards the cardinal rule: EVERY face-material path routes through `buildMat`
 * and therefore MUST carry the positive polygon offset — flat element materials,
 * system-tinted materials and user library materials alike.
 */

import {
  getElementMaterial3D,
  getSystemTintedMaterial3D,
  getMaterial3D,
} from '../MaterialCatalog3D';

describe('MaterialCatalog3D — Shaded with Edges depth bias (polygonOffset)', () => {
  it('flat element materials carry a positive polygon offset', () => {
    const mat = getElementMaterial3D('column');
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBeGreaterThan(0);
    expect(mat.polygonOffsetUnits).toBeGreaterThan(0);
  });

  it('DNA-resolved materials carry the same offset', () => {
    const mat = getMaterial3D('mat-concrete-c25');
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBeGreaterThan(0);
    expect(mat.polygonOffsetUnits).toBeGreaterThan(0);
  });

  it('system-tinted materials inherit the offset (single factory SSoT)', () => {
    const mat = getSystemTintedMaterial3D('mep-pipe', 0x2563eb);
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBeGreaterThan(0);
    expect(mat.polygonOffsetUnits).toBeGreaterThan(0);
  });
});
