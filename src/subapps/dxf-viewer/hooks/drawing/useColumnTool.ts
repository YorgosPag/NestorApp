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
  DEFAULT_COLUMN_HEIGHT_MM,
  type ColumnAnchor,
  type ColumnEntity,
} from '../../bim/types/column-types';
// N.7.1 file-size split — pure column-from-click entity builder (extracted commitColumnAt core).
import { buildClickColumnEntity, type ColumnSizeOverride } from './column-commit-build';
// Giorgio 2026-07-01 — Γ/Τ/Π/σύνθετο shape adoption (πλήρες/επαγγελματικό): ΕΝΑ
// polygon-backed τοιχίο ανά κλειστό περίγραμμα (SSoT builder, κοινό με «από περίγραμμα»).
import { buildColumnsFromPerimeters } from '../../bim/columns/column-from-faces';
import type { ClosedPerimeter } from '../../bim/walls/perimeter-from-faces';
// N.7.1 file-size split — state-mutation actions (lifecycle + ribbon setters).
import { useColumnToolStateActions } from './use-column-tool-actions';
import { useColumnAnchorTabCycle } from './use-column-anchor-tab-cycle';
// ADR-363 Φάση 3/3c «από περίγραμμα» — box-select/click-inside commit helpers (split).
import { useColumnPerimeterCommit } from './use-column-perimeter-commit';
// ADR-419 «Κολώνα σε περιοχή (4 γραμμές)» — region-detection clicks (mirror του τοίχου).
import { useColumnRegionClicks } from './use-column-region-clicks';
// ADR-524 «Πολλαπλή πλήρωση όμοιων πλαισίων» — κοινός suggest (region 'inside' + adopt).
import { useColumnBatchFillSuggest } from './use-column-batch-fill-suggest';
// ADR-398 §3.17 — «Υιοθέτηση μεγέθους ορθογωνίου» (opt-in confirm στο 1ο κλικ μέσα σε ορθογώνιο DXF).
import { useColumnRectAdopt } from './use-column-rect-adopt';
import type { AdoptProposal } from '../../bim/columns/column-adopt-rect';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import {
  getColumnGhostStatus,
  getColumnFaceAnchor,
  getColumnFaceRotation,
  getColumnFaceSizing,
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
import { useSceneSnapTargetSync } from './use-scene-snap-target-sync';
// N.7.1 file-size split — pure status-text resolver (FSM state → i18n key).
import { resolveColumnStatusTextKey } from './column-status-text';
// N.7.1 file-size split — state machine types + hook contract + INITIAL_STATE.
import {
  INITIAL_STATE,
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
  const { onColumnCreated, onColumnsCreated, currentLevelId = '0', getSceneUnits, getSceneEntities } = options;

  const [state, setState] = useState<ColumnToolState>(INITIAL_STATE);
  const stateRef = useRef<ColumnToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const getSceneEntitiesRef = useRef(getSceneEntities);
  getSceneEntitiesRef.current = getSceneEntities;
  const onColumnCreatedRef = useRef(onColumnCreated);
  onColumnCreatedRef.current = onColumnCreated;
  // ADR-524 — batch appender (ΕΝΑΣ adapter). Προτιμά `onColumnsCreated`· fallback
  // per-entity μόνο αν δεν δόθηκε batch callback. Σταθερή ref για τα multi-column hooks.
  const onColumnsCreatedRef = useRef(onColumnsCreated);
  onColumnsCreatedRef.current = onColumnsCreated;
  const appendColumnsBatchRef = useRef<(entities: readonly ColumnEntity[]) => void>(() => {});
  appendColumnsBatchRef.current = (entities) => {
    const batch = onColumnsCreatedRef.current;
    if (batch) {
      batch(entities);
      return;
    }
    const single = onColumnCreatedRef.current;
    if (single) for (const e of entities) single(e);
  };

  // ── scene snap targets sync (ADR-398 §3.10 — mirror useWallTool/useBeamTool) ──
  // Pre-collect κολόνες/δοκάρια/τοίχοι/πλάκες στο `columnPreviewStore` ΠΡΙΝ το 1ο κλικ, ώστε
  // το ghost-before-click face-snap (+ commit) να υπολογίζεται σύγχρονα με έτοιμους στόχους.
  // Re-sync στόχων on entity-created (rAF) + refresh on activate — SSoT hook, κοινό με τοίχο/δοκάρι.
  const refreshSnapTargets = useSceneSnapTargetSync(() => getSceneEntitiesRef.current?.() ?? []);

  // ── lifecycle + ribbon setters (N.7.1 split → use-column-tool-actions) ─────
  // Καθαροί state reducers· ίδιες υπογραφές/dependency arrays (μηδέν regression).
  const {
    activate,
    setKind,
    setPlacementMode,
    setRegionMethod,
    setDiscreteIntent,
    setAnchor,
    cycleAnchor,
    deactivate,
    reset,
    setParamOverrides,
    setSlantMode,
  } = useColumnToolStateActions(setState, refreshSnapTargets);

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
      // ADR-398 §3.17 — one-shot override (υιοθέτηση ορθογωνίου): χτίζει ΑΥΤΟ το στοιχείο με το adopted
      // width/depth/kind (κολόνα ή τοιχίο κατά EC2) ΧΩΡΙΣ να αλλάξει την προεπιλογή του εργαλείου (το
      // persisted `s.overrides`/`s.kind` μένουν άθικτα → το επόμενο στοιχείο ξαναγίνεται default).
      sizeOverride?: ColumnSizeOverride,
    ): boolean => {
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const built = buildClickColumnEntity(
        s.overrides,
        s.kind,
        position,
        anchor,
        rotationDeg,
        currentLevelId,
        sceneUnits,
        sizeOverride,
      );
      if (!built.ok) {
        setState({ ...s, error: built.error });
        return false;
      }
      onColumnCreated?.(built.entity);
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

  // ── ADR-524 «Πολλαπλή πλήρωση όμοιων πλαισίων» — κοινός suggest ──────────────
  // Καλείται μετά από ΚΑΘΕ τοποθέτηση σε πλαίσιο (region 'inside' + freehand adopt):
  // βρίσκει τα υπόλοιπα όμοια (ίδιο χρώμα) αγέμιστα πλαίσια και ρωτά αν θα γεμίσουν.
  const { suggestBatchFillAt } = useColumnBatchFillSuggest({
    appendColumnsRef: appendColumnsBatchRef,
    getSceneEntitiesRef,
    getSceneUnitsRef,
    currentLevelId,
  });

  // ── ADR-398 §3.17 «Υιοθέτηση μεγέθους ορθογωνίου» — opt-in confirm στο 1ο κλικ ────
  // Adopt («Ναι») → commit στο μέγεθος+κέντρο+γωνία του ορθογωνίου (anchor `center`, μηδέν 2ο κλικ:
  // το ορθογώνιο ορίζει πλήρως την κολόνα, Revit-grade). Default («Όχι») → κανονική ροή 2-κλικ.
  const onAdoptRect = useCallback(
    (s: ColumnToolState, proposal: AdoptProposal): void => {
      // one-shot override (5ος παράμετρος) → χτίζει στο μέγεθος + ΤΥΠΟ (κολόνα/τοιχίο κατά EC2) του
      // ορθογωνίου ΧΩΡΙΣ leak στην προεπιλογή του εργαλείου.
      //
      // ΣΤΑΤΙΚΟΣ ΠΥΡΗΝΑΣ = Η ΠΕΡΙΟΧΗ ΑΚΡΙΒΩΣ (Giorgio 2026-06-23, Revit-grade): το σχεδιασμένο
      // ορθογώνιο (4 ενωμένες γραμμές) είναι ο ΣΤΑΤΙΚΟΣ ΠΥΡΗΝΑΣ της κολόνας → η κολόνα γεμίζει την
      // περιοχή ΑΚΡΙΒΩΣ (δεν προεξέχει, δεν υπολείπεται). Ο σοβάς (ADR-449) είναι additive «δέρμα»
      // που μπαίνει ΓΥΡΩ-ΓΥΡΩ από τον πυρήνα (έξω από την περιοχή) — μηδέν inset, μηδέν επηρεασμός
      // του width/depth (immutable στατική διάσταση). `finish` παραλείπεται → default enabled
      // (`buildDefaultColumnParams`) → ο σοβάς εμφανίζεται κανονικά περιμετρικά.
      //
      // `autoSized: false` (ADR-499/ADR-503) — ΚΡΙΣΙΜΟ: η υιοθετημένη διάσταση είναι ΡΗΤΗ
      // αρχιτεκτονική πρόθεση (ο χρήστης τη σχεδίασε) → user-wins. Χωρίς αυτό, ο auto-sizer
      // (`buildColumnSizePatch`) ξανα-υπολόγιζε τη διατομή από λυγηρότητα/οπλισμό και «φούσκωνε»
      // π.χ. το 250 στο ελάχιστο επαρκές 300 (Giorgio bug 2026-06-23: 1×0,25 → 1×0,30).
      const ok = commitColumnAt(s, proposal.center, 'center', proposal.rotationDeg, {
        width: proposal.widthMm,
        depth: proposal.depthMm,
        kind: proposal.kind,
        autoSized: false,
      });
      // ADR-524 — μετά την υιοθέτηση, πρότεινε πλήρωση των υπόλοιπων όμοιων πλαισίων
      // (ίδιο χρώμα). Το `proposal.center` είναι μέσα στο πλαίσιο που μόλις γέμισε.
      if (ok) suggestBatchFillAt(proposal.center);
    },
    [commitColumnAt, suggestBatchFillAt],
  );
  const onAdoptDefault = useCallback(
    (s: ColumnToolState, point: Readonly<Point2D>, anchor: ColumnAnchor): void => {
      setColumnRotationLock(point, anchor); // ίδια κανονική ροή «θέση→γωνία» (2ο κλικ ορίζει γωνία)
      setState({ ...s, phase: 'awaitingRotation', error: null });
    },
    [],
  );
  // ADR-398 §3.17 (Γ/Τ/Π extension) — υιοθέτηση μη-ορθογώνιου σχήματος: ΕΝΑ
  // polygon-backed τοιχίο (composite/U-shape) που γεμίζει το ακριβές περίγραμμα.
  // Reuse ΤΟΥ ΙΔΙΟΥ SSoT builder με το «Τοιχίο από περίγραμμα» (`buildColumnsFromPerimeters`)
  // + ΤΟΥ ΙΔΙΟΥ batch appender → μηδέν διπλότυπο. Το FSM μένει σε awaitingPosition
  // (συνεχής τοποθέτηση), όπως και το rect adopt μετά το commit.
  const onAdoptShape = useCallback(
    (_s: ColumnToolState, perimeter: ClosedPerimeter): void => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const built = buildColumnsFromPerimeters([perimeter], currentLevelId, sceneUnits);
      if (built.columns.length > 0) appendColumnsBatchRef.current(built.columns);
      EventBus.emit('bim:columns-from-perimeter', {
        built: built.columns.length,
        ignored: built.ignored,
      });
    },
    [currentLevelId, getSceneUnitsRef],
  );
  const { tryAdoptRectColumn } = useColumnRectAdopt({
    getSceneEntitiesRef,
    getSceneUnitsRef,
    onAdopt: onAdoptRect,
    onAdoptShape,
    onDefault: onAdoptDefault,
  });

  // ── «από περίγραμμα» commit helpers (ADR-363 Φ3/Φ3c) — εξήχθησαν σε hook ────
  // (N.7.1 file-size split). Box-select listener + click-inside για outer-perimeter
  // (ΜΕ ένωση→τοιχία) και discrete-perimeter (ΧΩΡΙΣ ένωση→αυτόματη ταξινόμηση+confirm).
  const { onPerimeterClick, onDiscretePerimeterClick } = useColumnPerimeterCommit({
    stateRef,
    appendColumnsRef: appendColumnsBatchRef,
    getSceneEntitiesRef,
    getSceneUnitsRef,
    currentLevelId,
  });

  // ── ADR-419 «Κολώνα σε περιοχή (4 γραμμές)» — region clicks + box-select ────
  // ΙΔΙΑ region-detection SSoT με τον τοίχο· χτίζει ColumnEntity ανά ορθογώνιο.
  const { onRegionClick, getRegionPickIds } = useColumnRegionClicks({
    stateRef,
    setState,
    appendColumnsRef: appendColumnsBatchRef,
    getSceneEntitiesRef,
    getSceneUnitsRef,
    currentLevelId,
    suggestBatchFillAt,
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
        // ADR-525 — L corner-gap auto-junction: η L είναι ΠΛΗΡΩΣ ορισμένη από τα δύο κάθετα δοκάρια
        // (θέση + γωνία + διαστάσεις σκελών) → **single-click commit** (mirror adopt-rect §3.17, χωρίς
        // 2ο κλικ-γωνία). `autoSized:false` (ρητές διαστάσεις → ο auto-sizer δεν τις αλλάζει).
        const lSizing = getColumnFaceSizing();
        if (lSizing && !s.slantMode) {
          return commitColumnAt(s, point, anchor, getColumnFaceRotation() ?? 0, {
            width: lSizing.widthMm,
            depth: lSizing.depthMm,
            kind: 'L-shape',
            lshape: { armWidth: lSizing.armWidthMm, armLength: lSizing.armLengthMm, flipY: lSizing.flipY },
            autoSized: false,
          });
        }
        // ADR-398 §3.17 — 1ο κλικ μέσα σε ορθογώνιο DXF (rectangle/polyline/4-γραμμές): opt-in confirm
        // «υιοθέτηση μεγέθους ή default;». Μόνο ΕΛΕΥΘΕΡΗ τοποθέτηση (όχι slant). Αν ανοίξει → σταμάτα
        // εδώ (η ροή συνεχίζει async στο resolve: adopt→commit / default→awaitingRotation / cancel→noop).
        if (!s.slantMode && tryAdoptRectColumn(s, point, anchor)) return false;
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
    [commitColumnAt, onPerimeterClick, onDiscretePerimeterClick, onRegionClick, getSceneUnits, tryAdoptRectColumn],
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
      // Giorgio 2026-07-01 — «hover σε πλαίσιο → διακεκομμένη» eligible ΜΟΝΟ όταν ο
      // σκέτος «Κολόνα» περιμένει θέση (awaitingPosition) & όχι κεκλιμένη (slant δεν
      // υιοθετεί). Το `useRegionPerimeterMouseMove` το διαβάζει ώστε preview ≡ adopt-click.
      isRegionFillEligible: state.phase === 'awaitingPosition' && !state.slantMode,
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
