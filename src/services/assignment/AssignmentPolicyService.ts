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

import type { AssignmentPolicy } from '@/types/assignment-policy';
import type { IntentTypeValue } from '@/schemas/ai-analysis';
import { ASSIGNMENT_POLICY_DEFAULTS } from '@/types/assignment-policy';

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
