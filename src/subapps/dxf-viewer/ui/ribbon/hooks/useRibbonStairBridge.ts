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
import { useCommandHistory } from '../../../core/commands';
import { UpdateStairParamsCommand } from '../../../core/commands/entity-commands/UpdateStairParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { isStairEntity } from '../../../types/entities';
import type { StairEntity } from '../../../types/entities';
import type {
  StairMultiStoryConfig,
  StairNosingSide,
  StairParams,
  StairRiserType,
  StairStructureType,
  StairTurnDirectionLR,
} from '../../../types/stair';
import {
  STAIR_RIBBON_KEYS,
  STAIR_RIBBON_VISIBILITY_KEYS,
  isStairRibbonKey,
  isStairRibbonStringKey,
  isStairVisibilityKey,
  type StairRibbonComboKey,
  type StairRibbonStringComboKey,
} from './bridge/stair-command-keys';
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

const OPEN_RISER_STRUCTURE_TYPES: ReadonlySet<StairStructureType> = new Set<StairStructureType>([
  'cantilever',
  'suspended',
  'glass-tread',
  'steel-grating',
]);

const SIDE_NOSING_STRUCTURE_TYPES: ReadonlySet<StairStructureType> = new Set<StairStructureType>([
  'cantilever',
  'glass-tread',
  'steel-grating',
]);

const VALID_STRUCTURE_TYPES: ReadonlySet<string> = new Set<string>([
  'monolithic',
  'stringer-1side',
  'stringer-2side',
  'central-stringer',
  'cantilever',
  'suspended',
  'glass-tread',
  'steel-grating',
]);

const DEFAULT_STORY_HEIGHT_MM = 2700;

export function useRibbonStairBridge(
  props: UseRibbonStairBridgeProps,
): RibbonStairBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();

  const resolveStair = useCallback((): StairEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isStairEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  const dispatchParams = useCallback(
    (stair: StairEntity, next: StairParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateStairParamsCommand(stair.id, next, stair.params, sm, false),
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
      const v = readStairNumericField(commandKey, stair.params);
      return v === null ? null : { value: v, options: [] };
    },
    [resolveStair],
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

      const next = patchStairNumericParam(stair.params, commandKey, numeric);
      if (next === null) return;
      dispatchParams(stair, next);
    },
    [resolveStair, dispatchParams],
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

  // ADR-358 Phase 7b2b-β Stream F — panel visibility resolver.
  const getPanelVisibility = useCallback((visibilityKey: string): boolean => {
    if (!isStairVisibilityKey(visibilityKey)) return true;
    const stair = resolveStair();
    if (!stair) return false;
    if (visibilityKey === STAIR_RIBBON_VISIBILITY_KEYS.multiFlight) {
      const kind = stair.params.variant.kind;
      return kind === 'l-shape' || kind === 'u-shape' || kind === 'gamma';
    }
    return true;
  }, [resolveStair]);

  // ADR-040 Phase XIX: memoize return so RibbonCommandProvider deps stay stable.
  // Non-memoized object literal here caused 14/28 commit re-render cascade in
  // RibbonRoot + RibbonCommandProvider + 30+ button consumers (profile 2026-05-16).
  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, getPanelVisibility],
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

// ── Read helpers ─────────────────────────────────────────────────────────────

function readStairStringField(
  key: StairRibbonStringComboKey,
  p: StairParams,
): string | null {
  switch (key) {
    case STAIR_RIBBON_KEYS.stringParams.structureType: return p.structureType;
    case STAIR_RIBBON_KEYS.stringParams.riserType:     return p.riserType;
    case STAIR_RIBBON_KEYS.stringParams.flight2TurnDirection:
      return readFlightTurnDirection(p, 0);
    case STAIR_RIBBON_KEYS.stringParams.flight3TurnDirection:
      return readFlightTurnDirection(p, 1);
    default: return null;
  }
}

/**
 * ADR-358 Phase 7b2b-β Stream F — read flight turn direction from variant.
 * `flightIndex` 0 → flight 2 (l-shape/u-shape `turnDirection`, gamma `turnSequence[0]`).
 * `flightIndex` 1 → flight 3 (gamma only, `turnSequence[1]`).
 */
function readFlightTurnDirection(p: StairParams, flightIndex: 0 | 1): string | null {
  const v = p.variant;
  if (flightIndex === 0) {
    if (v.kind === 'l-shape' || v.kind === 'u-shape') return v.turnDirection;
    if (v.kind === 'gamma') return v.turnSequence[0];
    return null;
  }
  if (v.kind === 'gamma') return v.turnSequence[1];
  return null;
}

function readStairNumericField(
  key: StairRibbonComboKey,
  p: StairParams,
): string | null {
  switch (key) {
    case STAIR_RIBBON_KEYS.params.rise:        return String(p.rise);
    case STAIR_RIBBON_KEYS.params.tread:       return String(p.tread);
    case STAIR_RIBBON_KEYS.params.width:       return String(p.width);
    case STAIR_RIBBON_KEYS.params.stepCount:   return String(p.stepCount);
    // Return `null` (not `''`) when multi-story config is absent — Radix Select
    // forbids empty-string SelectItem values and RibbonCombobox injects the
    // current value as a fallback option. Empty-string would crash the panel
    // on stair selection (regression observed 2026-05-17).
    case STAIR_RIBBON_KEYS.params.storyCount:  return p.multiStoryConfig ? String(p.multiStoryConfig.storyCount) : null;
    case STAIR_RIBBON_KEYS.params.storyHeight: return p.multiStoryConfig ? String(p.multiStoryConfig.storyHeight) : null;
    default: return null;
  }
}

// ── String patch helpers ─────────────────────────────────────────────────────

function patchStairStringParam(
  prev: StairParams,
  key: StairRibbonStringComboKey,
  value: string,
): StairParams | null {
  switch (key) {
    case STAIR_RIBBON_KEYS.stringParams.structureType: {
      if (!VALID_STRUCTURE_TYPES.has(value)) return null;
      const structureType = value as StairStructureType;
      if (structureType === prev.structureType) return null;
      const riserType: StairRiserType = OPEN_RISER_STRUCTURE_TYPES.has(structureType) ? 'open' : 'closed';
      const nosingSide: StairNosingSide = SIDE_NOSING_STRUCTURE_TYPES.has(structureType) ? 'front-and-sides' : 'front';
      return { ...prev, structureType, riserType, nosingSide };
    }
    case STAIR_RIBBON_KEYS.stringParams.riserType: {
      if (value !== 'open' && value !== 'closed') return null;
      const riserType = value as StairRiserType;
      if (riserType === prev.riserType) return null;
      return { ...prev, riserType };
    }
    case STAIR_RIBBON_KEYS.stringParams.flight2TurnDirection:
      return patchFlightTurnDirection(prev, 0, value);
    case STAIR_RIBBON_KEYS.stringParams.flight3TurnDirection:
      return patchFlightTurnDirection(prev, 1, value);
    default: return null;
  }
}

/**
 * ADR-358 Phase 7b2b-β Stream F — patch flight turn direction on the
 * discriminated `variant` union. Returns `null` for invalid kinds or no-op.
 */
function patchFlightTurnDirection(
  prev: StairParams,
  flightIndex: 0 | 1,
  value: string,
): StairParams | null {
  if (value !== 'left' && value !== 'right') return null;
  const next = value as StairTurnDirectionLR;
  const v = prev.variant;
  if (flightIndex === 0) {
    if (v.kind === 'l-shape' || v.kind === 'u-shape') {
      if (v.turnDirection === next) return null;
      return { ...prev, variant: { ...v, turnDirection: next } };
    }
    if (v.kind === 'gamma') {
      if (v.turnSequence[0] === next) return null;
      return {
        ...prev,
        variant: {
          ...v,
          turnSequence: [next, v.turnSequence[1]] as readonly [StairTurnDirectionLR, StairTurnDirectionLR],
        },
      };
    }
    return null;
  }
  // flightIndex === 1 → only gamma
  if (v.kind === 'gamma') {
    if (v.turnSequence[1] === next) return null;
    return {
      ...prev,
      variant: {
        ...v,
        turnSequence: [v.turnSequence[0], next] as readonly [StairTurnDirectionLR, StairTurnDirectionLR],
      },
    };
  }
  return null;
}

// ── Numeric patch helpers ────────────────────────────────────────────────────

function patchStairNumericParam(
  prev: StairParams,
  key: StairRibbonComboKey,
  numeric: number,
): StairParams | null {
  switch (key) {
    case STAIR_RIBBON_KEYS.params.rise:      return patchRise(prev, numeric);
    case STAIR_RIBBON_KEYS.params.tread:     return patchTread(prev, numeric);
    case STAIR_RIBBON_KEYS.params.width:     return patchWidth(prev, numeric);
    case STAIR_RIBBON_KEYS.params.stepCount: return patchStepCount(prev, numeric);
    case STAIR_RIBBON_KEYS.params.storyCount:  return patchStoryCount(prev, numeric);
    case STAIR_RIBBON_KEYS.params.storyHeight: return patchStoryHeight(prev, numeric);
    default: return null;
  }
}

function patchRise(prev: StairParams, raw: number): StairParams | null {
  const rise = clamp(raw, 50, 300);
  if (rise === prev.rise) return null;
  return withRecomputedTotals({ ...prev, rise });
}

function patchTread(prev: StairParams, raw: number): StairParams | null {
  const tread = clamp(raw, 150, 500);
  if (tread === prev.tread) return null;
  return withRecomputedTotals({ ...prev, tread });
}

function patchWidth(prev: StairParams, raw: number): StairParams | null {
  const width = clamp(raw, 400, 4000);
  if (width === prev.width) return null;
  return { ...prev, width };
}

function patchStepCount(prev: StairParams, raw: number): StairParams | null {
  const stepCount = Math.max(2, Math.round(raw));
  if (stepCount === prev.stepCount) return null;
  return withRecomputedTotals({ ...prev, stepCount });
}

function patchStoryCount(prev: StairParams, raw: number): StairParams | null {
  const storyCount = Math.max(1, Math.round(raw));
  const cur = prev.multiStoryConfig;
  if (cur && cur.storyCount === storyCount) return null;
  const multiStoryConfig: StairMultiStoryConfig = cur
    ? { ...cur, storyCount }
    : { topLevel: '', storyHeight: DEFAULT_STORY_HEIGHT_MM, storyCount };
  return { ...prev, multiStoryConfig };
}

function patchStoryHeight(prev: StairParams, raw: number): StairParams | null {
  if (raw <= 0) return null;
  const storyHeight = raw;
  const cur = prev.multiStoryConfig;
  if (cur && cur.storyHeight === storyHeight) return null;
  const multiStoryConfig: StairMultiStoryConfig = cur
    ? { ...cur, storyHeight }
    : { topLevel: '', storyHeight, storyCount: 1 };
  return { ...prev, multiStoryConfig };
}

// ── Geometry recompute ───────────────────────────────────────────────────────

function withRecomputedTotals(p: StairParams): StairParams {
  const totalRise = p.rise * p.stepCount;
  const totalRun = p.tread * Math.max(0, p.stepCount - 1);
  const pitch = (Math.atan2(p.rise, p.tread) * 180) / Math.PI;
  return { ...p, totalRise, totalRun, pitch };
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
