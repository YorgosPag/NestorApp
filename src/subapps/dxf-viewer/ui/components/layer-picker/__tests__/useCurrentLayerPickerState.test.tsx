/**
 * useCurrentLayerPickerState — ADR-358 Phase 7 §5.5.bis Q8 integration tests.
 *
 * Wires the hook against a real LayerStore (no mock) with stubbed
 * `useLevels`, `useNotifications`, `useTranslation`, `useCanEditText`, and
 * `userSettingsRepository` so that derivation + selection + persistence +
 * seed + permission + pulse paths exercise their real branches.
 */

import { renderHook, act } from '@testing-library/react';

const notifySuccess = jest.fn();
const notifyWarning = jest.fn();
const mockTranslate = jest.fn((key: string, vars?: Record<string, unknown>) => {
  if (!vars) return key;
  return `${key}|${JSON.stringify(vars)}`;
});

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockTranslate, i18n: { language: 'el' } }),
}));

jest.mock('../../../../../../providers/NotificationProvider', () => ({
  useNotifications: () => ({
    success: notifySuccess,
    error: jest.fn(),
    warning: notifyWarning,
    info: jest.fn(),
  }),
}));

const mockUseLevels = jest.fn();
jest.mock('../../../../systems/levels/useLevels', () => ({
  useLevels: () => mockUseLevels(),
}));

jest.mock('../../../../hooks/useCanEditText', () => ({
  useCanEditText: () => ({
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canUnlockLayer: true,
    denyReason: null,
  }),
}));

const mockRepoIsReady = jest.fn(() => false);
const mockRepoUpdate = jest.fn();
const mockRepoGetSlice = jest.fn(() => undefined);
jest.mock('@/services/user-settings', () => ({
  userSettingsRepository: {
    isReady: () => mockRepoIsReady(),
    updateSlice: (...args: unknown[]) => mockRepoUpdate(...args),
    getSlice: (...args: unknown[]) => mockRepoGetSlice(...args),
  },
}));

import {
  __resetLayerStoreForTesting,
  setLayers,
  setCurrentLayerId,
  getCurrentLayerId,
  getRecentLayerIds,
  getLayer,
} from '../../../../stores/LayerStore';
import { createSceneLayer } from '../../../../types/entities';
import {
  useCurrentLayerPickerState,
  pickInitialLayerId,
} from '../useCurrentLayerPickerState';

const PROJECT_ID = 'proj_test';
const LEVEL_ID = 'lvl_a';

beforeEach(() => {
  __resetLayerStoreForTesting();
  notifySuccess.mockClear();
  notifyWarning.mockClear();
  mockRepoIsReady.mockReturnValue(false);
  mockRepoUpdate.mockClear();
  mockRepoGetSlice.mockReset();
  mockRepoGetSlice.mockReturnValue(undefined);
  mockUseLevels.mockReturnValue({
    currentLevelId: LEVEL_ID,
    levels: [{ id: LEVEL_ID, projectId: PROJECT_ID }],
  });
  if (typeof window !== 'undefined') window.localStorage.clear();
});

function seedScene(): void {
  setLayers([
    createSceneLayer({ id: 'lyr_walls', name: 'Walls', category: 'architectural' }),
    createSceneLayer({ id: 'lyr_doors', name: 'Doors', category: 'architectural' }),
    createSceneLayer({ id: 'lyr_columns', name: 'Columns', category: 'structural' }),
    createSceneLayer({ id: 'lyr_outlets', name: 'Outlets', category: 'electrical' }),
  ]);
}

describe('pickInitialLayerId — pure fn (Q8 line 863)', () => {
  it('returns null on empty array', () => {
    expect(pickInitialLayerId([])).toBeNull();
  });

  it('prefers Layer "0" when present (AutoCAD parity)', () => {
    const layers = [
      createSceneLayer({ id: 'lyr_a', name: 'A', category: 'architectural' }),
      createSceneLayer({ id: 'lyr_zero', name: '0' }),
    ];
    expect(pickInitialLayerId(layers)).toBe('lyr_zero');
  });

  it('falls back to first general-category layer when no "0"', () => {
    const layers = [
      createSceneLayer({ id: 'lyr_e', name: 'Outlets', category: 'electrical' }),
      createSceneLayer({ id: 'lyr_g', name: 'Notes', category: 'general' }),
    ];
    expect(pickInitialLayerId(layers)).toBe('lyr_g');
  });

  it('falls back to layers[0] when neither "0" nor general present', () => {
    const layers = [
      createSceneLayer({ id: 'lyr_a', name: 'A', category: 'architectural' }),
      createSceneLayer({ id: 'lyr_e', name: 'B', category: 'electrical' }),
    ];
    expect(pickInitialLayerId(layers)).toBe('lyr_a');
  });
});

describe('useCurrentLayerPickerState — derivation', () => {
  it('reports isReady=false on empty store', () => {
    const { result } = renderHook(() => useCurrentLayerPickerState());
    expect(result.current.state.isReady).toBe(false);
    expect(result.current.state.currentLayer).toBeNull();
  });

  it('exposes current layer + grouped categories in stable order', () => {
    seedScene();
    setCurrentLayerId('lyr_walls');
    const { result } = renderHook(() => useCurrentLayerPickerState());
    expect(result.current.state.currentLayer?.name).toBe('Walls');
    expect(result.current.state.groupedByCategory.map((g) => g.category)).toEqual([
      'architectural',
      'structural',
      'electrical',
    ]);
    const arch = result.current.state.groupedByCategory[0];
    expect(arch.layers.map((l) => l.name)).toEqual(['Doors', 'Walls']);
  });
});

describe('useCurrentLayerPickerState — initial seed (Q8 line 863)', () => {
  it('seeds Layer "0" on first scene load when no persisted current', () => {
    setLayers([
      createSceneLayer({ id: 'lyr_zero', name: '0' }),
      createSceneLayer({ id: 'lyr_walls', name: 'Walls', category: 'architectural' }),
    ]);
    renderHook(() => useCurrentLayerPickerState());
    expect(getCurrentLayerId()).toBe('lyr_zero');
  });

  it('seeds first layer when no "0" / general present', () => {
    seedScene();
    renderHook(() => useCurrentLayerPickerState());
    expect(getCurrentLayerId()).toBe('lyr_walls');
  });

  it('does not seed when current already set by hydration source', () => {
    seedScene();
    window.localStorage.setItem(`dxf:currentLayer:${PROJECT_ID}:${LEVEL_ID}`, 'lyr_columns');
    renderHook(() => useCurrentLayerPickerState());
    expect(getCurrentLayerId()).toBe('lyr_columns');
  });
});

describe('useCurrentLayerPickerState — recent + alpha fallback (Q8 line 858)', () => {
  it('fills recent up to 5 alphabetically when stack < 5', () => {
    seedScene();
    setCurrentLayerId('lyr_walls');
    const { result } = renderHook(() => useCurrentLayerPickerState());
    const recent = result.current.state.recentLayers.map((l) => l.name);
    expect(recent).toHaveLength(4);
    expect(recent[0]).toBe('Walls');
    expect(recent.slice(1).sort()).toEqual(['Columns', 'Doors', 'Outlets']);
  });

  it('caps recent display at 5 entries even when store holds more', () => {
    setLayers(
      Array.from({ length: 7 }, (_, i) =>
        createSceneLayer({ id: `lyr_${i}`, name: `L${i}`, category: 'general' }),
      ),
    );
    for (let i = 0; i < 7; i += 1) setCurrentLayerId(`lyr_${i}`);
    const { result } = renderHook(() => useCurrentLayerPickerState());
    expect(result.current.state.recentLayers).toHaveLength(5);
  });
});

describe('useCurrentLayerPickerState — selectLayer', () => {
  it('updates LayerStore.currentLayerId + fires success toast on change', () => {
    seedScene();
    const { result } = renderHook(() => useCurrentLayerPickerState());
    act(() => {
      result.current.actions.selectLayer('lyr_doors');
    });
    expect(getCurrentLayerId()).toBe('lyr_doors');
    expect(notifySuccess).toHaveBeenCalledTimes(1);
    expect(notifySuccess.mock.calls[0][0]).toContain('layerPicker.toastChanged');
    expect(result.current.state.isOpen).toBe(false);
  });

  it('re-selecting the current layer skips toast but bumps recent stack', () => {
    seedScene();
    setCurrentLayerId('lyr_doors');
    setCurrentLayerId('lyr_walls');
    const { result } = renderHook(() => useCurrentLayerPickerState());
    notifySuccess.mockClear();
    act(() => {
      result.current.actions.selectLayer('lyr_walls');
    });
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(getRecentLayerIds()[0]).toBe('lyr_walls');
  });

  it('rejects unknown layer ids silently (no current change)', () => {
    seedScene();
    const { result } = renderHook(() => useCurrentLayerPickerState());
    const beforeId = getCurrentLayerId();
    act(() => {
      result.current.actions.selectLayer('lyr_ghost');
    });
    expect(getCurrentLayerId()).toBe(beforeId);
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('blocks frozen layer selection with warning toast (Q8 line 846)', () => {
    setLayers([
      createSceneLayer({ id: 'lyr_w', name: 'Walls', category: 'architectural' }),
      createSceneLayer({ id: 'lyr_f', name: 'Frozen', frozen: true }),
    ]);
    const { result } = renderHook(() => useCurrentLayerPickerState());
    notifyWarning.mockClear();
    act(() => {
      result.current.actions.selectLayer('lyr_f');
    });
    expect(notifyWarning).toHaveBeenCalledTimes(1);
    expect(notifyWarning.mock.calls[0][0]).toContain('layerPicker.toastFrozen');
    expect(getCurrentLayerId()).not.toBe('lyr_f');
  });

  it('bumps pulseToken on every user pick', () => {
    seedScene();
    const { result } = renderHook(() => useCurrentLayerPickerState());
    const tokenBefore = result.current.state.pulseToken;
    act(() => {
      result.current.actions.selectLayer('lyr_doors');
    });
    expect(result.current.state.pulseToken).toBe(tokenBefore + 1);
    act(() => {
      result.current.actions.selectLayer('lyr_doors');
    });
    expect(result.current.state.pulseToken).toBe(tokenBefore + 2);
  });
});

describe('useCurrentLayerPickerState — mutation actions', () => {
  it('toggleVisibility flips layer.visible in the store', () => {
    seedScene();
    const { result } = renderHook(() => useCurrentLayerPickerState());
    expect(getLayer('lyr_walls')?.visible).toBe(true);
    act(() => {
      result.current.actions.toggleVisibility('lyr_walls');
    });
    expect(getLayer('lyr_walls')?.visible).toBe(false);
  });

  it('toggleFreeze flips layer.frozen in the store', () => {
    seedScene();
    const { result } = renderHook(() => useCurrentLayerPickerState());
    expect(getLayer('lyr_walls')?.frozen).toBe(false);
    act(() => {
      result.current.actions.toggleFreeze('lyr_walls');
    });
    expect(getLayer('lyr_walls')?.frozen).toBe(true);
  });
});

describe('useCurrentLayerPickerState — search filter', () => {
  it('narrows recent + grouped when query is set', () => {
    seedScene();
    setCurrentLayerId('lyr_walls');
    setCurrentLayerId('lyr_doors');
    setCurrentLayerId('lyr_columns');
    const { result, rerender } = renderHook(() => useCurrentLayerPickerState());
    act(() => result.current.actions.setSearchQuery('wall'));
    rerender();
    expect(result.current.state.filteredRecent.map((l) => l.name)).toEqual(['Walls']);
    expect(result.current.state.filteredGroups).toHaveLength(1);
    expect(result.current.state.filteredGroups[0].layers.map((l) => l.name)).toEqual(['Walls']);
  });

  it('empty query restores the full grouped view', () => {
    seedScene();
    const { result, rerender } = renderHook(() => useCurrentLayerPickerState());
    act(() => result.current.actions.setSearchQuery('zzzz'));
    rerender();
    expect(result.current.state.filteredGroups).toEqual([]);
    act(() => result.current.actions.setSearchQuery(''));
    rerender();
    expect(result.current.state.filteredGroups.length).toBeGreaterThan(0);
  });
});

describe('useCurrentLayerPickerState — persistence', () => {
  it('hydrates current + recent from localStorage on mount', () => {
    seedScene();
    window.localStorage.setItem(`dxf:currentLayer:${PROJECT_ID}:${LEVEL_ID}`, 'lyr_columns');
    window.localStorage.setItem(
      `dxf:recentLayers:${PROJECT_ID}`,
      JSON.stringify(['lyr_columns', 'lyr_walls']),
    );
    renderHook(() => useCurrentLayerPickerState());
    expect(getCurrentLayerId()).toBe('lyr_columns');
    expect(getRecentLayerIds()).toEqual(['lyr_columns', 'lyr_walls']);
  });

  it('falls back to Firestore slice when localStorage is empty', () => {
    seedScene();
    mockRepoIsReady.mockReturnValue(true);
    mockRepoGetSlice.mockReturnValue({
      layerPicker: {
        currentByLevel: { [PROJECT_ID]: { [LEVEL_ID]: 'lyr_doors' } },
        recentByProject: { [PROJECT_ID]: ['lyr_doors', 'lyr_outlets'] },
      },
    });
    renderHook(() => useCurrentLayerPickerState());
    expect(getCurrentLayerId()).toBe('lyr_doors');
    expect(getRecentLayerIds()).toEqual(['lyr_doors', 'lyr_outlets']);
  });

  it('writes localStorage after a user selection', () => {
    seedScene();
    const { result } = renderHook(() => useCurrentLayerPickerState());
    act(() => {
      result.current.actions.selectLayer('lyr_doors');
    });
    expect(window.localStorage.getItem(`dxf:currentLayer:${PROJECT_ID}:${LEVEL_ID}`)).toBe(
      'lyr_doors',
    );
    const recent = JSON.parse(
      window.localStorage.getItem(`dxf:recentLayers:${PROJECT_ID}`) ?? '[]',
    );
    expect(recent[0]).toBe('lyr_doors');
  });
});
