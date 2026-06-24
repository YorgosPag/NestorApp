/**
 * ADR-436 Slice 1 + Slice 2 — Foundation Tool React Hook Orchestrator.
 *
 * State machine (kind fixed by tool id — Revit 3 separate tools, NOT a combobox):
 *   - `pad` (point-based, Slice 1):
 *       idle → awaitingPosition → committed → awaitingPosition (continuous)
 *   - `strip` / `tie-beam` (line-based, Slice 2 — mirror `useBeamTool`):
 *       idle → awaitingStart → awaitingEnd → committed → awaitingStart (continuous)
 *   - `from-wall` (Slice 2 Phase 2b): 1-click pick of an existing wall → strip on
 *       its axis, independent of the FSM kind (mirror beam `from-wall`).
 *
 * Single-click placement (pad) — Revit Structural Foundation: Isolated. Two-click
 * line placement (strip/tie-beam) mirrors the AutoCAD `LINE` chain. ESC reset
 * (central EscapeCommandBus). Continuous chain.
 *
 * SSoT alignment:
 *   - Entity build via `buildFoundationEntity` / `buildDefaultFoundationParams` /
 *     `completeFoundationFromTwoClicks` (`hooks/drawing/foundation-completion.ts`).
 *     ZERO duplicate construction.
 *   - Line FSM writes `foundationPreviewStore` BEFORE `setState` (zero-delay
 *     rubber-band band ghost), mirror `useBeamTool` + `beamPreviewStore`.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4
 * @see hooks/drawing/useBeamTool.ts — line FSM + from-wall πρότυπο
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import {
  FOUNDATION_ANCHOR_CYCLE_ORDER,
  type FoundationAnchor,
  type FoundationEntity,
  type FoundationKind,
} from '../../bim/types/foundation-types';
import {
  buildDefaultFoundationParams,
  buildFoundationEntity,
  completeFoundationFromTwoClicks,
  type FoundationParamOverrides,
  type SceneUnits,
} from './foundation-completion';
import { foundationToolBridgeStore } from '../../ui/ribbon/hooks/bridge/foundation-tool-bridge-store';
import { foundationPreviewStore } from '../../bim/foundations/foundation-preview-store';
import { pickWallEntityAt, buildStripFromWall } from '../../bim/foundations/foundation-from-wall';
// ADR-484 Slice 4 — η στάθμη του χειροκίνητου πεδίλου παράγεται από το FFL ορόφου
// Θεμελίωσης (ρυθμίσεις), μέσω override στο `buildDefaultFoundationParams`.
import { resolveActiveFoundationLevelElevationMm } from '../../bim/foundations/foundation-level-elevation';
import { isWallEntity, type Entity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
// ADR-514 Φ6c — το πέδιλο (1-κλικ) κουμπώνει σε παρειά/άξονα κολόνας/μέλους ΟΠΩΣ η κολώνα, ΜΕΣΑ από
// τον ΕΝΑ εγκέφαλο έλξης (reuse `resolveColumnFaceSnapFromTargets`)· κοινό pre-collected scene store.
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { useSceneSnapTargetSync } from './use-scene-snap-target-sync';
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
// ADR-514 Φ6d — pad place→rotate (2-click, mirror κολώνας): κοινό rotation lock + ίδια opts/γωνία SSoT.
import { buildPlacementPolarSnapOptions } from '../../bim/placement/placement-polar-opts';
import {
  setPlacementRotationLock,
  getPlacementRotationLock,
  clearPlacementRotationLock,
} from '../../systems/cursor/PlacementRotationStore';
import { resolveColumnRotationDeg } from '../../bim/columns/column-rotation';
import { DEFAULT_PAD_WIDTH_MM, DEFAULT_PAD_LENGTH_MM } from '../../bim/types/foundation-types';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';

// ─── State machine types ─────────────────────────────────────────────────────

export type FoundationToolPhase =
  | 'idle'
  | 'awaitingPosition'   // pad — 1ο κλικ (θέση)
  | 'awaitingRotation'   // pad — 2ο κλικ (γωνία, ADR-514 Φ6d place+rotate, mirror κολώνας)
  | 'awaitingStart'      // line — 1st click
  | 'awaitingEnd'        // line — 2nd click
  | 'committed';

/**
 * Placement mode (mirror beam):
 *   - 'freehand'  — pad single-click ή strip/tie-beam 2-click.
 *   - 'from-wall' — «Πεδιλοδοκός από τοίχο»: 1 κλικ πάνω σε τοίχο → strip στον άξονά του.
 */
export type FoundationPlacementMode = 'freehand' | 'from-wall';

export interface FoundationToolState {
  readonly phase: FoundationToolPhase;
  readonly kind: FoundationKind;
  readonly placementMode: FoundationPlacementMode;
  readonly anchor: FoundationAnchor;
  readonly startPoint: Point2D | null;
  readonly overrides: FoundationParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: FoundationToolState = {
  phase: 'idle',
  kind: 'pad',
  placementMode: 'freehand',
  anchor: 'center',
  startPoint: null,
  overrides: {},
  error: null,
};

/** True for the line-based kinds (strip / tie-beam) που τρέχουν 2-click FSM. */
function isLineKind(kind: FoundationKind): boolean {
  return kind === 'strip' || kind === 'tie-beam';
}

/** Active (non-idle) entry phase για το συνδυασμό kind + placementMode. */
function activePhaseFor(kind: FoundationKind, placementMode: FoundationPlacementMode): FoundationToolPhase {
  if (placementMode === 'from-wall') return 'awaitingStart';
  return isLineKind(kind) ? 'awaitingStart' : 'awaitingPosition';
}

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseFoundationToolOptions {
  /** Callback fired μετά από επιτυχές build + commit. */
  readonly onFoundationCreated?: (entity: FoundationEntity) => void;
  /** Layer ID στο οποίο γράφεται η νέα foundation. */
  readonly currentLevelId?: string;
  /** Active scene coordinate units για σωστή mm→canvas conversion. */
  readonly getSceneUnits?: () => SceneUnits;
  /** Live scene entities — required ONLY για placementMode 'from-wall' (hit-test wall). */
  readonly getSceneEntities?: () => readonly Entity[];
}

export interface UseFoundationToolResult {
  readonly state: FoundationToolState;
  activate(): void;
  setKind(kind: FoundationKind): void;
  setPlacementMode(mode: FoundationPlacementMode): void;
  setAnchor(anchor: FoundationAnchor): void;
  cycleAnchor(direction?: 1 | -1): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click commit-άρισε νέα foundation ή προήγαγε το FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  setParamOverrides(overrides: FoundationParamOverrides): void;
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
  readonly isAwaitingStart: boolean;
  readonly isAwaitingEnd: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useFoundationTool(options: UseFoundationToolOptions = {}): UseFoundationToolResult {
  const { onFoundationCreated, currentLevelId = '0', getSceneUnits, getSceneEntities } = options;

  const [state, setState] = useState<FoundationToolState>(INITIAL_STATE);
  const stateRef = useRef<FoundationToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const getSceneEntitiesRef = useRef(getSceneEntities);
  getSceneEntitiesRef.current = getSceneEntities;

  // ── ADR-514 Φ6c — scene snap targets sync (mirror useColumnTool) — pad face-snap στόχοι ──
  const refreshSnapTargets = useSceneSnapTargetSync(() => getSceneEntitiesRef.current?.() ?? []);

  // Unmount cleanup — reset line preview store on teardown.
  useEffect(() => {
    return () => foundationPreviewStore.reset();
  }, []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  // Line transitions sync foundationPreviewStore immediately (before setState) so
  // the rubber-band band reads the correct data on the very next mousemove.

  const syncPreview = useCallback(
    (kind: FoundationKind, placementMode: FoundationPlacementMode, phase: FoundationToolPhase, startPoint: Point2D | null, overrides: FoundationParamOverrides, anchor: FoundationAnchor) => {
      if (phase === 'idle' || placementMode === 'from-wall') {
        foundationPreviewStore.reset();
        return;
      }
      if (isLineKind(kind)) {
        foundationPreviewStore.set({ startPoint, endPoint: null, kind, overrides });
        return;
      }
      // ADR-514 Φ6c — pad: κράτα kind + overrides(+anchor) ώστε το live pad ghost
      // (`generateFoundationPadPreview`) να χτίζει το ΑΚΡΙΒΕΣ πέδιλο που θα κάνει commit (preview ≡ commit).
      foundationPreviewStore.set({ startPoint: null, endPoint: null, kind, overrides: { ...overrides, anchor } });
    },
    [],
  );

  const activate = useCallback(() => {
    refreshSnapTargets(); // ADR-514 Φ6c — pad face-snap στόχοι έτοιμοι πριν το 1ο κλικ
    const prev = stateRef.current;
    const phase = activePhaseFor(prev.kind, prev.placementMode);
    syncPreview(prev.kind, prev.placementMode, phase, null, prev.overrides, prev.anchor);
    setState({ ...INITIAL_STATE, kind: prev.kind, placementMode: prev.placementMode, anchor: prev.anchor, overrides: prev.overrides, phase });
    // ADR-484 — το πρώην soft warning «θεμελίωση σε υπέργειο όροφο» αφαιρέθηκε:
    // πλέον το πέδιλο δρομολογείται ΠΑΝΤΑ στον foundation level (Revit-canonical,
    // addFoundationToScene), άρα δεν «κολλάει» σε λάθος όροφο → η προειδοποίηση ήταν
    // παραπλανητική. (Το ground-slab warning διατηρείται στο useRibbonSlabBridge.)
  }, [syncPreview, refreshSnapTargets]);

  const setKind = useCallback((kind: FoundationKind) => {
    clearPlacementRotationLock(); // ADR-514 Φ6d — αλλαγή kind ακυρώνει τυχόν ενεργό pad place+rotate
    setState((prev) => {
      const phase = prev.phase === 'idle' ? 'idle' : activePhaseFor(kind, prev.placementMode);
      syncPreview(kind, prev.placementMode, phase, null, prev.overrides, prev.anchor);
      return { ...INITIAL_STATE, kind, placementMode: prev.placementMode, anchor: prev.anchor, overrides: prev.overrides, phase };
    });
  }, [syncPreview]);

  const setPlacementMode = useCallback((mode: FoundationPlacementMode) => {
    clearPlacementRotationLock(); // ADR-514 Φ6d — αλλαγή mode ακυρώνει τυχόν ενεργό pad place+rotate
    setState((prev) => {
      if (prev.placementMode === mode) return prev;
      const phase = prev.phase === 'idle' ? 'idle' : activePhaseFor(prev.kind, mode);
      syncPreview(prev.kind, mode, phase, null, prev.overrides, prev.anchor);
      return { ...INITIAL_STATE, kind: prev.kind, placementMode: mode, anchor: prev.anchor, overrides: prev.overrides, phase };
    });
  }, [syncPreview]);

  const setAnchor = useCallback((anchor: FoundationAnchor) => {
    setState((prev) => {
      syncPreview(prev.kind, prev.placementMode, prev.phase, prev.startPoint, prev.overrides, anchor); // ADR-514 Φ6c — live pad ghost follows anchor
      return { ...prev, anchor };
    });
  }, [syncPreview]);

  const cycleAnchor = useCallback((direction: 1 | -1 = 1) => {
    setState((prev) => {
      const idx = FOUNDATION_ANCHOR_CYCLE_ORDER.indexOf(prev.anchor);
      const len = FOUNDATION_ANCHOR_CYCLE_ORDER.length;
      const nextIdx = (idx + direction + len) % len;
      const anchor = FOUNDATION_ANCHOR_CYCLE_ORDER[nextIdx];
      syncPreview(prev.kind, prev.placementMode, prev.phase, prev.startPoint, prev.overrides, anchor);
      return { ...prev, anchor };
    });
  }, [syncPreview]);

  const deactivate = useCallback(() => {
    clearPlacementRotationLock(); // ADR-514 Φ6d — ακύρωση τυχόν ενεργού pad place+rotate
    foundationPreviewStore.reset();
    sceneSnapTargetsStore.reset(); // ADR-514 Φ6c — καθάρισε τους face-snap στόχους
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    clearPlacementRotationLock(); // ESC κατά το awaitingRotation → επιστροφή σε awaitingPosition
    setState((prev) => {
      const phase = prev.phase === 'idle' ? 'idle' : activePhaseFor(prev.kind, prev.placementMode);
      syncPreview(prev.kind, prev.placementMode, phase, null, prev.overrides, prev.anchor);
      return { ...INITIAL_STATE, kind: prev.kind, placementMode: prev.placementMode, anchor: prev.anchor, overrides: prev.overrides, phase };
    });
  }, [syncPreview]);

  const setParamOverrides = useCallback((overrides: FoundationParamOverrides) => {
    setState((prev) => {
      const newOverrides = { ...prev.overrides, ...overrides };
      // ADR-514 Φ6c — live pad ghost follows overrides (διάσταση/πάχος)· line kinds αμετάβλητα (ΙΔΙΟ SSoT).
      if (prev.phase !== 'idle' && prev.placementMode === 'freehand') {
        syncPreview(prev.kind, prev.placementMode, prev.phase, prev.startPoint, newOverrides, prev.anchor);
      }
      return { ...prev, overrides: newOverrides };
    });
  }, [syncPreview]);

  // ── commit: pad (ADR-514 Φ6d place+rotate — 2ο κλικ ορίζει τη γωνία) ───────
  // `position`/`anchor`/`rotationDeg` έρχονται από το κλειδωμένο 1ο κλικ + τη γωνία του 2ου (mirror
  // `commitColumnAt`). Validator hardError → FSM μένει στη φάση ώστε ο χρήστης να διορθώσει.
  const commitPadAt = useCallback(
    (s: FoundationToolState, position: Readonly<Point2D>, anchor: FoundationAnchor, rotationDeg: number): boolean => {
      const ffl = resolveActiveFoundationLevelElevationMm();
      const overridesWithKind: FoundationParamOverrides = {
        ...s.overrides,
        kind: s.kind,
        anchor,
        rotation: rotationDeg,
        ...(ffl != null ? { foundationLevelElevationMm: ffl } : {}),
      };
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultFoundationParams(position, s.kind, overridesWithKind, sceneUnits);
      const result = buildFoundationEntity(params, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onFoundationCreated?.(result.entity);
      setState({ ...INITIAL_STATE, kind: s.kind, placementMode: s.placementMode, anchor: s.anchor, overrides: s.overrides, phase: 'awaitingPosition' });
      return true;
    },
    [currentLevelId, onFoundationCreated],
  );

  // ── commit: line two-click (Slice 2 — strip / tie-beam) ───────────────────
  const commitTwoClickFromState = useCallback(
    (s: FoundationToolState, endPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null) return false;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const ffl = resolveActiveFoundationLevelElevationMm();
      const overrides = ffl != null ? { ...s.overrides, foundationLevelElevationMm: ffl } : s.overrides;
      const result = completeFoundationFromTwoClicks(s.startPoint, endPoint, currentLevelId, s.kind, overrides, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onFoundationCreated?.(result.entity);
      // Sync store so next mousemove shows cursor dot, not stale ghost.
      foundationPreviewStore.set({ startPoint: null, endPoint: null, kind: s.kind, overrides: s.overrides });
      setState({ ...INITIAL_STATE, kind: s.kind, placementMode: s.placementMode, anchor: s.anchor, overrides: s.overrides, phase: 'awaitingStart' });
      return true;
    },
    [currentLevelId, onFoundationCreated],
  );

  // ── commit: from-wall (Slice 2 Phase 2b — 1-click pick) ───────────────────
  const commitFromWall = useCallback(
    (s: FoundationToolState, point: Readonly<Point2D>): boolean => {
      const entities = getSceneEntitiesRef.current?.() ?? [];
      const tol = TOLERANCE_CONFIG.HIT_TEST_FALLBACK;
      const wall = pickWallEntityAt(point, entities, tol);
      if (!wall) {
        setState({ ...s, error: 'tools.foundation.errorNoWall' });
        return false;
      }
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const ffl = resolveActiveFoundationLevelElevationMm();
      const overrides = ffl != null ? { ...s.overrides, foundationLevelElevationMm: ffl } : s.overrides;
      const result = buildStripFromWall(wall as WallEntity, overrides, currentLevelId, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onFoundationCreated?.(result.entity);
      // Continuous: stay in awaitingStart for the next wall pick.
      setState({ ...s, phase: 'awaitingStart', startPoint: null, error: null });
      return true;
    },
    [currentLevelId, onFoundationCreated],
  );

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      // «Πεδιλοδοκός από τοίχο» — single-click pick, independent of the FSM kind.
      if (s.placementMode === 'from-wall') {
        return commitFromWall(s, point);
      }

      // pad — ADR-514 Φ6d **place+rotate 2-click** (mirror κολώνας, «μέχρι και την περιστροφή»):
      if (!isLineKind(s.kind)) {
        const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
        // 2ο κλικ (awaitingRotation) → γωνία = κλειδωμένη θέση → click → commit.
        if (s.phase === 'awaitingRotation') {
          const rot = getPlacementRotationLock();
          clearPlacementRotationLock();
          if (!rot) {
            setState({ ...s, phase: 'awaitingPosition' });
            return false;
          }
          const rotationDeg = resolveColumnRotationDeg(rot.origin, point, worldPerPixel(getImmediateTransform().scale));
          return commitPadAt(s, rot.origin, rot.anchor, rotationDeg);
        }
        if (s.phase !== 'awaitingPosition') return false;
        // 1ο κλικ — face-snap ΜΕΣΑ από τον ΕΝΑ εγκέφαλο (flush σε παρειά/άξονα + polar/rect magnet, ΙΔΙΑ
        // opts με το preview). Ο `point` έρχεται ήδη OSNAP-snapped → ΧΩΡΙΣ findSnapPoint (ADR-514 §2).
        // ΚΛΕΙΔΩΣΕ θέση + auto λαβή → awaitingRotation (2ο κλικ ορίζει τη γωνία).
        const padWidthMm = typeof s.overrides.width === 'number' ? s.overrides.width : DEFAULT_PAD_WIDTH_MM;
        const padLengthMm = typeof s.overrides.length === 'number' ? s.overrides.length : DEFAULT_PAD_LENGTH_MM;
        const polarOpts = buildPlacementPolarSnapOptions(padWidthMm, padLengthMm, sceneUnits);
        const snap = resolveBimCursorSnap({ toolKind: 'foundation-pad', cursor: point, targets: sceneSnapTargetsStore.get(), sceneUnits, columnOpts: polarOpts });
        const faceSnap = snap.kind === 'column-placement' ? snap.placement : null;
        const position = faceSnap ? faceSnap.position : snap.point;
        const anchor: FoundationAnchor = faceSnap?.anchor ?? s.anchor;
        setPlacementRotationLock(position, anchor);
        setState({ ...s, phase: 'awaitingRotation', error: null });
        return false;
      }

      // strip / tie-beam — 2-click chain.
      if (s.phase === 'awaitingStart') {
        const startPoint = { x: point.x, y: point.y };
        // Sync before setState so next mousemove reads correct startPoint immediately.
        foundationPreviewStore.set({ startPoint, endPoint: null, kind: s.kind, overrides: s.overrides });
        setState({ ...s, phase: 'awaitingEnd', startPoint, error: null });
        return true;
      }
      if (s.phase === 'awaitingEnd' && s.startPoint) {
        return commitTwoClickFromState(s, point);
      }
      return false;
    },
    [commitPadAt, commitTwoClickFromState, commitFromWall],
  );

  // ── status text (i18n keys returned για caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase === 'idle') return '';
    if (s.placementMode === 'from-wall') return 'tools.foundation.statusPickWall';
    if (!isLineKind(s.kind)) {
      return s.phase === 'awaitingRotation' ? 'tools.foundation.statusRotation' : 'tools.foundation.statusPosition';
    }
    return s.phase === 'awaitingEnd' ? 'tools.foundation.statusEnd' : 'tools.foundation.statusStart';
  }, []);

  // ── publish handle to ribbon bridge store (single writer) ────────────────
  useEffect(() => {
    const isActive = state.phase !== 'idle';
    foundationToolBridgeStore.set({
      isActive,
      kind: state.kind,
      anchor: state.anchor,
      overrides: state.overrides,
      setKind,
      setAnchor,
      setParamOverrides,
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
    });
    return () => {
      if (foundationToolBridgeStore.get()?.setKind === setKind) {
        foundationToolBridgeStore.set(null);
      }
    };
  }, [state, setKind, setAnchor, setParamOverrides]);

  // ── Tab cycles anchor (pad only — mirror useColumnTool) ──────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const direction: 1 | -1 = e.shiftKey ? -1 : 1;
      setState((prev) => {
        const idx = FOUNDATION_ANCHOR_CYCLE_ORDER.indexOf(prev.anchor);
        const len = FOUNDATION_ANCHOR_CYCLE_ORDER.length;
        const nextIdx = (idx + direction + len) % len;
        const anchor = FOUNDATION_ANCHOR_CYCLE_ORDER[nextIdx];
        syncPreview(prev.kind, prev.placementMode, prev.phase, prev.startPoint, prev.overrides, anchor); // ADR-514 Φ6c
        return { ...prev, anchor };
      });
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [syncPreview]);

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
    isActive: state.phase !== 'idle',
    isAwaitingPosition: state.phase === 'awaitingPosition',
    isAwaitingStart: state.phase === 'awaitingStart',
    isAwaitingEnd: state.phase === 'awaitingEnd',
  };
}
