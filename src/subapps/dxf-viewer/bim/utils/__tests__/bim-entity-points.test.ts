/**
 * ADR-597 §κεντρικοποίηση (2026-07-05) — bim-entity-points column SSoT unification guard.
 *
 * Root cause of «κόκκινα τετράγωνα στο κενό» σε L/Γ κολόνα: `getBimEntityKeyPoints2D` (fed to
 * the ENDPOINT snap via `GeometricCalculations`) returned a column's 9 BBOX anchors — for a
 * non-rectangular column those cardinals/diagonals sit in the empty notch → ghost ■ markers
 * OUTSIDE the body. Fix: column key points now delegate to the ONE characteristic-corner SSoT
 * (real footprint vertices). This guard locks that so the bbox-anchor duplicate cannot return.
 */

import { getBimEntityKeyPoints2D, getBimEntityEdgeMidpoints2D } from '../bim-entity-points';
import { getBimCharacteristicPointsOfCategory } from '../bim-characteristic-points';
import type { ColumnEntity, ColumnParams, ColumnKind } from '../../types/column-types';
import type { SlabEntity } from '../../types/slab-types';
import type { WallEntity, WallParams } from '../../types/wall-types';
import type { BeamEntity, BeamParams } from '../../types/beam-types';
import type { Polygon3D } from '../../types/bim-base';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';

function makeColumn(kind: ColumnKind, overrides: Partial<ColumnParams> = {}): ColumnEntity {
  const base = buildDefaultColumnParams({ x: 0, y: 0 }, kind);
  return {
    id: 'col_1', type: 'column', kind, layerId: '0',
    params: { ...base, ...overrides },
    geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as ColumnEntity;
}

const L_SLAB = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 400 }, { x: 400, y: 400 }, { x: 400, y: 1000 }, { x: 0, y: 1000 }];

function makeSlab(vertices = L_SLAB): SlabEntity {
  const polygon: Polygon3D = { vertices: vertices.map(v => ({ x: v.x, y: v.y })) };
  return {
    id: 'slab_1', type: 'slab', kind: 'floor', layerId: '0',
    params: { outline: { vertices: vertices.map(v => ({ x: v.x, y: v.y })) } } as never,
    geometry: { polygon, bbox: undefined as never, area: 0, netArea: 0, volume: 0, perimeter: 0 },
    validation: undefined as never, visible: true,
  } as unknown as SlabEntity;
}

function makeWall(): WallEntity {
  const params = {
    category: 'exterior', start: { x: 0, y: 0 }, end: { x: 2000, y: 0 },
    height: 3000, thickness: 200, flip: false,
  } as WallParams;
  return {
    id: 'wall_1', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as WallEntity;
}

function makeBeam(): BeamEntity {
  const params: BeamParams = {
    kind: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 2000, y: 0 },
    width: 250, depth: 500, topElevation: 3000,
  };
  return {
    id: 'beam_1', type: 'beam', kind: 'straight', layerId: '0', params,
    geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as BeamEntity;
}

describe('getBimEntityKeyPoints2D — column κεντρικοποίηση (ADR-597)', () => {
  it('rectangular column → 4 REAL footprint corners', () => {
    expect(getBimEntityKeyPoints2D(makeColumn('rectangular'))).toHaveLength(4);
  });

  it('L-shape column → 6 REAL footprint corners (reentrant INSIDE bbox), NOT 9 bbox anchors', () => {
    const pts = getBimEntityKeyPoints2D(makeColumn('L-shape'));
    expect(pts).toHaveLength(6); // 9 bbox anchors → regression; 6 real vertices → correct
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    // A reentrant corner strictly inside the bbox proves these are real footprint vertices,
    // not the 4 bounding-box corners (which a 9-anchor grid would have emitted in the notch).
    expect(pts.some((p) => p.x > minX && p.x < maxX && p.y > minY && p.y < maxY)).toBe(true);
  });

  it('column key points ARE the ONE characteristic-corner SSoT (zero duplication)', () => {
    const col = makeColumn('L-shape');
    expect(getBimEntityKeyPoints2D(col)).toEqual(getBimCharacteristicPointsOfCategory(col, 'corner'));
  });
});

describe('bim-entity-points — polygon entities DELEGATE στο ΕΝΑ characteristic SSoT (ADR-597)', () => {
  it('slab key points = characteristic corners (zero duplicate extraction)', () => {
    const slab = makeSlab();
    expect(getBimEntityKeyPoints2D(slab)).toEqual(getBimCharacteristicPointsOfCategory(slab, 'corner'));
  });

  it('slab edge midpoints = characteristic midpoints', () => {
    const slab = makeSlab();
    expect(getBimEntityEdgeMidpoints2D(slab)).toEqual(getBimCharacteristicPointsOfCategory(slab, 'midpoint'));
  });
});

describe('bim-entity-points — LINEAR entities keep axis endpoints (Revit «Endpoint» ≠ «Corner»)', () => {
  it('wall key points = 2 axis endpoints (NOT the 4 face corners)', () => {
    // Το endpoint snap τοίχου κουμπώνει στα ΑΚΡΑ ΤΟΥ ΑΞΟΝΑ (location line), όχι στις γωνίες
    // σώματος — όπως Revit. Η κεντρικοποίηση ΔΕΝ πρέπει να το αλλάξει.
    expect(getBimEntityKeyPoints2D(makeWall())).toEqual([{ x: 0, y: 0 }, { x: 2000, y: 0 }]);
  });

  it('beam key points = 2 axis endpoints', () => {
    expect(getBimEntityKeyPoints2D(makeBeam())).toEqual([{ x: 0, y: 0 }, { x: 2000, y: 0 }]);
  });

  it('beam edge midpoint = single axis midpoint', () => {
    expect(getBimEntityEdgeMidpoints2D(makeBeam())).toEqual([{ x: 1000, y: 0 }]);
  });
});
