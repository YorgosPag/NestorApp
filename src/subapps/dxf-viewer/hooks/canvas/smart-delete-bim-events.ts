/**
 * Smart-delete BIM id collection + Firestore delete-event emission.
 * Extracted from `useSmartDelete.ts` for file-size compliance (<500 lines);
 * behavior-preserving.
 *
 * `collectBimDeleteIds` reads entity types from the scene adapter BEFORE the
 * delete command removes them; `emitBimDeleteEvents` fires the per-type
 * `bim:*-delete-requested` events (Firestore deleteDoc + subscription re-add
 * prevention) AFTER the command executes.
 *
 * @module hooks/canvas/smart-delete-bim-events
 * @see ./useSmartDelete.ts
 */
import type { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { emitBimEntityDeleteRequested } from '../../systems/events/bim-entity-lifecycle-events';

export interface CollectedBimDeleteIds {
  wallIds: string[];
  slabIds: string[];
  columnIds: string[];
  beamIds: string[];
  stairIds: string[];
  // ADR-407 Φ7 — κάγκελο (standalone + auto stair-hosted orphans).
  railingIds: string[];
  openingIds: string[];
  slabOpeningIds: string[];
  foundationIds: string[];
  fixtureIds: string[];
  panelIds: string[];
  furnitureIds: string[];
  mepSegmentIds: string[];
  manifoldIds: string[];
  radiatorIds: string[];
  boilerIds: string[];
  waterHeaterIds: string[];
  roofIds: string[];
  floorFinishIds: string[];
  underfloorIds: string[];
  spaceSeparatorIds: string[];
  // ADR-507 — FLAT DXF hatch (Firestore deleteDoc + tombstone on delete-tool).
  hatchIds: string[];
  // ADR-683 Φ3β — imported mesh (Firestore deleteDoc + tombstone; without this the
  // delete removed it from the scene but not Firestore → reload re-added it).
  importedMeshIds: string[];
  // ADR-684 — parametric generic solid (same deleteDoc + tombstone path).
  genericSolidIds: string[];
}

/**
 * Partition `idsToDelete` by entity type via the level-scoped adapter. MUST run
 * BEFORE the delete command — the adapter can only resolve types while the
 * entities are still in the scene.
 */
export function collectBimDeleteIds(
  idsToDelete: readonly string[],
  adapter: LevelSceneManagerAdapter,
): CollectedBimDeleteIds {
  const byType = (type: string): string[] =>
    idsToDelete.filter((id) => adapter.getEntity(id)?.type === type);
  return {
    wallIds: byType('wall'),
    slabIds: byType('slab'),
    columnIds: byType('column'),
    beamIds: byType('beam'),
    stairIds: byType('stair'),
    railingIds: byType('railing'),
    openingIds: byType('opening'),
    slabOpeningIds: byType('slab-opening'),
    foundationIds: byType('foundation'),
    fixtureIds: byType('mep-fixture'),
    panelIds: byType('electrical-panel'),
    furnitureIds: byType('furniture'),
    mepSegmentIds: byType('mep-segment'),
    manifoldIds: byType('mep-manifold'),
    radiatorIds: byType('mep-radiator'),
    boilerIds: byType('mep-boiler'),
    waterHeaterIds: byType('mep-water-heater'),
    roofIds: byType('roof'),
    floorFinishIds: byType('floor-finish'),
    underfloorIds: byType('mep-underfloor'),
    spaceSeparatorIds: byType('space-separator'),
    hatchIds: byType('hatch'),
    importedMeshIds: byType('imported-mesh'),
    genericSolidIds: byType('generic-solid'),
  };
}

/**
 * Fire Firestore deleteDoc (+ subscription re-add prevention) events for every
 * deleted BIM entity type. MUST run AFTER the delete command executes. Delegates
 * the per-type event mapping to the `emitBimEntityDeleteRequested` SSoT (N.0.2 —
 * single source shared with `CreateBimEntityCommand.undo()`).
 */
export function emitBimDeleteEvents(ids: CollectedBimDeleteIds): void {
  const groups: ReadonlyArray<readonly [readonly string[], string]> = [
    [ids.wallIds, 'wall'],
    [ids.slabIds, 'slab'],
    [ids.columnIds, 'column'],
    [ids.beamIds, 'beam'],
    [ids.foundationIds, 'foundation'],
    [ids.stairIds, 'stair'],
    [ids.railingIds, 'railing'],
    [ids.openingIds, 'opening'],
    [ids.slabOpeningIds, 'slab-opening'],
    [ids.fixtureIds, 'mep-fixture'],
    [ids.panelIds, 'electrical-panel'],
    [ids.furnitureIds, 'furniture'],
    [ids.mepSegmentIds, 'mep-segment'],
    [ids.manifoldIds, 'mep-manifold'],
    [ids.radiatorIds, 'mep-radiator'],
    [ids.boilerIds, 'mep-boiler'],
    [ids.waterHeaterIds, 'mep-water-heater'],
    [ids.roofIds, 'roof'],
    [ids.floorFinishIds, 'floor-finish'],
    [ids.underfloorIds, 'mep-underfloor'],
    [ids.spaceSeparatorIds, 'space-separator'],
    [ids.hatchIds, 'hatch'],
    [ids.importedMeshIds, 'imported-mesh'],
    [ids.genericSolidIds, 'generic-solid'],
  ];
  for (const [arr, type] of groups) {
    for (const id of arr) emitBimEntityDeleteRequested(type, id);
  }
}
