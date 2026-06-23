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
// ADR-362 Round 5 — scene-units awareness so paper-mm DIMSTYLE values
// (dimtxt, dimasz, dimgap, dimexe, dimexo) convert to world units before the
// view-scale multiplier. Without this, meters/cm scenes draw dims at the
// world-unit size of the paper-mm number (e.g. 2.5 m text in a meters DXF).
import { type SceneUnits } from '../../utils/scene-units';
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
import { paperHeightToModel, resolveEffectiveDimscale } from '../../utils/annotation-scale';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
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
import { HOVER_HIGHLIGHT } from '../../config/color-config';

/**
 * Paper-mm → pixel scale at the current view.
 *
 * AutoCAD DIMSCALE is unit-less; DIMSTYLE values (dimasz/dimtxt/dimgap/...) are
 * paper-mm by convention. To land in screen pixels we:
 *
 *   1. Convert paper-mm → world units of the active scene via `mmToSceneUnits`.
 *      For a mm-scene this is the identity (×1); for a meters scene it is
 *      ×0.001 — i.e. 2.5 paper-mm becomes 0.0025 world-meters.
 *   2. Multiply by the view scale (px / world-unit) to reach screen pixels.
 *
 * Without step 1 a 2.5 mm DIMTXT in a meters DXF would render as 2.5 m worth
 * of pixels (huge — the "ribbon dim larger than native DXF" bug, ADR-362
 * Round 5).
 */
interface ResolvedDimensionRender {
  readonly entity: DimensionEntity;
  readonly style: DimStyle;
  /** Style with paper-mm geometry offsets pre-scaled to world units (used by
   *  break engine + geometry builder). Rendering fields (dimasz, dimtxt) are
   *  NOT scaled here — those renderers apply dimscale×unitFactor themselves. */
  readonly geoStyle: DimStyle;
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
   * ADR-362 Round 5 — active scene unit system (defaults to `'mm'` for back-compat
   * with legacy mm-baked DXFs + unit tests that never seed it). Updated per-frame
   * by `setSceneUnits()` via the composite orchestrator.
   */
  private sceneUnits: SceneUnits = 'mm';
  private _isHovered = false;
  private _inGlowPass = false;

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

  /**
   * ADR-362 Round 5 — set the active scene unit system. Drives paper-mm →
   * world-unit conversion via the annotation-scale SSoT (`paperHeightToModel`)
   * in geometry offsets / arrowheads / `dim-text-renderer`. Default = `'mm'`.
   */
  setSceneUnits(units: SceneUnits): void {
    this.sceneUnits = units;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    this._isHovered = options.hovered ?? false;
    const resolved = this.resolveFromEntity(entity);
    if (!resolved) return;

    const breaks = this.sceneEntities.length > 0
      ? computeAutoBreaks(resolved.geometry, this.sceneEntities, resolved.geoStyle)
      : undefined;

    // Glow pre-pass — SSoT: same HOVER_HIGHLIGHT.ENTITY config as BaseEntityRenderer
    if (this._isHovered) {
      this._inGlowPass = true;
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
      this.drawExtensionLines(resolved, breaks);
      this.drawDimLineOrArc(resolved, breaks);
      this.drawArrowheads(resolved);
      this.ctx.restore();
      this._inGlowPass = false;
    }

    this.ctx.save();
    this.drawExtensionLines(resolved, breaks);
    this.drawDimLineOrArc(resolved, breaks);
    this.drawArrowheads(resolved);
    this.drawCenterMark(resolved);
    this.drawPrimaryText(resolved, options);
    this.ctx.restore();

    if (options.grips) {
      this.renderGrips(entity, options);
    }
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isDimensionEntity(entity)) return [];
    const pts = entity.defPoints;
    const grips: GripInfo[] = [];
    if (pts.length >= 1) {
      grips.push({ id: `${entity.id}-0`, entityId: entity.id, gripIndex: 0, type: 'vertex', position: pts[0], isVisible: true });
    }
    if (pts.length >= 2) {
      grips.push({ id: `${entity.id}-1`, entityId: entity.id, gripIndex: 1, type: 'vertex', position: pts[1], isVisible: true });
    }
    if (pts.length >= 3) {
      grips.push({ id: `${entity.id}-2`, entityId: entity.id, gripIndex: 2, type: 'midpoint', position: pts[2], isVisible: true });
    }
    const textPos = entity.textMidpoint ?? (pts.length >= 3 ? pts[2] : null);
    if (textPos) {
      grips.push({ id: `${entity.id}-3`, entityId: entity.id, gripIndex: 3, type: 'center', position: textPos, isVisible: true });
    }
    return grips;
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
    const rawStyle = resolveDimStyle(dim, this.styleRegistry);
    // ADR-344 Round 7 / ADR-362 Round 14 — resolve the effective annotation scale
    // ONCE here (imported DIMSCALE>1 wins, else the `drawingScale` SSoT, ADR-375).
    // Every downstream consumer (extension/dim-line offsets, arrowheads, text,
    // center mark) reads `style.dimscale`, so healing it at the single resolution
    // point fixes the whole dimension uniformly — no per-renderer heuristics. This
    // replaces the old metre-only rescue that left mm/cm dimensions microscopic.
    const drawingScale = useDrawingScaleStore.getState().drawingScale;
    const style: DimStyle = {
      ...rawStyle,
      dimscale: resolveEffectiveDimscale(rawStyle.dimscale, drawingScale),
    };
    // ADR-362 R8 — paper-mm geometry offsets must be in world units before the
    // geometry builder uses them as coordinate deltas. DIMASZ / DIMTXT are NOT
    // scaled here because their renderers (drawArrowheads / dim-text-renderer)
    // apply dimscale × mmToSceneUnits themselves.
    const geoStyle = this.scaleGeometryOffsets(style);
    let geometry: DimGeometry;
    try {
      geometry = buildDimensionGeometry(dim, geoStyle, this.dimensionLookup);
    } catch {
      // Builder throws on malformed input (e.g. baseline parent missing).
      // Phase C1 swallows + returns null so a single broken dim doesn't crash
      // the whole scene render. Diagnostics ride on the existing logger pipe.
      return null;
    }
    return { entity: dim, style, geoStyle, geometry };
  }

  /** Scale paper-mm geometry offset fields to world units for the geometry builder
   *  and break engine, via the annotation-scale SSoT (paper × dimscale ×
   *  mmToSceneUnits). `style.dimscale` is already the effective value. */
  private scaleGeometryOffsets(style: DimStyle): DimStyle {
    const toModel = (paperMm: number) =>
      paperHeightToModel(paperMm, style.dimscale, this.sceneUnits);
    return {
      ...style,
      dimexo: toModel(style.dimexo),
      dimexe: toModel(style.dimexe),
      dimdli: toModel(style.dimdli),
      dimcen: toModel(style.dimcen),
      breakGap: toModel(style.breakGap),
    };
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
    // Arrowhead unit length: paper dimasz → model (× dimscale × mmToSceneUnits via
    // the annotation-scale SSoT) → screen px (× view scale).
    const unitPx =
      paperHeightToModel(r.style.dimasz, r.style.dimscale, this.sceneUnits) * this.transform.scale;
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
    // ADR-362 hotfix Round 4 (2026-05-19) — use CSS viewport (getBoundingClientRect)
    // not backing-store. See `toScreen` for the full reasoning. Without this fix,
    // dim text lands at the wrong screen Y under non-100% browser zoom / HiDPI
    // (visible as "dim text jumps to top of canvas").
    const rect = this.ctx.canvas.getBoundingClientRect();
    renderDimensionText(this.ctx, {
      entity: r.entity,
      geometry: r.geometry,
      style: r.style,
      transform: this.transform,
      viewport: {
        width: rect.width || this.ctx.canvas.width,
        height: rect.height || this.ctx.canvas.height,
      },
      layerColour: this.layerColour,
      canvasBackground: this.canvasBackground,
      sceneUnits: this.sceneUnits,
      hovered: this._isHovered,
    });
  }

  // ── Canvas helpers ───────────────────────────────────────────────────────

  private applyLineStyle(aci: number, _suppressed: boolean): void {
    if (!this._inGlowPass) this.ctx.strokeStyle = resolveDimColor(aci, this.layerColour);
    this.ctx.lineWidth = this._inGlowPass ? 1 + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth : 1;
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
    // ADR-362 hotfix Round 4 (2026-05-19) — use CSS viewport (getBoundingClientRect)
    // not backing-store (ctx.canvas.width/height). With DPR ≠ 1 (e.g., browser zoom
    // ≠ 100% or HiDPI display) the two differ, and all other entity renderers go
    // through BaseEntityRenderer.getViewport() which uses CSS pixels. Mixing CSS
    // pixels for clicks (mouse-handler-up uses getBoundingClientRect snapshot) with
    // backing-store pixels here makes dim line + text land at the wrong Y at render
    // time — root cause of "dim jumps up" under non-100% browser zoom.
    const rect = this.ctx.canvas.getBoundingClientRect();
    return CoordinateTransforms.worldToScreen(p, this.transform, {
      width: rect.width || this.ctx.canvas.width,
      height: rect.height || this.ctx.canvas.height,
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
