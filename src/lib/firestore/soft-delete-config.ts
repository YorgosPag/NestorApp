/**
 * Soft-Delete Configuration Map — SSOT for entity-specific settings
 *
 * Each entity has: collection name, default restore status, permission,
 * labels for i18n/logging.
 *
 * @module lib/firestore/soft-delete-config
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

export interface SoftDeleteEntityConfig {
  /** Firestore collection name (from COLLECTIONS) */
  collection: string;
  /** Default status when restoring without previousStatus */
  defaultRestoreStatus: string;
  /** Permission string for withAuth */
  permission: string;
  /** Greek label (for logs and audit) */
  labelEl: string;
  /** English label (for API responses) */
  labelEn: string;
}

/**
 * SSOT config for each soft-deletable entity type.
 *
 * ADDING NEW ENTITY:
 * 1. Add entry here
 * 2. Add 'deleted' to the entity's status union
 * 3. Add SoftDeletableFields to the entity's interface
 * 4. Change DELETE route to call softDelete() instead of executeDeletion()
 * 5. Add .where('status', '!=', 'deleted') to the list route
 */
export const SOFT_DELETE_CONFIG: Record<SoftDeletableEntityType, SoftDeleteEntityConfig> = {
  contact: {
    collection: COLLECTIONS.CONTACTS,
    defaultRestoreStatus: 'active',
    permission: 'crm:contacts:delete',
    labelEl: 'Epafi',
    labelEn: 'Contact',
  },
  property: {
    collection: COLLECTIONS.PROPERTIES,
    defaultRestoreStatus: 'available',
    permission: 'properties:properties:delete',
    labelEl: 'Akinito',
    labelEn: 'Property',
  },
  building: {
    collection: COLLECTIONS.BUILDINGS,
    defaultRestoreStatus: 'active',
    permission: 'buildings:buildings:delete',
    labelEl: 'Ktirio',
    labelEn: 'Building',
  },
  project: {
    collection: COLLECTIONS.PROJECTS,
    defaultRestoreStatus: 'planning',
    permission: 'projects:projects:delete',
    labelEl: 'Ergo',
    labelEn: 'Project',
  },
  parking: {
    collection: COLLECTIONS.PARKING_SPACES,
    defaultRestoreStatus: 'available',
    permission: 'units:units:delete',
    labelEl: 'Thesi stathmeysis',
    labelEn: 'Parking Spot',
  },
  storage: {
    collection: COLLECTIONS.STORAGE,
    defaultRestoreStatus: 'available',
    permission: 'units:units:delete',
    labelEl: 'Apothiki',
    labelEn: 'Storage Unit',
  },
};

/** Validate that an entity type is soft-deletable */
export function isSoftDeletableEntity(value: string): value is SoftDeletableEntityType {
  return value in SOFT_DELETE_CONFIG;
}
