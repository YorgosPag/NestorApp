/**
 * =============================================================================
 * AI PIPELINE ORCHESTRATOR
 * =============================================================================
 *
 * 🏢 ENTERPRISE: The heart of the Universal AI Pipeline.
 * Chains the 7 steps, manages state transitions, and delegates to UC modules.
 *
 * @module services/ai-pipeline/pipeline-orchestrator
 * @see ADR-080 (Pipeline Implementation)
 * @see ADR-169 (Modular AI Architecture)
 * @see docs/centralized-systems/ai/pipeline.md (Universal Pipeline)
 *
 * PIPELINE STEPS:
 *   1. INTAKE      — Already done by channel adapter (IntakeMessage created)
 *   2. UNDERSTAND   — AI analyzes intent, entities, urgency, threat
 *   3. LOOKUP       — UC module fetches relevant Firestore data
 *   4. PROPOSE      — UC module generates action proposal
 *   5. APPROVE      — Auto-approve (high confidence) or queue for human review
 *   6. EXECUTE      — UC module executes approved actions
 *   7. ACKNOWLEDGE  — UC module sends confirmation to sender
 */

import type {
  PipelineContext,
  PipelineStateValue,
  UnderstandingResult,
  AuditDecision,
  IUCModule,
} from '@/types/ai-pipeline';
import {
  PipelineState,
  PipelineIntentType,
  SenderType,
  ThreatLevel,
  Urgency,
  isValidTransition,
} from '@/types/ai-pipeline';
import type { ModuleRegistry } from './module-registry';
import { IntentRouter } from './intent-router';
import type { PipelineAuditService } from './audit-service';
import type { IAIAnalysisProvider } from '@/services/ai-analysis/providers/IAIAnalysisProvider';
import { isMessageIntentAnalysis } from '@/schemas/ai-analysis';
import {
  PIPELINE_CONFIDENCE_CONFIG,
  PIPELINE_TIMEOUT_CONFIG,
  PIPELINE_PROTOCOL_CONFIG,
} from '@/config/ai-pipeline-config';

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * Pipeline execution result
 */
export interface PipelineExecutionResult {
  success: boolean;
  requestId: string;
  finalState: PipelineStateValue;
  context: PipelineContext;
  auditId?: string;
  error?: string;
}

/**
 * Orchestrates the 7-step Universal AI Pipeline
 * @enterprise Core engine — chains steps, manages state, delegates to UC modules
 */
export class PipelineOrchestrator {
  private router: IntentRouter;

  constructor(
    private registry: ModuleRegistry,
    private auditService: PipelineAuditService,
    private aiProvider: IAIAnalysisProvider
  ) {
    this.router = new IntentRouter(registry);
  }

  /**
   * Execute the full pipeline for a given context
   *
   * @param ctx - Pipeline context with IntakeMessage (from channel adapter)
   * @returns Pipeline execution result
   */
  async execute(ctx: PipelineContext): Promise<PipelineExecutionResult> {
    const startTime = Date.now();

    try {
      // Enforce total timeout
      const result = await Promise.race([
        this.executeSteps(ctx),
        this.createTimeout(PIPELINE_TIMEOUT_CONFIG.TOTAL_PIPELINE_MS),
      ]);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      ctx.errors.push({
        step: 'orchestrator',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        retryable: true,
      });

      ctx = this.transitionState(ctx, PipelineState.FAILED);

      const auditId = await this.auditService.record(ctx, 'failed');

      return {
        success: false,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        auditId,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute pipeline steps sequentially
   */
  private async executeSteps(ctx: PipelineContext): Promise<PipelineExecutionResult> {
    // ── Step 1: INTAKE (already done — IntakeMessage is in ctx) ──
    ctx = this.transitionState(ctx, PipelineState.ACKED);
    ctx.stepDurations['intake'] = 0; // Already processed

    // ── Step 2: UNDERSTAND ──
    const understandStart = Date.now();
    ctx = await this.stepUnderstand(ctx);
    ctx.stepDurations['understand'] = Date.now() - understandStart;

    // Check for quarantine
    if (ctx.state === PipelineState.DLQ) {
      const auditId = await this.auditService.record(ctx, 'quarantined');
      return {
        success: false,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        auditId,
      };
    }

    // ── Route to UC module ──
    const routingResult = this.router.route(ctx.understanding!);

    // Not routed → manual triage
    if (!routingResult.routed) {
      ctx = this.transitionState(ctx, PipelineState.PROPOSED);
      const auditId = await this.auditService.record(ctx, 'manual_triage');
      return {
        success: true,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        auditId,
      };
    }

    const module = this.registry.getModuleForIntent(ctx.understanding!.intent);
    if (!module) {
      ctx = this.transitionState(ctx, PipelineState.PROPOSED);
      const auditId = await this.auditService.record(ctx, 'manual_triage');
      return {
        success: true,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        auditId,
      };
    }

    // ── Step 3: LOOKUP ──
    const lookupStart = Date.now();
    ctx = await this.stepLookup(ctx, module);
    ctx.stepDurations['lookup'] = Date.now() - lookupStart;

    // ── Step 4: PROPOSE ──
    const proposeStart = Date.now();
    ctx = await this.stepPropose(ctx, module);
    ctx.stepDurations['propose'] = Date.now() - proposeStart;
    ctx = this.transitionState(ctx, PipelineState.PROPOSED);

    // ── Step 5: APPROVE ──
    const approveStart = Date.now();
    ctx = this.stepApprove(ctx, routingResult);
    ctx.stepDurations['approve'] = Date.now() - approveStart;

    // If not auto-approved, stop here — awaiting human review
    if (ctx.state !== PipelineState.APPROVED) {
      const decision: AuditDecision = ctx.state === PipelineState.REJECTED
        ? 'rejected' : 'manual_triage';
      const auditId = await this.auditService.record(ctx, decision, module.moduleId);
      return {
        success: true,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        auditId,
      };
    }

    // ── Step 6: EXECUTE ──
    const executeStart = Date.now();
    ctx = await this.stepExecute(ctx, module);
    ctx.stepDurations['execute'] = Date.now() - executeStart;

    if (!ctx.executionResult?.success) {
      ctx = this.transitionState(ctx, PipelineState.FAILED);
      const auditId = await this.auditService.record(ctx, 'failed', module.moduleId);
      return {
        success: false,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        auditId,
        error: ctx.executionResult?.error,
      };
    }

    // ── Step 7: ACKNOWLEDGE ──
    const ackStart = Date.now();
    ctx = await this.stepAcknowledge(ctx, module);
    ctx.stepDurations['acknowledge'] = Date.now() - ackStart;

    // ── Audit ──
    ctx = this.transitionState(ctx, PipelineState.AUDITED);
    const auditId = await this.auditService.record(ctx, 'auto_processed', module.moduleId);

    return {
      success: true,
      requestId: ctx.requestId,
      finalState: ctx.state,
      context: ctx,
      auditId,
    };
  }

  // ==========================================================================
  // STEP IMPLEMENTATIONS
  // ==========================================================================

  /**
   * Step 2: UNDERSTAND — AI analyzes intent, entities, urgency
   */
  private async stepUnderstand(ctx: PipelineContext): Promise<PipelineContext> {
    try {
      const aiResult = await this.aiProvider.analyze({
        kind: 'message_intent',
        messageText: ctx.intake.normalized.contentText || ctx.intake.normalized.subject || '',
        context: {
          senderName: ctx.intake.normalized.sender.name,
          channel: ctx.intake.channel,
        },
      });

      // Map AI result to UnderstandingResult
      const understanding = this.mapAIResultToUnderstanding(ctx, aiResult);
      ctx.understanding = understanding;

      // Check threat level for quarantine
      if (understanding.threatLevel === ThreatLevel.HIGH) {
        ctx = this.transitionState(ctx, PipelineState.DLQ);
        return ctx;
      }

      ctx = this.transitionState(ctx, PipelineState.UNDERSTOOD);
      return ctx;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.errors.push({
        step: 'understand',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Step 3: LOOKUP — UC module fetches relevant data
   */
  private async stepLookup(ctx: PipelineContext, module: IUCModule): Promise<PipelineContext> {
    try {
      ctx.lookupData = await module.lookup(ctx);
      return ctx;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.errors.push({
        step: 'lookup',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Step 4: PROPOSE — UC module generates action proposal
   */
  private async stepPropose(ctx: PipelineContext, module: IUCModule): Promise<PipelineContext> {
    try {
      ctx.proposal = await module.propose(ctx);
      return ctx;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.errors.push({
        step: 'propose',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Step 5: APPROVE — Auto-approve if confidence is high enough
   */
  private stepApprove(
    ctx: PipelineContext,
    routingResult: { routed: true; autoApprove: boolean; needsManualReview: boolean }
  ): PipelineContext {
    if (!ctx.proposal) return ctx;

    if (
      ctx.proposal.autoApprovable &&
      routingResult.autoApprove &&
      !routingResult.needsManualReview
    ) {
      ctx.approval = {
        decision: 'approved',
        approvedBy: 'AI-auto',
        decidedAt: new Date().toISOString(),
      };
      ctx = this.transitionState(ctx, PipelineState.APPROVED);
    }
    // If not auto-approved, state remains PROPOSED (awaiting human review)

    return ctx;
  }

  /**
   * Step 6: EXECUTE — UC module executes approved actions
   */
  private async stepExecute(ctx: PipelineContext, module: IUCModule): Promise<PipelineContext> {
    try {
      // Build execution plan
      ctx.executionPlan = {
        messageId: ctx.intake.id,
        idempotencyKey: `${ctx.requestId}_execute`,
        actions: ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [],
        sideEffects: [],
        schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
      };

      ctx.executionResult = await module.execute(ctx);
      ctx = this.transitionState(ctx, PipelineState.EXECUTED);
      return ctx;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.errors.push({
        step: 'execute',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        retryable: false, // Execution failures may not be safe to retry
      });
      ctx.executionResult = {
        success: false,
        sideEffects: [],
        error: errorMessage,
      };
      return ctx;
    }
  }

  /**
   * Step 7: ACKNOWLEDGE — UC module sends confirmation
   */
  private async stepAcknowledge(ctx: PipelineContext, module: IUCModule): Promise<PipelineContext> {
    try {
      ctx.acknowledgment = await module.acknowledge(ctx);
      return ctx;
    } catch (error) {
      // Acknowledgment failure is non-fatal — pipeline still succeeds
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.errors.push({
        step: 'acknowledge',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        retryable: true,
      });
      ctx.acknowledgment = {
        sent: false,
        channel: ctx.intake.channel,
      };
      return ctx;
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Transition pipeline state with validation
   */
  private transitionState(
    ctx: PipelineContext,
    to: PipelineStateValue
  ): PipelineContext {
    if (!isValidTransition(ctx.state, to)) {
      ctx.errors.push({
        step: 'state_transition',
        error: `Invalid transition: ${ctx.state} → ${to}`,
        timestamp: new Date().toISOString(),
        retryable: false,
      });
      return ctx;
    }

    ctx.state = to;
    return ctx;
  }

  /**
   * Map existing AI analysis result to pipeline UnderstandingResult
   */
  private mapAIResultToUnderstanding(
    ctx: PipelineContext,
    aiResult: unknown
  ): UnderstandingResult {
    // Use existing schema validation
    const typedResult = aiResult as Record<string, unknown>;

    // Map legacy intent types to pipeline intent types
    let intent: import('@/types/ai-pipeline').PipelineIntentTypeValue = PipelineIntentType.UNKNOWN;
    if (isMessageIntentAnalysis(typedResult as Parameters<typeof isMessageIntentAnalysis>[0])) {
      const analysisResult = typedResult as { intentType?: string; confidence?: number; extractedEntities?: Record<string, string> };
      intent = mapLegacyIntentToPipeline(analysisResult.intentType ?? 'triage_needed');
    }

    const confidence = typeof typedResult.confidence === 'number'
      ? typedResult.confidence * 100 // AI provider returns 0-1, pipeline uses 0-100
      : 0;

    const entities = (typedResult.extractedEntities ?? {}) as Record<string, string | undefined>;

    return {
      messageId: ctx.intake.id,
      intent,
      entities,
      confidence,
      rationale: `AI analysis via ${this.aiProvider.name}`,
      language: 'el', // Default to Greek, can be enhanced later
      urgency: Urgency.NORMAL,
      policyFlags: [],
      companyDetection: {
        companyId: ctx.companyId,
        signal: 'recipient_email',
        confidence: 100,
      },
      senderType: SenderType.UNKNOWN_LEGITIMATE,
      threatLevel: ThreatLevel.CLEAN,
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  /**
   * Create a timeout promise for pipeline execution limits
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Pipeline execution timeout after ${ms}ms`));
      }, ms);
    });
  }
}

// ============================================================================
// LEGACY INTENT MAPPING
// ============================================================================

/**
 * Map legacy intent types (from existing AI provider) to pipeline intent types
 * @see src/schemas/ai-analysis.ts IntentType enum
 */
function mapLegacyIntentToPipeline(legacyIntent: string): import('@/types/ai-pipeline').PipelineIntentTypeValue {
  const mapping: Record<string, import('@/types/ai-pipeline').PipelineIntentTypeValue> = {
    'appointment': PipelineIntentType.APPOINTMENT_REQUEST,
    'appointment_request': PipelineIntentType.APPOINTMENT_REQUEST,
    'delivery': PipelineIntentType.PROCUREMENT_REQUEST,
    'invoice': PipelineIntentType.INVOICE,
    'payment': PipelineIntentType.PAYMENT_NOTIFICATION,
    'issue': PipelineIntentType.DEFECT_REPORT,
    'defect_report': PipelineIntentType.DEFECT_REPORT,
    'info_update': PipelineIntentType.UNKNOWN,
    'triage_needed': PipelineIntentType.UNKNOWN,
    'document_request': PipelineIntentType.DOCUMENT_REQUEST,
    'property_search': PipelineIntentType.PROPERTY_SEARCH,
    'outbound_send': PipelineIntentType.OUTBOUND_SEND,
    'report_request': PipelineIntentType.REPORT_REQUEST,
    'dashboard_query': PipelineIntentType.DASHBOARD_QUERY,
    'status_inquiry': PipelineIntentType.STATUS_INQUIRY,
    'procurement_request': PipelineIntentType.PROCUREMENT_REQUEST,
    'payment_notification': PipelineIntentType.PAYMENT_NOTIFICATION,
    'unknown': PipelineIntentType.UNKNOWN,
  };

  return mapping[legacyIntent] ?? PipelineIntentType.UNKNOWN;
}
