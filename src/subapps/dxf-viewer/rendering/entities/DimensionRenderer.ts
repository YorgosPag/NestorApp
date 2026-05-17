/**
 * ADR-362 Phase C1 — Persistent dimension renderer (main canvas).
 *
 * Pure leaf — consumes the `DimGeometry` discriminated union from Phase B and
 * draws: extension lines, dim line(s) / arc / leader polyline, two arrowheads
 * (per DIMSTYLE block lookup), and the primary text. ADR-040 micro-leaf
 * compliant — no store subscriptions, no scene reads beyond the entity model.
 *
 * Geometry + resolved DIMSTYLE + lookup-map (for baseline/continued parent
 * resolution) are pre-computed by the caller (`DxfRenderer.toEntityModel`)
 * and forwarded via `EntityRendererComposite.setDimensionLookup()` once per
 * frame. The renderer never instantiates the registry or scans the scene
 * itself — keeps it deterministic + cheap to test.
 *
 * Out of scope for Phase C1 (reserved hooks in code):
 *   - Center mark (Phase L1)
 *   - DIMBREAK / DIMSPACE gaps (Phase K)
 *   - Tolerance / limits / alt-unit stacking (Phase G2/G3)
 *   - Snap + grips (Phase I)
 *   - Associativity observers (Phase J)
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import type { Entity } from '../../types/entities';
import {
  isDimensionEntity,
  type DimensionEntity,
  type DimStyle,
} from '../../types/entities';
import {
  buildDimensionGeometry,
  type DimensionLookup,
  type DimGeometry,
  type DimLineSegment,
  type LinearDimGeometry,
  type AngularDimGeometry,
  type RadialDimGeometry,
} from '../../systems/dimensions/dim-geometry-builder';
import {
  resolveDimStyle,
} from '../../systems/dimensions/dim-style-resolver';
import {
  getDimStyleRegistry,
  type DimStyleRegistry,
} from '../../systems/dimensions/dim-style-registry';
import { getArrowheadBlock } from '../../systems/dimensions/dim-arrowhead-blocks';
import { renderArrowhead } from './dimension/dim-arrowhead-renderer';
import { renderDimensionText } from './dimension/dim-text-renderer';
import { resolveDimColor } from './dimension/dim-color-resolver';
import { CoordinateTransforms } from '../core/CoordinateTransforms';

/**
 * Paper-mm → pixel scale at the current view.
 * AutoCAD DIMSCALE is unit-less; we map 1 mm-paper to 1 world-mm (project
 * convention) and multiply by view scale to land in screen pixels.
 */
function paperMmToPx(mm: number, scale: number): number {
  return mm * scale;
}

interface ResolvedDimensionRender {
  readonly entity: DimensionEntity;
  readonly style: DimStyle;
  readonly geometry: DimGeometry;
}

export class DimensionRenderer extends BaseEntityRenderer {
  private dimensionLookup: DimensionLookup = () => undefined;
  private styleRegistry: DimStyleRegistry = getDimStyleRegistry();
  private layerColour: string | undefined;

  /**
   * Inject the per-frame parent lookup (built once by `DxfRenderer.render()`
   * from `scene.entities` filtered by `type === 'dimension'`). Defaults to a
   * no-op callback so unit tests can render non-chained dims without setup.
   */
  setDimensionLookup(lookup: DimensionLookup): void {
    this.dimensionLookup = lookup;
  }

  /** Test seam — replace the registry (default: session singleton). */
  setStyleRegistry(registry: DimStyleRegistry): void {
    this.styleRegistry = registry;
  }

  /** Optional layer-colour pass-through for ByLayer/ByBlock DIMSTYLE resolution. */
  setLayerColour(colour: string | undefined): void {
    this.layerColour = colour;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    const resolved = this.resolveFromEntity(entity);
    if (!resolved) return;

    this.ctx.save();
    this.drawExtensionLines(resolved);
    this.drawDimLineOrArc(resolved);
    this.drawArrowheads(resolved);
    this.drawPrimaryText(resolved, options);
    this.ctx.restore();
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // Phase I delivers grip set. Phase C1 emits none.
    return [];
  }

  hitTest(_entity: EntityModel, _point: Point2D, _tolerance: number): boolean {
    // Phase I delivers proper hit testing (geometry-aware). Phase C1 returns false
    // to keep the entity selectable only via dedicated dim hit paths (none yet).
    return false;
  }

  // ── Resolution ───────────────────────────────────────────────────────────

  private resolveFromEntity(entity: EntityModel): ResolvedDimensionRender | null {
    const e = entity as Entity;
    if (!isDimensionEntity(e)) return null;
    const dim = e as DimensionEntity;
    const style = resolveDimStyle(dim, this.styleRegistry);
    let geometry: DimGeometry;
    try {
      geometry = buildDimensionGeometry(dim, style, this.dimensionLookup);
    } catch {
      // Builder throws on malformed input (e.g. baseline parent missing).
      // Phase C1 swallows + returns null so a single broken dim doesn't crash
      // the whole scene render. Diagnostics ride on the existing logger pipe.
      return null;
    }
    return { entity: dim, style, geometry };
  }

  // ── Geometry pieces ──────────────────────────────────────────────────────

  private drawExtensionLines(r: ResolvedDimensionRender): void {
    const ext1 = readExtLine(r.geometry, 1);
    const ext2 = readExtLine(r.geometry, 2);
    if (!ext1 && !ext2) return;
    this.applyLineStyle(r.style.dimclre, r.style.suppressExtLine1 || r.style.suppressExtLine2);
    if (ext1 && !r.style.suppressExtLine1) this.strokeSegment(ext1);
    if (ext2 && !r.style.suppressExtLine2) this.strokeSegment(ext2);
  }

  private drawDimLineOrArc(r: ResolvedDimensionRender): void {
    this.applyLineStyle(r.style.dimclrd, false);
    switch (r.geometry.kind) {
      case 'linear':
        if (!r.style.suppressDimLine1 && !r.style.suppressDimLine2) {
          this.strokeSegment(r.geometry.dimLine);
        }
        return;
      case 'angular':
        this.strokeArc(r.geometry);
        return;
      case 'radial':
        this.strokeLeader(r.geometry);
        return;
      default: {
        const _exhaustive: never = r.geometry;
        throw new Error(`[DimensionRenderer] Unknown geometry kind: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  private drawArrowheads(r: ResolvedDimensionRender): void {
    const block1Name = r.style.dimblk1 || r.style.dimblk;
    const block2Name = r.style.dimblk2 || r.style.dimblk;
    const block1 = getArrowheadBlock(block1Name);
    const block2 = getArrowheadBlock(block2Name);
    const unitPx = paperMmToPx(r.style.dimasz * r.style.dimscale, this.transform.scale);
    const colour = resolveDimColor(r.style.dimclrd, this.layerColour);
    const screenA1 = this.toScreen(r.geometry.arrowAnchor1);
    const screenA2 = this.toScreen(r.geometry.arrowAnchor2);

    renderArrowhead(this.ctx, block1, {
      screenAnchor: screenA1,
      direction: r.geometry.arrowDirection1,
      side: 1,
      unitPx,
      strokeColor: colour,
      fillColor: colour,
    });
    renderArrowhead(this.ctx, block2, {
      screenAnchor: screenA2,
      direction: r.geometry.arrowDirection2,
      side: 2,
      unitPx,
      strokeColor: colour,
      fillColor: colour,
    });
  }

  private drawPrimaryText(r: ResolvedDimensionRender, _options: RenderOptions): void {
    renderDimensionText(this.ctx, {
      entity: r.entity,
      geometry: r.geometry,
      style: r.style,
      transform: this.transform,
      viewport: { width: this.ctx.canvas.width, height: this.ctx.canvas.height },
      layerColour: this.layerColour,
    });
  }

  // ── Canvas helpers ───────────────────────────────────────────────────────

  private applyLineStyle(aci: number, _suppressed: boolean): void {
    this.ctx.strokeStyle = resolveDimColor(aci, this.layerColour);
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([]);
    this.ctx.lineCap = 'butt';
  }

  private strokeSegment(seg: DimLineSegment): void {
    const a = this.toScreen(seg.start);
    const b = this.toScreen(seg.end);
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
  }

  private strokeArc(geom: AngularDimGeometry): void {
    const centre = this.toScreen(geom.arcCenter);
    const radiusPx = geom.arcRadius * this.transform.scale;
    // Canvas Y is flipped vs world — negate angles so arc sweeps the right way.
    const start = -geom.arcStartAngle;
    const end = -geom.arcEndAngle;
    const sweepCcw = geom.arcEndAngle - geom.arcStartAngle;
    // Canvas `arc(..., counterclockwise)` interprets CCW in screen space — flip
    // the boolean because Y-down inverts orientation.
    const counterclockwise = sweepCcw > 0;
    this.ctx.beginPath();
    this.ctx.arc(centre.x, centre.y, radiusPx, start, end, counterclockwise);
    this.ctx.stroke();
  }

  private strokeLeader(geom: RadialDimGeometry): void {
    if (geom.leaderPath.length < 2) return;
    this.ctx.beginPath();
    const first = this.toScreen(geom.leaderPath[0]);
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < geom.leaderPath.length; i++) {
      const p = this.toScreen(geom.leaderPath[i]);
      this.ctx.lineTo(p.x, p.y);
    }
    this.ctx.stroke();
  }

  private toScreen(p: Point2D): Point2D {
    return CoordinateTransforms.worldToScreen(p, this.transform, {
      width: this.ctx.canvas.width,
      height: this.ctx.canvas.height,
    });
  }
}

// ── Geometry accessors (kept module-private — exhaustive on `kind`) ─────────

function readExtLine(geom: DimGeometry, side: 1 | 2): DimLineSegment | null {
  if (geom.kind === 'linear' || geom.kind === 'angular') {
    return side === 1 ? geom.extLine1 : geom.extLine2;
  }
  return null;
}
