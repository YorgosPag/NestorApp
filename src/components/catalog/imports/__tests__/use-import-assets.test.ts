/**
 * @fileoverview ADR-934 §5.2.2 Μ-β4 — **η ουρά μέσων στον πελάτη**: αυτόματη λήψη μόνο όσων περιμένουν, ≤ 3 ταυτόχρονα και
 *   ≤ 2 ανά server, 429 ⇒ αναμονή και ξανά (όχι αποτυχία), «Ξαναδοκιμή» μόνο ρητά, κλειστή παρτίδα ⇒ καμία λήψη.
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { ApiClientError } from '@/lib/api/api-client-types';
import type { ImportAssetView } from '@/subapps/catalog/types/catalog-media';
import { ASSET_FETCH_CONCURRENCY, ASSET_FETCH_PER_HOST } from '@/subapps/catalog/vocabulary/asset-fetch';
import { useImportAssets } from '../use-import-assets';

const mockList = jest.fn();
const mockFetch = jest.fn();

jest.mock('@/services/catalog/catalog-import-api.client', () => ({
  fetchImportAssets: (...args: unknown[]) => mockList(...args),
  fetchImportAsset: (...args: unknown[]) => mockFetch(...args),
}));

const view = (uri: string, overrides: Partial<ImportAssetView> = {}): ImportAssetView => ({
  uri, roles: ['photo'], filename: null, status: 'queued', attempts: 0, failure: null, verdict: null, content: null, transport: null, ...overrides,
});

const ready = (uri: string): ImportAssetView => view(uri, { status: 'ready', attempts: 1, verdict: 'new' });
const noop = () => undefined;

beforeEach(() => {
  mockList.mockReset();
  mockFetch.mockReset().mockImplementation(async (_batchId: string, request: { uri: string }) => ready(request.uri));
});

it('ζητά ΜΟΝΟ όσα περιμένουν — όχι τα έτοιμα ούτε τα αποτυχημένα (καμία αυτόματη επανάληψη)', async () => {
  mockList.mockResolvedValue({ assets: [view('https://a.example/1.jpg'), ready('https://a.example/2.jpg'), view('https://a.example/3.jpg', { status: 'failed' })] });
  const { result } = renderHook(() => useImportAssets('cibat_1', true, noop));
  await waitFor(() => expect(result.current.assets?.[0].status).toBe('ready'));
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('cibat_1', { uri: 'https://a.example/1.jpg', retry: false });
});

it(`ως ${ASSET_FETCH_CONCURRENCY} ταυτόχρονα και ως ${ASSET_FETCH_PER_HOST} προς τον ίδιο server`, async () => {
  const uris = ['https://a.example/1', 'https://a.example/2', 'https://a.example/3', 'https://b.example/1', 'https://c.example/1'];
  mockList.mockResolvedValue({ assets: uris.map((uri) => view(uri)) });
  let inFlight = 0;
  let peak = 0;
  const perHost = new Map<string, number>();
  let peakPerHost = 0;
  mockFetch.mockImplementation(async (_batchId: string, request: { uri: string }) => {
    const host = new URL(request.uri).host;
    inFlight += 1;
    perHost.set(host, (perHost.get(host) ?? 0) + 1);
    peak = Math.max(peak, inFlight);
    peakPerHost = Math.max(peakPerHost, perHost.get(host) ?? 0);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    perHost.set(host, (perHost.get(host) ?? 1) - 1);
    return ready(request.uri);
  });
  const { result } = renderHook(() => useImportAssets('cibat_1', true, noop));
  await waitFor(() => expect(result.current.assets?.every((asset) => asset.status === 'ready')).toBe(true));
  expect(peak).toBe(ASSET_FETCH_CONCURRENCY);
  expect(peakPerHost).toBe(ASSET_FETCH_PER_HOST);
});

it('429 ⇒ αναμονή όσο λέει το Retry-After και ξανά — η γραμμή δεν γίνεται αποτυχία', async () => {
  mockList.mockResolvedValue({ assets: [view('https://a.example/1.jpg')] });
  const limited = new ApiClientError('rate limited', 429, 'RATE_LIMITED', { headers: { get: (name: string) => (name === 'retry-after' ? '0' : null) } } as unknown as Response);
  mockFetch.mockRejectedValueOnce(limited);
  const failures: unknown[] = [];
  const { result } = renderHook(() => useImportAssets('cibat_1', true, (failure) => failures.push(failure)));
  await waitFor(() => expect(result.current.assets?.[0].status).toBe('ready'));
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(failures).toEqual([]);
});

it('«Ξαναδοκιμή» στέλνει `retry: true` μόνο για την αποτυχημένη γραμμή', async () => {
  const failed = view('https://a.example/1.jpg', { status: 'failed', attempts: 1, failure: { code: 'timeout', httpStatus: null } });
  mockList.mockResolvedValue({ assets: [failed] });
  const { result } = renderHook(() => useImportAssets('cibat_1', true, noop));
  await waitFor(() => expect(result.current.assets).not.toBeNull());
  expect(mockFetch).not.toHaveBeenCalled();
  act(() => result.current.retryFailed());
  await waitFor(() => expect(result.current.assets?.[0].status).toBe('ready'));
  expect(mockFetch).toHaveBeenCalledWith('cibat_1', { uri: failed.uri, retry: true });
});

it('κλειστή παρτίδα ⇒ καμία λήψη, μόνο η ανάγνωση της ουράς', async () => {
  mockList.mockResolvedValue({ assets: [view('https://a.example/1.jpg')] });
  const { result } = renderHook(() => useImportAssets('cibat_1', false, noop));
  await waitFor(() => expect(result.current.assets).toHaveLength(1));
  expect(mockFetch).not.toHaveBeenCalled();
});

it('βλάβη μεταφοράς ⇒ η γραμμή επιστρέφει όπως ήταν και ο άνθρωπος βλέπει το σφάλμα', async () => {
  mockList.mockResolvedValue({ assets: [view('https://a.example/1.jpg')] });
  mockFetch.mockRejectedValueOnce(new Error('offline'));
  const failures: unknown[] = [];
  const { result } = renderHook(() => useImportAssets('cibat_1', true, (failure) => failures.push(failure)));
  await waitFor(() => expect(failures).toHaveLength(1));
  expect(result.current.assets?.[0].status).toBe('queued');
});
