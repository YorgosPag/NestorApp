/**
 * ADR-399 Phase D — useFloors2DUnderlay tests.
 *
 * Coverage:
 *  - excludes the ACTIVE floor (drawn by the main pipeline)
 *  - excludes floors marked 'hide' (shared floorVisibilityModes SSoT, Phase C)
 *  - excludes floors of other buildings
 *  - visited floors use the in-memory scene; unvisited file-linked floors fetch
 *    via loadFileV2 (async snapshot)
 *  - inactive scope returns an empty list
 */

import { renderHook, waitFor } from '@testing-library/react';

import { useFloors2DUnderlay } from '../useFloors2DUnderlay';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import type { FloorVisMode } from '../../../bim-3d/utils/floor-visibility-state';

const mockUseLevelsOptional = jest.fn();
const mockLoadFileV2 = jest.fn();

jest.mock('../../../systems/levels/useLevels', () => ({
  useLevelsOptional: () => mockUseLevelsOptional(),
}));
jest.mock('../../../services/dxf-firestore.service', () => ({
  DxfFirestoreService: { loadFileV2: (...a: unknown[]) => mockLoadFileV2(...a) },
}));
// Convert is exercised separately by useDxfSceneConversion tests — here we echo
// the source entities so assertions stay on aggregation logic, not conversion.
jest.mock('../../canvas/useDxfSceneConversion', () => ({
  convertSceneToDxf: (model: { entities: { id: string }[] } | null) => ({
    entities: model?.entities ?? [],
    layers: [],
    layersById: {},
    bounds: null,
    units: 'mm',
  }),
  useDxfSceneConversion: jest.fn(),
}));

function wallScene(id: string) {
  return { entities: [{ id, type: 'wall' }] };
}

function ctx(getLevelScene: jest.Mock) {
  return {
    levels: [
      { id: 'L1', floorId: 'f1', buildingId: 'b1', sceneFileId: 'file1' }, // active
      { id: 'L2', floorId: 'f2', buildingId: 'b1', sceneFileId: 'file2' },
      { id: 'L3', floorId: 'f3', buildingId: 'b1', sceneFileId: 'file3' },
      { id: 'LX', floorId: 'fx', buildingId: 'b2', sceneFileId: 'fileX' },
    ],
    currentLevelId: 'L1',
    getLevelScene,
  };
}

beforeEach(() => {
  mockUseLevelsOptional.mockReset();
  mockLoadFileV2.mockReset();
  useViewMode3DStore.setState({ floorVisibilityModes: new Map<string, FloorVisMode>() });
});

describe('useFloors2DUnderlay — ADR-399 Phase D', () => {
  it('excludes the active floor and includes non-active visible floors', async () => {
    const getLevelScene = jest.fn((id: string) =>
      id === 'L2' ? wallScene('w2') : id === 'L3' ? wallScene('w3') : null,
    );
    mockUseLevelsOptional.mockReturnValue(ctx(getLevelScene));

    const { result } = renderHook(() => useFloors2DUnderlay(true));

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current.map((f) => f.levelId)).toEqual(['L2', 'L3']);
    expect(result.current.some((f) => f.levelId === 'L1')).toBe(false);
    expect(result.current[0].scene.entities.map((e) => (e as { id: string }).id)).toEqual(['w2']);
    expect(mockLoadFileV2).not.toHaveBeenCalled();
  });

  it("excludes floors marked 'hide' (shared visibility SSoT)", async () => {
    const getLevelScene = jest.fn((id: string) =>
      id === 'L2' ? wallScene('w2') : id === 'L3' ? wallScene('w3') : null,
    );
    mockUseLevelsOptional.mockReturnValue(ctx(getLevelScene));
    useViewMode3DStore.setState({
      floorVisibilityModes: new Map<string, FloorVisMode>([['L3', 'hide']]),
    });

    const { result } = renderHook(() => useFloors2DUnderlay(true));

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current.map((f) => f.levelId)).toEqual(['L2']);
  });

  it('excludes floors from other buildings', async () => {
    const getLevelScene = jest.fn((id: string) =>
      id === 'L2' ? wallScene('w2') : id === 'L3' ? wallScene('w3') : null,
    );
    mockUseLevelsOptional.mockReturnValue(ctx(getLevelScene));

    const { result } = renderHook(() => useFloors2DUnderlay(true));

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current.some((f) => f.levelId === 'LX')).toBe(false);
  });

  it('fetches unvisited file-linked floors via loadFileV2', async () => {
    const getLevelScene = jest.fn(() => null); // nothing in memory
    mockUseLevelsOptional.mockReturnValue(ctx(getLevelScene));
    mockLoadFileV2.mockImplementation((fileId: string) =>
      Promise.resolve({ scene: wallScene(fileId === 'file2' ? 'w2' : 'w3') }),
    );

    const { result } = renderHook(() => useFloors2DUnderlay(true));

    await waitFor(() => {
      const l2 = result.current.find((f) => f.levelId === 'L2');
      expect(l2?.scene.entities.map((e) => (e as { id: string }).id)).toEqual(['w2']);
    });
    expect(mockLoadFileV2).toHaveBeenCalledWith('file2');
    expect(mockLoadFileV2).toHaveBeenCalledWith('file3');
  });

  it('returns an empty list when inactive (single scope / 3D)', async () => {
    const getLevelScene = jest.fn(() => wallScene('w2'));
    mockUseLevelsOptional.mockReturnValue(ctx(getLevelScene));

    const { result } = renderHook(() => useFloors2DUnderlay(false));

    await waitFor(() => expect(result.current).toHaveLength(0));
    expect(mockLoadFileV2).not.toHaveBeenCalled();
  });
});
