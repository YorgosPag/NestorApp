'use client';

/**
 * ADR-353 Phase A + B — Bridge between the contextual Array ribbon tabs
 * (rect / polar) and the active ArrayEntity's params.
 *
 * Mirrors the text-editor bridge pattern (ADR-345 Fase 5.5): read state
 * via `getComboboxState` / `getToggleState`, write via `onComboboxChange`
 * / `onToggle`. Every write dispatches `UpdateArrayParamsCommand` with
 * `isDragging=true` so rapid edits merge into a single undo step
 * (500 ms window, ADR-031).
 *
 * Reactivity: subscribes to `ArrayStore.inProgressParams` so the leaf
 * widgets see the value the user just typed even before the next scene
 * mutation propagates. `inProgressParams` is cleared when the primary
 * selection changes (new array → no override).
 *
 * The bridge no-ops for commandKeys that are not part of
 * `ARRAY_RIBBON_KEYS` so it composes with the text-editor bridge in
 * `useRibbonCommands`.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useCommandHistory } from '../../../core/commands';
import { UpdateArrayParamsCommand } from '../../../core/commands/entity-commands/UpdateArrayParamsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { ArrayStore } from '../../../systems/array/ArrayStore';
import {
  ARRAY_RIBBON_KEYS,
  isArrayRibbonKey,
  isArrayRibbonToggleKey,
  isArrayRibbonStringKey,
  type ArrayRibbonComboKey,
  type ArrayRibbonStringComboKey,
  type ArrayRibbonToggleKey,
} from './bridge/array-command-keys';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { ArrayEntity } from '../../../types/entities';
import { isArrayEntity } from '../../../types/entities';
import type { ArrayParams, PathParams, PolarParams, RectParams } from '../../../systems/array/types';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';
import { useResolveSelectedEntity, useStableBridge } from './ribbon-entity-bridge-shared';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

export interface UseRibbonArrayBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonArrayBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (
    commandKey: string,
  ) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
}

const NULL_TOGGLE: RibbonToggleState = false;

export function useRibbonArrayBridge(
  props: UseRibbonArrayBridgeProps,
): RibbonArrayBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();

  // Subscribe to ArrayStore so widgets see the just-typed value
  // immediately, even before the scene mutation propagates.
  const inProgress = useSyncExternalStore(
    ArrayStore.subscribe,
    () => ArrayStore.getState().inProgressParams,
  );

  const lastPrimaryRef = useRef<string | null>(null);

  const resolveArray = useResolveSelectedEntity(levelManager, universalSelection, isArrayEntity);

  // Clear the in-progress override when the selected array changes,
  // so we don't apply stale "user typed" values to a different entity.
  useEffect(() => {
    const id = universalSelection.getPrimaryId();
    if (id !== lastPrimaryRef.current) {
      lastPrimaryRef.current = id;
      if (ArrayStore.getState().inProgressParams !== null) {
        ArrayStore.clearInProgressParams();
      }
    }
  });

  const readRectParams = useCallback((): RectParams | null => {
    const arr = resolveArray();
    if (!arr || arr.params.kind !== 'rect') return null;
    if (inProgress && inProgress.kind === 'rect') return inProgress;
    return arr.params;
  }, [resolveArray, inProgress]);

  const readPolarParams = useCallback((): PolarParams | null => {
    const arr = resolveArray();
    if (!arr || arr.params.kind !== 'polar') return null;
    if (inProgress && inProgress.kind === 'polar') return inProgress;
    return arr.params;
  }, [resolveArray, inProgress]);

  const readPathParams = useCallback((): PathParams | null => {
    const arr = resolveArray();
    if (!arr || arr.params.kind !== 'path') return null;
    if (inProgress && inProgress.kind === 'path') return inProgress;
    return arr.params;
  }, [resolveArray, inProgress]);

  const dispatchParams = useCallback(
    (arr: ArrayEntity, previousParams: ArrayParams, nextParams: ArrayParams) => {
      if (!levelManager.currentLevelId) return;
      ArrayStore.setInProgressParams(nextParams);
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateArrayParamsCommand(
          arr.id,
          nextParams,
          previousParams,
          sm,
          true,
        ),
      );
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (isArrayRibbonStringKey(commandKey)) {
        const path = readPathParams();
        if (path) {
          const value = readPathStringField(commandKey, path);
          return value === null ? null : { value, options: [] };
        }
        return null;
      }
      if (!isArrayRibbonKey(commandKey)) return null;

      const rect = readRectParams();
      if (rect) {
        const value = readRectField(commandKey, rect);
        return value === null ? null : { value, options: [] };
      }
      const polar = readPolarParams();
      if (polar) {
        const value = readPolarField(commandKey, polar);
        return value === null ? null : { value, options: [] };
      }
      const path = readPathParams();
      if (path) {
        const value = readPathField(commandKey, path);
        return value === null ? null : { value, options: [] };
      }
      return null;
    },
    [readRectParams, readPolarParams, readPathParams],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (isArrayRibbonStringKey(commandKey)) {
        const arr = resolveArray();
        if (!arr || arr.params.kind !== 'path') return;
        const next = patchPathStringParam(arr.params, commandKey, value);
        if (next === null) return;
        dispatchParams(arr, arr.params, next);
        return;
      }
      if (!isArrayRibbonKey(commandKey)) return;
      const arr = resolveArray();
      if (!arr) return;

      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;

      if (arr.params.kind === 'rect') {
        const next = patchRectParam(arr.params, commandKey, numeric);
        if (next === null) return;
        dispatchParams(arr, arr.params, next);
        return;
      }
      if (arr.params.kind === 'polar') {
        const next = patchPolarParam(arr.params, commandKey, numeric);
        if (next === null) return;
        dispatchParams(arr, arr.params, next);
        return;
      }
      if (arr.params.kind === 'path') {
        const next = patchPathParam(arr.params, commandKey, numeric);
        if (next === null) return;
        dispatchParams(arr, arr.params, next);
      }
    },
    [resolveArray, dispatchParams],
  );

  const getToggleState = useCallback(
    (commandKey: string): RibbonToggleState => {
      if (!isArrayRibbonToggleKey(commandKey)) return NULL_TOGGLE;
      const polar = readPolarParams();
      if (polar) return readPolarToggleField(commandKey, polar);
      const path = readPathParams();
      if (path) return readPathToggleField(commandKey, path);
      return NULL_TOGGLE;
    },
    [readPolarParams, readPathParams],
  );

  const onToggle = useCallback(
    (commandKey: string, nextValue: boolean): void => {
      if (!isArrayRibbonToggleKey(commandKey)) return;
      const arr = resolveArray();
      if (!arr) return;
      if (arr.params.kind === 'polar') {
        const next = patchPolarToggle(arr.params, commandKey, nextValue);
        if (next === null) return;
        dispatchParams(arr, arr.params, next);
        return;
      }
      if (arr.params.kind === 'path') {
        const next = patchPathToggle(arr.params, commandKey, nextValue);
        if (next === null) return;
        dispatchParams(arr, arr.params, next);
      }
    },
    [resolveArray, dispatchParams],
  );

  return useStableBridge({ onComboboxChange, getComboboxState, onToggle, getToggleState });
}

// ── Path helpers ──────────────────────────────────────────────────────────────

function readPathField(key: ArrayRibbonComboKey, p: PathParams): string | null {
  switch (key) {
    case ARRAY_RIBBON_KEYS.params.pathCount:   return String(p.count);
    case ARRAY_RIBBON_KEYS.params.pathSpacing: return p.spacing !== undefined ? formatNumeric(p.spacing) : '';
    // M2 — "magical" scatter/align numerics. undefined == 0 in the M1 math (all `?? 0`),
    // so display the effective 0 default rather than a blank combobox.
    case ARRAY_RIBBON_KEYS.params.pathAlignOffset:    return formatNumeric(p.alignOffsetDeg ?? 0);
    case ARRAY_RIBBON_KEYS.params.pathRotationJitter: return formatNumeric(p.rotationJitterDeg ?? 0);
    case ARRAY_RIBBON_KEYS.params.pathScaleJitter:    return formatNumeric(p.scaleJitterPct ?? 0);
    case ARRAY_RIBBON_KEYS.params.pathOffsetJitter:   return formatNumeric(p.offsetJitter ?? 0);
    case ARRAY_RIBBON_KEYS.params.pathSeed:           return String(p.seed ?? 0);
    default: return null;
  }
}

function patchPathParam(
  prev: PathParams,
  key: ArrayRibbonComboKey,
  numeric: number,
): PathParams | null {
  switch (key) {
    case ARRAY_RIBBON_KEYS.params.pathCount: {
      const v = Math.max(1, Math.round(numeric));
      if (v === prev.count) return null;
      return { ...prev, count: v };
    }
    case ARRAY_RIBBON_KEYS.params.pathSpacing: {
      if (numeric <= 0) return null;
      if (numeric === prev.spacing) return null;
      return { ...prev, spacing: numeric };
    }
    case ARRAY_RIBBON_KEYS.params.pathAlignOffset: {
      // Any angle (incl. negative, e.g. -90 "across the row"). 0 = pure tangent.
      if (numeric === (prev.alignOffsetDeg ?? 0)) return null;
      return { ...prev, alignOffsetDeg: numeric };
    }
    case ARRAY_RIBBON_KEYS.params.pathRotationJitter: {
      const v = Math.max(0, numeric);
      if (v === (prev.rotationJitterDeg ?? 0)) return null;
      return { ...prev, rotationJitterDeg: v };
    }
    case ARRAY_RIBBON_KEYS.params.pathScaleJitter: {
      const v = Math.max(0, numeric);
      if (v === (prev.scaleJitterPct ?? 0)) return null;
      return { ...prev, scaleJitterPct: v };
    }
    case ARRAY_RIBBON_KEYS.params.pathOffsetJitter: {
      const v = Math.max(0, numeric);
      if (v === (prev.offsetJitter ?? 0)) return null;
      return { ...prev, offsetJitter: v };
    }
    case ARRAY_RIBBON_KEYS.params.pathSeed: {
      const v = Math.max(0, Math.round(numeric));
      if (v === (prev.seed ?? 0)) return null;
      return { ...prev, seed: v };
    }
    default: return null;
  }
}

function readPathToggleField(key: ArrayRibbonToggleKey, p: PathParams): RibbonToggleState {
  switch (key) {
    case ARRAY_RIBBON_KEYS.toggles.pathAlignItems: return p.alignItems;
    case ARRAY_RIBBON_KEYS.toggles.pathReversed:   return p.reversed;
    default: return NULL_TOGGLE;
  }
}

function patchPathToggle(
  prev: PathParams,
  key: ArrayRibbonToggleKey,
  nextValue: boolean,
): PathParams | null {
  switch (key) {
    case ARRAY_RIBBON_KEYS.toggles.pathAlignItems: {
      if (nextValue === prev.alignItems) return null;
      return { ...prev, alignItems: nextValue };
    }
    case ARRAY_RIBBON_KEYS.toggles.pathReversed: {
      if (nextValue === prev.reversed) return null;
      return { ...prev, reversed: nextValue };
    }
    default: return null;
  }
}

function readPathStringField(
  key: ArrayRibbonStringComboKey,
  p: PathParams,
): string | null {
  switch (key) {
    case ARRAY_RIBBON_KEYS.stringParams.pathMethod:       return p.method;
    // undefined == 'group' in the M1 expander default (resolveDistribution).
    case ARRAY_RIBBON_KEYS.stringParams.pathDistribution: return p.sourceDistribution ?? 'group';
    default: return null;
  }
}

function patchPathStringParam(
  prev: PathParams,
  key: ArrayRibbonStringComboKey,
  value: string,
): PathParams | null {
  switch (key) {
    case ARRAY_RIBBON_KEYS.stringParams.pathMethod: {
      if (value !== 'divide' && value !== 'measure') return null;
      if (value === prev.method) return null;
      return { ...prev, method: value };
    }
    case ARRAY_RIBBON_KEYS.stringParams.pathDistribution: {
      if (value !== 'group' && value !== 'sequential' && value !== 'random') return null;
      if (value === (prev.sourceDistribution ?? 'group')) return null;
      return { ...prev, sourceDistribution: value };
    }
    default: return null;
  }
}

// ── Rect helpers ─────────────────────────────────────────────────────────────

function readRectField(
  key: ArrayRibbonComboKey,
  p: RectParams,
): string | null {
  switch (key) {
    case ARRAY_RIBBON_KEYS.params.rows:       return String(p.rows);
    case ARRAY_RIBBON_KEYS.params.cols:       return String(p.cols);
    case ARRAY_RIBBON_KEYS.params.rowSpacing: return formatNumeric(p.rowSpacing);
    case ARRAY_RIBBON_KEYS.params.colSpacing: return formatNumeric(p.colSpacing);
    case ARRAY_RIBBON_KEYS.params.angle:      return String(p.angle);
    default: return null;
  }
}

function patchRectParam(
  prev: RectParams,
  key: ArrayRibbonComboKey,
  numeric: number,
): RectParams | null {
  switch (key) {
    case ARRAY_RIBBON_KEYS.params.rows: {
      const v = Math.max(1, Math.round(numeric));
      if (v === prev.rows) return null;
      return { ...prev, rows: v };
    }
    case ARRAY_RIBBON_KEYS.params.cols: {
      const v = Math.max(1, Math.round(numeric));
      if (v === prev.cols) return null;
      return { ...prev, cols: v };
    }
    case ARRAY_RIBBON_KEYS.params.rowSpacing: {
      if (numeric === 0) return null;
      if (numeric === prev.rowSpacing) return null;
      return { ...prev, rowSpacing: numeric };
    }
    case ARRAY_RIBBON_KEYS.params.colSpacing: {
      if (numeric === 0) return null;
      if (numeric === prev.colSpacing) return null;
      return { ...prev, colSpacing: numeric };
    }
    case ARRAY_RIBBON_KEYS.params.angle: {
      if (numeric === prev.angle) return null;
      return { ...prev, angle: numeric };
    }
    default: return null;
  }
}

// ── Polar helpers ────────────────────────────────────────────────────────────

function readPolarField(
  key: ArrayRibbonComboKey,
  p: PolarParams,
): string | null {
  switch (key) {
    case ARRAY_RIBBON_KEYS.params.polarCount:      return String(p.count);
    case ARRAY_RIBBON_KEYS.params.polarFillAngle:  return String(p.fillAngle);
    case ARRAY_RIBBON_KEYS.params.polarStartAngle: return String(p.startAngle);
    case ARRAY_RIBBON_KEYS.params.polarRadius:     return formatNumeric(p.radius);
    default: return null;
  }
}

function patchPolarParam(
  prev: PolarParams,
  key: ArrayRibbonComboKey,
  numeric: number,
): PolarParams | null {
  switch (key) {
    case ARRAY_RIBBON_KEYS.params.polarCount: {
      const v = Math.max(1, Math.round(numeric));
      if (v === prev.count) return null;
      return { ...prev, count: v };
    }
    case ARRAY_RIBBON_KEYS.params.polarFillAngle: {
      // Forbid 0° (degenerate); allow ±360 and any other non-zero arc.
      if (numeric === 0) return null;
      if (numeric === prev.fillAngle) return null;
      return { ...prev, fillAngle: numeric };
    }
    case ARRAY_RIBBON_KEYS.params.polarStartAngle: {
      if (numeric === prev.startAngle) return null;
      return { ...prev, startAngle: numeric };
    }
    case ARRAY_RIBBON_KEYS.params.polarRadius: {
      // 0 = auto-derive from source bbox center distance (Q15 default).
      const v = numeric < 0 ? 0 : numeric;
      if (v === prev.radius) return null;
      return { ...prev, radius: v };
    }
    default: return null;
  }
}

function readPolarToggleField(
  key: ArrayRibbonToggleKey,
  p: PolarParams,
): RibbonToggleState {
  switch (key) {
    case ARRAY_RIBBON_KEYS.toggles.polarRotateItems: return p.rotateItems;
    default: return NULL_TOGGLE;
  }
}

function patchPolarToggle(
  prev: PolarParams,
  key: ArrayRibbonToggleKey,
  nextValue: boolean,
): PolarParams | null {
  switch (key) {
    case ARRAY_RIBBON_KEYS.toggles.polarRotateItems: {
      if (nextValue === prev.rotateItems) return null;
      return { ...prev, rotateItems: nextValue };
    }
    default: return null;
  }
}

function formatNumeric(n: number): string {
  // Two decimals max but trim trailing zeros to keep AutoCAD-style display.
  return Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toString();
}
