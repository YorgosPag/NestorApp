/**
 * useCanvasContextMenu Hook
 *
 * @description Manages right-click context menus on the canvas:
 * 1. DrawingContextMenu — during drawing/measurement operations
 * 2. EntityContextMenu — in select mode with entities selected
 *
 * 🏢 PERF (2026-02-19): Uses imperative refs instead of useState.
 * Opening the context menu no longer triggers a re-render of CanvasSection
 * or CanvasLayerStack. Only the menu component itself re-renders (~94ms saved).
 *
 * @see ADR-047: DrawingContextMenu
 * @see ADR-053: Drawing Context Menu Handler
 * @see ADR-161: Entity Join System (EntityContextMenu)
 */

'use client';

import { useCallback, useEffect, type RefObject, type MutableRefObject } from 'react';

import { isDrawingTool, isMeasurementTool } from '../../systems/tools/ToolStateManager';
import type { OverlayEditorMode } from '../../overlays/types';
import type { DrawingContextMenuHandle } from '../../ui/components/DrawingContextMenu';
import type { EntityContextMenuHandle } from '../../ui/components/EntityContextMenu';
// ADR-189: Guide context menu
import type { GuideContextMenuHandle } from '../../ui/components/GuideContextMenu';
import type { Guide } from '../../systems/guides/guide-types';
import type { ViewTransform } from '../../rendering/types/Types';

// ============================================================================
// TYPES
// ============================================================================

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
  /** Imperative ref to DrawingContextMenu */
  drawingMenuRef: RefObject<DrawingContextMenuHandle | null>;
  /** Imperative ref to EntityContextMenu */
  entityMenuRef: RefObject<EntityContextMenuHandle | null>;
  /** ADR-188: Rotation phase — enables right-click angle input during awaiting-angle */
  rotationPhase?: string;
  /** ADR-188: Callback to show PromptDialog for rotation angle input */
  onRotationAnglePrompt?: () => void;
  // ADR-189: Guide context menu
  /** Imperative ref to GuideContextMenu */
  guideMenuRef?: RefObject<GuideContextMenuHandle | null>;
  /** Current construction guides (for hit-testing on right-click) */
  guides?: readonly Guide[];
  /** Current canvas transform (for world-to-screen conversion during hit-testing) */
  transformRef?: MutableRefObject<ViewTransform>;
}

export interface UseCanvasContextMenuReturn {
  /** React handler — prevents browser context menu on canvas (fallback) */
  handleDrawingContextMenu: (e: React.MouseEvent) => void;
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
  drawingMenuRef,
  entityMenuRef,
  rotationPhase,
  onRotationAnglePrompt,
  guideMenuRef,
  guides,
  transformRef,
}: UseCanvasContextMenuParams): UseCanvasContextMenuReturn {

  // React handler — ALWAYS prevent browser context menu on canvas
  const handleDrawingContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Native DOM listener — more reliable than React synthetic events on canvas
  // Pattern: AutoCAD, Autodesk Viewer, BricsCAD
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // PRIORITY 0: ADR-188 — Rotation angle input (right-click during awaiting-angle → PromptDialog)
      if (activeTool === 'rotate' && rotationPhase === 'awaiting-angle' && onRotationAnglePrompt) {
        onRotationAnglePrompt();
        return;
      }

      // PRIORITY 0.5: ADR-189 — Guide context menu (right-click near a construction guide)
      if (guideMenuRef?.current && guides && guides.length > 0 && transformRef?.current && container) {
        const rect = container.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { scale, offsetX, offsetY } = transformRef.current;
        const worldX = (screenX - offsetX) / scale;
        const worldY = (screenY - offsetY) / scale;

        // Hit-test: find nearest guide within 30px screen tolerance
        const toleranceWorld = 30 / scale;
        let nearestGuide: Guide | null = null;
        let nearestDist = Infinity;

        for (const guide of guides) {
          if (!guide.visible) continue;
          const dist = guide.axis === 'X'
            ? Math.abs(worldX - guide.offset)
            : Math.abs(worldY - guide.offset);
          if (dist < toleranceWorld && dist < nearestDist) {
            nearestDist = dist;
            nearestGuide = guide;
          }
        }

        if (nearestGuide) {
          guideMenuRef.current.open(e.clientX, e.clientY, nearestGuide);
          return;
        }
      }

      // PRIORITY 1: Drawing context menu (during drawing with active points)
      const isUnifiedDrawing = isDrawingTool(activeTool) || isMeasurementTool(activeTool);
      const hasUnifiedPoints = hasUnifiedDrawingPointsRef.current();
      const isOverlayDrawing = overlayMode === 'draw';
      const hasOverlayPoints = draftPolygonRef.current.length > 0;

      if ((isUnifiedDrawing && hasUnifiedPoints) || (isOverlayDrawing && hasOverlayPoints)) {
        // 🏢 PERF: Imperative call — no setState, no parent re-render
        drawingMenuRef.current?.open(e.clientX, e.clientY);
        return;
      }

      // PRIORITY 2: Entity context menu (select mode with entities selected)
      if (activeTool === 'select' && selectedEntityIds.length > 0) {
        // 🏢 PERF: Imperative call — no setState, no parent re-render
        entityMenuRef.current?.open(e.clientX, e.clientY);
        return;
      }
    };

    container.addEventListener('contextmenu', handleNativeContextMenu, { capture: true });

    return () => {
      container.removeEventListener('contextmenu', handleNativeContextMenu, { capture: true });
    };
  }, [activeTool, overlayMode, containerRef, hasUnifiedDrawingPointsRef, draftPolygonRef, selectedEntityIds, drawingMenuRef, entityMenuRef, rotationPhase, onRotationAnglePrompt, guideMenuRef, guides, transformRef]);

  return {
    handleDrawingContextMenu,
  };
}
