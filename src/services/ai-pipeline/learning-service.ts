/**
 * =============================================================================
 * LEARNING SERVICE — AI Pattern Extraction & Retrieval
 * =============================================================================
 *
 * Extracts success/failure patterns from rated feedback and stores them
 * as learned patterns. These patterns are later injected into the AI prompt
 * as few-shot examples for better responses.
 *
 * Storage: Firestore `ai_learned_patterns` collection
 *
 * @module services/ai-pipeline/learning-service
 * @see ADR-173 (AI Self-Improvement System)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { extractKeywords, computeKeywordOverlap } from './shared/greek-nlp';
import type { FeedbackSnapshot, ToolChainDetailEntry } from './feedback-service';
import { getFeedbackService } from './feedback-service';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('LEARNING_SERVICE');

// ============================================================================
// TYPES
// ============================================================================

export type PatternType = 'success' | 'failure';

export interface LearnedPattern {
  patternType: PatternType;
  keywords: string[];
  queryTemplate: string;
  toolChain: string[];
  toolChainDetail: ToolChainDetailEntry[];
  exampleQuery: string;
  exampleAnswer: string;
  successCount: number;
  failureCount: number;
  score: number;
  lastUsedAt: string;
  lastFeedbackAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearnedPatternWithId extends LearnedPattern {
  id: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_QUERY_TEMPLATE_LENGTH = 200;
const MAX_EXAMPLE_QUERY_LENGTH = 300;
const MAX_EXAMPLE_ANSWER_LENGTH = 500;
const LOW_QUALITY_SCORE_THRESHOLD = 0.3;
const LOW_QUALITY_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_KEYWORDS_PER_QUERY = 5;

/**
 * ADR-173 Phase 1B: Minimum ratings before a pattern is considered trustworthy.
 * Prevents data poisoning — 5 crafted poisoned documents can achieve 90% attack success.
 * A pattern must have at least this many total ratings before being used in prompts.
 */
const MIN_RATINGS_THRESHOLD = 3;

// ============================================================================
// SERVICE
// ============================================================================

export class LearningService {
  /**
   * Extract patterns from unprocessed rated feedback.
   * Called by the daily cron job.
   *
   * @returns Number of patterns created/updated
   */
  async extractPatternsFromFeedback(maxItems: number = 50): Promise<number> {
    const feedbackService = getFeedbackService();
    const feedbackItems = await feedbackService.getUnprocessedFeedback(maxItems);

    if (feedbackItems.length === 0) {
      logger.info('No unprocessed feedback to extract');
      return 0;
    }

    let patternsAffected = 0;

    for (const feedback of feedbackItems) {
      try {
        const wasCreated = await this.processOneFeedback(feedback);
        if (wasCreated) patternsAffected++;
      } catch (error) {
        logger.warn('Failed to process feedback item', {
          feedbackId: feedback.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Mark all as processed
    const processedIds = feedbackItems.map(f => f.id);
    await feedbackService.markAsProcessed(processedIds);

    logger.info('Pattern extraction complete', {
      feedbackProcessed: feedbackItems.length,
      patternsAffected,
    });

    return patternsAffected;
  }

  /**
   * Find patterns relevant to a user query.
   * Uses keyword matching + score ranking.
   *
   * @param userQuery - The user's current query
   * @param limit - Max patterns to return (default 3)
   * @returns Ranked relevant patterns
   */
  async findRelevantPatterns(
    userQuery: string,
    limit: number = 3
  ): Promise<LearnedPatternWithId[]> {
    try {
      const queryKeywords = extractKeywords(userQuery).slice(0, MAX_KEYWORDS_PER_QUERY);

      if (queryKeywords.length === 0) return [];

      // Firestore supports max 10 items in array-contains-any
      const searchKeywords = queryKeywords.slice(0, 10);

      const db = getAdminFirestore();
      const snap = await db
        .collection(COLLECTIONS.AI_LEARNED_PATTERNS)
        .where('keywords', 'array-contains-any', searchKeywords)
        .limit(20) // Fetch more, rank client-side
        .get();

      if (snap.empty) return [];

      // Rank by: keyword overlap * score * recency
      const now = Date.now();
      const ranked = snap.docs
        .map(doc => {
          const data = doc.data() as LearnedPattern;
          const overlap = computeKeywordOverlap(queryKeywords, data.keywords);
          const recencyMs = now - new Date(data.lastFeedbackAt).getTime();
          const recencyFactor = Math.max(0.1, 1 - recencyMs / (30 * 24 * 60 * 60 * 1000)); // Decay over 30 days
          const compositeScore = overlap * data.score * recencyFactor;

          return {
            pattern: { id: doc.id, ...data },
            compositeScore,
          };
        })
        // ADR-173 Phase 1B: Require minimum ratings to prevent data poisoning
        .filter(item => {
          const totalRatings = item.pattern.successCount + item.pattern.failureCount;
          return totalRatings >= MIN_RATINGS_THRESHOLD;
        })
        .filter(item => item.compositeScore > 0.05) // Min relevance threshold
        .sort((a, b) => b.compositeScore - a.compositeScore)
        .slice(0, limit);

      // Update lastUsedAt for returned patterns (fire-and-forget)
      this.touchPatterns(ranked.map(r => r.pattern.id)).catch(() => {
        // Non-fatal
      });

      return ranked.map(r => r.pattern);
    } catch (error) {
      logger.warn('Failed to find relevant patterns', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Update pattern score when used in a response.
   */
  async updatePatternScore(patternId: string, wasSuccessful: boolean): Promise<void> {
    try {
      const db = getAdminFirestore();
      const docRef = db.collection(COLLECTIONS.AI_LEARNED_PATTERNS).doc(patternId);
      const doc = await docRef.get();

      if (!doc.exists) return;

      const data = doc.data() as LearnedPattern;
      const newSuccess = data.successCount + (wasSuccessful ? 1 : 0);
      const newFailure = data.failureCount + (wasSuccessful ? 0 : 1);
      const total = newSuccess + newFailure;
      const newScore = total > 0 ? newSuccess / total : 0;

      await docRef.update({
        successCount: newSuccess,
        failureCount: newFailure,
        score: newScore,
        lastFeedbackAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn('Failed to update pattern score', {
        patternId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Remove low-quality patterns (score < 0.3 and older than 7 days).
   * @returns Number of patterns deleted
   */
  async cleanupLowQuality(): Promise<number> {
    try {
      const db = getAdminFirestore();
      const cutoff = new Date(Date.now() - LOW_QUALITY_AGE_MS).toISOString();

      // Firestore doesn't support < on two different fields without composite index
      // So we query by updatedAt < cutoff, then filter by score client-side
      const snap = await db
        .collection(COLLECTIONS.AI_LEARNED_PATTERNS)
        .where('updatedAt', '<', cutoff)
        .limit(100)
        .get();

      const lowQualityDocs = snap.docs.filter(doc => {
        const data = doc.data() as LearnedPattern;
        return data.score < LOW_QUALITY_SCORE_THRESHOLD;
      });

      if (lowQualityDocs.length === 0) return 0;

      const batch = db.batch();
      for (const doc of lowQualityDocs) {
        batch.delete(doc.ref);
      }
      await batch.commit();

      logger.info('Cleaned up low-quality patterns', {
        deletedCount: lowQualityDocs.length,
      });

      return lowQualityDocs.length;
    } catch (error) {
      logger.warn('Failed to cleanup low-quality patterns', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Process a single feedback item into a learned pattern.
   * Either creates a new pattern or updates an existing one.
   */
  private async processOneFeedback(
    feedback: FeedbackSnapshot & { id: string }
  ): Promise<boolean> {
    const keywords = extractKeywords(feedback.userQuery).slice(0, MAX_KEYWORDS_PER_QUERY);
    if (keywords.length === 0) return false;

    const patternType: PatternType = feedback.rating === 'positive' ? 'success' : 'failure';
    const isPositive = feedback.rating === 'positive';

    // Check if a similar pattern exists
    const existing = await this.findSimilarPattern(keywords, feedback.toolChain);

    if (existing) {
      // Update existing pattern
      const db = getAdminFirestore();
      const newSuccess = existing.successCount + (isPositive ? 1 : 0);
      const newFailure = existing.failureCount + (isPositive ? 0 : 1);
      const total = newSuccess + newFailure;

      await db.collection(COLLECTIONS.AI_LEARNED_PATTERNS).doc(existing.id).update({
        successCount: newSuccess,
        failureCount: newFailure,
        score: total > 0 ? newSuccess / total : 0,
        lastFeedbackAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Update example if this is a positive feedback (better example)
        ...(isPositive ? {
          exampleQuery: feedback.userQuery.substring(0, MAX_EXAMPLE_QUERY_LENGTH),
          exampleAnswer: feedback.aiAnswer.substring(0, MAX_EXAMPLE_ANSWER_LENGTH),
        } : {}),
      });

      return true;
    }

    // Create new pattern
    const now = new Date().toISOString();
    const pattern: LearnedPattern = {
      patternType,
      keywords,
      queryTemplate: feedback.userQuery.substring(0, MAX_QUERY_TEMPLATE_LENGTH),
      toolChain: feedback.toolChain,
      toolChainDetail: feedback.toolChainDetail,
      exampleQuery: feedback.userQuery.substring(0, MAX_EXAMPLE_QUERY_LENGTH),
      exampleAnswer: feedback.aiAnswer.substring(0, MAX_EXAMPLE_ANSWER_LENGTH),
      successCount: isPositive ? 1 : 0,
      failureCount: isPositive ? 0 : 1,
      score: isPositive ? 1 : 0,
      lastUsedAt: now,
      lastFeedbackAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const db = getAdminFirestore();
    await db.collection(COLLECTIONS.AI_LEARNED_PATTERNS).add(pattern);

    return true;
  }

  /**
   * Find an existing pattern with similar keywords and tool chain.
   */
  private async findSimilarPattern(
    keywords: string[],
    toolChain: string[]
  ): Promise<LearnedPatternWithId | null> {
    try {
      if (keywords.length === 0) return null;

      const db = getAdminFirestore();
      const snap = await db
        .collection(COLLECTIONS.AI_LEARNED_PATTERNS)
        .where('keywords', 'array-contains-any', keywords.slice(0, 10))
        .limit(10)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data() as LearnedPattern;
        const overlap = computeKeywordOverlap(keywords, data.keywords);

        // High overlap + same tool chain = same pattern
        if (overlap >= 0.6 && this.toolChainsMatch(toolChain, data.toolChain)) {
          return { id: doc.id, ...data };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if two tool chains are functionally equivalent.
   */
  private toolChainsMatch(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  }

  /**
   * Update lastUsedAt for patterns (fire-and-forget).
   */
  private async touchPatterns(patternIds: string[]): Promise<void> {
    const db = getAdminFirestore();
    const batch = db.batch();
    const now = new Date().toISOString();

    for (const id of patternIds) {
      const ref = db.collection(COLLECTIONS.AI_LEARNED_PATTERNS).doc(id);
      batch.update(ref, { lastUsedAt: now });
    }

    await batch.commit();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let serviceInstance: LearningService | null = null;

export function getLearningService(): LearningService {
  if (!serviceInstance) {
    serviceInstance = new LearningService();
  }
  return serviceInstance;
}
