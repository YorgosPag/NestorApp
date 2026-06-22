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
  DEFAULT_COLUMN_HEIGHT_MM,
  type ColumnAnchor,
  type ColumnKind,
} from '../../bim/types/column-types';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
  resolveColumnGridBindings,
  type ColumnParamOverrides,
} from './column-completion';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { axisHostTolScene } from '../../bim/hosting/resolve-axis-bindings';
import { useColumnAnchorTabCycle } from './use-column-anchor-tab-cycle';
// ADR-363 Φάση 3/3c «από περίγραμμα» — box-select/click-inside commit helpers (split).
import { useColumnPerimeterCommit } from './use-column-perimeter-commit';
// ADR-419 «Κολώνα σε περιοχή (4 γραμμές)» — region-detection clicks (mirror του τοίχου).
import { useColumnRegionClicks } from './use-column-region-clicks';
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
// ADR-404 Phase 5 — slanted column 2-click (base→top-lean) place flow.
import {
  setColumnTopLeanLock,
  getColumnTopLeanLock,
  clearColumnTopLeanLock,
} from '../../systems/cursor/ColumnTopLeanStore';
import { resolveTopLeanTilt } from '../../bim/columns/column-tilt-from-points';
import { resolveStoreyHeightMm } from '../../systems/levels/storey-creation-defaults';
import { resolveColumnRotationDeg } from '../../bim/columns/column-rotation';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { EventBus } from '../../systems/events/EventBus';
// ADR-398 §3.10 sync-in-preview — pre-collect τους face-snap στόχους στο ΚΟΙΝΟ scene store
// (κοινό με τοίχο/δοκάρι) ώστε το ghost + commit να υπολογίζουν το snap σύγχρονα.
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { useSceneSnapTargetSync } from './use-scene-snap-target-sync';
// N.7.1 file-size split — pure status-text resolver (FSM state → i18n key).
import { resolveColumnStatusTextKey } from './column-status-text';
// N.7.1 file-size split — state machine types + hook contract + INITIAL_STATE.
import {
  INITIAL_STATE,
  type ColumnPlacementMode,
  type ColumnToolState,
  type UseColumnToolOptions,
  type UseColumnToolResult,
} from './column-tool-types';

// Re-export το πλήρες type contract → οι consumers (`import … from './useColumnTool'`) δεν αλλάζουν.
export type {
  ColumnPlacementMode,
  ColumnToolPhase,
  ColumnToolState,
  UseColumnToolOptions,
  UseColumnToolResult,
} from './column-tool-types';

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

  // ── scene snap targets sync (ADR-398 §3.10 — mirror useWallTool/useBeamTool) ──
  // Pre-collect κολόνες/δοκάρια/τοίχοι/πλάκες στο `columnPreviewStore` ΠΡΙΝ το 1ο κλικ, ώστε
  // το ghost-before-click face-snap (+ commit) να υπολογίζεται σύγχρονα με έτοιμους στόχους.
  // Re-sync στόχων on entity-created (rAF) + refresh on activate — SSoT hook, κοινό με τοίχο/δοκάρι.
  const refreshSnapTargets = useSceneSnapTargetSync(() => getSceneEntitiesRef.current?.() ?? []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    refreshSnapTargets(); // στόχοι έτοιμοι πριν το 1ο ghost frame
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      anchor: prev.anchor,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      discreteIntent: prev.discreteIntent,
      slantMode: prev.slantMode,
      overrides: prev.overrides,
      phase: 'awaitingPosition',
    }));
  }, [refreshSnapTargets]);

  const setKind = useCallback((kind: ColumnKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      anchor: prev.anchor,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      discreteIntent: prev.discreteIntent,
      slantMode: prev.slantMode,
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
        slantMode: prev.slantMode,
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
    clearColumnTopLeanLock(); // ADR-404 Φ5 — ακύρωση τυχόν ενεργού slant 2-click
    sceneSnapTargetsStore.reset(); // ADR-398 §3.10 — καθάρισε τους face-snap στόχους
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    clearColumnRotationLock(); // ESC κατά το awaitingRotation → επιστροφή σε awaitingPosition
    clearColumnTopLeanLock(); // ESC κατά το awaitingTopLean → επιστροφή σε awaitingPosition
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      anchor: prev.anchor,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      discreteIntent: prev.discreteIntent,
      slantMode: prev.slantMode,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: ColumnParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ADR-404 Φ5 — ribbon toggle «Κεκλιμένη». Αλλαγή mode → ακύρωση τυχόν ενεργού 2-click
  // (rotation ή top-lean) ώστε να μην μείνει «μισό» κλικ από προηγούμενο mode.
  const setSlantMode = useCallback((slantMode: boolean) => {
    setState((prev) => {
      if (prev.slantMode === slantMode) return prev;
      clearColumnRotationLock();
      clearColumnTopLeanLock();
      return {
        ...prev,
        slantMode,
        phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
        error: null,
      };
    });
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
        slantMode: s.slantMode,
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
      // ADR-508 §column place+rotate / ADR-398 §3.10b — freehand 1ο κλικ (awaitingPosition):
      if (s.phase === 'awaitingPosition') {
        // ADR-398 §3.10b (2026-06-22, Giorgio): **2-click ΠΑΝΤΑ** (mirror τοίχου). Η κολώνα ΠΟΤΕ δεν
        // commit-άρει στο 1ο κλικ — ακόμη κι όταν είναι face-snapped (flush / center-on-axis / polar /
        // cartesian). Το 1ο κλικ κλειδώνει θέση+λαβή, το 2ο ορίζει τη ΓΩΝΙΑ (ελεύθερη). Η face-snap
        // λαβή χρησιμοποιείται ΜΟΝΟ ως anchor· το `point` είναι ΗΔΗ η snapped θέση (mouse-handler-up
        // §3.10: `worldPoint = faceSnap.position`). [Regression fix: οι §3.13 Polar / §3.15 Cartesian
        // κλάδοι επέστρεφαν face-anchor για ΟΛΟ το εσωτερικό δίσκου/ορθογωνίου → single-click παντού.]
        const faceAnchor = getColumnFaceAnchor();
        const anchor: ColumnAnchor = faceAnchor ?? (getColumnGhostStatus() === 'beam' ? 'center' : s.anchor);
        // ADR-404 Φ5 §slanted — ΚΕΚΛΙΜΕΝΗ (ελεύθερη τοποθέτηση): ΚΛΕΙΔΩΣΕ τη βάση + την
        // rotation της διατομής (από ribbon) → awaitingTopLean (2ο κλικ ορίζει την κλίση).
        if (s.slantMode) {
          setColumnTopLeanLock(point, anchor, s.overrides.rotation ?? 0);
          setState({ ...s, phase: 'awaitingTopLean', error: null });
          return false;
        }
        //   ΕΛΕΥΘΕΡΗ: ΚΛΕΙΔΩΣΕ θέση + anchor → awaitingRotation (2ο κλικ ορίζει γωνία).
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
        return commitColumnAt(s, rot.origin, rot.anchor, resolveColumnRotationDeg(rot.origin, point, worldPerPixel(getImmediateTransform().scale)));
      }
      //   2ο κλικ (awaitingTopLean) → κλίση από βάση→κορυφή· direction snapped (ίδια με rotation),
      //   angle = atan(οριζόντια απόσταση / ύψος) snapped (5/15/30/45°) → commit με tilt.
      if (s.phase === 'awaitingTopLean') {
        const lean = getColumnTopLeanLock();
        clearColumnTopLeanLock();
        if (!lean) {
          setState({ ...s, phase: 'awaitingPosition' });
          return false;
        }
        const sceneUnits = getSceneUnits?.() ?? 'mm';
        const heightMm = resolveStoreyHeightMm(s.overrides.height, DEFAULT_COLUMN_HEIGHT_MM);
        const wpp = worldPerPixel(getImmediateTransform().scale);
        const tilt = resolveTopLeanTilt(lean.basePoint, point, heightMm, sceneUnits, wpp);
        return commitColumnAt(
          { ...s, overrides: { ...s.overrides, tilt } },
          lean.basePoint,
          lean.anchor,
          lean.rotationDeg,
        );
      }
      return false;
    },
    [commitColumnAt, onPerimeterClick, onDiscretePerimeterClick, onRegionClick, getSceneUnits],
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
  // N.7.1 split — pure resolver lives σε column-status-text.ts (SSoT).
  const getStatusText = useCallback((): string => resolveColumnStatusTextKey(stateRef.current), []);

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
      slantMode: state.slantMode,
      overrides: state.overrides,
      setKind,
      setAnchor,
      setSlantMode,
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
  }, [state, setKind, setAnchor, setSlantMode, setParamOverrides]);

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
    setSlantMode,
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
