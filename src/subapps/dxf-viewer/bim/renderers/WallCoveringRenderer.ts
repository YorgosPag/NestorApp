/**
 * WallCoveringRenderer — ADR-511.
 *
 * 2D plan-view renderer για `WallCoveringEntity`. Το covering ΔΕΝ αποθηκεύει polygon —
 * η ορατή «χρωματιστή λωρίδα στην παρειά» υπολογίζεται **live** από τον host δομικό τοίχο
 * (`computeWallCoveringStrip` SSoT) ώστε να ακολουθεί τον τοίχο όταν μετακινείται.
 *
 * Ο renderer χρειάζεται τον host τοίχο (cross-entity). Όπως ο `WallRenderer` δέχεται
 * per-frame `OpeningsByWall`, εδώ ο `DxfRenderer` τρέφει per-frame `setWallsById(map)` —
 * O(1) lookup του host στο render time. ADR-040 micro-leaf: zero store subscriptions.
 *
 * Σχεδιάζει:
 *   - translucent fill στο χρώμα του ορατού φινιρίσματος (surface coat ή «βαρύτερη» στρώση)
 *   - hatch ανά οικογένεια υλικού (tile/plaster/board), clipped στη λωρίδα
 *   - outline stroke στο χρώμα του υλικού
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * @see bim/renderers/FloorFinishRenderer.ts — το πρότυπο
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isWallCoveringEntity } from '../../types/entities';
import type {
  WallCoveringEntity,
  WallCoveringHatchType,
} from '../types/wall-covering-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getWallCoveringColor, getWallCoveringHatchType } from '../wall-coverings/wall-covering-material-catalog';
import { resolveVisibleWallCoveringLayer } from '../wall-coverings/wall-covering-layers';
import { strokeHatchLines, fillHatchDots } from './shared/canvas-hatch-fill';
import { hexToRgba } from '../utils/bim-vg-fill-tint';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';

/** Opacity του translucent fill της λωρίδας (λίγο πιο έντονο από floor-finish για να ξεχωρίζει). */
const STRIP_FILL_ALPHA = 0.35;
import {
  computeWallCoveringStrip,
  type WallCoveringHost,
  type WallCoveringStrip,
} from '../wall-coverings/wall-covering-strip-geometry';

const HATCH_STROKE = 'rgba(0, 0, 0, 0.18)';
const HATCH_LINE_WIDTH = 0.5;
/** World-space spacing (mm) ανά οικογένεια hatch. */
const HATCH_SPACING_MM: Record<Exclude<WallCoveringHatchType, 'solid'>, number> = {
  tile: 200,
  plaster: 120,
  board: 250,
};

export class WallCoveringRenderer extends BaseEntityRenderer {
  /** Per-frame host-wall index (id → wall). Fed by `DxfRenderer.render()`. */
  private wallsById: ReadonlyMap<string, WallCoveringHost> = new Map();

  /** ADR-511 — forward the per-frame wall index so the covering can resolve its host. */
  setWallsById(map: ReadonlyMap<string, WallCoveringHost>): void {
    this.wallsById = map;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isWallCoveringEntity(entity)) return;
    const wc = entity as WallCoveringEntity;
    const strip = this.resolveStrip(wc);
    if (!strip) return;

    const quad = strip.quad;
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo.
    if (phaseState.phase === 'highlighted') {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = HOVER_HIGHLIGHT.ENTITY.glowExtraWidth + 1.5;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawQuadPath(quad);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();

    const visible = resolveVisibleWallCoveringLayer(wc.params.layers);
    const color = visible.colorOverride ?? getWallCoveringColor(visible.materialId);
    const hatch = getWallCoveringHatchType(visible.materialId);

    // Translucent fill — reuse `hexToRgba` SSoT (ADR-375· μηδέν inline hex parse).
    // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
    this.ctx.fillStyle = adaptFillTintForCanvas(hexToRgba(color, STRIP_FILL_ALPHA) ?? color);
    this.drawQuadPath(quad);
    this.ctx.fill();

    if (hatch !== 'solid') {
      this.drawHatch(quad, hatch);
    }

    // Outline stroke.
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.2;
    this.ctx.setLineDash([]);
    this.drawQuadPath(quad);
    this.ctx.stroke();

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(): GripInfo[] {
    // ADR-511 Slice B — span-slide grips deferred (follow-up). Editing via ribbon.
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D): boolean {
    if (!isWallCoveringEntity(entity)) return false;
    const strip = this.resolveStrip(entity as WallCoveringEntity);
    if (!strip) return false;
    return pointInPolygon(point, strip.quad as ReadonlyArray<{ x: number; y: number }>);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** Resolve the live strip from the host wall, or `null` when host is missing. */
  private resolveStrip(wc: WallCoveringEntity): WallCoveringStrip | null {
    const host = this.wallsById.get(wc.params.hostWallId);
    if (!host) return null;
    return computeWallCoveringStrip(host, wc.params);
  }

  private drawQuadPath(quad: WallCoveringStrip['quad']): void {
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: quad[0].x, y: quad[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < quad.length; i++) {
      const s = this.worldToScreen({ x: quad[i].x, y: quad[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
  }

  private drawHatch(quad: WallCoveringStrip['quad'], hatch: Exclude<WallCoveringHatchType, 'solid'>): void {
    const spacingMm = HATCH_SPACING_MM[hatch];
    if (!Number.isFinite(spacingMm) || spacingMm <= 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of quad) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    this.ctx.save();
    this.drawQuadPath(quad);
    this.ctx.clip();
    this.ctx.strokeStyle = HATCH_STROKE;
    this.ctx.fillStyle = HATCH_STROKE;
    this.ctx.lineWidth = HATCH_LINE_WIDTH;
    this.ctx.setLineDash([]);

    // Reuse the canvas hatch-fill SSoT (N.0.2) — mapping (material→pattern) μένει εδώ.
    const bbox = { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
    const w2s = (p: { x: number; y: number }) => this.worldToScreen(p);
    if (hatch === 'plaster') {
      fillHatchDots(this.ctx, w2s, bbox, spacingMm, 1.2);
    } else if (hatch === 'board') {
      strokeHatchLines(this.ctx, w2s, bbox, spacingMm, 'horizontal');
    } else {
      strokeHatchLines(this.ctx, w2s, bbox, spacingMm, 'horizontal');
      strokeHatchLines(this.ctx, w2s, bbox, spacingMm, 'vertical');
    }
    this.ctx.restore();
  }
}
