/**
 * 🏢 ENTERPRISE: useCanvasKeyboardShortcuts Hook
 *
 * @description Window-level keyboard shortcuts for canvas operations:
 * - Delete/Backspace → context-aware smart delete
 * - Escape → cancel rotation / cancel grip interaction / clear draft polygon / clear grips / deselect entities
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
import { PolygonCropStore } from '../../systems/lasso/LassoCropStore';
import { LassoFreehandStore } from '../../systems/lasso/LassoFreehandStore';
import { CanvasNumericInputStore } from '../../systems/canvas-numeric-input/CanvasNumericInputStore';
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
  /** ADR-188: Rotation tool cancel handler */
  handleRotationEscape?: () => void;
  /** ADR-188: Whether the rotation tool is active */
  rotationIsActive?: boolean;
  /** ADR-049: Move tool cancel handler */
  handleMoveEscape?: () => void;
  /** ADR-049: Whether the move tool is active and collecting input */
  moveIsActive?: boolean;
  /** Mirror tool cancel handler */
  handleMirrorEscape?: () => void;
  /** Whether the mirror tool is active and collecting axis points */
  mirrorIsActive?: boolean;
  /** Mirror tool Y/N confirm handler (keepOriginals: true = keep, false = discard) */
  handleMirrorConfirm?: (keepOriginals: boolean) => void;
  /** True when mirror tool is in awaiting-keep-originals phase */
  mirrorAwaitingConfirm?: boolean;
  /** ADR-348: Scale tool cancel handler */
  handleScaleEscape?: () => void;
  /** ADR-348: Scale tool key handler — returns true if key was consumed */
  handleScaleKeyDown?: (key: string) => boolean;
  /** ADR-348: Whether the scale tool is active and collecting input */
  scaleIsActive?: boolean;
  /** ADR-349: Stretch / MStretch tool cancel handler */
  handleStretchEscape?: () => void;
  /** ADR-349: Stretch / MStretch tool key handler — returns true if key was consumed */
  handleStretchKeyDown?: (key: string) => boolean;
  /** ADR-349: Whether the stretch / mstretch tool is active and collecting input */
  stretchIsActive?: boolean;
  /** ADR-350: Trim tool cancel handler */
  handleTrimEscape?: () => void;
  /** ADR-350: Trim tool key handler — returns true if key was consumed */
  handleTrimKeyDown?: (key: string, shiftKey: boolean) => boolean;
  /** ADR-350: Whether the trim tool is active and in pick/edges phase */
  trimIsActive?: boolean;
  /** ADR-353: Extend tool cancel handler */
  handleExtendEscape?: () => void;
  /** ADR-353: Extend tool key handler — returns true if key was consumed */
  handleExtendKeyDown?: (key: string, shiftKey: boolean) => boolean;
  /** ADR-353: Whether the extend tool is active and in pick/edges phase */
  extendIsActive?: boolean;
  /** ADR-353 Phase B: Polar Array centre-pick cancel handler */
  handleArrayPolarEscape?: () => void;
  /** ADR-353 Phase B: Whether the polar Array tool is awaiting centre pick */
  arrayPolarIsActive?: boolean;
  /** SSoT deselect-all callback — clears local entity state + UniversalSelection */
  clearEntitySelection?: () => void;
  /** True when any non-DXF entity is selected (e.g. overlays) — widens the Escape guard */
  hasAnySelection?: boolean;
  /** PageUp/PageDown: bring selected entity to front / send to back */
  handleReorderEntity?: (direction: 'front' | 'back') => void;
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
  handleRotationEscape,
  rotationIsActive = false,
  handleMoveEscape,
  moveIsActive = false,
  handleMirrorEscape,
  mirrorIsActive = false,
  handleMirrorConfirm,
  mirrorAwaitingConfirm = false,
  handleScaleEscape,
  handleScaleKeyDown,
  scaleIsActive = false,
  handleStretchEscape,
  handleStretchKeyDown,
  stretchIsActive = false,
  handleTrimEscape,
  handleTrimKeyDown,
  trimIsActive = false,
  handleExtendEscape,
  handleExtendKeyDown,
  extendIsActive = false,
  handleArrayPolarEscape,
  arrayPolarIsActive = false,
  clearEntitySelection,
  hasAnySelection = false,
  handleReorderEntity,
}: UseCanvasKeyboardShortcutsParams): void {

  // Handle keyboard shortcuts for drawing, delete, and local operations
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // ADR-348: Scale tool — intercepts before global shortcuts when active
      if (scaleIsActive && handleScaleKeyDown) {
        const consumed = handleScaleKeyDown(e.key);
        if (consumed) { e.preventDefault(); return; }
      }

      // ADR-349: Stretch / MStretch tool — intercepts before global shortcuts when active
      if (stretchIsActive && handleStretchKeyDown) {
        const consumed = handleStretchKeyDown(e.key);
        if (consumed) { e.preventDefault(); return; }
      }

      // ADR-350: Trim tool — intercepts before global shortcuts when active
      if (trimIsActive && handleTrimKeyDown) {
        const consumed = handleTrimKeyDown(e.key, e.shiftKey);
        if (consumed) { e.preventDefault(); return; }
      }

      // ADR-353: Extend tool — intercepts before global shortcuts when active
      if (extendIsActive && handleExtendKeyDown) {
        const consumed = handleExtendKeyDown(e.key, e.shiftKey);
        if (consumed) { e.preventDefault(); return; }
      }

      // Canvas numeric input — intercepts before generic Delete/Backspace/Escape (ADR-189)
      if (CanvasNumericInputStore.isActive()) {
        if (e.key === 'Backspace') { e.preventDefault(); CanvasNumericInputStore.backspace(); return; }
        if (e.key === 'Enter') { e.preventDefault(); CanvasNumericInputStore.confirm(); return; }
        if (e.key === 'Escape') { e.preventDefault(); CanvasNumericInputStore.cancel(); return; }
        if (e.key === ',' || e.key === '.') { e.preventDefault(); CanvasNumericInputStore.addChar(e.key); return; }
        if (/^[\d-]$/.test(e.key)) { e.preventDefault(); CanvasNumericInputStore.addChar(e.key); return; }
        return; // block all other keys during numeric input
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

      // Z-order: PageUp = bring to front, PageDown = send to back
      if ((e.key === 'PageUp' || e.key === 'PageDown') && selectedEntityIds.length === 1 && handleReorderEntity) {
        e.preventDefault();
        handleReorderEntity(e.key === 'PageUp' ? 'front' : 'back');
        return;
      }

      switch (e.key) {
        case 'Escape':
          // Polygon crop: Escape cancels the in-progress polygon
          if (activeTool === 'polygon-crop') {
            PolygonCropStore.cancel();
            break;
          }
          // Freehand lasso-crop: Escape cancels the freehand trace
          if (activeTool === 'lasso-crop') {
            LassoFreehandStore.cancel();
            break;
          }
          // ADR-049: Move tool cancel (highest priority — intercepts before rotation)
          if (moveIsActive && handleMoveEscape) {
            handleMoveEscape();
            break;
          }
          // Mirror tool cancel
          if (mirrorIsActive && handleMirrorEscape) {
            handleMirrorEscape();
            break;
          }
          // ADR-348: Scale tool cancel
          if (scaleIsActive && handleScaleEscape) {
            handleScaleEscape();
            break;
          }
          // ADR-349: Stretch / MStretch tool cancel
          if (stretchIsActive && handleStretchEscape) {
            handleStretchEscape();
            break;
          }
          // ADR-350: Trim tool cancel
          if (trimIsActive && handleTrimEscape) {
            handleTrimEscape();
            break;
          }
          // ADR-353: Extend tool cancel
          if (extendIsActive && handleExtendEscape) {
            handleExtendEscape();
            break;
          }
          // ADR-353 Phase B: Polar Array centre-pick cancel
          if (arrayPolarIsActive && handleArrayPolarEscape) {
            handleArrayPolarEscape();
            break;
          }
          // ADR-188: Escape cancels rotation tool
          if (rotationIsActive && handleRotationEscape) {
            handleRotationEscape();
            break;
          }
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
          // SSoT deselect-all: Escape clears entity selection (AutoCAD/BricsCAD pattern)
          // hasAnySelection covers non-DXF selections (e.g. overlays)
          if (selectedEntityIds.length > 0 || hasAnySelection) {
            clearEntitySelection?.();
          }
          break;
        case 'Enter': {
          // Polygon crop: Enter closes the polygon and triggers the clip
          if (activeTool === 'polygon-crop') {
            e.preventDefault();
            PolygonCropStore.close();
            break;
          }
          // 🏢 ENTERPRISE (2026-01-31): Handle Enter for continuous drawing tools - ADR-083
          const continuousTools = ['polyline', 'polygon', 'measure-area', 'measure-angle', 'measure-distance-continuous', 'circle-best-fit'];
          if (continuousTools.includes(activeTool)) {
            e.preventDefault();
            handleDrawingFinish();
          } else if (draftPolygon.length >= 3) {
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
        // Mirror keep-originals confirm: Y = keep, N = discard
        case 'y':
        case 'Y':
          if (mirrorAwaitingConfirm && handleMirrorConfirm) {
            e.preventDefault();
            handleMirrorConfirm(true);
          }
          break;
        case 'n':
        case 'N':
          if (mirrorAwaitingConfirm && handleMirrorConfirm) {
            e.preventDefault();
            handleMirrorConfirm(false);
          }
          break;
      }
    };

    // 🏢 ENTERPRISE: Use capture: true to handle Delete before other handlers
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [draftPolygon, finishDrawing, handleSmartDelete, selectedGrips, activeTool, handleFlipArc, handleDrawingFinish, canEntityJoin, handleEntityJoin, selectedEntityIds, onExitDrawMode, handleRotationEscape, rotationIsActive, handleMoveEscape, moveIsActive, handleMirrorEscape, mirrorIsActive, handleMirrorConfirm, mirrorAwaitingConfirm, handleScaleEscape, handleScaleKeyDown, scaleIsActive, handleStretchEscape, handleStretchKeyDown, stretchIsActive, handleTrimEscape, handleTrimKeyDown, trimIsActive, handleExtendEscape, handleExtendKeyDown, extendIsActive, clearEntitySelection, hasAnySelection, dxfGripInteraction, setDraftPolygon, setSelectedGrips, handleReorderEntity]);

  // ADR-350 B2: SHIFT keyup → immediately reset inverseMode when trim is active
  useEffect(() => {
    if (!trimIsActive || !handleTrimKeyDown) return;
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') handleTrimKeyDown('Shift', false);
    };
    window.addEventListener('keyup', onKeyUp, { capture: true });
    return () => window.removeEventListener('keyup', onKeyUp, { capture: true });
  }, [trimIsActive, handleTrimKeyDown]);

  // ADR-353: SHIFT keyup → immediately reset inverseMode when extend is active
  useEffect(() => {
    if (!extendIsActive || !handleExtendKeyDown) return;
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') handleExtendKeyDown('Shift', false);
    };
    window.addEventListener('keyup', onKeyUp, { capture: true });
    return () => window.removeEventListener('keyup', onKeyUp, { capture: true });
  }, [extendIsActive, handleExtendKeyDown]);
}
