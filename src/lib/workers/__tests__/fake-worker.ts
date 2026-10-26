/**
 * @fileoverview **Ο ΨΕΥΤΙΚΟΣ WORKER ΤΩΝ TEST** — ο πελάτης μιλά με τον **πραγματικό** `serveWorkerRpc` μέσα από κανάλι
 * μηνυμάτων που συμπεριφέρεται σαν το `postMessage`: ασύγχρονο, και με **structured clone** σε κάθε κατεύθυνση.
 * @related `../worker-rpc-client.ts` · `../worker-rpc-host.ts` · `worker-rpc.test.ts` · τα test των Workers που χτίζουν πάνω τους
 * @module lib/workers/__tests__/fake-worker
 *
 * 🔑 **Κλώνος, όχι αναφορά**: ένα φορτίο που δεν περνά το σύνορο (συνάρτηση, κλάση με μεθόδους) **σκάει εδώ** όπως θα έσκαγε
 *   στον browser — και ένα buffer της λίστας `transfer` **αποσπάται** από τον αποστολέα, όπως στον πραγματικό Worker.
 *   Χωρίς `structuredClone` (παλιό περιβάλλον test) το μήνυμα περνά ως έχει.
 */

import { serveWorkerRpc } from '../worker-rpc-host';
import type { WorkerLike, WorkerRpcScope } from '../worker-rpc-protocol';

type Listener = (event: MessageEvent) => void;
type ErrorListener = (event: ErrorEvent) => void;

/** Ό,τι θα έκανε ο browser στο σύνορο του Worker. */
function acrossBoundary(message: unknown, transfer: Transferable[] = []): unknown {
  return typeof structuredClone === 'function' ? structuredClone(message, { transfer }) : message;
}

/** Ψεύτικος Worker: ό,τι στέλνει ο πελάτης φτάνει ασύγχρονα (και κλωνοποιημένο) στον host, και αντίστροφα. */
export class FakeWorker<Q, R> implements WorkerLike {
  readonly sent: unknown[] = [];
  /** Τα buffers που δόθηκαν για μεταφορά, ανά αποστολή. */
  readonly transfers: Transferable[][] = [];
  terminated = false;
  private readonly toClient: Listener[] = [];
  private readonly errors: ErrorListener[] = [];
  private readonly toHost: Listener[] = [];

  constructor(handle: (body: Q) => Promise<R> | R) {
    const scope: WorkerRpcScope = {
      postMessage: (message) => {
        const data = acrossBoundary(message);
        setTimeout(() => this.toClient.forEach((l) => l({ data } as MessageEvent)), 0);
      },
      addEventListener: (_type, listener) => { this.toHost.push(listener); },
    };
    serveWorkerRpc(scope, handle);
  }

  postMessage(message: unknown, transfer: Transferable[] = []): void {
    this.sent.push(message);
    this.transfers.push(transfer);
    const data = acrossBoundary(message, transfer);
    setTimeout(() => this.toHost.forEach((l) => l({ data } as MessageEvent)), 0);
  }

  addEventListener(type: 'message' | 'error', listener: Listener | ErrorListener): void {
    if (type === 'message') this.toClient.push(listener as Listener);
    else this.errors.push(listener as ErrorListener);
  }

  terminate(): void { this.terminated = true; }

  crash(message: string): void { this.errors.forEach((l) => l({ message } as ErrorEvent)); }
}
