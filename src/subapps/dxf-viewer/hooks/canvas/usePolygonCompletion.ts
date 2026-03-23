/**
 * 🏢 ENTERPRISE: usePolygonCompletion Hook
 *
 * @description Manages overlay polygon draft state and completion logic.
 * Owns: draftPolygon state, isSavingPolygon state, refs for async access,
 * finishDrawingWithPolygon save logic, EventBus listeners for save/cancel.
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~86 lines of polygon completion state and logic
 *
 * @see ADR-047: DrawingContextMenu
 */

'use client';

import { useState, useRef, useEffect, type Dispatch, type SetStateAction, type MutableRefObject } from 'react';
import { dwarn, derr } from '../../debug';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { useEventBus } from '../../systems/events';

// ============================================================================
// TYPES
// ============================================================================

export interface UsePolygonCompletionParams {
  /** Level manager for currentLevelId */
  levelManager: LevelsHookReturn;
  /** Overlay store for add() operations */
  overlayStore: ReturnType<typeof useOverlayStore>;
  /** Event bus for polygon save/cancel events */
  eventBus: ReturnType<typeof useEventBus>;
  /** Current overlay status for new polygons */
  currentStatus: Status;
  /** Current overlay kind for new polygons */
  currentKind: OverlayKind;
  /** Active tool name */
  activeTool: string;
  /** Current overlay editor mode */
  overlayMode: OverlayEditorMode;
}

export interface UsePolygonCompletionReturn {
  /** Current draft polygon points */
  draftPolygon: Array<[number, number]>;
  /** Setter for draft polygon state */
  setDraftPolygon: Dispatch<SetStateAction<Array<[number, number]>>>;
  /** Ref to draft polygon for fresh access in async operations */
  draftPolygonRef: MutableRefObject<Array<[number, number]>>;
  /** Whether a polygon save is in progress */
  isSavingPolygon: boolean;
  /** Setter for saving state */
  setIsSavingPolygon: Dispatch<SetStateAction<boolean>>;
  /** Ref to finishDrawingWithPolygon — avoids block-scope issues */
  finishDrawingWithPolygonRef: MutableRefObject<(polygon: Array<[number, number]>) => Promise<boolean>>;
  /** Legacy function for Enter key support (uses current draftPolygon state) */
  finishDrawing: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePolygonCompletion({
  levelManager,
  overlayStore,
  eventBus,
  currentStatus,
  currentKind,
  activeTool,
  overlayMode,
}: UsePolygonCompletionParams): UsePolygonCompletionReturn {

  const [draftPolygon, setDraftPolygon] = useState<Array<[number, number]>>([]);
  // 🔧 FIX (2026-01-24): Ref for fresh polygon access in async operations
  const draftPolygonRef = useRef<Array<[number, number]>>([]);
  // 🏢 ENTERPRISE (2026-02-15): Ref for finishDrawingWithPolygon — avoids block-scope issues
  // (function declared after action handlers, ref updated when function is created)
  const finishDrawingWithPolygonRef = useRef<(polygon: Array<[number, number]>) => Promise<boolean>>(
    async () => false
  );
  // 🔧 FIX (2026-01-24): Flag to track if we're in the process of saving
  const [isSavingPolygon, setIsSavingPolygon] = useState(false);

  // Keep ref in sync with state
  useEffect(() => {
    draftPolygonRef.current = draftPolygon;
  }, [draftPolygon]);

  // 🎯 POLYGON EVENTS (2026-01-24): Notify toolbar about draft polygon changes
  useEffect(() => {
    eventBus.emit('overlay:draft-polygon-update', {
      pointCount: draftPolygon.length,
      canSave: draftPolygon.length >= 3
    });
  }, [draftPolygon.length, eventBus]);

  // 🏢 ENTERPRISE (2026-01-25): Clear draft polygon when switching to select tool
  // Αποτρέπει το bug όπου η διαδικασία σχεδίασης συνεχίζεται μετά την αλλαγή tool
  // 🔧 FIX (2026-02-13): Exclude overlayMode='draw' — in draw mode activeTool stays 'select'
  // but the draft polygon must NOT be cleared while the user is actively drawing
  useEffect(() => {
    if (activeTool === 'select' && overlayMode !== 'draw' && draftPolygon.length > 0) {
      setDraftPolygon([]);
    }
  }, [activeTool, draftPolygon.length, overlayMode]);

  // 🔧 FIX (2026-01-24): New function that accepts polygon as parameter to avoid stale closure
  const finishDrawingWithPolygon = async (polygon: Array<[number, number]>) => {
    // 🔧 FIX: Better error handling - notify user if level is not selected
    if (polygon.length < 3) {
      dwarn('usePolygonCompletion', '⚠️ Cannot save polygon - need at least 3 points');
      return false;
    }

    if (!levelManager.currentLevelId) {
      derr('usePolygonCompletion', '❌ Cannot save polygon - no level selected!');
      // 🏢 ENTERPRISE: Use EventBus → centralized notification system (NOT browser alert)
      eventBus.emit('overlay:save-error', { reason: 'no-level-selected' });
      return false;
    }

    try {
      // ADR-258: status δεν αποθηκεύεται πλέον — χρωματισμός βάσει entity.commercialStatus
      const overlayId = await overlayStore.add({
        levelId: levelManager.currentLevelId,
        kind: currentKind,
        polygon: polygon, // 🔧 FIX: Use passed polygon, not stale draftPolygon
        label: `Overlay ${Date.now()}`, // Temporary label
      });

      // 🏢 ADR-258B: Auto-select new overlay → opens Properties Panel for entity linking
      eventBus.emit('overlay:polygon-saved', { overlayId });

      return true;
    } catch (error) {
      derr('usePolygonCompletion', 'Failed to create overlay:', error);
      return false;
    }
    // Note: setDraftPolygon([]) is done in the calling setDraftPolygon callback
  };
  // 🏢 ENTERPRISE (2026-02-15): Keep ref in sync for action handlers declared earlier
  finishDrawingWithPolygonRef.current = finishDrawingWithPolygon;

  // Legacy function for Enter key support (uses current state, which is fine for keyboard)
  const finishDrawing = async () => {
    if (draftPolygon.length >= 3 && levelManager.currentLevelId) {
      await finishDrawingWithPolygon(draftPolygon);
    }
    setDraftPolygon([]);
  };

  // 🎯 POLYGON EVENTS (2026-01-24): Listen for save/cancel commands from toolbar
  useEffect(() => {
    // Handle save polygon command from toolbar "Αποθήκευση" button
    const cleanupSave = eventBus.on('overlay:save-polygon', () => {
      const polygon = draftPolygonRef.current;

      if (polygon.length >= 3) {
        setIsSavingPolygon(true);
        finishDrawingWithPolygon(polygon).then(success => {
          setIsSavingPolygon(false);
          if (success) {
            setDraftPolygon([]);
          }
        });
      }
    });

    // Handle cancel polygon command from toolbar or Escape key
    const cleanupCancel = eventBus.on('overlay:cancel-polygon', () => {
      setDraftPolygon([]);
    });

    return () => {
      cleanupSave();
      cleanupCancel();
    };
  }, [eventBus]);

  return {
    draftPolygon,
    setDraftPolygon,
    draftPolygonRef,
    isSavingPolygon,
    setIsSavingPolygon,
    finishDrawingWithPolygonRef,
    finishDrawing,
  };
}
