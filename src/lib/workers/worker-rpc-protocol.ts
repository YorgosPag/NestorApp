/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΚΥΡΙΟΥ ΝΗΜΑΤΟΣ ⇄ WEB WORKER** — ένα αίτημα, μία απάντηση, ταυτισμένα με αριθμό (ADR-884 Φ2στ-γ
 * Γ3γ-2α · §4.14). Καθαροί τύποι, χωρίς DOM (η `location` μόνο ως προαιρετική βάση του `absoluteWorkerUrl`).
 * @related `worker-rpc-client.ts` (η πλευρά του κύριου νήματος) · `worker-rpc-host.ts` (η πλευρά του Worker)
 * @module lib/workers/worker-rpc-protocol
 *
 * 🔑 **Γιατί υπάρχει**: το ίδιο RPC (αριθμός αιτήματος → Map εκκρεμών, «κατάρρευση ⇒ όλα αποτυγχάνουν») ήταν γραμμένο με το
 *   χέρι σε κάθε Worker του dxf-viewer. Εδώ ζει **μία** φορά· η μετάβασή τους είναι εκκρεμότητα ratchet.
 * 🔑 **Ποτέ `reject`**: κάθε κλήση λύνεται με **ονομασμένο** αποτέλεσμα — ο καλών δεν μπορεί να «ξεχάσει» το `catch`.
 */

/** Ό,τι στέλνει ο κύριος νήμας. */
export interface WorkerRpcRequest<Q> {
  readonly id: number;
  readonly body: Q;
}

/** Ό,τι απαντά ο Worker — τιμή ή το μήνυμα του σφάλματος που πέταξε ο χειριστής. */
export type WorkerRpcReply<R> =
  | { readonly id: number; readonly ok: true; readonly value: R }
  | { readonly id: number; readonly ok: false; readonly error: string };

/**
 * Το αποτέλεσμα μιας κλήσης στον καλούντα. `superseded` = την αντικατέστησε νεότερο αίτημα πριν ξεκινήσει (`latestOnly`) —
 * **δεν** είναι αποτυχία, απλώς δεν αφορά πια κανέναν.
 */
export type WorkerRpcResult<R> =
  | { readonly kind: 'ok'; readonly value: R }
  | { readonly kind: 'failed'; readonly error: string }
  | { readonly kind: 'superseded' };

/** Η ελάχιστη μορφή ενός Worker που χρειάζεται ο πελάτης — ο πραγματικός `Worker` την ικανοποιεί, και ο ψεύτικος των test. */
export interface WorkerLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
  terminate(): void;
}

/** Η ελάχιστη μορφή του καθολικού πεδίου ενός Worker (`self`) που χρειάζεται ο οικοδεσπότης. */
export interface WorkerRpcScope {
  postMessage(message: unknown): void;
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
