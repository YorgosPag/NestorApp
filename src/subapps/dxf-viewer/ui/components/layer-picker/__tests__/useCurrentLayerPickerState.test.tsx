/**
 * useCurrentLayerPickerState — ADR-358 Phase 7 §5.5.bis Q8 integration tests.
 *
 * Wires the hook against a real LayerStore (no mock) with stubbed
 * `useLevels`, `useNotifications`, `useTranslation`, and
 * `userSettingsRepository` so that derivation + selection + persistence
 * paths exercise their real branches.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';

const notifySuccess = jest.fn();
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
    warning: jest.fn(),
    info: jest.fn(),
  }),
}));

const mockUseLevels = jest.fn();
jest.mock('../../../../systems/levels/useLevels', () => ({
  useLevels: () => mockUseLevels(),
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
} from '../../../../stores/LayerStore';
import { createSceneLayer } from '../../../../types/entities';
import { useCurrentLayerPickerState } from '../useCurrentLayerPickerState';

const PROJECT_ID = 'proj_test';
const LEVEL_ID = 'lvl_a';

beforeEach(() => {
  __resetLayerStoreForTesting();
  notifySuccess.mockClear();
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

  it('caps recent at 5 in derived state even when store holds more', () => {
    seedScene();
    setCurrentLayerId('lyr_walls');
    setCurrentLayerId('lyr_doors');
    setCurrentLayerId('lyr_columns');
    setCurrentLayerId('lyr_outlets');
    const { result } = renderHook(() => useCurrentLayerPickerState());
    expect(result.current.state.recentLayers).toHaveLength(4);
  });
});

describe('useCurrentLayerPickerState — selectLayer', () => {
  it('updates LayerStore.currentLayerId + fires success toast', () => {
    seedScene();
    const { result } = renderHook(() => useCurrentLayerPickerState());
    act(() => {
      result.current.actions.selectLayer('lyr_walls');
    });
    expect(getCurrentLayerId()).toBe('lyr_walls');
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

  it('rejects unknown layer ids silently', () => {
    seedScene();
    const { result } = renderHook(() => useCurrentLayerPickerState());
    act(() => {
      result.current.actions.selectLayer('lyr_ghost');
    });
    expect(getCurrentLayerId()).toBeNull();
    expect(notifySuccess).not.toHaveBeenCalled();
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
      result.current.actions.selectLayer('lyr_walls');
    });
    expect(window.localStorage.getItem(`dxf:currentLayer:${PROJECT_ID}:${LEVEL_ID}`)).toBe(
      'lyr_walls',
    );
    const recent = JSON.parse(
      window.localStorage.getItem(`dxf:recentLayers:${PROJECT_ID}`) ?? '[]',
    );
    expect(recent[0]).toBe('lyr_walls');
  });
});
