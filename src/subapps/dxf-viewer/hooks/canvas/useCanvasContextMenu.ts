/**
 * 🏢 ENTERPRISE: useCanvasContextMenu Hook
 *
 * @description Manages the AutoCAD-style right-click context menu during drawing operations.
 * Handles state, React preventDefault handler, native DOM listener, and close logic.
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~35 lines of context menu logic
 *
 * @see ADR-047: DrawingContextMenu
 * @see ADR-053: Drawing Context Menu Handler
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
}

export interface UseCanvasContextMenuReturn {
  /** Context menu state (isOpen + position) */
  drawingContextMenu: ContextMenuState;
  /** React handler — prevents browser context menu on canvas (fallback) */
  handleDrawingContextMenu: (e: React.MouseEvent) => void;
  /** Close handler for DrawingContextMenu component */
  handleDrawingContextMenuClose: (open: boolean) => void;
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
}: UseCanvasContextMenuParams): UseCanvasContextMenuReturn {

  const [drawingContextMenu, setDrawingContextMenu] = useState<ContextMenuState>({
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

  // Native DOM listener — more reliable than React synthetic events on canvas
  // Pattern: AutoCAD, Autodesk Viewer, BricsCAD
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Only show OUR context menu when in drawing mode with points
      const isUnifiedDrawing = isDrawingTool(activeTool) || isMeasurementTool(activeTool);
      const hasUnifiedPoints = hasUnifiedDrawingPointsRef.current();
      const isOverlayDrawing = overlayMode === 'draw';
      const hasOverlayPoints = draftPolygonRef.current.length > 0;

      if ((isUnifiedDrawing && hasUnifiedPoints) || (isOverlayDrawing && hasOverlayPoints)) {
        setDrawingContextMenu({
          isOpen: true,
          position: { x: e.clientX, y: e.clientY },
        });
      }
    };

    container.addEventListener('contextmenu', handleNativeContextMenu, { capture: true });

    return () => {
      container.removeEventListener('contextmenu', handleNativeContextMenu, { capture: true });
    };
  }, [activeTool, overlayMode, containerRef, hasUnifiedDrawingPointsRef, draftPolygonRef]);

  return {
    drawingContextMenu,
    handleDrawingContextMenu,
    handleDrawingContextMenuClose,
  };
}
