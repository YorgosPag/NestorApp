/**
 * Άγκυρες — οι διαδρομές θέσης επαφής **λύνουν και δεν γράφουν** (ADR-332 D27 Β-ΙΙ Φ2)
 *
 * Τρέχει ο **πραγματικός** εκτελεστής (`contactPreviewRouteWithBody`), ο πραγματικός φύλακας
 * (`loadOwnedContact`), ο πραγματικός γραφέας θέσης (`resolveAddressPositions`) και η
 * πραγματική όψη θέσης. Mock **μόνο** στα σύνορα: ταυτότητα, Firestore, μηχανή.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

var requestedPermissions: unknown[] = [];
jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>, options?: { permissions?: unknown }) => {
    requestedPermissions.push(options?.permissions);
    return async (request: unknown) =>
      callback(request, { uid: 'u_1', email: 'a@alpha.gr', companyId: 'co_alpha', globalRole: 'company_admin' }, {});
  },
}));
jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: (handler: unknown) => handler,
}));

/** Τι «υπάρχει» στη βάση — και κάθε απόπειρα εγγραφής καταγράφεται. */
var storedContact: Record<string, unknown> | null = null;
var writes: string[] = [];
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: storedContact !== null, id: 'cont_42', data: () => storedContact ?? undefined }),
        set: async () => { writes.push('set'); },
        update: async () => { writes.push('update'); },
      }),
    }),
  }),
}));

var geocoderCalls: Array<Record<string, unknown>> = [];
var geocoderVerdict: unknown = null;
jest.mock('@/app/api/geocoding/geocoding-engine', () => ({
  geocodeWithVerdict: async (query: Record<string, unknown>) => {
    geocoderCalls.push(query);
    return geocoderVerdict;
  },
}));
jest.mock('@/services/listings/publish-public-listing', () => ({
  republishListingsForProject: async () => ({ published: 0, withdrawn: 0, failed: 0 }),
}));

import type { NextRequest } from 'next/server';
import { ADDRESS_IDENTITY_FIELDS } from '@/lib/geocoding/address-position';
import { POST as positionsForContact } from '../../[contactId]/address-positions/route';
import { POST as positionsForNewContact } from '../../address-positions/route';

const HUMAN = { lat: 40.6617, lng: 22.9204 };
/** ~1,1 χλμ βορειότερα — πολύ πάνω από κάθε ανοχή απόκλισης. */
const FAR_HIT = {
  kind: 'hit',
  result: { lat: 40.6717, lng: 22.9204, accuracy: 'exact', confidence: 0.93, source: { variantUsed: 1, osmType: 'house' } },
};

const HQ = {
  id: 'addr_hq', type: 'headquarters', street: 'Αγγελάκη', number: '5', postalCode: '54621', city: 'Θεσσαλονίκη',
  coordinates: HUMAN, source: 'dragged', verifiedAt: 1_757_000_000_000,
};
const HQ_VIEW = {
  id: 'addr_hq', street: 'Αγγελάκη', number: '5', postalCode: '54621', city: 'Θεσσαλονίκη',
  coordinates: HUMAN, source: 'dragged', verifiedAt: 1_757_000_000_000,
};

const segment = { params: Promise.resolve({ contactId: 'cont_42' }) };
const request = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;

interface Decision { id: string; coordinates?: { lat: number; lng: number }; source?: string }
async function dataOf(response: unknown): Promise<{ positions: Decision[]; positionAdvisories: Array<{ addressId: string }> }> {
  const body = await (response as { json: () => Promise<{ data: never }> }).json();
  return body.data;
}

beforeEach(() => {
  storedContact = { companyId: 'co_alpha', type: 'company', customFields: { companyAddresses: [HQ] } };
  writes = [];
  geocoderCalls = [];
  geocoderVerdict = FAR_HIT;
  requestedPermissions = [];
});

describe('ADR-332 D27 Β-ΙΙ Φ2 — υπάρχουσα επαφή', () => {
  it('αμετάβλητη πινέζα ανθρώπου = μηδέν ερωτήσεις· νέα διεύθυνση = γεωκωδικοποίηση· ΚΑΜΙΑ εγγραφή', async () => {
    const branch = { id: 'addr_br', street: 'Μοναστηρίου', number: '10', postalCode: '56121', city: 'Εύοσμος' };
    const data = await dataOf(await positionsForContact(request({ addresses: [HQ_VIEW, branch] }), segment));

    expect(data.positions[0]).toMatchObject({ id: 'addr_hq', coordinates: HUMAN, source: 'dragged' });
    expect(data.positions[1]).toMatchObject({ id: 'addr_br', source: 'geocoded' });
    expect(geocoderCalls).toHaveLength(1);
    expect(writes).toEqual([]);
    expect(requestedPermissions).toEqual(['crm:contacts:update']);
  });

  it('Φ2β: αλλαγή κειμένου ⇒ η πινέζα ΜΕΝΕΙ, και η απόκλιση φτάνει ως συμβουλή', async () => {
    const data = await dataOf(await positionsForContact(
      request({ addresses: [{ ...HQ_VIEW, street: 'Τσιμισκή' }] }), segment,
    ));

    expect(data.positions[0]).toMatchObject({ coordinates: HUMAN, source: 'dragged' });
    expect(data.positionAdvisories.map((a) => a.addressId)).toEqual(['addr_hq']);
  });

  it('«Μετακίνησε» (relocate) ⇒ η θέση της μηχανής αντικαθιστά την πινέζα', async () => {
    const data = await dataOf(await positionsForContact(
      request({ addresses: [HQ_VIEW], relocateAddressIds: ['addr_hq'] }), segment,
    ));

    expect(data.positions[0]).toMatchObject({ coordinates: { lat: 40.6717, lng: 22.9204 }, source: 'geocoded' });
  });

  it('ΞΕΝΗ επαφή ⇒ 404, και η μηχανή ΔΕΝ ρωτιέται', async () => {
    storedContact = { companyId: 'co_ksena', type: 'company', customFields: { companyAddresses: [HQ] } };

    await expect(positionsForContact(request({ addresses: [HQ_VIEW] }), segment))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(geocoderCalls).toEqual([]);
  });
});

describe('ADR-332 D27 Β-ΙΙ Φ2 — νέα επαφή', () => {
  it('σημείο ανθρώπου = ανθρώπινη θέση· μόνο κείμενο = γεωκωδικοποίηση· δικαίωμα δημιουργίας', async () => {
    const dragged = { id: 'addr_new', coordinates: HUMAN, source: 'dragged' };
    const typed = { id: 'addr_typed', street: 'Εγνατία', number: '1', city: 'Θεσσαλονίκη' };
    const data = await dataOf(await positionsForNewContact(request({ addresses: [dragged, typed] })));

    expect(data.positions[0]).toMatchObject({ coordinates: HUMAN, source: 'dragged' });
    expect(data.positions[1]).toMatchObject({ source: 'geocoded' });
    expect(requestedPermissions).toEqual(['crm:contacts:create']);
    expect(writes).toEqual([]);
  });

  it('το σύνορο δέχεται ΚΑΘΕ πεδίο ταυτότητας του γραφέα — και τίποτε άλλο (strict)', async () => {
    for (const field of ADDRESS_IDENTITY_FIELDS) {
      const response = await positionsForNewContact(request({ addresses: [{ id: 'a', [field]: 'x' }] }));
      expect((response as { status: number }).status).toBe(200);
    }
    const foreign = await positionsForNewContact(request({ addresses: [{ id: 'a', municipalityName: 'x' }] }));
    expect((foreign as { status: number }).status).toBe(400);
  });
});
