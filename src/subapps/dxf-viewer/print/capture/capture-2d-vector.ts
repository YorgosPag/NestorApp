/**
 * ADR-608 — Print/Export engine · 2D VECTOR capture adapter.
 *
 * Sibling of `capture-2d.ts`: instead of rendering the scene to an offscreen PNG,
 * it returns a `draw(pdf, area)` closure that emits NATIVE jsPDF vector primitives
 * (lines / arcs / text / fills). The result is a PDF whose AutoCAD "PDF Import"
 * yields real entities (`PDF_Geometry` / `PDF_Text` / `PDF_Solid Fills`) instead of
 * one flattened image on `PDF_Images`, and which zooms without pixelation.
 *
 * SSoT reuse — this path shares EVERY upstream step with the raster adapter and the
 * DXF exporter, so all three stay in lockstep (Revit "export what you draw"):
 *   - `prepareScene2dCapture`               — same scene hydration as capture-2d.
 *   - `resolvePrintTransform`               — same fit/centering math as capture-2d.
 *   - `stampRenderedColors` + `flattenSceneEntitiesForDxf` — same colour + BIM
 *     decomposition as the DXF export adapter.
 *   - `CoordinateTransforms.worldToScreen` + `pxToMm` — the same world→screen the
 *     offscreen renderer uses, folded to paper mm so the drawing lands on IDENTICAL
 *     paper coordinates as the raster fallback.
 *   - `emitSceneToPdf`                      — the vector emitter core (Φ1).
 *
 * @module subapps/dxf-viewer/print/capture/capture-2d-vector
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { flattenSceneEntitiesForDxf } from '../../export/core/bim-to-dxf-primitives';
import { expandAnnotationsToPrimitives } from '../../export/core/annotation-to-primitives';
import { stampRenderedColors } from '../../export/formats/dxf-export-adapter';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { resolveSceneUnits } from '../../utils/scene-units';
import type { PrintColorPolicy } from '../../config/print-color-policy';
import { pxToMm, resolveAppliedScaleDenominator } from '../config/paper-math';
import { emitSceneToPdf } from '../vector/scene-vector-emitter';
import { resolveSceneImages } from '../vector/scene-image-resolver';
import type { Capture2dInput } from './capture-2d';
import { resolvePrintTransform, prepareScene2dCapture } from './capture-2d';
import type { CaptureResult } from './capture-types';
import type { PrintableAreaMm } from '../config/paper-types';

/**
 * Build a pure world→paper-mm mapper for the placed printable area.
 *
 * `worldToScreen` maps a world point to offscreen-canvas pixels (already Y-down,
 * ruler-margin-consistent with the raster render). Since the offscreen canvas is
 * sized exactly to the printable area, canvas px fold to paper mm 1:1 via `pxToMm`
 * plus the area's top-left offset — so the vector drawing coincides with what the
 * raster path would have rasterised.
 */
function makeToPaper(
  transform: ViewTransform,
  viewport: Viewport,
  effectiveDpi: number,
  area: PrintableAreaMm,
): (p: Point2D) => Point2D {
  return (p: Point2D) => {
    const screen = CoordinateTransforms.worldToScreen(p, transform, viewport);
    return {
      x: area.xMm + pxToMm(screen.x, effectiveDpi),
      y: area.yMm + pxToMm(screen.y, effectiveDpi),
    };
  };
}

/**
 * Capture the current 2D scene as a VECTOR `CaptureResult`. The heavy scene
 * conversion + flatten + async image decode runs eagerly (so failures surface
 * before assembly); only the jsPDF emission is deferred into the `draw` closure
 * the assembler invokes with the final printable area.
 *
 * ADR-608 hybrid — `resolveSceneImages` προ-αποκωδικοποιεί κάθε image-fill hatch /
 * `ImageEntity` σε data URL + world placements ΠΡΙΝ το sync closure, ώστε ο emitter να
 * τις συνθέτει inline (raster μέσα σε vector σχέδιο, όπως AutoCAD PDF export).
 */
export async function captureCurrent2dViewVector(input: Capture2dInput): Promise<CaptureResult> {
  const { dxfScene, viewport } = prepareScene2dCapture(input);
  const transform = resolvePrintTransform(dxfScene, viewport, input);
  const effectiveDpi = input.raster.effectiveDpi;

  // Same colour + BIM-decomposition pipeline the DXF export uses, so vector PDF,
  // DXF and the on-screen render agree entity-for-entity.
  const sceneEntities = input.scene?.entities ?? [];
  const layersById = input.scene?.layersById ?? {};
  const colored = stampRenderedColors(sceneEntities, layersById);
  const { entities: flat } = flattenSceneEntitiesForDxf(colored);

  // ADR-583/608 — explode annotation symbols + scale-bars into neutral primitives
  // the emitter draws (Revit/AutoCAD "explode annotation on export"). Without this
  // pre-pass the emitter's `default` case silently drops them from the vector PDF.
  // Annotative sizing needs the live drawing scale (1:N) + the scene's units.
  const drawingScale = useDrawingScaleStore.getState().drawingScale;
  const sceneUnits = input.userDrawingUnits ?? resolveSceneUnits({ units: dxfScene.units });
  const entities = expandAnnotationsToPrimitives(flat, { drawingScale, sceneUnits });

  const colorPolicy: PrintColorPolicy = {
    style: input.plotStyle ?? 'colour',
    dpi: effectiveDpi,
  };
  // px/world-unit → mm/world-unit (radii + text height are drawn in paper mm).
  const worldToPaperScale = pxToMm(transform.scale, effectiveDpi);

  // ADR-608 hybrid — async decode ΟΛΩΝ των εικόνων εδώ (πριν το sync closure): data URLs +
  // world placements. Το closure μετά μόνο συνθέτει (μηδέν await στο render path, ADR-040).
  const images = await resolveSceneImages(entities);

  return {
    kind: 'vector',
    appliedScaleDenominator: resolveAppliedScaleDenominator(input.fitMode, input.scaleDenominator),
    draw: (pdf, area) => {
      emitSceneToPdf(pdf, {
        entities,
        toPaper: makeToPaper(transform, viewport, effectiveDpi, area),
        worldToPaperScale,
        colorPolicy,
        images,
      });
    },
  };
}
