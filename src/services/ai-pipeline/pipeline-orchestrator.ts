/**
 * AI PIPELINE ORCHESTRATOR
 *
 * Core engine: chains 7 pipeline steps, manages state, delegates to UC modules.
 * Heavy logic extracted to: intent-mapping, multi-intent-steps,
 * agentic-path-executor, post-reply-actions (N.7.1 compliance).
 *
 * @see ADR-080 (Pipeline), ADR-169 (Modular AI), ADR-131 (Multi-Intent)
 */

import type { PipelineContext, PipelineStateValue, IUCModule } from '@/types/ai-pipeline';
import { PipelineState, PipelineChannel, ThreatLevel, isValidTransition } from '@/types/ai-pipeline';
import type { ModuleRegistry } from './module-registry';
import { IntentRouter } from './intent-router';
import type { PipelineAuditService } from './audit-service';
import type { IAIAnalysisProvider } from '@/services/ai-analysis/providers/IAIAnalysisProvider';
import { PIPELINE_TIMEOUT_CONFIG } from '@/config/ai-pipeline-config';
import { mapAIResultToUnderstanding } from './intent-mapping';
import { stepMultiLookup, stepMultiPropose, stepApproveMulti, stepMultiExecute } from './multi-intent-steps';
import { executeAgenticPath } from './agentic-path-executor';
import { resumeFromApproval } from './approval-resume';
import type { PipelineExecutionResult } from './pipeline-types';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

export type { PipelineExecutionResult } from './pipeline-types';

const orchestratorLogger = createModuleLogger('PIPELINE_ORCHESTRATOR');

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
   */
  async execute(ctx: PipelineContext): Promise<PipelineExecutionResult> {
    try {
      const result = await Promise.race([
        this.executeSteps(ctx),
        this.createTimeout(PIPELINE_TIMEOUT_CONFIG.TOTAL_PIPELINE_MS),
      ]);

      return result;
    } catch (error) {
      const errorMessage = getErrorMessage(error);

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
    ctx.stepDurations['intake'] = 0;

    // ── ADR-171: Agentic path for admin commands ──
    if (ctx.adminCommandMeta?.isAdminCommand === true) {
      return executeAgenticPath(ctx, {
        auditService: this.auditService,
        transitionState: this.transitionState.bind(this),
      });
    }

    // ── ADR-174: All messaging channels → agentic path ──
    if (
      ctx.intake.channel === PipelineChannel.TELEGRAM
      || ctx.intake.channel === PipelineChannel.WHATSAPP
      || ctx.intake.channel === PipelineChannel.MESSENGER
      || ctx.intake.channel === PipelineChannel.INSTAGRAM
    ) {
      return executeAgenticPath(ctx, {
        auditService: this.auditService,
        transitionState: this.transitionState.bind(this),
      });
    }

    // ── Step 2: UNDERSTAND (non-admin messages only) ──
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

    // Resolve modules from routing
    const allModules = multiRoute.allModules;

    if (allModules.length === 0) {
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

    const moduleIds = allModules.map(m => m.moduleId).join(',');

    // ── Step 3: MULTI-LOOKUP ──
    const lookupStart = Date.now();
    ctx = await stepMultiLookup(ctx, allModules);
    ctx.stepDurations['lookup'] = Date.now() - lookupStart;

    // ── Step 4: MULTI-PROPOSE ──
    const proposeStart = Date.now();
    ctx = await stepMultiPropose(ctx, allModules);
    ctx.stepDurations['propose'] = Date.now() - proposeStart;

    ctx = this.transitionState(ctx, PipelineState.PROPOSED);

    // ── Step 5: APPROVE ──
    ctx = stepApproveMulti(
      ctx,
      multiRoute,
      this.transitionState.bind(this)
    );

    // If not approved → waiting for human review
    if (ctx.state !== PipelineState.APPROVED) {
      const auditId = await this.auditService.record(ctx, 'manual_triage', moduleIds);
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
    ctx = await stepMultiExecute(
      ctx,
      allModules,
      this.transitionState.bind(this)
    );
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
          ...(isAdminCommand ? { isAdminCommand: true } : {}),
        },
      });

      const understanding = mapAIResultToUnderstanding(ctx, aiResult, this.aiProvider.name);
      ctx.understanding = understanding;

      if (understanding.threatLevel === ThreatLevel.HIGH) {
        ctx = this.transitionState(ctx, PipelineState.DLQ);
        return ctx;
      }

      ctx = this.transitionState(ctx, PipelineState.UNDERSTOOD);
      return ctx;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
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
      const errorMessage = getErrorMessage(error);
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

  /** Resume pipeline after human approval — delegates to approval-resume.ts */
  async resumeFromApproval(ctx: PipelineContext): Promise<PipelineExecutionResult> {
    return resumeFromApproval(ctx, {
      registry: this.registry,
      auditService: this.auditService,
      transitionState: this.transitionState.bind(this),
      stepAcknowledge: this.stepAcknowledge.bind(this),
    });
  }

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
        error: `Invalid transition: ${ctx.state} \u2192 ${to}`,
        timestamp: new Date().toISOString(),
        retryable: false,
      });
      return ctx;
    }

    ctx.state = to;
    return ctx;
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
