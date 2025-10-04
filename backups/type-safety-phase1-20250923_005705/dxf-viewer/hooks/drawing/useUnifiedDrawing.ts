/**
 * useUnifiedDrawing Hook - ΜΕ SNAP INTEGRATION (FIXED)
 * Unified system που συνδυάζει entity creation με measurement-style interaction
 * FIXED: Χρήση σωστής level manager function και διαδοχική σχεδίαση
 */

// DEBUG FLAG
const DEBUG_UNIFIED_DRAWING = false;

import { useState, useCallback, useRef } from 'react';
import type { AnySceneEntity, Point2D, LineEntity, CircleEntity, PolylineEntity, RectangleEntity, AngleMeasurementEntity } from '../../types/scene';
import { useLevels } from '../../systems/levels';
// Snap functionality removed - use ProSnapEngine directly if needed
import { useSnapContext } from '../../snapping/context/SnapContext';
import { calculateDistance } from '../../utils/renderers/shared/geometry-rendering-utils';
import { usePreviewMode } from '../usePreviewMode';

export type DrawingTool = 'select' | 'line' | 'rectangle' | 'circle' | 'circle-diameter' | 'circle-2p-diameter' | 'polyline' | 'polygon' | 'measure-distance' | 'measure-area' | 'measure-angle';



export interface DrawingState {
  currentTool: DrawingTool;
  isDrawing: boolean;
  previewEntity: AnySceneEntity | null;
  tempPoints: Point2D[];
  measurementId?: string;
  isOverlayMode?: boolean; // 🎯 ΝΕΟ: Flag για overlay mode
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

  const createEntityFromTool = useCallback((tool: DrawingTool, points: Point2D[]): AnySceneEntity | null => {
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
            (polyline as any).preview = true;
            (polyline as any).showEdgeDistances = true;
            // 🎯 ΔΙΟΡΘΩΣΗ: Σημαία για overlay detection στο PhaseManager
            (polyline as any).isOverlayPreview = state.isOverlayMode === true;
            
            return polyline;
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

  const addPoint = useCallback((worldPoint: Point2D, transform: any) => {
    if (DEBUG_UNIFIED_DRAWING) console.log('🔴 [useUnifiedDrawing] addPoint called with:', worldPoint, 'isDrawing:', state.isDrawing);
    if (!state.isDrawing) {
      if (DEBUG_UNIFIED_DRAWING) console.log('🚫 [useUnifiedDrawing] Not in drawing mode, ignoring point');
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
      if (DEBUG_UNIFIED_DRAWING) console.log('🔄 [useUnifiedDrawing] Entity completed - setting mode to NORMAL');
      setMode('normal');

      // FIXED: Reset temp points for continuous drawing
      setState(prev => ({
        ...prev,
        tempPoints: [],
        previewEntity: null
      }));
    } else {
      // Create a partial preview after adding the point
      let partialPreview: AnySceneEntity | null = null;

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
          (partialPreview as any).preview = true;
          (partialPreview as any).showEdgeDistances = true;
          (partialPreview as any).showPreviewGrips = true; // ✅ Preview grips για partial preview
        }
      }
      
      setState(prev => ({
        ...prev,
        tempPoints: newTempPoints,
        previewEntity: partialPreview
      }));
    }
  }, [state, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, setMode]);

  const updatePreview = useCallback((mousePoint: Point2D, transform: any) => {
    if (!state.isDrawing) {
      return;
    }

    // Snap is handled at DxfCanvas level, use mousePoint directly
    const snappedPoint = mousePoint;


    // For single-point preview (starting a shape)
    if (state.tempPoints.length === 0) {
      // Show a small preview indicator at the mouse position
      let previewEntity: AnySceneEntity | null = null;
      
      if (state.currentTool === 'line' || state.currentTool === 'measure-distance' || state.currentTool === 'rectangle' || state.currentTool === 'circle' || state.currentTool === 'circle-diameter' || state.currentTool === 'circle-2p-diameter' || state.currentTool === 'polygon' || state.currentTool === 'polyline' || state.currentTool === 'measure-area' || state.currentTool === 'measure-angle') {
        // For shapes that need two points, show a small dot at the start point
        const isMeasurementTool = state.currentTool === 'measure-distance' || state.currentTool === 'measure-area' || state.currentTool === 'measure-angle';
        
        previewEntity = {
          id: 'preview_start',
          type: 'point',              // point αντί για circle
          position: snappedPoint,     // position αντί για center
          size: 4,                    // size αντί για radius
          visible: true,
          layer: '0',
          preview: true,              // Flag για preview styling
          showPreviewGrips: true,     // ✅ ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Preview grips για start point!
          ...(isMeasurementTool && { measurement: true }),
        } as any;
      }
      
      setState(prev => ({ ...prev, previewEntity }));
      return;
    }

    // For multi-point preview (showing the shape being drawn)
    const worldPoints = [...state.tempPoints, snappedPoint];
    const previewEntity = createEntityFromTool(state.currentTool, worldPoints);
    
    // Mark preview entity for special preview rendering with distance labels
    if (previewEntity && (state.currentTool === 'polygon' || state.currentTool === 'polyline' || state.currentTool === 'measure-angle' || state.currentTool === 'measure-area' || state.currentTool === 'line' || state.currentTool === 'measure-distance' || state.currentTool === 'rectangle' || state.currentTool === 'circle' || state.currentTool === 'circle-diameter' || state.currentTool === 'circle-2p-diameter')) {
      (previewEntity as any).preview = true;
      (previewEntity as any).showEdgeDistances = true; // Special flag for preview rendering
      (previewEntity as any).showPreviewGrips = true; // ✅ ΝΕΟ! Flag για preview grips
      // 🎯 ΔΙΟΡΘΩΣΗ: Σημαία για overlay detection στο PhaseManager
      (previewEntity as any).isOverlayPreview = state.isOverlayMode === true;

      // Add grip points for line preview
      if (state.currentTool === 'line' && worldPoints.length >= 2) {
        (previewEntity as any).previewGripPoints = [
          { position: worldPoints[0], type: 'start' },  // Grip at start point
          { position: snappedPoint, type: 'cursor' }   // Grip at cursor position
        ];
      }

      if (DEBUG_UNIFIED_DRAWING) console.log('🎨 [useUnifiedDrawing] Preview entity created:', {
        entityType: previewEntity.type,
        currentTool: state.currentTool,
        isOverlayMode: state.isOverlayMode,
        isOverlayPreview: (previewEntity as any).isOverlayPreview,
        preview: (previewEntity as any).preview,
        showEdgeDistances: (previewEntity as any).showEdgeDistances,
        showPreviewGrips: (previewEntity as any).showPreviewGrips,
        previewGripPoints: (previewEntity as any).previewGripPoints?.length || 0,
        vertices: previewEntity.type === 'polyline' ? (previewEntity as any).vertices?.length : 'N/A',
        closed: previewEntity.type === 'polyline' ? (previewEntity as any).closed : 'N/A'
      });

      // Add measurement flag for measurement tools
      const isMeasurementTool = state.currentTool === 'measure-distance' || state.currentTool === 'measure-area' || state.currentTool === 'measure-angle';
      if (isMeasurementTool) {
        (previewEntity as any).measurement = true;
      }
    }

    setState(prev => ({ ...prev, previewEntity }));
  }, [state, createEntityFromTool]);

  const startDrawing = useCallback((tool: DrawingTool) => {
    if (DEBUG_UNIFIED_DRAWING) console.log('🎨 [useUnifiedDrawing] startDrawing called with:', tool);

    // Set preview mode when drawing starts
    if (DEBUG_UNIFIED_DRAWING) console.log('🔄 [useUnifiedDrawing] Setting mode to PREVIEW');
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
      if (DEBUG_UNIFIED_DRAWING) console.log('🎨 [useUnifiedDrawing] New state:', newState);
      return newState;
    });
  }, [setMode]);

  const cancelDrawing = useCallback(() => {
    // Return to normal mode on cancel
    if (DEBUG_UNIFIED_DRAWING) console.log('🔄 [useUnifiedDrawing] Canceling drawing - setting mode to NORMAL');
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
      if (DEBUG_UNIFIED_DRAWING) console.log('🔄 [useUnifiedDrawing] Polyline completed - setting mode to NORMAL');
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
        if (DEBUG_UNIFIED_DRAWING) console.log('🔄 [useUnifiedDrawing] Polyline stopped - setting mode to NORMAL');
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
    if (DEBUG_UNIFIED_DRAWING) console.log('🎯 [useUnifiedDrawing] startPolygon called with options:', {
      hasOnComplete: !!options.onComplete,
      hasOnCancel: !!options.onCancel,
      isOverlay: options.isOverlay,
      overlayMode,
      willSetOverlayMode: overlayMode
    });
    setState(prev => ({ ...prev, isOverlayMode: overlayMode }));
    startDrawing('polygon');
    
    return {
      stop: () => {
        const points = state.tempPoints;
        // Return to normal mode on polygon stop
        if (DEBUG_UNIFIED_DRAWING) console.log('🔄 [useUnifiedDrawing] Polygon stopped - setting mode to NORMAL');
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
