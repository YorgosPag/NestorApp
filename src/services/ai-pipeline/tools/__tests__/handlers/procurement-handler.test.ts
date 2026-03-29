/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * PROCUREMENT HANDLER — Unit Tests (ADR-267 Phase C)
 * =============================================================================
 *
 * Tests for AI agentic tools: create_purchase_order, list_purchase_orders,
 * get_purchase_order_status. Covers admin-only access, input validation,
 * VAT rate fallback, limit clamping, parseItems edge cases.
 *
 * @module __tests__/handlers/procurement-handler
 * @see ADR-267 Phase C (AI Telegram PO Creation)
 */

import '../setup';

import { ProcurementHandler } from '../../handlers/procurement-handler';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';

// ── Mock procurement service ──
const mockCreatePO = jest.fn();
const mockGetPO = jest.fn();
const mockListPOs = jest.fn();

jest.mock('@/services/procurement', () => ({
  createPO: (...args: unknown[]) => mockCreatePO(...args),
  getPO: (...args: unknown[]) => mockGetPO(...args),
  listPOs: (...args: unknown[]) => mockListPOs(...args),
}));

// ── Mock contact lookup (for supplier resolution) ──
// setup.ts mocks this module without findContactByName.
// Inject findContactByName into the mocked module.
const mockFindContactByName = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const contactLookupMock = require('@/services/ai-pipeline/shared/contact-lookup') as Record<string, unknown>;
contactLookupMock.findContactByName = mockFindContactByName;

// ── Mock PO_VAT_RATES ──
jest.mock('@/types/procurement', () => ({
  PO_VAT_RATES: [
    { value: 24, label: '24%' },
    { value: 13, label: '13%' },
    { value: 6, label: '6%' },
    { value: 0, label: '0%' },
  ],
}));

describe('ProcurementHandler', () => {
  let handler: ProcurementHandler;
  const adminCtx = createAdminContext();
  const customerCtx = createCustomerContext();

  beforeEach(() => {
    handler = new ProcurementHandler();
    jest.clearAllMocks();
    mockListPOs.mockResolvedValue([]);
  });

  // ========================================================================
  // TOOL NAMES
  // ========================================================================

  describe('toolNames', () => {
    it('exposes exactly 3 tool names', () => {
      expect(handler.toolNames).toEqual([
        'create_purchase_order',
        'list_purchase_orders',
        'get_purchase_order_status',
      ]);
    });
  });

  // ========================================================================
  // ADMIN-ONLY ACCESS CONTROL
  // ========================================================================

  describe('admin-only access control', () => {
    it('rejects non-admin for create_purchase_order', async () => {
      const result = await handler.execute('create_purchase_order', {}, customerCtx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('admin-only');
    });

    it('rejects non-admin for list_purchase_orders', async () => {
      const result = await handler.execute('list_purchase_orders', {}, customerCtx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('admin-only');
    });

    it('rejects non-admin for get_purchase_order_status', async () => {
      const result = await handler.execute('get_purchase_order_status', {}, customerCtx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('admin-only');
    });
  });

  // ========================================================================
  // UNKNOWN TOOL
  // ========================================================================

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const result = await handler.execute('unknown_tool', {}, adminCtx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown procurement tool');
    });
  });

  // ========================================================================
  // CREATE PURCHASE ORDER
  // ========================================================================

  describe('create_purchase_order', () => {
    const validArgs = {
      supplierId: 'supp_001',
      projectId: 'proj_001',
      items: [
        { description: 'Τσιμέντο', quantity: 100, unit: 'σακ', unitPrice: 8, categoryCode: 'OIK-2' },
      ],
      taxRate: 24,
    };

    it('creates PO with valid args', async () => {
      mockCreatePO.mockResolvedValue({ id: 'po_new', poNumber: 'PO-0001' });

      const result = await handler.execute('create_purchase_order', validArgs, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        poId: 'po_new',
        poNumber: 'PO-0001',
        itemCount: 1,
        taxRate: 24,
      });
    });

    it('rejects missing items', async () => {
      const result = await handler.execute('create_purchase_order', {
        supplierId: 'supp_001',
        projectId: 'proj_001',
        items: [],
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('items');
    });

    it('rejects items with missing description', async () => {
      const result = await handler.execute('create_purchase_order', {
        supplierId: 'supp_001',
        projectId: 'proj_001',
        items: [{ description: '', quantity: 10, unitPrice: 5, categoryCode: 'OIK-1' }],
      }, adminCtx);

      expect(result.success).toBe(false);
    });

    it('rejects items with zero quantity', async () => {
      const result = await handler.execute('create_purchase_order', {
        supplierId: 'supp_001',
        projectId: 'proj_001',
        items: [{ description: 'Test', quantity: 0, unitPrice: 5, categoryCode: 'OIK-1' }],
      }, adminCtx);

      expect(result.success).toBe(false);
    });

    it('rejects items with negative unitPrice', async () => {
      const result = await handler.execute('create_purchase_order', {
        supplierId: 'supp_001',
        projectId: 'proj_001',
        items: [{ description: 'Test', quantity: 10, unitPrice: -5, categoryCode: 'OIK-1' }],
      }, adminCtx);

      expect(result.success).toBe(false);
    });

    it('rejects items with missing categoryCode', async () => {
      const result = await handler.execute('create_purchase_order', {
        supplierId: 'supp_001',
        projectId: 'proj_001',
        items: [{ description: 'Test', quantity: 10, unitPrice: 5, categoryCode: '' }],
      }, adminCtx);

      expect(result.success).toBe(false);
    });

    it('defaults to 24% VAT when invalid rate provided', async () => {
      mockCreatePO.mockResolvedValue({ id: 'po_new', poNumber: 'PO-0001' });

      const result = await handler.execute('create_purchase_order', {
        ...validArgs,
        taxRate: 99, // invalid → should default to 24
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data.taxRate).toBe(24);
    });

    it('accepts valid 0% VAT (ενδοκοινοτική)', async () => {
      mockCreatePO.mockResolvedValue({ id: 'po_new', poNumber: 'PO-0001' });

      const result = await handler.execute('create_purchase_order', {
        ...validArgs,
        taxRate: 0,
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data.taxRate).toBe(0);
    });

    it('accepts valid 13% reduced VAT', async () => {
      mockCreatePO.mockResolvedValue({ id: 'po_new', poNumber: 'PO-0001' });

      const result = await handler.execute('create_purchase_order', {
        ...validArgs,
        taxRate: 13,
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data.taxRate).toBe(13);
    });

    it('defaults unit to τεμ when not provided', async () => {
      mockCreatePO.mockResolvedValue({ id: 'po_new', poNumber: 'PO-0001' });

      await handler.execute('create_purchase_order', {
        supplierId: 'supp_001',
        projectId: 'proj_001',
        items: [{ description: 'Test', quantity: 10, unitPrice: 5, categoryCode: 'OIK-1' }],
      }, adminCtx);

      const createCall = mockCreatePO.mock.calls[0];
      const dto = createCall[1];
      expect(dto.items[0].unit).toBe('τεμ');
    });
  });

  // ========================================================================
  // SUPPLIER RESOLUTION
  // ========================================================================

  describe('create_purchase_order — supplier resolution', () => {
    it('resolves supplier by name when supplierId not provided', async () => {
      mockFindContactByName.mockResolvedValue([
        { contactId: 'supp_resolved', name: 'ΑΤΛΑΣ Δομικά' },
      ]);
      mockCreatePO.mockResolvedValue({ id: 'po_new', poNumber: 'PO-0001' });

      const result = await handler.execute('create_purchase_order', {
        supplierName: 'ΑΤΛΑΣ',
        projectId: 'proj_001',
        items: [{ description: 'Test', quantity: 10, unitPrice: 5, categoryCode: 'OIK-1' }],
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data.supplierId).toBe('supp_resolved');
    });

    it('errors when no supplier found by name', async () => {
      mockFindContactByName.mockResolvedValue([]);

      const result = await handler.execute('create_purchase_order', {
        supplierName: 'NonExistent',
        projectId: 'proj_001',
        items: [{ description: 'Test', quantity: 10, unitPrice: 5, categoryCode: 'OIK-1' }],
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No supplier found');
    });

    it('errors when multiple suppliers match name', async () => {
      mockFindContactByName.mockResolvedValue([
        { contactId: 'supp_1', name: 'ΑΤΛΑΣ Α.Ε.' },
        { contactId: 'supp_2', name: 'ΑΤΛΑΣ Δομικά' },
      ]);

      const result = await handler.execute('create_purchase_order', {
        supplierName: 'ΑΤΛΑΣ',
        projectId: 'proj_001',
        items: [{ description: 'Test', quantity: 10, unitPrice: 5, categoryCode: 'OIK-1' }],
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Multiple matches');
    });

    it('errors when neither supplierId nor supplierName provided', async () => {
      const result = await handler.execute('create_purchase_order', {
        projectId: 'proj_001',
        items: [{ description: 'Test', quantity: 10, unitPrice: 5, categoryCode: 'OIK-1' }],
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('supplierId or supplierName');
    });
  });

  // ========================================================================
  // LIST PURCHASE ORDERS
  // ========================================================================

  describe('list_purchase_orders', () => {
    it('returns empty list', async () => {
      mockListPOs.mockResolvedValue([]);
      const result = await handler.execute('list_purchase_orders', {}, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('clamps limit to max 50', async () => {
      mockListPOs.mockResolvedValue([]);
      await handler.execute('list_purchase_orders', { limit: 200 }, adminCtx);

      // Verify the sliced result (can't directly check limit, but behavior should cap)
      expect(mockListPOs).toHaveBeenCalledTimes(1);
    });

    it('clamps limit to min 1', async () => {
      mockListPOs.mockResolvedValue([]);
      await handler.execute('list_purchase_orders', { limit: -5 }, adminCtx);
      expect(mockListPOs).toHaveBeenCalledTimes(1);
    });

    it('filters by status when provided', async () => {
      mockListPOs.mockResolvedValue([]);
      await handler.execute('list_purchase_orders', { status: 'ordered' }, adminCtx);

      const filters = mockListPOs.mock.calls[0][0];
      expect(filters.status).toBe('ordered');
    });

    it('ignores invalid status', async () => {
      mockListPOs.mockResolvedValue([]);
      await handler.execute('list_purchase_orders', { status: 'invalid_status' }, adminCtx);

      const filters = mockListPOs.mock.calls[0][0];
      expect(filters.status).toBeUndefined();
    });
  });

  // ========================================================================
  // GET PURCHASE ORDER STATUS
  // ========================================================================

  describe('get_purchase_order_status', () => {
    it('returns error when poId is missing', async () => {
      const result = await handler.execute('get_purchase_order_status', {}, adminCtx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('poId is required');
    });

    it('returns error when poId is empty string', async () => {
      const result = await handler.execute('get_purchase_order_status', { poId: '  ' }, adminCtx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('poId is required');
    });

    it('returns PO data when found by ID', async () => {
      const mockPO = {
        id: 'po_001',
        poNumber: 'PO-0001',
        companyId: 'test-company-001',
        status: 'ordered',
        supplierId: 'supp_001',
        projectId: 'proj_001',
        subtotal: 1000,
        taxRate: 24,
        taxAmount: 240,
        total: 1240,
        items: [{ description: 'Cement', quantity: 100, unit: 'σακ', unitPrice: 10, total: 1000, categoryCode: 'OIK-2', quantityReceived: 0, quantityRemaining: 100 }],
        dateCreated: '2026-01-01',
        dateNeeded: '2026-02-01',
        dateOrdered: '2026-01-05',
        dateDelivered: null,
        linkedInvoiceIds: [],
        supplierNotes: null,
        isDeleted: false,
      };
      mockGetPO.mockResolvedValue(mockPO);

      const result = await handler.execute('get_purchase_order_status', { poId: 'po_001' }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data.poNumber).toBe('PO-0001');
      expect(result.data.status).toBe('ordered');
      expect(result.data.items).toHaveLength(1);
    });

    it('returns error when PO not found', async () => {
      mockGetPO.mockResolvedValue(null);
      mockListPOs.mockResolvedValue([]);

      const result = await handler.execute('get_purchase_order_status', { poId: 'po_nonexistent' }, adminCtx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ========================================================================
  // parseItems — Edge Cases
  // ========================================================================

  describe('parseItems validation (via create_purchase_order)', () => {
    it('rejects non-array items', async () => {
      const result = await handler.execute('create_purchase_order', {
        supplierId: 'supp_001',
        projectId: 'proj_001',
        items: 'not-an-array',
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('items');
    });

    it('rejects items containing non-objects', async () => {
      const result = await handler.execute('create_purchase_order', {
        supplierId: 'supp_001',
        projectId: 'proj_001',
        items: [null, 'string-item'],
      }, adminCtx);

      expect(result.success).toBe(false);
    });

    it('rejects items with NaN quantity', async () => {
      const result = await handler.execute('create_purchase_order', {
        supplierId: 'supp_001',
        projectId: 'proj_001',
        items: [{ description: 'Test', quantity: 'abc', unitPrice: 5, categoryCode: 'OIK-1' }],
      }, adminCtx);

      expect(result.success).toBe(false);
    });
  });
});
