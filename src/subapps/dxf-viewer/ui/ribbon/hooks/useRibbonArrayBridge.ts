'use client';

/**
 * ADR-353 Phase A — Bridge between the ribbon contextual Array tab and
 * the rectangular array params on the selected ArrayEntity.
 *
 * Mirrors the text-editor bridge pattern (ADR-345 Fase 5.5): read state
 * via `getComboboxState`, write via `onComboboxChange`. Every combobox
 * write dispatches `UpdateArrayParamsCommand` with `isDragging=true` so
 * rapid edits merge into a single undo step (500 ms window, ADR-031).
 *
 * Reactivity: subscribes to `ArrayStore.inProgressParams` so the leaf
 * comboboxes see the value the user just typed even before the next
 * scene mutation propagates. `inProgressParams` is cleared when the
 * primary selection changes (new array → no override).
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
  type ArrayRibbonKey,
} from './bridge/array-command-keys';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { ArrayEntity } from '../../../types/entities';
import { isArrayEntity } from '../../../types/entities';
import type { RectParams } from '../../../systems/array/types';
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

const ARRAY_TOGGLE_NULL: RibbonToggleState = false;

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

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!isArrayRibbonKey(commandKey)) return null;
      const p = readRectParams();
      if (!p) return null;
      const value = readArrayField(commandKey, p);
      return { value, options: [] };
    },
    [readRectParams],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isArrayRibbonKey(commandKey)) return;
      const arr = resolveArray();
      if (!arr || arr.params.kind !== 'rect') return;
      if (!levelManager.currentLevelId) return;

      const previousParams = arr.params;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;

      const nextParams = patchRectParam(previousParams, commandKey, numeric);
      if (nextParams === null) return;

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
    [resolveArray, executeCommand, levelManager],
  );

  // Toggles unused in Phase A — return stable no-ops so the composed
  // bridge keeps a stable shape.
  const onToggle = useCallback((): void => {}, []);
  const getToggleState = useCallback((): RibbonToggleState => ARRAY_TOGGLE_NULL, []);

  return { onComboboxChange, getComboboxState, onToggle, getToggleState };
}

function readArrayField(key: ArrayRibbonKey, p: RectParams): string {
  switch (key) {
    case ARRAY_RIBBON_KEYS.params.rows:       return String(p.rows);
    case ARRAY_RIBBON_KEYS.params.cols:       return String(p.cols);
    case ARRAY_RIBBON_KEYS.params.rowSpacing: return formatNumeric(p.rowSpacing);
    case ARRAY_RIBBON_KEYS.params.colSpacing: return formatNumeric(p.colSpacing);
    case ARRAY_RIBBON_KEYS.params.angle:      return String(p.angle);
  }
}

function patchRectParam(
  prev: RectParams,
  key: ArrayRibbonKey,
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
  }
}

function formatNumeric(n: number): string {
  // Two decimals max but trim trailing zeros to keep AutoCAD-style display.
  return Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toString();
}
