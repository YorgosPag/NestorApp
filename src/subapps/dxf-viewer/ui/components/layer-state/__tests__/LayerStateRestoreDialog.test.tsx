/**
 * LayerStateRestoreDialog tests — ADR-358 Phase 13C.
 *
 * Covers: preview renders, toggle, unmatched warning, cancel, apply with options.
 */

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: { onAuthStateChanged: jest.fn() },
  functions: {},
  storage: {},
  default: {},
}));
jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => {
    if (opts && typeof opts.count !== 'undefined') return `${key} count=${opts.count}`;
    return key;
  }}),
}));

import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { LayerStateRestoreDialog } from '../LayerStateRestoreDialog';
import {
  __resetLayerStateStoreForTesting,
  setProjectId,
  saveCurrentLayerState,
} from '../../../../stores/LayerStateStore';
import { __resetLayerStoreForTesting, setLayers } from '../../../../stores/LayerStore';
import { __resetLayerStatePersistenceForTesting } from '../../../../services/layer-state-persistence';
import { createSceneLayer } from '../../../../types/entities';
import { createLayerState, createLayerStateEntry } from '../../../../types/layer-state';
import { saveLayerState } from '../../../../services/layer-state-persistence';

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetLayerStatePersistenceForTesting();
  __resetLayerStateStoreForTesting();
  try { window.localStorage.clear(); } catch { /* SSR */ }
});

describe('LayerStateRestoreDialog — preview', () => {
  it('renders state name + entry count', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const saved = saveCurrentLayerState({ name: 'Production' });
    if (!saved) throw new Error('save failed');

    const onApply = jest.fn();
    render(
      <LayerStateRestoreDialog
        open
        onOpenChange={jest.fn()}
        stateId={saved.id}
        onApply={onApply}
      />,
    );
    expect(screen.getByText('Production')).toBeTruthy();
    expect(screen.getByTestId('restore-dialog-create-missing')).toBeTruthy();
  });

  it('create-missing toggle defaults to OFF', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const saved = saveCurrentLayerState({ name: 'Base' });
    if (!saved) throw new Error('save failed');

    render(
      <LayerStateRestoreDialog
        open
        onOpenChange={jest.fn()}
        stateId={saved.id}
        onApply={jest.fn()}
      />,
    );
    const toggle = screen.getByTestId('restore-dialog-create-missing') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });
});

describe('LayerStateRestoreDialog — unmatched warning', () => {
  it('shows warning when snapshot has layer not in live store', () => {
    const ghostState = createLayerState({
      name: 'Ghost',
      snapshot: [
        createLayerStateEntry({ layerId: 'lyr_ghost', layerName: 'GHOST', visible: true, locked: false, color: '#fff' }),
      ],
      createdByUserId: 'u1',
    });
    saveLayerState('p1', ghostState);
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');

    render(
      <LayerStateRestoreDialog
        open
        onOpenChange={jest.fn()}
        stateId={ghostState.id}
        onApply={jest.fn()}
      />,
    );
    expect(screen.getByTestId('restore-dialog-unmatched')).toBeTruthy();
  });

  it('does NOT show warning when all layers matched', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const saved = saveCurrentLayerState({ name: 'OK' });
    if (!saved) throw new Error('save failed');

    render(
      <LayerStateRestoreDialog
        open
        onOpenChange={jest.fn()}
        stateId={saved.id}
        onApply={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('restore-dialog-unmatched')).toBeNull();
  });
});

describe('LayerStateRestoreDialog — actions', () => {
  it('calls onApply with createMissingLayers=false by default', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const saved = saveCurrentLayerState({ name: 'S' });
    if (!saved) throw new Error('save failed');

    const onApply = jest.fn();
    render(
      <LayerStateRestoreDialog
        open
        onOpenChange={jest.fn()}
        stateId={saved.id}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByTestId('restore-dialog-apply'));
    expect(onApply).toHaveBeenCalledWith({ createMissingLayers: false });
  });

  it('calls onApply with createMissingLayers=true when toggled', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const saved = saveCurrentLayerState({ name: 'S' });
    if (!saved) throw new Error('save failed');

    const onApply = jest.fn();
    render(
      <LayerStateRestoreDialog
        open
        onOpenChange={jest.fn()}
        stateId={saved.id}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByTestId('restore-dialog-create-missing'));
    fireEvent.click(screen.getByTestId('restore-dialog-apply'));
    expect(onApply).toHaveBeenCalledWith({ createMissingLayers: true });
  });

  it('calls onOpenChange(false) on cancel', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const saved = saveCurrentLayerState({ name: 'S' });
    if (!saved) throw new Error('save failed');

    const onOpenChange = jest.fn();
    render(
      <LayerStateRestoreDialog
        open
        onOpenChange={onOpenChange}
        stateId={saved.id}
        onApply={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('restore-dialog-cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
