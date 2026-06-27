/**
 * placement-overlay-paint — PURE dispatcher που ζωγραφίζει το 3D placement meta μέσω των
 * **ΙΔΙΩΝ** 2D painters (ADR-544). Μηδέν νέος render-κώδικας: καλεί `paintPolarDisk`/
 * `paintRectGrid`/`paintGhostFaceDimensions`/`paintAlignmentGuide` με τον 3D `OverlayProjector`
 * — έτσι η εικόνα στο 3D είναι ίδια με το 2D (ένας paint-κώδικας).
 *
 * Κρατάει το `BimPlacementOverlay2D` thin (το draw-loop μένει στο RAF) και είναι jest-friendly
 * (canvas + δεδομένα μέσα, μηδέν React/Three).
 *
 * @see ../../../canvas-v2/preview-canvas/* — οι μοιραζόμενοι painters
 * @see ../../stores/Placement3DOverlayStore.ts — η πηγή του meta
 */

import type { ViewTransform } from '../../../rendering/types/Types';
import type { OverlayProjector } from '../../../canvas-v2/preview-canvas/overlay-projector';
import type { Placement3DMeta } from '../../stores/Placement3DOverlayStore';
import { paintPolarDisk } from '../../../canvas-v2/preview-canvas/polar-disk-paint';
import { paintRectGrid } from '../../../canvas-v2/preview-canvas/rect-grid-paint';
import { paintGhostFaceDimensions } from '../../../canvas-v2/preview-canvas/ghost-face-dim-paint';
import { paintAlignmentGuide } from '../../../canvas-v2/preview-canvas/alignment-guide-paint';

type Viewport = { readonly width: number; readonly height: number };

/**
 * Ζωγράφισε ΟΛΟ το placement meta μέσω του `project`. Το `transform`/`viewport` περνούν μόνο στις
 * διαστάσεις (ADR-362 internals — text suppressed, scale από τον projector)· ο projector ορίζει
 * την πραγματική προβολή σε 2D ΚΑΙ 3D.
 */
export function paintPlacement3DOverlay(
  ctx: CanvasRenderingContext2D,
  meta: Placement3DMeta,
  project: OverlayProjector,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  if (meta.polarDiskGrid) paintPolarDisk(ctx, meta.polarDiskGrid, project);
  if (meta.rectGrid) paintRectGrid(ctx, meta.rectGrid, project);
  if (meta.faceDimensions) paintGhostFaceDimensions(ctx, meta.faceDimensions, transform, viewport, project);
  if (meta.alignmentGuide) {
    const guides = Array.isArray(meta.alignmentGuide) ? meta.alignmentGuide : [meta.alignmentGuide];
    for (const g of guides) paintAlignmentGuide(ctx, g, project);
  }
}
