'use client';

/**
 * useLayerStateDropdown — Phase 12 popover state SSoT (ADR-358 §5.9 Q12).
 *
 * Subscribes to `LayerStateStore` via `useSyncExternalStore` and exposes the
 * action surface the dropdown UI needs:
 *   - Save current snapshot (inline name input flow).
 *   - Rename / Delete saved states (inline row actions).
 *   - Restore a saved state via `RestoreLayerStateCommand` (undo-able).
 *
 * No popover open/close state lives here — that's owned by the Radix Popover
 * in `LayerStateDropdown.tsx`. This hook stays a pure micro-leaf, callable
 * from tests without rendering the popover shell.
 */

import { useCallback, useSyncExternalStore } from 'react';
import {
  deleteLayerStateById,
  getLayerStateStoreSnapshot,
  renameLayerState,
  saveCurrentLayerState,
  subscribeLayerStateStore,
  type LayerStateStoreSnapshot,
} from '../../../stores/LayerStateStore';
import { RestoreLayerStateCommand } from '../../../core/commands/layer/RestoreLayerStateCommand';
import type { ICommand } from '../../../core/commands/interfaces';
import type { LayerState } from '../../../types/layer-state';

export interface LayerStateDropdownActions {
  readonly saveCurrent: (name: string) => LayerState | null;
  readonly rename: (id: string, newName: string) => void;
  readonly remove: (id: string) => void;
  readonly restore: (id: string) => RestoreLayerStateCommand | null;
}

export interface LayerStateDropdownState {
  readonly snapshot: LayerStateStoreSnapshot;
  readonly currentState: LayerState | null;
  readonly isReady: boolean;
}

export function useLayerStateDropdown(
  executeCommand: (cmd: ICommand) => void,
): { state: LayerStateDropdownState; actions: LayerStateDropdownActions } {
  const snapshot = useSyncExternalStore(
    subscribeLayerStateStore,
    getLayerStateStoreSnapshot,
    getLayerStateStoreSnapshot,
  );

  const currentState = snapshot.currentStateId
    ? snapshot.states.find((s) => s.id === snapshot.currentStateId) ?? null
    : null;

  const isReady =
    snapshot.projectId !== null && snapshot.hydrationStatus !== 'idle';

  const saveCurrent = useCallback(
    (name: string): LayerState | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      return saveCurrentLayerState({ name: trimmed });
    },
    [],
  );

  const rename = useCallback((id: string, newName: string): void => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    renameLayerState(id, trimmed);
  }, []);

  const remove = useCallback((id: string): void => {
    deleteLayerStateById(id);
  }, []);

  const restore = useCallback(
    (id: string): RestoreLayerStateCommand | null => {
      const cmd = new RestoreLayerStateCommand({ stateId: id });
      executeCommand(cmd);
      return cmd;
    },
    [executeCommand],
  );

  return {
    state: { snapshot, currentState, isReady },
    actions: { saveCurrent, rename, remove, restore },
  };
}
