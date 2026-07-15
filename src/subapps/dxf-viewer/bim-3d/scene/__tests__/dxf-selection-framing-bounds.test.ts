/**
 * ADR-537 / ADR-366 A.6.Q4 — "Z"/"F" frame a SELECTED raw DXF entity (world bounds), keeping the
 * camera angle. Locks the projection + union + NaN-skip + empty-selection contract of
 * `computeDxfSelectionWorldBounds`. `findDxfEntityInScope` (store-backed) and `dxfSceneUnitToMm`
 * are mocked so the pure projection math (`getEntityBBox` + `dxfPlanToWorld`) is exercised for real.
 */

import type { DxfEntityUnion, DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { computeDxfSelectionWorldBounds } from '../dxf-selection-framing-bounds';
import { findDxfEntityInScope } from '../dxf-3d-floor-scope';

jest.mock('../dxf-3d-floor-scope', () => ({ findDxfEntityInScope: jest.fn() }));
// Native units → mm factor forced to 1000 (metres-scene), so the ×unit boundary is under test.
jest.mock('../../../utils/scene-units', () => ({ dxfSceneUnitToMm: () => 1000 }));

const mockFind = findDxfEntityInScope as jest.MockedFunction<typeof findDxfEntityInScope>;
const FAKE_SCENE = { entities: [] } as unknown as DxfScene;

function line(id: string, x1: number, y1: number, x2: number, y2: number): DxfEntityUnion {
  return { id, type: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
}

function resolve(entity: DxfEntityUnion, floorElevationMm = 0) {
  return { entity, floorElevationMm, scene: FAKE_SCENE };
}

beforeEach(() => mockFind.mockReset());

describe('computeDxfSelectionWorldBounds', () => {
  it('returns null for an empty selection', () => {
    expect(computeDxfSelectionWorldBounds([])).toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('projects one line: DXF x→world x, y→world −z, ×1000 units ×0.001 metres', () => {
    mockFind.mockReturnValue(resolve(line('l1', 0, 0, 2, 3)));
    const box = computeDxfSelectionWorldBounds(['l1'])!;
    expect(box).not.toBeNull();
    // native (0,0)-(2,3) → mm (0,0)-(2000,3000) → world x∈[0,2], z∈[-3,0], y=0
    expect(box.min.x).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(2);
    expect(box.min.z).toBeCloseTo(-3);
    expect(box.max.z).toBeCloseTo(0);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(0);
  });

  it('honours the floor elevation on the world Y axis', () => {
    mockFind.mockReturnValue(resolve(line('l1', 0, 0, 1, 1), 4000)); // 4000mm → 4m
    const box = computeDxfSelectionWorldBounds(['l1'])!;
    expect(box.min.y).toBeCloseTo(4);
    expect(box.max.y).toBeCloseTo(4);
  });

  it('unions the bounds of a multi-selection', () => {
    mockFind.mockImplementation((id: string) =>
      id === 'a' ? resolve(line('a', 0, 0, 1, 1)) : resolve(line('b', 5, 5, 6, 6)));
    const box = computeDxfSelectionWorldBounds(['a', 'b'])!;
    expect(box.min.x).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(6);
    expect(box.min.z).toBeCloseTo(-6);
    expect(box.max.z).toBeCloseTo(0);
  });

  it('skips ids that resolve to nothing (BIM id / off-scope); all-null → null', () => {
    mockFind.mockReturnValue(null);
    expect(computeDxfSelectionWorldBounds(['bim_1', 'bim_2'])).toBeNull();
  });

  it('frames only the resolvable ids when a selection is mixed', () => {
    mockFind.mockImplementation((id: string) =>
      id === 'real' ? resolve(line('real', 0, 0, 2, 2)) : null);
    const box = computeDxfSelectionWorldBounds(['real', 'bim_x'])!;
    expect(box.max.x).toBeCloseTo(2);
  });

  it('skips a NaN-bbox entity so the shared camera frame is never poisoned', () => {
    mockFind.mockReturnValue(resolve(line('nan', NaN, 0, 2, 3)));
    expect(computeDxfSelectionWorldBounds(['nan'])).toBeNull();
  });
});
