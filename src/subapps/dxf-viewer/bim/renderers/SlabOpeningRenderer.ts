/**
 * SlabOpeningRenderer — ADR-363 Phase 3.7.
 *
 * 2D plan-view renderer για `SlabOpeningEntity`. Reads `entity.geometry`
 * (populated by `computeSlabOpeningGeometry()` — SSoT) και draws:
 *   - dashed polygon outline ανά kind colour (industry convention για
 *     cutouts: red dashed για shaft/chimney, neutral για duct/well)
 *   - light translucent fill ανά kind
 *   - hover halo (continuous outline ring με glow)
 *
 * Per-kind palette:
 *   - shaft   → cool blue (lift)
 *   - well    → warm grey (stair-well)
 *   - duct    → neutral grey
 *   - chimney → warm red (καπνοδόχος)
 *
 * Boolean cutout στο host slab γίνεται στον `SlabRenderer.punchHostedSlabOpenings`
 * (mirror WallRenderer.punchHostedOpenings). Αυτός ο renderer δείχνει το ίδιο
 * το cutout entity σαν αυτόνομο visual element.
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions
 * σε high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isSlabOpeningEntity } from '../../types/entities';
import type {
  SlabOpeningEntity,
  SlabOpeningKind,
} from '../types/slab-opening-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { linePatternToDashArray } from '../../config/bim-line-patterns';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getSlabOpeningGrips } from '../slab-openings/slab-opening-grips';

/**
 * Stroke colour per kind — saturated, high-contrast over typical slab fills
 * (warm-grey floor / cool-grey ceiling / red-brown roof / dark-grey foundation).
 * Industry convention: cutouts use darker, more saturated outlines vs slab body
 * so the hole reads as "structural void" at a glance in plan view.
 */
const KIND_STROKE: Readonly<Record<SlabOpeningKind, string>> = {
  'shaft':   '#1f3a5f',
  'well':    '#5a4a2e',
  'duct':    '#2a2a2a',
  'chimney': '#7a2810',
};

/**
 * Translucent fill (rgba) per kind. ~35% opacity — enough για visible kind hint
 * over slab fill, low enough για cross-hatch / sub-entities να φαίνονται.
 */
const KIND_FILL: Readonly<Record<SlabOpeningKind, string>> = {
  'shaft':   'rgba(108, 152, 198, 0.35)',
  'well':    'rgba(170, 150, 120, 0.35)',
  'duct':    'rgba(140, 140, 140, 0.32)',
  'chimney': 'rgba(192, 92, 56, 0.40)',
};

/** Dash pattern για κάθε kind (mm-agnostic — screen px). */
const KIND_DASH: Readonly<Record<SlabOpeningKind, readonly [number, number]>> = {
  'shaft':   [8, 4],
  'well':    [6, 3],
  'duct':    [4, 2],
  'chimney': [8, 4],
};

export class SlabOpeningRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isSlabOpeningEntity(entity)) return;
    const opening = entity as SlabOpeningEntity;
    if (!opening.geometry || !opening.params) return;
    const verts = opening.geometry.polygon.vertices;
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

    this.ctx.fillStyle = KIND_FILL[opening.kind];
    this.drawPolygonPath(verts);
    this.ctx.fill();

    const _soZTop = opening.params.elevationOverride ?? 0;
    const _soCutState = resolveCutState(
      { zBottomMm: _soZTop - 200, zTopMm: _soZTop, category: 'slab-opening' },
      useDrawingScaleStore.getState().viewRange,
    );
    const { lineWidthPx: _soLwPx, linePattern: _soPattern, color: _soColor } = resolveSubcategoryStyle({
      category: 'slab-opening', subcategoryKey: 'edges',
      cutState: _soCutState, scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      dpi: 96, objectStyles: useDrawingScaleStore.getState().objectStyles,
    });
    this.ctx.lineWidth = _soLwPx;
    const _soDash = _soPattern !== 'solid'
      ? linePatternToDashArray(_soPattern)
      : KIND_DASH[opening.kind];
    this.ctx.setLineDash(_soDash as number[]);
    this.ctx.strokeStyle = _soColor ?? KIND_STROKE[opening.kind];
    this.drawPolygonPath(verts);
    this.ctx.stroke();
    this.ctx.restore();

    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-363 Phase 3.7a — parametric slab-opening grips (per-vertex translate +
    // edge-midpoint vertex insertion). Commit routed through
    // `applySlabOpeningGripDrag()` + `UpdateSlabOpeningParamsCommand` by
    // `commitSlabOpeningGripDrag` (grip-commit-adapter), with Shift driving
    // rectilinear quantization.
    if (!isSlabOpeningEntity(entity)) return [];
    return getSlabOpeningGrips(entity as SlabOpeningEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'midpoint' ? ('midpoint' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isSlabOpeningEntity(entity)) return false;
    const opening = entity as SlabOpeningEntity;
    const bb = opening.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    const verts = opening.geometry.polygon.vertices;
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
}
