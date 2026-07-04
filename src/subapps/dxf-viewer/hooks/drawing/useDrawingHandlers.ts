/**
 * useDrawingHandlers - Drawing Interaction Handlers
 *
 * @description
 * Κεντρικό hook που διαχειρίζεται όλα τα drawing και measurement interaction handlers.
 * Συνδυάζει unified drawing (useUnifiedDrawing), snap system (useSnapManager), και canvas
 * operations (useCanvasOperations). Εκθέτει τους click / hover / cancel / double-click
 * handlers + entity creation lifecycle.
 *
 * @see {@link docs/LINE_DRAWING_SYSTEM.md} - Complete line drawing documentation
 * @see {@link docs/settings-system/08-LINE_DRAWING_INTEGRATION.md} - Settings integration
 * @see {@link hooks/drawing/useUnifiedDrawing.ts} - Drawing state hook
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-06
 * @version 1.0.0
 */

'use client';

// DEBUG FLAG - 🔍 ENABLE FOR TRACING PREVIEW ISSUES
const DEBUG_DRAWING_HANDLERS = false; // 🔧 DISABLED (2026-02-02) - performance investigation

import { useCallback, useEffect, useRef } from 'react';
import type { ToolType } from '../../ui/toolbar/types';
import { useCadToggles } from '../common/useCadToggles';
// 🏢 ENTERPRISE (2026-01-30): Centralized tool metadata for continuous mode
// 🏢 ENTERPRISE (2026-01-30): Centralized Tool State Store - ADR Tool Persistence
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { mmToSceneUnits, resolveSceneUnits } from '../../utils/scene-units';
// ADR-508 §line-cyan — commit-time flush/κάθετο κούμπωμα γραμμής (ίδιος εγκέφαλος με το preview).
import { resolveLineCommitPoint } from './line-preview-helpers';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { isVisibleSnapMode } from '../../snapping/extended-types'; // «κορυφή νικάει» flush-gate (SSoT)
// ADR-508 §line-cyan — η γραμμή συλλέγει τους ΙΔΙΟΥΣ face-snap στόχους σκηνής με τον τοίχο (κοινό store).
import { useSceneSnapTargetSync } from './use-scene-snap-target-sync';
// ADR-513 §line-parity — length/angle lock της γραμμής στο commit (mirror του preview & του τοίχου).
import { applyLengthAngleLock } from '../../systems/dynamic-input/length-angle-lock';
import { useUnifiedDrawing } from './useUnifiedDrawing';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';
import { useCanvasOperations } from '../interfaces/useCanvasOperations';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
// 🏢 ADR-040: PreviewCanvas for direct preview rendering (performance optimization)
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
// 🎯 ADR-047: Distance calculation for close-on-first-point
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// ADR-357 Phase 4: Object Snap Tracking
import {
  TrackingPointStore,
  subscribeTrackingPoints,
  getTrackingPointsSnapshot,
} from '../../systems/tracking/TrackingPointStore';
// ADR-357 / 2026-07-04 — commit shares the preview's tracking SSoT (acquired ⊕
// ambient ⊕ segment-base clean-corner) so the clicked point ≡ the locked ghost.
import { resolveAlignmentTracking } from '../../systems/tracking/resolve-alignment-tracking';
// 🏢 ADR-099: Centralized Polygon Tolerances
import { POLYGON_TOLERANCES } from '../../config/tolerance-config';
// 🏢 ADR-362 Phase D1: Dim tool routing layer (Smart DIM + 4 manual overrides)
import { useDimToolRouting } from '../dimensions/useDimToolRouting';
// ADR-563 Φ4-Α: interactive cut-line dimension tool (dialog + 3-click + ghost-chain preview).
// Clicks are dispatched by useCanvasClickHandler (it has the levelManager accessor); this
// hook owns the lifecycle (dialog + arm) + the RAF preview (it has previewCanvasRef + scene).
import { useAutoDimCutlineTool } from '../dimensions/useAutoDimCutlineTool';
// ADR-362 hotfix: DetectableEntity for smart dim type detection via snap entityId
import type { DetectableEntity } from '../../systems/dimensions/dim-smart-detector';
// ADR-362 Phase L2: Center mark + centerline standalone tools
import { useCenterMarkCreate } from '../dimensions/useCenterMarkCreate';
// ADR-357 Phase 7: Snap Override orchestrator (single-use snap modifiers)
import { SnapOverrideOrchestrator } from '../../snapping/overrides/SnapOverrideOrchestrator';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { handleToolCompletion, resolveOrthoPolarStep, MEASURE_TOOLS_FOR_GUIDES, resolveDimPickContext, performDoubleClickFinish, commitM2PClick } from './drawing-handler-utils';
// ADR-562 Φ9 / ADR-357 — dim-creation alignment traces (commit parity with the hover preview).
import { resolveDimAlignmentTracking } from '../dimensions/dim-alignment-tracking';
import { dimensionCreateStore } from '../../stores/DimensionCreateStore';
import { ambientAlignmentConfigStore } from '../../systems/tracking/ambient-alignment-config-store';
import { isDimLineRefPhase } from '../dimensions/dim-skip-snap';
import { processDrawingHover } from './drawing-hover-handler';
export { MEASURE_TOOLS_FOR_GUIDES } from './drawing-handler-utils';

type Pt = { x: number, y: number };

export function useDrawingHandlers(
  activeTool: ToolType,
  onEntityCreated: (entity: Entity) => void,
  onToolChange: (tool: ToolType) => void,
  currentScene?: SceneModel,
  previewCanvasRef?: React.RefObject<PreviewCanvasHandle>,
  /** B36 (ADR-189): Called when a measurement tool completes — parent can offer "Create Guides" */
  onMeasurementComplete?: (points: ReadonlyArray<Pt>, tool: ToolType) => void,
) {
  // Canvas operations hook
  const canvasOps = useCanvasOperations();

  // 🏢 ADR-362 Phase D1: dim creation flow (Smart DIM + 4 manual overrides)
  const dimRouting = useDimToolRouting({ activeTool, onEntityCreated, previewCanvasRef, onToolChange });
  // ADR-362 Phase L2: center mark + centerline tools
  const centerMarkCreate = useCenterMarkCreate({ activeTool, onEntityCreated, previewCanvasRef });
  // ADR-563 Φ4-Α: interactive cut-line dimension tool — lifecycle + live ghost-chain preview.
  useAutoDimCutlineTool({ activeTool, previewCanvasRef, getScene: () => currentScene, onToolChange });

  // ADR-508 §line-cyan — η ΓΡΑΜΜΗ χρειάζεται τους ΙΔΙΟΥΣ face-snap στόχους με τον τοίχο για το flush
  // κούμπωμα + κυανές. Τα BIM tools (wall/beam/...) γεμίζουν το κοινό `sceneSnapTargetsStore` μέσω
  // `useSceneSnapTargetSync`· η γενική drawing διαδρομή ΔΕΝ το έκανε → στόχοι άδειοι όταν σχεδιαζόταν
  // γραμμή → καμία παρειά → καμία κυανή. Mount-άρουμε τον ΙΔΙΟ sync εδώ (μία πηγή) + refresh on
  // line-activate (στόχοι έτοιμοι πριν το 1ο ghost). Ο εσωτερικός `drawing:entity-created` listener
  // κρατά τους στόχους φρέσκους μετά.
  const refreshSnapTargets = useSceneSnapTargetSync(() => currentScene?.entities ?? []);
  // refresh on line-activate ΚΑΙ όταν αλλάζει το πλήθος οντοτήτων (νέα γραμμή committed στο ίδιο session —
  // το γενικό `completeEntity` δεν εκπέμπει `drawing:entity-created`, οπότε δεν αρκεί ο εσωτερικός listener).
  const lineSceneEntityCount = activeTool === 'line' ? (currentScene?.entities.length ?? 0) : -1;
  useEffect(() => {
    if (activeTool === 'line') refreshSnapTargets();
  }, [activeTool, lineSceneEntityCount, refreshSnapTargets]);

  // Drawing system
  const {
    state: drawingState,
    startDrawing,
    addPoint,
    finishEntity,
    finishPolyline,
    cancelDrawing,
    undoLastPoint,  // 🏢 ADR-047: Undo last point (AutoCAD U command)
    flipArcDirection,  // 🏢 ENTERPRISE (2026-01-31): Flip arc direction (AutoCAD X command)
    updatePreview,
    // 🏢 ADR-040: Direct access to preview entity (bypasses React state)
    getLatestPreviewEntity
  } = useUnifiedDrawing();

  // Snap functionality
  const { snapEnabled, enabledModes } = useSnapContext();
  const canvasElement = canvasOps.getCanvas();
  const canvasRef = { current: canvasElement };

  // Ortho (F8) + Polar (F10) — read via refs to avoid recreating callbacks on every toggle
  const { ortho, polar } = useCadToggles();
  const orthoOnRef = useRef(ortho.on);
  orthoOnRef.current = ortho.on;
  const polarOnRef = useRef(polar.on);
  polarOnRef.current = polar.on;

  // 🔲 GRID SNAP: Get grid step from RulersGrid context for grid snapping
  const { state: rulersGridState } = useRulersGridContext();
  const gridStep = rulersGridState?.grid?.visual?.step || 10;

  // 🏢 FIX (2026-02-20): Pass current zoom scale for correct pixel→world tolerance conversion
  const currentTransform = canvasOps.getTransform();
  const { snapManager, findSnapPoint } = useSnapManager(canvasRef, {
    scene: currentScene,
    gridStep, // 🔲 GRID SNAP: Pass grid step for grid snapping
    scale: currentTransform.scale,
    onSnapPoint: () => {},
  });

  // ADR-357 Phase 7: Stable ref for findSnapPoint — used inside onDrawingPoint /
  // onDrawingHover for override-filtered snap without adding findSnapPoint to
  // callback deps (prevents unnecessary re-creation on every scene update).
  const findSnapPointRef = useRef(findSnapPoint);
  findSnapPointRef.current = findSnapPoint;

  // ADR-357 Phase 4: hover-based Object Snap Tracking acquisition. We watch
  // the ImmediateSnapStore for a stable snap candidate — once the same point
  // has been hovered for `ACQUISITION_DURATION_MS`, the point joins the
  // TrackingPointStore FIFO and emits dashed alignment paths from then on.
  const trackingHoverRef = useRef<{
    point: Pt | null;
    snapType: string | null;
    hoverStartedAt: number;
  }>({ point: null, snapType: null, hoverStartedAt: 0 });

  // Propagate acquired points to the PreviewCanvas so the persistent `+`
  // markers stay anchored across drawPreview cycles (Phase 4 §5.3).
  useEffect(() => {
    if (!previewCanvasRef) return;
    const push = () => {
      previewCanvasRef.current?.setTrackingMarkers(getTrackingPointsSnapshot());
    };
    push();
    return subscribeTrackingPoints(push);
  }, [previewCanvasRef]);

  // Unified snap function
  const applySnap = useCallback((point: Pt): Pt => {
    if (!snapEnabled || !findSnapPoint) return point;
    try {
      const snapResult = findSnapPoint(point.x, point.y);
      if (snapResult && snapResult.found && snapResult.snappedPoint) {
        return snapResult.snappedPoint;
      }
    } catch (error) {
      if (DEBUG_DRAWING_HANDLERS) console.warn('🔺 Drawing snap error:', error, 'falling back to raw point');
    }
    return point;
  }, [snapEnabled, findSnapPoint]);

  // Drawing handlers
  // 🏢 ENTERPRISE (2026-01-27): IMMEDIATE preview clear on drawing completion
  // Pattern: Autodesk AutoCAD - Visual feedback must be synchronous
  // The return value from addPoint() indicates if drawing completed (e.g., 2nd click on line)
  // 🎯 ENTERPRISE (2026-01-27): ADR-047 - Close polygon on first-point click
  const onDrawingPoint = useCallback((p: Pt) => {
    // 🏢 ADR-362 Phase D1: route dim tools through the dedicated orchestrator.
    if (dimRouting.isDimTool) {
      // ADR-362 hotfix (2026-05-19): the dim-line-offset click (3rd click) is a free
      // position pick — skip-snap + entity-under-cursor resolution lives in the shared
      // helper so preview & commit stay in sync (see resolveDimPickContext).
      const { snapped, hoveredEntity, snapMode, secondEntity } = resolveDimPickContext(
        p, applySnap, findSnapPoint, currentScene?.entities,
      );
      // ADR-562 Φ9 / ADR-357 — commit parity: apply the SAME alignment override the hover
      // preview showed, so the committed defPoint equals the trace (WYSIWYG). Skipped on the
      // free dim-line offset pick (isDimLineRefPhase), matching OSNAP + the hover path.
      let alignedSnapped = snapped;
      if (!isDimLineRefPhase()) {
        const refPoints = dimensionCreateStore.get().clicks.map((c) => c.world);
        const ambientOn = ambientAlignmentConfigStore.getSnapshot().enabled;
        const composed = resolveDimAlignmentTracking(snapped, refPoints, {
          scale: canvasOps.getTransform().scale,
          polarEnabled: polarOnRef.current && !orthoOnRef.current,
          sceneEntities: ambientOn ? (currentScene?.entities ?? null) : null,
        });
        if (composed) alignedSnapped = composed.point;
      }
      // ADR-362 Phase J3 (gap #2) — forward snap mode + 2nd intersection host so
      // the association capture records intersection / parametric-nearest anchors.
      dimRouting.handlePoint(alignedSnapped, hoveredEntity, { snapMode, secondEntity });
      return;
    }
    // ADR-362 Phase L2: route center mark / centerline tools.
    if (centerMarkCreate.isCenterMarkTool) {
      centerMarkCreate.handlePoint(applySnap(p));
      return;
    }
    // 🔍 DEBUG (2026-01-31): Log drawing point for circle debugging
    if (DEBUG_DRAWING_HANDLERS) {
      console.debug('🎯 [onDrawingPoint]', {
        activeTool,
        point: p,
        drawingState: drawingState.currentTool,
        isDrawing: drawingState.isDrawing,
        tempPoints: drawingState.tempPoints?.length || 0
      });
    }

    // 🎯 ADR-047: CLOSE POLYGON ON FIRST-POINT CLICK (AutoCAD/BricsCAD pattern)
    // CRITICAL: Check distance BEFORE snap, using RAW point!
    // 🏢 ENTERPRISE: Unified close detection for ALL polygon-based tools (polygon, measure-area, overlays)
    const isClosableTool = activeTool === 'measure-area' || activeTool === 'polygon' || activeTool === 'hatch';
    const hasMinPoints = drawingState.tempPoints.length >= 3; // Need at least 3 points to close

    if (isClosableTool && hasMinPoints && drawingState.tempPoints[0]) {
      const firstPoint = drawingState.tempPoints[0];
      const distance = calculateDistance(p, firstPoint); // ✅ Use RAW point, NOT snapped!

      if (distance < POLYGON_TOLERANCES.CLOSE_DETECTION / canvasOps.getTransform().scale) {
        // 🎯 AUTO-CLOSE: User clicked near first point - close the polygon!
        // Ίδιο pattern με onDrawingDoubleClick — overlay completion first
        const { toolStyleStore } = require('../../stores/ToolStyleStore');
        const isOverlayCompletion = toolStyleStore.triggerOverlayCompletion();

        if (!isOverlayCompletion) {
          const newEntity = finishPolyline();
          if (newEntity && 'type' in newEntity && typeof newEntity.type === 'string') {
            onEntityCreated(newEntity as Entity);
          }
        }
        // 🏢 ENTERPRISE: Use centralized tool completion logic via ToolStateStore
        handleToolCompletion(activeTool);

        // Clear preview canvas
        if (previewCanvasRef?.current) {
          previewCanvasRef.current.clear();
        }
        // ADR-357 Phase 4: polygon auto-close also decays acquired points.
        TrackingPointStore.clearAll();
        return;
      }
    }

    // Normal point addition (not closing)
    const lastRef = drawingState.tempPoints[drawingState.tempPoints.length - 1];
    // ADR-363 — ORTHO(F8) → POLAR(F10) → fixed-step(F9+Q) via the shared SSoT
    // (`resolveOrthoPolarStep`), the EXACT pipeline the preview (`drawing-hover-handler`)
    // and the BIM commit (`applyBimDrawingConstraint`) use → commit ≡ ghost, zero duplication.
    // `constrained` = pre-step (for the m2p/from override branches); `stepped` = the value the
    // normal flow commits. Both no-op without an anchor or F9+Q.
    const opStep = lastRef
      ? resolveOrthoPolarStep(p, lastRef, { ortho: orthoOnRef.current, polar: polarOnRef.current })
      : null;
    const afterPolar = opStep ? opStep.constrained : p;
    const afterStep = opStep ? opStep.stepped : p;

    // ADR-357 Phase 7: Snap Override — handle special multi-click modes before normal snap.
    const snapOverride = SnapOverrideOrchestrator.getOverride();

    // M2P: accumulate 2 clicks → commit midpoint (first click does NOT add a drawing point).
    // SSoT flow lives in `commitM2PClick` (drawing-handler-utils) — keeps this hook lean.
    if (snapOverride === 'm2p') {
      commitM2PClick({
        seed: afterPolar,
        applySnap,
        commitPoint: (pt) => addPoint(pt, canvasOps.getTransformUtils()),
        clearPreview: () => previewCanvasRef?.current?.clear(),
        tempPoints: drawingState.tempPoints,
        activeTool,
        onMeasurementComplete,
      });
      return;
    }

    // From: first click = reference point (stored, not committed) → second click commits normally
    if (snapOverride === 'from') {
      const refAlreadySet = SnapOverrideOrchestrator.getFromReference() !== null;
      if (!refAlreadySet) {
        SnapOverrideOrchestrator.advanceFrom(applySnap(afterPolar));
        return; // reference stored — don't add to drawing
      }
      // second click: commit normally with snap, then consume override
      SnapOverrideOrchestrator.consumeOverride();
      // fall through to normal snappedPoint flow below
    }

    // Single-use engine override (including 'app' → INTERSECTION):
    // consume the override and apply override-filtered snap for this commit.
    let snappedPoint: Pt;
    if (snapOverride && snapOverride !== 'from' && snapOverride !== 'm2p') {
      SnapOverrideOrchestrator.consumeOverride();
      const engineTarget = snapOverride === 'app'
        ? ExtendedSnapType.INTERSECTION
        : snapOverride as ExtendedSnapType;
      let overrideSnapped: Pt | null = null;
      const findSnapFn = findSnapPointRef.current;
      if (findSnapFn) {
        try {
          const overrideResult = findSnapFn(afterStep.x, afterStep.y);
          if (overrideResult?.found && overrideResult.activeMode === engineTarget && overrideResult.snappedPoint) {
            overrideSnapped = overrideResult.snappedPoint;
          }
        } catch { /* snap error — fall back to applySnap */ }
      }
      snappedPoint = overrideSnapped ?? applySnap(afterStep);
    } else {
      snappedPoint = applySnap(afterStep);
    }

    // ADR-357 Phase 4 / 2026-07-04 — promote the alignment hit to the committed
    // point through the SAME SSoT as the preview (`resolveAlignmentTracking`:
    // acquired ⊕ ambient ⊕ segment-base clean-corner + adaptive quantize), so the
    // clicked point is IDENTICAL to the locked ghost (WYSIWYG). Previously this used
    // `resolveTrackingSnap` with acquired points ONLY — no ambient, no base corner,
    // no quantize → preview≠commit for line-endpoint alignment (rectangle wouldn't
    // actually close on click).
    let finalPoint = snappedPoint;
    const ambientOn = ambientAlignmentConfigStore.getSnapshot().enabled;
    const committedTracking = resolveAlignmentTracking(snappedPoint, {
      scale: canvasOps.getTransform().scale,
      polarEnabled: polarOnRef.current && !orthoOnRef.current,
      sceneEntities: ambientOn ? (currentScene?.entities ?? null) : null,
      segmentBase: lastRef ?? null,
    });
    if (committedTracking) finalPoint = committedTracking.point;

    // ADR-513 §line-parity — length/angle lock (Δαχτυλίδι Εντολών) ΠΡΙΝ το flush face-snap, ΑΚΡΙΒΩΣ
    // όπως το preview (drawing-hover-handler:268 → updatePreview → generateLinePreview). Χωρίς αυτό, lock
    // μέσω δαχτυλιδιού + κλικ θα κατέληγε στο μη-κλειδωμένο snapped σημείο → preview ≢ commit. No-op όταν
    // δεν υπάρχει ενεργό lock (ο helper επιστρέφει το σημείο αυτούσιο).
    if (activeTool === 'line' && lastRef) {
      finalPoint = applyLengthAngleLock(finalPoint, lastRef);
    }

    // ADR-508 §line-cyan — flush/κάθετο κούμπωμα της ΓΡΑΜΜΗΣ στο **1ο κλικ** (αρχή flush στην παρειά,
    // ΙΔΙΟΣ εγκέφαλος με preview → preview ≡ commit). Μετά το 1ο κλικ / μακριά από μέλος → αυτούσιο.
    // «Πραγματική κορυφή νικάει» (2026-07-04): locked ορατό OSNAP (fux) παρακάμπτει το flush → η αρχή
    // μένει ΑΚΡΙΒΩΣ στη γωνία. Χωρίς ορατό snap (ή grid/guide silent) → το flush aid δουλεύει κανονικά.
    if (activeTool === 'line' && drawingState.tempPoints.length === 0) {
      const lockedSnap = getImmediateSnap();
      const visibleOsnap = !!lockedSnap?.found && isVisibleSnapMode(lockedSnap.mode);
      if (!visibleOsnap) {
        finalPoint = resolveLineCommitPoint(finalPoint, resolveSceneUnits(currentScene));
      }
    }

    const transformUtils = canvasOps.getTransformUtils();
    const completed = addPoint(finalPoint, transformUtils);

    // ADR-357 Phase 2a — re-enable the legacy `canvas-click` window event so the
    // Dynamic Input phase hook (`useDynamicInputPhase`) can advance its anchor
    // (`firstClickPoint`) and field-unlock cycle. Before Phase 2a the overlay
    // was never mounted and no dispatcher existed; mounting it without this
    // signal would leave the live readout permanently in `first-point` phase.
    if (!completed) {
      window.dispatchEvent(new CustomEvent('canvas-click', { detail: { worldPoint: finalPoint } }));
    }

    // 🏢 ENTERPRISE (2026-01-30): Clear preview canvas when drawing completes
    // Note: Tool state is managed by useUnifiedDrawing based on allowsContinuous
    // - allowsContinuous=true → tool stays active for next drawing
    // - allowsContinuous=false → tool returns to select mode
    if (completed && previewCanvasRef?.current) {
      previewCanvasRef.current.clear();
    }

    // ADR-357 Phase 4: entity completion → decay all acquired tracking points
    // (matches AutoCAD: tracking memory is per-command, not cross-command).
    if (completed) {
      TrackingPointStore.clearAll();
    }

    // B36 (ADR-189): Notify parent when a measurement tool completes
    // Parent can then offer "Create Guides at measurement points"
    if (completed && onMeasurementComplete && MEASURE_TOOLS_FOR_GUIDES.has(activeTool)) {
      const allPoints = [...drawingState.tempPoints, finalPoint];
      onMeasurementComplete(allPoints, activeTool as ToolType);
    }
  }, [activeTool, drawingState.tempPoints, addPoint, finishPolyline, onEntityCreated, onToolChange, canvasOps, applySnap, previewCanvasRef, onMeasurementComplete]);

  const onDrawingHover = useCallback((p: Pt | null) => {
    // ADR-563 Φ4-Α: the cut-line tool owns the PreviewCanvas via its own RAF
    // callback (useAutoDimCutlineTool). Skip the generic drawing hover so it does
    // not clear/fight the live ghost-chain overlay.
    if (activeTool === 'auto-dim-cutline') return;
    processDrawingHover(p, {
      activeTool,
      isDimTool: dimRouting.isDimTool,
      // ADR-362 hotfix: forward hoveredEntity so smart dim detector sees the entity
      handleDimHover: (pt, hoveredEntity) => dimRouting.handleHover(pt, hoveredEntity),
      isCenterMarkTool: centerMarkCreate.isCenterMarkTool,
      handleCenterMarkHover: centerMarkCreate.handleHover,
      tempPoints: drawingState.tempPoints,
      applySnap,
      getTransformUtils: () => canvasOps.getTransformUtils(),
      getTransformScale: () => canvasOps.getTransform().scale,
      previewCanvasRef,
      orthoOnRef,
      polarOnRef,
      findSnapPointRef,
      trackingHoverRef,
      updatePreview,
      getLatestPreviewEntity,
      // ADR-362 hotfix: entity resolver — snap entityId → DetectableEntity
      resolveEntity: (id) =>
        currentScene?.entities.find((e) => e.id === id) as DetectableEntity | undefined,
      // ADR-357 ambient alignment: event-time scene reads (closed-over prop, no
      // React subscription in the hover hot path — ADR-040 safe).
      getSceneEntities: () => currentScene?.entities ?? [],
      getSceneUnitsScale: () => mmToSceneUnits(resolveSceneUnits(currentScene)),
    });
  }, [activeTool, dimRouting, centerMarkCreate, drawingState.tempPoints, applySnap, canvasOps, previewCanvasRef, updatePreview, getLatestPreviewEntity, currentScene]);
  
  const onDrawingCancel = useCallback(() => {
    // 🏢 ADR-362 Phase D1: cancel dim flow if active (does not stop tool deselect).
    if (dimRouting.isDimTool) dimRouting.handleCancel();
    // ADR-362 Phase L2: cancel center mark flow.
    if (centerMarkCreate.isCenterMarkTool) centerMarkCreate.handleCancel();
    cancelDrawing();
    // ADR-357 Phase 4: ESC / cancel decays acquired tracking points.
    TrackingPointStore.clearAll();
    // ADR-357 Phase 7: ESC clears any pending snap override.
    SnapOverrideOrchestrator.clearOverride();
    // 🏢 ENTERPRISE: Force select on cancel (user explicitly cancelled)
    handleToolCompletion(activeTool, true); // forceSelect=true for cancel
  }, [activeTool, cancelDrawing, dimRouting, onToolChange]);

  // Double click handler for finishing operations (SSoT: drawing-handler-utils)
  const onDrawingDoubleClick = useCallback(() => {
    performDoubleClickFinish(activeTool, {
      finishPolyline,
      onEntityCreated,
      cancelDrawing,
      clearPreview: () => previewCanvasRef?.current?.clear(),
    });
  }, [activeTool, finishPolyline, onEntityCreated, cancelDrawing, previewCanvasRef]);

  // Cancel all operations
  const cancelAllOperations = useCallback(() => {
    cancelDrawing();
    // ADR-357 Phase 4: hard cancel also decays acquired tracking points.
    TrackingPointStore.clearAll();
  }, [cancelDrawing]);

  return {
    // Systems
    drawingState,

    // Drawing actions
    startDrawing,

    // Event handlers
    onDrawingPoint,
    onDrawingHover,
    onDrawingCancel,
    onDrawingDoubleClick,
    onUndoLastPoint: undoLastPoint,  // 🏢 ADR-047: Undo last point (context menu)
    onFlipArc: flipArcDirection,  // 🏢 ENTERPRISE (2026-01-31): Flip arc direction (context menu)
    cancelAllOperations
  };
}
