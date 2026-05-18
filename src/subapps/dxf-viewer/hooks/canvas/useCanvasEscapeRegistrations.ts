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
import type { SelectedGrip } from '../grips/useGripSystem';

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
  readonly selectedEntityIds: readonly string[];
  readonly hasAnySelection: boolean;
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
  readonly handleRotationEscape?: () => void;
  readonly rotationIsActive: boolean;
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
  useEscapeHandler(buildModifyHandler('rotation', p.handleRotationEscape, () => p.rotationIsActive));

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
      p.selectedEntityIds.length > 0 ||
      p.hasAnySelection,
    handle: () => {
      p.setDraftPolygon([]);
      p.onExitDrawMode?.();
      if (p.selectedGrips.length > 0) p.setSelectedGrips([]);
      if (p.selectedEntityIds.length > 0 || p.hasAnySelection) {
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
