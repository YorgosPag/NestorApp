/**
 * ADR-535 Φ4 — `buildFootprintVertexOpCommand` (shared footprint vertex-op SSoT).
 *
 * The sibling of `polyline-grip-ops.test.ts`. Verifies the ONE builder both the 2D
 * grip context menu and the 3D viewport vertex menu use:
 *   - delete-corner on a vertex grip → the right `Update*ParamsCommand`, all four
 *     families (slab / roof / floor-finish / slab-opening);
 *   - add-corner on an edge-midpoint grip → a command (vertex inserted at the midpoint);
 *   - the minimum-triangle guard (≤3 vertices) → null;
 *   - unknown entity / wrong entity type / missing discriminator → null.
 */

import { buildFootprintVertexOpCommand } from '../footprint-grip-ops';
import { createMockSceneManager } from '../../../core/commands/__tests__/mock-scene-manager';
import { applyRoofShapePreset } from '../../../bim/geometry/roof-geometry';
import type { SceneEntity } from '../../../core/commands/interfaces';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';
import type { Point3D, Polygon3D } from '../../../bim/types/bim-base';

const QUAD: Point3D[] = [
  { x: 0, y: 0, z: 0 }, { x: 4000, y: 0, z: 0 }, { x: 4000, y: 3000, z: 0 }, { x: 0, y: 3000, z: 0 },
];
const TRI: Point3D[] = [{ x: 0, y: 0, z: 0 }, { x: 4000, y: 0, z: 0 }, { x: 2000, y: 3000, z: 0 }];

function grip(over: Partial<UnifiedGripInfo>): UnifiedGripInfo {
  return {
    id: 'g', source: 'dxf', entityId: 'e', gripIndex: 0, type: 'vertex',
    position: { x: 0, y: 0 }, movesEntity: false, ...over,
  } as UnifiedGripInfo;
}

function slabEntity(verts: Point3D[] = QUAD): SceneEntity {
  return { id: 'e', type: 'slab', params: { kind: 'floor', outline: { vertices: verts }, thickness: 200, levelElevation: 0, sceneUnits: 'mm' } } as unknown as SceneEntity;
}
function roofEntity(verts: Point3D[] = QUAD): SceneEntity {
  const outline: Polygon3D = { vertices: verts };
  return { id: 'e', type: 'roof', params: { outline, edges: applyRoofShapePreset(outline, 'gable', 30, 'deg'), slopeUnit: 'deg', basePivotZ: 3000, thickness: 200, sceneUnits: 'mm' } } as unknown as SceneEntity;
}
function floorFinishEntity(verts: Point3D[] = QUAD): SceneEntity {
  return { id: 'e', type: 'floor-finish', params: { footprint: { vertices: verts }, materialId: 'm', thicknessMm: 20, finishLevel: 0, sceneUnits: 'mm' } } as unknown as SceneEntity;
}
function slabOpeningEntity(verts: Point3D[] = QUAD): SceneEntity {
  return { id: 'e', type: 'slab-opening', params: { kind: 'shaft', slabId: 'sl', outline: { vertices: verts }, sceneUnits: 'mm' } } as unknown as SceneEntity;
}

describe('buildFootprintVertexOpCommand (ADR-535 Φ4)', () => {
  const cases: { name: string; entity: (v?: Point3D[]) => SceneEntity; type: string }[] = [
    { name: 'slab', entity: slabEntity, type: 'update-slab-params' },
    { name: 'roof', entity: roofEntity, type: 'update-roof-params' },
    { name: 'floor-finish', entity: floorFinishEntity, type: 'update-floor-finish-params' },
    { name: 'slab-opening', entity: slabOpeningEntity, type: 'update-slab-opening-params' },
  ];

  for (const c of cases) {
    const vertexKind = `${c.name}-vertex-0`;
    const edgeKind = `${c.name}-edge-midpoint-0`;

    it(`${c.name}: delete-corner on a quad → ${c.type}`, () => {
      const sm = createMockSceneManager([c.entity()]);
      const cmd = buildFootprintVertexOpCommand(
        grip({ gripKind: { on: c.name, kind: vertexKind } } as Partial<UnifiedGripInfo>),
        'delete-corner', sm,
      );
      expect(cmd?.type).toBe(c.type);
    });

    it(`${c.name}: add-corner on an edge-midpoint → ${c.type}`, () => {
      const sm = createMockSceneManager([c.entity()]);
      const cmd = buildFootprintVertexOpCommand(
        grip({ gripKind: { on: c.name, kind: edgeKind }, type: 'edge' } as Partial<UnifiedGripInfo>),
        'add-corner', sm,
      );
      expect(cmd?.type).toBe(c.type);
    });

    it(`${c.name}: delete-corner at the minimum triangle → null (guard)`, () => {
      const sm = createMockSceneManager([c.entity(TRI)]);
      const cmd = buildFootprintVertexOpCommand(
        grip({ gripKind: { on: c.name, kind: vertexKind } } as Partial<UnifiedGripInfo>),
        'delete-corner', sm,
      );
      expect(cmd).toBeNull();
    });
  }

  it('returns null for an unknown entity id', () => {
    const sm = createMockSceneManager([]);
    expect(buildFootprintVertexOpCommand(
      grip({ gripKind: { on: 'slab', kind: 'slab-vertex-0' } } as Partial<UnifiedGripInfo>),
      'delete-corner', sm,
    )).toBeNull();
  });

  it('returns null when the entity type mismatches the grip discriminator', () => {
    const sm = createMockSceneManager([roofEntity()]); // entity is a roof…
    // …but the grip claims a slab kind → guard rejects.
    expect(buildFootprintVertexOpCommand(
      grip({ gripKind: { on: 'slab', kind: 'slab-vertex-0' } } as Partial<UnifiedGripInfo>),
      'delete-corner', sm,
    )).toBeNull();
  });

  it('returns null when no footprint discriminator is present', () => {
    const sm = createMockSceneManager([slabEntity()]);
    expect(buildFootprintVertexOpCommand(grip({}), 'delete-corner', sm)).toBeNull();
  });
});
