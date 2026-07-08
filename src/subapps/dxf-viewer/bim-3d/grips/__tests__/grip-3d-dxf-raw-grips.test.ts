/**
 * ADR-537 — rawDxfReshapeGrips: which raw-DXF grips surface in 3D.
 *
 * Unlike the BIM footprint filter, raw DXF wants FULL 2D parity: vertices + edge
 * midpoints + whole-entity move grips (line midpoint / circle & arc centre) all stay.
 * The only thing stripped is a BIM-structural `*GripKind` (a raw DXF entity never has one).
 */

import type { GripInfo } from '../../../hooks/grip-types';
import { rawDxfReshapeGrips, scaleDxfGripsToMm } from '../grip-3d-dxf-raw-grips';

function g(partial: Partial<GripInfo>): GripInfo {
  return { entityId: 'e1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, ...partial };
}

describe('rawDxfReshapeGrips', () => {
  it('keeps plain vertex / edge / center grips including whole-entity move grips', () => {
    const grips = [
      g({ gripIndex: 0, type: 'vertex', movesEntity: false }),
      g({ gripIndex: 1, type: 'vertex', movesEntity: false }),
      g({ gripIndex: 2, type: 'edge', movesEntity: true, edgeVertexIndices: [0, 1] }), // line midpoint
      g({ gripIndex: 3, type: 'center', movesEntity: true }), // circle centre
    ];
    expect(rawDxfReshapeGrips(grips)).toHaveLength(4);
  });

  it('keeps polyline grips (polylineGripKind is a raw-DXF discriminator, not BIM)', () => {
    const grips = [
      g({ gripIndex: 0, type: 'vertex', polylineGripKind: 'polyline-vertex-0' }),
      g({ gripIndex: 1, type: 'edge', polylineGripKind: 'polyline-arc-midpoint-0', edgeVertexIndices: [0, 1] }),
    ];
    expect(rawDxfReshapeGrips(grips)).toHaveLength(2);
  });

  it('drops BIM-structural grips defensively (slab / wall / column …)', () => {
    const grips = [
      g({ gripIndex: 0, slabGripKind: 'slab-vertex-0', gripKind: { on: 'slab', kind: 'slab-vertex-0' } }),
      g({ gripIndex: 1, wallGripKind: 'wall-start', gripKind: { on: 'wall', kind: 'wall-start' } }),
      g({ gripIndex: 2, columnGripKind: 'column-rotation', gripKind: { on: 'column', kind: 'column-rotation' } }),
      g({ gripIndex: 3, type: 'vertex' }), // raw — kept
    ];
    const out = rawDxfReshapeGrips(grips);
    expect(out).toHaveLength(1);
    expect(out[0].gripIndex).toBe(3);
  });

  it('preserves input order (stable flat indices for the controller hit-test)', () => {
    const grips = [g({ gripIndex: 5 }), g({ gripIndex: 2 }), g({ gripIndex: 9 })];
    expect(rawDxfReshapeGrips(grips).map((x) => x.gripIndex)).toEqual([5, 2, 9]);
  });
});

// ADR-537 γ — seat grips in mm so they align with the mm-based plan projector at any unit.
describe('scaleDxfGripsToMm', () => {
  it('returns the input untouched (fresh array) at unitToMm = 1 (mm scenes)', () => {
    const grips = [g({ position: { x: 7, y: 3 } })];
    const out = scaleDxfGripsToMm(grips, 1);
    expect(out).not.toBe(grips); // fresh array
    expect(out[0].position).toEqual({ x: 7, y: 3 });
  });

  it('scales each grip position to mm for a cm scene (unitToMm = 10)', () => {
    const grips = [g({ position: { x: 5, y: 2 } }), g({ position: { x: -1, y: 4 } })];
    const out = scaleDxfGripsToMm(grips, 10);
    expect(out[0].position).toEqual({ x: 50, y: 20 });
    expect(out[1].position).toEqual({ x: -10, y: 40 });
  });

  it('leaves index / discriminator fields untouched (only position is geometric)', () => {
    const grips = [g({ gripIndex: 3, type: 'edge', edgeVertexIndices: [0, 1], position: { x: 1, y: 1 } })];
    const [out] = scaleDxfGripsToMm(grips, 1000);
    expect(out.gripIndex).toBe(3);
    expect(out.type).toBe('edge');
    expect(out.edgeVertexIndices).toEqual([0, 1]);
    expect(out.position).toEqual({ x: 1000, y: 1000 });
  });
});
