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

import { useCallback, useRef } from 'react';
import type { ToolType } from '../../ui/toolbar/types';
// 🏢 ENTERPRISE (2026-01-30): Centralized tool metadata for continuous mode
// 🏢 ENTERPRISE (2026-01-30): Centralized Tool State Store - ADR Tool Persistence
import { toolStateStore } from '../../stores/ToolStateStore';
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { useUnifiedDrawing } from './useUnifiedDrawing';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';
import { useCanvasOperations } from '../interfaces/useCanvasOperations';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
// 🏢 ADR-040: PreviewCanvas for direct preview rendering (performance optimization)
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
// 🎯 ADR-047: Distance calculation for close-on-first-point
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-099: Centralized Polygon Tolerances
import { POLYGON_TOLERANCES } from '../../config/tolerance-config';

type Pt = { x: number, y: number };

/**
 * 🏢 ENTERPRISE (2026-01-30): Centralized Tool Completion Handler
 *
 * Pattern: AutoCAD/BricsCAD - Tools with allowsContinuous=true stay active after completion
 *
 * REFACTORED: Now delegates to ToolStateStore for SINGLE SOURCE OF TRUTH
 * The store manages all tool state and notifies all subscribers (React components)
 *
 * @param tool - The current tool type
 * @param forceSelect - If true, always return to select (used for cancel operations)
 */
function handleToolCompletion(
  tool: ToolType,
  forceSelect: boolean = false
): void {
  // 🏢 ENTERPRISE: Delegate to centralized store
  // The store will:
  // 1. Check allowsContinuous metadata
  // 2. Update internal state (activeTool, previousTool)
  // 3. Notify all subscribers (React components auto-update)
  toolStateStore.handleToolCompletion(tool, forceSelect);
}

// 🏢 ENTERPRISE: Type-safe entity created callback
// 🏢 ADR-040: Optional previewCanvasRef for direct preview rendering (performance optimization)
export function useDrawingHandlers(
  activeTool: ToolType,
  onEntityCreated: (entity: Entity) => void,
  onToolChange: (tool: ToolType) => void,
  currentScene?: SceneModel,
  previewCanvasRef?: React.RefObject<PreviewCanvasHandle>
) {
  // Canvas operations hook
  const canvasOps = useCanvasOperations();

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
  const { snapEnabled, enabledModes, setCurrentSnapResult } = useSnapContext();
  const canvasElement = canvasOps.getCanvas();
  const canvasRef = { current: canvasElement };

  // 🔲 GRID SNAP: Get grid step from RulersGrid context for grid snapping
  const { state: rulersGridState } = useRulersGridContext();
  const gridStep = rulersGridState?.grid?.visual?.step || 10;

  const { snapManager, findSnapPoint } = useSnapManager(canvasRef, {
    scene: currentScene,
    gridStep, // 🔲 GRID SNAP: Pass grid step for grid snapping
    onSnapPoint: (point) => {

    }
  });

  // 🚀 PERFORMANCE: Throttle preview updates to requestAnimationFrame rate
  const previewThrottleRef = useRef<{
    rafId: number | null;
    pendingPoint: Pt | null;
  }>({
    rafId: null,
    pendingPoint: null
  });

  // Unified snap function
  // 🏢 ENTERPRISE (2026-02-17): Dead zone logic — prevents snapping back to the last placed point
  // AutoCAD pattern: After placing a point, nearby snap to the SAME location is suppressed
  // so the user can draw short entities without the cursor being pulled back.
  const applySnap = useCallback((point: Pt): Pt => {
    if (!snapEnabled || !findSnapPoint) {
      return point;
    }

    try {
      const snapResult = findSnapPoint(point.x, point.y);
      if (snapResult && snapResult.found && snapResult.snappedPoint) {
        // 🏢 Dead zone check: If drawing is active and snap result matches the last placed point,
        // skip snap to allow short entities. Without this, the cursor snaps back to the start
        // point making it impossible to create short lines/entities near existing endpoints.
        if (drawingState.isDrawing && drawingState.tempPoints.length > 0) {
          const lastPoint = drawingState.tempPoints[drawingState.tempPoints.length - 1];
          const dx = snapResult.snappedPoint.x - lastPoint.x;
          const dy = snapResult.snappedPoint.y - lastPoint.y;
          const distSq = dx * dx + dy * dy;
          // Float precision guard: 0.0001 = ~0.01 world units
          // This only blocks snapping to the EXACT same point, not nearby points
          if (distSq < 0.0001) {
            return point; // Use raw cursor position — don't snap back to start
          }
        }

        // Update snap context for visual indicator
        setCurrentSnapResult(snapResult);
        return snapResult.snappedPoint;
      }
    } catch (error) {
      if (DEBUG_DRAWING_HANDLERS) console.warn('🔺 Drawing snap error:', error, 'falling back to raw point');
    }

    return point;
  }, [snapEnabled, findSnapPoint, drawingState.isDrawing, drawingState.tempPoints, setCurrentSnapResult]);

  // Drawing handlers
  // 🏢 ENTERPRISE (2026-01-27): IMMEDIATE preview clear on drawing completion
  // Pattern: Autodesk AutoCAD - Visual feedback must be synchronous
  // The return value from addPoint() indicates if drawing completed (e.g., 2nd click on line)
  // 🎯 ENTERPRISE (2026-01-27): ADR-047 - Close polygon on first-point click
  const onDrawingPoint = useCallback((p: Pt) => {
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
    const isClosableTool = activeTool === 'measure-area' || activeTool === 'polygon';
    const hasMinPoints = drawingState.tempPoints.length >= 3; // Need at least 3 points to close

    if (isClosableTool && hasMinPoints && drawingState.tempPoints[0]) {
      const firstPoint = drawingState.tempPoints[0];
      const distance = calculateDistance(p, firstPoint); // ✅ Use RAW point, NOT snapped!

      if (distance < POLYGON_TOLERANCES.CLOSE_DETECTION) {
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
        return;
      }
    }

    // Normal point addition (not closing)
    const snappedPoint = applySnap(p);

    const transformUtils = canvasOps.getTransformUtils();
    const completed = addPoint(snappedPoint, transformUtils);

    // 🏢 ENTERPRISE (2026-01-30): Clear preview canvas when drawing completes
    // Note: Tool state is managed by useUnifiedDrawing based on allowsContinuous
    // - allowsContinuous=true → tool stays active for next drawing
    // - allowsContinuous=false → tool returns to select mode
    if (completed && previewCanvasRef?.current) {
      previewCanvasRef.current.clear();
    }
  }, [activeTool, drawingState.tempPoints, addPoint, finishPolyline, onEntityCreated, onToolChange, canvasOps, applySnap, previewCanvasRef]);

  const onDrawingHover = useCallback((p: Pt | null) => {
    // 🔍 STOP 1 DEBUG TRACE (2026-02-01): Comprehensive preview flow tracing
    if (DEBUG_DRAWING_HANDLERS) {
      console.debug('🔍 [onDrawingHover] ENTRY', {
        activeTool,
        hasPoint: !!p,
        worldPos: p ? `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})` : 'null',
        hasPreviewRef: !!previewCanvasRef?.current,
        timestamp: performance.now().toFixed(1)
      });
    }

    if (p) {
      // 🔍 PERF DEBUG (2026-02-02): Measure where the bottleneck is
      const t0 = performance.now();

      // 🚀 PERFORMANCE (2026-01-27): REMOVED RAF throttling for synchronous preview rendering
      // Now that CrosshairOverlay uses ImmediatePositionStore for zero-latency updates,
      // the preview grips must also update synchronously to avoid visible lag.
      // The mouse event handler is already called on each mousemove - no need to batch.
      const transformUtils = canvasOps.getTransformUtils();
      const t1 = performance.now();

      // Update the preview entity (calculates geometry, updates ref)
      updatePreview(p, transformUtils);
      const t2 = performance.now();

      // 🏢 ADR-040: Direct rendering to PreviewCanvas (ZERO React overhead)
      if (previewCanvasRef?.current) {
        const previewEntity = getLatestPreviewEntity();
        const t3 = performance.now();

        // 🔍 DEBUG TRACE: Log preview entity details
        if (DEBUG_DRAWING_HANDLERS) {
          console.debug('🔍 [onDrawingHover] PREVIEW ENTITY', {
            entityType: previewEntity?.type,
            hasEntity: !!previewEntity,
            callingDrawPreview: !!previewEntity,
            timestamp: performance.now().toFixed(1)
          });
        }

        if (previewEntity) {
          previewCanvasRef.current.drawPreview(previewEntity);
        } else {
          // 🔧 FIX (2026-01-27): Clear canvas when preview entity is null
          // This happens when drawing is completed (2nd click on line/measure-distance)
          // Without this, the old preview distance label stays visible
          previewCanvasRef.current.clear();
        }
        const t4 = performance.now();

        // 🔍 PERF DEBUG: Log timing only when explicitly enabled
        if (DEBUG_DRAWING_HANDLERS) {
          const total = t4 - t0;
          console.debug(`PERF_DRAWHOVER ${total.toFixed(1)}ms transform=${(t1-t0).toFixed(1)} preview=${(t2-t1).toFixed(1)} entity=${(t3-t2).toFixed(1)} draw=${(t4-t3).toFixed(1)}`);
        }
      }
    } else {
      // 🏢 ADR-040: Clear preview when mouse leaves
      if (previewCanvasRef?.current) {
        previewCanvasRef.current.clear();
      }
    }
  }, [updatePreview, canvasOps, getLatestPreviewEntity, previewCanvasRef, activeTool]);
  
  const onDrawingCancel = useCallback(() => {
    cancelDrawing();
    // 🏢 ENTERPRISE: Force select on cancel (user explicitly cancelled)
    handleToolCompletion(activeTool, true); // forceSelect=true for cancel
  }, [activeTool, cancelDrawing, onToolChange]);

  // Double click handler for finishing operations
  const onDrawingDoubleClick = useCallback(() => {
    // 🏢 ENTERPRISE (2026-01-27): Continuous tools that finish with double-click
    // 🏢 ENTERPRISE (2026-01-31): Added circle-best-fit - ADR-083
    if (activeTool === 'polyline' || activeTool === 'polygon' || activeTool === 'measure-area' || activeTool === 'measure-angle' || activeTool === 'measure-distance-continuous' || activeTool === 'circle-best-fit') {
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
