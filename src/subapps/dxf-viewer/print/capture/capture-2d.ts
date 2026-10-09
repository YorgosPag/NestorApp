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
import { IDENTITY_VIEW_TRANSFORM } from '../../config/geometry-constants';
import type { CaptureResult } from './capture-types';
import { createOffscreen2dTarget } from './capture-2d-offscreen-canvas';
import { missingSceneImageWarnings, preloadSceneImages } from './preload-scene-images';
import { summarizePrintFidelity } from '../print-fidelity';
import { isEntityLayerSkipped } from '../../canvas-v2/dxf-canvas/dxf-entity-layer-skip';

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
  /**
   * ADR-909 Β2.5 — δάπεδο πάχους σε px της εικόνας (`PrintColorPolicy.minLineWidthPx`). Η εκτύπωση σε
   * χαρτί **δεν** το ορίζει· το ορίζει μόνο εικόνα που θα μικρύνει πριν τη δει άνθρωπος.
   */
  minLineWidthPx?: number;
}

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
  // 🏢 ADR-118 SSoT — ο ουδέτερος μετασχηματισμός έχει ΜΙΑ πηγή (N.0.2, ήταν τοπικό literal εδώ).
  return fit.transform ?? IDENTITY_VIEW_TRANSFORM;
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
  const dxfScene = convertSceneForCapture(input.scene, input.userDrawingUnits);
  const viewport = rasterToViewport(input.raster);
  return { dxfScene, viewport };
}

/**
 * Convert the scene to DXF-shape and hydrate the LayerStore SSoT — the half of
 * {@link prepareScene2dCapture} that does **not** need a raster yet.
 *
 * ADR-909 Β2.3 — the public-floorplan capture sizes its raster FROM the converted
 * scene's bounds, so it needs the scene before it can name a viewport.
 */
export function convertSceneForCapture(
  scene: SceneModel | null,
  userDrawingUnits?: SceneUnits,
): DxfScene {
  const dxfScene = convertSceneToDxf(scene, userDrawingUnits);
  // Hydrate the LayerStore SSoT so the renderer resolves layer
  // visibility/frozen/colour exactly as the live canvas does (the pure
  // convertSceneToDxf intentionally performs no side effects).
  if (dxfScene.layersById) {
    setLayers(Object.values(dxfScene.layersById));
  }
  return dxfScene;
}

/** An offscreen render, with the transform that placed the drawing on it. */
export interface OffscreenScene2dRender {
  canvas: HTMLCanvasElement;
  /** World→pixel transform actually used — callers derive the visible world frame from it. */
  transform: ViewTransform;
}

/**
 * Render an already-converted scene into a fresh offscreen canvas at `input.raster`
 * size. The ONE render call shared by the print raster path and the public-floorplan
 * capture (ADR-909 Β2.3) — same options, same plot-style scope.
 */
export function renderDxfSceneOffscreen(
  dxfScene: DxfScene,
  viewport: Viewport,
  input: Capture2dInput,
): OffscreenScene2dRender {
  const { canvas, renderer } = createOffscreen2dTarget(input.raster.widthPx, input.raster.heightPx);
  const transform = resolvePrintTransform(dxfScene, viewport, input);

  // ADR-454 — activate the plot-style policy for this one-shot offscreen render
  // (white-safe colour remap + ISO lineweights at the real print DPI). Cleared in
  // `finally` so the live interactive renderer is never affected. The set→render→
  // clear chain is fully synchronous → zero concurrency risk.
  setPrintColorPolicy({
    style: input.plotStyle ?? 'colour',
    dpi: input.raster.effectiveDpi,
    ...(input.minLineWidthPx !== undefined ? { minLineWidthPx: input.minLineWidthPx } : {}),
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

  return { canvas, transform };
}

/**
 * ADR-909 Β2.6 — **φέρε τις εικόνες του σχεδίου πριν ζωγραφίσεις** (εικόνες υλικού γραμμοσκίασης, «γυμνές»
 * εικόνες). Το ΕΝΑ `await` κάθε raster λήψης, και ζει **πριν** από την απόδοση.
 *
 * 🔑 Μετατρέπει με το **καθαρό** `convertSceneToDxf` (χωρίς ενυδάτωση του LayerStore): ανάμεσα σε αυτό το
 * `await` και στην απόδοση ο ζωντανός καμβάς συνεχίζει να τρέχει, και μια ενυδάτωση εδώ θα μπορούσε να
 * έχει ξεπεραστεί ως τότε. Η ενυδάτωση γίνεται από το {@link convertSceneForCapture}, **σύγχρονα** με την απόδοση.
 */
export async function preloadCaptureImages(
  scene: SceneModel | null,
  plotStyle: PrintPlotStyle,
  userDrawingUnits?: SceneUnits,
): Promise<void> {
  await preloadSceneImages(convertSceneToDxf(scene, userDrawingUnits).entities, plotStyle);
}

/**
 * Capture the current 2D scene to a paper-resolution PNG `CaptureResult`.
 *
 * ADR-909 Β2.6 — async: the scene's images are decoded **before** the one-shot synchronous
 * render (they used to arrive after the last pixel and print as flat grey), and whatever
 * still is not ready is **reported** through `fidelity` — same channel as the vector path.
 */
export async function captureCurrent2dView(input: Capture2dInput): Promise<CaptureResult> {
  const plotStyle = input.plotStyle ?? 'colour';
  await preloadCaptureImages(input.scene, plotStyle, input.userDrawingUnits);

  const { dxfScene, viewport } = prepareScene2dCapture(input);
  const { canvas } = renderDxfSceneOffscreen(dxfScene, viewport, input);
  const drawn = dxfScene.entities.filter((e) => !isEntityLayerSkipped(e, dxfScene.layersById));

  return {
    kind: 'raster',
    dataUrl: canvas.toDataURL('image/png'),
    widthPx: input.raster.widthPx,
    heightPx: input.raster.heightPx,
    appliedScaleDenominator: resolveAppliedScaleDenominator(input.fitMode, input.scaleDenominator),
    fidelity: summarizePrintFidelity(missingSceneImageWarnings(drawn, plotStyle)),
  };
}
