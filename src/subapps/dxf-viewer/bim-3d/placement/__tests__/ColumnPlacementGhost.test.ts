/**
 * ADR-403 — ColumnPlacementGhost scene-management smoke tests.
 *
 * The SSoT builders + converter are mocked (covered by their own suites); here we
 * verify the ghost's lifecycle: add-on-update, replace-not-accumulate, visibility
 * toggle, non-pickable, and clean teardown.
 */

import * as THREE from 'three';

jest.mock('../../../hooks/drawing/column-completion', () => ({
  buildDefaultColumnParams: jest.fn(() => ({ kind: 'rectangular', position: { x: 0, y: 0, z: 0 } })),
  buildColumnEntity: jest.fn(() => ({ ok: true, entity: { id: 'ghost', params: {}, geometry: {} } })),
}));
jest.mock('../../../bim/geometry/column-geometry', () => ({
  computeColumnGeometry: jest.fn(() => ({ footprint: { vertices: [] } })),
}));
jest.mock('../../converters/BimToThreeConverter', () => ({
  columnToMesh: jest.fn(() => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())),
}));
jest.mock('../../../ui/ribbon/hooks/bridge/column-tool-bridge-store', () => ({
  columnToolBridgeStore: {
    get: () => ({ kind: 'rectangular', anchor: 'center', overrides: {}, getSceneUnits: () => 'm' }),
  },
}));

import { ColumnPlacementGhost } from '../ColumnPlacementGhost';
import { collectPostFxOverlayRoots } from '../../scene/post-fx-overlay-pass';

describe('ColumnPlacementGhost', () => {
  it('adds nothing to the scene until update() is called', () => {
    const scene = new THREE.Scene();
    new ColumnPlacementGhost(scene);
    expect(scene.children).toHaveLength(0);
  });

  it('update() adds one translucent, non-pickable mesh kept invisible to the main render', () => {
    const scene = new THREE.Scene();
    const ghost = new ColumnPlacementGhost(scene);
    ghost.update({ x: 1, y: 2 }, 0, 'L1');
    expect(scene.children).toHaveLength(1);
    const mesh = scene.children[0] as THREE.Mesh;
    expect((mesh.material as THREE.Material).transparent).toBe(true);
    // ADR-537 — root kept visible=false so the MAIN render skips it (post-FX pass draws it).
    expect(mesh.visible).toBe(false);
    // raycast is stubbed out so the ghost never intercepts picks.
    const hits: THREE.Intersection[] = [];
    mesh.raycast(new THREE.Raycaster(), hits);
    expect(hits).toHaveLength(0);
  });

  it('repeated update() replaces the mesh (no accumulation)', () => {
    const scene = new THREE.Scene();
    const ghost = new ColumnPlacementGhost(scene);
    ghost.update({ x: 1, y: 2 }, 0, 'L1');
    ghost.update({ x: 3, y: 4 }, 0, 'L1');
    ghost.update({ x: 5, y: 6 }, 0, 'L1');
    expect(scene.children).toHaveLength(1);
  });

  it('setVisible toggles the post-FX overlay exposure (ADR-537), not the root visibility', () => {
    const scene = new THREE.Scene();
    const ghost = new ColumnPlacementGhost(scene);
    ghost.update({ x: 1, y: 2 }, 0, 'L1');
    ghost.setVisible(true);
    expect(collectPostFxOverlayRoots(scene)).toHaveLength(1);
    // The root never becomes visible to the main render — the pass flips it on transiently.
    expect((scene.children[0] as THREE.Mesh).visible).toBe(false);
    ghost.setVisible(false);
    expect(collectPostFxOverlayRoots(scene)).toHaveLength(0);
  });

  it('dispose() removes the mesh + unregisters the overlay', () => {
    const scene = new THREE.Scene();
    const ghost = new ColumnPlacementGhost(scene);
    ghost.update({ x: 1, y: 2 }, 0, 'L1');
    ghost.setVisible(true);
    ghost.dispose();
    expect(scene.children).toHaveLength(0);
    expect(collectPostFxOverlayRoots(scene)).toHaveLength(0);
  });

  it('update() after dispose is a no-op', () => {
    const scene = new THREE.Scene();
    const ghost = new ColumnPlacementGhost(scene);
    ghost.dispose();
    ghost.update({ x: 1, y: 2 }, 0, 'L1');
    expect(scene.children).toHaveLength(0);
  });
});
