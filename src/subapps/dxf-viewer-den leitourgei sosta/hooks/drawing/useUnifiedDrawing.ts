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

import { useState, useCallback, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, LineEntity, CircleEntity, PolylineEntity, RectangleEntity, AngleMeasurementEntity } from '../../types/scene';

// Extended entity types for drawing preview functionality
export interface PreviewPoint {
  id: string;
  type: 'point';
  position: Point2D;
  size: number;
  visible: boolean;
  layer: string;
  preview: boolean;
  showPreviewGrips: boolean;
  measurement?: boolean;
}

export interface PreviewGripPoint {
  position: Point2D;
  type: 'start' | 'end' | 'cursor' | 'vertex';
}

export interface ExtendedPolylineEntity extends PolylineEntity {
  preview?: boolean;
  showEdgeDistances?: boolean;
  showPreviewGrips?: boolean;
  isOverlayPreview?: boolean;
  measurement?: boolean;
  previewGripPoints?: PreviewGripPoint[];
}

export interface ExtendedCircleEntity extends CircleEntity {
  preview?: boolean;
  showPreviewGrips?: boolean;
  measurement?: boolean;
  diameterMode?: boolean;
  twoPointDiameter?: boolean;
}

export interface ExtendedLineEntity extends LineEntity {
  preview?: boolean;
  showEdgeDistances?: boolean;
  showPreviewGrips?: boolean;
  isOverlayPreview?: boolean;
  measurement?: boolean;
  previewGripPoints?: PreviewGripPoint[];
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

export type DrawingTool = 'select' | 'line' | 'rectangle' | 'circle' | 'circle-diameter' | 'circle-2p-diameter' | 'polyline' | 'polygon' | 'measure-distance' | 'measure-area' | 'measure-angle';

export interface DrawingState {
  currentTool: DrawingTool;
  isDrawing: boolean;
  previewEntity: ExtendedSceneEntity | null;
  tempPoints: Point2D[];
  measurementId?: string;
  isOverlayMode?: boolean; // 🔺 ΝΕΟ: Flag για overlay mode
}

export function useUnifiedDrawing() {
  const [state, setState] = useState<DrawingState>({
    currentTool: 'select',
    isDrawing: false,
    previewEntity: null,
    tempPoints: []
  });

  const {
    currentLevelId,
    getLevelScene,
    setLevelScene
  } = useLevels();

  // ===== ΠΡΟΣΘΗΚΗ PREVIEW MODE INTEGRATION =====
  const { setMode } = usePreviewMode();

  const nextEntityIdRef = useRef(1);

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
          } as PolylineEntity;
        }
        break;
      case 'measure-angle':
        if (points.length >= 2) {
          if (points.length === 2) {
            // Show preview with one line from point1 to point2 with distance labels
            const polyline = {
              id,
              type: 'polyline',
              vertices: [points[0], points[1]],
              closed: false,
              visible: true,
              layer: '0',
            } as PolylineEntity;
            
            // Add flags for preview styling like polyline
            const extendedPolyline: ExtendedPolylineEntity = {
              ...polyline,
              preview: true,
              showEdgeDistances: true,
              isOverlayPreview: state.isOverlayMode === true
            };

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

  const addPoint = useCallback((worldPoint: Point2D, transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }) => {

    if (!state.isDrawing) {

      return;
    }

    // Snap is handled at DxfCanvas level, use worldPoint directly
    const snappedPoint = worldPoint;

    const newTempPoints = [...state.tempPoints, snappedPoint];

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

    if (isComplete(state.currentTool, newTempPoints)) {
      const newEntity = createEntityFromTool(state.currentTool, newTempPoints);
      if (newEntity && currentLevelId) {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
          const updatedScene = { ...scene, entities: [...scene.entities, newEntity] };
          setLevelScene(currentLevelId, updatedScene);
        }
      }
      // Return to normal mode after entity completion

      setMode('normal');

      // FIXED: Reset temp points for continuous drawing
      setState(prev => ({
        ...prev,
        tempPoints: [],
        previewEntity: null
      }));
    } else {
      // Create a partial preview after adding the point
      let partialPreview: ExtendedSceneEntity | null = null;

      // Line tool doesn't create partial preview on first click
      if (state.currentTool === 'line' && newTempPoints.length === 1) {
        partialPreview = null;
      }

      // For measure-angle, show intermediate state
      if (state.currentTool === 'measure-angle' && newTempPoints.length >= 1) {
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
          } as CircleEntity;
        } else if (newTempPoints.length === 2) {
          // After second click, show the first line with distance labels
          partialPreview = {
            id: 'preview_partial',
            type: 'polyline',
            vertices: newTempPoints,
            closed: false,
            visible: true,
            layer: '0',
            measurement: true, // Mark as measurement for brown dots
          } as PolylineEntity;
          
          // Add flags for preview styling like polyline
          const extendedPartialPreview: ExtendedPolylineEntity = {
            ...partialPreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true
          };
          partialPreview = extendedPartialPreview;
        }
      }
      
      setState(prev => ({
        ...prev,
        tempPoints: newTempPoints,
        previewEntity: partialPreview
      }));
    }
  }, [state, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, setMode]);

  const updatePreview = useCallback((mousePoint: Point2D, transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }) => {
    if (!state.isDrawing) {
      return;
    }

    // Snap is handled at DxfCanvas level, use mousePoint directly
    const snappedPoint = mousePoint;

    // For single-point preview (starting a shape)
    if (state.tempPoints.length === 0) {
      // Show a small preview indicator at the mouse position
      let previewEntity: ExtendedSceneEntity | null = null;
      
      if (state.currentTool === 'line' || state.currentTool === 'measure-distance' || state.currentTool === 'rectangle' || state.currentTool === 'circle' || state.currentTool === 'circle-diameter' || state.currentTool === 'circle-2p-diameter' || state.currentTool === 'polygon' || state.currentTool === 'polyline' || state.currentTool === 'measure-area' || state.currentTool === 'measure-angle') {
        // For shapes that need two points, show a small dot at the start point
        const isMeasurementTool = state.currentTool === 'measure-distance' || state.currentTool === 'measure-area' || state.currentTool === 'measure-angle';
        
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
      
      setState(prev => ({ ...prev, previewEntity }));
      return;
    }

    // For multi-point preview (showing the shape being drawn)
    const worldPoints = [...state.tempPoints, snappedPoint];
    const previewEntity = createEntityFromTool(state.currentTool, worldPoints);
    
    // Mark preview entity for special preview rendering with distance labels
    if (previewEntity && (state.currentTool === 'polygon' || state.currentTool === 'polyline' || state.currentTool === 'measure-angle' || state.currentTool === 'measure-area' || state.currentTool === 'line' || state.currentTool === 'measure-distance' || state.currentTool === 'rectangle' || state.currentTool === 'circle' || state.currentTool === 'circle-diameter' || state.currentTool === 'circle-2p-diameter')) {

      // Handle different entity types appropriately
      if (previewEntity.type === 'polyline') {
        const extendedPolyline = previewEntity as ExtendedPolylineEntity;
        extendedPolyline.preview = true;
        extendedPolyline.showEdgeDistances = true;
        extendedPolyline.showPreviewGrips = true;
        extendedPolyline.isOverlayPreview = state.isOverlayMode === true;
      } else if (previewEntity.type === 'line') {
        const extendedLine = previewEntity as ExtendedLineEntity;
        extendedLine.preview = true;
        extendedLine.showEdgeDistances = true;
        extendedLine.showPreviewGrips = true;
        extendedLine.isOverlayPreview = state.isOverlayMode === true;

        // Add grip points for line preview
        if (state.currentTool === 'line' && worldPoints.length >= 2) {
          extendedLine.previewGripPoints = [
            { position: worldPoints[0], type: 'start' },
            { position: snappedPoint, type: 'cursor' }
          ];
        }
      } else if (previewEntity.type === 'circle') {
        const extendedCircle = previewEntity as ExtendedCircleEntity;
        extendedCircle.preview = true;
        extendedCircle.showPreviewGrips = true;
      }

      if (DEBUG_UNIFIED_DRAWING) {
        const debugInfo: Record<string, unknown> = {
          entityType: previewEntity.type,
          currentTool: state.currentTool,
          isOverlayMode: state.isOverlayMode
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
      const isMeasurementTool = state.currentTool === 'measure-distance' || state.currentTool === 'measure-area' || state.currentTool === 'measure-angle';
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

    setState(prev => ({ ...prev, previewEntity }));
  }, [state, createEntityFromTool]);

  const startDrawing = useCallback((tool: DrawingTool) => {

    // Set preview mode when drawing starts

    setMode('preview');

    setState(prev => {
      const newState = {
        ...prev,
        currentTool: tool,
        isDrawing: true,
        tempPoints: [],
        previewEntity: null,
        isOverlayMode: false // ✅ ΔΙΟΡΘΩΣΗ: Reset overlay mode για κανονικές σχεδιάσεις
      };

      return newState;
    });
  }, [setMode]);

  const cancelDrawing = useCallback(() => {
    // Return to normal mode on cancel

    setMode('normal');

    setState(prev => ({
      ...prev,
      isDrawing: false,
      tempPoints: [],
      previewEntity: null
    }));
  }, [setMode]);

  const finishPolyline = useCallback(() => {
    if ((state.currentTool === 'polyline' || state.currentTool === 'measure-angle' || state.currentTool === 'polygon' || state.currentTool === 'measure-area') && state.tempPoints.length >= 2) {
      // Remove duplicate points that might be added by double-click
      let cleanedPoints = [...state.tempPoints];
      
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
      
      const newEntity = createEntityFromTool(state.currentTool, cleanedPoints);
      
      // Σώσε entity για polygon και polyline
      if (newEntity && currentLevelId) {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
            const updatedScene = { ...scene, entities: [...scene.entities, newEntity] };
            setLevelScene(currentLevelId, updatedScene);
        }
      }

      // Return to normal mode after polyline completion

      setMode('normal');

      cancelDrawing();
      return newEntity;
    }
    return null;
  }, [state, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, cancelDrawing, setMode]);

  // Wrapper function for starting polyline drawing with callback
  const startPolyline = useCallback((options: { onComplete?: (points: Point2D[]) => void; onCancel?: () => void } = {}) => {
    startDrawing('polyline');
    
    return {
      stop: () => {
        const points = state.tempPoints;
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
  }, [startDrawing, cancelDrawing, state.tempPoints, setMode]);

  // Start Polygon method for overlay creation
  const startPolygon = useCallback((options: { onComplete?: (points: Point2D[]) => void; onCancel?: () => void; isOverlay?: boolean } = {}) => {
    // Set overlay mode before starting drawing
    const overlayMode = options.isOverlay || false;

    setState(prev => ({ ...prev, isOverlayMode: overlayMode }));
    startDrawing('polygon');
    
    return {
      stop: () => {
        const points = state.tempPoints;
        // Return to normal mode on polygon stop

        setMode('normal');

        // Clear overlay mode
        setState(prev => ({ ...prev, isOverlayMode: false }));
        cancelDrawing();
        if (options.onComplete && points.length >= 3) {
          options.onComplete(points);
        } else if (options.onCancel) {
          options.onCancel();
        }
      }
    };
  }, [startDrawing, cancelDrawing, state.tempPoints, setMode]);

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
    // Snap config handled at DxfCanvas level
  };
}
