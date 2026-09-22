/**
 * =============================================================================
 * FIRESTORE PENDING WRITES → UNSAVED-WORK REGISTRY (ADR-367 §2.6)
 * =============================================================================
 *
 * Με `memoryLocalCache` (ADR-367 §2.5) οι εγγραφές που δεν έχει επιβεβαιώσει ο server ζουν
 * **μόνο** στη μνήμη της καρτέλας. Εκτός σύνδεσης μπαίνουν σε ουρά και φεύγουν μόλις επιστρέψει
 * το σήμα — αλλά αν η καρτέλα κλείσει πριν, **χάνονται**. Αυτό το module το λέει στο
 * `unsaved-work-registry`, και από εκεί: (α) η `unsaved-work-guard` προειδοποιεί τον άνθρωπο στο
 * κλείσιμο, (β) η ανάκαμψη του deploy (ADR-860 §Ε3β) **δεν** ανανεώνει αυτόματα από κάτω του.
 *
 * 🔑 **ΡΩΤΑΜΕ ΤΟΝ ΙΔΙΟΚΤΗΤΗ, ΔΕΝ ΤΥΛΙΓΟΥΜΕ ΤΟΥΣ ΓΡΑΦΕΙΣ.** ~100 αρχεία καλούν `setDoc`/`updateDoc`
 * απευθείας· ένα wrapper θα έπρεπε να το θυμάται κάθε μελλοντική εγγραφή, και η πρώτη που θα το
 * ξεχνούσε θα χανόταν σιωπηλά. Την ουρά την κρατά το SDK, και η μόνη δημόσια ερώτηση προς αυτό
 * είναι το `waitForPendingWrites` — που (μετρημένο στο @firebase/firestore 4.9.3,
 * `__PRIVATE_syncEngineRegisterPendingWritesCallback`) λύνεται **αμέσως** όταν δεν εκκρεμεί
 * τίποτα, **ακόμη και χωρίς δίκτυο**, αλλιώς μόλις ο server επιβεβαιώσει.
 *
 * 🔑 **ΚΑΤΩΦΛΙ, ΟΧΙ ΤΡΕΜΟΠΑΙΓΜΑ**: μια κανονική εγγραφή online επιβεβαιώνεται σε ~100-300ms.
 * Ο ιδιοκτήτης δηλώνεται μόνο αν μια ερώτηση μείνει ανοιχτή πάνω από `SETTLE_THRESHOLD_MS` — όχι
 * σε κάθε αποθήκευση. Και όταν μια «αργή» ερώτηση λυθεί, **δεν** καθαρίζουμε αμέσως: ξαναρωτάμε,
 * γιατί εγγραφές που μπήκαν ενώ περιμέναμε δεν καλύπτονταν από την πρώτη ερώτηση. Καθαρίζει μόνο
 * μια **γρήγορη** απάντηση — δηλαδή «δεν εκκρεμεί τίποτα».
 *
 * ⚠️ Όριο: ουρά του SDK απασχολημένη > κατώφλι (π.χ. φόρτωση τεράστιας σκηνής) μετράει προσωρινά
 * ως «εκκρεμεί». Ψευδώς θετικό, ακίνδυνο προς τα δεδομένα, και καθαρίζει στην επόμενη γρήγορη
 * απάντηση. Το αντίθετο σφάλμα (να πούμε «καθαρό» ενώ εκκρεμεί) δεν συμβαίνει.
 *
 * @module lib/firestore-pending-writes
 * @enterprise ADR-367 §2.6
 */

import { waitForPendingWrites } from 'firebase/firestore';
import { clearUnsavedWork, markUnsavedWork } from '@/lib/app-version/unsaved-work-registry';
import { db } from './firebase';

export const PENDING_WRITES_OWNER = 'firestore:pending-writes';
/** Πάνω από τον τυπικό χρόνο επιβεβαίωσης online (~100-300ms). */
export const SETTLE_THRESHOLD_MS = 400;
/** Μέγιστη καθυστέρηση ανάμεσα σε εγγραφή εκτός σύνδεσης και προειδοποίηση: διάστημα + κατώφλι. */
export const PROBE_INTERVAL_MS = 500;

export interface PendingWritesWatcherDeps {
  readonly waitForPendingWrites: () => Promise<void>;
  readonly mark: () => void;
  readonly clear: () => void;
  readonly now: () => number;
  readonly schedule: (callback: () => void, delayMs: number) => void;
}

export interface PendingWritesWatcher {
  /** Ρωτά το SDK. Αγνοείται όσο μια ερώτηση είναι ήδη ανοιχτή. */
  readonly probe: () => void;
}

export function createPendingWritesWatcher(deps: PendingWritesWatcherDeps): PendingWritesWatcher {
  let generation = 0;
  let inFlight = false;
  let marked = false;

  const settle = (fast: boolean): void => {
    inFlight = false;
    if (!fast) {
      probe();
      return;
    }
    if (!marked) return;
    marked = false;
    deps.clear();
  };

  const probe = (): void => {
    if (inFlight) return;
    inFlight = true;
    const current = ++generation;
    const startedAt = deps.now();
    deps.schedule(() => {
      if (!inFlight || generation !== current || marked) return;
      marked = true;
      deps.mark();
    }, SETTLE_THRESHOLD_MS);
    deps.waitForPendingWrites().then(
      () => settle(deps.now() - startedAt < SETTLE_THRESHOLD_MS),
      // Απόρριψη = άλλαξε χρήστης ή τερματίστηκε το instance (ADR-367 §2.2): καμία εγγραφή
      // αυτής της καρτέλας δεν μπορεί πλέον να σταλεί από εδώ — τίποτα να φυλάξουμε.
      () => settle(true),
    );
  };

  return { probe };
}

let installed = false;

/** Συνδέει το SDK με το μητρώο. Idempotent, μόνο στον browser. */
export function installFirestorePendingWritesWatcher(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const watcher = createPendingWritesWatcher({
    waitForPendingWrites: () => waitForPendingWrites(db),
    mark: () => markUnsavedWork(PENDING_WRITES_OWNER),
    clear: () => clearUnsavedWork(PENDING_WRITES_OWNER),
    now: () => performance.now(),
    schedule: (callback, delayMs) => {
      window.setTimeout(callback, delayMs);
    },
  });

  window.setInterval(watcher.probe, PROBE_INTERVAL_MS);
  // Οι στιγμές πριν από κίνδυνο: απώλεια σήματος, και απόκρυψη (οι timers των κρυφών
  // καρτελών στραγγαλίζονται — η κατάσταση πρέπει να είναι σωστή ΠΡΙΝ κρυφτεί).
  window.addEventListener('offline', watcher.probe);
  document.addEventListener('visibilitychange', watcher.probe);
}
