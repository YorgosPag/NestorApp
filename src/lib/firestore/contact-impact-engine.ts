/**
 * 🔍 CONTACT IMPACT ENGINE — Shared Server-Side Query Engine
 *
 * Executes dependency queries from the unified ContactDependencyRegistry.
 * Used by all impact preview services as their single query backend.
 *
 * Supports 3 query strategies:
 * - Standard: simple collection.where(foreignKey, op, contactId)
 * - Subcollection: query parent → fan out to subcollections → aggregate
 * - Compound: base query + additional where clauses
 *
 * All queries run in parallel with a 10s timeout.
 *
 * @module lib/firestore/contact-impact-engine
 * @enterprise ADR-145 — Contact Dependency SSoT
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
// ⚠️ Ήταν ιδιωτικό `withTimeout` σε αυτό το αρχείο· κεντρικοποιήθηκε 2026-08-28 (N.0.2)
//    όταν ο `enterprise-api-client` χρειάστηκε την ίδια δουλειά. Η κεντρική εκδοχή
//    **καθαρίζει το χρονόμετρο**, που η ιδιωτική δεν έκανε.
import { withTimeout } from '@/lib/async-utils';
import { tenantScopedDependencyQuery } from './dependency-tenant-scope';
import {
  getDependenciesForScenario,
  getScenarioMode,
  type ContactDependencyDef,
  type ContactImpactScenario,
  type ContactQueryStrategy,
  type DependencyImpactMode,
} from '@/config/contact-dependency-registry';
import type { ContactType } from '@/types/contacts';

const logger = createModuleLogger('ContactImpactEngine');

const QUERY_TIMEOUT_MS = 10_000;

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface DependencyCountResult {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly mode: DependencyImpactMode;
  readonly remediation?: string;
}

export interface ContactImpactResult {
  readonly scenario: ContactImpactScenario;
  readonly contactType: ContactType;
  readonly dependencies: ReadonlyArray<DependencyCountResult>;
  readonly totalAffected: number;
  readonly blockingCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
}

// ============================================================================
// QUERY EXECUTORS
// ============================================================================

type FirestoreDb = ReturnType<typeof getAdminFirestore>;

async function executeStandardQuery(
  db: FirestoreDb,
  query: Extract<ContactQueryStrategy, { type: 'standard' }>,
  contactId: string,
  companyId: string,
): Promise<number> {
  const q = tenantScopedDependencyQuery(db, query.collection, query, companyId)
    .where(query.foreignKey, query.queryType === 'equals' ? '==' : 'array-contains', contactId);

  const snapshot = await q.select().get();
  return snapshot.size;
}

async function executeSubcollectionQuery(
  db: FirestoreDb,
  query: Extract<ContactQueryStrategy, { type: 'subcollection' }>,
  contactId: string,
  companyId: string,
): Promise<number> {
  // Step 1: Query parent documents.
  // Ο tenant κόβεται **στον γονέα**: τα subcollection queries του βήματος 2
  // κρέμονται από τα ids που επέστρεψε αυτό το query, άρα ό,τι δεν πέρασε από
  // εδώ δεν φτάνει ποτέ στο fan-out.
  const parentQuery = tenantScopedDependencyQuery(db, query.parentCollection, query, companyId)
    .where(query.parentForeignKey, query.parentQueryType === 'equals' ? '==' : 'array-contains', contactId);

  const parentSnapshot = await parentQuery.select().get();
  if (parentSnapshot.empty) return 0;

  // Step 2: Fan out to subcollections
  const subQueries = parentSnapshot.docs.map((parentDoc) =>
    db.collection(query.parentCollection)
      .doc(parentDoc.id)
      .collection(query.subcollection)
      .where(query.subcollectionForeignKey, '==', contactId)
      .select()
      .get()
  );

  const subSnapshots = await Promise.all(subQueries);
  return subSnapshots.reduce((sum, snap) => sum + snap.size, 0);
}

async function executeCompoundQuery(
  db: FirestoreDb,
  query: Extract<ContactQueryStrategy, { type: 'compound' }>,
  contactId: string,
  companyId: string,
): Promise<number> {
  let q = tenantScopedDependencyQuery(db, query.collection, query, companyId)
    .where(query.foreignKey, query.queryType === 'equals' ? '==' : 'array-contains', contactId);

  for (const filter of query.additionalFilters) {
    q = q.where(filter.field, filter.operator, filter.value);
  }

  const snapshot = await q.select().get();
  return snapshot.size;
}

// ============================================================================
// DISPATCH
// ============================================================================

async function executeDependencyQuery(
  db: FirestoreDb,
  dep: ContactDependencyDef,
  scenario: ContactImpactScenario,
  contactId: string,
  companyId: string,
): Promise<DependencyCountResult> {
  const { query } = dep;

  let count: number;
  switch (query.type) {
    case 'standard':
      count = await executeStandardQuery(db, query, contactId, companyId);
      break;
    case 'subcollection':
      count = await executeSubcollectionQuery(db, query, contactId, companyId);
      break;
    case 'compound':
      count = await executeCompoundQuery(db, query, contactId, companyId);
      break;
  }

  return {
    id: dep.id,
    label: dep.label,
    count,
    mode: getScenarioMode(dep, scenario),
    remediation: dep.remediation,
  };
}

// ============================================================================
// MAIN ENGINE
// ============================================================================

/**
 * Compute contact impact for a given scenario.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ `companyId` ΕΙΝΑΙ **ΥΠΟΧΡΕΩΤΙΚΟ** (ADR-742 §7octies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι τις 2026-08-01 η παράμετρος ήταν `companyId?` και οι τρεις εκτελεστές
 * ρωτούσαν `if (!query.skipCompanyFilter && companyId)`. Η **δεύτερη συνθήκη**
 * σήμαινε: *«αν δεν μου δώσεις tenant, μη φιλτράρεις καθόλου»*.
 *
 * Μετρήθηκε ότι **κανένας** από τους έξι καλούντες δεν τον έδινε ⇒ το φίλτρο
 * tenant **δεν ενεργοποιήθηκε ποτέ, σε κανένα μονοπάτι**. Οι preview
 * επέστρεφαν πλήθη εγγραφών **από όλους τους πελάτες**: όχι μαντείο ύπαρξης
 * (ADR-742 §3.3) αλλά **διαρροή περιεχομένου**.
 *
 * 🔑 Η αδελφή μηχανή πάνω στο **ίδιο** registry το έκανε ήδη σωστά:
 * `deletion-guard.ts` δηλώνει `companyId: string` και ρωτά **μόνο**
 * `if (!dep.skipCompanyFilter)`. Δύο μηχανές, ένα registry, δύο δόγματα — και
 * **κανένα gate δεν τις συνέκρινε**. Αυτό το αρχείο ευθυγραμμίζεται με την
 * αυστηρότερη, δεν εφευρίσκει τρίτη.
 *
 * ⇒ Από τις 2026-08-01 (§7novies) **δεν υπάρχει τρίτη να εφευρεθεί**: ο κανόνας
 * ζει μία φορά στο {@link tenantScopedDependencyQuery} και οι έξι εκτελεστές
 * των δύο μηχανών τον **καλούν**, δεν τον ξαναγράφουν.
 *
 * ⚠️ Το `skipCompanyFilter: true` παραμένει νόμιμο (6 συλλογές που **δεν
 * φέρουν** `companyId`: `external_identities`, `employment_records`,
 * `contact_relationships`, `accounting_invoices`, `accounting_apy_certificates`,
 * `contact_links`). Η διαφορά είναι ότι η παράλειψη είναι πλέον **δηλωμένη ανά
 * εξάρτηση**, όχι **παρενέργεια** του τι ξέχασε να περάσει ο καλών.
 *
 * @param contactId - The contact being modified/deleted
 * @param scenario - Which operation (deletion, identityChange, etc.)
 * @param contactType - The contact's type (individual, company, service)
 * @param companyId - Tenant ID for isolation — **υποχρεωτικό**, βλ. παραπάνω
 * @param fieldCategories - Field categories that changed (for scenario-specific filtering)
 * @see ADR-742 §7octies · `deletion-guard.ts` (η αδελφή μηχανή)
 */
export async function computeContactImpact(
  contactId: string,
  scenario: ContactImpactScenario,
  contactType: ContactType,
  companyId: string,
  fieldCategories?: ReadonlyArray<string>,
): Promise<ContactImpactResult> {
  const db = getAdminFirestore();
  const applicableDeps = getDependenciesForScenario(scenario, contactType, fieldCategories);

  if (applicableDeps.length === 0) {
    return emptyResult(scenario, contactType);
  }

  try {
    const results = await withTimeout(
      Promise.all(
        applicableDeps.map((dep) =>
          executeDependencyQuery(db, dep, scenario, contactId, companyId),
        ),
      ),
      QUERY_TIMEOUT_MS,
    );

    const withCounts = results.filter((r) => r.count > 0);
    const blockingCount = sumByMode(withCounts, 'block');
    const warningCount = sumByMode(withCounts, 'warn');
    const infoCount = sumByMode(withCounts, 'info');

    return {
      scenario,
      contactType,
      dependencies: withCounts,
      totalAffected: blockingCount + warningCount,
      blockingCount,
      warningCount,
      infoCount,
    };
  } catch (error) {
    logger.warn('Contact impact query failed', { contactId, scenario, contactType, error });
    throw error;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function sumByMode(deps: ReadonlyArray<DependencyCountResult>, mode: DependencyImpactMode): number {
  return deps
    .filter((d) => d.mode === mode)
    .reduce((sum, d) => sum + d.count, 0);
}

function emptyResult(scenario: ContactImpactScenario, contactType: ContactType): ContactImpactResult {
  return { scenario, contactType, dependencies: [], totalAffected: 0, blockingCount: 0, warningCount: 0, infoCount: 0 };
}

/**
 * Extract count for a specific dependency ID from a result.
 * Convenience helper for preview service thin wrappers.
 */
export function findDependencyCount(result: ContactImpactResult, depId: string): number {
  return result.dependencies.find((d) => d.id === depId)?.count ?? 0;
}
