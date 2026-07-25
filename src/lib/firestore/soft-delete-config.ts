/**
 * Soft-Delete Configuration Map — SSOT for entity-specific settings
 *
 * Each entity has: collection name, default restore status, permission,
 * labels for i18n/logging.
 *
 * @module lib/firestore/soft-delete-config
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import "server-only";

import { COLLECTIONS } from "@/config/firestore-collections";
import type { SoftDeletableEntityType } from "@/types/soft-deletable";

/** The single status value that means "in the trash". */
export const TRASHED_STATUS = "deleted";

/**
 * What the `GET /api/{entity}/trash` endpoint needs on top of the lifecycle
 * config — present only for entities that actually publish such an endpoint.
 *
 * Every field here is a **wire contract**: the response key is what
 * `EntityTrashSpec.selectItems` unwraps on the client, and `labelPluralEn` is
 * spliced into the 500 error message the endpoint has always returned. They are
 * data, not defaults to be tidied up.
 */
export interface TrashListConfig {
  /** Envelope key holding the rows, e.g. `{ success: true, buildings: [...] }`. */
  responseKey: string;
  /** Permission guarding the bin — the *view* permission, same as the normal list. */
  viewPermission: string;
  /** Document field the bin is ordered by (locale-aware string compare). */
  sortField: string;
  /** English plural spliced into log lines and the 500 message. */
  labelPluralEn: string;
  /** Logger module name, preserved per entity so server logs stay greppable. */
  loggerName: string;
}

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
  /**
   * Trash-list endpoint contract. Absent for entities whose bin is filtered
   * client-side and therefore have no `/trash` route — `contact` is the only
   * such entity today, and its absence here is the assertion of that fact.
   */
  trashList?: TrashListConfig;
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
export const SOFT_DELETE_CONFIG: Record<
  SoftDeletableEntityType,
  SoftDeleteEntityConfig
> = {
  contact: {
    collection: COLLECTIONS.CONTACTS,
    defaultRestoreStatus: "active",
    permission: "crm:contacts:delete",
    labelEl: "Epafi",
    labelEn: "Contact",
  },
  property: {
    collection: COLLECTIONS.PROPERTIES,
    defaultRestoreStatus: "available",
    permission: "properties:properties:delete",
    labelEl: "Akinito",
    labelEn: "Property",
    trashList: {
      responseKey: "properties",
      viewPermission: "properties:properties:view",
      sortField: "name",
      labelPluralEn: "properties",
      loggerName: "PropertiesTrashRoute",
    },
  },
  building: {
    collection: COLLECTIONS.BUILDINGS,
    defaultRestoreStatus: "active",
    permission: "buildings:buildings:delete",
    labelEl: "Ktirio",
    labelEn: "Building",
    trashList: {
      responseKey: "buildings",
      viewPermission: "buildings:buildings:view",
      sortField: "name",
      labelPluralEn: "buildings",
      loggerName: "BuildingsTrashRoute",
    },
  },
  project: {
    collection: COLLECTIONS.PROJECTS,
    defaultRestoreStatus: "planning",
    permission: "projects:projects:delete",
    labelEl: "Ergo",
    labelEn: "Project",
    trashList: {
      responseKey: "projects",
      viewPermission: "projects:projects:view",
      sortField: "name",
      labelPluralEn: "projects",
      loggerName: "ProjectsTrashRoute",
    },
  },
  parking: {
    collection: COLLECTIONS.PARKING_SPACES,
    defaultRestoreStatus: "available",
    permission: "units:units:delete",
    labelEl: "Thesi stathmeysis",
    labelEn: "Parking Spot",
    trashList: {
      responseKey: "parkingSpots",
      viewPermission: "units:units:view",
      sortField: "number",
      labelPluralEn: "parking spots",
      loggerName: "ParkingTrashRoute",
    },
  },
  storage: {
    collection: COLLECTIONS.STORAGE,
    defaultRestoreStatus: "available",
    permission: "units:units:delete",
    labelEl: "Apothiki",
    labelEn: "Storage Unit",
    trashList: {
      responseKey: "storages",
      viewPermission: "units:units:view",
      sortField: "name",
      labelPluralEn: "storage units",
      loggerName: "StoragesTrashRoute",
    },
  },
};

/**
 * Trash-list contract for an entity, or `undefined` when it publishes no
 * `/trash` endpoint.
 *
 * Returns the config rather than a boolean so a caller that needs the contract
 * gets it in the same step — no `!` assertion and no second lookup.
 */
export function getTrashListConfig(
  entityType: SoftDeletableEntityType,
): TrashListConfig | undefined {
  return SOFT_DELETE_CONFIG[entityType].trashList;
}

/** Entity types that publish a `GET /api/{entity}/trash` endpoint. */
export function listTrashListableEntities(): SoftDeletableEntityType[] {
  return (Object.keys(SOFT_DELETE_CONFIG) as SoftDeletableEntityType[]).filter(
    entityType => SOFT_DELETE_CONFIG[entityType].trashList !== undefined,
  );
}

/** Validate that an entity type is soft-deletable */
export function isSoftDeletableEntity(
  value: string,
): value is SoftDeletableEntityType {
  return value in SOFT_DELETE_CONFIG;
}
