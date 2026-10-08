/**
 * @jest-environment node
 *
 * @fileoverview **«ΣΥΜΦΩΝΕΙ Η ΔΗΜΟΣΙΑ ΑΓΓΕΛΙΑ ΜΕ ΤΟ ΤΡΕΧΟΝ ΥΛΙΚΟ;»** — η πόρτα της ένδειξης (ADR-845 §7.17 Α5β).
 * @related app/api/properties/[id]/listing-media/route.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: η οθόνη παίρνει την ετυμηγορία του **ίδιου** κριτή με τη βραδινή συμφιλίωση, και
 * το «ενημέρωση τώρα» είναι πράξη **δημοσίευσης** — όχι κουμπί για κάθε μέλος.
 *
 * ⚠️ Ο φρουρός μισθωτή (`requirePropertyInTenantScope`), ο κριτής της συμφωνίας, ο κριτής ικανότητας
 * και το αποτύπωμα **ΔΕΝ** γίνονται mock. Mock μόνο τα σύνορα (Firestore · ταυτότητα · όριο ρυθμού),
 * ο αναγνώστης αρχείων και ο ΕΝΑΣ γραφέας της αγγελίας, που έχουν δικές τους άγκυρες.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
  FieldValue: { serverTimestamp: (): string => 'SERVER_TIME' },
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
  withSensitiveRateLimit: <T>(h: T) => h,
  withStandardRateLimit: <T>(h: T) => h,
}));

const PUBLISHER = ['listings:listings:publish'];
const caller: { uid: string; companyId: string; globalRole: string; permissions: string[]; isAuthenticated: boolean } =
  { uid: 'u_alpha', companyId: 'c_alpha', globalRole: 'external_user', permissions: PUBLISHER, isAuthenticated: true };

jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, caller, undefined),
}));

/** Τι θα έφευγε ΤΩΡΑ, ανά ακίνητο — ο ρόλος του αναγνώστη αρχείων. */
const currentMedia = new Map<string, unknown[]>();
jest.mock('@/services/listings/agency-media.reader', () => ({
  createAgencyMediaResolver: () => async (propertyId: string) => currentMedia.get(propertyId) ?? [],
}));

jest.mock('@/services/listings/public-listing-projection', () => ({
  isPubliclyListed: (property: { listed?: boolean }): boolean => property.listed === true,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mediaFingerprintOf } = require('@/services/listings/listing-media-fingerprint-stamp') as
  typeof import('@/services/listings/listing-media-fingerprint-stamp');

type Sources = Parameters<typeof mediaFingerprintOf>[0];

/** Ο ΕΝΑΣ γραφέας: «ξαναγράφει» την αγγελία με το αποτύπωμα του τρέχοντος υλικού, όπως ο αληθινός. */
const republishListing = jest.fn(async (_db: unknown, propertyId: string): Promise<string> => {
  fake.seed(COLLECTIONS.PUBLIC_LISTINGS, propertyId, {
    id: propertyId,
    mediaFingerprint: mediaFingerprintOf((currentMedia.get(propertyId) ?? []) as Sources),
  });
  return 'published';
});
jest.mock('@/services/listings/publish-public-listing', () => ({
  republishListing: (db: unknown, propertyId: string) => republishListing(db, propertyId),
  reportProjectionFailure: (): string => 'failed',
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET, POST } = require('../route') as typeof import('../route');

const PROPERTY = 'prop_95';
const FOREIGN = 'prop_beta';

interface Wire {
  success: boolean;
  data: { agreement: string; mayRefresh: boolean };
}

function requestFor(propertyId: string): never {
  const pathname = `/api/properties/${propertyId}/listing-media`;
  return { url: `http://localhost${pathname}`, nextUrl: { pathname }, json: async () => ({}) } as never;
}

async function call(method: typeof GET, propertyId: string): Promise<Wire['data']> {
  const response = (await method(requestFor(propertyId), undefined as never)) as unknown as {
    json: () => Promise<Wire>;
  };
  return (await response.json()).data;
}

function source(id: string): unknown {
  return { privateStoragePath: `companies/c/${id}.jpg`, material: 'photo', sourceFileId: id, focalPoint: null };
}

function publishWith(sources: unknown[]): void {
  fake.seed(COLLECTIONS.PUBLIC_LISTINGS, PROPERTY, {
    id: PROPERTY, mediaFingerprint: mediaFingerprintOf(sources as Sources),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  currentMedia.clear();
  caller.permissions = PUBLISHER;
  fake = new FakeFirestore();
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, { companyId: 'c_alpha', listed: true });
  fake.seed(COLLECTIONS.PROPERTIES, FOREIGN, { companyId: 'c_beta', listed: true });
  currentMedia.set(PROPERTY, [source('a')]);
});

describe('ADR-845 §7.17 Α5β — GET: η ετυμηγορία του ΕΝΟΣ κριτή', () => {
  it('🏆 Π1 — η αγγελία δείχνει το τρέχον υλικό ⇒ `current`', async () => {
    publishWith([source('a')]);

    await expect(call(GET, PROPERTY)).resolves.toEqual({ agreement: 'current', mayRefresh: true });
  });

  it('🔴 Π2 — άλλαξε αρχείο και η αγγελία δεν το έμαθε ⇒ `stale`', async () => {
    publishWith([source('a'), source('b')]);

    await expect(call(GET, PROPERTY)).resolves.toMatchObject({ agreement: 'stale' });
  });

  it('🔑 Π3 — το `mayRefresh` το λέει ο διακομιστής: χωρίς δικαίωμα δημοσίευσης ⇒ `false`', async () => {
    publishWith([source('a'), source('b')]);
    caller.permissions = [];

    await expect(call(GET, PROPERTY)).resolves.toEqual({ agreement: 'stale', mayRefresh: false });
  });

  it('🔐 Π4 — ακίνητο ΑΛΛΟΥ μισθωτή ⇒ άρνηση, ΠΡΙΝ κριθεί οτιδήποτε', async () => {
    await expect(call(GET, FOREIGN)).rejects.toBeDefined();
  });

  it('Π5 — το GET ΔΕΝ ξαναπροβάλλει ποτέ — μόνο ρωτά', async () => {
    publishWith([source('a'), source('b')]);

    await call(GET, PROPERTY);

    expect(republishListing).not.toHaveBeenCalled();
  });
});

describe('ADR-845 §7.17 Α5β — POST: «ενημέρωση αγγελίας τώρα»', () => {
  it('🏆 Ε1 — `stale` ⇒ ΜΙΑ επαναπροβολή από τον ΕΝΑ γραφέα ⇒ η ΝΕΑ ετυμηγορία είναι `current`', async () => {
    publishWith([source('a'), source('b')]);

    await expect(call(POST, PROPERTY)).resolves.toEqual({ agreement: 'current', mayRefresh: true });
    expect(republishListing).toHaveBeenCalledTimes(1);
  });

  it('🔴 Ε2 — χωρίς δικαίωμα δημοσίευσης ⇒ άρνηση, και ΚΑΜΙΑ επαναπροβολή', async () => {
    publishWith([source('a'), source('b')]);
    caller.permissions = [];

    await expect(call(POST, PROPERTY)).rejects.toMatchObject({ message: 'LISTING_REFRESH_NOT_CAPABLE' });
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('🔐 Ε3 — ακίνητο ΑΛΛΟΥ μισθωτή ⇒ άρνηση, και ΚΑΜΙΑ επαναπροβολή', async () => {
    await expect(call(POST, FOREIGN)).rejects.toBeDefined();
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('⚠️ Ε4 — η ετυμηγορία ΞΑΝΑΡΩΤΙΕΤΑΙ: γραφέας που δεν άφησε αποτύπωμα ⇒ `unknown`, όχι `current`', async () => {
    publishWith([source('a'), source('b')]);
    republishListing.mockImplementationOnce(async (_db: unknown, propertyId: string) => {
      fake.seed(COLLECTIONS.PUBLIC_LISTINGS, propertyId, { id: propertyId });
      return 'published';
    });

    await expect(call(POST, PROPERTY)).resolves.toMatchObject({ agreement: 'unknown' });
  });
});
