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
// ADR-362 Round 5 — scene-units awareness so paper-mm DIMSTYLE values
// (dimtxt, dimasz, dimgap, dimexe, dimexo) convert to world units before the
// view-scale multiplier. Without this, meters/cm scenes draw dims at the
// world-unit size of the paper-mm number (e.g. 2.5 m text in a meters DXF).
import { type SceneUnits } from '../../utils/scene-units';
import { type LineweightMm } from '../../types/entities';
// ADR-562 Φ2 — per-part lineweight + linetype → canvas stroke via the shared SSoT
// (reuses lineweightToPx + ADR-510 Unified Linetype dash catalog).
import { resolveDimStroke } from './dimension/dim-stroke-resolver';
import {
  type DimensionLookup,
  type DimLineSegment,
  type AngularDimGeometry,
  type RadialDimGeometry,
} from '../../systems/dimensions/dim-geometry-builder';
import { paperHeightToModel } from '../../utils/annotation-scale';
import {
  getDimStyleRegistry,
  type DimStyleRegistry,
} from '../../systems/dimensions/dim-style-registry';
import { getArrowheadBlock } from '../../systems/dimensions/dim-arrowhead-blocks';
import { renderArrowhead } from './dimension/dim-arrowhead-renderer';
import { renderDimensionText } from './dimension/dim-text-renderer';
import { addPoints, scalePoint } from './shared/geometry-vector-utils';
import { resolveDimColor } from './dimension/dim-color-resolver';
import { CoordinateTransforms } from '../core/CoordinateTransforms';
import {
  computeManualBreaks,
  type DimBreakResult,
} from '../../systems/dimensions/dim-break-engine';
import {
  computeCenterMarkGeometry,
} from '../../systems/dimensions/center-mark-builder';
import { renderCenterMark } from '../../systems/dimensions/center-mark-renderer';
// SRP split (ADR-362) — pure `this`-free logic (resolution, grips, hit-test,
// geometry-offset scaling, text-fit) lives in the support module so this file
// stays under the 500-line limit + focused on canvas drawing.
import {
  computeDimensionGrips,
  dimensionEntityHitTest,
  resolveDimensionRender,
  computeDimFitForRender,
  readExtLine,
  type ResolvedDimensionRender,
  type DimFitRender,
} from './dimension/dimension-renderer-support';
import { HOVER_HIGHLIGHT } from '../../config/color-config';

export class DimensionRenderer extends BaseEntityRenderer {
  private dimensionLookup: DimensionLookup = () => undefined;
  private styleRegistry: DimStyleRegistry = getDimStyleRegistry();
  private layerColour: string | undefined;
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
    const resolved = resolveDimensionRender(entity, this.styleRegistry, this.sceneUnits, this.dimensionLookup);
    if (!resolved) return;

    // ADR-362 Phase K — DIMBREAK reads the entity's persisted `manualBreaks`
    // (computed ONCE by the DIMBREAK command from crossing entities, not per
    // frame). The renderer just applies the `breakGap` around each stored point.
    const breaks = resolved.entity.manualBreaks
      ? computeManualBreaks(resolved.geometry, resolved.entity.manualBreaks, resolved.geoStyle)
      : undefined;

    // ADR-362 Phase M — decide text-fit ONCE (needs the render-time measured text
    // width) so the glow pass, arrows, dim line/arc, text + leader all agree.
    const lf = computeDimFitForRender(this.ctx, this.transform, this.sceneUnits, this.layerColour, resolved);

    // Glow pre-pass — SSoT: same HOVER_HIGHLIGHT.ENTITY config as BaseEntityRenderer
    if (this._isHovered) {
      this._inGlowPass = true;
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
      this.drawExtensionLines(resolved, breaks);
      this.drawDimLineOrArc(resolved, breaks, lf);
      this.drawArrowheads(resolved, lf);
      this.ctx.restore();
      this._inGlowPass = false;
    }

    this.ctx.save();
    this.drawExtensionLines(resolved, breaks);
    this.drawDimLineOrArc(resolved, breaks, lf);
    this.drawArrowheads(resolved, lf);
    this.drawCenterMark(resolved);
    this.drawFitLeader(resolved, lf);
    this.drawPrimaryText(resolved, options, lf);
    this.ctx.restore();

    if (options.grips) {
      this.renderGrips(entity, options);
    }
  }

  getGrips(entity: EntityModel): GripInfo[] {
    return computeDimensionGrips(entity);
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    return dimensionEntityHitTest(entity, point, tolerance);
  }

  // ── Geometry pieces ──────────────────────────────────────────────────────

  private drawExtensionLines(r: ResolvedDimensionRender, breaks?: DimBreakResult): void {
    const ext1 = readExtLine(r.geometry, 1);
    const ext2 = readExtLine(r.geometry, 2);
    if (!ext1 && !ext2) return;
    // Extension lines share one stroke setup (unified per-part granularity):
    // dimlwe + dimltex1 (dimltex1===dimltex2 while the UI sets both together).
    this.applyLineStyle(r.style.dimclre, r.style.dimlwe, r.style.dimltex1);
    if (ext1 && !r.style.suppressExtLine1) {
      const segs = breaks?.extLine1Segments ?? [ext1];
      for (const s of segs) this.strokeSegment(s);
    }
    if (ext2 && !r.style.suppressExtLine2) {
      const segs = breaks?.extLine2Segments ?? [ext2];
      for (const s of segs) this.strokeSegment(s);
    }
  }

  private drawDimLineOrArc(
    r: ResolvedDimensionRender,
    breaks?: DimBreakResult,
    lf?: DimFitRender | null,
  ): void {
    this.applyLineStyle(r.style.dimclrd, r.style.dimlwd, r.style.dimltype);
    switch (r.geometry.kind) {
      case 'linear':
        if (!r.style.suppressDimLine1 && !r.style.suppressDimLine2) {
          // ADR-362 Phase M — suppress the inside dim line only when BOTH text and
          // arrows go outside and DIMTOFL is off (else draw it as before).
          if (!lf || lf.fit.drawDimLineInside) {
            const segs = breaks?.dimLineSegments ?? [r.geometry.dimLine];
            for (const s of segs) this.strokeSegment(s);
          }
          // Outside stubs give the flipped arrowheads a line to rest on.
          if (lf?.fit.arrowsOutside) {
            const g = r.geometry;
            this.drawOutsideStubs(
              g.dimLine.start, g.arrowDirection1,
              g.dimLine.end, g.arrowDirection2,
              lf.arrowSize,
            );
          }
        }
        return;
      case 'angular':
        // Angular arc is always drawn (it IS the dimension); when arrows flip
        // outside, add tangent stubs at the arc ends for them to rest on.
        this.strokeArc(r.geometry);
        if (lf?.fit.arrowsOutside) {
          const g = r.geometry;
          this.drawOutsideStubs(
            g.arrowAnchor1, g.arrowDirection1,
            g.arrowAnchor2, g.arrowDirection2,
            lf.arrowSize,
          );
        }
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

  private drawArrowheads(r: ResolvedDimensionRender, lf?: DimFitRender | null): void {
    const block1Name = r.style.dimblk1 || r.style.dimblk;
    const block2Name = r.style.dimblk2 || r.style.dimblk;
    const block1 = getArrowheadBlock(block1Name);
    const block2 = getArrowheadBlock(block2Name);
    // Arrowhead unit length: paper dimasz → model (× dimscale × mmToSceneUnits via
    // the annotation-scale SSoT) → screen px (× view scale).
    const unitPx =
      paperHeightToModel(r.style.dimasz, r.style.dimscale, this.sceneUnits) * this.transform.scale;
    // ADR-562 Φ2 — arrows use the separate arrowColor channel when set, else
    // inherit the dim-line color (`arrowColor ?? dimclrd`, exceeds AutoCAD).
    const colour = resolveDimColor(r.style.arrowColor ?? r.style.dimclrd, this.layerColour);
    const screenA1 = this.toScreen(r.geometry.arrowAnchor1);
    const screenA2 = this.toScreen(r.geometry.arrowAnchor2);
    // ADR-362 Phase M — when DIMATFIT moves arrows outside, the placement flips the
    // outward directions so the heads sit outside the ext lines pointing inward.
    const dir1 = lf?.placement.arrowDirection1 ?? r.geometry.arrowDirection1;
    const dir2 = lf?.placement.arrowDirection2 ?? r.geometry.arrowDirection2;

    renderArrowhead(this.ctx, block1, {
      screenAnchor: screenA1,
      direction: dir1,
      side: 1,
      unitPx,
      strokeColor: colour,
      fillColor: colour,
    });
    renderArrowhead(this.ctx, block2, {
      screenAnchor: screenA2,
      direction: dir2,
      side: 2,
      unitPx,
      strokeColor: colour,
      fillColor: colour,
    });
  }

  /**
   * ADR-362 Phase M — short stubs extending OUTWARD from each arrow anchor when
   * the arrows are flipped outside, so each flipped arrowhead has a line to rest
   * on (AutoCAD-faithful). Length = 2× arrow size along the geometry's outward
   * direction (linear: along the dim line past each foot; angular: tangent past
   * each arc end).
   */
  private drawOutsideStubs(
    anchor1: Point2D,
    dir1: Point2D,
    anchor2: Point2D,
    dir2: Point2D,
    arrowSize: number,
  ): void {
    const len = 2 * arrowSize;
    this.strokeSegment({ start: anchor1, end: addPoints(anchor1, scalePoint(dir1, len)) });
    this.strokeSegment({ start: anchor2, end: addPoints(anchor2, scalePoint(dir2, len)) });
  }

  /**
   * ADR-362 Phase M — leader connecting the moved-out text back to the dim line
   * (DIMTMOVE=1). Uses the same dim-line stroke SSoT (`applyLineStyle`); the path
   * is a dogleg to the text near edge + a shelf under the text.
   */
  private drawFitLeader(r: ResolvedDimensionRender, lf?: DimFitRender | null): void {
    const path = lf?.placement.leaderPath;
    if (!path || path.length < 2) return;
    this.applyLineStyle(r.style.dimclrd, r.style.dimlwd, r.style.dimltype);
    for (let i = 1; i < path.length; i++) {
      this.strokeSegment({ start: path[i - 1], end: path[i] });
    }
  }

  private drawPrimaryText(
    r: ResolvedDimensionRender,
    _options: RenderOptions,
    lf?: DimFitRender | null,
  ): void {
    // ADR-362 hotfix Round 4 (2026-05-19) — use CSS viewport (getBoundingClientRect)
    // not backing-store. See `toScreen` for the full reasoning. Without this fix,
    // dim text lands at the wrong screen Y under non-100% browser zoom / HiDPI
    // (visible as "dim text jumps to top of canvas").
    const rect = this.ctx.canvas.getBoundingClientRect();
    // ADR-362 Phase M — when DIMATFIT moves the text outside, draw it at the
    // placement anchor (beyond the second foot) instead of the span midpoint.
    const textAnchorOverride =
      lf && lf.fit.textOutside ? lf.placement.textAnchor : undefined;
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
      textAnchorOverride,
    });
  }

  // ── Canvas helpers ───────────────────────────────────────────────────────

  private applyLineStyle(aci: number, lineweight: LineweightMm, linetype: string): void {
    // ADR-562 Φ2 — resolved per-part width + dash (was hardcoded 1px solid).
    const stroke = resolveDimStroke(lineweight, linetype, this.transform.scale);
    if (this._inGlowPass) {
      // Hover halo: keep the wider stroke but a CONTINUOUS line (a dashed halo
      // reads as broken) — unchanged from the pre-ADR-562 glow behaviour.
      this.ctx.lineWidth = stroke.lineWidthPx + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
      this.ctx.setLineDash([]);
    } else {
      this.ctx.strokeStyle = resolveDimColor(aci, this.layerColour);
      this.ctx.lineWidth = stroke.lineWidthPx;
      this.ctx.setLineDash(stroke.dashPx);
    }
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
