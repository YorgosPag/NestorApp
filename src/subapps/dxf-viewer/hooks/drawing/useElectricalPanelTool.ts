/**
 * ADR-408 Φ3 — Electrical Panel Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * Single-click placement (Revit family placement): user picks the panel tool →
 * clicks to place at the cursor point → continuous chain. ESC resets (handled
 * centrally by EscapeCommandBus, like the fixture/column tools).
 *
 * SSoT alignment:
 *   - Entity build via `buildElectricalPanelEntity` /
 *     `buildDefaultElectricalPanelParams` (`electrical-panel-completion.ts`).
 *   - 3D placement bridge via `bim:place-electrical-panel-3d` → same `onCanvasClick`.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  buildDefaultElectricalPanelParams,
  buildElectricalPanelEntity,
  type ElectricalPanelParamOverrides,
  type SceneUnits,
} from './electrical-panel-completion';
import { computeElectricalPanelGeometry } from '../../bim/electrical-panels/electrical-panel-geometry';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import { electricalPanelToolBridgeStore } from '../../ui/ribbon/hooks/bridge/electrical-panel-tool-bridge-store';
import { EventBus } from '../../systems/events/EventBus';

// ─── State machine types ─────────────────────────────────────────────────────

export type ElectricalPanelToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface ElectricalPanelToolState {
  readonly phase: ElectricalPanelToolPhase;
  readonly overrides: ElectricalPanelParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: ElectricalPanelToolState = {
  phase: 'idle',
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseElectricalPanelToolOptions {
  readonly onElectricalPanelCreated?: (entity: ElectricalPanelEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseElectricalPanelToolResult {
  readonly state: ElectricalPanelToolState;
  activate(): void;
  setParamOverrides(overrides: ElectricalPanelParamOverrides): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new panel. */
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

export function useElectricalPanelTool(
  options: UseElectricalPanelToolOptions = {},
): UseElectricalPanelToolResult {
  const { onElectricalPanelCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<ElectricalPanelToolState>(INITIAL_STATE);
  const stateRef = useRef<ElectricalPanelToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onElectricalPanelCreated);
  onCreatedRef.current = onElectricalPanelCreated;

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, overrides: prev.overrides, phase: 'awaitingPosition' }));
  }, []);

  const setParamOverrides = useCallback((overrides: ElectricalPanelParamOverrides) => {
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
    (s: ElectricalPanelToolState, clickPoint: Readonly<Point2D>): boolean => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultElectricalPanelParams(clickPoint, s.overrides, sceneUnits);
      const result = buildElectricalPanelEntity(params, currentLevelId);
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
    return EventBus.on('bim:place-electrical-panel-3d', ({ point }) => {
      onCanvasClickRef.current(point);
    });
  }, []);

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase === 'idle') return '';
    if (s.phase !== 'awaitingPosition') return '';
    // ADR-431 — the comms-rack shows its own placement prompt.
    return s.overrides.kind === 'comms-rack'
      ? 'tools.commsRack.statusPosition'
      : 'tools.electricalPanel.statusPosition';
  }, []);

  const getGhostFootprint = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultElectricalPanelParams(cursorPos, s.overrides, sceneUnits);
      return computeElectricalPanelGeometry(params).footprint.vertices;
    },
    [],
  );

  // Publish handle to the ribbon/3D bridge (single-writer, mirror fixture).
  useEffect(() => {
    const isActive = state.phase !== 'idle';
    electricalPanelToolBridgeStore.set({
      isActive,
      // ADR-431 — reflect the active kind so the contextual ribbon tab knows whether
      // it is editing a distribution board or a comms-rack.
      kind: state.overrides.kind ?? 'distribution-board',
      overrides: state.overrides,
      setParamOverrides,
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
    });
    return () => {
      if (electricalPanelToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
        electricalPanelToolBridgeStore.set(null);
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
