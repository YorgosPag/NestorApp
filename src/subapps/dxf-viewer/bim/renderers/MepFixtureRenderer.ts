/**
 * MepFixtureRenderer — ADR-406.
 *
 * 2D plan-view renderer for `MepFixtureEntity`. Reads `entity.geometry`
 * (populated by `computeMepFixtureGeometry()` — SSoT) and draws:
 *   - the footprint outline (rectangle / circle)
 *   - a translucent fill
 *   - the family symbol strokes (the diagonal "X" of a luminaire), from the
 *     `buildFixtureSymbol` SSoT (shared with the placement ghost)
 *   - a hover halo when highlighted
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions —
 * state read synchronously at draw time via `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isMepFixtureEntity } from '../../types/entities';
import type { MepFixtureEntity } from '../types/mep-fixture-types';
import { resolveFixtureBimCategory } from '../types/mep-fixture-types';
import { resolveSegmentClassificationColor } from '../mep-systems/mep-system-color';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { buildFixtureSymbol } from '../mep-fixtures/mep-fixture-symbol';
import { getMepFixtureGrips } from '../mep-fixtures/mep-fixture-grips';
import { bimMeshCache } from '../../bim-3d/library/bim-mesh-library/bim-mesh-cache';
import { drawMeshSilhouette } from './mesh-silhouette-draw';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
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

/** Family-symbol palette — electrical luminaire (amber projection, unassigned). */
const FIXTURE_STROKE = '#d97706';
const FIXTURE_FILL = 'rgba(251, 191, 36, 0.18)';
/** Translucent fill alpha for the colour-by-system (ADR-408 Φ5) override. */
const SYSTEM_FILL_ALPHA = 0.18;
/** BIM category → Storage library folder for light-fixture meshes (ADR-411). */
const LIGHT_FIXTURE_MESH_CATEGORY = 'light-fixture';

export class MepFixtureRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepFixtureEntity(entity)) return;
    const fixture = entity as MepFixtureEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'light-fixture' → electrical; ADR-408 Φ14 floor-drain → the
    // 'drain-pipe' category (plumbing), so it hides with the «Αποχέτευση» toggle.
    const category = resolveFixtureBimCategory(fixture.params);
    const layer = fixture.layerId ? getLayer(fixture.layerId) : null;
    if (!resolveIsEntityVisible(
      { category, layerId: fixture.layerId, discipline: fixture.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

    if (!fixture.geometry || !fixture.params) return;
    const verts = fixture.geometry.footprint.vertices;
    if (verts.length < 3) return;

    // ADR-408 Φ5 — colour-by-system: a fixture wired into a circuit paints with
    // the System's colour; unassigned fixtures keep the amber default.
    // ADR-408 Φ7 — gated by the per-view `colorBySystem` master toggle: OFF ⇒
    // every fixture keeps the amber default regardless of circuit assignment.
    const colorBySystem = useDrawingScaleStore.getState().colorBySystem;
    const systems = useMepSystemStore.getState().getSystems();
    const systemColor = colorBySystem && systems.length > 0
      ? resolveEntitySystemColor(fixture.id, getEntitySystemColorIndexCached(systems))
      : null;
    // ADR-408 Φ14 — a floor drain defaults to the sanitary-drainage brown (mirror
    // of MepFittingRenderer/MepSegmentRenderer); a System membership still wins.
    const drainColor = fixture.params.kind === 'floor-drain'
      ? resolveSegmentClassificationColor('sanitary-drainage')
      : null;
    const defaultStroke = drainColor ?? FIXTURE_STROKE;
    const defaultFill = drainColor ? hexToRgba(drainColor, SYSTEM_FILL_ALPHA) : FIXTURE_FILL;
    const strokeColor = systemColor ?? defaultStroke;
    const fillColor = systemColor ? hexToRgba(systemColor, SYSTEM_FILL_ALPHA) : defaultFill;

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

    // ADR-411 — a fixture carrying an `assetId` paints the per-asset top-view
    // silhouette + interior detail lines (shared SSoT); the colour-by-system
    // stroke/fill still tints it. Falls back to the parametric family-symbol
    // until the glTF (and its silhouette) has loaded, or when no asset is set.
    const assetId = fixture.params.assetId;
    const meshDrew = assetId
      ? drawMeshSilhouette({
          ctx: this.ctx,
          worldToScreen: (p) => this.worldToScreen(p),
          silhouette: bimMeshCache.getSilhouette(LIGHT_FIXTURE_MESH_CATEGORY, assetId),
          edges: bimMeshCache.getTopEdges(LIGHT_FIXTURE_MESH_CATEGORY, assetId),
          transform: {
            position: fixture.params.position,
            rotationDeg: fixture.params.rotation,
            sceneUnits: fixture.params.sceneUnits ?? 'mm',
          },
          palette: { stroke: strokeColor, fill: fillColor, edge: hexToRgba(strokeColor, 0.55) },
          lineWidth: RENDER_LINE_WIDTHS.NORMAL,
        })
      : false;

    if (!meshDrew) {
      // Fill + outline (colour-by-system override, ADR-408 Φ5).
      this.ctx.fillStyle = fillColor;
      this.drawPolygonPath(verts);
      this.ctx.fill();
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
      this.drawPolygonPath(verts);
      this.ctx.stroke();

      // Family symbol strokes (the luminaire "X").
      const symbol = buildFixtureSymbol(fixture.params, fixture.geometry);
      for (const stroke of symbol.strokes) {
        if (stroke.length < 2) continue;
        this.ctx.beginPath();
        const start = this.worldToScreen({ x: stroke[0].x, y: stroke[0].y });
        this.ctx.moveTo(start.x, start.y);
        for (let i = 1; i < stroke.length; i++) {
          const s = this.worldToScreen({ x: stroke[i].x, y: stroke[i].y });
          this.ctx.lineTo(s.x, s.y);
        }
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-406 v0.6 — parametric grips: move (centre) + rotation + 4 corner
    // resize (rectangular) or move + diameter (circular). Mirror of
    // `ColumnRenderer.getGrips`; the move/rotation handles get their icon glyph
    // from the shared `gripGlyphShape` registry SSoT, corners stay square.
    // Drag is routed through `applyMepFixtureGripDrag()` + `UpdateMepFixtureParamsCommand`
    // by `commitMepFixtureGripDrag` (grip-parametric-commits).
    if (!isMepFixtureEntity(entity)) return [];
    return getMepFixtureGrips(entity as MepFixtureEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? ('center' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
      shape: gripGlyphShape(g.mepFixtureGripKind),
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepFixtureEntity(entity)) return false;
    const fixture = entity as MepFixtureEntity;
    const bb = fixture.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    return pointInPolygon(point, fixture.geometry.footprint.vertices);
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
