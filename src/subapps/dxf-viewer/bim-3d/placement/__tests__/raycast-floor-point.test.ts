/**
 * ADR-403 — raycast-floor-point SSoT unit tests.
 *
 * `raycastFloorPoint` is verified against a camera looking straight down so the
 * centre click lands on the world origin; `resolveActiveFloorElevationMm` is
 * verified across single vs all-floors scope (stores mocked, multi-floor source
 * real).
 */

import * as THREE from 'three';

const viewState = { floor3DScope: 'single' as 'single' | 'all' };
const entitiesState = { activeLevelId: null as string | null };
const EMPTY_BIM_ENTITIES = {
  walls: [], columns: [], beams: [], slabs: [], slabOpenings: [], openings: [], stairs: [],
  fixtures: [], panels: [], railings: [],
};

jest.mock('../../stores/ViewMode3DStore', () => ({
  useViewMode3DStore: { getState: () => viewState },
}));
jest.mock('../../stores/Bim3DEntitiesStore', () => ({
  useBim3DEntitiesStore: { getState: () => entitiesState },
}));

import { raycastFloorPoint, resolveActiveFloorElevationMm } from '../raycast-floor-point';
import { setMultiFloorStack } from '../../scene/multi-floor-3d-source';

function fakeDom(width = 100, height = 100): HTMLElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }),
  } as unknown as HTMLElement;
}

function topDownCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 10, 0);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('raycastFloorPoint', () => {
  it('centre click with a top-down camera hits the floor origin', () => {
    const hit = raycastFloorPoint(topDownCamera(), fakeDom(), 50, 50, 0);
    expect(hit).not.toBeNull();
    // x/z at cm tolerance: a top-down lookAt has an ill-defined up axis so the
    // centre ray lands ~1mm off origin (negligible over a 10m camera distance).
    expect(hit!.x).toBeCloseTo(0, 2);
    expect(hit!.y).toBeCloseTo(0, 5); // plane at elevation 0 — exact by construction
    expect(hit!.z).toBeCloseTo(0, 2);
  });

  it('floor elevation shifts the hit plane up (world Y in metres)', () => {
    const hit = raycastFloorPoint(topDownCamera(), fakeDom(), 50, 50, 3000);
    expect(hit).not.toBeNull();
    expect(hit!.y).toBeCloseTo(3, 5); // 3000mm → 3m
  });

  it('returns null when the dom element has no layout', () => {
    expect(raycastFloorPoint(topDownCamera(), fakeDom(0, 0), 50, 50, 0)).toBeNull();
  });
});

describe('resolveActiveFloorElevationMm', () => {
  beforeEach(() => {
    viewState.floor3DScope = 'single';
    entitiesState.activeLevelId = null;
    setMultiFloorStack([]);
  });

  it('single-floor scope → 0', () => {
    viewState.floor3DScope = 'single';
    expect(resolveActiveFloorElevationMm()).toBe(0);
  });

  it('all-floors scope → active floor elevation from the stack', () => {
    viewState.floor3DScope = 'all';
    entitiesState.activeLevelId = 'L2';
    setMultiFloorStack([
      { levelId: 'L1', floorElevationMm: 0, entities: EMPTY_BIM_ENTITIES },
      { levelId: 'L2', floorElevationMm: 3000, entities: EMPTY_BIM_ENTITIES },
    ]);
    expect(resolveActiveFloorElevationMm()).toBe(3000);
  });

  it('all-floors scope but active floor not in stack → 0 fallback', () => {
    viewState.floor3DScope = 'all';
    entitiesState.activeLevelId = 'missing';
    setMultiFloorStack([{ levelId: 'L1', floorElevationMm: 0, entities: EMPTY_BIM_ENTITIES }]);
    expect(resolveActiveFloorElevationMm()).toBe(0);
  });
});
