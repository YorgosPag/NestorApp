/**
 * ADR-408 Φ15 — MEP Riser (κατακόρυφη στήλη αποχέτευσης) Tool Hook.
 *
 * Single-click placement of a VERTICAL drain stack: the user picks the tool, sets
 * the span height + diameter in the «Κατακόρυφη Στήλη» contextual tab, then clicks
 * a plan point. A vertical `mep-segment` is created (coincident XY, base = building
 * datum z=0, top = `heightMm`), domain `pipe`, classification `sanitary-drainage` —
 * so it reads as the Revit «pipe up» riser glyph in plan, spans floors in 3D, and
 * joins the drainage network/junctions for free (the segment engine is 3D-aware).
 *
 * SSoT — ΜΗΔΕΝ fork: reuses `completeMepSegmentFromTwoClicks` (the segment builder)
 * with the two clicks collapsed to one XY + distinct endpoint elevations. The riser
 * IS a `mep-segment` (Revit: a vertical pipe is still a Pipe), so selection/edit/3D
 * all flow through the existing segment machinery.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import {
  completeMepSegmentFromTwoClicks,
  type SceneUnits,
} from './mep-segment-completion';
import {
  DEFAULT_RISER_DIAMETER_MM,
  DEFAULT_RISER_HEIGHT_MM,
  type MepSegmentEntity,
} from '../../bim/types/mep-segment-types';
import { mepRiserToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-riser-tool-bridge-store';

// ─── State machine ───────────────────────────────────────────────────────────

export type MepRiserToolPhase = 'idle' | 'awaitingPosition';

export interface MepRiserToolState {
  readonly phase: MepRiserToolPhase;
  /** mm — datum-relative elevation of the stack base («Από όροφο», default datum 0). */
  readonly baseElevationMm: number;
  /** mm — datum-relative elevation of the stack top («Έως όροφο»). */
  readonly topElevationMm: number;
  /** mm — pipe diameter (DN). */
  readonly diameterMm: number;
}

const INITIAL_STATE: MepRiserToolState = {
  phase: 'idle',
  baseElevationMm: 0,
  topElevationMm: DEFAULT_RISER_HEIGHT_MM,
  diameterMm: DEFAULT_RISER_DIAMETER_MM,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseMepRiserToolOptions {
  readonly onRiserCreated?: (entity: MepSegmentEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseMepRiserToolResult {
  readonly state: MepRiserToolState;
  activate(): void;
  setSpan(baseMm: number, topMm: number): void;
  setDiameter(diameterMm: number): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new riser. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
}

export function useMepRiserTool(options: UseMepRiserToolOptions = {}): UseMepRiserToolResult {
  const { onRiserCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<MepRiserToolState>(INITIAL_STATE);
  const stateRef = useRef<MepRiserToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onRiserCreated);
  onCreatedRef.current = onRiserCreated;

  const activate = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'awaitingPosition' }));
  }, []);

  const deactivate = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'idle' }));
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({ ...prev, phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition' }));
  }, []);

  const setSpan = useCallback((baseMm: number, topMm: number) => {
    setState((prev) => ({ ...prev, baseElevationMm: baseMm, topElevationMm: topMm }));
  }, []);

  const setDiameter = useCallback((diameterMm: number) => {
    setState((prev) => ({ ...prev, diameterMm }));
  }, []);

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return false;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const xy: Point2D = { x: point.x, y: point.y };
      // Collapse the 2-click into one XY + distinct base/top elevations → a vertical
      // riser. base/top = datum-relative mm chosen via the «Από/Έως όροφο» tab. The
      // builder treats the two distinct snapped elevations as a connected run (no
      // slope projection).
      const result = completeMepSegmentFromTwoClicks(
        xy,
        xy,
        currentLevelId,
        'pipe',
        { classification: 'sanitary-drainage', diameter: s.diameterMm },
        sceneUnits,
        s.baseElevationMm,
        s.topElevationMm,
      );
      if (!result.ok) return false;
      onCreatedRef.current?.(result.entity);
      return true;
    },
    [currentLevelId],
  );

  const getStatusText = useCallback((): string => {
    return stateRef.current.phase === 'awaitingPosition' ? 'tools.mepRiser.statusPosition' : '';
  }, []);

  // Publish handle to the ribbon bridge (single-writer, mirror fixture).
  useEffect(() => {
    mepRiserToolBridgeStore.set({
      isActive: state.phase !== 'idle',
      baseElevationMm: state.baseElevationMm,
      topElevationMm: state.topElevationMm,
      diameterMm: state.diameterMm,
      setSpanMm: setSpan,
      setDiameter,
    });
    return () => {
      if (mepRiserToolBridgeStore.get()?.setSpanMm === setSpan) {
        mepRiserToolBridgeStore.set(null);
      }
    };
  }, [state, setSpan, setDiameter]);

  return {
    state,
    activate,
    setSpan,
    setDiameter,
    deactivate,
    reset,
    onCanvasClick,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
