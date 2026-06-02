/**
 * ADR-407 — Railing Tool React Hook Orchestrator (Φ1 sketch slice).
 *
 * State machine (AutoCAD `LINE` 2-click chain):
 *   idle → awaitingStart → awaitingEnd → committed → awaitingStart (continuous)
 *
 * Two-click straight sketch: user picks the railing tool → click 1 = path start
 * → click 2 = path end → straight `RailingEntity` (posts + balusters + top rail
 * derived by the engine) → continuous chain. ESC resets (handled centrally by
 * EscapeCommandBus, like the column/beam tools).
 *
 * SSoT alignment:
 *   - Entity build via `buildDefaultRailingParams` / `buildRailingEntity`
 *     (`hooks/drawing/railing-completion.ts`). ZERO duplicate construction.
 *   - 3D placement bridge via `bim:place-railing-3d` → same `onCanvasClick`
 *     (each 3D click feeds one point; the FSM resolves start/end).
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores. The ghost preview is
 *     pure projection (`getGhostPath`) read at draw time — no cursor-store sub.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  buildDefaultRailingParams,
  buildRailingEntity,
  type RailingParamOverrides,
  type SceneUnits,
} from './railing-completion';
import { computeRailingGeometry } from '../../bim/railings/railing-geometry';
import type { RailingEntity } from '../../bim/types/railing-types';
import { railingToolBridgeStore } from '../../ui/ribbon/hooks/bridge/railing-tool-bridge-store';
import { EventBus } from '../../systems/events/EventBus';

// ─── State machine types ─────────────────────────────────────────────────────

export type RailingToolPhase = 'idle' | 'awaitingStart' | 'awaitingEnd';

export interface RailingToolState {
  readonly phase: RailingToolPhase;
  readonly startPoint: Point2D | null;
  readonly overrides: RailingParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: RailingToolState = {
  phase: 'idle',
  startPoint: null,
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseRailingToolOptions {
  readonly onRailingCreated?: (entity: RailingEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseRailingToolResult {
  readonly state: RailingToolState;
  activate(): void;
  setParamOverrides(overrides: RailingParamOverrides): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new railing or advanced the FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  getStatusText(): string;
  /**
   * Straight preview path [start, cursor] (world canvas units), or null when not
   * yet awaiting the end click. Pure projection — no state mutation, no
   * cursor-store subscription (ADR-040). Consumed by the placement ghost leaf.
   */
  getGhostPath(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  readonly isActive: boolean;
  readonly isAwaitingStart: boolean;
  readonly isAwaitingEnd: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useRailingTool(options: UseRailingToolOptions = {}): UseRailingToolResult {
  const { onRailingCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<RailingToolState>(INITIAL_STATE);
  const stateRef = useRef<RailingToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onRailingCreated);
  onCreatedRef.current = onRailingCreated;

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, overrides: prev.overrides, phase: 'awaitingStart' }));
  }, []);

  const setParamOverrides = useCallback((overrides: RailingParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
    }));
  }, []);

  const commitFromState = useCallback(
    (s: RailingToolState, endPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null) return false;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultRailingParams(s.startPoint, endPoint, s.overrides, sceneUnits);
      const result = buildRailingEntity(params, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onCreatedRef.current?.(result.entity);
      setState({ ...INITIAL_STATE, overrides: s.overrides, phase: 'awaitingStart' });
      return true;
    },
    [currentLevelId],
  );

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'awaitingStart') {
        setState({ ...s, phase: 'awaitingEnd', startPoint: { x: point.x, y: point.y }, error: null });
        return true;
      }
      if (s.phase === 'awaitingEnd' && s.startPoint) {
        return commitFromState(s, point);
      }
      return false;
    },
    [commitFromState],
  );

  // 3D placement bridge — same commit path as the 2D click (zero duplication).
  // Each 3D click emits ONE point; the FSM resolves start vs end (2-click line).
  const onCanvasClickRef = useRef(onCanvasClick);
  onCanvasClickRef.current = onCanvasClick;
  useEffect(() => {
    return EventBus.on('bim:place-railing-3d', ({ point }) => {
      onCanvasClickRef.current(point);
    });
  }, []);

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    switch (s.phase) {
      case 'awaitingStart':
        return 'tools.railing.statusStart';
      case 'awaitingEnd':
        return 'tools.railing.statusEnd';
      default:
        return '';
    }
  }, []);

  const getGhostPath = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingEnd' || s.startPoint === null || cursorPos === null) return null;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultRailingParams(s.startPoint, cursorPos, s.overrides, sceneUnits);
      return computeRailingGeometry(params).resolvedPath;
    },
    [],
  );

  // Publish handle to the ribbon/3D bridge (single-writer, mirror MEP fixture).
  useEffect(() => {
    const isActive = state.phase !== 'idle';
    railingToolBridgeStore.set({
      isActive,
      overrides: state.overrides,
      setParamOverrides,
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
    });
    return () => {
      if (railingToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
        railingToolBridgeStore.set(null);
      }
    };
  }, [state, setParamOverrides]);

  return {
    state,
    activate,
    setParamOverrides,
    deactivate,
    reset,
    onCanvasClick,
    getStatusText,
    getGhostPath,
    isActive: state.phase !== 'idle',
    isAwaitingStart: state.phase === 'awaitingStart',
    isAwaitingEnd: state.phase === 'awaitingEnd',
  };
}
