/**
 * 🛡️ LINK REMOVAL GUARD — Compound dependency checks for contact links.
 *
 * Before a contact can be unlinked from a scope entity (project/building),
 * check that the contact has no active references inside that scope.
 *
 * Extracted from `deletion-guard.ts` (SRP: entity deletion vs. link removal).
 *
 * @module lib/firestore/deletion-link-guard
 * @enterprise ADR-226 — Deletion Guard (Phase 2)
 */

import 'server-only';

import {
  LINK_REMOVAL_REGISTRY,
  DEPENDENCY_REMEDIATIONS,
  type EntityType,
  type CompoundDependencyDef,
  type DependencyCheckResult,
} from '@/config/deletion-registry';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { FIELDS } from '@/config/firestore-field-constants';
import { MAX_PREVIEW_IDS, getDefaultRemediation } from './deletion-common';

const logger = createModuleLogger('LinkRemovalGuard');

/**
 * Check if a contact has active dependencies within a project/building scope
 * before allowing their link to be removed.
 *
 * Uses compound queries (contactField + scopeField) from LINK_REMOVAL_REGISTRY.
 */
export async function checkLinkRemovalDependencies(
  db: FirebaseFirestore.Firestore,
  contactId: string,
  targetEntityType: EntityType,
  targetEntityId: string,
  companyId: string
): Promise<DependencyCheckResult> {
  const deps = LINK_REMOVAL_REGISTRY[targetEntityType];

  if (!deps || deps.length === 0) {
    return { allowed: true, dependencies: [], totalDependents: 0, message: 'Δεν υπάρχουν εξαρτήσεις.' };
  }

  const results = await Promise.all(
    deps.map((dep) => checkCompoundDependency(db, dep, contactId, targetEntityId, companyId))
  );

  const blocking = results.filter((r) => r.count !== 0);
  const totalDependents = blocking.reduce((sum, r) => sum + Math.max(0, r.count), 0);

  if (blocking.length === 0) {
    return { allowed: true, dependencies: [], totalDependents: 0, message: 'Δεν υπάρχουν εξαρτήσεις. Η αφαίρεση επιτρέπεται.' };
  }

  const depLabels = blocking
    .map((d) => d.count > 0 ? `${d.label} (${d.count})` : `${d.label} (έλεγχος μη διαθέσιμος)`)
    .join(', ');

  return {
    allowed: false,
    dependencies: blocking,
    totalDependents,
    message: totalDependents > 0
      ? `Ο συνεργάτης δεν μπορεί να αφαιρεθεί. Εμπλέκεται σε ${totalDependents} εγγραφές: ${depLabels}.`
      : `Ο συνεργάτης δεν μπορεί να αφαιρεθεί λόγω σφάλματος ελέγχου εξαρτήσεων: ${depLabels}. Δοκιμάστε ξανά.`,
  };
}

/**
 * Query a single compound dependency (contact + scope).
 */
async function checkCompoundDependency(
  db: FirebaseFirestore.Firestore,
  dep: CompoundDependencyDef,
  contactId: string,
  scopeEntityId: string,
  companyId: string
): Promise<DependencyCheckResult['dependencies'][number]> {
  try {
    let query: FirebaseFirestore.Query = db.collection(dep.collection);

    if (!dep.skipCompanyFilter) {
      query = query.where(FIELDS.COMPANY_ID, '==', companyId);
    }

    query = dep.contactQueryType === 'array-contains'
      ? query.where(dep.contactField, 'array-contains', contactId)
      : query.where(dep.contactField, '==', contactId);

    query = dep.scopeQueryType === 'array-contains'
      ? query.where(dep.scopeField, 'array-contains', scopeEntityId)
      : query.where(dep.scopeField, '==', scopeEntityId);

    const snapshot = await query.limit(MAX_PREVIEW_IDS + 1).get();
    const documentIds = snapshot.docs.slice(0, MAX_PREVIEW_IDS).map((doc) => doc.id);

    return {
      label: dep.label,
      collection: dep.collection,
      count: snapshot.size,
      remediation: dep.remediation ?? getDefaultRemediation(dep.collection),
      documentIds,
    };
  } catch (err) {
    logger.error(`[LinkRemovalGuard] Failed to check ${dep.collection}`, {
      error: getErrorMessage(err), contactId, scopeEntityId,
    });
    return {
      label: dep.label,
      collection: dep.collection,
      count: -1,
      remediation: DEPENDENCY_REMEDIATIONS.guardUnavailable,
      documentIds: [],
    };
  }
}
