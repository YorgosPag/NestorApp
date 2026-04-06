/**
 * 🏢 ENTERPRISE EMAIL INGESTION QUEUE SERVICE
 *
 * ADR-071: Enterprise Email Webhook Queue System
 *
 * Pattern: "Acknowledge Fast, Process Later"
 * - Fast enqueue for webhook response (<1.5s target)
 * - Background processing with retry logic
 *
 * Attachments: ./email-queue-attachments.ts
 * Worker operations: ./email-queue-worker.ts
 *
 * @module services/communications/inbound/email-queue-service
 */

import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/server/admin/admin-guards';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { QUEUE_STATUS } from '@/constants/entity-status-values';
import {
  EMAIL_QUEUE_CONFIG,
  type EmailIngestionQueueItem,
  type EmailIngestionQueueStats,
  type EmailIngestionQueueStatus,
  type EmailProvider,
} from '@/types/email-ingestion-queue';
import { resolveCompanyIdFromRecipients } from './email-inbound-service';
import type { InboundEmailAttachment, MailgunStorageInfo } from './types';
import { serializeAttachments } from './email-queue-attachments';

// Re-export worker functions for consumers
export {
  claimNextQueueItems,
  claimRetryableItems,
  processQueueItem,
  markQueueItemCompleted,
  markQueueItemFailed,
  recoverStaleItems,
} from './email-queue-worker';

const logger = createModuleLogger('EMAIL_QUEUE_SERVICE');

// ============================================================================
// ENQUEUE FUNCTION (Fast Path - Used by Webhook)
// ============================================================================

/**
 * Enqueue inbound email for background processing.
 * FAST PATH: Target <1.5s for webhook response.
 */
export async function enqueueInboundEmail(params: {
  provider: EmailProvider;
  providerMessageId: string;
  sender: { email: string; name?: string };
  recipients: string[];
  subject: string;
  contentText: string;
  contentHtml?: string;
  emailReceivedAt?: string;
  attachments?: InboundEmailAttachment[];
  rawMetadata?: Record<string, unknown>;
  mailgunStorage?: MailgunStorageInfo;
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

    // Step 2: Deterministic document ID for idempotent dedup (ADR-253-RC-12)
    const deterministicId = `eq_${params.provider}_${params.providerMessageId}`;
    const docRef = queueCollection.doc(deterministicId);

    const existingDoc = await docRef.get();
    if (existingDoc.exists) {
      logger.info('Duplicate email detected, skipping queue', {
        providerMessageId: params.providerMessageId,
        existingQueueId: deterministicId,
      });
      return { queueId: deterministicId, status: 'duplicate' };
    }

    // Step 3: Serialize attachments
    const serializedAttachments = await serializeAttachments(params.attachments, params.mailgunStorage);

    // Step 4: Create queue item
    const queueItem: Omit<EmailIngestionQueueItem, 'id'> = {
      providerMessageId: params.providerMessageId,
      status: QUEUE_STATUS.PENDING,
      routingResolution: {
        companyId: routing.companyId,
        matchedPattern: routing.matchedPattern,
      },
      provider: params.provider,
      sender: params.sender,
      recipients: params.recipients,
      subject: params.subject,
      contentText: params.contentText,
      ...(params.contentHtml && { contentHtml: params.contentHtml }),
      attachments: serializedAttachments,
      rawMetadata: params.rawMetadata,
      retryCount: 0,
      maxRetries: EMAIL_QUEUE_CONFIG.MAX_RETRIES,
      createdAt: new Date(),
      emailReceivedAt: params.emailReceivedAt,
    };

    await docRef.set(queueItem);

    const elapsed = Date.now() - startTime;
    const exceededSLA = elapsed > 1000;

    logger.info('Email queued successfully', {
      queueId: deterministicId,
      provider: params.provider,
      companyId: routing.companyId,
      attachmentCount: serializedAttachments.length,
      elapsedMs: elapsed,
      slaCompliant: !exceededSLA,
      metrics: {
        enqueueDuration: elapsed,
        attachmentMode: serializedAttachments.length > 0 ? serializedAttachments[0].mode : null,
        deferredCount: serializedAttachments.filter(a => a.mode === 'deferred').length,
      },
    });

    if (exceededSLA) {
      logger.warn('Webhook SLA exceeded - performance degradation detected', {
        queueId: deterministicId,
        targetMs: 1000,
        actualMs: elapsed,
        exceedanceMs: elapsed - 1000,
      });
    }

    return { queueId: deterministicId, status: 'queued' };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error('Failed to enqueue email', {
      provider: params.provider,
      providerMessageId: params.providerMessageId,
      error: getErrorMessage(error),
      elapsedMs: elapsed,
    });
    return { queueId: null, status: 'error' };
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
    QUEUE_STATUS.PENDING,
    QUEUE_STATUS.PROCESSING,
    QUEUE_STATUS.COMPLETED,
    QUEUE_STATUS.FAILED,
    QUEUE_STATUS.DEAD_LETTER,
  ];

  const byStatus: Record<EmailIngestionQueueStatus, number> = {
    [QUEUE_STATUS.PENDING]: 0,
    [QUEUE_STATUS.PROCESSING]: 0,
    [QUEUE_STATUS.COMPLETED]: 0,
    [QUEUE_STATUS.FAILED]: 0,
    [QUEUE_STATUS.DEAD_LETTER]: 0,
  };

  await Promise.all(
    statuses.map(async (status) => {
      const snapshot = await queueCollection.where(FIELDS.STATUS, '==', status).count().get();
      byStatus[status] = snapshot.data().count;
    })
  );

  const oldestPendingQuery = await queueCollection
    .where(FIELDS.STATUS, '==', QUEUE_STATUS.PENDING)
    .orderBy(FIELDS.CREATED_AT, 'asc')
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
    const ageMinutes = Math.round(stats.oldestPendingAgeMs / 60000);
    warnings.push(`Oldest pending item is ${ageMinutes} minutes old`);
  }

  return {
    healthy: warnings.length === 0,
    warnings,
    stats,
  };
}
