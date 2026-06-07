/**
 * ADR-399 Phase B — useFloors3DAggregator tests.
 *
 * Coverage:
 *  - one stack entry per building floor, elevation (m) → mm
 *  - active floor uses LIVE store entities; siblings use the in-memory scene
 *  - unvisited file-linked floors fetch via loadFileV2 (async snapshot)
 *  - floors of other buildings are excluded
 *  - inactive scope clears the SSoT source
 */

import { renderHook, waitFor } from '@testing-library/react';

import { useFloors3DAggregator } from '../useFloors3DAggregator';
import { useBim3DEntitiesStore } from '../../../bim-3d/stores/Bim3DEntitiesStore';
import { getMultiFloorStack, setMultiFloorStack } from '../../../bim-3d/scene/multi-floor-3d-source';

const mockUseLevelsOptional = jest.fn();
const mockLoadFileV2 = jest.fn();
const mockUseFloorsByBuilding = jest.fn();

jest.mock('../../../systems/levels/useLevels', () => ({
  useLevelsOptional: () => mockUseLevelsOptional(),
}));
jest.mock('../../../services/dxf-firestore.service', () => ({
  DxfFirestoreService: { loadFileV2: (...a: unknown[]) => mockLoadFileV2(...a) },
}));
// ADR-399 Phase B — elevation now sourced from the canonical FLOORS Firestore
// subscription (same as the floor tabs), not Bim3DEntitiesStore.floors.
jest.mock('@/components/properties/shared/useFloorsByBuilding', () => ({
  useFloorsByBuilding: (...a: unknown[]) => mockUseFloorsByBuilding(...a),
}));

function wallScene(id: string) {
  return { entities: [{ id, type: 'wall' }] };
}

function baseStore() {
  useBim3DEntitiesStore.setState({
    walls: [{ id: 'w1', type: 'wall' } as never],
    columns: [], beams: [], slabs: [], slabOpenings: [], openings: [], stairs: [],
    activeLevelId: 'L1',
    floors: [
      { id: 'f1', elevation: 0, buildingId: 'b1' },
      { id: 'f2', elevation: 3, buildingId: 'b1' },
      { id: 'fx', elevation: 0, buildingId: 'b2' },
    ],
  });
}

function ctx(getLevelScene: jest.Mock) {
  return {
    levels: [
      { id: 'L1', floorId: 'f1', buildingId: 'b1', sceneFileId: 'file1' },
      { id: 'L2', floorId: 'f2', buildingId: 'b1', sceneFileId: 'file2' },
      { id: 'LX', floorId: 'fx', buildingId: 'b2', sceneFileId: 'fileX' },
    ],
    currentLevelId: 'L1',
    getLevelScene,
  };
}

beforeEach(() => {
  mockUseLevelsOptional.mockReset();
  mockLoadFileV2.mockReset();
  mockUseFloorsByBuilding.mockReset();
  // Canonical floor elevations (metres) for building b1.
  mockUseFloorsByBuilding.mockReturnValue({
    floors: [
      { id: 'f1', number: 0, name: 'Ground', buildingId: 'b1', elevation: 0 },
      { id: 'f2', number: 1, name: 'First', buildingId: 'b1', elevation: 3 },
    ],
    loading: false,
  });
  setMultiFloorStack([]);
  baseStore();
});

describe('useFloors3DAggregator — ADR-399 Phase B', () => {
  it('publishes one entry per building floor with elevation in mm', async () => {
    const getLevelScene = jest.fn((id: string) => (id === 'L2' ? wallScene('w2') : null));
    mockUseLevelsOptional.mockReturnValue(ctx(getLevelScene));

    renderHook(() => useFloors3DAggregator(true));

    await waitFor(() => expect(getMultiFloorStack()).toHaveLength(2));
    const stack = getMultiFloorStack();
    expect(stack.map((s) => s.levelId)).toEqual(['L1', 'L2']);
    expect(stack.map((s) => s.floorElevationMm)).toEqual([0, 3000]);
    // active floor uses LIVE store walls
    expect(stack[0].entities.walls.map((w) => w.id)).toEqual(['w1']);
    // sibling floor extracted from the in-memory scene
    expect(stack[1].entities.walls.map((w) => w.id)).toEqual(['w2']);
    expect(mockLoadFileV2).not.toHaveBeenCalled();
  });

  it('anchors to the lowest floor when no ground floor (number 0) exists', async () => {
    // Revit-grade datum: building whose lowest storey is «1ος» (number 1) at 3 m
    // and no Ισόγειο → datum = 3 m → «1ος» renders at 0, «2ος» at +3000 mm
    // (instead of floating at 3000/6000). Matches the single-floor «sit on 0» view.
    mockUseFloorsByBuilding.mockReturnValue({
      floors: [
        { id: 'f1', number: 1, name: 'First', buildingId: 'b1', elevation: 3 },
        { id: 'f2', number: 2, name: 'Second', buildingId: 'b1', elevation: 6 },
      ],
      loading: false,
    });
    const getLevelScene = jest.fn((id: string) => (id === 'L2' ? wallScene('w2') : null));
    mockUseLevelsOptional.mockReturnValue(ctx(getLevelScene));

    renderHook(() => useFloors3DAggregator(true));

    await waitFor(() => expect(getMultiFloorStack()).toHaveLength(2));
    expect(getMultiFloorStack().map((s) => s.floorElevationMm)).toEqual([0, 3000]);
  });

  it('fetches unvisited file-linked floors via loadFileV2', async () => {
    const getLevelScene = jest.fn(() => null); // nothing in memory
    mockUseLevelsOptional.mockReturnValue(ctx(getLevelScene));
    mockLoadFileV2.mockResolvedValue({ scene: wallScene('w2') });

    renderHook(() => useFloors3DAggregator(true));

    await waitFor(() => {
      const stack = getMultiFloorStack();
      const l2 = stack.find((s) => s.levelId === 'L2');
      expect(l2?.entities.walls.map((w) => w.id)).toEqual(['w2']);
    });
    expect(mockLoadFileV2).toHaveBeenCalledWith('file2');
  });

  it('excludes floors from other buildings', async () => {
    const getLevelScene = jest.fn((id: string) => (id === 'L2' ? wallScene('w2') : null));
    mockUseLevelsOptional.mockReturnValue(ctx(getLevelScene));

    renderHook(() => useFloors3DAggregator(true));

    await waitFor(() => expect(getMultiFloorStack()).toHaveLength(2));
    expect(getMultiFloorStack().some((s) => s.levelId === 'LX')).toBe(false);
  });

  it('clears the source when inactive (single scope)', async () => {
    const getLevelScene = jest.fn(() => null);
    mockUseLevelsOptional.mockReturnValue(ctx(getLevelScene));

    renderHook(() => useFloors3DAggregator(false));
    await waitFor(() => expect(getMultiFloorStack()).toHaveLength(0));
  });
});
