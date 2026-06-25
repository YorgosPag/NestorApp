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
 *   - State machine types + `INITIAL_STATE` → `beam-tool-state.ts`.
 *   - All build+commit paths → `use-beam-commit.ts` (`buildBeamEntity` /
 *     `buildDefaultBeamParams`, ZERO duplicate construction). This orchestrator
 *     owns only the React FSM state and the click pipeline.
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
import { resolveMemberEndpointSnap, resolveMemberEndpointWithFineStep } from '../../bim/framing/member-endpoint-snap';
import type { BeamParamOverrides } from './beam-completion';
import { sceneSnapTargetsStore, selectGhostMembers } from '../../bim/framing/scene-snap-targets';
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import type { SceneUnits } from '../../utils/scene-units';
import { isWallEntity, type Entity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import { beamToolBridgeStore } from '../../bim/beams/beam-tool-bridge-store';
import { EventBus } from '../../systems/events/EventBus';
import { useSceneSnapTargetSync } from './use-scene-snap-target-sync';
import { shouldWarnBeamOnFoundation } from '../../systems/levels/storey-creation-defaults';
import {
  INITIAL_STATE,
  type BeamPlacementMode,
  type BeamToolPhase,
  type BeamToolState,
} from './beam-tool-state';
import { useBeamCommit } from './use-beam-commit';

export type { BeamToolPhase, BeamPlacementMode, BeamToolState } from './beam-tool-state';

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
  /** `shiftKey` (ADR-528 §whole-line): Shift+κλικ → όλα τα φατνώματα της ευθείας με ένα κλικ. */
  onCanvasClick(point: Readonly<Point2D>, shiftKey?: boolean): boolean;
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

  // ── commit handlers (SSoT, N.7.1 split → use-beam-commit.ts) ──────────────
  const {
    commitTwoClickFromState,
    commitCurvedFromState,
    commitForWall,
    commitFromWall,
    resolveStartAnchor,
    commitSpanFromState,
    commitSpanChain,
  } = useBeamCommit({ stateRef, setState, currentLevelId, getSceneUnits, getSceneEntities, onBeamCreated });

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

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>, shiftKey: boolean = false): boolean => {
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
        // ADR-528 §whole-line — Shift+κλικ στη νοητή ευθεία συγγραμμικών στηρίξεων → όλα τα φατνώματα
        // (N δοκάρια) με ένα κλικ. Προηγείται του per-bay· αν δεν υπάρχει ευθεία → πέφτει παρακάτω.
        if (shiftKey && commitSpanChain(s, point)) {
          return true;
        }
        // ADR-398 §Smart beam ghost — face-snap το start (αν κοντά σε κολόνα).
        const { start: startPoint, anchored, spanEnd, spanJustification } = resolveStartAnchor(point);
        // ADR-528 — auto-span per-bay: ο cursor στη νοητή ευθεία δύο διαδοχικών μελών → ΕΝΑ κλικ γεφυρώνει
        // ολόκληρο το δοκάρι του φατνώματος (start→end flush στις παρειές), παρακάμπτοντας το 2-click.
        // ADR-529 — περνάμε το Location-Line justification ώστε το commit να το αποθηκεύσει (associative flush).
        if (spanEnd) {
          return commitSpanFromState(s, startPoint, spanEnd, spanJustification);
        }
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
        const endSnap = resolveMemberEndpointSnap(point, targets.footprints, selectGhostMembers(targets, ['wall', 'beam', 'slab', 'line']), widthMm, sceneUnits);
        const endPoint = resolveMemberEndpointWithFineStep(endSnap, s.startPoint);
        return commitTwoClickFromState(s, endPoint);
      }
      return false;
    },
    [commitTwoClickFromState, commitCurvedFromState, commitFromWall, commitSpanFromState, commitSpanChain, syncSceneTargetsToStore, resolveStartAnchor, getSceneUnits],
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
