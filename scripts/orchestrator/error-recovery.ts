/**
 * Multi-Agent Orchestrator — Error Recovery (ADR-261)
 *
 * Retry policies, cleanup guarantees, and graceful shutdown.
 */

import type { OrchestratorError, OrchestratorPhase, AgentRole, TaskId, RetryPolicy } from './types.js';
import { AGENT_RETRY_POLICY } from './config.js';
import type { OrchestratorLogger } from './logger.js';
import type { WorktreeManager } from './worktree-manager.js';

// ─── Error Classification ────────────────────────────────────

export type ErrorCategory = 'TIMEOUT' | 'SDK_ERROR' | 'WORKTREE_CONFLICT' | 'MERGE_CONFLICT' | 'UNKNOWN';

/** Classify an error for retry decisions */
export function classifyError(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('timeout') || message.includes('TIMEOUT') || message.includes('ETIMEDOUT')) {
    return 'TIMEOUT';
  }
  if (message.includes('worktree') || message.includes('WORKTREE')) {
    return 'WORKTREE_CONFLICT';
  }
  if (message.includes('merge') || message.includes('CONFLICT')) {
    return 'MERGE_CONFLICT';
  }
  if (message.includes('SDK') || message.includes('query') || message.includes('ECONNRESET')) {
    return 'SDK_ERROR';
  }
  return 'UNKNOWN';
}

/** Check if an error is retryable based on policy */
export function isRetryable(error: unknown, policy: RetryPolicy = AGENT_RETRY_POLICY): boolean {
  const category = classifyError(error);
  return policy.retryableErrors.includes(category);
}

// ─── Retry Logic ─────────────────────────────────────────────

/**
 * Execute a function with retry policy.
 * Exponential backoff: backoffMs * 2^attempt
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  logger: OrchestratorLogger,
  context: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const category = classifyError(error);

      if (attempt < policy.maxRetries && isRetryable(error, policy)) {
        const delayMs = policy.backoffMs * Math.pow(2, attempt);
        logger.warn(
          `${context}: ${category} error (attempt ${attempt + 1}/${policy.maxRetries + 1}). ` +
          `Retrying in ${delayMs}ms...`,
        );
        await sleep(delayMs);
      } else {
        logger.error(
          `${context}: ${category} error (attempt ${attempt + 1}/${policy.maxRetries + 1}). ` +
          `No more retries.`,
        );
      }
    }
  }

  throw lastError;
}

// ─── Cleanup Guarantees ──────────────────────────────────────

/**
 * Register process signal handlers for graceful cleanup.
 * Ensures worktrees are cleaned up even on CTRL+C or crash.
 */
export function registerCleanupHandlers(
  worktreeManager: WorktreeManager,
  logger: OrchestratorLogger,
): void {
  const cleanup = async (signal: string) => {
    logger.warn(`Received ${signal} — cleaning up worktrees...`);
    try {
      await worktreeManager.cleanupAll();
      logger.success('Worktrees cleaned up successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Cleanup failed: ${message}`);
    }
    process.exit(signal === 'SIGTERM' ? 0 : 1);
  };

  process.on('SIGINT', () => void cleanup('SIGINT'));
  process.on('SIGTERM', () => void cleanup('SIGTERM'));
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    void cleanup('uncaughtException');
  });
}

// ─── Error Factory ───────────────────────────────────────────

/** Create a structured orchestrator error */
export function createError(
  phase: OrchestratorPhase,
  message: string,
  options?: {
    agentRole?: AgentRole;
    taskId?: TaskId;
    retryable?: boolean;
  },
): OrchestratorError {
  return {
    phase,
    message,
    agentRole: options?.agentRole,
    taskId: options?.taskId,
    retryable: options?.retryable ?? false,
    timestamp: new Date().toISOString(),
  };
}

// ─── Utilities ───────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
