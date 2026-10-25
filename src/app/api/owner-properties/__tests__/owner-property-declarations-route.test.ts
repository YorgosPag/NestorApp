/**
 * @jest-environment node
 *
 * @fileoverview ADR-898 Φ3β — **η πόρτα των δηλώσεων της αντικειμενικής** (`PATCH /api/owner-properties/[id]` με
 * `objectiveValueDeclarations`). Εκτελεί την πραγματική διαδρομή → σχήμα → γραφέα πάνω σε ψεύτικη Firestore·
 * μοκάρονται μόνο η ταυτότητα, το όριο ρυθμού, το ίχνος και η ανάγνωση ζωνών.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `.strict()` φεύγει από το σχήμα | «άγνωστο κλειδί ⇒ 400» ⇒ 🔴 |
 * | ο κλάδος μπαίνει μετά το προσχέδιο των 8 | «οι δηλώσεις δεν αγγίζουν τα 8 πεδία» ⇒ 🔴 |
 * | `zone-unverified` ⇒ 422 | «ζώνες μη διαθέσιμες ⇒ 503» ⇒ 🔴 |
 */

import '@/test-utils/public-shelf-double';
import { COLLECTIONS } from '@/config/firestore-collections';
import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const fake = new FakeFirestore();
const OWNER = 'user-1';
const zoneVerdict = jest.fn<Promise<ValueZoneVerdict>, [unknown]>();

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
    async (request: unknown, context: unknown) => callback(request, { scope: 'personal', ctx: { uid: OWNER } }, context),
  listingActorOf: (actor: { ctx: { uid: string } }) => ({ uid: actor.ctx.uid, companyId: null }),
}));

jest.mock('@/services/entity-audit.service', () => {
  const actual = jest.requireActual('@/services/entity-audit.service');
  class SilentAuditService extends actual.EntityAuditService {
    static override async recordChange(): Promise<string | null> { return 'eaud_test'; }
  }
  return { ...actual, EntityAuditService: SilentAuditService };
});
jest.mock('@/services/market/value-zones.reader', () => ({
  readValueZoneAt: (position: unknown) => zoneVerdict(position),
}));
jest.mock('@/services/mandate/showcase-presence.service', () => ({
  refreshShowcasePresence: async () => undefined,
}));

const { PATCH } = require('../[ownerPropertyId]/route') as typeof import('../[ownerPropertyId]/route');

type Reply = { status: number; json: () => Promise<Record<string, unknown>> };

async function patch(ownerPropertyId: string, body: unknown): Promise<Reply> {
  const request = { json: async () => body };
  const context = { params: Promise.resolve({ ownerPropertyId }) };
  return (await (PATCH as unknown as (r: unknown, c: unknown) => Promise<Reply>)(request, context));
}

function seed() {
  const property = validOwnerProperty();
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
  return property;
}

const stored = (id: string) => fake.all<Record<string, unknown>>(COLLECTIONS.OWNER_PROPERTIES).find((doc) => doc.id === id);

beforeEach(() => {
  fake.reset();
  zoneVerdict.mockReset();
  zoneVerdict.mockResolvedValue({ kind: 'unavailable' });
});

describe('PATCH — οι δηλώσεις της αντικειμενικής είναι ΠΡΑΞΗ, όχι πεδίο των 8 (ADR-842 Α2)', () => {
  it('έγκυρη διόρθωση ⇒ 200 και γράφεται', async () => {
    const property = seed();
    const reply = await patch(property.id, { objectiveValueDeclarations: { frontage: 'single', display: 'hidden' } });
    expect(reply.status).toBe(200);
    expect(stored(property.id)?.objectiveValueDeclarations).toMatchObject({ frontage: 'single', display: 'hidden' });
  });

  it('οι δηλώσεις δεν αγγίζουν τα 8 πεδία — ούτε περνούν από το προσχέδιο', async () => {
    const property = seed();
    await patch(property.id, { objectiveValueDeclarations: { hasElevator: true } });
    expect(stored(property.id)).toMatchObject({ title: property.title, areaSqm: property.areaSqm, offers: property.offers });
  });

  it.each([
    [{ objectiveValueDeclarations: { unknownKey: true } }],
    [{ objectiveValueDeclarations: {} }],
    [{ objectiveValueDeclarations: { permitDate: '1998-02-30' } }],
    [{ objectiveValueDeclarations: null }],
  ])('κακό σώμα %j ⇒ 400 MALFORMED_BODY', async (body) => {
    const property = seed();
    const reply = await patch(property.id, body);
    expect(reply.status).toBe(400);
    expect(await reply.json()).toEqual({ error: 'MALFORMED_BODY', malformed: ['objectiveValueDeclarations'] });
  });

  it('ημερομηνία άδειας στο μέλλον ⇒ 422 με ονομασμένο κωδικό', async () => {
    const property = seed();
    const reply = await patch(property.id, { objectiveValueDeclarations: { permitDate: '2999-01-01' } });
    expect(reply.status).toBe(422);
    expect(await reply.json()).toEqual({ error: 'INVALID_DECLARATIONS', violations: ['permitDateInFuture'] });
  });

  it('🔴 ζώνες μη διαθέσιμες ⇒ 503, ΠΟΤΕ 422', async () => {
    const property = seed();
    const reply = await patch(property.id, { objectiveValueDeclarations: { zoneFront: { kind: 'street', street: 'Εγνατίας' } } });
    expect(reply.status).toBe(503);
    expect(await reply.json()).toEqual({ error: 'ZONE_UNVERIFIED' });
  });

  it('ανύπαρκτη αγγελία ⇒ 404', async () => {
    const reply = await patch('ownp_missing', { objectiveValueDeclarations: { frontage: 'single' } });
    expect(reply.status).toBe(404);
  });
});

describe('PATCH — τα κοινόχρηστα είναι ΠΡΑΞΗ, όχι πεδίο των 8 (ADR-777 §8.93)', () => {
  it('έγκυρη διόρθωση ⇒ 200 και γράφεται κανονικοποιημένη', async () => {
    const property = seed();
    const reply = await patch(property.id, { commonCharges: { monthlyAmount: 120, includes: ['elevator', 'heating'] } });
    expect(reply.status).toBe(200);
    expect(stored(property.id)?.commonCharges).toEqual({ monthlyAmount: 120, includes: ['heating', 'elevator'] });
  });

  it('τα κοινόχρηστα δεν αγγίζουν τα 8 πεδία, ούτε τις δηλώσεις της αντικειμενικής', async () => {
    const property = seed();
    await patch(property.id, { commonCharges: { monthlyAmount: 0 } });
    expect(stored(property.id)).toMatchObject({
      title: property.title,
      areaSqm: property.areaSqm,
      offers: property.offers,
      objectiveValueDeclarations: property.objectiveValueDeclarations,
    });
  });

  it.each([
    [{ commonCharges: { yearly: 1440 } }],
    [{ commonCharges: {} }],
    [{ commonCharges: { monthlyAmount: -5 } }],
    [{ commonCharges: { monthlyAmount: 120.5 } }],
    [{ commonCharges: { includes: ['sauna'] } }],
    [{ commonCharges: null }],
  ])('κακό σώμα %j ⇒ 400 MALFORMED_BODY — και τίποτα δεν γράφεται', async (body) => {
    const property = seed();
    const reply = await patch(property.id, body);
    expect(reply.status).toBe(400);
    expect(await reply.json()).toEqual({ error: 'MALFORMED_BODY', malformed: ['commonCharges'] });
    expect(stored(property.id)?.commonCharges).toEqual({ monthlyAmount: null, includes: null });
  });

  it('ανύπαρκτη αγγελία ⇒ 404', async () => {
    const reply = await patch('ownp_missing', { commonCharges: { monthlyAmount: 120 } });
    expect(reply.status).toBe(404);
  });
});

describe('PATCH — το ενεργειακό πιστοποιητικό είναι ΠΡΑΞΗ, όχι πεδίο των 8 (ADR-777 §8.94)', () => {
  it('έγκυρη διόρθωση ⇒ 200, γράφεται το μπλοκ ΚΑΙ η αξίωση νομιμότητάς του', async () => {
    const property = seed();
    const reply = await patch(property.id, { energy: { class: 'B+', issuedOn: '2024-03-12' } });
    expect(reply.status).toBe(200);
    expect(stored(property.id)?.energy).toMatchObject({ class: 'B+', issuedOn: '2024-03-12' });
    expect(stored(property.id)?.legality).toMatchObject([
      { kind: 'energy-performance', tier: 'self-declared', value: 'B+', validUntil: '2034-03-12' },
    ]);
  });

  it('το ΠΕΑ δεν αγγίζει τα 8 πεδία, ούτε τα κοινόχρηστα', async () => {
    const property = seed();
    await patch(property.id, { energy: { class: 'C' } });
    expect(stored(property.id)).toMatchObject({
      title: property.title,
      commonCharges: property.commonCharges,
      objectiveValueDeclarations: property.objectiveValueDeclarations,
    });
  });

  it.each([
    [{ energy: { class: 'H' } }],
    [{ energy: {} }],
    [{ energy: { primaryEnergy: 12.34 } }],
    [{ energy: { issuedOn: '2024-02-31' } }],
    [{ energy: { certificateId: '12345/2024' } }],
    [{ energy: null }],
  ])('κακό σώμα %j ⇒ 400 MALFORMED_BODY — και τίποτα δεν γράφεται', async (body) => {
    const property = seed();
    const reply = await patch(property.id, body);
    expect(reply.status).toBe(400);
    expect(await reply.json()).toEqual({ error: 'MALFORMED_BODY', malformed: ['energy'] });
    expect(stored(property.id)?.energy).toMatchObject({ class: null });
    expect(stored(property.id)?.legality).toEqual([]);
  });

  it('🔒 `legality` στο σώμα ΔΕΝ είναι πράξη: δεν γράφεται αξίωση από τον πελάτη', async () => {
    const property = seed();
    const forged = [{ kind: 'energy-performance', tier: 'registry-verified', value: 'A+' }];
    await patch(property.id, { legality: forged });
    expect(stored(property.id)?.legality).toEqual([]);
  });

  it('ανύπαρκτη αγγελία ⇒ 404', async () => {
    const reply = await patch('ownp_missing', { energy: { class: 'C' } });
    expect(reply.status).toBe(404);
  });
});
