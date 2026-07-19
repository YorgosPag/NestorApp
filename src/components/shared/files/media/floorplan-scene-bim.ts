/**
 * ADR-370 Phase 11 — BIM geometry rehydration for the read-only floorplan scene.
 *
 * WHY: the persisted `.scene.json` is a *derived cache*. The editor DISCARDS its BIM
 * entities on load (`reconcileLoadedSceneBim`) and re-sources them from the per-entity
 * Firestore collections, each `docToEntity` recomputing geometry via the SSoT
 * `computeXxxGeometry(params)` (geometry is NOT trusted from the snapshot — ADR-358
 * §G6). A BIM entity in the raw snapshot therefore may carry ONLY `params` and no
 * `geometry` (observed: `column` has none, `stair` happens to have it baked).
 *
 * The public read-only page is UNAUTHENTICATED — it cannot query Firestore (rules:
 * default-deny + tenant claims), so the scene.json IS its only data source. This
 * module does what the editor's per-entity loaders do, but over the snapshot entities:
 * recompute the missing `geometry` from `params` using the SAME pure SSoT functions
 * (N.18 clone-free — zero geometry logic duplicated here). Without it the entity
 * renderers (ColumnRenderer reads `geometry.footprint`, …) draw nothing.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md
 * @see src/subapps/dxf-viewer/systems/levels/scene-bim-load-policy.ts — editor discards snapshot BIM
 */

import type { Entity } from '@/subapps/dxf-viewer/types/entities';
import type { WallEntity } from '@/subapps/dxf-viewer/bim/types/wall-types';
import { isWallHostedOpening } from '@/subapps/dxf-viewer/bim/types/opening-types';
import type { FloorplanBimSnapshot } from '@/components/shared/files/media/useFloorplanBimEntities';

import { computeWallGeometry } from '@/subapps/dxf-viewer/bim/geometry/wall-geometry';
import { computeSlabGeometry } from '@/subapps/dxf-viewer/bim/geometry/slab-geometry';
import { computeBeamGeometry } from '@/subapps/dxf-viewer/bim/geometry/beam-geometry';
import { computeColumnGeometry } from '@/subapps/dxf-viewer/bim/geometry/column-geometry';
import { computeOpeningGeometry } from '@/subapps/dxf-viewer/bim/geometry/opening-geometry';
import { computeSlabOpeningGeometry } from '@/subapps/dxf-viewer/bim/geometry/slab-opening-geometry';
import { computeStairGeometry } from '@/subapps/dxf-viewer/bim/geometry/stairs/StairGeometryService';

/**
 * Fill in missing `geometry` for one snapshot entity via the SSoT compute functions.
 * Uses the baked `geometry` when present (cheap read-only optimisation, mirrors the
 * `doc.geometry ?? compute(...)` loaders); recomputes from `params` otherwise.
 * Non-BIM entities (line/text/image/hatch/block/…) pass through untouched.
 */
function ensureGeometry(entity: Entity, wallById: ReadonlyMap<string, WallEntity>): Entity {
  switch (entity.type) {
    case 'column':
      return entity.geometry ? entity : { ...entity, geometry: computeColumnGeometry(entity.params) };
    case 'wall':
      // Raw params (no family-type resolve outside the editor store) → base section.
      return entity.geometry ? entity : { ...entity, geometry: computeWallGeometry(entity.params, entity.kind) };
    case 'slab':
      return entity.geometry ? entity : { ...entity, geometry: computeSlabGeometry(entity.params) };
    case 'beam':
      return entity.geometry ? entity : { ...entity, geometry: computeBeamGeometry(entity.params) };
    case 'stair':
      return entity.geometry ? entity : { ...entity, geometry: computeStairGeometry(entity.params) };
    case 'slab-opening':
      return entity.geometry ? entity : { ...entity, geometry: computeSlabOpeningGeometry(entity.params) };
    case 'opening': {
      if (entity.geometry) return entity;
      // ADR-615 — a wall-hosted opening needs its host to derive geometry; a
      // self-hosted / host-less opening in a read-only snapshot is left as-is.
      if (!isWallHostedOpening(entity)) return entity;
      const host = wallById.get(entity.params.wallId);
      if (!host) return entity;
      return {
        ...entity,
        geometry: computeOpeningGeometry(entity.params, host, host.params.sceneUnits ?? 'mm'),
      };
    }
    default:
      return entity;
  }
}

/**
 * Return the scene entities with every structural BIM entity's `geometry` rehydrated
 * from `params`. Pure; the caller memoises per scene identity (see `floorplan-scene-render`).
 */
export function rehydrateBimGeometry(entities: readonly Entity[]): Entity[] {
  // Host-wall index for opening geometry (built once; walls are rehydrated too).
  const wallById = new Map<string, WallEntity>();
  for (const e of entities) {
    if (e.type === 'wall') wallById.set(e.id, e as WallEntity);
  }
  return entities.map((e) => ensureGeometry(e, wallById));
}

/**
 * Group the scene's (geometry-rehydrated) structural BIM entities into the
 * `FloorplanBimSnapshot` shape the read-only 3D overlay + toggle consume. On the
 * public page this replaces the projectId-scoped Firestore feed (which is
 * structurally dead there — the adapted `FileRecord` has no `projectId`, and an
 * unauthenticated visitor cannot query Firestore anyway). The scene.json is the SSoT.
 *
 * `hasAny` counts only 3D-capable structural types (not hatches) — it gates the 3D
 * toggle button, which must appear only when there is something to show in 3D.
 */
export function buildSceneBimSnapshot(
  entities: readonly Entity[] | null | undefined,
): FloorplanBimSnapshot {
  const rehydrated = entities?.length ? rehydrateBimGeometry(entities) : [];
  const pick = (t: Entity['type']): Entity[] => rehydrated.filter((e) => e.type === t);

  const walls = pick('wall');
  const slabs = pick('slab');
  const beams = pick('beam');
  const columns = pick('column');
  const openings = pick('opening');
  const slabOpenings = pick('slab-opening');
  const stairs = pick('stair');
  const foundations = pick('foundation');
  const furnitures = pick('furniture');

  const hasAny =
    walls.length + slabs.length + beams.length + columns.length +
      openings.length + slabOpenings.length + stairs.length +
      foundations.length + furnitures.length >
    0;

  return {
    walls, slabs, beams, columns, openings, slabOpenings, stairs,
    // Hatches render in 2D via the scene engine; the 3D overlay ignores them.
    hatches: [],
    foundations, furnitures,
    isLoading: false,
    hasAny,
  } as unknown as FloorplanBimSnapshot;
}
