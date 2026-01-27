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

// DEBUG FLAG
const DEBUG_UNIFIED_DRAWING = false;

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ENTERPRISE (2026-01-25): Drawing State Machine integration
import { useDrawingMachine, type DrawingStateType } from '../../core/state-machine';
// 🏢 ENTERPRISE (2026-01-26): Centralized tool configuration for continuous mode support
import { getToolMetadata } from '../../systems/tools/ToolStateManager';
import type { ToolType } from '../../ui/toolbar/types';
import type { AnySceneEntity, LineEntity, CircleEntity, PolylineEntity, RectangleEntity, AngleMeasurementEntity } from '../../types/scene';
// ✅ ENTERPRISE FIX: Import centralized PreviewGripPoint from entities
import type { PreviewGripPoint } from '../../types/entities';

// Extended entity types for drawing preview functionality
export interface PreviewPoint {
  id: string;
  type: 'point';
  position: Point2D;
  size: number;
  visible: boolean;
  layer: string;
  preview: boolean;
  // ✅ ENTERPRISE FIX: Remove duplicate properties - these are in BaseEntity
  // showPreviewGrips, measurement are inherited from BaseEntity
}

// ✅ ENTERPRISE FIX: Use centralized PreviewGripPoint from entities.ts

export interface ExtendedPolylineEntity extends PolylineEntity {
  // ✅ ENTERPRISE FIX: Remove duplicate properties - these are in BaseEntity
  // preview, showPreviewGrips, isOverlayPreview, measurement inherited from BaseEntity
  // previewGripPoints supports both Point2D[] and PreviewGripPoint[] via BaseEntity union type
  showEdgeDistances?: boolean;
}

export interface ExtendedCircleEntity extends CircleEntity {
  // ✅ ENTERPRISE FIX: Remove duplicate properties - these are in BaseEntity
  // preview, showPreviewGrips, measurement inherited from BaseEntity
  diameterMode?: boolean;
  twoPointDiameter?: boolean;
}

export interface ExtendedLineEntity extends LineEntity {
  // ✅ ENTERPRISE FIX: Remove duplicate properties - these are in BaseEntity
  // preview, showPreviewGrips, measurement, isOverlayPreview inherited from BaseEntity
  // previewGripPoints supports both Point2D[] and PreviewGripPoint[] via BaseEntity union type
  showEdgeDistances?: boolean;
}

export type ExtendedSceneEntity =
  | ExtendedPolylineEntity
  | ExtendedCircleEntity
  | ExtendedLineEntity
  | PreviewPoint
  | AnySceneEntity;
import { useLevels } from '../../systems/levels';
// Snap functionality removed - use ProSnapEngine directly if needed
import { useSnapContext } from '../../snapping/context/SnapContext';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { usePreviewMode } from '../usePreviewMode';
// 🗑️ REMOVED: useEntityStyles from ConfigurationProvider
// import { useEntityStyles } from '../useEntityStyles';
// 🆕 MERGE: Χρησιμοποιούμε το νέο useLineStyles από DxfSettingsProvider
import { useLineStyles } from '../../settings-provider';
// 🏢 ENTERPRISE: Import centralized CAD colors - ADR-014 color token migration
import { PANEL_LAYOUT } from '../../config/panel-tokens';

export type DrawingTool = 'select' | 'line' | 'rectangle' | 'circle' | 'circle-diameter' | 'circle-2p-diameter' | 'polyline' | 'polygon' | 'measure-distance' | 'measure-area' | 'measure-angle';

export interface DrawingState {
  currentTool: DrawingTool;
  isDrawing: boolean;
  previewEntity: ExtendedSceneEntity | null;
  tempPoints: Point2D[];
  measurementId?: string;
  isOverlayMode?: boolean; // 🔺 ΝΕΟ: Flag για overlay mode
  // ✅ ENTERPRISE: Missing properties used in StatusBar
  currentPoints: Point2D[];
  snapPoint: Point2D | null;
  snapType: string | null;
}

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

  // ===== ENTITY STYLES FOR PREVIEW & COMPLETION PHASES =====
  // 🆕 MERGE: Χρησιμοποιούμε το νέο useLineStyles από DxfSettingsProvider (merged)
  const linePreviewStyles = useLineStyles('preview');
  const lineCompletionStyles = useLineStyles('completion');


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

  const createEntityFromTool = useCallback((tool: DrawingTool, points: Point2D[]): ExtendedSceneEntity | null => {
    const id = `entity_${nextEntityIdRef.current++}`;
    
    switch (tool) {
      case 'line':
        if (points.length >= 2) {
          return {
            id,
            type: 'line',
            start: points[0],
            end: points[1],
            visible: true,
            layer: '0',
          } as LineEntity;
        }
        break;
      case 'measure-distance':
        if (points.length >= 2) {
          return {
            id,
            type: 'line',
            start: points[0],
            end: points[1],
            visible: true,
            layer: '0',
            measurement: true, // Mark as measurement entity
            // 🏢 ENTERPRISE (2026-01-27): Use bright green color for measurement lines
            // This matches the preview color and AutoCAD standard for measurements
            color: '#00FF00', // MEASUREMENT_LINE color from color-config.ts
            lineweight: 1,
            showEdgeDistances: true, // Show distance label on the measurement line
          } as LineEntity;
        }
        break;
      case 'rectangle':
        if (points.length >= 2) {
          const [p1, p2] = points;
          return {
            id,
            type: 'rectangle',
            corner1: p1,
            corner2: p2,
            visible: true,
            layer: '0',
          } as RectangleEntity;
        }
        break;
      case 'circle':
        if (points.length >= 2) {
          const [center, edge] = points;
          const radius = calculateDistance(center, edge);
          return {
            id,
            type: 'circle',
            center,
            radius,
            visible: true,
            layer: '0',
          } as CircleEntity;
        }
        break;
      case 'circle-diameter':
        if (points.length >= 2) {
          const [center, edge] = points;
          const radius = calculateDistance(center, edge);
          return {
            id,
            type: 'circle',
            center,
            radius,
            visible: true,
            layer: '0',
            diameterMode: true, // Special flag to indicate diameter mode
          } as CircleEntity;
        }
        break;
      case 'circle-2p-diameter':
        if (points.length >= 2) {
          // Δύο σημεία ως άκρα διαμέτρου - υπολογίζουμε κέντρο και ακτίνα
          const [p1, p2] = points;
          const center = {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
          };
          const radius = Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
          ) / 2; // Η διάμετρος διά 2
          return {
            id,
            type: 'circle',
            center,
            radius,
            visible: true,
            layer: '0',
            twoPointDiameter: true, // Ειδική σημαία για 2P diameter mode
          } as CircleEntity;
        }
        break;
      case 'polyline':
        if (points.length >= 2) {
          return {
            id,
            type: 'polyline',
            vertices: [...points],
            closed: false,
            visible: true,
            layer: '0',
          } as PolylineEntity; // ✅ ENTERPRISE FIX: Polyline entity type assertion
        }
        break;
      case 'measure-angle':
        if (points.length >= 2) {
          if (points.length === 2) {
            // Show preview with one line from point1 to point2 with distance labels
            const polyline = { // ✅ ENTERPRISE FIX: Let TypeScript infer the type
              id,
              type: 'polyline' as const,
              vertices: [points[0], points[1]],
              closed: false,
              visible: true,
              layer: '0',
              // ✅ ENTERPRISE FIX: Add required BaseEntity properties
              // 🏢 ENTERPRISE: Use centralized CAD color token - ADR-014
              color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
              lineweight: 1,
              opacity: 1.0,
              lineType: 'solid' as const
            };

            // Add flags for preview styling like polyline
            const extendedPolyline: ExtendedPolylineEntity = {
              ...polyline,
              preview: true,
              showEdgeDistances: true,
              isOverlayPreview: state.isOverlayMode === true
            } as ExtendedPolylineEntity;

            return extendedPolyline;
          } else if (points.length >= 3) {
            // Full angle measurement with 3+ points
            const [point1, vertex, point2] = points;
            
            // Calculate vectors
            const vector1 = { x: point1.x - vertex.x, y: point1.y - vertex.y };
            const vector2 = { x: point2.x - vertex.x, y: point2.y - vertex.y };
            
            // Calculate angle in radians
            const dot = vector1.x * vector2.x + vector1.y * vector2.y;
            const det = vector1.x * vector2.y - vector1.y * vector2.x;
            const angleRad = Math.atan2(det, dot);
            
            // Convert to degrees and make positive
            let angleDeg = (angleRad * 180) / Math.PI;
            if (angleDeg < 0) angleDeg += 360;
            
            return {
              id,
              type: 'angle-measurement',
              vertex: vertex,
              point1: point1,
              point2: point2,
              angle: angleDeg,
              visible: true,
              layer: '0',
              measurement: true, // Mark as measurement entity for hover detection
            } as AngleMeasurementEntity;
          }
        }
        break;
      case 'polygon':
        if (points.length >= 2) {
          return {
            id,
            type: 'polyline',
            vertices: [...points],
            closed: true,
            visible: true,
            layer: '0',
          } as PolylineEntity;
        }
        break;
      case 'measure-area':
        if (points.length >= 2) {
          return {
            id,
            type: 'polyline',
            vertices: [...points],
            closed: true,
            visible: true,
            layer: '0',
            measurement: true, // Mark as measurement entity
          } as PolylineEntity;
        }
        break;
    }
    return null;
  }, []);

  const addPoint = useCallback((worldPoint: Point2D, _transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }) => {
    // 🏢 ENTERPRISE (2026-01-25): Use state machine guard instead of manual checks
    // State machine provides canAddPoint which handles all edge cases
    if (!canAddPoint) {
      return;
    }

    // Snap is handled at DxfCanvas level, use worldPoint directly
    const snappedPoint = worldPoint;

    // 🏢 ENTERPRISE: Add point via state machine - this updates machineContext.points
    machineAddPoint(snappedPoint);

    // Calculate new points array for entity creation
    const newTempPoints = [...machineContext.points, snappedPoint];

    const isComplete = (tool: DrawingTool, points: Point2D[]) => {
      switch (tool) {
        case 'line':
        case 'measure-distance':
        case 'rectangle':
        case 'circle':
        case 'circle-diameter':
        case 'circle-2p-diameter':
          return points.length >= 2;
        case 'measure-angle':
          return points.length >= 3; // Complete after exactly 3 points for angle measurement
        case 'polyline':
        case 'polygon':
        case 'measure-area':
          return false; // These tools continue until manually finished
        default:
          return false;
      }
    };

    const currentTool = (machineContext.toolType as DrawingTool) || 'select';

    if (isComplete(currentTool, newTempPoints)) {
      const newEntity = createEntityFromTool(currentTool, newTempPoints);
      if (newEntity && currentLevelId) {
        // Apply completion settings from ColorPalettePanel (for line entities only)
        if (newEntity.type === 'line' && currentTool === 'line' && lineCompletionStyles) {
          // ✅ ENTERPRISE: Type-safe property assignment with proper assertion
          const lineEntity = newEntity as LineEntity;
          lineEntity.color = lineCompletionStyles.color;
          lineEntity.lineweight = lineCompletionStyles.lineWidth;
          lineEntity.opacity = lineCompletionStyles.opacity;
          // ✅ ENTERPRISE FIX: Convert LineType to entity LineType
          const convertLineType = (lineType: string): 'solid' | 'dashed' | 'dotted' | 'dashdot' | undefined => {
            switch (lineType) {
              case 'dash-dot': return 'dashdot';
              case 'dash-dot-dot': return 'dashdot'; // Fallback to dashdot
              case 'solid': return 'solid';
              case 'dashed': return 'dashed';
              case 'dotted': return 'dotted';
              default: return 'solid';
            }
          };
          lineEntity.lineType = convertLineType(lineCompletionStyles.lineType);
          lineEntity.dashScale = lineCompletionStyles.dashScale;
          lineEntity.lineCap = lineCompletionStyles.lineCap;
          lineEntity.lineJoin = lineCompletionStyles.lineJoin;
          lineEntity.dashOffset = lineCompletionStyles.dashOffset;
          lineEntity.breakAtCenter = lineCompletionStyles.breakAtCenter;
        }

        const scene = getLevelScene(currentLevelId);
        if (scene) {
          // Filter out extended types that are not compatible with AnySceneEntity
          if ('type' in newEntity && typeof newEntity.type === 'string') {
            const updatedScene = { ...scene, entities: [...scene.entities, newEntity as AnySceneEntity] };
            setLevelScene(currentLevelId, updatedScene);
          }
        }
      }
      // Return to normal mode after entity completion
      setMode('normal');

      // 🏢 ENTERPRISE: Use state machine to complete and reset
      machineComplete();
      machineReset();

      // 🏢 ENTERPRISE FIX (2026-01-26): Use centralized TOOL_DEFINITIONS for continuous mode
      // Pattern: AutoCAD/BricsCAD - tools with allowsContinuous=true stay active after completion
      // - Drawing tools (line, rectangle, circle, polygon): allowsContinuous=false → deselect
      // - Measurement tools (measure-*): allowsContinuous=true → remain active for consecutive use
      // - Polyline, Move, Pan: allowsContinuous=true → remain active
      const toolMetadata = getToolMetadata(currentTool as ToolType);
      if (!toolMetadata.allowsContinuous) {
        machineDeselectTool();
      } else {
        // 🏢 For continuous tools: re-select to restart the drawing process
        // This allows consecutive operations without manually re-selecting the tool
        machineSelectTool(currentTool);
      }

      // Reset local state (preview entity)
      setLocalState(prev => ({
        ...prev,
        previewEntity: null,
      }));
    } else {
      // Create a partial preview after adding the point
      let partialPreview: ExtendedSceneEntity | null = null;

      // Line tool doesn't create partial preview on first click
      if (currentTool === 'line' && newTempPoints.length === 1) {
        partialPreview = null;
      }

      // For measure-angle, show intermediate state
      if (currentTool === 'measure-angle' && newTempPoints.length >= 1) {
        if (newTempPoints.length === 1) {
          // After first click, show a dot
          partialPreview = {
            id: 'preview_partial',
            type: 'circle',
            center: newTempPoints[0],
            radius: 3,
            visible: true,
            layer: '0',
            measurement: true, // Mark as measurement for brown dots
            preview: true,     // ✅ Preview flag
            showPreviewGrips: true, // ✅ Preview grips
          } as ExtendedCircleEntity;
        } else if (newTempPoints.length === 2) {
          // After second click, show the first line with distance labels
          const basePartialPreview: PolylineEntity = {
            id: 'preview_partial',
            type: 'polyline',
            vertices: newTempPoints,
            closed: false,
            visible: true,
            layer: '0',
            // ✅ ENTERPRISE FIX: Add required BaseEntity properties
            // 🏢 ENTERPRISE: Use centralized CAD color token - ADR-014
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };

          // Add flags for preview styling like polyline
          const extendedPartialPreview: ExtendedPolylineEntity = {
            ...basePartialPreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
            measurement: true, // Mark as measurement for brown dots
          };
          partialPreview = extendedPartialPreview;
        }
      }

      // 🏢 ENTERPRISE: Update local state for preview entity only
      setLocalState(prev => ({
        ...prev,
        previewEntity: partialPreview,
      }));
    }
  }, [canAddPoint, machineAddPoint, machineContext.points, machineContext.toolType, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, setMode, lineCompletionStyles, machineComplete, machineReset, machineDeselectTool]);

  const updatePreview = useCallback((mousePoint: Point2D, _transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }) => {
    // 🏢 ENTERPRISE (2026-01-25): Use state machine for state checks
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';
    const isDrawingTool = currentTool && currentTool !== 'select';
    if (!isDrawingTool) {
      return;
    }

    // 🏢 ENTERPRISE: Update cursor position in state machine
    machineMoveCursor(mousePoint);

    // Snap is handled at DxfCanvas level, use mousePoint directly
    const snappedPoint = mousePoint;

    // Get current points from state machine
    const tempPoints = machineContext.points;

    // For single-point preview (starting a shape)
    if (tempPoints.length === 0) {
      // Show a small preview indicator at the mouse position
      let previewEntity: ExtendedSceneEntity | null = null;

      if (currentTool === 'line' || currentTool === 'measure-distance' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'circle-diameter' || currentTool === 'circle-2p-diameter' || currentTool === 'polygon' || currentTool === 'polyline' || currentTool === 'measure-area' || currentTool === 'measure-angle') {
        // For shapes that need two points, show a small dot at the start point
        const isMeasurementTool = currentTool === 'measure-distance' || currentTool === 'measure-area' || currentTool === 'measure-angle';

        previewEntity = {
          id: 'preview_start',
          type: 'point',
          position: snappedPoint,
          size: 4,
          visible: true,
          layer: '0',
          preview: true,
          showPreviewGrips: true,
          ...(isMeasurementTool && { measurement: true })
        } as PreviewPoint;
      }

      // 🏢 ADR-040: Update ref ONLY for immediate access (bypasses React async batching)
      // 🚀 PERFORMANCE (2026-01-27): Removed setLocalState to eliminate React re-renders on mouse move
      // PreviewCanvas reads directly from previewEntityRef - no state update needed
      previewEntityRef.current = previewEntity;
      return;
    }

    // For multi-point preview (showing the shape being drawn)
    const worldPoints = [...tempPoints, snappedPoint];
    const previewEntity = createEntityFromTool(currentTool, worldPoints);

    // Mark preview entity for special preview rendering with distance labels
    if (previewEntity && (currentTool === 'polygon' || currentTool === 'polyline' || currentTool === 'measure-angle' || currentTool === 'measure-area' || currentTool === 'line' || currentTool === 'measure-distance' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'circle-diameter' || currentTool === 'circle-2p-diameter')) {

      // Handle different entity types appropriately
      // 🏢 ENTERPRISE: Cast to Record<string, unknown> for applyPreviewSettings compatibility
      if (previewEntity.type === 'polyline') {
        const extendedPolyline = previewEntity as ExtendedPolylineEntity;
        extendedPolyline.preview = true;
        extendedPolyline.showEdgeDistances = true;
        extendedPolyline.showPreviewGrips = true;
        extendedPolyline.isOverlayPreview = localState.isOverlayMode === true;
        applyPreviewSettings(extendedPolyline as unknown as Record<string, unknown>);
      } else if (previewEntity.type === 'line') {
        const extendedLine = previewEntity as ExtendedLineEntity;
        extendedLine.preview = true;
        extendedLine.showEdgeDistances = true;
        extendedLine.showPreviewGrips = true;
        extendedLine.isOverlayPreview = localState.isOverlayMode === true;
        applyPreviewSettings(extendedLine as unknown as Record<string, unknown>);

        // Add grip points for line preview
        if (currentTool === 'line' && worldPoints.length >= 2) {
          extendedLine.previewGripPoints = [
            { position: worldPoints[0], type: 'start' },
            { position: snappedPoint, type: 'cursor' }
          ];
        }
      } else if (previewEntity.type === 'circle') {
        const extendedCircle = previewEntity as ExtendedCircleEntity;
        extendedCircle.preview = true;
        extendedCircle.showPreviewGrips = true;
        applyPreviewSettings(extendedCircle as unknown as Record<string, unknown>);
      } else if (previewEntity.type === 'rectangle') {
        // ✅ ENTERPRISE: Type-safe rectangle entity (uses polyline internally)
        const extendedRectangle = previewEntity as unknown as {
          preview?: boolean;
          showPreviewGrips?: boolean;
        } & typeof previewEntity;
        extendedRectangle.preview = true;
        extendedRectangle.showPreviewGrips = true;
        applyPreviewSettings(extendedRectangle as unknown as Record<string, unknown>);
      }

      if (DEBUG_UNIFIED_DRAWING) {
        const debugInfo: Record<string, unknown> = {
          entityType: previewEntity.type,
          currentTool: currentTool,
          isOverlayMode: localState.isOverlayMode
        };

        if (previewEntity.type === 'polyline') {
          const poly = previewEntity as ExtendedPolylineEntity;
          debugInfo.isOverlayPreview = poly.isOverlayPreview;
          debugInfo.preview = poly.preview;
          debugInfo.showEdgeDistances = poly.showEdgeDistances;
          debugInfo.showPreviewGrips = poly.showPreviewGrips;
          debugInfo.vertices = poly.vertices?.length || 0;
          debugInfo.closed = poly.closed;
        } else if (previewEntity.type === 'line') {
          const line = previewEntity as ExtendedLineEntity;
          debugInfo.isOverlayPreview = line.isOverlayPreview;
          debugInfo.preview = line.preview;
          debugInfo.showEdgeDistances = line.showEdgeDistances;
          debugInfo.showPreviewGrips = line.showPreviewGrips;
          debugInfo.previewGripPoints = line.previewGripPoints?.length || 0;
        }

      }

      // Add measurement flag for measurement tools
      const isMeasurementTool = currentTool === 'measure-distance' || currentTool === 'measure-area' || currentTool === 'measure-angle';
      if (isMeasurementTool) {
        if (previewEntity.type === 'polyline') {
          (previewEntity as ExtendedPolylineEntity).measurement = true;
        } else if (previewEntity.type === 'line') {
          (previewEntity as ExtendedLineEntity).measurement = true;
        } else if (previewEntity.type === 'circle') {
          (previewEntity as ExtendedCircleEntity).measurement = true;
        }
      }
    }

    // 🏢 ADR-040: Update ref ONLY for immediate access (bypasses React async batching)
    // 🚀 PERFORMANCE (2026-01-27): Removed setLocalState to eliminate React re-renders on mouse move
    // PreviewCanvas reads directly from previewEntityRef - no state update needed
    previewEntityRef.current = previewEntity;
  }, [machineContext.toolType, machineContext.points, machineMoveCursor, localState.isOverlayMode, createEntityFromTool, applyPreviewSettings]);

  const startDrawing = useCallback((tool: DrawingTool) => {
    // Set preview mode when drawing starts
    setMode('preview');

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

  const finishPolyline = useCallback(() => {
    // 🏢 ENTERPRISE (2026-01-25): Use state machine context
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';
    const tempPoints = machineContext.points;

    if ((currentTool === 'polyline' || currentTool === 'measure-angle' || currentTool === 'polygon' || currentTool === 'measure-area') && tempPoints.length >= 2) {
      // Remove duplicate points that might be added by double-click
      let cleanedPoints = [...tempPoints];

      // If last two points are very close (duplicate from double-click), remove the last one
      if (cleanedPoints.length >= 2) {
        const lastPoint = cleanedPoints[cleanedPoints.length - 1];
        const secondLastPoint = cleanedPoints[cleanedPoints.length - 2];

        const distance = Math.sqrt(
          Math.pow(lastPoint.x - secondLastPoint.x, 2) +
          Math.pow(lastPoint.y - secondLastPoint.y, 2)
        );

        // If points are closer than 1 pixel (likely duplicate from double-click)
        if (distance < 1.0) {
          cleanedPoints = cleanedPoints.slice(0, -1);
        }
      }

      const newEntity = createEntityFromTool(currentTool, cleanedPoints);

      // Σώσε entity για polygon και polyline
      if (newEntity && currentLevelId) {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
          // Filter out extended types that are not compatible with AnySceneEntity
          if ('type' in newEntity && typeof newEntity.type === 'string') {
            const updatedScene = { ...scene, entities: [...scene.entities, newEntity as AnySceneEntity] };
            setLevelScene(currentLevelId, updatedScene);
          }
        }
      }

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
