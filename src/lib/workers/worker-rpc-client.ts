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
 * 🔑 **Ακύρωση (ADR-929 Φ0.4)**: `run(body, { signal })` — στο `abort` η κλήση λύνεται **αμέσως** `cancelled` (όπως το
 *   `fetch`) και φεύγει `{ cancel: id }` ώστε ο Worker να σταματήσει στο επόμενο σημείο ελέγχου· η αργοπορημένη απάντησή
 *   του πετιέται. Πρόοδος με `onProgress`.
 * 🔑 **Τερματισμός μετά από αδράνεια (`idleTimeoutMs`, ADR-929 Φ0.4)**: η μνήμη ενός WASM **δεν μικραίνει ποτέ** (μάθημα
 *   YuNet, `yunet-session.ts`) ⇒ ο Worker τερματίζεται όταν μείνει χωρίς εκκρεμή κλήση για τόσο χρόνο, και ξαναγεννιέται
 *   στην επόμενη. Χωρίς την επιλογή ⇒ ζει ως το `dispose` (η συμπεριφορά των υπαρχόντων Workers).
 */

import type {
  WorkerLike, WorkerRpcCallOptions, WorkerRpcCancel, WorkerRpcCancellableResult, WorkerRpcContext, WorkerRpcProgress,
  WorkerRpcReply, WorkerRpcRequest, WorkerRpcResult,
} from './worker-rpc-protocol';
import { isWorkerRpcProgress } from './worker-rpc-protocol';

export interface WorkerRpcClientOptions<Q, R, P = never> {
  /** Γεννά τον Worker — `null` όταν ο browser δεν μπορεί (SSR, παλιός browser, απαγόρευση CSP). */
  readonly spawn: () => WorkerLike | null;
  /** Ο **ίδιος** χειριστής στον κύριο νήμα, όταν δεν υπάρχει/έπεσε ο Worker. Χωρίς αυτόν ⇒ `failed`. */
  readonly fallback?: (body: Q, context: WorkerRpcContext<P>) => Promise<R>;
  /**
   * Τα buffers του αιτήματος που **μετακομίζουν** στον Worker αντί να αντιγραφούν (structured clone ⇒ zero-copy). Δηλώνεται
   * εδώ, όχι ανά κλήση, ώστε το `latestOnly` να μένει αμετάβλητο: ένα αίτημα που προσπεράστηκε δεν στάλθηκε ποτέ, άρα τα
   * buffers του δεν αποσπάστηκαν. ⚠️ Μετά την αποστολή το buffer είναι **άδειο** στον κύριο νήμα — ο καλών φτιάχνει νέο ανά κλήση.
   * Το δίχτυ λαμβάνει το σώμα ανέπαφο (καμία μεταφορά).
   */
  readonly transferOf?: (body: Q) => Transferable[];
  /** Τερματισμός του Worker μετά από τόσα ms χωρίς εκκρεμή κλήση (βλ. κεφαλίδα). */
  readonly idleTimeoutMs?: number;
}

export interface WorkerRpcClient<Q, R, P = never> {
  readonly call: (body: Q) => Promise<WorkerRpcResult<R>>;
  /** Η κλήση με ακύρωση και πρόοδο (ADR-929 Φ0.4). */
  readonly run: (body: Q, options: WorkerRpcCallOptions<P>) => Promise<WorkerRpcCancellableResult<R>>;
  /** Τερματίζει τον Worker· οι εκκρεμείς κλήσεις λύνονται `failed`. */
  readonly dispose: () => void;
}

/** Το σφάλμα των κλήσεων που έμειναν εκκρεμείς στο `dispose` — ο καλών έφυγε, **δεν** απέτυχε η ερώτηση. */
export const WORKER_RPC_DISPOSED = 'disposed';

const CANCELLED = { kind: 'cancelled' } as const;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const noProgress = (): void => undefined;

async function runFallback<Q, R, P>(
  fallback: ((body: Q, context: WorkerRpcContext<P>) => Promise<R>) | undefined,
  body: Q,
  options: WorkerRpcCallOptions<P>,
): Promise<WorkerRpcCancellableResult<R>> {
  const { signal } = options;
  if (signal?.aborted) return CANCELLED;
  if (fallback === undefined) return { kind: 'failed', error: 'worker-unavailable' };
  try {
    const context = { signal: signal ?? new AbortController().signal, progress: options.onProgress ?? noProgress };
    return { kind: 'ok', value: await fallback(body, context) };
  } catch (error: unknown) {
    return signal?.aborted ? CANCELLED : { kind: 'failed', error: errorText(error) };
  }
}

function resultOf<R>(reply: WorkerRpcReply<R>): WorkerRpcCancellableResult<R> {
  if (reply.ok) return { kind: 'ok', value: reply.value };
  return 'cancelled' in reply ? CANCELLED : { kind: 'failed', error: reply.error };
}

interface PendingCall<R, P> {
  readonly resolve: (result: WorkerRpcCancellableResult<R>) => void;
  readonly onProgress?: (value: P) => void;
}

/** Οι κλήσεις που περιμένουν απάντηση, με τον αριθμό τους. `onEmpty` = έμεινε χωρίς καμία (αρχή αδράνειας). */
interface PendingTable<R, P> {
  readonly register: (call: PendingCall<R, P>) => number;
  readonly settle: (reply: WorkerRpcReply<R>) => void;
  readonly progress: (message: WorkerRpcProgress<P>) => void;
  /** `true` αν η κλήση ήταν ακόμα εκκρεμής (και λύθηκε τώρα `cancelled`). */
  readonly cancel: (id: number) => boolean;
  readonly failAll: (error: string) => void;
}

function createPendingTable<R, P>(onEmpty: () => void): PendingTable<R, P> {
  let nextId = 1;
  const pending = new Map<number, PendingCall<R, P>>();
  const take = (id: number): PendingCall<R, P> | undefined => {
    const call = pending.get(id);
    pending.delete(id);
    if (call !== undefined && pending.size === 0) onEmpty();
    return call;
  };
  return {
    register: (call) => { const id = nextId++; pending.set(id, call); return id; },
    settle: (reply) => take(reply.id)?.resolve(resultOf(reply)),
    progress: (message) => pending.get(message.id)?.onProgress?.(message.progress),
    cancel: (id) => {
      const call = take(id);
      call?.resolve(CANCELLED);
      return call !== undefined;
    },
    failAll: (error) => {
      const calls = [...pending.values()];
      pending.clear();
      for (const call of calls) call.resolve({ kind: 'failed', error });
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

/** Το χρονόμετρο αδράνειας: ξεκινά όταν αδειάσει ο πίνακας, σταματά στην επόμενη κλήση. */
function createIdleTimer(ms: number | undefined, expire: () => void): { readonly arm: () => void; readonly disarm: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const disarm = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const arm = (): void => {
    if (ms === undefined) return;
    disarm();
    timer = setTimeout(() => { timer = null; expire(); }, ms);
  };
  return { arm, disarm };
}

/** Στέλνει ένα αίτημα και δένει την ακύρωση του `signal` στο μήνυμα `{ cancel: id }`. */
function sendRequest<Q, R, P>(
  target: WorkerLike, table: PendingTable<R, P>, body: Q, options: WorkerRpcCallOptions<P>, transfer: Transferable[],
): Promise<WorkerRpcCancellableResult<R>> {
  const { signal, onProgress } = options;
  return new Promise((resolve) => {
    let id = 0;
    const onAbort = (): void => {
      if (table.cancel(id)) target.postMessage({ cancel: id } satisfies WorkerRpcCancel);
    };
    id = table.register({
      resolve: (result) => { signal?.removeEventListener('abort', onAbort); resolve(result); },
      onProgress,
    });
    signal?.addEventListener('abort', onAbort, { once: true });
    target.postMessage({ id, body } satisfies WorkerRpcRequest<Q>, transfer);
  });
}

/** **Ο πελάτης** — ένας Worker, πολλές ταυτόχρονες κλήσεις, η καθεμία με τον δικό της αριθμό. */
export function createWorkerRpcClient<Q, R, P = never>(options: WorkerRpcClientOptions<Q, R, P>): WorkerRpcClient<Q, R, P> {
  let worker: WorkerLike | null = null;
  let broken = false;
  const retire = (): void => { worker?.terminate(); worker = null; };
  const idle = createIdleTimer(options.idleTimeoutMs, retire);
  const table = createPendingTable<R, P>(idle.arm);

  const crash = (event: ErrorEvent) => {
    broken = true;
    idle.disarm();
    retire();
    table.failAll(event.message || 'worker-crashed');
  };
  const receive = (data: unknown): void => {
    if (isWorkerRpcProgress(data)) table.progress(data as WorkerRpcProgress<P>);
    else table.settle(data as WorkerRpcReply<R>);
  };
  const ensure = (): WorkerLike | null => {
    if (worker !== null || broken) return worker;
    worker = spawnSafely(options.spawn);
    if (worker === null) { broken = true; return null; }
    worker.addEventListener('message', (event) => receive(event.data));
    worker.addEventListener('error', crash);
    return worker;
  };

  const run = (body: Q, callOptions: WorkerRpcCallOptions<P>): Promise<WorkerRpcCancellableResult<R>> => {
    if (callOptions.signal?.aborted) return Promise.resolve(CANCELLED);
    idle.disarm();
    const target = ensure();
    if (target === null) return runFallback(options.fallback, body, callOptions);
    return sendRequest(target, table, body, callOptions, options.transferOf?.(body) ?? []);
  };

  return {
    // Χωρίς `signal` καμία κλήση δεν ακυρώνεται· ο κλάδος υπάρχει μόνο για να στενέψει ο τύπος, χωρίς μετατροπή.
    call: async (body) => {
      const result = await run(body, {});
      return result.kind === 'cancelled' ? { kind: 'failed', error: 'cancelled' } : result;
    },
    run,
    dispose: () => {
      idle.disarm();
      retire();
      table.failAll(WORKER_RPC_DISPOSED);
    },
  };
}

/**
 * **Μόνο το τελευταίο**: όσο τρέχει ένα αίτημα, το νεότερο περιμένει — και αν έρθει κι άλλο, το προηγούμενο αναμένον λύνεται
 * `superseded` χωρίς να σταλεί ποτέ. Το αίτημα σε πτήση ολοκληρώνεται κανονικά (ο Worker δεν διακόπτεται στη μέση· για
 * διακοπή, ο καλών ακυρώνει με το `signal` του `run`).
 */
export function latestOnly<Q, T>(call: (body: Q) => Promise<T>): (body: Q) => Promise<T | { readonly kind: 'superseded' }> {
  type Settled = T | { readonly kind: 'superseded' };
  let running = false;
  let waiting: { readonly body: Q; readonly resolve: (result: Settled) => void } | null = null;

  const pump = async (body: Q, resolve: (result: Settled) => void): Promise<void> => {
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
