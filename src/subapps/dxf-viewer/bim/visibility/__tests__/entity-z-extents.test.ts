/**
 * ADR-452 — entity-z-extents + cut-plane hide gate.
 */

import { getEntityZExtents, isHiddenByCutPlane } from '../entity-z-extents';
import { DEFAULT_VIEW_RANGE, type ViewRange } from '../../../config/bim-view-range';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

/** Flat-shape entity (wall/column/beam/foundation read `params` at top level). */
function entity(type: string, params: Record<string, unknown>): DxfEntityUnion {
  return { id: `${type}-1`, type, params } as unknown as DxfEntityUnion;
}

/** Nested-wrapper entity (slab/slab-opening/stair/opening nest the BIM entity). */
function nested(type: string, wrapperKey: string, params: Record<string, unknown>): DxfEntityUnion {
  return { id: `${type}-1`, type, [wrapperKey]: { params } } as unknown as DxfEntityUnion;
}

function rangeAt(cutPlaneMm: number): ViewRange {
  return { ...DEFAULT_VIEW_RANGE, cutPlaneMm };
}

describe('getEntityZExtents', () => {
  it('wall / column: base + height', () => {
    expect(getEntityZExtents(entity('wall', { baseOffset: 0, height: 3000 }))).toEqual({ zBottomMm: 0, zTopMm: 3000 });
    expect(getEntityZExtents(entity('column', { baseOffset: 500, height: 2500 }))).toEqual({ zBottomMm: 500, zTopMm: 3000 });
  });

  it('wall: absent baseOffset ⇒ 0', () => {
    expect(getEntityZExtents(entity('wall', { height: 3000 }))).toEqual({ zBottomMm: 0, zTopMm: 3000 });
  });

  it('beam hangs down by depth from top face', () => {
    expect(getEntityZExtents(entity('beam', { topElevation: 3000, depth: 300 }))).toEqual({ zBottomMm: 2700, zTopMm: 3000 });
  });

  it('slab hangs down by thickness from top FFL', () => {
    expect(getEntityZExtents(nested('slab', 'slabEntity', { levelElevation: 3000, thickness: 200 }))).toEqual({ zBottomMm: 2800, zTopMm: 3000 });
  });

  it('slab-opening: 200mm stub below override elevation', () => {
    expect(getEntityZExtents(nested('slab-opening', 'slabOpeningEntity', { elevationOverride: 0 }))).toEqual({ zBottomMm: -200, zTopMm: 0 });
  });

  it('stair: base point Z + total rise', () => {
    expect(getEntityZExtents(nested('stair', 'stairEntity', { basePoint: { x: 0, y: 0, z: 0 }, totalRise: 3000 }))).toEqual({ zBottomMm: 0, zTopMm: 3000 });
  });

  it('opening: sill + height', () => {
    expect(getEntityZExtents(nested('opening', 'openingEntity', { sillHeight: 900, height: 1200 }))).toEqual({ zBottomMm: 900, zTopMm: 2100 });
  });

  it('foundation hangs down by thickness from (negative) top face', () => {
    expect(getEntityZExtents(entity('foundation', { topElevationMm: -200, thicknessMm: 600 }))).toEqual({ zBottomMm: -800, zTopMm: -200 });
  });

  it('raw DXF / un-gated types ⇒ null', () => {
    expect(getEntityZExtents(entity('line', {}))).toBeNull();
    expect(getEntityZExtents(entity('roof', { levelElevation: 6000, thickness: 200 }))).toBeNull();
  });

  // ADR-049 regression — the *PersistenceHost feeds push FLAT scene entities (params
  // at top level) into Bim3DEntitiesStore, which the cut-plane range then reads. The
  // nested cases must tolerate that shape, not crash on the missing wrapper.
  describe('flat scene-entity shape (Bim3DEntitiesStore feed)', () => {
    it('slab — flat params', () => {
      expect(getEntityZExtents(entity('slab', { levelElevation: 3000, thickness: 200 }))).toEqual({ zBottomMm: 2800, zTopMm: 3000 });
    });
    it('slab-opening — flat params (no crash on missing slabOpeningEntity)', () => {
      expect(getEntityZExtents(entity('slab-opening', { elevationOverride: 0 }))).toEqual({ zBottomMm: -200, zTopMm: 0 });
    });
    it('stair — flat params', () => {
      expect(getEntityZExtents(entity('stair', { basePoint: { x: 0, y: 0, z: 0 }, totalRise: 3000 }))).toEqual({ zBottomMm: 0, zTopMm: 3000 });
    });
    it('opening — flat params', () => {
      expect(getEntityZExtents(entity('opening', { sillHeight: 900, height: 1200 }))).toEqual({ zBottomMm: 900, zTopMm: 2100 });
    });
  });
});

describe('isHiddenByCutPlane', () => {
  const beam = entity('beam', { topElevation: 3000, depth: 300 }); // base 2700
  const ceiling = nested('slab', 'slabEntity', { levelElevation: 3000, thickness: 200 }); // base 2800
  const wall = entity('wall', { baseOffset: 0, height: 3000 }); // base 0

  it('inactive gate ⇒ nothing hidden, regardless of elevation', () => {
    expect(isHiddenByCutPlane(beam, rangeAt(0), false)).toBe(false);
    expect(isHiddenByCutPlane(ceiling, rangeAt(0), false)).toBe(false);
  });

  it("Giorgio example — 3m floor: cut at 3m shows everything", () => {
    const r = rangeAt(3000);
    expect(isHiddenByCutPlane(wall, r, true)).toBe(false);
    expect(isHiddenByCutPlane(beam, r, true)).toBe(false);
    expect(isHiddenByCutPlane(ceiling, r, true)).toBe(false);
  });

  it("Giorgio example — cut at 2m hides ceiling slab + beams, keeps walls", () => {
    const r = rangeAt(2000);
    expect(isHiddenByCutPlane(wall, r, true)).toBe(false);
    expect(isHiddenByCutPlane(beam, r, true)).toBe(true);
    expect(isHiddenByCutPlane(ceiling, r, true)).toBe(true);
  });

  it('entities with no Z extent are never hidden', () => {
    expect(isHiddenByCutPlane(entity('line', {}), rangeAt(0), true)).toBe(false);
  });
});
