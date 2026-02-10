/**
 * =============================================================================
 * TOOL ANALYTICS SERVICE — AI Tool Execution Tracking
 * =============================================================================
 *
 * Records tool execution statistics (success/failure counts, common errors)
 * in a single Firestore document. Used to generate tool warnings for the
 * AI prompt (e.g., "search_text often fails with empty results").
 *
 * Storage: Single Firestore document at `settings/ai_tool_analytics`
 * Updates: Atomic FieldValue.increment() for concurrent safety
 *
 * @module services/ai-pipeline/tool-analytics-service
 * @see ADR-173 (AI Self-Improvement System)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('TOOL_ANALYTICS_SERVICE');

// ============================================================================
// TYPES
// ============================================================================

interface ToolStats {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  commonErrors: Record<string, number>;
  lastUpdated: string;
}

interface ToolAnalyticsDocument {
  tools: Record<string, ToolStats>;
  lastUpdated: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ANALYTICS_DOC_PATH = 'settings/ai_tool_analytics';
const MAX_ERROR_PATTERNS = 10;
const WARNING_FAILURE_THRESHOLD = 0.3; // 30% failure rate triggers warning

// ============================================================================
// SERVICE
// ============================================================================

export class ToolAnalyticsService {
  /**
   * Record a tool execution result (success or failure).
   * Uses atomic increments for concurrency safety.
   *
   * @param toolName - Name of the tool executed
   * @param success - Whether the execution succeeded
   * @param errorPattern - Short error description (max 50 chars)
   */
  async recordToolExecution(
    toolName: string,
    success: boolean,
    errorPattern?: string
  ): Promise<void> {
    try {
      const db = getAdminFirestore();
      const docRef = db.doc(ANALYTICS_DOC_PATH);

      const updates: Record<string, unknown> = {
        [`tools.${toolName}.totalCalls`]: FieldValue.increment(1),
        [`tools.${toolName}.lastUpdated`]: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      if (success) {
        updates[`tools.${toolName}.successCount`] = FieldValue.increment(1);
      } else {
        updates[`tools.${toolName}.failureCount`] = FieldValue.increment(1);

        if (errorPattern) {
          const sanitized = errorPattern.substring(0, 50).replace(/[.$/[\]#]/g, '_');
          updates[`tools.${toolName}.commonErrors.${sanitized}`] = FieldValue.increment(1);
        }
      }

      await docRef.set(updates, { merge: true });
    } catch (error) {
      // Non-fatal: analytics failure must never break tool execution
      logger.warn('Failed to record tool analytics', {
        toolName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get tool warnings for prompt injection.
   * Returns warnings about tools with high failure rates.
   *
   * @returns Array of warning strings (max 4)
   */
  async getToolWarnings(): Promise<string[]> {
    try {
      const db = getAdminFirestore();
      const doc = await db.doc(ANALYTICS_DOC_PATH).get();

      if (!doc.exists) return [];

      const data = doc.data() as ToolAnalyticsDocument;
      if (!data.tools) return [];

      const warnings: string[] = [];

      for (const [toolName, stats] of Object.entries(data.tools)) {
        if (stats.totalCalls < 5) continue; // Not enough data

        const failureRate = stats.totalCalls > 0
          ? stats.failureCount / stats.totalCalls
          : 0;

        if (failureRate >= WARNING_FAILURE_THRESHOLD) {
          // Find the most common error
          const topError = this.getTopError(stats.commonErrors);
          const errorSuffix = topError ? ` (${topError})` : '';
          warnings.push(
            `${toolName}: ${Math.round(failureRate * 100)}% failure rate${errorSuffix}`
          );
        }
      }

      return warnings.slice(0, 4); // Max 4 warnings
    } catch (error) {
      logger.warn('Failed to get tool warnings', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Recompute successRate for all tools.
   * Called by the daily cron job.
   */
  async recomputeRates(): Promise<void> {
    try {
      const db = getAdminFirestore();
      const doc = await db.doc(ANALYTICS_DOC_PATH).get();

      if (!doc.exists) return;

      const data = doc.data() as ToolAnalyticsDocument;
      if (!data.tools) return;

      const updates: Record<string, number> = {};
      let anyUpdate = false;

      for (const [toolName, stats] of Object.entries(data.tools)) {
        if (stats.totalCalls > 0) {
          const newRate = stats.successCount / stats.totalCalls;
          updates[`tools.${toolName}.successRate`] = newRate;
          anyUpdate = true;

          // Prune excess error patterns
          if (stats.commonErrors && Object.keys(stats.commonErrors).length > MAX_ERROR_PATTERNS) {
            const sorted = Object.entries(stats.commonErrors)
              .sort((a, b) => b[1] - a[1])
              .slice(0, MAX_ERROR_PATTERNS);
            const prunedErrors: Record<string, number> = {};
            for (const [key, val] of sorted) {
              prunedErrors[key] = val;
            }
            updates[`tools.${toolName}.commonErrors`] = prunedErrors as unknown as number;
          }
        }
      }

      if (anyUpdate) {
        await db.doc(ANALYTICS_DOC_PATH).set(updates, { merge: true });
        logger.info('Recomputed tool analytics rates');
      }
    } catch (error) {
      logger.warn('Failed to recompute tool analytics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Get the most common error for a tool.
   */
  private getTopError(errors: Record<string, number> | undefined): string | null {
    if (!errors) return null;

    const entries = Object.entries(errors);
    if (entries.length === 0) return null;

    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let serviceInstance: ToolAnalyticsService | null = null;

export function getToolAnalyticsService(): ToolAnalyticsService {
  if (!serviceInstance) {
    serviceInstance = new ToolAnalyticsService();
  }
  return serviceInstance;
}
