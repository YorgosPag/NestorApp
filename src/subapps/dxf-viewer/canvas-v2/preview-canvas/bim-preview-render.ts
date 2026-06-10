/**
 * SSOT — bim-preview-render
 *
 * WYSIWYG placement preview: renders a synthetic BIM entity (wall / foundation /
 * …) onto the dedicated PreviewCanvas 2D context using the SAME real entity
 * renderers as the committed scene (`EntityRendererComposite`). The placement
 * rubber-band is therefore byte-identical to the final element — category fill,
 * material hatch, lineweight, dashed hidden-line, centerline — instead of the
 * legacy schematic green outline.
 *
 * The composite is created lazily (once) and bound to the preview ctx. Each
 * frame: push the live transform, then save/restore around the single-entity
 * render so the renderer's style mutations (fillStyle / lineDash / globalAlpha)
 * never leak into the preview-canvas state across frames.
 *
 * Entity-type-agnostic: any preview helper that returns a full BIM entity
 * (`.params` + `.geometry`) and flags it `wysiwygPreview` lights up automatically
 * (wall + foundation today; column / beam / … extend with zero changes here).
 *
 * @see PreviewRenderer — dispatches here when `entity.wysiwygPreview` is set
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { EntityRendererComposite } from '../../rendering/core/EntityRendererComposite';
import type { Entity, ViewTransform } from '../../rendering/types/Types';

export class BimPreviewRenderer {
  private composite: EntityRendererComposite | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  /**
   * Render one synthetic BIM entity through the real renderer at full fidelity.
   * Lazily instantiates the composite on first use (bound to the preview ctx).
   */
  render(entity: Entity, transform: ViewTransform): void {
    if (!this.composite) {
      this.composite = new EntityRendererComposite(this.ctx);
    }
    this.composite.setTransform(transform);
    this.ctx.save();
    this.composite.render(entity, {});
    this.ctx.restore();
  }
}
