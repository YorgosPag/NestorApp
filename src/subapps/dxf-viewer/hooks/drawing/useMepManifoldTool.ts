/**
 * ADR-408 Φ12 — Plumbing Manifold Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * Single-click placement (Revit family placement): user picks the manifold tool →
 * clicks to place at the cursor point → continuous chain. ESC resets (handled
 * centrally by EscapeCommandBus, like the fixture/column tools).
 *
 * SSoT alignment:
 *   - Entity build via `buildMepManifoldEntity` /
 *     `buildDefaultMepManifoldParams` (`mep-manifold-completion.ts`).
 *   - 3D placement bridge via `bim:place-mep-manifold-3d` → same `onCanvasClick`.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  buildDefaultMepManifoldParams,
  buildMepManifoldEntity,
  type MepManifoldParamOverrides,
  type SceneUnits,
} from './mep-manifold-completion';
import { computeMepManifoldGeometry } from '../../bim/mep-manifolds/mep-manifold-geometry';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import { mepManifoldToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-manifold-tool-bridge-store';
import { EventBus } from '../../systems/events/EventBus';

// ─── State machine types ─────────────────────────────────────────────────────

export type MepManifoldToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface MepManifoldToolState {
  readonly phase: MepManifoldToolPhase;
  readonly overrides: MepManifoldParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: MepManifoldToolState = {
  phase: 'idle',
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseMepManifoldToolOptions {
  readonly onMepManifoldCreated?: (entity: MepManifoldEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseMepManifoldToolResult {
  readonly state: MepManifoldToolState;
  activate(): void;
  setParamOverrides(overrides: MepManifoldParamOverrides): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new manifold. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  getStatusText(): string;
  /**
   * Footprint preview at `cursorPos` (world canvas units), or null when not
   * awaiting a position. Pure projection — no state mutation (ADR-040).
   */
  getGhostFootprint(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useMepManifoldTool(
  options: UseMepManifoldToolOptions = {},
): UseMepManifoldToolResult {
  const { onMepManifoldCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<MepManifoldToolState>(INITIAL_STATE);
  const stateRef = useRef<MepManifoldToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onMepManifoldCreated);
  onCreatedRef.current = onMepManifoldCreated;

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, overrides: prev.overrides, phase: 'awaitingPosition' }));
  }, []);

  const setParamOverrides = useCallback((overrides: MepManifoldParamOverrides) => {
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
    (s: MepManifoldToolState, clickPoint: Readonly<Point2D>): boolean => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultMepManifoldParams(clickPoint, s.overrides, sceneUnits);
      const result = buildMepManifoldEntity(params, currentLevelId);
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
    return EventBus.on('bim:place-mep-manifold-3d', ({ point }) => {
      onCanvasClickRef.current(point);
    });
  }, []);

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase === 'idle') return '';
    return s.phase === 'awaitingPosition' ? 'tools.mepManifold.statusPosition' : '';
  }, []);

  const getGhostFootprint = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultMepManifoldParams(cursorPos, s.overrides, sceneUnits);
      return computeMepManifoldGeometry(params).footprint.vertices;
    },
    [],
  );

  // Publish handle to the ribbon/3D bridge (single-writer, mirror fixture).
  useEffect(() => {
    const isActive = state.phase !== 'idle';
    mepManifoldToolBridgeStore.set({
      isActive,
      kind: 'floor-manifold',
      overrides: state.overrides,
      setParamOverrides,
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
    });
    return () => {
      if (mepManifoldToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
        mepManifoldToolBridgeStore.set(null);
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
    isActive: state.phase !== 'idle',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
