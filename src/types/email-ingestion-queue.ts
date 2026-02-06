/**
 * 🏢 ENTERPRISE EMAIL INGESTION QUEUE TYPES
 *
 * ADR-071: Enterprise Email Webhook Queue System
 *
 * Pattern: "Acknowledge Fast, Process Later"
 * Used by: SAP, Salesforce, Google
 *
 * @module types/email-ingestion-queue
 */

import type { ParsedAddress, InboundAttachmentDownload } from '@/services/communications/inbound/types';

// ============================================================================
// STATUS TYPES
// ============================================================================

/**
 * Queue item status lifecycle:
 * pending -> processing -> completed/failed
 *                     \-> dead_letter (after max retries)
 */
export type EmailIngestionQueueStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'dead_letter';

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type EmailProvider = 'mailgun';

// ============================================================================
// SERIALIZED ATTACHMENT TYPE
// ============================================================================

/**
 * Serialized attachment for queue storage
 * Unlike InboundEmailAttachment, this stores the actual data
 * so it can be processed asynchronously
 *
 * 🏢 ENTERPRISE: Supports two modes:
 * 1. INLINE (small files): base64Content stored directly
 * 2. DEFERRED (large files): storageUrl for later fetch from Mailgun Storage API
 */
export interface SerializedAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number;

  /**
   * Mode: How attachment data is stored
   * - 'inline': base64Content is populated (small files, instant access)
   * - 'deferred': storageUrl is populated (large files, fetch from Mailgun later)
   */
  mode: 'inline' | 'deferred';

  /**
   * Base64-encoded attachment content (mode: 'inline')
   * Only populated for small attachments (< INLINE_THRESHOLD)
   */
  base64Content?: string;

  /**
   * Mailgun Storage URL for deferred download (mode: 'deferred')
   * Worker will fetch from this URL during processing
   * @see https://documentation.mailgun.com/en/latest/api-sending-messages.html#retrieving-stored-messages
   */
  storageUrl?: string;

  /**
   * Mailgun storage key for deferred download
   * Used with Mailgun API authentication
   */
  storageKey?: string;
}

/**
 * 🏢 ENTERPRISE: Attachment mode thresholds
 * Files smaller than INLINE_THRESHOLD are stored as base64 (fast)
 * Files larger are stored as reference (deferred download)
 */
export const ATTACHMENT_MODE_CONFIG = {
  /** Files <= 1MB: Store inline as base64 (fast processing) */
  INLINE_THRESHOLD_BYTES: 1 * 1024 * 1024, // 1MB

  /** Files > 1MB: Store reference, fetch from Mailgun later */
  DEFERRED_THRESHOLD_BYTES: 1 * 1024 * 1024,

  /** Mailgun stores messages for 3 days */
  MAILGUN_STORAGE_RETENTION_HOURS: 72,
} as const;

// ============================================================================
// ROUTING RESOLUTION
// ============================================================================

export interface QueueRoutingResolution {
  companyId: string;
  matchedPattern?: string;
}

// ============================================================================
// QUEUE ITEM TYPES
// ============================================================================

/**
 * Email Ingestion Queue Item
 *
 * Stored in Firestore 'email_ingestion_queue' collection
 */
export interface EmailIngestionQueueItem {
  /** Firestore document ID */
  id: string;

  /** Original provider message ID for deduplication */
  providerMessageId: string;

  /** Current processing status */
  status: EmailIngestionQueueStatus;

  // -------------------- Routing (resolved in fast path) --------------------

  /** Pre-resolved routing information */
  routingResolution: QueueRoutingResolution;

  // -------------------- Raw Email Payload --------------------

  /** Email provider source */
  provider: EmailProvider;

  /** Sender information */
  sender: ParsedAddress;

  /** Recipient email addresses */
  recipients: string[];

  /** Email subject line */
  subject: string;

  /** Plain text content (stripped) - for search/preview/fallback */
  contentText: string;

  /**
   * 🏢 ENTERPRISE: HTML content with formatting (colors, fonts, styles)
   * Follows Gmail/Outlook/Salesforce dual-content pattern
   * @optional Only present if email has HTML content
   */
  contentHtml?: string;

  /** Serialized attachments with base64 content */
  attachments: SerializedAttachment[];

  /** Raw metadata from provider */
  rawMetadata?: Record<string, unknown>;

  // -------------------- Retry Tracking --------------------

  /** Number of processing attempts */
  retryCount: number;

  /** Maximum allowed retries before dead letter */
  maxRetries: number;

  /** Timestamps of each retry attempt */
  retryHistory?: Array<{
    attemptedAt: Date;
    error: string;
  }>;

  // -------------------- Timestamps --------------------

  /** When the queue item was created */
  createdAt: Date;

  /** When processing started (claimed by worker) */
  processingStartedAt?: Date;

  /** When processing completed (success or final failure) */
  completedAt?: Date;

  /** Original email received timestamp from provider */
  emailReceivedAt?: string;

  // -------------------- Processing Result --------------------

  /** Result after successful processing */
  result?: {
    /** Created communication/message document ID */
    communicationId?: string;
    /** Contact ID (found or created) */
    contactId?: string;
    /** Number of attachments processed */
    attachmentCount?: number;
  };

  // -------------------- Error Information --------------------

  /** Last error encountered during processing */
  lastError?: {
    message: string;
    code?: string;
    occurredAt: Date;
  };
}

// ============================================================================
// QUEUE ITEM INPUT (for creation)
// ============================================================================

/**
 * Input for creating a new queue item
 * Used by webhook handler for fast enqueue
 */
export interface EmailIngestionQueueInput {
  provider: EmailProvider;
  providerMessageId: string;
  routingResolution: QueueRoutingResolution;
  sender: ParsedAddress;
  recipients: string[];
  subject: string;
  /** Plain text content (for search/preview/fallback) */
  contentText: string;
  /** 🏢 ENTERPRISE: HTML content with formatting (colors, fonts, styles) */
  contentHtml?: string;
  attachments: SerializedAttachment[];
  emailReceivedAt?: string;
  rawMetadata?: Record<string, unknown>;
}

// ============================================================================
// QUEUE STATISTICS
// ============================================================================

export interface EmailIngestionQueueStats {
  /** Total items in each status */
  byStatus: Record<EmailIngestionQueueStatus, number>;

  /** Items awaiting processing */
  pendingCount: number;

  /** Items currently being processed */
  processingCount: number;

  /** Items that failed and need retry */
  failedCount: number;

  /** Items that exceeded max retries */
  deadLetterCount: number;

  /** Oldest pending item age in milliseconds */
  oldestPendingAgeMs?: number;

  /** Average processing time in milliseconds */
  avgProcessingTimeMs?: number;
}

// ============================================================================
// WORKER TYPES
// ============================================================================

export interface EmailIngestionWorkerConfig {
  /** Maximum items to claim per batch */
  batchSize: number;

  /** Polling interval in milliseconds */
  pollIntervalMs: number;

  /** Maximum concurrent processing */
  maxConcurrency: number;

  /** Processing timeout in milliseconds */
  processingTimeoutMs: number;
}

export interface EmailIngestionWorkerStatus {
  isRunning: boolean;
  lastPollAt?: Date;
  itemsProcessed: number;
  itemsFailed: number;
  currentBatchSize: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Email Queue Configuration Constants
 *
 * These values are tuned for enterprise workloads:
 * - MAX_RETRIES: 3 (industry standard)
 * - RETRY_DELAYS: Exponential backoff (1s, 5s, 30s)
 * - PROCESSING_TIMEOUT: 2 minutes (allows AI analysis)
 * - BATCH_SIZE: 10 (Firestore optimal batch size)
 */
export const EMAIL_QUEUE_CONFIG = {
  /** Firestore collection name */
  COLLECTION_NAME: 'email_ingestion_queue',

  /** Maximum retry attempts before dead letter */
  MAX_RETRIES: 3,

  /** Retry delays in milliseconds (exponential backoff) */
  RETRY_DELAYS_MS: [1000, 5000, 30000] as const,

  /** Processing timeout in milliseconds (2 minutes for AI analysis) */
  PROCESSING_TIMEOUT_MS: 120000,

  /** Maximum items per worker batch */
  BATCH_SIZE: 10,

  /** Worker polling interval in milliseconds */
  POLL_INTERVAL_MS: 10000,

  /** Maximum concurrent item processing */
  MAX_CONCURRENCY: 5,

  /** Stale processing threshold (items stuck in 'processing' status) */
  STALE_PROCESSING_THRESHOLD_MS: 180000, // 3 minutes

  /** Maximum attachment size to serialize (10MB) */
  MAX_ATTACHMENT_SIZE_BYTES: 10 * 1024 * 1024,

  /** Maximum total attachments size per email (25MB) */
  MAX_TOTAL_ATTACHMENTS_SIZE_BYTES: 25 * 1024 * 1024,
} as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isValidQueueStatus(status: string): status is EmailIngestionQueueStatus {
  return ['pending', 'processing', 'completed', 'failed', 'dead_letter'].includes(status);
}

export function isValidEmailProvider(provider: string): provider is EmailProvider {
  return provider === 'mailgun';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get retry delay for given attempt number
 * Uses exponential backoff from config
 */
export function getRetryDelayMs(retryCount: number): number {
  const delays = EMAIL_QUEUE_CONFIG.RETRY_DELAYS_MS;
  const index = Math.min(retryCount, delays.length - 1);
  return delays[index];
}

/**
 * Check if item should be moved to dead letter
 */
export function shouldMoveToDeadLetter(item: EmailIngestionQueueItem): boolean {
  return item.retryCount >= item.maxRetries;
}

/**
 * Calculate time until next retry
 */
export function getNextRetryTime(item: EmailIngestionQueueItem): Date {
  const delayMs = getRetryDelayMs(item.retryCount);
  const lastAttempt = item.lastError?.occurredAt || item.createdAt;
  return new Date(lastAttempt.getTime() + delayMs);
}
