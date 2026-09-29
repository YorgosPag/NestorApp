/**
 * @fileoverview **Η ΠΛΕΥΡΑ ΤΟΥ WEB WORKER** — απαντά σε κάθε αίτημα του `worker-rpc-client` με τον ίδιο αριθμό (ADR-884 Φ2στ-γ
 * Γ3γ-2α · §4.14). Χωρίς DOM, χωρίς React: το αρχείο Worker είναι λεπτό περιτύλιγμα γύρω από έναν **καθαρό** χειριστή.
 * @related `worker-rpc-protocol.ts` · `worker-rpc-client.ts`
 * @module lib/workers/worker-rpc-host
 *
 * 🔑 **Σφάλμα του χειριστή ⇒ απάντηση με σφάλμα**, ποτέ σιωπή: ο πελάτης δεν θα έμενε ποτέ να περιμένει ένα αίτημα που πέθανε.
 * 🔑 **Σειριακά**: ένα αίτημα τη φορά (το `await` μέσα στον ακροατή δεν μπλοκάρει τα επόμενα μηνύματα — γι' αυτό η σειρά
 *   κρατιέται ρητά με αλυσίδα υποσχέσεων· ο χειριστής μπορεί να έχει κρυφή μνήμη χωρίς αγώνες).
 */

import type { WorkerRpcReply, WorkerRpcRequest, WorkerRpcScope } from './worker-rpc-protocol';

/** Η απάντηση σε ένα αίτημα — ο χειριστής τρέχει εδώ, το σφάλμα του γίνεται απάντηση. */
export async function answerWorkerRpc<Q, R>(request: WorkerRpcRequest<Q>, handle: (body: Q) => Promise<R> | R): Promise<WorkerRpcReply<R>> {
  try {
    return { id: request.id, ok: true, value: await handle(request.body) };
  } catch (error: unknown) {
    return { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** **Σύνδεσε τον χειριστή** στο καθολικό πεδίο του Worker (`self`). */
export function serveWorkerRpc<Q, R>(scope: WorkerRpcScope, handle: (body: Q) => Promise<R> | R): void {
  let queue: Promise<void> = Promise.resolve();
  scope.addEventListener('message', (event) => {
    const request = event.data as WorkerRpcRequest<Q>;
    queue = queue.then(async () => { scope.postMessage(await answerWorkerRpc(request, handle)); });
  });
}
