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
import { useEffect, useRef } from 'react';
import { CanvasNumericInputStore } from '../../systems/canvas-numeric-input/CanvasNumericInputStore';
import { PolygonCropStore } from '../../systems/lasso/LassoCropStore';
// ADR-357 Phase 3: DDE — cursor world position + unit conversion
import { getImmediateWorldPosition } from '../../systems/cursor/ImmediatePositionStore';
// ADR-532 B4 — event-time selection read (CanvasSection no longer re-renders on selection).
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
import { fromDisplay } from '../../config/units';
import type { DisplayUnit } from '../../config/units';
// ADR-357/397 — DDE buffer SSoT (ADR-344 DirectDistanceEntry) + per-keystroke input SSoT.
// Απόσταση → allowNegative:false (κατεύθυνση από τον κέρσορα, AutoCAD DDE parity).
import { DirectDistanceEntry } from '../../text-engine/interaction/DirectDistanceEntry';
import { applyTypedNumericKey } from '../../systems/dynamic-input/typed-angle-entry';
// ADR-364 — Escape Command Bus SSoT (priority chain extracted to registrations module)
import { useCanvasEscapeRegistrations } from './useCanvasEscapeRegistrations';
// ============================================================================
// TYPES — extracted to ./useCanvasKeyboardShortcuts.types for file-size compliance
// ============================================================================
import type { UseCanvasKeyboardShortcutsParams } from './useCanvasKeyboardShortcuts.types';
export type {
  UseCanvasKeyboardShortcutsParams,
  DxfGripInteractionLike,
} from './useCanvasKeyboardShortcuts.types';

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
  handleEntityJoin,
  canEntityJoin,
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
  handleOffsetEscape,
  handleOffsetKeyDown,
  offsetIsActive = false,
  handleFilletEscape,
  handleFilletKeyDown,
  filletIsActive = false,
  handleChamferEscape,
  handleChamferKeyDown,
  chamferIsActive = false,
  handleExtendEscape,
  handleExtendKeyDown,
  extendIsActive = false,
  handleArrayPolarEscape,
  arrayPolarIsActive = false,
  handleArrayPathEscape,
  arrayPathIsActive = false,
  handleHotGripKeyDown,
  hotGripKeyIsActive = false,
  handleRotationKeyDown,
  rotateToolAwaitingAngle = false,
  handleWallSplitEscape,
  wallSplitIsActive = false,
  handleWallAttachEscape,
  wallAttachIsActive = false,
  handleStairAddTurnEscape,
  stairAddTurnIsActive = false,
  handleCopyEscape,
  copyIsActive = false,
  clearEntitySelection,
  hasAnySelection = false,
  hasActiveCircuit,
  handleReorderEntity,
  drawingTempPoints,
  onDirectDistanceEntry,
  onUndoChainVertex,
  onChainFinish,
  onSnapOverrideMenuRequest,
  drawingTempPointCount = 0,
}: UseCanvasKeyboardShortcutsParams): void {
  // ADR-357 Phase 3 / ADR-397: DDE buffer via `DirectDistanceEntry` SSoT (persists across renders,
  // no re-render needed). Αντικατέστησε το hand-rolled string ref → κοινό buffer με rotation typed-input.
  const ddeRef = useRef<DirectDistanceEntry>(new DirectDistanceEntry());
  // Clear DDE buffer when tool changes (e.g. ESC → select, next tool activation)
  useEffect(() => {
    ddeRef.current.reset();
  }, [activeTool]);
  // Handle keyboard shortcuts for drawing, delete, and local operations
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      // ADR-397/513 (Giorgio 2026-07-06) — hot-grip ΠΕΡΙΣΤΡΟΦΗ: τα ψηφία/Enter/Backspace/«R» οδηγούν τη
      // ΓΩΝΙΑ ΠΡΙΝ τον input-guard, ώστε η πληκτρολόγηση να δουλεύει ΑΚΟΜΗ κι αν ένα stray <input> έκλεψε
      // το focus (π.χ. ribbon combobox re-focus στο preview re-render) → πολυψήφιες γωνίες (45, 90…) OK.
      // Capture-phase + stopImmediatePropagation → το focused input ΔΕΝ βλέπει τα πλήκτρα. (Πριν: ήταν ΜΕΤΑ
      // τον input-guard → το 2ο ψηφίο «τρωγόταν» από το input — bug «δέχεται μόνο το 1ο ψηφίο», Giorgio.)
      if (hotGripKeyIsActive && handleHotGripKeyDown) {
        const consumed = handleHotGripKeyDown(e.key);
        if (consumed) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      }
      // ADR-397/513 (Giorgio 2026-07-06) — 2-click ROTATE tool inline typed-angle (awaiting-angle):
      // ΙΔΙΟ μοτίβο με το hot-grip (ΠΑΝΩ από τον input-guard, capture + stopImmediatePropagation) →
      // big-player parity (Revit/C4D/Figma), πολυψήφια γωνία + κόμμα + Enter, χωρίς modal dialog.
      if (rotateToolAwaitingAngle && handleRotationKeyDown) {
        const consumed = handleRotationKeyDown(e.key);
        if (consumed) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      }
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

      // ADR-510 Φ4d: Offset tool — intercepts digits/backspace/E/U before global shortcuts
      if (offsetIsActive && handleOffsetKeyDown) {
        const consumed = handleOffsetKeyDown(e.key);
        if (consumed) { e.preventDefault(); return; }
      }

      // ADR-510 Φ4e: Fillet tool — intercepts digits/backspace/R/T/P/U before global shortcuts
      if (filletIsActive && handleFilletKeyDown) {
        const consumed = handleFilletKeyDown(e.key);
        if (consumed) { e.preventDefault(); return; }
      }

      // ADR-510 Φ4f: Chamfer tool — intercepts digits/backspace/D/A/T/P/U before global shortcuts
      if (chamferIsActive && handleChamferKeyDown) {
        const consumed = handleChamferKeyDown(e.key);
        if (consumed) { e.preventDefault(); return; }
      }

      // ADR-353: Extend tool — intercepts before global shortcuts when active
      if (extendIsActive && handleExtendKeyDown) {
        const consumed = handleExtendKeyDown(e.key, e.shiftKey);
        if (consumed) { e.preventDefault(); return; }
      }

      // ADR-397 Σ2 hot-grip rotate-free key handling MOVED above the input-focus guard
      // (top of handleKeyDown) so multi-digit typed angles survive a stray input focus-steal.

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

      if (isDde && e.key !== 'Enter') {
        // ADR-357/397 — ψηφία / `.` / `,` / Backspace μέσω του SSoT `applyTypedNumericKey`
        // (κόμμα-parity δωρεάν· allowNegative:false → η απόσταση μένει θετική, η κατεύθυνση έρχεται
        // από τον κέρσορα, AutoCAD DDE). Enter το χειρίζεται το switch παρακάτω (κενό buffer →
        // chain-finish, ΟΧΙ commit εδώ).
        const res = applyTypedNumericKey(ddeRef.current, e.key, { allowNegative: false });
        if (res.consumed) { e.preventDefault(); return; }
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
      // ADR-661 — N≥1 (multi-select reorders the whole set atomically via BatchReorderEntityCommand).
      if ((e.key === 'PageUp' || e.key === 'PageDown') && SelectedEntitiesStore.getSelectedEntityIds().length >= 1 && handleReorderEntity) {
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
          const ddeSnap = ddeRef.current.snapshot();
          if (isDde && ddeSnap.buffer.length > 0 && onDirectDistanceEntry && drawingTempPoints?.length) {
            ddeRef.current.reset();
            const rawDistance = ddeSnap.value;
            if (rawDistance != null && rawDistance > 0) {
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
          if (isInChain && ddeSnap.buffer.length === 0 && onChainFinish) {
            e.preventDefault();
            onChainFinish();
            break;
          }

          // 🏢 ENTERPRISE (2026-01-31): Handle Enter for continuous drawing tools - ADR-083
          const continuousTools = ['polyline', 'polygon', 'hatch', 'measure-area', 'measure-angle', 'measure-distance-continuous', 'circle-best-fit'];
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
          if (activeTool === 'select' && canEntityJoin?.() && handleEntityJoin) {
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
  }, [draftPolygon, finishDrawing, handleSmartDelete, activeTool, handleFlipArc, handleDrawingFinish, canEntityJoin, handleEntityJoin, handleMirrorConfirm, mirrorAwaitingConfirm, handleScaleKeyDown, scaleIsActive, handleStretchKeyDown, stretchIsActive, handleTrimKeyDown, trimIsActive, handleOffsetKeyDown, offsetIsActive, handleFilletKeyDown, filletIsActive, handleChamferKeyDown, chamferIsActive, handleExtendKeyDown, extendIsActive, handleHotGripKeyDown, hotGripKeyIsActive, handleRotationKeyDown, rotateToolAwaitingAngle, handleReorderEntity, drawingTempPoints, onDirectDistanceEntry, onUndoChainVertex, onChainFinish]);

  // ADR-364 — auto-clear DDE buffer when the active drawing flow resets
  // (tempPoints empties on cancel / commit). Replaces the legacy ESC fall-through.
  useEffect(() => {
    if ((drawingTempPoints?.length ?? 0) === 0) {
      ddeRef.current.reset();
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
    hasAnySelection,
    hasActiveCircuit,
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
    handleOffsetEscape,
    offsetIsActive,
    handleFilletEscape,
    filletIsActive,
    handleChamferEscape,
    chamferIsActive,
    handleExtendEscape,
    extendIsActive,
    handleArrayPolarEscape,
    arrayPolarIsActive,
    handleArrayPathEscape,
    arrayPathIsActive,
    handleWallSplitEscape,
    wallSplitIsActive,
    handleWallAttachEscape,
    wallAttachIsActive,
    handleStairAddTurnEscape,
    stairAddTurnIsActive,
    handleCopyEscape,
    copyIsActive,
    handleRotationEscape,
    rotationIsActive,
    // ADR-397 — active hot-grip op owns ESC at HOT_GRIP_OP priority.
    hotGripActive: hotGripKeyIsActive,
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
