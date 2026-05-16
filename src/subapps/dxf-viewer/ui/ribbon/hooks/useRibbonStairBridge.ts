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

import { useCallback } from 'react';
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
} from '../../../types/stair';
import {
  STAIR_RIBBON_KEYS,
  isStairRibbonKey,
  isStairRibbonStringKey,
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

  return { onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState };
}

/** ADR-358 Phase 7b1 — type guard used by `useRibbonCommands` composer. */
export function isStairBadgeKey(badgeKey: string): boolean {
  return STAIR_OWNED_BADGE_KEYS.has(badgeKey);
}

// ── Read helpers ─────────────────────────────────────────────────────────────

function readStairStringField(
  key: StairRibbonStringComboKey,
  p: StairParams,
): string | null {
  switch (key) {
    case STAIR_RIBBON_KEYS.stringParams.structureType: return p.structureType;
    case STAIR_RIBBON_KEYS.stringParams.riserType:     return p.riserType;
    default: return null;
  }
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
    case STAIR_RIBBON_KEYS.params.storyCount:  return p.multiStoryConfig ? String(p.multiStoryConfig.storyCount) : '';
    case STAIR_RIBBON_KEYS.params.storyHeight: return p.multiStoryConfig ? String(p.multiStoryConfig.storyHeight) : '';
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
    default: return null;
  }
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
