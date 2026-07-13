/**
 * ADR-453 — Print/Export engine · 2D capture adapter (Option A).
 *
 * Re-renders the active scene into an offscreen canvas at paper resolution and
 * returns a PNG `CaptureResult`. Reuses the production render pipeline
 * (`convertSceneToDxf` → `DxfRenderer.render`) so the output is pixel-faithful
 * to the on-screen drawing, just at print DPI.
 *
 * @module subapps/dxf-viewer/print/capture/capture-2d
 */

import type { SceneModel } from '../../types/entities';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { convertSceneToDxf } from '../../hooks/canvas/useDxfSceneConversion';
import { setLayers } from '../../stores/LayerStore';
import { FitToViewService } from '../../services/FitToViewService';
import { createCombinedBounds } from '../../utils/bounds-utils';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { FitMode, PrintPlotStyle, RasterTargetPx } from '../config/paper-types';
import {
  rasterToViewport,
  computeDrawingScaleTransform,
  resolveAppliedScaleDenominator,
} from '../config/paper-math';
import { setPrintColorPolicy, clearPrintColorPolicy } from '../../config/print-color-policy';
import type { CaptureResult } from './capture-types';
import { createOffscreen2dTarget } from './capture-2d-offscreen-canvas';

export interface Capture2dInput {
  scene: SceneModel | null;
  userDrawingUnits?: SceneUnits;
  raster: RasterTargetPx;
  fitMode: FitMode;
  /** Required (and used) only for `drawing-scale` mode. */
  scaleDenominator?: number;
  /**
   * ADR-454 — plot style for white-safe colour remap + print-DPI lineweights.
   * Defaults to `'colour'` (white-safe) when omitted.
   */
  plotStyle?: PrintPlotStyle;
}

const IDENTITY_TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

/**
 * Resolve the print transform for the requested fit mode. Exported so the vector
 * capture path (ADR-608) shares the EXACT same fit/centering math as the raster
 * render — the two outputs must land the drawing on identical paper coordinates.
 */
export function resolvePrintTransform(
  dxfScene: DxfScene,
  viewport: Viewport,
  input: Capture2dInput,
): ViewTransform {
  const bounds = createCombinedBounds(dxfScene, [], true);
  if (input.fitMode === 'drawing-scale' && input.scaleDenominator && bounds) {
    const units = (dxfScene.units ?? 'mm') as SceneUnits;
    return computeDrawingScaleTransform(bounds, viewport, {
      scaleDenominator: input.scaleDenominator,
      mmPerSceneUnit: 1 / mmToSceneUnits(units),
      dpi: input.raster.effectiveDpi,
    });
  }
  const fit = FitToViewService.calculateFitToViewTransform(dxfScene, [], viewport);
  return fit.transform ?? IDENTITY_TRANSFORM;
}

/**
 * Convert the scene to DXF-shape, hydrate the LayerStore SSoT, and resolve the
 * print viewport. Shared by the raster (`captureCurrent2dView`) and vector
 * (ADR-608 `captureCurrent2dViewVector`) capture paths so both start from the
 * identical scene/layer/viewport state.
 */
export function prepareScene2dCapture(
  input: Capture2dInput,
): { dxfScene: DxfScene; viewport: Viewport } {
  const dxfScene = convertSceneToDxf(input.scene, input.userDrawingUnits);
  // Hydrate the LayerStore SSoT so the renderer resolves layer
  // visibility/frozen/colour exactly as the live canvas does (the pure
  // convertSceneToDxf intentionally performs no side effects).
  if (dxfScene.layersById) {
    setLayers(Object.values(dxfScene.layersById));
  }
  const viewport = rasterToViewport(input.raster);
  return { dxfScene, viewport };
}

/**
 * Capture the current 2D scene to a paper-resolution PNG `CaptureResult`.
 */
export function captureCurrent2dView(input: Capture2dInput): CaptureResult {
  const { dxfScene, viewport } = prepareScene2dCapture(input);
  const { canvas, renderer } = createOffscreen2dTarget(input.raster.widthPx, input.raster.heightPx);
  const transform = resolvePrintTransform(dxfScene, viewport, input);

  // ADR-454 — activate the plot-style policy for this one-shot offscreen render
  // (white-safe colour remap + ISO lineweights at the real print DPI). Cleared in
  // `finally` so the live interactive renderer is never affected. The set→render→
  // clear chain is fully synchronous → zero concurrency risk.
  setPrintColorPolicy({
    style: input.plotStyle ?? 'colour',
    dpi: input.raster.effectiveDpi,
  });
  try {
    renderer.render(dxfScene, transform, viewport, {
      selectedEntityIds: [],
      showGrid: false,
      showLayerNames: false,
      wireframeMode: false,
      skipInteractive: true,
    });
  } finally {
    clearPrintColorPolicy();
  }

  return {
    kind: 'raster',
    dataUrl: canvas.toDataURL('image/png'),
    widthPx: input.raster.widthPx,
    heightPx: input.raster.heightPx,
    appliedScaleDenominator: resolveAppliedScaleDenominator(input.fitMode, input.scaleDenominator),
  };
}
