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

  /** Hover-halo glow outline around the footprint; no-op unless `highlighted`. */
  protected paintHoverHalo(vertices: ReadonlyArray<{ x: number; y: number }>, highlighted: boolean): void {
    paintPolygonHoverHalo(this.ctx, (p) => this.worldToScreen(p), vertices, highlighted);
  }
}
