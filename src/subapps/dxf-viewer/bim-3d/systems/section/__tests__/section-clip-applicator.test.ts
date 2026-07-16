/**
 * ADR-452 — clip applicator material safelist.
 * ADR-665 — per-scope routing (`'default'` = the building, `'topo'` = the terrain).
 *
 * The cut-plane / section clip must inject `clippingPlanes` ONLY into built-in
 * materials that ship clipping shader chunks. Fat-line (`LineMaterial`),
 * `ShaderMaterial`, sprites and points lack those chunks → injecting clip planes
 * throws a fragment-shader compile error, so they MUST be skipped.
 *
 * ADR-665 adds the second axis: the terrain carries its OWN level cut while the building stays
 * whole, so objects must be routed by scope — and thin lines are clippable ONLY in `'topo'`.
 */

import * as THREE from 'three';
import {
  applyClippingPlanes,
  clearClippingPlanes,
  isClippableMaterial,
  type ScopeClipPlanes,
} from '../section-clip-applicator';

const PLANE = new THREE.Plane(new THREE.Vector3(0, -1, 0), 3);
const TOPO_PLANE = new THREE.Plane(new THREE.Vector3(0, -1, 0), 5);

/** Read `clippingPlanes` off any material without leaking `any` into the test. */
function planesOf(material: THREE.Material): THREE.Plane[] | null {
  return (material as THREE.Material & { clippingPlanes?: THREE.Plane[] | null }).clippingPlanes ?? null;
}

/** A material tagged as the fat-line `LineMaterial` (three/examples), which must never be clipped. */
function fatLineMaterial(): THREE.Material {
  const mat = new THREE.MeshBasicMaterial();
  Object.defineProperty(mat, 'type', { value: 'LineMaterial' });
  return mat;
}

describe('isClippableMaterial', () => {
  it('allows built-in mesh materials', () => {
    expect(isClippableMaterial(new THREE.MeshStandardMaterial())).toBe(true);
    expect(isClippableMaterial(new THREE.MeshPhysicalMaterial())).toBe(true);
    expect(isClippableMaterial(new THREE.MeshBasicMaterial())).toBe(true);
  });

  it('skips fat-line / shader / sprite / points materials (clipping injection throws on them)', () => {
    // LineMaterial (three/examples) sets type 'LineMaterial'; emulate via a tagged material.
    // Confirmed at runtime: injecting clip planes into LineMaterial throws a fragment
    // shader compile error on this build → it MUST be skipped (edges handled geometrically).
    expect(isClippableMaterial(fatLineMaterial())).toBe(false);

    expect(isClippableMaterial(new THREE.ShaderMaterial())).toBe(false);
    expect(isClippableMaterial(new THREE.SpriteMaterial())).toBe(false);
    expect(isClippableMaterial(new THREE.PointsMaterial())).toBe(false);
  });

  it('ADR-665 — thin lines are clippable ONLY in the topo scope', () => {
    // The guard that gizmos / dimensions / focus outlines / DXF underlay stay unclipped:
    // ~20 bim-3d modules use LineBasicMaterial and none of them want the terrain's cut.
    expect(isClippableMaterial(new THREE.LineBasicMaterial(), 'default')).toBe(false);
    expect(isClippableMaterial(new THREE.LineDashedMaterial(), 'default')).toBe(false);
    expect(isClippableMaterial(new THREE.LineBasicMaterial(), 'topo')).toBe(true);
    expect(isClippableMaterial(new THREE.LineDashedMaterial(), 'topo')).toBe(true);
  });

  it('ADR-665 — the fat-line LineMaterial stays excluded in BOTH scopes', () => {
    expect(isClippableMaterial(fatLineMaterial(), 'default')).toBe(false);
    expect(isClippableMaterial(fatLineMaterial(), 'topo')).toBe(false);
  });

  it('defaults to the default (BIM) scope — pre-ADR-665 behaviour preserved', () => {
    expect(isClippableMaterial(new THREE.MeshStandardMaterial())).toBe(
      isClippableMaterial(new THREE.MeshStandardMaterial(), 'default'),
    );
  });
});

describe('applyClippingPlanes / clearClippingPlanes', () => {
  const planes: ScopeClipPlanes = { default: [PLANE], topo: [TOPO_PLANE] };

  function buildScene() {
    const scene = new THREE.Scene();
    const solid = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    // Fat-line edge overlay child (LineSegments2 extends Mesh → isMesh true).
    const edgeMat = fatLineMaterial();
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), edgeMat);
    solid.add(edge);
    // Section box part — excluded so it never clips itself.
    const boxPart = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    boxPart.userData['sectionBoxPart'] = true;
    scene.add(solid);
    scene.add(boxPart);
    return { scene, solid, edgeMat, boxPart };
  }

  it('writes planes to solid mesh materials but not to fat-line or box-part materials', () => {
    const { scene, solid, edgeMat, boxPart } = buildScene();
    applyClippingPlanes(scene, planes);

    expect((solid.material as THREE.MeshStandardMaterial).clippingPlanes).toEqual([PLANE]);
    // Fat-line edge stays unclipped (clipping injection throws on LineMaterial); the
    // overlay above the cut is suppressed geometrically by SectionSceneController.
    expect(planesOf(edgeMat)).toBeNull();
    // Section box part excluded (must not clip itself).
    expect(planesOf(boxPart.material as THREE.Material)).toBeNull();
  });

  it('clears planes from solid materials', () => {
    const { scene, solid } = buildScene();
    applyClippingPlanes(scene, planes);
    clearClippingPlanes(scene);
    expect((solid.material as THREE.MeshStandardMaterial).clippingPlanes).toBeNull();
  });

  it('is idempotent — applying twice leaves identical state', () => {
    const { scene, solid } = buildScene();
    applyClippingPlanes(scene, planes);
    applyClippingPlanes(scene, planes);
    expect((solid.material as THREE.MeshStandardMaterial).clippingPlanes).toEqual([PLANE]);
  });
});

describe('ADR-665 — per-scope routing', () => {
  const planes: ScopeClipPlanes = { default: [PLANE], topo: [TOPO_PLANE] };

  function buildTopoScene() {
    const scene = new THREE.Scene();

    // The building — must NEVER receive the terrain's level cut.
    const building = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    scene.add(building);

    // A BIM gizmo/dimension line outside the topo scope — must stay unclipped entirely.
    const gizmo = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
    scene.add(gizmo);

    // The topo layer root, marked by `seatTopoLayerRoot`.
    const topoRoot = new THREE.Group();
    topoRoot.userData['topoClipScope'] = true;
    const terrain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    topoRoot.add(terrain);
    // Contours nested one level deeper — scope must be INHERITED, not matched on the object itself.
    const nest = new THREE.Group();
    const contour = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
    nest.add(contour);
    topoRoot.add(nest);
    scene.add(topoRoot);

    return { scene, building, gizmo, topoRoot, terrain, contour };
  }

  it('the building gets the default planes, the terrain gets the topo planes', () => {
    const { scene, building, terrain } = buildTopoScene();
    applyClippingPlanes(scene, planes);

    expect((building.material as THREE.MeshStandardMaterial).clippingPlanes).toEqual([PLANE]);
    expect((terrain.material as THREE.MeshStandardMaterial).clippingPlanes).toEqual([TOPO_PLANE]);
  });

  it('a grandchild of the topo root inherits the topo scope', () => {
    const { scene, contour } = buildTopoScene();
    applyClippingPlanes(scene, planes);
    expect((contour.material as THREE.LineBasicMaterial).clippingPlanes).toEqual([TOPO_PLANE]);
  });

  it('an IDENTICAL line outside the topo scope is NOT clipped', () => {
    // The load-bearing guard: widening the allowlist must not reach gizmos/dimensions/underlay.
    const { scene, gizmo } = buildTopoScene();
    applyClippingPlanes(scene, planes);
    expect(planesOf(gizmo.material as THREE.Material)).toBeNull();
  });

  it('the terrain can be cut while the building is NOT (topo-only cut)', () => {
    // Exactly Giorgio's requirement: «το χώμα κόβεται, το κτίριο μένει ακέραιο».
    const { scene, building, terrain, contour } = buildTopoScene();
    applyClippingPlanes(scene, { default: [], topo: [TOPO_PLANE] });

    expect((building.material as THREE.MeshStandardMaterial).clippingPlanes).toEqual([]);
    expect((terrain.material as THREE.MeshStandardMaterial).clippingPlanes).toEqual([TOPO_PLANE]);
    expect((contour.material as THREE.LineBasicMaterial).clippingPlanes).toEqual([TOPO_PLANE]);
  });

  it('a subtree call re-asserts the topo scope and leaves outside objects untouched', () => {
    // The `reapplyClipPlanesUnder` contract: a rebuilt layer re-asserts its own planes only.
    const { scene, building, topoRoot, terrain } = buildTopoScene();
    applyClippingPlanes(scene, planes);
    clearClippingPlanes(scene);

    applyClippingPlanes(topoRoot, planes);

    expect((terrain.material as THREE.MeshStandardMaterial).clippingPlanes).toEqual([TOPO_PLANE]);
    expect((building.material as THREE.MeshStandardMaterial).clippingPlanes).toBeNull();
  });

  it('clearClippingPlanes nulls BOTH scopes', () => {
    const { scene, building, terrain, contour } = buildTopoScene();
    applyClippingPlanes(scene, planes);
    clearClippingPlanes(scene);

    expect((building.material as THREE.MeshStandardMaterial).clippingPlanes).toBeNull();
    expect((terrain.material as THREE.MeshStandardMaterial).clippingPlanes).toBeNull();
    expect((contour.material as THREE.LineBasicMaterial).clippingPlanes).toBeNull();
  });
});
