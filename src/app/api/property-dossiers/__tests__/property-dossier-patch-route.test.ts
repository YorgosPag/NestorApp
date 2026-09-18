/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α37.5 του ADR-866 Φ1.2** — η πόρτα μεταβολής φακέλου (`PATCH /api/property-dossiers/[id]`).
 * @related ADR-866 §2.9.1 (Α2 · Α3) · app/api/property-dossiers/[dossierId]/route.ts · _shared/respond.ts
 *
 * Εκτελεί την **πραγματική** πόρτα → σχήμα → γραφέα πάνω σε ψεύτικη Firestore. Μοκάρεται μόνο η ταυτότητα (ο αιτών
 * είναι πάντα `PERSON`) και η εγγραφή ίχνους.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | κάτοχος από το σώμα αντί `actor.ctx.uid` | «ξένος ⇒ 404» και «`userId` στο σώμα ⇒ 400» ⇒ 🔴 |
 * | `.strict()` αφαιρείται από το σχήμα | «ανάμεικτο σώμα ⇒ 400» ⇒ 🔴 |
 * | άκυρη ταυτότητα διαδρομής ⇒ 400 αντί 404 | «ταυτότητα αγγελίας ⇒ 404» ⇒ 🔴 |
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const fake = new FakeFirestore();
const PERSON = 'citizen-patch';

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> { return this.body; }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
}));

jest.mock('@/lib/auth/personal-scope-middleware', () => ({
  withPersonalOrOrgAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, context: unknown) => callback(request, { scope: 'personal', ctx: { uid: PERSON } }, context),
}));

jest.mock('@/services/entity-audit.service', () => {
  const actual = jest.requireActual('@/services/entity-audit.service');
  class SilentAuditService extends actual.EntityAuditService {
    static override async recordChange(): Promise<string | null> { return 'eaud_test'; }
  }
  return { ...actual, EntityAuditService: SilentAuditService };
});

const { PATCH } = require('../[dossierId]/route') as typeof import('../[dossierId]/route');
const { enterpriseIdService } = require('@/services/enterprise-id.service') as
  typeof import('@/services/enterprise-id.service');

type Reply = { status: number; json: () => Promise<Record<string, unknown>> };

async function patch(dossierId: string, body: unknown): Promise<Reply> {
  const request = { json: async () => body };
  const context = { params: Promise.resolve({ dossierId }) };
  return (await (PATCH as unknown as (r: unknown, c: unknown) => Promise<Reply>)(request, context));
}

function seed(userId: string): string {
  const id = enterpriseIdService.generatePropertyDossierId();
  fake.seed(COLLECTIONS.PROPERTY_DOSSIERS, id, {
    id, userId, label: 'Διαμέρισμα', type: 'apartment', lifecycle: 'active',
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  });
  return id;
}

const stored = (id: string) =>
  fake.all<Record<string, unknown>>(COLLECTIONS.PROPERTY_DOSSIERS).find((doc) => doc.id === id);

beforeEach(() => fake.reset());

describe('🏆 Α37.5 — ο κάτοχος είναι ΠΑΝΤΑ ο αιτών', () => {
  it('δικός μου φάκελος ⇒ 200 και αρχειοθετείται', async () => {
    const id = seed(PERSON);

    const reply = await patch(id, { lifecycle: 'archived' });

    expect(reply.status).toBe(200);
    expect(stored(id)).toEqual(expect.objectContaining({ lifecycle: 'archived' }));
  });

  it('ξένος φάκελος ⇒ 404 (ίδια απάντηση με «ανύπαρκτος»), ανέγγιχτος', async () => {
    const id = seed('someone-else');

    const reply = await patch(id, { lifecycle: 'archived' });

    expect(reply.status).toBe(404);
    expect(await reply.json()).toEqual({ error: 'NOT_FOUND' });
    expect(stored(id)).toEqual(expect.objectContaining({ lifecycle: 'active' }));
  });

  it('`userId` στο σώμα ⇒ 400 (`.strict()`): ο κάτοχος δεν δηλώνεται ποτέ από τον πελάτη', async () => {
    const id = seed(PERSON);

    const reply = await patch(id, { lifecycle: 'archived', userId: 'attacker-chosen' });

    expect(reply.status).toBe(400);
    expect(stored(id)).toEqual(expect.objectContaining({ lifecycle: 'active', userId: PERSON }));
  });
});

describe('Α37.5 — σχήμα σώματος και ταυτότητα διαδρομής', () => {
  it('ανάμεικτο σώμα (`lifecycle` + `label`) ⇒ 400 — καμία πράξη κατά μάντευση', async () => {
    const id = seed(PERSON);

    const reply = await patch(id, { lifecycle: 'archived', label: 'Άλλο', type: null });

    expect(reply.status).toBe(400);
    expect(stored(id)).toEqual(expect.objectContaining({ lifecycle: 'active', label: 'Διαμέρισμα' }));
  });

  it('μετονομασία ⇒ 200 με τον ενημερωμένο φάκελο', async () => {
    const id = seed(PERSON);

    const reply = await patch(id, { label: 'Μεζονέτα Πανοράματος', type: 'maisonette' });

    expect(reply.status).toBe(200);
    expect((await reply.json()).dossier).toEqual(expect.objectContaining({ id, label: 'Μεζονέτα Πανοράματος', type: 'maisonette' }));
  });

  it('κενό όνομα ⇒ 422 με ΚΩΔΙΚΟ', async () => {
    const reply = await patch(seed(PERSON), { label: ' ', type: null });

    expect(reply.status).toBe(422);
    expect(await reply.json()).toEqual({ error: 'INVALID_DOSSIER', violations: ['label-required'] });
  });

  it.each([
    ['ταυτότητα ΑΓΓΕΛΙΑΣ (`ownp_`)', () => enterpriseIdService.generateOwnerPropertyId()],
    ['πρόθεμα φακέλου χωρίς uuid v4', () => 'pdos_not-a-uuid'],
  ])('%s στη διαδρομή ⇒ 404 (όχι 400: «δεν υπάρχει εδώ»)', async (_case, idOf) => {
    const reply = await patch(idOf(), { lifecycle: 'archived' });

    expect(reply.status).toBe(404);
  });
});
