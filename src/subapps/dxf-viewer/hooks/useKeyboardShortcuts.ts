/**
 * useKeyboardShortcuts Hook
 * Handles all keyboard shortcuts for the DXF viewer
 * Extracted from DxfViewerContent.tsx for better separation of concerns
 *
 * ⌨️ ENTERPRISE: Now uses centralized keyboard-shortcuts.ts (Single Source of Truth)
 * @version 2.0.0 - Centralized shortcuts migration
 */

import { useEffect, useRef, useCallback } from 'react';
import type { Point2D } from '../rendering/types/Types';
import type { SceneModel } from '../types/scene';
import type { Overlay, CreateOverlayData, UpdateOverlayData } from '../overlays/types';
import { useCanvasContext } from '../contexts/CanvasContext';
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import { matchesShortcut } from '../config/keyboard-shortcuts';
// 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
import { useUniversalSelection } from '../systems/selection';

// Hook parameters interface
interface KeyboardShortcutsConfig {
  selectedEntityIds: string[];
  currentScene: SceneModel | null;
  onNudgeSelection: (dx: number, dy: number) => void;
  onColorMenuClose: () => void;
  onDrawingCancel?: () => void; // 🎯 ADR-047: Cancel drawing on Escape
  activeTool: string;
  overlayMode: string;
  overlayStore: {
    getByLevel: (levelId: string) => Overlay[];
    add: (overlay: CreateOverlayData) => Promise<string>;
    update: (id: string, patch: UpdateOverlayData) => Promise<void>;
    remove: (id: string) => Promise<void>;
    // 🏢 ENTERPRISE (2026-01-25): Selection REMOVED - ADR-030
    // Selection is now handled by useUniversalSelection() from systems/selection/
  } | null;
}

// ⌨️ ENTERPRISE: Nudge constants (could be moved to config if needed)
const NUDGE_CONFIG = {
  BASE_STEP: 0.1,      // Base nudge step (world units)
  SHIFT_MULTIPLIER: 3, // Shift key multiplier (3x larger nudge)
} as const;

export const useKeyboardShortcuts = ({
  selectedEntityIds,
  currentScene,
  onNudgeSelection,
  onColorMenuClose,
  onDrawingCancel, // 🎯 ADR-047: Cancel drawing on Escape
  activeTool,
  overlayMode,
  overlayStore
}: KeyboardShortcutsConfig) => {
  // 🏢 ENTERPRISE: Get centralized zoom system from context
  const canvasContext = useCanvasContext();
  const zoomManager = canvasContext?.zoomManager;

  // 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
  const universalSelection = useUniversalSelection();

  // Mouse tracking για zoom
  const lastMouseRef = useRef<Point2D | null>(null);

  // Mouse move handler
  const handleCanvasMouseMove = useCallback((pt: Point2D) => {
    lastMouseRef.current = pt;
  }, []);

  // ⌨️ ENTERPRISE: Centralized keyboard event handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // ✅ GUARD: Skip if typing in input fields
      const inputFocused = document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
         document.activeElement.tagName === 'TEXTAREA' ||
         document.activeElement.getAttribute('contenteditable') === 'true');

      // ⌨️ SPECIAL SHORTCUTS - Using centralized matchesShortcut()

      // 🎯 ADR-047: ESC - Cancel drawing OR close color palette
      if (matchesShortcut(e, 'escape')) {
        // PRIORITY 1: Cancel active drawing (measure-area, polyline, polygon, etc.)
        const isDrawingTool = ['line', 'polyline', 'polygon', 'measure-area', 'measure-distance', 'measure-angle', 'rectangle', 'circle'].includes(activeTool);

        if (isDrawingTool && onDrawingCancel) {
          e.preventDefault();
          onDrawingCancel();
          return;
        }

        // PRIORITY 2: Close color palette (fallback if not drawing)
        console.log(`🎨 [useKeyboardShortcuts] ESC → Close color palette (fallback)`);
        onColorMenuClose();
        return;
      }

      // 🏢 ENTERPRISE (2026-01-26): Delete handling MOVED to CanvasSection
      // CanvasSection has access to selectedGrips and handles smart delete:
      // - If grips selected → delete vertices
      // - Else if overlay selected → delete overlay
      // This provides Single Responsibility - CanvasSection knows what to delete

      // ⌨️ ZOOM SHORTCUTS - Using centralized matchesShortcut()

      // Shift+1 → Fit to view
      if (matchesShortcut(e, 'fitToView')) {
        if (inputFocused || !zoomManager) return;
        e.preventDefault();
        const event = new CustomEvent('canvas-fit-to-view', {
          detail: { viewport: { width: window.innerWidth, height: window.innerHeight } }
        });
        document.dispatchEvent(event);
        return;
      }

      // Shift+0 → 100% zoom
      if (matchesShortcut(e, 'zoom100')) {
        if (inputFocused || !zoomManager) return;
        e.preventDefault();
        zoomManager.zoomTo100(lastMouseRef.current || undefined);
        return;
      }

      // +/= → Zoom in (bare key, no modifiers)
      if (matchesShortcut(e, 'zoomIn') || matchesShortcut(e, 'zoomInNumpad')) {
        if (inputFocused || !zoomManager) return;
        e.preventDefault();
        zoomManager.zoomIn();
        return;
      }

      // - → Zoom out (bare key, no modifiers)
      if (matchesShortcut(e, 'zoomOut') || matchesShortcut(e, 'zoomOutNumpad')) {
        if (inputFocused || !zoomManager) return;
        e.preventDefault();
        zoomManager.zoomOut();
        return;
      }

      // ⌨️ NAVIGATION SHORTCUTS - Arrow keys for nudging
      if (!selectedEntityIds?.length) return;

      const step = NUDGE_CONFIG.BASE_STEP;
      const largeStep = NUDGE_CONFIG.BASE_STEP * NUDGE_CONFIG.SHIFT_MULTIPLIER;

      // Large nudge (Shift + Arrow)
      if (matchesShortcut(e, 'nudgeUpLarge')) {
        e.preventDefault();
        onNudgeSelection(0, largeStep);
        return;
      }
      if (matchesShortcut(e, 'nudgeDownLarge')) {
        e.preventDefault();
        onNudgeSelection(0, -largeStep);
        return;
      }
      if (matchesShortcut(e, 'nudgeLeftLarge')) {
        e.preventDefault();
        onNudgeSelection(-largeStep, 0);
        return;
      }
      if (matchesShortcut(e, 'nudgeRightLarge')) {
        e.preventDefault();
        onNudgeSelection(largeStep, 0);
        return;
      }

      // Normal nudge (Arrow only)
      if (matchesShortcut(e, 'nudgeUp')) {
        e.preventDefault();
        onNudgeSelection(0, step);
        return;
      }
      if (matchesShortcut(e, 'nudgeDown')) {
        e.preventDefault();
        onNudgeSelection(0, -step);
        return;
      }
      if (matchesShortcut(e, 'nudgeLeft')) {
        e.preventDefault();
        onNudgeSelection(-step, 0);
        return;
      }
      if (matchesShortcut(e, 'nudgeRight')) {
        e.preventDefault();
        onNudgeSelection(step, 0);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [selectedEntityIds, onNudgeSelection, activeTool, overlayMode, overlayStore, onColorMenuClose, zoomManager]);

  return {
    handleCanvasMouseMove
  };
};
