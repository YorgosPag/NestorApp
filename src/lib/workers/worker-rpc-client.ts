/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΕΝΟΣ WEB WORKER** — κλήσεις με υπόσχεση πάνω στο `postMessage`, με δίχτυ στον κύριο νήμα και
 * «μόνο το τελευταίο» για αιτήματα που τα προσπερνά ο χρήστης (ADR-884 Φ2στ-γ Γ3γ-2α · §4.14).
 * @related `worker-rpc-protocol.ts` (το συμβόλαιο) · `worker-rpc-host.ts` (η άλλη πλευρά)
 * @module lib/workers/worker-rpc-client
 *
 * 🔑 **Νωχελικό**: ο Worker γεννιέται στην πρώτη κλήση — μια σελίδα που δεν τον χρειάζεται δεν πληρώνει τίποτα.
 * 🔑 **Κατάρρευση ⇒ κανείς δεν κρέμεται**: κάθε εκκρεμής κλήση λύνεται `failed`, και οι επόμενες πάνε στο **δίχτυ** (ο ίδιος
 *   καθαρός χειριστής στον κύριο νήμα) αν δόθηκε — ποτέ βρόχος επαναγέννησης ενός Worker που πέφτει.
 * 🔑 **`latestOnly`** (ρυθμιστικό, αιώρηση): το πολύ **ένα** αίτημα σε πτήση και **ένα** αναμένον που αντικαθίσταται. Καμία
 *   καθυστέρηση (όπως θα είχε ένα debounce) και καμία ουρά από παλιές ερωτήσεις.
 */

import type { WorkerLike, WorkerRpcReply, WorkerRpcRequest, WorkerRpcResult } from './worker-rpc-protocol';

export interface WorkerRpcClientOptions<Q, R> {
  /** Γεννά τον Worker — `null` όταν ο browser δεν μπορεί (SSR, παλιός browser, απαγόρευση CSP). */
  readonly spawn: () => WorkerLike | null;
  /** Ο **ίδιος** χειριστής στον κύριο νήμα, όταν δεν υπάρχει/έπεσε ο Worker. Χωρίς αυτόν ⇒ `failed`. */
  readonly fallback?: (body: Q) => Promise<R>;
}

export interface WorkerRpcClient<Q, R> {
  readonly call: (body: Q) => Promise<WorkerRpcResult<R>>;
  /** Τερματίζει τον Worker· οι εκκρεμείς κλήσεις λύνονται `failed`. */
  readonly dispose: () => void;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function runFallback<Q, R>(fallback: ((body: Q) => Promise<R>) | undefined, body: Q): Promise<WorkerRpcResult<R>> {
  if (fallback === undefined) return { kind: 'failed', error: 'worker-unavailable' };
  try {
    return { kind: 'ok', value: await fallback(body) };
  } catch (error: unknown) {
    return { kind: 'failed', error: errorText(error) };
  }
}

/** Οι κλήσεις που περιμένουν απάντηση, με τον αριθμό τους. */
interface PendingTable<R> {
  readonly add: (resolve: (result: WorkerRpcResult<R>) => void) => number;
  readonly settle: (reply: WorkerRpcReply<R>) => void;
  readonly failAll: (error: string) => void;
}

function createPendingTable<R>(): PendingTable<R> {
  let nextId = 1;
  const pending = new Map<number, (result: WorkerRpcResult<R>) => void>();
  return {
    add: (resolve) => { const id = nextId++; pending.set(id, resolve); return id; },
    settle: (reply) => {
      const resolve = pending.get(reply.id);
      if (resolve === undefined) return;
      pending.delete(reply.id);
      resolve(reply.ok ? { kind: 'ok', value: reply.value } : { kind: 'failed', error: reply.error });
    },
    failAll: (error) => {
      for (const resolve of pending.values()) resolve({ kind: 'failed', error });
      pending.clear();
    },
  };
}

function spawnSafely(spawn: () => WorkerLike | null): WorkerLike | null {
  try {
    return spawn();
  } catch {
    return null; // CSP / bundler χωρίς υποστήριξη ⇒ δίχτυ, ποτέ σφάλμα στον καλούντα
  }
}

/** **Ο πελάτης** — ένας Worker, πολλές ταυτόχρονες κλήσεις, η καθεμία με τον δικό της αριθμό. */
export function createWorkerRpcClient<Q, R>(options: WorkerRpcClientOptions<Q, R>): WorkerRpcClient<Q, R> {
  const table = createPendingTable<R>();
  let worker: WorkerLike | null = null;
  let broken = false;

  const crash = (event: ErrorEvent) => {
    broken = true;
    worker?.terminate();
    worker = null;
    table.failAll(event.message || 'worker-crashed');
  };
  const ensure = (): WorkerLike | null => {
    if (worker !== null || broken) return worker;
    worker = spawnSafely(options.spawn);
    if (worker === null) { broken = true; return null; }
    worker.addEventListener('message', (event) => table.settle(event.data as WorkerRpcReply<R>));
    worker.addEventListener('error', crash);
    return worker;
  };

  return {
    call: (body) => {
      const target = ensure();
      if (target === null) return runFallback(options.fallback, body);
      return new Promise((resolve) => {
        const request: WorkerRpcRequest<Q> = { id: table.add(resolve), body };
        target.postMessage(request);
      });
    },
    dispose: () => {
      worker?.terminate();
      worker = null;
      table.failAll('disposed');
    },
  };
}

/**
 * **Μόνο το τελευταίο**: όσο τρέχει ένα αίτημα, το νεότερο περιμένει — και αν έρθει κι άλλο, το προηγούμενο αναμένον λύνεται
 * `superseded` χωρίς να σταλεί ποτέ. Το αίτημα σε πτήση ολοκληρώνεται κανονικά (ο Worker δεν διακόπτεται στη μέση).
 */
export function latestOnly<Q, R>(call: (body: Q) => Promise<WorkerRpcResult<R>>): (body: Q) => Promise<WorkerRpcResult<R>> {
  let running = false;
  let waiting: { readonly body: Q; readonly resolve: (result: WorkerRpcResult<R>) => void } | null = null;

  const pump = async (body: Q, resolve: (result: WorkerRpcResult<R>) => void): Promise<void> => {
    running = true;
    resolve(await call(body));
    running = false;
    const next = waiting;
    waiting = null;
    if (next !== null) await pump(next.body, next.resolve);
  };

  return (body) => new Promise((resolve) => {
    if (!running) { void pump(body, resolve); return; }
    waiting?.resolve({ kind: 'superseded' });
    waiting = { body, resolve };
  });
}
