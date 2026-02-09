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
  Proposal,
  DetectedIntent,
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
import type { MultiRoutingResult } from './intent-router';
import type { PipelineAuditService } from './audit-service';
import type { IAIAnalysisProvider } from '@/services/ai-analysis/providers/IAIAnalysisProvider';
import { isMessageIntentAnalysis, isMultiIntentAnalysis } from '@/schemas/ai-analysis';
import {
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
   * Execute pipeline steps sequentially — supports multi-intent routing
   * @see ADR-131 (Multi-Intent Pipeline)
   *
   * Single intent → 1 module (identical to original flow)
   * Multi intent  → N modules → multi-lookup → multi-propose → compose → approve → multi-execute
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

    // ── ADR-145: Admin Fallback Override ──
    // If sender is admin and no admin module matched (unknown/general_inquiry),
    // substitute with AdminFallbackModule for a helpful response instead of manual triage.
    const isAdminWithUnknownIntent = ctx.adminCommandMeta?.isAdminCommand === true
      && !ctx.understanding!.intent.startsWith('admin_');

    if (isAdminWithUnknownIntent) {
      return this.executeAdminFallback(ctx);
    }

    // ── Multi-Intent Route ──
    const multiRoute = this.router.routeMultiple(ctx.understanding!);

    // Primary not routed → manual triage
    if (!multiRoute.primaryRoute.routed) {
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

    // No modules found → manual triage
    if (multiRoute.allModules.length === 0) {
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

    const allModules = multiRoute.allModules;
    const moduleIds = allModules.map(m => m.moduleId).join(',');

    // ── Step 3: MULTI-LOOKUP ──
    const lookupStart = Date.now();
    ctx = await this.stepMultiLookup(ctx, allModules);
    ctx.stepDurations['lookup'] = Date.now() - lookupStart;

    // ── Step 4: MULTI-PROPOSE + COMPOSE ──
    const proposeStart = Date.now();
    ctx = await this.stepMultiPropose(ctx, allModules);
    ctx.stepDurations['propose'] = Date.now() - proposeStart;
    ctx = this.transitionState(ctx, PipelineState.PROPOSED);

    // ── Step 5: APPROVE (multi-intent aware) ──
    const approveStart = Date.now();
    ctx = this.stepApproveMulti(ctx, multiRoute);
    ctx.stepDurations['approve'] = Date.now() - approveStart;

    // If not auto-approved, stop here — awaiting human review
    if (ctx.state !== PipelineState.APPROVED) {
      const decision: AuditDecision = ctx.state === PipelineState.REJECTED
        ? 'rejected' : 'manual_triage';
      const auditId = await this.auditService.record(ctx, decision, moduleIds);
      return {
        success: true,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        auditId,
      };
    }

    // ── Step 6: MULTI-EXECUTE ──
    const executeStart = Date.now();
    ctx = await this.stepMultiExecute(ctx, allModules);
    ctx.stepDurations['execute'] = Date.now() - executeStart;

    if (!ctx.executionResult?.success) {
      ctx = this.transitionState(ctx, PipelineState.FAILED);
      const auditId = await this.auditService.record(ctx, 'failed', moduleIds);
      return {
        success: false,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        auditId,
        error: ctx.executionResult?.error,
      };
    }

    // ── Step 7: ACKNOWLEDGE (primary module handles acknowledgment) ──
    const ackStart = Date.now();
    ctx = await this.stepAcknowledge(ctx, allModules[0]);
    ctx.stepDurations['acknowledge'] = Date.now() - ackStart;

    // ── Audit ──
    ctx = this.transitionState(ctx, PipelineState.AUDITED);
    const auditId = await this.auditService.record(ctx, 'auto_processed', moduleIds);

    return {
      success: true,
      requestId: ctx.requestId,
      finalState: ctx.state,
      context: ctx,
      auditId,
    };
  }

  // ==========================================================================
  // ADR-145: ADMIN FALLBACK EXECUTION
  // ==========================================================================

  /**
   * Execute admin fallback flow for unrecognized admin commands.
   * Dynamically imports AdminFallbackModule to avoid coupling.
   *
   * @see ADR-145 (Super Admin AI Assistant)
   */
  private async executeAdminFallback(ctx: PipelineContext): Promise<PipelineExecutionResult> {
    try {
      const { AdminFallbackModule } = await import(
        './modules/uc-014-admin-fallback'
      );
      const fallbackModule = new AdminFallbackModule();

      // LOOKUP (no-op for fallback)
      ctx.lookupData = await fallbackModule.lookup(ctx);

      // PROPOSE
      ctx.proposal = await fallbackModule.propose(ctx);
      ctx = this.transitionState(ctx, PipelineState.PROPOSED);

      // AUTO-APPROVE (admin is the operator)
      ctx.approval = {
        decision: 'approved',
        approvedBy: `super_admin:${ctx.adminCommandMeta?.adminIdentity.displayName ?? 'admin'}`,
        decidedAt: new Date().toISOString(),
      };
      ctx = this.transitionState(ctx, PipelineState.APPROVED);

      // EXECUTE
      ctx.executionResult = await fallbackModule.execute(ctx);
      if (ctx.executionResult.success) {
        ctx = this.transitionState(ctx, PipelineState.EXECUTED);
      } else {
        ctx = this.transitionState(ctx, PipelineState.FAILED);
      }

      // ACKNOWLEDGE
      ctx.acknowledgment = await fallbackModule.acknowledge(ctx);

      // AUDIT
      ctx = this.transitionState(ctx, PipelineState.AUDITED);
      const auditId = await this.auditService.record(ctx, 'auto_processed', 'UC-014');

      return {
        success: true,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        auditId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.errors.push({
        step: 'admin_fallback',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        retryable: false,
      });
      ctx = this.transitionState(ctx, PipelineState.FAILED);
      const auditId = await this.auditService.record(ctx, 'failed', 'UC-014');

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

  // ==========================================================================
  // STEP IMPLEMENTATIONS
  // ==========================================================================

  /**
   * Step 2: UNDERSTAND — AI analyzes intent, entities, urgency
   * ADR-145: Uses admin-specific prompt when sender is a super admin
   */
  private async stepUnderstand(ctx: PipelineContext): Promise<PipelineContext> {
    try {
      const isAdminCommand = ctx.adminCommandMeta?.isAdminCommand === true;

      const aiResult = await this.aiProvider.analyze({
        kind: 'message_intent',
        messageText: ctx.intake.normalized.contentText || ctx.intake.normalized.subject || '',
        context: {
          senderName: ctx.intake.normalized.sender.name,
          channel: ctx.intake.channel,
          // ADR-145: Signal admin mode to AI provider
          ...(isAdminCommand ? { isAdminCommand: true } : {}),
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
  // MULTI-MODULE PIPELINE STEPS (ADR-131)
  // ==========================================================================

  /**
   * Step 3 (Multi): Run lookup() on all modules, collect results per module
   * Primary module failure is fatal; secondary module failures are logged and skipped.
   */
  private async stepMultiLookup(
    ctx: PipelineContext,
    modules: IUCModule[]
  ): Promise<PipelineContext> {
    const multiLookupData: Record<string, Record<string, unknown>> = {};

    for (const module of modules) {
      try {
        const lookupData = await module.lookup(ctx);
        multiLookupData[module.moduleId] = lookupData;
      } catch (error) {
        // Primary module (first) failure is fatal
        if (module === modules[0]) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          ctx.errors.push({
            step: `lookup_${module.moduleId}`,
            error: errorMessage,
            timestamp: new Date().toISOString(),
            retryable: true,
          });
          throw error;
        }
        // Secondary module failure is non-fatal — log and continue
        const errorMessage = error instanceof Error ? error.message : String(error);
        ctx.errors.push({
          step: `lookup_${module.moduleId}`,
          error: `Secondary module lookup failed: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          retryable: false,
        });
      }
    }

    ctx.multiLookupData = multiLookupData;
    // Backward compat: set lookupData to primary module's data
    ctx.lookupData = multiLookupData[modules[0].moduleId] ?? {};

    return ctx;
  }

  /**
   * Step 4 (Multi): Run propose() on all modules, then compose into single Proposal
   * Each module gets its own lookupData from multiLookupData.
   */
  private async stepMultiPropose(
    ctx: PipelineContext,
    modules: IUCModule[]
  ): Promise<PipelineContext> {
    const proposals: Proposal[] = [];
    const contributingModules: string[] = [];

    for (const module of modules) {
      // Set lookupData for this specific module
      ctx.lookupData = ctx.multiLookupData?.[module.moduleId] ?? {};

      try {
        const proposal = await module.propose(ctx);
        proposals.push(proposal);
        contributingModules.push(module.moduleId);
      } catch (error) {
        // Primary module (first) failure is fatal
        if (module === modules[0]) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          ctx.errors.push({
            step: `propose_${module.moduleId}`,
            error: errorMessage,
            timestamp: new Date().toISOString(),
            retryable: true,
          });
          throw error;
        }
        // Secondary module failure — log and skip
        const errorMessage = error instanceof Error ? error.message : String(error);
        ctx.errors.push({
          step: `propose_${module.moduleId}`,
          error: `Secondary module propose failed: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          retryable: false,
        });
      }
    }

    // Compose all proposals into one
    ctx.proposal = this.composeProposal(proposals, ctx);
    ctx.contributingModules = contributingModules;

    // Restore primary lookupData for backward compat
    ctx.lookupData = ctx.multiLookupData?.[modules[0].moduleId] ?? {};

    return ctx;
  }

  /**
   * Compose multiple module proposals into a single unified Proposal
   * Single-module case: returns the proposal as-is (zero overhead).
   * @see ADR-131 (Multi-Intent Pipeline)
   */
  private composeProposal(proposals: Proposal[], ctx: PipelineContext): Proposal {
    if (proposals.length === 1) {
      return proposals[0]; // Single module — no composition overhead
    }

    return {
      messageId: ctx.intake.id,
      suggestedActions: proposals.flatMap(p => p.suggestedActions),
      summary: proposals.map(p => p.summary).join(' | '),
      autoApprovable: proposals.every(p => p.autoApprovable),
      requiredApprovals: [...new Set(proposals.flatMap(p => p.requiredApprovals))],
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  /**
   * Step 5 (Multi): Auto-approve using multi-routing aggregate decisions
   * ADR-145: Super admin commands are always auto-approved
   */
  private stepApproveMulti(
    ctx: PipelineContext,
    multiRoute: MultiRoutingResult
  ): PipelineContext {
    if (!ctx.proposal) return ctx;

    // ── ADR-145: Super admin auto-approve ──
    // Admin IS the operator — force auto-approve
    if (ctx.adminCommandMeta?.isAdminCommand) {
      ctx.approval = {
        decision: 'approved',
        approvedBy: `super_admin:${ctx.adminCommandMeta.adminIdentity.displayName}`,
        decidedAt: new Date().toISOString(),
      };
      ctx = this.transitionState(ctx, PipelineState.APPROVED);
      return ctx;
    }

    if (
      ctx.proposal.autoApprovable &&
      multiRoute.allAutoApprovable &&
      !multiRoute.needsManualReview
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
   * Step 6 (Multi): Execute actions through all contributing modules
   * Each module gets its own lookupData restored before execution.
   * First module failure stops execution for remaining modules.
   */
  private async stepMultiExecute(
    ctx: PipelineContext,
    modules: IUCModule[]
  ): Promise<PipelineContext> {
    // Build execution plan with ALL actions
    ctx.executionPlan = {
      messageId: ctx.intake.id,
      idempotencyKey: `${ctx.requestId}_execute`,
      actions: ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [],
      sideEffects: [],
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };

    const allSideEffects: string[] = [];

    for (const module of modules) {
      // Set correct lookupData for this module
      ctx.lookupData = ctx.multiLookupData?.[module.moduleId] ?? {};

      try {
        const result = await module.execute(ctx);
        allSideEffects.push(...result.sideEffects);

        if (!result.success) {
          ctx.executionResult = {
            success: false,
            sideEffects: allSideEffects,
            error: result.error,
          };
          return ctx;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        ctx.errors.push({
          step: `execute_${module.moduleId}`,
          error: errorMessage,
          timestamp: new Date().toISOString(),
          retryable: false,
        });
        ctx.executionResult = {
          success: false,
          sideEffects: allSideEffects,
          error: errorMessage,
        };
        return ctx;
      }
    }

    ctx.executionResult = { success: true, sideEffects: allSideEffects };
    ctx = this.transitionState(ctx, PipelineState.EXECUTED);

    // Restore primary lookupData
    ctx.lookupData = ctx.multiLookupData?.[modules[0].moduleId] ?? {};

    return ctx;
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
   * Handles both multi_intent (new) and message_intent (legacy) responses
   * @see ADR-131 (Multi-Intent Pipeline)
   */
  private mapAIResultToUnderstanding(
    ctx: PipelineContext,
    aiResult: unknown
  ): UnderstandingResult {
    const typedResult = aiResult as Record<string, unknown>;
    const entities = (typedResult.extractedEntities ?? {}) as Record<string, string | undefined>;

    // ── Multi-Intent Response (new schema) ──
    if (isMultiIntentAnalysis(typedResult as Parameters<typeof isMultiIntentAnalysis>[0])) {
      const multiResult = typedResult as {
        primaryIntent: { intentType: string; confidence: number; rationale: string };
        secondaryIntents: Array<{ intentType: string; confidence: number; rationale: string }>;
        confidence: number;
      };

      const primaryIntent = mapLegacyIntentToPipeline(multiResult.primaryIntent.intentType);
      const primaryConfidence = multiResult.primaryIntent.confidence * 100;
      const primaryRationale = multiResult.primaryIntent.rationale;

      // Build detectedIntents array: primary first, then secondaries
      const detectedIntents: DetectedIntent[] = [
        {
          intent: primaryIntent,
          confidence: primaryConfidence,
          rationale: primaryRationale,
        },
        ...multiResult.secondaryIntents.map(si => ({
          intent: mapLegacyIntentToPipeline(si.intentType),
          confidence: si.confidence * 100,
          rationale: si.rationale,
        })),
      ];

      return {
        messageId: ctx.intake.id,
        intent: primaryIntent,
        entities,
        confidence: primaryConfidence,
        rationale: primaryRationale,
        language: 'el',
        urgency: Urgency.NORMAL,
        policyFlags: [],
        companyDetection: {
          companyId: ctx.companyId,
          signal: 'recipient_email',
          confidence: 100,
        },
        senderType: SenderType.UNKNOWN_LEGITIMATE,
        threatLevel: ThreatLevel.CLEAN,
        detectedIntents,
        schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
      };
    }

    // ── Legacy Single-Intent Response (backward compatible) ──
    let intent: import('@/types/ai-pipeline').PipelineIntentTypeValue = PipelineIntentType.UNKNOWN;
    if (isMessageIntentAnalysis(typedResult as Parameters<typeof isMessageIntentAnalysis>[0])) {
      const analysisResult = typedResult as { intentType?: string };
      intent = mapLegacyIntentToPipeline(analysisResult.intentType ?? 'triage_needed');
    }

    const confidence = typeof typedResult.confidence === 'number'
      ? typedResult.confidence * 100
      : 0;

    const rationale = `AI analysis via ${this.aiProvider.name}`;

    return {
      messageId: ctx.intake.id,
      intent,
      entities,
      confidence,
      rationale,
      language: 'el',
      urgency: Urgency.NORMAL,
      policyFlags: [],
      companyDetection: {
        companyId: ctx.companyId,
        signal: 'recipient_email',
        confidence: 100,
      },
      senderType: SenderType.UNKNOWN_LEGITIMATE,
      threatLevel: ThreatLevel.CLEAN,
      detectedIntents: [{ intent, confidence, rationale }],
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // ==========================================================================
  // OPERATOR INBOX: RESUME FROM HUMAN APPROVAL
  // ==========================================================================

  /**
   * Resume pipeline execution after human approval (UC-009 Operator Inbox)
   *
   * Called when an operator approves/modifies a PROPOSED pipeline item.
   * Runs the remaining steps: EXECUTE (Step 6) + ACKNOWLEDGE (Step 7).
   *
   * @param ctx - Pipeline context with state APPROVED and approval decision set
   * @returns Pipeline execution result
   */
  async resumeFromApproval(ctx: PipelineContext): Promise<PipelineExecutionResult> {
    // Validate: must be in APPROVED state
    if (ctx.state !== PipelineState.APPROVED) {
      return {
        success: false,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        error: `Cannot resume from state '${ctx.state}'. Expected: 'approved'`,
      };
    }

    try {
      // If operator provided modified actions, transition APPROVED → MODIFIED
      if (ctx.approval?.modifiedActions && ctx.approval.modifiedActions.length > 0) {
        ctx = this.transitionState(ctx, PipelineState.MODIFIED);
      }

      // Resolve UC modules — multi-intent aware
      const allModules = this.resolveModulesForExecution(ctx);

      if (allModules.length === 0) {
        // No module available — record audit as approved (manual execution needed)
        const auditId = await this.auditService.record(ctx, 'approved');
        return {
          success: true,
          requestId: ctx.requestId,
          finalState: ctx.state,
          context: ctx,
          auditId,
        };
      }

      const moduleIds = allModules.map(m => m.moduleId).join(',');

      // ── Step 6: MULTI-EXECUTE ──
      const executeStart = Date.now();
      ctx = await this.stepMultiExecute(ctx, allModules);
      ctx.stepDurations['execute'] = Date.now() - executeStart;

      if (!ctx.executionResult?.success) {
        ctx = this.transitionState(ctx, PipelineState.FAILED);
        const auditId = await this.auditService.record(ctx, 'failed', moduleIds);
        return {
          success: false,
          requestId: ctx.requestId,
          finalState: ctx.state,
          context: ctx,
          auditId,
          error: ctx.executionResult?.error,
        };
      }

      // ── Step 7: ACKNOWLEDGE (primary module) ──
      const ackStart = Date.now();
      ctx = await this.stepAcknowledge(ctx, allModules[0]);
      ctx.stepDurations['acknowledge'] = Date.now() - ackStart;

      // ── Audit ──
      ctx = this.transitionState(ctx, PipelineState.AUDITED);
      const decision: AuditDecision = ctx.approval?.decision === 'modified'
        ? 'modified'
        : 'approved';
      const auditId = await this.auditService.record(ctx, decision, moduleIds);

      return {
        success: true,
        requestId: ctx.requestId,
        finalState: ctx.state,
        context: ctx,
        auditId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      ctx.errors.push({
        step: 'resume_from_approval',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        retryable: false,
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
   * Resolve all UC modules needed for execution
   * Uses contributingModules (if available) or falls back to primary intent module
   */
  private resolveModulesForExecution(ctx: PipelineContext): IUCModule[] {
    // Multi-intent: use contributingModules from proposal phase
    if (ctx.contributingModules && ctx.contributingModules.length > 0) {
      const modules: IUCModule[] = [];
      for (const moduleId of ctx.contributingModules) {
        const module = this.registry.getModule(moduleId);
        if (module) {
          modules.push(module);
        }
      }
      if (modules.length > 0) return modules;
    }

    // Fallback: single-intent — resolve from primary intent
    if (ctx.understanding) {
      const module = this.registry.getModuleForIntent(ctx.understanding.intent);
      if (module) return [module];
    }

    return [];
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

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
    'issue': PipelineIntentType.COMPLAINT,
    'defect_report': PipelineIntentType.DEFECT_REPORT,
    'complaint': PipelineIntentType.COMPLAINT,
    'general_inquiry': PipelineIntentType.GENERAL_INQUIRY,
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
    // ── ADR-145: Super Admin Command Intents ──
    'admin_contact_search': PipelineIntentType.ADMIN_CONTACT_SEARCH,
    'admin_project_status': PipelineIntentType.ADMIN_PROJECT_STATUS,
    'admin_send_email': PipelineIntentType.ADMIN_SEND_EMAIL,
    'admin_unit_stats': PipelineIntentType.ADMIN_UNIT_STATS,
  };

  return mapping[legacyIntent] ?? PipelineIntentType.UNKNOWN;
}
