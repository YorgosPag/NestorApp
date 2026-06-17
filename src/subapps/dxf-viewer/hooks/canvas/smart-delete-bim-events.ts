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
import type { useEventBus } from '../../systems/events';

export interface CollectedBimDeleteIds {
  wallIds: string[];
  slabIds: string[];
  columnIds: string[];
  beamIds: string[];
  stairIds: string[];
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
  };
}

/**
 * Fire Firestore deleteDoc (+ subscription re-add prevention) events for every
 * deleted BIM entity type. MUST run AFTER the delete command executes.
 */
export function emitBimDeleteEvents(
  ids: CollectedBimDeleteIds,
  eventBus: ReturnType<typeof useEventBus>,
): void {
  for (const wallId of ids.wallIds) eventBus.emit('bim:wall-delete-requested', { wallId });
  for (const slabId of ids.slabIds) eventBus.emit('bim:slab-delete-requested', { slabId });
  for (const columnId of ids.columnIds) eventBus.emit('bim:column-delete-requested', { columnId });
  for (const beamId of ids.beamIds) eventBus.emit('bim:beam-delete-requested', { beamId });
  // ADR-436 — foundation.
  for (const foundationId of ids.foundationIds) eventBus.emit('bim:foundation-delete-requested', { foundationId });
  // ADR-358 Phase 9C-3 — stair.
  for (const stairId of ids.stairIds) eventBus.emit('bim:stair-delete-requested', { stairId });
  for (const openingId of ids.openingIds) eventBus.emit('bim:opening-delete-requested', { openingId });
  for (const slabOpeningId of ids.slabOpeningIds) eventBus.emit('bim:slab-opening-delete-requested', { slabOpeningId });
  // ADR-406 — MEP fixture.
  for (const fixtureId of ids.fixtureIds) eventBus.emit('bim:mep-fixture-delete-requested', { fixtureId });
  // ADR-408 Φ3 — electrical panel.
  for (const panelId of ids.panelIds) eventBus.emit('bim:electrical-panel-delete-requested', { panelId });
  // ADR-410 — furniture.
  for (const furnitureId of ids.furnitureIds) eventBus.emit('bim:furniture-delete-requested', { furnitureId });
  // ADR-408 Φ8 — MEP segment.
  for (const segmentId of ids.mepSegmentIds) eventBus.emit('bim:mep-segment-delete-requested', { segmentId });
  // ADR-408 Φ12 — plumbing manifold.
  for (const manifoldId of ids.manifoldIds) eventBus.emit('bim:mep-manifold-delete-requested', { manifoldId });
  // ADR-408 Εύρος Β — heating radiator.
  for (const radiatorId of ids.radiatorIds) eventBus.emit('bim:mep-radiator-delete-requested', { radiatorId });
  // ADR-408 Εύρος Β #2 — heating boiler.
  for (const boilerId of ids.boilerIds) eventBus.emit('bim:mep-boiler-delete-requested', { boilerId });
  // ADR-408 — DHW water heater.
  for (const waterHeaterId of ids.waterHeaterIds) eventBus.emit('bim:mep-water-heater-delete-requested', { waterHeaterId });
  // ADR-417 — roof.
  for (const roofId of ids.roofIds) eventBus.emit('bim:roof-delete-requested', { roofId });
  // ADR-419 — floor finish.
  for (const floorFinishId of ids.floorFinishIds) eventBus.emit('bim:floor-finish-delete-requested', { id: floorFinishId });
  // ADR-408 Εύρος Β #3 — underfloor.
  for (const underfloorId of ids.underfloorIds) eventBus.emit('bim:mep-underfloor-delete-requested', { underfloorId });
  // ADR-437 — space separator.
  for (const spaceSeparatorId of ids.spaceSeparatorIds) eventBus.emit('bim:space-separator-delete-requested', { id: spaceSeparatorId });
}
