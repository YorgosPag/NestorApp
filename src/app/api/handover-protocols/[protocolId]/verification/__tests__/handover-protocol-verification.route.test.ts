/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Γ44 (Φ-Γ2 Σ6) — **η δημόσια πόρτα επαλήθευσης**: δέχεται μόνο `phpr_<uuid v4>` και 64 hex,
 * δεν μαντεύει ποτέ «χαρτί» από άκυρο hash, δεν αποθηκεύεται σε κρυφή μνήμη, και η απάντηση δεν κουβαλά τίποτα του
 * ενοικιαστή. Μέσα από τον **πραγματικό** handler και τον πραγματικό αναγνώστη μητρώου — ψεύτικο μόνο το Firestore.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200, headers: init?.headers ?? {}, json: async () => body,
    }),
  },
}));

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withSensitiveRateLimit: jest.fn(<T>(handler: T) => handler) }));

jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));

var docs: Record<string, Record<string, unknown> | undefined> = {};
var reads: string[] = [];
var failing = false;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (failing) throw new Error('firestore down');
          reads.push(`${name}/${id}`);
          return { data: () => docs[`${name}/${id}`] };
        },
      }),
    }),
  }),
}));

import { GET } from '../route';

const ID = 'phpr_a387d0b1-9ad7-4af3-8db1-b8faf2f9bf16';
const PDF_SHA = 'c'.repeat(64);

const PROTOCOL = {
  revision: 2, digest: 'd'.repeat(64), issuedAt: '2026-10-22T10:00:00.000Z', companyFileId: 'file_co', recipientFileId: 'file_rc',
  companyId: 'comp_1', propertyId: 'prop_1', handoverId: 'phov_1', recipientUserId: 'user_1', supersedesProtocolId: null,
  pdfSha256: PDF_SHA, legalText: { version: 1, digest: 'sha256:xyz' }, rows: 3, bytes: 300,
};

const HANDOVER = {
  companyId: 'comp_1', propertyId: 'prop_1', recipientContactId: 'cont_1', lifecycle: 'ready',
  createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-22T10:00:00.000Z',
  protocol: { protocolId: ID, revision: 2, digest: 'd'.repeat(64), issuedAt: '2026-10-22T10:00:00.000Z', companyFileId: 'file_co', recipientFileId: 'file_rc' },
};

interface Reply { readonly status: number; readonly headers: Record<string, string>; json(): Promise<Record<string, unknown>> }

async function call(protocolId: string, query = ''): Promise<Reply> {
  const request = { nextUrl: new URL(`https://nestorconstruct.gr/api/handover-protocols/${protocolId}/verification${query}`) };
  const handler = GET as unknown as (req: typeof request, ctx: { params: Promise<{ protocolId: string }> }) => Promise<Reply>;
  return handler(request, { params: Promise.resolve({ protocolId }) });
}

beforeEach(() => {
  docs = { [`property_handover_protocols/${ID}`]: PROTOCOL, 'property_handovers/phov_1': HANDOVER };
  reads = [];
  failing = false;
});

describe('Γ44 — η δημόσια πόρτα επαλήθευσης', () => {
  it('δηλώνει όριο ρυθμού SENSITIVE (πόρτα χωρίς ταυτότητα)', () => {
    expect(jest.requireMock('@/lib/middleware/with-rate-limit').withSensitiveRateLimit).toHaveBeenCalledTimes(1);
  });

  it('ίδια bytes ⇒ registered · match · current, με no-store + no-referrer', async () => {
    const reply = await call(ID, `?sha256=${PDF_SHA}`);
    expect(reply.status).toBe(200);
    expect(reply.headers).toEqual({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    await expect(reply.json()).resolves.toMatchObject({ ok: true, registry: { kind: 'registered', file: 'match', standing: { kind: 'current' } } });
  });

  it('χωρίς sha256 (χαρτί) ⇒ not-provided · άλλο sha256 ⇒ mismatch', async () => {
    await expect((await call(ID)).json()).resolves.toMatchObject({ registry: { file: 'not-provided' } });
    await expect((await call(ID, `?sha256=${'e'.repeat(64)}`)).json()).resolves.toMatchObject({ registry: { file: 'mismatch' } });
  });

  it('🔴 άκυρο sha256 ⇒ 400, ΠΟΤΕ σιωπηλή υποβάθμιση σε «χαρτί» — και καμία ανάγνωση', async () => {
    for (const query of ['?sha256=', `?sha256=${'C'.repeat(64)}`, '?sha256=abc']) {
      const reply = await call(ID, query);
      expect(reply.status).toBe(400);
      await expect(reply.json()).resolves.toEqual({ ok: false, reason: 'request-invalid' });
    }
    expect(reads).toEqual([]);
  });

  it('🔴 ταυτότητα που δεν είναι phpr_<uuid v4> ⇒ 400, καμία ανάγνωση', async () => {
    for (const id of ['phov_a387d0b1-9ad7-4af3-8db1-b8faf2f9bf16', 'phpr_x', '..%2Fusers']) expect((await call(id)).status).toBe(400);
    expect(reads).toEqual([]);
  });

  it('ανύπαρκτο ή αλλοιωμένο έγγραφο ⇒ unknown (ποτέ σφάλμα προς τα έξω)', async () => {
    docs[`property_handover_protocols/${ID}`] = { ...PROTOCOL, pdfSha256: 'όχι-hex' };
    await expect((await call(ID, `?sha256=${PDF_SHA}`)).json()).resolves.toEqual({ ok: true, registry: { kind: 'unknown' } });
  });

  it('🔴 παράδοση ΑΛΛΗΣ εταιρείας στο ίδιο id ⇒ ο δείκτης δεν μετρά ⇒ undetermined', async () => {
    docs['property_handovers/phov_1'] = { ...HANDOVER, companyId: 'comp_other' };
    await expect((await call(ID, `?sha256=${PDF_SHA}`)).json()).resolves.toMatchObject({ registry: { standing: { kind: 'undetermined' } } });
  });

  it('🔒 η απάντηση δεν κουβαλά εταιρεία · ακίνητο · παράδοση · χρήστη · αρχεία · pdfSha256', async () => {
    const body = JSON.stringify(await (await call(ID, `?sha256=${PDF_SHA}`)).json());
    for (const secret of ['comp_1', 'prop_1', 'phov_1', 'user_1', 'file_co', 'file_rc', PDF_SHA]) expect(body).not.toContain(secret);
  });

  it('η βάση πέφτει ⇒ 503 unavailable', async () => {
    failing = true;
    const reply = await call(ID, `?sha256=${PDF_SHA}`);
    expect(reply.status).toBe(503);
    await expect(reply.json()).resolves.toEqual({ ok: false, reason: 'unavailable' });
  });
});
