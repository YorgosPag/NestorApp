/**
 * CHAT HISTORY SERVICE TESTS
 *
 * Tests conversation memory: message addition (with pruning + truncation),
 * TTL-aware retrieval, history clearing, and batch cleanup.
 *
 * @see ADR-171 (Autonomous AI Agent)
 * @module __tests__/chat-history-service
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
  COLLECTIONS: { AI_CHAT_HISTORY: 'ai_chat_history' },
}));

jest.mock('@/config/tenant', () => ({
  getCompanyId: () => 'comp_pagonis',
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateChatHistoryDocId: jest.fn(
    (channel: string, senderId: string) => `ach_${channel}_${senderId}`
  ),
}));

jest.mock('@/utils/firestore-helpers', () => ({
  sanitizeDocumentId: jest.fn((id: string) => id),
}));

// ── Firestore mocks ──
const mockDocGet = jest.fn();
const mockDocSet = jest.fn();
const mockDocUpdate = jest.fn();
const mockDocDelete = jest.fn().mockResolvedValue(undefined);

const mockTransactionGet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockTransactionSet = jest.fn();

const mockRunTransaction = jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
  const tx = {
    get: mockTransactionGet,
    update: mockTransactionUpdate,
    set: mockTransactionSet,
  };
  return fn(tx);
});

const mockDocRef = {
  get: mockDocGet,
  set: mockDocSet,
  update: mockDocUpdate,
  delete: mockDocDelete,
};
const mockDoc = jest.fn().mockReturnValue(mockDocRef);

const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

const mockWhere = jest.fn().mockReturnThis();
const mockLimitFn = jest.fn().mockReturnThis();
const mockCollGet = jest.fn();

const mockCollectionRef = {
  doc: mockDoc,
  where: mockWhere,
  limit: mockLimitFn,
  get: mockCollGet,
};
const mockCollection = jest.fn().mockReturnValue(mockCollectionRef);

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: mockCollection,
    runTransaction: mockRunTransaction,
    batch: () => ({
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    }),
  }),
}));

// ── Imports ──
import { ChatHistoryService } from '../chat-history-service';
import type { ChatHistoryMessage } from '../chat-history-service';

// ============================================================================
// HELPERS
// ============================================================================

function createMessage(role: 'user' | 'assistant', content: string): ChatHistoryMessage {
  return { role, content, timestamp: new Date().toISOString() };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ChatHistoryService', () => {
  let service: ChatHistoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatHistoryService();
  });

  describe('addMessage', () => {
    it('creates new document when history does not exist', async () => {
      mockTransactionGet.mockResolvedValue({ exists: false });

      await service.addMessage('telegram_123', createMessage('user', 'Hello'));

      expect(mockTransactionSet).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          channelSenderId: 'telegram_123',
          companyId: 'comp_pagonis',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'Hello' }),
          ]),
        })
      );
    });

    it('appends to existing messages', async () => {
      mockTransactionGet.mockResolvedValue({
        exists: true,
        data: () => ({
          messages: [createMessage('user', 'Previous')],
        }),
      });

      await service.addMessage('telegram_123', createMessage('assistant', 'Reply'));

      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: 'Previous' }),
            expect.objectContaining({ content: 'Reply' }),
          ]),
        })
      );
    });

    it('prunes oldest messages when exceeding 20 limit', async () => {
      const existingMessages = Array.from({ length: 20 }, (_, i) =>
        createMessage('user', `Message ${i}`)
      );

      mockTransactionGet.mockResolvedValue({
        exists: true,
        data: () => ({ messages: existingMessages }),
      });

      await service.addMessage('telegram_123', createMessage('user', 'New'));

      const updateCall = mockTransactionUpdate.mock.calls[0][1] as { messages: ChatHistoryMessage[] };
      expect(updateCall.messages).toHaveLength(20);
      // Oldest should be pruned, newest kept
      expect(updateCall.messages[19].content).toBe('New');
      expect(updateCall.messages[0].content).toBe('Message 1');
    });

    it('truncates content longer than 2000 chars', async () => {
      mockTransactionGet.mockResolvedValue({ exists: false });

      const longContent = 'A'.repeat(3000);
      await service.addMessage('telegram_123', createMessage('user', longContent));

      const setCall = mockTransactionSet.mock.calls[0][1] as { messages: ChatHistoryMessage[] };
      expect(setCall.messages[0].content.length).toBeLessThanOrEqual(2003); // 2000 + '...'
      expect(setCall.messages[0].content.endsWith('...')).toBe(true);
    });

    it('does not throw on Firestore error (non-fatal)', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Firestore down'));

      await expect(
        service.addMessage('telegram_123', createMessage('user', 'Test'))
      ).resolves.toBeUndefined();
    });
  });

  describe('getRecentHistory', () => {
    it('returns empty array when document does not exist', async () => {
      mockDocGet.mockResolvedValue({ exists: false });

      const result = await service.getRecentHistory('telegram_123');
      expect(result).toEqual([]);
    });

    it('returns messages when within TTL', async () => {
      const recentDate = new Date().toISOString();
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          messages: [createMessage('user', 'Hello')],
          lastUpdated: recentDate,
        }),
      });

      const result = await service.getRecentHistory('telegram_123');
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Hello');
    });

    it('returns empty array when history exceeds 24h TTL', async () => {
      const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          messages: [createMessage('user', 'Old message')],
          lastUpdated: staleDate,
        }),
      });

      const result = await service.getRecentHistory('telegram_123');
      expect(result).toEqual([]);
    });

    it('respects maxMessages parameter', async () => {
      const messages = Array.from({ length: 15 }, (_, i) =>
        createMessage('user', `Msg ${i}`)
      );

      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          messages,
          lastUpdated: new Date().toISOString(),
        }),
      });

      const result = await service.getRecentHistory('telegram_123', 5);
      expect(result).toHaveLength(5);
      expect(result[4].content).toBe('Msg 14'); // Last 5
    });

    it('returns empty on Firestore error (non-fatal)', async () => {
      mockDocGet.mockRejectedValue(new Error('permission denied'));

      const result = await service.getRecentHistory('telegram_123');
      expect(result).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('deletes the document', async () => {
      await service.clearHistory('telegram_123');
      expect(mockDocDelete).toHaveBeenCalled();
    });
  });

  describe('cleanupOldHistory', () => {
    it('returns 0 when no old documents', async () => {
      mockCollGet.mockResolvedValue({ empty: true, docs: [], size: 0 });

      const count = await service.cleanupOldHistory();
      expect(count).toBe(0);
    });

    it('batch-deletes old documents and returns count', async () => {
      const mockRef1 = { id: 'doc1' };
      const mockRef2 = { id: 'doc2' };
      mockCollGet.mockResolvedValue({
        empty: false,
        docs: [{ ref: mockRef1 }, { ref: mockRef2 }],
        size: 2,
      });

      const count = await service.cleanupOldHistory();

      expect(count).toBe(2);
      expect(mockBatchDelete).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('returns 0 on Firestore error (non-fatal)', async () => {
      mockCollGet.mockRejectedValue(new Error('unavailable'));

      const count = await service.cleanupOldHistory();
      expect(count).toBe(0);
    });
  });
});
