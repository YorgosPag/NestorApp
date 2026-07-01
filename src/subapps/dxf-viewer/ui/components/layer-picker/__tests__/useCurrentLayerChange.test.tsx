/**
 * useCurrentLayerChange — ADR-358 §5.5.bis Q8 + ADR-510 Φ4 unit tests.
 *
 * The single, effect-free current-layer change action shared by the picker
 * popover AND the ribbon «Επίπεδο» combobox. Exercised against a real
 * LayerStore with stubbed `useNotifications`, `useTranslation`, and
 * `useCanEditText` so permission gate + toast + recent FIFO branches run real.
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

// Permission is toggled per-test via `canUnlockLayer` (locked-layer branch).
let canUnlockLayer = true;
jest.mock('../../../../hooks/useCanEditText', () => ({
  useCanEditText: () => ({
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canUnlockLayer,
    denyReason: null,
  }),
}));

import {
  __resetLayerStoreForTesting,
  setLayers,
  setCurrentLayerId,
  getCurrentLayerId,
  getRecentLayerIds,
} from '../../../../stores/LayerStore';
import { createSceneLayer } from '../../../../types/entities';
import { useCurrentLayerChange } from '../useCurrentLayerChange';

beforeEach(() => {
  __resetLayerStoreForTesting();
  notifySuccess.mockClear();
  notifyWarning.mockClear();
  canUnlockLayer = true;
});

function seedScene(): void {
  setLayers([
    createSceneLayer({ id: 'lyr_walls', name: 'Walls', category: 'architectural' }),
    createSceneLayer({ id: 'lyr_doors', name: 'Doors', category: 'architectural' }),
    createSceneLayer({ id: 'lyr_frozen', name: 'Frozen', frozen: true }),
    createSceneLayer({ id: 'lyr_locked', name: 'Locked', locked: true }),
  ]);
}

describe('useCurrentLayerChange', () => {
  it('changes the current layer + success toast + recent FIFO', () => {
    seedScene();
    setCurrentLayerId('lyr_walls');
    const { result } = renderHook(() => useCurrentLayerChange());

    let outcome: string | undefined;
    act(() => {
      outcome = result.current.changeCurrentLayer('lyr_doors');
    });

    expect(outcome).toBe('changed');
    expect(getCurrentLayerId()).toBe('lyr_doors');
    expect(getRecentLayerIds()).toContain('lyr_doors');
    expect(notifySuccess).toHaveBeenCalledTimes(1);
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it('reselecting the current layer bumps recent, no toast', () => {
    seedScene();
    setCurrentLayerId('lyr_walls');
    const { result } = renderHook(() => useCurrentLayerChange());

    let outcome: string | undefined;
    act(() => {
      outcome = result.current.changeCurrentLayer('lyr_walls');
    });

    expect(outcome).toBe('reselected');
    expect(getCurrentLayerId()).toBe('lyr_walls');
    expect(getRecentLayerIds()).toContain('lyr_walls');
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('blocks a frozen layer with a warning toast, no change', () => {
    seedScene();
    setCurrentLayerId('lyr_walls');
    const { result } = renderHook(() => useCurrentLayerChange());

    let outcome: string | undefined;
    act(() => {
      outcome = result.current.changeCurrentLayer('lyr_frozen');
    });

    expect(outcome).toBe('blocked');
    expect(getCurrentLayerId()).toBe('lyr_walls');
    expect(notifyWarning).toHaveBeenCalledTimes(1);
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('blocks a locked layer without unlock permission', () => {
    canUnlockLayer = false;
    seedScene();
    setCurrentLayerId('lyr_walls');
    const { result } = renderHook(() => useCurrentLayerChange());

    let outcome: string | undefined;
    act(() => {
      outcome = result.current.changeCurrentLayer('lyr_locked');
    });

    expect(outcome).toBe('blocked');
    expect(getCurrentLayerId()).toBe('lyr_walls');
    expect(notifyWarning).toHaveBeenCalledTimes(1);
  });

  it('allows a locked layer when unlock permission is granted', () => {
    canUnlockLayer = true;
    seedScene();
    setCurrentLayerId('lyr_walls');
    const { result } = renderHook(() => useCurrentLayerChange());

    let outcome: string | undefined;
    act(() => {
      outcome = result.current.changeCurrentLayer('lyr_locked');
    });

    expect(outcome).toBe('changed');
    expect(getCurrentLayerId()).toBe('lyr_locked');
  });

  it('returns not-found for an unknown id (no toast, no change)', () => {
    seedScene();
    setCurrentLayerId('lyr_walls');
    const { result } = renderHook(() => useCurrentLayerChange());

    let outcome: string | undefined;
    act(() => {
      outcome = result.current.changeCurrentLayer('lyr_missing');
    });

    expect(outcome).toBe('not-found');
    expect(getCurrentLayerId()).toBe('lyr_walls');
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyWarning).not.toHaveBeenCalled();
  });
});
