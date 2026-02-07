/**
 * =============================================================================
 * AI PIPELINE QUEUE SERVICE
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Firestore-backed queue for pipeline processing items.
 * Same lifecycle pattern as email-queue-service.ts (proven in production).
 *
 * @module services/ai-pipeline/pipeline-queue-service
 * @see ADR-080 (Pipeline Implementation)
 * @see docs/centralized-systems/ai/reliability.md (Queue, Retries, DLQ)
 *
 * LIFECYCLE:
 *   pending → processing → completed
 *          ↘ failed → processing (retry) → completed/dead_letter
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { PIPELINE_QUEUE_CONFIG, PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  PipelineQueueItem,
  PipelineQueueStatus,
  PipelineContext,
  IntakeMessage,
  PipelineChannelValue,
  PipelineStateValue,
  ApprovalDecision,
} from '@/types/ai-pipeline';
import { PipelineState } from '@/types/ai-pipeline';

// ============================================================================
// HELPER: GENERATE REQUEST ID
// ============================================================================

/**
 * Generate unique correlation ID for pipeline tracing
 * Format: req_{timestamp}_{random}
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${PIPELINE_PROTOCOL_CONFIG.REQUEST_ID_PREFIX}_${timestamp}_${random}`;
}

// ============================================================================
// ENQUEUE
// ============================================================================

/**
 * Parameters for enqueueing a new pipeline item
 */
export interface EnqueuePipelineParams {
  companyId: string;
  channel: PipelineChannelValue;
  intakeMessage: IntakeMessage;
}

/**
 * Enqueue a new item to the AI pipeline queue
 *
 * @param params - Enqueue parameters
 * @returns Queue item ID and request ID
 */
export async function enqueuePipelineItem(
  params: EnqueuePipelineParams
): Promise<{ queueId: string; requestId: string }> {
  const adminDb = getAdminFirestore();
  const requestId = generateRequestId();
  const now = new Date().toISOString();

  const context: PipelineContext = {
    requestId,
    companyId: params.companyId,
    state: PipelineState.RECEIVED,
    intake: params.intakeMessage,
    startedAt: now,
    stepDurations: {},
    errors: [],
  };

  const queueItem: Omit<PipelineQueueItem, 'id'> = {
    requestId,
    companyId: params.companyId,
    channel: params.channel,
    intakeMessageId: params.intakeMessage.id,
    status: 'pending',
    pipelineState: PipelineState.RECEIVED,
    context,
    retryCount: 0,
    maxRetries: PIPELINE_QUEUE_CONFIG.MAX_RETRIES,
    createdAt: now,
  };

  const docRef = await adminDb
    .collection(COLLECTIONS.AI_PIPELINE_QUEUE)
    .add(queueItem);

  return { queueId: docRef.id, requestId };
}

// ============================================================================
// CLAIM ITEMS
// ============================================================================

/**
 * Claim the next batch of pending pipeline items for processing.
 * Uses Firestore transaction for atomic claiming.
 *
 * @param batchSize - Maximum items to claim
 * @returns Array of claimed queue items
 */
export async function claimNextPipelineItems(
  batchSize: number = PIPELINE_QUEUE_CONFIG.BATCH_SIZE
): Promise<PipelineQueueItem[]> {
  const adminDb = getAdminFirestore();
  const collectionRef = adminDb.collection(COLLECTIONS.AI_PIPELINE_QUEUE);

  // Query pending items ordered by creation time (FIFO)
  const pendingSnapshot = await collectionRef
    .where('status', '==', 'pending' satisfies PipelineQueueStatus)
    .orderBy('createdAt', 'asc')
    .limit(batchSize)
    .get();

  if (pendingSnapshot.empty) return [];

  const claimed: PipelineQueueItem[] = [];
  const now = new Date().toISOString();

  // Claim each item atomically
  for (const doc of pendingSnapshot.docs) {
    try {
      await adminDb.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(doc.ref);
        const data = freshDoc.data();

        // Re-check status inside transaction (optimistic concurrency)
        if (!freshDoc.exists || data?.status !== 'pending') {
          return; // Already claimed by another worker
        }

        transaction.update(doc.ref, {
          status: 'processing' satisfies PipelineQueueStatus,
          processingStartedAt: now,
        });
      });

      const updatedDoc = await doc.ref.get();
      const data = updatedDoc.data();
      if (data && data.status === 'processing') {
        claimed.push({ id: doc.id, ...data } as PipelineQueueItem);
      }
    } catch {
      // Transaction failed — item may have been claimed by another worker
      continue;
    }
  }

  return claimed;
}

// ============================================================================
// CLAIM RETRYABLE ITEMS
// ============================================================================

/**
 * Claim failed items that are eligible for retry
 *
 * @param batchSize - Maximum items to claim
 * @returns Array of retryable items claimed for processing
 */
export async function claimRetryablePipelineItems(
  batchSize: number = PIPELINE_QUEUE_CONFIG.BATCH_SIZE
): Promise<PipelineQueueItem[]> {
  const adminDb = getAdminFirestore();
  const collectionRef = adminDb.collection(COLLECTIONS.AI_PIPELINE_QUEUE);

  const failedSnapshot = await collectionRef
    .where('status', '==', 'failed' satisfies PipelineQueueStatus)
    .orderBy('createdAt', 'asc')
    .limit(batchSize)
    .get();

  if (failedSnapshot.empty) return [];

  const claimed: PipelineQueueItem[] = [];
  const now = new Date().toISOString();

  for (const doc of failedSnapshot.docs) {
    try {
      await adminDb.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(doc.ref);
        const data = freshDoc.data();

        if (!freshDoc.exists || data?.status !== 'failed') return;

        // Check retry eligibility
        if ((data.retryCount ?? 0) >= (data.maxRetries ?? PIPELINE_QUEUE_CONFIG.MAX_RETRIES)) {
          // Move to dead letter
          transaction.update(doc.ref, {
            status: 'dead_letter' satisfies PipelineQueueStatus,
          });
          return;
        }

        transaction.update(doc.ref, {
          status: 'processing' satisfies PipelineQueueStatus,
          processingStartedAt: now,
          retryCount: FieldValue.increment(1),
        });
      });

      const updatedDoc = await doc.ref.get();
      const data = updatedDoc.data();
      if (data && data.status === 'processing') {
        claimed.push({ id: doc.id, ...data } as PipelineQueueItem);
      }
    } catch {
      continue;
    }
  }

  return claimed;
}

// ============================================================================
// MARK COMPLETED
// ============================================================================

/**
 * Mark a queue item as completed with final context
 *
 * @param queueId - Firestore document ID
 * @param finalContext - Final pipeline context after execution
 */
export async function markPipelineItemCompleted(
  queueId: string,
  finalContext: PipelineContext
): Promise<void> {
  const adminDb = getAdminFirestore();

  await adminDb
    .collection(COLLECTIONS.AI_PIPELINE_QUEUE)
    .doc(queueId)
    .update({
      status: 'completed' satisfies PipelineQueueStatus,
      pipelineState: finalContext.state,
      context: finalContext,
      completedAt: new Date().toISOString(),
    });
}

// ============================================================================
// MARK FAILED
// ============================================================================

/**
 * Mark a queue item as failed with error information
 *
 * @param queueId - Firestore document ID
 * @param error - Error message
 * @param step - Pipeline step where failure occurred
 * @param context - Current pipeline context at time of failure
 */
export async function markPipelineItemFailed(
  queueId: string,
  error: string,
  step: string,
  context?: PipelineContext
): Promise<void> {
  const adminDb = getAdminFirestore();
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    status: 'failed' satisfies PipelineQueueStatus,
    lastError: { message: error, step, occurredAt: now },
  };

  if (context) {
    updateData.pipelineState = context.state;
    updateData.context = context;
  }

  // Add to retry history
  updateData[`retryHistory`] = FieldValue.arrayUnion({
    attemptedAt: now,
    error,
    step,
  });

  await adminDb
    .collection(COLLECTIONS.AI_PIPELINE_QUEUE)
    .doc(queueId)
    .update(updateData);
}

// ============================================================================
// RECOVER STALE ITEMS
// ============================================================================

/**
 * Recover items stuck in 'processing' state beyond the stale threshold.
 * Resets them to 'failed' so they can be retried.
 *
 * @returns Number of recovered items
 */
export async function recoverStalePipelineItems(): Promise<number> {
  const adminDb = getAdminFirestore();
  const threshold = new Date(
    Date.now() - PIPELINE_QUEUE_CONFIG.STALE_PROCESSING_THRESHOLD_MS
  ).toISOString();

  const staleSnapshot = await adminDb
    .collection(COLLECTIONS.AI_PIPELINE_QUEUE)
    .where('status', '==', 'processing' satisfies PipelineQueueStatus)
    .where('processingStartedAt', '<', threshold)
    .get();

  if (staleSnapshot.empty) return 0;

  let recovered = 0;
  for (const doc of staleSnapshot.docs) {
    await doc.ref.update({
      status: 'failed' satisfies PipelineQueueStatus,
      lastError: {
        message: 'Stale processing recovery — item exceeded processing timeout',
        step: 'recovery',
        occurredAt: new Date().toISOString(),
      },
    });
    recovered++;
  }

  return recovered;
}

// ============================================================================
// QUEUE STATISTICS
// ============================================================================

/**
 * Queue health statistics
 */
export interface PipelineQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  total: number;
}

/**
 * Get pipeline queue statistics for monitoring
 *
 * @returns Count of items per status
 */
export async function getPipelineQueueStats(): Promise<PipelineQueueStats> {
  const adminDb = getAdminFirestore();
  const collectionRef = adminDb.collection(COLLECTIONS.AI_PIPELINE_QUEUE);

  const statuses: PipelineQueueStatus[] = [
    'pending', 'processing', 'completed', 'failed', 'dead_letter',
  ];

  const counts = await Promise.all(
    statuses.map(async (status) => {
      const snapshot = await collectionRef
        .where('status', '==', status)
        .count()
        .get();
      return { status, count: snapshot.data().count };
    })
  );

  const stats: PipelineQueueStats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
    total: 0,
  };

  for (const { status, count } of counts) {
    switch (status) {
      case 'pending': stats.pending = count; break;
      case 'processing': stats.processing = count; break;
      case 'completed': stats.completed = count; break;
      case 'failed': stats.failed = count; break;
      case 'dead_letter': stats.deadLetter = count; break;
    }
    stats.total += count;
  }

  return stats;
}

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
    ref = ref.where('companyId', '==', query.companyId);
  }

  ref = ref.orderBy('createdAt', 'desc').limit(query.limit ?? 50);

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

    // Determine new pipeline state based on decision
    const newPipelineState: PipelineStateValue =
      approval.decision === 'rejected'
        ? PipelineState.REJECTED
        : PipelineState.APPROVED; // 'approved' or 'modified' both → APPROVED first

    // Update context with approval decision
    const updatedContext: PipelineContext = {
      ...item.context,
      state: newPipelineState,
      approval,
    };

    const updatePayload: Record<string, unknown> = {
      pipelineState: newPipelineState,
      context: updatedContext,
    };

    // For approved items, reset queue status to 'processing' to signal resume
    if (approval.decision !== 'rejected') {
      updatePayload.status = 'processing' satisfies PipelineQueueStatus;
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
 * Used by the Operator Inbox dashboard to show summary stats.
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
        ref = ref.where('companyId', '==', companyId);
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
