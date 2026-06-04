/**
 * MepSegmentRenderer — ADR-408 Φ8.
 *
 * 2D plan-view renderer for `MepSegmentEntity`. Reads `entity.geometry`
 * (populated by `computeMepSegmentGeometry()` — SSoT) and draws:
 *   - the plan-view footprint polygon (outline + translucent fill) —
 *     mirrors `BeamRenderer` (same linear-element convention with dashed
 *     outline indicating a run hidden above the cut plane)
 *   - a dashed axis centerline (thinner dashed stroke)
 *   - domain symbol strokes from `buildSegmentSymbol` SSoT:
 *       duct → centerline only (rendered here redundantly in symbol colour)
 *       pipe → centerline + midpoint tick marks
 *   - a hover halo when highlighted
 *
 * Palette per domain (Revit/NBS MEP colour convention):
 *   - `'duct'`  → teal / steel-blue  (#64748b stroke, rgba translucent fill)
 *   - `'pipe'`  → copper / amber     (#b45309 stroke, rgba translucent fill)
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions
 * to high-frequency stores. State read synchronously via
 * `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { MepSegmentEntity, MepSegmentDomain } from '../types/mep-segment-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { computeTrimmedSegmentGeometry } from '../geometry/mep-segment-geometry';
import { useMepSegmentTrimStore } from '../mep-fittings/mep-segment-trim-store';
import { buildSegmentSymbol, buildPipeTickScreen } from '../mep-segments/mep-segment-symbol';
import { getMepSegmentGrips } from '../mep-segments/mep-segment-grips';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';
import { useMepSystemStore } from '../mep-systems/mep-system-store';
import {
  getEntitySystemColorIndexCached,
  resolveEntitySystemColor,
  hexToRgba,
} from '../mep-systems/mep-system-color';

// ─── Palette ────────────────────────────────────────────────────────────────────

/**
 * Stroke colour per domain.
 *   - duct  → steel/slate (mechanical runs, HVAC blue-grey convention)
 *   - pipe  → copper/amber (plumbing runs, warm-orange convention)
 */
const DOMAIN_STROKE: Readonly<Record<MepSegmentDomain, string>> = {
  'duct': '#64748b',
  'pipe': '#b45309',
};

/**
 * Translucent fill per domain (~15% opacity — matches beam plan-hidden
 * convention; faint because the segment is above the cut plane).
 */
const DOMAIN_FILL: Readonly<Record<MepSegmentDomain, string>> = {
  'duct': 'rgba(100, 116, 139, 0.15)',
  'pipe': 'rgba(180, 83, 9, 0.15)',
};

/** Translucent fill alpha for the colour-by-system (ADR-408 Φ9/Φ10) override. */
const SEGMENT_SYSTEM_FILL_ALPHA = 0.15;

/** Dash pattern for the plan outline (dashed = above cut plane, BeamRenderer mirror). */
const OUTLINE_DASH: readonly [number, number] = [8, 4];

/** Dash pattern for the axis centerline. */
const AXIS_DASH: readonly [number, number] = [4, 3];

// ─── Type guard (local — main agent adds to entities.ts union) ───────────────────

function isMepSegmentEntity(entity: EntityModel): entity is MepSegmentEntity {
  return entity.type === 'mep-segment';
}

// ─── Renderer ────────────────────────────────────────────────────────────────────

export class MepSegmentRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepSegmentEntity(entity)) return;
    const segment = entity as MepSegmentEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). BimCategory determined by domain:
    //   'duct' → 'mechanical' discipline
    //   'pipe' → 'plumbing' discipline
    const layer = segment.layerId ? getLayer(segment.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: segment.params.domain, layerId: segment.layerId, discipline: segment.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

    if (!segment.geometry || !segment.params) return;

    // ADR-408 Φ11 — trim the run so it stops at any fitting on its ends (Revit
    // "pipe meets the fitting face"). Render-time, scene-derived (trim store),
    // zero persistence/mutation. Untrimmed segments use the cached geometry.
    const trim = useMepSegmentTrimStore.getState().getTrim(segment.id);
    const geometry = trim && (trim.startMm > 0 || trim.endMm > 0)
      ? computeTrimmedSegmentGeometry(segment.params, trim.startMm, trim.endMm)
      : segment.geometry;

    const verts = geometry.outline.vertices;
    if (verts.length < 3) return;

    const domain = segment.params.domain;

    // ADR-408 Φ9/Φ10 — colour-by-system: a segment joined to a pipe network paints
    // with the System's colour (classification-derived); unassigned segments keep
    // the per-domain default. Gated by the per-view `colorBySystem` master toggle
    // (Φ7): OFF ⇒ every segment keeps its domain default. The segment id is the
    // colour-index key (network members carry `entityId === segment.id`).
    const colorBySystem = useDrawingScaleStore.getState().colorBySystem;
    const systems = useMepSystemStore.getState().getSystems();
    const systemColor = colorBySystem && systems.length > 0
      ? resolveEntitySystemColor(segment.id, getEntitySystemColorIndexCached(systems))
      : null;
    const strokeColor = systemColor ?? DOMAIN_STROKE[domain];
    const fillColor = systemColor ? hexToRgba(systemColor, SEGMENT_SYSTEM_FILL_ALPHA) : DOMAIN_FILL[domain];

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo via outline thicker glow (mirror BeamRenderer / MepFixtureRenderer).
    if (phaseState.phase === 'highlighted') {
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

    // 1. Translucent fill — communicates the footprint extent in plan.
    this.ctx.fillStyle = fillColor;
    this.drawPolygonPath(verts);
    this.ctx.fill();

    // 2. Dashed outline (industry convention: linear run hidden above cut plane).
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.ctx.setLineDash(OUTLINE_DASH as unknown as number[]);
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // 3. Axis centerline — thinner dashed stroke along the run centreline.
    const axisPoints = geometry.axisPolyline.points;
    if (axisPoints.length >= 2) {
      this.ctx.setLineDash(AXIS_DASH as unknown as number[]);
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
      this.drawPolyline(axisPoints);
    }

    // 4. Domain symbol — centerline (world-space) from buildSegmentSymbol SSoT.
    const symbol = buildSegmentSymbol(geometry);
    this.ctx.setLineDash([]);
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    for (const stroke of symbol.strokes) {
      if (stroke.length < 2) continue;
      this.ctx.beginPath();
      const first = this.worldToScreen({ x: stroke[0].x, y: stroke[0].y });
      this.ctx.moveTo(first.x, first.y);
      for (let i = 1; i < stroke.length; i++) {
        const s = this.worldToScreen({ x: stroke[i].x, y: stroke[i].y });
        this.ctx.lineTo(s.x, s.y);
      }
      this.ctx.stroke();
    }

    // 4b. Pipe midpoint tick — SCREEN-space (fixed pixel length, zoom- and
    //     scene-independent). Mirrors the home-run conductor ticks; replaces the
    //     former world-unit clamp that rendered as metres in a metre-scene.
    if (domain === 'pipe' && axisPoints.length >= 2) {
      const startS = this.worldToScreen({ x: axisPoints[0].x, y: axisPoints[0].y });
      const endS = this.worldToScreen({
        x: axisPoints[axisPoints.length - 1].x,
        y: axisPoints[axisPoints.length - 1].y,
      });
      const tick = buildPipeTickScreen(startS, endS);
      if (tick) {
        this.ctx.beginPath();
        this.ctx.moveTo(tick.a.x, tick.a.y);
        this.ctx.lineTo(tick.b.x, tick.b.y);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isMepSegmentEntity(entity)) return [];
    return getMepSegmentGrips(entity as MepSegmentEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? ('center' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
      shape: 'square' as const,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepSegmentEntity(entity)) return false;
    const segment = entity as MepSegmentEntity;
    const bb = segment.geometry?.bbox;
    if (!bb) return false;
    // Bbox quick-reject with tolerance (mirror BeamRenderer).
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    // Detailed point-in-polygon test on outline.
    return pointInPolygon(point, segment.geometry.outline.vertices);
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

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

  private drawPolyline(points: ReadonlyArray<{ x: number; y: number }>): void {
    if (points.length < 2) return;
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: points[0].x, y: points[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const s = this.worldToScreen({ x: points[i].x, y: points[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.stroke();
  }
}
