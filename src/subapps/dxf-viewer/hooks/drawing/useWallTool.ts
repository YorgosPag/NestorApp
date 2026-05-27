/**
 * ADR-363 Phase 1B/1C — Wall Tool React Hook Orchestrator.
 *
 * State machine:
 *   - Straight kind (default, Phase 1B):
 *       `idle → awaitingStart → awaitingEnd → committed → awaitingStart`
 *   - Curved kind (Phase 1C):
 *       `idle → awaitingStart → awaitingEnd → awaitingCurveControl → committed → awaitingStart`
 *   - Polyline kind (Phase 1C):
 *       `idle → awaitingStart → awaitingNextVertex (loop) → committed (Enter / dbl-click)`
 *
 * The 2-click straight chain matches AutoCAD/Revit/ArchiCAD conventions; the
 * 3-click curve flow mirrors AutoCAD `ARC` start/end/control; the polyline
 * flow mirrors AutoCAD `PLINE` (Enter to finish, ESC to cancel).
 *
 * SSoT alignment:
 *   - Entity build via `buildWallEntity` / `buildDefaultWallParams`
 *     (`hooks/drawing/wall-completion.ts`). ZERO duplicate construction here.
 *   - Geometry math via `computeWallGeometry` (called inside `buildWallEntity`).
 *   - Live preview via `wallPreviewStore` (`bim/walls/wall-preview-store.ts`)
 *     — single-writer pattern mirroring `stairPreviewStore` (ADR-358 Phase 8).
 *   - Pattern alignment with `useStairTool.ts` (ref-backed setState bypass +
 *     activate/deactivate/reset + status text + Enter listener + Dynamic Input
 *     `commit-wall` event listener).
 *   - ADR-040 micro-leaf compliance: this hook owns its own React state and is
 *     consumed by `useSpecialTools`. No `useSyncExternalStore` against
 *     high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.9 §6 Phase 1B §6 Phase 1C
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type { WallEntity, WallKind, WallCategory } from '../../bim/types/wall-types';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import {
  buildDefaultWallParams,
  buildWallEntity,
  type SceneUnits,
  type WallParamOverrides,
} from './wall-completion';
import {
  useWallToolDynamicInputListener,
  useWallToolEnterListener,
} from './use-wall-tool-event-listeners';
import { EventBus } from '../../systems/events/EventBus';

// ─── State machine types ─────────────────────────────────────────────────────

export type WallToolPhase =
  | 'idle'
  | 'awaitingStart'
  | 'awaitingEnd'
  | 'awaitingAlignment'
  | 'awaitingCurveControl'
  | 'awaitingNextVertex';

export interface WallToolState {
  readonly phase: WallToolPhase;
  readonly kind: WallKind;
  readonly startPoint: Point2D | null;
  readonly endPoint: Point2D | null;
  readonly polylineVertices: readonly Point2D[];
  readonly overrides: WallParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: WallToolState = {
  phase: 'idle',
  kind: 'straight',
  startPoint: null,
  endPoint: null,
  polylineVertices: [],
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseWallToolOptions {
  /** Callback fired after a `WallEntity` is built & committed. */
  readonly onWallCreated?: (entity: WallEntity) => void;
  /** Layer ID at which the WallEntity is registered. */
  readonly currentLevelId?: string;
  /**
   * Scene units getter (called at commit time so the builder converts the
   * mm-baked defaults into the active scene's units). Defaults to `'mm'`
   * when omitted (back-compat). Mirrors stair `getSceneUnits` contract.
   */
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseWallToolResult {
  readonly state: WallToolState;
  activate(): void;
  /** Switch active kind (`'straight' | 'curved' | 'polyline'`). Resets the state machine. */
  setKind(kind: WallKind): void;
  deactivate(): void;
  reset(): void;
  /** Returns true if the click advanced the state machine. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Commit-and-finish the polyline chain (Enter key path). Returns true on commit. */
  finishPolyline(): boolean;
  /** Dynamic Input field overrides (category/height/thickness/flip). */
  setParamOverrides(overrides: WallParamOverrides): void;
  /** Status text for status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingStart: boolean;
  readonly isAwaitingEnd: boolean;
  readonly isAwaitingAlignment: boolean;
  readonly isAwaitingCurveControl: boolean;
  readonly isAwaitingNextVertex: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useWallTool(options: UseWallToolOptions = {}): UseWallToolResult {
  const { onWallCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<WallToolState>(INITIAL_STATE);
  const stateRef = useRef<WallToolState>(state);
  stateRef.current = state;

  // ── preview store sync (ADR-363 Phase 1C) ────────────────────────────────
  // Mirrors `stairPreviewStore` writer pattern: on every state transition we
  // push the current preview shape (startPoint / curveControl / polyline
  // vertices / overrides) so `useUnifiedDrawing.updatePreview` can read it
  // synchronously without subscribing to wall-tool React state.
  useEffect(() => {
    if (state.phase === 'idle') {
      wallPreviewStore.reset();
      return;
    }
    const curveControl =
      state.kind === 'curved' && state.phase === 'awaitingCurveControl' && state.endPoint
        ? null // user has not picked the control point yet — preview generator will use cursor
        : null;
    // ADR-363 Phase 1F — surface endPoint to the preview store only during the
    // straight-kind awaitingAlignment phase. In every other state (including
    // curved awaitingCurveControl) the preview falls back to the legacy
    // "start → cursor" rubber band by leaving endPoint null.
    const endPoint =
      state.kind === 'straight' && state.phase === 'awaitingAlignment' ? state.endPoint : null;
    wallPreviewStore.set({
      startPoint: state.startPoint,
      endPoint,
      curveControl,
      polylineVertices: state.polylineVertices,
      overrides: state.overrides,
    });
  }, [state]);

  // Drop preview state on unmount so other tools don't see stale ghosts.
  useEffect(() => {
    return () => {
      wallPreviewStore.reset();
    };
  }, []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, kind: prev.kind, phase: 'awaitingStart' }));
  }, []);

  const setKind = useCallback((kind: WallKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
      overrides: prev.overrides,
    }));
  }, []);

  // ADR-363 Phase 7B — keyboard W+n chord: set wall kind + (re-)activate the tool.
  // setKind is stable (useCallback []) so this listener registers exactly once.
  useEffect(() => EventBus.on('bim:set-wall-kind', ({ kind }) => setKind(kind)), [setKind]);

  const setCategory = useCallback((category: WallCategory) => {
    setState((prev) => ({
      ...prev,
      phase: prev.phase === 'idle' ? 'awaitingStart' : prev.phase,
      overrides: { ...prev.overrides, category },
    }));
  }, []);

  // ADR-363 Phase A — keyboard W+letter chord: set wall category, activates tool if idle.
  useEffect(() => EventBus.on('bim:set-wall-category', ({ category }) => setCategory(category)), [setCategory]);

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

  const setParamOverrides = useCallback((overrides: WallParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit (straight + curved) ───────────────────────────────────────────
  /**
   * Build + commit a wall from a fully-resolved straight state (startPoint set
   * + endPoint provided). Validator failure (hardErrors) aborts the commit
   * silently — the tool stays in awaitingEnd so the user can retry. Returns
   * `true` on successful commit.
   */
  const commitStraightFromState = useCallback(
    (
      s: WallToolState,
      endPoint: Readonly<Point2D>,
      alignmentPoint?: Readonly<Point2D> | null,
    ): boolean => {
      if (s.startPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const params = buildDefaultWallParams(
        s.startPoint,
        endPoint,
        s.overrides,
        sceneUnits,
        alignmentPoint,
      );
      const result = buildWallEntity(params, currentLevelId, 'straight', sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onWallCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits],
  );

  /**
   * Commit a curved wall (3-click flow). `s.startPoint` + `s.endPoint` are the
   * two endpoints; `controlPoint` is the quadratic Bezier control.
   */
  const commitCurvedFromState = useCallback(
    (s: WallToolState, controlPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null || s.endPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const base = buildDefaultWallParams(
        s.startPoint,
        s.endPoint,
        s.overrides,
        sceneUnits,
      );
      const curveControl: Point3D = { x: controlPoint.x, y: controlPoint.y, z: 0 };
      const params = { ...base, curveControl };
      const result = buildWallEntity(params, currentLevelId, 'curved', sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onWallCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits],
  );

  /**
   * Commit a polyline wall (N-click flow, Enter to finish). Requires ≥2
   * vertices (start + at least one more). Endpoints map to params.start +
   * params.end; interior vertices flow into `polylineVertices`.
   */
  const commitPolylineFromState = useCallback(
    (s: WallToolState): boolean => {
      const verts = s.polylineVertices;
      if (verts.length < 2) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const startPt = verts[0];
      const endPt = verts[verts.length - 1];
      const base = buildDefaultWallParams(startPt, endPt, s.overrides, sceneUnits);
      const polylineVertices: Point3D[] = verts.map((v) => ({ x: v.x, y: v.y, z: 0 }));
      const params = { ...base, polylineVertices };
      const result = buildWallEntity(params, currentLevelId, 'polyline', sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onWallCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits],
  );

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      // Polyline kind — N-click flow.
      if (s.kind === 'polyline') {
        if (s.phase === 'awaitingStart') {
          setState({
            ...s,
            phase: 'awaitingNextVertex',
            startPoint: { x: point.x, y: point.y },
            polylineVertices: [{ x: point.x, y: point.y }],
            error: null,
          });
          return true;
        }
        if (s.phase === 'awaitingNextVertex') {
          setState({
            ...s,
            polylineVertices: [...s.polylineVertices, { x: point.x, y: point.y }],
            error: null,
          });
          return true;
        }
        return false;
      }

      // Curved kind — 3-click flow.
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

      // Straight kind — 3-click chain (ADR-363 Phase 1F):
      //   click 1 (awaitingStart)     → store start, → awaitingEnd
      //   click 2 (awaitingEnd)       → store end,   → awaitingAlignment
      //   click 3 (awaitingAlignment) → commit with lateral offset toward C
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
        setState({
          ...s,
          phase: 'awaitingAlignment',
          endPoint: { x: point.x, y: point.y },
          error: null,
        });
        return true;
      }
      if (s.phase === 'awaitingAlignment' && s.startPoint && s.endPoint) {
        return commitStraightFromState(s, s.endPoint, point);
      }
      return false;
    },
    [commitStraightFromState, commitCurvedFromState],
  );

  const finishPolyline = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.kind !== 'polyline') return false;
    if (s.phase !== 'awaitingNextVertex') return false;
    return commitPolylineFromState(s);
  }, [commitPolylineFromState]);

  // ── status text (i18n keys returned for caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    switch (s.phase) {
      case 'awaitingStart':
        return 'tools.wall.statusStart';
      case 'awaitingEnd':
        return s.kind === 'curved'
          ? 'tools.wall.statusCurveEnd'
          : 'tools.wall.statusEnd';
      case 'awaitingAlignment':
        return 'tools.wall.statusAlignment';
      case 'awaitingCurveControl':
        return 'tools.wall.statusCurveControl';
      case 'awaitingNextVertex':
        return 'tools.wall.statusPolyNext';
      default:
        return '';
    }
  }, []);

  // ── side-effect listeners (extracted for N.7.1, parity preserved) ────────
  useWallToolDynamicInputListener({
    stateRef,
    setState,
    commitStraightFromState,
    commitCurvedFromState,
  });
  useWallToolEnterListener({ stateRef, commitPolylineFromState });

  return {
    state,
    activate,
    setKind,
    deactivate,
    reset,
    onCanvasClick,
    finishPolyline,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingStart: state.phase === 'awaitingStart',
    isAwaitingEnd: state.phase === 'awaitingEnd',
    isAwaitingAlignment: state.phase === 'awaitingAlignment',
    isAwaitingCurveControl: state.phase === 'awaitingCurveControl',
    isAwaitingNextVertex: state.phase === 'awaitingNextVertex',
  };
}
