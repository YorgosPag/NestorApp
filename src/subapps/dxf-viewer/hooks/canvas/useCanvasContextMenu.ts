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
// ADR-532 B4 — event-time selection read (CanvasSection no longer re-renders on selection).
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
// ADR-539 Φ3f — when the 3D Cinema 4D «Polygon Mode» is active, the per-face context menu
// (BimViewport3D) owns the right-click; this 2D capture-phase handler must yield so it does
// not pre-empt it with the generic entity menu.
import { usePolygonMode3DStore } from '../../bim-3d/stores/PolygonMode3DStore';
import type { OverlayEditorMode } from '../../overlays/types';
import type { DrawingContextMenuHandle } from '../../ui/components/DrawingContextMenu';
import type { EntityContextMenuHandle } from '../../ui/components/EntityContextMenu';
// ADR-189: Guide context menu
import type { GuideContextMenuHandle } from '../../ui/components/GuideContextMenu';
import type { Guide } from '../../systems/guides/guide-types';
import type { ViewTransform } from '../../rendering/types/Types';
// ADR-362 Phase M1: Dimension entity context menu
import type { DimensionContextMenuHandle } from '../../ui/context-menus/DimensionContextMenu';

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
  /** ADR-040: getter reads from GuideStore at event time — prevents stale snapshot */
  getGuides?: () => readonly Guide[];
  /** Current canvas transform (for world-to-screen conversion during hit-testing) */
  transformRef?: MutableRefObject<ViewTransform>;
  // ADR-189 B14: Batch guide context menu
  /** Imperative ref to GuideBatchContextMenu */
  guideBatchMenuRef?: RefObject<import('../../ui/components/GuideBatchContextMenu').GuideBatchContextMenuHandle | null>;
  /** Currently selected guide IDs */
  selectedGuideIds?: ReadonlySet<string>;
  // ADR-362 Phase M1: Dimension context menu
  /** Imperative ref to DimensionContextMenu */
  dimContextMenuRef?: RefObject<DimensionContextMenuHandle | null>;
  /** IDs of currently selected dimension entities (drives dim menu priority). */
  selectedDimensionIds?: readonly string[];
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
  drawingMenuRef,
  entityMenuRef,
  rotationPhase,
  onRotationAnglePrompt,
  guideMenuRef,
  guides: guidesSnapshot,
  getGuides,
  transformRef,
  guideBatchMenuRef,
  selectedGuideIds,
  dimContextMenuRef,
  selectedDimensionIds,
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

    // Right-drag detection: right-drag = pan (BricsCAD hybrid), right-click = context menu.
    // Track drag distance; if > 5px, suppress contextmenu on release.
    let rightButtonDownX = 0;
    let rightButtonDownY = 0;
    let rightDragMoved = false;

    const handleRightMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      rightButtonDownX = e.clientX;
      rightButtonDownY = e.clientY;
      rightDragMoved = false;
    };

    const handleRightMouseMove = (e: MouseEvent) => {
      if (!(e.buttons & 2)) return;
      const dx = e.clientX - rightButtonDownX;
      const dy = e.clientY - rightButtonDownY;
      if (dx * dx + dy * dy > 25) rightDragMoved = true; // 5px threshold
    };

    const handleNativeContextMenu = (e: MouseEvent) => {
      // ADR-539 Φ3f — yield to the 3D per-face context menu when Polygon Mode is active.
      // This listener is capture-phase on an ancestor of the BimViewport3D canvas, so without
      // this bail it pre-empts the 3D face menu (BimViewport3D `onContextMenu`) and opens the
      // generic entity menu instead. Returning WITHOUT preventDefault/stopPropagation lets the
      // event fall through to the bubble-phase 3D handler.
      if (usePolygonMode3DStore.getState().active) return;

      if (rightDragMoved) {
        rightDragMoved = false;
        e.preventDefault();
        return;
      }

      // RulerCornerBox owns its own context menu — let the event pass through to React
      if ((e.target as Element)?.closest('[data-ruler-corner-box]')) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // PRIORITY 0: ADR-188 — Rotation angle input (right-click during awaiting-angle → PromptDialog)
      if (activeTool === 'rotate' && rotationPhase === 'awaiting-angle' && onRotationAnglePrompt) {
        onRotationAnglePrompt();
        return;
      }

      // PRIORITY 0.3: ADR-189 B14 — Batch guide context menu (right-click with multi-select active)
      if (guideBatchMenuRef?.current && selectedGuideIds && selectedGuideIds.size > 0 && activeTool === 'guide-select') {
        guideBatchMenuRef.current.open(e.clientX, e.clientY, selectedGuideIds.size);
        return;
      }

      // PRIORITY 0.5: ADR-189 — Guide context menu (right-click near a construction guide)
      // ADR-040: resolve from store at event time to avoid stale snapshot
      const guides = getGuides?.() ?? guidesSnapshot;
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

      // PRIORITY 1.5: ADR-362 Phase M1 — Dimension context menu (select mode, dims selected)
      if (
        activeTool === 'select' &&
        dimContextMenuRef?.current &&
        selectedDimensionIds &&
        selectedDimensionIds.length > 0
      ) {
        dimContextMenuRef.current.open(e.clientX, e.clientY);
        return;
      }

      // PRIORITY 2: Entity context menu (select mode with entities selected)
      // ADR-532 B4 — read the selection at event time (no stale render snapshot).
      if (activeTool === 'select' && SelectedEntitiesStore.getSelectedEntityIds().length > 0) {
        // 🏢 PERF: Imperative call — no setState, no parent re-render
        entityMenuRef.current?.open(e.clientX, e.clientY);
        return;
      }
    };

    container.addEventListener('mousedown', handleRightMouseDown);
    container.addEventListener('mousemove', handleRightMouseMove);
    container.addEventListener('contextmenu', handleNativeContextMenu, { capture: true });

    return () => {
      container.removeEventListener('mousedown', handleRightMouseDown);
      container.removeEventListener('mousemove', handleRightMouseMove);
      container.removeEventListener('contextmenu', handleNativeContextMenu, { capture: true });
    };
  }, [activeTool, overlayMode, containerRef, hasUnifiedDrawingPointsRef, draftPolygonRef, drawingMenuRef, entityMenuRef, rotationPhase, onRotationAnglePrompt, guideMenuRef, getGuides, guidesSnapshot, transformRef, guideBatchMenuRef, selectedGuideIds, dimContextMenuRef, selectedDimensionIds]);

  return {
    handleDrawingContextMenu,
  };
}
