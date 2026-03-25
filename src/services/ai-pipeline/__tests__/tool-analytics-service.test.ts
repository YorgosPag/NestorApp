/**
 * TOOL ANALYTICS SERVICE TESTS
 *
 * Tests tool execution tracking: success/failure recording,
 * warning generation (30% threshold), rate recomputation, and error pruning.
 *
 * @see ADR-173 (AI Self-Improvement System)
 * @module __tests__/tool-analytics-service
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

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: jest.fn((n: number) => ({ _increment: n })),
  },
}));

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDocGet = jest.fn();
const mockDocRef = { set: mockSet, get: mockDocGet };
const mockDocFn = jest.fn().mockReturnValue(mockDocRef);

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ doc: mockDocFn }),
}));

// ── Imports ──
import { ToolAnalyticsService } from '../tool-analytics-service';

// ============================================================================
// TESTS
// ============================================================================

describe('ToolAnalyticsService', () => {
  let service: ToolAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ToolAnalyticsService();
  });

  describe('recordToolExecution', () => {
    it('records successful execution', async () => {
      await service.recordToolExecution('firestore_query', true);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'tools.firestore_query.totalCalls': expect.anything(),
          'tools.firestore_query.successCount': expect.anything(),
        }),
        { merge: true }
      );
    });

    it('records failed execution with error pattern', async () => {
      await service.recordToolExecution('firestore_query', false, 'FAILED_PRECONDITION');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'tools.firestore_query.failureCount': expect.anything(),
          'tools.firestore_query.commonErrors.FAILED_PRECONDITION': expect.anything(),
        }),
        { merge: true }
      );
    });

    it('sanitizes error pattern (removes Firestore-invalid chars)', async () => {
      await service.recordToolExecution('tool', false, 'path.with/invalid[chars]');

      const callArg = mockSet.mock.calls[0][0] as Record<string, unknown>;
      const errorKeys = Object.keys(callArg).filter(k => k.includes('commonErrors'));
      // The key format is "tools.tool.commonErrors.sanitized_pattern"
      // Only the LAST segment (after commonErrors.) should be sanitized
      const fullKey = errorKeys[0];
      const errorSegment = fullKey.split('commonErrors.')[1];
      expect(errorSegment).not.toContain('.');
      expect(errorSegment).not.toContain('[');
      expect(errorSegment).not.toContain('/');
    });

    it('truncates error pattern to 50 chars', async () => {
      const longError = 'A'.repeat(100);
      await service.recordToolExecution('tool', false, longError);

      const callArg = mockSet.mock.calls[0][0] as Record<string, unknown>;
      const errorKeys = Object.keys(callArg).filter(k => k.includes('commonErrors'));
      // Key should be truncated (tool.name.commonErrors.AAA...)
      const errorKey = errorKeys[0].split('.').pop() ?? '';
      expect(errorKey.length).toBeLessThanOrEqual(50);
    });

    it('does not throw on Firestore error (non-fatal)', async () => {
      mockSet.mockRejectedValue(new Error('unavailable'));

      await expect(
        service.recordToolExecution('tool', true)
      ).resolves.toBeUndefined();
    });
  });

  describe('getToolWarnings', () => {
    it('returns empty when no analytics document', async () => {
      mockDocGet.mockResolvedValue({ exists: false });

      const warnings = await service.getToolWarnings();
      expect(warnings).toEqual([]);
    });

    it('returns empty when no tools data', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ tools: null }),
      });

      const warnings = await service.getToolWarnings();
      expect(warnings).toEqual([]);
    });

    it('skips tools with < 5 calls', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          tools: {
            'firestore_query': {
              totalCalls: 3,
              successCount: 0,
              failureCount: 3,
              commonErrors: {},
            },
          },
        }),
      });

      const warnings = await service.getToolWarnings();
      expect(warnings).toEqual([]);
    });

    it('returns warning for tool with >= 30% failure rate', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          tools: {
            'search_text': {
              totalCalls: 10,
              successCount: 6,
              failureCount: 4,
              commonErrors: { 'empty_result': 3 },
            },
          },
        }),
      });

      const warnings = await service.getToolWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('search_text');
      expect(warnings[0]).toContain('40%');
      expect(warnings[0]).toContain('empty_result');
    });

    it('limits warnings to max 4', async () => {
      const tools: Record<string, unknown> = {};
      for (let i = 0; i < 6; i++) {
        tools[`tool_${i}`] = {
          totalCalls: 10,
          successCount: 2,
          failureCount: 8,
          commonErrors: {},
        };
      }

      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ tools }),
      });

      const warnings = await service.getToolWarnings();
      expect(warnings.length).toBeLessThanOrEqual(4);
    });

    it('returns empty on Firestore error (non-fatal)', async () => {
      mockDocGet.mockRejectedValue(new Error('permission denied'));

      const warnings = await service.getToolWarnings();
      expect(warnings).toEqual([]);
    });
  });

  describe('recomputeRates', () => {
    it('does nothing when no document', async () => {
      mockDocGet.mockResolvedValue({ exists: false });

      await service.recomputeRates();
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('computes correct success rates', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          tools: {
            'firestore_query': {
              totalCalls: 100,
              successCount: 85,
              failureCount: 15,
              commonErrors: {},
            },
          },
        }),
      });

      await service.recomputeRates();

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'tools.firestore_query.successRate': 0.85,
        }),
        { merge: true }
      );
    });
  });
});
