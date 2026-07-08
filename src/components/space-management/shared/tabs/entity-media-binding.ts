/**
 * entity-media-binding — per-entity adapter for the shared media/files tabs
 *
 * Normalises a Parking spot or a Storage unit into the minimal shape the
 * generic {@link EntityMediaFilesTab} needs. This is the "per-entity binding"
 * half of the shell+binding pattern (mirrors ADR-585 DomainCard binding and
 * ADR-586 webhook adapters).
 *
 * @module components/space-management/shared/tabs/entity-media-binding
 * @see ADR-588 — Space Media Tab Shell
 */

import { ENTITY_TYPES, type EntityType } from '@/config/domain-constants';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import type { Storage } from '@/types/storage/contracts';

/** Normalised, entity-agnostic binding consumed by EntityMediaFilesTab. */
export interface EntityMediaBinding {
  /** Canonical entity type for the file storage path (ADR-031). */
  entityType: EntityType;
  /** Entity document id. */
  entityId: string;
  /** Human-readable label shown in the files manager. */
  entityLabel?: string;
  /** Owning project id, when available. */
  projectId?: string;
  /** i18n namespace used to resolve the unauthenticated sign-in message. */
  i18nNamespace: string;
  /** Purpose prefix for canonical file naming (`${prefix}-${purposeKey}`). */
  purposePrefix: string;
}

/** Binding for a parking spot detail view. */
export function parkingMediaBinding(parking: ParkingSpot): EntityMediaBinding {
  return {
    entityType: ENTITY_TYPES.PARKING_SPOT,
    entityId: parking.id,
    entityLabel: parking.number,
    projectId: parking.projectId,
    i18nNamespace: 'parking',
    purposePrefix: 'parking',
  };
}

/** Binding for a storage unit detail view. */
export function storageMediaBinding(storage: Storage): EntityMediaBinding {
  return {
    entityType: ENTITY_TYPES.STORAGE,
    entityId: storage.id,
    entityLabel: storage.name,
    projectId: storage.projectId,
    i18nNamespace: 'storage',
    purposePrefix: 'storage',
  };
}
