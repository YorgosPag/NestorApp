'use client';

/**
 * ADR-419 — Bridge μεταξύ contextual Floor Finish ribbon tab και active
 * `FloorFinishEntity` params.
 *
 * Mirrors `useRibbonSlabBridge` (ADR-363 Phase 3): read state via
 * `getComboboxState`, write via `onComboboxChange`. Every mutation routes
 * through `UpdateFloorFinishParamsCommand` so the change is undoable +
 * geometry recomputes atomically. `useFloorFinishPersistence` picks up the
 * patched entity via 500ms debounced auto-save.
 *
 * No-ops για commandKeys εκτός `FLOOR_FINISH_RIBBON_KEYS` ώστε να composeί
 * με τα υπόλοιπα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isFloorFinishEntity } from '../../../types/entities';
import type { FloorFinishEntity, FloorFinishMaterialId, FloorFinishParams } from '../../../bim/types/floor-finish-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateFloorFinishParamsCommand } from '../../../core/commands/entity-commands/UpdateFloorFinishParamsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  FLOOR_FINISH_RIBBON_KEYS,
  isFloorFinishRibbonNumberKey,
  isFloorFinishRibbonStringKey,
  isFloorFinishRibbonToggleKey,
  isFloorFinishRibbonActionKey,
} from './bridge/floor-finish-command-keys';
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

export interface UseRibbonFloorFinishBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonFloorFinishBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
}

const NULL_TOGGLE: RibbonToggleState = false;

export function useRibbonFloorFinishBridge(
  props: UseRibbonFloorFinishBridgeProps,
): RibbonFloorFinishBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveFloorFinish = useCallback((): FloorFinishEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isFloorFinishEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  const dispatchParams = useCallback(
    (ff: FloorFinishEntity, nextParams: FloorFinishParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateFloorFinishParamsCommand(ff.id, nextParams, ff.params, sm, false),
      );
      EventBus.emit('bim:floor-finish-params-updated', { floorFinishId: ff.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const ff = resolveFloorFinish();
      if (!ff) return null;
      if (isFloorFinishRibbonStringKey(commandKey)) {
        return { value: ff.params.materialId, options: [] };
      }
      if (isFloorFinishRibbonNumberKey(commandKey)) {
        if (commandKey === FLOOR_FINISH_RIBBON_KEYS.params.tileLengthMm) {
          return { value: ff.params.tileLengthMm != null ? String(Math.round(ff.params.tileLengthMm)) : '', options: [] };
        }
        if (commandKey === FLOOR_FINISH_RIBBON_KEYS.params.tileWidthMm) {
          return { value: ff.params.tileWidthMm != null ? String(Math.round(ff.params.tileWidthMm)) : '', options: [] };
        }
        return { value: String(Math.round(ff.params.thicknessMm)), options: [] };
      }
      return null;
    },
    [resolveFloorFinish],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const ff = resolveFloorFinish();
      if (!ff) return;

      if (isFloorFinishRibbonStringKey(commandKey)) {
        const nextParams: FloorFinishParams = { ...ff.params, materialId: value as FloorFinishMaterialId };
        dispatchParams(ff, nextParams);
        return;
      }

      if (isFloorFinishRibbonNumberKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric) || numeric <= 0) return;
        if (commandKey === FLOOR_FINISH_RIBBON_KEYS.params.tileLengthMm) {
          dispatchParams(ff, { ...ff.params, tileLengthMm: numeric });
          return;
        }
        if (commandKey === FLOOR_FINISH_RIBBON_KEYS.params.tileWidthMm) {
          dispatchParams(ff, { ...ff.params, tileWidthMm: numeric });
          return;
        }
        dispatchParams(ff, { ...ff.params, thicknessMm: numeric });
      }
    },
    [resolveFloorFinish, dispatchParams],
  );

  const onToggle = useCallback(
    (commandKey: string, nextValue: boolean): void => {
      if (!isFloorFinishRibbonToggleKey(commandKey)) return;
      const ff = resolveFloorFinish();
      if (!ff) return;
      dispatchParams(ff, { ...ff.params, tileRotate90: nextValue || undefined });
    },
    [resolveFloorFinish, dispatchParams],
  );

  const getToggleState = useCallback(
    (commandKey: string): RibbonToggleState => {
      if (!isFloorFinishRibbonToggleKey(commandKey)) return NULL_TOGGLE;
      const ff = resolveFloorFinish();
      return ff?.params.tileRotate90 ?? false;
    },
    [resolveFloorFinish],
  );

  const onAction = useCallback(
    (action: string): void => {
      if (!isFloorFinishRibbonActionKey(action)) return;
      if (action === FLOOR_FINISH_RIBBON_KEYS.actions.delete) {
        const ff = resolveFloorFinish();
        if (!ff) return;
        const confirmed = window.confirm(t('ribbon.commands.floorFinishEditor.deleteConfirm'));
        if (!confirmed) return;
        EventBus.emit('bim:floor-finish-delete-requested', { id: ff.id });
        return;
      }
      // ADR-363 — «Κλείσιμο» handled centrally in `routeRibbonAction`
      // (uniform deselect for every contextual tab). No per-bridge branch.
    },
    [resolveFloorFinish, t],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction],
  );
}

/** Type guard — exposed so `useRibbonCommands` can route floor-finish action keys. */
export function isFloorFinishActionKey(action: string): boolean {
  return isFloorFinishRibbonActionKey(action);
}
