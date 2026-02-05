/**
 * 🏢 ENTERPRISE EMAIL INGESTION WORKER
 *
 * ADR-071: Enterprise Email Webhook Queue System
 *
 * Background worker that processes emails from the ingestion queue.
 * Designed to be triggered by:
 * - Vercel Cron (recommended for serverless)
 * - Long-running process (for dedicated servers)
 *
 * Features:
 * - Batch processing with configurable size
 * - Exponential backoff retry logic
 * - Stale item recovery
 * - Concurrent processing with limits
 * - Health monitoring
 *
 * @module server/comms/workers/email-ingestion-worker
 */

import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  claimNextQueueItems,
  claimRetryableItems,
  processQueueItem,
  markQueueItemCompleted,
  markQueueItemFailed,
  recoverStaleItems,
  getQueueHealth,
} from '@/services/communications/inbound';
import {
  EMAIL_QUEUE_CONFIG,
  type EmailIngestionQueueItem,
  type EmailIngestionWorkerConfig,
  type EmailIngestionWorkerStatus,
} from '@/types/email-ingestion-queue';

const logger = createModuleLogger('EMAIL_INGESTION_WORKER');

// ============================================================================
// WORKER CLASS
// ============================================================================

/**
 * Email Ingestion Worker
 *
 * Processes emails from the queue with retry logic and health monitoring.
 */
export class EmailIngestionWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly config: EmailIngestionWorkerConfig;
  private stats: EmailIngestionWorkerStatus = {
    isRunning: false,
    itemsProcessed: 0,
    itemsFailed: 0,
    currentBatchSize: 0,
  };

  constructor(config?: Partial<EmailIngestionWorkerConfig>) {
    this.config = {
      batchSize: config?.batchSize ?? EMAIL_QUEUE_CONFIG.BATCH_SIZE,
      pollIntervalMs: config?.pollIntervalMs ?? EMAIL_QUEUE_CONFIG.POLL_INTERVAL_MS,
      maxConcurrency: config?.maxConcurrency ?? EMAIL_QUEUE_CONFIG.MAX_CONCURRENCY,
      processingTimeoutMs: config?.processingTimeoutMs ?? EMAIL_QUEUE_CONFIG.PROCESSING_TIMEOUT_MS,
    };
  }

  /**
   * Start the worker (polling mode)
   *
   * For long-running server processes.
   * NOT recommended for Vercel serverless - use processBatch() instead.
   */
  start(): void {
    if (this.isRunning) {
      logger.info('Email ingestion worker is already running');
      return;
    }

    logger.info('Starting email ingestion worker', { config: this.config });
    this.isRunning = true;
    this.stats.isRunning = true;

    // Process immediately on start
    void this.poll();

    // Set up polling interval
    this.intervalId = setInterval(() => {
      void this.poll();
    }, this.config.pollIntervalMs);

    logger.info('Email ingestion worker started', {
      pollIntervalMs: this.config.pollIntervalMs,
      batchSize: this.config.batchSize,
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (!this.isRunning) {
      logger.info('Email ingestion worker is not running');
      return;
    }

    logger.info('Stopping email ingestion worker');
    this.isRunning = false;
    this.stats.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Email ingestion worker stopped');
  }

  /**
   * Process a single batch of queue items
   *
   * Designed for serverless environments (Vercel Cron).
   * Call this from a cron endpoint to process pending emails.
   *
   * @returns Processing results
   */
  async processBatch(): Promise<{
    processed: number;
    failed: number;
    recovered: number;
    healthStatus: Awaited<ReturnType<typeof getQueueHealth>>;
  }> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;
    let recovered = 0;

    try {
      // Step 1: Recover any stale items
      recovered = await recoverStaleItems();
      if (recovered > 0) {
        logger.info('Recovered stale items', { recovered });
      }

      // Step 2: Claim pending items
      const pendingItems = await claimNextQueueItems(this.config.batchSize);

      // Step 3: Claim retryable items (if we have capacity)
      const remainingCapacity = this.config.batchSize - pendingItems.length;
      const retryableItems = remainingCapacity > 0
        ? await claimRetryableItems(remainingCapacity)
        : [];

      const allItems = [...pendingItems, ...retryableItems];
      this.stats.currentBatchSize = allItems.length;

      if (allItems.length === 0) {
        logger.debug('No items to process');
        const healthStatus = await getQueueHealth();
        return { processed: 0, failed: 0, recovered, healthStatus };
      }

      logger.info('Processing batch', {
        totalItems: allItems.length,
        pendingItems: pendingItems.length,
        retryableItems: retryableItems.length,
      });

      // Step 4: Process items with concurrency control
      const results = await this.processItemsWithConcurrency(allItems);

      processed = results.processed;
      failed = results.failed;

      this.stats.itemsProcessed += processed;
      this.stats.itemsFailed += failed;
      this.stats.lastPollAt = new Date();

      const elapsed = Date.now() - startTime;
      logger.info('Batch processing completed', {
        processed,
        failed,
        recovered,
        elapsedMs: elapsed,
      });

      const healthStatus = await getQueueHealth();
      return { processed, failed, recovered, healthStatus };

    } catch (error) {
      const elapsed = Date.now() - startTime;
      logger.error('Error in batch processing', {
        error: error instanceof Error ? error.message : 'Unknown error',
        elapsedMs: elapsed,
      });

      const healthStatus = await getQueueHealth();
      return { processed, failed, recovered, healthStatus };
    }
  }

  /**
   * Process items with concurrency control
   */
  private async processItemsWithConcurrency(
    items: EmailIngestionQueueItem[]
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    // Process in chunks based on maxConcurrency
    const chunks = this.chunkArray(items, this.config.maxConcurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(async (item) => {
        try {
          const result = await this.processItemWithTimeout(item);
          if (result.success) {
            await markQueueItemCompleted(item.id, {
              communicationId: result.communicationId,
            });
            processed++;
          } else {
            await markQueueItemFailed(item.id, {
              message: result.error || 'Unknown error',
            });
            failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await markQueueItemFailed(item.id, { message: errorMessage });
          failed++;
        }
      });

      await Promise.all(promises);
    }

    return { processed, failed };
  }

  /**
   * Process single item with timeout
   */
  private async processItemWithTimeout(
    item: EmailIngestionQueueItem
  ): Promise<{ success: boolean; communicationId?: string; error?: string }> {
    const timeoutMs = this.config.processingTimeoutMs;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: `Processing timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      processQueueItem(item)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
    });
  }

  /**
   * Internal poll method for long-running mode
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.processBatch();
    } catch (error) {
      logger.error('Poll error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get worker status
   */
  getStatus(): EmailIngestionWorkerStatus {
    return { ...this.stats };
  }

  /**
   * Utility: Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton worker instance for long-running processes
 */
export const emailIngestionWorker = new EmailIngestionWorker();

// ============================================================================
// SERVERLESS HELPER FUNCTIONS
// ============================================================================

/**
 * Process a batch of queue items (serverless-friendly)
 *
 * Call this from a Vercel cron endpoint.
 * Creates a new worker instance per invocation (stateless).
 *
 * @param config - Optional configuration overrides
 * @returns Processing results
 */
export async function processEmailIngestionBatch(
  config?: Partial<EmailIngestionWorkerConfig>
): Promise<{
  processed: number;
  failed: number;
  recovered: number;
  healthStatus: Awaited<ReturnType<typeof getQueueHealth>>;
}> {
  const worker = new EmailIngestionWorker(config);
  return worker.processBatch();
}

/**
 * Get queue health status (serverless-friendly)
 *
 * Call this from a monitoring endpoint.
 */
export async function getEmailIngestionQueueHealth(): Promise<{
  healthy: boolean;
  warnings: string[];
  stats: Awaited<ReturnType<typeof getQueueHealth>>['stats'];
}> {
  return getQueueHealth();
}
