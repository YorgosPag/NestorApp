'use client';

/**
 * ADR-358 Phase 7a — Bridge between the contextual Stair ribbon tab and
 * the active `StairEntity` params.
 *
 * Mirrors the array-editor bridge (ADR-353 Phase A): read state via
 * `getComboboxState`, write via `onComboboxChange`. Every write dispatches
 * `UpdateStairParamsCommand` with `isDragging=false` (commit-on-select,
 * each combobox change is a discrete undo step).
 *
 * Smart defaults on structureType change:
 *   - Q20: cantilever/suspended/glass-tread/steel-grating -> riserType='open'
 *          monolithic/stringer-N/central-stringer         -> riserType='closed'
 *   - Q34: cantilever/glass-tread/steel-grating           -> nosingSide='front-and-sides'
 *          other                                          -> nosingSide='front'
 *
 * Multi-story panel writes `StairParams.multiStoryConfig`. When no
 * config exists yet, a default `{ topLevel: '', storyHeight: 2700, storyCount: 1 }`
 * is created on first change.
 *
 * The bridge no-ops for commandKeys outside `STAIR_RIBBON_KEYS` so it
 * composes with the text-editor + array bridges in `useRibbonCommands`.
 */

import { useCallback, useMemo } from 'react';
import { useCommandHistory } from '../../core/commands';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import { DetachStairsCommand, type StairDetachSide } from '../../core/commands/entity-commands/DetachStairsCommand';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { isStairEntity } from '../../types/entities';
import type { StairEntity } from '../../types/entities';
import type { StairParams } from '../types/stair-types';
import { detachStairSidesAffectedByVerticalEdit } from '../stairs/stair-attach-detach';
import { resolveStairAttachTargets } from '../walls/wall-attach-pick';
import { EventBus } from '../../systems/events/EventBus';
import {
  STAIR_RIBBON_KEYS,
  STAIR_RIBBON_VISIBILITY_KEYS,
  isStairRibbonKey,
  isStairRibbonStringKey,
  isStairVisibilityKey,
} from './bridge/stair-command-keys';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../../ui/ribbon/context/RibbonCommandContext';
import type { useLevels } from '../../systems/levels';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../systems/selection';
import { mmToSceneUnits, resolveSceneUnits } from '../../utils/scene-units';
import { useFloorMetadata } from '../../hooks/data/useFloorMetadata';
import { useBuildingTotalFloors } from '../../hooks/data/useBuildingTotalFloors';
import {
  type StairPatchContext,
  readStairStringField,
  readStairNumericField,
  patchStairStringParam,
  patchStairNumericParam,
} from './bridge/stair-param-helpers';

interface LevelManagerLike
  extends LevelSceneWriter,
    Pick<ReturnType<typeof useLevels>, 'saveContext'> {}

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId' | 'getSelectedEntityIds'
>;

export interface UseRibbonStairBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonStairBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  /**
   * ADR-358 Phase 7b1 — validation badge surfacing. Returns `true` when the
   * currently selected `StairEntity` has `validation.hasCodeViolations`.
   * Badge keys outside `STAIR_RIBBON_BADGE_KEYS` return `false`.
   */
  readonly getBadgeState: (badgeKey: string) => boolean;
  /**
   * ADR-358 Phase 7b2b-β Stream F — panel visibility resolver. Returns
   * `true` when the panel should render. For `multiFlight`, true iff the
   * selected stair's `variant.kind` ∈ {l-shape, u-shape, gamma}. Keys
   * outside `STAIR_RIBBON_VISIBILITY_KEYS` return `true` (no-op, panel shown).
   */
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
  /**
   * ADR-401 Phase G.3 — handles stair detach simple-button actions
   * (detachTop / detachBase). Other action keys are no-ops (composed in
   * `useRibbonCommands`).
   */
  readonly onAction: (action: string) => void;
}

/**
 * ADR-358 Phase 7b1 — Badge keys owned by the stair bridge. Mirrors the
 * commandKey registry pattern (`STAIR_RIBBON_KEYS`) so other bridges can
 * compose without collisions.
 */
export const STAIR_RIBBON_BADGE_KEYS = {
  violations: 'stair.badge.violations',
} as const;

const STAIR_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  STAIR_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

export function useRibbonStairBridge(
  props: UseRibbonStairBridgeProps,
): RibbonStairBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();

  // ADR-358 Phase 9B-1 — building context for storyCount clamp. When a
  // `floorId` is in scope, subscribe to the floor + parent building so
  // `patchStoryCount` can reject values that exceed the physically
  // available remaining floors above the current one. Both subscriptions
  // are SSoT (shared with widget + BuildingTabs).
  const floorIdInScope = levelManager.saveContext?.floorId ?? null;
  const floorInScope = useFloorMetadata(floorIdInScope);
  const { floorsCount: buildingTotalFloors } = useBuildingTotalFloors(
    floorInScope?.buildingId,
  );

  const resolveStair = useCallback((): StairEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isStairEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  // ADR-358 Phase 9 — unit bridge. Ribbon I/O is normalized to mm so the
  // hardcoded combobox option lists (140/150/160…/2400/2700…) always line
  // up with the displayed current value. `StairParams.rise/tread/width` are
  // stored in scene units (`* mmToSceneUnits`), so the bridge multiplies
  // on write and divides on read. `multiStoryConfig.storyHeight` stays in
  // mm (Phase 7a contract) — no conversion. `stepCount` is unitless.
  const getSceneUnitsScale = useCallback((): number => {
    const lid = levelManager.currentLevelId;
    if (!lid) return mmToSceneUnits('mm');
    const scene = levelManager.getLevelScene(lid);
    return mmToSceneUnits(resolveSceneUnits(scene));
  }, [levelManager]);

  const dispatchParams = useCallback(
    (stair: StairEntity, next: StairParams): void => {
      if (!levelManager.currentLevelId) return;
      // ADR-401 Phase G.3 — a manual rise/stepCount/elevation edit breaks the
      // matching top/base structural attach first (Revit «edit breaks attach»),
      // so the explicit value wins over the host follow. Detach + edit collapse
      // into one undo step.
      const broken = detachStairSidesAffectedByVerticalEdit(stair.params, next);
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateStairParamsCommand(stair.id, broken, stair.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const stair = resolveStair();
      if (!stair) return null;
      if (isStairRibbonStringKey(commandKey)) {
        const v = readStairStringField(commandKey, stair.params);
        return v === null ? null : { value: v, options: [] };
      }
      if (!isStairRibbonKey(commandKey)) return null;
      const v = readStairNumericField(commandKey, stair.params, getSceneUnitsScale());
      return v === null ? null : { value: v, options: [] };
    },
    [resolveStair, getSceneUnitsScale],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const stair = resolveStair();
      if (!stair) return;

      if (isStairRibbonStringKey(commandKey)) {
        const next = patchStairStringParam(stair.params, commandKey, value);
        if (next === null) return;
        dispatchParams(stair, next);
        return;
      }

      if (!isStairRibbonKey(commandKey)) return;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;

      // ADR-358 Phase 9B-1 — pass building context so `patchStoryCount` can
      // clamp `storyCount` to the physically available remaining floors
      // (avoid an atrium stair claiming to traverse 99 floors of a 3-floor
      // building).
      const ctx: StairPatchContext = {
        scale: getSceneUnitsScale(),
        buildingTotalFloors,
        currentFloorNumber: floorInScope?.number ?? null,
      };
      const next = patchStairNumericParam(stair.params, commandKey, numeric, ctx);
      if (next === null) return;
      dispatchParams(stair, next);
    },
    [resolveStair, dispatchParams, getSceneUnitsScale, buildingTotalFloors, floorInScope],
  );

  // No toggles in Phase 7a — riserType is exposed as a combobox.
  const onToggle = useCallback((_key: string, _next: boolean): void => {
    // no-op
  }, []);

  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const getBadgeState = useCallback((badgeKey: string): boolean => {
    if (!STAIR_OWNED_BADGE_KEYS.has(badgeKey)) return false;
    const stair = resolveStair();
    if (!stair) return false;
    if (badgeKey === STAIR_RIBBON_BADGE_KEYS.violations) {
      return stair.validation.hasCodeViolations;
    }
    return false;
  }, [resolveStair]);

  // ADR-358 Phase 7b2b-β Stream F + Phase 9B-3 — panel visibility resolver.
  // `multiStoryHeightEditor` hides the storyHeight combobox when the stair
  // is bound to a floor — Revit / ArchiCAD / AutoCAD Architecture all hide
  // the level-distance editor once a stair is linked, so the user cannot
  // drift the two surfaces apart.
  const getPanelVisibility = useCallback((visibilityKey: string): boolean => {
    if (!isStairVisibilityKey(visibilityKey)) return true;
    const stair = resolveStair();
    if (!stair) return false;
    if (visibilityKey === STAIR_RIBBON_VISIBILITY_KEYS.multiFlight) {
      const kind = stair.params.variant.kind;
      return kind === 'l-shape' || kind === 'u-shape' || kind === 'gamma';
    }
    if (visibilityKey === STAIR_RIBBON_VISIBILITY_KEYS.multiStoryHeightEditor) {
      return stair.params.multiStoryConfig?.linkedToFloor !== true;
    }
    // ADR-358 Phase 3f — l-shape corner sub-options.
    if (visibilityKey === STAIR_RIBBON_VISIBILITY_KEYS.lShapeCorner) {
      return stair.params.variant.kind === 'l-shape';
    }
    if (visibilityKey === STAIR_RIBBON_VISIBILITY_KEYS.lShapeWindersParams) {
      const v = stair.params.variant;
      return v.kind === 'l-shape' && v.cornerStyle === 'winders';
    }
    return true;
  }, [resolveStair]);

  // ADR-401 Phase G.3 — manual detach of ALL selected stairs' top/base from their
  // structural host(s). Restores stair default binding + clears attach ids (one undo).
  const handleDetach = useCallback(
    (side: StairDetachSide): void => {
      if (!levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;
      const targets = resolveStairAttachTargets(
        universalSelection.getSelectedEntityIds(),
        scene.entities,
      );
      if (targets.length === 0) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(new DetachStairsCommand(side, targets, sm));
      EventBus.emit('bim:stairs-detached', { side, stairIds: targets.map((t) => t.stairId) });
    },
    [levelManager, universalSelection, executeCommand],
  );

  const onAction = useCallback(
    (action: string): void => {
      if (action === STAIR_RIBBON_KEYS.actions.detachTop) { handleDetach('top'); return; }
      if (action === STAIR_RIBBON_KEYS.actions.detachBase) { handleDetach('base'); return; }
    },
    [handleDetach],
  );

  // ADR-040 Phase XIX: memoize return so RibbonCommandProvider deps stay stable.
  // Non-memoized object literal here caused 14/28 commit re-render cascade in
  // RibbonRoot + RibbonCommandProvider + 30+ button consumers (profile 2026-05-16).
  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, getPanelVisibility, onAction }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, getPanelVisibility, onAction],
  );
}

/** ADR-358 Phase 7b1 — type guard used by `useRibbonCommands` composer. */
export function isStairBadgeKey(badgeKey: string): boolean {
  return STAIR_OWNED_BADGE_KEYS.has(badgeKey);
}

/** ADR-358 Phase 7b2b-β Stream F — type guard used by `useRibbonCommands` composer. */
export function isStairPanelVisibilityKey(visibilityKey: string): boolean {
  return isStairVisibilityKey(visibilityKey);
}

