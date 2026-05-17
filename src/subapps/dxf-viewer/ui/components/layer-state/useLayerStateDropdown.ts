'use client';

/**
 * useLayerStateDropdown — Phase 12+13B.3 popover state SSoT (ADR-358 §5.9 Q12).
 *
 * Subscribes to `LayerStateStore` via `useSyncExternalStore` and exposes the
 * action surface the dropdown UI needs:
 *   - Save current snapshot (inline name input flow).
 *   - Rename / Delete saved states (inline row actions).
 *   - Restore a saved state via `RestoreLayerStateCommand` (undo-able).
 *   - **Phase 13B.3**: open template browser / save-as-template modals,
 *     wired through `useLayerStateTemplates` (cross-project library).
 *
 * Dialog open/close state for the two template modals lives here — that's
 * the simplest way for the popover footer entries to trigger them; the
 * popover still owns its own Radix open/close state separately.
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  deleteLayerStateById,
  exportLayerStatesAsLas,
  getLayerStateStoreSnapshot,
  importLayerStatesFromLas,
  renameLayerState,
  saveCurrentLayerState,
  subscribeLayerStateStore,
  type LasImportSummary,
  type LayerStateStoreSnapshot,
} from '../../../stores/LayerStateStore';
import { buildLasFilename } from '../../../services/las-exporter';
import { RestoreLayerStateCommand } from '../../../core/commands/layer/RestoreLayerStateCommand';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import {
  useLayerStateTemplates,
  type UseLayerStateTemplatesResult,
} from './useLayerStateTemplates';
import type { ICommand } from '../../../core/commands/interfaces';
import type { LayerState } from '../../../types/layer-state';

export interface LasExportPayload {
  readonly content: string;
  readonly filename: string;
}

export interface LayerStateDropdownActions {
  readonly saveCurrent: (name: string) => LayerState | null;
  readonly rename: (id: string, newName: string) => void;
  readonly remove: (id: string) => void;
  readonly restore: (id: string) => RestoreLayerStateCommand | null;
  readonly exportLas: () => LasExportPayload | null;
  readonly importLas: (content: string) => LasImportSummary;
  readonly openTemplateBrowser: () => void;
  readonly openSaveAsTemplate: (sourceStateId?: string) => void;
  readonly closeTemplateBrowser: () => void;
  readonly closeSaveAsTemplate: () => void;
}

export interface LayerStateDropdownDialogState {
  readonly browserOpen: boolean;
  readonly saveAsOpen: boolean;
  readonly saveAsSourceStateId: string | undefined;
}

export interface LayerStateDropdownState {
  readonly snapshot: LayerStateStoreSnapshot;
  readonly currentState: LayerState | null;
  readonly isReady: boolean;
  readonly templates: UseLayerStateTemplatesResult;
  readonly dialogs: LayerStateDropdownDialogState;
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

  const exportLas = useCallback((): LasExportPayload | null => {
    const content = exportLayerStatesAsLas();
    if (!content) return null;
    const filename = buildLasFilename(snapshot.states);
    return { content, filename };
  }, [snapshot.states]);

  const importLas = useCallback(
    (content: string): LasImportSummary => importLayerStatesFromLas(content),
    [],
  );

  // ─── Templates (Phase 13B.3) ────────────────────────────────────────────────
  const { user } = useAuth();
  const companyResult = useCompanyId();
  const templates = useLayerStateTemplates({
    companyId: companyResult?.companyId ?? '',
    userId: user?.uid ?? '',
  });

  const [browserOpen, setBrowserOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsSourceStateId, setSaveAsSourceStateId] = useState<string | undefined>(undefined);

  const openTemplateBrowser = useCallback((): void => {
    setBrowserOpen(true);
  }, []);

  const closeTemplateBrowser = useCallback((): void => {
    setBrowserOpen(false);
  }, []);

  const openSaveAsTemplate = useCallback((sourceStateId?: string): void => {
    setSaveAsSourceStateId(sourceStateId);
    setSaveAsOpen(true);
  }, []);

  const closeSaveAsTemplate = useCallback((): void => {
    setSaveAsOpen(false);
    setSaveAsSourceStateId(undefined);
  }, []);

  const dialogs = useMemo<LayerStateDropdownDialogState>(
    () => ({ browserOpen, saveAsOpen, saveAsSourceStateId }),
    [browserOpen, saveAsOpen, saveAsSourceStateId],
  );

  return {
    state: { snapshot, currentState, isReady, templates, dialogs },
    actions: {
      saveCurrent,
      rename,
      remove,
      restore,
      exportLas,
      importLas,
      openTemplateBrowser,
      openSaveAsTemplate,
      closeTemplateBrowser,
      closeSaveAsTemplate,
    },
  };
}
