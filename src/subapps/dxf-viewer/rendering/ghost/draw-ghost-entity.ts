/**
 * SSOT — draw-ghost-entity
 *
 * Pure 2D-canvas renderer for a single DXF entity drawn as a translucent
 * ghost overlay. Caller pre-configures `ctx.strokeStyle`, `ctx.fillStyle`,
 * `ctx.lineWidth` and `ctx.globalAlpha` (see GHOST_DEFAULTS in `./index`)
 * before invoking — this keeps per-call overhead minimal during the RAF
 * loop and allows batch-rendering multiple entities in one save/restore.
 *
 * The entity passed in is assumed to be already at its final (preview)
 * position. Use `applyEntityPreview()` first if you have a raw entity +
 * preview transform.
 *
 * Extracted from `useMovePreview.drawTranslatedGhostEntity` (ADR-049).
 * Now shared with the grip-drag ghost path via `useGripGhostPreview`.
 *
 * @see ./apply-entity-preview — companion transform
 * @see ./index — GHOST_DEFAULTS style constants
 */

import type { Point2D, ViewTransform, Viewport } from '../types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { ColumnParams } from '../../bim/types/column-types';
import { drawOpeningPlanOverlay } from '../../bim/renderers/opening-overlay-drawing';
// ADR-456/460 (Giorgio 2026-06-16) — live ghost rebar during column grip-drag/resize.
// Reuses the SAME pure 2Δ rebar SSoT as the committed cache pass (drawColumnRebar2D),
// gated by the same visibility toggle, so the preview matches the commit 1:1.
import { drawColumnRebar2D } from '../../bim/renderers/column-rebar-2d';
// ADR-471 — live ghost rebar (δοκάρι) κατά το grip-drag/resize (mirror της κολώνας).
import { drawBeamRebar2D } from '../../bim/renderers/beam-rebar-2d';
import type { BeamEntity, BeamParams } from '../../bim/types/beam-types';
import { isReinforcementVisible } from '../../bim/structural/reinforcement/rebar-visibility';
import { mmToSceneUnits } from '../../utils/scene-units';
import { CoordinateTransforms } from '../core/CoordinateTransforms';

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  verts: ReadonlyArray<{ x: number; y: number }>,
  toScreen: (p: { x: number; y: number }) => { x: number; y: number },
): void {
  ctx.beginPath();
  const first = toScreen(verts[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < verts.length; i++) {
    const p = toScreen(verts[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
}

export function drawGhostEntity(
  ctx: CanvasRenderingContext2D,
  entity: DxfEntityUnion,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  // Imported DXF may carry runtime type 'mtext' — treat it as 'text' for ghost rendering.
  if ((entity as { type: string }).type === 'mtext') {
    return drawGhostEntity(ctx, { ...entity, type: 'text' } as unknown as DxfEntityUnion, transform, viewport);
  }

  const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, transform, viewport);

  switch (entity.type) {
    case 'line': {
      const s = toScreen(entity.start);
      const e = toScreen(entity.end);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      return;
    }

    case 'circle': {
      const c = toScreen(entity.center);
      const r = entity.radius * transform.scale;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    case 'arc': {
      const c = toScreen(entity.center);
      const r = entity.radius * transform.scale;
      const startRad = (entity.startAngle * Math.PI) / 180;
      const endRad = (entity.endAngle * Math.PI) / 180;
      // Canvas Y axis is flipped vs world → negate angles AND flip direction
      // (mirrors ArcRenderer: screenCounterclockwise = !counterclockwise)
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, -startRad, -endRad, !(entity.counterclockwise ?? false));
      ctx.stroke();
      return;
    }

    case 'polyline': {
      if (entity.vertices.length < 2) return;
      ctx.beginPath();
      const first = toScreen(entity.vertices[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < entity.vertices.length; i++) {
        const p = toScreen(entity.vertices[i]);
        ctx.lineTo(p.x, p.y);
      }
      if (entity.closed) ctx.closePath();
      ctx.stroke();
      return;
    }

    case 'text': {
      // Cast wide: imported entities carry flat `.text`, while TEXT-tool entities
      // carry only `.textNode` (Phase 6.E AST) — flatten both for the ghost.
      const e = entity as DxfEntityUnion & {
        position?: Point2D;
        text?: string;
        height?: number;
        textNode?: { paragraphs?: Array<{ runs?: Array<{ text?: string }> }> };
      };
      if (!e.position) return;
      const pos = toScreen(e.position);
      const flatText = e.text
        ?? e.textNode?.paragraphs
             ?.flatMap(p => p.runs ?? [])
             .map(r => r.text ?? '')
             .join('')
        ?? '';
      if (!flatText) return;
      const height = e.height ?? 12;
      const fontSize = Math.max(8, height * transform.scale);
      ctx.save();
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(flatText, pos.x, pos.y);
      ctx.restore();
      return;
    }

    case 'angle-measurement': {
      const v = toScreen(entity.vertex);
      const p1 = toScreen(entity.point1);
      const p2 = toScreen(entity.point2);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(v.x, v.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      return;
    }

    // ADR-358 Phase 5d — parametric stair ghost. Renders the stringer
    // perimeter (closed polygon: outer forward + inner reversed) so the
    // ghost matches the perceived silhouette during grip drag. Treads /
    // walkline / arrow are intentionally skipped — for a fast RAF loop the
    // perimeter alone delivers the AutoCAD-style "I see where it lands"
    // feedback without per-frame full re-render.
    case 'stair': {
      const stair = (entity as unknown as {
        stairEntity?: {
          geometry?: {
            stringers?: { inner: Array<Point2D>; outer: Array<Point2D> };
          };
        };
        geometry?: {
          stringers?: { inner: Array<Point2D>; outer: Array<Point2D> };
        };
      });
      const stringers = stair.stairEntity?.geometry?.stringers ?? stair.geometry?.stringers;
      if (!stringers || stringers.outer.length < 2 || stringers.inner.length < 2) return;
      ctx.beginPath();
      const first = toScreen(stringers.outer[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < stringers.outer.length; i++) {
        const p = toScreen(stringers.outer[i]);
        ctx.lineTo(p.x, p.y);
      }
      for (let i = stringers.inner.length - 1; i >= 0; i--) {
        const p = toScreen(stringers.inner[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    }

    // ADR-363 Phase 1C — parametric wall ghost. Renders the closed silhouette
    // (outerEdge forward + innerEdge reversed) so the ghost matches the wall
    // footprint during grip drag (mirrors stair perimeter pattern).
    case 'wall': {
      const wall = entity as unknown as {
        geometry?: {
          outerEdge?: { points: Array<{ x: number; y: number }> };
          innerEdge?: { points: Array<{ x: number; y: number }> };
        };
      };
      const outer = wall.geometry?.outerEdge?.points ?? [];
      const inner = wall.geometry?.innerEdge?.points ?? [];
      if (outer.length < 2 || inner.length < 2) return;
      ctx.beginPath();
      const first = toScreen(outer[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < outer.length; i++) {
        const p = toScreen(outer[i]);
        ctx.lineTo(p.x, p.y);
      }
      for (let i = inner.length - 1; i >= 0; i--) {
        const p = toScreen(inner[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    }

    // ADR-363 Phase 5.5 — beam ghost: plan-view outline (closed polygon).
    case 'beam': {
      const beam = entity as unknown as {
        geometry?: {
          outline?: { vertices: ReadonlyArray<{ x: number; y: number }> };
          axisPolyline?: { points: ReadonlyArray<{ x: number; y: number }> };
        };
        params?: BeamParams;
      };
      const verts = beam.geometry?.outline?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      // ADR-471 (parity με κολόνα) — LIVE ghost rebar κατά το drag. Το preview entity φέρει
      // auto-aware `params` (applyEntityPreview → applyBeamGripDrag), ώστε το `drawBeamRebar2D`
      // να re-derive-άρει φρέσκο design από την ΤΡΑΒΗΓΜΕΝΗ γεωμετρία (auto) ή το stored (manual).
      // Ίδιο pure SSoT + visibility gate με το committed cache pass (drawMemberReinforcement2D).
      if (beam.params && beam.geometry?.axisPolyline && isReinforcementVisible()) {
        const pxPerMm = mmToSceneUnits(beam.params.sceneUnits ?? 'mm') * transform.scale;
        drawBeamRebar2D(ctx, entity as unknown as Pick<BeamEntity, 'params' | 'geometry'>, pxPerMm, toScreen);
      }
      return;
    }

    // ADR-363 Phase 3.5 — slab ghost: outline polygon from raw SlabEntity.params.
    // entity is a raw SlabEntity from scene.entities (not a DxfSlab wrapper).
    case 'slab': {
      const slab = entity as unknown as {
        params?: { outline?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = slab.params?.outline?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-363 Phase 3.7a — slab-opening ghost: outline polygon from raw SlabOpeningEntity.params.
    case 'slab-opening': {
      const so = entity as unknown as {
        params?: { outline?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = so.params?.outline?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-417 Φ1-part-2 #2 — roof ghost: footprint polygon from raw RoofEntity.params.
    // entity is a raw RoofEntity from scene.entities (DIRECT, not a wrapper);
    // `applyRoofGripDrag` mutates `params.outline.vertices` so the live footprint
    // follows the dragged vertex / inserted midpoint (mirror slab).
    case 'roof': {
      const roof = entity as unknown as {
        params?: { outline?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = roof.params?.outline?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-419 — floor-finish ghost: footprint polygon from raw FloorFinishEntity.params
    // (params-level, mirror slab/roof — `applyFloorFinishGripDrag` mutates
    // `params.footprint.vertices`). Was missing → the live vertex-drag ghost never painted.
    case 'floor-finish': {
      const finish = entity as unknown as {
        params?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = finish.params?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-397 — column ghost: footprint polygon (scene-units, from ColumnGeometry).
    // Mirror beam/slab so the live move/rotation/resize ghost paints.
    case 'column': {
      const col = entity as unknown as {
        geometry?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
        params?: ColumnParams;
      };
      const verts = col.geometry?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      // ADR-456/460 (Giorgio 2026-06-16) — LIVE ghost rebar during the drag. The preview
      // entity carries auto-aware `params` (applyEntityPreview → applyColumnGripDrag), so
      // `drawColumnRebar2D` re-derives a fresh code design from the DRAGGED geometry in
      // real-time (auto) — or paints the locked stored design (manual). Same pure SSoT +
      // visibility gate as the committed cache pass (DxfRenderer.drawColumnReinforcement2D);
      // inherits the ghost's translucent alpha (no style override → reads as a ghost).
      if (col.params && isReinforcementVisible()) {
        const pxPerMm = mmToSceneUnits(col.params.sceneUnits ?? 'mm') * transform.scale;
        drawColumnRebar2D(ctx, col.params, pxPerMm, toScreen);
      }
      return;
    }

    // ADR-436 Slice 1c — foundation ghost: footprint polygon (from FoundationGeometry).
    // Mirror column so the live move / corner-edge resize / rotation ghost paints.
    // (Before Slice 1c there was NO foundation case → the pad drag rendered no
    // live ghost even though `applyFoundationGripDrag` transformed it correctly.)
    case 'foundation': {
      const fnd = entity as unknown as {
        geometry?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = fnd.geometry?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-406 — MEP fixture ghost: footprint polygon (scene-units, from
    // MepFixtureGeometry). Mirror column so the live move/rotation/resize ghost paints.
    case 'mep-fixture': {
      const fix = entity as unknown as {
        geometry?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = fix.geometry?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-408 Φ3 — electrical panel ghost: footprint polygon (scene-units, from
    // ElectricalPanelGeometry). Mirror mep-fixture so the live move/rotation/resize
    // ghost paints.
    case 'electrical-panel': {
      const panel = entity as unknown as {
        geometry?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = panel.geometry?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-408 Φ12 — MEP manifold ghost: footprint polygon (scene-units, from
    // MepManifoldGeometry). Mirror electrical-panel so the live move/rotation/resize
    // ghost paints.
    case 'mep-manifold': {
      const manifold = entity as unknown as {
        geometry?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = manifold.geometry?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-408 Εύρος Β — heating radiator ghost: footprint polygon (scene-units,
    // from MepRadiatorGeometry). Mirror mep-manifold so the live
    // move/rotation/corner-resize ghost paints.
    case 'mep-radiator': {
      const radiator = entity as unknown as {
        geometry?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = radiator.geometry?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-408 Εύρος Β #2 — heating boiler ghost: footprint polygon (scene-units,
    // from MepBoilerGeometry). Mirror mep-radiator so the live
    // move/rotation/corner-resize ghost paints.
    case 'mep-boiler': {
      const boiler = entity as unknown as {
        geometry?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = boiler.geometry?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-408 DHW — domestic hot water heater ghost: footprint polygon (scene-units,
    // from MepWaterHeaterGeometry). Mirror mep-boiler so the live
    // move/rotation/corner-resize ghost paints.
    case 'mep-water-heater': {
      const wh = entity as unknown as {
        geometry?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = wh.geometry?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-408 Εύρος Β #3 — underfloor heating ghost: footprint polygon (world mm,
    // from MepUnderfloorParams). Area-based entity — uses params.footprint.vertices
    // directly (like floor-finish/slab), NOT geometry.footprint (which doesn't exist).
    case 'mep-underfloor': {
      const uf = entity as unknown as {
        params?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = uf.params?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-410 — furniture ghost: footprint polygon (scene-units, from
    // FurnitureGeometry). Mirror mep-fixture/electrical-panel so the live
    // move/rotation/corner-resize ghost paints.
    case 'furniture': {
      const furn = entity as unknown as {
        geometry?: { footprint?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = furn.geometry?.footprint?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-408 Φ8 — MEP segment ghost: plan-view outline polygon (section-width ×
    // axis length). Mirrors the beam/column pattern: read geometry.outline.vertices.
    case 'mep-segment': {
      const seg = entity as unknown as {
        geometry?: { outline?: { vertices: ReadonlyArray<{ x: number; y: number }> } };
      };
      const verts = seg.geometry?.outline?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      return;
    }

    // ADR-363 Phase 2.5 — opening ghost: cutout rectangle outline from raw OpeningEntity.geometry.
    // ADR-363 Φ1G.5 Slice 2 — also draw the kind-specific plan symbol (door swing
    // arc + leaf line, window glazing, …) via the renderer SSoT so the move ghost
    // shows WHERE the door ends, not just the cutout. Derived purely from the
    // (recomputed) geometry/outline, so it tracks the slide / re-host preview.
    case 'opening': {
      const opening = entity as unknown as OpeningEntity;
      const verts = opening.geometry?.outline?.vertices ?? [];
      if (verts.length < 2) return;
      drawPolygon(ctx, verts, toScreen);
      drawOpeningPlanOverlay(opening, { ctx, toScreen, lineWidth: ctx.lineWidth || 1 });
      return;
    }

    default:
      return;
  }
}
