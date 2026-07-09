/**
 * ADR-612 — Opening Info Tag renderer (main 2D canvas).
 *
 * Draws a dedicated, non-BIM `OpeningInfoTagEntity` (a sibling of the ADR-583
 * Φ2 `ScaleBarEntity` in the generic scene array). Mirrors `ScaleBarRenderer`:
 * a pure leaf, no store subscriptions.
 *
 * Unlike the scale-bar, the tag lives ENTIRELY in world canonical-mm (no
 * annotative paper-mm folding, no drawing-scale term, no `setSceneUnits`) —
 * the whole box scales with the drawing at any zoom (Giorgio 2026-07-09,
 * `types/opening-info-tag.ts` §Sizing model).
 *
 * @see bim/opening-info-tag/opening-info-tag-primitives.ts — `buildOpeningInfoTagPrimitives` (layout SSoT)
 * @see bim/opening-info-tag/opening-info-tag-geometry.ts — `openingInfoTagFrameToWorld` (frame→world rotation)
 * @see rendering/entities/opening-info-tag/stamp-opening-info-tag-primitives.ts — canvas stamper (SRP split)
 * @see rendering/entities/ScaleBarRenderer.ts — the sibling this file mirrors
 * @see docs/centralized-systems/reference/adrs/ADR-612-opening-info-tag.md
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, Point2D, GripInfo, RenderOptions } from '../types/Types';
import type { Entity, OpeningInfoTagEntity } from '../../types/entities';
import { isOpeningInfoTagEntity } from '../../types/entities';
import { buildOpeningInfoTagPrimitives } from '../../bim/opening-info-tag/opening-info-tag-primitives';
import { openingInfoTagFrameToWorld } from '../../bim/opening-info-tag/opening-info-tag-geometry';
import { hitTestOpeningInfoTag } from '../../bim/opening-info-tag/opening-info-tag-hit';
import { stampOpeningInfoTagPrimitives } from './opening-info-tag/stamp-opening-info-tag-primitives';
import { getOpeningInfoTagGrips } from '../../bim/opening-info-tag/opening-info-tag-grips';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { toRenderGripInfo } from './shared/grip-utils';

/** Frame mapper: (along-width mm, along-height mm) → screen px. */
type FrameToScreen = (u: number, v: number) => Point2D;

export class OpeningInfoTagRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isOpeningInfoTagEntity(entity as Entity)) return;
    const e = entity as unknown as OpeningInfoTagEntity;
    this.renderWithPhases(entity, options, () => this.drawTag(e));
  }

  /** Draw the box outline + dividers + numerals (called inside `renderWithPhases`). */
  private drawTag(e: OpeningInfoTagEntity): void {
    // Frame-space layout SSoT (box outline + dividers + numerals) — the SAME
    // primitives the export decomposer consumes (N.18 anti-clone).
    const primitives = buildOpeningInfoTagPrimitives(e);

    const toScreen: FrameToScreen = (u, v) => this.worldToScreen(openingInfoTagFrameToWorld(e, u, v));

    // Solid fills reuse the phase-resolved stroke colour so hover/selection tints
    // the whole tag uniformly (setupStyle already set strokeStyle for the phase).
    const colour = this.ctx.strokeStyle as string;
    this.ctx.fillStyle = colour;

    stampOpeningInfoTagPrimitives({
      ctx: this.ctx,
      primitives,
      toScreen,
      transformScale: this.transform.scale,
      color: colour,
    });
  }

  // ── Interaction ──────────────────────────────────────────────────────────────

  /**
   * ADR-612 — paint the MOVE cross + ROTATION handle + SIZE handle, via the
   * SHARED `getOpeningInfoTagGrips` SSoT (the SAME producer interaction
   * consumes) → render ≡ interaction. Positions read from the DERIVED geometry.
   */
  getGrips(entity: EntityModel): GripInfo[] {
    if (!isOpeningInfoTagEntity(entity as Entity)) return [];
    const e = entity as unknown as OpeningInfoTagEntity;
    return getOpeningInfoTagGrips(e).map((g) =>
      toRenderGripInfo(g, gripGlyphShape(gripKindOf(g, 'opening-info-tag'))),
    );
  }

  /**
   * Precise pick: delegates to the `hitTestOpeningInfoTag` SSoT so the leaf
   * renderer, the spatial-index narrow phase (`performDetailedHitTest`) and
   * the broad-phase bounds all agree (N.18 anti-clone).
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isOpeningInfoTagEntity(entity as Entity)) return false;
    return hitTestOpeningInfoTag(entity as unknown as OpeningInfoTagEntity, point, tolerance);
  }
}
