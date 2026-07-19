/* eslint-disable design-system/no-hardcoded-colors */
/**
 * ADR-340 — «Χρώμα σχεδίου» single-ink recolor for the read-only floorplan.
 *
 * Big-players / SSoT: AutoCAD/Revit/ArchiCAD «Monochrome» display collapses every
 * entity to ONE ink regardless of its layer/ACI/TrueColor/ByLayer style. The user picks
 * that ink (black on light, white on dark, or any colour via the OS colour picker) —
 * this helper is colour-agnostic (the ink is a parameter). Rather than
 * clone the scene and re-fight the editor engine's full colour cascade
 * (`resolveStyleForRender` → ACI 62 → TrueColor 420 → ByLayer → hex), this recolors
 * the ALREADY-rendered pixels: the engine draws every entity onto a TRANSPARENT
 * canvas (`DxfRenderer.render()` starts with `clearRect`, no opaque fill), so a single
 * `source-in` composite repaints every non-transparent pixel with the ink while
 * preserving its alpha (anti-aliasing, line-weight, transparency all survive).
 *
 * WHY this over a scene-colour remap (the rejected Option A):
 *  - ZERO duplication of the engine's colour-resolution logic (N.18 / SSoT) — it works
 *    for lines, text, hatch, dimensions, blocks and BIM linework identically, with no
 *    per-type list to drift as new entity types are added.
 *  - The shared editor `DxfRenderer` engine stays UNTOUCHED (no `RenderOptions.inkColor`
 *    surface added to a file another agent owns).
 *
 * Called by `renderFloorplanScene` between the engine `.render()` and the gallery
 * background paint, so the ink lands on entities only — never on the background (that
 * is painted afterwards with `destination-over`) nor on the interactive unit-overlay
 * polygons (drawn later, in `useFloorplanCanvasRender`, so they keep their colour).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-340-raster-background-layers-system.md
 * @module components/shared/files/media/floorplan-monochrome
 */

import { MONOCHROME_INK } from '@/components/shared/files/media/floorplan-dxf-renderer';

/**
 * Recolor every drawn (non-transparent) pixel of `ctx` to a single ink, preserving
 * each pixel's alpha. Must run while the canvas holds ONLY the entity render on a
 * transparent background (i.e. before any opaque background is composited).
 *
 * @param ctx    2D context of the read-only floorplan canvas, post-`engine.render()`.
 * @param width  Backing-store width in device pixels (`canvas.width`).
 * @param height Backing-store height in device pixels (`canvas.height`).
 * @param ink    Hex ink colour; defaults to the SSoT {@link MONOCHROME_INK}.
 */
export function applyMonochromeInk(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ink: string = MONOCHROME_INK,
): void {
  ctx.save();
  // `source-in`: keep the destination's alpha, replace its colour with `ink`.
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
