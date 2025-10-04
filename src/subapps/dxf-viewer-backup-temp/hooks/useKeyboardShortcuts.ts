/**
 * useKeyboardShortcuts Hook
 * Handles all keyboard shortcuts for the DXF viewer
 * Extracted from DxfViewerContent.tsx for better separation of concerns
 */

import { useEffect, useRef, useCallback } from 'react';
import type { Point2D } from '../rendering/types/Types';
import type { SceneModel } from '../types/scene';
import type { Overlay, CreateOverlayData, UpdateOverlayData } from '../overlays/types';
import { useCanvasOperations } from './interfaces/useCanvasOperations';

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
  // Canvas operations hook
  const canvasOps = useCanvasOperations();

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
      // ESC κλείνει palette
      if (e.key === 'Escape') {
        onColorMenuClose();
        return;
      }

      // Delete key για διαγραφή overlay σε edit mode
      if (e.key === 'Delete' && activeTool === 'layering' && overlayMode === 'edit' && overlayStore.selectedOverlayId) {
        e.preventDefault();
        overlayStore.remove(overlayStore.selectedOverlayId);
        return;
      }

      // Layout-safe ανίχνευση +/−
      const isPlus =
        e.key === '+' ||
        (e.key === '=' && e.shiftKey) ||
        e.code === 'NumpadAdd' ||
        (e.code === 'Equal' && e.shiftKey) ||
        (e.code === 'Semicolon' && e.shiftKey); // σε κάποια GR layouts
      const isMinus =
        e.key === '-' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract';

      if (isPlus || isMinus) {
        // ✅ ΕΛΕΓΧΟΣ: Αν το focus είναι σε input field, ΜΗ διαχειριστείς zoom
        const inputFocused = document.activeElement &&
          document.activeElement.tagName === 'INPUT' &&
          document.activeElement.getAttribute('type') === 'text';

        if (inputFocused) {
          return; // ΧΩΡΙΣ preventDefault - άφησε το event να φτάσει στο input
        }
        e.preventDefault();

        const factor = isPlus ? 1.2 : 1/1.2;
        const canvas = canvasOps.getCanvas();

        if (!canvas) {
          return isPlus
            ? canvasOps.zoomIn()
            : canvasOps.zoomOut();
        }

        const rect = canvas.getBoundingClientRect();

        // Zoom γύρω από τον τελευταίο δείκτη αν υπάρχει, αλλιώς κέντρο
        const pt = lastMouseRef.current
          ? lastMouseRef.current
          : { x: rect.width/2, y: rect.height/2 };

        canvasOps.zoomAtScreenPoint(factor, pt);
        return;
      }

      // Reset zoom με 0 ή Numpad0
      const isReset = e.key === '0' || e.code === 'Numpad0';
      if (isReset) {
        // ✅ ΕΛΕΓΧΟΣ: Αν το focus είναι σε input field, ΜΗ διαχειριστείς reset zoom
        const inputFocused = document.activeElement &&
          document.activeElement.tagName === 'INPUT' &&
          document.activeElement.getAttribute('type') === 'text';

        if (inputFocused) {
            return; // ΧΩΡΙΣ preventDefault - άφησε το event να φτάσει στο input
        }
        e.preventDefault();
        canvasOps.resetToOrigin();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ FIX: Empty deps - all functions/objects are stable or accessed via closure

  return {
    handleCanvasMouseMove
  };
};