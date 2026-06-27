/**
 * ADR-363 «Δοκάρι από τοίχο» — BeamFromWallGhost scene-management smoke tests.
 *
 * The SSoT builder + converter are mocked (covered by their own suites); here we
 * verify the ghost's lifecycle: add-on-show, reuse-same-wall, replace-on-new-wall,
 * visibility toggle, non-pickable, build-failure-hides, and clean teardown.
 */

import * as THREE from 'three';

let mockBuildOk = true;
jest.mock('../../../bim/beams/beam-from-wall', () => ({
  buildBeamFromWall: jest.fn(() =>
    mockBuildOk
      ? { ok: true, entity: { id: 'ghost-beam', params: {}, geometry: {} } }
      : { ok: false, hardErrors: ['x'] },
  ),
}));
jest.mock('../../converters/BimToThreeConverter', () => ({
  beamToMesh: jest.fn(() => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())),
}));
jest.mock('../../../bim/beams/beam-tool-bridge-store', () => ({
  beamToolBridgeStore: { get: () => ({ overrides: {}, getSceneUnits: () => 'm' }) },
}));
jest.mock('../../stores/Bim3DEntitiesStore', () => ({
  useBim3DEntitiesStore: { getState: () => ({ activeLevelId: 'L1' }) },
}));
jest.mock('../raycast-floor-point', () => ({
  resolveActiveFloorElevationMm: jest.fn(() => 0),
}));

import { BeamFromWallGhost } from '../BeamFromWallGhost';
import { collectPostFxOverlayRoots } from '../../scene/post-fx-overlay-pass';
import type { WallEntity } from '../../../bim/types/wall-types';

const wallA = { id: 'wall-A' } as unknown as WallEntity;
const wallB = { id: 'wall-B' } as unknown as WallEntity;

describe('BeamFromWallGhost', () => {
  beforeEach(() => { mockBuildOk = true; });

  it('adds nothing to the scene until showForWall() is called', () => {
    const scene = new THREE.Scene();
    new BeamFromWallGhost(scene);
    expect(scene.children).toHaveLength(0);
  });

  it('showForWall() adds one translucent, non-pickable mesh', () => {
    const scene = new THREE.Scene();
    const ghost = new BeamFromWallGhost(scene);
    ghost.showForWall(wallA);
    expect(scene.children).toHaveLength(1);
    const mesh = scene.children[0] as THREE.Mesh;
    expect((mesh.material as THREE.Material).transparent).toBe(true);
    const hits: THREE.Intersection[] = [];
    mesh.raycast(new THREE.Raycaster(), hits);
    expect(hits).toHaveLength(0);
  });

  it('showForWall() with the SAME wall ref reuses the mesh (no accumulation)', () => {
    const scene = new THREE.Scene();
    const ghost = new BeamFromWallGhost(scene);
    ghost.showForWall(wallA);
    ghost.showForWall(wallA);
    ghost.showForWall(wallA);
    expect(scene.children).toHaveLength(1);
  });

  it('showForWall() with a NEW wall ref replaces the mesh (still one)', () => {
    const scene = new THREE.Scene();
    const ghost = new BeamFromWallGhost(scene);
    ghost.showForWall(wallA);
    ghost.showForWall(wallB);
    expect(scene.children).toHaveLength(1);
  });

  it('hide() toggles the post-FX overlay exposure (ADR-537); re-show restores it', () => {
    const scene = new THREE.Scene();
    const ghost = new BeamFromWallGhost(scene);
    ghost.showForWall(wallA);
    expect(collectPostFxOverlayRoots(scene)).toHaveLength(1);
    ghost.hide();
    // The mesh stays in the scene (reuse) but the overlay no longer exposes it.
    expect(scene.children).toHaveLength(1);
    expect(collectPostFxOverlayRoots(scene)).toHaveLength(0);
    ghost.showForWall(wallA);
    expect(collectPostFxOverlayRoots(scene)).toHaveLength(1);
  });

  it('build failure hides instead of adding a mesh', () => {
    mockBuildOk = false;
    const scene = new THREE.Scene();
    const ghost = new BeamFromWallGhost(scene);
    ghost.showForWall(wallA);
    expect(scene.children).toHaveLength(0);
  });

  it('dispose() removes the mesh from the scene', () => {
    const scene = new THREE.Scene();
    const ghost = new BeamFromWallGhost(scene);
    ghost.showForWall(wallA);
    ghost.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('showForWall() after dispose is a no-op', () => {
    const scene = new THREE.Scene();
    const ghost = new BeamFromWallGhost(scene);
    ghost.dispose();
    ghost.showForWall(wallA);
    expect(scene.children).toHaveLength(0);
  });
});
