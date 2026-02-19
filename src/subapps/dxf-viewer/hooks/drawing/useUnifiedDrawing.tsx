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
import { useDrawingMachine } from '../../core/state-machine';
import { getToolMetadata } from '../../systems/tools/ToolStateManager';
import type { ToolType } from '../../ui/toolbar/types';
// Re-export types for backward compatibility (19 consumer files import from here)
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
import { useLineStyles } from '../../settings-provider';
import { completeEntity } from './completeEntity';
import { createEntityFromTool as createEntityFromToolPure, isEntityComplete } from './drawing-entity-builders';
import { generatePreviewEntity, applyPreviewStyling, createPartialPreview } from './drawing-preview-generator';

// ─── Module-level helpers ───────────────────────────────────────────────────

/** Measurement tools that create overlay entities */
const MEASUREMENT_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'measure-distance', 'measure-distance-continuous', 'measure-angle', 'measure-area',
  'measure-angle-measuregeom',
]);

/** Drawing tools that create persistent entities */
const ENTITY_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'line', 'rectangle', 'circle', 'circle-diameter', 'circle-2p-diameter',
  'circle-3p', 'circle-chord-sagitta', 'circle-2p-radius', 'circle-best-fit',
  'polyline', 'polygon', 'arc-3p', 'arc-cse', 'arc-sce',
]);

/** Resolves the level ID for entity placement (fallback to "0" for known tools) */
function getEffectiveLevelId(tool: DrawingTool, currentLevelId: string | null): string | null {
  if (currentLevelId) return currentLevelId;
  return (MEASUREMENT_TOOLS.has(tool) || ENTITY_TOOLS.has(tool)) ? '0' : null;
}

/** Removes the last point if it duplicates the previous one (distance < 1px from double-click) */
function removeDuplicateEndPoint(points: readonly Point2D[]): Point2D[] {
  const cleaned = [...points];
  if (cleaned.length >= 2) {
    const last = cleaned[cleaned.length - 1];
    const prev = cleaned[cleaned.length - 2];
    if (calculateDistance(last, prev) < 1.0) {
      cleaned.pop();
    }
  }
  return cleaned;
}

export function useUnifiedDrawing() {
  const {
    context: machineContext,
    isDrawing: machineIsDrawing,
    canAddPoint,
    selectTool: machineSelectTool,
    deselectTool: machineDeselectTool,
    addPoint: machineAddPoint,
    undoPoint: machineUndoPoint,
    moveCursor: machineMoveCursor,
    complete: machineComplete,
    cancel: machineCancel,
    reset: machineReset,
  } = useDrawingMachine({ useGlobal: true });

  const [localState, setLocalState] = useState<{
    previewEntity: ExtendedSceneEntity | null;
    isOverlayMode: boolean;
  }>({
    previewEntity: null,
    isOverlayMode: false,
  });

  // Sync ref for PreviewCanvas zero-latency rendering (bypasses React batching)
  const previewEntityRef = useRef<ExtendedSceneEntity | null>(null);
  // Entity IDs from continuous measurement session (for "Undo All")
  const continuousSessionEntityIdsRef = useRef<string[]>([]);
  // Arc direction toggle (X key / context menu)
  const arcFlippedRef = useRef<boolean>(false);

  const state: DrawingState = useMemo(() => ({
    currentTool: (machineContext.toolType as DrawingTool) || 'select',
    isDrawing: machineIsDrawing,
    previewEntity: localState.previewEntity,
    tempPoints: machineContext.points as Point2D[],
    isOverlayMode: localState.isOverlayMode,
    currentPoints: machineContext.points as Point2D[],
    snapPoint: machineContext.snapInfo.snapPoint,
    snapType: machineContext.snapInfo.snapType,
  }), [machineContext, machineIsDrawing, localState]);

  const {
    currentLevelId,
    getLevelScene,
    setLevelScene
  } = useLevels();

  const { setMode } = usePreviewMode();
  const linePreviewStyles = useLineStyles('preview');
  const nextEntityIdRef = useRef(1);

  /** Applies ColorPalettePanel preview settings to an entity */
  const applyPreviewSettings = useCallback((entity: Record<string, unknown>) => {
    if (!linePreviewStyles) return;

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

  const createEntityFromTool = useCallback((tool: DrawingTool, points: Point2D[]): ExtendedSceneEntity | null => {
    const id = `entity_${nextEntityIdRef.current++}`;
    return createEntityFromToolPure(tool, points, id, arcFlippedRef.current);
  }, []);

  /**
   * Add a point to the current drawing.
   * @returns true if the drawing was completed (entity created and added to scene)
   */
  const addPoint = useCallback((worldPoint: Point2D, _transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }): boolean => {
    if (!canAddPoint) return false;

    machineAddPoint(worldPoint);
    const newTempPoints = [...machineContext.points, worldPoint];
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';

    // ── Continuous measurement: create entity every 2 points, keep last ──
    if (currentTool === 'measure-distance-continuous' && newTempPoints.length >= 2 && newTempPoints.length % 2 === 0) {
      const lastTwoPoints = newTempPoints.slice(-2);
      completeEntity(createEntityFromTool('measure-distance', lastTwoPoints), {
        tool: currentTool as ToolType,
        levelId: currentLevelId || '0',
        getScene: getLevelScene,
        setScene: setLevelScene,
        trackForUndo: (id) => continuousSessionEntityIdsRef.current.push(id),
        skipToolPersistence: true,
      });

      // Keep last point for next segment (AutoCAD MEASUREGEOM pattern)
      machineReset();
      machineSelectTool(currentTool);
      machineAddPoint(newTempPoints[newTempPoints.length - 1]);

      const nextPreview = createEntityFromTool(currentTool, [newTempPoints[newTempPoints.length - 1]]);
      if (nextPreview) {
        previewEntityRef.current = nextPreview as ExtendedSceneEntity;
      }
      return false;
    }

    // ── Entity completion ────────────────────────────────────────────────
    if (isEntityComplete(currentTool, newTempPoints.length)) {
      const newEntity = createEntityFromTool(currentTool, newTempPoints);
      const effectiveLevelId = getEffectiveLevelId(currentTool, currentLevelId);

      if (newEntity && effectiveLevelId) {
        previewEntityRef.current = null;
        completeEntity(newEntity, {
          tool: currentTool as ToolType,
          levelId: effectiveLevelId,
          getScene: getLevelScene,
          setScene: setLevelScene,
        });
      }

      setMode('normal');
      machineComplete();
      machineReset();

      // Re-select for continuous tools, deselect for one-shot tools
      if (getToolMetadata(currentTool as ToolType).allowsContinuous) {
        machineSelectTool(currentTool);
      } else {
        machineDeselectTool();
      }

      setLocalState(prev => ({ ...prev, previewEntity: null }));
      return true;
    }

    // ── Not yet complete — show partial preview ──────────────────────────
    const partialPreview = createPartialPreview(currentTool, newTempPoints);
    setLocalState(prev => ({ ...prev, previewEntity: partialPreview }));
    return false;
  }, [canAddPoint, machineAddPoint, machineContext.points, machineContext.toolType, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, setMode, machineComplete, machineReset, machineDeselectTool]);

  const updatePreview = useCallback((mousePoint: Point2D, _transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }) => {
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';
    if (!currentTool || currentTool === 'select') return;

    machineMoveCursor(mousePoint);
    const tempPoints = machineContext.points;

    const previewEntity = generatePreviewEntity(
      currentTool, tempPoints, mousePoint, arcFlippedRef.current, createEntityFromTool
    );
    if (previewEntity) {
      applyPreviewStyling(
        previewEntity, currentTool,
        [...tempPoints, mousePoint], mousePoint,
        localState.isOverlayMode === true, applyPreviewSettings
      );
    }

    previewEntityRef.current = previewEntity;
  }, [machineContext.toolType, machineContext.points, machineMoveCursor, localState.isOverlayMode, createEntityFromTool, applyPreviewSettings]);

  const startDrawing = useCallback((tool: DrawingTool) => {
    setMode('preview');
    if (tool === 'measure-distance-continuous') {
      continuousSessionEntityIdsRef.current = [];
    }
    arcFlippedRef.current = false;
    machineSelectTool(tool);
    setLocalState({ previewEntity: null, isOverlayMode: false });
  }, [setMode, machineSelectTool]);

  const cancelDrawing = useCallback(() => {
    setMode('normal');
    continuousSessionEntityIdsRef.current = [];
    machineCancel('User cancelled drawing');
    machineReset();
    machineDeselectTool();
    previewEntityRef.current = null;
    setLocalState(prev => ({ ...prev, previewEntity: null }));
  }, [setMode, machineCancel, machineReset, machineDeselectTool]);

  /** Undo: for continuous measurement deletes ALL session entities, otherwise removes last point */
  const undoLastPoint = useCallback(() => {
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';

    // Continuous measurement: undo = delete ALL session entities
    if (currentTool === 'measure-distance-continuous') {
      const sessionEntityIds = continuousSessionEntityIdsRef.current;
      if (sessionEntityIds.length > 0) {
        const effectiveLevelId = currentLevelId || '0';
        const scene = getLevelScene(effectiveLevelId);
        if (scene) {
          const updatedEntities = scene.entities.filter(
            entity => !sessionEntityIds.includes(entity.id)
          );
          setLevelScene(effectiveLevelId, { ...scene, entities: updatedEntities });
        }
        continuousSessionEntityIdsRef.current = [];
      }
      machineCancel();
      machineReset();
      setMode('normal');
      previewEntityRef.current = null;
      setLocalState(prev => ({ ...prev, previewEntity: null }));
      return;
    }

    // Standard undo: remove last point, preview updates on next mouse move
    machineUndoPoint();
    previewEntityRef.current = null;
    setLocalState(prev => ({ ...prev, previewEntity: null }));
  }, [machineContext.toolType, machineUndoPoint, machineCancel, machineReset, setMode, currentLevelId, getLevelScene, setLevelScene]);

  /** Toggle arc direction (AutoCAD X command) */
  const flipArcDirection = useCallback(() => {
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';
    if (currentTool === 'arc-3p' || currentTool === 'arc-cse' || currentTool === 'arc-sce') {
      arcFlippedRef.current = !arcFlippedRef.current;
    }
  }, [machineContext.toolType]);

  const finishPolyline = useCallback(() => {
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';
    const cleanedPoints = removeDuplicateEndPoint(machineContext.points);

    // Circle best-fit: minimum 3 points (ADR-083)
    if (currentTool === 'circle-best-fit' && cleanedPoints.length >= 3) {
      const newEntity = createEntityFromTool(currentTool, cleanedPoints);
      if (newEntity) {
        completeEntity(newEntity, {
          tool: currentTool as ToolType,
          levelId: currentLevelId || '0',
          getScene: getLevelScene,
          setScene: setLevelScene,
        });
        setMode('normal');
        cancelDrawing();
        return newEntity;
      }
      return null;
    }

    // Polyline, polygon, measure-angle variants, measure-area: minimum 2 points
    const isFinishable =
      currentTool === 'polyline' || currentTool === 'measure-angle' ||
      currentTool === 'measure-angle-measuregeom' ||
      currentTool === 'polygon' || currentTool === 'measure-area';

    if (isFinishable && cleanedPoints.length >= 2) {
      const newEntity = createEntityFromTool(currentTool, cleanedPoints);
      completeEntity(newEntity, {
        tool: currentTool as ToolType,
        levelId: currentLevelId || '0',
        getScene: getLevelScene,
        setScene: setLevelScene,
      });
      setMode('normal');
      cancelDrawing();
      return newEntity;
    }

    return null;
  }, [machineContext.toolType, machineContext.points, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, cancelDrawing, setMode]);

  const startPolyline = useCallback((options: { onComplete?: (points: Point2D[]) => void; onCancel?: () => void } = {}) => {
    startDrawing('polyline');
    return {
      stop: () => {
        const points = [...machineContext.points];
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

  const startPolygon = useCallback((options: { onComplete?: (points: Point2D[]) => void; onCancel?: () => void; isOverlay?: boolean } = {}) => {
    setLocalState(prev => ({ ...prev, isOverlayMode: options.isOverlay || false }));
    startDrawing('polygon');
    return {
      stop: () => {
        const points = [...machineContext.points];
        setMode('normal');
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

  const getLatestPreviewEntity = useCallback(() => previewEntityRef.current, []);

  return {
    state,
    addPoint,
    updatePreview,
    startDrawing,
    cancelDrawing,
    undoLastPoint,
    flipArcDirection,
    finishEntity: finishPolyline,
    finishPolyline,
    startPolyline,
    startPolygon,
    setTool: startDrawing,
    finishDrawing: finishPolyline,
    snapConfig: null,
    getLatestPreviewEntity,
  };
}
