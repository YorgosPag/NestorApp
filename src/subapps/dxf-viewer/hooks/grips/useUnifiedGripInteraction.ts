/**
 * ADR-183: Unified Grip System — useUnifiedGripInteraction
 *
 * Single hook that manages ALL grip interactions for both DXF entities and overlay polygons.
 * State machine: idle → hovering → warm → dragging → commit/cancel → idle
 *
 * Split: unified-grip-types (types), grip-projections (projection builders).
 *
 * @see unified-grip-types.ts — type definitions
 * @see grip-projections.ts — backward-compatible projection builders
 * @see grip-registry.ts — grip computation
 * @see grip-hit-testing.ts — proximity detection
 * @see grip-commit-adapters.ts — commit logic
 */
import { useState, useCallback, useRef, useMemo, useEffect, useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { GRIP_CONFIG } from '../useGripMovement';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import type {
  UnifiedGripInfo,
  UnifiedGripPhase,
  UseUnifiedGripInteractionParams,
  UseUnifiedGripInteractionReturn,
  DxfProjection,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
  GripHoverThrottle,
} from './unified-grip-types';
import { type WallHotGripOp, type HotGripStep } from './wall-hot-grip-fsm';
// ADR-532 B4 — the grip registry now lives in the GripRegistryPublisher leaf; this
// hook reads the published grip set at event time (hit-testing) so CanvasSection
// stays inert on selection. Selection-change resets are driven off subscribeSelection.
import { AllGripsStore } from '../../systems/grip/AllGripsStore';
import { subscribeSelection } from '../../systems/selection/SelectedEntitiesStore';
import { WallRotateHotGripStore } from '../../bim/walls/wall-rotate-hotgrip-store';
// ADR-397 — rotation snap targets SSoT (arm on centre-pick, clear on reset).
import { getGlobalRotationSnapStore } from '../../bim/grips/rotation-snap-store';
import { runGripMouseDown } from './grip-mouse-handlers';
import { runGripMouseUp } from './grip-mouseup-handler';
import { runGripMouseMove } from './grip-mouse-move-handler';
import type { DxfCommitDeps, OverlayCommitDeps } from './grip-commit-adapters';
// ADR-363 Slice G.6 — free-rotate reference baseline along the entity's major axis.
import { createSceneManagerAdapter } from './grip-commit-adapters';
import { resolveRotateReferenceAnchor } from '../../bim/grips/rotate-reference-axis';
import type { Entity } from '../../types/entities';
import { GripBasePointStore } from '../../systems/grip/GripBasePointStore';
import { GripAltMoveStore } from '../../systems/grip/GripAltMoveStore';
// ADR-501 — armed-grip SSoT (clicked-to-select grips render orange for multi-grip move).
import { GripArmedStore } from '../../systems/grip/GripArmedStore';
import { GripCopyModeStore } from '../../systems/grip/GripCopyModeStore';
import { GripReferenceStore } from '../../systems/grip/GripReferenceStore';
import { GripSessionUndoStore } from '../../systems/grip/GripSessionUndoStore';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { useGripSpacebarCycle } from './useGripSpacebarCycle';
// ADR-397 Σ2/Σ3 — rotate-free keyboard: «R» → reference flow, typed-angle commit.
import { runHotGripKeyDown } from './grip-hotgrip-actions';
// ADR-397 Σ3 — typed-angle digit buffer SSoT (ADR-344, «angle for rotation»).
import { DirectDistanceEntry } from '../../text-engine/interaction/DirectDistanceEntry';
// ADR-513 §rotation-ring — bridge: το single-slice «Γωνία» ring γεμίζει το ΙΔΙΟ typed-angle που
// οδηγεί preview (ghost+τόξα) + commit. Το keyboard DDE νικά όταν και τα δύο υπάρχουν.
import { RotationRingStore } from '../../systems/dynamic-input/rotation-ring-store';
import {
  buildGripInteractionState,
  buildOverlayHoveredVertex,
  buildOverlayHoveredEdge,
  buildOverlayProjection,
  buildGripStateForStack,
} from './grip-projections';
// ADR-363/397 — DXF drag-preview resolver extracted for file-size (N.7.1).
import { resolveDxfDragPreview } from './grip-dxf-drag-preview-resolver';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { useMoveEntities } from '../useMoveEntities';
import { useCommandHistory } from '../../core/commands';
import { useLevels } from '../../systems/levels';
import { clearActiveDragGrip } from '../../systems/cursor/GripDragStore';
// ADR-363 — crosshair snap-to-grid: publish the drag anchor so the cursor leaf
// (`mouse-handler-move`) can quantize the crosshair onto the step grid (F9+Q).
import { clearGripStepAnchor } from '../../systems/cursor/GripStepAnchorStore';
// ADR-040 Phase XXII.A — transform reads from SSoT (orchestrator-decoupling).
// ADR-397 Φ2 — per-arm MOVE-glyph hover highlight (Giorgio 2026-06-17): classify the
// cursor into a move arm (world frame) and publish it so the renderer lights only it.
import { MoveGlyphZoneStore } from '../../bim/grips/move-glyph-zone-store';
// Re-export types for consumers
export type { UseUnifiedGripInteractionParams, UseUnifiedGripInteractionReturn, DxfProjection };
export type { OverlayProjection } from './unified-grip-types';
// ============================================================================
// HOOK
// ============================================================================
export function useUnifiedGripInteraction(
  params: UseUnifiedGripInteractionParams,
): UseUnifiedGripInteractionReturn {
  // ADR-040 XXII.A: `transform` param retained for signature compat; reads via SSoT.
  // ADR-532 B4: `selectedEntityIds`/`dxfScene` no longer drive a registry here — the
  // GripRegistryPublisher leaf owns that and publishes to AllGripsStore.
  const {
    transform: _transform,
    currentOverlays, universalSelection, overlayStore, overlayStoreRef,
    activeTool, gripSettings, executeCommand, movementDetectionThreshold,
    onToolChange,
  } = params;
  void _transform;
  // ── Commit deps ──
  const { moveEntities } = useMoveEntities();
  const { execute } = useCommandHistory();
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();
  const onToolChangeRef = useRef(onToolChange);
  onToolChangeRef.current = onToolChange;
  const dxfCommitDeps = useMemo<DxfCommitDeps>(
    () => ({
      moveEntities, execute, currentLevelId, getLevelScene, setLevelScene,
      onToolChange: (tool: string) => onToolChangeRef.current?.(tool),
    }),
    [moveEntities, execute, currentLevelId, getLevelScene, setLevelScene],
  );
  const overlayCommitDeps = useMemo<OverlayCommitDeps>(
    () => ({ overlayStore, executeCommand, movementDetectionThreshold }),
    [overlayStore, executeCommand, movementDetectionThreshold],
  );
  // ── Grip set (ADR-532 B4) ──
  // The unified grip registry is computed by the GripRegistryPublisher leaf (which
  // subscribes to the selection set) and published to AllGripsStore. Event handlers
  // below read `AllGripsStore.get()` at call time — never a render-time snapshot —
  // so this hook (hosted by the inert CanvasSection orchestrator) needs no selection
  // subscription. The armable-grips publish moved to the publisher as well.
  // ── Core state ──
  const [phase, setPhase] = useState<UnifiedGripPhase>('idle');
  const [hoveredGrip, setHoveredGrip] = useState<UnifiedGripInfo | null>(null);
  const [activeGrip, setActiveGrip] = useState<UnifiedGripInfo | null>(null);
  const [currentWorldPos, setCurrentWorldPos] = useState<Point2D | null>(null);
  const anchorRef = useRef<Point2D | null>(null);
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ADR-363 Phase 1G — distinguishes the 1st-click release (arm, stay hot) from
  // the 2nd-click release (commit) while `phase === 'hotGrip'`.
  const hotGripAwaitingFirstReleaseRef = useRef(false);
  // ADR-363 Phase 1G — true once the cursor has moved away from the grip anchor
  // since arming. Gates the commit so a stray same-spot release (the 2nd fire of
  // the canvas+container mouseup pair) cannot resetToIdle and kill the hot move.
  const hotGripMovedRef = useRef(false);
  // ADR-363 Phase 1G — hot-grip context.
  //   op   = corner (2-click) | move (3-click) | rotate (6-click reference flow).
  //   step = which point the next deliberate click picks (see HotGripStep).
  //   base = the picked base point (move) / rotation centre (rotate).
  const hotGripOpRef = useRef<WallHotGripOp | null>(null);
  const hotGripStepRef = useRef<HotGripStep>('tracking');
  const hotGripBaseRef = useRef<Point2D | null>(null);
  // ADR-363 Phase 1G.3 — rotate-reference (6-click): the existing (reference) line
  // and the alignment line points. The wall spins by angle(align) − angle(ref).
  const hotGripRefStartRef = useRef<Point2D | null>(null);
  const hotGripRefEndRef = useRef<Point2D | null>(null);
  const hotGripAlignStartRef = useRef<Point2D | null>(null);
  // ADR-397 — FREE rotate baseline: cursor world-point at the first move after the
  // centre is picked. The live sweep is measured relative to it (starts at 0, no
  // jump). Null until that first move; reset on selection change / idle.
  const hotGripRotateBaseRef = useRef<Point2D | null>(null);
  // ADR-397 Σ3 — typed rotation angle: digit buffer (DirectDistanceEntry SSoT, signed)
  // + a React snapshot that re-triggers the preview memo so the typed ghost updates
  // (keystrokes don't move the cursor). `deg` null while the buffer is partial.
  const rotateDdeRef = useRef(new DirectDistanceEntry());
  const [typedRotate, setTypedRotate] = useState<{ buffer: string; deg: number | null } | null>(null);
  // ── Overlay grip state (backward compat) ──
  const [selectedGrips, setSelectedGrips] = useState<SelectedGrip[]>([]);
  const [draggingVertices, setDraggingVertices] = useState<DraggingVertexState[] | null>(null);
  const [draggingEdgeMidpoint, setDraggingEdgeMidpoint] = useState<DraggingEdgeMidpointState | null>(null);
  const [draggingOverlayBody, setDraggingOverlayBody] = useState<DraggingOverlayBodyState | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<Point2D | null>(null);
  // ── Refs ──
  const gripHoverThrottleRef = useRef<GripHoverThrottle>({ lastCheckTime: 0, lastWorldPoint: null });
  const justFinishedDragRef = useRef(false);
  // Sync mutex: canvas onMouseUp + container onMouseUp both fire in the same
  // tick and would both pass the state check (setState is async, so closure
  // values are stale). Without a sync guard the second call commits again with
  // a wrong worldPos and teleports the vertex toward (0,0). See ADR-031.
  const mouseUpInProgressRef = useRef(false);
  // Same race exists on mouseDown — canvas and container both call
  // handleMouseDown. The container's call uses a stale `mouseWorldRef`, so it
  // typically resolves no nearGrip and would `setSelectedGrips([])`, clobbering
  // the correct selection set by the canvas's call (every other click).
  const mouseDownInProgressRef = useRef(false);
  const markDragFinished = useCallback(() => {
    justFinishedDragRef.current = true;
    setTimeout(() => { justFinishedDragRef.current = false; }, PANEL_LAYOUT.TIMING.DRAG_FINISH_RESET);
  }, []);
  const isGripMode = activeTool === 'select' || activeTool === 'layering';
  // ADR-349 Phase 1c-A: spacebar cycles grip-hot mode (Stretch → Move → Rotate → Scale → Mirror).
  useGripSpacebarCycle({ phase, activeTool });
  // ── Reset on selection change (ADR-532 B4) ──
  // CanvasSection no longer re-renders on selection, so the reset is driven off the
  // SelectedEntitiesStore subscription instead of a render-time selection key. The
  // body sets state to its idle defaults: when no grip session is active these are
  // no-ops (React bails out → CanvasSection does NOT re-render), so only an active
  // grip session that gets a new selection forces the one reset re-render it needs.
  const resetGripSessionOnSelectionChange = useCallback(() => {
    setPhase('idle');
    setHoveredGrip(null);
    setActiveGrip(null);
    setCurrentWorldPos(null);
    anchorRef.current = null;
    clearGripStepAnchor();
    hotGripAwaitingFirstReleaseRef.current = false;
    hotGripMovedRef.current = false;
    hotGripOpRef.current = null;
    hotGripStepRef.current = 'tracking';
    hotGripBaseRef.current = null;
    hotGripRefStartRef.current = null;
    hotGripRefEndRef.current = null;
    hotGripAlignStartRef.current = null;
    hotGripRotateBaseRef.current = null;
    WallRotateHotGripStore.clear();
    if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
    // ADR-357 Phase 12 — selection change ends the grip-hot session: clear
    // all 4 grip-extras micro-leaf SSoT stores so the next session starts clean.
    GripBasePointStore.clear();
    GripCopyModeStore.clear();
    GripReferenceStore.clear();
    GripSessionUndoStore.clear();
    // ADR-397 Σ3 — selection change ends any in-progress typed rotation angle.
    rotateDdeRef.current.reset();
    setTypedRotate(null);
    // ADR-513 §rotation-ring — selection change ends the rotate-free session → ξε-mount το ring.
    RotationRingStore.endSession();
  }, []);
  useEffect(
    () => subscribeSelection(resetGripSessionOnSelectionChange),
    [resetGripSessionOnSelectionChange],
  );
  // ADR-357 Phase 12 — keep `GripSessionUndoStore.currentSize` synced with the
  // global CommandHistory so the right-click `Undo` extra knows whether any
  // commands have been produced since the session began. Subscribed once for
  // the lifetime of the hook; the store itself stays inactive (sessionStartSize
  // === null) until `markSessionStart` is called on the first drag.
  useEffect(() => {
    const history = getGlobalCommandHistory();
    GripSessionUndoStore.reportHistorySize(history.size());
    const unsub = history.subscribe((event) => {
      GripSessionUndoStore.reportHistorySize(event.undoStackSize);
    });
    return unsub;
  }, []);
  useEffect(() => () => { if (warmTimerRef.current) clearTimeout(warmTimerRef.current); }, []);
  // ── Hit tolerance ──
  const hitTolerancePx = (gripSettings.gripSize ?? 5) * (gripSettings.dpiScale ?? 1.0) + 2;
  const effectiveTolerance = Math.max(hitTolerancePx, GRIP_CONFIG.HIT_TOLERANCE);
  const resetToIdle = useCallback(() => {
    console.log('[RD] resetToIdle'); // [RD]
    setPhase('idle');
    setActiveGrip(null);
    setHoveredGrip(null);
    setCurrentWorldPos(null);
    anchorRef.current = null;
    clearGripStepAnchor();
    hotGripAwaitingFirstReleaseRef.current = false;
    hotGripMovedRef.current = false;
    hotGripOpRef.current = null;
    hotGripStepRef.current = 'tracking';
    hotGripBaseRef.current = null;
    hotGripRefStartRef.current = null;
    hotGripRefEndRef.current = null;
    hotGripAlignStartRef.current = null;
    hotGripRotateBaseRef.current = null;
    WallRotateHotGripStore.clear();
    // ADR-397 — disarm the rotation snap targets (pivot ⊙ + grips) so the cursor
    // stops magnetising and the cyan grips revert once the rotation ends/cancels.
    getGlobalRotationSnapStore().clear();
    // ADR-363 Phase 1G.5 — disarm the Alt whole-entity move at the end of every
    // grip session so the next drag starts from its natural parametric behaviour.
    GripAltMoveStore.clear();
    // ADR-363 Phase 1G.3 — drop any hot-grip step hint so a finished/cancelled
    // flow does not leave a stale "click alignment point" prompt in the status bar.
    toolHintOverrideStore.setOverride(null);
    clearActiveDragGrip();
    // ADR-397 Σ3 — drop any typed rotation angle so the next flow starts clean.
    rotateDdeRef.current.reset();
    setTypedRotate(null);
    // ADR-513 §rotation-ring — commit / cancel / ESC ends the rotate-free session (ξε-mount το ring
    // + καθάρισμα τυχόν πληκτρολογημένης γωνίας). ΤΟ ΙΔΙΟ commit path τρέχει και για το ring (synthetic
    // canvas click → commitFreeRotate), οπότε το endSession εδώ καλύπτει και τις δύο πηγές.
    RotationRingStore.endSession();
  }, []);
  // ADR-397 Φ2 — classify the cursor into a MOVE-glyph arm (entity WORLD frame) and
  // publish it to `MoveGlyphZoneStore`; repaint the DXF canvas only on change so the
  // per-arm highlight tracks the cursor. Clears (and repaints) for non-move grips.
  // ── MOUSE MOVE (logic extracted → grip-mouse-move-handler.ts for file-size) ──
  const handleMouseMove = useCallback(
    (worldPos: Point2D, _screenPos: Point2D) =>
      runGripMouseMove(worldPos, {
        // ADR-532 B4: grip set read at event time from AllGripsStore (published by
        // GripRegistryPublisher) — never a render snapshot.
        isGripMode, allGrips: AllGripsStore.get(), phase, activeGrip, hoveredGrip, effectiveTolerance,
        gripSizePx: (gripSettings.gripSize ?? 5) * (gripSettings.dpiScale ?? 1),
        gripHoverThrottleRef, anchorRef, hotGripStepRef, hotGripMovedRef,
        hotGripRotateBaseRef, hotGripBaseRef, warmTimerRef,
        setCurrentWorldPos, setDragPreviewPosition, setHoveredGrip, setPhase,
      }),
    // ADR-040 XXII.A: scale removed from deps — SSoT read at event time.
    // ADR-532 B4: allGrips removed from deps — read from AllGripsStore at call time.
    [isGripMode, phase, activeGrip, hoveredGrip, effectiveTolerance, gripSettings.gripSize, gripSettings.dpiScale],
  );
  // ── MOUSE DOWN ──
  const handleMouseDown = useCallback(
    (worldPos: Point2D, isShift: boolean): boolean =>
      runGripMouseDown(worldPos, isShift, {
        mouseDownInProgressRef, activeGrip, anchorRef, onToolChangeRef, resetToIdle,
        // ADR-532 B4: grip set read at event time from AllGripsStore.
        isGripMode, allGrips: AllGripsStore.get(), phase, effectiveTolerance, hoveredGrip, selectedGrips,
        setSelectedGrips, setActiveGrip, setPhase, setCurrentWorldPos,
        hotGripOpRef, hotGripStepRef, hotGripAwaitingFirstReleaseRef, hotGripMovedRef, hotGripBaseRef,
        hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef, hotGripRotateBaseRef,
        warmTimerRef, universalSelection, setDraggingVertices, setDragPreviewPosition,
        overlayStoreRef, currentOverlays, setDraggingEdgeMidpoint,
        // ADR-397 Φ2 — directional move-by-value: deps for the click→prompt→commit path.
        dxfCommitDeps, gripSizePx: (gripSettings.gripSize ?? 5) * (gripSettings.dpiScale ?? 1),
        markDragFinished,
      }),
    // ADR-040 XXII.A: scale removed from deps — SSoT read at event time.
    // ADR-532 B4: allGrips removed from deps — read from AllGripsStore at call time.
    [isGripMode, phase, activeGrip, hoveredGrip, effectiveTolerance, selectedGrips, universalSelection, overlayStoreRef, currentOverlays, resetToIdle, dxfCommitDeps, gripSettings.gripSize, gripSettings.dpiScale, markDragFinished],
  );
  // ── MOUSE UP ──
  const handleMouseUp = useCallback(
    (worldPos: Point2D): Promise<boolean> =>
      runGripMouseUp(worldPos, {
        mouseUpInProgressRef, phase, hotGripAwaitingFirstReleaseRef, hotGripStepRef,
        hotGripMovedRef, hotGripBaseRef, hotGripOpRef, activeGrip, anchorRef,
        hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef, hotGripRotateBaseRef,
        dxfCommitDeps, overlayCommitDeps, resetToIdle, setCurrentWorldPos, markDragFinished,
        draggingVertices, setDraggingVertices, draggingEdgeMidpoint, setDraggingEdgeMidpoint,
        draggingOverlayBody, setDraggingOverlayBody, setSelectedGrips, setDragPreviewPosition,
        // ADR-397 — capture the rotating entity's grip world-points so the centre-pick
        // step can arm the rotation snap targets (pivot ⊙ + grips).
        rotatingEntityGripsWorld: () =>
          activeGrip?.source === 'dxf' && activeGrip.entityId
            ? AllGripsStore.get()
                .filter((g) => g.source === 'dxf' && g.entityId === activeGrip.entityId)
                .map((g) => ({ entityId: g.entityId!, gripIndex: g.gripIndex, point: g.position }))
            : [],
        // ADR-363 Slice G.6 — seed the free-rotate reference baseline along the active
        // entity's MAJOR axis (toward its body). Reads the entity via the same scene
        // manager adapter the commit uses; null entity / no orientation → null (legacy
        // first-move baseline). Pure resolver, no new orientation maths.
        resolveRotateBaselineAnchor: (pivot: Point2D): Point2D | null => {
          if (activeGrip?.source !== 'dxf' || !activeGrip.entityId) return null;
          const sm = createSceneManagerAdapter(dxfCommitDeps);
          const entity = sm?.getEntity(activeGrip.entityId);
          return entity ? resolveRotateReferenceAnchor(entity as unknown as Entity, pivot) : null;
        },
        // ADR-513 §rotation-ring — ένα terminal click οριστικοποιεί ΜΟΝΟ την ΟΛΟΚΛΗΡΩΜΕΝΗ γωνία του
        // «Δαχτυλιδιού Εντολών» (το δικό του Enter → synthetic canvas click). Read at event time.
        typedRotateDeg: RotationRingStore.getLockedDeg(),
        // ADR-397/513 (Giorgio 2026-07-06, επιλογή Β) — ΟΣΟ πληκτρολογείς γωνία με το ΠΛΗΚΤΡΟΛΟΓΙΟ, ένα
        // κλικ ΔΕΝ κάνει commit (μόνο το Enter κλειδώνει το πληκτρολογημένο). Χωρίς πληκτρολόγηση → κλικ =
        // ελεύθερη περιστροφή στον κέρσορα (shipped). Backspace/ESC καθαρίζει → ξανά ελεύθερη με κλικ.
        keyboardAngleEntryActive: (typedRotate?.deg ?? null) !== null,
      }),
    // ADR-532 B4: allGrips removed from deps — read from AllGripsStore at call time.
    [phase, activeGrip, dxfCommitDeps, overlayCommitDeps, draggingVertices, draggingEdgeMidpoint, draggingOverlayBody, resetToIdle, markDragFinished, typedRotate],
  );
  // ── ESCAPE ──
  const handleEscape = useCallback((): boolean => {
    let handled = false;
    // ADR-363 Phase 1G — ESC / right-click also cancels an active corner hot-grip.
    if (phase === 'dragging' || phase === 'hotGrip') {
      setDraggingVertices(null); setDraggingEdgeMidpoint(null);
      setDraggingOverlayBody(null); setDragPreviewPosition(null);
      resetToIdle();
      handled = true;
    }
    // ADR-501 — ESC also clears the armed-grip selection (AutoCAD: Esc deselects
    // grips) even when idle, so the orange grips revert to cold.
    if (GripArmedStore.size > 0) {
      GripArmedStore.clear();
      handled = true;
    }
    return handled;
  }, [phase, resetToIdle]);
  // ── ADR-397 Σ2 — ROTATE-FREE KEYBOARD ──
  // Window-level key during the free rotate (`phase==='hotGrip'`, op rotate, step
  // rotate-free). Σ2: «R» jumps to the 6-click reference flow. Returns true when the
  // key is consumed so the canvas keyboard hook can `preventDefault` + block globals.
  // Refs are read at call time (closure), so only `phase` needs to be a dep.
  // ADR-397 Σ2/Σ3 — logic extracted → grip-hotgrip-actions.runHotGripKeyDown (file-size
  // N.7.1). Refs read at call time (closure), so only `phase` needs to be a dep. ESC is
  // NOT handled here — it routes through the escape-bus SSoT at `ESC_PRIORITY.HOT_GRIP_OP`.
  const handleHotGripKeyDown = useCallback(
    (key: string): boolean =>
      runHotGripKeyDown(key, phase, {
        hotGripOpRef, hotGripStepRef, hotGripBaseRef, hotGripRotateBaseRef,
        hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef, hotGripMovedRef,
        rotateDdeRef, activeGrip, dxfCommitDeps, resetToIdle,
        setCurrentWorldPos, setTypedRotate,
      }),
    [phase, activeGrip, dxfCommitDeps, resetToIdle],
  );
  // True while a hot-grip flow is live — coarse reactive gate for the canvas keyboard
  // hook; the fine op/step check happens inside `handleHotGripKeyDown` (refs).
  const hotGripIsActive = phase === 'hotGrip';
  // ── PROJECTIONS (from grip-projections.ts) ──
  // ADR-513 §rotation-ring — low-freq subscription στη γωνία του «Γωνία» ring (αλλάζει σε ενέργεια
  // χρήστη, ΟΧΙ ανά frame — ίδια κλάση με το GripArmedStore) ώστε το preview memo να ξαναϋπολογιστεί
  // μόλις κλειδωθεί γωνία στο ring, ΧΩΡΙΣ κίνηση κέρσορα (πλήκτρα δεν αλλάζουν currentWorldPos).
  const ringLockedDeg = useSyncExternalStore(
    RotationRingStore.subscribe, RotationRingStore.getLockedDeg, RotationRingStore.getLockedDeg,
  );
  // ADR-363/397 — preview resolver extracted → grip-dxf-drag-preview-resolver (file-size
  // N.7.1). typedRotate re-triggers the memo so the typed ghost updates (keystrokes don't
  // change currentWorldPos); dxfCommitDeps drives the deterministic axis-baseline read.
  // ADR-513 §rotation-ring — effective typed angle = keyboard DDE ?? ring-locked γωνία (ΙΔΙΟ ghost+τόξα).
  const dxfDragPreview = useMemo(
    () => resolveDxfDragPreview({
      phase, activeGrip, anchorPos: anchorRef.current, currentWorldPos,
      hotGripOp: hotGripOpRef.current, hotGripStep: hotGripStepRef.current,
      hotGripBase: hotGripBaseRef.current,
      hotGripRefStart: hotGripRefStartRef.current, hotGripRefEnd: hotGripRefEndRef.current,
      hotGripAlignStart: hotGripAlignStartRef.current, hotGripRotateBase: hotGripRotateBaseRef.current,
      typedRotateDeg: typedRotate?.deg ?? ringLockedDeg, dxfCommitDeps,
    }),
    [phase, activeGrip, currentWorldPos, typedRotate, ringLockedDeg, dxfCommitDeps],
  );
  // ADR-501 — subscribe to the armed-grip set so the canvas repaints (orange grips)
  // when the user clicks/shift-clicks/marquees grips. Low-frequency (click), not a
  // 60fps drag subscription → ADR-040 compliant.
  const armedKeys = useSyncExternalStore(
    GripArmedStore.subscribe,
    GripArmedStore.getKeysSnapshot,
    GripArmedStore.getKeysSnapshot,
  );
  const gripInteractionState = useMemo(
    () => buildGripInteractionState(hoveredGrip, activeGrip, phase, armedKeys),
    [hoveredGrip, activeGrip, phase, armedKeys],
  );
  // ADR-363 Phase 1G — hotGrip counts as "following" so upstream snap applies to
  // the live rubber-band move and the lasso gate (`!isGripDragging`) stays closed.
  const isDxfFollowing = (phase === 'dragging' || phase === 'hotGrip') && activeGrip?.source === 'dxf';
  const dxfProjection = useMemo<DxfProjection>(() => ({
    gripInteractionState,
    isDraggingGrip: isDxfFollowing,
    isFollowingGrip: isDxfFollowing,
    handleGripMouseMove: (worldPos: Point2D, screenPos: Point2D) => {
      handleMouseMove(worldPos, screenPos);
      // Suppress upstream handlers (drawing preview, hover, etc.) for ANY active
      // grip drag, not only DXF — overlay grips also flow through DxfCanvas.
      return phase === 'dragging' || phase === 'hotGrip' || draggingVertices !== null || draggingEdgeMidpoint !== null || draggingOverlayBody !== null;
    },
    handleGripMouseDown: (worldPos: Point2D) => handleMouseDown(worldPos, false),
    handleGripMouseUp: (worldPos: Point2D) => {
      // Capture drag state BEFORE handleMouseUp resets it. Returning truthy here
      // tells the canvas mouse-up handler to skip onCanvasClick — otherwise the
      // active drawing tool (e.g. layering / polygon) registers a stray click
      // and creates a new polygon point while a vertex was being dragged.
      // ADR-363 Phase 1G — hotGrip release (arm + commit) must also suppress
      // onCanvasClick so the corner click-click move never deselects the wall.
      const wasDragging = phase === 'dragging' || phase === 'hotGrip' || draggingVertices !== null || draggingEdgeMidpoint !== null || draggingOverlayBody !== null;
      handleMouseUp(worldPos);
      return wasDragging;
    },
    handleGripClick: (_worldPos: Point2D) => false,
    handleGripEscape: handleEscape,
    handleGripRightClick: handleEscape,
    dragPreview: dxfDragPreview,
  }), [gripInteractionState, isDxfFollowing, phase, activeGrip, handleMouseMove, handleMouseDown, handleMouseUp, handleEscape, dxfDragPreview, draggingVertices, draggingEdgeMidpoint, draggingOverlayBody]);
  const overlayHoveredVertex = useMemo(() => buildOverlayHoveredVertex(hoveredGrip), [hoveredGrip]);
  const overlayHoveredEdge = useMemo(() => buildOverlayHoveredEdge(hoveredGrip, currentOverlays), [hoveredGrip, currentOverlays]);
  const draggingVertex: DraggingVertexState | null = draggingVertices?.[0] ?? null;
  const selectedGrip: SelectedGrip | null = selectedGrips[0] ?? null;
  const overlayProjection = useMemo(
    () => buildOverlayProjection(overlayHoveredVertex, overlayHoveredEdge, selectedGrips, selectedGrip, draggingVertex, draggingVertices, draggingEdgeMidpoint, draggingOverlayBody, dragPreviewPosition),
    [overlayHoveredVertex, overlayHoveredEdge, selectedGrips, selectedGrip, draggingVertex, draggingVertices, draggingEdgeMidpoint, draggingOverlayBody, dragPreviewPosition],
  );
  const gripStateForStack = useMemo(
    () => buildGripStateForStack(draggingVertex, draggingEdgeMidpoint, overlayHoveredVertex, overlayHoveredEdge, draggingOverlayBody, dragPreviewPosition),
    [draggingVertex, draggingEdgeMidpoint, overlayHoveredVertex, overlayHoveredEdge, draggingOverlayBody, dragPreviewPosition],
  );
  const isDragging = phase === 'dragging' || draggingVertices !== null || draggingEdgeMidpoint !== null || draggingOverlayBody !== null;
  // ── RETURN ──
  return useMemo(() => ({
    handleMouseMove, handleMouseDown, handleMouseUp, handleEscape,
    hoveredGrip, activeGrip, phase,
    dxfProjection, overlayProjection, gripStateForStack,
    selectedGrips, setSelectedGrips, setDragPreviewPosition,
    isDragging, gripHoverThrottleRef, justFinishedDragRef, markDragFinished,
    setDraggingOverlayBody, draggingOverlayBody, draggingVertices, draggingEdgeMidpoint,
    // ADR-397 Σ2 — rotate-free keyboard API for the canvas keyboard hook.
    handleHotGripKeyDown, hotGripIsActive,
  }), [
    handleMouseMove, handleMouseDown, handleMouseUp, handleEscape,
    hoveredGrip, activeGrip, phase,
    dxfProjection, overlayProjection, gripStateForStack,
    selectedGrips, isDragging, markDragFinished,
    draggingOverlayBody, draggingVertices, draggingEdgeMidpoint,
    handleHotGripKeyDown, hotGripIsActive,
  ]);
}
