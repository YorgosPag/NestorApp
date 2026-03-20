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
  /** Skip companyId filter — for collections without tenant isolation (e.g. accounting_invoices) */
  skipCompanyFilter?: boolean;
}

/** A dependency that gets auto-deleted (cascade) before blocking check */
export type CascadeDependencyDef = DependencyDef;

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
  /** Junction-record dependencies: auto-deleted BEFORE blocking check */
  cascadeDependencies?: readonly CascadeDependencyDef[];
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
    // Junction records — auto-deleted BEFORE blocking check
    cascadeDependencies: [
      {
        collection: COLLECTIONS.CONTACT_RELATIONSHIPS,
        foreignKey: 'sourceContactId',
        label: 'Σχέσεις (ως πηγή)',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
      {
        collection: COLLECTIONS.CONTACT_RELATIONSHIPS,
        foreignKey: 'targetContactId',
        label: 'Σχέσεις (ως στόχος)',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
      {
        collection: COLLECTIONS.CONTACT_LINKS,
        foreignKey: 'sourceContactId',
        label: 'Συνδέσεις επαφής',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
    ],
    // Blocking dependencies — user must delete manually
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
        collection: COLLECTIONS.EXTERNAL_IDENTITIES,
        foreignKey: 'internalContactId',
        label: 'Εξωτερικές ταυτότητες',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
      {
        collection: COLLECTIONS.EMPLOYMENT_RECORDS,
        foreignKey: 'contactId',
        label: 'Εγγραφές απασχόλησης',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
      {
        collection: COLLECTIONS.ATTENDANCE_EVENTS,
        foreignKey: 'employeeId',
        label: 'Συμβάντα παρουσίας',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
      // 🛡️ ADR-247 F-2: Block deletion of contact used as linkedCompanyId in projects
      {
        collection: COLLECTIONS.PROJECTS,
        foreignKey: 'linkedCompanyId',
        label: 'Συνδεδεμένα έργα (ως εταιρεία)',
        queryType: 'equals',
      },
    ],
  },

  // ─── UNIT ───────────────────────────────────────────────────────────
  unit: {
    strategy: 'BLOCK',
    conditionalBlock: {
      field: 'commercial.buyerContactId',
      condition: 'not-null',
      message: 'Η μονάδα έχει αγοραστή (κράτηση ή πώληση) και δεν μπορεί να διαγραφεί. Ακυρώστε πρώτα την κράτηση/πώληση.',
    },
    dependencies: [
      {
        collection: COLLECTIONS.ACCOUNTING_INVOICES,
        foreignKey: 'unitId',
        label: 'Τιμολόγια',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
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
    // TODO: ADR-AUDIT — Add check for unit.linkedSpaces[] referencing this parking spot.
    // Firestore cannot query array-of-objects by nested field (spaceId).
    // Options: (1) denormalize linkedUnitId on parking doc, (2) Cloud Function trigger.
    // Current protection: conditionalBlock catches sold spots (buyerContactId set by appurtenance-sync).
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
    // TODO: ADR-AUDIT — Same as parking: add check for unit.linkedSpaces[] referencing this storage.
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
