/**
 * @jest-environment node
 *
 * @fileoverview **ΣΥΝΕΧΙΖΟΜΕΝΟ ΑΝΕΒΑΣΜΑ** (ADR-884 Φ0.8 · Κ3α) — πάνω σε ψεύτικο «GCS» που μιλά το πρωτόκολλο.
 *
 * - **Σ1** χωρίς διακοπές: τμήματα των 8 MiB, πρόοδος ως το 1, ολοκλήρωση.
 * - **Σ2** διακοπή στη μέση ⇒ «πού έμεινα;» ⇒ συνέχεια **από εκεί** — κανένα byte δεν ξαναστέλνεται.
 * - **Σ3** μόνιμη αποτυχία ⇒ `failed` (όχι ατέρμονος βρόχος) · ακύρωση ⇒ `aborted`.
 */

import { RESUMABLE_CHUNK_BYTES, committedBytesOf, transferResumable } from '../resumable-upload-client';

/** Ένα «GCS»: κρατά πόσα bytes έχει, απαντά 308/200 όπως το πραγματικό. */
function fakeGcs(total: number, options: { readonly failOnCall?: ReadonlySet<number> } = {}) {
  let committed = 0;
  let calls = 0;
  const sentBytes: number[] = [];
  const fetchImpl = (async (_uri: string, init?: RequestInit) => {
    calls += 1;
    if (options.failOnCall?.has(calls)) throw new TypeError('network down');
    const range = new Headers(init?.headers).get('Content-Range') ?? '';
    const query = /^bytes \*\/(\d+)$/.exec(range);
    const chunk = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
    if (chunk && Number(chunk[1]) === committed) {
      sentBytes.push(Number(chunk[2]) - Number(chunk[1]) + 1);
      committed = Number(chunk[2]) + 1;
    }
    if (!query && !chunk) return new Response(null, { status: 400 });
    if (committed >= total) return new Response(null, { status: 200 });
    return new Response(null, { status: 308, headers: committed > 0 ? { Range: `bytes=0-${committed - 1}` } : {} });
  }) as typeof fetch;
  return { fetchImpl, sentBytes, calls: () => calls };
}

const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)]);
const noSleep = async () => undefined;

it('committedBytesOf: «bytes=0-k» ⇒ k+1 · απόν ⇒ 0', () => {
  expect(committedBytesOf('bytes=0-262143')).toBe(262144);
  expect(committedBytesOf(null)).toBe(0);
});

it('Σ1 — χωρίς διακοπές: τμήματα 8 MiB, πρόοδος ως το 1, ολοκλήρωση', async () => {
  const total = RESUMABLE_CHUNK_BYTES * 2 + 1000;
  const gcs = fakeGcs(total);
  const progress: number[] = [];
  const outcome = await transferResumable({ sessionUri: 'https://gcs/x', body: blobOf(total), fetchImpl: gcs.fetchImpl, sleep: noSleep, onProgress: (f) => progress.push(f) });
  expect(outcome).toBe('completed');
  expect(gcs.sentBytes).toEqual([RESUMABLE_CHUNK_BYTES, RESUMABLE_CHUNK_BYTES, 1000]);
  expect(progress[progress.length - 1]).toBe(1);
});

it('🏆 Σ2 — διακοπή στο 2ο τμήμα ⇒ ερώτηση θέσης ⇒ συνέχεια από εκεί, ΚΑΝΕΝΑ byte δύο φορές', async () => {
  const total = RESUMABLE_CHUNK_BYTES * 3;
  const gcs = fakeGcs(total, { failOnCall: new Set([2]) });
  let interrupted = 0;
  const outcome = await transferResumable({
    sessionUri: 'https://gcs/x', body: blobOf(total), fetchImpl: gcs.fetchImpl, sleep: noSleep, onInterrupted: () => { interrupted += 1; },
  });
  expect(outcome).toBe('completed');
  expect(interrupted).toBe(1);
  expect(gcs.sentBytes.reduce((a, b) => a + b, 0)).toBe(total);
});

it('🔴 Σ3 — μόνιμη αποτυχία ⇒ `failed` σε πεπερασμένα βήματα · ακύρωση ⇒ `aborted`', async () => {
  const always = new Set(Array.from({ length: 50 }, (_, i) => i + 1));
  const gcs = fakeGcs(1000, { failOnCall: always });
  expect(await transferResumable({ sessionUri: 'u', body: blobOf(1000), fetchImpl: gcs.fetchImpl, sleep: noSleep })).toBe('failed');
  expect(gcs.calls()).toBeLessThanOrEqual(8);

  const controller = new AbortController();
  controller.abort();
  expect(await transferResumable({ sessionUri: 'u', body: blobOf(1000), fetchImpl: fakeGcs(1000).fetchImpl, signal: controller.signal })).toBe('aborted');
});
