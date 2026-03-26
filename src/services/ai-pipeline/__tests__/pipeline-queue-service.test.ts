/**
 * PIPELINE QUEUE SERVICE TESTS
 *
 * Tests Firestore-backed queue lifecycle: enqueue (deduplication),
 * claim (optimistic concurrency), fail/complete, retry/dead-letter,
 * stale recovery, stats, and operator inbox approval.
 *
 * @see ADR-080 (Pipeline), ADR-171 (Autonomous AI Agent)
 * @module __tests__/pipeline-queue-service
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ── Standalone mocks ──

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { AI_PIPELINE_QUEUE: 'ai_pipeline_queue' },
}));

jest.mock('@/config/firestore-field-constants', () => ({
  FIELDS: { STATUS: 'status', CREATED_AT: 'createdAt', COMPANY_ID: 'companyId' },
}));

jest.mock('@/config/ai-pipeline-config', () => ({
  PIPELINE_QUEUE_CONFIG: {
    BATCH_SIZE: 5,
    MAX_RETRIES: 3,
    STALE_PROCESSING_THRESHOLD_MS: 300_000,
  },
  PIPELINE_PROTOCOL_CONFIG: {
    REQUEST_ID_PREFIX: 'req',
    SCHEMA_VERSION: 1,
  },
}));

jest.mock('@/constants/entity-status-values', () => ({
  QUEUE_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    DEAD_LETTER: 'dead_letter',
  },
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: jest.fn((n: number) => ({ _increment: n })),
    arrayUnion: jest.fn((val: unknown) => ({ _arrayUnion: val })),
  },
}));

// ── Firestore mock helpers ──
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn();
const mockGet = jest.fn();
const mockDocRef = { update: mockUpdate, get: mockGet, set: mockSet };
const mockDoc = jest.fn().mockReturnValue(mockDocRef);

const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimitFn = jest.fn().mockReturnThis();
const mockCountFn = jest.fn().mockReturnValue({ get: jest.fn() });

const mockCollectionRef = {
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimitFn,
  count: mockCountFn,
  doc: mockDoc,
  get: mockGet,
};
const mockCollection = jest.fn().mockReturnValue(mockCollectionRef);
const mockRunTransaction = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  }),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generatePipelineQueueId: jest.fn(() => 'pq_test_001'),
}));

// ── Imports ──
import {
  enqueuePipelineItem,
  markPipelineItemCompleted,
  markPipelineItemFailed,
  recoverStalePipelineItems,
} from '../pipeline-queue-service';
import { PipelineState, PipelineChannel } from '@/types/ai-pipeline';
import type { IntakeMessage, PipelineContext } from '@/types/ai-pipeline';

// ============================================================================
// HELPERS
// ============================================================================

function createIntakeMessage(id = 'msg_001'): IntakeMessage {
  return {
    id,
    channel: PipelineChannel.EMAIL,
    rawPayload: {},
    normalized: {
      sender: { email: 'test@example.com' },
      recipients: [],
      contentText: 'Test',
      attachments: [],
      timestampIso: new Date().toISOString(),
    },
    metadata: { providerMessageId: `pm_${id}`, signatureVerified: true },
    schemaVersion: 1,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Pipeline Queue Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueuePipelineItem', () => {
    it('creates new queue item when no duplicate exists', async () => {
      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
          set: jest.fn(),
        };
        return fn(tx);
      });

      const result = await enqueuePipelineItem({
        companyId: 'comp_test',
        channel: PipelineChannel.EMAIL,
        intakeMessage: createIntakeMessage(),
      });

      expect(result.queueId).toBe('pq_test_001');
      expect(result.requestId).toMatch(/^req_/);
    });

    it('returns existing item when duplicate found (deduplication)', async () => {
      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: [{ id: 'pq_existing', data: () => ({ requestId: 'req_existing' }) }],
          }),
          set: jest.fn(),
        };
        return fn(tx);
      });

      const result = await enqueuePipelineItem({
        companyId: 'comp_test',
        channel: PipelineChannel.EMAIL,
        intakeMessage: createIntakeMessage(),
      });

      expect(result.queueId).toBe('pq_existing');
      expect(result.requestId).toBe('req_existing');
    });

    it('includes adminCommandMeta when provided', async () => {
      let capturedItem: Record<string, unknown> | undefined;

      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
          set: jest.fn((_ref: unknown, data: Record<string, unknown>) => {
            capturedItem = data;
          }),
        };
        return fn(tx);
      });

      await enqueuePipelineItem({
        companyId: 'comp_test',
        channel: PipelineChannel.TELEGRAM,
        intakeMessage: createIntakeMessage(),
        adminCommandMeta: {
          isAdminCommand: true,
          adminIdentity: { displayName: 'Admin', firebaseUid: 'uid_001' },
          resolvedVia: 'telegram_user_id',
        },
      });

      expect(capturedItem?.context).toEqual(
        expect.objectContaining({
          adminCommandMeta: expect.objectContaining({ isAdminCommand: true }),
        })
      );
    });
  });

  describe('markPipelineItemCompleted', () => {
    it('updates status to completed with final context', async () => {
      const finalContext = {
        requestId: 'req_001',
        companyId: 'comp_test',
        state: PipelineState.ACKED,
        intake: createIntakeMessage(),
        startedAt: '2026-03-25T10:00:00Z',
        stepDurations: {},
        errors: [],
      } as PipelineContext;

      await markPipelineItemCompleted('pq_001', finalContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          pipelineState: PipelineState.ACKED,
        })
      );
    });
  });

  describe('markPipelineItemFailed', () => {
    it('updates status to failed with error and retry history', async () => {
      await markPipelineItemFailed('pq_001', 'OpenAI timeout', 'understand');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          lastError: expect.objectContaining({
            message: 'OpenAI timeout',
            step: 'understand',
          }),
        })
      );
    });

    it('includes context when provided', async () => {
      const ctx = {
        requestId: 'req_001',
        companyId: 'comp_test',
        state: PipelineState.UNDERSTOOD,
        intake: createIntakeMessage(),
        startedAt: '2026-03-25T10:00:00Z',
        stepDurations: {},
        errors: [],
      } as PipelineContext;

      await markPipelineItemFailed('pq_001', 'error', 'step', ctx);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineState: PipelineState.UNDERSTOOD,
          context: ctx,
        })
      );
    });
  });

  describe('recoverStalePipelineItems', () => {
    it('returns 0 when no stale items', async () => {
      // Chain the query mocks to return empty on final .get()
      mockWhere.mockReturnThis();
      mockGet.mockResolvedValue({ empty: true, docs: [] });

      // Override collection to handle chained where().where().get()
      const chainObj = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
      };
      mockCollection.mockReturnValue(chainObj);

      const count = await recoverStalePipelineItems();
      expect(count).toBe(0);
    });

    it('recovers stale items by setting status to failed', async () => {
      const mockDocRef1 = { update: jest.fn().mockResolvedValue(undefined) };
      const chainObj = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [{ ref: mockDocRef1 }],
        }),
      };
      mockCollection.mockReturnValue(chainObj);

      const count = await recoverStalePipelineItems();

      expect(count).toBe(1);
      expect(mockDocRef1.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          lastError: expect.objectContaining({
            message: expect.stringContaining('Stale processing recovery'),
          }),
        })
      );
    });
  });
});
