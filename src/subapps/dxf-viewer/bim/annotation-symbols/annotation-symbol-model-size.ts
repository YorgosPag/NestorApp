/**
 * ADR-583 — Annotation-symbol annotative sizing SSoT.
 *
 * An `AnnotationSymbolEntity.sizeMm` is a *paper*-space height (D2, AutoCAD
 * annotative block convention). Its *model*-space extent — what the renderer
 * stamps, and what selection bounds / hit-test must cover — is that paper height
 * folded through the SAME `paperHeightToModel` the dimension arrowheads/text use,
 * at the live `drawingScale` (1:N) SSoT. Centralising it here is the ONE place the
 * three consumers (renderer, `entity-bounds`, `hit-test`) agree, so a north arrow
 * is never drawn one size but picked at another (N.18 anti-clone).
 *
 * `sceneUnits` defaults to `'mm'`: the canvas geometry is canonical-mm
 * (`reference_dxf_units_and_viewport_ssot`), so the pure bounds/hit-test callers —
 * which have no injected unit system — stay exact for the common case. The
 * renderer passes the real injected `scene.units` for cm/m scenes.
 *
 * @see utils/annotation-scale.ts — `paperHeightToModel` (the unit math SSoT)
 * @see state/drawing-scale-store.ts — the `drawingScale` SSoT (Revit annotation scale)
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import { paperHeightToModel } from '../../utils/annotation-scale';
import type { SceneUnits } from '../../utils/scene-units';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';

/**
 * Nominal model-space glyph height (scene units) for a paper height `sizeMm` at a
 * given drawing scale. Pure — no store read (testable / renderer fast-path).
 */
export function annotationSymbolModelSize(
  sizeMm: number,
  drawingScale: number,
  sceneUnits: SceneUnits = 'mm',
): number {
  return paperHeightToModel(sizeMm, drawingScale, sceneUnits);
}

/**
 * Convenience: nominal model-space glyph height using the LIVE `drawingScale`
 * SSoT (frame-time getter, ADR-040 — no subscription). Used by the pure
 * bounds/hit-test paths that only know the paper `sizeMm`.
 */
export function annotationSymbolModelSizeLive(
  sizeMm: number,
  sceneUnits: SceneUnits = 'mm',
): number {
  const drawingScale = useDrawingScaleStore.getState().drawingScale;
  return annotationSymbolModelSize(sizeMm, drawingScale, sceneUnits);
}
