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

  // Unmount cleanup — reset store when hook teardown (tool panel unmount).
  useEffect(() => {
    return () => beamPreviewStore.reset();
  }, []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  // All state transitions sync beamPreviewStore immediately (before setState)
  // so updatePreview reads the correct data on the very next mousemove, without
  // waiting for React's passive-effect flush (which fires after paint).

  const activate = useCallback(() => {
    const prev = stateRef.current;
    beamPreviewStore.set({ startPoint: null, endPoint: null, kind: prev.kind, overrides: prev.overrides });
    setState({ ...INITIAL_STATE, kind: prev.kind, overrides: prev.overrides, phase: 'awaitingStart' });
  }, []);

  const setKind = useCallback((kind: BeamKind) => {
    const prev = stateRef.current;
    const newPhase = prev.phase === 'idle' ? 'idle' : 'awaitingStart';
    if (newPhase === 'idle') {
      beamPreviewStore.reset();
    } else {
      beamPreviewStore.set({ startPoint: null, endPoint: null, kind, overrides: prev.overrides });
    }
    setState({ ...INITIAL_STATE, kind, overrides: prev.overrides, phase: newPhase });
  }, []);

  const deactivate = useCallback(() => {
    beamPreviewStore.reset();
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    const prev = stateRef.current;
    const newPhase = prev.phase === 'idle' ? 'idle' : 'awaitingStart';
    if (newPhase === 'idle') {
      beamPreviewStore.reset();
    } else {
      beamPreviewStore.set({ startPoint: null, endPoint: null, kind: prev.kind, overrides: prev.overrides });
    }
    setState({ ...INITIAL_STATE, kind: prev.kind, overrides: prev.overrides, phase: newPhase });
  }, []);

  const setParamOverrides = useCallback((overrides: BeamParamOverrides) => {
    const prev = stateRef.current;
    const newOverrides = { ...prev.overrides, ...overrides };
    if (prev.phase !== 'idle') {
      const current = beamPreviewStore.get();
      beamPreviewStore.set({ ...current, overrides: newOverrides });
    }
    setState({ ...prev, overrides: newOverrides });
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
      // Sync store immediately so next mousemove sees null startPoint (cursor dot),
      // not the stale committed startPoint that would show a ghost footprint.
      beamPreviewStore.set({ startPoint: null, endPoint: null, kind: s.kind, overrides: s.overrides });
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
      // Sync store immediately so next mousemove shows cursor dot, not stale ghost.
      beamPreviewStore.set({ startPoint: null, endPoint: null, kind: s.kind, overrides: s.overrides });
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
          const startPoint = { x: point.x, y: point.y };
          // Sync before setState: next mousemove reads correct startPoint immediately.
          beamPreviewStore.set({ startPoint, endPoint: null, kind: s.kind, overrides: s.overrides });
          setState({ ...s, phase: 'awaitingEnd', startPoint, endPoint: null, error: null });
          return true;
        }
        if (s.phase === 'awaitingEnd') {
          const endPoint = { x: point.x, y: point.y };
          beamPreviewStore.set({ startPoint: s.startPoint, endPoint, kind: s.kind, overrides: s.overrides });
          setState({ ...s, phase: 'awaitingCurveControl', endPoint, error: null });
          return true;
        }
        if (s.phase === 'awaitingCurveControl') {
          return commitCurvedFromState(s, point);
        }
        return false;
      }

      // Straight / cantilever — 2-click chain
      if (s.phase === 'awaitingStart') {
        const startPoint = { x: point.x, y: point.y };
        // Sync before setState: next mousemove reads correct startPoint immediately,
        // no useEffect-delay window where stale null would produce a cursor-dot flash.
        beamPreviewStore.set({ startPoint, endPoint: null, kind: s.kind, overrides: s.overrides });
        setState({ ...s, phase: 'awaitingEnd', startPoint, error: null });
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
