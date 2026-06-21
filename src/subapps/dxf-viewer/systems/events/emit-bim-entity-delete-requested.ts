/**
 * SSoT — single-entity BIM delete-event emitter (type → `bim:<type>-delete-requested`).
 *
 * Το mapping «entity type → delete event name + payload key» ζούσε **διπλό**:
 *   · `hooks/canvas/smart-delete-bim-events.emitBimDeleteEvents` (bulk smart-delete)·
 *   · hardcoded ανά command (`CreateColumnsCommand`/`CreateFoundationsCommand`).
 * Πλέον ζει ΜΙΑ φορά εδώ. Καταναλώνεται από:
 *   · `CreateBimEntityCommand.undo()` (ADR-390 — symmetric create/undo: ο create
 *      αναιρείται → Firestore deleteDoc, μηδέν zombie doc)·
 *   · `emitBimDeleteEvents` (bulk delete) που πλέον delegate-άρει εδώ.
 *
 * Global `EventBus` (ίδιο singleton με τον `useEventBus` hook — το proven από το
 * `CreateColumnsCommand` που εκπέμπει το ίδιο event global και το ακούει η
 * column persistence). Άγνωστος τύπος → no-op (η αφαίρεση από scene έχει ήδη γίνει).
 *
 * @see ../../hooks/canvas/smart-delete-bim-events.ts — bulk consumer (delegate)
 * @see ../../core/commands/entity-commands/CreateBimEntityCommand.ts — create-undo consumer
 * @see docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md
 */

import { EventBus } from './EventBus';

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
    case 'opening': EventBus.emit('bim:opening-delete-requested', { openingId: id }); break;
    case 'slab-opening': EventBus.emit('bim:slab-opening-delete-requested', { slabOpeningId: id }); break;
    case 'mep-fixture': EventBus.emit('bim:mep-fixture-delete-requested', { fixtureId: id }); break;
    case 'electrical-panel': EventBus.emit('bim:electrical-panel-delete-requested', { panelId: id }); break;
    case 'furniture': EventBus.emit('bim:furniture-delete-requested', { furnitureId: id }); break;
    case 'mep-segment': EventBus.emit('bim:mep-segment-delete-requested', { segmentId: id }); break;
    case 'mep-manifold': EventBus.emit('bim:mep-manifold-delete-requested', { manifoldId: id }); break;
    case 'mep-radiator': EventBus.emit('bim:mep-radiator-delete-requested', { radiatorId: id }); break;
    case 'mep-boiler': EventBus.emit('bim:mep-boiler-delete-requested', { boilerId: id }); break;
    case 'mep-water-heater': EventBus.emit('bim:mep-water-heater-delete-requested', { waterHeaterId: id }); break;
    case 'roof': EventBus.emit('bim:roof-delete-requested', { roofId: id }); break;
    case 'floor-finish': EventBus.emit('bim:floor-finish-delete-requested', { id }); break;
    case 'mep-underfloor': EventBus.emit('bim:mep-underfloor-delete-requested', { underfloorId: id }); break;
    case 'space-separator': EventBus.emit('bim:space-separator-delete-requested', { id }); break;
    default: break;
  }
}
