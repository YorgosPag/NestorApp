/**
 * =============================================================================
 * Η ΑΝΑΝΕΩΣΗ μιας όψης που παράγεται στον server — ο καθαρός ελεγκτής (ADR-901 §14.8)
 * =============================================================================
 *
 * Μοτίβο **invalidate + refetch** (Figma LiveGraph · Asana Luna): ένα ελαφρύ σήμα λέει «η όψη σου άλλαξε», και η
 * αλήθεια ξαναδιαβάζεται από τον server. Αυτός ο ελεγκτής αποφασίζει **πότε** — καθαρός (χωρίς React, χωρίς
 * Firestore), ώστε κάθε κανόνας του να ασκείται από άγκυρα:
 *
 * 1. **Πύλη αναθεώρησης** (Linear `lastSyncId`): ανάγνωση **μόνο** όταν το σήμα ξεπερνά την αναθεώρηση της όψης
 *    που ήδη έχουμε — η δική μου πράξη (που επέστρεψε ήδη φρέσκια όψη) δεν φέρνει δεύτερη ανάγνωση.
 * 2. **Μία ανάγνωση τη φορά** + **μία** επόμενη στην ουρά: δέκα σήματα σε ριπή ⇒ το πολύ δύο αναγνώσεις.
 * 3. **Συνένωση** (`coalesceMs`): σήματα που φτάνουν μαζί (π.χ. πράξη + ακύρωση συμμετοχών) ⇒ μία ανάγνωση.
 * 4. **Αναμονή** (`isHeld`): όσο εκκρεμούν αισιόδοξες εντολές, η ανάγνωση **περιμένει** — αλλιώς θα «πατούσε»
 *    στην οθόνη ό,τι ο server δεν έχει ακόμη επιβεβαιώσει. Ο καλών λέει `release()` όταν αδειάσει η ουρά.
 * 5. **Αποτυχία** ανάγνωσης ⇒ καμία άμεση επανάληψη (ούτε βρόχος): ξαναδοκιμάζει το επόμενο σήμα / ορατότητα / ρολόι.
 *
 * @module services/realtime/server-view-refresh
 */

/** Η ανάγνωση της όψης — επιστρέφει την αναθεώρηση της όψης που ήρθε, ή `null` αν απέτυχε. */
export type ServerViewFetch = () => Promise<number | null>;

export interface ServerViewRefreshOptions {
  readonly fetch: ServerViewFetch;
  readonly isHeld: () => boolean;
  readonly coalesceMs: number;
  readonly setTimer: (run: () => void, ms: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
}

export interface ServerViewRefresh {
  /** Μια όψη ήρθε (από οποιαδήποτε πηγή: αρχική φόρτωση, πράξη, ανάγνωση) — η αναθεώρησή της. */
  noteView(revision: number): void;
  /** Το σήμα της όψης άλλαξε. */
  noteSignal(revision: number): void;
  /** Ανάγνωση **χωρίς** πύλη (ορατότητα καρτέλας · επανασύνδεση · λήξη `freshUntil`). */
  force(): void;
  /** Η ουρά αισιόδοξων εντολών άδειασε — ό,τι περίμενε, ξεκινά. */
  release(): void;
  dispose(): void;
}

export function createServerViewRefresh(options: ServerViewRefreshOptions): ServerViewRefresh {
  let known = 0;
  let signalled = 0;
  let forced = false;
  let inFlight = false;
  let waiting = false;
  let disposed = false;
  let timer: unknown = null;

  const wanted = () => forced || signalled > known;

  const schedule = () => {
    if (disposed || timer !== null) return;
    timer = options.setTimer(() => {
      timer = null;
      void run();
    }, options.coalesceMs);
  };

  async function run(): Promise<void> {
    if (disposed || !wanted()) return;
    if (options.isHeld()) {
      waiting = true;
      return;
    }
    if (inFlight) return; // η επόμενη ξεκινά όταν τελειώσει η τρέχουσα (βλ. κάτω)
    inFlight = true;
    forced = false;
    const revision = await options.fetch().catch(() => null);
    inFlight = false;
    if (revision === null || disposed) return;
    known = Math.max(known, revision);
    if (wanted()) schedule();
  }

  return {
    noteView(revision) {
      known = Math.max(known, revision);
    },
    noteSignal(revision) {
      signalled = Math.max(signalled, revision);
      if (signalled > known) schedule();
    },
    force() {
      forced = true;
      schedule();
    },
    release() {
      if (!waiting) return;
      waiting = false;
      schedule();
    },
    dispose() {
      disposed = true;
      if (timer !== null) options.clearTimer(timer);
      timer = null;
    },
  };
}
