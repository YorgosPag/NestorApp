/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α36.8 του ADR-866 Φ1.1** — η πόρτα γέννησης φακέλου.
 * @related app/api/property-dossiers/route.ts · services/property-dossier/property-dossier-write.service.ts
 *
 * Ο γραφέας **ΔΕΝ** γίνεται mock: τρέχει πάνω σε ψεύτικη Firestore, ώστε να κρίνεται **ολόκληρη** η
 * διαδρομή σώμα → σχήμα → κάτοχος → γραφή → HTTP. Mock μόνο το περιτύλιγμα ταυτότητας (ο δρων) και το
 * ίχνος (δικό του σύστημα, με δικές του άγκυρες).
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | κάτοχος από το σώμα (`body.userId`) αντί `actor.ctx.uid` | «ο κάτοχος είναι ΠΑΝΤΑ ο αιτών» ⇒ 🔴 |
 * | σχήμα χωρίς έλεγχο προθέματος | «ταυτότητα αγγελίας ⇒ 400» ⇒ 🔴 |
 * | `absent` ⇒ 403/409 | «ξένη ταυτότητα ⇒ 404» ⇒ 🔴 |
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const fake = new FakeFirestore();
const PERSON = 'citizen-route';

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
    async (request: unknown) => callback(request, { scope: 'personal', ctx: { uid: PERSON } }),
}));

jest.mock('@/services/entity-audit.service', () => {
  const actual = jest.requireActual('@/services/entity-audit.service');
  class SilentAuditService extends actual.EntityAuditService {
    static override async recordChange(): Promise<string | null> { return 'eaud_test'; }
  }
  return { ...actual, EntityAuditService: SilentAuditService };
});

const { POST } = require('../route') as typeof import('../route');
const { enterpriseIdService } = require('@/services/enterprise-id.service') as
  typeof import('@/services/enterprise-id.service');

type Reply = { status: number; json: () => Promise<Record<string, unknown>> };

async function post(body: unknown): Promise<Reply> {
  const request = { json: async () => body };
  return (await (POST as unknown as (r: unknown) => Promise<Reply>)(request));
}

const dossiers = () => fake.all<Record<string, unknown>>(COLLECTIONS.PROPERTY_DOSSIERS);

beforeEach(() => fake.reset());

describe('🏆 Α36.8 — ο κάτοχος είναι ΠΑΝΤΑ ο αιτών', () => {
  it('`userId` στο σώμα αγνοείται ⇒ ο φάκελος ανήκει στο `actor.ctx.uid`', async () => {
    const id = enterpriseIdService.generatePropertyDossierId();

    const reply = await post({ id, label: 'Το σπίτι μου', type: null, userId: 'attacker-chosen' });

    expect(reply.status).toBe(201);
    expect(dossiers()).toEqual([expect.objectContaining({ id, userId: PERSON })]);
    expect(JSON.stringify(dossiers())).not.toContain('attacker-chosen');
  });
});

describe('Α36.8 — έκβαση γραφέα → HTTP', () => {
  it('επανάληψη της ίδιας γέννησης ⇒ 200 με τον ΥΠΑΡΧΟΝΤΑ φάκελο', async () => {
    const id = enterpriseIdService.generatePropertyDossierId();
    await post({ id, label: 'Πρώτο', type: 'apartment' });

    const again = await post({ id, label: 'Δεύτερο', type: 'apartment' });

    expect(again.status).toBe(200);
    expect((await again.json()).dossier).toEqual(expect.objectContaining({ id, label: 'Πρώτο' }));
    expect(dossiers()).toHaveLength(1);
  });

  it('ταυτότητα ξένου φακέλου ⇒ 404, ποτέ επιβεβαίωση ύπαρξης', async () => {
    const id = enterpriseIdService.generatePropertyDossierId();
    fake.seed(COLLECTIONS.PROPERTY_DOSSIERS, id, {
      id, userId: 'someone-else', label: 'Ξένο', type: null, lifecycle: 'active',
      createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    });

    const reply = await post({ id, label: 'Δικό μου', type: null });

    expect(reply.status).toBe(404);
    expect(await reply.json()).toEqual({ error: 'NOT_FOUND' });
  });

  it('κενό όνομα ⇒ 422 με ΚΩΔΙΚΟ, όχι κείμενο', async () => {
    const reply = await post({ id: enterpriseIdService.generatePropertyDossierId(), label: ' ', type: null });

    expect(reply.status).toBe(422);
    expect(await reply.json()).toEqual({ error: 'INVALID_DOSSIER', violations: ['label-required'] });
  });

  it.each([
    ['ταυτότητα ΑΓΓΕΛΙΑΣ (`ownp_`)', () => enterpriseIdService.generateOwnerPropertyId()],
    ['πρόθεμα φακέλου χωρίς uuid v4', () => 'pdos_not-a-uuid'],
    ['χωρίς ταυτότητα', () => undefined],
  ])('%s ⇒ 400 στο πεδίο `id`, κανένα έγγραφο', async (_case, idOf) => {
    const reply = await post({ id: idOf(), label: 'Σπίτι', type: null });

    expect(reply.status).toBe(400);
    expect((await reply.json()).malformed).toEqual(['id']);
    expect(dossiers()).toEqual([]);
  });

  it('άγνωστο είδος ακινήτου ⇒ 400 στο πεδίο `type`', async () => {
    const reply = await post({ id: enterpriseIdService.generatePropertyDossierId(), label: 'Σπίτι', type: 'castle' });

    expect(reply.status).toBe(400);
    expect((await reply.json()).malformed).toEqual(['type']);
  });
});
