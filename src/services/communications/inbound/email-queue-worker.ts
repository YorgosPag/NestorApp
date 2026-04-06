/**
 * 🏢 EMAIL QUEUE WORKER OPERATIONS
 *
 * Claim, process, status update, and stale recovery for email ingestion queue.
 * This is the SLOW PATH — background processing with AI analysis.
 *
 * Extracted from email-queue-service.ts (ADR-065 SRP split).
 *
 * @module services/communications/inbound/email-queue-worker
 */

import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/server/admin/admin-guards';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { QUEUE_STATUS } from '@/constants/entity-status-values';
import {
  EMAIL_QUEUE_CONFIG,
  getRetryDelayMs,
  type EmailIngestionQueueItem,
  type EmailIngestionQueueStatus,
} from '@/types/email-ingestion-queue';
import { processInboundEmail } from './email-inbound-service';
import { deserializeAttachment } from './email-queue-attachments';
import { FieldValue } from 'firebase-admin/firestore';

const logger = createModuleLogger('EMAIL_QUEUE_WORKER');

// ============================================================================
// CLAIM FUNCTIONS
// ============================================================================

/**
 * Claim next pending queue items for processing.
 * Uses atomic transactions to prevent race conditions between workers.
 */
export async function claimNextQueueItems(
  batchSize: number = EMAIL_QUEUE_CONFIG.BATCH_SIZE
): Promise<EmailIngestionQueueItem[]> {
  const adminDb = getAdminFirestore();
  const queueCollection = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE);

  try {
    const pendingQuery = await queueCollection
      .where(FIELDS.STATUS, '==', QUEUE_STATUS.PENDING)
      .orderBy(FIELDS.CREATED_AT, 'asc')
      .limit(batchSize)
      .get();

    if (pendingQuery.empty) {
      return [];
    }

    const claimedItems: EmailIngestionQueueItem[] = [];
    const now = new Date();

    for (const doc of pendingQuery.docs) {
      const docRef = queueCollection.doc(doc.id);

      const claimed = await adminDb.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(docRef);
        const data = freshDoc.data();

        if (!data || data.status !== QUEUE_STATUS.PENDING) {
          return null;
        }

        transaction.update(docRef, {
          status: QUEUE_STATUS.PROCESSING,
          processingStartedAt: now,
        });

        return {
          id: doc.id,
          ...data,
          status: QUEUE_STATUS.PROCESSING,
          processingStartedAt: now,
        } as EmailIngestionQueueItem;
      });

      if (claimed) {
        claimedItems.push(claimed);
      }
    }

    if (claimedItems.length > 0) {
      logger.info('Claimed queue items for processing', {
        claimedCount: claimedItems.length,
        queueIds: claimedItems.map((item) => item.id),
      });
    }

    return claimedItems;
  } catch (error) {
    logger.error('Error claiming queue items', {
      error: getErrorMessage(error),
    });
    return [];
  }
}

/**
 * Claim failed items that are ready for retry.
 * Items eligible when: status=failed, retryCount < maxRetries, delay elapsed.
 */
export async function claimRetryableItems(
  batchSize: number = EMAIL_QUEUE_CONFIG.BATCH_SIZE
): Promise<EmailIngestionQueueItem[]> {
  const adminDb = getAdminFirestore();
  const queueCollection = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE);

  try {
    const failedQuery = await queueCollection
      .where(FIELDS.STATUS, '==', QUEUE_STATUS.FAILED)
      .orderBy(FIELDS.CREATED_AT, 'asc')
      .limit(batchSize * 2)
      .get();

    if (failedQuery.empty) {
      return [];
    }

    const claimedItems: EmailIngestionQueueItem[] = [];
    const now = new Date();

    for (const doc of failedQuery.docs) {
      if (claimedItems.length >= batchSize) break;

      const data = doc.data();

      if (data.retryCount >= data.maxRetries) {
        continue;
      }

      const retryDelay = getRetryDelayMs(data.retryCount);
      const lastErrorTime = data.lastError?.occurredAt?.toDate?.() || data.createdAt.toDate();
      const eligibleTime = new Date(lastErrorTime.getTime() + retryDelay);

      if (now < eligibleTime) {
        continue;
      }

      const docRef = queueCollection.doc(doc.id);

      const claimed = await adminDb.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(docRef);
        const freshData = freshDoc.data();

        if (!freshData || freshData.status !== QUEUE_STATUS.FAILED) {
          return null;
        }

        transaction.update(docRef, {
          status: QUEUE_STATUS.PROCESSING,
          processingStartedAt: now,
          retryCount: FieldValue.increment(1),
        });

        return {
          id: doc.id,
          ...freshData,
          status: QUEUE_STATUS.PROCESSING,
          processingStartedAt: now,
          retryCount: freshData.retryCount + 1,
        } as EmailIngestionQueueItem;
      });

      if (claimed) {
        claimedItems.push(claimed);
      }
    }

    if (claimedItems.length > 0) {
      logger.info('Claimed retryable items', {
        claimedCount: claimedItems.length,
        queueIds: claimedItems.map((item) => item.id),
      });
    }

    return claimedItems;
  } catch (error) {
    logger.error('Error claiming retryable items', {
      error: getErrorMessage(error),
    });
    return [];
  }
}

// ============================================================================
// PROCESS FUNCTION
// ============================================================================

/**
 * Process a single queue item — full email processing with AI analysis.
 */
export async function processQueueItem(item: EmailIngestionQueueItem): Promise<{
  success: boolean;
  communicationId?: string;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    logger.info('Processing queue item', {
      queueId: item.id,
      provider: item.provider,
      companyId: item.routingResolution.companyId,
      retryCount: item.retryCount,
    });

    const attachments = item.attachments.map(deserializeAttachment);

    const result = await processInboundEmail({
      provider: item.provider,
      providerMessageId: item.providerMessageId,
      sender: item.sender,
      recipients: item.recipients,
      subject: item.subject,
      contentText: item.contentText,
      contentHtml: item.contentHtml,
      receivedAt: item.emailReceivedAt,
      attachments,
      raw: item.rawMetadata,
    });

    const elapsed = Date.now() - startTime;

    if (result.processed) {
      logger.info('Queue item processed successfully', {
        queueId: item.id,
        communicationId: result.communicationId,
        elapsedMs: elapsed,
      });

      if (result.communicationId && item.routingResolution.companyId) {
        try {
          const { EmailChannelAdapter } = await import('@/services/ai-pipeline/channel-adapters/email-channel-adapter');
          const pipelineResult = await EmailChannelAdapter.feedToPipeline({
            queueItem: item,
            communicationId: result.communicationId,
            companyId: item.routingResolution.companyId,
          });

          if (pipelineResult.enqueued) {
            logger.info('Email fed to AI pipeline', {
              queueId: item.id,
              pipelineQueueId: pipelineResult.pipelineQueueId,
              requestId: pipelineResult.requestId,
            });
          }
        } catch (pipelineError) {
          logger.warn('Failed to enqueue to AI pipeline (non-blocking)', {
            queueId: item.id,
            error: getErrorMessage(pipelineError),
          });
        }
      }

      return { success: true, communicationId: result.communicationId };
    }

    logger.info('Queue item skipped (not processed)', {
      queueId: item.id,
      reason: result.reason,
      elapsedMs: elapsed,
    });

    return { success: true };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);

    logger.error('Error processing queue item', {
      queueId: item.id,
      error: errorMessage,
      elapsedMs: elapsed,
    });

    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// STATUS UPDATE FUNCTIONS
// ============================================================================

/**
 * Mark queue item as completed
 */
export async function markQueueItemCompleted(
  queueId: string,
  result: {
    communicationId?: string;
    contactId?: string;
    attachmentCount?: number;
  }
): Promise<void> {
  const adminDb = getAdminFirestore();
  const docRef = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE).doc(queueId);

  await docRef.update({
    status: QUEUE_STATUS.COMPLETED,
    completedAt: new Date(),
    result,
  });

  logger.info('Queue item marked as completed', { queueId, result });
}

/**
 * Mark queue item as failed. Moves to dead_letter if max retries exceeded.
 */
export async function markQueueItemFailed(
  queueId: string,
  error: { message: string; code?: string }
): Promise<void> {
  const adminDb = getAdminFirestore();
  const docRef = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE).doc(queueId);

  await adminDb.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const data = doc.data();

    if (!data) {
      logger.warn('Queue item not found for failure update', { queueId });
      return;
    }

    const currentRetryCount = data.retryCount || 0;
    const maxRetries = data.maxRetries || EMAIL_QUEUE_CONFIG.MAX_RETRIES;
    const now = new Date();

    const newStatus: EmailIngestionQueueStatus =
      currentRetryCount >= maxRetries ? QUEUE_STATUS.DEAD_LETTER : QUEUE_STATUS.FAILED;

    const retryHistoryEntry = {
      attemptedAt: now,
      error: error.message,
    };

    transaction.update(docRef, {
      status: newStatus,
      lastError: {
        message: error.message,
        code: error.code,
        occurredAt: now,
      },
      retryHistory: FieldValue.arrayUnion(retryHistoryEntry),
      ...(newStatus === QUEUE_STATUS.DEAD_LETTER ? { completedAt: now } : {}),
    });

    logger.warn('Queue item marked as failed', {
      queueId,
      newStatus,
      retryCount: currentRetryCount,
      maxRetries,
      error: error.message,
    });
  });
}

// ============================================================================
// STALE ITEM RECOVERY
// ============================================================================

/**
 * Recover stale items stuck in 'processing' status (worker crash).
 */
export async function recoverStaleItems(): Promise<number> {
  const adminDb = getAdminFirestore();
  const queueCollection = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE);

  const threshold = new Date(Date.now() - EMAIL_QUEUE_CONFIG.STALE_PROCESSING_THRESHOLD_MS);

  try {
    const staleQuery = await queueCollection
      .where(FIELDS.STATUS, '==', QUEUE_STATUS.PROCESSING)
      .where('processingStartedAt', '<', threshold)
      .limit(50)
      .get();

    if (staleQuery.empty) {
      return 0;
    }

    let recoveredCount = 0;

    for (const doc of staleQuery.docs) {
      await doc.ref.update({
        status: QUEUE_STATUS.FAILED,
        lastError: {
          message: 'Processing timeout - worker may have crashed',
          code: 'STALE_PROCESSING',
          occurredAt: new Date(),
        },
      });
      recoveredCount++;
    }

    if (recoveredCount > 0) {
      logger.warn('Recovered stale queue items', { recoveredCount });
    }

    return recoveredCount;
  } catch (error) {
    logger.error('Error recovering stale items', {
      error: getErrorMessage(error),
    });
    return 0;
  }
}
