/**
 * ADR-370 — Read-only BIM render façade for Properties floorplan tab.
 *
 * ADR-370 v2 (full parity, big-players): drives the SAME
 * `EntityRendererComposite` the DXF Viewer uses (`createEntityRenderers` SSoT
 * registry) instead of a hand-maintained renderer subset. Any persisted BIM
 * entity type the editor can draw (walls, slabs, columns, openings, stairs,
 * hatches — incl. material image fills — foundations, furniture, …) renders
 * here verbatim, non-interactively. Adding a new type never needs a change in
 * this file again — the registry is the single source of truth.
 *
 * The synthetic `ViewTransform` from `buildBimViewTransform()` aligns
 * `CoordinateTransforms.worldToScreen` with the DXF renderer pixel space, so
 * BIM fills and DXF geometry stack with zero misalignment.
 *
 * SSoT contract:
 *  - Reuses `EntityRendererComposite` + every `BaseEntityRenderer` subclass
 *    verbatim — no duplicated renderer, no per-type list to drift (N.18).
 *  - Read-only: `grips: false`, no hover, no selection halo.
 *  - Async assets (hatch material images, furniture meshes) decode off-thread
 *    and signal a redraw through `subscribeImageAssetReady` (ADR-654), which the
 *    canvas render effect listens to.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md
 */

import type { PanOffset } from '@/hooks/useZoomPan';

import { EntityRendererComposite } from '@/subapps/dxf-viewer/rendering/core/EntityRendererComposite';
import type { OpeningsByWall } from '@/subapps/dxf-viewer/bim/renderers/WallRenderer';
import type { SlabOpeningsBySlab } from '@/subapps/dxf-viewer/bim/renderers/SlabRenderer';

import {
  isWallHostedOpening,
  type OpeningEntity,
} from '@/subapps/dxf-viewer/bim/types/opening-types';
import type { SlabOpeningEntity } from '@/subapps/dxf-viewer/bim/types/slab-opening-types';
import type { Entity } from '@/subapps/dxf-viewer/types/entities';
import type { RenderOptions } from '@/subapps/dxf-viewer/rendering/types/Types';

import {
  buildBimViewTransform,
  type SceneBounds,
} from '@/components/shared/files/media/bim-canvas-transform';
import type { FloorplanBimSnapshot } from '@/components/shared/files/media/useFloorplanBimEntities';

const READONLY_OPTIONS: RenderOptions = { grips: false, hovered: false };

/**
 * Persist ONE composite per canvas. The composite's renderers own async asset
 * caches (hatch material images, segment geometry); recreating them every paint
 * would discard the decoded image between the async-load redraw and the repaint,
 * spinning an infinite reload→bump→repaint loop. A per-canvas instance keeps the
 * cache warm so the second paint (triggered by `subscribeImageAssetReady`) hits
 * it and terminates. Keyed weakly so a detached canvas is GC'd with its composite.
 */
const compositeByCanvas = new WeakMap<HTMLCanvasElement, EntityRendererComposite>();

function getComposite(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): EntityRendererComposite {
  let composite = compositeByCanvas.get(canvas);
  if (!composite) {
    composite = new EntityRendererComposite(ctx);
    compositeByCanvas.set(canvas, composite);
  }
  return composite;
}

function buildOpeningsByWall(openings: ReadonlyArray<OpeningEntity>): OpeningsByWall {
  const map = new Map<string, OpeningEntity[]>();
  for (const o of openings) {
    // ADR-615 — a self-hosted opening has no host wall, so it belongs to no bucket.
    if (!isWallHostedOpening(o)) continue;
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

/**
 * Assemble the draw list in painter order (bottom → top). 2D z-order = array
 * order (SSoT). Material hatches sit under the structural bodies; furniture is
 * an interior overlay above the shell; stairs cap the list.
 */
function orderedDrawList(snapshot: FloorplanBimSnapshot): Entity[] {
  return [
    ...snapshot.hatches,
    ...snapshot.slabs,
    ...snapshot.foundations,
    ...snapshot.walls,
    ...snapshot.beams,
    ...snapshot.columns,
    ...snapshot.openings,
    ...snapshot.slabOpenings,
    ...snapshot.furnitures,
    ...snapshot.stairs,
  ];
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

  const composite = getComposite(canvas, ctx);
  composite.setTransform(transform);

  // Per-frame cross-entity indices (parity with the live DxfRenderer pass).
  composite.setOpeningsByWall(buildOpeningsByWall(snapshot.openings));
  // ADR-509 §axis-clip — cut the wall axis at the column face (parity with live render).
  composite.setColumnFootprints(
    snapshot.columns
      .map((c) => c.geometry?.footprint?.vertices)
      .filter((v): v is NonNullable<typeof v> => !!v && v.length >= 3),
  );
  composite.setSlabOpeningsBySlab(buildSlabOpeningsBySlab(snapshot.slabOpenings));

  ctx.save();
  // renderEntities skips `visible === false` and dispatches each entity to its
  // registered renderer (unknown types are a no-op warn, never a throw).
  composite.renderEntities(orderedDrawList(snapshot), READONLY_OPTIONS);
  ctx.restore();
}
