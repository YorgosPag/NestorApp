'use client';

/**
 * ADR-563 Φ4-Α — interactive cut-line dimension tool (lifecycle + live preview).
 *
 * Mounted alongside `useDimToolRouting` in `useDrawingHandlers` (which owns the
 * `previewCanvasRef` + the active scene). Owns everything EXCEPT the click, which
 * is dispatched by the central `useCanvasClickHandler` (it has the `levelManager`
 * accessor for the undoable batch) → `advanceCutlineClick`.
 *
 * Responsibilities:
 *   - On tool activate: open the shared `AutoDimensionOptionsDialog`, then arm the
 *     session store (cancel → back to `select`).
 *   - RAF preview (ADR-040, `registerRenderCallback` — mirror `dim-preview-persist`):
 *     phase `awaitingEnd`  → rubber-band cut line to the cursor;
 *     phase `awaitingPlacement` → cut line + live ghost dimension chain following
 *     the cursor offset, via the existing `drawGhostFaceDimensions` overlay.
 *   - Escape → cancel + exit tool (EscapeCommandBus, ADR-364).
 *
 * @see systems/dimensions/auto/run-cutline-dimension.ts — click FSM + commit + preview meta.
 * @see systems/dimensions/auto/auto-dimension-cutline-store.ts — the session SSoT.
 */

import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/scene';
import type { ToolType } from '../../ui/toolbar/types';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';
import { getRealtimeWorldCursor } from '../../systems/cursor/ImmediatePositionStore';
import { requestAutoDimensionDialog } from '../../systems/dimensions/auto/auto-dimension-dialog-store';
import {
  armCutline,
  resetCutline,
  getCutlineSession,
} from '../../systems/dimensions/auto/auto-dimension-cutline-store';
import { buildCutlinePreviewMeta } from '../../systems/dimensions/auto/run-cutline-dimension';
import { handleToolCompletion } from '../drawing/drawing-handler-utils';
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';

/** The tool id — a single-source constant so the wiring stays consistent. */
export const AUTO_DIM_CUTLINE_TOOL: ToolType = 'auto-dim-cutline';

type PreviewRef = React.RefObject<PreviewCanvasHandle> | undefined;

export interface UseAutoDimCutlineToolParams {
  readonly activeTool: ToolType;
  readonly previewCanvasRef?: React.RefObject<PreviewCanvasHandle>;
  /** Active-level scene getter (drives the live chain preview). */
  readonly getScene: () => SceneModel | undefined;
  /** Called on cancel / Escape so the parent can switch back to `select`. */
  readonly onToolChange?: (tool: ToolType) => void;
}

/** Minimal line entity for the rubber-band cut line (rendered by `drawPreview`). */
function cutlinePreviewLine(start: Point2D, end: Point2D) {
  return { id: '__auto_dim_cutline_preview__', type: 'line' as const, layerId: '', start, end };
}

/** Paint the cut line + (placement phase) the live ghost dimension chain. */
function paintCutlinePreview(previewRef: PreviewRef, scene: SceneModel | undefined): void {
  const canvas = previewRef?.current;
  if (!canvas) return;
  const s = getCutlineSession();
  // Realtime 60fps un-throttled channel — the SSoT every ghost reads (ADR-040
  // cursor-lag Φ12). The throttled ~20fps `getImmediateWorldPosition` lagged the
  // rubber-band so the cut line didn't follow the cursor live after click 1.
  const cursor = getRealtimeWorldCursor();

  if (s.phase === 'awaitingEnd' && s.cutStart && cursor) {
    canvas.drawPreview(cutlinePreviewLine(s.cutStart, cursor) as unknown as Parameters<typeof canvas.drawPreview>[0]);
    return;
  }
  if (s.phase === 'awaitingPlacement' && s.cutStart && s.cutEnd && s.options) {
    canvas.drawPreview(cutlinePreviewLine(s.cutStart, s.cutEnd) as unknown as Parameters<typeof canvas.drawPreview>[0]);
    if (cursor && scene) {
      const meta = buildCutlinePreviewMeta(scene, s.cutStart, s.cutEnd, cursor, s.options);
      if (meta) canvas.drawGhostFaceDimensions(meta);
    }
    return;
  }
  canvas.clear();
}

export function useAutoDimCutlineTool(params: UseAutoDimCutlineToolParams): void {
  const { activeTool, previewCanvasRef, getScene } = params;
  const isActive = activeTool === AUTO_DIM_CUTLINE_TOOL;

  const previewRef = useRef(previewCanvasRef);
  previewRef.current = previewCanvasRef;
  const getSceneRef = useRef(getScene);
  getSceneRef.current = getScene;
  const onToolChangeRef = useRef(params.onToolChange);
  onToolChangeRef.current = params.onToolChange;

  const exitTool = useCallback(() => {
    resetCutline();
    previewRef.current?.current?.clear();
    onToolChangeRef.current?.('select');
    handleToolCompletion(AUTO_DIM_CUTLINE_TOOL, true);
  }, []);

  // Lifecycle: open dialog + arm on activate; reset on deactivate.
  useEffect(() => {
    if (!isActive) {
      resetCutline();
      previewRef.current?.current?.clear();
      return;
    }
    let cancelled = false;
    void requestAutoDimensionDialog().then((res) => {
      if (cancelled) return;
      if (res.kind === 'run') armCutline(res.options);
      else exitTool();
    });
    return () => {
      cancelled = true;
    };
  }, [isActive, exitTool]);

  // RAF preview persist (mirror `dim-preview-persist`) — reads session + cursor.
  useEffect(() => {
    if (!isActive) return;
    return registerRenderCallback(
      'auto-dim-cutline-preview',
      'Auto-Dim Cut-Line Preview',
      RENDER_PRIORITIES.NORMAL,
      () => paintCutlinePreview(previewRef.current, getSceneRef.current()),
    );
  }, [isActive]);

  // Escape → cancel the flow + exit the tool (AutoCAD pattern).
  useEscapeHandler({
    id: 'auto-dim-cutline/cancel',
    priority: ESC_PRIORITY.DIM_TOOL,
    canHandle: () => isActive,
    handle: () => {
      exitTool();
      return true;
    },
  });
}
