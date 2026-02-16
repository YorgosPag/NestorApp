/**
 * @module useUnifiedDrawing
 * @description Unified drawing system hook that combines entity creation with measurement-style interaction.
 * Provides a consistent interface for all drawing tools with snap integration and preview support.
 *
 * @example
 * ```tsx
 * const drawing = useUnifiedDrawing();
 *
 * // Start drawing a line
 * drawing.setTool('line');
 *
 * // Add points (with snap support)
 * drawing.addPoint({ x: 100, y: 100 });
 * drawing.addPoint({ x: 200, y: 200 });
 *
 * // Finish and get the created entity
 * const entity = drawing.finishDrawing();
 * ```
 *
 * @returns {Object} Drawing state and control methods
 * @returns {DrawingState} state - Current drawing state
 * @returns {Function} setTool - Set the active drawing tool
 * @returns {Function} addPoint - Add a point to the current drawing
 * @returns {Function} updatePreview - Update preview with mouse position
 * @returns {Function} finishDrawing - Complete the current drawing
 * @returns {Function} cancelDrawing - Cancel the current drawing
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ENTERPRISE (2026-01-25): Drawing State Machine integration
import { useDrawingMachine } from '../../core/state-machine';
// 🏢 ENTERPRISE (2026-01-26): Centralized tool configuration for continuous mode support
import { getToolMetadata } from '../../systems/tools/ToolStateManager';
import type { ToolType } from '../../ui/toolbar/types';
// 🏢 ENTERPRISE (2026-02-16): Types extracted to drawing-types.ts — re-export for backward compatibility
export type {
  PreviewPoint,
  ExtendedPolylineEntity,
  ExtendedCircleEntity,
  ExtendedLineEntity,
  ExtendedArcEntity,
  ExtendedSceneEntity,
  DrawingTool,
  DrawingState,
} from './drawing-types';
import type { DrawingTool, ExtendedSceneEntity, DrawingState } from './drawing-types';
import { useLevels } from '../../systems/levels';
import { calculateDistance } from '../../rendering/entities/shared';
import { usePreviewMode } from '../usePreviewMode';
// 🆕 MERGE: Χρησιμοποιούμε το νέο useLineStyles από DxfSettingsProvider
import { useLineStyles } from '../../settings-provider';
// 🏢 ENTERPRISE (2026-01-30): ADR-057 - Unified Entity Completion Pipeline
import { completeEntity } from './completeEntity';
// 🏢 ENTERPRISE (2026-02-16): Extracted pure functions for entity creation and preview generation
import { createEntityFromTool as createEntityFromToolPure, isEntityComplete } from './drawing-entity-builders';
import { generatePreviewEntity, applyPreviewStyling, createPartialPreview } from './drawing-preview-generator';

export function useUnifiedDrawing() {
  // 🏢 ENTERPRISE (2026-01-25): Use Drawing State Machine for state management
  // This replaces boolean flags with formal state machine (ADR-032)
  const {
    state: machineState,
    context: machineContext,
    isDrawing: machineIsDrawing,
    canComplete,
    canCancel,
    canAddPoint,
    selectTool: machineSelectTool,
    deselectTool: machineDeselectTool,
    addPoint: machineAddPoint,
    undoPoint: machineUndoPoint,  // 🏢 ADR-047: Undo last point
    moveCursor: machineMoveCursor,
    complete: machineComplete,
    cancel: machineCancel,
    reset: machineReset,
  } = useDrawingMachine({ useGlobal: true });

  // Local state for preview entity and overlay mode (not part of state machine)
  const [localState, setLocalState] = useState<{
    previewEntity: ExtendedSceneEntity | null;
    isOverlayMode: boolean;
  }>({
    previewEntity: null,
    isOverlayMode: false,
  });

  // 🏢 ADR-040: Preview entity ref for direct access (bypasses React state)
  // This ref is updated synchronously in updatePreview() for immediate access
  // Used by PreviewCanvas for zero-latency rendering
  const previewEntityRef = useRef<ExtendedSceneEntity | null>(null);

  // 🏢 ADR-053: Track entity IDs created during continuous measurement session
  // Used for "Undo All" functionality - deletes all measurements from current session
  const continuousSessionEntityIdsRef = useRef<string[]>([]);

  // 🏢 ENTERPRISE (2026-01-31): Arc flip state for direction toggle
  // When true, the arc direction is inverted (counterclockwise becomes clockwise and vice versa)
  // Toggled by "X" key or context menu "Αντιστροφή τόξου" option
  const arcFlippedRef = useRef<boolean>(false);

  // 🏢 ENTERPRISE: Derive DrawingState from state machine for backward compatibility
  const state: DrawingState = useMemo(() => ({
    currentTool: (machineContext.toolType as DrawingTool) || 'select',
    isDrawing: machineIsDrawing,
    previewEntity: localState.previewEntity,
    tempPoints: machineContext.points as Point2D[],
    isOverlayMode: localState.isOverlayMode,
    // ✅ ENTERPRISE: Map state machine context to DrawingState
    currentPoints: machineContext.points as Point2D[],
    snapPoint: machineContext.snapInfo.snapPoint,
    snapType: machineContext.snapInfo.snapType,
  }), [machineContext, machineIsDrawing, localState]);

  const {
    currentLevelId,
    getLevelScene,
    setLevelScene
  } = useLevels();

  // ===== ΠΡΟΣΘΗΚΗ PREVIEW MODE INTEGRATION =====
  const { setMode } = usePreviewMode();

  // ===== ENTITY STYLES FOR PREVIEW PHASE =====
  // 🆕 MERGE: Χρησιμοποιούμε το νέο useLineStyles από DxfSettingsProvider (merged)
  const linePreviewStyles = useLineStyles('preview');
  // 🏢 ADR-056: Completion styles read from completionStyleStore via applyCompletionStyles()
  // No React hook needed - store is synchronized by StyleManagerProvider


  const nextEntityIdRef = useRef(1);

  // ===== ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ HELPER FUNCTION ΓΙΑ PREVIEW SETTINGS =====
  // Applies ColorPalettePanel settings (DXF Settings → General + Specific Preview)
  // Used by: line, polyline, circle, rectangle entities
  // 🏢 ENTERPRISE: Type-safe entity with preview properties
  // Using Record<string, unknown> for flexibility with different entity types
  const applyPreviewSettings = useCallback((entity: Record<string, unknown>) => {
    // ✅ FIX (ChatGPT-5): Guard against undefined linePreviewStyles
    if (!linePreviewStyles) {
      return;
    }

    // ✅ FIX (ChatGPT-5): useLineStyles returns LineSettings directly, not { settings: LineSettings }
    entity.color = linePreviewStyles.color;
    entity.lineweight = linePreviewStyles.lineWidth;
    entity.opacity = linePreviewStyles.opacity;
    entity.lineType = linePreviewStyles.lineType;
    entity.dashScale = linePreviewStyles.dashScale;
    entity.lineCap = linePreviewStyles.lineCap;
    entity.lineJoin = linePreviewStyles.lineJoin;
    entity.dashOffset = linePreviewStyles.dashOffset;
    entity.breakAtCenter = linePreviewStyles.breakAtCenter;
  }, [linePreviewStyles]);

  // Snap functionality moved to DxfCanvas level

  // 🏢 ENTERPRISE (2026-02-16): Entity creation delegated to pure function in drawing-entity-builders.ts
  const createEntityFromTool = useCallback((tool: DrawingTool, points: Point2D[]): ExtendedSceneEntity | null => {
    const id = `entity_${nextEntityIdRef.current++}`;
    return createEntityFromToolPure(tool, points, id, arcFlippedRef.current);
  }, []);

  /**
   * 🏢 ENTERPRISE: Add point to current drawing
   * @returns {boolean} true if drawing was completed (for immediate preview clear)
   * Also emits 'drawing:complete' event for other listeners (Event Bus pattern)
   */
  const addPoint = useCallback((worldPoint: Point2D, _transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }): boolean => {
    // 🔍 DEBUG (2026-01-31): Log addPoint for circle debugging
    console.debug('➕ [addPoint] Called', {
      worldPoint,
      canAddPoint,
      currentTool: machineContext.toolType,
      pointCount: machineContext.points.length,
      machineState: machineIsDrawing ? 'drawing' : 'not-drawing'
    });

    // 🏢 ENTERPRISE (2026-01-25): Use state machine guard instead of manual checks
    // State machine provides canAddPoint which handles all edge cases
    if (!canAddPoint) {
      console.debug('❌ [addPoint] BLOCKED - canAddPoint is false');
      return false;
    }

    // Snap is handled at DxfCanvas level, use worldPoint directly
    const snappedPoint = worldPoint;

    // 🏢 ENTERPRISE: Add point via state machine - this updates machineContext.points
    machineAddPoint(snappedPoint);

    // Calculate new points array for entity creation
    const newTempPoints = [...machineContext.points, snappedPoint];

    // 🏢 ENTERPRISE (2026-02-16): isEntityComplete extracted to drawing-entity-builders.ts

    const currentTool = (machineContext.toolType as DrawingTool) || 'select';

    // 🏢 ENTERPRISE (2026-01-27): CONTINUOUS DISTANCE MEASUREMENT - AutoCAD Pattern
    // Pattern: AutoCAD MEASUREGEOM continuous mode
    // - Every 2nd point → create measurement entity
    // - Keep last point for next measurement
    // - Continue until double-click/Escape

    if (currentTool === 'measure-distance-continuous' && newTempPoints.length >= 2 && newTempPoints.length % 2 === 0) {
      // Get the last 2 points for this measurement
      const lastTwoPoints = newTempPoints.slice(-2);

      // Create measurement entity
      const measurementEntity = createEntityFromTool('measure-distance', lastTwoPoints);

      // 🏢 ADR-057: Unified Entity Completion Pipeline
      // Single entry point for ALL entity completions
      completeEntity(measurementEntity, {
        tool: currentTool as ToolType,
        levelId: currentLevelId || '0',
        getScene: getLevelScene,
        setScene: setLevelScene,
        trackForUndo: (id) => continuousSessionEntityIdsRef.current.push(id),
        skipToolPersistence: true, // Continuous mode - don't reset tool
      });

      // 🏢 ENTERPRISE: Keep last point for next measurement (AutoCAD pattern)
      // Reset machine to have only the last point
      machineReset();
      machineSelectTool(currentTool);
      machineAddPoint(newTempPoints[newTempPoints.length - 1]);

      // Update preview for next measurement
      const nextPreview = createEntityFromTool(currentTool, [newTempPoints[newTempPoints.length - 1]]);
      if (nextPreview) {
        previewEntityRef.current = nextPreview as ExtendedSceneEntity;
      }

      return false; // Early return - don't execute standard completion logic (not yet complete)
    }

    if (isEntityComplete(currentTool, newTempPoints.length)) {
      const newEntity = createEntityFromTool(currentTool, newTempPoints);

      // 🔍 DEBUG (2026-01-31): Log entity creation for circle debugging
      console.debug('🏗️ [addPoint] Entity creation', {
        currentTool,
        pointsCount: newTempPoints.length,
        newEntity: newEntity ? { type: newEntity.type, id: newEntity.id } : null,
        currentLevelId
      });

      // 🏢 ENTERPRISE (2026-01-30): CRITICAL FIX - ALL drawing tools fallback for missing level
      // Pattern: AutoCAD/DXF Standard - Layer "0" is always present for entities without explicit layer
      // If no currentLevelId, use default level "0" for ALL entities (measurements AND drawing tools)
      const isMeasurementTool = currentTool === 'measure-distance' || currentTool === 'measure-distance-continuous' || currentTool === 'measure-angle' || currentTool === 'measure-area';
      // 🏢 ENTERPRISE (2026-01-31): Added arc tools - ADR-059
      // 🏢 ENTERPRISE (2026-01-31): Added circle-3p, circle-chord-sagitta, circle-2p-radius, circle-best-fit - ADR-083
      const isDrawingTool = currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'circle-diameter' || currentTool === 'circle-2p-diameter' || currentTool === 'circle-3p' || currentTool === 'circle-chord-sagitta' || currentTool === 'circle-2p-radius' || currentTool === 'circle-best-fit' || currentTool === 'polyline' || currentTool === 'polygon' || currentTool === 'arc-3p' || currentTool === 'arc-cse' || currentTool === 'arc-sce';
      const effectiveLevelId = currentLevelId || ((isMeasurementTool || isDrawingTool) ? '0' : null);

      if (newEntity && effectiveLevelId) {
        // 🔍 DEBUG (2026-01-31): Log before completeEntity
        console.debug('✅ [addPoint] Calling completeEntity', {
          entityType: newEntity.type,
          entityId: newEntity.id,
          effectiveLevelId,
          // 🔍 DEBUG: Check counterclockwise BEFORE completeEntity
          counterclockwiseBeforeComplete: newEntity.type === 'arc' ? (newEntity as { counterclockwise?: boolean }).counterclockwise : 'N/A',
          fullEntityJSON: JSON.stringify(newEntity)
        });

        // 🏢 ENTERPRISE (2026-01-27): CRITICAL - Clear preview FIRST before any state updates!
        // Pattern: Autodesk AutoCAD - Visual feedback must be synchronous
        previewEntityRef.current = null;

        // 🏢 ADR-057: Unified Entity Completion Pipeline
        // Single entry point for ALL entity completions (styles, scene, events, tool persistence)
        completeEntity(newEntity, {
          tool: currentTool as ToolType,
          levelId: effectiveLevelId,
          getScene: getLevelScene,
          setScene: setLevelScene,
        });
      } else {
        // 🔍 DEBUG (2026-01-31): Log why completeEntity was NOT called
        console.debug('❌ [addPoint] completeEntity NOT called', {
          hasEntity: !!newEntity,
          effectiveLevelId
        });
      }
      // Return to normal mode after entity completion
      setMode('normal');

      // 🏢 ENTERPRISE: Use state machine to complete and reset
      machineComplete();
      machineReset();

      // Also update state machine for consistency (internal drawing state)
      const toolMetadata = getToolMetadata(currentTool as ToolType);
      if (toolMetadata.allowsContinuous) {
        // Re-select to restart the drawing process for next entity
        machineSelectTool(currentTool);
      } else {
        machineDeselectTool();
      }

      // Reset local state (preview entity)
      setLocalState(prev => ({
        ...prev,
        previewEntity: null,
      }));

      return true; // Drawing completed
    } else {
      // 🏢 ENTERPRISE (2026-02-16): Partial preview delegated to createPartialPreview()
      const partialPreview = createPartialPreview(currentTool, newTempPoints);
      setLocalState(prev => ({ ...prev, previewEntity: partialPreview }));
      return false; // Drawing not yet complete
    }
  }, [canAddPoint, machineAddPoint, machineContext.points, machineContext.toolType, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, setMode, machineComplete, machineReset, machineDeselectTool]);

  // 🏢 ENTERPRISE (2026-02-16): Preview generation delegated to pure functions in drawing-preview-generator.ts
  const updatePreview = useCallback((mousePoint: Point2D, _transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }) => {
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';
    if (!currentTool || currentTool === 'select') return;

    // Update cursor position in state machine
    machineMoveCursor(mousePoint);

    const tempPoints = machineContext.points;

    // Generate preview entity (extracted pure function)
    const previewEntity = generatePreviewEntity(
      currentTool, tempPoints, mousePoint, arcFlippedRef.current, createEntityFromTool
    );

    // Apply styling (extracted pure function)
    if (previewEntity) {
      applyPreviewStyling(
        previewEntity, currentTool,
        [...tempPoints, mousePoint], mousePoint,
        localState.isOverlayMode === true, applyPreviewSettings
      );
    }

    // 🏢 ADR-040: Update ref ONLY for immediate access (bypasses React async batching)
    previewEntityRef.current = previewEntity;
  }, [machineContext.toolType, machineContext.points, machineMoveCursor, localState.isOverlayMode, createEntityFromTool, applyPreviewSettings]);

  const startDrawing = useCallback((tool: DrawingTool) => {
    // 🔍 DEBUG (2026-01-31): Log startDrawing for circle debugging
    console.debug('🚀 [startDrawing] Called with tool:', tool);

    // Set preview mode when drawing starts
    setMode('preview');

    // 🏢 ADR-053: Clear continuous session when starting new drawing
    // This ensures each new continuous measurement session starts fresh
    if (tool === 'measure-distance-continuous') {
      continuousSessionEntityIdsRef.current = [];
    }

    // 🏢 ENTERPRISE (2026-01-31): Reset arc flip state for new drawing
    arcFlippedRef.current = false;

    // 🏢 ENTERPRISE: Use state machine for tool selection
    machineSelectTool(tool);

    // Reset local state
    setLocalState({
      previewEntity: null,
      isOverlayMode: false, // ✅ ΔΙΟΡΘΩΣΗ: Reset overlay mode για κανονικές σχεδιάσεις
    });
  }, [setMode, machineSelectTool]);

  const cancelDrawing = useCallback(() => {
    // Return to normal mode on cancel
    setMode('normal');

    // 🏢 ADR-053: Clear session tracking (but don't delete entities - user wants to KEEP them on Cancel)
    continuousSessionEntityIdsRef.current = [];

    // 🏢 ENTERPRISE: Use state machine for cancel
    machineCancel('User cancelled drawing');
    machineReset();
    machineDeselectTool();

    // 🚀 PERFORMANCE (2026-01-27): Clear preview ref for PreviewCanvas
    // CRITICAL: PreviewCanvas reads from ref, not state!
    previewEntityRef.current = null;

    // Reset local state
    setLocalState(prev => ({
      ...prev,
      previewEntity: null,
    }));
  }, [setMode, machineCancel, machineReset, machineDeselectTool]);

  // 🏢 ADR-053: Undo functionality - Context menu "Αναίρεση"
  // For measure-distance-continuous: DELETE ALL entities from current session
  // For other tools: Standard undo last point behavior
  const undoLastPoint = useCallback(() => {
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';

    // 🏢 ADR-053: Special handling for continuous measurement
    // User expects "Undo" to delete ALL measurements from this session
    if (currentTool === 'measure-distance-continuous') {
      const sessionEntityIds = continuousSessionEntityIdsRef.current;

      if (sessionEntityIds.length > 0) {
        // Delete ALL session entities from the scene
        const effectiveLevelId = currentLevelId || '0';
        const scene = getLevelScene(effectiveLevelId);

        if (scene) {
          // Filter out all entities that belong to this session
          const updatedEntities = scene.entities.filter(
            entity => !sessionEntityIds.includes(entity.id)
          );
          const updatedScene = { ...scene, entities: updatedEntities };
          setLevelScene(effectiveLevelId, updatedScene);
        }

        // Clear the session tracking array
        continuousSessionEntityIdsRef.current = [];
      }

      // Cancel drawing and reset
      machineCancel();
      machineReset();
      setMode('normal');
      previewEntityRef.current = null;
      setLocalState(prev => ({
        ...prev,
        previewEntity: null,
      }));

      return; // Early return - handled specially
    }

    // Standard undo for other tools: just remove last point
    machineUndoPoint();

    // Update preview to reflect point removal
    // The preview will be updated on next mouse move
    // Clear current preview entity since it may be stale
    previewEntityRef.current = null;
    setLocalState(prev => ({
      ...prev,
      previewEntity: null,
    }));
  }, [machineContext.toolType, machineUndoPoint, machineCancel, machineReset, setMode, currentLevelId, getLevelScene, setLevelScene]);

  // 🏢 ENTERPRISE (2026-01-31): Flip arc direction during drawing
  // Pattern: AutoCAD X command - toggles arc direction
  // Called by keyboard shortcut "X" or context menu "Αντιστροφή τόξου"
  const flipArcDirection = useCallback(() => {
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';

    // Only flip for arc tools
    if (currentTool === 'arc-3p' || currentTool === 'arc-cse' || currentTool === 'arc-sce') {
      arcFlippedRef.current = !arcFlippedRef.current;
      console.debug('🔄 [flipArcDirection] Arc flipped:', arcFlippedRef.current);

      // Force preview update by clearing and re-rendering
      // The next mouse move will apply the new flip state
      // For immediate feedback, we could trigger a preview refresh here
      // but mouse move will do it automatically
    }
  }, [machineContext.toolType]);

  const finishPolyline = useCallback(() => {
    // 🏢 ENTERPRISE (2026-01-25): Use state machine context
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';
    const tempPoints = machineContext.points;

    // 🏢 ENTERPRISE (2026-01-31): Circle best-fit requires minimum 3 points - ADR-083
    if (currentTool === 'circle-best-fit' && tempPoints.length >= 3) {
      // Remove duplicate points that might be added by double-click
      let cleanedPoints = [...tempPoints];

      if (cleanedPoints.length >= 2) {
        const lastPoint = cleanedPoints[cleanedPoints.length - 1];
        const secondLastPoint = cleanedPoints[cleanedPoints.length - 2];
        const distance = calculateDistance(lastPoint, secondLastPoint);
        if (distance < 1.0) {
          cleanedPoints = cleanedPoints.slice(0, -1);
        }
      }

      // Need at least 3 points after cleanup
      if (cleanedPoints.length >= 3) {
        const newEntity = createEntityFromTool(currentTool, cleanedPoints);

        if (newEntity) {
          const effectiveLevelId = currentLevelId || '0';
          completeEntity(newEntity, {
            tool: currentTool as ToolType,
            levelId: effectiveLevelId,
            getScene: getLevelScene,
            setScene: setLevelScene,
          });

          setMode('normal');
          cancelDrawing();
          return newEntity;
        }
      }
      return null;
    }

    if ((currentTool === 'polyline' || currentTool === 'measure-angle' || currentTool === 'polygon' || currentTool === 'measure-area') && tempPoints.length >= 2) {
      // Remove duplicate points that might be added by double-click
      let cleanedPoints = [...tempPoints];

      // If last two points are very close (duplicate from double-click), remove the last one
      if (cleanedPoints.length >= 2) {
        const lastPoint = cleanedPoints[cleanedPoints.length - 1];
        const secondLastPoint = cleanedPoints[cleanedPoints.length - 2];

        // 🏢 ADR-065: Use centralized distance calculation
        const distance = calculateDistance(lastPoint, secondLastPoint);

        // If points are closer than 1 pixel (likely duplicate from double-click)
        if (distance < 1.0) {
          cleanedPoints = cleanedPoints.slice(0, -1);
        }
      }

      const newEntity = createEntityFromTool(currentTool, cleanedPoints);

      // 🏢 ADR-057: Unified Entity Completion Pipeline
      // Single entry point for polyline/polygon/measure-area completions
      const effectiveLevelId = currentLevelId || '0';
      completeEntity(newEntity, {
        tool: currentTool as ToolType,
        levelId: effectiveLevelId,
        getScene: getLevelScene,
        setScene: setLevelScene,
      });

      // Return to normal mode after polyline completion
      setMode('normal');

      cancelDrawing();
      return newEntity;
    }
    return null;
  }, [machineContext.toolType, machineContext.points, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, cancelDrawing, setMode]);

  // Wrapper function for starting polyline drawing with callback
  const startPolyline = useCallback((options: { onComplete?: (points: Point2D[]) => void; onCancel?: () => void } = {}) => {
    startDrawing('polyline');

    return {
      stop: () => {
        // 🏢 ENTERPRISE: Get points from state machine context (spread to convert readonly to mutable)
        const points = [...machineContext.points];
        // Return to normal mode on polyline stop
        setMode('normal');

        cancelDrawing();
        if (options.onComplete && points.length >= 3) {
          options.onComplete(points);
        } else if (options.onCancel) {
          options.onCancel();
        }
      }
    };
  }, [startDrawing, cancelDrawing, machineContext.points, setMode]);

  // Start Polygon method for overlay creation
  const startPolygon = useCallback((options: { onComplete?: (points: Point2D[]) => void; onCancel?: () => void; isOverlay?: boolean } = {}) => {
    // Set overlay mode before starting drawing
    const overlayMode = options.isOverlay || false;

    // 🏢 ENTERPRISE: Use local state for overlay mode
    setLocalState(prev => ({ ...prev, isOverlayMode: overlayMode }));
    startDrawing('polygon');

    return {
      stop: () => {
        // 🏢 ENTERPRISE: Get points from state machine context (spread to convert readonly to mutable)
        const points = [...machineContext.points];
        // Return to normal mode on polygon stop
        setMode('normal');

        // Clear overlay mode
        setLocalState(prev => ({ ...prev, isOverlayMode: false }));
        cancelDrawing();
        if (options.onComplete && points.length >= 3) {
          options.onComplete(points);
        } else if (options.onCancel) {
          options.onCancel();
        }
      }
    };
  }, [startDrawing, cancelDrawing, machineContext.points, setMode]);

  // 🏢 ADR-040: Get latest preview entity directly from ref (bypasses React state)
  // Used by PreviewCanvas for zero-latency rendering
  const getLatestPreviewEntity = useCallback(() => {
    return previewEntityRef.current;
  }, []);

  return {
    state,
    addPoint,
    updatePreview,
    startDrawing,
    cancelDrawing,
    undoLastPoint,  // 🏢 ADR-047: Undo last point (AutoCAD U command)
    flipArcDirection,  // 🏢 ENTERPRISE (2026-01-31): Flip arc direction (AutoCAD X command)
    finishEntity: finishPolyline,
    finishPolyline,
    startPolyline,
    startPolygon,
    // ✅ ENTERPRISE FIX: Add missing methods for DrawingOrchestrator compatibility
    setTool: startDrawing, // Alias για compatibility
    finishDrawing: finishPolyline, // Alias για compatibility
    // ✅ ENTERPRISE FIX: Add snapConfig for entity creation compatibility
    snapConfig: null, // Placeholder - Snap config handled at DxfCanvas level
    // 🏢 ADR-040: Direct access to preview entity (bypasses React state for performance)
    getLatestPreviewEntity,
  };
}
