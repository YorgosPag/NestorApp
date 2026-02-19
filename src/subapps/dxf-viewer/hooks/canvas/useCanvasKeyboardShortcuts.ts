/**
 * 🏢 ENTERPRISE: useCanvasKeyboardShortcuts Hook
 *
 * @description Window-level keyboard shortcuts for canvas operations:
 * - Delete/Backspace → context-aware smart delete
 * - Escape → cancel grip interaction / clear draft polygon / clear grips
 * - Enter → finish continuous drawing tool or overlay polygon
 * - X → flip arc direction during arc drawing
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~61 lines of keyboard handler useEffect
 *
 * @see ADR-032: Command History / Undo-Redo
 * @see ADR-083: Continuous drawing tools
 */

'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { SelectedGrip } from '../grips/useGripSystem';

// ============================================================================
// TYPES
// ============================================================================

/** Subset of useDxfGripInteraction return — only the methods used by this hook */
interface DxfGripInteractionLike {
  handleGripEscape: () => boolean;
}

export interface UseCanvasKeyboardShortcutsParams {
  /** Context-aware delete handler */
  handleSmartDelete: () => Promise<boolean>;
  /** DXF grip interaction for Escape handling */
  dxfGripInteraction: DxfGripInteractionLike;
  /** Setter for draft polygon state */
  setDraftPolygon: Dispatch<SetStateAction<Array<[number, number]>>>;
  /** Current draft polygon points */
  draftPolygon: Array<[number, number]>;
  /** Currently selected grip vertices */
  selectedGrips: SelectedGrip[];
  /** Clear grip selection */
  setSelectedGrips: (grips: SelectedGrip[]) => void;
  /** Active tool name */
  activeTool: string;
  /** Finish handler for continuous drawing tools */
  handleDrawingFinish: () => void;
  /** Flip arc direction handler */
  handleFlipArc: () => void;
  /** Legacy finish drawing for overlay polygons */
  finishDrawing: () => Promise<void>;
  /** ADR-161: Selected entity IDs for join shortcut */
  selectedEntityIds?: string[];
  /** ADR-161: Join handler (J key) */
  handleEntityJoin?: () => void;
  /** ADR-161: Check if join is possible */
  canEntityJoin?: boolean;
  /** Callback to exit overlay draw mode on Escape (resets overlayMode to 'select') */
  onExitDrawMode?: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCanvasKeyboardShortcuts({
  handleSmartDelete,
  dxfGripInteraction,
  setDraftPolygon,
  draftPolygon,
  selectedGrips,
  setSelectedGrips,
  activeTool,
  handleDrawingFinish,
  handleFlipArc,
  finishDrawing,
  selectedEntityIds = [],
  handleEntityJoin,
  canEntityJoin = false,
  onExitDrawMode,
}: UseCanvasKeyboardShortcutsParams): void {

  // Handle keyboard shortcuts for drawing, delete, and local operations
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // 🏢 ENTERPRISE (2026-01-26): Smart Delete - ADR-032
      // Delete/Backspace: Context-aware deletion (grips first, then overlays)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation(); // 🏢 Prevent other handlers from receiving this event
        await handleSmartDelete();
        return;
      }

      // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Zoom shortcuts μετακόμισαν στο hooks/useKeyboardShortcuts.ts
      // Εδώ κρατάμε ΜΟΝΟ local shortcuts για drawing mode (Escape, Enter)

      switch (e.key) {
        case 'Escape':
          // 🏢 ENTERPRISE (2026-02-15): Escape cancels grip following mode first
          if (dxfGripInteraction.handleGripEscape()) {
            break; // Consumed by grip interaction
          }
          setDraftPolygon([]);
          // 🏢 FIX (2026-02-19): Escape must also exit overlay draw mode
          // Previously only cleared draft points but overlayMode stayed 'draw',
          // causing next click to resume polygon drawing unexpectedly
          onExitDrawMode?.();
          // 🏢 ENTERPRISE: Escape also clears grip selection
          if (selectedGrips.length > 0) {
            setSelectedGrips([]);
          }
          break;
        case 'Enter': {
          // 🏢 ENTERPRISE (2026-01-31): Handle Enter for continuous drawing tools - ADR-083
          // Check if we're in a continuous drawing mode (polyline, polygon, measure-area, circle-best-fit, etc.)
          const continuousTools = ['polyline', 'polygon', 'measure-area', 'measure-angle', 'measure-distance-continuous', 'circle-best-fit'];
          if (continuousTools.includes(activeTool)) {
            e.preventDefault();
            handleDrawingFinish();
          } else if (draftPolygon.length >= 3) {
            // Legacy: Overlay polygon mode
            finishDrawing();
          }
          break;
        }
        // 🏢 ENTERPRISE (2026-01-31): "X" key for flip arc direction during arc drawing
        case 'x':
        case 'X':
          // Only flip if we're in arc drawing mode
          if (activeTool === 'arc-3p' || activeTool === 'arc-cse' || activeTool === 'arc-sce') {
            e.preventDefault();
            handleFlipArc();
          }
          break;
        // ADR-161: "J" key for Join entities in select mode
        case 'j':
        case 'J':
          if (activeTool === 'select' && canEntityJoin && handleEntityJoin) {
            e.preventDefault();
            handleEntityJoin();
          }
          break;
      }
    };

    // 🏢 ENTERPRISE: Use capture: true to handle Delete before other handlers
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [draftPolygon, finishDrawing, handleSmartDelete, selectedGrips, activeTool, handleFlipArc, handleDrawingFinish, canEntityJoin, handleEntityJoin, selectedEntityIds, onExitDrawMode]);
}
