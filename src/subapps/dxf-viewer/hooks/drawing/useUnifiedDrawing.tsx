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
// 🏢 ENTERPRISE (2026-01-30): Centralized Tool State Store for persistent tool selection
import { toolStateStore } from '../../stores/ToolStateStore';
// 🏢 ENTERPRISE (2026-01-27): Event Bus for drawing completion notification - ADR-040
import { EventBus } from '../../systems/events';
// NOTE: ADR-055 Event Bus pattern for entity creation temporarily disabled - needs debugging
// import { emitEntityCreateRequest } from '../../systems/entity-creation';
import type { AnySceneEntity, LineEntity, CircleEntity, PolylineEntity, RectangleEntity, AngleMeasurementEntity, ArcEntity, SceneModel } from '../../types/scene';
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

// 🏢 ENTERPRISE (2026-01-31): Extended Arc Entity for preview with construction lines
// Shows both the arc shape AND the rubber band lines connecting clicked points
export interface ExtendedArcEntity extends ArcEntity {
  // Construction vertices: all clicked points + cursor position
  // Used to draw rubber band lines during arc drawing
  constructionVertices?: Point2D[];
  showConstructionLines?: boolean;
  showEdgeDistances?: boolean;
  // 🏢 ENTERPRISE: Arc direction flag for Canvas 2D rendering
  // true = draw counterclockwise (anticlockwise), false = draw clockwise
  counterclockwise?: boolean;
  // 🏢 ENTERPRISE: Construction line drawing mode
  // 'polyline': Connect points in sequence (arc-3p: start → mid → end)
  // 'radial': Draw radii from center (arc-cse/arc-sce: center → start, center → end)
  constructionLineMode?: 'polyline' | 'radial';
}

export type ExtendedSceneEntity =
  | ExtendedPolylineEntity
  | ExtendedCircleEntity
  | ExtendedLineEntity
  | ExtendedArcEntity
  | PreviewPoint
  | AnySceneEntity;
import { useLevels } from '../../systems/levels';
// Snap functionality removed - use ProSnapEngine directly if needed
import { useSnapContext } from '../../snapping/context/SnapContext';
// 🏢 ENTERPRISE (2026-01-31): Geometry utilities - unified import from barrel export
// calculateDistance: from geometry-rendering-utils.ts
// arcFrom3Points, arcFromCenterStartEnd, arcFromStartCenterEnd: from geometry-utils.ts (ADR-059)
// radToDeg: from geometry-utils.ts (ADR-067)
// normalizeAngleDeg: from geometry-utils.ts (ADR-068)
import {
  calculateDistance,
  arcFrom3Points,
  arcFromCenterStartEnd,
  arcFromStartCenterEnd,
  radToDeg,
  normalizeAngleDeg,
  dotProduct,
  // 🏢 ADR-078: Centralized Angle Between Vectors
  angleBetweenVectors,
  // 🏢 ADR-083: Circle from 3 points (circumcircle)
  circleFrom3Points,
  // 🏢 ADR-083: Circle from chord and sagitta
  circleFromChordAndSagitta,
  // 🏢 ADR-083: Circle from 2 points + radius indicator
  circleFrom2PointsAndRadius,
  // 🏢 ADR-083: Circle best-fit (least squares)
  circleBestFit,
  // 🏢 ADR-090: Centralized Point Vector Operations
  subtractPoints,
  // 🏢 ADR-065: Centralized point projection and angle calculation
  pointOnCircle,
  calculateAngle,
} from '../../rendering/entities/shared';
// 🏢 ADR-079: Centralized Geometric Precision Constants
import { GEOMETRY_PRECISION } from '../../config/tolerance-config';
import { usePreviewMode } from '../usePreviewMode';
// 🗑️ REMOVED: useEntityStyles from ConfigurationProvider
// import { useEntityStyles } from '../useEntityStyles';
// 🆕 MERGE: Χρησιμοποιούμε το νέο useLineStyles από DxfSettingsProvider
import { useLineStyles } from '../../settings-provider';
// 🏢 ENTERPRISE: Import centralized CAD colors - ADR-014 color token migration
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: Import centralized UI colors - hardcoded color centralization
import { UI_COLORS } from '../../config/color-config';
// 🏢 ENTERPRISE (2026-01-30): ADR-057 - Unified Entity Completion Pipeline
// Note: applyCompletionStyles is called internally by completeEntity (ADR-056)
import { completeEntity } from './completeEntity';

// 🏢 ENTERPRISE (2026-01-31): Added arc tools - ADR-059
// 🏢 ENTERPRISE (2026-01-31): Added circle-3p, circle-chord-sagitta, circle-2p-radius, circle-best-fit - ADR-083
export type DrawingTool = 'select' | 'line' | 'rectangle' | 'circle' | 'circle-diameter' | 'circle-2p-diameter' | 'circle-3p' | 'circle-chord-sagitta' | 'circle-2p-radius' | 'circle-best-fit' | 'polyline' | 'polygon' | 'measure-distance' | 'measure-distance-continuous' | 'measure-area' | 'measure-angle' | 'arc-3p' | 'arc-cse' | 'arc-sce';

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
          // 🏢 ADR-057: Entity creation only - styles applied by completeEntity()
          const measureEntity = {
            id,
            type: 'line',
            start: points[0],
            end: points[1],
            visible: true,
            layer: '0',
            measurement: true, // Mark as measurement entity
            showEdgeDistances: true, // Show distance label on the measurement line
          } as LineEntity;
          return measureEntity;
        }
        break;

      // 🏢 ENTERPRISE (2026-01-27): Continuous distance measurement
      // Pattern: AutoCAD MEASUREGEOM continuous mode - multiple distance measurements
      // Creates line entity for every 2 consecutive points
      case 'measure-distance-continuous':
        if (points.length >= 2) {
          // For continuous mode, always return preview for LAST 2 points
          const lastTwoPoints = points.slice(-2);
          // 🏢 ADR-057: Entity creation only - styles applied by completeEntity()
          const continuousMeasureEntity = {
            id,
            type: 'line',
            start: lastTwoPoints[0],
            end: lastTwoPoints[1],
            visible: true,
            layer: '0',
            measurement: true, // Mark as measurement entity
            showEdgeDistances: true, // Show distance label on the measurement line
          } as LineEntity;
          return continuousMeasureEntity;
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
          // 🏢 ADR-065: Use centralized distance calculation
          const radius = calculateDistance(p1, p2) / 2; // Η διάμετρος διά 2
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

      // 🏢 ENTERPRISE (2026-01-31): Circle from 3 points (circumcircle) - ADR-083
      // Creates a circle that passes through all 3 clicked points
      case 'circle-3p':
        if (points.length >= 3) {
          const [p1, p2, p3] = points;
          const circleResult = circleFrom3Points(p1, p2, p3);
          if (circleResult) {
            return {
              id,
              type: 'circle',
              center: circleResult.center,
              radius: circleResult.radius,
              visible: true,
              layer: '0',
            } as CircleEntity;
          }
        }
        break;

      // 🏢 ENTERPRISE (2026-01-31): Circle from chord and sagitta - ADR-083
      // Creates a circle from two points defining a chord and a third point defining the sagitta (arc height)
      case 'circle-chord-sagitta':
        if (points.length >= 3) {
          const [chordStart, chordEnd, sagittaPoint] = points;
          const circleResult = circleFromChordAndSagitta(chordStart, chordEnd, sagittaPoint);
          if (circleResult) {
            return {
              id,
              type: 'circle',
              center: circleResult.center,
              radius: circleResult.radius,
              visible: true,
              layer: '0',
            } as CircleEntity;
          }
        }
        break;

      // 🏢 ENTERPRISE (2026-01-31): Circle from 2 points + radius indicator - ADR-083
      // Creates a circle from two points on circumference and a third point indicating radius/side
      case 'circle-2p-radius':
        if (points.length >= 3) {
          const [p1, p2, radiusIndicator] = points;
          const circleResult = circleFrom2PointsAndRadius(p1, p2, radiusIndicator);
          if (circleResult) {
            return {
              id,
              type: 'circle',
              center: circleResult.center,
              radius: circleResult.radius,
              visible: true,
              layer: '0',
            } as CircleEntity;
          }
        }
        break;

      // 🏢 ENTERPRISE (2026-01-31): Circle best-fit (least squares) - ADR-083
      // Creates a circle that best fits N points (minimum 3) using Hyper Circle Fit algorithm
      // Works like polyline: user clicks multiple points, then Enter to complete
      case 'circle-best-fit':
        if (points.length >= 3) {
          const circleResult = circleBestFit(points);
          if (circleResult) {
            return {
              id,
              type: 'circle',
              center: circleResult.center,
              radius: circleResult.radius,
              visible: true,
              layer: '0',
            } as CircleEntity;
          }
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
            
            // 🏢 ADR-090: Use centralized point subtraction
            const vector1 = subtractPoints(point1, vertex);
            const vector2 = subtractPoints(point2, vertex);

            // Calculate angle in radians
            // 🏢 ADR-078: Use centralized angleBetweenVectors
            const angleRad = angleBetweenVectors(vector1, vector2);

            // 🏢 ADR-067: Use centralized angle conversion
            // 🏢 ADR-068: Use centralized angle normalization
            const angleDeg = normalizeAngleDeg(radToDeg(angleRad));
            
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

      // 🏢 ENTERPRISE (2026-01-31): Arc drawing tools - ADR-059
      // AutoCAD pattern: Different arc creation methods
      case 'arc-3p':
        // 3-Point Arc: Start → Point on Arc → End
        if (points.length >= 3) {
          const [start, mid, end] = points;
          const arcResult = arcFrom3Points(start, mid, end);
          if (arcResult) {
            // 🏢 ENTERPRISE (2026-01-31): Apply flip if user toggled direction
            const finalCounterclockwise = arcFlippedRef.current
              ? !arcResult.counterclockwise
              : arcResult.counterclockwise;
            return {
              id,
              type: 'arc',
              center: arcResult.center,
              radius: arcResult.radius,
              startAngle: arcResult.startAngle,
              endAngle: arcResult.endAngle,
              visible: true,
              layer: '0',
              // 🔧 FIX (2026-01-31): Προσθήκη counterclockwise για σωστή κατεύθυνση τόξου
              counterclockwise: finalCounterclockwise,
            } as ArcEntity;
          }
        }
        break;

      case 'arc-cse':
        // Center → Start → End Arc
        if (points.length >= 3) {
          const [center, start, end] = points;
          const arcResult = arcFromCenterStartEnd(center, start, end);
          // 🏢 ENTERPRISE (2026-01-31): Apply flip if user toggled direction
          const finalCounterclockwise = arcFlippedRef.current
            ? !arcResult.counterclockwise
            : arcResult.counterclockwise;
          return {
            id,
            type: 'arc',
            center: arcResult.center,
            radius: arcResult.radius,
            startAngle: arcResult.startAngle,
            endAngle: arcResult.endAngle,
            visible: true,
            layer: '0',
            // 🏢 ENTERPRISE: Pass counterclockwise flag for correct arc direction
            counterclockwise: finalCounterclockwise,
          } as ArcEntity;
        }
        break;

      case 'arc-sce':
        // Start → Center → End Arc
        if (points.length >= 3) {
          const [start, center, end] = points;
          const arcResult = arcFromStartCenterEnd(start, center, end);
          // 🏢 ENTERPRISE (2026-01-31): Apply flip if user toggled direction
          const finalCounterclockwise = arcFlippedRef.current
            ? !arcResult.counterclockwise
            : arcResult.counterclockwise;
          // 🔍 DEBUG: Log arc creation
          console.log('🏗️ createEntityFromTool arc-sce:', {
            startAngle: arcResult.startAngle,
            endAngle: arcResult.endAngle,
            counterclockwise: finalCounterclockwise,
            flipped: arcFlippedRef.current,
            points: { start, center, end }
          });
          const arcEntity = {
            id,
            type: 'arc' as const,
            center: arcResult.center,
            radius: arcResult.radius,
            startAngle: arcResult.startAngle,
            endAngle: arcResult.endAngle,
            visible: true,
            layer: '0',
            // 🏢 ENTERPRISE: Pass counterclockwise flag for correct arc direction
            counterclockwise: finalCounterclockwise,
          };
          // 🔍 DEBUG: Log the FULL entity object before returning
          console.log('🏗️ createEntityFromTool arc-sce FULL ENTITY:', JSON.stringify(arcEntity, null, 2));
          return arcEntity as ArcEntity;
        }
        break;
    }
    return null;
  }, []);

  /**
   * 🏢 ENTERPRISE: Add point to current drawing
   * @returns {boolean} true if drawing was completed (for immediate preview clear)
   * Also emits 'drawing:complete' event for other listeners (Event Bus pattern)
   */
  const addPoint = useCallback((worldPoint: Point2D, _transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }): boolean => {
    // 🔍 DEBUG (2026-01-31): Log addPoint for circle debugging
    console.log('➕ [addPoint] Called', {
      worldPoint,
      canAddPoint,
      currentTool: machineContext.toolType,
      pointCount: machineContext.points.length,
      machineState: machineIsDrawing ? 'drawing' : 'not-drawing'
    });

    // 🏢 ENTERPRISE (2026-01-25): Use state machine guard instead of manual checks
    // State machine provides canAddPoint which handles all edge cases
    if (!canAddPoint) {
      console.log('❌ [addPoint] BLOCKED - canAddPoint is false');
      return false;
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
        // 🏢 ENTERPRISE (2026-01-31): Arc tools require 3 points - ADR-059
        case 'arc-3p':
        case 'arc-cse':
        case 'arc-sce':
        // 🏢 ENTERPRISE (2026-01-31): Circle from 3 points, chord-sagitta, 2p-radius - ADR-083
        case 'circle-3p':
        case 'circle-chord-sagitta':
        case 'circle-2p-radius':
          return points.length >= 3;
        case 'measure-distance-continuous':
        case 'polyline':
        case 'polygon':
        case 'measure-area':
        // 🏢 ENTERPRISE (2026-01-31): Circle best-fit continues until Enter/double-click - ADR-083
        case 'circle-best-fit':
          return false; // These tools continue until manually finished (double-click or Escape)
        default:
          return false;
      }
    };

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

    if (isComplete(currentTool, newTempPoints)) {
      const newEntity = createEntityFromTool(currentTool, newTempPoints);

      // 🔍 DEBUG (2026-01-31): Log entity creation for circle debugging
      console.log('🏗️ [addPoint] Entity creation', {
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
        console.log('✅ [addPoint] Calling completeEntity', {
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
        console.log('❌ [addPoint] completeEntity NOT called', {
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

      // 🏢 ENTERPRISE (2026-01-31): Arc tools partial preview - ADR-059
      // Arc tools need 3 points, so show intermediate state with 1-2 points
      if ((currentTool === 'arc-3p' || currentTool === 'arc-cse' || currentTool === 'arc-sce') && newTempPoints.length >= 1) {
        if (newTempPoints.length === 1) {
          // After first click, show a dot at the first point
          partialPreview = {
            id: 'preview_partial',
            type: 'point',
            position: newTempPoints[0],
            size: 4,
            visible: true,
            layer: '0',
            preview: true,
            showPreviewGrips: true,
          } as PreviewPoint;
        } else if (newTempPoints.length === 2) {
          // After second click, show a line connecting the two points
          const basePartialPreview: LineEntity = {
            id: 'preview_partial',
            type: 'line',
            start: newTempPoints[0],
            end: newTempPoints[1],
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };

          const extendedPartialPreview: ExtendedLineEntity = {
            ...basePartialPreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
          };
          partialPreview = extendedPartialPreview;
        }
      }

      // 🏢 ENTERPRISE (2026-01-31): Circle-3p partial preview - ADR-083
      // Circle-3p needs 3 points, so show intermediate state with 1-2 points
      if (currentTool === 'circle-3p' && newTempPoints.length >= 1) {
        if (newTempPoints.length === 1) {
          // After first click, show a dot at the first point
          partialPreview = {
            id: 'preview_partial',
            type: 'point',
            position: newTempPoints[0],
            size: 4,
            visible: true,
            layer: '0',
            preview: true,
            showPreviewGrips: true,
          } as PreviewPoint;
        } else if (newTempPoints.length === 2) {
          // After second click, show a line connecting the two points
          const basePartialPreview: LineEntity = {
            id: 'preview_partial',
            type: 'line',
            start: newTempPoints[0],
            end: newTempPoints[1],
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };

          const extendedPartialPreview: ExtendedLineEntity = {
            ...basePartialPreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
          };
          partialPreview = extendedPartialPreview;
        }
      }

      // 🏢 ENTERPRISE (2026-01-31): Circle-chord-sagitta partial preview - ADR-083
      // Circle-chord-sagitta needs 3 points, so show intermediate state with 1-2 points
      if (currentTool === 'circle-chord-sagitta' && newTempPoints.length >= 1) {
        if (newTempPoints.length === 1) {
          // After first click, show a dot at the chord start point
          partialPreview = {
            id: 'preview_partial',
            type: 'point',
            position: newTempPoints[0],
            size: 4,
            visible: true,
            layer: '0',
            preview: true,
            showPreviewGrips: true,
          } as PreviewPoint;
        } else if (newTempPoints.length === 2) {
          // After second click, show the chord line
          const basePartialPreview: LineEntity = {
            id: 'preview_partial',
            type: 'line',
            start: newTempPoints[0],
            end: newTempPoints[1],
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };

          const extendedPartialPreview: ExtendedLineEntity = {
            ...basePartialPreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
          };
          partialPreview = extendedPartialPreview;
        }
      }

      // 🏢 ENTERPRISE (2026-01-31): Circle-2p-radius partial preview - ADR-083
      // Circle-2p-radius needs 3 points, so show intermediate state with 1-2 points
      if (currentTool === 'circle-2p-radius' && newTempPoints.length >= 1) {
        if (newTempPoints.length === 1) {
          // After first click, show a dot at the first circumference point
          partialPreview = {
            id: 'preview_partial',
            type: 'point',
            position: newTempPoints[0],
            size: 4,
            visible: true,
            layer: '0',
            preview: true,
            showPreviewGrips: true,
          } as PreviewPoint;
        } else if (newTempPoints.length === 2) {
          // After second click, show the line between the two circumference points
          const basePartialPreview: LineEntity = {
            id: 'preview_partial',
            type: 'line',
            start: newTempPoints[0],
            end: newTempPoints[1],
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };

          const extendedPartialPreview: ExtendedLineEntity = {
            ...basePartialPreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
          };
          partialPreview = extendedPartialPreview;
        }
      }

      // 🏢 ENTERPRISE (2026-01-31): Circle-best-fit partial preview - ADR-083
      // Circle-best-fit needs minimum 3 points, continues until Enter
      // Shows polyline connecting all points + best-fit circle when 3+ points
      if (currentTool === 'circle-best-fit' && newTempPoints.length >= 1) {
        if (newTempPoints.length === 1) {
          // After first click, show a dot
          partialPreview = {
            id: 'preview_partial',
            type: 'point',
            position: newTempPoints[0],
            size: 4,
            visible: true,
            layer: '0',
            preview: true,
            showPreviewGrips: true,
          } as PreviewPoint;
        } else if (newTempPoints.length === 2) {
          // After second click, show line between points
          const basePartialPreview: LineEntity = {
            id: 'preview_partial',
            type: 'line',
            start: newTempPoints[0],
            end: newTempPoints[1],
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };

          const extendedPartialPreview: ExtendedLineEntity = {
            ...basePartialPreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
          };
          partialPreview = extendedPartialPreview;
        } else {
          // 3+ points: show polyline connecting points + best-fit circle
          // First, try to calculate the best-fit circle
          const circleResult = circleBestFit(newTempPoints);
          if (circleResult) {
            // Show the best-fit circle as preview
            partialPreview = {
              id: 'preview_partial',
              type: 'circle',
              center: circleResult.center,
              radius: circleResult.radius,
              visible: true,
              layer: '0',
              preview: true,
              showPreviewGrips: true,
            } as ExtendedCircleEntity;
          } else {
            // If calculation fails, show polyline of points
            const polylinePreview: PolylineEntity = {
              id: 'preview_partial',
              type: 'polyline',
              vertices: [...newTempPoints],
              closed: false,
              visible: true,
              layer: '0',
              color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
              lineweight: 1,
              opacity: 1.0,
              lineType: 'solid' as const
            };
            partialPreview = {
              ...polylinePreview,
              preview: true,
              showEdgeDistances: true,
              showPreviewGrips: true,
            } as ExtendedPolylineEntity;
          }
        }
      }

      // 🏢 ENTERPRISE: Update local state for preview entity only
      setLocalState(prev => ({
        ...prev,
        previewEntity: partialPreview,
      }));

      return false; // Drawing not yet complete
    }
  }, [canAddPoint, machineAddPoint, machineContext.points, machineContext.toolType, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, setMode, machineComplete, machineReset, machineDeselectTool]);

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

      // 🏢 ENTERPRISE (2026-01-31): Added arc tools - ADR-059
      // 🏢 ENTERPRISE (2026-01-31): Added circle-3p, circle-chord-sagitta, circle-2p-radius - ADR-083
      if (currentTool === 'line' || currentTool === 'measure-distance' || currentTool === 'measure-distance-continuous' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'circle-diameter' || currentTool === 'circle-2p-diameter' || currentTool === 'circle-3p' || currentTool === 'circle-chord-sagitta' || currentTool === 'circle-2p-radius' || currentTool === 'polygon' || currentTool === 'polyline' || currentTool === 'measure-area' || currentTool === 'measure-angle' || currentTool === 'arc-3p' || currentTool === 'arc-cse' || currentTool === 'arc-sce') {
        // For shapes that need two points, show a small dot at the start point
        const isMeasurementTool = currentTool === 'measure-distance' || currentTool === 'measure-distance-continuous' || currentTool === 'measure-area' || currentTool === 'measure-angle';

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

    // 🏢 ENTERPRISE (2026-01-31): Arc/Circle-3p tools ALWAYS show rubber band polyline during drawing
    // These tools need 3 clicks to complete, but we want to show dynamic polyline (rubber band)
    // connecting all clicked points + cursor position until the drawing is complete.
    // The entity is only created when the user clicks the 3rd point (in addPoint).
    let previewEntity: ExtendedSceneEntity | null = null;

    // 🏢 ENTERPRISE (2026-01-31): Circle from 3 points preview - ADR-083
    // Shows rubber band lines connecting clicked points + cursor, then circle when 3 points available
    if (currentTool === 'circle-3p') {
      if (tempPoints.length === 1) {
        // 1 click + cursor = rubber band line only
        const basePreview: PolylineEntity = {
          id: 'preview_circle3p_rubberband',
          type: 'polyline',
          vertices: worldPoints,
          closed: false,
          visible: true,
          layer: '0',
          color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
          lineweight: 1,
          opacity: 1.0,
          lineType: 'solid' as const
        };
        previewEntity = {
          ...basePreview,
          preview: true,
          showEdgeDistances: true,
          showPreviewGrips: true,
        } as ExtendedPolylineEntity;

      } else if (tempPoints.length >= 2) {
        // 2+ clicks + cursor = try to show circle preview
        const circleResult = circleFrom3Points(worldPoints[0], worldPoints[1], worldPoints[2]);
        if (circleResult) {
          // Show circle preview
          const circlePreview: ExtendedCircleEntity = {
            id: 'preview_circle3p',
            type: 'circle',
            center: circleResult.center,
            radius: circleResult.radius,
            visible: true,
            layer: '0',
            preview: true,
            showPreviewGrips: true,
          };
          previewEntity = circlePreview;
        } else {
          // Points are collinear - show polyline only
          const basePreview: PolylineEntity = {
            id: 'preview_circle3p_rubberband',
            type: 'polyline',
            vertices: worldPoints,
            closed: false,
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };
          previewEntity = {
            ...basePreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
          } as ExtendedPolylineEntity;
        }
      }
    } else if (currentTool === 'circle-chord-sagitta') {
      // 🏢 ENTERPRISE (2026-01-31): Circle from chord and sagitta preview - ADR-083
      // Shows rubber band lines connecting clicked points + cursor, then circle when 3 points available
      if (tempPoints.length === 1) {
        // 1 click + cursor = rubber band line only (chord being defined)
        const basePreview: PolylineEntity = {
          id: 'preview_chord_sagitta_rubberband',
          type: 'polyline',
          vertices: worldPoints,
          closed: false,
          visible: true,
          layer: '0',
          color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
          lineweight: 1,
          opacity: 1.0,
          lineType: 'solid' as const
        };
        previewEntity = {
          ...basePreview,
          preview: true,
          showEdgeDistances: true,
          showPreviewGrips: true,
        } as ExtendedPolylineEntity;

      } else if (tempPoints.length >= 2) {
        // 2+ clicks + cursor = try to show circle preview (chord + sagitta)
        const circleResult = circleFromChordAndSagitta(worldPoints[0], worldPoints[1], worldPoints[2]);
        if (circleResult) {
          // Show circle preview
          const circlePreview: ExtendedCircleEntity = {
            id: 'preview_chord_sagitta',
            type: 'circle',
            center: circleResult.center,
            radius: circleResult.radius,
            visible: true,
            layer: '0',
            preview: true,
            showPreviewGrips: true,
          };
          previewEntity = circlePreview;
        } else {
          // Invalid configuration - show polyline only
          const basePreview: PolylineEntity = {
            id: 'preview_chord_sagitta_rubberband',
            type: 'polyline',
            vertices: worldPoints,
            closed: false,
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };
          previewEntity = {
            ...basePreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
          } as ExtendedPolylineEntity;
        }
      }
    } else if (currentTool === 'circle-2p-radius') {
      // 🏢 ENTERPRISE (2026-01-31): Circle from 2 points + radius indicator preview - ADR-083
      // Shows rubber band lines connecting clicked points + cursor, then circle when 3 points available
      if (tempPoints.length === 1) {
        // 1 click + cursor = rubber band line only (two points being defined)
        const basePreview: PolylineEntity = {
          id: 'preview_2p_radius_rubberband',
          type: 'polyline',
          vertices: worldPoints,
          closed: false,
          visible: true,
          layer: '0',
          color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
          lineweight: 1,
          opacity: 1.0,
          lineType: 'solid' as const
        };
        previewEntity = {
          ...basePreview,
          preview: true,
          showEdgeDistances: true,
          showPreviewGrips: true,
        } as ExtendedPolylineEntity;

      } else if (tempPoints.length >= 2) {
        // 2+ clicks + cursor = try to show circle preview (2 points + radius indicator)
        const circleResult = circleFrom2PointsAndRadius(worldPoints[0], worldPoints[1], worldPoints[2]);
        if (circleResult) {
          // Show circle preview
          const circlePreview: ExtendedCircleEntity = {
            id: 'preview_2p_radius',
            type: 'circle',
            center: circleResult.center,
            radius: circleResult.radius,
            visible: true,
            layer: '0',
            preview: true,
            showPreviewGrips: true,
          };
          previewEntity = circlePreview;
        } else {
          // Invalid configuration - show polyline only
          const basePreview: PolylineEntity = {
            id: 'preview_2p_radius_rubberband',
            type: 'polyline',
            vertices: worldPoints,
            closed: false,
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };
          previewEntity = {
            ...basePreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
          } as ExtendedPolylineEntity;
        }
      }
    } else if (currentTool === 'circle-best-fit') {
      // 🏢 ENTERPRISE (2026-01-31): Circle best-fit preview - ADR-083
      // Shows rubber band lines connecting all clicked points + cursor
      // When 3+ points: shows the best-fit circle calculated from all points including cursor
      if (tempPoints.length === 1) {
        // 1 click + cursor = rubber band line only
        const basePreview: PolylineEntity = {
          id: 'preview_bestfit_rubberband',
          type: 'polyline',
          vertices: worldPoints,
          closed: false,
          visible: true,
          layer: '0',
          color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
          lineweight: 1,
          opacity: 1.0,
          lineType: 'solid' as const
        };
        previewEntity = {
          ...basePreview,
          preview: true,
          showEdgeDistances: true,
          showPreviewGrips: true,
        } as ExtendedPolylineEntity;

      } else if (tempPoints.length === 2) {
        // 2 clicks + cursor = rubber band polyline (3 points not enough without cursor contribution)
        const basePreview: PolylineEntity = {
          id: 'preview_bestfit_rubberband',
          type: 'polyline',
          vertices: worldPoints,
          closed: false,
          visible: true,
          layer: '0',
          color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
          lineweight: 1,
          opacity: 1.0,
          lineType: 'solid' as const
        };
        previewEntity = {
          ...basePreview,
          preview: true,
          showEdgeDistances: true,
          showPreviewGrips: true,
        } as ExtendedPolylineEntity;

      } else {
        // 3+ clicks + cursor = show best-fit circle calculated from all points including cursor
        const circleResult = circleBestFit(worldPoints);
        if (circleResult) {
          // Show best-fit circle preview
          const circlePreview: ExtendedCircleEntity = {
            id: 'preview_bestfit',
            type: 'circle',
            center: circleResult.center,
            radius: circleResult.radius,
            visible: true,
            layer: '0',
            preview: true,
            showPreviewGrips: true,
          };
          previewEntity = circlePreview;
        } else {
          // If calculation fails, show polyline of all points
          const basePreview: PolylineEntity = {
            id: 'preview_bestfit_rubberband',
            type: 'polyline',
            vertices: worldPoints,
            closed: false,
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };
          previewEntity = {
            ...basePreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
          } as ExtendedPolylineEntity;
        }
      }
    } else if (currentTool === 'arc-3p' || currentTool === 'arc-cse' || currentTool === 'arc-sce') {
      // 🏢 ENTERPRISE (2026-01-31): Arc preview with construction lines
      // Shows BOTH the rubber band lines AND the arc shape preview

      if (tempPoints.length === 1) {
        // 1 click + cursor = rubber band line only (can't calculate arc yet)
        const basePreview: PolylineEntity = {
          id: 'preview_arc_rubberband',
          type: 'polyline',
          vertices: worldPoints,
          closed: false,
          visible: true,
          layer: '0',
          color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
          lineweight: 1,
          opacity: 1.0,
          lineType: 'solid' as const
        };
        previewEntity = {
          ...basePreview,
          preview: true,
          showEdgeDistances: true,
          showPreviewGrips: true,
        } as ExtendedPolylineEntity;

      } else if (tempPoints.length >= 2) {
        // 2+ clicks + cursor = arc preview WITH construction lines
        // worldPoints has 3 points: [point1, point2, cursor]
        let arcResult: { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise?: boolean } | null = null;

        // Calculate arc based on tool type
        if (currentTool === 'arc-3p') {
          // 3-Point Arc: Start → Point on Arc → End
          arcResult = arcFrom3Points(worldPoints[0], worldPoints[1], worldPoints[2]);
        } else if (currentTool === 'arc-cse') {
          // Center → Start → End Arc
          arcResult = arcFromCenterStartEnd(worldPoints[0], worldPoints[1], worldPoints[2]);
        } else if (currentTool === 'arc-sce') {
          // Start → Center → End Arc
          arcResult = arcFromStartCenterEnd(worldPoints[0], worldPoints[1], worldPoints[2]);
        }

        if (arcResult) {
          // 🏢 ENTERPRISE: Calculate construction vertices based on tool type
          // For arc-cse/arc-sce: project cursor to circumference (same radius as start)
          // For arc-3p: all points are on the circumference by definition
          let constructionVerts: Point2D[];

          if (currentTool === 'arc-cse') {
            // arc-cse: [Center, Start, End] - End must be projected to circumference
            const center = worldPoints[0];
            const start = worldPoints[1];
            const cursor = worldPoints[2];
            // 🏢 ADR-065: Use centralized distance calculation
            const dist = calculateDistance(center, cursor);
            // 🏢 ADR-079: Use centralized point match threshold
            // 🏢 ADR-065: Use centralized pointOnCircle for projection
            const projectedEnd = dist > GEOMETRY_PRECISION.POINT_MATCH
              ? pointOnCircle(center, arcResult.radius, calculateAngle(center, cursor))
              : start; // Fallback if cursor is on center
            constructionVerts = [center, start, projectedEnd];
          } else if (currentTool === 'arc-sce') {
            // arc-sce: [Start, Center, End] - End must be projected to circumference
            const start = worldPoints[0];
            const center = worldPoints[1];
            const cursor = worldPoints[2];
            // 🏢 ADR-065: Use centralized distance calculation
            const dist = calculateDistance(center, cursor);
            // 🏢 ADR-079: Use centralized point match threshold
            // 🏢 ADR-065: Use centralized pointOnCircle for projection
            const projectedEnd = dist > GEOMETRY_PRECISION.POINT_MATCH
              ? pointOnCircle(center, arcResult.radius, calculateAngle(center, cursor))
              : start;
            constructionVerts = [start, center, projectedEnd];
          } else {
            // arc-3p: all points define the circumference - use as-is
            constructionVerts = worldPoints;
          }

          // 🏢 ENTERPRISE (2026-01-31): Apply flip if user toggled direction
          const finalCounterclockwise = arcFlippedRef.current
            ? !arcResult.counterclockwise
            : arcResult.counterclockwise;

          // Create arc entity with construction vertices for rubber band lines
          const arcPreview: ExtendedArcEntity = {
            id: 'preview_arc',
            type: 'arc',
            center: arcResult.center,
            radius: arcResult.radius,
            startAngle: arcResult.startAngle,
            endAngle: arcResult.endAngle,
            visible: true,
            layer: '0',
            preview: true,
            showPreviewGrips: true,
            // 🏢 ENTERPRISE: Construction vertices for rubber band lines
            // For arc-cse/arc-sce: uses projected points on circumference
            constructionVertices: constructionVerts,
            showConstructionLines: true,
            showEdgeDistances: true,
            // 🏢 ENTERPRISE: Arc direction flag for correct rendering
            // Ensures arc passes through all 3 points (not the "mirror" arc)
            // With flip support for user direction toggle
            counterclockwise: finalCounterclockwise,
            // 🏢 ENTERPRISE: Construction line mode
            // arc-3p: polyline (start → mid → end)
            // arc-cse/arc-sce: radial (center → start, center → end)
            constructionLineMode: currentTool === 'arc-3p' ? 'polyline' : 'radial',
          };
          previewEntity = arcPreview;
        } else {
          // Arc calculation failed (e.g., collinear points) - show polyline only
          const basePreview: PolylineEntity = {
            id: 'preview_arc_rubberband',
            type: 'polyline',
            vertices: worldPoints,
            closed: false,
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const
          };
          previewEntity = {
            ...basePreview,
            preview: true,
            showEdgeDistances: true,
            showPreviewGrips: true,
          } as ExtendedPolylineEntity;
        }
      }
    } else {
      // For all other tools: use createEntityFromTool for proper shape preview
      previewEntity = createEntityFromTool(currentTool, worldPoints);
    }

    // Mark preview entity for special preview rendering with distance labels
    // 🏢 ENTERPRISE (2026-01-31): Added arc tools - ADR-059
    // 🏢 ENTERPRISE (2026-01-31): Added circle-3p, circle-chord-sagitta, circle-2p-radius, circle-best-fit - ADR-083
    if (previewEntity && (currentTool === 'polygon' || currentTool === 'polyline' || currentTool === 'measure-angle' || currentTool === 'measure-area' || currentTool === 'line' || currentTool === 'measure-distance' || currentTool === 'measure-distance-continuous' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'circle-diameter' || currentTool === 'circle-2p-diameter' || currentTool === 'circle-3p' || currentTool === 'circle-chord-sagitta' || currentTool === 'circle-2p-radius' || currentTool === 'circle-best-fit' || currentTool === 'arc-3p' || currentTool === 'arc-cse' || currentTool === 'arc-sce')) {

      // Handle different entity types appropriately
      // 🏢 ENTERPRISE: Cast to Record<string, unknown> for applyPreviewSettings compatibility
      if (previewEntity.type === 'polyline') {
        const extendedPolyline = previewEntity as ExtendedPolylineEntity;
        extendedPolyline.preview = true;
        extendedPolyline.showEdgeDistances = true;
        extendedPolyline.showPreviewGrips = true;
        extendedPolyline.isOverlayPreview = localState.isOverlayMode === true;
        applyPreviewSettings(extendedPolyline as unknown as Record<string, unknown>);

        // 🎯 ADR-047: Highlight first point for measure-area when 3+ points (close indicator)
        if (currentTool === 'measure-area' && worldPoints.length >= 3) {
          extendedPolyline.previewGripPoints = [
            { position: worldPoints[0], type: 'close', color: UI_COLORS.BRIGHT_GREEN }, // 🟢 Green circle = clickable close point
            { position: snappedPoint, type: 'cursor' }
          ];
        }
      } else if (previewEntity.type === 'line') {
        const extendedLine = previewEntity as ExtendedLineEntity;
        extendedLine.preview = true;
        extendedLine.showEdgeDistances = true;
        extendedLine.showPreviewGrips = true;
        extendedLine.isOverlayPreview = localState.isOverlayMode === true;
        applyPreviewSettings(extendedLine as unknown as Record<string, unknown>);

        // Add grip points for line preview
        // 🏢 ENTERPRISE (2026-01-27): Include continuous distance measurement
        if ((currentTool === 'line' || currentTool === 'measure-distance-continuous') && worldPoints.length >= 2) {
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
      } else if (previewEntity.type === 'angle-measurement') {
        // 🏢 ENTERPRISE (2026-01-27): Angle measurement preview support
        const extendedAngle = previewEntity as unknown as {
          preview?: boolean;
          showPreviewGrips?: boolean;
        } & typeof previewEntity;
        extendedAngle.preview = true;
        extendedAngle.showPreviewGrips = true;
        applyPreviewSettings(extendedAngle as unknown as Record<string, unknown>);
      } else if (previewEntity.type === 'arc') {
        // 🏢 ENTERPRISE (2026-01-31): Arc preview support - ADR-059
        const extendedArc = previewEntity as unknown as {
          preview?: boolean;
          showPreviewGrips?: boolean;
        } & typeof previewEntity;
        extendedArc.preview = true;
        extendedArc.showPreviewGrips = true;
        applyPreviewSettings(extendedArc as unknown as Record<string, unknown>);
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
    // 🔍 DEBUG (2026-01-31): Log startDrawing for circle debugging
    console.log('🚀 [startDrawing] Called with tool:', tool);

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
      console.log('🔄 [flipArcDirection] Arc flipped:', arcFlippedRef.current);

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
