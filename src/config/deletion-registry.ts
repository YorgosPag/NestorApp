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
import { deriveDeletionDependencies } from '@/config/contact-dependency-registry';
import { normalizeProjectIdForQuery } from '@/utils/firestore-helpers';

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
  /** Recommended remediation shown to the user */
  remediation?: string;
  /** Query strategy */
  queryType: QueryType;
  /** Skip companyId filter — for collections without tenant isolation (e.g. accounting_invoices) */
  skipCompanyFilter?: boolean;
  /**
   * Optional normalizer for the entityId before querying.
   * Required when the foreign key may be stored as a different type in Firestore
   * (e.g., legacy numeric projectId stored as number, not string).
   * Firestore uses strict type matching — string '123' ≠ number 123.
   */
  valueNormalizer?: (value: string) => string | number;
}

/** A dependency that gets auto-deleted (cascade) before blocking check */
export interface CascadeDependencyDef extends DependencyDef {
  /**
   * Query a collectionGroup instead of a top-level collection.
   * Use when the target lives in a subcollection (e.g. `dxf_overlay_levels/{levelId}/items`).
   * `collection` then holds the subcollection ID (e.g. `'items'`).
   */
  useCollectionGroup?: boolean;
}

/**
 * Storage prefix cleanup applied after Firestore cascade.
 * Template placeholders: `{companyId}`, `{entityId}`.
 * Cleanup is best-effort (non-blocking): failures are logged but do not abort deletion.
 */
export interface StorageCleanupDef {
  pathTemplate: string;
  /** Human-readable label (Greek) for audit/log output */
  label: string;
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
  /** Junction-record dependencies: auto-deleted BEFORE blocking check */
  cascadeDependencies?: readonly CascadeDependencyDef[];
  /** Storage prefix cleanup executed AFTER Firestore cascade (best-effort). */
  storageCleanup?: readonly StorageCleanupDef[];
  conditionalBlock?: ConditionalBlock;
}

/** All entity types managed by the deletion guard */
export type EntityType =
  | 'contact'
  | 'property'
  | 'floor'
  | 'project'
  | 'building'
  | 'company'
  | 'parking'
  | 'storage';

// ============================================================================
// LINK REMOVAL GUARD TYPES (ADR-226 Phase 2)
// ============================================================================

/** Compound dependency: checks contact + scope entity in the same query */
export interface CompoundDependencyDef {
  collection: string;
  contactField: string;
  contactQueryType: QueryType;
  scopeField: string;
  scopeQueryType: QueryType;
  label: string;
  remediation?: string;
  skipCompanyFilter?: boolean;
}

/** Result of a dependency check */
export interface DependencyCheckResult {
  /** Whether deletion is allowed */
  allowed: boolean;
  /** Per-collection dependency details */
  dependencies: Array<{
    label: string;
    collection: string;
    count: number;
    remediation?: string;
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

// ============================================================================
// REMEDIATION SSOT
// ============================================================================

export const DEPENDENCY_REMEDIATIONS = {
  attendanceEvents: 'Υπάρχουν καταγεγραμμένες παρουσίες. Πρέπει πρώτα να γίνει διοικητική διόρθωση ή αντιλογισμός παρουσιών και μετά επανέλεγχος.',
  employmentRecords: 'Υπάρχουν εγγραφές απασχόλησης, ένσημα ή εισφορές. Διορθώστε πρώτα τις σχετικές περιόδους ΑΠΔ/ΕΦΚΑ και μετά επιχειρήστε ξανά.',
  communications: 'Μεταφέρετε, αποσυνδέστε ή διαγράψτε πρώτα τις σχετικές επικοινωνίες.',
  opportunities: 'Κλείστε ή αποσυνδέστε πρώτα τις σχετικές ευκαιρίες πώλησης.',
  propertiesOwnership: 'Αφαιρέστε πρώτα την ιδιοκτησιακή σχέση από τα σχετικά ακίνητα ή μεταβιβάστε την σε άλλο πρόσωπο.',
  contactLinks: 'Αποσυνδέστε πρώτα τις σχετικές συνδέσεις με άλλα entities.',
  obligations: 'Κλείστε, μεταφέρετε ή διαγράψτε πρώτα τις σχετικές υποχρεώσεις.',
  constructionChildren: 'Διαγράψτε πρώτα τα εξαρτώμενα στοιχεία κατασκευής που ανήκουν σε αυτό το entity.',
  accountingDocs: 'Διαγράψτε ή επανασυνδέστε πρώτα τα σχετιζόμενα οικονομικά παραστατικά.',
  projectsAsCompany: 'Μεταφέρετε πρώτα τα έργα σε άλλη εταιρεία ή διαγράψτε τα έργα που εξαρτώνται από αυτήν.',
  landowners: 'Αφαιρέστε πρώτα τον οικοπεδούχο από τα έργα ή τις ιδιοκτησίες όπου χρησιμοποιείται.',
  generic: 'Αφαιρέστε ή επανασυνδέστε πρώτα τις εξαρτώμενες εγγραφές που εμφανίζονται παρακάτω.',
  guardUnavailable: 'Ο έλεγχος εξαρτήσεων δεν ολοκληρώθηκε αξιόπιστα. Δοκιμάστε ξανά και, αν επιμείνει, επικοινωνήστε με διαχειριστή.',
  buildings: 'Διαγράψτε πρώτα όλα τα κτίρια που ανήκουν σε αυτό το έργο. Πηγαίνετε στη σελίδα "Κτίρια", επιλέξτε κάθε κτίριο και διαγράψτε το.',
} as const;

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
      {
        collection: COLLECTIONS.SEARCH_DOCUMENTS,
        foreignKey: 'entityId',
        label: 'Search index',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
    ],
    // Blocking dependencies — DERIVED from unified ContactDependencyRegistry (ADR-145 SSoT)
    // Single source of truth: src/config/contact-dependency-registry.ts
    dependencies: deriveDeletionDependencies(),
  },

  // ─── PROPERTY ──────────────────────────────────────────────────────
  // Note: entity_audit_trail is intentionally NOT cascaded — preserved as a
  // permanent audit log (Google pattern). Orphan entries are expected & safe.
  property: {
    strategy: 'BLOCK',
    conditionalBlock: {
      field: 'commercial.owners',
      condition: 'exists',
      message: 'Το ακίνητο έχει αγοραστή (κράτηση ή πώληση) και δεν μπορεί να διαγραφεί. Ακυρώστε πρώτα την κράτηση/πώληση.',
    },
    cascadeDependencies: [
      {
        collection: COLLECTIONS.SEARCH_DOCUMENTS,
        foreignKey: 'entityId',
        label: 'Search index',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
      {
        collection: COLLECTIONS.FILES,
        foreignKey: 'entityId',
        label: 'Αρχεία ακινήτου',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.SHARES,
        foreignKey: 'entityId',
        label: 'Share tokens (showcase κ.λπ.)',
        queryType: 'equals',
      },
      {
        // Subcollection: dxf_overlay_levels/{levelId}/items/{overlayId}
        // No dedicated COLLECTIONS constant — `items` is the subcollection ID.
        collection: 'items',
        foreignKey: 'linked.propertyId',
        label: 'DXF overlay polygons',
        queryType: 'equals',
        useCollectionGroup: true,
        // Legacy overlays may have companyId: null; propertyId is globally
        // unique (UUID), so skipping tenant filter is safe here.
        skipCompanyFilter: true,
      },
    ],
    storageCleanup: [
      {
        pathTemplate: 'companies/{companyId}/entities/property/{entityId}/',
        label: 'Storage ακινήτου (φωτογραφίες, κατόψεις, share PDFs)',
      },
    ],
    dependencies: [
      {
        collection: COLLECTIONS.ACCOUNTING_INVOICES,
        foreignKey: 'propertyId',
        label: 'Τιμολόγια',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
      {
        collection: COLLECTIONS.OPPORTUNITIES,
        foreignKey: 'propertyIds',
        label: 'Ευκαιρίες πώλησης',
        queryType: 'array-contains',
      },
      {
        collection: COLLECTIONS.COMMUNICATIONS,
        foreignKey: 'propertyId',
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
        foreignKey: 'linkedPropertyId',
        label: 'Επιμετρήσεις (BOQ)',
        queryType: 'equals',
      },
      {
        collection: COLLECTIONS.OBLIGATIONS,
        foreignKey: 'propertyId',
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
        collection: COLLECTIONS.PROPERTIES,
        foreignKey: 'floorId',
        label: 'Διαμερίσματα ορόφου',
        queryType: 'equals',
      },
    ],
  },

  // ─── PROJECT ────────────────────────────────────────────────────────
  project: {
    strategy: 'BLOCK',
    cascadeDependencies: [
      {
        collection: COLLECTIONS.SEARCH_DOCUMENTS,
        foreignKey: 'entityId',
        label: 'Search index',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
    ],
    dependencies: [
      {
        collection: COLLECTIONS.BUILDINGS,
        foreignKey: 'projectId',
        label: 'Κτίρια',
        queryType: 'equals',
        remediation: DEPENDENCY_REMEDIATIONS.buildings,
        // Legacy projects may store projectId as a number in Firestore.
        // Firestore strict type matching: string '123' ≠ number 123.
        valueNormalizer: normalizeProjectIdForQuery,
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
    cascadeDependencies: [
      {
        collection: COLLECTIONS.SEARCH_DOCUMENTS,
        foreignKey: 'entityId',
        label: 'Search index',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
    ],
    dependencies: [
      {
        collection: COLLECTIONS.PROPERTIES,
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
      field: 'commercial.owners',
      condition: 'exists',
      message: 'Η θέση στάθμευσης έχει πωληθεί και δεν μπορεί να διαγραφεί.',
    },
    cascadeDependencies: [
      {
        collection: COLLECTIONS.SEARCH_DOCUMENTS,
        foreignKey: 'entityId',
        label: 'Search index',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
    ],
    // TODO: ADR-AUDIT — Add check for unit.linkedSpaces[] referencing this parking spot.
    // Firestore cannot query array-of-objects by nested field (spaceId).
    // Options: (1) denormalize linkedUnitId on parking doc, (2) Cloud Function trigger.
    // Current protection: conditionalBlock catches sold spots (owners set by appurtenance-sync).
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
      field: 'commercial.owners',
      condition: 'exists',
      message: 'Η αποθήκη έχει πωληθεί και δεν μπορεί να διαγραφεί.',
    },
    cascadeDependencies: [
      {
        collection: COLLECTIONS.SEARCH_DOCUMENTS,
        foreignKey: 'entityId',
        label: 'Search index',
        queryType: 'equals',
        skipCompanyFilter: true,
      },
    ],
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
// LINK REMOVAL REGISTRY — Compound dependency checks (ADR-226 Phase 2)
// ============================================================================

/**
 * When removing a contact link from an entity (project/building),
 * check if the contact has active references within that entity's scope.
 */
export const LINK_REMOVAL_REGISTRY: Partial<Record<EntityType, readonly CompoundDependencyDef[]>> = {
  project: [
    { collection: COLLECTIONS.PROPERTIES, contactField: 'commercial.ownerContactIds', contactQueryType: 'array-contains', scopeField: 'projectId', scopeQueryType: 'equals', label: 'Ιδιοκτησία ακινήτου' },
    { collection: COLLECTIONS.OPPORTUNITIES, contactField: 'contactId', contactQueryType: 'equals', scopeField: 'projectIds', scopeQueryType: 'array-contains', label: 'Ευκαιρίες πώλησης' },
    { collection: COLLECTIONS.COMMUNICATIONS, contactField: 'contactId', contactQueryType: 'equals', scopeField: 'projectId', scopeQueryType: 'equals', label: 'Επικοινωνίες' },
    { collection: COLLECTIONS.ATTENDANCE_EVENTS, contactField: 'contactId', contactQueryType: 'equals', scopeField: 'projectId', scopeQueryType: 'equals', label: 'Συμβάντα παρουσίας εργατοτεχνίτη' },
    { collection: COLLECTIONS.EMPLOYMENT_RECORDS, contactField: 'contactId', contactQueryType: 'equals', scopeField: 'projectId', scopeQueryType: 'equals', label: 'Εγγραφές απασχόλησης / ένσημα / εισφορές' },
  ],
  building: [
    { collection: COLLECTIONS.PARKING_SPACES, contactField: 'commercial.ownerContactIds', contactQueryType: 'array-contains', scopeField: 'buildingId', scopeQueryType: 'equals', label: 'Θέσεις parking' },
    { collection: COLLECTIONS.STORAGE, contactField: 'commercial.ownerContactIds', contactQueryType: 'array-contains', scopeField: 'buildingId', scopeQueryType: 'equals', label: 'Αποθήκες' },
  ],
  // TODO Phase 2: property-scoped deps (legal_contracts.professionals[] — needs denormalization)
};

// ============================================================================
// HELPERS
// ============================================================================

/** Get the Firestore collection name for a given entity type */
export function getEntityCollection(entityType: EntityType): string {
  const map: Record<EntityType, string> = {
    contact: COLLECTIONS.CONTACTS,
    property: COLLECTIONS.PROPERTIES,
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
