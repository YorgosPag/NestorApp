/**
 * ADR-535 Φ1/Φ3 — grip-3d-reshape-grips filter: only footprint reshape grips reach 3D.
 *
 * The 3D overlay surfaces ONLY the per-vertex / edge-midpoint footprint grips (the gizmo
 * owns whole-entity move/rotate). The filter must keep grips carrying ANY footprint
 * discriminator (slab / roof / floor-finish / slab-opening) with `movesEntity:false`, and
 * drop everything else (whole-entity, no-kind grips).
 */

import type { GripInfo } from '../../../hooks/grip-types';
import { reshapeGripsForFootprint } from '../grip-3d-reshape-grips';
import { toUnifiedGrip } from '../grip-3d-commit';

function vertexGrip(i: number): GripInfo {
  return {
    entityId: 's1', gripIndex: i, type: 'vertex',
    position: { x: i * 100, y: 0 }, movesEntity: false,
    slabGripKind: `slab-vertex-${i}`,
  };
}

function midpointGrip(i: number): GripInfo {
  return {
    entityId: 's1', gripIndex: 10 + i, type: 'midpoint',
    position: { x: i * 50, y: 50 }, movesEntity: false,
    edgeVertexIndices: [i, i + 1],
    slabGripKind: `slab-edge-midpoint-${i}`,
  };
}

describe('reshapeGripsForFootprint', () => {
  it('keeps vertex + edge-midpoint slab grips in order', () => {
    const grips = [vertexGrip(0), midpointGrip(0), vertexGrip(1)];
    const out = reshapeGripsForFootprint(grips);
    expect(out.map((g) => g.slabGripKind)).toEqual([
      'slab-vertex-0', 'slab-edge-midpoint-0', 'slab-vertex-1',
    ]);
  });

  it('drops whole-entity grips (movesEntity:true)', () => {
    const wholeEntity: GripInfo = {
      entityId: 's1', gripIndex: 99, type: 'center',
      position: { x: 0, y: 0 }, movesEntity: true, slabGripKind: 'slab-vertex-0',
    };
    expect(reshapeGripsForFootprint([wholeEntity, vertexGrip(0)])).toHaveLength(1);
  });

  it('drops grips without any footprint gripKind', () => {
    const plain: GripInfo = {
      entityId: 's1', gripIndex: 0, type: 'vertex',
      position: { x: 0, y: 0 }, movesEntity: false,
    };
    expect(reshapeGripsForFootprint([plain])).toHaveLength(0);
  });

  it('keeps roof / floor-finish / slab-opening footprint grips (ADR-535 Φ3)', () => {
    const roof: GripInfo = {
      entityId: 'r1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 },
      movesEntity: false, roofGripKind: 'roof-vertex-0',
    };
    const floorFinish: GripInfo = {
      entityId: 'f1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 },
      movesEntity: false, floorFinishGripKind: 'floor-finish-vertex-0',
    };
    const slabOpening: GripInfo = {
      entityId: 'o1', gripIndex: 1, type: 'midpoint', position: { x: 0, y: 0 },
      movesEntity: false, edgeVertexIndices: [0, 1], slabOpeningGripKind: 'slab-opening-edge-midpoint-0',
    };
    const out = reshapeGripsForFootprint([roof, floorFinish, slabOpening]);
    expect(out).toHaveLength(3);
    expect(out[0].roofGripKind).toBe('roof-vertex-0');
    expect(out[1].floorFinishGripKind).toBe('floor-finish-vertex-0');
    expect(out[2].slabOpeningGripKind).toBe('slab-opening-edge-midpoint-0');
  });

  // ADR-535 Φ7 — columns: a column's plan cross-section IS a footprint, so its corner /
  // edge / parametric / poly-vertex reshape grips surface in 3D — but the whole-entity
  // glyphs (center move, rotation) stay with the gizmo.
  it('keeps column cross-section reshape grips (corner / edge / poly-vertex)', () => {
    const grips: GripInfo[] = [
      { entityId: 'c1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, columnGripKind: 'column-corner-ne' },
      { entityId: 'c1', gripIndex: 1, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, columnGripKind: 'column-edge-w' },
      { entityId: 'c1', gripIndex: 2, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, columnGripKind: 'column-poly-vertex-2' },
    ];
    expect(reshapeGripsForFootprint(grips)).toHaveLength(3);
  });

  it('drops the whole-entity column glyphs: center (movesEntity) + rotation (explicit)', () => {
    const grips: GripInfo[] = [
      { entityId: 'c1', gripIndex: 0, type: 'center', position: { x: 0, y: 0 }, movesEntity: true, columnGripKind: 'column-center' },
      { entityId: 'c1', gripIndex: 1, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, columnGripKind: 'column-rotation' },
    ];
    expect(reshapeGripsForFootprint(grips)).toHaveLength(0);
  });

  // ADR-535 Φ8 — walls: a wall's plan cross-section IS a footprint, so its corner / thickness /
  // length / endpoint / curve / poly-vertex reshape grips surface in 3D — but the whole-entity
  // glyphs (center MOVE `wall-midpoint`, `wall-rotation`) stay with the gizmo.
  it('keeps wall cross-section reshape grips (corner / thickness / endpoint / vertex)', () => {
    const grips: GripInfo[] = [
      { entityId: 'w1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, wallGripKind: 'wall-corner-start-pos' },
      { entityId: 'w1', gripIndex: 1, type: 'edge', position: { x: 0, y: 0 }, movesEntity: false, wallGripKind: 'wall-thickness' },
      { entityId: 'w1', gripIndex: 2, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, wallGripKind: 'wall-start' },
      { entityId: 'w1', gripIndex: 3, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, wallGripKind: 'wall-vertex-1' },
    ];
    expect(reshapeGripsForFootprint(grips)).toHaveLength(4);
  });

  it('drops the whole-entity wall glyphs: midpoint (movesEntity) + rotation (explicit)', () => {
    const grips: GripInfo[] = [
      { entityId: 'w1', gripIndex: 0, type: 'center', position: { x: 0, y: 0 }, movesEntity: true, wallGripKind: 'wall-midpoint' },
      { entityId: 'w1', gripIndex: 1, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, wallGripKind: 'wall-rotation' },
    ];
    expect(reshapeGripsForFootprint(grips)).toHaveLength(0);
  });

  // ADR-535 Φ9 — beams: a beam's plan cross-section IS a footprint, so its corner / width /
  // length-edge / endpoint / poly-vertex reshape grips surface in 3D — but the whole-entity
  // glyphs (center MOVE `beam-midpoint`, `beam-rotation`) stay with the gizmo.
  it('keeps beam cross-section reshape grips (corner / width / length-edge / endpoint)', () => {
    const grips: GripInfo[] = [
      { entityId: 'b1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, beamGripKind: 'beam-corner-start-pos' },
      { entityId: 'b1', gripIndex: 1, type: 'edge', position: { x: 0, y: 0 }, movesEntity: false, beamGripKind: 'beam-width' },
      { entityId: 'b1', gripIndex: 2, type: 'edge', position: { x: 0, y: 0 }, movesEntity: false, beamGripKind: 'beam-edge-length' },
      { entityId: 'b1', gripIndex: 3, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, beamGripKind: 'beam-start' },
    ];
    expect(reshapeGripsForFootprint(grips)).toHaveLength(4);
  });

  it('drops the whole-entity beam glyphs: midpoint (movesEntity) + rotation (explicit)', () => {
    const grips: GripInfo[] = [
      { entityId: 'b1', gripIndex: 0, type: 'center', position: { x: 0, y: 0 }, movesEntity: true, beamGripKind: 'beam-midpoint' },
      { entityId: 'b1', gripIndex: 1, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, beamGripKind: 'beam-rotation' },
    ];
    expect(reshapeGripsForFootprint(grips)).toHaveLength(0);
  });
});

describe('toUnifiedGrip — forwards columnGripKind (ADR-535 Φ7)', () => {
  it('carries columnGripKind so commitDxfGripDragModeAware routes to commitColumnGripDrag', () => {
    const grip: GripInfo = {
      entityId: 'c1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 },
      movesEntity: false, columnGripKind: 'column-corner-se',
    };
    expect(toUnifiedGrip(grip).columnGripKind).toBe('column-corner-se');
  });

  it('still forwards the footprint discriminators, columnGripKind undefined (regression)', () => {
    const grip: GripInfo = {
      entityId: 's1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 },
      movesEntity: false, slabGripKind: 'slab-vertex-0',
    };
    const unified = toUnifiedGrip(grip);
    expect(unified.slabGripKind).toBe('slab-vertex-0');
    expect(unified.columnGripKind).toBeUndefined();
    expect(unified.wallGripKind).toBeUndefined();
  });
});

describe('toUnifiedGrip — forwards wallGripKind (ADR-535 Φ8)', () => {
  it('carries wallGripKind so commitDxfGripDragModeAware routes to commitWallGripDrag', () => {
    const grip: GripInfo = {
      entityId: 'w1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 },
      movesEntity: false, wallGripKind: 'wall-corner-end-neg',
    };
    expect(toUnifiedGrip(grip).wallGripKind).toBe('wall-corner-end-neg');
  });
});

describe('toUnifiedGrip — forwards beamGripKind (ADR-535 Φ9)', () => {
  it('carries beamGripKind so commitDxfGripDragModeAware routes to commitBeamGripDrag', () => {
    const grip: GripInfo = {
      entityId: 'b1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 },
      movesEntity: false, beamGripKind: 'beam-corner-end-neg',
    };
    expect(toUnifiedGrip(grip).beamGripKind).toBe('beam-corner-end-neg');
  });
});
