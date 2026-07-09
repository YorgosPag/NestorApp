/**
 * ADR-618 — createPlacementGhostClass factory contract tests.
 *
 * Covers the generic lifecycle the 7 point-placement ghosts inherit, using a FAKE
 * config (no real SSoT modules): build-on-update, replace-not-accumulate, id-stable
 * rebuild, build-null → hide, optional per-frame recolour, and disposed no-op.
 * The concrete bindings (Column/MEP/…) are smoke-tested by their own suites.
 */

import * as THREE from 'three';
import { createPlacementGhostClass } from '../create-placement-ghost';
import { collectPostFxOverlayRoots } from '../../scene/post-fx-overlay-pass';

interface FakeParams {
  readonly x: number;
}
interface FakeEntity {
  readonly id: string;
  readonly params: FakeParams;
  readonly geometry: { readonly built: boolean };
}
interface FakeHandle {
  getSceneUnits(): 'mm';
  readonly overrides: Record<string, never>;
}

function makeConfig(overrides: {
  buildOk?: boolean;
  resolveColor?: (entity: FakeEntity) => number | undefined;
} = {}) {
  const buildEntity = jest.fn((params: FakeParams, layerId: string) =>
    overrides.buildOk === false
      ? ({ ok: false } as const)
      : ({ ok: true, entity: { id: `${layerId}-${params.x}`, params, geometry: { built: true } } } as const),
  );
  const toMesh = jest.fn(
    () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()),
  );
  const GhostClass = createPlacementGhostClass<FakeEntity, FakeParams, FakeHandle>({
    color: 0x123456,
    layerId: '__ghost-fake__',
    bridgeStore: { get: () => ({ getSceneUnits: () => 'mm', overrides: {} }) },
    buildParams: (scenePoint) => ({ x: scenePoint.x }),
    computeGeometry: () => ({ built: true }),
    buildEntity,
    toMesh,
    resolveColor: overrides.resolveColor,
  });
  return { GhostClass, buildEntity, toMesh };
}

describe('createPlacementGhostClass', () => {
  it('adds nothing until update() is called', () => {
    const scene = new THREE.Scene();
    const { GhostClass } = makeConfig();
    new GhostClass(scene);
    expect(scene.children).toHaveLength(0);
  });

  it('update() adds one translucent, non-pickable, main-render-invisible mesh', () => {
    const scene = new THREE.Scene();
    const { GhostClass } = makeConfig();
    new GhostClass(scene).update({ x: 5, y: 0 }, 0, 'L1');
    expect(scene.children).toHaveLength(1);
    const mesh = scene.children[0] as THREE.Mesh;
    expect((mesh.material as THREE.Material).transparent).toBe(true);
    expect(mesh.visible).toBe(false);
    const hits: THREE.Intersection[] = [];
    mesh.raycast(new THREE.Raycaster(), hits);
    expect(hits).toHaveLength(0);
  });

  it('validates + assigns an id ONCE, then reuses it on rebuild (no id churn)', () => {
    const scene = new THREE.Scene();
    const { GhostClass, buildEntity } = makeConfig();
    const ghost = new GhostClass(scene);
    ghost.update({ x: 1, y: 0 }, 0, 'L1');
    ghost.update({ x: 2, y: 0 }, 0, 'L1');
    ghost.update({ x: 3, y: 0 }, 0, 'L1');
    expect(scene.children).toHaveLength(1); // replace, not accumulate
    expect(buildEntity).toHaveBeenCalledTimes(1); // id assigned once
  });

  it('hides (no object) when buildEntity fails validation', () => {
    const scene = new THREE.Scene();
    const { GhostClass, toMesh } = makeConfig({ buildOk: false });
    new GhostClass(scene).update({ x: 9, y: 0 }, 0, 'L1');
    expect(scene.children).toHaveLength(0);
    expect(toMesh).not.toHaveBeenCalled();
  });

  it('applies the optional per-frame recolour to the ghost material', () => {
    const scene = new THREE.Scene();
    const { GhostClass } = makeConfig({ resolveColor: () => 0x00ff00 });
    new GhostClass(scene).update({ x: 1, y: 0 }, 0, 'L1');
    const mesh = scene.children[0] as THREE.Mesh;
    expect((mesh.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x00ff00);
  });

  it('setVisible toggles the post-FX overlay exposure; dispose() tears down', () => {
    const scene = new THREE.Scene();
    const { GhostClass } = makeConfig();
    const ghost = new GhostClass(scene);
    ghost.update({ x: 1, y: 0 }, 0, 'L1');
    ghost.setVisible(true);
    expect(collectPostFxOverlayRoots(scene)).toHaveLength(1);
    ghost.dispose();
    expect(scene.children).toHaveLength(0);
    expect(collectPostFxOverlayRoots(scene)).toHaveLength(0);
  });

  it('update() after dispose is a no-op', () => {
    const scene = new THREE.Scene();
    const { GhostClass } = makeConfig();
    const ghost = new GhostClass(scene);
    ghost.dispose();
    ghost.update({ x: 1, y: 0 }, 0, 'L1');
    expect(scene.children).toHaveLength(0);
  });
});
