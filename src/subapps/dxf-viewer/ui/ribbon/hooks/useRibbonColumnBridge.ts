'use client';

/**
 * ADR-363 Phase 4 / 4.5 — Bridge μεταξύ contextual Column ribbon tab και
 * active `ColumnEntity` params.
 *
 * Mirrors `useRibbonBeamBridge`: read state via `getComboboxState`, write via
 * `onComboboxChange`. Phase 4.5 routes every mutation through
 * `UpdateColumnParamsCommand` (via `useCommandHistory().execute`) ώστε η
 * αλλαγή να είναι undoable + geometry/validation να επανυπολογίζονται
 * atomically. `useColumnPersistence` picks up την αλλαγή μέσω debounced
 * auto-save. Ribbon edits χρησιμοποιούν `isDragging=false` ώστε κάθε edit
 * να είναι δικό του undo entry (drag merging ζει στο grip-commit path).
 *
 * No-ops για commandKeys εκτός `COLUMN_RIBBON_KEYS` ώστε να composeί με τα
 * stair / wall / opening / slab / beam / array / text bridges στο
 * `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isColumnEntity } from '../../../types/entities';
import type {
  ColumnEntity,
  ColumnKind,
} from '../../../bim/types/column-types';
import { useCommandHistory } from '../../../core/commands';
import { DetachColumnsCommand, type ColumnDetachSide } from '../../../core/commands/entity-commands/DetachColumnsCommand';
import { resolveColumnAttachTargets } from '../../../bim/walls/wall-attach-pick';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  COLUMN_RIBBON_KEYS_ACTIONS,
  COLUMN_RIBBON_BADGE_KEYS,
  isColumnVisibilityKey,
  resolveColumnPanelVisibility,
} from './bridge/column-command-keys';
import { autoReinforceColumn } from './bridge/column-structural-bridge';
import { useColumnParamsDispatcher } from './bridge/useColumnParamsDispatcher';
import { columnToolBridgeStore } from './bridge/column-tool-bridge-store';
import {
  resolveColumnComboboxState,
  applyColumnComboboxChange,
} from './bridge/column-bridge-combobox-resolvers';
import { PSET_RIBBON_ACTION } from './bridge/pset-action-keys';
import { EventBus } from '../../../systems/events/EventBus';
// ADR-441 Slice GEN-COL — one-shot «Κολώνες από κάναβο» (στις τομές).
import { getGlobalGuideStore } from '../../../systems/guides/guide-store';
import { resolveSceneUnits } from '../../../utils/scene-units';
import { commitColumnGridFromGuides } from '../../../bim/columns/column-grid-commit';
import type { GridPerimeterMode } from '../../../bim/grid/grid-justification';
import { columnGridSettingsStore } from './bridge/grid-perimeter-mode-stores';
import { warnIfGridJustificationConflict } from '../../../bim/grid/grid-justification-consistency';
import { emitColumnsFromGridToast } from './bridge/column-grid-toast';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId' | 'getSelectedEntityIds'
>;

export interface UseRibbonColumnBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonColumnBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  /** Returns `true` όταν το currently selected column έχει code violations. */
  readonly getBadgeState: (badgeKey: string) => boolean;
  /** Handles ribbon simple-button actions (close / delete). */
  readonly onAction: (action: string) => void;
  /**
   * ADR-363 Phase 8D — panel visibility resolver. Returns `true` όταν το panel
   * πρέπει να εμφανίζεται.
   *   - polygonParams → kind === 'polygon'
   *   - ishapeParams  → kind === 'I-shape'
   * Keys εκτός `COLUMN_RIBBON_VISIBILITY_KEYS` επιστρέφουν `true` (no-op).
   */
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

const COLUMN_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  COLUMN_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

export function useRibbonColumnBridge(
  props: UseRibbonColumnBridgeProps,
): RibbonColumnBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  // ADR-363 Phase 8D — Reactive subscription to the drawing-tool handle so the
  // ribbon re-renders when the user switches kind in drawing mode (no selected
  // entity). Selected-entity reads are driven by `useUniversalSelection`.
  const toolHandle = columnToolBridgeStore.use();

  const resolveColumn = useCallback((): ColumnEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isColumnEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch — SSoT writer shared με το docked Properties panel
   * (`useColumnParamsDispatcher`): undoable `UpdateColumnParamsCommand` +
   * geometry/validation recompute atomically· debounced auto-save via
   * `useColumnPersistence`.
   */
  const dispatchParams = useColumnParamsDispatcher({ levelManager });

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null =>
      resolveColumnComboboxState(commandKey, resolveColumn(), toolHandle),
    [resolveColumn, toolHandle],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      applyColumnComboboxChange(commandKey, value, resolveColumn(), dispatchParams);
    },
    [resolveColumn, dispatchParams],
  );

  // Toggles unused Phase 4 — included για interface parity.
  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op Phase 4 */
  }, []);

  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const getBadgeState = useCallback((badgeKey: string): boolean => {
    if (!COLUMN_OWNED_BADGE_KEYS.has(badgeKey)) return false;
    const column = resolveColumn();
    if (!column) return false;
    if (badgeKey === COLUMN_RIBBON_BADGE_KEYS.violations) {
      return column.validation.hasCodeViolations;
    }
    return false;
  }, [resolveColumn]);

  // ADR-401 Phase F.3 — manual detach of ALL selected columns' top/base from their
  // structural host(s). Restores default binding + clears attach ids (one undo).
  const handleDetach = useCallback(
    (side: ColumnDetachSide): void => {
      if (!levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;
      const targets = resolveColumnAttachTargets(
        universalSelection.getSelectedEntityIds(),
        scene.entities,
      );
      if (targets.length === 0) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(new DetachColumnsCommand(side, targets, sm));
      EventBus.emit('bim:columns-detached', { side, columnIds: targets.map((t) => t.columnId) });
    },
    [levelManager, universalSelection, executeCommand],
  );

  // ADR-441 Slice GEN-COL / 3-mode — «Κολώνες από κάναβο»: born-bound κολώνα σε κάθε
  // τομή (idempotent), με περιμετρική έδραση anchor (center/inner/outer). Πάντα toast.
  const handleColumnsFromGrid = useCallback((mode: GridPerimeterMode): void => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    columnGridSettingsStore.set(mode);
    const scene = levelManager.getLevelScene(levelId);
    const result = commitColumnGridFromGuides({
      guideReader: getGlobalGuideStore(),
      getLevelScene: levelManager.getLevelScene,
      setLevelScene: levelManager.setLevelScene,
      levelId,
      sceneUnits: scene ? resolveSceneUnits(scene) : 'mm',
      executeCommand,
      perimeterMode: columnGridSettingsStore.get(),
    });
    emitColumnsFromGridToast(result);
    // ADR-441 3-mode — soft warning αν η έδραση ασυνεπεί με υπάρχοντα grid-στοιχεία.
    warnIfGridJustificationConflict(levelManager.getLevelScene(levelId));
  }, [levelManager, executeCommand]);

  const onAction = useCallback(
    (action: string): void => {
      // ADR-456 Slice 2 — «Auto οπλισμός»: code-suggested ελάχιστος-έγκυρος.
      if (action === COLUMN_RIBBON_KEYS_ACTIONS.autoReinforce) {
        const column = resolveColumn();
        if (column) autoReinforceColumn(column, (next) => dispatchParams(column, next));
        return;
      }
      // ADR-457 — «Λεπτομέρεια Οπλισμού»: άνοιγμα του φύλλου σχεδίου οπλισμού.
      if (action === COLUMN_RIBBON_KEYS_ACTIONS.reinforcementDetail) {
        const column = resolveColumn();
        if (!column || !levelManager.currentLevelId) return;
        EventBus.emit('bim:column-detail-requested', {
          columnId: column.id,
          levelId: levelManager.currentLevelId,
        });
        return;
      }
      if (action === COLUMN_RIBBON_KEYS_ACTIONS.fromGrid) { handleColumnsFromGrid('inner'); return; }
      if (action === COLUMN_RIBBON_KEYS_ACTIONS.fromGridCenter) { handleColumnsFromGrid('center'); return; }
      if (action === COLUMN_RIBBON_KEYS_ACTIONS.fromGridOuter) { handleColumnsFromGrid('outer'); return; }
      if (action === PSET_RIBBON_ACTION) {
        const column = resolveColumn();
        if (!column || !levelManager.currentLevelId) return;
        EventBus.emit('bim:pset-editor-open', {
          entityId: column.id,
          levelId: levelManager.currentLevelId,
          entityType: 'column',
        });
        return;
      }
      if (action === COLUMN_RIBBON_KEYS_ACTIONS.detachTop) { handleDetach('top'); return; }
      if (action === COLUMN_RIBBON_KEYS_ACTIONS.detachBase) { handleDetach('base'); return; }
      if (action !== COLUMN_RIBBON_KEYS_ACTIONS.delete) return;
      const column = resolveColumn();
      if (!column) return;
      const confirmed = window.confirm(
        t('ribbon.commands.columnEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:column-delete-requested', { columnId: column.id });
    },
    [resolveColumn, levelManager, t, handleDetach, handleColumnsFromGrid, dispatchParams],
  );

  /**
   * ADR-363 Phase 8D — Panel visibility resolver. Returns `true` when the
   * panel should render. Resolves `kind` from the selected entity first;
   * falls back to the drawing-tool handle when no entity is selected (so the
   * polygon/I-shape input panels appear/hide as the user switches kind during
   * column creation).
   */
  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      const column = resolveColumn();
      const kind: ColumnKind | null = column
        ? column.params.kind
        : toolHandle?.isActive
          ? toolHandle.kind
          : null;
      const poly = column?.params.ushape?.polygon;
      return resolveColumnPanelVisibility(visibilityKey, kind, !!(poly && poly.length >= 3));
    },
    [resolveColumn, toolHandle],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer. */
export function isColumnBadgeKey(badgeKey: string): boolean {
  return COLUMN_OWNED_BADGE_KEYS.has(badgeKey);
}

/** ADR-363 Phase 8D — type guard used by `useRibbonCommands` composer. */
export function isColumnPanelVisibilityKey(visibilityKey: string): boolean {
  return isColumnVisibilityKey(visibilityKey);
}

/** Exposed so action interceptor μπορεί να αναγνωρίσει `column.actions.close`. */
export const COLUMN_BRIDGE_ACTIONS = COLUMN_RIBBON_KEYS_ACTIONS;
