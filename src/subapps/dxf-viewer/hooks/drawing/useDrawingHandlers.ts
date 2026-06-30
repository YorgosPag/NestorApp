/**
 * useDrawingHandlers - Drawing Interaction Handlers
 *
 * @description
 * Κεντρικό hook που διαχειρίζεται όλα τα drawing και measurement interaction handlers.
 * Συνδυάζει unified drawing, snap system, και canvas operations.
 *
 * @features
 * - 🖱️ Mouse event handlers (click, move, right-click)
 * - 🔄 Drawing state management (useUnifiedDrawing)
 * - 📍 Snap system integration (grid, endpoint, midpoint, intersection)
 * - 📏 Measurement tools (distance, area, radius)
 * - 🎨 Settings integration (preview/completion colors)
 * - ✅ Entity creation & lifecycle
 *
 * @handlers
 * - `handleCanvasClick(point)` - Main click handler (snap + drawing)
 * - `handleMouseMove(point)` - Preview update handler
 * - `handleRightClick()` - Finish polyline / Cancel drawing
 * - `handleKeyPress(key)` - ESC to cancel, Enter to finish
 *
 * @integration
 * ```
 * useDrawingHandlers (THIS)
 *   ├── useUnifiedDrawing (drawing state + settings)
 *   ├── useSnapManager (snap point detection)
 *   └── useCanvasOperations (canvas queries)
 * ```
 *
 * @usage
 * ```tsx
 * const {
 *   handleCanvasClick,
 *   handleMouseMove,
 *   handleRightClick
 * } = useDrawingHandlers(activeTool, onEntityCreated, onToolChange, currentScene);
 * ```
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
import { useUnifiedDrawing } from './useUnifiedDrawing';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';
import { useCanvasOperations } from '../interfaces/useCanvasOperations';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
// 🏢 ADR-040: PreviewCanvas for direct preview rendering (performance optimization)
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
// 🎯 ADR-047: Distance calculation for close-on-first-point
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// ADR-357 Phase 1: Polar Tracking
import { polarTrackingStore } from '../../systems/constraints/polar-tracking-store';
// ADR-357 Phase 4: Object Snap Tracking
import {
  TrackingPointStore,
  subscribeTrackingPoints,
  getTrackingPointsSnapshot,
} from '../../systems/tracking/TrackingPointStore';
import { resolveTrackingSnap } from '../../systems/tracking/tracking-resolver';
import { pixelsToWorld } from '../../rendering/utils/viewport-scale';
// 🏢 ADR-099: Centralized Polygon Tolerances
import { POLYGON_TOLERANCES } from '../../config/tolerance-config';
// 🏢 ADR-362 Phase D1: Dim tool routing layer (Smart DIM + 4 manual overrides)
import { useDimToolRouting } from '../dimensions/useDimToolRouting';
// ADR-362 hotfix: DetectableEntity for smart dim type detection via snap entityId
import type { DetectableEntity } from '../../systems/dimensions/dim-smart-detector';
// ADR-362 Phase L2: Center mark + centerline standalone tools
import { useCenterMarkCreate } from '../dimensions/useCenterMarkCreate';
// ADR-357 Phase 7: Snap Override orchestrator (single-use snap modifiers)
import { SnapOverrideOrchestrator } from '../../snapping/overrides/SnapOverrideOrchestrator';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { handleToolCompletion, resolveOrthoPolarStep, MEASURE_TOOLS_FOR_GUIDES, resolveDimPickContext } from './drawing-handler-utils';
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
      // ADR-362 Phase J3 (gap #2) — forward snap mode + 2nd intersection host so
      // the association capture records intersection / parametric-nearest anchors.
      dimRouting.handlePoint(snapped, hoveredEntity, { snapMode, secondEntity });
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

    // M2P: accumulate 2 clicks → commit midpoint (first click does NOT add a drawing point)
    if (snapOverride === 'm2p') {
      const midPoint = SnapOverrideOrchestrator.advanceM2P(applySnap(afterPolar));
      if (!midPoint) return; // first M2P click — waiting for second
      // second click: midPoint is ready → commit it, clear override
      SnapOverrideOrchestrator.clearOverride();
      const transformUtils = canvasOps.getTransformUtils();
      const completed = addPoint(midPoint, transformUtils);
      if (!completed) {
        window.dispatchEvent(new CustomEvent('canvas-click', { detail: { worldPoint: midPoint } }));
      }
      if (completed && previewCanvasRef?.current) previewCanvasRef.current.clear();
      if (completed) TrackingPointStore.clearAll();
      if (completed && onMeasurementComplete && MEASURE_TOOLS_FOR_GUIDES.has(activeTool)) {
        const allPoints = [...drawingState.tempPoints, midPoint];
        onMeasurementComplete(allPoints, activeTool as ToolType);
      }
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

    // ADR-357 Phase 4: Object Snap Tracking — promote alignment-path hit to
    // the committed point so clicks lock onto path intersections / projections.
    const acquired = TrackingPointStore.getPoints();
    let finalPoint = snappedPoint;
    if (acquired.length > 0) {
      const worldTolerance = pixelsToWorld(3, canvasOps.getTransform().scale);
      const trackingResult = resolveTrackingSnap(snappedPoint, acquired, {
        incrementAngle: polarTrackingStore.incrementAngle,
        additionalAngles: polarTrackingStore.additionalAngles,
        polarEnabled: polarOnRef.current && !orthoOnRef.current,
      }, worldTolerance);
      if (trackingResult) finalPoint = trackingResult.point;
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

  // Double click handler for finishing operations
  const onDrawingDoubleClick = useCallback(() => {
    // 🏢 ENTERPRISE (2026-01-27): Continuous tools that finish with double-click
    // 🏢 ENTERPRISE (2026-01-31): Added circle-best-fit - ADR-083
    if (activeTool === 'polyline' || activeTool === 'polygon' || activeTool === 'hatch' || activeTool === 'measure-area' || activeTool === 'measure-angle' || activeTool === 'measure-angle-measuregeom' || activeTool === 'measure-distance-continuous' || activeTool === 'circle-best-fit') {
      // Check for overlay completion callback first
      const { toolStyleStore } = require('../../stores/ToolStyleStore');
      const isOverlayCompletion = toolStyleStore.triggerOverlayCompletion();

      if (!isOverlayCompletion) {
        // 🏢 ADR-053 FIX (2026-01-30): Special handling for measure-distance-continuous
        // This tool auto-creates entities every 2 points, so "finish" just means stop drawing
        // No entity creation needed - just cancel and switch to select
        if (activeTool === 'measure-distance-continuous') {
          cancelDrawing();
          // Clear preview canvas
          if (previewCanvasRef?.current) {
            previewCanvasRef.current.clear();
          }
          // 🏢 ENTERPRISE: Use centralized tool completion logic via ToolStateStore
          handleToolCompletion(activeTool);
          return;
        }

        // Standard DXF polyline completion (polyline, polygon, measure-area, measure-angle)
        const newEntity = finishPolyline();
        if(newEntity) {
          // Filter out extended types that are not compatible with base Entity type
          if ('type' in newEntity && typeof newEntity.type === 'string') {
            onEntityCreated(newEntity as Entity);
          }
        }
        // 🏢 ENTERPRISE: Use centralized tool completion logic via ToolStateStore
        handleToolCompletion(activeTool);
      }
    }
  }, [activeTool, finishPolyline, onEntityCreated, onToolChange, cancelDrawing, previewCanvasRef]);

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
