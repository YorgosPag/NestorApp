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
 * σε κάθε αποθήκευση.
 *
 * 🔑 **ΦΡΑΓΜΑ ΟΥΡΑΣ — η αργή ουρά ΔΕΝ είναι εκκρεμής εγγραφή** (2026-11-12): ο χρόνος απάντησης
 * ήταν πληρεξούσιος, όχι η αλήθεια — μια ουρά του SDK απασχολημένη από βαριά φόρτωση (μετρημένο
 * στο `/catalog/imports`: σημάδι ~530ms χωρίς καμία εγγραφή ⇒ ψευδές «Leave site?») άργησε όσο
 * μια πραγματική εκκρεμής εγγραφή. Η ουρά του SDK (`AsyncQueue.enqueueInternal`, αλυσίδα `tail.then`)
 * είναι **αυστηρά σειριακή FIFO**, και το `waitForPendingWrites` λύνει την υπόσχεσή του **μέσα** στη
 * δική του πράξη όταν δεν εκκρεμεί τίποτα (`BATCHID_UNKNOWN`). Άρα αμέσως μετά βάζουμε μια πράξη
 * **φράγμα** στην ίδια ουρά, που δεν εξαρτάται από εγγραφές (ανάγνωση από την τοπική μνήμη):
 *  - η ερώτηση απάντησε **πριν** το φράγμα ⇒ «δεν εκκρεμούσε τίποτα» — όσο κι αν άργησαν και τα δύο·
 *  - το φράγμα πέρασε και η ερώτηση **ακόμη** περιμένει ⇒ εκκρεμεί πραγματικά εγγραφή.
 * Σημάδι μόνο αν ισχύει το δεύτερο **και** πέρασε το κατώφλι. Η καθυστέρηση της ουράς **ακυρώνεται**
 * στη σύγκριση, αντί να «ανέβει το κατώφλι» (που απλώς μετακινεί το ψευδώς θετικό).
 *
 * Και όταν η ερώτηση λυθεί **μετά** το φράγμα (υπήρχαν εγγραφές, τώρα επιβεβαιώθηκαν), **δεν**
 * καθαρίζουμε αμέσως: ξαναρωτάμε, γιατί εγγραφές που μπήκαν ενώ περιμέναμε δεν καλύπτονταν.
 * Καθαρίζει μόνο απάντηση **πριν** το φράγμα. Το αντίθετο σφάλμα (να πούμε «καθαρό» ενώ εκκρεμεί)
 * δεν συμβαίνει.
 *
 * @module lib/firestore-pending-writes
 * @enterprise ADR-367 §2.6
 */

import { doc, getDocFromCache, waitForPendingWrites } from 'firebase/firestore';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { clearUnsavedWork, markUnsavedWork } from '@/lib/app-version/unsaved-work-registry';
import { db } from './firebase';

export const PENDING_WRITES_OWNER = 'firestore:pending-writes';
/** Πάνω από τον τυπικό χρόνο επιβεβαίωσης online (~100-300ms). */
export const SETTLE_THRESHOLD_MS = 400;
/** Μέγιστη καθυστέρηση ανάμεσα σε εγγραφή εκτός σύνδεσης και προειδοποίηση: διάστημα + κατώφλι. */
export const PROBE_INTERVAL_MS = 500;

export interface PendingWritesWatcherDeps {
  readonly waitForPendingWrites: () => Promise<void>;
  /**
   * Πράξη στην **ίδια** σειριακή ουρά του SDK που δεν εξαρτάται από εγγραφές. Καλείται **αμέσως μετά**
   * το `waitForPendingWrites` ⇒ όταν κλείσει (λύση ή απόρριψη, αδιάφορο), η ερώτηση έχει ήδη απαντηθεί
   * αν δεν εκκρεμούσε τίποτα.
   */
  readonly queueBarrier: () => Promise<unknown>;
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

  /** `nothingPending` = η ερώτηση απάντησε πριν το φράγμα, ή απορρίφθηκε. */
  const settle = (nothingPending: boolean): void => {
    inFlight = false;
    if (!nothingPending) {
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
    let answered = false;
    let barrierPassed = false;
    // Σημάδι ΜΟΝΟ με απόδειξη: φράγμα περασμένο + ερώτηση ανοιχτή + κατώφλι περασμένο.
    const maybeMark = (): void => {
      if (!inFlight || generation !== current || marked || answered || !barrierPassed) return;
      if (deps.now() - startedAt < SETTLE_THRESHOLD_MS) return;
      marked = true;
      deps.mark();
    };
    // Η ΣΕΙΡΑ ΕΙΝΑΙ Η ΕΓΓΥΗΣΗ: πρώτα η ερώτηση, μετά το φράγμα (FIFO ουρά του SDK).
    deps.waitForPendingWrites().then(
      () => {
        answered = true;
        settle(!barrierPassed);
      },
      // Απόρριψη = άλλαξε χρήστης ή τερματίστηκε το instance (ADR-367 §2.2): καμία εγγραφή
      // αυτής της καρτέλας δεν μπορεί πλέον να σταλεί από εδώ — τίποτα να φυλάξουμε.
      () => {
        answered = true;
        settle(true);
      },
    );
    const passBarrier = (): void => {
      barrierPassed = true;
      maybeMark();
    };
    deps.queueBarrier().then(passBarrier, passBarrier);
    deps.schedule(maybeMark, SETTLE_THRESHOLD_MS);
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
    // Ανάγνωση ΜΟΝΟ από την τοπική μνήμη: κανένα δίκτυο, κανένας κανόνας ασφαλείας. Ένα έγγραφο που
    // δεν υπάρχει στη μνήμη απορρίπτεται — εξίσου «πέρασε το φράγμα». Το ποιο έγγραφο είναι αδιάφορο.
    queueBarrier: () => getDocFromCache(doc(db, COLLECTIONS.SYSTEM, SYSTEM_DOCS.APP_SETTINGS)),
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
