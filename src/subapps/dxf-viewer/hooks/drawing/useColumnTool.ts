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
  type SceneUnits,
} from './column-completion';
import {
  computeAnchorGhostFootprints,
  type AnchorGhost,
  type ColumnGhostOverrides,
} from '../../bim/columns/column-anchor-ghosts';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';

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
  /** Returns the active scene's coordinate units for correct mm→canvas conversion. */
  readonly getSceneUnits?: () => SceneUnits;
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
  /**
   * ADR-363 Phase 4.5c.1 — projection helper για το anchor ghost preview.
   * Returns null όταν phase !== 'awaitingPosition' ή cursorPos === null.
   * Διαφορετικά επιστρέφει 9 ghosts (1 για circular) με state.anchor flag-marked.
   *
   * Pure projection: ΔΕΝ mutate-άρει state, ΔΕΝ subscribes σε cursor store.
   * Caller (leaf) supplies το current cursor world position — ώστε το hook
   * να μην τραβάει re-renders του CanvasSection σε κάθε mousemove (ADR-040).
   */
  getGhostFootprints(cursorPos: Readonly<Point2D> | null): readonly AnchorGhost[] | null;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useColumnTool(options: UseColumnToolOptions = {}): UseColumnToolResult {
  const { onColumnCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<ColumnToolState>(INITIAL_STATE);
  const stateRef = useRef<ColumnToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;

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
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const params = buildDefaultColumnParams(clickPoint, s.kind, overridesWithKind, sceneUnits);
      const result = buildColumnEntity(params, currentLevelId, sceneUnits);
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
    [currentLevelId, onColumnCreated, getSceneUnits],
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

  // ── ADR-363 Phase 4.5c.1 — anchor ghost preview projection ──────────────
  const getGhostFootprints = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly AnchorGhost[] | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
      // ColumnGhostOverrides is structurally a subset of ColumnParamOverrides
      // (kind+anchor flattened to args). Spread keeps width/depth/height/
      // rotation/material/lshape/tshape only — kind/anchor passed explicitly.
      const ghostOverrides: ColumnGhostOverrides = {
        ...(s.overrides.width !== undefined ? { width: s.overrides.width } : {}),
        ...(s.overrides.depth !== undefined ? { depth: s.overrides.depth } : {}),
        ...(s.overrides.height !== undefined ? { height: s.overrides.height } : {}),
        ...(s.overrides.rotation !== undefined ? { rotation: s.overrides.rotation } : {}),
        ...(s.overrides.material !== undefined ? { material: s.overrides.material } : {}),
        ...(s.overrides.lshape !== undefined ? { lshape: s.overrides.lshape } : {}),
        ...(s.overrides.tshape !== undefined ? { tshape: s.overrides.tshape } : {}),
        // ADR-363 Phase 8D — polygon/ishape variant overrides drive ghost
        // preview geometry for the 3 new kinds (polygon sides, I-shape flange/
        // web thickness).
        ...(s.overrides.polygon !== undefined ? { polygon: s.overrides.polygon } : {}),
        ...(s.overrides.ishape !== undefined ? { ishape: s.overrides.ishape } : {}),
        sceneUnits: getSceneUnitsRef.current?.() ?? 'mm',
      };
      return computeAnchorGhostFootprints(cursorPos, s.kind, s.anchor, ghostOverrides);
    },
    [],
  );

  // ── ADR-363 Phase 8D — publish handle to ribbon bridge store ────────────
  // Single writer pattern (mirror stair-status-store). Bridge reads via
  // `columnToolBridgeStore.get()` when no entity selected, so the contextual
  // column ribbon drives the FSM in drawing mode (kind dropdown + variant
  // numeric inputs).
  useEffect(() => {
    const isActive = state.phase !== 'idle';
    columnToolBridgeStore.set({
      isActive,
      kind: state.kind,
      anchor: state.anchor,
      overrides: state.overrides,
      setKind,
      setAnchor,
      setParamOverrides,
    });
    return () => {
      // Only clear if we're the current publisher (prevents wiping a newer
      // mount that took over).
      if (columnToolBridgeStore.get()?.setKind === setKind) {
        columnToolBridgeStore.set(null);
      }
    };
  }, [state, setKind, setAnchor, setParamOverrides]);

  // ── Tab cycles anchor (ADR-363 Phase 4.5c) ───────────────────────────────
  // ESC handled centrally by EscapeCommandBus (ADR-364 §4.1 BIM migration
  // 2026-05-19) — DRAW_TOOL slot in useKeyboardShortcuts calls
  // handleToolCompletion(activeTool, true) which deactivates this tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const direction: 1 | -1 = e.shiftKey ? -1 : 1;
      setState((prev) => {
        const idx = ANCHOR_CYCLE_ORDER.indexOf(prev.anchor);
        const len = ANCHOR_CYCLE_ORDER.length;
        const nextIdx = (idx + direction + len) % len;
        return { ...prev, anchor: ANCHOR_CYCLE_ORDER[nextIdx] };
      });
      e.preventDefault();
      e.stopPropagation();
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
    getGhostFootprints,
    isActive: state.phase !== 'idle',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
