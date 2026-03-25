/**
 * FEEDBACK SERVICE TESTS
 *
 * Tests AI agent response rating collection: snapshot creation (with sanitization,
 * prompt injection detection, channel extraction, token estimation), rating/category
 * updates, latest feedback retrieval, unprocessed feedback queries, batch processing,
 * suggested actions, and stale cleanup.
 *
 * @see ADR-173 (AI Self-Improvement System)
 * @module __tests__/feedback-service
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
  COLLECTIONS: { AI_AGENT_FEEDBACK: 'ai_agent_feedback' },
}));

jest.mock('@/config/firestore-field-constants', () => ({
  FIELDS: { CREATED_AT: 'createdAt' },
}));

jest.mock('@/config/tenant', () => ({
  getCompanyId: () => 'comp_pagonis',
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateFeedbackId: jest.fn(() => 'fb_test_001'),
}));

jest.mock('@/lib/json-utils', () => ({
  safeJsonParse: jest.fn((str: string, fallback: unknown) => {
    try { return JSON.parse(str); } catch { return fallback; }
  }),
}));

jest.mock('../shared/prompt-sanitizer', () => ({
  sanitizeForPromptInjection: jest.fn((text: string, maxLen: number) => text?.substring(0, maxLen) ?? ''),
  containsPromptInjection: jest.fn(() => false),
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

import { FeedbackService } from '../feedback-service';
import type { SaveFeedbackParams } from '../feedback-service';
import { sanitizeForPromptInjection, containsPromptInjection } from '../shared/prompt-sanitizer';

const mockSanitize = sanitizeForPromptInjection as jest.MockedFunction<typeof sanitizeForPromptInjection>;
const mockContainsInjection = containsPromptInjection as jest.MockedFunction<typeof containsPromptInjection>;

// ============================================================================
// HELPERS
// ============================================================================

function createSaveParams(overrides?: Partial<SaveFeedbackParams>): SaveFeedbackParams {
  return {
    requestId: 'req_001',
    channelSenderId: 'telegram_123',
    userQuery: 'Ποιο είναι το project;',
    aiAnswer: 'Το project είναι Nestor.',
    toolCalls: [{ name: 'firestore_query', args: '{"collection":"projects"}', result: 'ok' }],
    iterations: 2,
    durationMs: 1500,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FeedbackService();

    // Reset chainable mocks
    mockWhere.mockReturnThis();
    mockOrderBy.mockReturnThis();
    mockLimitFn.mockReturnThis();
  });

  // ========================================================================
  // saveFeedbackSnapshot
  // ========================================================================

  describe('saveFeedbackSnapshot', () => {
    it('saves a feedback snapshot and returns the doc ID', async () => {
      const result = await service.saveFeedbackSnapshot(createSaveParams());

      expect(result).toBe('fb_test_001');
      expect(mockCollection).toHaveBeenCalledWith('ai_agent_feedback');
      expect(mockDoc).toHaveBeenCalledWith('fb_test_001');
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req_001',
          companyId: 'comp_pagonis',
          channelSenderId: 'telegram_123',
          rating: null,
          negativeCategory: null,
          processedForLearning: false,
          channel: 'telegram',
          iterations: 2,
          durationMs: 1500,
        })
      );
    });

    it('sanitizes userQuery and aiAnswer before storage', async () => {
      await service.saveFeedbackSnapshot(createSaveParams({
        userQuery: 'Long query text',
        aiAnswer: 'Long answer text',
      }));

      expect(mockSanitize).toHaveBeenCalledWith('Long query text', 500);
      expect(mockSanitize).toHaveBeenCalledWith('Long answer text', 500);
    });

    it('logs warning when prompt injection is detected', async () => {
      mockContainsInjection.mockReturnValueOnce(true);

      const result = await service.saveFeedbackSnapshot(createSaveParams());

      expect(result).toBe('fb_test_001');
      expect(mockContainsInjection).toHaveBeenCalledWith('Ποιο είναι το project;');
    });

    it('extracts channel from channelSenderId when not provided', async () => {
      await service.saveFeedbackSnapshot(createSaveParams({
        channelSenderId: 'email_user@example.com',
      }));

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'email' })
      );
    });

    it('uses "unknown" for channelSenderId without underscore', async () => {
      await service.saveFeedbackSnapshot(createSaveParams({
        channelSenderId: 'nounderscore',
      }));

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'unknown' })
      );
    });

    it('estimates tokens as ceil((query + answer) / 4)', async () => {
      // query: 20 chars, answer: 24 chars => ceil(44/4) = 11
      await service.saveFeedbackSnapshot(createSaveParams({
        userQuery: '12345678901234567890',       // 20 chars
        aiAnswer: '123456789012345678901234',     // 24 chars
      }));

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({ tokenEstimate: 11 })
      );
    });

    it('returns null on Firestore error', async () => {
      mockDocSet.mockRejectedValueOnce(new Error('Firestore down'));

      const result = await service.saveFeedbackSnapshot(createSaveParams());
      expect(result).toBeNull();
    });

    it('extracts tool chain detail from tool call args', async () => {
      await service.saveFeedbackSnapshot(createSaveParams({
        toolCalls: [{
          name: 'firestore_query',
          args: JSON.stringify({ collection: 'projects', filters: [{ field: 'status' }] }),
          result: 'ok',
        }],
      }));

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          toolChain: ['firestore_query'],
          toolChainDetail: [{ tool: 'firestore_query', collection: 'projects', filterFields: ['status'] }],
        })
      );
    });
  });

  // ========================================================================
  // updateRating
  // ========================================================================

  describe('updateRating', () => {
    it('updates rating to positive and returns true', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true });

      const result = await service.updateRating('fb_test_001', 'positive');

      expect(result).toBe(true);
      expect(mockDocUpdate).toHaveBeenCalledWith({ rating: 'positive' });
    });

    it('updates rating to negative and returns true', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true });

      const result = await service.updateRating('fb_test_001', 'negative');

      expect(result).toBe(true);
      expect(mockDocUpdate).toHaveBeenCalledWith({ rating: 'negative' });
    });

    it('returns false when document not found', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });

      const result = await service.updateRating('fb_nonexistent', 'positive');
      expect(result).toBe(false);
    });

    it('returns false on Firestore error', async () => {
      mockDocGet.mockRejectedValueOnce(new Error('permission denied'));

      const result = await service.updateRating('fb_test_001', 'positive');
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // updateNegativeCategory
  // ========================================================================

  describe('updateNegativeCategory', () => {
    it('updates negative category and returns true', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true });

      const result = await service.updateNegativeCategory('fb_test_001', 'wrong_answer');

      expect(result).toBe(true);
      expect(mockDocUpdate).toHaveBeenCalledWith({ negativeCategory: 'wrong_answer' });
    });

    it('returns false when document not found', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });

      const result = await service.updateNegativeCategory('fb_nonexistent', 'slow');
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // getLatestFeedbackForChannel
  // ========================================================================

  describe('getLatestFeedbackForChannel', () => {
    it('returns latest feedback within time window', async () => {
      const recentDate = new Date().toISOString();
      mockCollGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'fb_recent',
          data: () => ({
            requestId: 'req_001',
            channelSenderId: 'telegram_123',
            rating: null,
            createdAt: recentDate,
          }),
        }],
      });

      const result = await service.getLatestFeedbackForChannel('telegram_123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('fb_recent');
      expect(mockWhere).toHaveBeenCalledWith('channelSenderId', '==', 'telegram_123');
      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(mockLimitFn).toHaveBeenCalledWith(1);
    });

    it('returns null when no feedback exists', async () => {
      mockCollGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await service.getLatestFeedbackForChannel('telegram_123');
      expect(result).toBeNull();
    });

    it('returns null when latest feedback is stale (outside time window)', async () => {
      const staleDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      mockCollGet.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'fb_old',
          data: () => ({
            createdAt: staleDate,
          }),
        }],
      });

      // Default maxAgeMs is 30 minutes, so 1 hour old is stale
      const result = await service.getLatestFeedbackForChannel('telegram_123');
      expect(result).toBeNull();
    });
  });

  // ========================================================================
  // getUnprocessedFeedback
  // ========================================================================

  describe('getUnprocessedFeedback', () => {
    it('returns unprocessed feedback items with rating', async () => {
      mockCollGet.mockResolvedValueOnce({
        docs: [
          { id: 'fb_001', data: () => ({ rating: 'positive', userQuery: 'Q1' }) },
          { id: 'fb_002', data: () => ({ rating: 'negative', userQuery: 'Q2' }) },
        ],
      });

      const result = await service.getUnprocessedFeedback(10);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('fb_001');
      expect(result[1].id).toBe('fb_002');
      expect(mockWhere).toHaveBeenCalledWith('processedForLearning', '==', false);
      expect(mockWhere).toHaveBeenCalledWith('rating', 'in', ['positive', 'negative']);
    });

    it('returns empty array on error', async () => {
      mockCollGet.mockRejectedValueOnce(new Error('unavailable'));

      const result = await service.getUnprocessedFeedback();
      expect(result).toEqual([]);
    });
  });

  // ========================================================================
  // markAsProcessed
  // ========================================================================

  describe('markAsProcessed', () => {
    it('batch updates processedForLearning for all doc IDs', async () => {
      await service.markAsProcessed(['fb_001', 'fb_002', 'fb_003']);

      expect(mockBatch).toHaveBeenCalled();
      expect(mockBatchUpdate).toHaveBeenCalledTimes(3);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('handles empty array without errors', async () => {
      await service.markAsProcessed([]);

      expect(mockBatch).toHaveBeenCalled();
      expect(mockBatchUpdate).not.toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // getSuggestedActions
  // ========================================================================

  describe('getSuggestedActions', () => {
    it('returns suggested actions from document', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ suggestedActions: ['Check project status', 'View contacts'] }),
      });

      const result = await service.getSuggestedActions('fb_test_001');

      expect(result).toEqual(['Check project status', 'View contacts']);
    });

    it('returns empty array when document not found', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });

      const result = await service.getSuggestedActions('fb_nonexistent');
      expect(result).toEqual([]);
    });
  });

  // ========================================================================
  // cleanupStale
  // ========================================================================

  describe('cleanupStale', () => {
    it('deletes stale feedback documents and returns count', async () => {
      const mockRef1 = { id: 'fb_stale_1' };
      const mockRef2 = { id: 'fb_stale_2' };
      mockCollGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ ref: mockRef1 }, { ref: mockRef2 }],
        size: 2,
      });

      const count = await service.cleanupStale();

      expect(count).toBe(2);
      expect(mockBatchDelete).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalledWith('rating', '==', null);
    });

    it('returns 0 when no stale documents exist', async () => {
      mockCollGet.mockResolvedValueOnce({ empty: true, docs: [], size: 0 });

      const count = await service.cleanupStale();
      expect(count).toBe(0);
    });

    it('returns 0 on Firestore error', async () => {
      mockCollGet.mockRejectedValueOnce(new Error('unavailable'));

      const count = await service.cleanupStale();
      expect(count).toBe(0);
    });
  });
});
