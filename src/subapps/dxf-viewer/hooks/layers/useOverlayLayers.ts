'use client';

/**
 * 🏢 ENTERPRISE: useOverlayLayers Hook
 *
 * @description Converts overlay data to Canvas V2 ColorLayer format
 * @see ADR-XXX: CanvasSection Decomposition
 *
 * Responsibilities:
 * - Convert Overlay[] to ColorLayer[]
 * - Handle selection state (grips, hover, drag)
 * - Create draft polygon preview layer
 * - Combine saved layers with draft preview
 *
 * Pattern: Single Responsibility Principle - Pure Data Transformation
 * Extracted from: CanvasSection.tsx
 */

import { useMemo } from 'react';
import type { ColorLayer } from '../../canvas-v2';
import type { Overlay } from '../../overlays/types';
import type { RegionStatus } from '../../types/overlay';
import type { Point2D } from '../../rendering/types/Types';
import { getStatusColors } from '../../config/color-mapping';
import { UI_COLORS } from '../../config/color-config';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { POLYGON_TOLERANCES } from '../../config/tolerance-config';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Hover information for vertex grips
 */
interface VertexHoverInfo {
  overlayId: string;
  vertexIndex: number;
}

/**
 * Hover information for edge midpoint grips
 */
interface EdgeHoverInfo {
  overlayId: string;
  edgeIndex: number;
}

/**
 * Selected grip state
 */
interface SelectedGrip {
  type: 'vertex' | 'edge-midpoint';
  overlayId: string;
  index: number;
}

/**
 * Dragging vertex state (simplified)
 */
interface DraggingVertexState {
  overlayId: string;
  vertexIndex: number;
  startPoint: Point2D;
  originalPosition: Point2D;
}

/**
 * Dragging edge midpoint state (simplified)
 */
interface DraggingEdgeMidpointState {
  overlayId: string;
  edgeIndex: number;
}

/**
 * Status type for overlays
 * Includes all possible status values from the application
 */
type OverlayStatus = 'for-sale' | 'for-rent' | 'reserved' | 'sold' | 'landowner' | 'rented' | 'under-negotiation' | 'coming-soon' | 'off-market' | 'unavailable';

/**
 * Props for useOverlayLayers hook
 */
export interface UseOverlayLayersProps {
  /** Current overlays to convert */
  overlays: Overlay[];
  /** Function to check if overlay is selected */
  isSelected: (id: string) => boolean;
  /** Hovered vertex info */
  hoveredVertexInfo: VertexHoverInfo | null;
  /** Hovered edge info */
  hoveredEdgeInfo: EdgeHoverInfo | null;
  /** Selected grips array */
  selectedGrips: SelectedGrip[];
  /** Single dragging vertex (backwards compatibility) */
  draggingVertex: { overlayId: string } | null;
  /** Multiple dragging vertices */
  draggingVertices: DraggingVertexState[] | null;
  /** Dragging edge midpoint */
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
  /** Drag preview position */
  dragPreviewPosition: Point2D | null;
  /** Draft polygon points */
  draftPolygon: Array<[number, number]>;
  /** Current mouse world position */
  mouseWorld: Point2D | null;
  /** Current transform scale */
  transformScale: number;
  /** Current status for draft polygon */
  currentStatus: OverlayStatus;
}

/**
 * Return type of useOverlayLayers hook
 */
export interface UseOverlayLayersReturn {
  /** Converted color layers from overlays */
  colorLayers: ColorLayer[];
  /** Draft polygon preview layer (null if no draft) */
  draftColorLayer: ColorLayer | null;
  /** Combined layers (colorLayers + draftColorLayer) */
  colorLayersWithDraft: ColorLayer[];
  /** Whether mouse is near first point of draft polygon */
  isNearFirstPoint: boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Overlay to ColorLayer conversion hook
 *
 * This hook handles all the conversion logic from Overlay[] to ColorLayer[],
 * including selection states, grip rendering, and drag previews.
 *
 * @example
 * ```tsx
 * const {
 *   colorLayers,
 *   draftColorLayer,
 *   colorLayersWithDraft,
 *   isNearFirstPoint,
 * } = useOverlayLayers({
 *   overlays: currentOverlays,
 *   isSelected: universalSelection.isSelected,
 *   hoveredVertexInfo,
 *   hoveredEdgeInfo,
 *   selectedGrips,
 *   draggingVertex,
 *   draggingVertices,
 *   draggingEdgeMidpoint,
 *   dragPreviewPosition,
 *   draftPolygon,
 *   mouseWorld,
 *   transformScale: transform.scale,
 *   currentStatus,
 * });
 * ```
 */
export function useOverlayLayers(props: UseOverlayLayersProps): UseOverlayLayersReturn {
  const {
    overlays,
    isSelected,
    hoveredVertexInfo,
    hoveredEdgeInfo,
    selectedGrips,
    draggingVertex,
    draggingVertices,
    draggingEdgeMidpoint,
    dragPreviewPosition,
    draftPolygon,
    mouseWorld,
    transformScale,
    currentStatus,
  } = props;

  // ============================================================================
  // COLOR LAYERS CONVERSION
  // ============================================================================

  /**
   * Convert overlays to ColorLayer format
   */
  const colorLayers: ColorLayer[] = useMemo(() => {
    return overlays
      .filter(overlay => overlay.polygon && Array.isArray(overlay.polygon) && overlay.polygon.length >= 3)
      .map((overlay, index) => {
        const vertices = overlay.polygon.map((point: [number, number]) => ({ x: point[0], y: point[1] }));

        // Get selection state
        const overlayIsSelected = isSelected(overlay.id);
        const statusColors = overlay.status ? getStatusColors(overlay.status) : null;
        const fillColor = overlay.style?.fill || statusColors?.fill || UI_COLORS.BUTTON_PRIMARY;
        const strokeColor = overlay.style?.stroke || statusColors?.stroke || UI_COLORS.BLACK;

        // Build drag state if this overlay has dragging vertices
        let dragState: { delta: Point2D; originalPositions: Map<number, Point2D> } | undefined;
        if (draggingVertices && draggingVertices.length > 0 && dragPreviewPosition) {
          const overlayDraggingVertices = draggingVertices.filter(dv => dv.overlayId === overlay.id);
          if (overlayDraggingVertices.length > 0) {
            const originalPositions = new Map<number, Point2D>();
            overlayDraggingVertices.forEach(dv => {
              originalPositions.set(dv.vertexIndex, dv.originalPosition);
            });

            const delta = {
              x: dragPreviewPosition.x - draggingVertices[0].startPoint.x,
              y: dragPreviewPosition.y - draggingVertices[0].startPoint.y
            };

            dragState = { delta, originalPositions };
          }
        }

        return {
          id: overlay.id,
          name: overlay.label || `Layer ${index + 1}`,
          color: fillColor,
          opacity: overlay.style?.opacity ?? 0.7,
          visible: true,
          zIndex: index,
          status: overlay.status as RegionStatus | undefined,
          // Grip visibility
          showGrips: overlayIsSelected,
          showEdgeMidpoints: overlayIsSelected,
          // WARM state (hover)
          hoveredEdgeIndex: hoveredEdgeInfo?.overlayId === overlay.id ? hoveredEdgeInfo.edgeIndex : undefined,
          hoveredVertexIndex: hoveredVertexInfo?.overlayId === overlay.id ? hoveredVertexInfo.vertexIndex : undefined,
          // HOT state (selected grips)
          selectedGripIndices: selectedGrips
            .filter(g => g.overlayId === overlay.id && g.type === 'vertex')
            .map(g => g.index),
          selectedEdgeMidpointIndices: selectedGrips
            .filter(g => g.overlayId === overlay.id && g.type === 'edge-midpoint')
            .map(g => g.index),
          // Drag state
          isDragging: draggingVertex?.overlayId === overlay.id || draggingEdgeMidpoint?.overlayId === overlay.id,
          dragPreviewPosition: (draggingVertex?.overlayId === overlay.id || draggingEdgeMidpoint?.overlayId === overlay.id)
            ? dragPreviewPosition ?? undefined
            : undefined,
          dragState,
          // Polygon data
          polygons: [{
            id: `polygon_${overlay.id}`,
            vertices,
            fillColor,
            strokeColor: overlayIsSelected ? UI_COLORS.SELECTED_RED : strokeColor,
            strokeWidth: overlayIsSelected ? 3 : 2,
            selected: overlayIsSelected
          }]
        };
      });
  }, [
    overlays,
    isSelected,
    hoveredVertexInfo,
    hoveredEdgeInfo,
    selectedGrips,
    draggingVertex,
    draggingVertices,
    draggingEdgeMidpoint,
    dragPreviewPosition,
  ]);

  // ============================================================================
  // DRAFT POLYGON DETECTION
  // ============================================================================

  /**
   * Check if mouse is near first point of draft polygon (for closing)
   */
  const isNearFirstPoint = useMemo(() => {
    if (draftPolygon.length < 3 || !mouseWorld) return false;
    const firstPoint = draftPolygon[0];
    const distance = calculateDistance(mouseWorld, { x: firstPoint[0], y: firstPoint[1] });
    return distance < (POLYGON_TOLERANCES.CLOSE_DETECTION / transformScale);
  }, [draftPolygon, mouseWorld, transformScale]);

  // ============================================================================
  // DRAFT COLOR LAYER
  // ============================================================================

  /**
   * Create draft polygon preview layer
   */
  const draftColorLayer: ColorLayer | null = useMemo(() => {
    if (draftPolygon.length < 1) return null;

    const statusColors = getStatusColors(currentStatus);
    const fillColor = statusColors?.fill ?? UI_COLORS.PRIMARY_FILL_30;
    const strokeColor = statusColors?.stroke ?? UI_COLORS.BUTTON_PRIMARY;

    return {
      id: 'draft-polygon-preview',
      name: 'Draft Polygon (Preview)',
      color: fillColor,
      opacity: 0.5,
      visible: true,
      zIndex: 999,
      status: currentStatus as RegionStatus,
      isDraft: true,
      showGrips: true,
      isNearFirstPoint: isNearFirstPoint,
      polygons: [{
        id: 'draft-polygon-preview-0',
        vertices: draftPolygon.map(([x, y]) => ({ x, y })),
        fillColor: fillColor,
        strokeColor: strokeColor,
        strokeWidth: 2,
        selected: false
      }]
    };
  }, [draftPolygon, currentStatus, isNearFirstPoint]);

  // ============================================================================
  // COMBINED LAYERS
  // ============================================================================

  /**
   * Combine saved layers with draft preview
   */
  const colorLayersWithDraft = useMemo(() => {
    return draftColorLayer ? [...colorLayers, draftColorLayer] : colorLayers;
  }, [colorLayers, draftColorLayer]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    colorLayers,
    draftColorLayer,
    colorLayersWithDraft,
    isNearFirstPoint,
  };
}

export default useOverlayLayers;
