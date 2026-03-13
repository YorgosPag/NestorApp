/**
 * 🛡️ DELETION REGISTRY — Declarative Dependency Configuration
 *
 * Single source of truth for entity deletion rules.
 * Defines which collections reference each entity type,
 * so the deletion guard can check for blocking dependencies.
 *
 * Strategy: BOTTOM-UP ONLY / BLOCK
 * - If dependencies exist → deletion is BLOCKED
 * - User must delete children manually first
 *
 * @module config/deletion-registry
 * @enterprise ADR-226 — Deletion Guard (Phase 1)
 */

import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPES
// ============================================================================

/** How to query for dependent documents */
type QueryType = 'equals' | 'array-contains';

/** A single dependency that blocks deletion */
export interface DependencyDef {
  /** Firestore collection to query */
  collection: string;
  /** Field in that collection referencing this entity */
  foreignKey: string;
  /** Human-readable label (Greek) for UI display */
  label: string;
  /** Query strategy */
  queryType: QueryType;
}

/** Deletion strategy for an entity type */
type DeletionStrategy = 'BLOCK' | 'SOFT_DELETE';

/** Conditional pre-check before dependency scan */
interface ConditionalBlock {
  /** Field on the entity document to check */
  field: string;
  /** Condition to evaluate */
  condition: 'exists' | 'not-null';
  /** Greek message shown when condition is met */
  message: string;
}

/** Full deletion configuration for one entity type */
export interface EntityDeletionConfig {
  strategy: DeletionStrategy;
  dependencies: readonly DependencyDef[];
  conditionalBlock?: ConditionalBlock;
}

/** All entity types managed by the deletion guard */
export type EntityType =
  | 'contact'
  | 'unit'
  | 'floor'
  | 'project'
  | 'building'
  | 'company'
  | 'parking'
  | 'storage';

/** Result of a dependency check */
export interface DependencyCheckResult {
  /** Whether deletion is allowed */
  allowed: boolean;
  /** Per-collection dependency details */
  dependencies: Array<{
    label: string;
    collection: string;
    count: number;
    /** Up to 10 document IDs for preview/linking */
    documentIds: string[];
  }>;
  /** Total number of blocking dependents */
  totalDependents: number;
  /** Human-readable Greek message */
  message: string;
}

// ============================================================================
// REGISTRY
// ============================================================================

export const DELETION_REGISTRY: Record<EntityType, EntityDeletionConfig> = {
  // ─── CONTACT ────────────────────────────────────────────────────────
  contact: {
    strategy: 'BLOCK',
    dependencies: [
      {
        collection: COLLECTIONS.UNITS,
        foreignKey: 'commercial.buyerContactId',
        label: 'Πωλημένα διαμερίσματα',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.PARKING_SPACES,
        foreignKey: 'commercial.buyerContactId',
        label: 'Πωλημένες θέσεις στάθμευσης',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.STORAGE,
        foreignKey: 'commercial.buyerContactId',
        label: 'Πωλημένες αποθήκες',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.OPPORTUNITIES,
        foreignKey: 'contactId',
        label: 'Ευκαιρίες πώλησης',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.COMMUNICATIONS,
        foreignKey: 'contactId',
        label: 'Επικοινωνίες',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.APPOINTMENTS,
        foreignKey: 'requester.contactId',
        label: 'Ραντεβού',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.CONTACT_RELATIONSHIPS,
        foreignKey: 'sourceContactId',
        label: 'Σχέσεις (ως πηγή)',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.CONTACT_RELATIONSHIPS,
        foreignKey: 'targetContactId',
        label: 'Σχέσεις (ως στόχος)',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.CONTACT_LINKS,
        foreignKey: 'sourceContactId',
        label: 'Συνδέσεις επαφής',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.EXTERNAL_IDENTITIES,
        foreignKey: 'internalContactId',
        label: 'Εξωτερικές ταυτότητες',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.EMPLOYMENT_RECORDS,
        foreignKey: 'contactId',
        label: 'Εγγραφές απασχόλησης',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.ATTENDANCE_EVENTS,
        foreignKey: 'employeeId',
        label: 'Συμβάντα παρουσίας',
        queryType: 'equals',
      },
    ],
  },

  // ─── UNIT ───────────────────────────────────────────────────────────
  unit: {
    strategy: 'BLOCK',
    dependencies: [
      {
        collection: COLLECTIONS.OPPORTUNITIES,
        foreignKey: 'unitIds',
        label: 'Ευκαιρίες πώλησης',
        queryType: 'array-contains',
      },
      {
        collection: COLLECTIONS.COMMUNICATIONS,
        foreignKey: 'unitId',
        label: 'Επικοινωνίες',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.CONTACT_LINKS,
        foreignKey: 'targetEntityId',
        label: 'Συνδέσεις με επαφές',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.BOQ_ITEMS,
        foreignKey: 'linkedUnitId',
        label: 'Επιμετρήσεις (BOQ)',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.OBLIGATIONS,
        foreignKey: 'unitId',
        label: 'Υποχρεώσεις',
        queryType: 'equals',
      },
    ],
  },

  // ─── FLOOR ──────────────────────────────────────────────────────────
  floor: {
    strategy: 'BLOCK',
    dependencies: [
      {
        collection: COLLECTIONS.UNITS,
        foreignKey: 'floorId',
        label: 'Διαμερίσματα ορόφου',
        queryType: 'equals',
      },
    ],
  },

  // ─── PROJECT ────────────────────────────────────────────────────────
  project: {
    strategy: 'BLOCK',
    dependencies: [
      {
        collection: COLLECTIONS.BUILDINGS,
        foreignKey: 'projectId',
        label: 'Κτίρια',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.OPPORTUNITIES,
        foreignKey: 'projectIds',
        label: 'Ευκαιρίες πώλησης',
        queryType: 'array-contains',
      },
      {
        collection: COLLECTIONS.COMMUNICATIONS,
        foreignKey: 'projectId',
        label: 'Επικοινωνίες',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.CONTACT_LINKS,
        foreignKey: 'targetEntityId',
        label: 'Συνδέσεις με επαφές',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.CONSTRUCTION_PHASES,
        foreignKey: 'projectId',
        label: 'Φάσεις κατασκευής',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.OBLIGATIONS,
        foreignKey: 'projectId',
        label: 'Υποχρεώσεις',
        queryType: 'equals',
      },
    ],
  },

  // ─── BUILDING ───────────────────────────────────────────────────────
  building: {
    strategy: 'BLOCK',
    dependencies: [
      {
        collection: COLLECTIONS.UNITS,
        foreignKey: 'buildingId',
        label: 'Διαμερίσματα',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.FLOORS,
        foreignKey: 'buildingId',
        label: 'Όροφοι',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.PARKING_SPACES,
        foreignKey: 'buildingId',
        label: 'Θέσεις στάθμευσης',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.STORAGE,
        foreignKey: 'buildingId',
        label: 'Αποθήκες',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.BUILDING_MILESTONES,
        foreignKey: 'buildingId',
        label: 'Ορόσημα κτιρίου',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.FLOORPLANS,
        foreignKey: 'buildingId',
        label: 'Κατόψεις',
        queryType: 'equals',
      },
    ],
  },

  // ─── COMPANY ────────────────────────────────────────────────────────
  company: {
    strategy: 'BLOCK',
    dependencies: [
      {
        collection: COLLECTIONS.PROJECTS,
        foreignKey: 'companyId',
        label: 'Έργα',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.CONTACTS,
        foreignKey: 'companyId',
        label: 'Επαφές',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.BUILDINGS,
        foreignKey: 'companyId',
        label: 'Κτίρια',
        queryType: 'equals',
      },
    ],
  },

  // ─── PARKING ────────────────────────────────────────────────────────
  parking: {
    strategy: 'BLOCK',
    conditionalBlock: {
      field: 'commercial.buyerContactId',
      condition: 'not-null',
      message: 'Η θέση στάθμευσης έχει πωληθεί και δεν μπορεί να διαγραφεί.',
    },
    dependencies: [
      {
        collection: COLLECTIONS.CONTACT_LINKS,
        foreignKey: 'targetEntityId',
        label: 'Συνδέσεις με επαφές',
        queryType: 'equals',
      },
    ],
  },

  // ─── STORAGE ────────────────────────────────────────────────────────
  storage: {
    strategy: 'BLOCK',
    conditionalBlock: {
      field: 'commercial.buyerContactId',
      condition: 'not-null',
      message: 'Η αποθήκη έχει πωληθεί και δεν μπορεί να διαγραφεί.',
    },
    dependencies: [
      {
        collection: COLLECTIONS.CONTACT_LINKS,
        foreignKey: 'targetEntityId',
        label: 'Συνδέσεις με επαφές',
        queryType: 'equals',
      },
    ],
  },
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/** Get the Firestore collection name for a given entity type */
export function getEntityCollection(entityType: EntityType): string {
  const map: Record<EntityType, string> = {
    contact: COLLECTIONS.CONTACTS,
    unit: COLLECTIONS.UNITS,
    floor: COLLECTIONS.FLOORS,
    project: COLLECTIONS.PROJECTS,
    building: COLLECTIONS.BUILDINGS,
    company: COLLECTIONS.COMPANIES,
    parking: COLLECTIONS.PARKING_SPACES,
    storage: COLLECTIONS.STORAGE,
  };
  return map[entityType];
}

/** Validate that a string is a known EntityType */
export function isValidEntityType(value: string): value is EntityType {
  return value in DELETION_REGISTRY;
}
