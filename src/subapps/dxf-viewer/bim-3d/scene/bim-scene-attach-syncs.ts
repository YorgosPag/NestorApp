import * as THREE from 'three';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { wallToMesh, columnToMesh } from '../converters/BimToThreeConverter';
import { buildWallHostInputs, makeWallTopContext, makeWallBaseContext } from '../../bim/geometry/wall-host-plan-builder';
// ADR-534 §monolithic-cut — top-clip κολόνας στο soffit καλύπτουσας πλάκας (μηδέν z-fighting).
import { buildCeilingSlabHosts, resolveMemberTopClipZmm } from './monolithic-slab-clip';
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
import { isColumnTilted } from '../../bim/geometry/column-tilt';
// ADR-488 §6.1 — DERIVED effective βάση κολώνας (στατική συνέχεια κολώνα→πέδιλο).
import { ColumnBaseContinuityStore } from '../../bim/structural/organism/column-base-continuity-store';
import { filterHostedOpenings } from './bim-scene-hosted-opening-filters';
import { buildWallFootprintRing } from '../../bim/geometry/wall-geometry';
import { computeWallCrossCutters, type WallCrossInput } from '../../bim/walls/wall-cross-cutback';
import type { SyncContext } from './bim-scene-context';
import type { EntityResolution } from './BimSceneLayer';
import type { BimCategory } from '../../config/bim-object-styles';
import type { Discipline } from '../../bim/discipline/bim-discipline';
import type { Point3D } from '../../bim/types/bim-base';

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

  // ADR-449 #2 — column footprints για embed άκρης τοίχου που κουμπώνει σε κολόνα
  // (3Δ-only z-fight fix· wallToMesh βυθίζει την άκρη μέσα στο μπετόν). Render-only.
  const columnFootprints = entities.columns
    .map((c) => c.geometry?.footprint?.vertices)
    .filter((v): v is readonly Point3D[] => !!v && v.length >= 3);

  // ADR-458 (wall↔wall cross) — winner-wall cutters ανά τοίχο (priority): σε διασταύρωση Χ ο
  // νικητής μένει ακέραιος, ο loser κόβεται στην τομή (πραγματικό notch 3Δ). Ένα O(n²) pass για
  // όλους τους τοίχους· DERIVED, ίδιο SSoT με 2Δ/BOQ. Canvas units (scaled σε μέτρα στο wallToMesh).
  const wallCrossInputs: WallCrossInput[] = [];
  for (const w of entities.walls) {
    if (w.kind !== 'straight' || !w.geometry) continue;
    const ring = buildWallFootprintRing(w.geometry.outerEdge.points, w.geometry.innerEdge.points);
    if (ring.length >= 3) wallCrossInputs.push({ id: w.id, params: w.params, footprint: ring });
  }
  const wallCrossCutterMap = computeWallCrossCutters(wallCrossInputs);

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
    const wallCrossFootprints = (wallCrossCutterMap.get(wall.id) ?? [])
      .map((r2) => r2.map((p) => ({ x: p.x, y: p.y, z: 0 })));
    const mesh = wallToMesh(
      wall, openingsForWall, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation, profile, baseProfile, topClip, nominalHeightMm,
      columnFootprints, wallCrossFootprints,
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
  // ADR-534 §monolithic-cut — host inputs πλακών (soffit) → η κορυφή κάθε κολόνας κόβεται όπου την
  // καλύπτει πλάκα οροφής (μηδέν z-fighting). Άδειο → no-op (byte-for-byte).
  const slabHosts = buildCeilingSlabHosts(entities.slabs);

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
    const colTopMm = resolveColumnNominalTopZmm(column.params, colVctx);
    const colBaseMm = resolveColumnBaseZmm(column.params, colVctx);
    const rawColTop = colTopMm - colBaseMm;
    const nominalHeightMm = Number.isFinite(rawColTop) ? rawColTop : undefined;
    // ADR-534 §monolithic-cut — clip-top στο soffit καλύπτουσας πλάκας (συνδυάζεται min με το topProfile).
    const clipTopZmm = (footVerts && footVerts.length >= 3 && Number.isFinite(colTopMm) && Number.isFinite(colBaseMm))
      ? resolveMemberTopClipZmm(footVerts.map((v) => ({ x: v.x, y: v.y })), colTopMm, colBaseMm, slabHosts)
      : undefined;
    // ADR-488 §6.1 — DERIVED effective βάση (άνω παρειά στηρίζοντος πεδίλου) ώστε η κολώνα
    // να εδραστεί στο πέδιλο (στατική συνέχεια). ΟΧΙ για ρητά base-attached κολώνες (κρατούν
    // τον δικό τους attach profile). undefined → flat path κρατά τη nominal βάση.
    const effectiveBaseZmm = baseAttached ? undefined : ColumnBaseContinuityStore.get(column.id);
    const mesh = columnToMesh(
      column, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation, topProfile, baseProfile, nominalHeightMm,
      entities.walls, // ADR-449 Slice 2 — obstacles + exterior classifier για τον σοβά
      entities.beams, // ADR-449 Slice 6 — mutual obstacles (junction κολόνας↔δοκαριού)
      // ADR-449 Slice X1 — suppress per-element· η ΕΝΙΑΙΑ silhouette αναλαμβάνει το σκιν.
      // ADR-404 Bug A — ΕΞΑΙΡΕΣΗ: κεκλιμένη κολώνα ΔΕΝ μπαίνει στο flat union (δεν shear-άρεται
      // ως merged) → παίρνει per-element σοβά (suppress=false) που ακολουθεί την κλίση.
      !isColumnTilted(column.params),
      effectiveBaseZmm,
      clipTopZmm, // ADR-534 §monolithic-cut
    );
    if (mesh) { mesh.userData['buildingId'] = r.buildingId; group.add(mesh); }
  }
}
