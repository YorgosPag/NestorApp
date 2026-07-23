/**
 * SSoT — BIM entity **lifecycle** events (create + delete), ΜΙΑ πηγή για όλο το
 * codebase (Revit-grade transaction events).
 *
 * Πριν, οι δύο emits ήταν **copy-pasted** σε ~11 σημεία:
 *   · `EventBus.emit('drawing:entity-created', { entity, tool })` (persistence first-save)
 *     στα 8 batch commands + `CreateBimEntityCommand` + `appendEntityToScene`·
 *   · `EventBus.emit('bim:<type>-delete-requested', { <key>Id })` (Firestore deleteDoc)
 *     στα ίδια commands + `emitBimDeleteEvents` (bulk smart-delete), με per-type
 *     mapping (20-case switch) ξαναγραμμένο.
 * Πλέον ζουν **ΜΙΑ φορά** εδώ — μηδέν διπλότυπο (N.0.2 / SSoT, Giorgio audit 2026-06-21).
 *
 * Global `EventBus` (ίδιο singleton με τον `useEventBus` hook). Άγνωστος τύπος στο
 * delete → no-op (η αφαίρεση από scene έχει ήδη γίνει).
 *
 * @see ../../core/commands/entity-commands/CreateBimEntityCommand.ts — single-entity create
 * @see ../../core/commands/entity-commands/CreateColumnsCommand.ts (+ Beams/Walls/Slabs/Foundations/MepSegments, Merge, DeleteFoundations) — batch consumers
 * @see ../../hooks/canvas/smart-delete-bim-events.ts — bulk delete consumer
 * @see docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md
 */

import { EventBus } from './EventBus';
import type { AnySceneEntity } from '../../types/scene';
import type { BimEventMap } from './drawing-event-map-bim';

/** Payload shape του `bim:entity-restore-requested` — SSoT για τα param types του helper. */
type RestoreRequestedPayload = BimEventMap['bim:entity-restore-requested'];

/**
 * Broadcast `drawing:entity-created` — the trigger the `use*Persistence` hooks wait
 * on to schedule the first Firestore save. `tool` = the entity-type tag ('column',
 * 'beam', 'slab', …). Caller is responsible for any defensive deep-clone.
 */
export function emitBimEntityCreated(entity: AnySceneEntity, tool: string): void {
  EventBus.emit('drawing:entity-created', { entity, tool });
}

/**
 * Fire the per-type `bim:*-delete-requested` event for ONE deleted/undone BIM entity
 * (Firestore deleteDoc + subscription re-add prevention). No-op for non-persisted /
 * unknown types (DXF primitives, wall — wall uses its own trim-aware delete path).
 */
export function emitBimEntityDeleteRequested(type: string, id: string): void {
  switch (type) {
    case 'wall': EventBus.emit('bim:wall-delete-requested', { wallId: id }); break;
    case 'slab': EventBus.emit('bim:slab-delete-requested', { slabId: id }); break;
    case 'column': EventBus.emit('bim:column-delete-requested', { columnId: id }); break;
    case 'beam': EventBus.emit('bim:beam-delete-requested', { beamId: id }); break;
    case 'foundation': EventBus.emit('bim:foundation-delete-requested', { foundationId: id }); break;
    case 'stair': EventBus.emit('bim:stair-delete-requested', { stairId: id }); break;
    // ADR-407 Φ7 — κάγκελο (standalone Ή auto stair-hosted): delete → Firestore deleteDoc + tombstone
    // μέσω useRailingPersistence. Πριν έλειπε → smart-delete έβγαζε το κάγκελο από τη σκηνή αλλά όχι
    // από το Firestore (επέστρεφε στο reload).
    case 'railing': EventBus.emit('bim:railing-delete-requested', { railingId: id }); break;
    case 'opening': EventBus.emit('bim:opening-delete-requested', { openingId: id }); break;
    case 'slab-opening': EventBus.emit('bim:slab-opening-delete-requested', { slabOpeningId: id }); break;
    case 'mep-fixture': EventBus.emit('bim:mep-fixture-delete-requested', { fixtureId: id }); break;
    case 'electrical-panel': EventBus.emit('bim:electrical-panel-delete-requested', { panelId: id }); break;
    case 'furniture': EventBus.emit('bim:furniture-delete-requested', { furnitureId: id }); break;
    // ADR-683 Φ3β — χωρίς αυτή τη γραμμή, το Ctrl+Z μιας εισαγωγής θα έβγαζε το αντικείμενο από
    // τη σκηνή αλλά ΟΧΙ από το Firestore → θα επέστρεφε μόνο του στο επόμενο reload.
    case 'imported-mesh': EventBus.emit('bim:imported-mesh-delete-requested', { importedMeshId: id }); break;
    // ADR-684 — παραμετρικό στερεό: undo-of-create + delete-tool → Firestore deleteDoc + tombstone.
    case 'generic-solid': EventBus.emit('bim:generic-solid-delete-requested', { genericSolidId: id }); break;
    case 'mep-segment': EventBus.emit('bim:mep-segment-delete-requested', { segmentId: id }); break;
    case 'mep-manifold': EventBus.emit('bim:mep-manifold-delete-requested', { manifoldId: id }); break;
    case 'mep-radiator': EventBus.emit('bim:mep-radiator-delete-requested', { radiatorId: id }); break;
    case 'mep-boiler': EventBus.emit('bim:mep-boiler-delete-requested', { boilerId: id }); break;
    case 'mep-water-heater': EventBus.emit('bim:mep-water-heater-delete-requested', { waterHeaterId: id }); break;
    case 'roof': EventBus.emit('bim:roof-delete-requested', { roofId: id }); break;
    case 'floor-finish': EventBus.emit('bim:floor-finish-delete-requested', { id }); break;
    case 'wall-covering': EventBus.emit('bim:wall-covering-delete-requested', { id }); break;
    case 'mep-underfloor': EventBus.emit('bim:mep-underfloor-delete-requested', { underfloorId: id }); break;
    case 'space-separator': EventBus.emit('bim:space-separator-delete-requested', { id }); break;
    // ADR-507 — FLAT DXF hatch (undo-of-create + delete-tool → Firestore deleteDoc + tombstone).
    case 'hatch': EventBus.emit('bim:hatch-delete-requested', { id }); break;
    default: break;
  }
}

/**
 * Fire `bim:entity-restore-requested` — ο **τρίτος αδελφός** του create/delete
 * lifecycle SSoT (συμμετρικός με τα `emitBimEntityCreated` / `emitBimEntityDeleteRequested`).
 * Τα persistence hooks ξαναγράφουν το Firestore doc (+ audit `action='restored'`) όταν
 * ένα delete αναιρείται ή ένα create επαναλαμβάνεται (redo), με το **ίδιο id**.
 *
 * Πριν ήταν copy-pasted inline σε 4 σημεία (DeleteEntityCommand, MergeColumnsCommand,
 * bim-clone-persistence, HatchLifecycleSignalCommand) — πλέον ΜΙΑ πηγή (N.0.2 / SSoT).
 * `source` default = `'undo-delete'` (η συχνότερη περίπτωση· redo → `'redo-restore'`).
 */
export function emitBimEntityRestoreRequested(
  entityType: RestoreRequestedPayload['entityType'],
  entitySnapshot: AnySceneEntity,
  source: RestoreRequestedPayload['source'] = 'undo-delete',
): void {
  EventBus.emit('bim:entity-restore-requested', { entityType, entitySnapshot, source });
}
