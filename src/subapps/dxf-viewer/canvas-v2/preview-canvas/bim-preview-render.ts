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
import type { Entity, ViewTransform, Viewport } from '../../rendering/types/Types';
import { isBlockEntity } from '../../types/entities';
import { expandBlockInstance } from '../../systems/block/block-expander';

export class BimPreviewRenderer {
  private composite: EntityRendererComposite | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  /**
   * Render one synthetic BIM entity through the real renderer at full fidelity.
   * Lazily instantiates the composite on first use (bound to the preview ctx).
   *
   * ADR-398 — the ghost is painted on the shared PreviewCanvas, but its y-flip
   * MUST be measured against the SAME canonical `viewport` as the committed
   * entity (the DxfCanvas / container rect, identical to the column ghost path).
   * The real entity renderers default to their own `ctx.canvas` rect; here that
   * is the PreviewCanvas, whose `getBoundingClientRect()` diverges a few px from
   * the DxfCanvas (inline-style sizing) → a constant +Y offset. We inject the
   * canonical viewport for the duration of this single render, then clear it.
   */
  render(entity: Entity, transform: ViewTransform, viewport: Viewport): void {
    if (!this.composite) {
      this.composite = new EntityRendererComposite(this.ctx);
    }
    this.composite.setViewportOverride(viewport);
    this.composite.setTransform(transform);
    this.ctx.save();
    try {
      // ADR-652 M7 — WYSIWYG block ghost: το committed path κάνει expand ΠΡΙΝ το
      // conversion, οπότε ο composite/registry ΔΕΝ έχει renderer για 'block'. Στο
      // preview το ghost είναι BlockEntity (wysiwygPreview) → expand-άρουμε εδώ σε
      // world members (ίδιο placement transform με το committed) και ζωγραφίζουμε
      // τον καθένα μέσω των ΠΡΑΓΜΑΤΙΚΩΝ renderers, ίδιο transform/viewport/ctx.
      if (isBlockEntity(entity)) {
        for (const member of expandBlockInstance(entity)) {
          this.composite.render(member, {});
        }
      } else {
        this.composite.render(entity, {});
      }
    } finally {
      this.ctx.restore();
      this.composite.setViewportOverride(null);
    }
  }
}
