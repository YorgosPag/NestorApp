/**
 * =============================================================================
 * ASSIGNMENT POLICY SERVICE
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Business logic για task assignment routing.
 * Resolves assignee με policy rules + fallback logic.
 *
 * @module services/assignment/AssignmentPolicyService
 * @enterprise Policy resolution, confidence thresholds, triage logic
 *
 * ARCHITECTURE:
 * - Policy resolution με priority + constraints
 * - Confidence threshold checking
 * - Fallback: Company-wide → Triage
 * - NO hardcoded thresholds (από policy)
 */

import 'server-only';

import type {
  AssignmentPolicy,
  AssignmentRule,
  PolicyResolutionResult,
} from '@/types/assignment-policy';
import type { MessageIntentAnalysis, IntentTypeValue } from '@/schemas/ai-analysis';
import {
  getProjectPolicy,
  getCompanyWidePolicy,
} from './AssignmentPolicyRepository';
import { ASSIGNMENT_POLICY_DEFAULTS } from '@/types/assignment-policy';

// ============================================================================
// POLICY RESOLUTION
// ============================================================================

/**
 * Resolve assignee για message intent
 * @enterprise Two-level fallback: Project policy → Company-wide policy → Triage
 *
 * @param companyId - Company ID (required για tenant isolation)
 * @param intentAnalysis - AI analysis result
 * @param projectId - Optional project ID (for project-specific rules)
 * @returns Policy resolution result με assignedTo ή needsTriage
 */
export async function resolveAssignment(
  companyId: string,
  intentAnalysis: MessageIntentAnalysis,
  projectId?: string
): Promise<PolicyResolutionResult> {
  // Step 1: Try project-specific policy (if projectId provided)
  if (projectId) {
    const projectPolicy = await getProjectPolicy(companyId, projectId);
    if (projectPolicy) {
      const result = resolveWithPolicy(projectPolicy, intentAnalysis);
      if (result.matched) {
        return result;
      }
    }
  }

  // Step 2: Fallback to company-wide policy
  const companyPolicy = await getCompanyWidePolicy(companyId);
  if (companyPolicy) {
    const result = resolveWithPolicy(companyPolicy, intentAnalysis);
    if (result.matched) {
      return result;
    }
  }

  // Step 3: No matching policy → Triage
  return {
    matched: false,
    needsTriage: true,
    triageReason: 'No matching assignment policy found',
  };
}

/**
 * Resolve με specific policy
 * @enterprise Matches rules by intentType + constraints + confidence
 */
function resolveWithPolicy(
  policy: AssignmentPolicy,
  intentAnalysis: MessageIntentAnalysis
): PolicyResolutionResult {
  const { intentType, confidence, extractedEntities } = intentAnalysis;

  // Find matching rules (active + intentType match)
  const matchingRules = policy.rules.filter(
    (rule) => rule.isActive && rule.intentType === intentType
  );

  if (matchingRules.length === 0) {
    // No rule για this intent type → Use triage settings
    return {
      matched: false,
      needsTriage: true,
      triageReason: `No rule found for intent type: ${intentType}`,
      policyId: policy.id,
    };
  }

  // Sort by priority (lower = higher priority)
  const sortedRules = matchingRules.sort(
    (a, b) => (a.priority || 999) - (b.priority || 999)
  );

  // Find first matching rule (with constraint checks)
  for (const rule of sortedRules) {
    if (matchesConstraints(rule, extractedEntities)) {
      // Check confidence threshold
      const minConfidence =
        rule.minConfidence ?? policy.triageSettings.defaultMinConfidence;

      if (confidence < minConfidence) {
        // Confidence too low → Triage
        return {
          matched: true,
          matchedRule: rule,
          needsTriage: true,
          triageReason: `Confidence ${confidence.toFixed(2)} below threshold ${minConfidence}`,
          policyId: policy.id,
        };
      }

      // Success: Matched rule με sufficient confidence
      return {
        matched: true,
        matchedRule: rule,
        assignedTo: rule.defaultAssignedTo,
        notifyTargets: rule.notifyTargets,
        needsTriage: false,
        policyId: policy.id,
      };
    }
  }

  // No rule matched constraints → Triage
  return {
    matched: false,
    needsTriage: true,
    triageReason: 'No rule matched entity constraints',
    policyId: policy.id,
  };
}

/**
 * Check if rule constraints match extracted entities
 * @enterprise Filters rules by projectIds, buildingIds, categories
 */
function matchesConstraints(
  rule: AssignmentRule,
  entities?: MessageIntentAnalysis['extractedEntities']
): boolean {
  if (!rule.constraints) {
    // No constraints = match all
    return true;
  }

  const { projectIds, buildingIds } = rule.constraints;

  // Check project constraint
  if (projectIds && projectIds.length > 0) {
    if (!entities?.projectId || !projectIds.includes(entities.projectId)) {
      return false;
    }
  }

  // Check building constraint
  if (buildingIds && buildingIds.length > 0) {
    if (!entities?.buildingId || !buildingIds.includes(entities.buildingId)) {
      return false;
    }
  }

  // All constraints passed
  return true;
}

// ============================================================================
// TRIAGE HELPERS
// ============================================================================

/**
 * Check if intent analysis requires triage
 * @enterprise Centralized triage logic (NO hardcoded thresholds!)
 */
export function requiresTriage(
  intentAnalysis: MessageIntentAnalysis,
  policy?: AssignmentPolicy
): { needsTriage: boolean; reason?: string } {
  // Check AI's own triage flag
  if (intentAnalysis.needsTriage) {
    return {
      needsTriage: true,
      reason: 'AI flagged for manual review',
    };
  }

  // Check confidence against policy threshold
  if (policy) {
    const threshold = policy.triageSettings.defaultMinConfidence;
    if (intentAnalysis.confidence < threshold) {
      return {
        needsTriage: true,
        reason: `Confidence ${intentAnalysis.confidence.toFixed(2)} below threshold ${threshold}`,
      };
    }
  }

  // No triage needed
  return { needsTriage: false };
}

/**
 * Get triage assignee από policy
 * @enterprise Returns default triage assignee if configured
 */
export function getTriageAssignee(
  policy?: AssignmentPolicy
): AssignmentPolicy['triageSettings']['triageAssignedTo'] | undefined {
  return policy?.triageSettings.triageAssignedTo;
}

// ============================================================================
// TASK SLA HELPERS
// ============================================================================

/**
 * Resolve task due date offset (hours) from policy
 * @enterprise DB-driven, tenant-scoped defaults
 */
export function resolveTaskDueInHours(
  intentType: IntentTypeValue | undefined,
  policy?: AssignmentPolicy
): number {
  const defaults = policy?.taskDefaults ?? ASSIGNMENT_POLICY_DEFAULTS.taskDefaults;
  const perIntent = intentType
    ? policy?.taskDefaults?.dueInHoursByIntent?.[intentType]
    : undefined;

  return perIntent ?? defaults.defaultDueInHours;
}
