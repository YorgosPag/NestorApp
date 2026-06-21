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
  WallCoveringLayer,
} from '../types/wall-covering-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getWallCoveringColor, getWallCoveringHatchType } from '../wall-coverings/wall-covering-material-catalog';
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

    const visible = resolveVisibleLayer(wc.params.layers);
    const color = visible.colorOverride ?? getWallCoveringColor(visible.materialId);
    const hatch = getWallCoveringHatchType(visible.materialId);

    // Translucent fill (35% — λίγο πιο έντονο από floor-finish ώστε η λωρίδα να ξεχωρίζει).
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
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

    if (hatch === 'plaster') {
      this.drawDotGrid(minX, minY, maxX, maxY, spacingMm);
    } else if (hatch === 'board') {
      this.drawParallelLines(minX, minY, maxX, maxY, spacingMm, 'horizontal');
    } else {
      this.drawParallelLines(minX, minY, maxX, maxY, spacingMm, 'horizontal');
      this.drawParallelLines(minX, minY, maxX, maxY, spacingMm, 'vertical');
    }
    this.ctx.restore();
  }

  private drawParallelLines(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    spacingMm: number,
    orientation: 'horizontal' | 'vertical',
  ): void {
    if (orientation === 'horizontal') {
      const startY = Math.ceil(minY / spacingMm) * spacingMm;
      for (let y = startY; y <= maxY; y += spacingMm) {
        const s = this.worldToScreen({ x: minX, y });
        const e = this.worldToScreen({ x: maxX, y });
        this.ctx.beginPath();
        this.ctx.moveTo(s.x, s.y);
        this.ctx.lineTo(e.x, e.y);
        this.ctx.stroke();
      }
    } else {
      const startX = Math.ceil(minX / spacingMm) * spacingMm;
      for (let x = startX; x <= maxX; x += spacingMm) {
        const s = this.worldToScreen({ x, y: minY });
        const e = this.worldToScreen({ x, y: maxY });
        this.ctx.beginPath();
        this.ctx.moveTo(s.x, s.y);
        this.ctx.lineTo(e.x, e.y);
        this.ctx.stroke();
      }
    }
  }

  private drawDotGrid(minX: number, minY: number, maxX: number, maxY: number, spacingMm: number): void {
    const startX = Math.ceil(minX / spacingMm) * spacingMm;
    const startY = Math.ceil(minY / spacingMm) * spacingMm;
    for (let x = startX; x <= maxX; x += spacingMm) {
      for (let y = startY; y <= maxY; y += spacingMm) {
        const s = this.worldToScreen({ x, y });
        this.ctx.beginPath();
        this.ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
}

/**
 * Διαλέγει τη στρώση που ορίζει το ορατό χρώμα 2D: η `surface` (coat/μπογιά) αν υπάρχει,
 * αλλιώς η `body` με το μεγαλύτερο πάχος, αλλιώς η πρώτη. Pure.
 */
function resolveVisibleLayer(layers: readonly WallCoveringLayer[]): WallCoveringLayer {
  const surface = layers.find((l) => l.function === 'surface');
  if (surface) return surface;
  let heaviest: WallCoveringLayer | undefined;
  for (const l of layers) {
    if (l.function !== 'body') continue;
    if (!heaviest || l.thicknessMm > heaviest.thicknessMm) heaviest = l;
  }
  return heaviest ?? layers[0];
}
