'use client';

/**
 * ADR-364 — Canvas Escape Registrations
 *
 * Single SSoT module that wires every canvas-level ESC consumer into the
 * centralized EscapeCommandBus with the correct priority. Extracted from
 * `useCanvasKeyboardShortcuts.ts` so each module stays under the 500-line
 * cap (Google SRP, CLAUDE.md N.7.1).
 *
 * Priority layout (high → low):
 *   CANVAS_NUMERIC      — Canvas numeric input (ADR-189)
 *   CROP_TOOL           — polygon-crop, lasso-crop
 *   MODIFY_TOOL         — move, mirror, scale, stretch, trim, extend,
 *                         array-polar, array-path, rotation (registered in the
 *                         legacy first-match order; ties resolve by insertion)
 *   GRIP_DRAG           — useDxfGripInteraction.handleGripEscape
 *   DRAFT_POLYGON       — composite fallback: clear draft polygon + exit overlay
 *                         draw mode + clear grip selection + deselect entities
 *
 * `useKeyboardShortcuts` owns DRAW_TOOL (cancel generic drawing) and
 * COLOR_MENU (lowest-priority fallback). `useDimToolRouting` owns DIM_TOOL.
 */

import type { Dispatch, SetStateAction } from 'react';
import { CanvasNumericInputStore } from '../../systems/canvas-numeric-input/CanvasNumericInputStore';
import { PolygonCropStore } from '../../systems/lasso/LassoCropStore';
import { LassoFreehandStore } from '../../systems/lasso/LassoFreehandStore';
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';
// ADR-532 B4 — event-time selection read (CanvasSection no longer re-renders on selection).
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
import type { SelectedGrip } from '../grips/unified-grip-types';

interface DxfGripInteractionLike {
  readonly handleGripEscape: () => boolean;
}

export interface UseCanvasEscapeRegistrationsParams {
  readonly activeTool: string;
  readonly dxfGripInteraction: DxfGripInteractionLike;
  readonly draftPolygon: ReadonlyArray<readonly [number, number]>;
  readonly setDraftPolygon: Dispatch<SetStateAction<Array<[number, number]>>>;
  readonly selectedGrips: readonly SelectedGrip[];
  readonly setSelectedGrips: (grips: SelectedGrip[]) => void;
  readonly hasAnySelection: boolean;
  /**
   * Event-time getter — true when a MEP circuit is selected via wire-click
   * (`activeSystemId`, no scene entity). Read as a getter (not a snapshot prop)
   * so the orchestrator never subscribes to the circuit store (ADR-040).
   */
  readonly hasActiveCircuit?: () => boolean;
  readonly onExitDrawMode?: () => void;
  readonly clearEntitySelection?: () => void;
  readonly handleMoveEscape?: () => void;
  readonly moveIsActive: boolean;
  readonly handleMirrorEscape?: () => void;
  readonly mirrorIsActive: boolean;
  readonly handleScaleEscape?: () => void;
  readonly scaleIsActive: boolean;
  readonly handleStretchEscape?: () => void;
  readonly stretchIsActive: boolean;
  readonly handleTrimEscape?: () => void;
  readonly trimIsActive: boolean;
  readonly handleExtendEscape?: () => void;
  readonly extendIsActive: boolean;
  readonly handleArrayPolarEscape?: () => void;
  readonly arrayPolarIsActive: boolean;
  readonly handleArrayPathEscape?: () => void;
  readonly arrayPathIsActive: boolean;
  /** ADR-363 Phase 5.6: Wall Split ESC handler */
  readonly handleWallSplitEscape?: () => void;
  readonly wallSplitIsActive: boolean;
  /** ADR-401 Phase E.1: Wall Attach Top/Base ESC handler */
  readonly handleWallAttachEscape?: () => void;
  readonly wallAttachIsActive: boolean;
  /** ADR-363 R1: BIM Copy ESC handler */
  readonly handleBimCopyEscape?: () => void;
  readonly bimCopyIsActive: boolean;
  readonly handleRotationEscape?: () => void;
  readonly rotationIsActive: boolean;
  /**
   * ADR-397 — true while a hot-grip click-flow (move / corner / rotate, incl. the
   * rotate reference sub-steps) is active. Gives that grip op ESC priority over any
   * tool / numeric handler, so the multi-click rotate is always cancellable.
   */
  readonly hotGripActive?: boolean;
}

export function useCanvasEscapeRegistrations(p: UseCanvasEscapeRegistrationsParams): void {
  // P950 — Canvas Numeric Input
  useEscapeHandler({
    id: 'canvas/numeric-input-cancel',
    priority: ESC_PRIORITY.CANVAS_NUMERIC,
    canHandle: () => CanvasNumericInputStore.isActive(),
    handle: () => { CanvasNumericInputStore.cancel(); return true; },
  });

  // P650 — Crop tools (polygon-crop, lasso-crop)
  useEscapeHandler({
    id: 'canvas/polygon-crop-cancel',
    priority: ESC_PRIORITY.CROP_TOOL,
    canHandle: () => p.activeTool === 'polygon-crop',
    handle: () => { PolygonCropStore.cancel(); return true; },
  });
  useEscapeHandler({
    id: 'canvas/lasso-crop-cancel',
    priority: ESC_PRIORITY.CROP_TOOL,
    canHandle: () => p.activeTool === 'lasso-crop',
    handle: () => { LassoFreehandStore.cancel(); return true; },
  });

  // P600 — Modify tools (registered in legacy first-match order)
  useEscapeHandler(buildModifyHandler('move', p.handleMoveEscape, () => p.moveIsActive));
  useEscapeHandler(buildModifyHandler('mirror', p.handleMirrorEscape, () => p.mirrorIsActive));
  useEscapeHandler(buildModifyHandler('scale', p.handleScaleEscape, () => p.scaleIsActive));
  useEscapeHandler(buildModifyHandler('stretch', p.handleStretchEscape, () => p.stretchIsActive));
  useEscapeHandler(buildModifyHandler('trim', p.handleTrimEscape, () => p.trimIsActive));
  useEscapeHandler(buildModifyHandler('extend', p.handleExtendEscape, () => p.extendIsActive));
  useEscapeHandler(buildModifyHandler('array-polar', p.handleArrayPolarEscape, () => p.arrayPolarIsActive));
  useEscapeHandler(buildModifyHandler('array-path', p.handleArrayPathEscape, () => p.arrayPathIsActive));
  useEscapeHandler(buildModifyHandler('wall-split', p.handleWallSplitEscape, () => p.wallSplitIsActive));
  useEscapeHandler(buildModifyHandler('wall-attach', p.handleWallAttachEscape, () => p.wallAttachIsActive));
  useEscapeHandler(buildModifyHandler('wall-merge', p.handleWallMergeEscape, () => p.wallMergeIsActive));
  useEscapeHandler(buildModifyHandler('bim-copy', p.handleBimCopyEscape, () => p.bimCopyIsActive));
  useEscapeHandler(buildModifyHandler('rotation', p.handleRotationEscape, () => p.rotationIsActive));

  // P975 — Active hot-grip op (ADR-397). Above every tool/numeric handler so the
  // multi-click move/rotate (incl. the «R» reference sub-steps, where `activeTool`
  // stays 'select') is always cancellable — a tool/numeric handler must never win
  // the ESC mid-flow. Same `handleGripEscape` reset as the low-priority GRIP_DRAG.
  //
  // `allowWhenEditable: true` — with a BIM entity selected the ribbon shows editable
  // numeric comboboxes (RibbonEditableCombobox), and clicking the canvas does NOT
  // blur them (the canvas is not focusable), so `document.activeElement` stays an
  // INPUT for the whole grip flow. Without this opt-in the editable-focus guard
  // skips the handler and ESC never cancels the rotate (Giorgio repro 2026-06-17:
  // open+close a dialog → focus resets → ESC works again). Same pattern as the dim
  // tool / dynamic input. The grip op is the active modal context → it owns ESC.
  useEscapeHandler({
    id: 'canvas/hot-grip-op-cancel',
    priority: ESC_PRIORITY.HOT_GRIP_OP,
    allowWhenEditable: true,
    canHandle: () => p.hotGripActive === true,
    handle: () => p.dxfGripInteraction.handleGripEscape(),
  });

  // P450 — Grip drag (handleGripEscape returns its own consumed boolean)
  useEscapeHandler({
    id: 'canvas/grip-drag',
    priority: ESC_PRIORITY.GRIP_DRAG,
    canHandle: () => true,
    handle: () => p.dxfGripInteraction.handleGripEscape(),
  });

  // P400 — Composite fallback (draft polygon + overlay draw mode + grip
  // selection + entity selection). Mirrors the legacy switch behaviour
  // where all four cleanup actions ran in sequence on a single ESC press.
  useEscapeHandler({
    id: 'canvas/fallback-deselect',
    priority: ESC_PRIORITY.DRAFT_POLYGON,
    canHandle: () =>
      p.draftPolygon.length > 0 ||
      p.selectedGrips.length > 0 ||
      SelectedEntitiesStore.getSelectedEntityIds().length > 0 ||
      p.hasAnySelection ||
      (p.hasActiveCircuit?.() ?? false),
    handle: () => {
      p.setDraftPolygon([]);
      p.onExitDrawMode?.();
      if (p.selectedGrips.length > 0) p.setSelectedGrips([]);
      if (SelectedEntitiesStore.getSelectedEntityIds().length > 0 || p.hasAnySelection || (p.hasActiveCircuit?.() ?? false)) {
        p.clearEntitySelection?.();
      }
      return true;
    },
  });

  // P350 — Overlay draw mode fallback (when nothing else applied but the
  // overlay system is still in draw mode — keeps the legacy onExitDrawMode
  // behaviour even with empty draft / selection).
  useEscapeHandler({
    id: 'canvas/overlay-draw-mode',
    priority: ESC_PRIORITY.OVERLAY_DRAW_MODE,
    canHandle: () => p.onExitDrawMode !== undefined,
    handle: () => { p.onExitDrawMode?.(); return false; },
  });
}

function buildModifyHandler(
  toolId: string,
  callback: (() => void) | undefined,
  isActive: () => boolean,
) {
  if (!callback) return null;
  return {
    id: `modify-tool/${toolId}`,
    priority: ESC_PRIORITY.MODIFY_TOOL,
    canHandle: isActive,
    handle: () => { callback(); return true; },
  };
}
