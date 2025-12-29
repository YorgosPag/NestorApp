/**
 * useKeyboardShortcuts Hook
 * Handles all keyboard shortcuts for the DXF viewer
 * Extracted from DxfViewerContent.tsx for better separation of concerns
 */

import { useEffect, useRef, useCallback } from 'react';
import type { Point2D } from '../rendering/types/Types';
import type { SceneModel } from '../types/scene';
import type { Overlay, CreateOverlayData, UpdateOverlayData } from '../overlays/types';
import { useCanvasContext } from '../contexts/CanvasContext';

// Hook parameters interface
interface KeyboardShortcutsConfig {
  selectedEntityIds: string[];
  currentScene: SceneModel | null;
  onNudgeSelection: (dx: number, dy: number) => void;
  onColorMenuClose: () => void;
  activeTool: string;
  overlayMode: string;
  overlayStore: {
    getByLevel: (levelId: string) => Overlay[];
    add: (overlay: CreateOverlayData) => Promise<string>;
    update: (id: string, patch: UpdateOverlayData) => Promise<void>;
    remove: (id: string) => Promise<void>;
    setSelectedOverlay: (id: string | null) => void;
    selectedOverlayId: string | null; // ✅ ENTERPRISE FIX: Add selectedOverlayId property
  } | null;
}

export const useKeyboardShortcuts = ({
  selectedEntityIds,
  currentScene,
  onNudgeSelection,
  onColorMenuClose,
  activeTool,
  overlayMode,
  overlayStore
}: KeyboardShortcutsConfig) => {
  // 🏢 ENTERPRISE: Get centralized zoom system from context
  const canvasContext = useCanvasContext();
  const zoomManager = canvasContext?.zoomManager;

  // Constants για nudging
  const NUDGE_BASE = 0.1;         // μικρός βασικός βηματισμός (world units)
  const NUDGE_SHIFT_MULT = 3;     // Shift => ×3

  // Mouse tracking για zoom
  const lastMouseRef = useRef<Point2D | null>(null);

  // Mouse move handler
  const handleCanvasMouseMove = useCallback((pt: Point2D) => {
    lastMouseRef.current = pt;
  }, []);

  // ESC για κλείσιμο palette + keyboard nudging + zoom
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // ✅ ΕΛΕΓΧΟΣ: Αν το focus είναι σε input field, ΜΗ διαχειριστείς shortcuts
      const inputFocused = document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
         document.activeElement.tagName === 'TEXTAREA' ||
         document.activeElement.getAttribute('contenteditable') === 'true');

      // ESC κλείνει palette
      if (e.key === 'Escape') {
        onColorMenuClose();
        return;
      }

      // Delete key για διαγραφή overlay σε edit mode
      if (e.key === 'Delete' && activeTool === 'layering' && overlayMode === 'edit' && overlayStore?.selectedOverlayId) {
        e.preventDefault();
        overlayStore.remove(overlayStore.selectedOverlayId as string); // ✅ ENTERPRISE FIX: Type assertion for selectedOverlayId
        return;
      }

      // 🔥 ENTERPRISE SHORTCUTS: Shift+1 → Fit to view, Shift+0 → 100% zoom
      if (e.shiftKey && (e.code === 'Digit1' || e.code === 'Numpad1')) {
        if (inputFocused || !zoomManager) return;
        e.preventDefault();
        // Trigger fit-to-view via custom event (CanvasSection handles it)
        const event = new CustomEvent('canvas-fit-to-view', { detail: { viewport: { width: window.innerWidth, height: window.innerHeight } } });
        document.dispatchEvent(event);
        return;
      }

      if (e.shiftKey && (e.code === 'Digit0' || e.code === 'Numpad0')) {
        if (inputFocused || !zoomManager) return;
        e.preventDefault();
        // ✅ ENTERPRISE FIX: Use zoomTo100() method from context interface
        zoomManager.zoomTo100(lastMouseRef.current || undefined);
        return;
      }

      // ❌ REMOVED: Ctrl/Cmd+± shortcuts (browser conflict - hijacks page zoom)
      // Enterprise CAD systems (AutoCAD, Blender) don't use these shortcuts for this reason
      // See: pos_proxorame.txt → Enterprise Architecture Migration section

      // Bare +/- zoom (without Ctrl/Cmd) - PRIMARY keyboard zoom method
      const modifierKey = e.ctrlKey || e.metaKey; // Ctrl (Windows/Linux) or Cmd (Mac)
      const isPlus =
        e.key === '+' ||
        (e.key === '=' && !e.shiftKey) || // = χωρίς Shift (σε κάποια keyboards το + είναι Shift+=)
        e.code === 'NumpadAdd';
      const isMinus =
        e.key === '-' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract';

      if ((isPlus || isMinus) && !modifierKey && !e.shiftKey) {
        if (inputFocused || !zoomManager) return;
        e.preventDefault();

        if (isPlus) {
          zoomManager.zoomIn(lastMouseRef.current || undefined);
        } else {
          zoomManager.zoomOut(lastMouseRef.current || undefined);
        }
        return;
      }

      // Arrow keys για nudging
      if (!selectedEntityIds?.length) return;
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;

      e.preventDefault();

      // Μικρό βήμα, Shift = ×3
      const step = NUDGE_BASE * (e.shiftKey ? NUDGE_SHIFT_MULT : 1);

      let dx = 0, dy = 0;
      switch (e.key) {
        case 'ArrowUp':    dy =  step; break;   // +Y προς τα πάνω
        case 'ArrowDown':  dy = -step; break;
        case 'ArrowLeft':  dx = -step; break;
        case 'ArrowRight': dx =  step; break;
      }
      onNudgeSelection(dx, dy);
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [selectedEntityIds, onNudgeSelection, activeTool, overlayMode, overlayStore, onColorMenuClose, zoomManager]);

  return {
    handleCanvasMouseMove
  };
};