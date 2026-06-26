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
});
