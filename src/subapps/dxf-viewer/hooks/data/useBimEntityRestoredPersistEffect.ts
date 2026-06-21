'use client';

/**
 * ADR-390 SSoT — `bim:entity-restore-requested` persistence side-effect.
 *
 * Symmetric inverse του `useBimEntityMovedPersistEffect` για undo→restore flow.
 * Each BIM persistence hook (`useWallPersistence`, `useSlabPersistence`, κλπ)
 * calls this once με entity-type discriminator + per-hook `persistRestore`.
 *
 * Triggered by `DeleteEntityCommand.undo()` / `DeleteMultipleEntitiesCommand.undo()`
 * which emit `bim:entity-restore-requested` AFTER `sceneManager.addEntity(snapshot)`.
 *
 * Effect flow:
 *   1. Type-guard payload — single shared event fans out to 7 hooks
 *   2. `pendingFirstSaveIdsRef.add(id)` — marks "in-flight first save" so the
 *      subscribe-loop ghost-drop guard does NOT drop the entity during the race
 *   3. `deletedIdsRef.delete(id)` — clear tombstone (entity is back, not deleted)
 *   4. Invoke per-hook `persistRestore(entity)` — writes Firestore doc +
 *      audit row με `action='restored'` (όχι misleading `'created'`)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md
 */

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import type { AnySceneEntity } from '../../types/entities';

type BimRestoreEntityType =
  | 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair'
  // ADR-436 — substructure footing (pad/strip/tie-beam, IfcFooting).
  | 'foundation'
  // ADR-406 — point-based MEP fixture.
  | 'mep-fixture'
  // ADR-408 Φ3 — point-based electrical panel.
  | 'electrical-panel'
  // ADR-407 — standalone path-based railing.
  | 'railing'
  // ADR-410 — mesh-based CC0 furniture.
  | 'furniture'
  // ADR-408 Φ8 — unified linear MEP segment (duct + pipe).
  | 'mep-segment'
  // ADR-415 — pure-vector 2D floorplan symbol.
  | 'floorplan-symbol'
  // ADR-408 Φ12 — plumbing manifold (floor-mounted distributor).
  | 'mep-manifold'
  // ADR-408 Εύρος Β — heating radiator (wall-mounted terminal).
  | 'mep-radiator'
  // ADR-408 Εύρος Β #2 — heating boiler (wall-mounted heat source).
  | 'mep-boiler'
  // ADR-408 — DHW water heater (θερμοσίφωνας / αντλία θερμότητας ΖΝΧ).
  | 'mep-water-heater'
  // ADR-417 — parametric pitched roof.
  | 'roof'
  // ADR-419 — per-room floor-finish covering.
  | 'floor-finish'
  // ADR-511 — wall finish per room/face (IfcCovering CLADDING/INTERIOR).
  | 'wall-covering'
  // ADR-408 Εύρος Β #3 — area-based underfloor radiant heating loop.
  | 'mep-underfloor'
  // ADR-422 — analytical thermal space (IfcSpace).
  | 'thermal-space'
  // ADR-437 — space separator (IfcVirtualElement).
  | 'space-separator';

export function useBimEntityRestoredPersistEffect<T extends AnySceneEntity, S>(
  entityType: BimRestoreEntityType,
  isEntityType: (e: AnySceneEntity) => e is T,
  serviceRef: MutableRefObject<S | null>,
  pendingFirstSaveIdsRef: MutableRefObject<Set<string>>,
  deletedIdsRef: MutableRefObject<Set<string>>,
  persistRestore: (entity: T) => Promise<void>,
): void {
  useEffect(() => {
    return EventBus.on('bim:entity-restore-requested', (payload) => {
      if (payload.entityType !== entityType) return;
      if (!serviceRef.current) return;
      const snapshot = payload.entitySnapshot;
      if (!isEntityType(snapshot)) return;
      pendingFirstSaveIdsRef.current.add(snapshot.id);
      deletedIdsRef.current.delete(snapshot.id);
      void persistRestore(snapshot);
    });
  }, [entityType, isEntityType, serviceRef, pendingFirstSaveIdsRef, deletedIdsRef, persistRestore]);
}
