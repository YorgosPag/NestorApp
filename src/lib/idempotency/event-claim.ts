/**
 * @module lib/idempotency/event-claim
 * @description **Η ταυτότητα μιας ΑΛΛΑΓΗΣ, και η κρίση «έγινε ήδη;»** — ο φορητός πυρήνας
 * της ιδεμποτίας των Cloud Functions (ADR-873 Φάση 1 · βήμα 1.1).
 *
 * ## Γιατί υπάρχει
 *
 * Οι triggers της Firestore είναι **at-least-once** και **χωρίς σειρά**· και στο παράθυρο
 * αναβάθμισης 1ης → 2ης γενιάς η Google λέει ρητά ότι *«your business logic will run twice
 * per event»*. Καμία από τις 20 συναρτήσεις δεν κρατούσε δείκτη «το έκανα ήδη».
 *
 * ## 🔴 Το κλειδί είναι η ΑΛΛΑΓΗ, όχι το γεγονός
 *
 * Η προφανής ιδέα —ταυτότητα από το `eventId`— **δεν** κόβει το διπλό old+new: το `eventId`
 * είναι σταθερό στις **επαναλήψεις του ίδιου συνδρομητή**, και **καμία** πρωτογενής πηγή δεν
 * εγγυάται ότι ο legacy trigger και ο Eventarc CloudEvent βλέπουν **το ίδιο** id για το ίδιο
 * γεγονός. Κλειδί που είναι **αποδεδειγμένα** ίδιο για κάθε παρατηρητή είναι η ίδια η αλλαγή:
 * η διαδρομή και οι **χρόνοι commit** — τιμές που τις ορίζει ο server, όχι ο παρατηρητής.
 *
 * ## Δύο είδη φρουρού — και πότε ΔΕΝ χρειάζεται έγγραφο
 *
 * | Είδος | Πότε | Παράδειγμα |
 * |---|---|---|
 * | **Φυσικός** | ο ίδιος ο στόχος κουβαλά έκδοση ή ταυτότητα | search index με `sourceUpdateTime`· μικρογραφία σε ντετερμινιστική διαδρομή |
 * | **Δείκτης** | δεν υπάρχει τίποτα να συγκρίνεις | γραμμή audit· μείξη μέσου όρου τιμής |
 *
 * ⛔ **ΜΗΝ βάλεις δείκτη εκεί που ο φυσικός φρουρός αρκεί.** Οι 11 search triggers χτυπούν σε
 * **κάθε** εγγραφή οντότητας: ένα έγγραφο-δείκτη ανά γεγονός θα ήταν διπλάσιες εγγραφές για
 * μηδέν κέρδος. Το ίδιο λέει και το συμβόλαιο του HTTP συνόρου (`NaturalIdempotency` στο
 * `lib/api/idempotency/idempotency-contract.ts`) — με **υποχρεωτικό λόγο**.
 *
 * ## ⚠️ ΦΟΡΗΤΟ — ΜΗΔΕΝ ΕΙΣΑΓΩΓΕΣ, ΕΠΙΤΗΔΕΣ
 *
 * Αυτό το αρχείο **προβάλλεται αυτούσιο** στο `functions/src/generated/` (ADR-874 ·
 * CHECK 3.93), γιατί το `functions/` είναι χωριστό πακέτο npm που **δεν μπορεί** να εισάγει
 * από το `src/`. Η πύλη απαιτεί **κλειστότητα**: καμία εισαγωγή `@/`, κανένα πακέτο, κανένα
 * μη-προβαλλόμενο σχετικό αρχείο. Κράτα το έτσι — αλλιώς η πύλη μπλοκάρει, και σωστά.
 *
 * @see ADR-873 §9.1 · ADR-872 (το δόγμα) · ADR-874 (η προβολή)
 */

/**
 * Διαχωριστικό των μερών ενός κλειδιού: ο **μόνος** χαρακτήρας που δεν μπορεί να εμφανιστεί
 * σε διαδρομή Firestore, σε όνομα αντικειμένου Storage ή σε ταυτότητα εγγράφου.
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ `:` Ή `|`**: και τα δύο είναι **νόμιμα** μέσα σε ταυτότητα εγγράφου. Με
 * διαχωριστικό που μπορεί να εμφανιστεί στα δεδομένα, δύο **διαφορετικές** αλλαγές μπορούν
 * να παραγάγουν **το ίδιο** κλειδί (`a:b` + `c` ≡ `a` + `b:c`) — δηλαδή η μία θα θεωρούνταν
 * σιωπηλά «έγινε ήδη». Ίδια επιλογή με τα αποτυπώματα του ADR-874 (`plan.js`).
 */
const PART_SEPARATOR = '\u0000';

/** Πόσο θεωρείται «σε εξέλιξη» μια εκτέλεση. Πάνω από το όριο 540s των event-driven 2ης γενιάς. */
export const EVENT_CLAIM_LEASE_MS = 600_000;

/**
 * Πόσο ζει ο δείκτης. Πάνω από το παράθυρο επαναλήψεων της Firestore (24 ώρες), ώστε ένα
 * καθυστερημένο διπλότυπο να βρίσκει ακόμη τον δείκτη του.
 */
export const EVENT_CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Μια αλλαγή εγγράφου Firestore, όπως τη βλέπει **κάθε** παρατηρητής. */
export interface FirestoreChangeCoordinates {
  /** Πλήρης διαδρομή του εγγράφου — `collection/docId`. */
  readonly path: string;
  /** Χρόνος commit **πριν**. `null` σε δημιουργία (δεν υπήρχε έγγραφο). */
  readonly beforeUpdateTime: string | null;
  /** Χρόνος commit **μετά**. `null` σε διαγραφή (δεν υπάρχει έγγραφο). */
  readonly afterUpdateTime: string | null;
}

/** Ένα αντικείμενο Storage, όπως το βλέπει κάθε παρατηρητής. */
export interface StorageObjectCoordinates {
  readonly bucket: string;
  readonly name: string;
  /** Αλλάζει σε **κάθε** νέο περιεχόμενο. */
  readonly generation: string;
  /** Αλλάζει σε κάθε αλλαγή **μεταδεδομένων** του ίδιου περιεχομένου. */
  readonly metageneration: string;
}

/** Μια εκτέλεση προγραμματισμένης εργασίας. */
export interface ScheduledRunCoordinates {
  /** Σταθερό όνομα της εργασίας — **ποτέ** το όνομα του job στο Google (αλλάζει στο 1.3). */
  readonly job: string;
  /**
   * Η περίοδος σε **UTC**, στη χονδρότητα του προγράμματος: `2026-09-22` για ημερήσιο,
   * `2026-09-22T14` για ωριαίο. Και οι τρεις προγραμματισμένες συναρτήσεις δηλώνουν
   * `.timeZone('UTC')`, άρα η περίοδος υπολογίζεται **από τον κώδικα**, χωρίς CLI.
   */
  readonly periodUtc: string;
}

const joinParts = (kind: string, parts: readonly (string | null)[]): string =>
  [kind, ...parts.map((p) => p ?? '')].join(PART_SEPARATOR);

/**
 * Σπόρος από μια αλλαγή Firestore.
 *
 * Οι **δύο** χρόνοι μαζί, όχι μόνο ο `after`: χωρίς τον `before` δύο διαφορετικές μεταβάσεις
 * που καταλήγουν στο ίδιο commit δεν ξεχωρίζουν, και —πιο σοβαρά— μια **διαγραφή** (όπου ο
 * `after` είναι κενός) θα συγχεόταν με κάθε άλλη διαγραφή του ίδιου εγγράφου.
 */
export function firestoreChangeSeed(change: FirestoreChangeCoordinates): string {
  return joinParts('fs', [change.path, change.beforeUpdateTime, change.afterUpdateTime]);
}

/** Σπόρος από ένα αντικείμενο Storage. */
export function storageObjectSeed(object: StorageObjectCoordinates): string {
  return joinParts('gcs', [object.bucket, object.name, object.generation, object.metageneration]);
}

/** Σπόρος από μία εκτέλεση προγραμματισμένης εργασίας. */
export function scheduledRunSeed(run: ScheduledRunCoordinates): string {
  return joinParts('cron', [run.job, run.periodUtc]);
}

/**
 * Σπόρος από **επιχειρηματική** ταυτότητα — όχι από το γεγονός.
 *
 * 🔑 Χρησιμοποιείται όπου η ίδια πράξη δεν πρέπει να μετρήσει δεύτερη φορά **ακόμη κι αν
 * φτάσει από εντελώς άλλο γεγονός**. Παράδειγμα (απόφαση Giorgio 2026-09-22): η ίδια
 * παραγγελία δεν ξαναμπαίνει στον μέσο όρο τιμής — ούτε αν κάποιος τη γυρίσει σε
 * `ordered` και ξανά σε `delivered`, που είναι **νέα** αλλαγή με **νέους** χρόνους commit.
 */
export function businessSeed(domain: string, parts: readonly string[]): string {
  return joinParts(domain, parts);
}

/** Το έγγραφο-δείκτης, όπως ζει στη Firestore. */
export interface EventClaimRecord {
  readonly state: 'in-flight' | 'done';
  /** Ο σπόρος, αυτούσιος — ώστε μια σύγκρουση κατακερματισμού να **φαίνεται**. */
  readonly seed: string;
  readonly lockedAtMs: number;
}

/**
 * Η κρίση για μια εκτέλεση που βρήκε **υπάρχοντα** δείκτη.
 *
 * - `done` — έγινε· παράλειψη.
 * - `in-flight` — άλλη εκτέλεση το κρατά **τώρα**. Ο καλών πρέπει να **ρίξει**, ώστε η
 *   πλατφόρμα να ξαναδοκιμάσει αργότερα και να δει `done`. Σιωπηλή παράλειψη θα σήμαινε
 *   «έγινε» για κάτι που μπορεί να **αποτύχει**.
 * - `unknown` — 🏆 το lease έληξε: η διεργασία που το κρατούσε **δεν υπάρχει πια** και
 *   μπορεί να είχε **ήδη γράψει**. Το ADR-872 το λέει καθαρά και το κρατάμε: **ποτέ**
 *   σιωπηλή δεύτερη εκτέλεση. Η πολιτική ανήκει στον καλούντα — δες {@link EventClaimVerdict}.
 * - `collision` — ίδια ταυτότητα, **άλλος** σπόρος. Δεν συμβαίνει με σωστά κλειδιά· αν
 *   συμβεί, είναι σύγκρουση κατακερματισμού και πρέπει να **ουρλιάξει**, όχι να σιωπήσει.
 */
export type EventClaimVerdict = 'done' | 'in-flight' | 'unknown' | 'collision';

/** Τι σημαίνει ένας ζωντανός δείκτης για μια νέα εκτέλεση με τον ίδιο σπόρο. */
export function judgeEventClaim(
  record: EventClaimRecord,
  seed: string,
  nowMs: number,
): EventClaimVerdict {
  if (record.seed !== seed) return 'collision';
  if (record.state === 'done') return 'done';
  return nowMs - record.lockedAtMs < EVENT_CLAIM_LEASE_MS ? 'in-flight' : 'unknown';
}

/**
 * Έληξε ο δείκτης;
 *
 * ⚠️ Κρίνεται από **αριθμό ms**, ποτέ από `Timestamp`: η TTL της Firestore σβήνει με
 * καθυστέρηση έως 24 ώρες, και ο τύπος του πεδίου διαφέρει σε κάθε αντίγραφο. Ίδιος
 * λόγος με το `idempotency-store.ts` — ένα ληγμένο έγγραφο ισοδυναμεί με ανύπαρκτο.
 */
export function isEventClaimExpired(record: EventClaimRecord, nowMs: number): boolean {
  return nowMs - record.lockedAtMs >= EVENT_CLAIM_TTL_MS;
}
