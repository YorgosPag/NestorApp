/**
 * APPROVAL RESUME — Operator Inbox Resume Flow (UC-009)
 *
 * Resumes pipeline execution after human approval/modification.
 * Runs remaining steps: EXECUTE (Step 6) + ACKNOWLEDGE (Step 7).
 *
 * Extracted from pipeline-orchestrator.ts for N.7.1 compliance.
 *
 * @module services/ai-pipeline/approval-resume
 * @see ADR-080 (Pipeline), ADR-131 (Multi-Intent)
 */

import type {
  PipelineContext,
  PipelineStateValue,
  AuditDecision,
  IUCModule,
} from '@/types/ai-pipeline';
import { PipelineState } from '@/types/ai-pipeline';
import type { ModuleRegistry } from './module-registry';
import type { PipelineAuditService } from './audit-service';
import type { PipelineExecutionResult } from './pipeline-types';
import { stepMultiExecute } from './multi-intent-steps';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// TYPES
// ============================================================================

export interface ApprovalResumeDeps {
  registry: ModuleRegistry;
  auditService: PipelineAuditService;
  transitionState: (ctx: PipelineContext, to: PipelineStateValue) => PipelineContext;
  stepAcknowledge: (ctx: PipelineContext, module: IUCModule) => Promise<PipelineContext>;
}

// ============================================================================
// RESUME FROM APPROVAL
// ============================================================================

/** Resume pipeline after human approval (UC-009 Operator Inbox) */
export async function resumeFromApproval(
  ctx: PipelineContext,
  deps: ApprovalResumeDeps
): Promise<PipelineExecutionResult> {
  const { registry, auditService, transitionState, stepAcknowledge } = deps;

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
    if (ctx.approval?.modifiedActions && ctx.approval.modifiedActions.length > 0) {
      ctx = transitionState(ctx, PipelineState.MODIFIED);
    }

    const allModules = resolveModulesForExecution(ctx, registry);

    if (allModules.length === 0) {
      const auditId = await auditService.record(ctx, 'approved');
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
    ctx = await stepMultiExecute(ctx, allModules, transitionState);
    ctx.stepDurations['execute'] = Date.now() - executeStart;

    if (!ctx.executionResult?.success) {
      ctx = transitionState(ctx, PipelineState.FAILED);
      const auditId = await auditService.record(ctx, 'failed', moduleIds);
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
    ctx = await stepAcknowledge(ctx, allModules[0]);
    ctx.stepDurations['acknowledge'] = Date.now() - ackStart;

    // ── Audit ──
    ctx = transitionState(ctx, PipelineState.AUDITED);
    const decision: AuditDecision = ctx.approval?.decision === 'modified'
      ? 'modified'
      : 'approved';
    const auditId = await auditService.record(ctx, decision, moduleIds);

    return {
      success: true,
      requestId: ctx.requestId,
      finalState: ctx.state,
      context: ctx,
      auditId,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    ctx.errors.push({
      step: 'resume_from_approval',
      error: errorMessage,
      timestamp: nowISO(),
      retryable: false,
    });

    ctx = deps.transitionState(ctx, PipelineState.FAILED);
    const auditId = await deps.auditService.record(ctx, 'failed');

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

// ============================================================================
// MODULE RESOLUTION
// ============================================================================

/**
 * Resolve all UC modules needed for execution.
 * Uses contributingModules (if available) or falls back to primary intent module.
 */
function resolveModulesForExecution(
  ctx: PipelineContext,
  registry: ModuleRegistry
): IUCModule[] {
  if (ctx.contributingModules && ctx.contributingModules.length > 0) {
    const modules: IUCModule[] = [];
    for (const moduleId of ctx.contributingModules) {
      const module = registry.getModule(moduleId);
      if (module) {
        modules.push(module);
      }
    }
    if (modules.length > 0) return modules;
  }

  if (ctx.understanding) {
    const module = registry.getModuleForIntent(ctx.understanding.intent);
    if (module) return [module];
  }

  return [];
}
