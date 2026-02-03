/**
 * =============================================================================
 * ASSIGNMENT POLICY VALIDATION SCHEMAS
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Zod validation για Assignment Policy runtime validation.
 *
 * @module schemas/assignment-policy-validation
 * @enterprise Runtime type safety για policy writes
 */

import { z } from 'zod';
import { IntentType } from './ai-analysis';

// ============================================================================
// ASSIGNMENT TARGET SCHEMAS
// ============================================================================

export const AssignmentTargetSchema = z.object({
  type: z.enum(['user', 'role']),
  value: z.string().min(1),
  displayName: z.string().optional(),
});

// ============================================================================
// ASSIGNMENT RULE SCHEMA
// ============================================================================

export const AssignmentRuleSchema = z.object({
  id: z.string().min(1),
  intentType: IntentType, // Reuse SSoT enum από ai-analysis
  defaultAssignedTo: AssignmentTargetSchema,
  notifyTargets: z.array(AssignmentTargetSchema).optional(),
  minConfidence: z.number().min(0).max(1).optional(), // 🏢 Validated 0-1 range!
  constraints: z
    .object({
      projectIds: z.array(z.string()).optional(),
      buildingIds: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
    })
    .optional(),
  isActive: z.boolean(),
  priority: z.number().int().optional(),
});

// ============================================================================
// TRIAGE SETTINGS SCHEMA
// ============================================================================

export const TriageSettingsSchema = z.object({
  defaultMinConfidence: z.number().min(0).max(1), // 🏢 Validated 0-1 range!
  triageAssignedTo: AssignmentTargetSchema.optional(),
  autoCreateTriageTask: z.boolean(),
});

// ============================================================================
// ASSIGNMENT POLICY SCHEMA
// ============================================================================

export const AssignmentPolicySchema = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  rules: z.array(AssignmentRuleSchema),
  triageSettings: TriageSettingsSchema,
  status: z.enum(['active', 'inactive', 'archived']),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(), // ISO 8601 string
  updatedBy: z.string().optional(),
  updatedAt: z.string().datetime().optional(), // ISO 8601 string
  version: z.number().int().optional(),
});

// ============================================================================
// CREATE/UPDATE INPUT SCHEMAS
// ============================================================================

export const CreateAssignmentPolicyInputSchema = z.object({
  companyId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  rules: z.array(AssignmentRuleSchema.omit({ id: true })),
  triageSettings: TriageSettingsSchema,
  createdBy: z.string().min(1),
});

export const UpdateAssignmentPolicyInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  rules: z.array(AssignmentRuleSchema).optional(),
  triageSettings: TriageSettingsSchema.optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  updatedBy: z.string().min(1),
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate assignment policy
 */
export function validateAssignmentPolicy(data: unknown) {
  return AssignmentPolicySchema.parse(data);
}

/**
 * Validate create input
 */
export function validateCreateInput(data: unknown) {
  return CreateAssignmentPolicyInputSchema.parse(data);
}

/**
 * Validate update input
 */
export function validateUpdateInput(data: unknown) {
  return UpdateAssignmentPolicyInputSchema.parse(data);
}
