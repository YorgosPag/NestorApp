/**
 * 🏢 ENTERPRISE EMAIL INGESTION QUEUE SERVICE
 *
 * ADR-071: Enterprise Email Webhook Queue System
 *
 * Pattern: "Acknowledge Fast, Process Later"
 * - Fast enqueue for webhook response (<1.5s target)
 * - Background processing with retry logic
 * - Exponential backoff for failures
 * - Dead letter queue for unrecoverable items
 *
 * @module services/communications/inbound/email-queue-service
 */

import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getAdminFirestore } from '@/server/admin/admin-guards';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  EMAIL_QUEUE_CONFIG,
  getRetryDelayMs,
  shouldMoveToDeadLetter,
  type EmailIngestionQueueItem,
  type EmailIngestionQueueInput,
  type EmailIngestionQueueStats,
  type EmailIngestionQueueStatus,
  type SerializedAttachment,
} from '@/types/email-ingestion-queue';
import { processInboundEmail, resolveCompanyIdFromRecipients } from './email-inbound-service';
import type { InboundEmailAttachment, InboundAttachmentDownload } from './types';
import { FieldValue } from 'firebase-admin/firestore';

const logger = createModuleLogger('EMAIL_QUEUE_SERVICE');

// ============================================================================
// ENQUEUE FUNCTIONS (Fast Path - Used by Webhook)
// ============================================================================

/**
 * Serialize attachment to base64 for queue storage
 *
 * @param attachment - Original attachment with download function
 * @returns Serialized attachment or null if failed/too large
 */
async function serializeAttachment(
  attachment: InboundEmailAttachment
): Promise<SerializedAttachment | null> {
  try {
    // Check size limit before downloading
    if (
      attachment.sizeBytes &&
      attachment.sizeBytes > EMAIL_QUEUE_CONFIG.MAX_ATTACHMENT_SIZE_BYTES
    ) {
      logger.warn('Attachment exceeds max size for queue, skipping', {
        filename: attachment.filename,
        sizeBytes: attachment.sizeBytes,
        maxSize: EMAIL_QUEUE_CONFIG.MAX_ATTACHMENT_SIZE_BYTES,
      });
      return null;
    }

    const downloadResult = await attachment.download();
    if (!downloadResult) {
      logger.warn('Failed to download attachment for serialization', {
        filename: attachment.filename,
      });
      return null;
    }

    // Double-check size after download
    if (downloadResult.buffer.length > EMAIL_QUEUE_CONFIG.MAX_ATTACHMENT_SIZE_BYTES) {
      logger.warn('Downloaded attachment exceeds max size, skipping', {
        filename: attachment.filename,
        downloadedSize: downloadResult.buffer.length,
      });
      return null;
    }

    return {
      filename: attachment.filename,
      contentType: attachment.contentType || downloadResult.contentType,
      sizeBytes: downloadResult.buffer.length,
      base64Content: downloadResult.buffer.toString('base64'),
    };
  } catch (error) {
    logger.error('Error serializing attachment', {
      filename: attachment.filename,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Serialize all attachments for queue storage
 *
 * @param attachments - Original attachments from webhook
 * @returns Array of serialized attachments (skips failures)
 */
async function serializeAttachments(
  attachments: InboundEmailAttachment[] | undefined
): Promise<SerializedAttachment[]> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const serialized: SerializedAttachment[] = [];
  let totalSize = 0;

  for (const attachment of attachments) {
    const result = await serializeAttachment(attachment);
    if (result) {
      // Check total size limit
      if (totalSize + result.sizeBytes > EMAIL_QUEUE_CONFIG.MAX_TOTAL_ATTACHMENTS_SIZE_BYTES) {
        logger.warn('Total attachments size exceeded, skipping remaining', {
          currentTotal: totalSize,
          maxTotal: EMAIL_QUEUE_CONFIG.MAX_TOTAL_ATTACHMENTS_SIZE_BYTES,
          skippedFilename: result.filename,
        });
        break;
      }
      serialized.push(result);
      totalSize += result.sizeBytes;
    }
  }

  return serialized;
}

/**
 * Enqueue inbound email for background processing
 *
 * This is the FAST PATH function called by webhook handlers.
 * Target: Complete in <1.5 seconds to meet webhook timeout requirements.
 *
 * @param input - Email data to queue
 * @returns Queue item ID or null if failed
 */
export async function enqueueInboundEmail(params: {
  provider: 'mailgun' | 'brevo' | 'sendgrid';
  providerMessageId: string;
  sender: { email: string; name?: string };
  recipients: string[];
  subject: string;
  contentText: string;
  emailReceivedAt?: string;
  attachments?: InboundEmailAttachment[];
  rawMetadata?: Record<string, unknown>;
}): Promise<{ queueId: string | null; status: 'queued' | 'duplicate' | 'routing_failed' | 'error' }> {
  const startTime = Date.now();

  try {
    // Step 1: Resolve routing (fast - single Firestore read)
    const routing = await resolveCompanyIdFromRecipients(params.recipients);
    if (!routing.companyId) {
      logger.warn('No routing match for inbound email, cannot queue', {
        recipients: params.recipients,
        provider: params.provider,
      });
      return { queueId: null, status: 'routing_failed' };
    }

    const adminDb = getAdminFirestore();
    const queueCollection = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE);

    // Step 2: Check for duplicate (idempotency)
    const duplicateCheck = await queueCollection
      .where('providerMessageId', '==', params.providerMessageId)
      .where('provider', '==', params.provider)
      .limit(1)
      .get();

    if (!duplicateCheck.empty) {
      logger.info('Duplicate email detected, skipping queue', {
        providerMessageId: params.providerMessageId,
        existingQueueId: duplicateCheck.docs[0].id,
      });
      return { queueId: duplicateCheck.docs[0].id, status: 'duplicate' };
    }

    // Step 3: Serialize attachments (parallel downloads)
    const serializedAttachments = await serializeAttachments(params.attachments);

    // Step 4: Create queue item
    const queueItem: Omit<EmailIngestionQueueItem, 'id'> = {
      providerMessageId: params.providerMessageId,
      status: 'pending',
      routingResolution: {
        companyId: routing.companyId,
        matchedPattern: routing.matchedPattern,
      },
      provider: params.provider,
      sender: params.sender,
      recipients: params.recipients,
      subject: params.subject,
      contentText: params.contentText,
      attachments: serializedAttachments,
      rawMetadata: params.rawMetadata,
      retryCount: 0,
      maxRetries: EMAIL_QUEUE_CONFIG.MAX_RETRIES,
      createdAt: new Date(),
      emailReceivedAt: params.emailReceivedAt,
    };

    const docRef = await queueCollection.add(queueItem);

    const elapsed = Date.now() - startTime;
    logger.info('Email queued successfully', {
      queueId: docRef.id,
      provider: params.provider,
      companyId: routing.companyId,
      attachmentCount: serializedAttachments.length,
      elapsedMs: elapsed,
    });

    return { queueId: docRef.id, status: 'queued' };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error('Failed to enqueue email', {
      provider: params.provider,
      providerMessageId: params.providerMessageId,
      error: error instanceof Error ? error.message : 'Unknown error',
      elapsedMs: elapsed,
    });
    return { queueId: null, status: 'error' };
  }
}

// ============================================================================
// CLAIM & PROCESS FUNCTIONS (Worker Path)
// ============================================================================

/**
 * Convert serialized attachment back to InboundEmailAttachment
 *
 * Creates a download function that returns the pre-loaded buffer
 */
function deserializeAttachment(serialized: SerializedAttachment): InboundEmailAttachment {
  return {
    filename: serialized.filename,
    contentType: serialized.contentType,
    sizeBytes: serialized.sizeBytes,
    download: async (): Promise<InboundAttachmentDownload> => ({
      buffer: Buffer.from(serialized.base64Content, 'base64'),
      contentType: serialized.contentType,
    }),
  };
}

/**
 * Claim next pending queue items for processing
 *
 * Uses atomic update to prevent race conditions between workers.
 * Items are marked as 'processing' and given a processing start time.
 *
 * @param batchSize - Maximum items to claim (default from config)
 * @returns Claimed queue items
 */
export async function claimNextQueueItems(
  batchSize: number = EMAIL_QUEUE_CONFIG.BATCH_SIZE
): Promise<EmailIngestionQueueItem[]> {
  const adminDb = getAdminFirestore();
  const queueCollection = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE);

  try {
    // Query for pending items, oldest first
    const pendingQuery = await queueCollection
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(batchSize)
      .get();

    if (pendingQuery.empty) {
      return [];
    }

    const claimedItems: EmailIngestionQueueItem[] = [];
    const now = new Date();

    // Claim each item with atomic update
    for (const doc of pendingQuery.docs) {
      const docRef = queueCollection.doc(doc.id);

      // Use transaction to ensure atomic claim
      const claimed = await adminDb.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(docRef);
        const data = freshDoc.data();

        // Double-check status in case another worker claimed it
        if (!data || data.status !== 'pending') {
          return null;
        }

        // Claim the item
        transaction.update(docRef, {
          status: 'processing',
          processingStartedAt: now,
        });

        return {
          id: doc.id,
          ...data,
          status: 'processing' as const,
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Also claim failed items that are ready for retry
 *
 * Items are eligible for retry when:
 * - status === 'failed'
 * - retryCount < maxRetries
 * - Time since lastError >= getRetryDelayMs(retryCount)
 */
export async function claimRetryableItems(
  batchSize: number = EMAIL_QUEUE_CONFIG.BATCH_SIZE
): Promise<EmailIngestionQueueItem[]> {
  const adminDb = getAdminFirestore();
  const queueCollection = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE);

  try {
    // Query for failed items
    const failedQuery = await queueCollection
      .where('status', '==', 'failed')
      .orderBy('createdAt', 'asc')
      .limit(batchSize * 2) // Get more to filter by retry eligibility
      .get();

    if (failedQuery.empty) {
      return [];
    }

    const claimedItems: EmailIngestionQueueItem[] = [];
    const now = new Date();

    for (const doc of failedQuery.docs) {
      if (claimedItems.length >= batchSize) break;

      const data = doc.data();

      // Check if eligible for retry
      if (data.retryCount >= data.maxRetries) {
        continue; // Should be dead_letter, skip
      }

      const retryDelay = getRetryDelayMs(data.retryCount);
      const lastErrorTime = data.lastError?.occurredAt?.toDate?.() || data.createdAt.toDate();
      const eligibleTime = new Date(lastErrorTime.getTime() + retryDelay);

      if (now < eligibleTime) {
        continue; // Not yet eligible for retry
      }

      const docRef = queueCollection.doc(doc.id);

      // Claim with transaction
      const claimed = await adminDb.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(docRef);
        const freshData = freshDoc.data();

        if (!freshData || freshData.status !== 'failed') {
          return null;
        }

        transaction.update(docRef, {
          status: 'processing',
          processingStartedAt: now,
          retryCount: FieldValue.increment(1),
        });

        return {
          id: doc.id,
          ...freshData,
          status: 'processing' as const,
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Process a single queue item
 *
 * This is the SLOW PATH - full email processing with AI analysis.
 * Called by the background worker.
 *
 * @param item - Queue item to process
 * @returns Processing result
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

    // Convert serialized attachments back to InboundEmailAttachment format
    const attachments = item.attachments.map(deserializeAttachment);

    // Call the full processing function
    const result = await processInboundEmail({
      provider: item.provider,
      providerMessageId: item.providerMessageId,
      sender: item.sender,
      recipients: item.recipients,
      subject: item.subject,
      contentText: item.contentText,
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

      return {
        success: true,
        communicationId: result.communicationId,
      };
    }

    // Processed returned false but not an error (e.g., duplicate detected)
    logger.info('Queue item skipped (not processed)', {
      queueId: item.id,
      reason: result.reason,
      elapsedMs: elapsed,
    });

    return {
      success: true, // Mark as success since it's a valid skip
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Error processing queue item', {
      queueId: item.id,
      error: errorMessage,
      elapsedMs: elapsed,
    });

    return {
      success: false,
      error: errorMessage,
    };
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
    status: 'completed',
    completedAt: new Date(),
    result,
  });

  logger.info('Queue item marked as completed', { queueId, result });
}

/**
 * Mark queue item as failed
 *
 * If max retries exceeded, moves to dead_letter status.
 */
export async function markQueueItemFailed(
  queueId: string,
  error: { message: string; code?: string }
): Promise<void> {
  const adminDb = getAdminFirestore();
  const docRef = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE).doc(queueId);

  // Get current item to check retry count
  const doc = await docRef.get();
  const data = doc.data();

  if (!data) {
    logger.warn('Queue item not found for failure update', { queueId });
    return;
  }

  const currentRetryCount = data.retryCount || 0;
  const maxRetries = data.maxRetries || EMAIL_QUEUE_CONFIG.MAX_RETRIES;
  const now = new Date();

  // Determine new status
  const newStatus: EmailIngestionQueueStatus =
    currentRetryCount >= maxRetries ? 'dead_letter' : 'failed';

  // Build retry history entry
  const retryHistoryEntry = {
    attemptedAt: now,
    error: error.message,
  };

  await docRef.update({
    status: newStatus,
    lastError: {
      message: error.message,
      code: error.code,
      occurredAt: now,
    },
    retryHistory: FieldValue.arrayUnion(retryHistoryEntry),
    ...(newStatus === 'dead_letter' ? { completedAt: now } : {}),
  });

  logger.warn('Queue item marked as failed', {
    queueId,
    newStatus,
    retryCount: currentRetryCount,
    maxRetries,
    error: error.message,
  });
}

// ============================================================================
// STALE ITEM RECOVERY
// ============================================================================

/**
 * Recover stale items that got stuck in 'processing' status
 *
 * This handles cases where a worker crashed during processing.
 * Items stuck in 'processing' longer than STALE_PROCESSING_THRESHOLD_MS
 * are reset to 'failed' for retry.
 */
export async function recoverStaleItems(): Promise<number> {
  const adminDb = getAdminFirestore();
  const queueCollection = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE);

  const threshold = new Date(Date.now() - EMAIL_QUEUE_CONFIG.STALE_PROCESSING_THRESHOLD_MS);

  try {
    const staleQuery = await queueCollection
      .where('status', '==', 'processing')
      .where('processingStartedAt', '<', threshold)
      .limit(50)
      .get();

    if (staleQuery.empty) {
      return 0;
    }

    let recoveredCount = 0;

    for (const doc of staleQuery.docs) {
      await doc.ref.update({
        status: 'failed',
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

// ============================================================================
// STATISTICS & MONITORING
// ============================================================================

/**
 * Get queue statistics for monitoring
 */
export async function getQueueStats(): Promise<EmailIngestionQueueStats> {
  const adminDb = getAdminFirestore();
  const queueCollection = adminDb.collection(COLLECTIONS.EMAIL_INGESTION_QUEUE);

  const statuses: EmailIngestionQueueStatus[] = [
    'pending',
    'processing',
    'completed',
    'failed',
    'dead_letter',
  ];

  const byStatus: Record<EmailIngestionQueueStatus, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    dead_letter: 0,
  };

  // Count items by status
  await Promise.all(
    statuses.map(async (status) => {
      const snapshot = await queueCollection.where('status', '==', status).count().get();
      byStatus[status] = snapshot.data().count;
    })
  );

  // Get oldest pending item
  const oldestPendingQuery = await queueCollection
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get();

  let oldestPendingAgeMs: number | undefined;
  if (!oldestPendingQuery.empty) {
    const oldestCreatedAt = oldestPendingQuery.docs[0].data().createdAt?.toDate?.();
    if (oldestCreatedAt) {
      oldestPendingAgeMs = Date.now() - oldestCreatedAt.getTime();
    }
  }

  return {
    byStatus,
    pendingCount: byStatus.pending,
    processingCount: byStatus.processing,
    failedCount: byStatus.failed,
    deadLetterCount: byStatus.dead_letter,
    oldestPendingAgeMs,
  };
}

/**
 * Get queue health status
 */
export async function getQueueHealth(): Promise<{
  healthy: boolean;
  warnings: string[];
  stats: EmailIngestionQueueStats;
}> {
  const stats = await getQueueStats();
  const warnings: string[] = [];

  // Check for warning conditions
  if (stats.pendingCount > 100) {
    warnings.push(`High pending count: ${stats.pendingCount} items`);
  }

  if (stats.processingCount > EMAIL_QUEUE_CONFIG.BATCH_SIZE * 2) {
    warnings.push(`Many items processing: ${stats.processingCount} items`);
  }

  if (stats.deadLetterCount > 10) {
    warnings.push(`Dead letter items: ${stats.deadLetterCount} items need attention`);
  }

  if (stats.oldestPendingAgeMs && stats.oldestPendingAgeMs > 300000) {
    // 5 minutes
    const ageMinutes = Math.round(stats.oldestPendingAgeMs / 60000);
    warnings.push(`Oldest pending item is ${ageMinutes} minutes old`);
  }

  return {
    healthy: warnings.length === 0,
    warnings,
    stats,
  };
}
