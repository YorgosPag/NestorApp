/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ RPC ΚΥΡΙΟΥ ΝΗΜΑΤΟΣ ⇄ WORKER** (ADR-884 Φ2στ-γ Γ3γ-2α · §4.14). Ο πελάτης μιλά με τον **πραγματικό**
 * `serveWorkerRpc` μέσα από ψεύτικο κανάλι μηνυμάτων (ασύγχρονο, όπως το `postMessage`).
 *
 * - αντιστοίχιση απαντήσεων με αριθμό, και όταν έρχονται **ανάποδα**
 * - σφάλμα χειριστή ⇒ `failed` με το μήνυμά του · κατάρρευση ⇒ ΟΛΑ τα εκκρεμή `failed`, οι επόμενες στο δίχτυ, καμία επαναγέννηση
 * - χωρίς Worker ⇒ δίχτυ · χωρίς δίχτυ ⇒ `worker-unavailable` · `dispose` ⇒ `disposed` + τερματισμός
 * - `transferOf`: buffers μετακομίζουν (zero-copy) — όχι προς το δίχτυ
 * - `latestOnly`: 5 γρήγορα ⇒ εκτελούνται 1ο + 5ο, τα ενδιάμεσα `superseded` χωρίς να σταλούν
 */

import { createWorkerRpcClient, latestOnly } from '../worker-rpc-client';
import { absoluteWorkerUrl, type WorkerRpcResult } from '../worker-rpc-protocol';

import { FakeWorker } from './fake-worker';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ok = (value: number): WorkerRpcResult<number> => ({ kind: 'ok', value });

describe('createWorkerRpcClient', () => {
  it('ταυτόχρονες κλήσεις: κάθε απάντηση στον δικό της καλούντα — ακόμη κι όταν έρχονται ανάποδα', async () => {
    // Ο host είναι σειριακός· γι' αυτό οι καθυστερήσεις δείχνουν ότι η αντιστοίχιση γίνεται με αριθμό, όχι με σειρά.
    const client = createWorkerRpcClient<number, number>({ spawn: () => new FakeWorker<number, number>(async (n) => { await delay(10 - n); return n * 10; }) });
    await expect(Promise.all([client.call(1), client.call(2), client.call(3)])).resolves.toEqual([ok(10), ok(20), ok(30)]);
  });

  it('ο Worker γεννιέται στην ΠΡΩΤΗ κλήση και μόνο μία φορά', async () => {
    const spawn = jest.fn(() => new FakeWorker<number, number>((n) => n));
    const client = createWorkerRpcClient<number, number>({ spawn });
    expect(spawn).not.toHaveBeenCalled();
    await client.call(1);
    await client.call(2);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('σφάλμα του χειριστή ⇒ failed με το μήνυμά του (ποτέ κρέμασμα)', async () => {
    const client = createWorkerRpcClient<number, number>({ spawn: () => new FakeWorker<number, number>(() => { throw new Error('boom'); }) });
    await expect(client.call(1)).resolves.toEqual({ kind: 'failed', error: 'boom' });
  });

  it('κατάρρευση ⇒ ΟΛΑ τα εκκρεμή failed · οι επόμενες πάνε στο δίχτυ, χωρίς επαναγέννηση', async () => {
    let worker: FakeWorker<number, number> | null = null;
    const spawn = jest.fn(() => (worker = new FakeWorker<number, number>(async (n) => { await delay(50); return n; })));
    const client = createWorkerRpcClient<number, number>({ spawn, fallback: async (n) => -n });
    const pending = [client.call(1), client.call(2)];
    worker?.crash('out of memory');
    await expect(Promise.all(pending)).resolves.toEqual([
      { kind: 'failed', error: 'out of memory' }, { kind: 'failed', error: 'out of memory' },
    ]);
    expect(worker?.terminated).toBe(true);
    await expect(client.call(3)).resolves.toEqual(ok(-3));
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('transferOf: το buffer ΜΕΤΑΚΟΜΙΖΕΙ (άδειο στον αποστολέα, ανέπαφο στον Worker) · το δίχτυ το παίρνει όπως είναι', async () => {
    const sum = (body: Float64Array) => body.reduce((a, b) => a + b, 0);
    const worker = new FakeWorker<Float64Array, number>(sum);
    const client = createWorkerRpcClient<Float64Array, number>({ spawn: () => worker, transferOf: (body) => [body.buffer] });
    const sent = new Float64Array([1, 2, 3]);
    await expect(client.call(sent)).resolves.toEqual(ok(6));
    expect(sent.byteLength).toBe(0);
    expect(worker.transfers[0]).toHaveLength(1);

    const kept = new Float64Array([4, 5]);
    const viaFallback = createWorkerRpcClient<Float64Array, number>({
      spawn: () => null, fallback: async (body) => sum(body), transferOf: (body) => [body.buffer],
    });
    await expect(viaFallback.call(kept)).resolves.toEqual(ok(9));
    expect(kept.byteLength).toBe(16);
  });

  it('χωρίς Worker ⇒ δίχτυ · χωρίς δίχτυ ⇒ worker-unavailable · δίχτυ που πετά ⇒ failed', async () => {
    await expect(createWorkerRpcClient<number, number>({ spawn: () => null, fallback: async (n) => n + 1 }).call(1)).resolves.toEqual(ok(2));
    await expect(createWorkerRpcClient<number, number>({ spawn: () => null }).call(1)).resolves.toEqual({ kind: 'failed', error: 'worker-unavailable' });
    const throwing = createWorkerRpcClient<number, number>({ spawn: () => { throw new Error('csp'); }, fallback: async () => { throw new Error('no canvas'); } });
    await expect(throwing.call(1)).resolves.toEqual({ kind: 'failed', error: 'no canvas' });
  });

  it('dispose ⇒ εκκρεμή disposed, τερματισμός · επόμενη κλήση γεννά ξανά (StrictMode)', async () => {
    const workers: FakeWorker<number, number>[] = [];
    const client = createWorkerRpcClient<number, number>({ spawn: () => { const w = new FakeWorker<number, number>(async (n) => { await delay(20); return n; }); workers.push(w); return w; } });
    const pending = client.call(1);
    client.dispose();
    await expect(pending).resolves.toEqual({ kind: 'failed', error: 'disposed' });
    expect(workers[0].terminated).toBe(true);
    await expect(client.call(2)).resolves.toEqual(ok(2));
    expect(workers).toHaveLength(2);
  });
});

describe('latestOnly', () => {
  it('5 γρήγορα ⇒ εκτελούνται μόνο το 1ο και το 5ο· τα ενδιάμεσα superseded χωρίς να σταλούν', async () => {
    const executed: number[] = [];
    const call = latestOnly(async (n: number) => { executed.push(n); await delay(10); return ok(n); });
    const results = await Promise.all([1, 2, 3, 4, 5].map(call));
    expect(executed).toEqual([1, 5]);
    expect(results).toEqual([ok(1), { kind: 'superseded' }, { kind: 'superseded' }, { kind: 'superseded' }, ok(5)]);
  });

  it('αργό αίτημα μετά από ησυχία ⇒ εκτελείται αμέσως (κανένα debounce)', async () => {
    const executed: number[] = [];
    const call = latestOnly(async (n: number) => { executed.push(n); return ok(n); });
    await call(1);
    const second = call(2);
    expect(executed).toEqual([1, 2]);
    await expect(second).resolves.toEqual(ok(2));
  });
});

describe('absoluteWorkerUrl — ADR-884 Γ3γ-2β (μετρημένο ζωντανά: Worker σε `blob:` ⇒ «Failed to parse URL»)', () => {
  it('σχετικό ⇒ απόλυτο ως προς τη σελίδα · ήδη απόλυτο ⇒ ίδιο · χωρίς βάση (Node) ⇒ ως έχει', () => {
    const page = 'http://localhost:3000/o/pagonis/properties/p1';
    expect(absoluteWorkerUrl('/api/spatial-tours/x/p1/w1024.webp', page)).toBe('http://localhost:3000/api/spatial-tours/x/p1/w1024.webp');
    expect(absoluteWorkerUrl('https://cdn.example/a.webp', page)).toBe('https://cdn.example/a.webp');
    expect(absoluteWorkerUrl('/api/a', undefined)).toBe('/api/a');
  });
});
