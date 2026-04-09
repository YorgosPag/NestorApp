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
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
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
// TIMEOUT UTILITY
// ============================================================================

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms),
    ),
  ]);
}

// ============================================================================
// QUERY EXECUTORS
// ============================================================================

type FirestoreDb = ReturnType<typeof getAdminFirestore>;

async function executeStandardQuery(
  db: FirestoreDb,
  query: Extract<ContactQueryStrategy, { type: 'standard' }>,
  contactId: string,
  companyId?: string,
): Promise<number> {
  let q = db.collection(query.collection)
    .where(query.foreignKey, query.queryType === 'equals' ? '==' : 'array-contains', contactId);

  if (!query.skipCompanyFilter && companyId) {
    q = q.where(FIELDS.COMPANY_ID, '==', companyId);
  }

  const snapshot = await q.select().get();
  return snapshot.size;
}

async function executeSubcollectionQuery(
  db: FirestoreDb,
  query: Extract<ContactQueryStrategy, { type: 'subcollection' }>,
  contactId: string,
  companyId?: string,
): Promise<number> {
  // Step 1: Query parent documents
  let parentQuery = db.collection(query.parentCollection)
    .where(query.parentForeignKey, query.parentQueryType === 'equals' ? '==' : 'array-contains', contactId);

  if (!query.skipCompanyFilter && companyId) {
    parentQuery = parentQuery.where(FIELDS.COMPANY_ID, '==', companyId);
  }

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
  companyId?: string,
): Promise<number> {
  let q = db.collection(query.collection)
    .where(query.foreignKey, query.queryType === 'equals' ? '==' : 'array-contains', contactId);

  for (const filter of query.additionalFilters) {
    q = q.where(filter.field, filter.operator, filter.value);
  }

  if (!query.skipCompanyFilter && companyId) {
    q = q.where(FIELDS.COMPANY_ID, '==', companyId);
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
  companyId?: string,
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
 * @param contactId - The contact being modified/deleted
 * @param scenario - Which operation (deletion, identityChange, etc.)
 * @param contactType - The contact's type (individual, company, service)
 * @param companyId - Tenant ID for isolation (optional for some queries)
 * @param fieldCategories - Field categories that changed (for scenario-specific filtering)
 */
export async function computeContactImpact(
  contactId: string,
  scenario: ContactImpactScenario,
  contactType: ContactType,
  companyId?: string,
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
