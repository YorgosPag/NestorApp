/**
 * =============================================================================
 * Legal Contract — Property legalPhase sync + audit wiring
 * =============================================================================
 *
 * Split off from `legal-contract.service.ts` (ADR-230, ADR-195 CHECK 3.17).
 *
 * Houses the single PROPERTIES-tracked write in the legal-contract domain:
 * `updatePropertyLegalPhase()` writes `commercial.legalPhase` on the property
 * document whenever a contract is created, transitioned, or removed. Because
 * PROPERTIES is an audit-tracked collection (ADR-195), the write must be
 * paired with an `EntityAuditService.recordChange()` call so the per-property
 * Ιστορικό tab surfaces legal-phase transitions inline with other entity
 * mutations.
 *
 * Isolating this function in its own module keeps the parent service below
 * the 500-line Google SRP limit (CLAUDE.md N.7.1) and lets CHECK 3.17's
 * file-level scanner resolve audit coverage at the right granularity — the
 * parent service no longer writes to PROPERTIES directly and falls out of
 * the CHECK 3.17 baseline, while this module carries its own coverage.
 *
 * Uses Admin SDK — server-only.
 *
 * @module services/legal-contract-phase-sync
 * @enterprise ADR-230 — Contract Workflow & Legal Process
 * @enterprise ADR-195 — Entity Audit Trail (CHECK 3.17 writer-side coverage)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { ContractPhase, LegalPhase } from '@/types/legal-contracts';

const logger = createModuleLogger('LegalContractPhaseSync');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Minimal performer context propagated through the sync layer for audit trail
 * attribution. Callers pass their best-known identity; when unknown the
 * sync function falls back to a `'system'` sentinel so CHECK 3.17 file-level
 * coverage still fires.
 */
export interface PhaseSyncPerformer {
  uid: string;
  name: string;
}

const SYSTEM_PERFORMER: PhaseSyncPerformer = {
  uid: 'system',
  name: 'Νομικό Σύστημα',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Human-readable label for a contract phase. Used by the parent service for
 * user-facing error messages (e.g. "Υπάρχει ήδη Προσύμφωνο για αυτή τη μονάδα").
 */
export function phaseLabel(phase: ContractPhase): string {
  const labels: Record<ContractPhase, string> = {
    preliminary: 'Προσύμφωνο',
    final: 'Οριστικό Συμβόλαιο',
    payoff: 'Εξοφλητήριο',
  };
  return labels[phase];
}

/**
 * Type guard for the subset of property data we read for audit attribution.
 * Kept deliberately narrow — we only need `name`, `companyId`, and the
 * current `commercial.legalPhase` to compute the diff.
 */
interface PropertyAuditSlice {
  name?: string | null;
  companyId?: string | null;
  commercial?: {
    legalPhase?: LegalPhase | null;
  } | null;
}

// ============================================================================
// PROPERTY LEGAL PHASE SYNC
// ============================================================================

/**
 * Write `commercial.legalPhase` on a property document and record the change
 * in `entity_audit_trail` if the phase actually changed.
 *
 * No-op audit when the new phase equals the old phase — avoids phantom audit
 * rows on idempotent `syncLegalPhase()` calls from FSM transitions that don't
 * actually move the legal phase forward (e.g. a `draft → pending_signature`
 * transition that stays inside the same LegalPhase bucket).
 *
 * Audit failure does NOT block the property write — `recordChange()` is
 * fire-and-forget by contract (see ADR-195 and `EntityAuditService` JSDoc).
 */
export async function updatePropertyLegalPhase(
  propertyId: string,
  newLegalPhase: LegalPhase,
  performer: PhaseSyncPerformer = SYSTEM_PERFORMER,
): Promise<void> {
  try {
    const db = getAdminFirestore();
    if (!db) throw new Error('Admin Firestore unavailable');

    const propertyRef = db.collection(COLLECTIONS.PROPERTIES).doc(propertyId);

    // Read BEFORE write so we can compute the audit diff and skip no-op events.
    const before = await propertyRef.get();
    if (!before.exists) {
      logger.warn(
        `[LegalContractPhaseSync] Property ${propertyId} not found — skipping legalPhase sync`,
      );
      return;
    }

    const data = (before.data() ?? {}) as PropertyAuditSlice;
    const oldLegalPhase: LegalPhase = data.commercial?.legalPhase ?? 'none';

    // Idempotent short-circuit: same phase → neither write nor audit.
    if (oldLegalPhase === newLegalPhase) {
      return;
    }

    await propertyRef.update({
      'commercial.legalPhase': newLegalPhase,
    });

    logger.info(
      `[LegalContractPhaseSync] Property ${propertyId} legalPhase ${oldLegalPhase} → ${newLegalPhase}`,
    );

    // Fire-and-forget audit. Only emits when the property carries a tenant —
    // legacy fixtures without `companyId` are silently skipped to match the
    // same guard used in `contact-lookup-crud.ts` and elsewhere in the audit
    // writer coverage (ADR-195 CHECK 3.17 services batch 3).
    const companyId = data.companyId;
    if (companyId) {
      await EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.PROPERTY,
        entityId: propertyId,
        entityName: data.name ?? null,
        action: 'updated',
        changes: [
          {
            field: 'commercial.legalPhase',
            oldValue: oldLegalPhase,
            newValue: newLegalPhase,
            label: 'Νομική Φάση',
          },
        ],
        performedBy: performer.uid,
        performedByName: performer.name,
        companyId,
      });
    }
  } catch (error) {
    logger.error(
      `[LegalContractPhaseSync] Failed to update legalPhase for ${propertyId}:`,
      { error: getErrorMessage(error) },
    );
  }
}
