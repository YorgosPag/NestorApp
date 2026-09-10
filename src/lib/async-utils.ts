/**
 * @module async-utils
 * @description Canonical async utilities — Single Source of Truth (ADR-212 Phase 9)
 *
 * ALL sleep/delay usage in the app MUST import from here.
 */

// ============================================================================
// SLEEP / DELAY
// ============================================================================

/**
 * Returns a Promise that resolves after `ms` milliseconds.
 * Use for rate limiting, backoff delays, polling intervals, etc.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// TIMEOUT
// ============================================================================

/**
 * Runs `promise` under a deadline: resolves with its value, or **rejects** with a
 * `TimeoutError` after `ms` milliseconds — whichever happens first.
 *
 * 🔑 **The caller declares the policy, not this function.** Rejection is the honest
 * default (something did not finish), and a caller that wants "expire quietly and
 * carry on" says so at its own call site with `.catch(...)`. One primitive, two
 * policies — instead of two near-identical primitives.
 *
 * ⚠️ **Ο N.0.2 σε πράξη (2026-08-28)**: αυτή η συνάρτηση ήταν **ιδιωτική** στο
 * `lib/firestore/contact-impact-engine.ts:63`. Ο `enterprise-api-client` χρειάστηκε την
 * ίδια δουλειά για το φράγμα ετοιμότητας ταυτότητας· ένα δεύτερο αντίγραφο εκεί θα ήταν
 * ακριβώς το sibling clone που ο **N.18** ονομάζει και το `jscpd` πιάνει. Μετακινήθηκε
 * εδώ — στο δηλωμένο SSoT του *«ALL sleep/delay usage MUST import from here»*.
 *
 * 🔴 **ΚΑΙ ΔΙΟΡΘΩΘΗΚΕ ΜΕΤΑΚΙΝΟΥΜΕΝΗ**: η ιδιωτική εκδοχή **δεν καθάριζε ποτέ** το
 * χρονόμετρό της. Σε επιτυχία το `setTimeout` έμενε ζωντανό ως τη λήξη του, κρατώντας
 * κλειστό handle — σε Node αυτό **καθυστερεί τον τερματισμό της διεργασίας** και στο Jest
 * εμφανίζεται ως *«did not exit one second after…»*. Το `finally` το κλείνει.
 */
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });

  return Promise.race([promise, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

// ============================================================================
// DEADLINE — ΜΙΑ προθεσμία για ΟΛΟ το δέντρο κλήσεων (ADR-332 D27 Β13)
// ============================================================================

/**
 * Μια **απόλυτη** προθεσμία που μοιράζεται σε διαδοχικά στάδια.
 *
 * 🔑 Google SRE, *Addressing Cascading Failures*: *«rather than inventing a deadline when
 * sending RPCs to backends, servers should employ deadline propagation»*. Κάθε στάδιο παίρνει
 * **ό,τι απομένει** ({@link Deadline.remainingMs}), όχι δικό του σταθερό χρόνο.
 *
 * 🔴 Γιατί υπάρχει: η αντίστροφη γεωκωδικοποίηση έδινε 8″ στο Nominatim και μετά έως **τρία
 * διαδοχικά** Overpass των έως τριών προσπαθειών × 6″ — ο διάλογος συρσίματος μετρήθηκε στα
 * 24–38″. Άθροισμα σταθερών χρόνων δεν είναι προθεσμία.
 */
export interface Deadline {
  /** Χιλιοστά που απομένουν — ποτέ αρνητικά. */
  remainingMs(): number;
  /** Ακυρώνεται στη λήξη — δίνεται σε `fetch`. */
  readonly signal: AbortSignal;
  /** Κλείνει το χρονόμετρο νωρίτερα. Αλλιώς κρατά ζωντανή τη διεργασία ως τη λήξη (βλ. `withTimeout`). */
  dispose(): void;
}

export function createDeadline(ms: number): Deadline {
  const endsAt = Date.now() + ms;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    remainingMs: () => Math.max(0, endsAt - Date.now()),
    signal: controller.signal,
    dispose: () => clearTimeout(timer),
  };
}

/**
 * Ένα σήμα που ακυρώνεται μόλις ακυρωθεί **οποιοδήποτε** από τα δοσμένα (τα `undefined` αγνοούνται).
 *
 * ⚠️ Όχι `AbortSignal.any`: ήρθε μόλις το 2024 (Safari 17.4 · Firefox 124), και εδώ τρέχει σε
 * περιηγητή πελάτη. Η ακύρωση γίνεται **χωρίς** αιτία, ώστε το `fetch` να απορρίπτει με
 * `AbortError` — αυτό που ήδη ταξινομεί ο καλών.
 */
export function linkedAbortSignal(...signals: readonly (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
