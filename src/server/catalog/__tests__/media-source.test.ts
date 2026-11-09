/**
 * @jest-environment node
 *
 * @fileoverview ADR-934 §5.2 Μ5 · §5.2.2 Μ-β3 — **ο γραφέας της ταυτότητας διεύθυνσης**: η κρίση βγαίνει μέσα στη συναλλαγή,
 *   πάνω στην ξαναδιαβασμένη κατάσταση· ΜΙΑ εγγραφή ανά (χώρος, διεύθυνση) με ντετερμινιστικό id· ο 304 δεν «γεννά» διεύθυνση
 *   που δεν ξέραμε· ξένος χώρος ≡ ανύπαρκτος.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { generateDeterministicCatalogMediaSourceId } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

const fake = new FakeFirestore();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθεί ο γραφέας */
import { readMediaSource, recordFetchedMediaSource, recordRevalidatedMediaSource, type FetchedMediaContent } from '../media-source.server';
/* eslint-enable import/first */

const ctx = { uid: 'user_1', companyId: 'comp_1' } as AuthContext;
const URI = 'https://cdn.example.com/datasheet.pdf';
const SOURCES = COLLECTIONS.CATALOG_MEDIA_SOURCES;
const sha = (digit: string): string => digit.repeat(64);

const fetched = (overrides: Partial<FetchedMediaContent> = {}): FetchedMediaContent => ({
  uri: URI, etag: '"v1"', lastModified: null, contentSha256: sha('a'), contentFileId: 'file_a', transport: 'secure', contentAlreadyKept: false,
  ...overrides,
});

beforeEach(() => fake.reset());

describe('recordFetchedMediaSource', () => {
  it('πρώτη λήψη ⇒ `new` και ΜΙΑ εγγραφή στο ντετερμινιστικό id', async () => {
    expect(await recordFetchedMediaSource(ctx, fetched(), 'T1')).toBe('new');
    const docs = fake.getAllDocs(SOURCES);
    expect(Object.keys(docs)).toEqual([generateDeterministicCatalogMediaSourceId('comp_1', URI)]);
    expect(Object.values(docs)[0]).toMatchObject({ companyId: 'comp_1', uri: URI, contentSha256: sha('a'), etag: '"v1"', checkedAt: 'T1', previousSha256: [] });
  });

  it('ίδια bytes ξανά ⇒ `unchanged`, ακόμη μία εγγραφή μόνο', async () => {
    await recordFetchedMediaSource(ctx, fetched(), 'T1');
    expect(await recordFetchedMediaSource(ctx, fetched(), 'T2')).toBe('unchanged');
    expect(Object.keys(fake.getAllDocs(SOURCES))).toHaveLength(1);
  });

  it('🔑 άλλα bytes πίσω από την ίδια διεύθυνση ⇒ `newVersion`, το παλιό sha256 στο ιστορικό', async () => {
    await recordFetchedMediaSource(ctx, fetched(), 'T1');
    expect(await recordFetchedMediaSource(ctx, fetched({ contentSha256: sha('b'), contentFileId: 'file_b' }), 'T2')).toBe('newVersion');
    expect(await readMediaSource(ctx, URI)).toMatchObject({ contentSha256: sha('b'), contentFileId: 'file_b', previousSha256: [sha('a')] });
  });

  it('🔑 νέα διεύθυνση με περιεχόμενο που ήδη κρατάμε ⇒ `sameContent`', async () => {
    expect(await recordFetchedMediaSource(ctx, fetched({ contentAlreadyKept: true }), 'T1')).toBe('sameContent');
  });

  it('🔴 ξένος χώρος δεν βλέπει ούτε επηρεάζει την ίδια διεύθυνση', async () => {
    await recordFetchedMediaSource(ctx, fetched(), 'T1');
    const rival = { uid: 'user_2', companyId: 'comp_2' } as AuthContext;
    expect(await readMediaSource(rival, URI)).toBeNull();
    expect(await recordFetchedMediaSource(rival, fetched({ contentSha256: sha('b') }), 'T2')).toBe('new');
    expect(await readMediaSource(ctx, URI)).toMatchObject({ contentSha256: sha('a') });
  });
});

describe('recordRevalidatedMediaSource — 304', () => {
  it('γνωστή διεύθυνση ⇒ ανανεώνει χρόνο και μεταφορά, περιεχόμενο ίδιο', async () => {
    await recordFetchedMediaSource(ctx, fetched(), 'T1');
    const next = await recordRevalidatedMediaSource(ctx, URI, { transport: 'insecure', checkedAt: 'T2' });
    expect(next).toMatchObject({ contentSha256: sha('a'), etag: '"v1"', transport: 'insecure', checkedAt: 'T2' });
  });

  it('🔴 άγνωστη διεύθυνση ⇒ `null`, ΚΑΜΙΑ εγγραφή (ο 304 σε μη conditional GET είναι λάθος του server)', async () => {
    expect(await recordRevalidatedMediaSource(ctx, URI, { transport: 'secure', checkedAt: 'T1' })).toBeNull();
    expect(Object.keys(fake.getAllDocs(SOURCES))).toHaveLength(0);
  });
});
