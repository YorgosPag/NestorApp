/**
 * cross-floor-link — pure guard for the level↔scene isolation invariant (ADR-399).
 *
 * A DXF `Level` may only load a scene file that belongs to its OWN floor. A stale
 * or mis-linked `sceneFileId` (root cause: the auto-save `fileRecordId` was sticky
 * across level switches, so drawing on one floor re-linked the previous floor's
 * file) would otherwise load another floor's DXF into this level — making every
 * floor render the same scene — and a later auto-save would overwrite that other
 * floor's file. `useLevelSceneLoader` calls this to skip such cross-floor loads.
 *
 * Pure + dependency-free so it unit-tests standalone.
 *
 * @module subapps/dxf-viewer/systems/levels/cross-floor-link
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
 */

/** Minimal structural view of a loaded FileRecord needed for the floor check. */
export interface FloorScopedFileRecord {
  readonly entityType?: string;
  readonly entityId?: string;
}

/**
 * True when `fileRecord` is floor-scoped and belongs to a DIFFERENT floor than the
 * level it is about to be loaded into.
 *
 * Conservative by design — returns `false` (i.e. allow the load) unless ALL hold:
 *  - the file is floor-scoped (`entityType === 'floor'`),
 *  - the level has a known `floorId`,
 *  - the file carries an `entityId`,
 *  - and the two floor ids differ.
 *
 * So legacy file-less levels, project/building-scoped scenes, and correctly-linked
 * floors are never affected.
 */
export function isCrossFloorSceneLink(
  fileRecord: FloorScopedFileRecord | null | undefined,
  levelFloorId: string | null | undefined,
): boolean {
  return (
    fileRecord?.entityType === 'floor' &&
    !!levelFloorId &&
    !!fileRecord.entityId &&
    fileRecord.entityId !== levelFloorId
  );
}
