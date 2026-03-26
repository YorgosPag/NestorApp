/**
 * LEARNING SERVICE TESTS
 *
 * Tests AI pattern extraction from rated feedback, pattern retrieval with
 * keyword matching + score ranking, pattern score updates, and low-quality
 * pattern cleanup.
 *
 * @see ADR-173 (AI Self-Improvement System)
 * @module __tests__/learning-service
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ── Standalone mocks ──

jest.mock('server-only', () => ({}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) =>
    e instanceof Error ? e.message : String(e)
  ),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { AI_LEARNED_PATTERNS: 'ai_learned_patterns' },
}));

jest.mock('@/config/firestore-field-constants', () => ({
  FIELDS: { UPDATED_AT: 'updatedAt' },
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateLearnedPatternId: jest.fn(() => 'lp_test_001'),
}));

// ── Greek NLP mock ──

jest.mock('../shared/greek-nlp', () => ({
  extractKeywords: jest.fn((text: string) =>
    text.split(/\s+/).filter((w: string) => w.length > 2).slice(0, 5)
  ),
  computeKeywordOverlap: jest.fn((a: string[], b: string[]) => {
    const setA = new Set(a);
    const intersection = b.filter((k: string) => setA.has(k));
    return a.length > 0 ? intersection.length / a.length : 0;
  }),
}));

// ── Feedback service mock ──

jest.mock('../feedback-service', () => ({
  getFeedbackService: jest.fn(),
}));

// ── Firestore mocks ──

const mockDocGet = jest.fn();
const mockDocSet = jest.fn().mockResolvedValue(undefined);
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocRef = { get: mockDocGet, set: mockDocSet, update: mockDocUpdate };
const mockDoc = jest.fn().mockReturnValue(mockDocRef);

const mockBatchUpdate = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatch = jest.fn().mockReturnValue({
  update: mockBatchUpdate,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
});

const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimitFn = jest.fn().mockReturnThis();
const mockCollGet = jest.fn();

const mockCollectionRef = {
  doc: mockDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimitFn,
  get: mockCollGet,
};
const mockCollection = jest.fn().mockReturnValue(mockCollectionRef);

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: mockCollection,
    batch: mockBatch,
  }),
}));

// ── Imports ──

import { LearningService } from '../learning-service';
import type { FeedbackSnapshot } from '../feedback-service';
import { getFeedbackService } from '../feedback-service';
import { extractKeywords, computeKeywordOverlap } from '../shared/greek-nlp';

// ── Get typed references to mocked functions ──

const mockGetFeedbackService = getFeedbackService as jest.MockedFunction<typeof getFeedbackService>;
const mockExtractKeywords = extractKeywords as jest.MockedFunction<typeof extractKeywords>;
const mockComputeKeywordOverlap = computeKeywordOverlap as jest.MockedFunction<typeof computeKeywordOverlap>;

// ── Mock feedback service instance ──

const mockGetUnprocessedFeedback = jest.fn();
const mockMarkAsProcessed = jest.fn().mockResolvedValue(undefined);

// ============================================================================
// HELPERS
// ============================================================================

type FeedbackWithId = FeedbackSnapshot & { id: string };

function createFeedbackItem(overrides?: Partial<FeedbackWithId>): FeedbackWithId {
  return {
    id: 'fb_001',
    requestId: 'req_001',
    companyId: 'comp_pagonis',
    channelSenderId: 'telegram_123',
    rating: 'positive',
    negativeCategory: null,
    userQuery: 'Ποιο project status',
    aiAnswer: 'Το project είναι ενεργό',
    toolChain: ['firestore_query'],
    toolChainDetail: [{ tool: 'firestore_query', collection: 'projects' }],
    iterations: 1,
    durationMs: 1000,
    processedForLearning: false,
    channel: 'telegram',
    tokenEstimate: 15,
    suggestedActions: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createPatternDoc(id: string, overrides?: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    id,
    ref: { id },
    data: () => ({
      patternType: 'success',
      keywords: ['project', 'status'],
      queryTemplate: 'project status',
      toolChain: ['firestore_query'],
      toolChainDetail: [{ tool: 'firestore_query' }],
      exampleQuery: 'Ποιο project status',
      exampleAnswer: 'Ενεργό',
      successCount: 5,
      failureCount: 1,
      score: 0.83,
      lastUsedAt: now,
      lastFeedbackAt: now,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('LearningService', () => {
  let service: LearningService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LearningService();

    // Reset chainable mocks
    mockWhere.mockReturnThis();
    mockOrderBy.mockReturnThis();
    mockLimitFn.mockReturnThis();

    // Setup feedback service singleton mock
    mockGetFeedbackService.mockReturnValue({
      getUnprocessedFeedback: mockGetUnprocessedFeedback,
      markAsProcessed: mockMarkAsProcessed,
    } as unknown as ReturnType<typeof getFeedbackService>);
  });

  // ========================================================================
  // extractPatternsFromFeedback
  // ========================================================================

  describe('extractPatternsFromFeedback', () => {
    it('processes feedback items and marks all as processed', async () => {
      const feedback1 = createFeedbackItem({ id: 'fb_001', userQuery: 'project status check' });
      const feedback2 = createFeedbackItem({ id: 'fb_002', userQuery: 'contact info search', rating: 'negative' });
      mockGetUnprocessedFeedback.mockResolvedValueOnce([feedback1, feedback2]);

      // findSimilarPattern will find no matches (empty snap)
      mockCollGet.mockResolvedValueOnce({ empty: true, docs: [] });
      mockCollGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const count = await service.extractPatternsFromFeedback(50);

      expect(count).toBe(2);
      expect(mockMarkAsProcessed).toHaveBeenCalledWith(['fb_001', 'fb_002']);
    });

    it('returns 0 when no unprocessed feedback exists', async () => {
      mockGetUnprocessedFeedback.mockResolvedValueOnce([]);

      const count = await service.extractPatternsFromFeedback();

      expect(count).toBe(0);
      expect(mockMarkAsProcessed).not.toHaveBeenCalled();
    });

    it('still marks all as processed even when one item fails', async () => {
      // First item has no extractable keywords → processOneFeedback returns false
      const feedback1 = createFeedbackItem({ id: 'fb_001', userQuery: 'ab' });
      const feedback2 = createFeedbackItem({ id: 'fb_002', userQuery: 'another query here' });
      mockGetUnprocessedFeedback.mockResolvedValueOnce([feedback1, feedback2]);

      // extractKeywords returns [] for 'ab' (no words > 2 chars) → returns false
      // For second item, findSimilarPattern returns empty → creates new pattern
      mockCollGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const count = await service.extractPatternsFromFeedback();

      // Only 1 pattern affected (second one), but both IDs marked as processed
      expect(count).toBe(1);
      expect(mockMarkAsProcessed).toHaveBeenCalledWith(['fb_001', 'fb_002']);
    });

    it('updates existing pattern when similar pattern found', async () => {
      const feedback = createFeedbackItem({
        id: 'fb_001',
        userQuery: 'project status check',
        rating: 'positive',
        toolChain: ['firestore_query'],
      });
      mockGetUnprocessedFeedback.mockResolvedValueOnce([feedback]);

      // findSimilarPattern returns a match with high overlap
      mockComputeKeywordOverlap.mockReturnValueOnce(0.8);
      mockCollGet.mockResolvedValueOnce({
        empty: false,
        docs: [createPatternDoc('lp_existing', {
          keywords: ['project', 'status', 'check'],
          toolChain: ['firestore_query'],
          successCount: 3,
          failureCount: 1,
        })],
      });

      const count = await service.extractPatternsFromFeedback();

      expect(count).toBe(1);
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          successCount: 4,
          failureCount: 1,
        })
      );
    });

    it('creates new pattern when no similar pattern exists', async () => {
      const feedback = createFeedbackItem({
        id: 'fb_001',
        userQuery: 'brand new query topic',
        rating: 'negative',
        toolChain: ['firestore_query'],
      });
      mockGetUnprocessedFeedback.mockResolvedValueOnce([feedback]);

      // findSimilarPattern returns no match
      mockCollGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const count = await service.extractPatternsFromFeedback();

      expect(count).toBe(1);
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          patternType: 'failure',
          successCount: 0,
          failureCount: 1,
          score: 0,
        })
      );
    });
  });

  // ========================================================================
  // findRelevantPatterns
  // ========================================================================

  describe('findRelevantPatterns', () => {
    it('returns ranked patterns sorted by composite score', async () => {
      const recentDate = new Date().toISOString();
      const patternHigh = createPatternDoc('lp_high', {
        keywords: ['project', 'status'],
        score: 0.9,
        successCount: 8,
        failureCount: 2,
        lastFeedbackAt: recentDate,
      });
      const patternLow = createPatternDoc('lp_low', {
        keywords: ['project'],
        score: 0.5,
        successCount: 3,
        failureCount: 3,
        lastFeedbackAt: recentDate,
      });

      mockCollGet.mockResolvedValueOnce({
        empty: false,
        docs: [patternHigh, patternLow],
      });

      // High overlap for both
      mockComputeKeywordOverlap
        .mockReturnValueOnce(0.8)   // patternHigh
        .mockReturnValueOnce(0.4);  // patternLow

      const result = await service.findRelevantPatterns('project status query');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('lp_high');
      expect(result[1].id).toBe('lp_low');
    });

    it('filters out patterns below MIN_RATINGS_THRESHOLD (3)', async () => {
      const recentDate = new Date().toISOString();
      const patternBelow = createPatternDoc('lp_below', {
        keywords: ['project', 'status'],
        score: 0.9,
        successCount: 1,
        failureCount: 1, // total = 2, below threshold of 3
        lastFeedbackAt: recentDate,
      });

      mockCollGet.mockResolvedValueOnce({
        empty: false,
        docs: [patternBelow],
      });

      mockComputeKeywordOverlap.mockReturnValueOnce(0.8);

      const result = await service.findRelevantPatterns('project status query');

      expect(result).toHaveLength(0);
    });

    it('returns empty array when keywords are empty', async () => {
      mockExtractKeywords.mockReturnValueOnce([]);

      const result = await service.findRelevantPatterns('ab');

      expect(result).toEqual([]);
      expect(mockCollGet).not.toHaveBeenCalled();
    });

    it('returns empty array on Firestore error', async () => {
      mockCollGet.mockRejectedValueOnce(new Error('unavailable'));

      const result = await service.findRelevantPatterns('project status query');

      expect(result).toEqual([]);
    });

    it('returns empty array when no patterns match in Firestore', async () => {
      mockCollGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await service.findRelevantPatterns('project status query');

      expect(result).toEqual([]);
    });
  });

  // ========================================================================
  // updatePatternScore
  // ========================================================================

  describe('updatePatternScore', () => {
    it('increments success count and recalculates score on success', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          successCount: 5,
          failureCount: 2,
          score: 0.71,
        }),
      });

      await service.updatePatternScore('lp_test_001', true);

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          successCount: 6,
          failureCount: 2,
          score: 6 / 8, // 0.75
        })
      );
    });

    it('increments failure count and recalculates score on failure', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          successCount: 5,
          failureCount: 2,
          score: 0.71,
        }),
      });

      await service.updatePatternScore('lp_test_001', false);

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          successCount: 5,
          failureCount: 3,
          score: 5 / 8, // 0.625
        })
      );
    });

    it('does nothing when document not found', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });

      await service.updatePatternScore('lp_nonexistent', true);

      expect(mockDocUpdate).not.toHaveBeenCalled();
    });

    it('does not throw on Firestore error', async () => {
      mockDocGet.mockRejectedValueOnce(new Error('permission denied'));

      await expect(
        service.updatePatternScore('lp_test_001', true)
      ).resolves.toBeUndefined();
    });
  });

  // ========================================================================
  // cleanupLowQuality
  // ========================================================================

  describe('cleanupLowQuality', () => {
    it('deletes patterns with score < 0.3 and older than 7 days', async () => {
      const mockRef1 = { id: 'lp_low_1' };
      const mockRef2 = { id: 'lp_low_2' };

      mockCollGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          { ref: mockRef1, data: () => ({ score: 0.1 }) },
          { ref: mockRef2, data: () => ({ score: 0.25 }) },
          // This one has good score — should NOT be deleted
          { ref: { id: 'lp_good' }, data: () => ({ score: 0.8 }) },
        ],
      });

      const count = await service.cleanupLowQuality();

      expect(count).toBe(2);
      expect(mockBatchDelete).toHaveBeenCalledTimes(2);
      expect(mockBatchDelete).toHaveBeenCalledWith(mockRef1);
      expect(mockBatchDelete).toHaveBeenCalledWith(mockRef2);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('returns 0 when no low-quality patterns exist', async () => {
      mockCollGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          { ref: { id: 'lp_good' }, data: () => ({ score: 0.9 }) },
        ],
      });

      const count = await service.cleanupLowQuality();

      expect(count).toBe(0);
      expect(mockBatchDelete).not.toHaveBeenCalled();
    });

    it('returns 0 when query returns empty', async () => {
      mockCollGet.mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      const count = await service.cleanupLowQuality();
      expect(count).toBe(0);
    });

    it('returns 0 on Firestore error', async () => {
      mockCollGet.mockRejectedValueOnce(new Error('unavailable'));

      const count = await service.cleanupLowQuality();
      expect(count).toBe(0);
    });
  });
});
