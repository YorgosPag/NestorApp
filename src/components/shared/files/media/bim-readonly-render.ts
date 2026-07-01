/**
 * ADR-370 — Read-only BIM render façade for Properties floorplan tab.
 *
 * Instantiates the existing `BaseEntityRenderer` subclasses from the DXF Viewer
 * subapp and draws hydrated BIM entities onto the same canvas used by
 * `renderDxfToCanvas`. The synthetic `ViewTransform` from
 * `buildBimViewTransform()` aligns `CoordinateTransforms.worldToScreen` with
 * the DXF renderer pixel space, so BIM fills and DXF geometry stack with zero
 * misalignment.
 *
 * SSoT contract:
 *  - Reuses `WallRenderer`, `SlabRenderer`, `BeamRenderer`, `ColumnRenderer`,
 *    `OpeningRenderer`, `SlabOpeningRenderer` verbatim — no duplication.
 *  - Read-only: `grips: false`, no hover, no selection halo.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md
 */

import type { PanOffset } from '@/hooks/useZoomPan';

import { WallRenderer, type OpeningsByWall } from '@/subapps/dxf-viewer/bim/renderers/WallRenderer';
import { SlabRenderer, type SlabOpeningsBySlab } from '@/subapps/dxf-viewer/bim/renderers/SlabRenderer';
import { BeamRenderer } from '@/subapps/dxf-viewer/bim/renderers/BeamRenderer';
import { ColumnRenderer } from '@/subapps/dxf-viewer/bim/renderers/ColumnRenderer';
import { OpeningRenderer } from '@/subapps/dxf-viewer/bim/renderers/OpeningRenderer';
import { SlabOpeningRenderer } from '@/subapps/dxf-viewer/bim/renderers/SlabOpeningRenderer';
import { StairRenderer } from '@/subapps/dxf-viewer/bim/renderers/StairRenderer';

import type { OpeningEntity } from '@/subapps/dxf-viewer/bim/types/opening-types';
import type { SlabOpeningEntity } from '@/subapps/dxf-viewer/bim/types/slab-opening-types';
import type { RenderOptions } from '@/subapps/dxf-viewer/rendering/types/Types';

import {
  buildBimViewTransform,
  type SceneBounds,
} from '@/components/shared/files/media/bim-canvas-transform';
import type { FloorplanBimSnapshot } from '@/components/shared/files/media/useFloorplanBimEntities';

const READONLY_OPTIONS: RenderOptions = { grips: false, hovered: false };

function buildOpeningsByWall(openings: ReadonlyArray<OpeningEntity>): OpeningsByWall {
  const map = new Map<string, OpeningEntity[]>();
  for (const o of openings) {
    const wid = o.params.wallId;
    const bucket = map.get(wid);
    if (bucket) bucket.push(o);
    else map.set(wid, [o]);
  }
  return map as OpeningsByWall;
}

function buildSlabOpeningsBySlab(
  slabOpenings: ReadonlyArray<SlabOpeningEntity>,
): SlabOpeningsBySlab {
  const map = new Map<string, SlabOpeningEntity[]>();
  for (const so of slabOpenings) {
    const sid = so.params.slabId;
    if (!sid) continue;
    const bucket = map.get(sid);
    if (bucket) bucket.push(so);
    else map.set(sid, [so]);
  }
  return map as SlabOpeningsBySlab;
}

export function renderBimEntitiesToCanvas(
  canvas: HTMLCanvasElement,
  snapshot: FloorplanBimSnapshot,
  bounds: SceneBounds,
  zoom: number,
  panOffset: PanOffset,
): void {
  if (snapshot.isLoading || !snapshot.hasAny) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { transform } = buildBimViewTransform(
    bounds,
    canvas.width,
    canvas.height,
    zoom,
    panOffset,
  );

  const wallRenderer = new WallRenderer(ctx);
  const slabRenderer = new SlabRenderer(ctx);
  const beamRenderer = new BeamRenderer(ctx);
  const columnRenderer = new ColumnRenderer(ctx);
  const openingRenderer = new OpeningRenderer(ctx);
  const slabOpeningRenderer = new SlabOpeningRenderer(ctx);
  const stairRenderer = new StairRenderer(ctx);

  wallRenderer.setTransform(transform);
  slabRenderer.setTransform(transform);
  beamRenderer.setTransform(transform);
  columnRenderer.setTransform(transform);
  openingRenderer.setTransform(transform);
  slabOpeningRenderer.setTransform(transform);
  stairRenderer.setTransform(transform);

  wallRenderer.setOpeningsByWall(buildOpeningsByWall(snapshot.openings));
  // ADR-509 §axis-clip — κόψε τον άξονα τοίχου στην παρειά κολώνας (parity με live render).
  wallRenderer.setColumnFootprints(
    snapshot.columns
      .map((c) => c.geometry?.footprint?.vertices)
      .filter((v): v is NonNullable<typeof v> => !!v && v.length >= 3),
  );
  slabRenderer.setSlabOpeningsBySlab(buildSlabOpeningsBySlab(snapshot.slabOpenings));

  ctx.save();
  for (const slab of snapshot.slabs) slabRenderer.render(slab, READONLY_OPTIONS);
  for (const wall of snapshot.walls) wallRenderer.render(wall, READONLY_OPTIONS);
  for (const beam of snapshot.beams) beamRenderer.render(beam, READONLY_OPTIONS);
  for (const column of snapshot.columns) columnRenderer.render(column, READONLY_OPTIONS);
  for (const opening of snapshot.openings) openingRenderer.render(opening, READONLY_OPTIONS);
  for (const so of snapshot.slabOpenings) slabOpeningRenderer.render(so, READONLY_OPTIONS);
  for (const stair of snapshot.stairs) stairRenderer.render(stair, READONLY_OPTIONS);
  ctx.restore();
}
