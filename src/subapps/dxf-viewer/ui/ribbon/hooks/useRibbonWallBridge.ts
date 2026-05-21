'use client';

/**
 * ADR-363 Phase 1B — Bridge between the contextual Wall ribbon tab and the
 * active `WallEntity` params.
 *
 * Mirrors `useRibbonStairBridge` (ADR-358 Phase 7a): read state via
 * `getComboboxState` / `getToggleState`, write via `onComboboxChange` /
 * `onToggle`. Every write dispatches `UpdateWallParamsCommand` with
 * `isDragging=false` (commit-on-select, each change is a discrete undo step).
 *
 * Phase 1B writable surface: `category` + `height` + `thickness` + `flip`.
 * Flip is exposed as a 2-option combobox (mirrors the ribbon data shape) but
 * the bridge also honors the toggle API for future-proofing.
 *
 * The bridge no-ops for commandKeys outside `WALL_RIBBON_KEYS` so it composes
 * with the stair / array / text bridges in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.9 §5.14
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCommandHistory } from '../../../core/commands';
import { UpdateWallParamsCommand } from '../../../core/commands/entity-commands/UpdateWallParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { isWallEntity } from '../../../types/entities';
import type { WallEntity } from '../../../bim/types/wall-types';
import {
  isWallRibbonKey,
  isWallRibbonStringKey,
  isWallRibbonToggleKey,
  WALL_RIBBON_KEYS_ACTIONS,
  WALL_RIBBON_BADGE_KEYS,
} from './bridge/wall-command-keys';
import { PSET_RIBBON_ACTION } from './bridge/pset-action-keys';
import { EventBus } from '../../../systems/events/EventBus';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';
import { mmToSceneUnits, resolveSceneUnits } from '../../../utils/scene-units';
import {
  type WallPatchContext,
  readWallStringField,
  readWallNumericField,
  patchWallStringParam,
  patchWallNumericParam,
} from './bridge/wall-param-helpers';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

export interface UseRibbonWallBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonWallBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  /** Returns `true` when the currently selected wall has code violations. */
  readonly getBadgeState: (badgeKey: string) => boolean;
  /** Handles ribbon simple-button actions (e.g. delete). */
  readonly onAction: (action: string) => void;
}

const WALL_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  WALL_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

export function useRibbonWallBridge(
  props: UseRibbonWallBridgeProps,
): RibbonWallBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveWall = useCallback((): WallEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isWallEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  // Scene-units scale: ribbon I/O normalized to mm so the hardcoded
  // combobox options always line up with the displayed current value
  // (mirrors stair Phase 9 bridge contract).
  const getSceneUnitsScale = useCallback((): number => {
    const lid = levelManager.currentLevelId;
    if (!lid) return mmToSceneUnits('mm');
    const scene = levelManager.getLevelScene(lid);
    return mmToSceneUnits(resolveSceneUnits(scene));
  }, [levelManager]);

  const dispatchParams = useCallback(
    (wall: WallEntity, next: WallEntity['params']): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateWallParamsCommand(wall.id, next, wall.params, sm, false, wall.kind),
      );
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const wall = resolveWall();
      if (!wall) return null;
      if (isWallRibbonStringKey(commandKey) || isWallRibbonToggleKey(commandKey)) {
        const v = readWallStringField(commandKey, wall.params);
        return v === null ? null : { value: v, options: [] };
      }
      if (!isWallRibbonKey(commandKey)) return null;
      const v = readWallNumericField(commandKey, wall.params, getSceneUnitsScale());
      return v === null ? null : { value: v, options: [] };
    },
    [resolveWall, getSceneUnitsScale],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const wall = resolveWall();
      if (!wall) return;

      if (isWallRibbonStringKey(commandKey) || isWallRibbonToggleKey(commandKey)) {
        const next = patchWallStringParam(wall.params, commandKey, value);
        if (next === null) return;
        dispatchParams(wall, next);
        return;
      }

      if (!isWallRibbonKey(commandKey)) return;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;

      const ctx: WallPatchContext = { scale: getSceneUnitsScale() };
      const next = patchWallNumericParam(wall.params, commandKey, numeric, ctx);
      if (next === null) return;
      dispatchParams(wall, next);
    },
    [resolveWall, dispatchParams, getSceneUnitsScale],
  );

  const onToggle = useCallback(
    (commandKey: string, nextValue: boolean): void => {
      if (!isWallRibbonToggleKey(commandKey)) return;
      const wall = resolveWall();
      if (!wall) return;
      const next = patchWallStringParam(wall.params, commandKey, nextValue ? 'true' : 'false');
      if (next === null) return;
      dispatchParams(wall, next);
    },
    [resolveWall, dispatchParams],
  );

  const getToggleState = useCallback(
    (commandKey: string): RibbonToggleState => {
      if (!isWallRibbonToggleKey(commandKey)) return NULL_TOGGLE;
      const wall = resolveWall();
      if (!wall) return NULL_TOGGLE;
      const v = readWallStringField(commandKey, wall.params);
      return v === 'true';
    },
    [resolveWall],
  );

  const getBadgeState = useCallback((badgeKey: string): boolean => {
    if (!WALL_OWNED_BADGE_KEYS.has(badgeKey)) return false;
    const wall = resolveWall();
    if (!wall) return false;
    if (badgeKey === WALL_RIBBON_BADGE_KEYS.violations) {
      return wall.validation.hasCodeViolations;
    }
    return false;
  }, [resolveWall]);

  const onAction = useCallback(
    (action: string): void => {
      if (action === PSET_RIBBON_ACTION) {
        const wall = resolveWall();
        if (!wall || !levelManager.currentLevelId) return;
        EventBus.emit('bim:pset-editor-open', {
          entityId: wall.id,
          levelId: levelManager.currentLevelId,
          entityType: 'wall',
        });
        return;
      }
      if (action !== WALL_RIBBON_KEYS_ACTIONS.delete) return;
      const wall = resolveWall();
      if (!wall) return;
      const confirmed = window.confirm(
        t('ribbon.commands.wallEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:wall-delete-requested', { wallId: wall.id });
    },
    [resolveWall, levelManager, t],
  );

  // Memoize return so RibbonCommandProvider deps stay stable (ADR-040 Phase XIX).
  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction],
  );
}

/** Type guard used by `useRibbonCommands` composer. */
export function isWallBadgeKey(badgeKey: string): boolean {
  return WALL_OWNED_BADGE_KEYS.has(badgeKey);
}

/** Exposed so the action interceptor can recognize `wall.actions.close`. */
export const WALL_BRIDGE_ACTIONS = WALL_RIBBON_KEYS_ACTIONS;
