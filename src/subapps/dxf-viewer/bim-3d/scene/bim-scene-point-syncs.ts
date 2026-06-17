/**
 * bim-scene-point-syncs — generic point-entity → mesh sync for BimSceneLayer.
 *
 * Boy-Scout extraction (CLAUDE.md N.0.2, 2026-06-17): the point-based BIM
 * converters (panel / manifold / radiator / boiler / water-heater / railing /
 * foundation / roof / floor-finish / underfloor / furniture) all shared the
 * IDENTICAL "iterate → resolveEntity → toMesh → tag buildingId → add to group"
 * loop. One generic SSoT replaces 11 copy-pasted private methods and keeps
 * BimSceneLayer under the 500-line Google limit (N.7.1).
 */
import type * as THREE from 'three';
import type { SyncContext } from './bim-scene-context';
import type { BimCategory } from '../../config/bim-object-styles';
import type { Discipline } from '../../bim/discipline/bim-discipline';
import type { EntityResolution } from './BimSceneLayer';

/** Per-entity visibility + building binding resolver (BimSceneLayer.resolveEntity). */
type ResolveEntity = (
  entity: { id?: string; layerId?: string; discipline?: Discipline },
  category: BimCategory,
  ctx: SyncContext,
) => EntityResolution | null;

/** Converts one resolved point entity to its Three.js object (null = skip). */
type PointMeshFactory<T> = (
  entity: T,
  ctx: SyncContext,
  resolution: EntityResolution,
) => THREE.Object3D | null;

/**
 * Sync a list of point-based BIM entities into the scene group. The `?? []`
 * guard tolerates legacy floor-stack entries / snapshots that predate a given
 * entity slice, exactly as the original per-method loops did.
 */
export function syncPointEntities<T extends { id?: string; layerId?: string; discipline?: Discipline }>(
  group: THREE.Group,
  list: readonly T[] | undefined,
  category: BimCategory,
  ctx: SyncContext,
  resolve: ResolveEntity,
  toMesh: PointMeshFactory<T>,
): void {
  for (const entity of list ?? []) {
    const r = resolve(entity, category, ctx);
    if (!r) continue;
    const mesh = toMesh(entity, ctx, r);
    if (mesh) {
      mesh.userData['buildingId'] = r.buildingId;
      group.add(mesh);
    }
  }
}
