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
  type EntityType,
  type CompoundDependencyDef,
  type DependencyCheckResult,
} from '@/config/deletion-registry';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { tenantScopedDependencyQuery } from './dependency-tenant-scope';
import {
  MAX_PREVIEW_IDS,
  summarizeDependencyCheck,
  toDependencyOutcome,
  unavailableDependencyOutcome,
} from './deletion-common';

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

  // Ίδιος μηχανισμός με τον φύλακα διαγραφής, **άλλο** λεξιλόγιο: η αφαίρεση
  // δεσμού δεν είναι διαγραφή (ADR-742 §7novies).
  return summarizeDependencyCheck(results, {
    allowed: 'Δεν υπάρχουν εξαρτήσεις. Η αφαίρεση επιτρέπεται.',
    blocked: (total, labels) =>
      `Ο συνεργάτης δεν μπορεί να αφαιρεθεί. Εμπλέκεται σε ${total} εγγραφές: ${labels}.`,
    unavailable: (labels) =>
      `Ο συνεργάτης δεν μπορεί να αφαιρεθεί λόγω σφάλματος ελέγχου εξαρτήσεων: ${labels}. Δοκιμάστε ξανά.`,
  });
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
    // Ο κανόνας του μητρώου («φέρει η συλλογή companyId;») ζει μία φορά:
    // ADR-742 §7novies.
    let query = tenantScopedDependencyQuery(db, dep.collection, dep, companyId);

    query = dep.contactQueryType === 'array-contains'
      ? query.where(dep.contactField, 'array-contains', contactId)
      : query.where(dep.contactField, '==', contactId);

    query = dep.scopeQueryType === 'array-contains'
      ? query.where(dep.scopeField, 'array-contains', scopeEntityId)
      : query.where(dep.scopeField, '==', scopeEntityId);

    const snapshot = await query.limit(MAX_PREVIEW_IDS + 1).get();

    return toDependencyOutcome(dep, snapshot);
  } catch (err) {
    logger.error(`[LinkRemovalGuard] Failed to check ${dep.collection}`, {
      error: getErrorMessage(err), contactId, scopeEntityId,
    });
    return unavailableDependencyOutcome(dep);
  }
}
