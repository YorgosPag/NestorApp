/**
 * =============================================================================
 * OPERATOR INBOX SERVICE (UC-009)
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Orchestrates the human approval workflow for the AI Pipeline.
 * Bridges the Operator Inbox UI with the pipeline queue and orchestrator.
 *
 * Flow:
 *   1. Operator submits decision (approve/reject) via API
 *   2. This service updates the queue item with the decision
 *   3. If approved → resumes pipeline execution (EXECUTE + ACKNOWLEDGE)
 *   4. If rejected → records audit and stops
 *
 * @module services/ai-pipeline/operator-inbox-service
 * @see ADR-080 (Pipeline Implementation)
 * @see docs/centralized-systems/ai/use-cases/UC-009-internal-operator-workflow.md
 */

import 'server-only';

import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  updateApprovalDecision,
  markPipelineItemCompleted,
  markPipelineItemFailed,
} from './pipeline-queue-service';
import { PipelineOrchestrator } from './pipeline-orchestrator';
import type { PipelineExecutionResult } from './pipeline-orchestrator';
import { getModuleRegistry } from './module-registry';
import { getPipelineAuditService } from './audit-service';
import { createAIAnalysisProvider } from '@/services/ai-analysis/providers/ai-provider-factory';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  PipelineQueueItem,
  PipelineAction,
  PipelineStateValue,
  ApprovalDecision,
} from '@/types/ai-pipeline';
import { PipelineState } from '@/types/ai-pipeline';

const logger = createModuleLogger('OPERATOR_INBOX_SERVICE');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parameters for operator approval decision
 */
export interface OperatorApprovalParams {
  queueId: string;
  decision: 'approved' | 'rejected';
  approvedBy: string;
  reason?: string;
  modifiedActions?: PipelineAction[];
}

/**
 * Result of operator approval processing
 */
export interface OperatorApprovalResult {
  success: boolean;
  queueId: string;
  newState: PipelineStateValue;
  auditId?: string;
  error?: string;
}

// ============================================================================
// PROCESS OPERATOR DECISION
// ============================================================================

/**
 * Process an operator's approval/rejection decision
 *
 * Full workflow:
 * 1. Build ApprovalDecision from params
 * 2. Update queue item atomically (Firestore transaction)
 * 3. If rejected → record audit, return
 * 4. If approved → resume pipeline (EXECUTE + ACKNOWLEDGE), mark completed/failed
 *
 * @param params - Operator decision parameters
 * @returns Processing result
 */
export async function processOperatorDecision(
  params: OperatorApprovalParams
): Promise<OperatorApprovalResult> {
  const startTime = Date.now();

  logger.info('Processing operator decision', {
    queueId: params.queueId,
    decision: params.decision,
    approvedBy: params.approvedBy,
  });

  try {
    // Step 1: Build ApprovalDecision
    const approvalDecision: ApprovalDecision = {
      decision: params.modifiedActions && params.modifiedActions.length > 0
        ? 'modified'
        : params.decision,
      approvedBy: params.approvedBy,
      reason: params.reason,
      modifiedActions: params.modifiedActions,
      decidedAt: new Date().toISOString(),
    };

    // Step 2: Update queue item with approval decision
    await updateApprovalDecision(params.queueId, approvalDecision);

    // Step 3: If rejected → done
    if (params.decision === 'rejected') {
      logger.info('Operator rejected pipeline item', {
        queueId: params.queueId,
        reason: params.reason,
        elapsedMs: Date.now() - startTime,
      });

      return {
        success: true,
        queueId: params.queueId,
        newState: PipelineState.REJECTED,
      };
    }

    // Step 4: If approved → resume pipeline execution
    const executionResult = await resumePipelineExecution(params.queueId);

    const elapsed = Date.now() - startTime;

    logger.info('Operator approval processed', {
      queueId: params.queueId,
      success: executionResult.success,
      finalState: executionResult.finalState,
      auditId: executionResult.auditId,
      elapsedMs: elapsed,
    });

    return {
      success: executionResult.success,
      queueId: params.queueId,
      newState: executionResult.finalState,
      auditId: executionResult.auditId,
      error: executionResult.error,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const elapsed = Date.now() - startTime;

    logger.error('Error processing operator decision', {
      queueId: params.queueId,
      error: errorMessage,
      elapsedMs: elapsed,
    });

    return {
      success: false,
      queueId: params.queueId,
      newState: PipelineState.FAILED,
      error: errorMessage,
    };
  }
}

// ============================================================================
// RESUME PIPELINE EXECUTION
// ============================================================================

/**
 * Resume pipeline execution for an approved queue item
 *
 * Fetches the updated queue item, creates a fresh orchestrator instance,
 * and runs steps 6-7 (EXECUTE + ACKNOWLEDGE).
 *
 * @param queueId - Firestore document ID of the approved item
 * @returns Pipeline execution result
 */
async function resumePipelineExecution(
  queueId: string
): Promise<PipelineExecutionResult> {
  // Fetch the updated queue item (now in APPROVED state)
  const adminDb = getAdminFirestore();
  const docRef = adminDb.collection(COLLECTIONS.AI_PIPELINE_QUEUE).doc(queueId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error(`Queue item ${queueId} not found for resume`);
  }

  const item = doc.data() as PipelineQueueItem;

  if (item.pipelineState !== PipelineState.APPROVED) {
    throw new Error(
      `Cannot resume item in state '${item.pipelineState}'. Expected: 'approved'`
    );
  }

  // Create fresh orchestrator (stateless, serverless-safe)
  const registry = getModuleRegistry();
  const auditService = getPipelineAuditService();
  const aiProvider = createAIAnalysisProvider();
  const orchestrator = new PipelineOrchestrator(registry, auditService, aiProvider);

  // Resume execution from APPROVED state
  const result = await orchestrator.resumeFromApproval(item.context);

  // Update queue item with final result
  if (result.success) {
    await markPipelineItemCompleted(queueId, result.context);
  } else {
    await markPipelineItemFailed(
      queueId,
      result.error ?? 'Resume execution failed',
      'operator_resume',
      result.context
    );
  }

  return result;
}
