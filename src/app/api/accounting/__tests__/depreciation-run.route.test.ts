/**
 * Contract tests — αποσβέσεις χρήσης + φρουροί Βιβλίου Ε-Ε (ADR-ACC-010 §2.1.1 Φάση 5), μέσα από το ΠΡΑΓΜΑΤΙΚΟ
 * `defineRoute`.
 *
 *   Ρ1  GET προεπισκόπηση: κάθε συνδεδεμένος· POST καταχώριση / αναίρεση: ΜΟΝΟ διοικητικός ρόλος
 *   Ρ2  σώμα: ακέραιο έτος στα όρια, τίποτε άλλο (`strict`)
 *   Ρ3  αρνήσεις της μηχανής ⇒ 409 / 422 με `errorCode` (ADR-284), ποτέ 500 με κείμενο
 *   Ρ4  Βιβλίο Ε-Ε: εγγραφή υποσυστήματος ΔΕΝ αλλάζει / σβήνεται · κατηγορία υποσυστήματος ΔΕΝ γράφεται χειροκίνητα
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

/** Το σύνορο τιμά τον ΔΗΛΩΜΕΝΟ ρόλο της διαδρομής — ό,τι δεν δηλώνεται, δεν φυλάσσεται. */
jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>, options?: { requiredGlobalRoles?: readonly string[] }) =>
    async (request: unknown, segmentData?: unknown) => {
      if (options?.requiredGlobalRoles && !options.requiredGlobalRoles.includes(authCtx.globalRole)) {
        return { status: 403, json: async () => ({ success: false, error: 'Forbidden' }) };
      }
      return callback(request, authCtx, { cache: true }, segmentData);
    },
  logAuditEvent: jest.fn(async () => undefined),
  logEntityDeletion: jest.fn(async () => undefined),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

var service = {
  previewYearEndDepreciation: jest.fn(),
  runYearEndDepreciation: jest.fn(),
  reverseYearEndDepreciation: jest.fn(),
};
var repository = {
  getJournalEntry: jest.fn(),
  updateJournalEntry: jest.fn(async () => undefined),
  deleteJournalEntry: jest.fn(async () => undefined),
  createJournalEntry: jest.fn(async () => ({ id: 'je_1' })),
};

jest.mock('@/subapps/accounting/services/create-accounting-services', () => ({
  createAccountingServices: () => ({ service, repository }),
}));

import type { NextRequest } from 'next/server';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { DepreciationRunError } from '@/subapps/accounting/services/engines/depreciation-engine';
import { InvalidDepreciationTermsError } from '@/subapps/accounting/services/engines/depreciation-schedule';
import { DepreciationPeriodClosedError } from '@/subapps/accounting/services/repository/accounting-repo-depreciation';
import { GET as previewGet, POST as runPost } from '../assets/depreciation-run/route';
import { POST as reversalPost } from '../assets/depreciation-run/reversal/route';
import { POST as journalPost } from '../journal/route';
import { DELETE as journalDelete, PATCH as journalPatch } from '../journal/[id]/route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}

function req(body?: unknown, url = 'https://app.test/api/accounting/assets/depreciation-run?fiscalYear=2025'): NextRequest {
  return { url, method: body ? 'POST' : 'GET', json: async () => body } as unknown as NextRequest;
}

const seg = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  authCtx.globalRole = ADMINISTRATIVE_ROLES[0];
});

describe('Ρ1 — ποιος μπορεί', () => {
  it('GET προεπισκόπηση: ο καλών χωρίς διοικητικό ρόλο τη βλέπει', async () => {
    authCtx.globalRole = 'internal_user';
    service.previewYearEndDepreciation.mockResolvedValue({ fiscalYear: 2025, lines: [] });

    const res = (await previewGet(req())) as Envelope;

    expect(res.status).toBe(200);
    expect(service.previewYearEndDepreciation).toHaveBeenCalledWith(2025);
    expect((await res.json()).data).toEqual({ fiscalYear: 2025, lines: [] });
  });

  it.each([
    ['καταχώριση', () => runPost(req({ fiscalYear: 2025 })), () => service.runYearEndDepreciation],
    ['αναίρεση', () => reversalPost(req({ fiscalYear: 2025 })), () => service.reverseYearEndDepreciation],
  ] as const)('%s χωρίς διοικητικό ρόλο ⇒ 403, τίποτα δεν εκτελείται', async (_label, call, target) => {
    authCtx.globalRole = 'internal_user';

    const res = (await call()) as Envelope;

    expect(res.status).toBe(403);
    expect(target()).not.toHaveBeenCalled();
  });

  it('καταχώριση με διοικητικό ρόλο ⇒ 200 με το αποτέλεσμα', async () => {
    service.runYearEndDepreciation.mockResolvedValue({ fiscalYear: 2025, bookedDelta: 1200 });

    const res = (await runPost(req({ fiscalYear: 2025 }))) as Envelope;

    expect(res.status).toBe(200);
    expect(service.runYearEndDepreciation).toHaveBeenCalledWith(2025);
  });
});

describe('Ρ2 — σώμα', () => {
  it.each([[{}], [{ fiscalYear: '2025' }], [{ fiscalYear: 2025.5 }], [{ fiscalYear: 1999 }], [{ fiscalYear: 2025, force: true }]])(
    '%o ⇒ 400, καμία εκτέλεση', async (body) => {
      const res = (await runPost(req(body))) as Envelope;

      expect(res.status).toBe(400);
      expect(service.runYearEndDepreciation).not.toHaveBeenCalled();
    });
});

describe('Ρ3 — αρνήσεις με κωδικό', () => {
  it.each([
    [new DepreciationRunError('FISCAL_YEAR_NOT_ENDED', 2025), 409, 'FISCAL_YEAR_NOT_ENDED'],
    [new DepreciationRunError('PERIOD_NOT_FOUND', 2025), 409, 'PERIOD_NOT_FOUND'],
    [new DepreciationPeriodClosedError('PERIOD_NOT_OPEN', '2025-12'), 409, 'PERIOD_NOT_OPEN'],
    [new InvalidDepreciationTermsError('depreciationStartDate', 'x'), 422, 'INVALID_DEPRECIATION_TERMS'],
  ])('%s ⇒ %i %s', async (error, status, errorCode) => {
    service.runYearEndDepreciation.mockRejectedValue(error);

    const res = (await runPost(req({ fiscalYear: 2025 }))) as Envelope;

    expect(res.status).toBe(status);
    expect((await res.json()).errorCode).toBe(errorCode);
  });
});

describe('Ρ4 — Βιβλίο Ε-Ε: εγγραφές υποσυστήματος', () => {
  const depreciationEntry = {
    entryId: 'je_depr', category: 'depreciation', status: 'ACTIVE',
    source: { kind: 'depreciation', depreciationRecordId: 'depr_1', assetId: 'ast_1', fiscalYear: 2025, revision: 1 },
  };

  it('PATCH / DELETE εγγραφής απόσβεσης ⇒ 403 `JOURNAL_ENTRY_SUBSYSTEM_OWNED`, τίποτα δεν αλλάζει', async () => {
    repository.getJournalEntry.mockResolvedValue(depreciationEntry);

    const patched = (await journalPatch(req({ notes: 'x' }), seg('je_depr'))) as Envelope;
    const deleted = (await journalDelete(req(), seg('je_depr'))) as Envelope;

    expect([patched.status, deleted.status]).toEqual([403, 403]);
    expect((await deleted.json()).errorCode).toBe('JOURNAL_ENTRY_SUBSYSTEM_OWNED');
    expect(repository.updateJournalEntry).not.toHaveBeenCalled();
    expect(repository.deleteJournalEntry).not.toHaveBeenCalled();
  });

  it.each([
    [{ category: 'depreciation' }],
    [{ category: 'other_expense', source: { kind: 'depreciation' } }],
  ])('χειροκίνητη εγγραφή %o ⇒ 422 `JOURNAL_CATEGORY_SUBSYSTEM_OWNED`', async (override) => {
    const body = { date: '2025-12-31', type: 'expense', description: 'x', netAmount: 100, ...override };

    const res = (await journalPost(req(body))) as Envelope;

    expect(res.status).toBe(422);
    expect((await res.json()).errorCode).toBe('JOURNAL_CATEGORY_SUBSYSTEM_OWNED');
    expect(repository.createJournalEntry).not.toHaveBeenCalled();
  });
});
