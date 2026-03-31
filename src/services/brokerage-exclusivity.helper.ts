/**
 * =============================================================================
 * Brokerage Exclusivity Validation — Server-Side (Admin SDK)
 * =============================================================================
 *
 * Extracted from brokerage-server.service.ts (Google SRP — max 500 lines).
 * Server-side exclusivity rules + input validation helpers.
 *
 * @module services/brokerage-exclusivity.helper
 * @enterprise ADR-252
 */
import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  BrokerageAgreement,
  CreateBrokerageAgreementInput,
  ExclusivityValidationResult,
  ExclusivityValidationInput,
  ExclusivityValidationIssue,
} from '@/types/brokerage';

const logger = createModuleLogger('BrokerageExclusivity');

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

export interface AgreementFieldValidation {
  valid: boolean;
  error?: string;
}

export function validateAgreementFields(input: CreateBrokerageAgreementInput): AgreementFieldValidation {
  if (!input.projectId) return { valid: false, error: 'projectId is required' };
  if (!input.agentContactId) return { valid: false, error: 'agentContactId is required' };
  if (!input.agentName) return { valid: false, error: 'agentName is required' };
  if (!input.scope) return { valid: false, error: 'scope is required' };
  if (!input.exclusivity) return { valid: false, error: 'exclusivity is required' };
  if (!input.commissionType) return { valid: false, error: 'commissionType is required' };
  if (input.scope === 'unit' && !input.unitId) return { valid: false, error: 'unitId is required for unit scope' };
  if (input.commissionType === 'percentage' && (input.commissionPercentage == null || input.commissionPercentage <= 0)) {
    return { valid: false, error: 'commissionPercentage must be > 0 for percentage type' };
  }
  if (input.commissionType === 'fixed' && (input.commissionFixedAmount == null || input.commissionFixedAmount <= 0)) {
    return { valid: false, error: 'commissionFixedAmount must be > 0 for fixed type' };
  }
  return { valid: true };
}

export interface CommissionFieldValidation {
  valid: boolean;
  error?: string;
}

export function validateCommissionFields(input: { salePrice: number }): CommissionFieldValidation {
  if (!input.salePrice || input.salePrice <= 0) {
    return { valid: false, error: 'salePrice must be > 0' };
  }
  return { valid: true };
}

// ============================================================================
// SERVER-SIDE EXCLUSIVITY VALIDATION
// ============================================================================

function getDb() {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

/**
 * Server-side exclusivity validation — mirrors client logic exactly.
 *
 * Rule 1: Exclusive unit → BLOCKS everything on that unit
 * Rule 2: Exclusive project → BLOCKS everything on the project
 * Rule 3: Exclusive project + existing non-exclusive units → WARNING
 * Rule 4: Non-exclusive can coexist UNLESS blocked by exclusive
 * Rule 5: Validation runs on CREATE and UPDATE
 */
export async function validateExclusivityServer(
  input: ExclusivityValidationInput,
  companyId: string
): Promise<ExclusivityValidationResult> {
  try {
    const { projectId, unitId, scope, exclusivity, excludeAgreementId } = input;
    const today = new Date().toISOString().split('T')[0];

    const db = getDb();
    const snapshot = await db
      .collection(COLLECTIONS.BROKERAGE_AGREEMENTS)
      .where('projectId', '==', projectId)
      .where('companyId', '==', companyId)
      .get();

    const allAgreements = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as BrokerageAgreement);

    // Filter: only active + not expired + not self
    const active = allAgreements.filter((a) => {
      if (a.status !== 'active') return false;
      if (a.endDate && a.endDate.split('T')[0] < today) return false;
      if (excludeAgreementId && a.id === excludeAgreementId) return false;
      return true;
    });

    const issues: ExclusivityValidationIssue[] = [];
    const excludedUnitIds: string[] = [];

    const exclusiveProject = active.filter((a) => a.exclusivity === 'exclusive' && a.scope === 'project');
    const exclusiveUnits = active.filter((a) => a.exclusivity === 'exclusive' && a.scope === 'unit');
    const nonExclusiveUnits = active.filter((a) => a.exclusivity === 'non_exclusive' && a.scope === 'unit');

    // NEW agreement is EXCLUSIVE + PROJECT scope
    if (exclusivity === 'exclusive' && scope === 'project') {
      for (const conflict of exclusiveProject) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityConflictProjectExclusive',
          messageParams: { agentName: conflict.agentName },
          conflictingAgreementId: conflict.id, conflictingAgentName: conflict.agentName,
        });
      }
      for (const conflict of exclusiveUnits) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityConflictUnitExclusive',
          messageParams: { agentName: conflict.agentName, unitName: conflict.unitId ?? '' },
          conflictingAgreementId: conflict.id, conflictingAgentName: conflict.agentName,
        });
      }
      for (const existing of nonExclusiveUnits) {
        if (existing.unitId) excludedUnitIds.push(existing.unitId);
      }
      if (excludedUnitIds.length > 0) {
        issues.push({
          severity: 'warning', messageKey: 'sales.legal.exclusivityWarningExcludedUnits',
          messageParams: { unitNames: excludedUnitIds.join(', ') },
          conflictingAgreementId: null, conflictingAgentName: null,
        });
      }
    }

    // NEW agreement is EXCLUSIVE + UNIT scope
    if (exclusivity === 'exclusive' && scope === 'unit' && unitId) {
      for (const conflict of exclusiveProject) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityBlockedByProjectExclusive',
          messageParams: { agentName: conflict.agentName },
          conflictingAgreementId: conflict.id, conflictingAgentName: conflict.agentName,
        });
      }
      for (const conflict of exclusiveUnits.filter((a) => a.unitId === unitId)) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityConflictSameUnit',
          messageParams: { agentName: conflict.agentName, unitName: unitId },
          conflictingAgreementId: conflict.id, conflictingAgentName: conflict.agentName,
        });
      }
      for (const conflict of nonExclusiveUnits.filter((a) => a.unitId === unitId)) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityBlockedByExistingUnit',
          messageParams: { agentName: conflict.agentName, unitName: unitId },
          conflictingAgreementId: conflict.id, conflictingAgentName: conflict.agentName,
        });
      }
    }

    // NEW agreement is NON-EXCLUSIVE + PROJECT scope
    if (exclusivity === 'non_exclusive' && scope === 'project') {
      for (const conflict of exclusiveProject) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.nonExclusiveBlockedByProjectExclusive',
          messageParams: { agentName: conflict.agentName },
          conflictingAgreementId: conflict.id, conflictingAgentName: conflict.agentName,
        });
      }
    }

    // NEW agreement is NON-EXCLUSIVE + UNIT scope
    if (exclusivity === 'non_exclusive' && scope === 'unit' && unitId) {
      for (const conflict of exclusiveProject) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.nonExclusiveBlockedByProjectExclusive',
          messageParams: { agentName: conflict.agentName },
          conflictingAgreementId: conflict.id, conflictingAgentName: conflict.agentName,
        });
      }
      for (const conflict of exclusiveUnits.filter((a) => a.unitId === unitId)) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.nonExclusiveBlockedByUnitExclusive',
          messageParams: { agentName: conflict.agentName, unitName: unitId },
          conflictingAgreementId: conflict.id, conflictingAgentName: conflict.agentName,
        });
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    const firstIssue = issues[0] ?? null;

    return {
      canProceed: !hasErrors, issues, excludedUnitIds,
      valid: !hasErrors,
      conflictingAgreementId: firstIssue?.conflictingAgreementId ?? null,
      reason: firstIssue?.messageKey ?? null,
    };
  } catch (error) {
    logger.error('[BrokerageServerService] Exclusivity validation failed:', error);
    return {
      canProceed: false,
      issues: [{
        severity: 'error', messageKey: 'sales.legal.saveError', messageParams: {},
        conflictingAgreementId: null, conflictingAgentName: null,
      }],
      excludedUnitIds: [], valid: false,
      conflictingAgreementId: null, reason: 'sales.legal.saveError',
    };
  }
}
