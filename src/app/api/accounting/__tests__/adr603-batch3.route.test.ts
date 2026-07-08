/**
 * Contract tests — ADR-603 accounting migration batch-3 (heavy routes).
 *
 * Proves each defineRoute-migrated heavy route is BYTE-IDENTICAL to its previous
 * inline handler: same envelopes, status codes, messages and the contract-risky
 * shapes — through the REAL factory + REAL safeParseBody / safeJsonBody + REAL
 * zod schemas (invoice-schemas, bank-match-validation):
 *
 *   - invoices/[id]:            403 immutability, 409 already-cancelled,
 *                               DELETE dual success shapes (voided / credit_note),
 *                               400 unknown-status, 404, 400 no-fields
 *   - invoices/[id]/send-email: 400 Invalid JSON, 422 (no email / required),
 *                               404, 502 mailgun-fail, success shape
 *   - bank/match:              object-`error` problemResponse passthrough (404/409),
 *                               400 zod union, success `{...result, version}`
 *   - bank/reconcile:          403 segregation (object error) + 403 admin-only
 *                               (string error, checked BEFORE parse), 400/409
 *                               problemResponse, dual success shapes
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
  companyId: 'comp_1',
  email: 'g@example.com',
  globalRole: 'company_admin',
  mfaEnrolled: true,
  isAuthenticated: true as const,
};

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segmentData?: unknown) =>
      callback(request, authCtx, { cache: true }, segmentData),
  logAuditEvent: jest.fn(async () => undefined),
  logFinancialTransition: jest.fn(async () => undefined),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

var repo = {
  // invoices/[id]
  getInvoice: jest.fn(),
  updateInvoice: jest.fn(async () => undefined),
  getCompanySetup: jest.fn(async () => null),
  // bank
  getBankTransaction: jest.fn(),
  updateBankTransaction: jest.fn(async () => undefined),
};

var matchingEngine = {
  matchTransaction: jest.fn(async () => ({ status: 'matched', confidence: 0.9 })),
  matchGroup: jest.fn(async () => ({ matched: 2 })),
};

jest.mock('@/subapps/accounting/services/create-accounting-services', () => ({
  createAccountingServices: () => ({
    repository: repo,
    matchingEngine,
    service: {},
    vatEngine: {},
    taxEngine: {},
  }),
}));

var svcExtras = {
  updateCustomerBalance: jest.fn(async () => undefined),
};

jest.mock('@/subapps/accounting/services', () => ({
  updateCustomerBalance: (...a: unknown[]) => svcExtras.updateCustomerBalance(...a),
}));

var reversal = {
  reverseJournalEntryForCancelledInvoice: jest.fn(async () => ({ reversalEntryId: 'rev_1' })),
  createCreditNoteForInvoice: jest.fn(async () => ({
    creditNoteId: 'cn_1',
    creditNoteNumber: 'CN-1',
    reversalEntryId: 'rev_2',
  })),
};

jest.mock('@/subapps/accounting/services/reversal-service', () => ({
  reverseJournalEntryForCancelledInvoice: (...a: unknown[]) => reversal.reverseJournalEntryForCancelledInvoice(...a),
  createCreditNoteForInvoice: (...a: unknown[]) => reversal.createCreditNoteForInvoice(...a),
}));

jest.mock('@/subapps/accounting/services/repository/firestore-helpers', () => ({
  getFiscalYearFromDate: () => 2026,
}));

var bankExtras = {
  validatePostingAllowed: jest.fn(async () => ({ allowed: true, periodId: 'p1', periodStatus: 'OPEN', reason: null })),
  logAccountingEvent: jest.fn(async () => undefined),
};

jest.mock('@/subapps/accounting/services/fiscal-period-service', () => ({
  validatePostingAllowed: (...a: unknown[]) => bankExtras.validatePostingAllowed(...a),
}));

jest.mock('@/subapps/accounting/services/accounting-audit-service', () => ({
  logAccountingEvent: (...a: unknown[]) => bankExtras.logAccountingEvent(...a),
}));

// ── send-email dependency mocks ─────────────────────────────────────────────
var mailgun = { result: { success: true, messageId: 'mg_1', error: null } as { success: boolean; messageId: string | null; error: string | null } };
var orgResolver = { result: null as null | { email: string; source: string } };

jest.mock('@/subapps/accounting/services/pdf/invoice-pdf-exporter', () => ({
  extractKadFromProfile: () => '62010',
}));

jest.mock('@/subapps/accounting/services/email/invoice-email-template', () => ({
  buildInvoiceEmailContent: () => '<p>content</p>',
  buildInvoiceEmailSubject: () => 'Subject',
  buildInvoiceEmailPlainText: () => 'text',
  detectInvoiceEmailLanguage: () => 'el',
}));

jest.mock('@/services/email-templates/base-email-template', () => ({
  wrapInBrandedTemplate: () => '<html></html>',
}));

jest.mock('@/services/ai-pipeline/shared/mailgun-sender', () => ({
  sendReplyViaMailgun: jest.fn(async () => mailgun.result),
}));

jest.mock('@/services/org-structure/org-routing-resolver', () => ({
  resolveContactDepartmentEmail: jest.fn(async () => orgResolver.result),
}));

jest.mock('@/subapps/accounting/services/pdf/invoice-pdf-template', () => ({
  renderInvoicePDF: jest.fn(async () => ({ output: () => new ArrayBuffer(16) })),
}), { virtual: true });

jest.mock('@/subapps/accounting/services/pdf/logo-data', () => ({
  PAGONIS_LOGO_BASE64: 'data:image/png;base64,AAAA',
}), { virtual: true });

import type { NextRequest } from 'next/server';
import { GET as invGet, PATCH as invPatch, DELETE as invDelete } from '../invoices/[id]/route';
import { POST as emailPost } from '../invoices/[id]/send-email/route';
import { POST as matchPost } from '../bank/match/route';
import { POST as reconcilePost, PATCH as reconcilePatch } from '../bank/reconcile/route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}
type Seg<T> = { params: Promise<T> };

function req(body?: unknown, url = 'https://app.test/api/accounting/x'): NextRequest {
  return {
    url,
    method: body === undefined ? 'GET' : 'POST',
    json: async () => {
      if (body === '__BAD_JSON__') throw new SyntaxError('bad json');
      return body;
    },
  } as unknown as NextRequest;
}

const seg = (id = 'inv_1'): Seg<{ id: string }> => ({ params: Promise.resolve({ id }) });

function fullInvoice(overrides: Record<string, unknown> = {}) {
  return {
    series: 'A',
    number: '1',
    issueDate: '2026-01-15',
    customer: { name: 'ACME LTD', country: 'GR', contactId: null },
    issuer: {
      name: 'Pagonis', phone: '210', email: 'i@x.com', address: 'Str 1',
      city: 'Athens', postalCode: '11111', website: 'x.com', bankAccounts: [],
    },
    emailHistory: [],
    mydata: { status: 'draft' },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  authCtx.globalRole = 'company_admin';
  authCtx.email = 'g@example.com';
  repo.getCompanySetup.mockResolvedValue(null);
  bankExtras.validatePostingAllowed.mockResolvedValue({ allowed: true, periodId: 'p1', periodStatus: 'OPEN', reason: null });
  mailgun.result = { success: true, messageId: 'mg_1', error: null };
  orgResolver.result = null;
});

// ===========================================================================
// invoices/[id]
// ===========================================================================

describe('invoices/[id] — GET/PATCH/DELETE', () => {
  it('GET found → 200 { success:true, data:invoice }', async () => {
    repo.getInvoice.mockResolvedValue({ id: 'inv_1', number: 'A-1' });
    const res = (await invGet(req(), seg())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: 'inv_1', number: 'A-1' } });
  });

  it('GET not found → 404 Invoice not found', async () => {
    repo.getInvoice.mockResolvedValue(null);
    const res = (await invGet(req(), seg())) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Invoice not found');
  });

  it('PATCH empty body → 400 No update fields provided', async () => {
    const res = (await invPatch(req({}), seg())) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No update fields provided');
  });

  it('PATCH immutable status → 403 exact message', async () => {
    repo.getInvoice.mockResolvedValue({ mydata: { status: 'sent' }, customer: {} });
    const res = (await invPatch(req({ notes: 'x' }), seg())) as Envelope;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(
      "Cannot edit invoice with myDATA status 'sent'. Only draft or rejected invoices are editable."
    );
  });

  it('PATCH not found → 404', async () => {
    repo.getInvoice.mockResolvedValue(null);
    const res = (await invPatch(req({ notes: 'x' }), seg())) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Invoice not found');
  });

  it('PATCH ok → 200 { data:{ invoiceId, updated:true } }', async () => {
    repo.getInvoice.mockResolvedValue({ mydata: { status: 'draft' }, customer: {} });
    const res = (await invPatch(req({ notes: 'x' }), seg())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { invoiceId: 'inv_1', updated: true } });
  });

  it('DELETE already cancelled → 409', async () => {
    repo.getInvoice.mockResolvedValue({ mydata: { status: 'cancelled' } });
    const res = (await invDelete(req({ reasonCode: 'DUPLICATE' }), seg())) as Envelope;
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Invoice is already cancelled');
  });

  it('DELETE voidable (draft) → 200 action:voided + reversalEntryId', async () => {
    repo.getInvoice.mockResolvedValue({ mydata: { status: 'draft' }, customer: {}, issueDate: '2026-01-01' });
    const res = (await invDelete(req({ reasonCode: 'DUPLICATE' }), seg())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { invoiceId: 'inv_1', action: 'voided', cancelled: true, reversalEntryId: 'rev_1' },
    });
  });

  it('DELETE credit-note (sent) → 200 action:credit_note_issued', async () => {
    repo.getInvoice.mockResolvedValue({ mydata: { status: 'sent' }, customer: {}, issueDate: '2026-01-01' });
    const res = (await invDelete(req({ reasonCode: 'GOODS_RETURNED' }), seg())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        invoiceId: 'inv_1', action: 'credit_note_issued',
        creditNoteId: 'cn_1', creditNoteNumber: 'CN-1', reversalEntryId: 'rev_2',
      },
    });
  });

  it('DELETE unknown status → 400 Cannot cancel', async () => {
    repo.getInvoice.mockResolvedValue({ mydata: { status: 'weird' } });
    const res = (await invDelete(req({ reasonCode: 'DUPLICATE' }), seg())) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Cannot cancel invoice with status 'weird'");
  });

  it('DELETE not found → 404', async () => {
    repo.getInvoice.mockResolvedValue(null);
    const res = (await invDelete(req({ reasonCode: 'DUPLICATE' }), seg())) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Invoice not found');
  });
});

// ===========================================================================
// invoices/[id]/send-email
// ===========================================================================

describe('invoices/[id]/send-email — POST', () => {
  it('invalid JSON → 400 Invalid JSON body', async () => {
    const res = (await emailPost(req('__BAD_JSON__'), seg())) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON body');
  });

  it('no recipient + no contact → 422 required', async () => {
    const res = (await emailPost(req({}), seg())) as Envelope;
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('recipientEmail or customerContactId required');
  });

  it('contactId with no accounting email → 422', async () => {
    orgResolver.result = null;
    const res = (await emailPost(req({ customerContactId: 'c_1' }), seg())) as Envelope;
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('No accounting email found for contact');
  });

  it('valid email but invoice not found → 404', async () => {
    repo.getInvoice.mockResolvedValue(null);
    const res = (await emailPost(req({ recipientEmail: 'c@x.com' }), seg())) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Invoice not found');
  });

  it('mailgun failure → 502', async () => {
    repo.getInvoice.mockResolvedValue(fullInvoice());
    mailgun.result = { success: false, messageId: null, error: 'SMTP down' };
    const res = (await emailPost(req({ recipientEmail: 'c@x.com' }), seg())) as Envelope;
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('SMTP down');
  });

  it('success → 200 { data:{ mailgunMessageId, recipientEmail, subject } }', async () => {
    repo.getInvoice.mockResolvedValue(fullInvoice());
    mailgun.result = { success: true, messageId: 'mg_9', error: null };
    const res = (await emailPost(req({ recipientEmail: 'c@x.com' }), seg())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { mailgunMessageId: 'mg_9', recipientEmail: 'c@x.com', subject: 'Subject' },
    });
  });
});

// ===========================================================================
// bank/match
// ===========================================================================

describe('bank/match — POST', () => {
  const single = { transactionId: 't1', entityId: 'e1', entityType: 'invoice' };

  it('zod invalid → 400 Validation failed', async () => {
    const res = (await matchPost(req({}))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('transaction not found → 404 object error TRANSACTION_NOT_FOUND', async () => {
    repo.getBankTransaction.mockResolvedValue(null);
    const res = (await matchPost(req(single))) as Envelope;
    expect(res.status).toBe(404);
    const err = (await res.json()).error as Record<string, unknown>;
    expect(err.code).toBe('TRANSACTION_NOT_FOUND');
    expect(err.status).toBe(404);
  });

  it('already matched → 409 object error ALREADY_MATCHED', async () => {
    repo.getBankTransaction.mockResolvedValue({ matchStatus: 'manual_matched', direction: 'credit', amount: 100 });
    const res = (await matchPost(req(single))) as Envelope;
    expect(res.status).toBe(409);
    expect(((await res.json()).error as Record<string, unknown>).code).toBe('ALREADY_MATCHED');
  });

  it('success → 200 { data:{ ...result, version } }', async () => {
    repo.getBankTransaction.mockResolvedValue({ matchStatus: 'unmatched', direction: 'credit', amount: 100, version: 0 });
    const res = (await matchPost(req(single))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { status: 'matched', confidence: 0.9, version: 1 },
    });
    expect(repo.updateBankTransaction).toHaveBeenCalledWith('t1', { version: 1, matchedByName: 'g@example.com' });
  });
});

// ===========================================================================
// bank/reconcile
// ===========================================================================

describe('bank/reconcile — POST reconcile', () => {
  it('not matched → 400 object error NOT_MATCHED', async () => {
    repo.getBankTransaction.mockResolvedValue({ matchStatus: 'unmatched' });
    const res = (await reconcilePost(req({ transactionId: 't1' }))) as Envelope;
    expect(res.status).toBe(400);
    expect(((await res.json()).error as Record<string, unknown>).code).toBe('NOT_MATCHED');
  });

  it('already reconciled → 409 object error ALREADY_RECONCILED', async () => {
    repo.getBankTransaction.mockResolvedValue({ matchStatus: 'reconciled' });
    const res = (await reconcilePost(req({ transactionId: 't1' }))) as Envelope;
    expect(res.status).toBe(409);
    expect(((await res.json()).error as Record<string, unknown>).code).toBe('ALREADY_RECONCILED');
  });

  it('segregation violation (self-matched, non-super_admin) → 403 object error', async () => {
    repo.getBankTransaction.mockResolvedValue({ matchStatus: 'manual_matched', matchedByName: 'g@example.com', version: 0 });
    const res = (await reconcilePost(req({ transactionId: 't1' }))) as Envelope;
    expect(res.status).toBe(403);
    expect(((await res.json()).error as Record<string, unknown>).code).toBe('SEGREGATION_VIOLATION');
  });

  it('success → 200 { data:{ status:reconciled, version } }', async () => {
    repo.getBankTransaction.mockResolvedValue({ matchStatus: 'manual_matched', matchedByName: 'other@x.com', version: 0 });
    const res = (await reconcilePost(req({ transactionId: 't1' }))) as Envelope;
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect((payload.data as Record<string, unknown>).status).toBe('reconciled');
    expect((payload.data as Record<string, unknown>).version).toBe(1);
  });
});

describe('bank/reconcile — PATCH admin unlock', () => {
  it('non-admin → 403 STRING error, BEFORE zod parse (invalid body still 403)', async () => {
    authCtx.globalRole = 'accountant';
    const res = (await reconcilePatch(req({}))) as Envelope;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Only admin can unlock reconciled transactions');
  });

  it('admin + not reconciled → 400 object error NOT_RECONCILED', async () => {
    repo.getBankTransaction.mockResolvedValue({ matchStatus: 'manual_matched' });
    const res = (await reconcilePatch(req({ transactionId: 't1', reason: 'valid reason' }))) as Envelope;
    expect(res.status).toBe(400);
    expect(((await res.json()).error as Record<string, unknown>).code).toBe('NOT_RECONCILED');
  });

  it('admin unlock success → 200 { data:{ status:manual_matched, reason, version } }', async () => {
    repo.getBankTransaction.mockResolvedValue({ matchStatus: 'reconciled', version: 0 });
    const res = (await reconcilePatch(req({ transactionId: 't1', reason: 'valid reason' }))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { transactionId: 't1', status: 'manual_matched', unlockedBy: 'user_1', reason: 'valid reason', version: 1 },
    });
  });
});
