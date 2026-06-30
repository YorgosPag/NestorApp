/**
 * BIM Floor Utilities — ADR-369 Phase 0.3 (§9.0)
 *
 * Reverse-lookup helpers: resolve storey + building context of a BIM entity.
 *
 * Two exported functions:
 *   1. `getEntityAbsoluteElevation` — absolute z in mm (offsetFromStorey + storey.elevation×1000)
 *   2. `getEntityBuilding`          — parent Building record for multi-building scenes
 *
 * Storey resolution order (getEntityAbsoluteElevation):
 *   1. `entity.params.storeyId`  (in-params FK, ADR-369 Phase 0.4)
 *   2. `entity.floorId`          (BaseEntity-level FK, fallback)
 *
 * Building resolution order (getEntityBuilding):
 *   1. `entity.buildingId`       (BaseEntity-level FK)
 *
 * Semantic for elevation depends on entity type (ADR-369 §2.1 / §2.2):
 *   - Slab / Beam  : top-face absolute elevation
 *   - Wall / Column: base-face absolute elevation
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9.0
 */

// ─── Shared minimal shapes ───────────────────────────────────────────────────

/** Minimal storey shape needed for elevation resolution. */
export type StoreyRef = {
  readonly id: string;
  /** METRES — absolute elevation από building datum (ADR-369 §9.0). */
  readonly elevation?: number;
};

/**
 * Storey shape extended with building FK — used by the 3D viewer to resolve
 * building.baseElevation via the floor-chain (entity → floor → building).
 * ADR-369 §9.2 Q2.1.
 */
export type FloorRef = StoreyRef & {
  /** FK → Building (ADR-369 Q2 multi-building). */
  readonly buildingId?: string;
};

/** Minimal building shape needed for reverse-lookup and UI display. */
export type BuildingRef = {
  readonly id: string;
  /** METRES — building base elevation above site datum (ADR-369 §9.2). */
  readonly baseElevation?: number;
  /** Display name for building selector UI (ADR-369 Q2.2). */
  readonly name?: string;
};

/**
 * Minimal entity shape για `getEntityAbsoluteElevation`. Covers
 * WallEntity / ColumnEntity / SlabEntity / BeamEntity post-ADR-369.
 */
export type EntityWithStoreyParams = {
  /** BaseEntity-level FK. Fallback when `params.storeyId` absent. */
  readonly floorId?: string;
  /** BaseEntity-level FK. Used by getEntityBuilding. */
  readonly buildingId?: string;
  readonly params: {
    /** In-params FK → storey (ADR-369 Phase 0.4). Alias for floorId. */
    readonly storeyId?: string;
    /** mm. Elevation offset από storey reference. Default 0. */
    readonly offsetFromStorey?: number;
    /**
     * Index signature ώστε να δέχεται ΟΠΟΙΑΔΗΠΟΤΕ params (π.χ. `FloorFinishParams` που δεν
     * έχει καθόλου storey linkage) χωρίς το weak-type «no properties in common». Τα ονομαστικά
     * storey πεδία παραμένουν αυστηρά τυποποιημένα (named members υπερισχύουν του index).
     */
    readonly [key: string]: unknown;
  };
};

// ─── Lookup functions ────────────────────────────────────────────────────────

/**
 * Resolves the absolute elevation reference point of a BIM entity in mm.
 *
 * Formula: `offsetFromStorey + (storey.elevation × 1000)`
 * Falls back to `offsetFromStorey ?? 0` when no storey found.
 *
 * @param entity - BIM entity with storey linkage params.
 * @param floors - Available storey records to search.
 * @returns Absolute elevation in mm.
 */
export function getEntityAbsoluteElevation(
  entity: EntityWithStoreyParams,
  floors: StoreyRef[],
): number {
  const storeyId = entity.params.storeyId ?? entity.floorId;
  const storey = storeyId !== undefined
    ? floors.find(f => f.id === storeyId)
    : undefined;
  const storeyElevationMm = (storey?.elevation ?? 0) * 1000;
  return (entity.params.offsetFromStorey ?? 0) + storeyElevationMm;
}

/**
 * Resolves the parent Building record for a BIM entity via direct `buildingId` FK.
 *
 * @param entity    - BIM entity with `buildingId` FK.
 * @param buildings - Available building records to search.
 * @returns Matching BuildingRef, or `undefined` when not found / FK absent.
 */
export function getEntityBuilding<B extends BuildingRef>(
  entity: EntityWithStoreyParams,
  buildings: readonly B[],
): B | undefined {
  if (entity.buildingId === undefined) return undefined;
  return buildings.find(b => b.id === entity.buildingId);
}

/**
 * Resolves the parent Building via two-step lookup (ADR-369 §9.2 Q2.1):
 *   1. Direct: `entity.buildingId` → fast path
 *   2. Floor-chain: `entity.floorId → floor.buildingId → building`
 *
 * Used by the 3D viewer to apply `building.baseElevation` Y-offset to every mesh.
 *
 * @param entity    - BIM entity with optional buildingId / floorId FKs.
 * @param floors    - Available floor records carrying buildingId.
 * @param buildings - Available building records.
 * @returns Matching building, or `undefined` when chain cannot be resolved.
 */
export function resolveEntityBuilding<B extends BuildingRef>(
  entity: EntityWithStoreyParams,
  floors: readonly FloorRef[],
  buildings: readonly B[],
): B | undefined {
  const direct = getEntityBuilding(entity, buildings);
  if (direct !== undefined) return direct;
  const floorId = entity.params.storeyId ?? entity.floorId;
  if (floorId === undefined) return undefined;
  const floor = floors.find(f => f.id === floorId);
  if (floor?.buildingId === undefined) return undefined;
  return buildings.find(b => b.id === floor.buildingId);
}
