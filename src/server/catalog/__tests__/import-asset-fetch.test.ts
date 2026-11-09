/**
 * @jest-environment node
 *
 * @fileoverview ADR-934 §5.2.2 Μ-β4 — **η ροή της λήψης μιας διεύθυνσης**, με ψεύτικα σύνορα (φρουρός · καραντίνα · ταυτότητα ·
 *   store) και πραγματικούς κριτές (ουρά · κωδικοί αποτυχίας):
 *   • μόνο διεύθυνση που ζητά η παρτίδα — ποτέ αυθαίρετο URL·
 *   • έτοιμη / σε εξέλιξη ⇒ καμία λήψη·
 *   • conditional GET **μόνο** με γνωστό περιεχόμενο που κρατιέται· 304 ⇒ `unchanged` χωρίς bytes·
 *   • Μ-β5: 304 σε περιεχόμενο στον κάδο ⇒ **επαναφορά** χωρίς bytes· αν εκκαθαρίστηκε στο μεταξύ ⇒ **μία** λήψη χωρίς validators·
 *   • αποτυχία μεταφοράς / περιεχομένου / κάδου ⇒ κωδικός· βλάβη ⇒ πετιέται (η μίσθωση λήγει μόνη της).
 */

import type { AuthContext } from '@/lib/auth';
import type { ImportAssetFetchDefinition, MediaContentFacts } from '@/subapps/catalog/types/catalog-media';

const mockFetchGuardedStream = jest.fn();
const mockQuarantine = jest.fn();
const mockReadKept = jest.fn();
const mockReadSource = jest.fn();
const mockRecordFetched = jest.fn();
const mockRecordRevalidated = jest.fn();
const mockClaim = jest.fn();
const mockSettle = jest.fn();
const mockProposals = jest.fn();
const mockRestoreTrashed = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/security/outbound-fetch', () => ({ fetchGuardedStream: (...args: unknown[]) => mockFetchGuardedStream(...args) }));
jest.mock('../catalog-store.server', () => ({
  runCatalogTransaction: (_ctx: unknown, work: (scope: unknown) => unknown) => work({}),
  readOwned: async () => ({ id: 'cibat_1', status: 'reviewing', target: { purpose: 'attributes' } }),
}));
jest.mock('../import-batch-writer.server', () => ({ assertPurposeAuthority: async () => undefined }));
jest.mock('../import-reads.server', () => ({ readBatchProposals: (...args: unknown[]) => mockProposals(...args) }));
jest.mock('../import-asset-fetch-store.server', () => ({
  importAssetFetchIdOf: () => 'ciafx_1',
  readImportAssetFetches: async () => new Map(),
  claimImportAssetFetch: (...args: unknown[]) => mockClaim(...args),
  settleImportAssetFetch: (...args: unknown[]) => mockSettle(...args),
}));
jest.mock('../media-content-revival.server', () => {
  class MediaContentUnavailableError extends Error {}
  return { MediaContentUnavailableError, restoreTrashedMediaContent: (...args: unknown[]) => mockRestoreTrashed(...args) };
});
jest.mock('../media-quarantine.server', () => ({
  quarantineDownloadedMedia: (...args: unknown[]) => mockQuarantine(...args),
  readKeptMediaContent: (...args: unknown[]) => mockReadKept(...args),
}));
jest.mock('../media-source.server', () => ({
  readMediaSource: (...args: unknown[]) => mockReadSource(...args),
  recordFetchedMediaSource: (...args: unknown[]) => mockRecordFetched(...args),
  recordRevalidatedMediaSource: (...args: unknown[]) => mockRecordRevalidated(...args),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθεί η ροή */
import { CatalogWriteError } from '../catalog-write-error';
import { fetchImportAsset } from '../import-asset-fetch.server';
import { MediaContentUnavailableError } from '../media-content-revival.server';
/* eslint-enable import/first */

const ctx = { uid: 'user_1', companyId: 'comp_1' } as AuthContext;
const URI = 'https://cdn.example.com/fc-100.pdf';
const SHA = 'b'.repeat(64);
const CONTENT: MediaContentFacts = { fileId: 'file_1', sha256: SHA, sizeBytes: 9000, kind: 'document', ext: 'pdf', contentType: 'application/pdf' };
const SOURCE = { companyId: 'comp_1', uri: URI, etag: '"v1"', lastModified: 'Mon, 09 Nov 2026 10:00:00 GMT', contentSha256: SHA, contentFileId: 'file_1', transport: 'secure', checkedAt: 'x', previousSha256: [] };

const proposalWith = (uri: string) => ({ status: 'pending', extracted: { groupKey: 'g', modelCode: null, sharedCells: [], pages: [], rows: [], assets: [{ uri, role: 'datasheet', order: null, filename: 'fc.pdf', languages: [], issuedOn: null, expiresOn: null, atx: null }] } });
const body = () => new ReadableStream<Uint8Array>();
const okStream = { ok: true, notModified: false, status: 200, contentType: 'application/pdf', etag: '"v2"', lastModified: null, transport: 'secure', body: body() };

const settledWith = (stored: Partial<ImportAssetFetchDefinition>) => ({
  companyId: 'comp_1', batchId: 'cibat_1', uri: URI, roles: ['datasheet'], leaseUntil: null, attempts: 1, failure: null, verdict: null,
  content: null, transport: null, updatedAt: 'x', updatedBy: 'user_1', status: 'ready', ...stored,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockProposals.mockResolvedValue([proposalWith(URI)]);
  mockClaim.mockResolvedValue({ kind: 'claimed', attempt: 1 });
  mockSettle.mockImplementation(async (_ctx: unknown, _target: unknown, outcome: Record<string, unknown>) => settledWith(outcome));
  mockReadSource.mockResolvedValue(null);
  mockReadKept.mockResolvedValue(null);
});

describe('fetchImportAsset — μόνο ό,τι ζητά η παρτίδα', () => {
  it('🔴 διεύθυνση που ΔΕΝ ζητά καμία πρόταση ⇒ notFound, καμία λήψη (όχι ενισχυτής SSRF)', async () => {
    await expect(fetchImportAsset(ctx, 'cibat_1', { uri: 'http://169.254.169.254/latest/meta-data' })).rejects.toBeInstanceOf(CatalogWriteError);
    expect(mockFetchGuardedStream).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('η διεύθυνση κανονικοποιείται πριν συγκριθεί (fragment)', async () => {
    mockFetchGuardedStream.mockResolvedValue({ ok: false, rejection: 'http_error', status: 500 });
    await fetchImportAsset(ctx, 'cibat_1', { uri: `${URI}#page=2` });
    expect(mockFetchGuardedStream).toHaveBeenCalledWith(URI, expect.anything());
  });

  it('έτοιμη ή σε εξέλιξη ⇒ η αποθηκευμένη όψη, καμία λήψη', async () => {
    mockClaim.mockResolvedValue({ kind: 'inFlight', stored: settledWith({ status: 'fetching', leaseUntil: Date.now() + 60_000 }) });
    const view = await fetchImportAsset(ctx, 'cibat_1', { uri: URI });
    expect(view.status).toBe('fetching');
    expect(mockFetchGuardedStream).not.toHaveBeenCalled();
  });
});

describe('fetchImportAsset — η λήψη', () => {
  it('αναβάθμιση σε https, όριο από τον ρόλο, χρονικά όρια της λήψης, κανένα validator την πρώτη φορά', async () => {
    mockFetchGuardedStream.mockResolvedValue({ ok: false, rejection: 'timeout', status: null });
    await fetchImportAsset(ctx, 'cibat_1', { uri: URI });
    expect(mockFetchGuardedStream).toHaveBeenCalledWith(URI, expect.objectContaining({
      scheme: 'https-upgrade', maxRedirects: 5, timeoutMs: 240_000, headersTimeoutMs: 30_000, ifNoneMatch: null, ifModifiedSince: null,
    }));
  });

  it('200 ⇒ καραντίνα με κλειδί προσπάθειας, ταυτότητα διεύθυνσης, `ready` με την κρίση', async () => {
    mockFetchGuardedStream.mockResolvedValue(okStream);
    mockQuarantine.mockResolvedValue({ ok: true, content: { ...CONTENT, alreadyKept: true } });
    mockRecordFetched.mockResolvedValue('sameContent');
    const view = await fetchImportAsset(ctx, 'cibat_1', { uri: URI });
    expect(mockQuarantine).toHaveBeenCalledWith(ctx, expect.objectContaining({ role: 'datasheet', uri: URI, filename: 'fc.pdf', attemptKey: 'ciafx_1/1' }));
    expect(mockRecordFetched).toHaveBeenCalledWith(ctx, expect.objectContaining({ uri: URI, etag: '"v2"', contentSha256: SHA, contentFileId: 'file_1', contentAlreadyKept: true }), expect.any(String));
    expect(view).toMatchObject({ status: 'ready', verdict: 'sameContent', content: CONTENT });
    expect(mockSettle).toHaveBeenCalledWith(ctx, { batchId: 'cibat_1', uri: URI, attempt: 1 }, expect.objectContaining({ status: 'ready' }));
  });

  it('🔑 ζωντανό γνωστό περιεχόμενο ⇒ conditional GET· 304 ⇒ `unchanged` ΧΩΡΙΣ καραντίνα', async () => {
    mockReadSource.mockResolvedValue(SOURCE);
    mockReadKept.mockResolvedValue({ state: 'live', content: CONTENT });
    mockFetchGuardedStream.mockResolvedValue({ ok: true, notModified: true, status: 304, transport: 'secure' });
    const view = await fetchImportAsset(ctx, 'cibat_1', { uri: URI });
    expect(mockFetchGuardedStream).toHaveBeenCalledWith(URI, expect.objectContaining({ ifNoneMatch: '"v1"', ifModifiedSince: SOURCE.lastModified }));
    expect(mockQuarantine).not.toHaveBeenCalled();
    expect(mockRestoreTrashed).not.toHaveBeenCalled();
    expect(mockRecordRevalidated).toHaveBeenCalled();
    expect(view).toMatchObject({ status: 'ready', verdict: 'unchanged', content: CONTENT });
  });

  it('🔑 Μ-β5: περιεχόμενο στον ΚΑΔΟ + 304 ⇒ ΕΠΑΝΑΦΟΡΑ χωρίς να κατέβει byte, `unchanged`', async () => {
    mockReadSource.mockResolvedValue(SOURCE);
    mockReadKept.mockResolvedValue({ state: 'trashed', content: CONTENT });
    mockRestoreTrashed.mockResolvedValue(true);
    mockFetchGuardedStream.mockResolvedValue({ ok: true, notModified: true, status: 304, transport: 'secure' });
    const view = await fetchImportAsset(ctx, 'cibat_1', { uri: URI });
    expect(mockFetchGuardedStream).toHaveBeenCalledTimes(1);
    expect(mockFetchGuardedStream).toHaveBeenCalledWith(URI, expect.objectContaining({ ifNoneMatch: '"v1"' }));
    expect(mockRestoreTrashed).toHaveBeenCalledWith(ctx, 'file_1', SHA, URI);
    expect(mockQuarantine).not.toHaveBeenCalled();
    expect(view).toMatchObject({ status: 'ready', verdict: 'unchanged', content: CONTENT });
  });

  it('🔴 Μ-β5: 304 αλλά η επαναφορά απέτυχε (εκκαθαρίστηκε στο μεταξύ) ⇒ ΜΙΑ λήψη χωρίς validators, ποτέ ψεύτικο «έτοιμο»', async () => {
    mockReadSource.mockResolvedValue(SOURCE);
    mockReadKept.mockResolvedValue({ state: 'trashed', content: CONTENT });
    mockRestoreTrashed.mockResolvedValue(false);
    mockFetchGuardedStream
      .mockResolvedValueOnce({ ok: true, notModified: true, status: 304, transport: 'secure' })
      .mockResolvedValueOnce({ ok: false, rejection: 'timeout', status: null });
    const view = await fetchImportAsset(ctx, 'cibat_1', { uri: URI });
    expect(mockFetchGuardedStream).toHaveBeenCalledTimes(2);
    expect(mockFetchGuardedStream).toHaveBeenLastCalledWith(URI, expect.objectContaining({ ifNoneMatch: null, ifModifiedSince: null }));
    expect(mockRecordRevalidated).not.toHaveBeenCalled();
    expect(view).toMatchObject({ status: 'failed', failure: { code: 'timeout' } });
  });

  it('🔴 γνωστή διεύθυνση με περιεχόμενο που ΔΕΝ κρατιέται (επιτύμβιο) ⇒ χωρίς validators: ένα 304 θα έδειχνε σε αρχείο που δεν υπάρχει', async () => {
    mockReadSource.mockResolvedValue(SOURCE);
    mockReadKept.mockResolvedValue(null);
    mockFetchGuardedStream.mockResolvedValue({ ok: false, rejection: 'timeout', status: null });
    await fetchImportAsset(ctx, 'cibat_1', { uri: URI });
    expect(mockFetchGuardedStream).toHaveBeenCalledWith(URI, expect.objectContaining({ ifNoneMatch: null, ifModifiedSince: null }));
  });

  it('304 σε GET χωρίς validators ⇒ `httpError` (304), ποτέ «αμετάβλητο»', async () => {
    mockFetchGuardedStream.mockResolvedValue({ ok: true, notModified: true, status: 304, transport: 'secure' });
    const view = await fetchImportAsset(ctx, 'cibat_1', { uri: URI });
    expect(view).toMatchObject({ status: 'failed', failure: { code: 'httpError', httpStatus: 304 } });
  });
});

describe('fetchImportAsset — αποτυχίες με κωδικό', () => {
  it('404 ⇒ `notFound` με τον κωδικό HTTP', async () => {
    mockFetchGuardedStream.mockResolvedValue({ ok: false, rejection: 'http_error', status: 404 });
    expect(await fetchImportAsset(ctx, 'cibat_1', { uri: URI })).toMatchObject({ status: 'failed', failure: { code: 'notFound', httpStatus: 404 } });
  });

  it('ιδιωτική διεύθυνση ⇒ `notPublic`', async () => {
    mockFetchGuardedStream.mockResolvedValue({ ok: false, rejection: 'address_not_public', status: null });
    expect((await fetchImportAsset(ctx, 'cibat_1', { uri: URI })).failure).toEqual({ code: 'notPublic', httpStatus: null });
  });

  it('η καραντίνα αρνείται (σελίδα HTML) ⇒ `notAFile`, χωρίς ταυτότητα διεύθυνσης', async () => {
    mockFetchGuardedStream.mockResolvedValue(okStream);
    mockQuarantine.mockResolvedValue({ ok: false, failure: 'notAFile' });
    const view = await fetchImportAsset(ctx, 'cibat_1', { uri: URI });
    expect(view.failure).toEqual({ code: 'notAFile', httpStatus: null });
    expect(mockRecordFetched).not.toHaveBeenCalled();
  });

  it('η εγγραφή αυτών των bytes δεν είναι δική μας (αλλοιωμένη) ⇒ `contentUnavailable`, ποτέ υιοθέτηση', async () => {
    mockFetchGuardedStream.mockResolvedValue(okStream);
    mockQuarantine.mockRejectedValue(new MediaContentUnavailableError('file_1'));
    expect((await fetchImportAsset(ctx, 'cibat_1', { uri: URI })).failure).toEqual({ code: 'contentUnavailable', httpStatus: null });
  });

  it('🔴 βλάβη (κάδος/βάση) ⇒ πετιέται· η λήψη ΔΕΝ κλείνει με ψεύτικο κωδικό (η μίσθωση λήγει μόνη της)', async () => {
    mockFetchGuardedStream.mockResolvedValue(okStream);
    mockQuarantine.mockRejectedValue(new Error('storage down'));
    await expect(fetchImportAsset(ctx, 'cibat_1', { uri: URI })).rejects.toThrow('storage down');
    expect(mockSettle).not.toHaveBeenCalled();
  });
});
