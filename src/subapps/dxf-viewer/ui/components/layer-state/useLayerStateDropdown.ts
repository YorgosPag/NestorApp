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
  duplicateLayerState,
  exportLayerStatesAsLas,
  getLayerState,
  getLayerStateStoreSnapshot,
  importLayerStatesFromLas,
  renameLayerState,
  saveCurrentLayerState,
  subscribeLayerStateStore,
  updateLayerStateCategory,
  type LasImportSummary,
  type LayerStateStoreSnapshot,
} from '../../../stores/LayerStateStore';
import { getAllLayers } from '../../../stores/LayerStore';
import { buildLasFilename } from '../../../services/las-exporter';
import {
  RestoreLayerStateCommand,
  type RestoreLayerStateOptions,
} from '../../../core/commands/layer/RestoreLayerStateCommand';
import {
  useLayerStateTemplates,
  type UseLayerStateTemplatesResult,
} from './useLayerStateTemplates';
import type { ICommand } from '../../../core/commands/interfaces';
import type { LayerState } from '../../../types/layer-state';

/**
 * Auth context required by the cross-project templates surface. The hook does
 * NOT import `useAuth` / `useCompanyId` directly — that would pull the firebase
 * auth chain into every test that mounts the popover. Instead the wrapper
 * component (LayerStateDropdown.tsx) reads auth and passes the resolved values
 * in; tests can pass empty strings and the templates branch cleanly stays
 * `isReady: false`.
 */
export interface LayerStateTemplatesAuth {
  readonly companyId: string;
  readonly userId: string;
}

const EMPTY_AUTH: LayerStateTemplatesAuth = { companyId: '', userId: '' };

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
  // Phase 13C — Manage panel
  readonly openManagePanel: () => void;
  readonly closeManagePanel: () => void;
  readonly openRestoreDialog: (stateId: string) => void;
  readonly closeRestoreDialog: () => void;
  readonly duplicate: (id: string, nameSuffix: string) => LayerState | null;
  readonly bulkDelete: (ids: ReadonlyArray<string>) => void;
  readonly updateCategory: (id: string, category: string) => void;
  /** Smart restore: direct if no unmatched layers, dialog otherwise (D1 policy). */
  readonly smartRestore: (id: string) => void;
  /** Restore with explicit options — used by LayerStateRestoreDialog after user confirms. */
  readonly restoreWithOptions: (id: string, options: RestoreLayerStateOptions) => void;
}

export interface LayerStateDropdownDialogState {
  readonly browserOpen: boolean;
  readonly saveAsOpen: boolean;
  readonly saveAsSourceStateId: string | undefined;
  readonly managePanelOpen: boolean;
  readonly restoreDialogStateId: string | undefined;
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
  templatesAuth: LayerStateTemplatesAuth = EMPTY_AUTH,
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
  const templates = useLayerStateTemplates({
    companyId: templatesAuth.companyId,
    userId: templatesAuth.userId,
  });

  const [browserOpen, setBrowserOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsSourceStateId, setSaveAsSourceStateId] = useState<string | undefined>(undefined);
  const [managePanelOpen, setManagePanelOpen] = useState(false);
  const [restoreDialogStateId, setRestoreDialogStateId] = useState<string | undefined>(undefined);

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

  const openManagePanel = useCallback((): void => {
    setManagePanelOpen(true);
  }, []);

  const closeManagePanel = useCallback((): void => {
    setManagePanelOpen(false);
  }, []);

  const openRestoreDialog = useCallback((stateId: string): void => {
    setRestoreDialogStateId(stateId);
  }, []);

  const closeRestoreDialog = useCallback((): void => {
    setRestoreDialogStateId(undefined);
  }, []);

  const duplicate = useCallback(
    (id: string, nameSuffix: string): LayerState | null => duplicateLayerState(id, nameSuffix),
    [],
  );

  const bulkDelete = useCallback((ids: ReadonlyArray<string>): void => {
    for (const id of ids) {
      deleteLayerStateById(id);
    }
  }, []);

  const updateCategory = useCallback((id: string, category: string): void => {
    updateLayerStateCategory(id, category);
  }, []);

  const smartRestore = useCallback(
    (id: string): void => {
      const target = getLayerState(id);
      if (!target) return;
      const live = getAllLayers();
      const liveById = new Set(live.map((l) => l.id));
      const liveByName = new Set(live.map((l) => l.name.toLowerCase()));
      const hasUnmatched = target.snapshot.some(
        (e) => !liveById.has(e.layerId) && !liveByName.has(e.layerName.toLowerCase()),
      );
      if (hasUnmatched) {
        setRestoreDialogStateId(id);
      } else {
        const cmd = new RestoreLayerStateCommand({ stateId: id });
        executeCommand(cmd);
      }
    },
    [executeCommand],
  );

  const restoreWithOptions = useCallback(
    (id: string, options: RestoreLayerStateOptions): void => {
      const cmd = new RestoreLayerStateCommand({ stateId: id, options });
      executeCommand(cmd);
    },
    [executeCommand],
  );

  const dialogs = useMemo<LayerStateDropdownDialogState>(
    () => ({
      browserOpen,
      saveAsOpen,
      saveAsSourceStateId,
      managePanelOpen,
      restoreDialogStateId,
    }),
    [browserOpen, saveAsOpen, saveAsSourceStateId, managePanelOpen, restoreDialogStateId],
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
      openManagePanel,
      closeManagePanel,
      openRestoreDialog,
      closeRestoreDialog,
      duplicate,
      bulkDelete,
      updateCategory,
      smartRestore,
      restoreWithOptions,
    },
  };
}
