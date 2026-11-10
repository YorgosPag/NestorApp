/**
 * @fileoverview **Η ΠΛΕΥΡΑ ΤΟΥ WEB WORKER** — απαντά σε κάθε αίτημα του `worker-rpc-client` με τον ίδιο αριθμό (ADR-884 Φ2στ-γ
 * Γ3γ-2α · §4.14). Χωρίς DOM, χωρίς React: το αρχείο Worker είναι λεπτό περιτύλιγμα γύρω από έναν **καθαρό** χειριστή.
 * @related `worker-rpc-protocol.ts` · `worker-rpc-client.ts`
 * @module lib/workers/worker-rpc-host
 *
 * 🔑 **Σφάλμα του χειριστή ⇒ απάντηση με σφάλμα**, ποτέ σιωπή: ο πελάτης δεν θα έμενε ποτέ να περιμένει ένα αίτημα που πέθανε.
 * 🔑 **Σειριακά**: ένα αίτημα τη φορά (το `await` μέσα στον ακροατή δεν μπλοκάρει τα επόμενα μηνύματα — γι' αυτό η σειρά
 *   κρατιέται ρητά με αλυσίδα υποσχέσεων· ο χειριστής μπορεί να έχει κρυφή μνήμη χωρίς αγώνες).
 * 🔑 **Η ακύρωση ΔΕΝ μπαίνει στην ουρά (ADR-929 Φ0.4)**: το `{ cancel: id }` εξυπηρετείται αμέσως, στον ακροατή — αλλιώς θα
 *   περίμενε πίσω από το ίδιο το αίτημα που θέλει να σταματήσει. Ενεργοποιεί το `AbortController` του αιτήματος: αν τρέχει,
 *   ο χειριστής το βλέπει στο επόμενο σημείο ελέγχου· αν περιμένει ακόμα στην ουρά, απαντά `cancelled` **χωρίς** να τρέξει.
 */

import type { WorkerRpcContext, WorkerRpcHandler, WorkerRpcReply, WorkerRpcRequest, WorkerRpcScope } from './worker-rpc-protocol';
import { isWorkerRpcCancel } from './worker-rpc-protocol';

/** Το πλαίσιο μιας απάντησης χωρίς κανάλι (π.χ. άμεση κλήση σε test): ποτέ ακυρωμένο, καμία πρόοδος. */
function detachedContext<P>(): WorkerRpcContext<P> {
  return { signal: new AbortController().signal, progress: () => undefined };
}

/** Η απάντηση σε ένα αίτημα — ο χειριστής τρέχει εδώ, το σφάλμα του γίνεται απάντηση. */
export async function answerWorkerRpc<Q, R, P = never>(
  request: WorkerRpcRequest<Q>,
  handle: WorkerRpcHandler<Q, R, P>,
  context: WorkerRpcContext<P> = detachedContext<P>(),
): Promise<WorkerRpcReply<R>> {
  if (context.signal.aborted) return { id: request.id, ok: false, cancelled: true };
  try {
    return { id: request.id, ok: true, value: await handle(request.body, context) };
  } catch (error: unknown) {
    if (context.signal.aborted) return { id: request.id, ok: false, cancelled: true };
    return { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * **Σύνδεσε τον χειριστή** στο καθολικό πεδίο του Worker (`self`).
 *
 * `transferOf` (προαιρετικό, συμμετρικό με το `transferOf` του πελάτη): τα buffers της **επιτυχούς** απάντησης που
 * μετακομίζουν αντί να αντιγραφούν. Μια ευθυγραμμισμένη κάτοψη 12 MP είναι 48 MB RGBA — η αντιγραφή της με structured
 * clone θα κόστιζε όσο ένα μέρος της ίδιας της επεξεργασίας (ADR-929 Φ1). Ο χειριστής **δεν** πρέπει να κρατά αναφορά
 * σε ό,τι μεταφέρεται (μένει άδειο σε αυτή την πλευρά).
 */
export function serveWorkerRpc<Q, R, P = never>(
  scope: WorkerRpcScope,
  handle: WorkerRpcHandler<Q, R, P>,
  transferOf?: (value: R) => Transferable[],
): void {
  let queue: Promise<void> = Promise.resolve();
  const controllers = new Map<number, AbortController>();
  scope.addEventListener('message', (event) => {
    const data: unknown = event.data;
    if (isWorkerRpcCancel(data)) { controllers.get(data.cancel)?.abort(); return; }
    const request = data as WorkerRpcRequest<Q>;
    const controller = new AbortController();
    controllers.set(request.id, controller);
    const context: WorkerRpcContext<P> = {
      signal: controller.signal,
      progress: (progress) => scope.postMessage({ id: request.id, progress }),
    };
    queue = queue.then(async () => {
      const reply = await answerWorkerRpc(request, handle, context);
      controllers.delete(request.id);
      scope.postMessage(reply, reply.ok && transferOf !== undefined ? transferOf(reply.value) : []);
    });
  });
}
