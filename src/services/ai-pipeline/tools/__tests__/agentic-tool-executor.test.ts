/**
 * AGENTIC TOOL EXECUTOR TESTS
 *
 * Tests the Strategy Pattern dispatcher: handler routing, unknown tools,
 * FAILED_PRECONDITION fallback, analytics recording, and error handling.
 *
 * @see ADR-171 (Autonomous AI Agent)
 * @module __tests__/agentic-tool-executor
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ── Standalone mocks ──

jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry/sentry', () => ({
  captureMessage: jest.fn(),
}));

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) =>
    e instanceof Error ? e.message : String(e)
  ),
}));

const mockRecordToolExecution = jest.fn().mockResolvedValue(undefined);
jest.mock('../../tool-analytics-service', () => ({
  getToolAnalyticsService: () => ({
    recordToolExecution: mockRecordToolExecution,
  }),
}));

// Mock executor-shared
jest.mock('../executor-shared', () => ({
  logger: {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  },
  redactSensitiveFields: jest.fn((data: unknown) => data),
  redactRoleBlockedFields: jest.fn((data: unknown) => data),
  flattenNestedFields: jest.fn((data: unknown) => data),
  truncateResult: jest.fn((data: unknown) => data),
}));

// Mock ALL domain handlers
const mockFirestoreExecute = jest.fn();
jest.mock('../handlers/firestore-handler', () => ({
  FirestoreHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['firestore_query', 'get_document', 'count_documents', 'firestore_write', 'search_text'],
    execute: mockFirestoreExecute,
  })),
}));

const mockContactExecute = jest.fn();
jest.mock('../handlers/contact-handler', () => ({
  ContactHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['create_contact', 'append_contact_info'],
    execute: mockContactExecute,
  })),
}));

const mockMessagingExecute = jest.fn();
jest.mock('../handlers/messaging-handler', () => ({
  MessagingHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['send_email', 'send_telegram', 'send_social'],
    execute: mockMessagingExecute,
  })),
}));

const mockCustomerExecute = jest.fn();
jest.mock('../handlers/customer-handler', () => ({
  CustomerHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['create_complaint_task'],
    execute: mockCustomerExecute,
  })),
}));

const mockFileDeliveryExecute = jest.fn();
jest.mock('../handlers/file-delivery-handler', () => ({
  FileDeliveryHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['deliver_file_to_chat'],
    execute: mockFileDeliveryExecute,
  })),
}));

jest.mock('../handlers/knowledge-base-handler', () => ({
  KnowledgeBaseHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['search_knowledge_base'],
    execute: jest.fn(),
  })),
}));

jest.mock('../handlers/utility-handler', () => ({
  UtilityHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['get_collection_schema', 'lookup_doy_code'],
    execute: jest.fn(),
  })),
}));

jest.mock('../handlers/banking-handler', () => ({
  BankingHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['bank_transaction_query'],
    execute: jest.fn(),
  })),
}));

jest.mock('../handlers/relationship-handler', () => ({
  RelationshipHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['link_entities', 'get_relationships'],
    execute: jest.fn(),
  })),
}));

jest.mock('../handlers/attachment-handler', () => ({
  AttachmentHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['get_attachment_url'],
    execute: jest.fn(),
  })),
}));

jest.mock('../handlers/procurement-handler', () => ({
  ProcurementHandler: jest.fn().mockImplementation(() => ({
    toolNames: ['create_purchase_order', 'list_purchase_orders', 'get_purchase_order_status'],
    execute: jest.fn(),
  })),
}));

// ── Imports ──
import { AgenticToolExecutor } from '../agentic-tool-executor';
import type { AgenticContext } from '../executor-shared';

// ============================================================================
// HELPERS
// ============================================================================

function createCtx(overrides?: Partial<AgenticContext>): AgenticContext {
  return {
    requestId: 'req_test_001',
    companyId: 'comp_pagonis',
    isAdmin: false,
    role: 'customer',
    ...overrides,
  } as AgenticContext;
}

// ============================================================================
// TESTS
// ============================================================================

describe('AgenticToolExecutor', () => {
  let executor: AgenticToolExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new AgenticToolExecutor();
  });

  describe('executeTool — routing', () => {
    it('routes firestore_query to FirestoreHandler', async () => {
      mockFirestoreExecute.mockResolvedValue({ success: true, data: [], count: 0 });

      const result = await executor.executeTool(
        'firestore_query',
        { collection: 'contacts', limit: 10 },
        createCtx()
      );

      expect(result.success).toBe(true);
      expect(mockFirestoreExecute).toHaveBeenCalledWith(
        'firestore_query',
        { collection: 'contacts', limit: 10 },
        expect.objectContaining({ requestId: 'req_test_001' })
      );
    });

    it('routes create_contact to ContactHandler', async () => {
      mockContactExecute.mockResolvedValue({ success: true });

      await executor.executeTool('create_contact', { name: 'Test' }, createCtx());

      expect(mockContactExecute).toHaveBeenCalledWith(
        'create_contact',
        expect.objectContaining({ name: 'Test' }),
        expect.anything()
      );
    });

    it('routes send_email to MessagingHandler', async () => {
      mockMessagingExecute.mockResolvedValue({ success: true });

      await executor.executeTool('send_email', { to: 'a@b.com' }, createCtx());

      expect(mockMessagingExecute).toHaveBeenCalled();
    });

    it('returns error for unknown tool name', async () => {
      const result = await executor.executeTool(
        'nonexistent_tool',
        {},
        createCtx()
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool: nonexistent_tool');
    });
  });

  describe('executeTool — analytics', () => {
    it('records tool analytics after successful execution', async () => {
      mockFirestoreExecute.mockResolvedValue({ success: true, data: [], count: 0 });

      await executor.executeTool('firestore_query', {}, createCtx());

      // Give fire-and-forget a tick
      await new Promise(r => setTimeout(r, 10));

      expect(mockRecordToolExecution).toHaveBeenCalledWith(
        'firestore_query',
        true,
        undefined
      );
    });

    it('records tool analytics after failed execution', async () => {
      mockFirestoreExecute.mockResolvedValue({
        success: false,
        error: 'permission denied',
      });

      await executor.executeTool('firestore_query', {}, createCtx());
      await new Promise(r => setTimeout(r, 10));

      expect(mockRecordToolExecution).toHaveBeenCalledWith(
        'firestore_query',
        false,
        'permission denied'
      );
    });
  });

  describe('executeTool — FAILED_PRECONDITION fallback', () => {
    it('falls back to broad query on missing Firestore index for firestore_query', async () => {
      mockFirestoreExecute.mockImplementation(() => {
        throw new Error('9 FAILED_PRECONDITION: index not found');
      });

      // Mock Firestore for fallback
      const mockDocs = [
        { id: 'doc1', data: () => ({ name: 'Test', companyId: 'comp_pagonis' }) },
      ];
      const mockSnapshot = { docs: mockDocs };
      const mockLimit = jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockSnapshot) });
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockColl = jest.fn().mockReturnValue({ where: mockWhere });

      const { getAdminFirestore } = require('@/lib/firebaseAdmin');
      (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockColl });

      const result = await executor.executeTool(
        'firestore_query',
        { collection: 'contacts', limit: 10 },
        createCtx()
      );

      expect(result.success).toBe(true);
      expect(result.warning).toContain('FALLBACK');
      expect(result.warning).toContain('missing Firestore index');
    });

    it('returns empty fallback for non-query tools with FAILED_PRECONDITION', async () => {
      mockContactExecute.mockImplementation(() => {
        throw new Error('FAILED_PRECONDITION: something');
      });

      const result = await executor.executeTool(
        'create_contact',
        {},
        createCtx()
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.warning).toContain('FALLBACK');
    });
  });

  describe('executeTool — error handling', () => {
    it('returns error for generic handler exceptions', async () => {
      mockCustomerExecute.mockImplementation(() => {
        throw new Error('unexpected null');
      });

      const result = await executor.executeTool(
        'create_complaint_task',
        {},
        createCtx()
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool error: unexpected null');
    });
  });
});
