/**
 * ADR-408 Εύρος Β #3 — Underfloor (radiant floor) Tool React Hook Orchestrator.
 *
 * State machine (mirror useFloorFinishTool.ts):
 *   idle → awaitingFirstVertex → awaitingNextVertex (loop) → committed → awaitingFirstVertex
 *
 * Multi-click polygon drawing — the user clicks N times, Enter or auto-close near the
 * first vertex (tolerance) commits the heating-area polygon. ESC resets (handled by
 * EscapeCommandBus). After commit the tool stays in `awaitingFirstVertex` for a
 * continuous draw chain.
 *
 * SSoT alignment:
 *   - Entity build via `buildMepUnderfloorEntity` / `buildDefaultMepUnderfloorParams`
 *     (`hooks/drawing/mep-underfloor-completion.ts`). ZERO duplicate construction.
 *   - Pattern alignment with `useFloorFinishTool.ts` polygon mode.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no `useSyncExternalStore`.
 *   - Active-tool string: `'mep-underfloor'`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see hooks/drawing/useFloorFinishTool.ts — the area-entity template (clone)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
import {
  buildMepUnderfloorEntity,
  buildDefaultMepUnderfloorParams,
  type MepUnderfloorParamOverrides,
  type SceneUnits,
} from './mep-underfloor-completion';
import { mepUnderfloorPreviewStore } from '../../bim/mep-underfloor/mep-underfloor-preview-store';

// ─── State machine types ─────────────────────────────────────────────────────

export type MepUnderfloorToolPhase =
  | 'idle'
  | 'awaitingFirstVertex'
  | 'awaitingNextVertex';

export interface MepUnderfloorToolState {
  readonly phase: MepUnderfloorToolPhase;
  readonly vertices: readonly Point2D[];
  readonly overrides: MepUnderfloorParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: MepUnderfloorToolState = {
  phase: 'idle',
  vertices: [],
  overrides: {},
  error: null,
};

/** World-units snap tolerance — caller scales by view zoom if needed. */
export const MEP_UNDERFLOOR_AUTO_CLOSE_TOLERANCE_DEFAULT = 50;

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseMepUnderfloorToolOptions {
  /** Callback fired after a successful build + commit. */
  readonly onMepUnderfloorCreated?: (entity: MepUnderfloorEntity) => void;
  /** Layer ID the new heating loop is written to. */
  readonly currentLevelId?: string;
  /** Optional resolver returning the auto-close tolerance in world units. Default 50. */
  readonly getAutoCloseTolerance?: () => number;
  /** Returns the active scene's coordinate units for correct calculations. */
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseMepUnderfloorToolResult {
  readonly state: MepUnderfloorToolState;
  activate(): void;
  deactivate(): void;
  reset(): void;
  /** Returns true if the click advanced the FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Commit-and-finish or reset for the polygon chain (Enter path). Returns true on commit. */
  finishPolygon(): boolean;
  /** Dynamic Input field overrides (spacing / clearance / pattern / ...). */
  setParamOverrides(overrides: MepUnderfloorParamOverrides): void;
  /** Status text for status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingFirstVertex: boolean;
  readonly isAwaitingNextVertex: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useMepUnderfloorTool(options: UseMepUnderfloorToolOptions = {}): UseMepUnderfloorToolResult {
  const { onMepUnderfloorCreated, currentLevelId = '0', getAutoCloseTolerance, getSceneUnits } = options;

  const [state, setState] = useState<MepUnderfloorToolState>(INITIAL_STATE);
  const stateRef = useRef<MepUnderfloorToolState>(state);
  stateRef.current = state;

  // ── live preview — single-writer into mepUnderfloorPreviewStore so the preview
  //    generator draws the in-progress footprint rubber-band. ─────────────────
  useEffect(() => {
    if (state.phase === 'idle') {
      mepUnderfloorPreviewStore.reset();
      return;
    }
    mepUnderfloorPreviewStore.set({ vertices: state.vertices });
  }, [state]);
  useEffect(() => {
    return () => mepUnderfloorPreviewStore.reset();
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

  const setParamOverrides = useCallback((overrides: MepUnderfloorParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit ───────────────────────────────────────────────────────────────
  const commitFromState = useCallback((s: MepUnderfloorToolState): boolean => {
    if (s.vertices.length < 3) return false;
    const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
    const params = buildDefaultMepUnderfloorParams(s.vertices, s.overrides, sceneUnits);
    const result = buildMepUnderfloorEntity(params, currentLevelId);
    if (!result.ok) {
      setState({ ...s, error: result.hardErrors[0] ?? null });
      return false;
    }
    onMepUnderfloorCreated?.(result.entity);
    setState({
      ...INITIAL_STATE,
      overrides: s.overrides,
      phase: 'awaitingFirstVertex',
    });
    return true;
  }, [currentLevelId, onMepUnderfloorCreated, getSceneUnits]);

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
        // Auto-close: click near the first vertex with ≥3 vertices → commit.
        if (s.vertices.length >= 3) {
          const first = s.vertices[0];
          const dx = point.x - first.x;
          const dy = point.y - first.y;
          const tol = getAutoCloseTolerance?.() ?? MEP_UNDERFLOOR_AUTO_CLOSE_TOLERANCE_DEFAULT;
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
        return 'tools.mepUnderfloor.statusFirstVertex';
      case 'awaitingNextVertex':
        return 'tools.mepUnderfloor.statusNextVertex';
      default:
        return '';
    }
  }, []);

  // ── Enter to commit polygon (mirror useFloorFinishTool §Enter) ───────────
  // ESC handled by EscapeCommandBus (ADR-364 §4.1).
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
