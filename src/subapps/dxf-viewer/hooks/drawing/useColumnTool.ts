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
  resolveColumnGridBindings,
  type ColumnParamOverrides,
  type SceneUnits,
} from './column-completion';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { axisHostTolScene } from '../../bim/hosting/resolve-axis-bindings';
import { useColumnAnchorTabCycle } from './use-column-anchor-tab-cycle';
// ADR-363 Φάση 3/3c «από περίγραμμα» — box-select/click-inside commit helpers (split).
import { useColumnPerimeterCommit } from './use-column-perimeter-commit';
// ADR-419 «Κολώνα σε περιοχή (4 γραμμές)» — region-detection clicks (mirror του τοίχου).
import { useColumnRegionClicks } from './use-column-region-clicks';
import type { RegionLineSeg } from '../../bim/walls/wall-in-region';
import type { RegionMethod } from '../../systems/tools/region-tool-ids';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import {
  getColumnGhostStatus,
  getColumnFaceAnchor,
} from '../../systems/cursor/ColumnPlacementGhostStatusStore';
import {
  setColumnRotationLock,
  getColumnRotationLock,
  clearColumnRotationLock,
} from '../../systems/cursor/ColumnRotationStore';
import { columnRotationDeg } from '../../bim/columns/column-rotation';
import { EventBus } from '../../systems/events/EventBus';

/**
 * ADR-363 Φάση 3 / 3c — column placement mode:
 *   - 'freehand'          — single-click placement (default, Phase 4).
 *   - 'outer-perimeter'   — box-select παρειές → ΕΝΑ τοιχίο (ColumnEntity) ανά
 *                           κλειστή περίμετρο, ΜΕ ένωση γειτονικών (Φάση 3).
 *   - 'discrete-perimeter'— box-select παρειές → ΧΩΡΙΣ ένωση (κάθε περίγραμμα
 *                           ξεχωριστό)· αυτόματη ταξινόμηση κολώνα/τοιχίο ανά
 *                           αναλογία πλευρών + ενημερωτικό confirm (Φάση 3c).
 *   - 'in-region'         — ADR-419 «Κολώνα σε περιοχή (4 γραμμές)»: 4 κλικ σε
 *                           γραμμές / 1 κλικ μέσα / box-select → ΕΝΑ ColumnEntity
 *                           ανά εσώκλειστο ορθογώνιο (ΙΔΙΑ SSoT με «Τοίχος σε περιοχή»).
 */
export type ColumnPlacementMode =
  | 'freehand'
  | 'outer-perimeter'
  | 'discrete-perimeter'
  | 'in-region';

// ─── State machine types ─────────────────────────────────────────────────────

export type ColumnToolPhase =
  | 'idle'
  | 'awaitingPosition'
  | 'awaitingRotation' // ADR-508 §column place+rotate — μετά το 1ο κλικ: ορισμός γωνίας με 2ο κλικ
  | 'committed';

export interface ColumnToolState {
  readonly phase: ColumnToolPhase;
  readonly kind: ColumnKind;
  readonly anchor: ColumnAnchor;
  /** ADR-363 Φάση 3 — 'freehand' (single-click) ή 'outer-perimeter' (από περίγραμμα). */
  readonly placementMode: ColumnPlacementMode;
  /**
   * ADR-419 — όταν `placementMode === 'in-region'`, ποιον τρόπο δέχεται το εργαλείο:
   * 'lines' (4 γραμμές) / 'inside' (κλικ μέσα) / 'box' (πλαίσιο). Οδηγείται από το
   * active tool id (column-region-lines/inside/box). Αδιάφορο στα άλλα modes.
   */
  readonly regionMethod: RegionMethod;
  /**
   * ADR-419 — όταν `placementMode === 'discrete-perimeter'`, η πρόθεση του χρήστη:
   * 'columns' («Πολλαπλή δημιουργία κολωνών») ή 'walls' («…τοιχίων»). Καθορίζει τι
   * δημιουργείται κατευθείαν vs τι ζητά επιβεβαίωση (intent-aware confirm).
   */
  readonly discreteIntent: 'columns' | 'walls';
  readonly overrides: ColumnParamOverrides;
  /** ADR-419 «Κολώνα σε περιοχή» — accumulated 4-line picks (mirror του τοίχου). */
  readonly regionPicks: readonly RegionLineSeg[];
  readonly error: string | null;
}

const INITIAL_STATE: ColumnToolState = {
  phase: 'idle',
  kind: 'rectangular',
  anchor: 'center',
  placementMode: 'freehand',
  regionMethod: 'lines',
  discreteIntent: 'columns',
  overrides: {},
  regionPicks: [],
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
  /** ADR-419 — in-region method ('lines' | 'inside' | 'box'), driven by tool id. */
  setRegionMethod(method: RegionMethod): void;
  /** ADR-419 — discrete-from-perimeter intent ('columns' | 'walls'), driven by tool id. */
  setDiscreteIntent(intent: 'columns' | 'walls'): void;
  /** Explicit anchor selector (used από ribbon combobox). */
  setAnchor(anchor: ColumnAnchor): void;
  /** Tab cycles through 9-state ring (ANCHOR_CYCLE_ORDER). */
  cycleAnchor(direction?: 1 | -1): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click commit-άρισε νέα column. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** ADR-419 — deduped ids των accumulated in-region picks (selection highlight). */
  getRegionPickIds(): string[];
  /** Dynamic Input field overrides (width / depth / height / rotation). */
  setParamOverrides(overrides: ColumnParamOverrides): void;
  /** Status text για status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
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
      regionMethod: prev.regionMethod,
      discreteIntent: prev.discreteIntent,
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
      regionMethod: prev.regionMethod,
      discreteIntent: prev.discreteIntent,
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
        regionMethod: prev.regionMethod,
        discreteIntent: prev.discreteIntent,
        placementMode: mode,
        phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
      };
    });
  }, []);

  // ADR-419 — set the in-region method ('lines' | 'inside' | 'box'). Driven by the
  // active tool id (column-region-lines/inside/box). Clears accumulated picks on change.
  const setRegionMethod = useCallback((regionMethod: RegionMethod) => {
    setState((prev) =>
      prev.regionMethod === regionMethod ? prev : { ...prev, regionMethod, regionPicks: [] },
    );
  }, []);

  // ADR-419 — set the discrete-from-perimeter intent ('columns' | 'walls'). Driven by
  // the active tool id (column-discrete-from-perimeter vs …-walls).
  const setDiscreteIntent = useCallback((discreteIntent: 'columns' | 'walls') => {
    setState((prev) => (prev.discreteIntent === discreteIntent ? prev : { ...prev, discreteIntent }));
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
    clearColumnRotationLock(); // ADR-508 §column place+rotate — ακύρωση τυχόν ενεργού rotation
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    clearColumnRotationLock(); // ESC κατά το awaitingRotation → επιστροφή σε awaitingPosition
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      anchor: prev.anchor,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      discreteIntent: prev.discreteIntent,
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
  const commitColumnAt = useCallback(
    (
      s: ColumnToolState,
      position: Readonly<Point2D>,
      anchor: ColumnAnchor,
      rotationDeg: number,
    ): boolean => {
      const overridesWithKind: ColumnParamOverrides = {
        ...s.overrides,
        kind: s.kind,
        anchor,
        rotation: rotationDeg,
      };
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const params = buildDefaultColumnParams(position, s.kind, overridesWithKind, sceneUnits);
      const result = buildColumnEntity(params, currentLevelId, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      // ADR-441 Slice COL — host-on-snap: αν το σημείο πέφτει σε άξονα/τομή κανάβου,
      // «κρέμασε» την κολώνα ώστε να ακολουθεί τον κάναβο (Revit «Column → At Grids»).
      const bindings = resolveColumnGridBindings(
        params.position,
        getGlobalGuideStore(),
        axisHostTolScene(sceneUnits),
      );
      const entity = bindings.length > 0 ? { ...result.entity, guideBindings: bindings } : result.entity;
      onColumnCreated?.(entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        anchor: s.anchor,
        placementMode: s.placementMode,
        regionMethod: s.regionMethod,
        discreteIntent: s.discreteIntent,
        overrides: s.overrides,
        phase: 'awaitingPosition',
      });
      return true;
    },
    [currentLevelId, onColumnCreated, getSceneUnits],
  );

  // ── «από περίγραμμα» commit helpers (ADR-363 Φ3/Φ3c) — εξήχθησαν σε hook ────
  // (N.7.1 file-size split). Box-select listener + click-inside για outer-perimeter
  // (ΜΕ ένωση→τοιχία) και discrete-perimeter (ΧΩΡΙΣ ένωση→αυτόματη ταξινόμηση+confirm).
  const { onPerimeterClick, onDiscretePerimeterClick } = useColumnPerimeterCommit({
    stateRef,
    onColumnCreatedRef,
    getSceneEntitiesRef,
    getSceneUnitsRef,
    currentLevelId,
  });

  // ── ADR-419 «Κολώνα σε περιοχή (4 γραμμές)» — region clicks + box-select ────
  // ΙΔΙΑ region-detection SSoT με τον τοίχο· χτίζει ColumnEntity ανά ορθογώνιο.
  const { onRegionClick, getRegionPickIds } = useColumnRegionClicks({
    stateRef,
    setState,
    onColumnCreatedRef,
    getSceneEntitiesRef,
    getSceneUnitsRef,
    currentLevelId,
  });

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;
      // ADR-363 Φάση 3 — outer-perimeter: click μέσα σε περίμετρο (box-select primary).
      if (s.placementMode === 'outer-perimeter') {
        return onPerimeterClick(point);
      }
      // ADR-363 Φάση 3c — discrete-perimeter: click μέσα σε περίμετρο (gated confirm).
      if (s.placementMode === 'discrete-perimeter') {
        return onDiscretePerimeterClick(point);
      }
      // ADR-419 — in-region: 4 κλικ σε γραμμές / 1 κλικ μέσα → ColumnEntity ανά ορθογώνιο.
      if (s.placementMode === 'in-region') {
        return onRegionClick(s, point);
      }
      // ADR-508 §column place+rotate — freehand 2-click (παριότητα με τοίχο/δοκάρι):
      //   1ο κλικ (awaitingPosition) → ΚΛΕΙΔΩΣΕ θέση + auto anchor (face-snap precedence ≡ ghost)
      //   → awaitingRotation (ΟΧΙ commit ακόμη).
      if (s.phase === 'awaitingPosition') {
        const faceAnchor = getColumnFaceAnchor();
        const anchor: ColumnAnchor =
          faceAnchor ?? (getColumnGhostStatus() === 'beam' ? 'center' : s.anchor);
        setColumnRotationLock(point, anchor);
        setState({ ...s, phase: 'awaitingRotation', error: null });
        return false;
      }
      //   2ο κλικ (awaitingRotation) → γωνία = κατεύθυνση (κλειδωμένη θέση → click) → commit.
      if (s.phase === 'awaitingRotation') {
        const rot = getColumnRotationLock();
        clearColumnRotationLock();
        if (!rot) {
          setState({ ...s, phase: 'awaitingPosition' });
          return false;
        }
        return commitColumnAt(s, rot.origin, rot.anchor, columnRotationDeg(rot.origin, point));
      }
      return false;
    },
    [commitColumnAt, onPerimeterClick, onDiscretePerimeterClick, onRegionClick],
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
    // ADR-363 Φάση 3c — discrete-perimeter prompt (box-select· αυτόματη ταξινόμηση).
    if (s.placementMode === 'discrete-perimeter')
      return 'tools.column.statusDiscretePerimeterPick';
    // ADR-419 — in-region prompt ανά τρόπο (4 γραμμές / κλικ μέσα / πλαίσιο).
    if (s.placementMode === 'in-region') {
      if (s.regionMethod === 'inside') return 'tools.column.statusRegionInsidePick';
      if (s.regionMethod === 'box') return 'tools.column.statusRegionBoxPick';
      return 'tools.column.statusRegionLinesPick';
    }
    return s.phase === 'awaitingPosition' ? 'tools.column.statusPosition' : '';
  }, []);

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
  useColumnAnchorTabCycle(stateRef, setState);

  return {
    state,
    activate,
    setKind,
    setPlacementMode,
    setRegionMethod,
    setDiscreteIntent,
    setAnchor,
    cycleAnchor,
    deactivate,
    reset,
    onCanvasClick,
    getRegionPickIds,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
