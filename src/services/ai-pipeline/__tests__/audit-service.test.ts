/**
 * AUDIT SERVICE TESTS
 *
 * Tests pipeline audit recording: entry creation, enterprise ID,
 * field extraction, query methods, and singleton pattern.
 *
 * @see ADR-080 (Pipeline Implementation)
 * @module __tests__/audit-service
 */

import '../tools/__tests__/setup';

// ── Import after setup ──
import { PipelineAuditService, getPipelineAuditService } from '../audit-service';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { generatePipelineAuditId } from '@/services/enterprise-id.service';
import type { PipelineContext } from '@/types/ai-pipeline';

// ============================================================================
// HELPERS
// ============================================================================

function createMockContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    requestId: 'req_audit_001',
    companyId: 'comp_001',
    state: 'audited',
    intake: {
      channel: 'telegram',
      normalized: {
        contentText: 'Test message',
        subject: '',
        sender: { email: 'user@test.com', name: 'Γιώργος' },
      },
      rawPayload: {},
      receivedAt: '2026-03-26T10:00:00Z',
    },
    understanding: {
      intent: 'general_inquiry',
      confidence: 0.95,
      senderType: 'known_contact',
      threatLevel: 'clean',
      entities: { projectId: 'proj_001' },
    },
    approval: {
      decision: 'approved',
      approvedBy: 'AI-auto',
      decidedAt: '2026-03-26T10:00:01Z',
    },
    executionResult: {
      success: true,
      sideEffects: ['reply_sent'],
    },
    startedAt: '2026-03-26T10:00:00Z',
    stepDurations: {},
    errors: [],
    ...overrides,
  } as PipelineContext;
}

function setupFirestoreMock() {
  const mockSet = jest.fn(async () => {});
  const mockDoc = jest.fn(() => ({ set: mockSet }));
  const mockGet = jest.fn(async () => ({
    docs: [{ data: () => ({ requestId: 'req_001', timestamp: '2026-03-26T10:00:00Z' }) }],
  }));
  const mockCollection = jest.fn(() => ({
    doc: mockDoc,
    where: jest.fn().mockReturnValue({
      orderBy: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({ get: mockGet }),
        get: mockGet,
      }),
      get: mockGet,
    }),
  }));

  (getAdminFirestore as jest.Mock).mockReturnValue({
    collection: mockCollection,
  });

  return { mockSet, mockDoc, mockCollection, mockGet };
}

// ============================================================================
// TESTS
// ============================================================================

describe('PipelineAuditService', () => {
  let service: PipelineAuditService;
  let mocks: ReturnType<typeof setupFirestoreMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PipelineAuditService();
    mocks = setupFirestoreMock();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // record()
  // ──────────────────────────────────────────────────────────────────────────

  describe('record', () => {
    it('creates audit entry with enterprise ID', async () => {
      const ctx = createMockContext();
      const auditId = await service.record(ctx, 'auto_processed', 'UC-005');

      expect(generatePipelineAuditId).toHaveBeenCalled();
      expect(auditId).toBe('audit_test_001');
    });

    it('writes entry to Firestore', async () => {
      const ctx = createMockContext();
      await service.record(ctx, 'auto_processed');

      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req_audit_001',
          companyId: 'comp_001',
          decision: 'auto_processed',
          channel: 'telegram',
        })
      );
    });

    it('extracts intent from understanding', async () => {
      const ctx = createMockContext();
      await service.record(ctx, 'auto_processed');

      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: 'general_inquiry',
          aiConfidence: 0.95,
        })
      );
    });

    it('handles missing understanding gracefully', async () => {
      const ctx = createMockContext({ understanding: undefined });
      await service.record(ctx, 'failed');

      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: 'unknown',
          aiConfidence: 0,
        })
      );
    });

    it('records module ID as useCase', async () => {
      const ctx = createMockContext();
      await service.record(ctx, 'auto_processed', 'ADR-171-agentic');

      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          useCase: 'ADR-171-agentic',
        })
      );
    });

    it('defaults useCase to "unrouted" when no moduleId', async () => {
      const ctx = createMockContext();
      await service.record(ctx, 'auto_processed');

      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          useCase: 'unrouted',
        })
      );
    });

    it('captures durationMs from startedAt', async () => {
      const ctx = createMockContext();
      await service.record(ctx, 'auto_processed');

      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: expect.any(Number),
        })
      );
    });

    it('includes error details when present', async () => {
      const ctx = createMockContext({
        errors: [{
          step: 'execute',
          error: 'OpenAI timeout',
          timestamp: '2026-03-26T10:00:02Z',
          retryable: false,
        }],
      });
      await service.record(ctx, 'failed');

      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({ error: 'OpenAI timeout' }),
            ]),
          }),
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // queryByCompany / queryByRequestId
  // ──────────────────────────────────────────────────────────────────────────

  describe('queries', () => {
    it('queryByCompany returns entries', async () => {
      const entries = await service.queryByCompany('comp_001', 10);
      expect(entries).toHaveLength(1);
      expect(entries[0].requestId).toBe('req_001');
    });

    it('queryByRequestId returns entries', async () => {
      const entries = await service.queryByRequestId('req_001');
      expect(entries).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Singleton
  // ──────────────────────────────────────────────────────────────────────────

  describe('singleton', () => {
    it('returns same instance', () => {
      const a = getPipelineAuditService();
      const b = getPipelineAuditService();
      expect(a).toBe(b);
    });
  });
});
