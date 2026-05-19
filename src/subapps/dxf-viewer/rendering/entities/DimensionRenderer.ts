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
import {
  computeAutoBreaks,
  type DimBreakResult,
} from '../../systems/dimensions/dim-break-engine';
import {
  computeCenterMarkGeometry,
} from '../../systems/dimensions/center-mark-builder';
import { renderCenterMark } from '../../systems/dimensions/center-mark-renderer';
// ADR-362 Phase I3 hotfix (2026-05-19) — shared dim-line + text anchor geometry.
import { computeDimHitGeometry } from '../../systems/dimensions/dim-hit-geometry';
import { pointToLineDistance } from './shared/geometry-utils';
import { calculateDistance } from './shared/geometry-rendering-utils';

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
  /** All non-dimension scene entities for auto DIMBREAK intersection detection (Phase K1). */
  private sceneEntities: readonly Entity[] = [];
  /** Canvas background for DIMTFILL='backgroundColor' mask (Phase K3). */
  private canvasBackground: string | undefined;

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

  /**
   * Inject scene entities for auto DIMBREAK intersection detection (Phase K1).
   * Called once per frame by the orchestrating renderer before drawing dims.
   * Typically all non-dimension entities so break gaps appear at crossings.
   */
  setSceneEntities(entities: readonly Entity[]): void {
    this.sceneEntities = entities;
  }

  /** Canvas background for DIMTFILL 'backgroundColor' mask (Phase K3). */
  setCanvasBackground(bg: string): void {
    this.canvasBackground = bg;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    const resolved = this.resolveFromEntity(entity);
    if (!resolved) return;

    // [DIM-DIAG R3] TEMPORARY — log defPoints + canvas + transform + screen coords.
    {
      const g = resolved.geometry as {
        kind: string;
        dimLine?: { start: { x: number; y: number }; end: { x: number; y: number } };
        textAnchor?: { x: number; y: number };
      };
      const cvw = this.ctx.canvas.width;
      const cvh = this.ctx.canvas.height;
      const tr = this.transform;
      const ent = resolved.entity;
      const rot = 'rotation' in ent ? (ent as { rotation: number }).rotation : 'n/a';
      const defPointsStr = ent.defPoints.map((p) => `(${p.x.toFixed(2)},${p.y.toFixed(2)})`).join(' | ');
      const dl = g.dimLine;
      const dlStr = dl
        ? `(${dl.start.x.toFixed(2)},${dl.start.y.toFixed(2)} → ${dl.end.x.toFixed(2)},${dl.end.y.toFixed(2)})`
        : 'n/a';
      // Screen-space projection of dimLine + textAnchor.
      let dlScreenStr = 'n/a';
      let txtScreenStr = 'n/a';
      if (dl) {
        const a = this.toScreen(dl.start);
        const b = this.toScreen(dl.end);
        dlScreenStr = `(${a.x.toFixed(1)},${a.y.toFixed(1)} → ${b.x.toFixed(1)},${b.y.toFixed(1)})`;
      }
      if (g.textAnchor) {
        const t = this.toScreen(g.textAnchor);
        txtScreenStr = `world=(${g.textAnchor.x.toFixed(2)},${g.textAnchor.y.toFixed(2)}) screen=(${t.x.toFixed(1)},${t.y.toFixed(1)})`;
      }
      // eslint-disable-next-line no-console
      console.warn(
        `[DIM-DIAG R3] render id=${ent.id} type=${ent.dimensionType} ` +
          `defPoints=[${defPointsStr}] rotation=${rot} ` +
          `dimLineWorld=${dlStr} dimLineScreen=${dlScreenStr} ` +
          `textAnchor=${txtScreenStr} ` +
          `canvas=(${cvw}x${cvh}) transform=(scale=${tr.scale.toFixed(3)},offsetX=${tr.offsetX.toFixed(2)},offsetY=${tr.offsetY.toFixed(2)}) ` +
          `dimscale=${resolved.style.dimscale} dimtxt=${resolved.style.dimtxt} dimtad=${resolved.style.dimtad ?? 'n/a'}`,
      );
    }

    const breaks = this.sceneEntities.length > 0
      ? computeAutoBreaks(resolved.geometry, this.sceneEntities, resolved.style)
      : undefined;

    this.ctx.save();
    this.drawExtensionLines(resolved, breaks);
    this.drawDimLineOrArc(resolved, breaks);
    this.drawArrowheads(resolved);
    this.drawCenterMark(resolved);
    this.drawPrimaryText(resolved, options);
    this.ctx.restore();
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // Phase I delivers grip set. Phase C1 emits none.
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    // ADR-362 Phase I3 hotfix (2026-05-19) — linear/aligned use computed foot
    // points (shared SSoT in dim-hit-geometry.ts) so a click near the rendered
    // dim line or text anchor selects the entity. Radial/angular/ordinate keep
    // a defPoints-proximity fallback until per-variant geometry lands. The
    // canonical hit path still runs through `performDetailedHitTest` in the
    // HitTester; this renderer-level method is the leaf bypass used by
    // canvas-v2 paths that hit-test directly against renderers.
    const e = entity as Entity;
    if (!isDimensionEntity(e)) return false;
    const dim = e as DimensionEntity;
    const pts = dim.defPoints;
    if (!pts || pts.length === 0) return false;

    const hitGeom = computeDimHitGeometry(dim);
    if (hitGeom) {
      if (calculateDistance(point, hitGeom.textAnchor) <= tolerance * 1.5) return true;
      if (pointToLineDistance(point, hitGeom.footStart, hitGeom.footEnd) <= tolerance) return true;
      if (pointToLineDistance(point, pts[0], hitGeom.footStart) <= tolerance) return true;
      if (pointToLineDistance(point, pts[1], hitGeom.footEnd) <= tolerance) return true;
    }
    for (const pt of pts) {
      if (calculateDistance(point, pt) <= tolerance) return true;
    }
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

  private drawExtensionLines(r: ResolvedDimensionRender, breaks?: DimBreakResult): void {
    const ext1 = readExtLine(r.geometry, 1);
    const ext2 = readExtLine(r.geometry, 2);
    if (!ext1 && !ext2) return;
    this.applyLineStyle(r.style.dimclre, false);
    if (ext1 && !r.style.suppressExtLine1) {
      const segs = breaks?.extLine1Segments ?? [ext1];
      for (const s of segs) this.strokeSegment(s);
    }
    if (ext2 && !r.style.suppressExtLine2) {
      const segs = breaks?.extLine2Segments ?? [ext2];
      for (const s of segs) this.strokeSegment(s);
    }
  }

  private drawDimLineOrArc(r: ResolvedDimensionRender, breaks?: DimBreakResult): void {
    this.applyLineStyle(r.style.dimclrd, false);
    switch (r.geometry.kind) {
      case 'linear':
        if (!r.style.suppressDimLine1 && !r.style.suppressDimLine2) {
          const segs = breaks?.dimLineSegments ?? [r.geometry.dimLine];
          for (const s of segs) this.strokeSegment(s);
        }
        return;
      case 'angular':
        this.strokeArc(r.geometry);
        return;
      case 'radial': {
        const leaderSegs = breaks?.leaderSegments;
        if (leaderSegs) {
          for (const s of leaderSegs) this.strokeSegment(s);
        } else {
          this.strokeLeader(r.geometry);
        }
        return;
      }
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
      canvasBackground: this.canvasBackground,
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

  private drawCenterMark(r: ResolvedDimensionRender): void {
    if (r.geometry.kind !== 'radial') return;
    const { centerMarkExtent, centerPoint, measurementValue } = r.geometry;
    if (!centerMarkExtent || !centerPoint || centerMarkExtent === 0) return;
    const geom = computeCenterMarkGeometry(
      centerPoint,
      measurementValue,
      centerMarkExtent,
      r.style.dimscale,
    );
    renderCenterMark(this.ctx, geom, r.style.dimclrd, this.transform, this.layerColour);
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
    // [DIM-DIAG R3] log canvas vs rect mismatch — DPR scaling bug suspect.
    const rect = this.ctx.canvas.getBoundingClientRect();
    const cvw = this.ctx.canvas.width;
    const cvh = this.ctx.canvas.height;
    if (Math.abs(rect.width - cvw) > 1 || Math.abs(rect.height - cvh) > 1) {
      const g = (globalThis as { __dimCanvasMismatchLogged?: boolean });
      if (!g.__dimCanvasMismatchLogged) {
        g.__dimCanvasMismatchLogged = true;
        // eslint-disable-next-line no-console
        console.warn(
          `[DIM-DIAG R3] CANVAS_VS_RECT_MISMATCH ctx.canvas=(${cvw}x${cvh}) rect=(${rect.width.toFixed(1)}x${rect.height.toFixed(1)}) ratioW=${(cvw / rect.width).toFixed(2)} ratioH=${(cvh / rect.height).toFixed(2)} ` +
            `devicePixelRatio=${typeof window !== 'undefined' ? window.devicePixelRatio : 'n/a'}`,
        );
      }
    }
    return CoordinateTransforms.worldToScreen(p, this.transform, {
      width: cvw,
      height: cvh,
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
