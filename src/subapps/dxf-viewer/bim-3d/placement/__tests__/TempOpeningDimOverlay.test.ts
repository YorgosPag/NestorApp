/**
 * ADR-363 Φ1G.5 Slice 2f — TempOpeningDimOverlay orchestration tests.
 *
 * The reference maths (`resolveOpeningDimReferences`) runs for real; the dimension
 * renderer + wall-axis walk are mocked so the focus is the overlay's lifecycle:
 * build/update both witness lines, hide a flush side, reuse renderers across frames,
 * hide()/dispose().
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
jest.mock('../../../bim/geometry/opening-geometry', () => ({
  wallAxisPointAtOffsetMm: () => ({ x: 0, y: 0, z: 0 }),
}));

import * as THREE from 'three';
import { TempOpeningDimOverlay } from '../TempOpeningDimOverlay';
import { createDimension3DRenderer } from '../../dimensions/Dimension3DRenderer';
import type { OpeningParams } from '../../../bim/types/opening-types';
import type { WallEntity } from '../../../bim/types/wall-types';

const createMock = createDimension3DRenderer as jest.Mock;
const host: WallEntity = { geometry: { length: 5 }, params: { sceneUnits: 'mm' } } as unknown as WallEntity;
const params = (offset: number, width: number): OpeningParams =>
  ({ offsetFromStart: offset, width, sillHeight: 0, height: 2100 }) as unknown as OpeningParams;

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(0, 0, 10);
const canvas = { clientHeight: 800 } as unknown as HTMLElement;

function fakeScene(): THREE.Scene {
  return { add: jest.fn(), remove: jest.fn() } as unknown as THREE.Scene;
}

describe('TempOpeningDimOverlay', () => {
  beforeEach(() => createMock.mockClear());

  it('adds its group to the scene on construction', () => {
    const scene = fakeScene();
    new TempOpeningDimOverlay(scene);
    expect(scene.add).toHaveBeenCalledTimes(1);
    expect((scene.add as jest.Mock).mock.calls[0][0]).toBeInstanceOf(THREE.Group);
  });

  it('builds two witness lines when both sides have a distance', () => {
    const overlay = new TempOpeningDimOverlay(fakeScene());
    overlay.update(params(1000, 1000), host, [], 0, 0, camera, canvas);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it('builds only one witness line when a jamb is flush', () => {
    const overlay = new TempOpeningDimOverlay(fakeScene());
    overlay.update(params(0, 1000), host, [], 0, 0, camera, canvas); // left jamb flush at offset 0
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the renderers (updates, does not recreate) on a second frame', () => {
    const overlay = new TempOpeningDimOverlay(fakeScene());
    overlay.update(params(1000, 1000), host, [], 0, 0, camera, canvas);
    const leftHandle = createMock.mock.results[0].value as { update: jest.Mock };
    overlay.update(params(1200, 1000), host, [], 0, 0, camera, canvas);
    expect(createMock).toHaveBeenCalledTimes(2); // still 2 — no new renderers
    expect(leftHandle.update).toHaveBeenCalled();
  });

  it('hides a side that becomes flush instead of recreating it', () => {
    const overlay = new TempOpeningDimOverlay(fakeScene());
    overlay.update(params(1000, 1000), host, [], 0, 0, camera, canvas);
    const leftHandle = createMock.mock.results[0].value as { root: THREE.Object3D };
    overlay.update(params(0, 1000), host, [], 0, 0, camera, canvas); // left now flush
    expect(leftHandle.root.visible).toBe(false);
  });

  it('scales the label to a non-default size, preserving the texture aspect', () => {
    const overlay = new TempOpeningDimOverlay(fakeScene());
    overlay.update(params(1000, 1000), host, [], 0, 0, camera, canvas);
    const sprite = (createMock.mock.results[0].value as { textSprite: THREE.Sprite }).textSprite;
    expect(sprite.scale.y).toBeGreaterThan(0);
    expect(sprite.scale.y).not.toBe(1); // recomputed from camera distance, not the default
    expect(sprite.scale.x).toBeCloseTo(sprite.scale.y * 4); // 512×128 texture → 4:1
  });

  it('keeps the label screen-constant: farther camera → larger world scale', () => {
    const near = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    near.position.set(0, 0, 5);
    const far = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    far.position.set(0, 0, 20);
    new TempOpeningDimOverlay(fakeScene()).update(params(1000, 1000), host, [], 0, 0, near, canvas);
    const hNear = (createMock.mock.results[0].value as { textSprite: THREE.Sprite }).textSprite.scale.y;
    createMock.mockClear();
    new TempOpeningDimOverlay(fakeScene()).update(params(1000, 1000), host, [], 0, 0, far, canvas);
    const hFar = (createMock.mock.results[0].value as { textSprite: THREE.Sprite }).textSprite.scale.y;
    expect(hFar).toBeGreaterThan(hNear);
  });

  it('hide() makes the group invisible', () => {
    const scene = fakeScene();
    const overlay = new TempOpeningDimOverlay(scene);
    overlay.update(params(1000, 1000), host, [], 0, 0, camera, canvas);
    overlay.hide();
    const group = (scene.add as jest.Mock).mock.calls[0][0] as THREE.Group;
    expect(group.visible).toBe(false);
  });

  it('dispose() disposes renderers and removes the group from the scene', () => {
    const scene = fakeScene();
    const overlay = new TempOpeningDimOverlay(scene);
    overlay.update(params(1000, 1000), host, [], 0, 0, camera, canvas);
    const leftHandle = createMock.mock.results[0].value as { dispose: jest.Mock };
    overlay.dispose();
    expect(leftHandle.dispose).toHaveBeenCalled();
    expect(scene.remove).toHaveBeenCalledTimes(1);
  });
});
