/**
 * =============================================================================
 * AI PIPELINE TYPES — ENTERPRISE UNIVERSAL PIPELINE
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Type definitions for the 7-step Universal AI Pipeline.
 * Matches contracts from docs/centralized-systems/ai/contracts.md
 *
 * @module types/ai-pipeline
 * @see ADR-080 (Pipeline Implementation)
 * @see ADR-169 (Modular AI Architecture)
 *
 * PIPELINE STEPS:
 *   INTAKE → UNDERSTAND → LOOKUP → PROPOSE → APPROVE → EXECUTE → ACKNOWLEDGE
 *
 * ARCHITECTURE:
 * - State machine with defined transitions
 * - Module Interface Contract (IUCModule) for pluggable UC modules
 * - Channel-agnostic normalized intake
 * - Config-driven thresholds and timeouts
 * - Full audit trail per execution
 */

// ============================================================================
// PIPELINE STATE MACHINE
// ============================================================================

/**
 * Pipeline state machine values
 * @see docs/centralized-systems/ai/reliability.md
 *
 * RECEIVED → ACKED → UNDERSTOOD → PROPOSED → APPROVED → EXECUTED → AUDITED
 *                                     ↓           ↓          ↓
 *                                  REJECTED    MODIFIED    FAILED → DLQ
 */
export const PipelineState = {
  RECEIVED: 'received',
  ACKED: 'acked',
  UNDERSTOOD: 'understood',
  PROPOSED: 'proposed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MODIFIED: 'modified',
  EXECUTED: 'executed',
  FAILED: 'failed',
  AUDITED: 'audited',
  DLQ: 'dlq',
} as const;

export type PipelineStateValue = typeof PipelineState[keyof typeof PipelineState];

/**
 * Valid state transitions
 * @enterprise State machine enforcement — no invalid transitions
 */
export const VALID_STATE_TRANSITIONS: Record<PipelineStateValue, readonly PipelineStateValue[]> = {
  [PipelineState.RECEIVED]: [PipelineState.ACKED, PipelineState.FAILED, PipelineState.DLQ],
  [PipelineState.ACKED]: [PipelineState.UNDERSTOOD, PipelineState.FAILED, PipelineState.DLQ],
  [PipelineState.UNDERSTOOD]: [PipelineState.PROPOSED, PipelineState.FAILED, PipelineState.DLQ],
  [PipelineState.PROPOSED]: [PipelineState.APPROVED, PipelineState.REJECTED, PipelineState.FAILED],
  [PipelineState.APPROVED]: [PipelineState.EXECUTED, PipelineState.MODIFIED, PipelineState.FAILED],
  [PipelineState.REJECTED]: [PipelineState.AUDITED],
  [PipelineState.MODIFIED]: [PipelineState.EXECUTED, PipelineState.FAILED],
  [PipelineState.EXECUTED]: [PipelineState.AUDITED, PipelineState.FAILED],
  [PipelineState.FAILED]: [PipelineState.DLQ, PipelineState.RECEIVED], // retry → RECEIVED
  [PipelineState.AUDITED]: [], // terminal state
  [PipelineState.DLQ]: [], // terminal state
} as const;

// ============================================================================
// PIPELINE INTENT TYPES
// ============================================================================

/**
 * Intent types aligned with contracts.md
 * Superset covering all documented UCs
 */
export const PipelineIntentType = {
  APPOINTMENT_REQUEST: 'appointment_request',
  INVOICE: 'invoice',
  DOCUMENT_REQUEST: 'document_request',
  PROPERTY_SEARCH: 'property_search',
  OUTBOUND_SEND: 'outbound_send',
  REPORT_REQUEST: 'report_request',
  DASHBOARD_QUERY: 'dashboard_query',
  STATUS_INQUIRY: 'status_inquiry',
  DEFECT_REPORT: 'defect_report',
  PROCUREMENT_REQUEST: 'procurement_request',
  PAYMENT_NOTIFICATION: 'payment_notification',
  UNKNOWN: 'unknown',
} as const;

export type PipelineIntentTypeValue = typeof PipelineIntentType[keyof typeof PipelineIntentType];

// ============================================================================
// CHANNEL TYPES
// ============================================================================

/**
 * Communication channels supported by the pipeline
 */
export const PipelineChannel = {
  EMAIL: 'email',
  TELEGRAM: 'telegram',
  IN_APP: 'in_app',
  MESSENGER: 'messenger',
  SMS: 'sms',
} as const;

export type PipelineChannelValue = typeof PipelineChannel[keyof typeof PipelineChannel];

// ============================================================================
// SENDER CLASSIFICATION
// ============================================================================

/**
 * Sender type classification
 * @see docs/centralized-systems/ai/pipeline.md (Cross-Cutting Patterns)
 */
export const SenderType = {
  KNOWN_CONTACT: 'known_contact',
  UNKNOWN_LEGITIMATE: 'unknown_legitimate',
  COLD_OUTREACH: 'cold_outreach',
  SPAM: 'spam',
  PHISHING: 'phishing',
} as const;

export type SenderTypeValue = typeof SenderType[keyof typeof SenderType];

/**
 * Threat level classification
 * @see docs/centralized-systems/ai/security.md
 */
export const ThreatLevel = {
  CLEAN: 'clean',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type ThreatLevelValue = typeof ThreatLevel[keyof typeof ThreatLevel];

// ============================================================================
// URGENCY
// ============================================================================

/**
 * Message urgency levels
 */
export const Urgency = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type UrgencyValue = typeof Urgency[keyof typeof Urgency];

// ============================================================================
// INTAKE MESSAGE (Step 1)
// ============================================================================

/**
 * Normalized attachment from any channel
 */
export interface IntakeAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
  storageUrl?: string;
}

/**
 * Normalized sender information
 */
export interface IntakeSender {
  email?: string;
  phone?: string;
  name?: string;
  telegramId?: string;
}

/**
 * Normalized intake message from any channel
 * @see docs/centralized-systems/ai/contracts.md
 */
export interface IntakeMessage {
  id: string;
  channel: PipelineChannelValue;
  rawPayload: Record<string, unknown>;
  normalized: {
    sender: IntakeSender;
    recipients: string[];
    subject?: string;
    contentText: string;
    contentHtml?: string;
    attachments: IntakeAttachment[];
    timestampIso: string;
  };
  metadata: {
    providerMessageId: string;
    signatureVerified: boolean;
  };
  schemaVersion: number;
}

// ============================================================================
// UNDERSTANDING RESULT (Step 2)
// ============================================================================

/**
 * Company detection result
 * @see docs/centralized-systems/ai/pipeline.md (Company Detection)
 */
export interface CompanyDetection {
  companyId: string | null;
  signal: 'recipient_email' | 'known_contact' | 'content_match' | 'fallback';
  confidence: number;
}

/**
 * A single detected intent from AI analysis
 * @see ADR-131 (Multi-Intent Pipeline)
 */
export interface DetectedIntent {
  intent: PipelineIntentTypeValue;
  confidence: number; // 0-100
  rationale: string;
}

/**
 * Understanding result from AI analysis
 * @see docs/centralized-systems/ai/contracts.md
 * @see ADR-131 (Multi-Intent Pipeline)
 */
export interface UnderstandingResult {
  messageId: string;
  /** Primary intent — backward compatible (same as detectedIntents[0].intent) */
  intent: PipelineIntentTypeValue;
  entities: Record<string, string | undefined>;
  /** Primary confidence — backward compatible (same as detectedIntents[0].confidence) */
  confidence: number; // 0-100
  /** Primary rationale — backward compatible (same as detectedIntents[0].rationale) */
  rationale: string;
  language: string;
  urgency: UrgencyValue;
  policyFlags: string[];
  companyDetection: CompanyDetection;
  senderType: SenderTypeValue;
  threatLevel: ThreatLevelValue;
  threatReason?: string;
  /** All detected intents — primary first, then secondaries by descending confidence */
  detectedIntents: DetectedIntent[];
  schemaVersion: number;
}

// ============================================================================
// PROPOSAL (Step 4)
// ============================================================================

/**
 * A single action that the pipeline can execute
 */
export interface PipelineAction {
  type: string;
  params: Record<string, unknown>;
}

/**
 * Proposal generated by a UC module
 * @see docs/centralized-systems/ai/contracts.md
 */
export interface Proposal {
  messageId: string;
  suggestedActions: PipelineAction[];
  requiredApprovals: string[];
  autoApprovable: boolean;
  summary: string;
  alternativeActions?: PipelineAction[];
  schemaVersion: number;
}

// ============================================================================
// APPROVAL (Step 5)
// ============================================================================

/**
 * Approval decision for a proposal
 */
export interface ApprovalDecision {
  decision: 'approved' | 'rejected' | 'modified';
  approvedBy?: string | null;
  modifiedActions?: PipelineAction[] | null;
  reason?: string | null;
  decidedAt: string;
}

// ============================================================================
// EXECUTION PLAN (Step 6)
// ============================================================================

/**
 * Execution plan with idempotency protection
 * @see docs/centralized-systems/ai/contracts.md
 */
export interface ExecutionPlan {
  messageId: string;
  idempotencyKey: string;
  actions: PipelineAction[];
  sideEffects: string[];
  rollbackPlan?: PipelineAction[];
  schemaVersion: number;
}

/**
 * Result of executing a plan
 */
export interface ExecutionResult {
  success: boolean;
  sideEffects: string[];
  error?: string;
}

// ============================================================================
// ACKNOWLEDGMENT (Step 7)
// ============================================================================

/**
 * Result of sending acknowledgment to sender
 */
export interface AcknowledgmentResult {
  sent: boolean;
  channel: PipelineChannelValue;
  messageId?: string;
}

// ============================================================================
// PIPELINE CONTEXT (carries data through all 7 steps)
// ============================================================================

/**
 * Error encountered during pipeline execution
 */
export interface PipelineError {
  step: string;
  error: string;
  timestamp: string;
  retryable: boolean;
}

/**
 * Context object that flows through all pipeline steps
 * @enterprise Core data carrier — accumulates results from each step
 */
export interface PipelineContext {
  /** Unique correlation ID: req_{timestamp}_{random} */
  requestId: string;

  /** Tenant isolation */
  companyId: string;

  /** Current state in the pipeline */
  state: PipelineStateValue;

  /** Step 1: Intake message (always present) */
  intake: IntakeMessage;

  /** Step 2: Understanding result */
  understanding?: UnderstandingResult;

  /** Step 3: Lookup results from Firestore */
  lookupData?: Record<string, unknown>;

  /** Step 4: Proposal from UC module */
  proposal?: Proposal;

  /** Step 5: Approval decision */
  approval?: ApprovalDecision;

  /** Step 6: Execution plan */
  executionPlan?: ExecutionPlan;

  /** Step 6 result */
  executionResult?: ExecutionResult;

  /** Step 7: Acknowledgment result */
  acknowledgment?: AcknowledgmentResult;

  // ── Multi-Module Support (ADR-131) ──

  /** Lookup results per module (moduleId → data). Used when multiple modules contribute. */
  multiLookupData?: Record<string, Record<string, unknown>>;

  /** Module IDs that contributed to the proposal */
  contributingModules?: string[];

  /** Pipeline start timestamp (ISO 8601) */
  startedAt: string;

  /** Per-step durations in milliseconds */
  stepDurations: Partial<Record<string, number>>;

  /** Errors encountered during execution */
  errors: PipelineError[];
}

// ============================================================================
// UC MODULE INTERFACE
// ============================================================================

/**
 * Interface that every UC module MUST implement
 * @enterprise Modular architecture — each UC plugs into the pipeline
 *
 * @example
 * ```typescript
 * class AppointmentModule implements IUCModule {
 *   moduleId = 'UC-001';
 *   displayName = 'Αίτημα Ραντεβού';
 *   handledIntents = ['appointment_request'] as const;
 *   requiredRoles = ['salesManager'];
 *   // ... implement lookup, propose, execute, acknowledge
 * }
 * ```
 */
export interface IUCModule {
  /** Module identifier (e.g., 'UC-001', 'UC-002') */
  readonly moduleId: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Intent types this module handles */
  readonly handledIntents: readonly PipelineIntentTypeValue[];

  /** Roles required for approval of this module's actions */
  readonly requiredRoles: readonly string[];

  /**
   * Step 3: Lookup — Fetch relevant data from Firestore
   * @returns Lookup data needed for proposal generation
   */
  lookup(ctx: PipelineContext): Promise<Record<string, unknown>>;

  /**
   * Step 4: Propose — Generate action proposal based on understanding + lookup
   * @returns Proposal with suggested actions
   */
  propose(ctx: PipelineContext): Promise<Proposal>;

  /**
   * Step 6: Execute — Carry out approved actions
   * @returns Execution result with side effects
   */
  execute(ctx: PipelineContext): Promise<ExecutionResult>;

  /**
   * Step 7: Acknowledge — Send confirmation to the original sender
   * @returns Acknowledgment result
   */
  acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult>;

  /**
   * Health check for this module
   * @returns true if the module and its dependencies are available
   */
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// PIPELINE QUEUE ITEM
// ============================================================================

/**
 * Queue item status
 */
export type PipelineQueueStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'dead_letter';

/**
 * Queue retry history entry
 */
export interface PipelineRetryEntry {
  attemptedAt: string;
  error: string;
  step: string;
}

/**
 * Queue item stored in Firestore `ai_pipeline_queue` collection
 * @enterprise Same lifecycle pattern as email_ingestion_queue
 */
export interface PipelineQueueItem {
  id: string;
  requestId: string;
  companyId: string;
  channel: PipelineChannelValue;
  intakeMessageId: string;
  status: PipelineQueueStatus;
  pipelineState: PipelineStateValue;
  context: PipelineContext;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  processingStartedAt?: string;
  completedAt?: string;
  lastError?: {
    message: string;
    step: string;
    occurredAt: string;
  };
  retryHistory?: PipelineRetryEntry[];
}

// ============================================================================
// AUDIT ENTRY
// ============================================================================

/**
 * Audit decision types
 */
export type AuditDecision =
  | 'auto_processed'
  | 'approved'
  | 'rejected'
  | 'modified'
  | 'failed'
  | 'manual_triage'
  | 'quarantined';

/**
 * Audit trail entry for pipeline execution
 * @enterprise Full traceability — every AI decision is recorded
 * @see docs/centralized-systems/ai/pipeline.md (Audit Trail)
 */
export interface PipelineAuditEntry {
  requestId: string;
  timestamp: string;
  actionType: string;
  useCase: string;
  companyId: string;
  projectId?: string | null;
  initiatedBy: string;
  handledBy: string;
  aiConfidence: number;
  aiModel: string;
  decision: AuditDecision;
  details: Record<string, unknown>;
  durationMs: number;
  pipelineState: PipelineStateValue;
  channel: PipelineChannelValue;
  intent: PipelineIntentTypeValue;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a state is a terminal state (no further transitions)
 */
export function isTerminalState(state: PipelineStateValue): boolean {
  return state === PipelineState.AUDITED || state === PipelineState.DLQ;
}

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  from: PipelineStateValue,
  to: PipelineStateValue
): boolean {
  const validTargets = VALID_STATE_TRANSITIONS[from];
  return validTargets.includes(to);
}

/**
 * Check if a queue item is retryable
 */
export function isRetryable(item: PipelineQueueItem): boolean {
  return item.status === 'failed' && item.retryCount < item.maxRetries;
}
