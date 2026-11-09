/**
 * @jest-environment node
 *
 * @fileoverview ADR-934 §5.2.2 Μ-β4 — ο γραφέας του `catalog_import_asset_fetches`, με ψεύτικη βάση:
 *   • διεκδίκηση **μόνο** σε ανοιχτή παρτίδα, με μίσθωση και αριθμό προσπάθειας·
 *   • δεύτερη αίτηση με ζωντανή μίσθωση ⇒ `inFlight` (ποτέ δύο λήψεις)·
 *   • 🔑 σφραγίδα: αργή λήψη που έχασε τη μίσθωσή της ΔΕΝ σβήνει το αποτέλεσμα της νεότερης.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

const fake = new FakeFirestore();
let mockBatchStatus = 'reviewing';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('../catalog-store.server', () => ({
  runCatalogTransaction: (_ctx: unknown, work: (scope: unknown) => unknown) => fake.runTransaction((tx) => Promise.resolve(work({ db: fake, tx }))),
  readOwned: async () => ({ id: 'cibat_1', status: mockBatchStatus }),
}));
// Ο πραγματικός κριτής «ανοιχτή παρτίδα», χωρίς να φορτωθεί ο γραφέας παρτίδας (PDF · αποθήκευση).
jest.mock('../import-batch-writer.server', () => {
  const { CatalogWriteError: WriteError } = jest.requireActual('../catalog-write-error');
  const { IMPORT_FINISHED_BATCH_STATUSES } = jest.requireActual('@/subapps/catalog/vocabulary/catalog-import');
  return {
    assertImportBatchOpen: (batch: { readonly status: string }) => {
      if (IMPORT_FINISHED_BATCH_STATUSES.includes(batch.status)) throw new WriteError('immutable');
    },
  };
});

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθεί ο γραφέας */
import { ASSET_FETCH_LEASE_MS } from '@/subapps/catalog/vocabulary/asset-fetch';
import { CatalogWriteError } from '../catalog-write-error';
import { claimImportAssetFetch, importAssetFetchIdOf, readImportAssetFetches, settleImportAssetFetch } from '../import-asset-fetch-store.server';
/* eslint-enable import/first */

const ctx = { uid: 'user_1', companyId: 'comp_1' } as AuthContext;
const URI = 'https://cdn.example.com/fc-100.pdf';
const request = { uri: URI, roles: ['datasheet'] as const, filename: null };
const NOW = 1_000_000;
const FETCHES = COLLECTIONS.CATALOG_IMPORT_ASSET_FETCHES;
const failure = { status: 'failed', failure: { code: 'timeout', httpStatus: null }, transport: null } as const;

beforeEach(() => {
  fake.reset();
  mockBatchStatus = 'reviewing';
});

describe('claimImportAssetFetch', () => {
  it('πρώτη αίτηση ⇒ `claimed` (προσπάθεια 1) και έγγραφο `fetching` με μίσθωση, id ντετερμινιστικό', async () => {
    expect(await claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: false, now: NOW })).toEqual({ kind: 'claimed', attempt: 1 });
    const id = importAssetFetchIdOf('comp_1', 'cibat_1', URI);
    expect(fake.getData(FETCHES, id)).toMatchObject({ companyId: 'comp_1', batchId: 'cibat_1', uri: URI, status: 'fetching', leaseUntil: NOW + ASSET_FETCH_LEASE_MS, attempts: 1 });
  });

  it('🔑 δεύτερη αίτηση με ζωντανή μίσθωση ⇒ `inFlight`, ο αριθμός προσπάθειας δεν αλλάζει', async () => {
    await claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: false, now: NOW });
    const second = await claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: true, now: NOW + 1 });
    expect(second.kind).toBe('inFlight');
    expect((await readImportAssetFetches(ctx, 'cibat_1', [URI])).get(URI)?.attempts).toBe(1);
  });

  it('ληγμένη μίσθωση ⇒ νέα προσπάθεια (2)', async () => {
    await claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: false, now: NOW });
    expect(await claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: false, now: NOW + ASSET_FETCH_LEASE_MS + 1 })).toEqual({ kind: 'claimed', attempt: 2 });
  });

  it('🔴 εγκαταλειμμένη παρτίδα ⇒ άρνηση, τίποτα δεν γράφεται', async () => {
    mockBatchStatus = 'discarded';
    await expect(claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: false, now: NOW })).rejects.toBeInstanceOf(CatalogWriteError);
    expect(Object.keys(fake.getAllDocs(FETCHES))).toHaveLength(0);
  });
});

describe('settleImportAssetFetch — σφραγίδα', () => {
  it('ο κάτοχος της προσπάθειας κλείνει τη λήψη· η μίσθωση σβήνει', async () => {
    await claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: false, now: NOW });
    const settled = await settleImportAssetFetch(ctx, { batchId: 'cibat_1', uri: URI, attempt: 1 }, failure);
    expect(settled).toMatchObject({ status: 'failed', leaseUntil: null, failure: { code: 'timeout', httpStatus: null } });
  });

  it('🔑 αργή προσπάθεια 1 μετά τη νεότερη 2 ⇒ ΔΕΝ γράφει· ισχύει η 2', async () => {
    await claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: false, now: NOW });
    await claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: false, now: NOW + ASSET_FETCH_LEASE_MS + 1 });
    const stale = await settleImportAssetFetch(ctx, { batchId: 'cibat_1', uri: URI, attempt: 1 }, failure);
    expect(stale).toMatchObject({ status: 'fetching', attempts: 2 });
  });

  it('ήδη κλεισμένη ⇒ δεύτερο κλείσιμο δεν αλλάζει τίποτα (ιδεμπότητο)', async () => {
    await claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: false, now: NOW });
    await settleImportAssetFetch(ctx, { batchId: 'cibat_1', uri: URI, attempt: 1 }, failure);
    const again = await settleImportAssetFetch(ctx, { batchId: 'cibat_1', uri: URI, attempt: 1 }, { status: 'failed', failure: { code: 'notFound', httpStatus: 404 }, transport: null });
    expect(again?.failure).toEqual({ code: 'timeout', httpStatus: null });
  });
});

describe('readImportAssetFetches', () => {
  it('κενή λίστα ⇒ καμία ανάγνωση· ξένο έγγραφο ⇒ αγνοείται', async () => {
    expect((await readImportAssetFetches(ctx, 'cibat_1', [])).size).toBe(0);
    await claimImportAssetFetch(ctx, { batchId: 'cibat_1', request, retry: false, now: NOW });
    const other = { uid: 'user_2', companyId: 'comp_2' } as AuthContext;
    expect((await readImportAssetFetches(other, 'cibat_1', [URI])).size).toBe(0);
  });
});
