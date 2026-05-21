/**
 * BIM Schedule Export — Filter Pipeline (ADR-363 §6 Phase 8).
 *
 * 4 composable filter axes applied to `ScheduleRow[]`:
 *   1. Floor       — `entity.floorId` ∈ `criteria.floorIds`
 *   2. Category    — `entity.params.material` OR `entity.kind` ∈ categories
 *   3. Region      — `entity.geometry.bbox` intersects `criteria.region`
 *   4. Selection   — `entity.id` ∈ `criteria.selectionIds`
 *
 * Filters are pure functions over the typed entity union — applied BEFORE
 * row mapping so presets only see survivors. Composable: any subset active
 * simultaneously (logical AND across axes).
 *
 * SSoT:
 *   - Region intersection is bbox-vs-bbox (cheap, conservative). Sub-mm
 *     z-overlap ignored — schedules are floor-plan oriented.
 *   - Empty array for an active axis = match-nothing (intentional).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import type { BimEntity, BoundingBox3D } from '../types/bim-base';
import type { ScheduleFilterCriteria } from './types';

// ─── Generic entity shape consumed by filters ───────────────────────────────

/**
 * Minimal shape any filter needs. All concrete BimEntity sub-types satisfy
 * this: `id`, optional `floorId`, optional `params.material` / `params.kind`
 * (we duck-type — `kind` lives at top level του BimEntity, `material` στο
 * params if present).
 */
export interface FilterableBimEntity {
  readonly id: string;
  readonly floorId?: string;
  /** ADR-369 §9.2 Q2.4 — building FK for building-filter axis. */
  readonly buildingId?: string;
  readonly kind: string;
  readonly geometry: { readonly bbox: BoundingBox3D };
  readonly params: Readonly<{
    readonly material?: string;
    readonly kind?: string;
  }> & Readonly<Record<string, unknown>>;
}

// ─── Axis 1: Floor ───────────────────────────────────────────────────────────

/**
 * Floor filter. Undefined criteria axis → pass-through. Empty array →
 * match nothing. Entity without floorId fails when floor filter active
 * (no "uncategorised" bucket — strict).
 */
export function passesFloorFilter(
  entity: FilterableBimEntity,
  floorIds: readonly string[] | undefined,
): boolean {
  if (floorIds === undefined) return true;
  if (entity.floorId === undefined) return false;
  return floorIds.includes(entity.floorId);
}

// ─── Axis 2: Building ────────────────────────────────────────────────────────

/**
 * Building filter (ADR-369 §9.2 Q2.4). Undefined criteria axis → pass-through.
 * Empty array → match nothing. Entity without buildingId fails when filter active.
 */
export function passesBuildingFilter(
  entity: FilterableBimEntity,
  buildingIds: readonly string[] | undefined,
): boolean {
  if (buildingIds === undefined) return true;
  if (entity.buildingId === undefined) return false;
  return buildingIds.includes(entity.buildingId);
}

// ─── Axis 3: Category (material OR kind) ─────────────────────────────────────

/**
 * Category filter — accepts material ID OR entity kind. Heterogeneous
 * match enables both "ξύλο" (material) και "πόρτα" (kind) UI checkbox
 * filtering through one criteria array.
 */
export function passesCategoryFilter(
  entity: FilterableBimEntity,
  categories: readonly string[] | undefined,
): boolean {
  if (categories === undefined) return true;
  const material = entity.params.material;
  const kind = entity.kind;
  if (material !== undefined && categories.includes(material)) return true;
  if (categories.includes(kind)) return true;
  return false;
}

// ─── Axis 3: Region (bbox intersection) ──────────────────────────────────────

/**
 * 2D AABB intersection (XY plane, z ignored — schedules are plan-view).
 * Inclusive at boundaries: touching boxes count as intersecting.
 */
function bboxesIntersect2D(a: BoundingBox3D, b: BoundingBox3D): boolean {
  if (a.max.x < b.min.x || b.max.x < a.min.x) return false;
  if (a.max.y < b.min.y || b.max.y < a.min.y) return false;
  return true;
}

/**
 * Region filter — entity bbox must intersect criteria region bbox in XY.
 * Z dimension intentionally ignored (plan-view schedule contract).
 */
export function passesRegionFilter(
  entity: FilterableBimEntity,
  region: BoundingBox3D | undefined,
): boolean {
  if (region === undefined) return true;
  return bboxesIntersect2D(entity.geometry.bbox, region);
}

// ─── Axis 4: Selection ───────────────────────────────────────────────────────

/**
 * Selection filter — entity id ∈ selection set. Undefined → pass-through.
 * Empty array → match nothing.
 */
export function passesSelectionFilter(
  entity: FilterableBimEntity,
  selectionIds: readonly string[] | undefined,
): boolean {
  if (selectionIds === undefined) return true;
  return selectionIds.includes(entity.id);
}

// ─── Composed filter (all axes ∧) ────────────────────────────────────────────

/**
 * Compose all 5 axes — logical AND. Entity passes ⇔ all defined axes pass.
 * Unused axes (criteria field undefined) are no-ops.
 */
export function passesAllFilters(
  entity: FilterableBimEntity,
  criteria: ScheduleFilterCriteria,
): boolean {
  return (
    passesFloorFilter(entity, criteria.floorIds) &&
    passesBuildingFilter(entity, criteria.buildingIds) &&
    passesCategoryFilter(entity, criteria.categories) &&
    passesRegionFilter(entity, criteria.region) &&
    passesSelectionFilter(entity, criteria.selectionIds)
  );
}

/**
 * Convenience — apply filters to a heterogeneous entity list. Returns a
 * new array (caller can re-filter for narrowing types downstream).
 */
export function applyScheduleFilters<E extends FilterableBimEntity>(
  entities: readonly E[],
  criteria: ScheduleFilterCriteria,
): E[] {
  return entities.filter((e) => passesAllFilters(e, criteria));
}

// ─── Type guard helper για builder (bridges BimEntity union → filter shape) ─

/**
 * Coerce a `BimEntity<TKind, TParams, TGeometry>` to the `FilterableBimEntity`
 * shape. Safe because all BimEntity sub-types include: id (BaseEntity),
 * kind, params, geometry.bbox.
 *
 * NOTE: this is a structural cast helper — no runtime work. Used by
 * builder when iterating heterogeneous `BimEntity<string, unknown, ...>[]`.
 */
export function asFilterable<TKind extends string, TParams, TGeometry extends { bbox: BoundingBox3D }>(
  entity: BimEntity<TKind, TParams, TGeometry>,
): FilterableBimEntity {
  return entity as unknown as FilterableBimEntity;
}
