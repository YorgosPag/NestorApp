/**
 * ADR-408 Εύρος Β #2 — Heating Boiler Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * Single-click placement (Revit family placement): user picks the boiler tool →
 * clicks to place at the cursor point → continuous chain. ESC resets (handled
 * centrally by EscapeCommandBus, like the manifold/fixture/column tools).
 *
 * SSoT alignment:
 *   - Entity build via `buildMepBoilerEntity` / `buildDefaultMepBoilerParams`
 *     (`mep-boiler-completion.ts`).
 *   - 3D placement bridge via `bim:place-mep-boiler-3d` → same `onCanvasClick`.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  buildDefaultMepBoilerParams,
  buildMepBoilerEntity,
  type MepBoilerParamOverrides,
  type SceneUnits,
} from './mep-boiler-completion';
import { computeMepBoilerGeometry } from '../../bim/mep-boilers/mep-boiler-geometry';
import { buildMepBoilerSymbol, type BoilerSymbolGeometry } from '../../bim/mep-boilers/mep-boiler-symbol';
import type { MepBoilerEntity, MepBoilerParams } from '../../bim/types/mep-boiler-types';
import { mepBoilerToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-boiler-tool-bridge-store';
import { EventBus } from '../../systems/events/EventBus';

// ─── State machine types ─────────────────────────────────────────────────────

export type MepBoilerToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface MepBoilerToolState {
  readonly phase: MepBoilerToolPhase;
  readonly overrides: MepBoilerParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: MepBoilerToolState = {
  phase: 'idle',
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseMepBoilerToolOptions {
  readonly onMepBoilerCreated?: (entity: MepBoilerEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseMepBoilerToolResult {
  readonly state: MepBoilerToolState;
  activate(): void;
  setParamOverrides(overrides: MepBoilerParamOverrides): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new boiler. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  getStatusText(): string;
  /**
   * Footprint preview at `cursorPos` (world canvas units), or null when not
   * awaiting a position. Pure projection — no state mutation (ADR-040).
   */
  getGhostFootprint(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  /**
   * Full 2D symbol preview at `cursorPos` (connector stubs + flue vent + divider/
   * flame glyph), or null when not awaiting a position. Built from the SAME
   * `buildMepBoilerSymbol` SSoT the placed renderer uses, so the placement ghost is
   * byte-for-byte WYSIWYG. Pure projection — no state mutation (ADR-040).
   */
  getGhostSymbol(cursorPos: Readonly<Point2D> | null): BoilerSymbolGeometry | null;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useMepBoilerTool(
  options: UseMepBoilerToolOptions = {},
): UseMepBoilerToolResult {
  const { onMepBoilerCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<MepBoilerToolState>(INITIAL_STATE);
  const stateRef = useRef<MepBoilerToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onMepBoilerCreated);
  onCreatedRef.current = onMepBoilerCreated;

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, overrides: prev.overrides, phase: 'awaitingPosition' }));
  }, []);

  const setParamOverrides = useCallback((overrides: MepBoilerParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  const commitFromState = useCallback(
    (s: MepBoilerToolState, clickPoint: Readonly<Point2D>): boolean => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultMepBoilerParams(clickPoint, s.overrides, sceneUnits);
      const result = buildMepBoilerEntity(params, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onCreatedRef.current?.(result.entity);
      setState({ ...INITIAL_STATE, overrides: s.overrides, phase: 'awaitingPosition' });
      return true;
    },
    [currentLevelId],
  );

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return false;
      return commitFromState(s, point);
    },
    [commitFromState],
  );

  // 3D placement bridge — same commit path as the 2D click (zero duplication).
  const onCanvasClickRef = useRef(onCanvasClick);
  onCanvasClickRef.current = onCanvasClick;
  useEffect(() => {
    return EventBus.on('bim:place-mep-boiler-3d', ({ point }) => {
      onCanvasClickRef.current(point);
    });
  }, []);

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase === 'idle') return '';
    return s.phase === 'awaitingPosition' ? 'tools.mepBoiler.statusPosition' : '';
  }, []);

  // Shared ghost params builder (SSoT): both the footprint and the full-symbol ghost
  // getters resolve params identically, so the placement preview never drifts from
  // the committed entity. Returns null unless awaiting a position with a valid cursor.
  const resolveGhostParams = useCallback(
    (cursorPos: Readonly<Point2D> | null): MepBoilerParams | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      return buildDefaultMepBoilerParams(cursorPos, s.overrides, sceneUnits);
    },
    [],
  );

  const getGhostFootprint = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null => {
      const params = resolveGhostParams(cursorPos);
      if (!params) return null;
      return computeMepBoilerGeometry(params).footprint.vertices;
    },
    [resolveGhostParams],
  );

  const getGhostSymbol = useCallback(
    (cursorPos: Readonly<Point2D> | null): BoilerSymbolGeometry | null => {
      const params = resolveGhostParams(cursorPos);
      if (!params) return null;
      return buildMepBoilerSymbol(params, computeMepBoilerGeometry(params));
    },
    [resolveGhostParams],
  );

  // Publish handle to the ribbon/3D bridge (single-writer, mirror radiator).
  useEffect(() => {
    const isActive = state.phase !== 'idle';
    mepBoilerToolBridgeStore.set({
      isActive,
      kind: 'wall-boiler',
      overrides: state.overrides,
      setParamOverrides,
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
    });
    return () => {
      if (mepBoilerToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
        mepBoilerToolBridgeStore.set(null);
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
    getGhostFootprint,
    getGhostSymbol,
    isActive: state.phase !== 'idle',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
