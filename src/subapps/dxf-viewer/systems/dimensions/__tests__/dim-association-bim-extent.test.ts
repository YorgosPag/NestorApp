/**
 * ADR-563 Φ2 — `bimExtent` associativity: auto-dimensions follow their BIM host
 * (wall/column/foundation) on geometry change, locked to the measured axis.
 */

import { applyAssociationUpdates } from '../dim-association-service';
import type { DimensionAssociation, LinearDimensionEntity } from '../../../types/dimension';
import type { SceneEntity } from '../../../core/commands/interfaces';

function wallAt(minX: number, minY: number, maxX: number, maxY: number): SceneEntity {
  return {
    id: 'w1',
    type: 'wall',
    geometry: { bbox: { min: { x: minX, y: minY, z: 0 }, max: { x: maxX, y: maxY, z: 0 } } },
  } as unknown as SceneEntity;
}

function dimWith(assoc: DimensionAssociation): LinearDimensionEntity {
  return {
    id: 'd1',
    type: 'dimension',
    layerId: 'lyr',
    dimensionType: 'linear',
    styleId: 's',
    defPoints: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 0, y: -600 }],
    rotation: 0,
    associations: [assoc],
  };
}

describe('applyAssociationUpdates — bimExtent', () => {
  it('follows the host bbox min on the X axis, preserving the perpendicular', () => {
    const dim = dimWith({ defPointIndex: 0, geometryId: 'w1', associationType: 'bimExtent', bimAnchor: { axis: 'x', edge: 'min' } });
    const { updated } = applyAssociationUpdates(dim, () => wallAt(100, 0, 400, 200)); // moved +100 in X
    expect(updated.defPoints[0]).toEqual({ x: 100, y: 0 });
  });

  it('follows the host bbox max on the X axis', () => {
    const dim = dimWith({ defPointIndex: 1, geometryId: 'w1', associationType: 'bimExtent', bimAnchor: { axis: 'x', edge: 'max' } });
    const { updated } = applyAssociationUpdates(dim, () => wallAt(0, 0, 500, 200)); // maxX 400→500
    expect(updated.defPoints[1]).toEqual({ x: 500, y: 0 });
  });

  it('follows the Y axis while keeping X fixed', () => {
    const dim = dimWith({ defPointIndex: 0, geometryId: 'w1', associationType: 'bimExtent', bimAnchor: { axis: 'y', edge: 'min' } });
    const { updated } = applyAssociationUpdates(dim, () => wallAt(0, 50, 400, 200)); // minY 0→50
    expect(updated.defPoints[0]).toEqual({ x: 0, y: 50 });
  });

  it('uses the bbox center when edge is center', () => {
    const dim = dimWith({ defPointIndex: 0, geometryId: 'w1', associationType: 'bimExtent', bimAnchor: { axis: 'x', edge: 'center' } });
    const { updated } = applyAssociationUpdates(dim, () => wallAt(200, 0, 600, 200)); // center X = 400
    expect(updated.defPoints[0]).toEqual({ x: 400, y: 0 });
  });

  it('orphans (preserves def point) when the host is gone', () => {
    const dim = dimWith({ defPointIndex: 0, geometryId: 'w1', associationType: 'bimExtent', bimAnchor: { axis: 'x', edge: 'min' } });
    const { updated, orphanCount } = applyAssociationUpdates(dim, () => undefined);
    expect(orphanCount).toBe(1);
    expect(updated.defPoints[0]).toEqual({ x: 0, y: 0 });
  });
});
