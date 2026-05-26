/**
 * SlabRenderer — ADR-363 Phase 3 + 3.5 + 3.6.
 *
 * 2D plan-view renderer για `SlabEntity`. Reads `entity.geometry`
 * (populated by `computeSlabGeometry()` — SSoT) και draws:
 *   - closed polygon outline (stroke per-kind colour)
 *   - translucent fill per kind
 *   - reinforcement hatch (Phase 3.6) clipped by polygon path:
 *       · one-way → parallel lines (200mm) along the X axis
 *       · two-way → orthogonal grid (300mm)
 *       · waffle  → dense cross-hatch (150mm)
 *       · flat    → dotted grid (250mm)
 *
 * Per-kind palette (industry convention — warm για συμπαγή στοιχεία, cool
 * για ψυχρές επιφάνειες, RC = γκρι):
 *   - floor       → warm grey (γενική πλάκα ορόφου)
 *   - ceiling     → cool blue-grey
 *   - roof        → red-brown (κεραμίδι / RC roof)
 *   - ground      → dark green (έδαφος)
 *   - foundation  → dark grey (RC θεμελίωση)
 *
 * Phase 3.6 NOT implemented (deferred Phase 3.7+):
 *   - Boolean cutout για slab-openings (όταν slab-opening entity εισαχθεί)
 *   - maxFreeSpan analytical (1D beam-direction span detection)
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions
 * σε high-frequency stores. Called by canvas με entity resolved upstream.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3.6
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isSlabEntity } from '../../types/entities';
import type { SlabEntity, SlabKind, SlabReinforcement } from '../types/slab-types';
import type { SlabOpeningEntity } from '../types/slab-opening-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveSubcategoryStyle, resolveIsCategoryVisible } from '../../config/bim-line-weight-resolver';
import { linePatternToDashArray } from '../../config/bim-line-patterns';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getSlabGrips } from '../slabs/slab-grips';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';

/** Stroke colour per kind. */
const KIND_STROKE: Readonly<Record<SlabKind, string>> = {
  'floor':      '#6e6358',
  'ceiling':    '#5f7286',
  'roof':       '#a04a2b',
  'ground':     '#3d5a3a',
  'foundation': '#3a3a40',
};

/** Translucent fill (rgba) per kind. ~20% opacity. */
const KIND_FILL: Readonly<Record<SlabKind, string>> = {
  'floor':      'rgba(178, 162, 144, 0.20)',
  'ceiling':    'rgba(140, 158, 178, 0.20)',
  'roof':       'rgba(192, 92, 56, 0.20)',
  'ground':     'rgba(94, 130, 88, 0.20)',
  'foundation': 'rgba(88, 88, 96, 0.22)',
};

/**
 * Hatch line stroke (light gray, low-opacity) — non-intrusive against the
 * already-tinted fill, matches the industry convention for "hint" hatch in
 * plan view.
 */
const HATCH_STROKE = 'rgba(0, 0, 0, 0.15)';
const HATCH_LINE_WIDTH = 0.5;

/** World-space spacing (mm) per reinforcement family. */
const HATCH_SPACING_MM: Readonly<Record<SlabReinforcement, number>> = {
  'one-way': 200,
  'two-way': 300,
  'waffle':  150,
  'flat':    250,
};

/** ADR-363 Phase 3.7 — per-frame slab-opening index keyed by host slab id. */
export type SlabOpeningsBySlab = ReadonlyMap<string, ReadonlyArray<SlabOpeningEntity>>;

export class SlabRenderer extends BaseEntityRenderer {
  /**
   * ADR-363 Phase 3.7 — per-frame map of slab-openings keyed by host slab id.
   * Forwarded by `EntityRendererComposite.setSlabOpeningsBySlab()` ώστε ο
   * renderer να τρυπάει boolean cutouts στο slab fill σε κάθε hosted
   * opening outline (visual "hole" κατ' αντιστοιχία με WallRenderer Phase 2.5).
   *
   * Empty map ⇒ legacy behaviour (no cutout). Renderer never subscribes —
   * caller rebuilds the map once per frame and pushes via setter (micro-leaf
   * compliant, ADR-040).
   */
  private slabOpeningsBySlab: SlabOpeningsBySlab = new Map();

  /** Inject per-frame slab-opening index. Composite calls this once per render. */
  setSlabOpeningsBySlab(map: SlabOpeningsBySlab): void {
    this.slabOpeningsBySlab = map;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isSlabEntity(entity)) return;
    // ADR-375 Phase C.4 v2.6 — V/G visibility hotfix (see WallRenderer for rationale).
    if (!resolveIsCategoryVisible('slab', useDrawingScaleStore.getState().objectStyles)) return;
    const slab = entity as SlabEntity;
    if (!slab.geometry || !slab.params) return;
    const verts = slab.geometry.polygon.vertices;
    if (verts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo via outline thicker glow.
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
    // Fill first, hatch clipped inside, stroke on top so outline stays sharp.
    this.ctx.fillStyle = KIND_FILL[slab.kind];
    this.drawPolygonPath(verts);
    this.ctx.fill();

    if (slab.params.reinforcement) {
      this.drawReinforcementHatch(slab);
    }

    // ADR-363 Phase 3.7 — subtract hosted slab-opening outlines από το fill.
    this.punchHostedSlabOpenings(slab);

    const _slabLayer = slab.layerId ? getLayer(slab.layerId) : null;
    const _slabLayerOverride = _slabLayer ? {
      lineweightMm: isConcreteLineweight(_slabLayer.lineweight) ? _slabLayer.lineweight : undefined,
      color: _slabLayer.color ?? undefined,
    } : undefined;
    const _slabZTop = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
    const _slabCutState = resolveCutState(
      { zBottomMm: _slabZTop - slab.params.thickness, zTopMm: _slabZTop, category: 'slab' },
      useDrawingScaleStore.getState().viewRange,
    );
    const { lineWidthPx: _slabLwPx, linePattern: _slabPattern, color: _slabColor } = resolveSubcategoryStyle({
      category: 'slab', subcategoryKey: 'common-edges',
      cutState: _slabCutState, scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      dpi: 96, objectStyles: useDrawingScaleStore.getState().objectStyles,
      elementOverride: slab.styleOverride, layerOverride: _slabLayerOverride,
    });
    this.ctx.lineWidth = _slabLwPx;
    this.ctx.setLineDash(linePatternToDashArray(_slabPattern) as number[]);
    this.ctx.strokeStyle = _slabColor ?? KIND_STROKE[slab.kind];
    this.drawPolygonPath(verts);
    this.ctx.stroke();
    this.ctx.restore();

    this.finalizeRender(entity, options);
  }

  /**
   * ADR-363 Phase 3.7 — subtract κάθε hosted slab-opening outline από το ήδη
   * ζωγραφισμένο slab fill via `destination-out`. Scoped save/restore κρατά
   * το composite mode τοπικά. Silent skip όταν δεν υπάρχουν openings
   * (legacy behaviour preserved). Mirrors WallRenderer.punchHostedOpenings.
   */
  private punchHostedSlabOpenings(slab: SlabEntity): void {
    const openings = this.slabOpeningsBySlab.get(slab.id);
    if (!openings || openings.length === 0) return;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    for (const opening of openings) {
      const verts = opening.geometry?.polygon.vertices;
      if (!verts || verts.length < 3) continue;
      this.ctx.beginPath();
      const start = this.worldToScreen({ x: verts[0].x, y: verts[0].y });
      this.ctx.moveTo(start.x, start.y);
      for (let i = 1; i < verts.length; i++) {
        const s = this.worldToScreen({ x: verts[i].x, y: verts[i].y });
        this.ctx.lineTo(s.x, s.y);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-363 Phase 3.5 + 3.6 — parametric slab grips (per-vertex translate +
    // edge-midpoint vertex insertion). Commit routed through
    // `applySlabGripDrag()` + `UpdateSlabParamsCommand` by `commitSlabGripDrag`
    // (grip-commit-adapter), with Shift driving rectilinear quantization.
    if (!isSlabEntity(entity)) return [];
    return getSlabGrips(entity as SlabEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'midpoint' ? ('midpoint' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isSlabEntity(entity)) return false;
    const slab = entity as SlabEntity;
    const bb = slab.geometry?.bbox;
    if (!bb) return false;
    // Bbox quick-reject με tolerance.
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    // Detailed point-in-polygon test (ray casting).
    const verts = slab.geometry.polygon.vertices;
    return pointInPolygon(point, verts);
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

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

  /**
   * Phase 3.6 — light hatch hint per reinforcement family. Drawn in world
   * space, clipped by the polygon outline so the pattern never bleeds
   * outside the slab. Stroke kept faint (0.15 opacity) so the outline +
   * fill stay readable.
   */
  private drawReinforcementHatch(slab: SlabEntity): void {
    const reinforcement = slab.params.reinforcement;
    if (!reinforcement) return;
    const bbox = slab.geometry.bbox;
    const spacingMm = HATCH_SPACING_MM[reinforcement];
    if (!Number.isFinite(spacingMm) || spacingMm <= 0) return;

    this.ctx.save();
    this.drawPolygonPath(slab.geometry.polygon.vertices);
    this.ctx.clip();
    this.ctx.strokeStyle = HATCH_STROKE;
    this.ctx.fillStyle = HATCH_STROKE;
    this.ctx.lineWidth = HATCH_LINE_WIDTH;
    this.ctx.setLineDash([]);

    if (reinforcement === 'flat') {
      this.drawDotGrid(bbox, spacingMm);
    } else {
      if (reinforcement === 'one-way' || reinforcement === 'two-way' || reinforcement === 'waffle') {
        this.drawParallelLines(bbox, spacingMm, 'horizontal');
      }
      if (reinforcement === 'two-way' || reinforcement === 'waffle') {
        this.drawParallelLines(bbox, spacingMm, 'vertical');
      }
    }
    this.ctx.restore();
  }

  private drawParallelLines(
    bbox: SlabEntity['geometry']['bbox'],
    spacingMm: number,
    orientation: 'horizontal' | 'vertical',
  ): void {
    if (orientation === 'horizontal') {
      const startY = Math.ceil(bbox.min.y / spacingMm) * spacingMm;
      for (let y = startY; y <= bbox.max.y; y += spacingMm) {
        const a = this.worldToScreen({ x: bbox.min.x, y });
        const b = this.worldToScreen({ x: bbox.max.x, y });
        this.ctx.beginPath();
        this.ctx.moveTo(a.x, a.y);
        this.ctx.lineTo(b.x, b.y);
        this.ctx.stroke();
      }
      return;
    }
    const startX = Math.ceil(bbox.min.x / spacingMm) * spacingMm;
    for (let x = startX; x <= bbox.max.x; x += spacingMm) {
      const a = this.worldToScreen({ x, y: bbox.min.y });
      const b = this.worldToScreen({ x, y: bbox.max.y });
      this.ctx.beginPath();
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.stroke();
    }
  }

  private drawDotGrid(
    bbox: SlabEntity['geometry']['bbox'],
    spacingMm: number,
  ): void {
    const startX = Math.ceil(bbox.min.x / spacingMm) * spacingMm;
    const startY = Math.ceil(bbox.min.y / spacingMm) * spacingMm;
    const dotRadius = 1;
    for (let x = startX; x <= bbox.max.x; x += spacingMm) {
      for (let y = startY; y <= bbox.max.y; y += spacingMm) {
        const s = this.worldToScreen({ x, y });
        this.ctx.beginPath();
        this.ctx.arc(s.x, s.y, dotRadius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
}
