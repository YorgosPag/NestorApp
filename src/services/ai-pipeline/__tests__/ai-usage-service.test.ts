/**
 * AI USAGE SERVICE TESTS
 *
 * Tests token tracking, daily cap enforcement, cost calculation,
 * and fail-open resilience (ADR-259A).
 *
 * @see ADR-259A (OpenAI Usage Tracking + Cost Protection)
 * @module __tests__/ai-usage-service
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ── Standalone mocks ──

jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { AI_USAGE: 'ai_usage' },
}));

jest.mock('@/config/ai-analysis-config', () => ({
  AI_COST_CONFIG: {
    PRICING: {
      'gpt-4o-mini': { inputPer1MTokens: 0.15, outputPer1MTokens: 0.60 },
      'gpt-4o': { inputPer1MTokens: 2.50, outputPer1MTokens: 10.00 },
    },
    LIMITS: {
      CUSTOMER_DAILY_MESSAGE_CAP: 50,
    },
  },
}));

const mockSet = jest.fn<Promise<void>, [unknown, unknown]>();
const mockGet = jest.fn<Promise<{ exists: boolean; data: () => unknown }>, []>();
const mockDoc = jest.fn().mockReturnValue({ set: mockSet, get: mockGet });
const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: mockCollection }),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  enterpriseIdService: {
    generateAiUsageDocId: jest.fn(
      (channel: string, userId: string, month: string) =>
        `aiu_${channel}_${userId}_${month}`
    ),
  },
}));

// Mock FieldValue
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: jest.fn((n: number) => ({ _increment: n })),
    serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
  },
}));

// ── Imports ──
import { calculateCost, recordUsage, checkDailyCap, getMonthlyUsage } from '../ai-usage.service';

// ============================================================================
// TESTS
// ============================================================================

describe('AI Usage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
  });

  describe('calculateCost', () => {
    it('calculates correct cost for gpt-4o-mini', () => {
      const cost = calculateCost({
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      });

      // (1000/1M) * 0.15 + (500/1M) * 0.60 = 0.00015 + 0.0003 = 0.00045
      expect(cost).toBeCloseTo(0.00045, 6);
    });

    it('returns 0 for zero tokens', () => {
      const cost = calculateCost({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      });
      expect(cost).toBe(0);
    });

    it('handles large token counts', () => {
      const cost = calculateCost({
        prompt_tokens: 1_000_000,
        completion_tokens: 500_000,
        total_tokens: 1_500_000,
      });

      // (1M/1M) * 0.15 + (500K/1M) * 0.60 = 0.15 + 0.30 = 0.45
      expect(cost).toBeCloseTo(0.45, 4);
    });
  });

  describe('recordUsage', () => {
    it('writes usage document with atomic increments', async () => {
      await recordUsage('user_123', 'telegram', {
        prompt_tokens: 500,
        completion_tokens: 200,
        total_tokens: 700,
      });

      expect(mockCollection).toHaveBeenCalledWith('ai_usage');
      expect(mockDoc).toHaveBeenCalledWith('aiu_telegram_user_123_' + new Date().toISOString().slice(0, 7));
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_123',
          channel: 'telegram',
        }),
        { merge: true }
      );
    });

    it('does not throw on Firestore failure (non-fatal)', async () => {
      mockSet.mockRejectedValue(new Error('Firestore down'));

      // Should not throw
      await expect(
        recordUsage('user_123', 'telegram', {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('checkDailyCap', () => {
    it('allows when no usage document exists', async () => {
      mockGet.mockResolvedValue({ exists: false, data: () => null });

      const result = await checkDailyCap('user_123', 'telegram');

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.limit).toBe(50);
    });

    it('allows when usage is below cap', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ dailyCounts: { [today]: 30 } }),
      });

      const result = await checkDailyCap('user_123', 'telegram');

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(30);
    });

    it('blocks when usage reaches cap', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ dailyCounts: { [today]: 50 } }),
      });

      const result = await checkDailyCap('user_123', 'telegram');

      expect(result.allowed).toBe(false);
      expect(result.used).toBe(50);
    });

    it('blocks when usage exceeds cap', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ dailyCounts: { [today]: 75 } }),
      });

      const result = await checkDailyCap('user_123', 'telegram');

      expect(result.allowed).toBe(false);
      expect(result.used).toBe(75);
    });

    it('defaults to 0 when today has no count entry', async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ dailyCounts: { '2026-01-01': 5 } }),
      });

      const result = await checkDailyCap('user_123', 'telegram');

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
    });

    it('fail-open on Firestore error (allows message)', async () => {
      mockGet.mockRejectedValue(new Error('permission denied'));

      const result = await checkDailyCap('user_123', 'telegram');

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
    });
  });

  describe('getMonthlyUsage', () => {
    it('returns null when document does not exist', async () => {
      mockGet.mockResolvedValue({ exists: false, data: () => null });

      const result = await getMonthlyUsage('user_123', 'email');
      expect(result).toBeNull();
    });

    it('returns document data when exists', async () => {
      const usageDoc = {
        userId: 'user_123',
        channel: 'email',
        month: '2026-03',
        totalTokens: { prompt: 5000, completion: 2000 },
        estimatedCostUsd: 0.02,
      };
      mockGet.mockResolvedValue({ exists: true, data: () => usageDoc });

      const result = await getMonthlyUsage('user_123', 'email');
      expect(result).toEqual(usageDoc);
    });

    it('returns null on Firestore error', async () => {
      mockGet.mockRejectedValue(new Error('unavailable'));

      const result = await getMonthlyUsage('user_123', 'email');
      expect(result).toBeNull();
    });

    it('uses custom month parameter', async () => {
      mockGet.mockResolvedValue({ exists: false, data: () => null });

      await getMonthlyUsage('user_123', 'telegram', '2025-12');

      expect(mockDoc).toHaveBeenCalledWith('aiu_telegram_user_123_2025-12');
    });
  });
});
