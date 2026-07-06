/**
 * Preview entity paint — SRP split out of `PreviewRenderer.render()` (ADR-040).
 *
 * Pure paint pass for the ACTIVE preview entity (the frame-lifecycle bits — clear,
 * dirty-flag, tracking markers — stay in `PreviewRenderer.render`). Two entity paths:
 *  1. WYSIWYG placement ghost (`wysiwygPreview`) → real BIM renderers via `BimPreviewRenderer`,
 *     with the 🔴 schematic status override (`drawStatusGhostPolygon`) + LIVE joint-miter neighbors.
 *  2. Generic entity dispatch (line/circle/…/dimension) via `dispatchPreviewEntityRender`, plus the
 *     colored preview grips override (ADR-142 icon click sequence).
 */

import type { Point2D, ViewTransform, Viewport, Entity } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from '../../hooks/drawing/useUnifiedDrawing';
import type { SceneUnits } from '../../utils/scene-units';
import { OPACITY } from '../../config/color-config';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { PreviewGripPoint } from '../../types/entities';
import type { PreviewRenderOptions, PreviewRenderHelpers } from './preview-renderer-types';
import { renderDistanceLabelFromWorld, renderInfoLabel } from './preview-render-labels';
import { dispatchPreviewEntityRender } from './preview-entity-dispatch';
import { BimPreviewRenderer } from './bim-preview-render';
import { drawEntityStatusSchematic } from '../../bim/ghosts/ghost-status-polygon-draw';
import type { GhostStatusColor } from '../../bim/ghosts/ghost-status-color';

/** Grip painter injected from the renderer (keeps ownership of the `UnifiedGripRenderer`). */
export type PreviewGripPainter = (
  ctx: CanvasRenderingContext2D,
  screenPos: Point2D,
  opts: Required<PreviewRenderOptions>,
  customColor?: string,
) => void;

/**
 * Paint the active preview entity. Called by `PreviewRenderer.render()` AFTER the canvas has been
 * cleared and tracking markers painted; `entity` is guaranteed non-null by the caller.
 */
export function paintPreviewEntity(
  ctx: CanvasRenderingContext2D,
  entity: ExtendedSceneEntity,
  transform: ViewTransform,
  viewport: Viewport,
  options: Required<PreviewRenderOptions>,
  sceneUnits: SceneUnits,
  bimPreview: BimPreviewRenderer | null,
  renderGrip: PreviewGripPainter,
): void {
  // 🏢 WYSIWYG placement preview: when the tool's preview helper returns a full
  // BIM entity (`.params` + `.geometry`, flagged `wysiwygPreview`), render it
  // through the SAME real renderers as the committed scene so the rubber-band
  // IS the final element (fill / hatch / lineweight), not a green outline.
  const bimMeta = entity as {
    wysiwygPreview?: boolean;
    ghostStatusColor?: GhostStatusColor | null;
  };
  if (bimMeta.wysiwygPreview && bimPreview) {
    // ADR-398 §beam-to-beam framing — όταν η σύνδεση είναι παράλογη (🔴), ζωγράφισε
    // κόκκινο schematic (outline + 30% fill) αντί WYSIWYG amber, μέσω του κοινού
    // `drawEntityStatusSchematic` SSoT (resolve-outline + guard + draw σε ΕΝΑ σημείο —
    // ADR-574 Σ2b· κοινό ΚΑΙ με τα direct-paint leaf hooks). Το `resolveStatusGhostOutline`
    // μέσα του καλύπτει column/beam (outline) · slab/slab-opening (polygon) · τοίχο (edges).
    const statusColor = bimMeta.ghostStatusColor;
    if (statusColor && drawEntityStatusSchematic(ctx, entity, statusColor, transform, viewport)) {
      return;
    }
    // ADR-363 §wall-joint-miter-preview («Επίπεδο 2») — LIVE join: draw the affected
    // existing walls with their NEW miter FIRST (underneath), so the active ghost paints
    // on top. Same real renderer as the ghost → WYSIWYG. Attached by `applyJointMiterPreview`.
    const jointNeighbors = (entity as { jointNeighbors?: readonly unknown[] }).jointNeighbors;
    if (jointNeighbors && jointNeighbors.length > 0) {
      for (const neighbor of jointNeighbors) {
        bimPreview.render(neighbor as unknown as Entity, transform, viewport);
      }
    }
    // ADR-398 — pass the canonical viewport (= prop viewport = DxfCanvas /
    // container rect) so the BIM ghost measures its y-flip against the SAME
    // viewport as the committed entity, not the PreviewCanvas's own rect.
    bimPreview.render(entity as unknown as Entity, transform, viewport);
    return;
  }

  // Colored preview grips override entity-renderer grips (ADR-142 icon click sequence)
  const entityMeta = entity as { previewGripPoints?: Array<PreviewGripPoint>; showPreviewGrips?: boolean };
  const coloredGrips = entityMeta.showPreviewGrips && entityMeta.previewGripPoints?.length
    ? entityMeta.previewGripPoints
    : null;

  // Setup context style
  ctx.strokeStyle = options.color;
  ctx.fillStyle = options.gripColor;
  ctx.lineWidth = options.lineWidth;
  ctx.globalAlpha = options.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(options.dashPattern.length > 0 ? options.dashPattern : []);

  // Suppress entity-level grips when colored grips handle rendering
  const renderOpts = coloredGrips ? { ...options, showGrips: false } : options;

  // Build helpers object for entity renderers
  const helpers: PreviewRenderHelpers = {
    viewport,
    renderGrip: (c, pos, o) => renderGrip(c, pos, o),
    renderDistanceLabelFromWorld: (c, w1, w2, s1, s2) => renderDistanceLabelFromWorld(c, w1, w2, s1, s2),
    renderInfoLabel: (c, pos, lines) => renderInfoLabel(c, pos, lines),
  };

  // Dispatch to entity renderer (per-type routing extracted, SRP).
  dispatchPreviewEntityRender(ctx, entity, transform, viewport, renderOpts, helpers, sceneUnits);

  // Render colored preview grips (FIRST=teal P1/cursor-start, SECOND=yellow intermediates, THIRD=red cursor)
  if (coloredGrips) {
    for (const grip of coloredGrips) {
      const screenPos = CoordinateTransforms.worldToScreen(grip.position, transform, viewport);
      renderGrip(ctx, screenPos, options, grip.color);
    }
  }

  // Reset context
  ctx.globalAlpha = OPACITY.OPAQUE;
  ctx.setLineDash([]);
}
