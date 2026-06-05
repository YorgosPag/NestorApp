/**
 * MepManifoldRenderer — ADR-408 Φ12.
 *
 * 2D plan-view renderer for `MepManifoldEntity`. Reads `entity.geometry`
 * (populated by `computeMepManifoldGeometry()` — SSoT) and draws:
 *   - the footprint outline (rectangle)
 *   - a translucent fill
 *   - the manifold symbol strokes (inlet stub + outlet stubs), from the
 *     `buildMepManifoldSymbol` SSoT (shared with the placement ghost)
 *   - a hover halo when highlighted
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions —
 * state read synchronously at draw time via `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isMepManifoldEntity } from '../../types/entities';
import type { MepManifoldEntity } from '../types/mep-manifold-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { buildMepManifoldSymbol } from '../mep-manifolds/mep-manifold-symbol';
import { getMepManifoldGrips } from '../mep-manifolds/mep-manifold-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';

/**
 * Manifold palette — plumbing distribution equipment (cyan-teal). ADR-408 Φ12: the
 * manifold is a circuit **source**, not a member, so it is NOT coloured by system
 * (Revit: Plumbing Equipment carries no circuit colour). It keeps this equipment
 * cyan; only the connected pipe segments take the circuit colour.
 */
const MANIFOLD_STROKE = '#0891b2';
const MANIFOLD_FILL = 'rgba(8, 145, 178, 0.18)';
// ADR-408 Φ14 — a drainage collector (φρεάτιο) reads brown (CIBSE sanitary
// convention), distinguishing it at a glance from a water manifold.
const DRAINAGE_COLLECTOR_STROKE = '#b45309';
const DRAINAGE_COLLECTOR_FILL = 'rgba(180, 83, 9, 0.18)';

export class MepManifoldRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepManifoldEntity(entity)) return;
    const manifold = entity as MepManifoldEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'mep-manifold' → plumbing via DISCIPLINE_BY_CATEGORY.
    const layer = manifold.layerId ? getLayer(manifold.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'mep-manifold', layerId: manifold.layerId, discipline: manifold.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

    if (!manifold.geometry || !manifold.params) return;
    const verts = manifold.geometry.footprint.vertices;
    if (verts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

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
    this.ctx.setLineDash([]);

    // Fill + outline — equipment cyan-teal for a water manifold; brown for a
    // drainage collector (φρεάτιο). Manifolds are not coloured by circuit (source).
    const isDrain = manifold.params.kind === 'drainage-collector';
    this.ctx.fillStyle = isDrain ? DRAINAGE_COLLECTOR_FILL : MANIFOLD_FILL;
    this.drawPolygonPath(verts);
    this.ctx.fill();
    this.ctx.strokeStyle = isDrain ? DRAINAGE_COLLECTOR_STROKE : MANIFOLD_STROKE;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // Manifold symbol strokes (inlet stub + outlet stubs).
    const symbol = buildMepManifoldSymbol(manifold.params, manifold.geometry);
    for (const stroke of symbol.strokes) {
      this.drawStroke(stroke);
    }

    // ADR-408 Φ14 — drainage collector (φρεάτιο) grating: parallel bars inside the
    // footprint, thinner than the stubs so the catch-basin reads at a glance.
    if (symbol.gratingStrokes) {
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
      for (const stroke of symbol.gratingStrokes) {
        this.drawStroke(stroke);
      }
    }

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-408 Φ12 — parametric grips (wall-parity): move (centre) + rotation + 4
    // corner resize (rectangular-only). Mirror of `ElectricalPanelRenderer.getGrips`;
    // the move/rotation handles get their icon glyph from the shared
    // `gripGlyphShape` registry SSoT, corners stay square. Drag is routed through
    // `applyMepManifoldGripDrag()` + `UpdateMepManifoldParamsCommand` by
    // `commitMepManifoldGripDrag` (grip-parametric-commits).
    if (!isMepManifoldEntity(entity)) return [];
    return getMepManifoldGrips(entity as MepManifoldEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? ('center' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
      shape: gripGlyphShape(g.mepManifoldGripKind),
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepManifoldEntity(entity)) return false;
    const manifold = entity as MepManifoldEntity;
    const bb = manifold.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    return pointInPolygon(point, manifold.geometry.footprint.vertices);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** Stroke a world-space polyline (symbol stub / grating bar) at the current style. */
  private drawStroke(stroke: ReadonlyArray<{ x: number; y: number }>): void {
    if (stroke.length < 2) return;
    this.ctx.beginPath();
    const start = this.worldToScreen({ x: stroke[0].x, y: stroke[0].y });
    this.ctx.moveTo(start.x, start.y);
    for (let i = 1; i < stroke.length; i++) {
      const s = this.worldToScreen({ x: stroke[i].x, y: stroke[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
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
