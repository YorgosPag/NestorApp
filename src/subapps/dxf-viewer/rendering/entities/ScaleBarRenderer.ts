/**
 * ADR-583 Φ2.1 — Graphic Scale-Bar renderer (main 2D canvas).
 *
 * Draws a dedicated, non-BIM `ScaleBarEntity` (a sibling of dimension / center-mark
 * in the generic scene array). Mirrors `DimensionRenderer` / `AnnotationSymbolRenderer`:
 * a pure leaf, no store subscriptions beyond the drawing-scale + scene-units the
 * composite injects per-frame.
 *
 * ## The two-formula split (ADR-583 Φ2 — THE correctness rule)
 * Two fundamentally different length spaces are kept apart here:
 *   1. **Axis length + division boundaries = REAL model distance**, taken straight
 *      from `computeScaleBarGeometry` (which routes the span through
 *      `realDistanceToModelMm`, a *scale-INVARIANT* canonical-mm value). These are
 *      world coordinates → `worldToScreen`. Zoom / plot scale never changes what the
 *      bar measures ("this bar IS 10 m").
 *   2. **Bar thickness + tick length + numeral height = ANNOTATIVE**, folded through
 *      `paperHeightToModel(paperMm, drawingScale, sceneUnits)` at draw time so they
 *      keep a constant printed size at any 1:N — exactly like dimension text/arrows.
 *
 * Styles: `alternating` (checker of filled / hollow major cells), `hollow` (outline
 * only), `line-ticks` (baseline + boundary ticks), `double` (two half-height rows,
 * checkerboarded). `subdivisions > 0` adds a fine-tick extension LEFT of the '0' tick.
 *
 * @see bim/geometry/scale-bar-geometry.ts — `computeScaleBarGeometry` (span SSoT)
 * @see utils/annotation-scale.ts — `paperHeightToModel` (annotative sizing SSoT)
 * @see bim/scale-bar/scale-bar-primitives.ts — `buildScaleBarPrimitives` (layout SSoT)
 * @see rendering/entities/scale-bar/stamp-scale-bar-primitives.ts — canvas stamper (SRP split)
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, Point2D, GripInfo, RenderOptions } from '../types/Types';
import type { Entity, ScaleBarEntity } from '../../types/entities';
import { isScaleBarEntity } from '../../types/entities';
import { buildScaleBarPrimitives } from '../../bim/scale-bar/scale-bar-primitives';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import type { SceneUnits } from '../../utils/scene-units';
import { hitTestScaleBarAxis } from '../../bim/scale-bar/scale-bar-hit';
import { stampScaleBarPrimitives } from './scale-bar/stamp-scale-bar-primitives';
import { getScaleBarGrips } from '../../bim/scale-bar/scale-bar-grips';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { toRenderGripInfo } from './shared/grip-utils';

/** World-frame offset mapper: (along-axis mm, perpendicular mm) → screen px. */
type FrameToScreen = (axisOffsetMm: number, perpOffsetMm: number) => Point2D;

export class ScaleBarRenderer extends BaseEntityRenderer {
  /**
   * ADR-583 — active scene unit system, injected per-frame by the composite
   * (mirror `DimensionRenderer.setSceneUnits`). Drives the paper-mm → model fold
   * for the annotative thickness / numeral height. Defaults to `'mm'` for partial
   * test setups (canonical-mm geometry).
   */
  private _sceneUnits: SceneUnits = 'mm';

  setSceneUnits(units: SceneUnits): void {
    this._sceneUnits = units;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isScaleBarEntity(entity as Entity)) return;
    const e = entity as unknown as ScaleBarEntity;
    this.renderWithPhases(entity, options, () => this.drawBar(e));
  }

  /** Draw the bar body + subdivisions + numerals (called inside `renderWithPhases`). */
  private drawBar(e: ScaleBarEntity): void {
    const drawingScale = useDrawingScaleStore.getState().drawingScale;
    // Frame-space layout SSoT (body cells + ticks + numerals) — the SAME primitives
    // the export decomposer (`annotation-to-primitives`) consumes (N.18 anti-clone).
    const primitives = buildScaleBarPrimitives(e, drawingScale, this._sceneUnits);

    // World frame: axis = angleRad, perpendicular = +90° CCW. worldToScreen owns the
    // Y-flip so `perp > 0` is drawn ABOVE the baseline on screen.
    const cos = Math.cos(e.angleRad);
    const sin = Math.sin(e.angleRad);
    const toScreen: FrameToScreen = (s, t) =>
      this.worldToScreen({
        x: e.position.x + s * cos - t * sin,
        y: e.position.y + s * sin + t * cos,
      });

    // Solid fills reuse the phase-resolved stroke colour so hover/selection tints
    // the whole bar uniformly (setupStyle already set strokeStyle for the phase).
    const colour = this.ctx.strokeStyle as string;
    this.ctx.fillStyle = colour;

    stampScaleBarPrimitives({
      ctx: this.ctx,
      primitives,
      toScreen,
      transformScale: this.transform.scale,
      color: colour,
    });
  }

  // ── Interaction ──────────────────────────────────────────────────────────────

  /**
   * ADR-583 Φ2.4 — paint the MOVE cross + ROTATION handle + LENGTH handle, via the
   * SHARED `getScaleBarGrips` SSoT (the SAME `computeDxfEntityGrips` / GRIP_PRODUCERS
   * ['scale-bar'] consume for interaction) → render ≡ interaction. The midpoint → 4-arrow
   * MOVE glyph, the rotation handle → curved ROTATION glyph via `gripGlyphShape`; the
   * length handle → default square. Positions read from the DERIVED geometry.
   */
  getGrips(entity: EntityModel): GripInfo[] {
    if (!isScaleBarEntity(entity as Entity)) return [];
    const e = entity as unknown as ScaleBarEntity;
    return getScaleBarGrips(e).map((g) =>
      toRenderGripInfo(g, gripGlyphShape(gripKindOf(g, 'scale-bar'))),
    );
  }

  /**
   * Precise pick: distance from the click to the bar AXIS segment (position →
   * derived endPosition), gated by the live annotative half-thickness + tolerance.
   * All world-space (broad-phase already filtered by entity-bounds). Delegates to the
   * `hitTestScaleBarAxis` SSoT so the leaf renderer, the spatial-index narrow phase
   * (`performDetailedHitTest`) and the broad-phase bounds all agree (N.18 anti-clone).
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isScaleBarEntity(entity as Entity)) return false;
    return hitTestScaleBarAxis(entity as unknown as ScaleBarEntity, point, tolerance, this._sceneUnits);
  }
}
