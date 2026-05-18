/**
 * 🏢 ENTERPRISE: useCanvasKeyboardShortcuts Hook
 *
 * @description Window-level keyboard shortcuts for canvas operations:
 * - Delete/Backspace → context-aware smart delete
 * - Escape → cancel rotation / cancel grip interaction / clear draft polygon / clear grips / deselect entities
 * - Enter → finish continuous drawing tool or overlay polygon
 * - X → flip arc direction during arc drawing
 * - ADR-357 Phase 3: Direct Distance Entry (digit + Enter while drawing line)
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~61 lines of keyboard handler useEffect
 *
 * @see ADR-032: Command History / Undo-Redo
 * @see ADR-083: Continuous drawing tools
 * @see ADR-357: DXF Line Tool Google-Level (Phase 3 — Direct Distance Entry)
 */
'use client';
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { CanvasNumericInputStore } from '../../systems/canvas-numeric-input/CanvasNumericInputStore';
import { PolygonCropStore } from '../../systems/lasso/LassoCropStore';
import type { SelectedGrip } from '../grips/useGripSystem';
import type { Point2D } from '../../rendering/types/Types';
// ADR-357 Phase 3: DDE — cursor world position + unit conversion
import { getImmediateWorldPosition } from '../../systems/cursor/ImmediatePositionStore';
import { fromDisplay } from '../../config/units';
import type { DisplayUnit } from '../../config/units';
// ADR-364 — Escape Command Bus SSoT (priority chain extracted to registrations module)
import { useCanvasEscapeRegistrations } from './useCanvasEscapeRegistrations';
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
  /** ADR-353 Phase C: Path Array path-entity-pick cancel handler */
  handleArrayPathEscape?: () => void;
  /** ADR-353 Phase C: Whether the path Array tool is awaiting path-entity pick */
  arrayPathIsActive?: boolean;
  /** SSoT deselect-all callback — clears local entity state + UniversalSelection */
  clearEntitySelection?: () => void;
  /** True when any non-DXF entity is selected (e.g. overlays) — widens the Escape guard */
  hasAnySelection?: boolean;
  /** PageUp/PageDown: bring selected entity to front / send to back */
  handleReorderEntity?: (direction: 'front' | 'back') => void;
  /**
   * ADR-357 Phase 3: Direct Distance Entry.
   * Temp points of the active drawing (line). Length >= 1 = COLLECTING_POINTS.
   * DDE activates when tool='line', tempPoints.length >= 1, no input focused.
   */
  drawingTempPoints?: Point2D[];
  /** ADR-357 Phase 3: DDE callback — called with the computed world point. */
  onDirectDistanceEntry?: (pt: { x: number; y: number }) => void;
  /** ADR-357 Phase 5: Undo last chain vertex (U / Ctrl+Z during line chain mode). */
  onUndoChainVertex?: () => void;
  /** ADR-357 Phase 5: Finish chain (Enter during chain, no DDE pending) — exits chain, tool deselects. */
  onChainFinish?: () => void;
  /** ADR-357 Phase 7: Shift+Right-click snap override — open snap override menu at (x, y). */
  onSnapOverrideMenuRequest?: (x: number, y: number) => void;
  /** ADR-357 Phase 7: Number of drawing temp points — needed to gate Shift+Right-click. */
  drawingTempPointCount?: number;
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
  handleArrayPathEscape,
  arrayPathIsActive = false,
  clearEntitySelection,
  hasAnySelection = false,
  handleReorderEntity,
  drawingTempPoints,
  onDirectDistanceEntry,
  onUndoChainVertex,
  onChainFinish,
  onSnapOverrideMenuRequest,
  drawingTempPointCount = 0,
}: UseCanvasKeyboardShortcutsParams): void {
  // ADR-357 Phase 3: DDE digit accumulation buffer (persists across renders, no re-render needed)
  const ddeBufferRef = useRef('');
  // Clear DDE buffer when tool changes (e.g. ESC → select, next tool activation)
  useEffect(() => {
    ddeBufferRef.current = '';
  }, [activeTool]);
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

      // ADR-357 Phase 5: Ctrl+Z intercept during line chain mode → undo chain vertex.
      // Must run before CommandHistory's global Ctrl+Z listener (capture order).
      const isInChain = activeTool === 'line' && (drawingTempPoints?.length ?? 0) >= 1;
      if (isInChain && e.ctrlKey && (e.key === 'z' || e.key === 'Z') && onUndoChainVertex) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onUndoChainVertex();
        return;
      }

      // ADR-357 Phase 3: Direct Distance Entry — capture digit/decimal keys during line drawing.
      // Guard: tool='line', COLLECTING_POINTS (>= 1 temp point), no input focused, no CanvasNumericInput.
      const isDde = activeTool === 'line'
        && (drawingTempPoints?.length ?? 0) >= 1
        && !CanvasNumericInputStore.isActive();

      if (isDde) {
        if (/^[\d.]$/.test(e.key)) {
          // Avoid double-decimal: only allow one dot in the buffer
          if (e.key === '.' && ddeBufferRef.current.includes('.')) return;
          e.preventDefault();
          ddeBufferRef.current += e.key;
          return;
        }
        if (e.key === 'Backspace' && ddeBufferRef.current.length > 0) {
          e.preventDefault();
          ddeBufferRef.current = ddeBufferRef.current.slice(0, -1);
          return;
        }
        // ADR-364: Escape no longer fall-throughs here — DDE buffer is cleared
        // by the auto-reset effect below when tempPoints empties (after the
        // DRAW_TOOL bus handler in useKeyboardShortcuts cancels the drawing).
      }

      // Canvas numeric input — intercepts before generic Delete/Backspace (ADR-189).
      // ADR-364: Escape moved to the EscapeCommandBus (CANVAS_NUMERIC slot).
      if (CanvasNumericInputStore.isActive()) {
        if (e.key === 'Backspace') { e.preventDefault(); CanvasNumericInputStore.backspace(); return; }
        if (e.key === 'Enter') { e.preventDefault(); CanvasNumericInputStore.confirm(); return; }
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
        // ADR-364: Escape dispatch moved entirely to EscapeCommandBus.
        // See useCanvasEscapeRegistrations() below for the full priority chain
        // (CANVAS_NUMERIC → CROP_TOOL → MODIFY_TOOL × 9 → GRIP_DRAG → composite fallback).
        case 'Enter': {
          // Polygon crop: Enter closes the polygon and triggers the clip
          if (activeTool === 'polygon-crop') {
            e.preventDefault();
            PolygonCropStore.close();
            break;
          }

          // ADR-357 Phase 3: Direct Distance Entry — fires when DDE buffer is non-empty.
          // User typed a number (in display units) while cursor points direction. Enter applies it.
          // Pipeline: display-unit distance → mm → lastRef + dir*dist → onDirectDistanceEntry
          const ddeStr = ddeBufferRef.current.trim();
          if (isDde && ddeStr.length > 0 && onDirectDistanceEntry && drawingTempPoints?.length) {
            ddeBufferRef.current = '';
            const rawDistance = parseFloat(ddeStr);
            if (!isNaN(rawDistance) && rawDistance > 0) {
              const lastRef = drawingTempPoints[drawingTempPoints.length - 1];
              const cursor = getImmediateWorldPosition();
              if (cursor && lastRef) {
                const dx = cursor.x - lastRef.x;
                const dy = cursor.y - lastRef.y;
                const cursorDist = Math.sqrt(dx * dx + dy * dy);
                if (cursorDist > 0) {
                  const unit = (localStorage.getItem('dxf:displayUnit') ?? 'cm') as DisplayUnit;
                  const distMm = fromDisplay(rawDistance, unit);
                  e.preventDefault();
                  onDirectDistanceEntry({ x: lastRef.x + (dx / cursorDist) * distMm, y: lastRef.y + (dy / cursorDist) * distMm });
                  break;
                }
              }
            }
          }

          // ADR-357 Phase 5: Enter during line chain mode (no DDE pending) → finish chain.
          if (isInChain && ddeStr.length === 0 && onChainFinish) {
            e.preventDefault();
            onChainFinish();
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
        // ADR-357 Phase 5: U key → undo last chain vertex during line chain mode
        case 'u':
        case 'U':
          if (isInChain && onUndoChainVertex) {
            e.preventDefault();
            onUndoChainVertex();
          }
          break;
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
  }, [draftPolygon, finishDrawing, handleSmartDelete, activeTool, handleFlipArc, handleDrawingFinish, canEntityJoin, handleEntityJoin, selectedEntityIds, handleMirrorConfirm, mirrorAwaitingConfirm, handleScaleKeyDown, scaleIsActive, handleStretchKeyDown, stretchIsActive, handleTrimKeyDown, trimIsActive, handleExtendKeyDown, extendIsActive, handleReorderEntity, drawingTempPoints, onDirectDistanceEntry, onUndoChainVertex, onChainFinish]);

  // ADR-364 — auto-clear DDE buffer when the active drawing flow resets
  // (tempPoints empties on cancel / commit). Replaces the legacy ESC fall-through.
  useEffect(() => {
    if ((drawingTempPoints?.length ?? 0) === 0) {
      ddeBufferRef.current = '';
    }
  }, [drawingTempPoints]);

  // ADR-364 — Register every canvas-level ESC consumer in the EscapeCommandBus.
  useCanvasEscapeRegistrations({
    activeTool,
    dxfGripInteraction,
    draftPolygon,
    setDraftPolygon,
    selectedGrips,
    setSelectedGrips,
    selectedEntityIds,
    hasAnySelection,
    onExitDrawMode,
    clearEntitySelection,
    handleMoveEscape,
    moveIsActive,
    handleMirrorEscape,
    mirrorIsActive,
    handleScaleEscape,
    scaleIsActive,
    handleStretchEscape,
    stretchIsActive,
    handleTrimEscape,
    trimIsActive,
    handleExtendEscape,
    extendIsActive,
    handleArrayPolarEscape,
    arrayPolarIsActive,
    handleArrayPathEscape,
    arrayPathIsActive,
    handleRotationEscape,
    rotationIsActive,
  });

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

  // ADR-357 Phase 7: Shift+Right-click → open snap override menu (AutoCAD/BricsCAD UX).
  // Gate: only during line COLLECTING_POINTS (drawingTempPointCount >= 1).
  useEffect(() => {
    if (!onSnapOverrideMenuRequest) return;
    const handleContextMenu = (e: MouseEvent) => {
      if (!e.shiftKey) return;
      if (activeTool !== 'line' || drawingTempPointCount < 1) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onSnapOverrideMenuRequest(e.clientX, e.clientY);
    };
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    return () => window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
  }, [activeTool, drawingTempPointCount, onSnapOverrideMenuRequest]);
}
