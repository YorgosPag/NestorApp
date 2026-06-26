/**
 * ADR-537 — rawDxfReshapeGrips: which raw-DXF grips surface in 3D.
 *
 * Unlike the BIM footprint filter, raw DXF wants FULL 2D parity: vertices + edge
 * midpoints + whole-entity move grips (line midpoint / circle & arc centre) all stay.
 * The only thing stripped is a BIM-structural `*GripKind` (a raw DXF entity never has one).
 */

import type { GripInfo } from '../../../hooks/grip-types';
import { rawDxfReshapeGrips } from '../grip-3d-dxf-raw-grips';

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
      g({ gripIndex: 0, slabGripKind: 'slab-vertex-0' }),
      g({ gripIndex: 1, wallGripKind: 'wall-start' }),
      g({ gripIndex: 2, columnGripKind: 'column-rotation' }),
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
