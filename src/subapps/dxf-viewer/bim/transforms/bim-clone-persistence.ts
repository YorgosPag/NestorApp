/**
 * ADR-363 §7.2 — persistence SSoT for *cloned* BIM entities (copy+mirror, and
 * any command path that spawns a fresh BIM entity from an existing one).
 *
 * A cloned BIM entity must:
 *   (a) carry a FRESH per-type enterprise ID (N.6) + a NEW IFC GlobalId — each
 *       instance owns a unique `ifcGuid`, never shares the source's; and
 *   (b) broadcast the same create / delete / restore EventBus signals the draw
 *       tool + DeleteEntityCommand use.
 *
 * Without (b) the Firestore subscription (`use*Persistence`) treats the clone as
 * an unknown scene entity (`!docsById.has(id) && !dirty && !pending` → `mutated`)
 * and drops it on the next snapshot — the "copy flashes then vanishes" bug
 * (HANDOFFS/2026-06-01_BIM_copy-mirror-persistence-bug). The in-place mirror
 * (`keepOriginals=false`) was never affected because it mutates an already
 * persisted entity that `useBimEntityMovedPersistEffect` re-saves.
 *
 * Symmetric inverse of `DeleteEntityCommand` (create ↔ delete, redo ↔ restore):
 *   - execute (make copy)  → `broadcastBimCloneCreated`  → first Firestore save
 *   - undo    (drop copy)  → `broadcastBimCloneDeleted`  → Firestore delete + tombstone
 *   - redo    (re-create)  → `broadcastBimCloneRestored` → clear tombstone + re-save
 *
 * @see core/commands/entity-commands/DeleteEntityCommand.ts — symmetric inverse
 * @see hooks/data/useBimEntityRestoredPersistEffect.ts — restore listener
 * @see bim/scene/append-entity-to-scene.ts — draw-tool create path (tool = type)
 */
import { EventBus } from '../../systems/events/EventBus';
import {
  emitBimEntityDeleteRequested,
  emitBimEntityRestoreRequested,
} from '../../systems/events/bim-entity-lifecycle-events';
import type { AnySceneEntity } from '../../types/entities';
import {
  generateWallId,
  generateOpeningId,
  generateSlabId,
  generateSlabOpeningId,
  generateColumnId,
  generateBeamId,
  generateStairId,
  generateFloorFinishId,
  // ADR-688 — full clone coverage: every BIM type the move-geometry SSoT supports.
  generateFoundationId,
  generateRoofId,
  generateSpaceSeparatorId,
  generateFurnitureId,
  generateImportedMeshId,
  generateGenericSolidId,
  generateMepFixtureId,
  generateElectricalPanelId,
  generateMepManifoldId,
  generateMepSegmentId,
  generateMepRadiatorId,
  generateMepBoilerId,
  generateMepWaterHeaterId,
  generateMepUnderfloorId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';

/**
 * BIM entity types that persist to Firestore via a `use*Persistence` hook AND
 * clone independently.
 *
 * ADR-688 — this list MUST stay aligned with the non-null cases of
 * `calculateBimMovedGeometry` (`bim/utils/bim-move-geometry.ts`): the clone SSoT
 * (`buildClonesFromEntities`) transforms each source THEN mints identity, so a
 * type needs BOTH a mover case AND an entry here to survive. Types the mover
 * intentionally leaves to their host — `railing` (auto-hosted on stair, ADR-407),
 * `wall-covering` (follows wall), `thermal-space` (derived region),
 * `mep-fitting` (derived from segment endpoints), `floorplan-symbol` — are
 * therefore NOT here: they clone via their host, not independently (Revit parity).
 * Before 688 only the first 8 structural types were covered, so copy/paste of a
 * MEP fixture / imported mesh / generic solid silently dropped it (skipped) in
 * BOTH the 2D clipboard and the 3D canvas.
 */
export type BimPersistedType =
  | 'wall'
  | 'opening'
  | 'slab'
  | 'slab-opening'
  | 'column'
  | 'beam'
  | 'stair'
  // ADR-419 — floor-finish persists via useFloorFinishPersistence.
  | 'floor-finish'
  // ADR-688 — remaining move-capable BIM types (structural / MEP / mesh / solid).
  | 'foundation'
  | 'roof'
  | 'space-separator'
  | 'furniture'
  | 'imported-mesh'
  | 'generic-solid'
  | 'mep-fixture'
  | 'electrical-panel'
  | 'mep-manifold'
  | 'mep-segment'
  | 'mep-radiator'
  | 'mep-boiler'
  | 'mep-water-heater'
  | 'mep-underfloor';

/** Per-type enterprise-id generator (N.6 — never `generateEntityId()` for BIM). */
const BIM_ID_GENERATORS: Record<BimPersistedType, () => string> = {
  wall: generateWallId,
  opening: generateOpeningId,
  slab: generateSlabId,
  'slab-opening': generateSlabOpeningId,
  column: generateColumnId,
  beam: generateBeamId,
  stair: generateStairId,
  'floor-finish': generateFloorFinishId,
  // ADR-688 — full coverage (aligned with calculateBimMovedGeometry).
  foundation: generateFoundationId,
  roof: generateRoofId,
  'space-separator': generateSpaceSeparatorId,
  furniture: generateFurnitureId,
  'imported-mesh': generateImportedMeshId,
  'generic-solid': generateGenericSolidId,
  'mep-fixture': generateMepFixtureId,
  'electrical-panel': generateElectricalPanelId,
  'mep-manifold': generateMepManifoldId,
  'mep-segment': generateMepSegmentId,
  'mep-radiator': generateMepRadiatorId,
  'mep-boiler': generateMepBoilerId,
  'mep-water-heater': generateMepWaterHeaterId,
  'mep-underfloor': generateMepUnderfloorId,
};

/** Minimal shape a clone helper needs — satisfied by SceneEntity / AnySceneEntity. */
interface CloneEntityLike {
  readonly id: string;
  readonly type?: string;
}

export function isBimPersistedType(type: string | undefined): type is BimPersistedType {
  return type !== undefined && Object.prototype.hasOwnProperty.call(BIM_ID_GENERATORS, type);
}

/**
 * Fresh identity for a BIM clone: per-type enterprise ID + a NEW IFC GlobalId.
 * Returns `null` for non-BIM entities so the caller falls back to its generic
 * id path (`generateEntityId()`).
 */
export function mintBimCloneIdentity(
  type: string | undefined,
): { id: string; ifcGuid: string } | null {
  if (!isBimPersistedType(type)) return null;
  return { id: BIM_ID_GENERATORS[type](), ifcGuid: generateIfcGuid() };
}

/**
 * Emit `drawing:entity-created` (tool = entity type) so the matching
 * `use*Persistence` hook schedules the clone's first Firestore save. No-op for
 * non-BIM entities (they persist via the DXF-JSON autosave path instead).
 */
export function broadcastBimCloneCreated(entity: CloneEntityLike): void {
  if (!isBimPersistedType(entity.type)) return;
  EventBus.emit('drawing:entity-created', {
    entity: entity as unknown as AnySceneEntity,
    tool: entity.type,
  });
}

/**
 * Emit the per-type `bim:*-delete-requested` so the clone's Firestore doc is
 * removed (+ tombstoned) when its creating command is undone. Delegates to the
 * `emitBimEntityDeleteRequested` lifecycle SSoT (μηδέν inline switch) — που καλύπτει
 * ΟΛΟΥΣ τους per-entity τύπους (incl. `floor-finish`, που το παλιό inline switch
 * **παρέλειπε** → ο orphan doc του clone δεν σβηνόταν). No-op for non-persisted types.
 */
export function broadcastBimCloneDeleted(entity: CloneEntityLike): void {
  emitBimEntityDeleteRequested(entity.type ?? '', entity.id);
}

/**
 * Emit `bim:entity-restore-requested` (`source: 'redo-restore'`) so the clone's
 * Firestore doc is re-created when its creating command is redone — clears the
 * delete tombstone set on undo. No-op for non-BIM entities.
 */
export function broadcastBimCloneRestored(entity: CloneEntityLike): void {
  if (!isBimPersistedType(entity.type)) return;
  emitBimEntityRestoreRequested(entity.type, entity as unknown as AnySceneEntity, 'redo-restore');
}
