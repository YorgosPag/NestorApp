/**
 * =============================================================================
 * ADR-744 §34 — ΠΙΝΑΚΕΣ ΜΗΝΥΜΑΤΩΝ ΠΟΥ ΔΕΝ ΖΩΓΡΑΦΙΖΟΝΤΑΙ ΣΤΟ ΠΡΩΤΟ ΚΑΡΕ
 * =============================================================================
 *
 * «Ένας πίνακας `κωδικός → κλειδί` με 159 γραμμές, που ζωγραφίζει **μόνο** όταν κάτι πάει
 * στραβά — πρέπει να τον πληρώνει το πρώτο καρέ **κάθε** σελίδας;»
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ (2026-11-03):** το route slice της `/catalog/imports` ήταν 28.189 bytes, και
 * τα **19.652** από αυτά ήταν `catalog.issues.*`. Ο εξαγωγέας κλειδιών (ADR-744 §2) βλέπει
 * `t(ISSUE_KEYS[issue.code])` ⇒ «υπολογισμένος δείκτης ⇒ **όλες** οι τιμές», σωστά: δεν μπορεί
 * να ξέρει ποιος κωδικός θα έρθει. Το ίδιο κόστος πλήρωνε κάθε σελίδα του καταλόγου.
 *
 * 🔑 **ΚΑΝΕΝΑΣ ΔΕΥΤΕΡΟΣ ΜΗΧΑΝΙΣΜΟΣ.** Ο γεννήτορας ήδη θεωρεί κάθε `import()` **όριο**
 * (`shell-closure.js`: «ένα module σε τεμπέλικο chunk δεν ζωγραφίζει πριν το δικό του
 * round-trip»). Εδώ ο πίνακας ζει πίσω από αυτό το όριο — όπως στο Lingui και στο Closure,
 * όπου τα μηνύματα **ταξιδεύουν με το chunk** που τα δείχνει. Τίποτα δεν δηλώνεται με το
 * χέρι σε λίστα: το όριο είναι ο ίδιος ο κώδικας.
 *
 * 🔑 **ΕΤΟΙΜΟ = ΠΙΝΑΚΑΣ ΚΑΙ ΠΛΗΡΕΣ BUNDLE, ΜΑΖΙ.** Ο πίνακας μόνος δεν φτάνει: τα κλειδιά του
 * λείπουν **επίτηδες** από το slice, άρα χωρίς πλήρες bundle θα έβγαιναν ωμά. Η ετοιμότητα
 * του bundle κρίνεται **μόνο** από την αυθεντία του (`bundle-registry`, μέσω του
 * `useBundlesComplete`) — ποτέ με δεύτερη ερώτηση εδώ.
 *
 * 🔑 **ΠΡΟΦΟΡΤΩΣΗ ΣΕ ΑΔΡΑΝΕΙΑ, ΑΜΕΣΗ ΦΟΡΤΩΣΗ ΣΕ ΖΗΤΗΣΗ.** Ό,τι μπορεί να δείξει εύρημα ζητά
 * τον πίνακα **μετά** το πρώτο καρέ, σε αδράνεια (`requestIdleCallback`) — άρα όταν ο χρήστης
 * κάνει το πρώτο λάθος, ο πίνακας είναι ήδη εκεί. Αν εύρημα εμφανιστεί **πριν**, η ζήτηση
 * γίνεται αμέσως. Αποτυχία ⇒ η επόμενη ζήτηση είναι νέα απόπειρα (`singleFlight`), ποτέ
 * cache της αποτυχίας.
 *
 * ⚠️ **ΜΗΝ** εισαγάγεις στατικά το module του πίνακα από κώδικα εφαρμογής: θα τον ξαναέβαζε
 * στην κλειστότητα της σελίδας και στο slice. Το φυλάει άγκυρα στην πλευρά του καταναλωτή.
 *
 * @module i18n/deferred-message-table
 * @see docs/centralized-systems/reference/adrs/ADR-744-i18n-shell-slice.md §34
 */

import { createExternalStore } from '@/lib/state/createExternalStore';
import { createModuleLogger } from '@/lib/telemetry';
import { loadNamespace, type Namespace } from './lazy-config';
import { importWithRetry, singleFlight } from './namespace-load';

const logger = createModuleLogger('i18n-deferred-message-table');

/** Ένας πίνακας μηνυμάτων πίσω από όριο `import()`, μαζί με τα namespaces που χρειάζονται τα κλειδιά του. */
export interface DeferredMessageTable<T> {
  /** Μοναδικό όνομα — κλειδί του `singleFlight` και των μηνυμάτων καταγραφής. */
  readonly id: string;
  readonly namespaces: readonly Namespace[];
  /** Ζητά πίνακα και namespaces. Ιδεμποτικό· **δεν απορρίπτει ποτέ**. */
  load(): Promise<void>;
  /** Ο πίνακας, ή `null` όσο δεν έχει φτάσει. Σταθερή αναφορά μετά τη φόρτωση. */
  getTable(): T | null;
  subscribe(listener: () => void): () => void;
}

/**
 * Δηλώνει πίνακα μηνυμάτων που φορτώνεται εκτός πρώτου καρέ.
 * @param load πάντα `() => import('./…')` — το `import()` **είναι** το όριο που βλέπει ο γεννήτορας.
 */
export function defineDeferredMessageTable<T>(
  id: string,
  namespaces: readonly Namespace[],
  load: () => Promise<T>,
): DeferredMessageTable<T> {
  // Το κελί pub/sub είναι το SSoT της πλατφόρμας (`createExternalStore`), όχι δεύτερο χειρόγραφο σύνολο listeners.
  const store = createExternalStore<T | null>(null);

  // Δύο ΑΝΕΞΑΡΤΗΤΕΣ συνθήκες ετοιμότητας: ο πίνακας (δικός μας) και τα bundles (του `bundle-registry`, με δική του
  // επανάληψη και ανάκτηση — ADR-744 §25). Τα bundles ζητούνται, δεν αναμένονται εδώ: η πληρότητά τους κρίνεται στον hook.
  const requestNamespaces = (): void => {
    for (const namespace of namespaces) {
      Promise.resolve().then(() => loadNamespace(namespace)).catch((error: unknown) => {
        logger.error(`deferred message table ${id}: namespace ${namespace} request threw`, { error });
      });
    }
  };

  const fetchTable = async (): Promise<void> => {
    requestNamespaces();
    try {
      store.set(await importWithRetry(load));
    } catch (error) {
      logger.error(`deferred message table ${id} failed to load — generic wording stays until the next request`, { error });
    }
  };

  return {
    id,
    namespaces,
    load: () => (store.get() !== null ? Promise.resolve() : singleFlight(`deferred:${id}`, fetchTable)),
    getTable: store.get,
    subscribe: store.subscribe,
  };
}

/** Ελάχιστη όψη του `window` για την αδράνεια — δοκιμάσιμη χωρίς browser. */
export interface IdleHost {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
  setTimeout: (callback: () => void, ms: number) => number;
  clearTimeout: (handle: number) => void;
}

/** Το ανώτατο όριο αναμονής αδράνειας: σε σελίδα που δεν ησυχάζει ποτέ, η προφόρτωση δεν χάνεται. */
export const DEFERRED_PRELOAD_TIMEOUT_MS = 2000;

/** Τρέχει το `run` σε αδράνεια (ή μετά από `timeout` χωρίς `requestIdleCallback`). Επιστρέφει ακύρωση. */
export function whenIdle(host: IdleHost, run: () => void): () => void {
  // Κλήση **ως μέθοδος** του host: αποσπασμένο, το `window.requestIdleCallback` πετά «Illegal invocation».
  if (host.requestIdleCallback && host.cancelIdleCallback) {
    const handle = host.requestIdleCallback(run, { timeout: DEFERRED_PRELOAD_TIMEOUT_MS });
    return () => host.cancelIdleCallback?.(handle);
  }
  const handle = host.setTimeout(run, 0);
  return () => host.clearTimeout(handle);
}
