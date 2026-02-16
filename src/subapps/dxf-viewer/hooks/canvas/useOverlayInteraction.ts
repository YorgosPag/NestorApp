/**
 * 🏢 ENTERPRISE: useOverlayInteraction Hook — Extraction #12
 *
 * @description Overlay click interaction handlers.
 * - createOverlayHandlers factory (bridge to universal selection)
 * - handleEdgeMidpointClick (vertex insertion on edge click)
 * - handleOverlayClick (multi-path overlay click routing)
 * - handleMultiOverlayClick (marquee multi-selection)
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~88 lines
 */

'use client';

import { useCallback } from 'react';
import { createOverlayHandlers } from '../../overlays/types';
import { findOverlayEdgeForGrip } from '../../utils/entity-conversion';
import { POLYGON_TOLERANCES } from '../../config/tolerance-config';
import { deepClone } from '../../utils/clone-utils';
import { derr } from '../../debug';
import type { Overlay, OverlayEditorMode, UpdateOverlayData } from '../../overlays/types';
import type { Point2D } from '../../rendering/types/Types';
import type { EdgeHoverInfo, DraggingOverlayBodyState } from './useCanvasMouse';

// ============================================================================
// TYPES
// ============================================================================

/** Minimal overlay store interface — only methods used by this hook */
interface OverlayStoreLike {
  remove: (id: string) => void;
  update: (id: string, data: UpdateOverlayData) => void;
  getSelectedOverlay: () => Overlay | null;
  overlays: Record<string, Overlay>;
  addVertex: (overlayId: string, index: number, vertex: [number, number]) => Promise<void>;
}

/** Minimal universal selection interface — only methods used by this hook */
interface UniversalSelectionLike {
  select: (id: string, type: 'overlay' | 'dxf-entity') => void;
  clearByType: (type: 'overlay' | 'dxf-entity') => void;
  selectMultiple: (items: Array<{ id: string; type: 'overlay' }>) => void;
}

export interface UseOverlayInteractionParams {
  /** Current active tool */
  activeTool: string;
  /** Current overlay editor mode */
  overlayMode: OverlayEditorMode;
  /** Current level's overlays */
  currentOverlays: Overlay[];
  /** Universal selection system */
  universalSelection: UniversalSelectionLike;
  /** Overlay store for CRUD operations */
  overlayStore: OverlayStoreLike;
  /** Currently hovered edge info (for midpoint click detection) */
  hoveredEdgeInfo: EdgeHoverInfo | null;
  /** Current transform scale (for edge tolerance calculation) */
  transformScale: number;
  /** Zoom to a specific overlay */
  fitToOverlay: (overlayId: string) => void;
  /** Start overlay body drag */
  setDraggingOverlayBody: (state: DraggingOverlayBodyState | null) => void;
  /** Set drag preview position */
  setDragPreviewPosition: (pos: Point2D | null) => void;
}

export interface UseOverlayInteractionReturn {
  /** Click handler for single overlay selection + vertex insertion */
  handleOverlayClick: (overlayId: string, point: Point2D) => void;
  /** Click handler for marquee multi-selection */
  handleMultiOverlayClick: (layerIds: string[]) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useOverlayInteraction({
  activeTool,
  overlayMode,
  currentOverlays,
  universalSelection,
  overlayStore,
  hoveredEdgeInfo,
  transformScale,
  fitToOverlay,
  setDraggingOverlayBody,
  setDragPreviewPosition,
}: UseOverlayInteractionParams): UseOverlayInteractionReturn {

  // Bridge to universal selection system — ADR-030
  const { handleOverlaySelect } =
    createOverlayHandlers({
      setSelectedOverlay: (id: string | null) => {
        if (id) {
          universalSelection.select(id, 'overlay');
        } else {
          universalSelection.clearByType('overlay');
        }
      },
      remove: overlayStore.remove,
      update: overlayStore.update,
      getSelectedOverlay: overlayStore.getSelectedOverlay,
      overlays: overlayStore.overlays
    }, undefined);

  // Edge midpoint click handler for vertex insertion
  const handleEdgeMidpointClick = async (overlayId: string, edgeIndex: number, insertPoint: Point2D) => {
    const overlay = currentOverlays.find(o => o.id === overlayId);
    if (!overlay) return;

    const vertex: [number, number] = [insertPoint.x, insertPoint.y];
    const insertIndex = edgeIndex + 1;

    try {
      await overlayStore.addVertex(overlayId, insertIndex, vertex);
    } catch (error) {
      derr('useOverlayInteraction', 'Failed to add vertex:', error);
    }
  };

  // Overlay click routing: edge midpoint → selection → move → auto-fit
  const handleOverlayClick = (overlayId: string, point: Point2D) => {
    // Check for edge midpoint click first (vertex insertion)
    if ((activeTool === 'select' || activeTool === 'layering') && hoveredEdgeInfo?.overlayId === overlayId) {
      const overlay = currentOverlays.find(o => o.id === overlayId);
      if (overlay?.polygon) {
        const edgeTolerance = POLYGON_TOLERANCES.EDGE_DETECTION / transformScale;
        const edgeInfo = findOverlayEdgeForGrip(point, overlay.polygon, edgeTolerance);

        if (edgeInfo && edgeInfo.edgeIndex === hoveredEdgeInfo.edgeIndex) {
          handleEdgeMidpointClick(overlayId, edgeInfo.edgeIndex, edgeInfo.insertPoint);
          return;
        }
      }
    }

    // Automatic layer selection for select/layering/move tools
    if (activeTool === 'select' || activeTool === 'layering' || activeTool === 'move' || overlayMode === 'select') {
      handleOverlaySelect(overlayId);

      // Start overlay body drag if move tool is active
      if (activeTool === 'move') {
        const overlay = currentOverlays.find(o => o.id === overlayId);
        if (overlay?.polygon) {
          setDraggingOverlayBody({
            overlayId,
            startPoint: point,
            startPolygon: deepClone(overlay.polygon)
          });
          setDragPreviewPosition(point);
        }
      }

      // Auto fit to view for layering tool
      if (activeTool === 'layering') {
        setTimeout(() => {
          fitToOverlay(overlayId);
        }, 100);
      }
    }
  };

  // Marquee multi-selection handler
  const handleMultiOverlayClick = useCallback((layerIds: string[]) => {
    if (activeTool === 'select' || activeTool === 'layering' || overlayMode === 'select') {
      universalSelection.selectMultiple(layerIds.map(id => ({ id, type: 'overlay' as const })));
    }
  }, [activeTool, overlayMode, universalSelection]);

  return {
    handleOverlayClick,
    handleMultiOverlayClick,
  };
}
