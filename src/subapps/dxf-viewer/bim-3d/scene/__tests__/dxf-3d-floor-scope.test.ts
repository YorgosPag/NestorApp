/**
 * ADR-537 δ — dxf-3d-floor-scope: WHICH DXF floor plane(s) the 3D edit/hover path operates
 * over, honouring `floor3DScope` (the same scope decision as `resyncDxfOverlay`).
 *   'single' → the active overlay scene at Y=0.
 *   'all'    → the stacked multi-floor DXF set, each at its datum elevation.
 */

import type { DxfScene, DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

let mockScope: 'single' | 'all' = 'single';
let mockActiveScene: DxfScene | null = null;
let mockStack: { scene: DxfScene; floorElevationMm: number; levelId: string }[] = [];

jest.mock('../../stores/ViewMode3DStore', () => ({
  useViewMode3DStore: { getState: () => ({ floor3DScope: mockScope }) },
}));
jest.mock('../../stores/DxfOverlay3DStore', () => ({
  useDxfOverlay3DStore: { getState: () => ({ dxfScene: mockActiveScene }) },
}));
jest.mock('../multi-floor-dxf-source', () => ({
  getMultiFloorDxfStack: () => mockStack,
}));

import { getDxfFloorScope, findDxfEntityInScope } from '../dxf-3d-floor-scope';

const ent = (id: string): DxfEntityUnion =>
  ({ id, type: 'line', visible: true, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }) as unknown as DxfEntityUnion;

const scene = (units: string | null, entities: DxfEntityUnion[]): DxfScene =>
  ({ units, entities } as unknown as DxfScene);

beforeEach(() => {
  mockScope = 'single';
  mockActiveScene = null;
  mockStack = [];
});

describe('getDxfFloorScope', () => {
  it('single scope → the active scene at elevation 0 (levelId null)', () => {
    mockActiveScene = scene('mm', [ent('a')]);
    expect(getDxfFloorScope()).toEqual([{ scene: mockActiveScene, floorElevationMm: 0, levelId: null }]);
  });

  it('single scope with no active scene → empty', () => {
    expect(getDxfFloorScope()).toEqual([]);
  });

  it('all scope → the multi-floor stack verbatim', () => {
    mockScope = 'all';
    mockStack = [
      { scene: scene('mm', [ent('a')]), floorElevationMm: 0, levelId: 'L1' },
      { scene: scene('cm', [ent('b')]), floorElevationMm: 3000, levelId: 'L2' },
    ];
    expect(getDxfFloorScope()).toBe(mockStack);
  });
});

describe('findDxfEntityInScope', () => {
  it('resolves an entity on a stacked floor with its elevation + scene', () => {
    mockScope = 'all';
    const sceneL2 = scene('cm', [ent('b')]);
    mockStack = [
      { scene: scene('mm', [ent('a')]), floorElevationMm: 0, levelId: 'L1' },
      { scene: sceneL2, floorElevationMm: 3000, levelId: 'L2' },
    ];
    const found = findDxfEntityInScope('b');
    expect(found?.floorElevationMm).toBe(3000);
    expect(found?.scene).toBe(sceneL2);
    expect(found?.entity.id).toBe('b');
  });

  it('returns null for an id on no visible floor', () => {
    mockScope = 'all';
    mockStack = [{ scene: scene('mm', [ent('a')]), floorElevationMm: 0, levelId: 'L1' }];
    expect(findDxfEntityInScope('zzz')).toBeNull();
  });

  it('single scope resolves from the active scene at elevation 0', () => {
    mockActiveScene = scene('mm', [ent('a')]);
    const found = findDxfEntityInScope('a');
    expect(found?.floorElevationMm).toBe(0);
    expect(found?.entity.id).toBe('a');
  });
});
