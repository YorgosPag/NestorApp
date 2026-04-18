/**
 * =============================================================================
 * 🧠 AI QUERY STRATEGY MEMORY SERVICE
 * =============================================================================
 *
 * Records which Firestore query approaches succeed/fail per collection.
 * Injects strategy hints into the AI prompt so it doesn't repeat failures.
 *
 * Pattern: FAILED_PRECONDITION on nested field → record failed filters →
 *          next time, prompt tells AI to avoid those filters.
 *
 * @module services/ai-pipeline/query-strategy-service
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateQueryStrategyDocId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('QUERY_STRATEGY_SERVICE');

// ============================================================================
// TYPES
// ============================================================================

export interface QueryStrategy {
  /** Firestore collection name */
  collection: string;
  /** Fields that caused FAILED_PRECONDITION */
  failedFilters: string[];
  /** Why it failed */
  failedReason: string;
  /** Strategy that worked (description) */
  successfulStrategy: string;
  /** Filters that worked */
  successfulFilters: string[];
  /** Times this strategy was used */
  useCount: number;
  /** Last used timestamp */
  lastUsedAt: string;
  /** Created timestamp */
  createdAt: string;
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Record a failed query strategy and its successful fallback.
 * Called by agentic-tool-executor when FAILED_PRECONDITION triggers fallback.
 */
export async function recordQueryStrategy(params: {
  collection: string;
  failedFilters: string[];
  failedReason: string;
  successfulFilters: string[];
}): Promise<void> {
  try {
    const db = getAdminFirestore();
    const docId = generateQueryStrategyDocId(params.collection, params.failedFilters);

    const docRef = db.collection(COLLECTIONS.AI_QUERY_STRATEGIES).doc(docId);
    const existing = await docRef.get();

    if (existing.exists) {
      // Update use count
      await docRef.update({
        useCount: (existing.data()?.useCount ?? 0) + 1,
        lastUsedAt: nowISO(),
        successfulFilters: params.successfulFilters,
      });
    } else {
      // Create new strategy record
      const strategy: QueryStrategy = {
        collection: params.collection,
        failedFilters: params.failedFilters,
        failedReason: params.failedReason,
        successfulStrategy: `Query ${params.collection} without nested filters (${params.failedFilters.join(', ')}), filter results in response`,
        successfulFilters: params.successfulFilters,
        useCount: 1,
        lastUsedAt: nowISO(),
        createdAt: nowISO(),
      };
      await docRef.set(strategy);
    }

    logger.info('Query strategy recorded', {
      collection: params.collection,
      failedFilters: params.failedFilters,
      docId,
    });
  } catch (error) {
    // Non-fatal — don't break the pipeline
    logger.warn('Failed to record query strategy', {
      error: getErrorMessage(error),
    });
  }
}

/**
 * Get all known query strategies for prompt injection.
 * Returns formatted text to inject into the AI system prompt.
 */
export async function getQueryStrategyHints(): Promise<string> {
  try {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(COLLECTIONS.AI_QUERY_STRATEGIES)
      .orderBy('useCount', 'desc')
      .limit(10)
      .get();

    if (snapshot.empty) return '';

    const hints = snapshot.docs.map(doc => {
      const s = doc.data() as QueryStrategy;
      return `- Collection "${s.collection}": ΜΗΝ κάνεις WHERE σε ${s.failedFilters.join(', ')} (αποτυγχάνει). Αντί αυτού: ${s.successfulStrategy}`;
    });

    return `\nΑΠΟΤΥΧΗΜΕΝΑ QUERY PATTERNS (μαθημένα από προηγούμενα λάθη):\n${hints.join('\n')}\n`;
  } catch (error) {
    logger.warn('Failed to get query strategy hints', {
      error: getErrorMessage(error),
    });
    return '';
  }
}
