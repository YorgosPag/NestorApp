/**
 * OPERATOR INBOX SERVICE TESTS (UC-009)
 *
 * Tests the human approval workflow: approve/reject/modify decisions,
 * pipeline resume, queue updates, and error handling.
 *
 * @see ADR-080 (Pipeline Implementation)
 * @module __tests__/operator-inbox-service
 */

import '../tools/__tests__/setup';

// ── Mock pipeline-queue-service ──
jest.mock('../pipeline-queue-service', () => ({
  updateApprovalDecision: jest.fn(async () => {}),
  markPipelineItemCompleted: jest.fn(async () => {}),
  markPipelineItemFailed: jest.fn(async () => {}),
}));

// ── Mock pipeline-orchestrator ──
jest.mock('../pipeline-orchestrator', () => ({
  PipelineOrchestrator: jest.fn().mockImplementation(() => ({
    resumeFromApproval: jest.fn(async () => ({
      success: true,
      requestId: 'req_001',
      finalState: 'audited',
      context: {},
    })),
  })),
}));

// ── Mock module-registry ──
jest.mock('../module-registry', () => ({
  getModuleRegistry: jest.fn(() => ({})),
}));

// ── Mock audit-service ──
jest.mock('../audit-service', () => ({
  getPipelineAuditService: jest.fn(() => ({
    record: jest.fn(async () => 'audit_001'),
  })),
}));

// ── Mock AI provider factory ──
jest.mock('@/services/ai-analysis/providers/ai-provider-factory', () => ({
  createAIAnalysisProvider: jest.fn(() => ({})),
}));

// ── Mock register-modules (dynamic import) ──
jest.mock('@/services/ai-pipeline/modules/register-modules', () => ({
  registerAllPipelineModules: jest.fn(),
}));

// ── Import after mocks ──
import { processOperatorDecision } from '../operator-inbox-service';
import type { OperatorApprovalParams } from '../operator-inbox-service';
import {
  updateApprovalDecision,
  markPipelineItemCompleted,
  markPipelineItemFailed,
} from '../pipeline-queue-service';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { PipelineState } from '@/types/ai-pipeline';

// ============================================================================
// HELPERS
// ============================================================================

function createParams(overrides?: Partial<OperatorApprovalParams>): OperatorApprovalParams {
  return {
    queueId: 'queue_001',
    decision: 'approved',
    approvedBy: 'operator@test.com',
    reason: 'Looks good',
    ...overrides,
  };
}

function setupQueueItemDoc(state: string = 'approved') {
  const mockDoc = {
    exists: true,
    data: () => ({
      pipelineState: state,
      context: {
        requestId: 'req_001',
        companyId: 'comp_001',
        state,
        intake: { channel: 'email', normalized: { sender: {} }, rawPayload: {}, receivedAt: '' },
        errors: [],
        startedAt: new Date().toISOString(),
        stepDurations: {},
      },
    }),
  };

  const mockCollection = {
    doc: jest.fn(() => ({
      get: jest.fn(async () => mockDoc),
    })),
  };

  (getAdminFirestore as jest.Mock).mockReturnValue({
    collection: jest.fn(() => mockCollection),
  });

  return { mockDoc, mockCollection };
}

// ============================================================================
// TESTS
// ============================================================================

describe('processOperatorDecision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupQueueItemDoc('approved');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // REJECTION
  // ──────────────────────────────────────────────────────────────────────────

  describe('rejection', () => {
    it('returns REJECTED state and does not resume pipeline', async () => {
      const params = createParams({ decision: 'rejected', reason: 'Not relevant' });
      const result = await processOperatorDecision(params);

      expect(result.success).toBe(true);
      expect(result.newState).toBe(PipelineState.REJECTED);
      expect(result.queueId).toBe('queue_001');
    });

    it('calls updateApprovalDecision with rejected', async () => {
      const params = createParams({ decision: 'rejected' });
      await processOperatorDecision(params);

      expect(updateApprovalDecision).toHaveBeenCalledWith(
        'queue_001',
        expect.objectContaining({ decision: 'rejected' })
      );
    });

    it('does NOT call markPipelineItemCompleted on rejection', async () => {
      const params = createParams({ decision: 'rejected' });
      await processOperatorDecision(params);

      expect(markPipelineItemCompleted).not.toHaveBeenCalled();
      expect(markPipelineItemFailed).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // APPROVAL
  // ──────────────────────────────────────────────────────────────────────────

  describe('approval', () => {
    it('resumes pipeline and returns audited state', async () => {
      const params = createParams({ decision: 'approved' });
      const result = await processOperatorDecision(params);

      expect(result.success).toBe(true);
      expect(result.newState).toBe('audited');
    });

    it('calls updateApprovalDecision before resume', async () => {
      const params = createParams({ decision: 'approved' });
      await processOperatorDecision(params);

      expect(updateApprovalDecision).toHaveBeenCalledWith(
        'queue_001',
        expect.objectContaining({ decision: 'approved' })
      );
    });

    it('marks queue item completed on successful resume', async () => {
      const params = createParams({ decision: 'approved' });
      await processOperatorDecision(params);

      expect(markPipelineItemCompleted).toHaveBeenCalledWith(
        'queue_001',
        expect.anything()
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // MODIFIED ACTIONS
  // ──────────────────────────────────────────────────────────────────────────

  describe('modified actions', () => {
    it('stores decision as "modified" when modifiedActions provided', async () => {
      const params = createParams({
        decision: 'approved',
        modifiedActions: [{ type: 'send_email', params: { to: 'test@test.com' } }],
      });
      await processOperatorDecision(params);

      expect(updateApprovalDecision).toHaveBeenCalledWith(
        'queue_001',
        expect.objectContaining({ decision: 'modified' })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ──────────────────────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns FAILED when updateApprovalDecision throws', async () => {
      (updateApprovalDecision as jest.Mock).mockRejectedValue(new Error('DB error'));

      const params = createParams();
      const result = await processOperatorDecision(params);

      expect(result.success).toBe(false);
      expect(result.newState).toBe(PipelineState.FAILED);
      expect(result.error).toBe('DB error');
    });

    it('stores approvedBy and reason in decision', async () => {
      const params = createParams({
        approvedBy: 'admin@pagonis.gr',
        reason: 'Verified by admin',
      });
      await processOperatorDecision(params);

      expect(updateApprovalDecision).toHaveBeenCalledWith(
        'queue_001',
        expect.objectContaining({
          approvedBy: 'admin@pagonis.gr',
          reason: 'Verified by admin',
        })
      );
    });

    it('handles null reason gracefully', async () => {
      const params = createParams({ reason: undefined });
      await processOperatorDecision(params);

      expect(updateApprovalDecision).toHaveBeenCalledWith(
        'queue_001',
        expect.objectContaining({ reason: null })
      );
    });
  });
});
