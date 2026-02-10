/**
 * =============================================================================
 * FEEDBACK SERVICE — AI Agent Response Rating Collection
 * =============================================================================
 *
 * Collects user feedback (thumbs up/down) on AI agent responses.
 * Feedback is stored in Firestore and later processed by the learning cron
 * to extract success/failure patterns.
 *
 * Storage: Firestore `ai_agent_feedback` collection
 * Lifecycle: Snapshot created at response time, rating updated via callback
 *
 * @module services/ai-pipeline/feedback-service
 * @see ADR-173 (AI Self-Improvement System)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('FEEDBACK_SERVICE');

// ============================================================================
// TYPES
// ============================================================================

export type FeedbackRating = 'positive' | 'negative';

export interface ToolChainDetailEntry {
  tool: string;
  collection?: string;
  filterFields?: string[];
}

export interface FeedbackSnapshot {
  requestId: string;
  channelSenderId: string;
  rating: FeedbackRating | null;
  userQuery: string;
  aiAnswer: string;
  toolChain: string[];
  toolChainDetail: ToolChainDetailEntry[];
  iterations: number;
  durationMs: number;
  processedForLearning: boolean;
  createdAt: string;
}

export interface SaveFeedbackParams {
  requestId: string;
  channelSenderId: string;
  userQuery: string;
  aiAnswer: string;
  toolCalls: Array<{ name: string; args: string; result: string }>;
  iterations: number;
  durationMs: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_QUERY_LENGTH = 500;
const MAX_ANSWER_LENGTH = 500;
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

// ============================================================================
// SERVICE
// ============================================================================

export class FeedbackService {
  /**
   * Create a feedback snapshot when the AI responds.
   * Rating is null — will be updated when user clicks thumbs up/down.
   *
   * @returns The Firestore document ID (used as requestId in callback)
   */
  async saveFeedbackSnapshot(params: SaveFeedbackParams): Promise<string | null> {
    try {
      const toolChain = params.toolCalls.map(tc => tc.name);
      const toolChainDetail = this.extractToolChainDetail(params.toolCalls);

      const snapshot: FeedbackSnapshot = {
        requestId: params.requestId,
        channelSenderId: params.channelSenderId,
        rating: null,
        userQuery: params.userQuery.substring(0, MAX_QUERY_LENGTH),
        aiAnswer: params.aiAnswer.substring(0, MAX_ANSWER_LENGTH),
        toolChain,
        toolChainDetail,
        iterations: params.iterations,
        durationMs: params.durationMs,
        processedForLearning: false,
        createdAt: new Date().toISOString(),
      };

      const db = getAdminFirestore();
      const docRef = await db.collection(COLLECTIONS.AI_AGENT_FEEDBACK).add(snapshot);

      logger.info('Feedback snapshot saved', {
        docId: docRef.id,
        requestId: params.requestId,
      });

      return docRef.id;
    } catch (error) {
      // Non-fatal: feedback failure must never break the pipeline
      logger.warn('Failed to save feedback snapshot', {
        requestId: params.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update rating on a feedback document (from callback button press).
   */
  async updateRating(feedbackDocId: string, rating: FeedbackRating): Promise<boolean> {
    try {
      const db = getAdminFirestore();
      const docRef = db.collection(COLLECTIONS.AI_AGENT_FEEDBACK).doc(feedbackDocId);
      const doc = await docRef.get();

      if (!doc.exists) {
        logger.warn('Feedback document not found for rating update', { feedbackDocId });
        return false;
      }

      await docRef.update({ rating });

      logger.info('Feedback rating updated', {
        feedbackDocId,
        rating,
      });

      return true;
    } catch (error) {
      logger.warn('Failed to update feedback rating', {
        feedbackDocId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get unprocessed feedback with a rating (for learning extraction).
   */
  async getUnprocessedFeedback(limit: number = 50): Promise<Array<FeedbackSnapshot & { id: string }>> {
    try {
      const db = getAdminFirestore();
      const snap = await db
        .collection(COLLECTIONS.AI_AGENT_FEEDBACK)
        .where('processedForLearning', '==', false)
        .where('rating', 'in', ['positive', 'negative'])
        .limit(limit)
        .get();

      return snap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as FeedbackSnapshot),
      }));
    } catch (error) {
      logger.warn('Failed to get unprocessed feedback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Mark feedback documents as processed for learning.
   */
  async markAsProcessed(docIds: string[]): Promise<void> {
    try {
      const db = getAdminFirestore();
      const batch = db.batch();

      for (const docId of docIds) {
        const ref = db.collection(COLLECTIONS.AI_AGENT_FEEDBACK).doc(docId);
        batch.update(ref, { processedForLearning: true });
      }

      await batch.commit();

      logger.info('Marked feedback as processed', { count: docIds.length });
    } catch (error) {
      logger.warn('Failed to mark feedback as processed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clean up stale feedback documents (no rating after 48h).
   * @returns Number of documents deleted
   */
  async cleanupStale(): Promise<number> {
    try {
      const db = getAdminFirestore();
      const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

      const staleDocs = await db
        .collection(COLLECTIONS.AI_AGENT_FEEDBACK)
        .where('rating', '==', null)
        .where('createdAt', '<', cutoff)
        .limit(100)
        .get();

      if (staleDocs.empty) return 0;

      const batch = db.batch();
      for (const doc of staleDocs.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();

      logger.info('Cleaned up stale feedback', { deletedCount: staleDocs.size });
      return staleDocs.size;
    } catch (error) {
      logger.warn('Failed to cleanup stale feedback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Extract structured tool chain detail from raw tool calls.
   */
  private extractToolChainDetail(
    toolCalls: Array<{ name: string; args: string }>
  ): ToolChainDetailEntry[] {
    return toolCalls.map(tc => {
      const entry: ToolChainDetailEntry = { tool: tc.name };

      try {
        const parsed = JSON.parse(tc.args) as Record<string, unknown>;
        if (typeof parsed.collection === 'string') {
          entry.collection = parsed.collection;
        }
        if (Array.isArray(parsed.filters)) {
          entry.filterFields = (parsed.filters as Array<{ field?: string }>)
            .map(f => f.field)
            .filter((f): f is string => typeof f === 'string');
        }
      } catch {
        // Non-fatal: args might not be valid JSON
      }

      return entry;
    });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let serviceInstance: FeedbackService | null = null;

export function getFeedbackService(): FeedbackService {
  if (!serviceInstance) {
    serviceInstance = new FeedbackService();
  }
  return serviceInstance;
}
