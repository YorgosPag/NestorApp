/**
 * BimFootprintRenderer — shared base for BIM plan renderers whose footprint is a
 * closed polygon (Column / Slab / …).
 *
 * Owns the screen-space polygon trace + hover-halo glow that each such renderer
 * otherwise inlined identically (N.18). Keeps the generic `BaseEntityRenderer`
 * free of BIM-specific painters; concrete renderers extend THIS instead.
 */
import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import { tracePolygonScreenPath, paintPolygonHoverHalo } from './bim-polygon-render';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import { applyLiveStroke } from './shared/live-stroke';
import type { EntityModel, RenderOptions } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { PhaseRenderingState } from '../../systems/phase-manager/types';

export abstract class BimFootprintRenderer extends BaseEntityRenderer {
  /** Trace a closed footprint polygon in screen space (beginPath..closePath, no paint). */
  protected drawPolygonPath(vertices: ReadonlyArray<{ x: number; y: number }>): void {
    tracePolygonScreenPath(this.ctx, (p) => this.worldToScreen(p), vertices);
  }

  /**
   * Shared render preamble for a phased footprint body (N.18): resolve the phase,
   * paint the hover halo, apply the phase style, then `save()` + clear the dash.
   * Returns the phase state for the few renderers that branch on it afterwards.
   */
  protected beginPhasedBodyRender(
    entity: EntityModel,
    vertices: ReadonlyArray<{ x: number; y: number }>,
    options: RenderOptions,
  ): PhaseRenderingState {
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);
    this.paintHoverHalo(vertices, phaseState.phase === 'highlighted');
    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();
    this.ctx.setLineDash([]);
    return phaseState;
  }

  /**
   * Closing half of {@link beginPhasedBodyRender}: `restore()` the state it saved, then run
   * the shared post-render pass (grips etc.). For bodies with nothing to draw after the restore.
   */
  protected endPhasedBodyRender(entity: EntityModel, options: RenderOptions): void {
    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  /**
   * ADR-909 Γ2.3 — fill the footprint + stroke its outline, for a body whose colour belongs to
   * the SYSTEM or the equipment (MEP), not to an Object-Styles category (N.18).
   *
   * Screen ⇒ `fillTint` through the shared adaptive body-fill layer, `strokeColor` / `widthPx`
   * verbatim. Print pass ⇒ the print policy decides ink + width ({@link applyLiveStroke}).
   * The stroke state it sets is left in place on purpose: symbol strokes drawn right after
   * inherit the same pen (and `dash`, when given — clear it before solid sub-strokes).
   */
  protected paintLiveBody(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    fillTint: string,
    strokeColor: string,
    widthPx: number,
    dash?: readonly number[],
  ): void {
    this.ctx.fillStyle = adaptFillTintForCanvas(fillTint);
    this.drawPolygonPath(vertices);
    this.ctx.fill();
    applyLiveStroke(this.ctx, strokeColor, widthPx);
    if (dash) this.ctx.setLineDash([...dash]);
    this.drawPolygonPath(vertices);
    this.ctx.stroke();
  }

  /** Hover-halo glow outline around the footprint; no-op unless `highlighted`. */
  protected paintHoverHalo(vertices: ReadonlyArray<{ x: number; y: number }>, highlighted: boolean): void {
    paintPolygonHoverHalo(this.ctx, (p) => this.worldToScreen(p), vertices, highlighted);
  }
}
