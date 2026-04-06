/**
 * =============================================================================
 * AI PIPELINE QUEUE — OPERATOR INBOX OPERATIONS
 * =============================================================================
 *
 * Extracted from pipeline-queue-service.ts (ADR-065 Phase 6).
 * Handles operator review workflow: proposed items, approval, stats.
 *
 * @module services/ai-pipeline/pipeline-queue-operator
 * @see ADR-080 (Pipeline Implementation)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { QUEUE_STATUS } from '@/constants/entity-status-values';
import type {
  PipelineQueueItem,
  PipelineQueueStatus,
  PipelineContext,
  PipelineStateValue,
  ApprovalDecision,
} from '@/types/ai-pipeline';
import { PipelineState } from '@/types/ai-pipeline';

// ============================================================================
// OPERATOR INBOX: QUERY PROPOSED ITEMS
// ============================================================================

/**
 * Query parameters for proposed pipeline items
 */
export interface ProposedItemsQuery {
  companyId?: string;
  limit?: number;
}

/**
 * Get pipeline items awaiting human review (pipelineState === 'proposed')
 *
 * Used by the Operator Inbox to display items needing approval.
 *
 * @param query - Optional filters (companyId, limit)
 * @returns Array of proposed queue items, newest first
 */
export async function getProposedPipelineItems(
  query: ProposedItemsQuery = {}
): Promise<PipelineQueueItem[]> {
  const adminDb = getAdminFirestore();
  let ref: FirebaseFirestore.Query = adminDb
    .collection(COLLECTIONS.AI_PIPELINE_QUEUE)
    .where('pipelineState', '==', PipelineState.PROPOSED satisfies PipelineStateValue);

  if (query.companyId) {
    ref = ref.where(FIELDS.COMPANY_ID, '==', query.companyId);
  }

  ref = ref.orderBy(FIELDS.CREATED_AT, 'desc').limit(query.limit ?? 50);

  const snapshot = await ref.get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as PipelineQueueItem));
}

// ============================================================================
// OPERATOR INBOX: UPDATE APPROVAL DECISION
// ============================================================================

/**
 * Update a pipeline queue item with operator approval decision.
 *
 * Uses Firestore transaction for optimistic concurrency control:
 * - Validates item exists and is in PROPOSED state
 * - Updates context.approval and pipelineState atomically
 * - For APPROVED: resets queue status to 'processing' (signals resume)
 * - For REJECTED: keeps queue status as-is
 *
 * @param queueId - Firestore document ID of the queue item
 * @param approval - Operator's approval decision
 * @throws Error if item not found or not in PROPOSED state
 */
export async function updateApprovalDecision(
  queueId: string,
  approval: ApprovalDecision
): Promise<void> {
  const adminDb = getAdminFirestore();
  const docRef = adminDb
    .collection(COLLECTIONS.AI_PIPELINE_QUEUE)
    .doc(queueId);

  await adminDb.runTransaction(async (transaction) => {
    const freshDoc = await transaction.get(docRef);

    if (!freshDoc.exists) {
      throw new Error(`Pipeline queue item ${queueId} not found`);
    }

    const item = freshDoc.data() as PipelineQueueItem;

    if (item.pipelineState !== PipelineState.PROPOSED) {
      throw new Error(
        `Cannot approve item in state '${item.pipelineState}'. Expected: 'proposed'`
      );
    }

    const newPipelineState: PipelineStateValue =
      approval.decision === 'rejected'
        ? PipelineState.REJECTED
        : PipelineState.APPROVED;

    const updatedContext: PipelineContext = {
      ...item.context,
      state: newPipelineState,
      approval,
    };

    const updatePayload: Record<string, unknown> = {
      pipelineState: newPipelineState,
      context: updatedContext,
    };

    if (approval.decision !== 'rejected') {
      updatePayload.status = QUEUE_STATUS.PROCESSING satisfies PipelineQueueStatus;
      updatePayload.processingStartedAt = new Date().toISOString();
    }

    transaction.update(docRef, updatePayload);
  });
}

// ============================================================================
// OPERATOR INBOX: STATISTICS
// ============================================================================

/**
 * Statistics for operator inbox dashboard
 */
export interface ProposedItemStats {
  proposed: number;
  approved: number;
  rejected: number;
}

/**
 * Get pipeline item counts by review-relevant states
 *
 * @param companyId - Optional tenant filter
 * @returns Counts of proposed, approved, and rejected items
 */
export async function getProposedItemStats(
  companyId?: string
): Promise<ProposedItemStats> {
  const adminDb = getAdminFirestore();
  const states: PipelineStateValue[] = [
    PipelineState.PROPOSED,
    PipelineState.APPROVED,
    PipelineState.REJECTED,
  ];

  const counts = await Promise.all(
    states.map(async (state) => {
      let ref: FirebaseFirestore.Query = adminDb
        .collection(COLLECTIONS.AI_PIPELINE_QUEUE)
        .where('pipelineState', '==', state);

      if (companyId) {
        ref = ref.where(FIELDS.COMPANY_ID, '==', companyId);
      }

      const snapshot = await ref.count().get();
      return { state, count: snapshot.data().count };
    })
  );

  return {
    proposed: counts.find(c => c.state === PipelineState.PROPOSED)?.count ?? 0,
    approved: counts.find(c => c.state === PipelineState.APPROVED)?.count ?? 0,
    rejected: counts.find(c => c.state === PipelineState.REJECTED)?.count ?? 0,
  };
}
