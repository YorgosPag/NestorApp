/**
 * useCanvasContextMenu Hook
 *
 * @description Manages right-click context menus on the canvas:
 * 1. DrawingContextMenu — during drawing/measurement operations
 * 2. EntityContextMenu — in select mode with entities selected
 *
 * @see ADR-047: DrawingContextMenu
 * @see ADR-053: Drawing Context Menu Handler
 * @see ADR-161: Entity Join System (EntityContextMenu)
 */

'use client';

import { useState, useCallback, useEffect, type RefObject, type MutableRefObject } from 'react';

import { isDrawingTool, isMeasurementTool } from '../../systems/tools/ToolStateManager';
import type { OverlayEditorMode } from '../../overlays/types';

// ============================================================================
// TYPES
// ============================================================================

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
}

export interface UseCanvasContextMenuParams {
  /** Container element ref for native DOM listener */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Current active tool */
  activeTool: string;
  /** Current overlay editor mode */
  overlayMode: OverlayEditorMode;
  /** Ref that returns whether unified drawing has active points */
  hasUnifiedDrawingPointsRef: MutableRefObject<() => boolean>;
  /** Ref to draft polygon array (overlay drawing system) */
  draftPolygonRef: MutableRefObject<Array<[number, number]>>;
  /** Currently selected DXF entity IDs (for entity context menu) */
  selectedEntityIds?: string[];
}

export interface UseCanvasContextMenuReturn {
  /** Drawing context menu state (isOpen + position) */
  drawingContextMenu: ContextMenuState;
  /** Entity context menu state (isOpen + position) */
  entityContextMenu: ContextMenuState;
  /** React handler — prevents browser context menu on canvas (fallback) */
  handleDrawingContextMenu: (e: React.MouseEvent) => void;
  /** Close handler for DrawingContextMenu component */
  handleDrawingContextMenuClose: (open: boolean) => void;
  /** Close handler for EntityContextMenu component */
  handleEntityContextMenuClose: (open: boolean) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCanvasContextMenu({
  containerRef,
  activeTool,
  overlayMode,
  hasUnifiedDrawingPointsRef,
  draftPolygonRef,
  selectedEntityIds = [],
}: UseCanvasContextMenuParams): UseCanvasContextMenuReturn {

  const [drawingContextMenu, setDrawingContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });

  const [entityContextMenu, setEntityContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });

  // React handler — ALWAYS prevent browser context menu on canvas
  const handleDrawingContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Close handler for DrawingContextMenu component
  const handleDrawingContextMenuClose = useCallback((open: boolean) => {
    if (!open) {
      setDrawingContextMenu(prev => ({ ...prev, isOpen: false }));
    }
  }, []);

  // Close handler for EntityContextMenu component
  const handleEntityContextMenuClose = useCallback((open: boolean) => {
    if (!open) {
      setEntityContextMenu(prev => ({ ...prev, isOpen: false }));
    }
  }, []);

  // Native DOM listener — more reliable than React synthetic events on canvas
  // Pattern: AutoCAD, Autodesk Viewer, BricsCAD
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // PRIORITY 1: Drawing context menu (during drawing with active points)
      const isUnifiedDrawing = isDrawingTool(activeTool) || isMeasurementTool(activeTool);
      const hasUnifiedPoints = hasUnifiedDrawingPointsRef.current();
      const isOverlayDrawing = overlayMode === 'draw';
      const hasOverlayPoints = draftPolygonRef.current.length > 0;

      if ((isUnifiedDrawing && hasUnifiedPoints) || (isOverlayDrawing && hasOverlayPoints)) {
        setDrawingContextMenu({
          isOpen: true,
          position: { x: e.clientX, y: e.clientY },
        });
        return;
      }

      // PRIORITY 2: Entity context menu (select mode with entities selected)
      if (activeTool === 'select' && selectedEntityIds.length > 0) {
        setEntityContextMenu({
          isOpen: true,
          position: { x: e.clientX, y: e.clientY },
        });
        return;
      }
    };

    container.addEventListener('contextmenu', handleNativeContextMenu, { capture: true });

    return () => {
      container.removeEventListener('contextmenu', handleNativeContextMenu, { capture: true });
    };
  }, [activeTool, overlayMode, containerRef, hasUnifiedDrawingPointsRef, draftPolygonRef, selectedEntityIds]);

  return {
    drawingContextMenu,
    entityContextMenu,
    handleDrawingContextMenu,
    handleDrawingContextMenuClose,
    handleEntityContextMenuClose,
  };
}
