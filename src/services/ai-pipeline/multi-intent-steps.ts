/**
 * =============================================================================
 * MULTI-INTENT PIPELINE STEPS (ADR-131)
 * =============================================================================
 *
 * Handles multi-module pipeline execution: lookup, propose, compose,
 * approve, and execute across multiple UC modules.
 *
 * Extracted from pipeline-orchestrator.ts for SRP compliance (N.7.1).
 *
 * @module services/ai-pipeline/multi-intent-steps
 * @see ADR-131 (Multi-Intent Pipeline)
 */

import type {
  PipelineContext,
  PipelineStateValue,
  IUCModule,
  Proposal,
} from '@/types/ai-pipeline';
import { PipelineState } from '@/types/ai-pipeline';
import type { MultiRoutingResult } from './intent-router';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { getErrorMessage } from '@/lib/error-utils';

/** Callback type for state transitions (injected from orchestrator) */
export type TransitionStateFn = (ctx: PipelineContext, to: PipelineStateValue) => PipelineContext;

// ============================================================================
// STEP 3 (Multi): LOOKUP
// ============================================================================

/**
 * Run lookup() on all modules, collect results per module.
 * Primary module failure is fatal; secondary module failures are logged and skipped.
 */
export async function stepMultiLookup(
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
        const errorMessage = getErrorMessage(error);
        ctx.errors.push({
          step: `lookup_${module.moduleId}`,
          error: errorMessage,
          timestamp: new Date().toISOString(),
          retryable: true,
        });
        throw error;
      }
      // Secondary module failure is non-fatal — log and continue
      const errorMessage = getErrorMessage(error);
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

// ============================================================================
// STEP 4 (Multi): PROPOSE
// ============================================================================

/**
 * Run propose() on all modules, then compose into single Proposal.
 * Each module gets its own lookupData from multiLookupData.
 */
export async function stepMultiPropose(
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
        const errorMessage = getErrorMessage(error);
        ctx.errors.push({
          step: `propose_${module.moduleId}`,
          error: errorMessage,
          timestamp: new Date().toISOString(),
          retryable: true,
        });
        throw error;
      }
      // Secondary module failure — log and skip
      const errorMessage = getErrorMessage(error);
      ctx.errors.push({
        step: `propose_${module.moduleId}`,
        error: `Secondary module propose failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        retryable: false,
      });
    }
  }

  // Compose all proposals into one
  ctx.proposal = composeProposal(proposals, ctx);
  ctx.contributingModules = contributingModules;

  // Restore primary lookupData for backward compat
  ctx.lookupData = ctx.multiLookupData?.[modules[0].moduleId] ?? {};

  return ctx;
}

// ============================================================================
// COMPOSE PROPOSAL
// ============================================================================

/**
 * Compose multiple module proposals into a single unified Proposal.
 * Single-module case: returns the proposal as-is (zero overhead).
 * @see ADR-131 (Multi-Intent Pipeline)
 */
export function composeProposal(proposals: Proposal[], ctx: PipelineContext): Proposal {
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

// ============================================================================
// STEP 5 (Multi): APPROVE
// ============================================================================

/**
 * Auto-approve using multi-routing aggregate decisions.
 * ADR-145: Super admin commands are always auto-approved.
 */
export function stepApproveMulti(
  ctx: PipelineContext,
  multiRoute: MultiRoutingResult,
  transitionState: TransitionStateFn
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
    ctx = transitionState(ctx, PipelineState.APPROVED);
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
    ctx = transitionState(ctx, PipelineState.APPROVED);
  }
  // If not auto-approved, state remains PROPOSED (awaiting human review)

  return ctx;
}

// ============================================================================
// STEP 6 (Multi): EXECUTE
// ============================================================================

/**
 * Execute actions through all contributing modules.
 * Each module gets its own lookupData restored before execution.
 * First module failure stops execution for remaining modules.
 */
export async function stepMultiExecute(
  ctx: PipelineContext,
  modules: IUCModule[],
  transitionState: TransitionStateFn
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
      const errorMessage = getErrorMessage(error);
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
  ctx = transitionState(ctx, PipelineState.EXECUTED);

  // Restore primary lookupData
  ctx.lookupData = ctx.multiLookupData?.[modules[0].moduleId] ?? {};

  return ctx;
}
