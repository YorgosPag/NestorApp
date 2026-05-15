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
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { ArrayStore } from '../../../systems/array/ArrayStore';
import {
  ARRAY_RIBBON_KEYS,
  isArrayRibbonKey,
  isArrayRibbonToggleKey,
  type ArrayRibbonComboKey,
  type ArrayRibbonToggleKey,
} from './bridge/array-command-keys';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { ArrayEntity } from '../../../types/entities';
import { isArrayEntity } from '../../../types/entities';
import type { ArrayParams, PolarParams, RectParams } from '../../../systems/array/types';
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

export interface UseRibbonArrayBridgeProps {
  readonly levelManager: LevelManagerLike;
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

  const resolveArray = useCallback((): ArrayEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isArrayEntity(e)) return null;
    return e as ArrayEntity;
  }, [universalSelection, levelManager]);

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

  const dispatchParams = useCallback(
    (arr: ArrayEntity, previousParams: ArrayParams, nextParams: ArrayParams) => {
      if (!levelManager.currentLevelId) return;
      ArrayStore.setInProgressParams(nextParams);
      const sm = new LevelSceneManagerAdapter(
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
      return null;
    },
    [readRectParams, readPolarParams],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
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
      }
    },
    [resolveArray, dispatchParams],
  );

  const getToggleState = useCallback(
    (commandKey: string): RibbonToggleState => {
      if (!isArrayRibbonToggleKey(commandKey)) return NULL_TOGGLE;
      const polar = readPolarParams();
      if (!polar) return NULL_TOGGLE;
      return readPolarToggleField(commandKey, polar);
    },
    [readPolarParams],
  );

  const onToggle = useCallback(
    (commandKey: string, nextValue: boolean): void => {
      if (!isArrayRibbonToggleKey(commandKey)) return;
      const arr = resolveArray();
      if (!arr || arr.params.kind !== 'polar') return;
      const next = patchPolarToggle(arr.params, commandKey, nextValue);
      if (next === null) return;
      dispatchParams(arr, arr.params, next);
    },
    [resolveArray, dispatchParams],
  );

  return { onComboboxChange, getComboboxState, onToggle, getToggleState };
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
