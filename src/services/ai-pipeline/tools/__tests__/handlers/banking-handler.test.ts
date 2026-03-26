/**
 * BANKING HANDLER — Unit Tests (Google-level)
 *
 * Tests manage_bank_account tool: add, list, delete, set_primary operations.
 * Verifies RBAC (admin-only), IBAN auto-detection, validation delegation.
 *
 * @see ADR-171, ADR-252
 */

import '../setup';

// Mock banking dependencies
jest.mock('@/constants/greek-banks', () => ({
  getBankByIBAN: jest.fn((iban: string) => {
    if (iban.replace(/\s/g, '').startsWith('GR')) {
      return { code: 'ETHNGRAA', name: 'Εθνική Τράπεζα της Ελλάδος' };
    }
    return undefined;
  }),
}));

jest.mock('@/types/contacts/banking', () => ({
  formatIBAN: jest.fn((iban: string) => {
    const clean = iban.replace(/\s/g, '');
    return clean.replace(/(.{4})/g, '$1 ').trim();
  }),
  validateIBAN: jest.fn(() => ({ valid: true })),
  cleanIBAN: jest.fn((iban: string) => iban.replace(/\s/g, '')),
  isCurrencyCode: jest.fn(() => true),
}));

const mockAddAccount = jest.fn();
const mockDeleteAccount = jest.fn();

jest.mock('@/services/banking/bank-accounts-server.service', () => ({
  BankAccountsServerService: {
    addAccount: (...args: unknown[]) => Reflect.apply(mockAddAccount, null, args),
    deleteAccount: (...args: unknown[]) => Reflect.apply(mockDeleteAccount, null, args),
  },
}));

// Mock firebase-admin/firestore for list/set_primary (inline Firestore ops)
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP') },
}));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { BankingHandler } from '../../handlers/banking-handler';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';

// Helper: create mock Firestore chain for list/set_primary tests
function mockFirestoreForList(accounts: Array<Record<string, unknown>>) {
  const docs = accounts.map((data, i) => ({
    id: `bacc_${i + 1}`,
    data: () => data,
    ref: { id: `bacc_${i + 1}` },
  }));
  const mockGet = jest.fn().mockResolvedValue({ exists: true, data: () => ({ companyId: 'test-company-001' }) });
  const mockWhere = jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs, empty: docs.length === 0 }) });
  const mockCollection = jest.fn().mockReturnValue({
    doc: jest.fn().mockReturnValue({
      get: mockGet,
      collection: jest.fn().mockReturnValue({ where: mockWhere }),
    }),
  });
  (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockCollection });
}

function mockFirestoreForSetPrimary() {
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockCommit = jest.fn().mockResolvedValue(undefined);
  const mockBatch = jest.fn().mockReturnValue({ update: mockUpdate, commit: mockCommit });
  const accountRef = { id: 'bacc_002' };
  const mockGet = jest.fn()
    .mockResolvedValueOnce({ exists: true, data: () => ({ companyId: 'test-company-001' }) }) // contact
    .mockResolvedValueOnce({ exists: true }); // account
  const mockWhere = jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
  });
  const mockDoc = jest.fn().mockReturnValue({
    get: mockGet,
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({ ...accountRef, get: jest.fn().mockResolvedValue({ exists: true }) }),
      where: mockWhere,
    }),
  });
  const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
  (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockCollection, batch: mockBatch });
  return { mockCommit };
}

describe('BankingHandler', () => {
  const handler = new BankingHandler();
  const adminCtx = createAdminContext();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── RBAC ──

  it('should BLOCK non-admin users', async () => {
    const customerCtx = createCustomerContext();
    const result = await handler.execute('manage_bank_account', {
      operation: 'list', contactId: 'cont_001',
      accountId: null, iban: null, bankName: null,
      accountType: null, currency: null, holderName: null, notes: null, isPrimary: null,
    }, customerCtx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('admin-only');
  });

  it('should reject invalid operation', async () => {
    const result = await handler.execute('manage_bank_account', {
      operation: 'hack', contactId: 'cont_001',
      accountId: null, iban: null, bankName: null,
      accountType: null, currency: null, holderName: null, notes: null, isPrimary: null,
    }, adminCtx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('operation must be one of');
  });

  it('should reject missing contactId', async () => {
    const result = await handler.execute('manage_bank_account', {
      operation: 'list', contactId: '',
      accountId: null, iban: null, bankName: null,
      accountType: null, currency: null, holderName: null, notes: null, isPrimary: null,
    }, adminCtx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('contactId is required');
  });

  // ── ADD ──

  describe('add', () => {
    const baseArgs = {
      operation: 'add', contactId: 'cont_001',
      accountId: null, bankName: null,
      accountType: null, currency: null, holderName: null, notes: null, isPrimary: null,
    };

    it('should add Greek IBAN with auto-detected bank', async () => {
      mockAddAccount.mockResolvedValue({ success: true, data: { accountId: 'bacc_001' } });

      const result = await handler.execute('manage_bank_account', {
        ...baseArgs, iban: 'GR1601101250000000012300695',
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        accountId: 'bacc_001',
        bankName: 'Εθνική Τράπεζα της Ελλάδος',
      });
      expect(mockAddAccount).toHaveBeenCalledWith(
        'cont_001',
        expect.objectContaining({
          bankName: 'Εθνική Τράπεζα της Ελλάδος',
          bankCode: 'ETHNGRAA',
          accountType: 'checking',
          currency: 'EUR',
          isPrimary: false,
          isActive: true,
        }),
        adminCtx.companyId,
        expect.stringContaining('AI Agent'),
      );
    });

    it('should require bankName for non-Greek IBAN', async () => {
      const result = await handler.execute('manage_bank_account', {
        ...baseArgs, iban: 'DE89370400440532013000',
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('bankName is required for non-Greek');
    });

    it('should accept explicit bankName override', async () => {
      mockAddAccount.mockResolvedValue({ success: true, data: { accountId: 'bacc_002' } });

      const result = await handler.execute('manage_bank_account', {
        ...baseArgs, iban: 'DE89370400440532013000', bankName: 'Deutsche Bank',
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ bankName: 'Deutsche Bank' });
    });

    it('should reject missing IBAN', async () => {
      const result = await handler.execute('manage_bank_account', {
        ...baseArgs, iban: null,
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('iban is required');
    });

    it('should propagate server validation errors', async () => {
      mockAddAccount.mockResolvedValue({ success: false, error: 'Invalid IBAN' });

      const result = await handler.execute('manage_bank_account', {
        ...baseArgs, iban: 'GR0000000000000000000000000',
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid IBAN');
    });

    it('should pass isPrimary and accountType', async () => {
      mockAddAccount.mockResolvedValue({ success: true, data: { accountId: 'bacc_003' } });

      await handler.execute('manage_bank_account', {
        ...baseArgs, iban: 'GR1601101250000000012300695',
        isPrimary: true, accountType: 'savings', currency: 'USD',
      }, adminCtx);

      expect(mockAddAccount).toHaveBeenCalledWith(
        'cont_001',
        expect.objectContaining({
          isPrimary: true,
          accountType: 'savings',
          currency: 'USD',
        }),
        adminCtx.companyId,
        expect.stringContaining('AI Agent'),
      );
    });
  });

  // ── LIST ──

  describe('list', () => {
    it('should return formatted bank accounts', async () => {
      mockFirestoreForList([
        { bankName: 'Εθνική', iban: 'GR1601101250000000012300695', isPrimary: true, accountType: 'checking', currency: 'EUR', isActive: true },
        { bankName: 'Alpha', iban: 'GR9601401010101002320000655', isPrimary: false, accountType: 'savings', currency: 'EUR', isActive: true },
      ]);

      const result = await handler.execute('manage_bank_account', {
        operation: 'list', contactId: 'cont_001',
        accountId: null, iban: null, bankName: null,
        accountType: null, currency: null, holderName: null, notes: null, isPrimary: null,
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should return empty array for no accounts', async () => {
      mockFirestoreForList([]);

      const result = await handler.execute('manage_bank_account', {
        operation: 'list', contactId: 'cont_001',
        accountId: null, iban: null, bankName: null,
        accountType: null, currency: null, holderName: null, notes: null, isPrimary: null,
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  // ── DELETE ──

  describe('delete', () => {
    it('should soft-delete account', async () => {
      mockDeleteAccount.mockResolvedValue({ success: true, data: undefined });

      const result = await handler.execute('manage_bank_account', {
        operation: 'delete', contactId: 'cont_001', accountId: 'bacc_001',
        iban: null, bankName: null,
        accountType: null, currency: null, holderName: null, notes: null, isPrimary: null,
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ accountId: 'bacc_001', deleted: true });
      expect(mockDeleteAccount).toHaveBeenCalledWith('cont_001', 'bacc_001', adminCtx.companyId);
    });

    it('should require accountId', async () => {
      const result = await handler.execute('manage_bank_account', {
        operation: 'delete', contactId: 'cont_001', accountId: null,
        iban: null, bankName: null,
        accountType: null, currency: null, holderName: null, notes: null, isPrimary: null,
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('accountId is required');
    });
  });

  // ── SET PRIMARY ──

  describe('set_primary', () => {
    it('should require accountId', async () => {
      const result = await handler.execute('manage_bank_account', {
        operation: 'set_primary', contactId: 'cont_001', accountId: '',
        iban: null, bankName: null,
        accountType: null, currency: null, holderName: null, notes: null, isPrimary: null,
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('accountId is required');
    });
  });
});
