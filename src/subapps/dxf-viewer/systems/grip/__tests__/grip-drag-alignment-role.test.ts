/**
 * ADR-537/561/508 — grip-drag alignment/HUD SELECTION SSoT tests.
 *
 * Guards the 2D↔3D shared selection extract (`grip-drag-alignment-role`): the anchor
 * branches (`resolveGripAlignmentAnchors`) + the polyline HUD-segment gate
 * (`resolvePolylineHudSegments`), so a 3D reuse can never silently fork the 2D behaviour.
 */

import type { GripInfo } from '../../../hooks/grip-types';
import {
  resolveGripAlignmentAnchors,
  resolvePolylineHudSegments,
  gripInfoToAlignmentRole,
  type GripAlignmentRole,
  type GripAlignmentEntityView,
} from '../grip-drag-alignment-role';

const LINE: GripAlignmentEntityView = { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
const OPEN_POLY: GripAlignmentEntityView = {
  type: 'polyline',
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
  closed: false,
};

function role(partial: Partial<GripAlignmentRole>): GripAlignmentRole {
  return {
    movesEntity: false,
    isRotation: false,
    gripIndex: 0,
    anchorPos: null,
    ...partial,
  };
}

describe('resolveGripAlignmentAnchors', () => {
  it('whole-entity move (not rotation) → the base point', () => {
    const anchorPos = { x: 3, y: 4 };
    expect(resolveGripAlignmentAnchors(LINE, role({ movesEntity: true, anchorPos })))
      .toEqual([anchorPos]);
  });

  it('rotation handle → no base-point traces (falls through)', () => {
    // movesEntity + isRotation → skips the base branch; a line rotation kind → null.
    expect(resolveGripAlignmentAnchors(LINE, role({
      movesEntity: true, isRotation: true, anchorPos: { x: 3, y: 4 }, lineGripKind: 'line-rotation',
    }))).toBeNull();
  });

  it('line endpoint reshape → the FIXED opposite endpoint', () => {
    expect(resolveGripAlignmentAnchors(LINE, role({ gripIndex: 0 }))).toEqual([{ x: 10, y: 0 }]);
    expect(resolveGripAlignmentAnchors(LINE, role({ gripIndex: 1 }))).toEqual([{ x: 0, y: 0 }]);
  });

  it('line rotation grip → null (its own arc/polar overlay)', () => {
    expect(resolveGripAlignmentAnchors(LINE, role({ gripIndex: 2, lineGripKind: 'line-rotation' })))
      .toBeNull();
  });

  it('polyline interior vertex → BOTH fixed neighbour vertices', () => {
    expect(resolveGripAlignmentAnchors(OPEN_POLY, role({ gripIndex: 1 })))
      .toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  });

  it('polyline open endpoint → the single adjacent vertex', () => {
    expect(resolveGripAlignmentAnchors(OPEN_POLY, role({ gripIndex: 0 })))
      .toEqual([{ x: 10, y: 0 }]);
  });

  it('polyline STRAIGHT edge-slide → the grabbed base point', () => {
    const anchorPos = { x: 5, y: 0 };
    expect(resolveGripAlignmentAnchors(OPEN_POLY, role({ edgeVertexIndices: [0, 1], anchorPos })))
      .toEqual([anchorPos]);
  });

  it('polyline ARC edge-slide (non-zero bulge) → NOT a slide → vertex anchors', () => {
    const arcPoly: GripAlignmentEntityView = { ...OPEN_POLY, bulges: [0.5, 0, 0] };
    // gripIndex 1 → interior vertex neighbours (the apex is excluded from the slide path).
    expect(resolveGripAlignmentAnchors(arcPoly, role({ gripIndex: 1, edgeVertexIndices: [0, 1] })))
      .toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  });

  it('non-line / non-polyline reshape → null (caller resolves BIM footprint itself)', () => {
    expect(resolveGripAlignmentAnchors({ type: 'circle' }, role({ gripIndex: 1 }))).toBeNull();
  });
});

describe('resolvePolylineHudSegments', () => {
  it('vertex reshape → the (≤2) incident segments', () => {
    expect(resolvePolylineHudSegments(OPEN_POLY, role({ gripIndex: 1 })))
      .toEqual([[0, 1], [1, 2]]);
  });

  it('open endpoint → a single incident segment', () => {
    expect(resolvePolylineHudSegments(OPEN_POLY, role({ gripIndex: 0 })))
      .toEqual([[0, 1]]);
  });

  it('STRAIGHT edge-slide → the leg + its neighbours (deduped union)', () => {
    expect(resolvePolylineHudSegments(OPEN_POLY, role({ edgeVertexIndices: [0, 1] })))
      .toEqual([[0, 1], [1, 2]]);
  });

  it('ARC edge-slide (non-zero bulge) → falls back to vertex-incident', () => {
    const arcPoly: GripAlignmentEntityView = { ...OPEN_POLY, bulges: [0.5, 0, 0] };
    expect(resolvePolylineHudSegments(arcPoly, role({ gripIndex: 1, edgeVertexIndices: [0, 1] })))
      .toEqual([[0, 1], [1, 2]]);
  });

  it('non-polyline → []', () => {
    expect(resolvePolylineHudSegments(LINE, role({ gripIndex: 0 }))).toEqual([]);
  });
});

describe('gripInfoToAlignmentRole — 3D GripInfo adapter', () => {
  const gripInfo = (p: Partial<GripInfo>): GripInfo =>
    ({ entityId: 'e', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, ...p });

  it('plain vertex grip → not rotation, carries index + anchor + edgeVertexIndices', () => {
    const r = gripInfoToAlignmentRole(
      gripInfo({ gripIndex: 2, edgeVertexIndices: [1, 2] }),
      { x: 7, y: 8 },
    );
    expect(r).toEqual({
      movesEntity: false, isRotation: false, gripIndex: 2,
      anchorPos: { x: 7, y: 8 }, edgeVertexIndices: [1, 2], lineGripKind: undefined,
    });
  });

  it('detects rotation via the glyph-registry SSoT (line / polyline / arc kinds)', () => {
    expect(gripInfoToAlignmentRole(
      gripInfo({ gripKind: { on: 'line', kind: 'line-rotation' } }), null,
    ).isRotation).toBe(true);
    expect(gripInfoToAlignmentRole(
      gripInfo({ gripKind: { on: 'polyline', kind: 'polyline-rotation' } }), null,
    ).isRotation).toBe(true);
    expect(gripInfoToAlignmentRole(
      gripInfo({ gripKind: { on: 'arc', kind: 'arc-rotation' } }), null,
    ).isRotation).toBe(true);
  });

  it('move / non-rotation kinds are NOT rotation', () => {
    expect(gripInfoToAlignmentRole(
      gripInfo({ gripKind: { on: 'circle', kind: 'circle-move' } }), null,
    ).isRotation).toBe(false);
    expect(gripInfoToAlignmentRole(
      gripInfo({
        movesEntity: true,
        gripKind: { on: 'polyline', kind: 'polyline-move' },
      }), null,
    ).isRotation).toBe(false);
    expect(gripInfoToAlignmentRole(gripInfo({}), null).isRotation).toBe(false);
  });
});
