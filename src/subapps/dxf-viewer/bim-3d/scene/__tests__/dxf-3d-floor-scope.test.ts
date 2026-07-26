/**
 * ADR-537 δ — dxf-3d-floor-scope: WHICH DXF floor plane(s) the 3D edit/hover path operates
 * over, honouring `floor3DScope` (the same scope decision as `resyncDxfOverlay`).
 *   'single' → the active overlay scene at the ACTIVE STOREY's datum-relative FFL (ADR-399 Φάση Ε).
 *   'all'    → the stacked multi-floor DXF set, each at its datum elevation.
 */

import type { DxfScene, DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

let mockScope: 'single' | 'all' = 'single';
let mockActiveScene: DxfScene | null = null;
let mockStoreyElevationMm: number | null = null;
let mockStack: { scene: DxfScene; floorElevationMm: number; levelId: string }[] = [];

jest.mock('../../stores/ViewMode3DStore', () => ({
  useViewMode3DStore: { getState: () => ({ floor3DScope: mockScope }) },
}));
jest.mock('../../stores/DxfOverlay3DStore', () => ({
  useDxfOverlay3DStore: { getState: () => ({ dxfScene: mockActiveScene }) },
}));
jest.mock('../../../systems/levels/active-storey-store', () => ({
  useActiveStoreyStore: {
    getState: () => ({
      context: mockStoreyElevationMm === null ? null : { floorElevationMm: mockStoreyElevationMm },
    }),
  },
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
  mockStoreyElevationMm = null;
  mockStack = [];
});

describe('getDxfFloorScope', () => {
  it('single scope with no linked storey → the active scene at elevation 0 (levelId null)', () => {
    mockActiveScene = scene('mm', [ent('a')]);
    expect(getDxfFloorScope()).toEqual([{ scene: mockActiveScene, floorElevationMm: 0, levelId: null }]);
  });

  // ADR-399 Φάση Ε — the regression this closes: an upper storey's plan used to pick (and render)
  // at ground level because this entry hardcoded 0 while the BIM path already used the real FFL.
  it('single scope → the active scene at the ACTIVE STOREY datum-relative FFL', () => {
    mockActiveScene = scene('mm', [ent('a')]);
    mockStoreyElevationMm = 3000;
    expect(getDxfFloorScope()).toEqual([
      { scene: mockActiveScene, floorElevationMm: 3000, levelId: null },
    ]);
  });

  it('single scope → a defined basement seats BELOW the datum (negative FFL)', () => {
    mockActiveScene = scene('mm', [ent('a')]);
    mockStoreyElevationMm = -2800;
    expect(getDxfFloorScope()[0].floorElevationMm).toBe(-2800);
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

  it('single scope resolves from the active scene at elevation 0 (no linked storey)', () => {
    mockActiveScene = scene('mm', [ent('a')]);
    const found = findDxfEntityInScope('a');
    expect(found?.floorElevationMm).toBe(0);
    expect(found?.entity.id).toBe('a');
  });

  // ADR-399 Φάση Ε — grips / ghost / OSNAP anchor on this elevation, so it must follow the storey.
  it('single scope seats a resolved entity at the active storey FFL', () => {
    mockActiveScene = scene('mm', [ent('a')]);
    mockStoreyElevationMm = 6000;
    expect(findDxfEntityInScope('a')?.floorElevationMm).toBe(6000);
  });
});
