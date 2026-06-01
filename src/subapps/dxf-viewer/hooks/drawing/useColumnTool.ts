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
import type { Entity } from '../../types/entities';
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
// ADR-363 Φάση 3 «Τοιχίο από περίγραμμα» — faces → ΕΝΑ ColumnEntity ανά περίμετρο.
import {
  perimeterFacesToColumns,
  buildColumnsFromPerimeters,
} from '../../bim/columns/column-from-faces';
import { perimeterFacesToRects } from '../../bim/walls/perimeter-from-faces';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import { EventBus } from '../../systems/events/EventBus';

/**
 * ADR-363 Φάση 3 — column placement mode:
 *   - 'freehand'        — single-click placement (default, Phase 4).
 *   - 'outer-perimeter' — box-select τις παρειές ενός δομικού στοιχείου → ΕΝΑ
 *                         τοιχίο (ColumnEntity) ανά κλειστή περίμετρο.
 */
export type ColumnPlacementMode = 'freehand' | 'outer-perimeter';

// ─── State machine types ─────────────────────────────────────────────────────

export type ColumnToolPhase =
  | 'idle'
  | 'awaitingPosition'
  | 'committed';

export interface ColumnToolState {
  readonly phase: ColumnToolPhase;
  readonly kind: ColumnKind;
  readonly anchor: ColumnAnchor;
  /** ADR-363 Φάση 3 — 'freehand' (single-click) ή 'outer-perimeter' (από περίγραμμα). */
  readonly placementMode: ColumnPlacementMode;
  readonly overrides: ColumnParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: ColumnToolState = {
  phase: 'idle',
  kind: 'rectangular',
  anchor: 'center',
  placementMode: 'freehand',
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
  /**
   * ADR-363 Φάση 3 — live scene entities getter για το 'outer-perimeter' mode
   * (ανάλυση των παρειών στο box-select / click-inside). Omit ⇒ το «από
   * περίγραμμα» γίνεται no-op.
   */
  readonly getSceneEntities?: () => readonly Entity[];
}

export interface UseColumnToolResult {
  readonly state: ColumnToolState;
  activate(): void;
  /** Switch active kind (4 kinds). Resets the state machine. */
  setKind(kind: ColumnKind): void;
  /**
   * ADR-363 Φάση 3 — switch placement mode ('freehand' ⇄ 'outer-perimeter').
   * Resets the state machine (κρατά kind + anchor + overrides). Driven by the
   * active tool id ('column' → freehand, 'column-from-perimeter' → outer-perimeter).
   */
  setPlacementMode(mode: ColumnPlacementMode): void;
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
  const { onColumnCreated, currentLevelId = '0', getSceneUnits, getSceneEntities } = options;

  const [state, setState] = useState<ColumnToolState>(INITIAL_STATE);
  const stateRef = useRef<ColumnToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const getSceneEntitiesRef = useRef(getSceneEntities);
  getSceneEntitiesRef.current = getSceneEntities;
  const onColumnCreatedRef = useRef(onColumnCreated);
  onColumnCreatedRef.current = onColumnCreated;

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      anchor: prev.anchor,
      placementMode: prev.placementMode,
      overrides: prev.overrides,
      phase: 'awaitingPosition',
    }));
  }, []);

  const setKind = useCallback((kind: ColumnKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      anchor: prev.anchor,
      placementMode: prev.placementMode,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  // ADR-363 Φάση 3 — switch placement mode (freehand ⇄ outer-perimeter). Resets
  // the state machine (κρατά kind + anchor + overrides). No-op όταν δεν αλλάζει.
  const setPlacementMode = useCallback((mode: ColumnPlacementMode) => {
    setState((prev) => {
      if (prev.placementMode === mode) return prev;
      return {
        ...INITIAL_STATE,
        kind: prev.kind,
        anchor: prev.anchor,
        overrides: prev.overrides,
        placementMode: mode,
        phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
      };
    });
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
      placementMode: prev.placementMode,
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
        placementMode: s.placementMode,
        overrides: s.overrides,
        phase: 'awaitingPosition',
      });
      return true;
    },
    [currentLevelId, onColumnCreated, getSceneUnits],
  );

  // ── outer-perimeter helpers (ADR-363 Φάση 3 «Τοιχίο από περίγραμμα») ──────
  // Live scene-units-agnostic hit-test tolerance (world units), ίδιος κανόνας
  // SNAP_DEFAULT/scale με το «Τοίχος από περίγραμμα».
  const regionTol = useCallback(
    (): number => TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale,
    [],
  );

  // Commit ΕΝΑ ColumnEntity ανά περίμετρο· broadcast summary toast event. Mirror
  // του `commitPerimeterFaces` (walls): per-entity append via onColumnCreated.
  const commitPerimeterColumns = useCallback(
    (built: { columns: ColumnEntity[]; ignored: number }): boolean => {
      for (const column of built.columns) onColumnCreatedRef.current?.(column);
      EventBus.emit('bim:columns-from-perimeter', {
        built: built.columns.length,
        ignored: built.ignored,
      });
      return built.columns.length > 0;
    },
    [],
  );

  // Click μέσα σε κλειστή περίμετρο κάτω από τον κέρσορα → τοιχίο (box-select είναι
  // η κύρια χειρονομία· αυτό είναι η single-click διευκόλυνση, mirror in-region).
  const onPerimeterClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const entities = getSceneEntitiesRef.current?.() ?? [];
      const { perimeters } = perimeterFacesToRects(entities, regionTol());
      const hit = perimeters.filter((p) => isPointInPolygon(point as Point2D, [...p.polygon]));
      if (hit.length === 0) return false;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      return commitPerimeterColumns(buildColumnsFromPerimeters(hit, currentLevelId, sceneUnits));
    },
    [regionTol, currentLevelId, commitPerimeterColumns],
  );

  // Box-select listener (reuse κοινό 'bim:wall-region-box-select'). Inert εκτός
  // outer-perimeter mode. Mirror του `useWallToolPerimeterBoxSelectListener`.
  useEffect(
    () =>
      EventBus.on('bim:wall-region-box-select', ({ entityIds }) => {
        const s = stateRef.current;
        if (s.placementMode !== 'outer-perimeter' || s.phase === 'idle') return;
        const idSet = new Set(entityIds);
        const selected = (getSceneEntitiesRef.current?.() ?? []).filter((e) => idSet.has(e.id));
        const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
        commitPerimeterColumns(
          perimeterFacesToColumns(selected, regionTol(), currentLevelId, sceneUnits),
        );
      }),
    [regionTol, currentLevelId, commitPerimeterColumns],
  );

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;
      // ADR-363 Φάση 3 — outer-perimeter: click μέσα σε περίμετρο (box-select primary).
      if (s.placementMode === 'outer-perimeter') {
        return onPerimeterClick(point);
      }
      if (s.phase !== 'awaitingPosition') return false;
      return commitColumnFromState(s, point);
    },
    [commitColumnFromState, onPerimeterClick],
  );

  // ── ADR-403 — 3D placement bridge ─────────────────────────────────────────
  // The 3D viewport (`useBim3DColumnPlacement`) raycasts the active floor plane
  // and emits the scene-units point; route it through the SAME `onCanvasClick`
  // commit path so 2D and 3D share one column FSM (zero duplication). Ref keeps
  // the listener stable while always calling the latest callback.
  const onCanvasClickRef = useRef(onCanvasClick);
  onCanvasClickRef.current = onCanvasClick;
  useEffect(() => {
    return EventBus.on('bim:place-column-3d', ({ point }) => {
      onCanvasClickRef.current(point);
    });
  }, []);

  // ── status text (i18n keys returned για caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase === 'idle') return '';
    // ADR-363 Φάση 3 — outer-perimeter prompt (box-select τις παρειές).
    if (s.placementMode === 'outer-perimeter') return 'tools.column.statusPerimeterPick';
    return s.phase === 'awaitingPosition' ? 'tools.column.statusPosition' : '';
  }, []);

  // ── ADR-363 Phase 4.5c.1 — anchor ghost preview projection ──────────────
  const getGhostFootprints = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly AnchorGhost[] | null => {
      const s = stateRef.current;
      // ADR-363 Φάση 3 — outer-perimeter δεν έχει anchor ghost (box-select picks).
      if (s.placementMode === 'outer-perimeter') return null;
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
      // ADR-398 — expose scene units for the Body Corner Projection snap.
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
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
    setPlacementMode,
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
