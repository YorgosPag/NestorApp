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
    const { unitId, scope, exclusivity, excludeAgreementId } = input;
    const today = new Date().toISOString().split('T')[0];

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
          messageParams: { agentName: c.agentName, unitName: c.unitId ?? '' },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
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

    // EXCLUSIVE + UNIT scope
    if (exclusivity === 'exclusive' && scope === 'unit' && unitId) {
      for (const c of exclusiveProject) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityBlockedByProjectExclusive',
          messageParams: { agentName: c.agentName },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
      for (const c of exclusiveUnits.filter((a) => a.unitId === unitId)) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityConflictSameUnit',
          messageParams: { agentName: c.agentName, unitName: unitId },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
      for (const c of nonExclusiveUnits.filter((a) => a.unitId === unitId)) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.exclusivityBlockedByExistingUnit',
          messageParams: { agentName: c.agentName, unitName: unitId },
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
    if (exclusivity === 'non_exclusive' && scope === 'unit' && unitId) {
      for (const c of exclusiveProject) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.nonExclusiveBlockedByProjectExclusive',
          messageParams: { agentName: c.agentName },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
        });
      }
      for (const c of exclusiveUnits.filter((a) => a.unitId === unitId)) {
        issues.push({
          severity: 'error', messageKey: 'sales.legal.nonExclusiveBlockedByUnitExclusive',
          messageParams: { agentName: c.agentName, unitName: unitId },
          conflictingAgreementId: c.id, conflictingAgentName: c.agentName,
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
    logger.error('[BrokerageExclusivityRules] Validation failed:', error);
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
