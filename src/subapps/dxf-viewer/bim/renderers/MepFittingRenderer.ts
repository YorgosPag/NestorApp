/**
 * MepFittingRenderer — ADR-408 Φ11 (auto pipe fittings).
 *
 * 2D plan-view renderer for `MepFittingEntity`. A fitting is a point-based MEP
 * element materialised at a junction of two or more pipe segments (Revit "Pipe
 * Fitting"; IFC `IfcPipeFitting`). It is the point-based counterpart of the
 * linear `mep-segment` (ADR-408 Φ8) and mirrors that renderer's structure:
 * unified visibility gate, hover halo, translucent footprint fill, dashed
 * outline, then a per-kind plan glyph drawn from the incident directions.
 *
 * The glyph is the topology signature of the junction, oriented by
 * `params.incidents[].directionUnit` and sized by the incident diameters:
 *   - `'elbow'`            → quarter-bend arc between the two angled directions.
 *   - `'coupling'`/`'reducer'` → short sleeve straddling the two collinear dirs.
 *   - `'tee'`              → a T (three radial stubs).
 *   - `'cross'`            → a + (four radial stubs).
 *   - `'cap'`              → a closed circle (dead end).
 *
 * Glyph stub lengths are SCREEN-space (fixed pixel length, zoom- and
 * scene-unit-independent) — exactly like the pipe midpoint tick in
 * `mep-segment-symbol.ts`. A world-unit length cannot stay legible across mm /
 * metre scenes; a fixed pixel length is correct at every zoom and `sceneUnits`.
 *
 * Palette mirrors the segment's pipe convention (copper / amber). When the
 * fitting derives a system colour later (Φ9/Φ10), the same override pattern as
 * the segment renderer applies; this foundation slice paints the domain default.
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions to
 * high-frequency stores. State read synchronously via
 * `useDrawingScaleStore.getState()`.
 *
 * @see ./MepSegmentRenderer.ts (the linear-element template)
 * @see ../mep-segments/mep-segment-symbol.ts (the screen-space tick model)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type {
  MepFittingEntity,
  MepFittingDomain,
  MepFittingIncident,
} from '../types/mep-fitting-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';

// ─── Palette ────────────────────────────────────────────────────────────────────

/**
 * Stroke colour per domain. Mirrors the segment palette so a fitting reads as
 * the same network as the pipes it joins (copper/amber for plumbing; reserved
 * steel/slate for duct).
 */
const DOMAIN_STROKE: Readonly<Record<MepFittingDomain, string>> = {
  'pipe': '#b45309',
  'duct': '#64748b',
};

/** Translucent footprint fill per domain (~15% opacity — segment mirror). */
const DOMAIN_FILL: Readonly<Record<MepFittingDomain, string>> = {
  'pipe': 'rgba(180, 83, 9, 0.15)',
  'duct': 'rgba(100, 116, 139, 0.15)',
};

/** Dash pattern for the plan outline (dashed = above cut plane, segment mirror). */
const OUTLINE_DASH: readonly [number, number] = [8, 4];

// Glyph metrics are expressed as MULTIPLES of the pipe radius (world-space,
// resolved to screen px at draw time via `pipeRadiusPx`), so a fitting glyph
// grows/shrinks with the pipe cross-section — and with zoom — exactly like real
// geometry. A small screen-px floor keeps a thin pipe legible at low zoom.

/** Minimum on-screen pipe-radius unit (px) — legibility floor at far zoom. */
const MIN_PIPE_RADIUS_PX = 3;

/** Radial stub half-length as a multiple of the pipe radius (tee/cross/elbow). */
const GLYPH_STUB_FACTOR = 2;

/** Cap dead-end circle radius as a multiple of the pipe radius. */
const CAP_RADIUS_FACTOR = 1;

/** Coupling/reducer sleeve half-length (along axis) as a multiple of pipe radius. */
const SLEEVE_HALF_FACTOR = 1.8;

/** Coupling/reducer sleeve half-width (across axis) as a multiple of pipe radius. */
const SLEEVE_WIDTH_FACTOR = 1;

/** Elbow quarter-bend arc radius as a multiple of the pipe radius. */
const ELBOW_ARC_FACTOR = 1.3;

// ─── Type guard (local — main agent adds to entities.ts union) ───────────────────

function isMepFittingEntity(entity: EntityModel): entity is MepFittingEntity {
  return entity.type === 'mep-fitting';
}

// ─── Renderer ────────────────────────────────────────────────────────────────────

export class MepFittingRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepFittingEntity(entity)) return;
    const fitting = entity as MepFittingEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). BimCategory determined by domain (mirror segment renderer):
    //   'pipe' → 'plumbing' discipline; 'duct' → 'mechanical' discipline.
    const layer = fitting.layerId ? getLayer(fitting.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: fitting.params.domain, layerId: fitting.layerId, discipline: fitting.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

    if (!fitting.geometry || !fitting.params) return;
    const verts = fitting.geometry.footprint.vertices;
    const domain = fitting.params.domain;
    const strokeColor = DOMAIN_STROKE[domain];
    const fillColor = DOMAIN_FILL[domain];

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo via outline thicker glow (mirror segment / fixture renderer).
    if (phaseState.phase === 'highlighted' && verts.length >= 3) {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawPolygonPath(verts);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();

    // 1. Translucent footprint fill — communicates the node extent in plan.
    if (verts.length >= 3) {
      this.ctx.fillStyle = fillColor;
      this.drawPolygonPath(verts);
      this.ctx.fill();

      // 2. Dashed outline (linear-run-above-cut-plane convention, segment mirror).
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
      this.ctx.setLineDash(OUTLINE_DASH as unknown as number[]);
      this.drawPolygonPath(verts);
      this.ctx.stroke();
    }

    // 3. Per-kind plan glyph — the junction topology signature, screen-space so
    //    it stays legible at every zoom and in every scene-unit system.
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.fillStyle = strokeColor;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawKindGlyph(fitting);

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // Φ11 foundation: fittings are auto-derived (read-only); no editable grips.
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepFittingEntity(entity)) return false;
    const fitting = entity as MepFittingEntity;
    const bb = fitting.geometry?.bbox;
    if (!bb) return false;
    // Bbox quick-reject with tolerance (mirror segment renderer).
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    const verts = fitting.geometry.footprint.vertices;
    if (verts.length < 3) return true; // glyph-only fitting → bbox is the target.
    return pointInPolygon(point, verts);
  }

  // ─── Glyph dispatch ────────────────────────────────────────────────────────────

  /**
   * Draw the per-kind plan glyph at the node centre, oriented by the incident
   * directions and SIZED to the pipe cross-section: `pipeRadiusPx` converts the
   * fitting's nominal radius (world) to screen px, so the glyph scales with both
   * the pipe diameter and the zoom (a fat pipe → a fat fitting), with a small
   * floor for legibility at far zoom.
   */
  private drawKindGlyph(fitting: MepFittingEntity): void {
    const center = this.worldToScreen({
      x: fitting.params.position.x,
      y: fitting.params.position.y,
    });
    const incidents = fitting.params.incidents;
    const unitPx = this.pipeRadiusPx(fitting);

    switch (fitting.params.kind) {
      case 'cap':
        this.drawCapGlyph(center, unitPx);
        return;
      case 'coupling':
      case 'reducer':
        this.drawSleeveGlyph(center, incidents, unitPx);
        return;
      case 'elbow':
        this.drawElbowGlyph(center, incidents, unitPx);
        return;
      case 'tee':
      case 'cross':
        this.drawRadialGlyph(center, incidents, unitPx);
        return;
      default:
        return;
    }
  }

  /**
   * Screen-px length of the fitting's nominal pipe RADIUS. Derived from the
   * world-space radius (`primaryDiameterMm/2` → canvas units via `mmToSceneUnits`)
   * measured through `worldToScreen`, so it tracks diameter AND zoom. Floored at
   * `MIN_PIPE_RADIUS_PX` so a thin pipe stays visible when zoomed far out.
   */
  private pipeRadiusPx(fitting: MepFittingEntity): number {
    const s = mmToSceneUnits(fitting.params.sceneUnits ?? 'mm');
    const radiusWorld = (fitting.params.primaryDiameterMm * s) / 2;
    const o = this.worldToScreen({ x: fitting.params.position.x, y: fitting.params.position.y });
    const t = this.worldToScreen({ x: fitting.params.position.x + radiusWorld, y: fitting.params.position.y });
    const px = Math.hypot(t.x - o.x, t.y - o.y);
    return Math.max(px, MIN_PIPE_RADIUS_PX);
  }

  // ─── Glyph primitives (all sizes = unitPx × factor) ──────────────────────────

  /** Cap — a closed circle (pipe-bore sized) at the dead end. */
  private drawCapGlyph(center: Point2D, unitPx: number): void {
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, unitPx * CAP_RADIUS_FACTOR, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  /**
   * Tee / cross — one radial stub per incident, pointing along its (screen)
   * direction. A simple "T" or "+" signature whose arm count IS the topology.
   */
  private drawRadialGlyph(center: Point2D, incidents: readonly MepFittingIncident[], unitPx: number): void {
    const stub = unitPx * GLYPH_STUB_FACTOR;
    for (const incident of incidents) {
      const dir = this.screenDirection(incident.directionUnit);
      if (!dir) continue;
      this.ctx.beginPath();
      this.ctx.moveTo(center.x, center.y);
      this.ctx.lineTo(center.x + dir.x * stub, center.y + dir.y * stub);
      this.ctx.stroke();
    }
  }

  /**
   * Elbow — a real pipe bend: a fillet arc TANGENT to both legs that rounds the
   * corner (concave toward the bend), not an arc centred on the node. The fillet
   * centre sits on the inner bisector at `r / sin(½θ)`; the arc runs between the
   * two tangent points (each `r / tan(½θ)` along its leg). Short stubs join the
   * node to those tangent points. Falls back to two stubs if a direction is
   * degenerate or the legs are collinear (a straight pass-through, no bend).
   */
  private drawElbowGlyph(center: Point2D, incidents: readonly MepFittingIncident[], unitPx: number): void {
    const dirs = incidents
      .map((i) => this.screenDirection(i.directionUnit))
      .filter((d): d is Point2D => d !== null);
    if (dirs.length < 2) {
      this.drawRadialGlyph(center, incidents, unitPx);
      return;
    }

    // Inner bisector of the two outward legs + half-angle (|dA| = |dB| = 1, so
    // |dA + dB| = 2·cos(½θ)).
    const sx = dirs[0].x + dirs[1].x;
    const sy = dirs[0].y + dirs[1].y;
    const blen = Math.hypot(sx, sy);
    const arcR = unitPx * ELBOW_ARC_FACTOR;
    const cosHalf = blen / 2;
    const sinHalf = Math.sqrt(Math.max(0, 1 - cosHalf * cosHalf));
    // Collinear legs (straight run) → no bend; just two stubs.
    if (blen < 1e-6 || sinHalf < 1e-6) {
      this.drawRadialGlyph(center, incidents, unitPx);
      return;
    }
    const bis = { x: sx / blen, y: sy / blen };
    const tangentLen = arcR * (cosHalf / sinHalf); // r / tan(½θ)
    const tA = { x: center.x + dirs[0].x * tangentLen, y: center.y + dirs[0].y * tangentLen };
    const tB = { x: center.x + dirs[1].x * tangentLen, y: center.y + dirs[1].y * tangentLen };

    // Stubs: node → each tangent point (so the leg meets the fillet cleanly).
    this.strokeSegment(center, tA);
    this.strokeSegment(center, tB);

    // Fillet centre on the inner bisector; minor arc between the tangent points.
    const cx = center.x + bis.x * (arcR / sinHalf);
    const cy = center.y + bis.y * (arcR / sinHalf);
    const angA = Math.atan2(tA.y - cy, tA.x - cx);
    const angB = Math.atan2(tB.y - cy, tB.x - cx);
    let delta = angB - angA;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, arcR, angA, angB, delta < 0);
    this.ctx.stroke();
  }

  /**
   * Coupling / reducer — a short rectangular sleeve straddling the two collinear
   * incident directions. The sleeve axis follows the first incident direction;
   * the cross-bars mark the inline join. Sized to the pipe radius.
   */
  private drawSleeveGlyph(center: Point2D, incidents: readonly MepFittingIncident[], unitPx: number): void {
    const axis = incidents.length > 0 ? this.screenDirection(incidents[0].directionUnit) : null;
    if (!axis) {
      this.drawCapGlyph(center, unitPx);
      return;
    }
    // Perpendicular unit (screen-space) for the sleeve width.
    const px = -axis.y;
    const py = axis.x;
    const halfLen = unitPx * SLEEVE_HALF_FACTOR;
    const halfWid = unitPx * SLEEVE_WIDTH_FACTOR;

    const ax = center.x + axis.x * halfLen;
    const ay = center.y + axis.y * halfLen;
    const bx = center.x - axis.x * halfLen;
    const by = center.y - axis.y * halfLen;

    // Two long edges (the sleeve walls).
    this.strokeSegment(
      { x: ax + px * halfWid, y: ay + py * halfWid },
      { x: bx + px * halfWid, y: by + py * halfWid },
    );
    this.strokeSegment(
      { x: ax - px * halfWid, y: ay - py * halfWid },
      { x: bx - px * halfWid, y: by - py * halfWid },
    );
    // Two end caps (the join faces).
    this.strokeSegment(
      { x: ax + px * halfWid, y: ay + py * halfWid },
      { x: ax - px * halfWid, y: ay - py * halfWid },
    );
    this.strokeSegment(
      { x: bx + px * halfWid, y: by + py * halfWid },
      { x: bx - px * halfWid, y: by - py * halfWid },
    );
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Convert a world-space incident direction unit vector to a screen-space unit
   * vector. Computes the direction from two `worldToScreen` points (rather than
   * negating Y) so any axis flip / transform handling is respected — same
   * approach as the segment pipe-tick. Returns `null` for a degenerate vector.
   */
  private screenDirection(dir: { x: number; y: number }): Point2D | null {
    const origin = this.worldToScreen({ x: 0, y: 0 });
    const tip = this.worldToScreen({ x: dir.x, y: dir.y });
    const dx = tip.x - origin.x;
    const dy = tip.y - origin.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return null;
    return { x: dx / len, y: dy / len };
  }

  private strokeSegment(a: Point2D, b: Point2D): void {
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
  }

  private drawPolygonPath(vertices: ReadonlyArray<{ x: number; y: number }>): void {
    if (vertices.length < 3) return;
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: vertices[0].x, y: vertices[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = this.worldToScreen({ x: vertices[i].x, y: vertices[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
  }
}
