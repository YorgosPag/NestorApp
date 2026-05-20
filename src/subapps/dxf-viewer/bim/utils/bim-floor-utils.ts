/**
 * BIM Floor Utilities — ADR-369 Phase 0.3 (§9.0)
 *
 * Reverse-lookup helper: resolves the absolute elevation of a BIM entity (mm)
 * by combining its storey's `elevation` (METRES → mm) with
 * `params.offsetFromStorey`. Works for all 4 storey-linked entity types
 * (wall / column / slab / beam).
 *
 * Storey resolution order:
 *   1. `entity.params.storeyId`  (in-params FK, ADR-369 Phase 0.4)
 *   2. `entity.floorId`          (BaseEntity-level FK, fallback)
 *
 * Semantic depends on entity type (ADR-369 §2.1 / §2.2):
 *   - Slab / Beam  : returns top-face absolute elevation
 *   - Wall / Column: returns base-face absolute elevation
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9.0
 */

/** Minimal storey shape needed for elevation resolution. */
export type StoreyRef = {
  readonly id: string;
  /** METRES — absolute elevation από building datum (ADR-369 §9.0). */
  readonly elevation?: number;
};

/**
 * Minimal entity shape για `getEntityAbsoluteElevation`. Covers
 * WallEntity / ColumnEntity / SlabEntity / BeamEntity post-ADR-369.
 */
export type EntityWithStoreyParams = {
  /** BaseEntity-level FK. Fallback when `params.storeyId` absent. */
  readonly floorId?: string;
  readonly params: {
    /** In-params FK → storey (ADR-369 Phase 0.4). Alias for floorId. */
    readonly storeyId?: string;
    /** mm. Elevation offset από storey reference. Default 0. */
    readonly offsetFromStorey?: number;
  };
};

/**
 * Resolves the absolute elevation reference point of a BIM entity in mm.
 *
 * Formula: `offsetFromStorey + (storey.elevation × 1000)`
 * When no matching storey found, falls back to `offsetFromStorey ?? 0`.
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
