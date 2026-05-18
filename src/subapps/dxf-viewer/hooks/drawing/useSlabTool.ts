/**
 * ADR-363 Phase 3 — Slab Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingFirstVertex → awaitingNextVertex (loop) → committed → awaitingFirstVertex
 *
 * Multi-click polygon drawing — Industry convention (AutoCAD PLINE / Revit
 * Slab Sketch): user clicks N times, Enter ή auto-close near the first
 * vertex (50px tolerance) commits the polygon. ESC at any time resets.
 *
 * Continuous draw — μετά από commit ο tool παραμένει σε `awaitingFirstVertex`
 * ώστε ο χρήστης να ξεκινήσει αμέσως νέα πλάκα (mirror useWallTool polyline).
 *
 * SSoT alignment:
 *   - Entity build via `buildSlabEntity` / `buildDefaultSlabParams`
 *     (`hooks/drawing/slab-completion.ts`). ZERO duplicate construction here.
 *   - Pattern alignment με `useWallTool.ts` polyline mode (ref-backed
 *     stateRef + activate/deactivate/reset + Enter keydown listener).
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { SlabEntity, SlabKind } from '../../bim/types/slab-types';
import {
  buildSlabEntity,
  buildDefaultSlabParams,
  type SlabParamOverrides,
} from './slab-completion';

// ─── State machine types ─────────────────────────────────────────────────────

export type SlabToolPhase =
  | 'idle'
  | 'awaitingFirstVertex'
  | 'awaitingNextVertex';

export interface SlabToolState {
  readonly phase: SlabToolPhase;
  readonly kind: SlabKind;
  readonly vertices: readonly Point2D[];
  readonly overrides: SlabParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: SlabToolState = {
  phase: 'idle',
  kind: 'floor',
  vertices: [],
  overrides: {},
  error: null,
};

/** World-units snap tolerance — caller scales by view zoom αν χρειαστεί. */
export const SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT = 50;

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseSlabToolOptions {
  /** Callback fired μετά από επιτυχές build + commit. */
  readonly onSlabCreated?: (entity: SlabEntity) => void;
  /** Layer ID στο οποίο γράφεται η νέα slab. */
  readonly currentLevelId?: string;
  /**
   * Optional resolver που επιστρέφει το auto-close tolerance σε world units.
   * Default 50 (mm convention). FSM χρησιμοποιεί την τιμή στο `awaitingNextVertex`
   * για να ανιχνεύσει click κοντά στην πρώτη κορυφή.
   */
  readonly getAutoCloseTolerance?: () => number;
}

export interface UseSlabToolResult {
  readonly state: SlabToolState;
  activate(): void;
  setKind(kind: SlabKind): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click προχώρησε το FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Commit-and-finish ή reset για polygon chain (Enter path). Returns true on commit. */
  finishPolygon(): boolean;
  /** Dynamic Input field overrides (kind / thickness / elevation / reinforcement). */
  setParamOverrides(overrides: SlabParamOverrides): void;
  /** Status text για status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingFirstVertex: boolean;
  readonly isAwaitingNextVertex: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useSlabTool(options: UseSlabToolOptions = {}): UseSlabToolResult {
  const { onSlabCreated, currentLevelId = '0', getAutoCloseTolerance } = options;

  const [state, setState] = useState<SlabToolState>(INITIAL_STATE);
  const stateRef = useRef<SlabToolState>(state);
  stateRef.current = state;

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      overrides: prev.overrides,
      phase: 'awaitingFirstVertex',
    }));
  }, []);

  const setKind = useCallback((kind: SlabKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      overrides: { ...prev.overrides, kind },
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingFirstVertex',
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
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingFirstVertex',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: SlabParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit ───────────────────────────────────────────────────────────────
  /**
   * Build + commit slab από fully-resolved vertex list. Validator hardError
   * αναιρεί το commit silently — FSM παραμένει σε awaitingNextVertex ώστε
   * ο χρήστης να διορθώσει.
   */
  const commitFromState = useCallback((s: SlabToolState): boolean => {
    if (s.vertices.length < 3) return false;
    const overridesWithKind: SlabParamOverrides = { ...s.overrides, kind: s.kind };
    const params = buildDefaultSlabParams(s.vertices, overridesWithKind);
    const result = buildSlabEntity(params, currentLevelId);
    if (!result.ok) {
      setState({ ...s, error: result.hardErrors[0] ?? null });
      return false;
    }
    onSlabCreated?.(result.entity);
    setState({
      ...INITIAL_STATE,
      kind: s.kind,
      overrides: s.overrides,
      phase: 'awaitingFirstVertex',
    });
    return true;
  }, [currentLevelId, onSlabCreated]);

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
          const tol = getAutoCloseTolerance?.() ?? SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT;
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
        return 'tools.slab.statusFirstVertex';
      case 'awaitingNextVertex':
        return 'tools.slab.statusNextVertex';
      default:
        return '';
    }
  }, []);

  // ── Enter to commit / ESC to reset ───────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingNextVertex' && s.phase !== 'awaitingFirstVertex') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'Enter') {
        if (s.phase === 'awaitingNextVertex') {
          const ok = commitFromState(s);
          if (ok) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        setState({
          ...INITIAL_STATE,
          kind: s.kind,
          overrides: s.overrides,
          phase: 'awaitingFirstVertex',
        });
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
    setKind,
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
