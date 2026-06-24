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
import { useCommandHistory } from '../../../core/commands';
import { UpdateWallParamsCommand } from '../../../core/commands/entity-commands/UpdateWallParamsCommand';
import { DetachWallsCommand, type WallDetachSide } from '../../../core/commands/entity-commands/DetachWallsCommand';
import { resolveWallAttachTargets } from '../../../bim/walls/wall-attach-pick';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { isWallEntity } from '../../../types/entities';
import type { WallEntity } from '../../../bim/types/wall-types';
import {
  isWallRibbonKey,
  isWallRibbonStringKey,
  isWallRibbonToggleKey,
  isWallTiltKey,
  WALL_RIBBON_KEYS_ACTIONS,
  WALL_RIBBON_BADGE_KEYS,
} from './bridge/wall-command-keys';
// ADR-404 Phase 5b — κεκλιμένος τοίχος: dedicated resolver (signed angle ↔ magnitude+side).
import {
  resolveWallTiltComboboxState,
  applyWallTiltComboboxChange,
} from './bridge/wall-tilt-param';
import { PSET_RIBBON_ACTION } from './bridge/pset-action-keys';
import { EventBus } from '../../../systems/events/EventBus';
// ADR-032/390/401 — «Διαγραφή» routes through the canonical command-based delete
// (undoable + cascades incl. orphan openings), shared with the keyboard Delete.
import { useRibbonEntityDelete } from './useRibbonEntityDelete';
// ADR-441 Slice GEN-WALL — one-shot «Τοίχοι από κάναβο» (στα segments).
import { getGlobalGuideStore } from '../../../systems/guides/guide-store';
import {
  commitWallGridFromGuides,
  type WallGridCommitResult,
} from '../../../bim/walls/wall-grid-commit';
import type { GridPerimeterMode } from '../../../bim/grid/grid-justification';
import { wallGridSettingsStore } from './bridge/grid-perimeter-mode-stores';
import { warnIfGridJustificationConflict } from '../../../bim/grid/grid-justification-consistency';
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
  'getPrimaryId' | 'getSelectedEntityIds' | 'clearByType'
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

/**
 * ADR-441 Slice GEN-WALL — toast μετά το «Τοίχοι από κάναβο». Το `up-to-date` (κάθε
 * segment έχει ήδη τοίχο) ΔΕΝ είναι αποτυχία: εκπέμπεται ως success-style summary
 * με created=0.
 */
function emitWallsFromGridToast(result: WallGridCommitResult): void {
  if (result.ok || result.reason === 'up-to-date') {
    EventBus.emit('bim:walls-from-grid', { created: result.created, skipped: result.skipped });
  } else {
    EventBus.emit('bim:walls-from-grid-failed', { reason: result.reason ?? 'insufficient-guides' });
  }
}

export function useRibbonWallBridge(
  props: UseRibbonWallBridgeProps,
): RibbonWallBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const ribbonDelete = useRibbonEntityDelete({ levelManager, universalSelection });
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
      // ADR-404 Phase 5b — tilt keys: resolver χειρίζεται ΚΑΙ selected ΚΑΙ drawing-mode
      // (overrides) → τρέχει ΠΡΙΝ το null-check (drawing mode = no selection).
      if (isWallTiltKey(commandKey)) {
        return resolveWallTiltComboboxState(commandKey, resolveWall());
      }
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
      // ADR-404 Phase 5b — tilt keys: γράφει selected τοίχο (UpdateWallParamsCommand) ή
      // drawing-tool overrides (born-tilted). Τρέχει ΠΡΙΝ το null-check (drawing mode).
      if (isWallTiltKey(commandKey)) {
        applyWallTiltComboboxChange(commandKey, value, resolveWall(), dispatchParams);
        return;
      }
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

  // ADR-401 Phase E.1 — manual detach of ALL selected walls' top/base from their
  // structural host(s). Restores default binding + clears attach ids (one undo).
  const handleDetach = useCallback(
    (side: WallDetachSide): void => {
      if (!levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;
      const targets = resolveWallAttachTargets(
        universalSelection.getSelectedEntityIds(),
        scene.entities,
      );
      if (targets.length === 0) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(new DetachWallsCommand(side, targets, sm));
      EventBus.emit('bim:walls-detached', { side, wallIds: targets.map((t) => t.wallId) });
    },
    [levelManager, universalSelection, executeCommand],
  );

  // ADR-441 Slice GEN-WALL / 3-mode — «Τοίχοι από κάναβο»: born-bound τοίχος σε κάθε
  // segment άξονα (idempotent), με Wall Location Line (center/inner/outer). Πάντα toast.
  const handleWallsFromGrid = useCallback((mode: GridPerimeterMode): void => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    wallGridSettingsStore.set(mode);
    const scene = levelManager.getLevelScene(levelId);
    const result = commitWallGridFromGuides({
      guideReader: getGlobalGuideStore(),
      getLevelScene: levelManager.getLevelScene,
      setLevelScene: levelManager.setLevelScene,
      levelId,
      sceneUnits: scene ? resolveSceneUnits(scene) : 'mm',
      executeCommand,
      perimeterMode: wallGridSettingsStore.get(),
    });
    emitWallsFromGridToast(result);
    // ADR-441 3-mode — soft warning αν η έδραση ασυνεπεί με υπάρχοντα grid-στοιχεία.
    warnIfGridJustificationConflict(levelManager.getLevelScene(levelId));
  }, [levelManager, executeCommand]);

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
      if (action === WALL_RIBBON_KEYS_ACTIONS.fromGrid) { handleWallsFromGrid('inner'); return; }
      if (action === WALL_RIBBON_KEYS_ACTIONS.fromGridCenter) { handleWallsFromGrid('center'); return; }
      if (action === WALL_RIBBON_KEYS_ACTIONS.fromGridOuter) { handleWallsFromGrid('outer'); return; }
      if (action === WALL_RIBBON_KEYS_ACTIONS.detachTop) { handleDetach('top'); return; }
      if (action === WALL_RIBBON_KEYS_ACTIONS.detachBase) { handleDetach('base'); return; }
      if (action !== WALL_RIBBON_KEYS_ACTIONS.delete) return;
      const wall = resolveWall();
      if (!wall) return;
      ribbonDelete.deleteEntity(wall.id);
    },
    [resolveWall, levelManager, handleDetach, handleWallsFromGrid, ribbonDelete],
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
