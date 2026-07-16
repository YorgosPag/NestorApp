/**
 * MepFittingRenderer — ADR-408 Φ11 (auto pipe fittings).
 *
 * 2D plan-view renderer for `MepFittingEntity`. A fitting is a point-based MEP
 * element materialised at a junction of two or more pipe segments (Revit "Pipe
 * Fitting"; IFC `IfcPipeFitting`). It is the point-based counterpart of the
 * linear `mep-segment` (ADR-408 Φ8) and mirrors that renderer's structure:
 * unified visibility gate, hover halo, translucent footprint fill, dashed outline.
 *
 * The footprint IS the real fitting body (Revit-grade): the swept bend of an
 * elbow, the union of arms of a tee/cross, the axial rectangle/trapezoid of a
 * coupling/reducer, or the dome of a cap — all derived from the generic body SSoT
 * (`mep-fitting-body.ts`), the same source the 3D mesh + the pipe trim read. So the
 * fill + outline alone draw the true shape; NO per-kind screen-space glyph is
 * needed (unlike the Φ11 foundation slice, which drew schematic glyphs on a square).
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
 * @see ../geometry/mep-fitting-body.ts (the body footprint SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { MepFittingEntity, MepFittingDomain } from '../types/mep-fitting-types';
import { incidentEntityId, resolveFittingBimCategory } from '../types/mep-fitting-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';
import { useMepSystemStore } from '../mep-systems/mep-system-store';
import {
  getEntitySystemColorIndexCached,
  resolveFittingSystemColor,
  resolveSegmentClassificationColor,
  hexToRgba,
} from '../mep-systems/mep-system-color';

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

/** Translucent fill alpha for the colour-by-system override (segment mirror). */
const SYSTEM_FILL_ALPHA = 0.15;

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
    // Discipline). BimCategory mirrors the segment renderer (ADR-408 Φ14): a
    // drainage fitting maps to its own 'drain-pipe' bucket so it hides/toggles
    // together with the drainage pipes it joins; every other fitting → its domain.
    const layer = fitting.layerId ? getLayer(fitting.layerId) : null;
    if (!resolveBimPlanVisibility({ category: resolveFittingBimCategory(fitting.params), layerId: fitting.layerId, discipline: fitting.discipline }, layer)) return;

    if (!fitting.geometry || !fitting.params) return;
    const verts = fitting.geometry.footprint.vertices;
    if (verts.length < 3) return;
    const domain = fitting.params.domain;

    // ADR-408 Φ11 — colour-by-system: a fitting reads as the same network as its
    // pipes (Revit). It is NOT a system member (auto-derived), so it inherits the
    // colour of the FIRST incident pipe that belongs to a system. Gated by the
    // per-view `colorBySystem` master toggle (Φ7): OFF ⇒ the per-domain default.
    const colorBySystem = useDrawingScaleStore.getState().colorBySystem;
    const systems = useMepSystemStore.getState().getSystems();
    const systemColor = colorBySystem && systems.length > 0
      ? resolveFittingSystemColor(
          fitting.params.incidents.filter((inc) => !inc.host).map(incidentEntityId),
          getEntitySystemColorIndexCached(systems),
        )
      : null;
    // Colour precedence mirrors the segment renderer (ADR-408 Φ14): a live System
    // membership wins; else the inherited classification tint (drainage brown, …);
    // else the per-domain default. So a drainage fitting reads brown like its pipes.
    const baseColor = systemColor ?? resolveSegmentClassificationColor(fitting.params.classification);
    const strokeColor = baseColor ?? DOMAIN_STROKE[domain];
    const fillColor = baseColor ? hexToRgba(baseColor, SYSTEM_FILL_ALPHA) : DOMAIN_FILL[domain];

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo via outline thicker glow (mirror segment / fixture renderer).
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

    // 1. Translucent footprint fill — the real body in plan.
    // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
    this.ctx.fillStyle = adaptFillTintForCanvas(fillColor);
    this.drawPolygonPath(verts);
    this.ctx.fill();

    // 2. Dashed outline (linear-run-above-cut-plane convention, segment mirror).
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.ctx.setLineDash(OUTLINE_DASH as unknown as number[]);
    this.drawPolygonPath(verts);
    this.ctx.stroke();

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
    if (verts.length < 3) return true; // degenerate footprint → bbox is the target.
    return pointInPolygon(point, verts);
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
}
