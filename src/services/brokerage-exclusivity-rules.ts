/**
 * =============================================================================
 * Brokerage Exclusivity Rules — Client-Side Validation Logic
 * =============================================================================
 *
 * Extracted from brokerage.service.ts (Google SRP — max 500 lines).
 * Pure function: receives agreements, returns validation result.
 *
 * @module services/brokerage-exclusivity-rules
 */

import { createModuleLogger } from '@/lib/telemetry';
import type {
  BrokerageAgreement,
  ExclusivityValidationResult,
  ExclusivityValidationInput,
  ExclusivityValidationIssue,
} from '@/types/brokerage';

const logger = createModuleLogger('BrokerageExclusivityRules');

/**
 * Client-side exclusivity validation.
 * Pure logic: receives all agreements, validates new input against them.
 */
export function evaluateExclusivityRules(
  input: ExclusivityValidationInput,
  allAgreements: BrokerageAgreement[],
): ExclusivityValidationResult {
  try {
    const { propertyId, scope, exclusivity, excludeAgreementId } = input;
    const today = new Date().toISOString().split('T')[0];

    const active = allAgreements.filter((a) => {
      if (a.status !== 'active') return false;
      if (a.endDate && a.endDate.split('T')[0] < today) return false;
      if (excludeAgreementId && a.id === excludeAgreementId) return false;
      return true;
    });

    const issues: ExclusivityValidationIssue[] = [];
    const excludedPropertyIds: string[] = [];

    const exclusiveProject = active.filter((a) => a.exclusivity === 'exclusive' && a.scope === 'project');
    const exclusiveUnits = active.filter((a) => a.exclusivity === 'exclusive' && a.scope === 'property');
    const nonExclusiveUnits = active.filter((a) => a.exclusivity === 'non_exclusive' && a.scope === 'property');

    // EXCLUSIVE + PROJECT scope
    if (exclusivity === 'exclusive' && scope === 'project') {
      for (const c of exclusiveProject) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityConflictProjectExclusive',
          messageParams: { agentName: c.agentName },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
      for (const c of exclusiveUnits) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityConflictUnitExclusive',
          messageParams: { agentName: c.agentName, propertyName: c.propertyId ?? '' },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
      for (const existing of nonExclusiveUnits) {
        if (existing.propertyId) excludedPropertyIds.push(existing.propertyId);
      }
      if (excludedPropertyIds.length > 0) {
        issues.push({
          severity: 'warning', messageKey: 'sales.legal.exclusivityWarningExcludedUnits',
          messageParams: { propertyNames: excludedPropertyIds.join(', ') },
          conflictingAgreementId: null, conflictingAgentName: null,
        });
      }
    }

    // EXCLUSIVE + UNIT scope
    if (exclusivity === 'exclusive' && scope === 'property' && propertyId) {
      for (const c of exclusiveProject) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityBlockedByProjectExclusive',
          messageParams: { agentName: c.agentName },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
      for (const c of exclusiveUnits.filter((a) => a.propertyId === propertyId)) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityConflictSameUnit',
          messageParams: { agentName: c.agentName, propertyName: propertyId },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
      for (const c of nonExclusiveUnits.filter((a) => a.propertyId === propertyId)) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityBlockedByExistingUnit',
          messageParams: { agentName: c.agentName, propertyName: propertyId },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
    }

    // NON-EXCLUSIVE + PROJECT scope
    if (exclusivity === 'non_exclusive' && scope === 'project') {
      for (const c of exclusiveProject) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.nonExclusiveBlockedByProjectExclusive',
          messageParams: { agentName: c.agentName },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
    }

    // NON-EXCLUSIVE + UNIT scope
    if (exclusivity === 'non_exclusive' && scope === 'property' && propertyId) {
      for (const c of exclusiveProject) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.nonExclusiveBlockedByProjectExclusive',
          messageParams: { agentName: c.agentName },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
      for (const c of exclusiveUnits.filter((a) => a.propertyId === propertyId)) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.nonExclusiveBlockedByUnitExclusive',
          messageParams: { agentName: c.agentName, propertyName: propertyId },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    const firstIssue = issues[0] ?? null;

    return {
      canProceed: !hasErrors, issues, excludedPropertyIds,
      valid: !hasErrors,
      conflictingAgreementId: firstIssue?.conflictingAgreementId ?? null,
      reason: firstIssue?.messageKey ?? null,
    };
  } catch (error) {
    logger.error('[BrokerageExclusivityRules] Validation failed:', error);
    return {
      canProceed: false,
      issues: [{
        severity: 'error', messageKey: 'sales.legal.saveError', messageParams: {},
        conflictingAgreementId: null, conflictingAgentName: null,
      }],
      excludedPropertyIds: [], valid: false,
      conflictingAgreementId: null, reason: 'sales.legal.saveError',
    };
  }
}
