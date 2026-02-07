/**
 * =============================================================================
 * AI PIPELINE SCHEMAS — ZOD VALIDATION
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Runtime validation schemas for Universal AI Pipeline contracts.
 * Ensures data integrity at module boundaries.
 *
 * @module schemas/ai-pipeline
 * @see ADR-080 (Pipeline Implementation)
 * @see docs/centralized-systems/ai/contracts.md
 *
 * CRITICAL:
 * - NO Date objects (serialization-safe — ISO 8601 strings only)
 * - Discriminated unions where applicable
 * - Single source of truth for pipeline contract validation
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const PipelineStateSchema = z.enum([
  'received', 'acked', 'understood', 'proposed',
  'approved', 'rejected', 'modified',
  'executed', 'failed', 'audited', 'dlq',
]);

export const PipelineIntentTypeSchema = z.enum([
  'appointment_request', 'invoice', 'document_request',
  'property_search', 'outbound_send', 'report_request',
  'dashboard_query', 'status_inquiry', 'defect_report',
  'procurement_request', 'payment_notification', 'unknown',
]);

export const PipelineChannelSchema = z.enum([
  'email', 'telegram', 'in_app', 'messenger', 'sms',
]);

export const SenderTypeSchema = z.enum([
  'known_contact', 'unknown_legitimate', 'cold_outreach', 'spam', 'phishing',
]);

export const ThreatLevelSchema = z.enum([
  'clean', 'low', 'medium', 'high',
]);

export const UrgencySchema = z.enum([
  'low', 'normal', 'high', 'critical',
]);

export const PipelineQueueStatusSchema = z.enum([
  'pending', 'processing', 'completed', 'failed', 'dead_letter',
]);

export const AuditDecisionSchema = z.enum([
  'auto_processed', 'approved', 'rejected', 'modified',
  'failed', 'manual_triage', 'quarantined',
]);

// ============================================================================
// INTAKE MESSAGE (Step 1)
// ============================================================================

export const IntakeAttachmentSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  storageUrl: z.string().url().optional(),
});

export const IntakeSenderSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  telegramId: z.string().optional(),
});

export const IntakeMessageSchema = z.object({
  id: z.string().min(1),
  channel: PipelineChannelSchema,
  rawPayload: z.record(z.unknown()),
  normalized: z.object({
    sender: IntakeSenderSchema,
    recipients: z.array(z.string()),
    subject: z.string().optional(),
    contentText: z.string(),
    contentHtml: z.string().optional(),
    attachments: z.array(IntakeAttachmentSchema),
    timestampIso: z.string().datetime(),
  }),
  metadata: z.object({
    providerMessageId: z.string().min(1),
    signatureVerified: z.boolean(),
  }),
  schemaVersion: z.number().int().positive(),
});

export type IntakeMessageValidated = z.infer<typeof IntakeMessageSchema>;

// ============================================================================
// UNDERSTANDING RESULT (Step 2)
// ============================================================================

export const CompanyDetectionSchema = z.object({
  companyId: z.string().nullable(),
  signal: z.enum(['recipient_email', 'known_contact', 'content_match', 'fallback']),
  confidence: z.number().min(0).max(100),
});

export const UnderstandingResultSchema = z.object({
  messageId: z.string().min(1),
  intent: PipelineIntentTypeSchema,
  entities: z.record(z.string().optional()),
  confidence: z.number().min(0).max(100),
  rationale: z.string(),
  language: z.string().min(2).max(5),
  urgency: UrgencySchema,
  policyFlags: z.array(z.string()),
  companyDetection: CompanyDetectionSchema,
  senderType: SenderTypeSchema,
  threatLevel: ThreatLevelSchema,
  threatReason: z.string().optional(),
  schemaVersion: z.number().int().positive(),
});

export type UnderstandingResultValidated = z.infer<typeof UnderstandingResultSchema>;

// ============================================================================
// PROPOSAL (Step 4)
// ============================================================================

export const PipelineActionSchema = z.object({
  type: z.string().min(1),
  params: z.record(z.unknown()),
});

export const ProposalSchema = z.object({
  messageId: z.string().min(1),
  suggestedActions: z.array(PipelineActionSchema).min(1),
  requiredApprovals: z.array(z.string()),
  autoApprovable: z.boolean(),
  summary: z.string().min(1),
  alternativeActions: z.array(PipelineActionSchema).optional(),
  schemaVersion: z.number().int().positive(),
});

export type ProposalValidated = z.infer<typeof ProposalSchema>;

// ============================================================================
// APPROVAL (Step 5)
// ============================================================================

export const ApprovalDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'modified']),
  approvedBy: z.string().optional(),
  modifiedActions: z.array(PipelineActionSchema).optional(),
  reason: z.string().optional(),
  decidedAt: z.string().datetime(),
});

// ============================================================================
// EXECUTION PLAN (Step 6)
// ============================================================================

export const ExecutionPlanSchema = z.object({
  messageId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  actions: z.array(PipelineActionSchema).min(1),
  sideEffects: z.array(z.string()),
  rollbackPlan: z.array(PipelineActionSchema).optional(),
  schemaVersion: z.number().int().positive(),
});

export const ExecutionResultSchema = z.object({
  success: z.boolean(),
  sideEffects: z.array(z.string()),
  error: z.string().optional(),
});

// ============================================================================
// ACKNOWLEDGMENT (Step 7)
// ============================================================================

export const AcknowledgmentResultSchema = z.object({
  sent: z.boolean(),
  channel: PipelineChannelSchema,
  messageId: z.string().optional(),
});

// ============================================================================
// PIPELINE CONTEXT
// ============================================================================

export const PipelineErrorSchema = z.object({
  step: z.string(),
  error: z.string(),
  timestamp: z.string().datetime(),
  retryable: z.boolean(),
});

export const PipelineContextSchema = z.object({
  requestId: z.string().min(1),
  companyId: z.string().min(1),
  state: PipelineStateSchema,
  intake: IntakeMessageSchema,
  understanding: UnderstandingResultSchema.optional(),
  lookupData: z.record(z.unknown()).optional(),
  proposal: ProposalSchema.optional(),
  approval: ApprovalDecisionSchema.optional(),
  executionPlan: ExecutionPlanSchema.optional(),
  executionResult: ExecutionResultSchema.optional(),
  acknowledgment: AcknowledgmentResultSchema.optional(),
  startedAt: z.string().datetime(),
  stepDurations: z.record(z.number()).optional(),
  errors: z.array(PipelineErrorSchema),
});

// ============================================================================
// AUDIT ENTRY
// ============================================================================

export const PipelineAuditEntrySchema = z.object({
  requestId: z.string().min(1),
  timestamp: z.string().datetime(),
  actionType: z.string(),
  useCase: z.string(),
  companyId: z.string().min(1),
  projectId: z.string().optional(),
  initiatedBy: z.string(),
  handledBy: z.string(),
  aiConfidence: z.number().min(0).max(100),
  aiModel: z.string(),
  decision: AuditDecisionSchema,
  details: z.record(z.unknown()),
  durationMs: z.number().nonnegative(),
  pipelineState: PipelineStateSchema,
  channel: PipelineChannelSchema,
  intent: PipelineIntentTypeSchema,
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate an IntakeMessage
 * @throws ZodError if validation fails
 */
export function validateIntakeMessage(data: unknown): IntakeMessageValidated {
  return IntakeMessageSchema.parse(data);
}

/**
 * Safe validation for IntakeMessage (returns result instead of throwing)
 */
export function safeValidateIntakeMessage(data: unknown) {
  return IntakeMessageSchema.safeParse(data);
}

/**
 * Validate an UnderstandingResult
 * @throws ZodError if validation fails
 */
export function validateUnderstandingResult(data: unknown): UnderstandingResultValidated {
  return UnderstandingResultSchema.parse(data);
}

/**
 * Validate a Proposal
 * @throws ZodError if validation fails
 */
export function validateProposal(data: unknown): ProposalValidated {
  return ProposalSchema.parse(data);
}
