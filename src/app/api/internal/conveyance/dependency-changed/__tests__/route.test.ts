/**
 * ⚓ ADR-915 §20 · ADR-905 §6 — η ΜΙΑ ροή CDC των αρχείων έχει ΔΥΟ καταναλωτές, με σειρά.
 *
 * 🔴 Η άγκυρα που μετρά: **πρώτα** τα σήματα των όψεων, **μετά** η ανάγνωση. Μια βλάβη της ανάγνωσης (5xx ⇒ επανάληψη
 * του trigger) δεν επιτρέπεται να αφήσει την όψη της μεταβίβασης χωρίς σήμα ώσπου να γιάνει ο κάδος.
 */

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }) },
}));
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withInternalWebhookRateLimit: <T>(handler: T) => handler }));
jest.mock('@/server/internal-webhooks/signed-webhook-door', () => ({
  withSignedInternalWebhook: (_options: unknown, handler: (body: unknown) => Promise<unknown>) => handler,
}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({ db: 'admin' }) }));
jest.mock('@/services/pdf/pdf-rasterize.service', () => ({ extractPdfText: jest.fn() }));

const calls: string[] = [];
const mockRelay = jest.fn(async () => { calls.push('signals'); return { cases: 1, signalled: 1 }; });
jest.mock('@/services/conveyance/conveyance-dependency-relay.server', () => ({
  relayDependencyChange: (...args: unknown[]) => mockRelay(...(args as [])),
}));
const mockReading = jest.fn();
jest.mock('@/server/files/document-text-on-file-change', () => ({
  readDocumentTextOnFileChange: (...args: unknown[]) => mockReading(...args),
}));

import { POST } from '../route';

const FILE_EVENT = { eventId: 'evt_1', source: 'file', docId: 'file_1', before: null, after: { companyId: 'c1', status: 'ready' } };
type Handler = (body: unknown) => Promise<{ status: number; json: () => Promise<Record<string, unknown>> }>;
const post = POST as unknown as Handler;

beforeEach(() => {
  calls.length = 0;
  mockRelay.mockClear();
  mockReading.mockReset();
});

describe('POST /api/internal/conveyance/dependency-changed — δύο καταναλωτές (ADR-915 §20)', () => {
  it('σήματα ΠΡΩΤΑ, ανάγνωση ΜΕΤΑ — και η έκβαση της ανάγνωσης στο σώμα', async () => {
    mockReading.mockImplementation(async () => { calls.push('reading'); return { kind: 'recorded' }; });
    const response = await post(FILE_EVENT);
    expect(calls).toEqual(['signals', 'reading']);
    await expect(response.json()).resolves.toEqual({ ok: true, cases: 1, signalled: 1, documentText: 'recorded' });
  });

  it('🔴 βλάβη της ανάγνωσης ⇒ πετά (επανάληψη του trigger) — αλλά τα σήματα έχουν ΗΔΗ φύγει', async () => {
    mockReading.mockRejectedValue(new Error('503 storage'));
    await expect(post(FILE_EVENT)).rejects.toThrow('503 storage');
    expect(calls).toEqual(['signals']);
  });

  it('δεν χρειάζεται ανάγνωση ⇒ `documentText: null`', async () => {
    mockReading.mockResolvedValue(null);
    await expect((await post(FILE_EVENT)).json()).resolves.toMatchObject({ documentText: null });
  });
});
