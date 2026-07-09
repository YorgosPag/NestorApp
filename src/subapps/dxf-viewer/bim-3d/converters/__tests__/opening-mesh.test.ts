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
import { CATALOG_CUSTOM_SENTINEL } from '../../../bim/types/opening-frame-profile';

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

  // ─── ADR-568 — mm-scene (geo-referenced DXF) placement + sizing ────────────
  // The 3D world is in METRES. `geometry.position` is in SCENE UNITS, so it must
  // scale by `sceneToM` (mm → m = ×0.001), and the mm dims must become metres.
  // Regression guard for the «3D door body invisible» bug: the old `mmToSceneUnits`
  // factor left a mm-scene body 1000× oversized AND ~1000× too far from the wall.
  describe('mm-scene scaling (geo-referenced DXF)', () => {
    function makeMmWall(): WallEntity {
      const params: WallParams = {
        category: 'exterior',
        start: { x: 17137018, y: 4192517, z: 0 },
        end: { x: 17137018, y: 4189217, z: 0 },
        height: 3000, thickness: 100,
        flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling',
        baseOffset: 0, topOffset: 0, sceneUnits: 'mm',
      };
      return {
        id: 'wall_mm', type: 'wall', kind: 'straight', layerId: '0', params,
        geometry: computeWallGeometry(params, 'straight'),
        validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
        visible: true,
      } as unknown as WallEntity;
    }

    it('scales placement by sceneToM (mm → metres) and sizes the body in metres', () => {
      const opening = makeOpening();
      // position lives in scene units (mm) at the geo-referenced origin.
      (opening.geometry as { position: { x: number; y: number; z: number } }).position = {
        x: 17137018, y: 4190467, z: 0,
      };
      const g = buildOpeningMesh(opening, makeMmWall(), materials, 0, 0)!;
      expect(g).not.toBeNull();
      // Placement scaled 17_137_018 mm → 17_137.018 m (×0.001) — NOT left at ~1.7e7.
      expect(g.position.x).toBeCloseTo(17137.018, 2);
      expect(g.position.z).toBeCloseTo(-4190.467, 2);
      // Body sized in metres: a 900 mm door → ~0.9 m wide, NOT 900 units.
      const width = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).x;
      expect(width).toBeGreaterThan(0.5);
      expect(width).toBeLessThan(1.5);
    });
  });

  // ─── ADR-611 — frame profile: CONSTANT cross-section, independent of opening
  // size and of wall thickness. Bars are, in build order: jamb1, jamb2, head,
  // [sill], then leaf(s) — see `frameBars()` / SLICE B comments above.
  describe('ADR-611 frame profile — constant cross-section', () => {
    /** World-space (sx, sy, sz) of a box mesh, in metres. */
    function boxSize(mesh: THREE.Object3D): THREE.Vector3 {
      return new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    }

    it('jamb face-width/depth stay constant across opening widths (legacy frameWidth=50)', () => {
      for (const width of [700, 900, 1200, 2400]) {
        const g = buildOpeningMesh(makeOpening({ width }), makeWall(), materials, 0, 0)!;
        const jamb = boxSize(g.children[0]);
        // legacy `frameWidth: 50` (set by makeOpening's default params) resolves
        // faceWidth = depth = 50mm = 0.05m — regardless of opening width.
        expect(jamb.x).toBeCloseTo(0.05, 3);
        expect(jamb.z).toBeCloseTo(0.05, 3);
      }
    });

    it('head bar face-width/depth (sy, sz) stay constant across opening widths', () => {
      for (const width of [700, 900, 1200, 2400]) {
        const g = buildOpeningMesh(makeOpening({ width }), makeWall(), materials, 0, 0)!;
        const head = boxSize(g.children[2]);
        expect(head.y).toBeCloseTo(0.05, 3);
        expect(head.z).toBeCloseTo(0.05, 3);
        // head LENGTH (sx) legitimately tracks the opening width.
        expect(head.x).toBeCloseTo(width / 1000, 3);
      }
    });

    it('jamb face-width/depth stay constant across opening heights', () => {
      for (const height of [1800, 2100, 2400]) {
        const g = buildOpeningMesh(makeOpening({ height }), makeWall(), materials, 0, 0)!;
        const jamb = boxSize(g.children[0]);
        expect(jamb.x).toBeCloseTo(0.05, 3);
        expect(jamb.z).toBeCloseTo(0.05, 3);
        // jamb LENGTH (sy) legitimately tracks the opening height.
        expect(jamb.y).toBeCloseTo(height / 1000, 3);
      }
    });

    it('jamb sz equals resolved profile depth, NOT the host wall thickness', () => {
      // makeWall() thickness = 250mm (0.25m). A distinct faceWidth/depth override
      // (70mm × 90mm) must NOT be shadowed by the wall's 250mm thickness — that
      // was the pre-ADR-611 bug (`sz: thicknessW`). Per the resolver's documented
      // layering, a hand-edited dimension only "sticks" once a `frameProfileId`
      // (here the custom sentinel) is also set — mirrors the ribbon UI contract.
      const opening = makeOpening({
        frameWidth: undefined,
        frameProfileId: CATALOG_CUSTOM_SENTINEL,
        frameProfileOverrides: { faceWidth: 70, depth: 90 },
      });
      const g = buildOpeningMesh(opening, makeWall(), materials, 0, 0)!;
      const jamb = boxSize(g.children[0]);
      expect(jamb.x).toBeCloseTo(0.07, 3);
      expect(jamb.z).toBeCloseTo(0.09, 3);
      expect(jamb.z).not.toBeCloseTo(0.25, 3);
    });

    it('catalog frameProfileId resolves a distinct constant cross-section (Alumil Supreme S350: 84×75)', () => {
      const opening = makeOpening({ frameProfileId: 'ALUMIL-S350-frame' });
      const g = buildOpeningMesh(opening, makeWall(), materials, 0, 0)!;
      const jamb = boxSize(g.children[0]);
      expect(jamb.x).toBeCloseTo(0.084, 3);
      expect(jamb.z).toBeCloseTo(0.075, 3);
    });

    it('legacy opening with NO frameWidth and NO frameProfileId falls back to the catalog default (70×70)', () => {
      const opening = makeOpening({ frameWidth: undefined });
      const g = buildOpeningMesh(opening, makeWall(), materials, 0, 0)!;
      const jamb = boxSize(g.children[0]);
      expect(jamb.x).toBeCloseTo(0.07, 3);
      expect(jamb.z).toBeCloseTo(0.07, 3);
    });
  });
});
