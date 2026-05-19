import * as THREE from 'three';
import {
  dxfPlanToWorld,
  worldToDxfPlan,
  ndcToWorld,
  worldToNdc,
  getPixelWorldSize,
} from '../viewport/coordinate-transforms';

describe('dxfPlanToWorld / worldToDxfPlan', () => {
  it('converts mm to m and maps Y-up correctly', () => {
    const world = dxfPlanToWorld(1000, 2000, 3000);
    expect(world.x).toBeCloseTo(1);       // 1000mm = 1m east
    expect(world.y).toBeCloseTo(3);       // 3000mm elevation = 3m Y
    expect(world.z).toBeCloseTo(-2);      // 2000mm north = -2m Z (right-hand Y-up)
  });

  it('round-trips with < 0.001mm error', () => {
    const origin = { x_mm: 12345, y_mm: -6789, elev_mm: 500 };
    const world = dxfPlanToWorld(origin.x_mm, origin.y_mm, origin.elev_mm);
    const back = worldToDxfPlan(world);
    expect(back.x).toBeCloseTo(origin.x_mm, 3);
    expect(back.y).toBeCloseTo(origin.y_mm, 3);
    expect(back.z).toBeCloseTo(origin.elev_mm, 3);
  });

  it('handles zero input', () => {
    const world = dxfPlanToWorld(0, 0, 0);
    expect(world.x).toBeCloseTo(0, 5);
    expect(world.y).toBeCloseTo(0, 5);
    expect(world.z).toBeCloseTo(0, 5);
  });

  it('handles negative coordinates', () => {
    const world = dxfPlanToWorld(-500, -1000, -200);
    expect(world.x).toBeCloseTo(-0.5);
    expect(world.z).toBeCloseTo(1);   // -(-1000mm) * 0.001 = +1m
    expect(world.y).toBeCloseTo(-0.2);
  });

  it('default elevation is 0', () => {
    const world = dxfPlanToWorld(1000, 1000);
    expect(world.y).toBe(0);
  });
});

describe('ndcToWorld / worldToNdc', () => {
  function makeCamera(): THREE.PerspectiveCamera {
    const cam = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    cam.position.set(0, 0, 5);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    return cam;
  }

  it('round-trips NDC origin to near origin', () => {
    const cam = makeCamera();
    const world = ndcToWorld(new THREE.Vector2(0, 0), -1, cam);
    const ndc = worldToNdc(world, cam);
    expect(ndc.x).toBeCloseTo(0, 2);
    expect(ndc.y).toBeCloseTo(0, 2);
  });

  it('maps NDC corners symmetrically', () => {
    const cam = makeCamera();
    const topLeft = ndcToWorld(new THREE.Vector2(-1, 1), 0, cam);
    const topRight = ndcToWorld(new THREE.Vector2(1, 1), 0, cam);
    // Symmetric about Y axis
    expect(topLeft.x).toBeCloseTo(-topRight.x, 2);
    expect(topLeft.y).toBeCloseTo(topRight.y, 2);
  });
});

describe('getPixelWorldSize', () => {
  it('returns positive size for perspective camera', () => {
    const cam = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    const canvas = { clientHeight: 600 } as HTMLElement;
    const size = getPixelWorldSize(10, cam, canvas);
    expect(size).toBeGreaterThan(0);
  });

  it('returns 1 for non-perspective cameras', () => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
    const canvas = { clientHeight: 600 } as HTMLElement;
    expect(getPixelWorldSize(10, cam, canvas)).toBe(1);
  });
});
