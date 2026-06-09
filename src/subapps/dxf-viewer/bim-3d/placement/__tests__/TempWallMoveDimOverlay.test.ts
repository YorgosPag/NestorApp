/**
 * ADR-363 Φ1G.5 Slice 2h — TempWallMoveDimOverlay orchestration tests.
 *
 * The reference maths (`resolveWallMoveDimReferences`) runs for real; the dimension
 * renderer is mocked so the focus is the overlay's lifecycle: build/update one witness
 * line per perpendicular side, reuse renderers across frames, react to the live gizmo
 * translation, hide()/dispose().
 */

jest.mock('../../dimensions/Dimension3DRenderer', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const THREE = require('three');
  return {
    createDimension3DRenderer: jest.fn(() => ({
      root: new THREE.Group(),
      textSprite: new THREE.Sprite(),
      update: jest.fn(),
      dispose: jest.fn(),
    })),
  };
});

import * as THREE from 'three';
import { TempWallMoveDimOverlay } from '../TempWallMoveDimOverlay';
import { createDimension3DRenderer } from '../../dimensions/Dimension3DRenderer';
import type { WallEntity } from '../../../bim/types/wall-types';

const createMock = createDimension3DRenderer as jest.Mock;

/** Straight wall fixture (mm scene): axis start→end. */
const wall = (id: string, sx: number, sy: number, ex: number, ey: number): WallEntity =>
  ({
    id,
    kind: 'straight',
    params: { start: { x: sx, y: sy, z: 0 }, end: { x: ex, y: ey, z: 0 }, thickness: 200, sceneUnits: 'mm' },
  }) as unknown as WallEntity;

const moving = wall('moving', 0, 0, 4000, 0); // 4 m horizontal along +X
const above = wall('above', 0, 2000, 4000, 2000); // +Y side
const below = wall('below', 0, -3000, 4000, -3000); // −Y side
const NO_MOVE = { x: 0, y: 0, z: 0 };

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(0, 0, 10);
const canvas = { clientHeight: 800 } as unknown as HTMLElement;

function fakeScene(): THREE.Scene {
  return { add: jest.fn(), remove: jest.fn() } as unknown as THREE.Scene;
}

describe('TempWallMoveDimOverlay', () => {
  beforeEach(() => createMock.mockClear());

  it('adds its group to the scene on construction', () => {
    const scene = fakeScene();
    new TempWallMoveDimOverlay(scene);
    expect(scene.add).toHaveBeenCalledTimes(1);
    expect((scene.add as jest.Mock).mock.calls[0][0]).toBeInstanceOf(THREE.Group);
  });

  it('builds one witness line per perpendicular side that has a reference', () => {
    const overlay = new TempWallMoveDimOverlay(fakeScene());
    overlay.update(moving, [moving, above, below], NO_MOVE, 0, camera, canvas);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it('builds only one witness line when only one side has a reference', () => {
    const overlay = new TempWallMoveDimOverlay(fakeScene());
    overlay.update(moving, [moving, above], NO_MOVE, 0, camera, canvas);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the renderers (updates, does not recreate) on a second frame', () => {
    const overlay = new TempWallMoveDimOverlay(fakeScene());
    overlay.update(moving, [moving, above, below], NO_MOVE, 0, camera, canvas);
    const handle = createMock.mock.results[0].value as { update: jest.Mock };
    overlay.update(moving, [moving, above, below], { x: 0, y: 0, z: 0.2 }, 0, camera, canvas);
    expect(createMock).toHaveBeenCalledTimes(2); // still 2 — no new renderers
    expect(handle.update).toHaveBeenCalled();
  });

  it('hides a side that loses its reference instead of recreating it', () => {
    const overlay = new TempWallMoveDimOverlay(fakeScene());
    overlay.update(moving, [moving, above, below], NO_MOVE, 0, camera, canvas);
    expect(createMock).toHaveBeenCalledTimes(2);
    const negHandle = createMock.mock.results[1].value as { root: THREE.Object3D }; // the −Y side
    // The −Y reference wall disappears from the candidate set → that slot must hide, not recreate.
    overlay.update(moving, [moving, above], NO_MOVE, 0, camera, canvas);
    expect(negHandle.root.visible).toBe(false);
    expect(createMock).toHaveBeenCalledTimes(2); // no new renderer beyond the first frame
  });

  it('keeps the label screen-constant: farther camera → larger world scale', () => {
    const near = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    near.position.set(0, 0, 5);
    const far = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    far.position.set(0, 0, 20);
    new TempWallMoveDimOverlay(fakeScene()).update(moving, [moving, above], NO_MOVE, 0, near, canvas);
    const hNear = (createMock.mock.results[0].value as { textSprite: THREE.Sprite }).textSprite.scale.y;
    createMock.mockClear();
    new TempWallMoveDimOverlay(fakeScene()).update(moving, [moving, above], NO_MOVE, 0, far, canvas);
    const hFar = (createMock.mock.results[0].value as { textSprite: THREE.Sprite }).textSprite.scale.y;
    expect(hFar).toBeGreaterThan(hNear);
  });

  it('hide() makes the group invisible', () => {
    const scene = fakeScene();
    const overlay = new TempWallMoveDimOverlay(scene);
    overlay.update(moving, [moving, above], NO_MOVE, 0, camera, canvas);
    overlay.hide();
    const group = (scene.add as jest.Mock).mock.calls[0][0] as THREE.Group;
    expect(group.visible).toBe(false);
  });

  it('dispose() disposes renderers and removes the group from the scene', () => {
    const scene = fakeScene();
    const overlay = new TempWallMoveDimOverlay(scene);
    overlay.update(moving, [moving, above], NO_MOVE, 0, camera, canvas);
    const handle = createMock.mock.results[0].value as { dispose: jest.Mock };
    overlay.dispose();
    expect(handle.dispose).toHaveBeenCalled();
    expect(scene.remove).toHaveBeenCalledTimes(1);
  });
});
