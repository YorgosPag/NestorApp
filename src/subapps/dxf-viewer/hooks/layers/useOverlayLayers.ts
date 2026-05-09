'use client';

/**
 * 🏢 ENTERPRISE: useOverlayLayers Hook
 *
 * @description Converts overlay data to Canvas V2 ColorLayer format (static)
 * @see ADR-040 (mouse position SSoT)
 *
 * 🚀 PERF (2026-05-09): mouse-driven outputs (`draftColorLayer`,
 * `colorLayersWithDraft`, `isNearFirstPoint`) MOVED to `useDraftPolygonLayer`,
 * invoked downstream (CanvasLayerStack). Keeping the static colorLayers
 * computation here lets CanvasSection memoize without subscribing to mouse
 * position — the cascade that re-rendered 13+ hooks per mousemove is gone.
 *
 * Responsibilities:
 * - Convert Overlay[] to ColorLayer[]
 * - Handle selection state (grips, hover, drag)
 *
 * Pattern: Single Responsibility Principle - Pure Data Transformation
 */

import { useMemo } from 'react';
import type { ColorLayer } from '../../canvas-v2';
import type { Overlay } from '../../overlays/types';
import type { RegionStatus } from '../../types/overlay';
import type { Point2D } from '../../rendering/types/Types';
import { getStatusColors } from '../../config/color-mapping';
import { UI_COLORS } from '../../config/color-config';
import { useEntityStatusResolver } from '@/hooks/useEntityStatusResolver';

function getLinkedEntityId(overlay: Overlay): string | undefined {
  switch (overlay.kind) {
    case 'property': return overlay.linked?.propertyId;
    case 'parking': return overlay.linked?.parkingId;
    case 'storage': return overlay.linked?.storageId;
    default: return undefined;
  }
}

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
  /** 🏢 ENTERPRISE (2026-02-15): ID of hovered overlay for yellow glow highlight */
  hoveredOverlayId?: string | null;
  /** Set of overlay IDs hidden by user via eye toggle */
  hiddenOverlayIds?: Set<string>;
}

/**
 * Return type of useOverlayLayers hook
 */
export interface UseOverlayLayersReturn {
  /** Converted color layers from overlays */
  colorLayers: ColorLayer[];
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
 * const { colorLayers } = useOverlayLayers({
 *   overlays: currentOverlays,
 *   isSelected: universalSelection.isSelected,
 *   hoveredVertexInfo, hoveredEdgeInfo, selectedGrips,
 *   draggingVertex, draggingVertices, draggingEdgeMidpoint,
 *   dragPreviewPosition, hoveredOverlayId,
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
    hoveredOverlayId,
    hiddenOverlayIds,
  } = props;

  // ============================================================================
  // 🏢 ADR-258 SSoT: Real-time entity-driven status resolution
  // When an overlay is linked to a property/parking/storage, the linked
  // entity's commercialStatus drives the canvas color (matches the
  // read-only viewer behavior on the properties index page).
  // ============================================================================

  const resolvedStatusMap = useEntityStatusResolver(overlays);

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
        const isLinked = !!getLinkedEntityId(overlay);
        const liveStatus = resolvedStatusMap.get(overlay.id);
        const effectiveStatus = isLinked ? liveStatus : overlay.status;
        const statusColors = effectiveStatus ? getStatusColors(effectiveStatus) : null;
        // 🏢 ADR-258: status colors win over style overrides when entity is linked,
        // so the canvas always reflects the live commercial status.
        // Unlinked layers use the status-neutral DRAFT pink so they never clash
        // with the for-rent blue / for-sale green / etc. status palette.
        const fillColor = isLinked
          ? statusColors?.fill || overlay.style?.fill || UI_COLORS.LAYER_DRAFT_FILL
          : overlay.style?.fill || UI_COLORS.LAYER_DRAFT_FILL;
        const strokeColor = isLinked
          ? statusColors?.stroke || overlay.style?.stroke || UI_COLORS.BLACK
          : overlay.style?.stroke || UI_COLORS.LAYER_DRAFT_STROKE;

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
          visible: !hiddenOverlayIds?.has(overlay.id),
          zIndex: index,
          status: (effectiveStatus ?? overlay.status) as RegionStatus | undefined,
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
          // 🏢 ENTERPRISE (2026-02-15): Hover state for overlay yellow glow
          isHovered: hoveredOverlayId === overlay.id,
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
    hoveredOverlayId,
    hiddenOverlayIds,
    resolvedStatusMap,
  ]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return { colorLayers };
}

export default useOverlayLayers;
