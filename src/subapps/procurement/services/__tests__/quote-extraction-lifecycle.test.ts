/**
 * ΑΓΚΥΡΑ — **ο κύκλος ζωής της εξαγωγής: compare-and-set + fencing token** (ADR-327 §6.10, 2026-11-03).
 *
 * - «Επανάληψη» ξεκινά ΜΙΑ προσπάθεια (δεύτερο κλικ ⇒ `in_progress`, καμία εγγραφή).
 * - Η αποτυχία γράφεται ΜΟΝΟ από την τρέχουσα προσπάθεια: μια κολλημένη διεργασία που τελειώνει μετά την
 *   επανάληψη δεν σβήνει τη ζωντανή νεότερη.
 */

/* global describe, it, expect, beforeEach, jest */

import type { AuthContext } from '@/lib/auth';
import { markQuoteExtractionFailed, markQuoteExtractionPending } from '../quote-extraction-lifecycle';
import { QUOTE_EXTRACTION_STALE_AFTER_MS } from '../../utils/quote-intake-view';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('firebase-admin', () => ({
  __esModule: true,
  default: { firestore: { Timestamp: { now: () => ({ toDate: () => new Date() }) } } },
}));
jest.mock('../quote-change-stamp', () => ({ quoteChangeStamp: () => ({ updatedBy: 'u_1' }) }));
jest.mock('../procurement-owned-doc', () => ({
  PROCUREMENT_RESOURCE: { QUOTE: 'quote' },
  requireOwnedSnapshot: (snap: { data: () => Record<string, unknown> }) => ({ id: 'qt_1', ...snap.data() }),
}));

let stored: Record<string, unknown> = {};
const txUpdate = jest.fn();
const fakeDb = {
  collection: () => ({ doc: () => ({ id: 'qt_1' }) }),
  runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
    fn({ get: async () => ({ exists: true, data: () => stored }), update: txUpdate }),
};
jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: (op: (db: unknown) => unknown) => op(fakeDb),
}));

const ctx = { uid: 'u_1', companyId: 'co_1' } as unknown as AuthContext;
const ago = (ms: number) => ({ toDate: () => new Date(Date.now() - ms) });
const scanQuote = (extraction: Record<string, unknown> | undefined, extra: Record<string, unknown> = {}) => ({
  companyId: 'co_1', source: 'scan', extractedData: null, notes: null, createdAt: ago(1000), auditTrail: [], extraction, ...extra,
});
const written = () => txUpdate.mock.calls[0][1] as { extraction: Record<string, unknown>; auditTrail: Array<{ action: string; newValue: string }> };

beforeEach(() => txUpdate.mockClear());

describe('markQuoteExtractionPending — «Επανάληψη»', () => {
  it('Λ1 — failed ⇒ νέα pending, προσπάθεια +1, γραμμή ιστορικού', async () => {
    stored = scanQuote({ status: 'failed', startedAt: ago(60_000), errorCode: 'analyzer_failed', attempt: 2 });
    await expect(markQuoteExtractionPending(ctx, 'qt_1')).resolves.toEqual({ outcome: 'started', attempt: 3 });
    expect(written().extraction).toMatchObject({ status: 'pending', attempt: 3, errorCode: null, finishedAt: null });
    expect(written().auditTrail.at(-1)).toMatchObject({ action: 'extraction_retried', newValue: 'attempt=3' });
  });

  it('Λ2 — κολλημένη pending ⇒ ξεκινά νέα', async () => {
    stored = scanQuote({ status: 'pending', startedAt: ago(QUOTE_EXTRACTION_STALE_AFTER_MS + 1000), errorCode: null, attempt: 1 });
    await expect(markQuoteExtractionPending(ctx, 'qt_1')).resolves.toEqual({ outcome: 'started', attempt: 2 });
  });

  it('Λ3 — ζωντανή pending ⇒ in_progress, ΚΑΜΙΑ εγγραφή (δύο κλικ = μία προσπάθεια)', async () => {
    stored = scanQuote({ status: 'pending', startedAt: ago(5_000), errorCode: null, attempt: 1 });
    await expect(markQuoteExtractionPending(ctx, 'qt_1')).resolves.toEqual({ outcome: 'in_progress' });
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['πύλη χωρίς εξαγωγή', { source: 'portal' }],
    ['ήδη εξαγμένη', { extractedData: { overallConfidence: 80 } }],
  ])('Λ4 — %s ⇒ not_retryable, καμία εγγραφή', async (_label, extra) => {
    stored = scanQuote(undefined, extra);
    await expect(markQuoteExtractionPending(ctx, 'qt_1')).resolves.toEqual({ outcome: 'not_retryable' });
    expect(txUpdate).not.toHaveBeenCalled();
  });
});

describe('markQuoteExtractionFailed — fencing token', () => {
  it('Φ1 — η τρέχουσα προσπάθεια γράφει failed + κωδικό, κρατά έναρξη και αριθμό', async () => {
    const startedAt = ago(20_000);
    stored = scanQuote({ status: 'pending', startedAt, errorCode: null, attempt: 2 });
    await markQuoteExtractionFailed(ctx, 'qt_1', 'not_a_quote', 2);
    expect(written().extraction).toMatchObject({ status: 'failed', errorCode: 'not_a_quote', attempt: 2, startedAt });
    expect(written().auditTrail.at(-1)).toMatchObject({ action: 'extraction_failed', newValue: 'not_a_quote' });
  });

  it('Φ2 — παλιά προσπάθεια (1) μετά από επανάληψη (2) ⇒ ΚΑΜΙΑ εγγραφή', async () => {
    stored = scanQuote({ status: 'pending', startedAt: ago(1000), errorCode: null, attempt: 2 });
    await markQuoteExtractionFailed(ctx, 'qt_1', 'analyzer_failed', 1);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('Φ3 — υπάρχουν ήδη δεδομένα ⇒ η αποτυχία δεν τα σκεπάζει', async () => {
    stored = scanQuote({ status: 'succeeded', startedAt: ago(1000), errorCode: null, attempt: 1 }, { extractedData: { overallConfidence: 70 } });
    await markQuoteExtractionFailed(ctx, 'qt_1', 'analyzer_failed', 1);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('Φ4 — έγγραφο πριν το §6.10 (χωρίς `extraction`) μετρά ως προσπάθεια 1', async () => {
    stored = scanQuote(undefined);
    await markQuoteExtractionFailed(ctx, 'qt_1', 'document_unavailable', 1);
    expect(written().extraction).toMatchObject({ status: 'failed', errorCode: 'document_unavailable', attempt: 1 });
  });
});
