/**
 * Contract tests — ADR-603 accounting migration batch-2.
 *
 * Proves each defineRoute-migrated route (batch-2) is BYTE-IDENTICAL to its
 * previous inline handler: same envelopes, status codes, validation messages,
 * and the contract-risky shapes — through the REAL factory + REAL safeParseBody:
 *   - 422 passthrough of `validatePostingAllowed.reason` / credit-limit warning
 *     (journal POST, invoices POST)
 *   - 403 immutability guards (journal/[id] PATCH + DELETE)
 *   - top-level extra fields: `action` (categories/[id] DELETE), `entityType`
 *     (efka/summary, tax/estimate)
 *   - manual (non-zod) validation messages (documents, setup, setup/presets, vat, reports)
 *
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHighRateLimit: <T>(h: T) => h,
  withStandardRateLimit: <T>(h: T) => h,
  withSensitiveRateLimit: <T>(h: T) => h,
  withHeavyRateLimit: <T>(h: T) => h,
  withWebhookRateLimit: <T>(h: T) => h,
  withTelegramRateLimit: <T>(h: T) => h,
}));

var authCtx = {
  uid: 'user_1',
  companyId: 'comp_caller',
  email: 'g@example.com',
  globalRole: 'admin',
  mfaEnrolled: true,
  isAuthenticated: true as const,
};

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segmentData?: unknown) =>
      callback(request, authCtx, { cache: true }, segmentData),
  logAuditEvent: jest.fn(async () => undefined),
  logEntityDeletion: jest.fn(async () => undefined),
  logFinancialTransition: jest.fn(async () => undefined),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

var repo = {
  // categories
  listCustomCategories: jest.fn(async () => []),
  createCustomCategory: jest.fn(),
  getCustomCategory: jest.fn(),
  updateCustomCategory: jest.fn(async () => undefined),
  deleteCustomCategory: jest.fn(async () => undefined),
  listJournalEntries: jest.fn(async () => ({ items: [] })),
  // documents
  listExpenseDocuments: jest.fn(async () => []),
  createExpenseDocument: jest.fn(),
  updateExpenseDocument: jest.fn(async () => undefined),
  getExpenseDocument: jest.fn(),
  // journal
  getJournalEntry: jest.fn(),
  createJournalEntry: jest.fn(),
  updateJournalEntry: jest.fn(async () => undefined),
  deleteJournalEntry: jest.fn(async () => undefined),
  // setup
  getCompanySetup: jest.fn(async () => null),
  saveCompanySetup: jest.fn(async () => undefined),
  getServicePresets: jest.fn(async () => []),
  saveServicePresets: jest.fn(async () => undefined),
  // bank
  listBankTransactions: jest.fn(async () => ({ items: [] })),
  createBankTransaction: jest.fn(),
  // invoices
  listInvoices: jest.fn(async () => ({ items: [] })),
  createInvoice: jest.fn(),
  getCustomerBalance: jest.fn(async () => null),
};

var svc = {
  createJournalEntryFromExpense: jest.fn(),
  getPartnershipEfkaSummary: jest.fn(),
  getEPEEfkaSummary: jest.fn(),
  getAEEfkaSummary: jest.fn(),
  getEfkaAnnualSummary: jest.fn(),
  calculatePartnershipTax: jest.fn(),
  calculateEPETax: jest.fn(),
  calculateAETax: jest.fn(),
  getTaxEstimate: jest.fn(),
  getVATQuarterDashboard: jest.fn(),
  getVATAnnualDashboard: jest.fn(),
  createJournalEntryFromInvoice: jest.fn(),
};

jest.mock('@/subapps/accounting/services/create-accounting-services', () => ({
  createAccountingServices: () => ({
    repository: repo,
    service: svc,
    vatEngine: {},
    taxEngine: {},
  }),
}));

var svcExtras = {
  validatePostingAllowed: jest.fn(async () => ({ allowed: true, reason: null })),
  checkCreditLimit: jest.fn(() => ({ allowed: true, warning: null })),
  updateCustomerBalance: jest.fn(async () => undefined),
};

jest.mock('@/subapps/accounting/services', () => ({
  validatePostingAllowed: (...a: unknown[]) => svcExtras.validatePostingAllowed(...a),
  checkCreditLimit: (...a: unknown[]) => svcExtras.checkCreditLimit(...a),
  updateCustomerBalance: (...a: unknown[]) => svcExtras.updateCustomerBalance(...a),
}));

jest.mock('@/subapps/accounting/services/repository/firestore-helpers', () => ({
  isoNow: () => '2026-01-01T00:00:00.000Z',
  isoToday: () => '2026-01-01',
  getFiscalYearFromDate: () => 2026,
}));

jest.mock('@/subapps/accounting/services/audited-repository-wrapper', () => ({
  createAuditedRepository: (r: unknown) => r,
}));

jest.mock('@/subapps/accounting/services/validation/entity-arrays-validator', () => ({
  validateCompanyEntityArrays: () => null,
  deriveShareholderEfkaModes: (s: unknown) => s,
}));

jest.mock('@/subapps/accounting/services/reports', () => ({
  generateReport: jest.fn(async () => ({ rows: [] })),
  VALID_REPORT_TYPES: ['profit_and_loss', 'trial_balance'],
}));

jest.mock('@/subapps/accounting/services/reports/report-date-utils', () => ({
  validateDateFilter: () => null,
  resolveReportPeriods: () => ({ current: {}, previous: {} }),
}));

jest.mock('@/subapps/accounting/services/external/openai-document-analyzer', () => ({
  createOpenAIDocumentAnalyzer: () => null,
}));

jest.mock('@/subapps/accounting/services/external/document-analyzer.stub', () => ({
  DocumentAnalyzerStub: class {
    classifyDocument = jest.fn();
    extractData = jest.fn();
  },
}));

import type { NextRequest } from 'next/server';
import { GET as catGet, POST as catPost } from '../categories/route';
import { DELETE as catDelete } from '../categories/[id]/route';
import { PATCH as docPatch } from '../documents/[id]/route';
import { GET as docGet } from '../documents/route';
import { POST as journalPost } from '../journal/route';
import { PATCH as journalPatch, DELETE as journalDelete } from '../journal/[id]/route';
import { PUT as setupPut } from '../setup/route';
import { PUT as presetsPut } from '../setup/presets/route';
import { GET as efkaGet } from '../efka/summary/route';
import { GET as taxGet } from '../tax/estimate/route';
import { GET as vatGet } from '../vat/summary/route';
import { GET as reportsGet } from '../reports/[type]/route';
import { POST as bankPost } from '../bank/transactions/route';
import { POST as invPost } from '../invoices/route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}
type Seg<T> = { params: Promise<T> };

function req(body?: unknown, url = 'https://app.test/api/accounting/x'): NextRequest {
  return { url, method: body ? 'POST' : 'GET', json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  svcExtras.validatePostingAllowed.mockResolvedValue({ allowed: true, reason: null });
  svcExtras.checkCreditLimit.mockReturnValue({ allowed: true, warning: null });
  repo.getCompanySetup.mockResolvedValue(null);
  repo.getCustomerBalance.mockResolvedValue(null);
  repo.listJournalEntries.mockResolvedValue({ items: [] });
});

describe('categories POST/GET', () => {
  it('POST valid → 201 { success:true, data: result }', async () => {
    repo.createCustomCategory.mockResolvedValue({ id: 'cc_1', code: 'custom_1' });
    const res = (await catPost(req({
      type: 'expense', label: 'X', description: 'd', mydataCode: 'm', e3Code: 'e',
      defaultVatRate: 24, vatDeductible: true, vatDeductiblePercent: 100,
    }))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'cc_1', code: 'custom_1' } });
  });

  it('GET → 200 { success:true, data }', async () => {
    repo.listCustomCategories.mockResolvedValue([{ id: 'cc_1' }]);
    const res = (await catGet(req())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'cc_1' }] });
  });
});

describe('categories/[id] DELETE — soft/hard extra fields', () => {
  const seg: Seg<{ id: string }> = { params: Promise.resolve({ id: 'cc_1' }) };

  it('in use → 200 soft_deleted + message', async () => {
    repo.getCustomCategory.mockResolvedValue({ code: 'custom_1' });
    repo.listJournalEntries.mockResolvedValue({ items: [{ id: 'je' }] });
    const res = (await catDelete(req(), seg)) as Envelope;
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect(payload.action).toBe('soft_deleted');
    expect(payload.message).toContain('απενεργοποιήθηκε');
    expect(repo.updateCustomCategory).toHaveBeenCalledWith('cc_1', { isActive: false });
    expect(repo.deleteCustomCategory).not.toHaveBeenCalled();
  });

  it('unused → 200 hard_deleted + message', async () => {
    repo.getCustomCategory.mockResolvedValue({ code: 'custom_1' });
    repo.listJournalEntries.mockResolvedValue({ items: [] });
    const res = (await catDelete(req(), seg)) as Envelope;
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.action).toBe('hard_deleted');
    expect(repo.deleteCustomCategory).toHaveBeenCalledWith('cc_1');
  });

  it('not found → 404', async () => {
    repo.getCustomCategory.mockResolvedValue(null);
    const res = (await catDelete(req(), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Category not found');
  });
});

describe('documents', () => {
  it('GET invalid fiscalYear → 400 exact message', async () => {
    const res = (await docGet(req(undefined, 'https://app.test/api/accounting/documents?fiscalYear=abc'))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('fiscalYear must be a valid year (2000-2100)');
  });

  it('[id] PATCH reject → 200 { data:{ documentId, status:rejected } }', async () => {
    repo.getExpenseDocument.mockResolvedValue({ status: 'review', notes: null });
    const seg: Seg<{ id: string }> = { params: Promise.resolve({ id: 'doc_1' }) };
    const res = (await docPatch(req({ action: 'reject' }), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { documentId: 'doc_1', status: 'rejected' } });
  });

  it('[id] PATCH not found → 404', async () => {
    repo.getExpenseDocument.mockResolvedValue(null);
    const seg: Seg<{ id: string }> = { params: Promise.resolve({ id: 'doc_1' }) };
    const res = (await docPatch(req({ action: 'reject' }), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Document not found');
  });
});

describe('journal POST — 422 validatePostingAllowed passthrough', () => {
  it('posting blocked → 422 with reason', async () => {
    svcExtras.validatePostingAllowed.mockResolvedValue({ allowed: false, reason: 'Period CLOSED' });
    const res = (await journalPost(req({
      date: '2026-01-01', type: 'income', category: 'c', description: 'd', netAmount: 100,
    }))) as Envelope;
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ success: false, error: 'Period CLOSED' });
  });

  it('allowed → 201 { data:{ entryId } }', async () => {
    repo.createJournalEntry.mockResolvedValue({ id: 'je_1' });
    const res = (await journalPost(req({
      date: '2026-01-01', type: 'income', category: 'c', description: 'd', netAmount: 100,
    }))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { entryId: 'je_1' } });
  });
});

describe('journal/[id] — 403 immutability guards', () => {
  const seg: Seg<{ id: string }> = { params: Promise.resolve({ id: 'je_1' }) };

  it('PATCH empty body → 400', async () => {
    const res = (await journalPatch(req({}), seg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No update fields provided');
  });

  it('PATCH reversed → 403', async () => {
    repo.getJournalEntry.mockResolvedValue({ status: 'REVERSED' });
    const res = (await journalPatch(req({ notes: 'x' }), seg)) as Envelope;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Cannot edit a reversed journal entry. It has been superseded by a reversal entry.');
  });

  it('PATCH isReversal → 403', async () => {
    repo.getJournalEntry.mockResolvedValue({ isReversal: true });
    const res = (await journalPatch(req({ notes: 'x' }), seg)) as Envelope;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Cannot edit a reversal journal entry. Reversal entries are immutable.');
  });

  it('DELETE reversal → 403', async () => {
    repo.getJournalEntry.mockResolvedValue({ isReversal: true });
    const res = (await journalDelete(req(), seg)) as Envelope;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Cannot delete reversed or reversal journal entries. They form an immutable audit trail.');
  });

  it('DELETE ok → 200 { data:{ entryId, deleted:true } }', async () => {
    repo.getJournalEntry.mockResolvedValue({ type: 'income', category: 'c' });
    const res = (await journalDelete(req(), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { entryId: 'je_1', deleted: true } });
  });
});

describe('setup + presets — manual validation', () => {
  it('PUT setup empty → 400 businessName is required', async () => {
    const res = (await setupPut(req({}, 'https://app.test/api/accounting/setup'))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('businessName is required');
  });

  it('PUT presets non-array → 400', async () => {
    const res = (await presetsPut(req({}, 'https://app.test/api/accounting/setup/presets'))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Request body must be an array of presets');
  });
});

describe('efka + tax/estimate — entityType extra field (sole path)', () => {
  it('efka sole → 200 { success:true, entityType:sole_proprietor, data }', async () => {
    svc.getEfkaAnnualSummary.mockResolvedValue({ total: 5 });
    const res = (await efkaGet(req(undefined, 'https://app.test/api/accounting/efka/summary?year=2026'))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, entityType: 'sole_proprietor', data: { total: 5 } });
  });

  it('efka invalid year → 400', async () => {
    const res = (await efkaGet(req(undefined, 'https://app.test/api/accounting/efka/summary?year=99'))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('year must be a valid year (2000-2100)');
  });

  it('tax/estimate sole → 200 { entityType:sole_proprietor, data }', async () => {
    svc.getTaxEstimate.mockResolvedValue({ tax: 9 });
    const res = (await taxGet(req(undefined, 'https://app.test/api/accounting/tax/estimate?fiscalYear=2026'))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, entityType: 'sole_proprietor', data: { tax: 9 } });
  });
});

describe('vat/summary — validations', () => {
  it('missing fiscalYear → 400', async () => {
    const res = (await vatGet(req(undefined, 'https://app.test/api/accounting/vat/summary'))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('fiscalYear query parameter is required');
  });

  it('invalid quarter → 400', async () => {
    const res = (await vatGet(req(undefined, 'https://app.test/api/accounting/vat/summary?fiscalYear=2026&quarter=9'))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('quarter must be 1, 2, 3, or 4');
  });
});

describe('reports/[type] — validations', () => {
  it('invalid type → 400', async () => {
    const seg: Seg<{ type: string }> = { params: Promise.resolve({ type: 'bogus' }) };
    const res = (await reportsGet(req(undefined, 'https://app.test/api/accounting/reports/bogus'), seg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Invalid report type: bogus');
  });

  it('missing preset → 400', async () => {
    const seg: Seg<{ type: string }> = { params: Promise.resolve({ type: 'profit_and_loss' }) };
    const res = (await reportsGet(req(undefined, 'https://app.test/api/accounting/reports/profit_and_loss'), seg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('preset query parameter is required');
  });
});

describe('bank/transactions + invoices — created shapes', () => {
  it('bank POST valid → 201 { data:{ transactionId } }', async () => {
    repo.createBankTransaction.mockResolvedValue({ id: 'bt_1' });
    const res = (await bankPost(req({
      accountId: 'acc_1', valueDate: '2026-01-01', direction: 'credit', amount: 100,
    }))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { transactionId: 'bt_1' } });
  });

  it('invoices POST blocked posting → 422 reason', async () => {
    svcExtras.validatePostingAllowed.mockResolvedValue({ allowed: false, reason: 'Locked period' });
    const res = (await invPost(req({
      series: 'A', type: 'service_invoice', issueDate: '2026-01-01',
    }))) as Envelope;
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ success: false, error: 'Locked period' });
  });

  it('invoices POST valid (no contact) → 201 { data:{ invoiceId, number, journalEntryId, creditWarning } }', async () => {
    repo.createInvoice.mockResolvedValue({ id: 'inv_1', number: 'A-1' });
    svc.createJournalEntryFromInvoice.mockResolvedValue({ entryId: 'je_2' });
    const res = (await invPost(req({
      series: 'A', type: 'service_invoice', issueDate: '2026-01-01',
    }))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      success: true,
      data: { invoiceId: 'inv_1', number: 'A-1', journalEntryId: 'je_2', creditWarning: null },
    });
  });

  it('invoices POST credit exceeded → 422 warning', async () => {
    repo.getCustomerBalance.mockResolvedValue({ creditLimit: 100 });
    svcExtras.checkCreditLimit.mockReturnValue({ allowed: false, warning: 'Credit exceeded' });
    const res = (await invPost(req({
      series: 'A', type: 'service_invoice', issueDate: '2026-01-01', contactId: 'cust_1',
      lineItems: [{ grossAmount: 500 }],
    }))) as Envelope;
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ success: false, error: 'Credit exceeded' });
  });
});
