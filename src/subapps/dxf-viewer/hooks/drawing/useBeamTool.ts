/**
 * ADR-363 Phase 5 — Beam Tool React Hook Orchestrator.
 *
 * State machine:
 *   - Straight / Cantilever (2-click chain):
 *       `idle → awaitingStart → awaitingEnd → committed → awaitingStart`
 *   - Curved (3-click chain):
 *       `idle → awaitingStart → awaitingEnd → awaitingCurveControl → committed → awaitingStart`
 *
 * 2-click flow mirrors AutoCAD `LINE` chain; 3-click curved flow mirrors
 * `ARC` start/end/bulge convention. ESC reset. Continuous chain.
 *
 * SSoT alignment:
 *   - Entity build via `buildBeamEntity` / `buildDefaultBeamParams`
 *     (`hooks/drawing/beam-completion.ts`). ZERO duplicate construction.
 *   - Pattern alignment με `useWallTool` (closest analogue — straight + curved
 *     FSM). No polyline kind (Phase 5 scope).
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type {
  BeamEntity,
  BeamKind,
} from '../../bim/types/beam-types';
import {
  buildBeamEntity,
  buildDefaultBeamParams,
  type BeamParamOverrides,
} from './beam-completion';
import type { Point3D } from '../../bim/types/bim-base';
import type { BeamParams } from '../../bim/types/beam-types';
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import type { SceneUnits } from '../../utils/scene-units';

// ─── State machine types ─────────────────────────────────────────────────────

export type BeamToolPhase =
  | 'idle'
  | 'awaitingStart'
  | 'awaitingEnd'
  | 'awaitingCurveControl';

export interface BeamToolState {
  readonly phase: BeamToolPhase;
  readonly kind: BeamKind;
  readonly startPoint: Point2D | null;
  readonly endPoint: Point2D | null;
  readonly overrides: BeamParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: BeamToolState = {
  phase: 'idle',
  kind: 'straight',
  startPoint: null,
  endPoint: null,
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseBeamToolOptions {
  /** Callback fired μετά από επιτυχές build + commit. */
  readonly onBeamCreated?: (entity: BeamEntity) => void;
  /** Layer ID στο οποίο γράφεται το νέο beam. */
  readonly currentLevelId?: string;
  /** Returns the active scene's coordinate units for threshold scaling. */
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseBeamToolResult {
  readonly state: BeamToolState;
  activate(): void;
  /** Switch active kind (3 kinds). Resets the state machine, preserves overrides. */
  setKind(kind: BeamKind): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click commit-άρισε νέο beam ή προήγαγε το FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Dynamic Input / ribbon overrides (width / depth / elevation / supportType). */
  setParamOverrides(overrides: BeamParamOverrides): void;
  /** Status text για status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingStart: boolean;
  readonly isAwaitingEnd: boolean;
  readonly isAwaitingCurveControl: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useBeamTool(options: UseBeamToolOptions = {}): UseBeamToolResult {
  const { onBeamCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<BeamToolState>(INITIAL_STATE);
  const stateRef = useRef<BeamToolState>(state);
  stateRef.current = state;

  // ── preview store sync (ADR-363 Phase 5.5P) ───────────────────────────────
  useEffect(() => {
    if (state.phase === 'idle') {
      beamPreviewStore.reset();
      return;
    }
    beamPreviewStore.set({
      startPoint: state.startPoint,
      endPoint: state.endPoint,
      kind: state.kind,
      overrides: state.overrides,
    });
  }, [state]);

  useEffect(() => {
    return () => beamPreviewStore.reset();
  }, []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      overrides: prev.overrides,
      phase: 'awaitingStart',
    }));
  }, []);

  const setKind = useCallback((kind: BeamKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
    }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: BeamParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit helpers (straight/cantilever 2-click, curved 3-click) ─────────

  const commitTwoClickFromState = useCallback(
    (s: BeamToolState, endPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const params = buildDefaultBeamParams(s.startPoint, endPoint, s.kind, s.overrides, sceneUnits);
      const result = buildBeamEntity(params, currentLevelId, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onBeamCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, getSceneUnits, onBeamCreated],
  );

  const commitCurvedFromState = useCallback(
    (s: BeamToolState, controlPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null || s.endPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const base = buildDefaultBeamParams(s.startPoint, s.endPoint, 'curved', s.overrides, sceneUnits);
      const curveControl: Point3D = { x: controlPoint.x, y: controlPoint.y, z: 0 };
      const params: BeamParams = { ...base, kind: 'curved', curveControl };
      const result = buildBeamEntity(params, currentLevelId, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onBeamCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, getSceneUnits, onBeamCreated],
  );

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      if (s.kind === 'curved') {
        if (s.phase === 'awaitingStart') {
          setState({
            ...s,
            phase: 'awaitingEnd',
            startPoint: { x: point.x, y: point.y },
            endPoint: null,
            error: null,
          });
          return true;
        }
        if (s.phase === 'awaitingEnd') {
          setState({
            ...s,
            phase: 'awaitingCurveControl',
            endPoint: { x: point.x, y: point.y },
            error: null,
          });
          return true;
        }
        if (s.phase === 'awaitingCurveControl') {
          return commitCurvedFromState(s, point);
        }
        return false;
      }

      // Straight / cantilever — 2-click chain
      if (s.phase === 'awaitingStart') {
        setState({
          ...s,
          phase: 'awaitingEnd',
          startPoint: { x: point.x, y: point.y },
          error: null,
        });
        return true;
      }
      if (s.phase === 'awaitingEnd' && s.startPoint) {
        return commitTwoClickFromState(s, point);
      }
      return false;
    },
    [commitTwoClickFromState, commitCurvedFromState],
  );

  // ── status text (i18n keys returned για caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    switch (s.phase) {
      case 'awaitingStart':
        return 'tools.beam.statusStart';
      case 'awaitingEnd':
        return s.kind === 'curved' ? 'tools.beam.statusCurveEnd' : 'tools.beam.statusEnd';
      case 'awaitingCurveControl':
        return 'tools.beam.statusCurveControl';
      default:
        return '';
    }
  }, []);

  // ── ESC handled by EscapeCommandBus (ADR-364 §4.1 BIM migration 2026-05-19)
  // DRAW_TOOL slot in useKeyboardShortcuts.DRAWING_TOOLS_WITH_CANCEL routes ESC
  // through onDrawingCancel → handleToolCompletion(activeTool, true) → tool
  // deactivates via useToolLifecycle. AutoCAD/Revit parity.

  return {
    state,
    activate,
    setKind,
    deactivate,
    reset,
    onCanvasClick,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingStart: state.phase === 'awaitingStart',
    isAwaitingEnd: state.phase === 'awaitingEnd',
    isAwaitingCurveControl: state.phase === 'awaitingCurveControl',
  };
}
