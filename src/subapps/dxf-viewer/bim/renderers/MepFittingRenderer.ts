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

/** Screen-space radial stub half-length (px) for tee/cross/elbow glyphs. */
const GLYPH_STUB_PX = 11;

/** Screen-space radius (px) of the cap dead-end circle. */
const CAP_RADIUS_PX = 6;

/** Screen-space half-length (px) of a coupling/reducer sleeve along its axis. */
const SLEEVE_HALF_PX = 10;

/** Screen-space half-width (px) of a coupling/reducer sleeve across its axis. */
const SLEEVE_WIDTH_PX = 5;

/** Screen-space radius (px) of the elbow quarter-bend arc. */
const ELBOW_ARC_PX = 10;

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
   * directions. All glyph metrics are screen-space (fixed pixels).
   */
  private drawKindGlyph(fitting: MepFittingEntity): void {
    const center = this.worldToScreen({
      x: fitting.params.position.x,
      y: fitting.params.position.y,
    });
    const incidents = fitting.params.incidents;

    switch (fitting.params.kind) {
      case 'cap':
        this.drawCapGlyph(center);
        return;
      case 'coupling':
      case 'reducer':
        this.drawSleeveGlyph(center, incidents);
        return;
      case 'elbow':
        this.drawElbowGlyph(center, incidents);
        return;
      case 'tee':
      case 'cross':
        this.drawRadialGlyph(center, incidents);
        return;
      default:
        return;
    }
  }

  // ─── Glyph primitives ────────────────────────────────────────────────────────

  /** Cap — a small closed circle at the dead end. */
  private drawCapGlyph(center: Point2D): void {
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, CAP_RADIUS_PX, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  /**
   * Tee / cross — one radial stub per incident, pointing along its (screen)
   * direction. A simple "T" or "+" signature whose arm count IS the topology.
   */
  private drawRadialGlyph(center: Point2D, incidents: readonly MepFittingIncident[]): void {
    for (const incident of incidents) {
      const dir = this.screenDirection(incident.directionUnit);
      if (!dir) continue;
      this.ctx.beginPath();
      this.ctx.moveTo(center.x, center.y);
      this.ctx.lineTo(center.x + dir.x * GLYPH_STUB_PX, center.y + dir.y * GLYPH_STUB_PX);
      this.ctx.stroke();
    }
  }

  /**
   * Elbow — a quarter-bend: two short stubs along the incident directions joined
   * by an arc. Falls back to two stubs if either direction is degenerate.
   */
  private drawElbowGlyph(center: Point2D, incidents: readonly MepFittingIncident[]): void {
    const dirs = incidents
      .map((i) => this.screenDirection(i.directionUnit))
      .filter((d): d is Point2D => d !== null);
    if (dirs.length < 2) {
      this.drawRadialGlyph(center, incidents);
      return;
    }

    // Two stubs along each leg.
    for (const dir of dirs) {
      this.ctx.beginPath();
      this.ctx.moveTo(center.x, center.y);
      this.ctx.lineTo(center.x + dir.x * GLYPH_STUB_PX, center.y + dir.y * GLYPH_STUB_PX);
      this.ctx.stroke();
    }

    // Sweep an arc between the two leg angles (the bend signature).
    const a0 = Math.atan2(dirs[0].y, dirs[0].x);
    const a1 = Math.atan2(dirs[1].y, dirs[1].x);
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, ELBOW_ARC_PX, a0, a1);
    this.ctx.stroke();
  }

  /**
   * Coupling / reducer — a short rectangular sleeve straddling the two collinear
   * incident directions. The sleeve axis follows the first incident direction;
   * the cross-bars mark the inline join.
   */
  private drawSleeveGlyph(center: Point2D, incidents: readonly MepFittingIncident[]): void {
    const axis = incidents.length > 0 ? this.screenDirection(incidents[0].directionUnit) : null;
    if (!axis) {
      this.drawCapGlyph(center);
      return;
    }
    // Perpendicular unit (screen-space) for the sleeve width.
    const px = -axis.y;
    const py = axis.x;

    const ax = center.x + axis.x * SLEEVE_HALF_PX;
    const ay = center.y + axis.y * SLEEVE_HALF_PX;
    const bx = center.x - axis.x * SLEEVE_HALF_PX;
    const by = center.y - axis.y * SLEEVE_HALF_PX;

    // Two long edges (the sleeve walls).
    this.strokeSegment(
      { x: ax + px * SLEEVE_WIDTH_PX, y: ay + py * SLEEVE_WIDTH_PX },
      { x: bx + px * SLEEVE_WIDTH_PX, y: by + py * SLEEVE_WIDTH_PX },
    );
    this.strokeSegment(
      { x: ax - px * SLEEVE_WIDTH_PX, y: ay - py * SLEEVE_WIDTH_PX },
      { x: bx - px * SLEEVE_WIDTH_PX, y: by - py * SLEEVE_WIDTH_PX },
    );
    // Two end caps (the join faces).
    this.strokeSegment(
      { x: ax + px * SLEEVE_WIDTH_PX, y: ay + py * SLEEVE_WIDTH_PX },
      { x: ax - px * SLEEVE_WIDTH_PX, y: ay - py * SLEEVE_WIDTH_PX },
    );
    this.strokeSegment(
      { x: bx + px * SLEEVE_WIDTH_PX, y: by + py * SLEEVE_WIDTH_PX },
      { x: bx - px * SLEEVE_WIDTH_PX, y: by - py * SLEEVE_WIDTH_PX },
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
