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
 * @see rendering/entities/scale-bar/draw-scale-bar-labels.ts — numeral drawing (SRP split)
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, Point2D, GripInfo, RenderOptions } from '../types/Types';
import type { Entity, ScaleBarEntity } from '../../types/entities';
import {
  isScaleBarEntity,
  DEFAULT_SCALE_BAR_HEIGHT_MM,
  DEFAULT_SCALE_BAR_LABEL_MM,
} from '../../types/entities';
import type { ScaleBarGeometry } from '../../types/scale-bar';
import { computeScaleBarGeometry } from '../../bim/geometry/scale-bar-geometry';
import { paperHeightToModel } from '../../utils/annotation-scale';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import type { SceneUnits } from '../../utils/scene-units';
import { pointToSegmentDistance } from '../../systems/guides/guide-types';
import { drawScaleBarLabels } from './scale-bar/draw-scale-bar-labels';
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
    const geo = computeScaleBarGeometry(e, drawingScale, this._sceneUnits);

    // Annotative sizes (paper mm → model) — constant printed size at any 1:N.
    const thicknessMm = paperHeightToModel(
      e.barHeightMm ?? DEFAULT_SCALE_BAR_HEIGHT_MM, drawingScale, this._sceneUnits,
    );
    const labelHeightMm = paperHeightToModel(
      e.labelHeightMm ?? DEFAULT_SCALE_BAR_LABEL_MM, drawingScale, this._sceneUnits,
    );

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

    this.drawBody(e.style, geo.divisionBoundariesMm, thicknessMm, toScreen);
    this.drawSubdivisions(geo.subdivisionOffsetsMm, thicknessMm, toScreen);

    // Numerals: 'below' → opposite side of the band; 'above' → past the band top.
    const gap = thicknessMm * 0.3;
    const labelPerpMm =
      e.labelPlacement === 'above'
        ? thicknessMm + gap + labelHeightMm / 2
        : -(gap + labelHeightMm / 2);
    drawScaleBarLabels({
      ctx: this.ctx,
      geometry: geo,
      toScreen,
      fontPx: labelHeightMm * this.transform.scale,
      labelPerpMm,
      unitGapMm: labelHeightMm,
      color: colour,
    });
  }

  // ── Body styles ────────────────────────────────────────────────────────────

  private drawBody(
    style: ScaleBarEntity['style'],
    boundaries: readonly number[],
    thickness: number,
    toScreen: FrameToScreen,
  ): void {
    switch (style) {
      case 'line-ticks':
        this.drawLineTicks(boundaries, thickness, toScreen);
        return;
      case 'double':
        this.drawDoubleRow(boundaries, thickness, toScreen);
        return;
      case 'hollow':
        this.forEachCell(boundaries, (a, b) => this.cell(a, b, 0, thickness, false, toScreen));
        return;
      case 'alternating':
      default:
        // Outline every cell; fill the even (0,2,4,…) ones → classic checker.
        this.forEachCell(boundaries, (a, b, i) => {
          this.cell(a, b, 0, thickness, i % 2 === 0, toScreen);
        });
        return;
    }
  }

  /** Baseline segment + a vertical tick at each major boundary (t: 0 → thickness). */
  private drawLineTicks(
    boundaries: readonly number[],
    thickness: number,
    toScreen: FrameToScreen,
  ): void {
    if (boundaries.length === 0) return;
    const ctx = this.ctx;
    const first = toScreen(boundaries[0], 0);
    const last = toScreen(boundaries[boundaries.length - 1], 0);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    ctx.lineTo(last.x, last.y);
    for (const s of boundaries) {
      const base = toScreen(s, 0);
      const top = toScreen(s, thickness);
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
    }
    ctx.stroke();
  }

  /** Two half-height rows, checkerboarded (top fills even cells, bottom fills odd). */
  private drawDoubleRow(
    boundaries: readonly number[],
    thickness: number,
    toScreen: FrameToScreen,
  ): void {
    const mid = thickness / 2;
    this.forEachCell(boundaries, (a, b, i) => {
      this.cell(a, b, mid, thickness, i % 2 === 0, toScreen);
      this.cell(a, b, 0, mid, i % 2 === 1, toScreen);
    });
  }

  /** Fine sub-tick cells inside the left extension, alternating fill (LEFT of '0'). */
  private drawSubdivisions(
    offsets: readonly number[],
    thickness: number,
    toScreen: FrameToScreen,
  ): void {
    let prev = 0;
    offsets.forEach((off, k) => {
      // Offsets are positive magnitudes measured LEFT of the origin → negate along axis.
      this.cell(-prev, -off, 0, thickness, k % 2 === 0, toScreen);
      prev = off;
    });
  }

  // ── Canvas helpers ───────────────────────────────────────────────────────────

  /** Iterate adjacent boundary pairs as (axisStart, axisEnd, index) cells. */
  private forEachCell(
    boundaries: readonly number[],
    fn: (axisStart: number, axisEnd: number, index: number) => void,
  ): void {
    for (let i = 0; i < boundaries.length - 1; i++) fn(boundaries[i], boundaries[i + 1], i);
  }

  /** Stroke (and optionally fill) one rectangular cell in the bar's world frame. */
  private cell(
    axisStart: number,
    axisEnd: number,
    perpLo: number,
    perpHi: number,
    fill: boolean,
    toScreen: FrameToScreen,
  ): void {
    const ctx = this.ctx;
    const p1 = toScreen(axisStart, perpLo);
    const p2 = toScreen(axisEnd, perpLo);
    const p3 = toScreen(axisEnd, perpHi);
    const p4 = toScreen(axisStart, perpHi);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    if (fill) ctx.fill();
    ctx.stroke();
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
   * All world-space (broad-phase already filtered by entity-bounds).
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isScaleBarEntity(entity as Entity)) return false;
    const e = entity as unknown as ScaleBarEntity;
    const drawingScale = useDrawingScaleStore.getState().drawingScale;
    const geo: ScaleBarGeometry = computeScaleBarGeometry(e, drawingScale, this._sceneUnits);
    const thickness = paperHeightToModel(
      e.barHeightMm ?? DEFAULT_SCALE_BAR_HEIGHT_MM, drawingScale, this._sceneUnits,
    );
    const band = thickness / 2 + tolerance;
    return pointToSegmentDistance(point, e.position, geo.endPosition) <= band;
  }
}
