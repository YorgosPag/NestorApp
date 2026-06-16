/**
 * ADR-399 — useFloorTabs reconciliation hook tests.
 *
 * Coverage:
 *  - visibility gating (buildingId required — any building-bound level, ADR-399 §3.4 rev. 2026-06-16)
 *  - floor↔level mapping (linked level vs virtual tab)
 *  - hasFloorplan flag (sceneFileId / scene entities)
 *  - label fallback via generateAutoLongName (no longName/name)
 *  - ascending order preserved from useFloorsByBuilding
 *  - onSelectTab: switch (existing) vs lazy-provision (virtual)
 *  - double-click guard (single addLevel for two rapid virtual clicks)
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';

import { useFloorTabs } from '../useFloorTabs';
import type { FloorTab } from '../useFloorTabs';
import type { FloorOption } from '@/components/properties/shared/useFloorsByBuilding';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';

const mockUseLevelsContext = jest.fn();
const mockUseFloorsByBuilding = jest.fn();

jest.mock('../../../systems/levels/LevelsSystem', () => ({
  useLevelsContext: () => mockUseLevelsContext(),
}));
jest.mock('@/components/properties/shared/useFloorsByBuilding', () => ({
  useFloorsByBuilding: (buildingId: string | null, enabled?: boolean) =>
    mockUseFloorsByBuilding(buildingId, enabled),
}));

interface LevelLike {
  id: string;
  floorId?: string;
  buildingId?: string;
  floorplanType?: string;
  sceneFileId?: string;
}

function makeCtx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    levels: [] as LevelLike[],
    currentLevelId: null as string | null,
    addLevel: jest.fn().mockResolvedValue('lvl_new'),
    setCurrentLevel: jest.fn(),
    updateLevelContext: jest.fn().mockResolvedValue(undefined),
    getLevelScene: jest.fn().mockReturnValue(null),
    ...overrides,
  };
}

function floor(id: string, number: number, extra: Partial<FloorOption> = {}): FloorOption {
  return { id, number, name: '', buildingId: 'b1', ...extra };
}

afterEach(() => jest.clearAllMocks());

describe('useFloorTabs — visibility', () => {
  it('visible for an empty building storey (buildingId, no floorplanType) — the 2026-06-16 fix', () => {
    // Building-setup levels (findOrCreateLevelForFloor) carry buildingId+floorId
    // but NO floorplanType:'floor'. They belong to a building → strip must show.
    mockUseLevelsContext.mockReturnValue(
      makeCtx({ levels: [{ id: 'L1', floorId: 'f1', buildingId: 'b1' }], currentLevelId: 'L1' }),
    );
    mockUseFloorsByBuilding.mockReturnValue({ floors: [floor('f1', 1)], loading: false });

    const { result } = renderHook(() => useFloorTabs());
    expect(result.current.visible).toBe(true);
  });

  it('hidden for the building-less default level («Επίπεδο 1»)', () => {
    mockUseLevelsContext.mockReturnValue(
      makeCtx({ levels: [{ id: 'L1' }], currentLevelId: 'L1' }),
    );
    mockUseFloorsByBuilding.mockReturnValue({ floors: [], loading: false });

    const { result } = renderHook(() => useFloorTabs());
    expect(result.current.visible).toBe(false);
  });

  it('visible for a floor plan with buildingId', () => {
    mockUseLevelsContext.mockReturnValue(
      makeCtx({
        levels: [{ id: 'L1', floorId: 'f1', buildingId: 'b1', floorplanType: 'floor' }],
        currentLevelId: 'L1',
      }),
    );
    mockUseFloorsByBuilding.mockReturnValue({ floors: [floor('f1', 1)], loading: false });

    const { result } = renderHook(() => useFloorTabs());
    expect(result.current.visible).toBe(true);
  });
});

describe('useFloorTabs — mapping & labels', () => {
  function visibleCtx(extra: Partial<Record<string, unknown>> = {}) {
    return makeCtx({
      levels: [{ id: 'L1', floorId: 'f1', buildingId: 'b1', floorplanType: 'floor', sceneFileId: 'file_1' }],
      currentLevelId: 'L1',
      ...extra,
    });
  }

  it('links existing level and flags hasFloorplan via sceneFileId', () => {
    mockUseLevelsContext.mockReturnValue(visibleCtx());
    mockUseFloorsByBuilding.mockReturnValue({ floors: [floor('f1', 1, { longName: '1ος Όροφος' })], loading: false });

    const { result } = renderHook(() => useFloorTabs());
    const tab = result.current.tabs[0];
    expect(tab.levelId).toBe('L1');
    expect(tab.hasFloorplan).toBe(true);
    expect(tab.label).toBe('1ος Όροφος');
    expect(result.current.activeFloorId).toBe('f1');
  });

  it('produces a virtual tab for a floor with no level', () => {
    mockUseLevelsContext.mockReturnValue(visibleCtx());
    mockUseFloorsByBuilding.mockReturnValue({
      floors: [floor('f1', 1), floor('f2', 2)],
      loading: false,
    });

    const { result } = renderHook(() => useFloorTabs());
    const virtual = result.current.tabs.find((t) => t.floorId === 'f2')!;
    expect(virtual.levelId).toBeNull();
    expect(virtual.hasFloorplan).toBe(false);
  });

  it('falls back to generateAutoLongName when longName/name are absent', () => {
    mockUseLevelsContext.mockReturnValue(visibleCtx());
    mockUseFloorsByBuilding.mockReturnValue({
      floors: [floor('f0', 0), floor('f1', 1)],
      loading: false,
    });

    const { result } = renderHook(() => useFloorTabs());
    expect(result.current.tabs.find((t) => t.floorId === 'f0')!.label).toBe('Ισόγειο');
    expect(result.current.tabs.find((t) => t.floorId === 'f1')!.label).toBe('1ος Όροφος');
  });

  it('preserves ascending order from useFloorsByBuilding', () => {
    mockUseLevelsContext.mockReturnValue(visibleCtx());
    mockUseFloorsByBuilding.mockReturnValue({
      floors: [floor('fb', -1), floor('f0', 0), floor('f1', 1)],
      loading: false,
    });

    const { result } = renderHook(() => useFloorTabs());
    expect(result.current.tabs.map((t) => t.number)).toEqual([-1, 0, 1]);
  });
});

describe('useFloorTabs — onSelectTab', () => {
  const existingTab: FloorTab = { floorId: 'f1', number: 1, label: '1ος Όροφος', levelId: 'L1', hasFloorplan: true };
  const virtualTab: FloorTab = { floorId: 'f2', number: 2, label: '2ος Όροφος', levelId: null, hasFloorplan: false };

  function selectCtx(extra: Partial<Record<string, unknown>> = {}) {
    return makeCtx({
      levels: [{ id: 'L1', floorId: 'f1', buildingId: 'b1', floorplanType: 'floor' }],
      currentLevelId: 'L1',
      ...extra,
    });
  }

  it('switches to the linked level for an existing tab', async () => {
    const ctx = selectCtx();
    mockUseLevelsContext.mockReturnValue(ctx);
    mockUseFloorsByBuilding.mockReturnValue({ floors: [floor('f1', 1)], loading: false });

    const { result } = renderHook(() => useFloorTabs());
    const { onSelectTab } = result.current;
    await act(async () => {
      await onSelectTab(existingTab);
    });

    expect(ctx.setCurrentLevel).toHaveBeenCalledWith('L1');
    expect(ctx.addLevel).not.toHaveBeenCalled();
  });

  it('lazily provisions a level for a virtual tab', async () => {
    const ctx = selectCtx();
    mockUseLevelsContext.mockReturnValue(ctx);
    mockUseFloorsByBuilding.mockReturnValue({ floors: [floor('f2', 2)], loading: false });

    const { result } = renderHook(() => useFloorTabs());
    const { onSelectTab } = result.current;
    await act(async () => {
      await onSelectTab(virtualTab);
    });

    expect(ctx.addLevel).toHaveBeenCalledWith('2ος Όροφος', false, 'f2');
    expect(ctx.updateLevelContext).toHaveBeenCalledWith('lvl_new', {
      floorplanType: 'floor',
      entityLabel: '2ος Όροφος',
      buildingId: 'b1',
      floorId: 'f2',
    });
    expect(ctx.setCurrentLevel).toHaveBeenCalledWith('lvl_new');
  });

  it('guards against double-click duplicate provisioning', async () => {
    let resolveAdd: (id: string) => void = () => {};
    const addLevel = jest.fn().mockReturnValue(new Promise<string>((r) => { resolveAdd = r; }));
    const ctx = selectCtx({ addLevel });
    mockUseLevelsContext.mockReturnValue(ctx);
    mockUseFloorsByBuilding.mockReturnValue({ floors: [floor('f2', 2)], loading: false });

    const { result } = renderHook(() => useFloorTabs());
    const { onSelectTab } = result.current;
    await act(async () => {
      onSelectTab(virtualTab); // first — in-flight
      onSelectTab(virtualTab); // second — must be blocked
      resolveAdd('lvl_new');
    });

    expect(addLevel).toHaveBeenCalledTimes(1);
  });
});

describe('useFloorTabs — Phase B/C all-floors scope + visibility', () => {
  const existingTab: FloorTab = { floorId: 'f1', number: 1, label: '1ος Όροφος', levelId: 'L1', hasFloorplan: true };
  const virtualTab: FloorTab = { floorId: 'f2', number: 2, label: '2ος Όροφος', levelId: null, hasFloorplan: false };

  function scopeCtx(extra: Partial<Record<string, unknown>> = {}) {
    return makeCtx({
      levels: [{ id: 'L1', floorId: 'f1', buildingId: 'b1', floorplanType: 'floor' }],
      currentLevelId: 'L1',
      ...extra,
    });
  }

  beforeEach(() => {
    // Reset the shared 3D store to defaults between cases.
    useViewMode3DStore.setState({
      mode: '2d',
      floor3DScope: 'single',
      floorVisibilityModes: new Map(),
    });
    mockUseLevelsContext.mockReturnValue(scopeCtx());
    mockUseFloorsByBuilding.mockReturnValue({ floors: [floor('f1', 1)], loading: false });
  });

  it('defaults to single scope', () => {
    const { result } = renderHook(() => useFloorTabs());
    expect(result.current.floor3DScope).toBe('single');
  });

  it('onSelectAllFloors sets scope=all and stays in 2D (Phase D underlay)', () => {
    const { result } = renderHook(() => useFloorTabs());
    act(() => { result.current.onSelectAllFloors(); });
    expect(useViewMode3DStore.getState().floor3DScope).toBe('all');
    // Phase D: 2D «Όλοι» now renders the FloorUnderlayOverlay — no longer enters raster.
    expect(useViewMode3DStore.getState().mode).toBe('2d');
  });

  it('onSelectAllFloors keeps an existing 3D mode unchanged', () => {
    useViewMode3DStore.setState({ mode: '3d-preview' });
    const { result } = renderHook(() => useFloorTabs());
    act(() => { result.current.onSelectAllFloors(); });
    expect(useViewMode3DStore.getState().mode).toBe('3d-preview');
  });

  it('onSelectTab returns scope to single', async () => {
    useViewMode3DStore.setState({ floor3DScope: 'all' });
    const { result } = renderHook(() => useFloorTabs());
    await act(async () => { await result.current.onSelectTab(existingTab); });
    expect(useViewMode3DStore.getState().floor3DScope).toBe('single');
  });

  it('onToggleFloorVisible flips a real floor show↔hide', () => {
    const { result } = renderHook(() => useFloorTabs());
    act(() => { result.current.onToggleFloorVisible(existingTab); });
    expect(useViewMode3DStore.getState().floorVisibilityModes.get('L1')).toBe('hide');
    act(() => { result.current.onToggleFloorVisible(existingTab); });
    expect(useViewMode3DStore.getState().floorVisibilityModes.get('L1')).toBe('show');
  });

  it('onToggleFloorVisible is a no-op for a virtual floor (no level)', () => {
    const { result } = renderHook(() => useFloorTabs());
    act(() => { result.current.onToggleFloorVisible(virtualTab); });
    expect(useViewMode3DStore.getState().floorVisibilityModes.size).toBe(0);
  });
});
