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
  ColumnAnchor,
  ColumnEntity,
  ColumnKind,
  ColumnParams,
} from '../../../bim/types/column-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateColumnParamsCommand } from '../../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  COLUMN_RIBBON_KEYS,
  COLUMN_RIBBON_KEYS_ACTIONS,
  COLUMN_RIBBON_BADGE_KEYS,
  isColumnRibbonKey,
  isColumnRibbonStringKey,
} from './bridge/column-command-keys';
import { EventBus } from '../../../systems/events/EventBus';
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
  'getPrimaryId'
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
}

const COLUMN_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  COLUMN_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof ColumnParams>> = {
  [COLUMN_RIBBON_KEYS.params.width]:    'width',
  [COLUMN_RIBBON_KEYS.params.depth]:    'depth',
  [COLUMN_RIBBON_KEYS.params.height]:   'height',
  [COLUMN_RIBBON_KEYS.params.rotation]: 'rotation',
};

const STRING_KEY_TO_FIELD: Readonly<Record<string, keyof ColumnParams>> = {
  [COLUMN_RIBBON_KEYS.stringParams.kind]:     'kind',
  [COLUMN_RIBBON_KEYS.stringParams.anchor]:   'anchor',
  [COLUMN_RIBBON_KEYS.stringParams.material]: 'material',
};

export function useRibbonColumnBridge(
  props: UseRibbonColumnBridgeProps,
): RibbonColumnBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

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
   * Dispatch the params patch through `UpdateColumnParamsCommand` so the
   * change is undoable + geometry/validation recompute atomically (ADR-363
   * Phase 4.5). `useColumnPersistence` picks up the patched entity via
   * debounced auto-save.
   */
  const dispatchParams = useCallback(
    (column: ColumnEntity, nextParams: ColumnParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateColumnParamsCommand(column.id, nextParams, column.params, sm, false),
      );
      EventBus.emit('bim:column-params-updated', { columnId: column.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const column = resolveColumn();
      if (!column) return null;
      if (isColumnRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        const raw = column.params[field];
        // ADR-363 Phase 4.5d — surface 'rc' as the active selection when
        // `params.material` is undefined; mirrors the `resolveMaterialKey`
        // fallback used by `ColumnRenderer.drawMaterialHatch`.
        if (raw == null) {
          if (field === 'material') return { value: 'rc', options: [] };
          return null;
        }
        return { value: String(raw), options: [] };
      }
      if (isColumnRibbonKey(commandKey)) {
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const raw = column.params[field];
        if (typeof raw !== 'number') return null;
        return { value: String(Math.round(raw)), options: [] };
      }
      return null;
    },
    [resolveColumn],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const column = resolveColumn();
      if (!column) return;

      if (isColumnRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        if (field === 'kind') {
          const nextParams: ColumnParams = { ...column.params, kind: value as ColumnKind };
          dispatchParams(column, nextParams);
          return;
        }
        if (field === 'anchor') {
          const nextParams: ColumnParams = { ...column.params, anchor: value as ColumnAnchor };
          dispatchParams(column, nextParams);
          return;
        }
        if (field === 'material') {
          // ADR-363 Phase 4.5d — material patch. `isDragging=false` so every
          // pick is its own undo entry. Renderer hatch updates on the next
          // frame via the existing column-bbox bitmap-cache invalidation path.
          const nextParams: ColumnParams = { ...column.params, material: value };
          dispatchParams(column, nextParams);
        }
        return;
      }

      if (isColumnRibbonKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const nextParams: ColumnParams = { ...column.params, [field]: numeric } as ColumnParams;
        dispatchParams(column, nextParams);
      }
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

  const onAction = useCallback(
    (action: string): void => {
      if (action !== COLUMN_RIBBON_KEYS_ACTIONS.delete) return;
      const column = resolveColumn();
      if (!column) return;
      const confirmed = window.confirm(
        t('ribbon.commands.columnEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:column-delete-requested', { columnId: column.id });
    },
    [resolveColumn, t],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction],
  );
}

/** Type guard used by `useRibbonCommands` composer. */
export function isColumnBadgeKey(badgeKey: string): boolean {
  return COLUMN_OWNED_BADGE_KEYS.has(badgeKey);
}

/** Exposed so action interceptor μπορεί να αναγνωρίσει `column.actions.close`. */
export const COLUMN_BRIDGE_ACTIONS = COLUMN_RIBBON_KEYS_ACTIONS;
