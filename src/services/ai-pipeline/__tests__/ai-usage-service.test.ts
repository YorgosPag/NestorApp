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

// Το `@/config/ai-analysis-config` ΔΕΝ γίνεται mock: ο πραγματικός τιμοκατάλογος (`tokenCostUsd`) είναι μέρος αυτού που ελέγχεται.

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
import { recordUsage, checkDailyCap, getMonthlyUsage } from '../ai-usage.service';
import { usageFromSdk, usageFromSdkSteps } from '../ai-usage-sdk';

// ============================================================================
// FIRESTORE set(…, { merge: true }) — η σημασιολογία που έκρυψε το σφάλμα
// ============================================================================

type Stored = Record<string, unknown>;

function isIncrement(v: unknown): v is { _increment: number } {
  return typeof v === 'object' && v !== null && '_increment' in v;
}

function isMap(v: unknown): v is Stored {
  return typeof v === 'object' && v !== null && !isIncrement(v) && !('_serverTimestamp' in v);
}

/**
 * Όπως η Firestore: κάθε κλειδί του `set` είναι **κυριολεκτικό** όνομα πεδίου (η τελεία ΔΕΝ είναι διαδρομή), οι
 * εμφωλευμένοι χάρτες συγχωνεύονται σε βάθος, και το `increment` προσθέτει στην τρέχουσα τιμή (ή στο 0).
 */
function applySetMerge(target: Stored, data: Stored): Stored {
  const out: Stored = { ...target };
  for (const [key, value] of Object.entries(data)) {
    if (isIncrement(value)) {
      out[key] = (typeof out[key] === 'number' ? (out[key] as number) : 0) + value._increment;
    } else if (isMap(value)) {
      out[key] = applySetMerge(isMap(out[key]) ? (out[key] as Stored) : {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

const TOKENS = { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 } as const;

function writtenData(call = 0): Stored {
  return mockSet.mock.calls[call][0] as Stored;
}

// ============================================================================
// TESTS
// ============================================================================

describe('AI Usage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
  });

  describe('recordUsage', () => {
    it('writes the monthly document of the channel and user, with merge', async () => {
      await recordUsage('user_123', 'telegram', 'gpt-4o-mini', TOKENS);

      expect(mockCollection).toHaveBeenCalledWith('ai_usage');
      expect(mockDoc).toHaveBeenCalledWith('aiu_telegram_user_123_' + new Date().toISOString().slice(0, 7));
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user_123', channel: 'telegram' }),
        { merge: true },
      );
    });

    it('never writes a dotted key — in set() a dot is a literal field name, not a path', async () => {
      await recordUsage('user_123', 'telegram', 'gpt-4o-mini', TOKENS);

      const keys: string[] = [];
      const walk = (o: Stored): void => {
        for (const [k, v] of Object.entries(o)) {
          keys.push(k);
          if (isMap(v)) walk(v);
        }
      };
      walk(writtenData());
      expect(keys.filter((k) => k.includes('.'))).toEqual([]);
    });

    it('round trip: what recordUsage writes is what checkDailyCap counts', async () => {
      let stored: Stored = {};
      mockSet.mockImplementation(async (data) => { stored = applySetMerge(stored, data as Stored); });
      mockGet.mockImplementation(async () => ({ exists: true, data: () => stored }));

      await recordUsage('user_123', 'telegram', 'gpt-4o-mini', TOKENS);
      await recordUsage('user_123', 'telegram', 'gpt-4o-mini', TOKENS);

      const today = new Date().toISOString().slice(0, 10);
      expect((await checkDailyCap('user_123', 'telegram')).used).toBe(2);
      expect(stored.dailyTokens).toEqual({ [today]: { prompt: 1000, completion: 400 } });
      expect(stored.totalTokens).toEqual({ prompt: 1000, completion: 400 });
    });

    it('prices each call with the model that ran, not a fixed one', async () => {
      await recordUsage('u', 'telegram', 'gpt-4o-mini', TOKENS);
      await recordUsage('u', 'telegram', 'gpt-4o', TOKENS);

      // gpt-4o-mini: 500·0,15/1M + 200·0,60/1M = 0,000195 · gpt-4o: 500·2,50/1M + 200·10/1M = 0,00325
      expect((writtenData(0).estimatedCostUsd as { _increment: number })._increment).toBeCloseTo(0.000195, 9);
      expect((writtenData(1).estimatedCostUsd as { _increment: number })._increment).toBeCloseTo(0.00325, 9);
      expect(writtenData(0).unpricedCalls).toEqual({ _increment: 0 });
    });

    it('an unpriced model is counted, not guessed: tokens yes, cost 0, unpricedCalls +1', async () => {
      await recordUsage('u', 'telegram', 'model-without-price', TOKENS);

      expect(writtenData().estimatedCostUsd).toEqual({ _increment: 0 });
      expect(writtenData().unpricedCalls).toEqual({ _increment: 1 });
      expect(writtenData().totalTokens).toEqual({ prompt: { _increment: 500 }, completion: { _increment: 200 } });
    });

    it('does not throw on Firestore failure (non-fatal)', async () => {
      mockSet.mockRejectedValue(new Error('Firestore down'));

      await expect(recordUsage('user_123', 'telegram', 'gpt-4o-mini', TOKENS)).resolves.toBeUndefined();
    });
  });

  describe('usageFromSdk', () => {
    it('maps SDK fields to snake_case and keeps the provider total', () => {
      expect(usageFromSdk({ inputTokens: 120, outputTokens: 45, totalTokens: 170 }))
        .toEqual({ prompt_tokens: 120, completion_tokens: 45, total_tokens: 170 });
    });

    it('without a provider total, total = input + output; missing usage = zero', () => {
      expect(usageFromSdk({ inputTokens: 120, outputTokens: 45 }).total_tokens).toBe(165);
      expect(usageFromSdk(undefined)).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
    });

    it('sums the steps of a tool-using generation', () => {
      expect(usageFromSdkSteps([
        { usage: { inputTokens: 100, outputTokens: 30 } },
        {},
        { usage: { inputTokens: 200, outputTokens: 100 } },
      ])).toEqual({ prompt_tokens: 300, completion_tokens: 130, total_tokens: 430 });
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
