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
import { getRealtimeWorldCursor, subscribeRealtimeWorldCursor } from '../../systems/cursor/ImmediatePositionStore';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { requestAutoDimensionDialog } from '../../systems/dimensions/auto/auto-dimension-dialog-store';
import {
  armCutline,
  resetCutline,
  getCutlineSession,
} from '../../systems/dimensions/auto/auto-dimension-cutline-store';
import { buildCutlinePreviewMeta } from '../../systems/dimensions/auto/run-cutline-dimension';
import { handleToolCompletion } from '../drawing/drawing-handler-utils';
// ADR-563 §cutline-tracking — ίδια ίχνη ευθυγράμμισης + Polar με τη σχεδίαση τοίχου
// (ΕΝΑΣ SSoT resolver+paint, μηδέν νέα μηχανή). Preview & commit καλούν το ίδιο resolve.
import { resolveDimActionEndpoint, paintDimActionTracking } from './dim-alignment-tracking';
import { ambientAlignmentConfigStore } from '../../systems/tracking/ambient-alignment-config-store';
import { resolveSceneUnits, mmToSceneUnits } from '../../utils/scene-units';
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

/** World-distance → mm for the active scene (canonical-mm default when no scene). */
function cutlineToMm(scene: SceneModel | undefined): (worldDist: number) => number {
  const mmScale = Math.max(mmToSceneUnits(resolveSceneUnits(scene)), 1e-9);
  return (worldDist) => worldDist / mmScale;
}

/**
 * Resolve the tracked endpoint (POLAR angle-lock + alignment override) for the
 * cut-line action — the SAME SSoT the wall drawing uses. `refPoints[0]` is the
 * POLAR anchor (the current segment's start). The ambient scene read is gated
 * behind the AutoAlign toggle so it stays lazy (perf parity with the drawing flow).
 */
function resolveCutlineTracking(
  refPoints: readonly Point2D[],
  cursor: Point2D,
  scene: SceneModel | undefined,
): ReturnType<typeof resolveDimActionEndpoint> {
  const ambientOn = ambientAlignmentConfigStore.getSnapshot().enabled;
  const entities = ambientOn ? scene?.entities ?? null : null;
  return resolveDimActionEndpoint(refPoints, cursor, getImmediateTransform().scale, entities);
}

/** Paint the cut line + alignment/Polar traces + (placement phase) ghost dimension chain. */
function paintCutlinePreview(previewRef: PreviewRef, scene: SceneModel | undefined): void {
  const canvas = previewRef?.current;
  if (!canvas) return;
  const s = getCutlineSession();
  // Realtime 60fps un-throttled channel — the SSoT every ghost reads (ADR-040
  // cursor-lag Φ12). The throttled ~20fps `getImmediateWorldPosition` lagged the
  // rubber-band so the cut line didn't follow the cursor live after click 1.
  const cursor = getRealtimeWorldCursor();

  if (s.phase === 'awaitingEnd' && s.cutStart && cursor) {
    // ADR-563 §cutline-tracking — the rubber-band end snaps to POLAR/alignment,
    // then the SAME traces the wall shows overlay it (drawPreview first, ίχνη μετά).
    const resolved = resolveCutlineTracking([s.cutStart], cursor, scene);
    canvas.drawPreview(cutlinePreviewLine(s.cutStart, resolved.point) as unknown as Parameters<typeof canvas.drawPreview>[0]);
    // ADR-397 §15 — έγχρωμο τόξο ΦΟΡΑΣ (🟢 πάνω / 🔴 κάτω από τον world-X) + βελάκι + baseline 0°
    // από την αρχή προς το τέλος — ΤΟ ΙΔΙΟ SSoT painter με τοίχο/δοκό/περιστροφή (Giorgio).
    const bearingDeg = (Math.atan2(resolved.point.y - s.cutStart.y, resolved.point.x - s.cutStart.x) * 180) / Math.PI;
    canvas.drawDirectionArc(s.cutStart, { x: s.cutStart.x + 1, y: s.cutStart.y }, resolved.point, bearingDeg);
    paintDimActionTracking(canvas, s.cutStart, resolved, cutlineToMm(scene));
    return;
  }
  if (s.phase === 'awaitingPlacement' && s.cutStart && s.cutEnd && s.options) {
    canvas.drawPreview(cutlinePreviewLine(s.cutStart, s.cutEnd) as unknown as Parameters<typeof canvas.drawPreview>[0]);
    if (cursor && scene) {
      const meta = buildCutlinePreviewMeta(scene, s.cutStart, s.cutEnd, cursor, s.options);
      if (meta) canvas.drawGhostFaceDimensions(meta);
    }
    // Giorgio «και στην τοποθέτηση offset» — show the traces during placement too.
    // Both endpoints are alignment anchors; POLAR anchors on the nearest (cutEnd).
    // Visual only — the offset itself keeps following the raw cursor (no forced snap).
    if (cursor) {
      const resolved = resolveCutlineTracking([s.cutEnd, s.cutStart], cursor, scene);
      paintDimActionTracking(canvas, s.cutEnd, resolved, cutlineToMm(scene));
    }
    return;
  }
  canvas.clear();
}

export function useAutoDimCutlineTool(params: UseAutoDimCutlineToolParams): void {
  const { activeTool, previewCanvasRef, getScene } = params;
  // `useDrawingHandlers` is mounted TWICE (useCanvasEffects/CanvasSection WITH a
  // previewCanvasRef · useDxfViewerState WITHOUT one). Both mount this hook, and both
  // would register the SAME-id RAF callback ('auto-dim-cutline-preview') — the scheduler
  // REPLACES on duplicate id, so the ref-less mount would clobber the real one and the
  // preview would never paint (hasCanvas:false). Gate the whole tool on the preview ref
  // so ONLY the instance that can actually render owns the dialog + RAF + escape.
  const isActive = activeTool === AUTO_DIM_CUTLINE_TOOL && !!previewCanvasRef;

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

  // Live repaint: the realtime cursor channel fires SYNCHRONOUSLY on every mousemove
  // (ADR-040 Φ12), so the rubber-band follows the cursor in REAL TIME. The cut-line tool
  // skips the generic `processDrawingHover` (which is what gives every other tool its
  // synchronous per-move repaint), so without this the preview only refreshed at the
  // scheduler's idle cadence → «updates only when the cursor stops» (Giorgio).
  useEffect(() => {
    if (!isActive) return;
    return subscribeRealtimeWorldCursor(() =>
      paintCutlinePreview(previewRef.current, getSceneRef.current()),
    );
  }, [isActive]);

  // RAF preview persist (mirror `dim-preview-persist`) — re-pushes every frame so the
  // rubber-band survives any external `canvas.clear()` WHILE the cursor is still (no
  // mousemove → the sync subscription above is idle).
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
