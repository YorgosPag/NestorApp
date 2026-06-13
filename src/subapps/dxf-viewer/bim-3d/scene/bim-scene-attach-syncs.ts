import * as THREE from 'three';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { wallToMesh, columnToMesh } from '../converters/BimToThreeConverter';
import { buildWallHostInputs, makeWallTopContext, makeWallBaseContext } from '../../bim/geometry/wall-host-plan-builder';
import { resolveWallTopProfile, resolveWallNominalTopZmm, resolveWallBaseZmm } from '../../bim/geometry/wall-top-profile';
import { resolveWallBaseProfile } from '../../bim/geometry/wall-base-profile';
import { wallTopFaceCrossingBreakpoints, type WallTopClipContext } from '../converters/wall-top-clip';
import {
  resolveColumnTopProfile,
  resolveColumnBaseProfile,
  resolveColumnNominalTopZmm,
  resolveColumnBaseZmm,
  makeColumnHostResolver,
} from '../../bim/geometry/column-vertical-profile';
import { filterHostedOpenings } from './bim-scene-hosted-opening-filters';
import type { SyncContext } from './bim-scene-context';
import type { EntityResolution } from './BimSceneLayer';
import type { BimCategory } from '../../config/bim-object-styles';
import type { Discipline } from '../../bim/discipline/bim-discipline';

type ResolveEntity = (
  entity: { id?: string; layerId?: string; discipline?: Discipline },
  category: BimCategory,
  ctx: SyncContext,
) => EntityResolution | null;

export function syncWalls(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  resolveEntity: ResolveEntity,
): void {
  const hasAttached = entities.walls.some(
    (w) => w.params?.topBinding === 'attached' || w.params?.baseBinding === 'attached',
  );
  const hostInputs = hasAttached
    ? buildWallHostInputs(entities.beams, entities.slabs, entities.roofs)
    : [];

  for (const wall of entities.walls) {
    const r = resolveEntity(wall, 'wall', ctx);
    if (!r) continue;
    const openingsForWall = filterHostedOpenings(
      entities.openings, 'wallId', wall.id, r.buildingMode, ctx,
    );
    const start = { x: wall.params.start.x, y: wall.params.start.y };
    const end = { x: wall.params.end.x, y: wall.params.end.y };
    // ADR-448 Phase 1b — storey ceiling feeds the vertical context so a
    // `storey-ceiling` wall (the default) reaches the real next floor.
    const topBase = { floorElevationMm: ctx.floorElevationMm, nextFloorElevationMm: ctx.nextFloorElevationMm };
    const profile = wall.params?.topBinding === 'attached'
      ? resolveWallTopProfile(wall.params, makeWallTopContext(start, end, hostInputs, topBase))
      : undefined;
    const attachHosts = (wall.params?.topBinding === 'attached' && wall.kind === 'straight')
      ? hostInputs.filter((h) => wall.params.attachTopToIds?.includes(h.hostId))
      : null;
    const topClip: WallTopClipContext | undefined = attachHosts
      ? {
          hosts: attachHosts,
          nominalTopMm: resolveWallNominalTopZmm(wall.params, topBase),
          breakpoints: wallTopFaceCrossingBreakpoints(wall.geometry, attachHosts),
        }
      : undefined;
    const baseProfile = wall.params?.baseBinding === 'attached'
      ? resolveWallBaseProfile(
          wall.params,
          makeWallBaseContext(start, end, hostInputs, { floorElevationMm: ctx.floorElevationMm }),
        )
      : undefined;
    // ADR-448 1b — render height for a non-attached `storey-ceiling` wall = real
    // ceiling − base (SSoT resolver). Without storey context this ≡ params.height.
    // Degenerate params (missing height/offset) → undefined → legacy fallback.
    const rawWallTop = resolveWallNominalTopZmm(wall.params, topBase) - resolveWallBaseZmm(wall.params, topBase);
    const nominalHeightMm = Number.isFinite(rawWallTop) ? rawWallTop : undefined;
    const mesh = wallToMesh(
      wall, openingsForWall, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation, profile, baseProfile, topClip, nominalHeightMm,
    );
    if (mesh) { mesh.userData['buildingId'] = r.buildingId; group.add(mesh); }
  }
}

export function syncColumns(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  resolveEntity: ResolveEntity,
): void {
  const hasAttached = entities.columns.some(
    (c) => c.params?.topBinding === 'attached' || c.params?.baseBinding === 'attached',
  );
  const resolveHostInput = hasAttached
    ? makeColumnHostResolver(buildWallHostInputs(entities.beams, entities.slabs))
    : undefined;

  for (const column of entities.columns) {
    const r = resolveEntity(column, 'column', ctx);
    if (!r) continue;
    const topAttached = column.params?.topBinding === 'attached';
    const baseAttached = column.params?.baseBinding === 'attached';
    // ADR-448 Phase 1b — storey ceiling for `storey-ceiling` columns (mirror wall).
    const colVctx = { floorElevationMm: ctx.floorElevationMm, nextFloorElevationMm: ctx.nextFloorElevationMm };
    let topProfile, baseProfile;
    const footVerts = column.geometry?.footprint?.vertices;
    if ((topAttached || baseAttached) && footVerts && footVerts.length >= 3) {
      const footprint = footVerts.map((v) => ({ x: v.x, y: v.y }));
      const colCtx = { ...colVctx, resolveHostInput };
      topProfile = topAttached ? resolveColumnTopProfile(column.params, footprint, colCtx) : undefined;
      baseProfile = baseAttached ? resolveColumnBaseProfile(column.params, footprint, colCtx) : undefined;
    }
    // Non-attached `storey-ceiling` column render height = ceiling − base (SSoT).
    // Degenerate params → undefined → legacy fallback to params.height.
    const rawColTop = resolveColumnNominalTopZmm(column.params, colVctx) - resolveColumnBaseZmm(column.params, colVctx);
    const nominalHeightMm = Number.isFinite(rawColTop) ? rawColTop : undefined;
    const mesh = columnToMesh(
      column, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation, topProfile, baseProfile, nominalHeightMm,
      entities.walls, // ADR-449 Slice 2 — obstacles + exterior classifier για τον σοβά
      entities.beams, // ADR-449 Slice 6 — mutual obstacles (junction κολόνας↔δοκαριού)
      true, // ADR-449 Slice 7 — ο scene-level ενιαίος σοβάς (silhouette) αναλαμβάνει το skin
    );
    if (mesh) { mesh.userData['buildingId'] = r.buildingId; group.add(mesh); }
  }
}
