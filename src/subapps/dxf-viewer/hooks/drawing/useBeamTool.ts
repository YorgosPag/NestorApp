/**
 * ADR-363 Phase 5 — Beam Tool React Hook Orchestrator.
 *
 * State machine:
 *   - Straight / Cantilever (2-click chain):
 *       `idle → awaitingStart → awaitingEnd → committed → awaitingStart`
 *   - Curved (3-click chain):
 *       `idle → awaitingStart → awaitingEnd → awaitingCurveControl → committed → awaitingStart`
 *
 * 2-click flow mirrors AutoCAD `LINE` chain; 3-click curved flow mirrors
 * `ARC` start/end/bulge convention. ESC reset. Continuous chain.
 *
 * SSoT alignment:
 *   - Entity build via `buildBeamEntity` / `buildDefaultBeamParams`
 *     (`hooks/drawing/beam-completion.ts`). ZERO duplicate construction.
 *   - Pattern alignment με `useWallTool` (closest analogue — straight + curved
 *     FSM). No polyline kind (Phase 5 scope).
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import {
  DEFAULT_BEAM_WIDTH_MM,
  type BeamEntity,
  type BeamKind,
} from '../../bim/types/beam-types';
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
import { resolveMemberEndpointSnap, resolveMemberEndpointWithFineStep } from '../../bim/framing/member-endpoint-snap';
import { isBeamCollinearOverlap } from '../../bim/beams/beam-beam-face-snap';
import {
  buildAnchoredBeamParams,
  buildBeamEntity,
  buildDefaultBeamParams,
  type BeamParamOverrides,
} from './beam-completion';
import { sceneSnapTargetsStore, selectGhostMembers } from '../../bim/framing/scene-snap-targets';
import type { Point3D } from '../../bim/types/bim-base';
import type { BeamParams } from '../../bim/types/beam-types';
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import type { SceneUnits } from '../../utils/scene-units';
import { isWallEntity, type Entity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import { pickWallEntityAt, buildBeamFromWall } from '../../bim/beams/beam-from-wall';
import { beamToolBridgeStore } from '../../bim/beams/beam-tool-bridge-store';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { EventBus } from '../../systems/events/EventBus';
import { useSceneSnapTargetSync } from './use-scene-snap-target-sync';
import { shouldWarnBeamOnFoundation } from '../../systems/levels/storey-creation-defaults';

// ─── State machine types ─────────────────────────────────────────────────────

export type BeamToolPhase =
  | 'idle'
  | 'awaitingStart'
  | 'awaitingEnd'
  | 'awaitingCurveControl';

/**
 * Placement mode (ADR-363):
 *   - 'freehand'  — κλασικό 2-click straight/cantilever ή 3-click curved.
 *   - 'from-wall' — «Δοκάρι από τοίχο»: 1 κλικ πάνω σε τοίχο → δοκάρι στον άξονά του.
 */
export type BeamPlacementMode = 'freehand' | 'from-wall';

export interface BeamToolState {
  readonly phase: BeamToolPhase;
  readonly kind: BeamKind;
  readonly placementMode: BeamPlacementMode;
  readonly startPoint: Point2D | null;
  readonly endPoint: Point2D | null;
  readonly overrides: BeamParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: BeamToolState = {
  phase: 'idle',
  kind: 'straight',
  placementMode: 'freehand',
  startPoint: null,
  endPoint: null,
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseBeamToolOptions {
  /** Callback fired μετά από επιτυχές build + commit. */
  readonly onBeamCreated?: (entity: BeamEntity) => void;
  /** Layer ID στο οποίο γράφεται το νέο beam. */
  readonly currentLevelId?: string;
  /** Returns the active scene's coordinate units for threshold scaling. */
  readonly getSceneUnits?: () => SceneUnits;
  /**
   * Returns the active scene entities — required ONLY for placementMode
   * 'from-wall' (hit-test the picked WallEntity). Mirrors `useWallTool`.
   */
  readonly getSceneEntities?: () => readonly Entity[];
}

export interface UseBeamToolResult {
  readonly state: BeamToolState;
  activate(): void;
  /** Switch active kind (3 kinds). Resets the state machine, preserves overrides. */
  setKind(kind: BeamKind): void;
  /** Switch placement mode (freehand ⇄ from-wall). Resets the FSM, preserves overrides. */
  setPlacementMode(mode: BeamPlacementMode): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click commit-άρισε νέο beam ή προήγαγε το FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Dynamic Input / ribbon overrides (width / depth / elevation / supportType). */
  setParamOverrides(overrides: BeamParamOverrides): void;
  /** Status text για status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingStart: boolean;
  readonly isAwaitingEnd: boolean;
  readonly isAwaitingCurveControl: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useBeamTool(options: UseBeamToolOptions = {}): UseBeamToolResult {
  const { onBeamCreated, currentLevelId = '0', getSceneUnits, getSceneEntities } = options;

  const [state, setState] = useState<BeamToolState>(INITIAL_STATE);
  const stateRef = useRef<BeamToolState>(state);
  stateRef.current = state;

  // Stable getter ref for the scene entities. `options.getSceneEntities` is an inline
  // arrow (new identity every render), so reading it through a ref keeps the callbacks
  // that depend on it (`syncSceneTargetsToStore` → `activate`) referentially STABLE. Critical:
  // `activate` is passed to `useToolLifecycle`'s effect deps — an unstable `activate`
  // re-runs the effect every render → `activate()` → setState → infinite render loop.
  const getSceneEntitiesRef = useRef(getSceneEntities);
  getSceneEntitiesRef.current = getSceneEntities;

  // Unmount cleanup — reset store when hook teardown (tool panel unmount).
  useEffect(() => {
    return () => beamPreviewStore.reset();
  }, []);

  // ADR-398 §3.10 — refresh face-snap στόχων στο ΚΟΙΝΟ scene store: on entity-created (rAF, ώστε
  // ένα μόλις-σχεδιασμένο δοκάρι να είναι ορατό στο ghost του επόμενου ΠΡΙΝ το 1ο κλικ — αλλιώς
  // «κόκκινο μόνο μετά το κλικ») + on activate (το `syncSceneTargetsToStore` = το hook return).
  const syncSceneTargetsToStore = useSceneSnapTargetSync(() => getSceneEntitiesRef.current?.() ?? []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  // All state transitions sync beamPreviewStore immediately (before setState)
  // so updatePreview reads the correct data on the very next mousemove, without
  // waiting for React's passive-effect flush (which fires after paint).

  const activate = useCallback(() => {
    const prev = stateRef.current;
    syncSceneTargetsToStore();
    beamPreviewStore.set({ startPoint: null, endPoint: null, kind: prev.kind, overrides: prev.overrides });
    setState({ ...INITIAL_STATE, kind: prev.kind, placementMode: prev.placementMode, overrides: prev.overrides, phase: 'awaitingStart' });
    // ADR-461 — soft warning (once per activation): ένα κανονικό δοκάρι στη στάθμη
    // θεμελίωσης είναι μάλλον πεδιλοδοκός/συνδετήρια δοκός. Revit-style — επιτρέπεται,
    // απλώς προτείνει· δεν μπλοκάρει (mirror του useFoundationTool.activate).
    if (shouldWarnBeamOnFoundation()) {
      EventBus.emit('bim:beam-on-foundation-storey', {});
    }
  }, [syncSceneTargetsToStore]);

  const setKind = useCallback((kind: BeamKind) => {
    const prev = stateRef.current;
    const newPhase = prev.phase === 'idle' ? 'idle' : 'awaitingStart';
    if (newPhase === 'idle') {
      beamPreviewStore.reset();
    } else {
      beamPreviewStore.set({ startPoint: null, endPoint: null, kind, overrides: prev.overrides });
    }
    setState({ ...INITIAL_STATE, kind, placementMode: prev.placementMode, overrides: prev.overrides, phase: newPhase });
  }, []);

  // ADR-363 «Δοκάρι από τοίχο» — switch placement mode (freehand ⇄ from-wall).
  // Mirrors useWallTool.setPlacementMode: resets the FSM, preserves kind/overrides.
  const setPlacementMode = useCallback((mode: BeamPlacementMode) => {
    const prev = stateRef.current;
    if (prev.placementMode === mode) return;
    const newPhase = prev.phase === 'idle' ? 'idle' : 'awaitingStart';
    if (newPhase === 'idle') {
      beamPreviewStore.reset();
    } else {
      beamPreviewStore.set({ startPoint: null, endPoint: null, kind: prev.kind, overrides: prev.overrides });
    }
    setState({ ...INITIAL_STATE, kind: prev.kind, placementMode: mode, overrides: prev.overrides, phase: newPhase });
  }, []);

  const deactivate = useCallback(() => {
    beamPreviewStore.reset();
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    const prev = stateRef.current;
    const newPhase = prev.phase === 'idle' ? 'idle' : 'awaitingStart';
    if (newPhase === 'idle') {
      beamPreviewStore.reset();
    } else {
      beamPreviewStore.set({ startPoint: null, endPoint: null, kind: prev.kind, overrides: prev.overrides });
    }
    setState({ ...INITIAL_STATE, kind: prev.kind, placementMode: prev.placementMode, overrides: prev.overrides, phase: newPhase });
  }, []);

  const setParamOverrides = useCallback((overrides: BeamParamOverrides) => {
    const prev = stateRef.current;
    const newOverrides = { ...prev.overrides, ...overrides };
    if (prev.phase !== 'idle') {
      const current = beamPreviewStore.get();
      beamPreviewStore.set({ ...current, overrides: newOverrides });
    }
    setState({ ...prev, overrides: newOverrides });
  }, []);

  // ── commit helpers (straight/cantilever 2-click, curved 3-click) ─────────

  const commitTwoClickFromState = useCallback(
    (s: BeamToolState, endPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      // ADR-363 §5.7 — edge-anchored placement (location line = παρειά, Revit-style)
      // + side-face auto-flush. Τα column footprints διαβάζονται από το preview store
      // (συγχρονισμένα στο 1ο κλικ μέσω `syncSceneTargetsToStore`) ώστε το justification να
      // είναι ΤΑΥΤΟΣΗΜΟ με το preview WYSIWYG ghost (preview === commit).
      // Straight/cantilever μόνο· curved κρατά centerline (commitCurvedFromState).
      // ADR-398 §Smart beam ghost — αν το start κλειδώθηκε από face-snap (centerline),
      // commit centerline (ΟΧΙ location-line auto-flush) ώστε commit === preview.
      const preview = beamPreviewStore.get();
      // ADR-398 §3.10 — face-snap στόχοι από το ΚΟΙΝΟ scene store (preview === commit)· δοκάρι = beam+slab.
      const targets = sceneSnapTargetsStore.get();
      // ADR-398 §3.6 — ΑΠΑΓΟΡΕΥΣΗ τοποθέτησης δοκαριού ομοαξονικά/πάνω σε υφιστάμενο
      // (duplication — «extend instead»). Το κόκκινο awaitingEnd ghost ήδη το δείχνει·
      // εδώ μπλοκάρεται το commit (silent — ο χρήστης σύρει αλλού). Κάθετο Τ-framing OK.
      if (isBeamCollinearOverlap(s.startPoint, endPoint, selectGhostMembers(targets, ['beam', 'slab']))) {
        return false;
      }
      const params = preview.startAnchored
        ? buildDefaultBeamParams(s.startPoint, endPoint, s.kind, s.overrides, sceneUnits)
        : buildAnchoredBeamParams(s.startPoint, endPoint, s.kind, s.overrides, sceneUnits, targets.footprints);
      const result = buildBeamEntity(params, currentLevelId, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onBeamCreated?.(result.entity);
      // Sync store immediately so next mousemove sees null startPoint (cursor dot),
      // not the stale committed startPoint that would show a ghost footprint.
      beamPreviewStore.set({ startPoint: null, endPoint: null, kind: s.kind, overrides: s.overrides });
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        placementMode: s.placementMode,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, getSceneUnits, onBeamCreated],
  );

  const commitCurvedFromState = useCallback(
    (s: BeamToolState, controlPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null || s.endPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const base = buildDefaultBeamParams(s.startPoint, s.endPoint, 'curved', s.overrides, sceneUnits);
      const curveControl: Point3D = { x: controlPoint.x, y: controlPoint.y, z: 0 };
      const params: BeamParams = { ...base, kind: 'curved', curveControl };
      const result = buildBeamEntity(params, currentLevelId, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onBeamCreated?.(result.entity);
      // Sync store immediately so next mousemove shows cursor dot, not stale ghost.
      beamPreviewStore.set({ startPoint: null, endPoint: null, kind: s.kind, overrides: s.overrides });
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        placementMode: s.placementMode,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, getSceneUnits, onBeamCreated],
  );

  // ── from-wall commit core (shared by 2D point-pick + 3D mesh-pick) ────────
  // Builds ONE beam on the wall's axis via the SSoT `buildBeamFromWall` and
  // appends it through `onBeamCreated`. The wall is resolved upstream (2D: by
  // point hit-test; 3D: by raycast id), so this core never re-picks — ZERO
  // duplication between the two entry points.
  const commitForWall = useCallback(
    (s: BeamToolState, wall: WallEntity): boolean => {
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const result = buildBeamFromWall(wall, s.overrides, currentLevelId, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onBeamCreated?.(result.entity);
      // Continuous: stay in awaitingStart for the next wall pick.
      setState({ ...s, phase: 'awaitingStart', startPoint: null, endPoint: null, error: null });
      return true;
    },
    [currentLevelId, getSceneUnits, onBeamCreated],
  );

  // ── from-wall commit (2D: 1-click pick a wall → beam on its axis) ─────────
  const commitFromWall = useCallback(
    (s: BeamToolState, point: Readonly<Point2D>): boolean => {
      const entities = getSceneEntities?.() ?? [];
      // Tolerance mirrors the click-time snap tolerance used elsewhere (world units).
      const tol = TOLERANCE_CONFIG.HIT_TEST_FALLBACK;
      const wall = pickWallEntityAt(point, entities, tol);
      if (!wall) {
        setState({ ...s, error: 'tools.beam.errorNoWall' });
        return false;
      }
      return commitForWall(s, wall);
    },
    [getSceneEntities, commitForWall],
  );

  // ADR-398 §Smart beam ghost — το 1ο κλικ κλειδώνει το START. Αν ο κέρσορας
  // κούμπωνε σε παρειά κολόνας (face-snap), κλειδώνουμε στο προτεινόμενο centerline
  // (ΟΧΙ στον raw cursor) + σημαία `anchored` ώστε το 2ο κλικ να τραβά centerline
  // (χωρίς location-line auto-flush). Καλεί τον ΙΔΙΟ resolver με το preview (το store
  // έχει ήδη συγχρονισμένες κολόνες) → preview === commit.
  const resolveStartAnchor = useCallback(
    (point: Readonly<Point2D>): { start: Point2D; anchored: boolean } => {
      const widthMm = stateRef.current.overrides.width ?? DEFAULT_BEAM_WIDTH_MM;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      // ADR-398 §3.10 — δοκάρι = beam+slab μέλη από το ΚΟΙΝΟ scene store (preview === commit).
      const targets = sceneSnapTargetsStore.get();
      // ADR-514 Φ3 — «Ένας Εγκέφαλος Έλξης»: ΕΝΑ unified entry (toolKind:'beam', kinds beam+slab).
      // ⚠️ ADR-514 §2 — ο `point` έρχεται ήδη OSNAP-snapped από το click pipeline → ΧΩΡΙΣ findSnapPoint
      // (anti double-snap). ΙΔΙΟ entry με το preview (`makeBeamGhostBeforeClick`) → preview ≡ commit.
      const snap = resolveBimCursorSnap({ toolKind: 'beam', cursor: point, targets, sceneUnits, memberWidthMm: widthMm, memberKinds: ['beam', 'slab'] });
      return snap.kind === 'member-placement'
        ? { start: snap.placement.start, anchored: true }
        : { start: { x: point.x, y: point.y }, anchored: false };
    },
    [getSceneUnits],
  );

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      // ADR-363 «Δοκάρι από τοίχο» — single-click pick, independent of the FSM kind.
      if (s.placementMode === 'from-wall') {
        return commitFromWall(s, point);
      }

      if (s.kind === 'curved') {
        if (s.phase === 'awaitingStart') {
          syncSceneTargetsToStore();
          // ADR-398 §Smart beam ghost — face-snap το start (αν κοντά σε κολόνα).
          const { start: startPoint, anchored } = resolveStartAnchor(point);
          // Sync before setState: next mousemove reads correct startPoint immediately.
          beamPreviewStore.set({ startPoint, endPoint: null, kind: s.kind, overrides: s.overrides, startAnchored: anchored });
          setState({ ...s, phase: 'awaitingEnd', startPoint, endPoint: null, error: null });
          return true;
        }
        if (s.phase === 'awaitingEnd') {
          const endPoint = { x: point.x, y: point.y };
          beamPreviewStore.set({ startPoint: s.startPoint, endPoint, kind: s.kind, overrides: s.overrides });
          setState({ ...s, phase: 'awaitingCurveControl', endPoint, error: null });
          return true;
        }
        if (s.phase === 'awaitingCurveControl') {
          return commitCurvedFromState(s, point);
        }
        return false;
      }

      // Straight / cantilever — 2-click chain
      if (s.phase === 'awaitingStart') {
        syncSceneTargetsToStore();
        // ADR-398 §Smart beam ghost — face-snap το start (αν κοντά σε κολόνα).
        const { start: startPoint, anchored } = resolveStartAnchor(point);
        // Sync before setState: next mousemove reads correct startPoint immediately,
        // no useEffect-delay window where stale null would produce a cursor-dot flash.
        beamPreviewStore.set({ startPoint, endPoint: null, kind: s.kind, overrides: s.overrides, startAnchored: anchored });
        setState({ ...s, phase: 'awaitingEnd', startPoint, error: null });
        return true;
      }
      if (s.phase === 'awaitingEnd' && s.startPoint) {
        // ADR-508 — endpoint face-snap (ΙΔΙΟΣ dispatcher με το start & ΙΔΙΟ SSoT με τον τοίχο
        // `resolveMemberEndpointSnap`): το ΑΚΡΟ κουμπώνει flush σε παρειά μέλους/κολώνας + Shift 1cm
        // βήμα στο ελεύθερο (face-snap νικά). Το δοκάρι δεν έχει length/angle lock (wall-only ADR-513)
        // → χωρίς lock branch. ΙΔΙΟ entry/targets με το preview (`generateBeamPreview`) → preview ≡ commit.
        const sceneUnits = getSceneUnits?.() ?? 'mm';
        const targets = sceneSnapTargetsStore.get();
        const widthMm = s.overrides.width ?? DEFAULT_BEAM_WIDTH_MM;
        const endSnap = resolveMemberEndpointSnap(point, targets.footprints, selectGhostMembers(targets, ['beam', 'slab']), widthMm, sceneUnits);
        const endPoint = resolveMemberEndpointWithFineStep(endSnap, s.startPoint);
        return commitTwoClickFromState(s, endPoint);
      }
      return false;
    },
    [commitTwoClickFromState, commitCurvedFromState, commitFromWall, syncSceneTargetsToStore, resolveStartAnchor, getSceneUnits],
  );

  // ── ADR-363 «Δοκάρι από τοίχο» — 3D pick bridge ───────────────────────────
  // The 3D viewport (`useBim3DBeamFromWallPick`) raycasts a wall mesh and emits
  // its id; resolve the WallEntity from the live scene and run the SAME from-wall
  // commit core (zero duplication, full append + auto-attach path, ADR-401 D).
  // Refs keep the listener stable while always calling the latest core + getter.
  // Mirror of the column `bim:place-column-3d` bridge.
  const commitForWallRef = useRef(commitForWall);
  commitForWallRef.current = commitForWall;
  // `getSceneEntitiesRef` is declared once near the top (stable getter for the scene).
  useEffect(() => {
    return EventBus.on('bim:beam-from-wall-picked-3d', ({ wallId }) => {
      const wall = getSceneEntitiesRef.current?.().find(
        (e): e is WallEntity => isWallEntity(e) && e.id === wallId,
      );
      if (wall) commitForWallRef.current(stateRef.current, wall);
    });
  }, []);

  // Publish overrides + scene units so the 3D ghost previews the EXACT beam the
  // commit will build (WYSIWYG). Single writer → single reader (BeamFromWallGhost).
  useEffect(() => {
    beamToolBridgeStore.set({
      overrides: state.overrides,
      getSceneUnits: () => getSceneUnits?.() ?? 'mm',
    });
    return () => beamToolBridgeStore.set(null);
  }, [state.overrides, getSceneUnits]);

  // ── status text (i18n keys returned για caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.placementMode === 'from-wall') {
      return s.phase === 'idle' ? '' : 'tools.beam.statusPickWall';
    }
    switch (s.phase) {
      case 'awaitingStart':
        return 'tools.beam.statusStart';
      case 'awaitingEnd':
        return s.kind === 'curved' ? 'tools.beam.statusCurveEnd' : 'tools.beam.statusEnd';
      case 'awaitingCurveControl':
        return 'tools.beam.statusCurveControl';
      default:
        return '';
    }
  }, []);

  // ── ESC handled by EscapeCommandBus (ADR-364 §4.1 BIM migration 2026-05-19)
  // DRAW_TOOL slot in useKeyboardShortcuts.DRAWING_TOOLS_WITH_CANCEL routes ESC
  // through onDrawingCancel → handleToolCompletion(activeTool, true) → tool
  // deactivates via useToolLifecycle. AutoCAD/Revit parity.

  return {
    state,
    activate,
    setKind,
    setPlacementMode,
    deactivate,
    onCanvasClick,
    reset,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingStart: state.phase === 'awaitingStart',
    isAwaitingEnd: state.phase === 'awaitingEnd',
    isAwaitingCurveControl: state.phase === 'awaitingCurveControl',
  };
}
