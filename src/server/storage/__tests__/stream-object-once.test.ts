/**
 * @jest-environment node
 *
 * @fileoverview ADR-934 §5.2.2 Μ-β3 — **ροή → αντικείμενο με κλειδί από το περιεχόμενο, μία φορά**: το sha256 και το μέγεθος
 *   μετρώνται στο πέρασμα · το τελικό κλειδί γεννιέται μόνο αν είναι κενό · ίδια bytes ξανά ⇒ `exists` χωρίς επανεγγραφή ·
 *   άλλα bytes στο ίδιο κλειδί ⇒ σφάλμα · άρνηση του καλούντος ⇒ τίποτα στο τελικό κλειδί · υπέρβαση ορίου ⇒ τίποτα πουθενά ·
 *   το προσωρινό σβήνεται πάντα. Ψεύτικος κάδος, συνθετικά bytes.
 */

import { createHash } from 'crypto';
import type { Bucket } from '@google-cloud/storage';

import { STREAM_TOO_LARGE_ERROR } from '@/lib/storage/sha256-pass-through';
import { streamObjectOnce, type MeasuredStream, type StreamObjectOnceInput } from '@/server/storage/stream-object-once.server';
import { fakeGcsBucket, type FakeGcsStore } from '@/test-utils/fake-gcs/fake-gcs-bucket';

jest.mock('server-only', () => ({}));

const store: FakeGcsStore = new Map();
const bucket = fakeGcsBucket(store, 'files-eu');

const BYTES = Buffer.from(Array.from({ length: 1000 }, (_, i) => (i * 7) % 253));
const SHA = createHash('sha256').update(BYTES).digest('hex');

function bodyOf(bytes: Uint8Array, chunkSize = 100): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

const input = (overrides: Partial<StreamObjectOnceInput> = {}): StreamObjectOnceInput => ({
  bucket: bucket as unknown as Bucket,
  stagingPath: 'staging/catalog-media/comp_1/attempt-1',
  body: bodyOf(BYTES),
  contentType: 'application/pdf',
  maxBytes: 10_000,
  destinationOf: (measured: MeasuredStream) => `content/${measured.sha256}.pdf`,
  ...overrides,
});

beforeEach(() => store.clear());

describe('streamObjectOnce', () => {
  it('γράφει στο κλειδί του sha256, με μέτρηση στο πέρασμα — σε ΠΟΛΛΑ κομμάτια', async () => {
    const outcome = await streamObjectOnce(input());
    expect(outcome.kind).toBe('created');
    expect(outcome.measured).toEqual({ sha256: SHA, size: 1000 });
    expect(Buffer.from(store.get(`content/${SHA}.pdf`)?.bytes ?? [])).toEqual(BYTES);
  });

  it('🔑 το προσωρινό αντικείμενο σβήνεται — μένει ΜΟΝΟ το τελικό', async () => {
    await streamObjectOnce(input());
    expect([...store.keys()]).toEqual([`content/${SHA}.pdf`]);
  });

  it('🔑 ίδια bytes ξανά (άλλη προσπάθεια) ⇒ `exists`, καμία επανεγγραφή της γενιάς', async () => {
    await streamObjectOnce(input());
    const generation = store.get(`content/${SHA}.pdf`)?.generation;
    const again = await streamObjectOnce(input({ stagingPath: 'staging/catalog-media/comp_1/attempt-2', body: bodyOf(BYTES) }));
    expect(again.kind).toBe('exists');
    expect(store.get(`content/${SHA}.pdf`)?.generation).toBe(generation);
    expect([...store.keys()]).toEqual([`content/${SHA}.pdf`]);
  });

  it('🔴 το τελικό κλειδί κρατά ΑΛΛΑ bytes ⇒ σφάλμα, ποτέ «υιοθέτηση»', async () => {
    store.set(`content/${SHA}.pdf`, { crc32c: 'other', size: 3, generation: 1, bytes: new Uint8Array([1, 2, 3]) });
    await expect(streamObjectOnce(input())).rejects.toThrow(/holds other bytes/);
    expect(store.has('staging/catalog-media/comp_1/attempt-1')).toBe(false);
  });

  it('ο καλών αρνείται μετά τη μέτρηση ⇒ `declined`, τίποτα στο τελικό, τίποτα στο προσωρινό', async () => {
    const outcome = await streamObjectOnce(input({ destinationOf: () => null }));
    expect(outcome).toEqual({ kind: 'declined', measured: { sha256: SHA, size: 1000 } });
    expect(store.size).toBe(0);
  });

  it('🔴 υπέρβαση ορίου μέσα στη ροή ⇒ σφάλμα, κανένα αντικείμενο πουθενά (ούτε μισό)', async () => {
    await expect(streamObjectOnce(input({ maxBytes: 500 }))).rejects.toThrow(STREAM_TOO_LARGE_ERROR);
    expect(store.size).toBe(0);
  });

  it('🔴 υπέρβαση ορίου ⇒ η πηγή ΑΚΥΡΩΝΕΤΑΙ (κλείνει η σύνδεση με τον τρίτο)', async () => {
    const cancel = jest.fn();
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(BYTES.subarray(offset, offset + 100));
        offset += 100;
      },
      cancel,
    });
    await expect(streamObjectOnce(input({ body, maxBytes: 250 }))).rejects.toThrow(STREAM_TOO_LARGE_ERROR);
    expect(cancel).toHaveBeenCalled();
  });

  it('σφάλμα της πηγής στη μέση ⇒ πετά, κανένα αντικείμενο', async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls < 3) controller.enqueue(BYTES.subarray(0, 100));
        else controller.error(new Error('connection reset'));
      },
    });
    await expect(streamObjectOnce(input({ body }))).rejects.toThrow('connection reset');
    expect(store.size).toBe(0);
  });
});
