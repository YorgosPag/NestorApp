/**
 * ADR-419 — Floor-Finish Tool React Hook Orchestrator.
 *
 * State machine (mirror useRoofTool.ts):
 *   idle → awaitingFirstVertex → awaitingNextVertex (loop) → committed → awaitingFirstVertex
 *
 * Multi-click polygon drawing — Industry convention (AutoCAD PLINE / Revit
 * Floor Finish by Boundary): ο χρήστης κλικάρει N φορές, Enter ή auto-close
 * κοντά στην πρώτη κορυφή (50px tolerance) commits το polygon. ESC οποτεδήποτε reset.
 *
 * Continuous draw — μετά από commit ο tool παραμένει σε `awaitingFirstVertex`
 * ώστε ο χρήστης να ξεκινήσει αμέσως νέα επικάλυψη (mirror useRoofTool polyline).
 *
 * SSoT alignment:
 *   - Entity build μέσω `buildFloorFinishEntity` / `buildDefaultFloorFinishParams`
 *     (`hooks/drawing/floor-finish-completion.ts`). ZERO duplicate construction εδώ.
 *   - Pattern alignment με `useRoofTool.ts` polygon mode (ref-backed
 *     stateRef + activate/deactivate/reset + Enter keydown listener).
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *   - Active-tool string: `'floor-finish'` — ο orchestrator (useSpecialTools) ενεργοποιεί
 *     αυτό το hook μέσω `useToolLifecycle(activeTool === 'floor-finish', ...)`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 * @see hooks/drawing/useRoofTool.ts — το ακριβές πρότυπο (clone)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import {
  buildFloorFinishEntity,
  buildDefaultFloorFinishParams,
  type FloorFinishParamOverrides,
  type SceneUnits,
} from './floor-finish-completion';
import { floorFinishPreviewStore } from '../../bim/floor-finishes/floor-finish-preview-store';

// ─── State machine types ─────────────────────────────────────────────────────

export type FloorFinishToolPhase =
  | 'idle'
  | 'awaitingFirstVertex'
  | 'awaitingNextVertex';

export interface FloorFinishToolState {
  readonly phase: FloorFinishToolPhase;
  readonly vertices: readonly Point2D[];
  readonly overrides: FloorFinishParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: FloorFinishToolState = {
  phase: 'idle',
  vertices: [],
  overrides: {},
  error: null,
};

/** World-units snap tolerance — caller scales by view zoom αν χρειαστεί. */
export const FLOOR_FINISH_AUTO_CLOSE_TOLERANCE_DEFAULT = 50;

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseFloorFinishToolOptions {
  /** Callback fired μετά από επιτυχές build + commit. */
  readonly onFloorFinishCreated?: (entity: FloorFinishEntity) => void;
  /** Layer ID στο οποίο γράφεται η νέα επικάλυψη δαπέδου. */
  readonly currentLevelId?: string;
  /**
   * Optional resolver που επιστρέφει το auto-close tolerance σε world units.
   * Default 50 (mm convention). FSM χρησιμοποιεί την τιμή στο `awaitingNextVertex`
   * για να ανιχνεύσει click κοντά στην πρώτη κορυφή.
   */
  readonly getAutoCloseTolerance?: () => number;
  /** Returns the active scene's coordinate units for correct calculations. */
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseFloorFinishToolResult {
  readonly state: FloorFinishToolState;
  activate(): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click προχώρησε το FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Commit-and-finish ή reset για polygon chain (Enter path). Returns true on commit. */
  finishPolygon(): boolean;
  /** Dynamic Input field overrides (materialId / thicknessMm / finishLevel). */
  setParamOverrides(overrides: FloorFinishParamOverrides): void;
  /** Status text για status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingFirstVertex: boolean;
  readonly isAwaitingNextVertex: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useFloorFinishTool(options: UseFloorFinishToolOptions = {}): UseFloorFinishToolResult {
  const { onFloorFinishCreated, currentLevelId = '0', getAutoCloseTolerance, getSceneUnits } = options;

  const [state, setState] = useState<FloorFinishToolState>(INITIAL_STATE);
  const stateRef = useRef<FloorFinishToolState>(state);
  stateRef.current = state;

  // ── live preview (ADR-419) — single-writer into floorFinishPreviewStore so
  //    useUnifiedDrawing draws the in-progress footprint rubber-band. ─────────
  useEffect(() => {
    if (state.phase === 'idle') {
      floorFinishPreviewStore.reset();
      return;
    }
    floorFinishPreviewStore.set({ vertices: state.vertices });
  }, [state]);
  useEffect(() => {
    return () => floorFinishPreviewStore.reset();
  }, []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      overrides: prev.overrides,
      phase: 'awaitingFirstVertex',
    }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingFirstVertex',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: FloorFinishParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit ───────────────────────────────────────────────────────────────
  const commitFromState = useCallback((s: FloorFinishToolState): boolean => {
    if (s.vertices.length < 3) return false;
    const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
    const params = buildDefaultFloorFinishParams(s.vertices, s.overrides, sceneUnits);
    const result = buildFloorFinishEntity(params, currentLevelId);
    if (!result.ok) {
      setState({ ...s, error: result.hardErrors[0] ?? null });
      return false;
    }
    onFloorFinishCreated?.(result.entity);
    setState({
      ...INITIAL_STATE,
      overrides: s.overrides,
      phase: 'awaitingFirstVertex',
    });
    return true;
  }, [currentLevelId, onFloorFinishCreated, getSceneUnits]);

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      if (s.phase === 'awaitingFirstVertex') {
        setState({
          ...s,
          phase: 'awaitingNextVertex',
          vertices: [{ x: point.x, y: point.y }],
          error: null,
        });
        return true;
      }

      if (s.phase === 'awaitingNextVertex') {
        // Auto-close: click κοντά στην πρώτη κορυφή με ≥3 vertices → commit.
        if (s.vertices.length >= 3) {
          const first = s.vertices[0];
          const dx = point.x - first.x;
          const dy = point.y - first.y;
          const tol = getAutoCloseTolerance?.() ?? FLOOR_FINISH_AUTO_CLOSE_TOLERANCE_DEFAULT;
          if (Math.hypot(dx, dy) <= tol) {
            return commitFromState(s);
          }
        }
        setState({
          ...s,
          vertices: [...s.vertices, { x: point.x, y: point.y }],
          error: null,
        });
        return true;
      }

      return false;
    },
    [commitFromState, getAutoCloseTolerance],
  );

  const finishPolygon = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.phase !== 'awaitingNextVertex') return false;
    return commitFromState(s);
  }, [commitFromState]);

  // ── status text (i18n keys) ──────────────────────────────────────────────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    switch (s.phase) {
      case 'awaitingFirstVertex':
        return 'tools.floorFinish.statusFirstVertex';
      case 'awaitingNextVertex':
        return 'tools.floorFinish.statusNextVertex';
      default:
        return '';
    }
  }, []);

  // ── Enter to commit polygon (mirror useRoofTool §Enter) ──────────────────
  // ESC handled by EscapeCommandBus (ADR-364 §4.1 BIM migration 2026-05-19).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const s = stateRef.current;
      if (s.phase !== 'awaitingNextVertex') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const ok = commitFromState(s);
      if (ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [commitFromState]);

  return {
    state,
    activate,
    deactivate,
    reset,
    onCanvasClick,
    finishPolygon,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingFirstVertex: state.phase === 'awaitingFirstVertex',
    isAwaitingNextVertex: state.phase === 'awaitingNextVertex',
  };
}
