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

// DEBUG FLAG
const DEBUG_DRAWING_HANDLERS = false; // 🔍 DISABLED - set to true only for debugging

import { useCallback, useRef, useMemo } from 'react';
import type { ToolType } from '../../ui/toolbar/types';
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { useUnifiedDrawing, type ExtendedSceneEntity, type DrawingTool } from './useUnifiedDrawing';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';
import { useCanvasOperations } from '../interfaces/useCanvasOperations';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
// 🏢 ADR-040: PreviewCanvas for direct preview rendering (performance optimization)
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
// 🎯 ADR-047: Distance calculation for close-on-first-point
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';

type Pt = { x: number, y: number };

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
  const applySnap = useCallback((point: Pt): Pt => {
    if (!snapEnabled || !findSnapPoint) {

      return point;
    }
    
    try {
      const snapResult = findSnapPoint(point.x, point.y);
      if (snapResult && snapResult.found && snapResult.snappedPoint) {

        return snapResult.snappedPoint;
      } else {

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
    // 🔍 DEBUG (2026-01-27): Diagnostic logging for coordinate offset issue
    console.log(`🎯 [onDrawingPoint] Received WORLD point: x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}`);

    // 🎯 ADR-047: CLOSE POLYGON ON FIRST-POINT CLICK (AutoCAD/BricsCAD pattern)
    // CRITICAL: Check distance BEFORE snap, using RAW point!
    const isAreaTool = activeTool === 'measure-area';
    const hasMinPoints = drawingState.tempPoints.length >= 3; // Need at least 3 points to close

    console.log(`🔍 [onDrawingPoint] ADR-047 STATE CHECK:`, JSON.stringify({
      activeTool,
      isAreaTool,
      tempPointsCount: drawingState.tempPoints.length,
      hasMinPoints,
      firstPoint: drawingState.tempPoints[0],
      allConditionsMet: isAreaTool && hasMinPoints && !!drawingState.tempPoints[0]
    }, null, 2));

    if (isAreaTool && hasMinPoints && drawingState.tempPoints[0]) {
      const firstPoint = drawingState.tempPoints[0];
      const distance = calculateDistance(p, firstPoint); // ✅ Use RAW point, NOT snapped!
      const CLOSE_TOLERANCE = 20; // 20 world units tolerance (generous for user-friendly closing)

      console.log(`🔄 [onDrawingPoint] ADR-047 Close check:`, {
        rawPoint: p,
        firstPoint,
        distance: distance.toFixed(2),
        tolerance: CLOSE_TOLERANCE,
        willClose: distance < CLOSE_TOLERANCE
      });

      if (distance < CLOSE_TOLERANCE) {
        // 🎯 AUTO-CLOSE: User clicked near first point - close the polygon!
        console.log(`✅ [onDrawingPoint] ADR-047 AUTO-CLOSE: Closing polygon at first point`);
        const newEntity = finishPolyline();
        if (newEntity && 'type' in newEntity && typeof newEntity.type === 'string') {
          onEntityCreated(newEntity as Entity);
        }
        onToolChange('select');

        // Clear preview canvas
        if (previewCanvasRef?.current) {
          previewCanvasRef.current.clear();
        }
        return;
      }
    } else {
      console.log(`❌ [onDrawingPoint] ADR-047 SKIPPED: Conditions not met for auto-close`);
    }

    // Normal point addition (not closing)
    const snappedPoint = applySnap(p);
    console.log(`🎯 [onDrawingPoint] After snap: x=${snappedPoint.x.toFixed(2)}, y=${snappedPoint.y.toFixed(2)}`);

    const transformUtils = canvasOps.getTransformUtils();
    const completed = addPoint(snappedPoint, transformUtils);

    // 🔧 FIX (2026-01-27): IMMEDIATE clear prevents "two numbers" bug
    // This is the SYNCHRONOUS path - Event Bus is backup for other listeners
    if (completed && previewCanvasRef?.current) {
      previewCanvasRef.current.clear();
    }
  }, [activeTool, drawingState.tempPoints, addPoint, finishPolyline, onEntityCreated, onToolChange, canvasOps, applySnap, previewCanvasRef]);

  const onDrawingHover = useCallback((p: Pt | null) => {
    if (DEBUG_DRAWING_HANDLERS) console.log('🔍 [onDrawingHover] Called with point:', p);

    if (p) {
      // 🚀 PERFORMANCE (2026-01-27): REMOVED RAF throttling for synchronous preview rendering
      // Now that CrosshairOverlay uses ImmediatePositionStore for zero-latency updates,
      // the preview grips must also update synchronously to avoid visible lag.
      // The mouse event handler is already called on each mousemove - no need to batch.
      const transformUtils = canvasOps.getTransformUtils();

      // Update the preview entity (calculates geometry, updates ref)
      updatePreview(p, transformUtils);

      // 🏢 ADR-040: Direct rendering to PreviewCanvas (ZERO React overhead)
      if (previewCanvasRef?.current) {
        const previewEntity = getLatestPreviewEntity();
        if (previewEntity) {
          previewCanvasRef.current.drawPreview(previewEntity);
        } else {
          // 🔧 FIX (2026-01-27): Clear canvas when preview entity is null
          // This happens when drawing is completed (2nd click on line/measure-distance)
          // Without this, the old preview distance label stays visible
          previewCanvasRef.current.clear();
        }
      }
    } else {
      // 🏢 ADR-040: Clear preview when mouse leaves
      if (previewCanvasRef?.current) {
        previewCanvasRef.current.clear();
      }
    }
  }, [updatePreview, canvasOps, getLatestPreviewEntity, previewCanvasRef]);
  
  const onDrawingCancel = useCallback(() => {
    console.log(`🚫 [onDrawingCancel] ADR-047 CANCEL DRAWING CALLED!`, {
      activeTool,
      tempPointsCount: drawingState.tempPoints.length
    });
    cancelDrawing();
    onToolChange('select');
  }, [cancelDrawing, onToolChange, activeTool, drawingState.tempPoints]);

  // Double click handler for finishing operations
  const onDrawingDoubleClick = useCallback(() => {

    // 🏢 ENTERPRISE (2026-01-27): Continuous tools that finish with double-click
    if (activeTool === 'polyline' || activeTool === 'polygon' || activeTool === 'measure-area' || activeTool === 'measure-angle' || activeTool === 'measure-distance-continuous') {
      // Check for overlay completion callback first
      const { toolStyleStore } = require('../../stores/ToolStyleStore');
      const isOverlayCompletion = toolStyleStore.triggerOverlayCompletion();

      if (!isOverlayCompletion) {
        // Standard DXF polyline completion

        const newEntity = finishPolyline();
        if(newEntity) {
          // Filter out extended types that are not compatible with base Entity type
          if ('type' in newEntity && typeof newEntity.type === 'string') {
            onEntityCreated(newEntity as Entity);
          }
        }
        onToolChange('select');
      } else {

      }
    }
  }, [activeTool, finishPolyline, onEntityCreated, onToolChange]);

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
    cancelAllOperations
  };
}