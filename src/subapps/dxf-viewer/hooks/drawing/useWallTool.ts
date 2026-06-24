/**
 * ADR-363 Phase 1B/1C — Wall Tool React Hook Orchestrator.
 *
 * State machine:
 *   - Straight kind (default, Phase 1B):
 *       `idle → awaitingStart → awaitingEnd → committed → awaitingStart`
 *   - Curved kind (Phase 1C):
 *       `idle → awaitingStart → awaitingEnd → awaitingCurveControl → committed → awaitingStart`
 *   - Polyline kind (Phase 1C):
 *       `idle → awaitingStart → awaitingNextVertex (loop) → committed (Enter / dbl-click)`
 *
 * The 2-click straight chain matches AutoCAD/Revit/ArchiCAD conventions; the
 * 3-click curve flow mirrors AutoCAD `ARC` start/end/control; the polyline
 * flow mirrors AutoCAD `PLINE` (Enter to finish, ESC to cancel).
 *
 * SSoT alignment:
 *   - Entity build via `buildWallEntity` / `buildDefaultWallParams`
 *     (`hooks/drawing/wall-completion.ts`). ZERO duplicate construction here.
 *   - Geometry math via `computeWallGeometry` (called inside `buildWallEntity`).
 *   - Live preview via `wallPreviewStore` (`bim/walls/wall-preview-store.ts`)
 *     — single-writer pattern mirroring `stairPreviewStore` (ADR-358 Phase 8).
 *   - Pattern alignment with `useStairTool.ts` (ref-backed setState bypass +
 *     activate/deactivate/reset + status text + Enter listener + Dynamic Input
 *     `commit-wall` event listener).
 *   - ADR-040 micro-leaf compliance: this hook owns its own React state and is
 *     consumed by `useSpecialTools`. No `useSyncExternalStore` against
 *     high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.9 §6 Phase 1B §6 Phase 1C
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
// ADR-363 Phase 1J — «Τοίχος πάνω σε οντότητα 2Δ» geometry bridge.
import { pickWallSourceFromEntity } from '../../bim/walls/wall-from-entity';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { radToDeg } from '../../rendering/entities/shared/geometry-utils';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { resolveWallThicknessMm } from './wall-completion';
// ADR-508 unified linear-member framing — smart ghost-before-click + 2-κλικ (mirror δοκαριού).
// ADR-398 §3.10 — face-snap στόχοι από το ΚΟΙΝΟ scene store (κοινό με κολώνα/δοκάρι).
import { sceneSnapTargetsStore, selectGhostMembers } from '../../bim/framing/scene-snap-targets';
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
import {
  useWallToolDynamicInputListener,
  useWallToolEnterListener,
  useWallToolRegionBoxSelectListener,
  useWallToolPerimeterBoxSelectListener,
} from './use-wall-tool-event-listeners';
import { useSceneSnapTargetSync } from './use-scene-snap-target-sync';
// ADR-363 — state-machine types + commit builders extracted for N.7.1 (≤500 lines).
import {
  INITIAL_STATE,
  type WallToolState,
  type UseWallToolOptions,
  type UseWallToolResult,
} from './wall-tool-types';
import { useWallCommit } from './use-wall-commit';
// ADR-363 — in-region / perimeter click handlers extracted for N.7.1 (≤500 lines).
import { useWallRegionClicks } from './use-wall-region-clicks';
// ADR-363 — lifecycle + setters + incremental-back ESC handlers extracted for N.7.1.
import { useWallToolLifecycle } from './use-wall-tool-lifecycle';
// ADR-404 Phase 5b — publish drawing-mode handle στο ribbon (κεκλιμένος τοίχος «σχεδίασε κεκλιμένο»).
import { wallToolBridgeStore } from '../../ui/ribbon/hooks/bridge/wall-tool-bridge-store';
// ADR-513 — «Δαχτυλίδι Εντολών»: το locked μήκος/γωνία πρέπει να σέβεται ΚΑΙ το click-commit
// (ίδιος SSoT περιορισμός με το preview στο drawing-hover-handler). No-op όταν δεν υπάρχει lock.
import { applyLengthAngleLock, isLengthAngleLockActive } from '../../systems/dynamic-input/length-angle-lock';
// ADR-508 — endpoint face-snap (point snap, ΙΔΙΟΣ dispatcher με το start → preview ≡ commit).
import { resolveWallEndpointSnap, resolveWallEndpointWithFineStep } from '../../bim/walls/wall-endpoint-snap';

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useWallTool(options: UseWallToolOptions = {}): UseWallToolResult {
  const { onWallCreated, currentLevelId = '0', getSceneUnits, getSceneEntities } = options;

  const [state, setState] = useState<WallToolState>(INITIAL_STATE);
  const stateRef = useRef<WallToolState>(state);
  stateRef.current = state;

  // ── scene snap targets sync (ADR-508 — mirror useBeamTool) ───────────────
  // Stable getter ref: `options.getSceneEntities` is a new arrow each render, so reading
  // through a ref keeps `syncSceneTargetsToStore` (→ `activate`) referentially STABLE
  // (critical: `activate` feeds `useToolLifecycle` deps → avoid setState render loop).
  const getSceneEntitiesRef = useRef(getSceneEntities);
  getSceneEntitiesRef.current = getSceneEntities;

  // ADR-508 / ADR-398 §3.10 — refresh face-snap στόχων στο ΚΟΙΝΟ scene store: on entity-created
  // (rAF) μέσω του SSoT hook + on activate (το `syncSceneTargetsToStore` = το hook return, που
  // περνά στο lifecycle ώστε οι στόχοι να είναι έτοιμοι ΠΡΙΝ το 1ο ghost).
  const syncSceneTargetsToStore = useSceneSnapTargetSync(() => getSceneEntitiesRef.current?.() ?? []);

  // ADR-508 §smart wall ghost — το 1ο κλικ κλειδώνει το START· αν κούμπωνε σε παρειά
  // κολόνας/μέλους (face-snap), κλειδώνουμε στο προτεινόμενο centerline (+anchored) ώστε το
  // 2ο κλικ να τραβά centerline (χωρίς location-line auto-flush). Ίδιος resolver με το ghost.
  const resolveWallStartAnchor = useCallback(
    (point: Readonly<Point2D>): { start: Point2D; anchored: boolean; faceAngle: number | null; hostId: string | null } => {
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const targets = sceneSnapTargetsStore.get();
      const thicknessMm = resolveWallThicknessMm(stateRef.current.overrides);
      // ADR-508 (2026-06-24, Giorgio «να ολισθαίνει ΠΛΗΡΩΣ») — ΧΩΡΙΣ worldPerPixel → **πλήρως συνεχής
      // ολίσθηση** στην παρειά (μηδέν quantize/magnet, ίδιο με την κολώνα `resolveForTarget`). preview ≡
      // commit. ADR-398 §3.10/§3.11 — τοίχος = wall+beam+slab μέλη ΚΑΙ σκέτες ΓΡΑΜΜΕΣ (γραμμές = οδηγοί
      // στοίχισης· ο commit overlap-check στο use-wall-commit τις εξαιρεί, δεν μπλοκάρουν).
      // ADR-514 Φ3 — «Ένας Εγκέφαλος Έλξης»: ΕΝΑ unified entry (toolKind:'wall') αντί για άμεση κλήση
      // του dispatcher. Default member kinds = wall+beam+slab+line (ίδιο με πριν). ⚠️ ADR-514 §2 — ο
      // `point` έρχεται ήδη OSNAP-snapped από το click pipeline → ΧΩΡΙΣ findSnapPoint (anti double-snap).
      // ΙΔΙΟ entry με το preview (`makeWallGhostBeforeClick`) → preview ≡ commit by construction.
      const snap = resolveBimCursorSnap({ toolKind: 'wall', cursor: point, targets, sceneUnits, memberWidthMm: thicknessMm });
      if (snap.kind !== 'member-placement') return { start: { x: point.x, y: point.y }, anchored: false, faceAngle: null, hostId: null };
      const placement = snap.placement;
      // ADR-508 — `end - start` του ghost = κάθετη-στην-παρειά κατεύθυνση (face normal, outward).
      // Την κρατάμε ως baseAngle για το relative-polar του 2ου κλικ. Στο 🔴 collinear-overlap
      // (status 'overlap') το `end - start` είναι ΚΑΤΑ ΜΗΚΟΣ του μέλους (όχι face normal) → null.
      const dx = placement.end.x - placement.start.x;
      const dy = placement.end.y - placement.start.y;
      const faceAngle =
        placement.status !== 'overlap' && Math.hypot(dx, dy) > 1e-9 ? radToDeg(Math.atan2(dy, dx)) : null;
      // ADR-508 §opening-conflict — κράτα τον host reference που ΗΔΗ επέλεξε το snap (μηδέν re-derive).
      return { start: placement.start, anchored: true, faceAngle, hostId: placement.targetId ?? null };
    },
    [getSceneUnits],
  );

  // ── preview store sync (ADR-363 Phase 1C) ────────────────────────────────
  // Mirrors `stairPreviewStore` writer pattern: on every state transition we
  // push the current preview shape (startPoint / curveControl / polyline
  // vertices / overrides) so `useUnifiedDrawing.updatePreview` can read it
  // synchronously without subscribing to wall-tool React state.
  useEffect(() => {
    if (state.phase === 'idle') {
      wallPreviewStore.reset();
      return;
    }
    // ADR-363 Phase 1K / «από περίγραμμα» — region & perimeter picks are surfaced
    // via selection highlight (box-select), not a rubber-band ghost. No preview shape.
    if (state.placementMode === 'in-region' || state.placementMode === 'outer-perimeter') {
      wallPreviewStore.reset();
      return;
    }
    // ADR-363 Phase 1J — on-entity: surface the picked line as a straight ghost
    // (start→end shifted toward the live cursor, reusing the Phase 1F preview
    // generator). Closed sources have no rubber-band ghost (multi-wall).
    if (state.placementMode === 'on-entity') {
      if (state.phase === 'awaitingSide' && state.pickedSource?.kind === 'line') {
        wallPreviewStore.set({
          startPoint: state.pickedSource.start,
          endPoint: state.pickedSource.end,
          curveControl: null,
          polylineVertices: [],
          overrides: state.overrides,
        });
      } else {
        wallPreviewStore.reset();
      }
      return;
    }
    const curveControl =
      state.kind === 'curved' && state.phase === 'awaitingCurveControl' && state.endPoint
        ? null // user has not picked the control point yet — preview generator will use cursor
        : null;
    // ADR-363 Phase 1F — surface endPoint to the preview store only during the
    // straight-kind awaitingAlignment phase. In every other state (including
    // curved awaitingCurveControl) the preview falls back to the legacy
    // "start → cursor" rubber band by leaving endPoint null.
    const endPoint =
      state.kind === 'straight' && state.phase === 'awaitingAlignment' ? state.endPoint : null;
    wallPreviewStore.set({
      startPoint: state.startPoint,
      endPoint,
      curveControl,
      polylineVertices: state.polylineVertices,
      overrides: state.overrides,
      startAnchored: state.startAnchored,
      startFaceAngle: state.startFaceAngle,
      anchoredHostId: state.anchoredHostId,
    });
  }, [state]);

  // Drop preview state on unmount so other tools don't see stale ghosts.
  useEffect(() => {
    return () => {
      wallPreviewStore.reset();
    };
  }, []);

  // ── lifecycle + setters + incremental-back ESC handlers (extracted N.7.1) ──
  const {
    activate,
    setKind,
    setPlacementMode,
    setRegionMethod,
    deactivate,
    reset,
    backToAwaitingEnd,
    setParamOverrides,
  } = useWallToolLifecycle({ stateRef, setState, syncSceneTargetsToStore });

  // ── commit builders (extracted to ./use-wall-commit for N.7.1) ───────────
  const {
    commitStraightFromState,
    commitCurvedFromState,
    commitPolylineFromState,
    commitOnEntity,
    commitInRegionRects,
    commitPerimeterFaces,
  } = useWallCommit({ currentLevelId, onWallCreated, getSceneUnits, getSceneEntities, setState });

  // ── in-region / perimeter click handlers (extracted for N.7.1) ───────────
  const { regionTol, onRegionClick, onPerimeterClick, getRegionPickIds } = useWallRegionClicks({
    stateRef,
    setState,
    getSceneEntities,
    getSceneUnits,
    commitInRegionRects,
    commitPerimeterFaces,
  });

  // ADR-363 Phase 1K Mode C — box-select listener extracted for N.7.1 (≤500 lines).
  useWallToolRegionBoxSelectListener({ stateRef, getSceneEntities, regionTol, commitInRegionRects });
  // ADR-363 «Τοίχος από περίγραμμα» — box-select listener (faces → leg walls).
  useWallToolPerimeterBoxSelectListener({ stateRef, getSceneEntities, regionTol, commitPerimeterFaces });

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      // ADR-363 Phase 1K — in-region placement (pick 4 lines / click inside).
      if (s.placementMode === 'in-region') {
        return onRegionClick(s, point);
      }

      // ADR-363 «Τοίχος από περίγραμμα» — click inside a perimeter (box-select primary).
      if (s.placementMode === 'outer-perimeter') {
        return onPerimeterClick(s, point);
      }

      // ADR-363 Phase 1J — on-entity placement (pick entity → pick side).
      if (s.placementMode === 'on-entity') {
        if (s.phase === 'awaitingStart') {
          const entities = getSceneEntities?.() ?? [];
          const tol = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
          const source = pickWallSourceFromEntity(point, entities, tol);
          if (!source) return false; // missed — stay in awaitingStart
          setState({ ...s, phase: 'awaitingSide', pickedSource: source, error: null });
          return true;
        }
        if (s.phase === 'awaitingSide') {
          return commitOnEntity(s, point);
        }
        return false;
      }

      // Polyline kind — N-click flow.
      if (s.kind === 'polyline') {
        if (s.phase === 'awaitingStart') {
          setState({
            ...s,
            phase: 'awaitingNextVertex',
            startPoint: { x: point.x, y: point.y },
            polylineVertices: [{ x: point.x, y: point.y }],
            error: null,
          });
          return true;
        }
        if (s.phase === 'awaitingNextVertex') {
          setState({
            ...s,
            polylineVertices: [...s.polylineVertices, { x: point.x, y: point.y }],
            error: null,
          });
          return true;
        }
        return false;
      }

      // Curved kind — 3-click flow.
      if (s.kind === 'curved') {
        if (s.phase === 'awaitingStart') {
          setState({
            ...s,
            phase: 'awaitingEnd',
            startPoint: { x: point.x, y: point.y },
            endPoint: null,
            error: null,
          });
          return true;
        }
        if (s.phase === 'awaitingEnd') {
          setState({
            ...s,
            phase: 'awaitingCurveControl',
            endPoint: { x: point.x, y: point.y },
            error: null,
          });
          return true;
        }
        if (s.phase === 'awaitingCurveControl') {
          return commitCurvedFromState(s, point);
        }
        return false;
      }

      // Straight kind — 2-click chain (ADR-508, mirror δοκαριού):
      //   click 1 (awaitingStart) → resolveWallStartAnchor → store start (+anchored), → awaitingEnd
      //   click 2 (awaitingEnd)   → commit (auto-flush σε κολόνα ή centerline αν anchored)
      if (s.phase === 'awaitingStart') {
        syncSceneTargetsToStore();
        // ADR-508 §smart wall ghost — face-snap το start (αν κοντά σε κολόνα/μέλος).
        const { start: startPoint, anchored, faceAngle, hostId } = resolveWallStartAnchor(point);
        // Sync before setState: το επόμενο mousemove διαβάζει σωστό startPoint αμέσως
        // (χωρίς useEffect-delay window με stale null → cursor-dot flash).
        wallPreviewStore.set({
          startPoint,
          endPoint: null,
          curveControl: null,
          polylineVertices: [],
          overrides: s.overrides,
          startAnchored: anchored,
          startFaceAngle: faceAngle,
          anchoredHostId: hostId,
        });
        setState({
          ...s,
          phase: 'awaitingEnd',
          startPoint,
          startAnchored: anchored,
          startFaceAngle: faceAngle,
          anchoredHostId: hostId,
          error: null,
        });
        return true;
      }
      if (s.phase === 'awaitingEnd' && s.startPoint) {
        // ADR-513/ADR-508 — precedence στο commit (preview ≡ committed):
        //  · ενεργό lock (Δαχτυλίδι/Dynamic Input) → ρητή αριθμητική είσοδος ΝΙΚΑ (applyLengthAngleLock)·
        //  · αλλιώς → endpoint face-snap (το ΑΚΡΟ κουμπώνει flush σε παρειά μέλους/κολώνας, ΙΔΙΟΣ
        //    dispatcher με το start· face-snap > ortho κατά Giorgio). No-op εκτός capture → raw point.
        let endPoint: Point2D;
        if (isLengthAngleLockActive()) {
          endPoint = applyLengthAngleLock(point, s.startPoint);
        } else {
          const targets = sceneSnapTargetsStore.get();
          // ΧΩΡΙΣ worldPerPixel → πλήρως συνεχής ολίσθηση του ΑΚΡΟΥ στην παρειά (Giorgio «ΠΛΗΡΩΣ»).
          const endSnap = resolveWallEndpointSnap(
            point,
            targets.footprints,
            selectGhostMembers(targets, ['wall', 'beam', 'slab', 'line']),
            resolveWallThicknessMm(s.overrides),
            getSceneUnits?.() ?? 'mm',
          );
          // ADR-049 — Shift fine 1cm βήμα στο ΑΚΡΟ ΜΟΝΟ στο ελεύθερο (face-snap νικά). preview ≡ commit.
          endPoint = resolveWallEndpointWithFineStep(endSnap, s.startPoint);
        }
        return commitStraightFromState(s, endPoint);
      }
      // Legacy awaitingAlignment commit (μη προσβάσιμο πλέον από κλικ straight· διατηρείται
      // για το dynamic-input precision path που μπορεί ακόμη να το θέσει).
      if (s.phase === 'awaitingAlignment' && s.startPoint && s.endPoint) {
        return commitStraightFromState(s, s.endPoint, point);
      }
      return false;
    },
    [
      commitStraightFromState,
      commitCurvedFromState,
      commitOnEntity,
      getSceneEntities,
      getSceneUnits,
      onRegionClick,
      onPerimeterClick,
      resolveWallStartAnchor,
      syncSceneTargetsToStore,
    ],
  );

  const finishPolyline = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.kind !== 'polyline') return false;
    if (s.phase !== 'awaitingNextVertex') return false;
    return commitPolylineFromState(s);
  }, [commitPolylineFromState]);

  // ── status text (i18n keys returned for caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    // ADR-419 — in-region prompts ανά τρόπο (4 γραμμές / κλικ μέσα / πλαίσιο).
    if (s.placementMode === 'in-region') {
      if (s.regionMethod === 'inside') return 'tools.wall.statusRegionInsidePick';
      if (s.regionMethod === 'box') return 'tools.wall.statusRegionBoxPick';
      return s.regionPicks.length > 0
        ? 'tools.wall.statusRegionMore'
        : 'tools.wall.statusRegionLinesPick';
    }
    // ADR-363 «Τοίχος από περίγραμμα» — box-select prompt.
    if (s.placementMode === 'outer-perimeter') {
      return 'tools.wall.statusPerimeterPick';
    }
    // ADR-363 Phase 1J — on-entity prompts.
    if (s.placementMode === 'on-entity') {
      if (s.phase === 'awaitingStart') return 'tools.wall.statusPickEntity';
      if (s.phase === 'awaitingSide') return 'tools.wall.statusPickSide';
      return '';
    }
    switch (s.phase) {
      case 'awaitingStart':
        return 'tools.wall.statusStart';
      case 'awaitingEnd':
        return s.kind === 'curved'
          ? 'tools.wall.statusCurveEnd'
          : 'tools.wall.statusEnd';
      case 'awaitingAlignment':
        return 'tools.wall.statusAlignment';
      case 'awaitingCurveControl':
        return 'tools.wall.statusCurveControl';
      case 'awaitingNextVertex':
        return 'tools.wall.statusPolyNext';
      default:
        return '';
    }
  }, []);

  // ── ADR-404 Phase 5b — publish handle στο ribbon bridge store ────────────
  // Single writer (mirror columnToolBridgeStore). Ο bridge διαβάζει μέσω
  // `wallToolBridgeStore.get()` όταν δεν υπάρχει επιλεγμένος τοίχος, ώστε το panel
  // «Κλίση» να οδηγεί τα overrides σε drawing mode (ο επόμενος τοίχος born-tilted).
  useEffect(() => {
    wallToolBridgeStore.set({
      isActive: state.phase !== 'idle',
      overrides: state.overrides,
      setParamOverrides,
    });
    return () => {
      // Καθάρισε μόνο αν είμαστε ο τρέχων publisher (μην σβήσεις νεότερο mount).
      if (wallToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
        wallToolBridgeStore.set(null);
      }
    };
  }, [state.phase, state.overrides, setParamOverrides]);

  // ── side-effect listeners (extracted for N.7.1, parity preserved) ────────
  useWallToolDynamicInputListener({
    stateRef,
    setState,
    commitStraightFromState,
    commitCurvedFromState,
  });
  useWallToolEnterListener({ stateRef, commitPolylineFromState });

  return {
    state,
    activate,
    setKind,
    setPlacementMode,
    setRegionMethod,
    deactivate,
    reset,
    backToAwaitingEnd,
    onCanvasClick,
    finishPolyline,
    setParamOverrides,
    getStatusText,
    getRegionPickIds,
    isActive: state.phase !== 'idle',
    isAwaitingStart: state.phase === 'awaitingStart',
    isAwaitingEnd: state.phase === 'awaitingEnd',
    isAwaitingAlignment: state.phase === 'awaitingAlignment',
    isAwaitingCurveControl: state.phase === 'awaitingCurveControl',
    isAwaitingNextVertex: state.phase === 'awaitingNextVertex',
    isAwaitingSide: state.phase === 'awaitingSide',
  };
}
