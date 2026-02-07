/**
 * =============================================================================
 * AI PIPELINE WORKER
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Background worker that processes items from the AI pipeline queue.
 * Same proven pattern as EmailIngestionWorker (ADR-071).
 *
 * Designed to be triggered by:
 * - Next.js 15 `after()` (immediate processing after email webhook)
 * - Vercel Cron (scheduled backup trigger)
 * - Manual API call (admin tools)
 *
 * Features:
 * - Batch processing with configurable size
 * - Stale item recovery
 * - Retry with dead letter queue
 * - Concurrent processing with limits
 * - Health monitoring
 *
 * @module server/ai/workers/ai-pipeline-worker
 * @see ADR-080 (Pipeline Implementation)
 * @see server/comms/workers/email-ingestion-worker.ts (same pattern)
 */

import 'server-only';

import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  claimNextPipelineItems,
  claimRetryablePipelineItems,
  markPipelineItemCompleted,
  markPipelineItemFailed,
  recoverStalePipelineItems,
  getPipelineQueueStats,
  PipelineOrchestrator,
  getModuleRegistry,
  getPipelineAuditService,
} from '@/services/ai-pipeline';
import type { PipelineQueueItem } from '@/types/ai-pipeline';
import { PipelineState } from '@/types/ai-pipeline';
import type { PipelineQueueStats } from '@/services/ai-pipeline';
import { PIPELINE_QUEUE_CONFIG, PIPELINE_TIMEOUT_CONFIG } from '@/config/ai-pipeline-config';
import { createAIAnalysisProvider } from '@/services/ai-analysis/providers/ai-provider-factory';

const logger = createModuleLogger('AI_PIPELINE_WORKER');

// ============================================================================
// WORKER CONFIG & STATUS TYPES
// ============================================================================

/**
 * Worker configuration (config-driven, not hardcoded)
 */
interface AIPipelineWorkerConfig {
  batchSize: number;
  pollIntervalMs: number;
  maxConcurrency: number;
  processingTimeoutMs: number;
}

/**
 * Worker runtime status for monitoring
 */
interface AIPipelineWorkerStatus {
  isRunning: boolean;
  itemsProcessed: number;
  itemsFailed: number;
  currentBatchSize: number;
  lastPollAt?: Date;
}

// ============================================================================
// WORKER CLASS
// ============================================================================

/**
 * AI Pipeline Worker
 *
 * Processes items from `ai_pipeline_queue` through the Universal Pipeline.
 * Same lifecycle pattern as EmailIngestionWorker.
 */
export class AIPipelineWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly config: AIPipelineWorkerConfig;
  private stats: AIPipelineWorkerStatus = {
    isRunning: false,
    itemsProcessed: 0,
    itemsFailed: 0,
    currentBatchSize: 0,
  };

  constructor(config?: Partial<AIPipelineWorkerConfig>) {
    this.config = {
      batchSize: config?.batchSize ?? PIPELINE_QUEUE_CONFIG.BATCH_SIZE,
      pollIntervalMs: config?.pollIntervalMs ?? PIPELINE_QUEUE_CONFIG.POLL_INTERVAL_MS,
      maxConcurrency: config?.maxConcurrency ?? PIPELINE_QUEUE_CONFIG.MAX_CONCURRENCY,
      processingTimeoutMs: config?.processingTimeoutMs ?? PIPELINE_TIMEOUT_CONFIG.TOTAL_PIPELINE_MS,
    };
  }

  /**
   * Start the worker (polling mode)
   *
   * For long-running server processes.
   * NOT recommended for Vercel serverless — use processBatch() instead.
   */
  start(): void {
    if (this.isRunning) {
      logger.info('AI pipeline worker is already running');
      return;
    }

    logger.info('Starting AI pipeline worker', { config: this.config });
    this.isRunning = true;
    this.stats.isRunning = true;

    void this.poll();

    this.intervalId = setInterval(() => {
      void this.poll();
    }, this.config.pollIntervalMs);

    logger.info('AI pipeline worker started', {
      pollIntervalMs: this.config.pollIntervalMs,
      batchSize: this.config.batchSize,
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (!this.isRunning) {
      logger.info('AI pipeline worker is not running');
      return;
    }

    logger.info('Stopping AI pipeline worker');
    this.isRunning = false;
    this.stats.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('AI pipeline worker stopped');
  }

  /**
   * Process a single batch of queue items
   *
   * Designed for serverless environments (Vercel Cron / after()).
   * Call this from a cron endpoint to process pending pipeline items.
   *
   * @returns Processing results
   */
  async processBatch(): Promise<{
    processed: number;
    failed: number;
    recovered: number;
    queueStats: PipelineQueueStats;
  }> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;
    let recovered = 0;

    try {
      // Step 1: Recover any stale items
      recovered = await recoverStalePipelineItems();
      if (recovered > 0) {
        logger.info('Recovered stale pipeline items', { recovered });
      }

      // Step 2: Claim pending items
      const pendingItems = await claimNextPipelineItems(this.config.batchSize);

      // Step 3: Claim retryable items (if we have capacity)
      const remainingCapacity = this.config.batchSize - pendingItems.length;
      const retryableItems = remainingCapacity > 0
        ? await claimRetryablePipelineItems(remainingCapacity)
        : [];

      const allItems = [...pendingItems, ...retryableItems];
      this.stats.currentBatchSize = allItems.length;

      if (allItems.length === 0) {
        logger.debug('No pipeline items to process');
        const queueStats = await getPipelineQueueStats();
        return { processed: 0, failed: 0, recovered, queueStats };
      }

      logger.info('Processing pipeline batch', {
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
      logger.info('Pipeline batch processing completed', {
        processed,
        failed,
        recovered,
        elapsedMs: elapsed,
      });

      const queueStats = await getPipelineQueueStats();
      return { processed, failed, recovered, queueStats };

    } catch (error) {
      const elapsed = Date.now() - startTime;
      logger.error('Error in pipeline batch processing', {
        error: error instanceof Error ? error.message : 'Unknown error',
        elapsedMs: elapsed,
      });

      const queueStats = await getPipelineQueueStats();
      return { processed, failed, recovered, queueStats };
    }
  }

  /**
   * Process items with concurrency control
   */
  private async processItemsWithConcurrency(
    items: PipelineQueueItem[]
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
            await markPipelineItemCompleted(item.id, result.context);
            processed++;
          } else {
            await markPipelineItemFailed(
              item.id,
              result.error ?? 'Unknown pipeline error',
              result.failedStep ?? 'unknown',
              result.context
            );
            failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await markPipelineItemFailed(item.id, errorMessage, 'worker');
          failed++;
        }
      });

      await Promise.all(promises);
    }

    return { processed, failed };
  }

  /**
   * Process a single pipeline item with timeout
   */
  private async processItemWithTimeout(
    item: PipelineQueueItem
  ): Promise<{
    success: boolean;
    context: PipelineQueueItem['context'];
    error?: string;
    failedStep?: string;
  }> {
    const timeoutMs = this.config.processingTimeoutMs;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          context: item.context,
          error: `Pipeline processing timeout after ${timeoutMs}ms`,
          failedStep: 'timeout',
        });
      }, timeoutMs);

      this.executePipeline(item)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            context: item.context,
            error: error instanceof Error ? error.message : 'Unknown error',
            failedStep: 'orchestrator',
          });
        });
    });
  }

  /**
   * Execute the Universal Pipeline for a single queue item
   *
   * Creates an Orchestrator instance per execution (stateless, safe for serverless).
   */
  private async executePipeline(
    item: PipelineQueueItem
  ): Promise<{
    success: boolean;
    context: PipelineQueueItem['context'];
    error?: string;
    failedStep?: string;
  }> {
    // Ensure all UC modules are registered (lazy, idempotent)
    const { registerAllPipelineModules } = await import('@/services/ai-pipeline/modules/register-modules');
    registerAllPipelineModules();

    const registry = getModuleRegistry();
    const auditService = getPipelineAuditService();
    const aiProvider = createAIAnalysisProvider();

    const orchestrator = new PipelineOrchestrator(registry, auditService, aiProvider);

    // 🏢 ENTERPRISE: Reset context state to RECEIVED for retried items
    // Without this, retried items have context.state = 'failed' from previous run,
    // and the state machine rejects FAILED → ACKED transition (only FAILED → RECEIVED is valid).
    // This ensures proper state transitions during retry execution.
    if (item.context.state === PipelineState.FAILED) {
      item.context.state = PipelineState.RECEIVED;
      item.context.errors = []; // Clear previous run errors for clean retry
    }

    logger.info('Executing pipeline for item', {
      queueId: item.id,
      requestId: item.requestId,
      channel: item.channel,
      companyId: item.companyId,
      contextState: item.context.state,
      retryCount: item.retryCount,
    });

    const result = await orchestrator.execute(item.context);

    logger.info('Pipeline execution result', {
      queueId: item.id,
      requestId: result.requestId,
      success: result.success,
      finalState: result.finalState,
      auditId: result.auditId,
    });

    return {
      success: result.success,
      context: result.context,
      error: result.error,
      failedStep: result.success ? undefined : result.finalState,
    };
  }

  /**
   * Internal poll method for long-running mode
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.processBatch();
    } catch (error) {
      logger.error('Pipeline worker poll error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get worker status for monitoring
   */
  getStatus(): AIPipelineWorkerStatus {
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
export const aiPipelineWorker = new AIPipelineWorker();

// ============================================================================
// SERVERLESS HELPER FUNCTIONS
// ============================================================================

/**
 * Process a batch of pipeline queue items (serverless-friendly)
 *
 * Call this from a Vercel cron endpoint or after() callback.
 * Creates a new worker instance per invocation (stateless).
 *
 * @param config - Optional configuration overrides
 * @returns Processing results
 */
export async function processAIPipelineBatch(
  config?: Partial<AIPipelineWorkerConfig>
): Promise<{
  processed: number;
  failed: number;
  recovered: number;
  queueStats: PipelineQueueStats;
}> {
  const worker = new AIPipelineWorker(config);
  return worker.processBatch();
}

/**
 * Get pipeline queue health status (serverless-friendly)
 *
 * Call this from a monitoring endpoint.
 */
export async function getAIPipelineQueueHealth(): Promise<{
  healthy: boolean;
  warnings: string[];
  stats: PipelineQueueStats;
}> {
  const stats = await getPipelineQueueStats();
  const warnings: string[] = [];

  if (stats.pending > 50) {
    warnings.push(`High pending count: ${stats.pending} items`);
  }

  if (stats.processing > PIPELINE_QUEUE_CONFIG.BATCH_SIZE * 2) {
    warnings.push(`Many items processing: ${stats.processing} items`);
  }

  if (stats.deadLetter > 5) {
    warnings.push(`Dead letter items: ${stats.deadLetter} items need attention`);
  }

  if (stats.failed > 10) {
    warnings.push(`Failed items: ${stats.failed} items awaiting retry`);
  }

  return {
    healthy: warnings.length === 0,
    warnings,
    stats,
  };
}
