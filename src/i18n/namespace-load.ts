/**
 * =============================================================================
 * 🏢 NAMESPACE LOAD RESILIENCE — ADR-744 §25 (SSoT)
 * =============================================================================
 *
 * 🔴 ΤΟ ΣΥΜΠΤΩΜΑ (μετρημένο σε Chrome, 2026-10-01): 184 ωμά κλειδιά στην καρτέλα
 * ακινήτου, **αθεράπευτα μετά από 75″**. Η κονσόλα έλεγε
 * `Failed to load chunk …/src_i18n_locales_el_properties-detail_json…` — και το
 * `loadTranslations` το κατάπινε επιστρέφοντας `{}`. Το bundle έμενε `absent`, ο
 * hook δήλωνε «φορτώθηκε», **κανείς δεν ξαναπροσπαθούσε**.
 *
 * Τρία κενά, τρεις μηχανισμοί — εδώ, σε ΕΝΑ σημείο:
 *
 * 1. **Επανάληψη με εκθετική αναμονή** (`importWithRetry`). Το ίδιο το i18next το
 *    κάνει στον `BackendConnector` (`maxRetries` / `retryTimeout`)· εμείς το
 *    παρακάμπταμε επειδή φορτώνουμε με δικό μας `import()`.
 * 2. **Μία φόρτωση ανά κλειδί** (`singleFlight`). Μετρημένο: το ίδιο namespace
 *    ζητούνταν **έως 4 φορές ταυτόχρονα** (κάθε mount στο dev κάνει `forceReload`).
 * 3. **Ανάκτηση** (`armBundleRecovery`): ό,τι έμεινε `failed` ξαναζητείται όταν
 *    επιστρέψει το δίκτυο ή η καρτέλα ξαναγίνει ορατή.
 *
 * ⚠️ ΤΟ ΟΡΙΟ, ΔΗΛΩΜΕΝΟ: ο runtime του **Turbopack dev** κρατά το απορριφθέν
 * promise ανά URL chunk (`chunkResolvers`, `loadingStarted=true`) ⇒ στο dev κάθε
 * επανάληψη `import()` του ίδιου chunk αποτυγχάνει ακαριαία ώσπου να γίνει reload.
 * Η **παραγωγή** χτίζεται με webpack, που καθαρίζει το αποτυχημένο chunk ⇒ εκεί η
 * επανάληψη θεραπεύει. Στο dev η αποτυχία τουλάχιστον **λέγεται** (μία γραμμή
 * `logger.error` με οδηγία), αντί να σωπαίνει.
 *
 * @module i18n/namespace-load
 * @see docs/centralized-systems/reference/adrs/ADR-744-i18n-shell-slice.md §25
 */

/** Πόσες φορές και με ποιο ρυθμό ξαναζητείται ένα locale chunk. */
export interface RetryPolicy {
  /** Συνολικές απόπειρες, μαζί με την πρώτη. */
  readonly attempts: number;
  /** Αναμονή πριν τη 2η απόπειρα· κάθε επόμενη τριπλασιάζεται (300 → 900 → 2700 ms). */
  readonly baseDelayMs: number;
}

/** Η ΜΙΑ πολιτική — ~3,9″ συνολικής αναμονής, αρκετή για παροδική αστοχία δικτύου/διακομιστή. */
export const NAMESPACE_RETRY_POLICY: RetryPolicy = { attempts: 4, baseDelayMs: 300 };

const BACKOFF_FACTOR = 3;

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Εκτελεί τον `loader` έως `policy.attempts` φορές. Επιστρέφει την πρώτη επιτυχία·
 * αν αποτύχουν όλες, πετά το **τελευταίο** σφάλμα — ποτέ σιωπηλό κενό αποτέλεσμα.
 */
export async function importWithRetry<T>(
  loader: () => Promise<T>,
  policy: RetryPolicy = NAMESPACE_RETRY_POLICY,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < policy.attempts; attempt++) {
    if (attempt > 0) await sleep(policy.baseDelayMs * BACKOFF_FACTOR ** (attempt - 1));
    try {
      return await loader();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const inFlight = new Map<string, Promise<void>>();

/**
 * Μία εκτέλεση ανά `key` τη φορά: όποιος ζητήσει το ίδιο κλειδί ενώ τρέχει,
 * παίρνει το **ίδιο** promise. Μόλις κλείσει (επιτυχία ή αποτυχία), το κλειδί
 * ελευθερώνεται — η επόμενη ζήτηση είναι νέα απόπειρα, όχι cache της αποτυχίας.
 */
export function singleFlight(key: string, run: () => Promise<void>): Promise<void> {
  const pending = inFlight.get(key);
  if (pending) return pending;
  const started = run().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, started);
  return started;
}

/** Ελάχιστη όψη του `window` που χρειάζεται η ανάκτηση — δοκιμάσιμη χωρίς browser. */
export interface RecoveryHost {
  addEventListener(type: 'online' | 'visibilitychange', listener: () => void): void;
  readonly isVisible: () => boolean;
}

let recoveryArmed = false;

/**
 * Οπλίζει **μία φορά** (ιδεμποτικό) την ανάκτηση των `failed` bundles: σε κάθε
 * `online` ή επιστροφή της καρτέλας σε ορατότητα, ο `recover` ξαναζητά ό,τι έχει
 * εγκαταλειφθεί. Όταν τίποτα δεν είναι `failed`, ο `recover` δεν κάνει τίποτα.
 */
export function armBundleRecovery(host: RecoveryHost, recover: () => void): void {
  if (recoveryArmed) return;
  recoveryArmed = true;
  host.addEventListener('online', recover);
  host.addEventListener('visibilitychange', () => {
    if (host.isVisible()) recover();
  });
}

/** Μηδενισμός — αποκλειστικά για tests. */
export function resetNamespaceLoadState(): void {
  inFlight.clear();
  recoveryArmed = false;
}
