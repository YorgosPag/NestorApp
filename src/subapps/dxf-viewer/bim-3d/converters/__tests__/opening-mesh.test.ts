/**
 * ADR-421 §A6 — `buildOpeningMesh` parametric 3D opening body tests.
 *
 * Coverage:
 *   - door (sill=0) → frame (2 jambs + head) + 1 leaf = 4 meshes.
 *   - double-door → frame (3) + 2 leaves = 5 meshes.
 *   - window (sill>0) → frame (3 + sill bar) + 1 panel = 5 meshes· panel = glass.
 *   - degenerate (width 0) → null.
 *   - group tagged userData.bimType='opening'.
 */

import * as THREE from 'three';
import { buildOpeningMesh, type OpeningMeshMaterials } from '../opening-mesh';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../../bim/types/opening-types';

function makeWall(): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling',
    baseOffset: 0, topOffset: 0, sceneUnits: 'm',
  };
  return {
    id: 'wall_test', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

function makeOpening(overrides?: Partial<OpeningParams>): OpeningEntity {
  const params: OpeningParams = {
    kind: 'door', wallId: 'wall_test', offsetFromStart: 1000,
    width: 900, height: 2100, sillHeight: 0, frameWidth: 50, ...overrides,
  };
  return {
    id: 'op_test', type: 'opening', kind: params.kind, layerId: '0', params,
    geometry: {
      position: { x: 1.45, y: 0, z: 0 }, rotation: 0, outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, perimeter: 0,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as OpeningEntity;
}

const materials: OpeningMeshMaterials = {
  frame: new THREE.MeshStandardMaterial(),
  leaf: new THREE.MeshStandardMaterial(),
  glass: new THREE.MeshStandardMaterial(),
};

describe('buildOpeningMesh', () => {
  it('door (sill=0) → 4 meshes (2 jambs + head + 1 leaf)', () => {
    const g = buildOpeningMesh(makeOpening(), makeWall(), materials, 0, 0);
    expect(g).not.toBeNull();
    expect(g!.children).toHaveLength(4);
  });

  it('double-door → 5 meshes (frame 3 + 2 leaves)', () => {
    const g = buildOpeningMesh(makeOpening({ kind: 'double-door', width: 1400 }), makeWall(), materials, 0, 0);
    expect(g!.children).toHaveLength(5);
  });

  it('window (sill>0) → 5 meshes (frame 4 + 1 glass panel)', () => {
    const g = buildOpeningMesh(
      makeOpening({ kind: 'window', width: 1200, height: 1400, sillHeight: 900 }),
      makeWall(), materials, 0, 0,
    );
    expect(g!.children).toHaveLength(5);
    const usesGlass = g!.children.some(
      (c) => (c as THREE.Mesh).material === materials.glass,
    );
    expect(usesGlass).toBe(true);
  });

  it('degenerate width=0 → null', () => {
    const g = buildOpeningMesh(makeOpening({ width: 0 }), makeWall(), materials, 0, 0);
    expect(g).toBeNull();
  });

  it("group tagged userData.bimType='opening'", () => {
    const g = buildOpeningMesh(makeOpening(), makeWall(), materials, 0, 0);
    expect(g!.userData['bimType']).toBe('opening');
    expect(g!.userData['bimId']).toBe('op_test');
  });

  // ─── ADR-421 SLICE B — fan-out family 3D bodies ───────────────────────────
  describe('SLICE B families (frame + leaf counts)', () => {
    const count = (overrides: Parameters<typeof makeOpening>[0]): number =>
      buildOpeningMesh(makeOpening(overrides), makeWall(), materials, 0, 0)!.children.length;

    it('double-sliding-door → 3 frame + 2 panels = 5', () => {
      expect(count({ kind: 'double-sliding-door', width: 2400 })).toBe(5);
    });

    it('pocket-door → 3 frame + 1 panel = 4', () => {
      expect(count({ kind: 'pocket-door' })).toBe(4);
    });

    it('bifold-door → 3 frame + 3 folded panels = 6', () => {
      expect(count({ kind: 'bifold-door', width: 1800 })).toBe(6);
    });

    it('overhead-door → 3 frame + 5 slats = 8', () => {
      expect(count({ kind: 'overhead-door', width: 2400, height: 2200 })).toBe(8);
    });

    it('revolving-door → 3 frame + 2 blades + post = 6', () => {
      expect(count({ kind: 'revolving-door', width: 2000, height: 2200 })).toBe(6);
    });

    it('double-hung-window (sill>0) → 4 frame + 2 glass sashes = 6', () => {
      const g = buildOpeningMesh(
        makeOpening({ kind: 'double-hung-window', width: 900, height: 1500, sillHeight: 900 }),
        makeWall(), materials, 0, 0,
      );
      expect(g!.children).toHaveLength(6);
      expect(g!.children.some((c) => (c as THREE.Mesh).material === materials.glass)).toBe(true);
    });

    it('sliding-window (sill>0) → 4 frame + 2 sashes = 6', () => {
      expect(count({ kind: 'sliding-window', width: 1500, height: 1200, sillHeight: 900 })).toBe(6);
    });

    it('awning-window (sill>0) → 4 frame + 1 panel = 5', () => {
      expect(count({ kind: 'awning-window', width: 900, height: 600, sillHeight: 1800 })).toBe(5);
    });

    it('bay-window (sill>0) → 4 frame + 1 projecting body = 5', () => {
      expect(count({ kind: 'bay-window', width: 2400, height: 1500, sillHeight: 600 })).toBe(5);
    });
  });
});
