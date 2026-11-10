/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΚΥΡΙΟΥ ΝΗΜΑΤΟΣ ⇄ WEB WORKER** — ένα αίτημα, μία απάντηση, ταυτισμένα με αριθμό (ADR-884 Φ2στ-γ
 * Γ3γ-2α · §4.14). Καθαροί τύποι, χωρίς DOM (η `location` μόνο ως προαιρετική βάση του `absoluteWorkerUrl`).
 * @related `worker-rpc-client.ts` (η πλευρά του κύριου νήματος) · `worker-rpc-host.ts` (η πλευρά του Worker)
 * @module lib/workers/worker-rpc-protocol
 *
 * 🔑 **Γιατί υπάρχει**: το ίδιο RPC (αριθμός αιτήματος → Map εκκρεμών, «κατάρρευση ⇒ όλα αποτυγχάνουν») ήταν γραμμένο με το
 *   χέρι σε κάθε Worker του dxf-viewer. Εδώ ζει **μία** φορά· η μετάβασή τους είναι εκκρεμότητα ratchet.
 * 🔑 **Ποτέ `reject`**: κάθε κλήση λύνεται με **ονομασμένο** αποτέλεσμα — ο καλών δεν μπορεί να «ξεχάσει» το `catch`.
 * 🔑 **Ακύρωση + πρόοδος (ADR-929 Φ0.4)**: προαιρετικά ανά κλήση — ένα μήνυμα `{ cancel: id }` προς τον Worker και
 *   μηνύματα `{ id, progress }` προς τον πελάτη, στο ίδιο κανάλι. Οι Workers που δεν τα χρησιμοποιούν μένουν αμετάβλητοι.
 */

/** Ό,τι στέλνει ο κύριος νήμας. */
export interface WorkerRpcRequest<Q> {
  readonly id: number;
  readonly body: Q;
}

/**
 * Ό,τι απαντά ο Worker — τιμή, το μήνυμα του σφάλματος που πέταξε ο χειριστής, ή `cancelled` όταν ο χειριστής σταμάτησε
 * επειδή το ζήτησε ο πελάτης (ADR-929 Φ0.4).
 */
export type WorkerRpcReply<R> =
  | { readonly id: number; readonly ok: true; readonly value: R }
  | { readonly id: number; readonly ok: false; readonly error: string }
  | { readonly id: number; readonly ok: false; readonly cancelled: true };

/**
 * **Ακύρωση ενός αιτήματος** (ADR-929 Φ0.4). Το `AbortSignal` **δεν** περνά το σύνορο του Worker (δεν κλωνοποιείται —
 * WHATWG DOM #948)· το καθιερωμένο πρότυπο (Node `worker_threads`, η ακύρωση του `fetch` μέσα σε Service Worker) είναι
 * **μήνυμα** ακύρωσης στο ίδιο κανάλι, και ο οικοδεσπότης ενεργοποιεί ένα **δικό του** `AbortController` για το αίτημα.
 */
export interface WorkerRpcCancel {
  readonly cancel: number;
}

/** Ενδιάμεση ειδοποίηση προόδου ενός αιτήματος — **δεν** το λύνει (ADR-929 Φ0.4). */
export interface WorkerRpcProgress<P> {
  readonly id: number;
  readonly progress: P;
}

export const isWorkerRpcCancel = (data: unknown): data is WorkerRpcCancel =>
  typeof data === 'object' && data !== null && typeof (data as { cancel?: unknown }).cancel === 'number';

export const isWorkerRpcProgress = (data: unknown): data is WorkerRpcProgress<unknown> =>
  typeof data === 'object' && data !== null && 'progress' in data && !('ok' in data);

/**
 * Ό,τι λαμβάνει ο χειριστής μαζί με το σώμα: το `signal` του αιτήματος (ενεργοποιείται από το μήνυμα ακύρωσης) και η
 * αναφορά προόδου. Ο χειριστής που δεν τα χρειάζεται τα αγνοεί — οι υπάρχοντες χειριστές `(body) => …` ικανοποιούν τον τύπο.
 */
export interface WorkerRpcContext<P> {
  readonly signal: AbortSignal;
  readonly progress: (value: P) => void;
}

/** Ο καθαρός χειριστής ενός Worker (και του διχτυού του στον κύριο νήμα). */
export type WorkerRpcHandler<Q, R, P = never> = (body: Q, context: WorkerRpcContext<P>) => Promise<R> | R;

/**
 * Το αποτέλεσμα μιας κλήσης στον καλούντα. `superseded` = την αντικατέστησε νεότερο αίτημα πριν ξεκινήσει (`latestOnly`) —
 * **δεν** είναι αποτυχία, απλώς δεν αφορά πια κανέναν.
 */
export type WorkerRpcResult<R> =
  | { readonly kind: 'ok'; readonly value: R }
  | { readonly kind: 'failed'; readonly error: string }
  | { readonly kind: 'superseded' };

/**
 * Το αποτέλεσμα μιας κλήσης **με `signal`** (`WorkerRpcClient.run`): και `cancelled` = ο καλών ακύρωσε. Χωριστός τύπος
 * επίτηδες: οι καλούντες του `call` (χωρίς `signal`) δεν μπορούν να ακυρωθούν, άρα δεν τους φορτώνεται κλάδος που δεν
 * συμβαίνει ποτέ.
 */
export type WorkerRpcCancellableResult<R> = WorkerRpcResult<R> | { readonly kind: 'cancelled' };

/** Ανά κλήση: ακύρωση και πρόοδος — και τα δύο προαιρετικά. */
export interface WorkerRpcCallOptions<P> {
  readonly signal?: AbortSignal;
  readonly onProgress?: (value: P) => void;
}

/** Η ελάχιστη μορφή ενός Worker που χρειάζεται ο πελάτης — ο πραγματικός `Worker` την ικανοποιεί, και ο ψεύτικος των test. */
export interface WorkerLike {
  /** `transfer` = buffers που **μετακομίζουν** στον Worker (zero-copy) — μένουν άδεια σε αυτή την πλευρά. */
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
  terminate(): void;
}

/** Η ελάχιστη μορφή του καθολικού πεδίου ενός Worker (`self`) που χρειάζεται ο οικοδεσπότης. */
export interface WorkerRpcScope {
  /** `transfer` = buffers της απάντησης που **μετακομίζουν** στον κύριο νήμα (zero-copy), π.χ. μια επεξεργασμένη εικόνα. */
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

/**
 * **Κάθε URL που περνά σε Worker γίνεται ΑΠΟΛΥΤΟ στον κύριο νήμα** (ADR-884 Γ3γ-2β, μετρημένο ζωντανά): ο Turbopack γεννά τους
 * module Workers από `blob:` URL, και εκεί ένα σχετικό `/api/…` **δεν έχει βάση** — `fetch` πετά «Failed to parse URL». Στο jsdom
 * δεν φαίνεται (δεν υπάρχει πραγματικός Worker). Η βάση λύνεται **εδώ**, στην πλευρά που ξέρει τη σελίδα· χωρίς `location` (Node,
 * tests) ⇒ ως έχει.
 */
export function absoluteWorkerUrl(url: string, base: string | undefined = globalThis.location?.href): string {
  return base === undefined ? url : new URL(url, base).href;
}
