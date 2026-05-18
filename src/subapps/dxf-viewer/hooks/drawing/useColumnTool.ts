/**
 * ADR-363 Phase 4 — Column Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * Single-click placement — Industry convention (Revit Column tool / ArchiCAD
 * CO): user picks the Column tool → optional anchor cycling με Tab → click
 * commits a column at the projected anchor offset. ESC reset. Continuous
 * chain (mirrors useSlabTool polygon chain).
 *
 * SSoT alignment:
 *   - Entity build via `buildColumnEntity` / `buildDefaultColumnParams`
 *     (`hooks/drawing/column-completion.ts`). ZERO duplicate construction.
 *   - Pattern alignment με `useOpeningTool` single-click FSM (closest
 *     analogue — no host wall lookup, anchor cycling instead).
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import {
  ANCHOR_CYCLE_ORDER,
  type ColumnAnchor,
  type ColumnEntity,
  type ColumnKind,
} from '../../bim/types/column-types';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
  type ColumnParamOverrides,
} from './column-completion';

// ─── State machine types ─────────────────────────────────────────────────────

export type ColumnToolPhase =
  | 'idle'
  | 'awaitingPosition'
  | 'committed';

export interface ColumnToolState {
  readonly phase: ColumnToolPhase;
  readonly kind: ColumnKind;
  readonly anchor: ColumnAnchor;
  readonly overrides: ColumnParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: ColumnToolState = {
  phase: 'idle',
  kind: 'rectangular',
  anchor: 'center',
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseColumnToolOptions {
  /** Callback fired μετά από επιτυχές build + commit. */
  readonly onColumnCreated?: (entity: ColumnEntity) => void;
  /** Layer ID στο οποίο γράφεται η νέα column. */
  readonly currentLevelId?: string;
}

export interface UseColumnToolResult {
  readonly state: ColumnToolState;
  activate(): void;
  /** Switch active kind (4 kinds). Resets the state machine. */
  setKind(kind: ColumnKind): void;
  /** Explicit anchor selector (used από ribbon combobox). */
  setAnchor(anchor: ColumnAnchor): void;
  /** Tab cycles through 9-state ring (ANCHOR_CYCLE_ORDER). */
  cycleAnchor(direction?: 1 | -1): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click commit-άρισε νέα column. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Dynamic Input field overrides (width / depth / height / rotation). */
  setParamOverrides(overrides: ColumnParamOverrides): void;
  /** Status text για status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useColumnTool(options: UseColumnToolOptions = {}): UseColumnToolResult {
  const { onColumnCreated, currentLevelId = '0' } = options;

  const [state, setState] = useState<ColumnToolState>(INITIAL_STATE);
  const stateRef = useRef<ColumnToolState>(state);
  stateRef.current = state;

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      anchor: prev.anchor,
      overrides: prev.overrides,
      phase: 'awaitingPosition',
    }));
  }, []);

  const setKind = useCallback((kind: ColumnKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      anchor: prev.anchor,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  const setAnchor = useCallback((anchor: ColumnAnchor) => {
    setState((prev) => ({ ...prev, anchor }));
  }, []);

  const cycleAnchor = useCallback((direction: 1 | -1 = 1) => {
    setState((prev) => {
      const idx = ANCHOR_CYCLE_ORDER.indexOf(prev.anchor);
      const len = ANCHOR_CYCLE_ORDER.length;
      const nextIdx = (idx + direction + len) % len;
      return { ...prev, anchor: ANCHOR_CYCLE_ORDER[nextIdx] };
    });
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      anchor: prev.anchor,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: ColumnParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit ───────────────────────────────────────────────────────────────
  /**
   * Build + commit column από clicked point. Validator hardError αναιρεί το
   * commit silently — FSM παραμένει σε awaitingPosition ώστε ο χρήστης να
   * διορθώσει (e.g. via ribbon overrides).
   */
  const commitColumnFromState = useCallback(
    (s: ColumnToolState, clickPoint: Readonly<Point2D>): boolean => {
      const overridesWithKind: ColumnParamOverrides = {
        ...s.overrides,
        kind: s.kind,
        anchor: s.anchor,
      };
      const params = buildDefaultColumnParams(clickPoint, s.kind, overridesWithKind);
      const result = buildColumnEntity(params, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onColumnCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        anchor: s.anchor,
        overrides: s.overrides,
        phase: 'awaitingPosition',
      });
      return true;
    },
    [currentLevelId, onColumnCreated],
  );

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return false;
      return commitColumnFromState(s, point);
    },
    [commitColumnFromState],
  );

  // ── status text (i18n keys returned για caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    return s.phase === 'awaitingPosition' ? 'tools.column.statusPosition' : '';
  }, []);

  // ── Tab cycles anchor / ESC resets ───────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if (e.key === 'Tab') {
        const direction: 1 | -1 = e.shiftKey ? -1 : 1;
        setState((prev) => {
          const idx = ANCHOR_CYCLE_ORDER.indexOf(prev.anchor);
          const len = ANCHOR_CYCLE_ORDER.length;
          const nextIdx = (idx + direction + len) % len;
          return { ...prev, anchor: ANCHOR_CYCLE_ORDER[nextIdx] };
        });
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === 'Escape') {
        setState({
          ...INITIAL_STATE,
          kind: s.kind,
          anchor: s.anchor,
          overrides: s.overrides,
          phase: 'awaitingPosition',
        });
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return {
    state,
    activate,
    setKind,
    setAnchor,
    cycleAnchor,
    deactivate,
    reset,
    onCanvasClick,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
