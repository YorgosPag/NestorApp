/**
 * 🏢 CONTACT DEPENDENCY REGISTRY — Single Source of Truth
 *
 * Unified, declarative registry of ALL Firestore collections that reference
 * a contact. Every dependency is defined ONCE here with metadata about:
 * - Which contact types it applies to
 * - Which mutation scenarios trigger a check
 * - How to query Firestore for it
 * - What impact mode applies per scenario (block / warn / info)
 *
 * Consumers:
 * - contact-impact-engine.ts — shared server-side query engine
 * - deletion-registry.ts — derives contact blocking deps via deriveDeletionDependencies()
 * - Impact preview services — thin wrappers over the engine
 *
 * @module config/contact-dependency-registry
 * @enterprise ADR-145 — Contact Dependency SSoT
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { ContactType } from '@/types/contacts';

// ============================================================================
// SCENARIO & QUERY TYPES
// ============================================================================

/** All scenarios where a contact dependency might be checked */
export type ContactImpactScenario =
  | 'deletion'
  | 'identityChange'
  | 'companyIdentityChange'
  | 'communicationChange'
  | 'addressChange'
  | 'nameChange';

/** How to query Firestore */
export type ContactQueryType = 'equals' | 'array-contains';

/** Impact mode per scenario */
export type DependencyImpactMode = 'block' | 'warn' | 'info';

// ── Query Strategies (discriminated union) ─────────────────────────────────

interface StandardQueryStrategy {
  readonly type: 'standard';
  readonly collection: string;
  readonly foreignKey: string;
  readonly queryType: ContactQueryType;
  readonly skipCompanyFilter?: boolean;
}

interface SubcollectionQueryStrategy {
  readonly type: 'subcollection';
  readonly parentCollection: string;
  readonly parentForeignKey: string;
  readonly parentQueryType: ContactQueryType;
  readonly subcollection: string;
  readonly subcollectionForeignKey: string;
  readonly skipCompanyFilter?: boolean;
}

interface CompoundQueryStrategy {
  readonly type: 'compound';
  readonly collection: string;
  readonly foreignKey: string;
  readonly queryType: ContactQueryType;
  readonly additionalFilters: ReadonlyArray<{
    readonly field: string;
    readonly operator: '==' | 'array-contains';
    readonly value: string;
  }>;
  readonly skipCompanyFilter?: boolean;
}

export type ContactQueryStrategy =
  | StandardQueryStrategy
  | SubcollectionQueryStrategy
  | CompoundQueryStrategy;

// ── Scenario Behavior ──────────────────────────────────────────────────────

/** How a dependency behaves in a specific scenario */
export interface ScenarioBehavior {
  readonly mode: DependencyImpactMode;
  /**
   * Only apply when specific field categories change.
   * Used by individual identity guard (e.g., AMKA → block attendance).
   * If omitted, applies to all changes in this scenario.
   */
  readonly onlyForFieldCategories?: ReadonlyArray<string>;
}

// ── Core Registry Entry ────────────────────────────────────────────────────

export interface ContactDependencyDef {
  readonly id: string;
  readonly label: string;
  readonly remediation?: string;
  readonly contactTypes: ReadonlyArray<ContactType>;
  readonly query: ContactQueryStrategy;
  readonly scenarios: Partial<Record<ContactImpactScenario, ScenarioBehavior>>;
}

// ============================================================================
// REGISTRY DATA
// ============================================================================

const ALL_TYPES: ReadonlyArray<ContactType> = ['individual', 'company', 'service'];

export const CONTACT_DEPENDENCY_REGISTRY: ReadonlyArray<ContactDependencyDef> = [
  // ── Ownership ────────────────────────────────────────────────────────────
  {
    id: 'properties',
    label: 'Πωλημένα διαμερίσματα',
    remediation: 'Αφαιρέστε πρώτα την ιδιοκτησιακή σχέση από τα σχετικά ακίνητα ή μεταβιβάστε την σε άλλο πρόσωπο.',
    contactTypes: ALL_TYPES,
    query: { type: 'standard', collection: COLLECTIONS.PROPERTIES, foreignKey: 'commercial.ownerContactIds', queryType: 'array-contains' },
    scenarios: {
      deletion: { mode: 'block' },
      identityChange: { mode: 'warn' },
      companyIdentityChange: { mode: 'warn' },
      communicationChange: { mode: 'warn' },
      addressChange: { mode: 'warn' },
      nameChange: { mode: 'warn' },
    },
  },
  {
    id: 'propertyPaymentPlans',
    label: 'Δόσεις πληρωμής',
    contactTypes: ALL_TYPES,
    query: {
      type: 'subcollection',
      parentCollection: COLLECTIONS.PROPERTIES,
      parentForeignKey: 'commercial.ownerContactIds',
      parentQueryType: 'array-contains',
      subcollection: SUBCOLLECTIONS.PROPERTY_PAYMENT_PLANS,
      subcollectionForeignKey: 'ownerContactId',
    },
    scenarios: {
      nameChange: { mode: 'warn' },
      addressChange: { mode: 'warn' },
      communicationChange: { mode: 'warn' },
    },
  },
  {
    id: 'parking',
    label: 'Πωλημένες θέσεις στάθμευσης',
    remediation: 'Αφαιρέστε πρώτα την ιδιοκτησιακή σχέση από τις θέσεις στάθμευσης.',
    contactTypes: ALL_TYPES,
    query: { type: 'standard', collection: COLLECTIONS.PARKING_SPACES, foreignKey: 'commercial.ownerContactIds', queryType: 'array-contains' },
    scenarios: {
      deletion: { mode: 'block' },
      identityChange: { mode: 'warn' },
      companyIdentityChange: { mode: 'warn' },
      nameChange: { mode: 'warn' },
    },
  },
  {
    id: 'storage',
    label: 'Πωλημένες αποθήκες',
    remediation: 'Αφαιρέστε πρώτα την ιδιοκτησιακή σχέση από τις αποθήκες.',
    contactTypes: ALL_TYPES,
    query: { type: 'standard', collection: COLLECTIONS.STORAGE, foreignKey: 'commercial.ownerContactIds', queryType: 'array-contains' },
    scenarios: {
      deletion: { mode: 'block' },
      identityChange: { mode: 'warn' },
      companyIdentityChange: { mode: 'warn' },
      nameChange: { mode: 'warn' },
    },
  },

  // ── CRM ──────────────────────────────────────────────────────────────────
  {
    id: 'opportunities',
    label: 'Ευκαιρίες πώλησης',
    remediation: 'Κλείστε ή αποσυνδέστε πρώτα τις σχετικές ευκαιρίες πώλησης.',
    contactTypes: ALL_TYPES,
    query: { type: 'standard', collection: COLLECTIONS.OPPORTUNITIES, foreignKey: 'contactId', queryType: 'equals' },
    scenarios: {
      deletion: { mode: 'block' },
      identityChange: { mode: 'warn' },
    },
  },
  {
    id: 'communications',
    label: 'Επικοινωνίες',
    remediation: 'Μεταφέρετε, αποσυνδέστε ή διαγράψτε πρώτα τις σχετικές επικοινωνίες.',
    contactTypes: ALL_TYPES,
    query: { type: 'standard', collection: COLLECTIONS.COMMUNICATIONS, foreignKey: 'contactId', queryType: 'equals' },
    scenarios: {
      deletion: { mode: 'block' },
      identityChange: { mode: 'warn' },
      communicationChange: { mode: 'warn' },
    },
  },
  {
    id: 'appointments',
    label: 'Ραντεβού',
    contactTypes: ALL_TYPES,
    query: { type: 'standard', collection: COLLECTIONS.APPOINTMENTS, foreignKey: 'requester.contactId', queryType: 'equals' },
    scenarios: {
      deletion: { mode: 'block' },
    },
  },

  // ── Identity / Compliance ────────────────────────────────────────────────
  {
    id: 'externalIdentities',
    label: 'Εξωτερικές ταυτότητες',
    contactTypes: ALL_TYPES,
    query: { type: 'standard', collection: COLLECTIONS.EXTERNAL_IDENTITIES, foreignKey: 'internalContactId', queryType: 'equals', skipCompanyFilter: true },
    scenarios: {
      deletion: { mode: 'block' },
    },
  },
  {
    id: 'employmentRecords',
    label: 'Εγγραφές απασχόλησης',
    remediation: 'Διορθώστε πρώτα τις σχετικές περιόδους ΑΠΔ/ΕΦΚΑ και μετά επιχειρήστε ξανά.',
    contactTypes: ['individual'],
    query: { type: 'standard', collection: COLLECTIONS.EMPLOYMENT_RECORDS, foreignKey: 'contactId', queryType: 'equals', skipCompanyFilter: true },
    scenarios: {
      deletion: { mode: 'block' },
      identityChange: { mode: 'warn', onlyForFieldCategories: ['identity', 'regulated'] },
    },
  },
  {
    id: 'attendanceEvents',
    label: 'Συμβάντα παρουσίας',
    remediation: 'Πρέπει πρώτα να γίνει διοικητική διόρθωση ή αντιλογισμός παρουσιών και μετά επανέλεγχος.',
    contactTypes: ['individual'],
    query: { type: 'standard', collection: COLLECTIONS.ATTENDANCE_EVENTS, foreignKey: 'contactId', queryType: 'equals' },
    scenarios: {
      deletion: { mode: 'block' },
      identityChange: { mode: 'warn', onlyForFieldCategories: ['identity', 'regulated'] },
    },
  },

  // ── Project Dependencies ─────────────────────────────────────────────────
  {
    id: 'projectsAsCompany',
    label: 'Συνδεδεμένα έργα (ως εταιρεία)',
    remediation: 'Μεταφέρετε πρώτα τα έργα σε άλλη εταιρεία ή διαγράψτε τα έργα που εξαρτώνται από αυτήν.',
    contactTypes: ['company'],
    query: { type: 'standard', collection: COLLECTIONS.PROJECTS, foreignKey: 'linkedCompanyId', queryType: 'equals' },
    scenarios: {
      deletion: { mode: 'block' },
      companyIdentityChange: { mode: 'warn' },
      communicationChange: { mode: 'warn' },
    },
  },
  {
    id: 'projectsAsLandowner',
    label: 'Έργα (ως οικοπεδούχος)',
    remediation: 'Αφαιρέστε πρώτα τον οικοπεδούχο από τα έργα ή τις ιδιοκτησίες όπου χρησιμοποιείται.',
    contactTypes: ['individual', 'company'],
    query: { type: 'standard', collection: COLLECTIONS.PROJECTS, foreignKey: 'landownerContactIds', queryType: 'array-contains' },
    scenarios: {
      deletion: { mode: 'block' },
      identityChange: { mode: 'warn' },
      nameChange: { mode: 'warn' },
    },
  },
  {
    id: 'projectLinks',
    label: 'Συνδέσεις σε έργα',
    contactTypes: ALL_TYPES,
    query: {
      type: 'compound',
      collection: COLLECTIONS.CONTACT_LINKS,
      foreignKey: 'sourceContactId',
      queryType: 'equals',
      additionalFilters: [
        { field: 'targetEntityType', operator: '==', value: 'project' },
        { field: 'status', operator: '==', value: 'active' },
      ],
      skipCompanyFilter: true,
    },
    scenarios: {
      identityChange: { mode: 'warn' },
    },
  },

  // ── Relationship Dependencies ────────────────────────────────────────────
  {
    id: 'contactRelationships',
    label: 'Σχέσεις επαφής',
    contactTypes: ALL_TYPES,
    query: { type: 'standard', collection: COLLECTIONS.CONTACT_RELATIONSHIPS, foreignKey: 'sourceContactId', queryType: 'equals', skipCompanyFilter: true },
    scenarios: {
      identityChange: { mode: 'warn' },
    },
  },

  // ── Financial (company-specific) ─────────────────────────────────────────
  {
    id: 'obligations',
    label: 'Υποχρεώσεις',
    remediation: 'Κλείστε, μεταφέρετε ή διαγράψτε πρώτα τις σχετικές υποχρεώσεις.',
    contactTypes: ['company'],
    query: { type: 'standard', collection: COLLECTIONS.OBLIGATIONS, foreignKey: 'companyId', queryType: 'equals' },
    scenarios: {
      companyIdentityChange: { mode: 'warn' },
    },
  },
  {
    id: 'invoices',
    label: 'Τιμολόγια',
    contactTypes: ['company'],
    query: { type: 'standard', collection: COLLECTIONS.ACCOUNTING_INVOICES, foreignKey: 'customer.contactId', queryType: 'equals', skipCompanyFilter: true },
    scenarios: {
      companyIdentityChange: { mode: 'info' },
      addressChange: { mode: 'info' },
      communicationChange: { mode: 'info' },
    },
  },
  {
    id: 'apyCertificates',
    label: 'Πιστοποιητικά ΑΠΥ',
    contactTypes: ['company'],
    query: { type: 'standard', collection: COLLECTIONS.ACCOUNTING_APY_CERTIFICATES, foreignKey: 'customerId', queryType: 'equals', skipCompanyFilter: true },
    scenarios: {
      companyIdentityChange: { mode: 'info' },
      addressChange: { mode: 'info' },
      communicationChange: { mode: 'info' },
    },
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Filter registry entries for a given scenario and contact type.
 */
export function getDependenciesForScenario(
  scenario: ContactImpactScenario,
  contactType: ContactType,
  fieldCategories?: ReadonlyArray<string>,
): ReadonlyArray<ContactDependencyDef> {
  return CONTACT_DEPENDENCY_REGISTRY.filter((dep) => {
    if (!dep.contactTypes.includes(contactType)) return false;
    const behavior = dep.scenarios[scenario];
    if (!behavior) return false;
    if (fieldCategories && behavior.onlyForFieldCategories) {
      return behavior.onlyForFieldCategories.some((cat) => fieldCategories.includes(cat));
    }
    return true;
  });
}

/**
 * Get the impact mode for a dependency in a given scenario.
 */
export function getScenarioMode(
  dep: ContactDependencyDef,
  scenario: ContactImpactScenario,
): DependencyImpactMode {
  return dep.scenarios[scenario]?.mode ?? 'warn';
}

// ============================================================================
// DELETION REGISTRY DERIVATION
// ============================================================================

/**
 * Derive deletion-blocking dependencies from the unified registry.
 * Return shape is structurally compatible with DependencyDef from deletion-registry.ts.
 * No import needed — TypeScript structural typing handles compatibility.
 */
export function deriveDeletionDependencies(): ReadonlyArray<{
  collection: string;
  foreignKey: string;
  label: string;
  queryType: ContactQueryType;
  remediation?: string;
  skipCompanyFilter?: boolean;
}> {
  return CONTACT_DEPENDENCY_REGISTRY
    .filter((dep) => dep.scenarios.deletion?.mode === 'block' && dep.query.type === 'standard')
    .map((dep) => {
      const q = dep.query as StandardQueryStrategy;
      return {
        collection: q.collection,
        foreignKey: q.foreignKey,
        label: dep.label,
        queryType: q.queryType,
        remediation: dep.remediation,
        skipCompanyFilter: q.skipCompanyFilter,
      };
    });
}
