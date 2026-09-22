/**
 * @module lib/search/search-index-version
 * @description **Ποια έκδοση της οντότητας κάθεται στο ευρετήριο — και ποια γραφή δικαιούται
 * να τη διώξει.** Ο φορητός κριτής του search index (ADR-873 Φάση 1 · βήμα 1.1 · Στάδιο 1).
 *
 * ## Γιατί υπάρχει
 *
 * Οι 11 search triggers γράφουν το `search_documents` από το **payload** του γεγονότος. Οι
 * triggers της Firestore είναι **at-least-once** και **χωρίς σειρά**: ένα καθυστερημένο
 * διπλότυπο του E1 που φτάνει **μετά** το E2 γράφει **παλιά** δεδομένα πάνω από νέα, και το
 * ευρετήριο μένει μπαγιάτικο για πάντα — καμία επόμενη εγγραφή δεν το διορθώνει.
 *
 * Ο φρουρός εδώ είναι **φυσικός**: ο ίδιος ο στόχος κουβαλά την έκδοση της πηγής
 * (`sourceUpdateTime` = ο χρόνος commit που είδε ο trigger). Καμία δεύτερη συλλογή, κανένα
 * έγγραφο-δείκτης — οι triggers χτυπούν σε **κάθε** εγγραφή οντότητας και ένας δείκτης εκεί
 * θα ήταν διπλάσιες εγγραφές για μηδέν κέρδος (ADR-873 §9.1.1 · ADR-872 `NaturalIdempotency`).
 *
 * ## 🔴 Η ΔΙΑΓΡΑΦΗ ΕΙΝΑΙ ΤΟ ΔΥΣΚΟΛΟ ΜΙΣΟ — και εκεί σταματούν οι μεγάλοι
 *
 * Το «γράψε μόνο αν νεότερο» είναι ακριβώς το `version_type=external` της Elasticsearch:
 * *«only store this information if no one else has supplied the same or a more recent version
 * in the meantime»*. Αλλά **σκληρή διαγραφή καταστρέφει την έκδοση**: ένα καθυστερημένο CREATE
 * που φτάνει μετά το DELETE βρίσκει **κενό**, δεν έχει τίποτα να συγκρίνει, γράφει — και
 * φτιάχνει **μόνιμο φάντασμα**. Η οντότητα έχει διαγραφεί· **κανένας** trigger δεν θα
 * ξαναχτυπήσει να το καθαρίσει.
 *
 * Η ίδια η Elastic το λύνει με **ταφόπλακες** — και τις **ξεχνά σε 60 δευτερόλεπτα**
 * (`index.gc_deletes`), γιατί τις κρατά στη μνήμη κάθε shard. Δηλαδή το κενό υπάρχει και εκεί,
 * απλώς στενότερο.
 *
 * 🏆 **Εμείς το κλείνουμε ολόκληρο**: η ταφόπλακα ζει στο **ίδιο έγγραφο**, με
 * `search.prefixes: []`. Το ερώτημα της αναζήτησης απαιτεί `array-contains-any` πάνω σε αυτόν
 * τον πίνακα — **κενός πίνακας δεν ταιριάζει ποτέ**. Δεν είναι σημαία που κάποιος μπορεί να
 * ξεχάσει να ελέγξει· είναι **αδυναμία του ευρετηρίου**. Και ζει {@link SEARCH_TOMBSTONE_TTL_MS}
 * — όσο **ολόκληρο** το παράθυρο επαναλήψεων της πλατφόρμας, όχι 60 δευτερόλεπτα.
 *
 * ## ⚠️ ΦΟΡΗΤΟ — ΜΗΔΕΝ ΕΙΣΑΓΩΓΕΣ, ΕΠΙΤΗΔΕΣ
 *
 * Προβάλλεται αυτούσιο στο `functions/src/generated/` (ADR-874 · CHECK 3.93), γιατί το
 * `functions/` είναι χωριστό πακέτο npm. Καμία εισαγωγή `@/`, κανένα πακέτο — αλλιώς η πύλη
 * μπλοκάρει, και σωστά. Γι' αυτό ο χρόνος περνά ως **δομή**, ποτέ ως `Timestamp`.
 *
 * @see ADR-873 §9.1.2 · ADR-029 (το ευρετήριο) · ADR-872 (το δόγμα ιδεμποτίας)
 */

/**
 * Πόσο ζει μια ταφόπλακα.
 *
 * 🔑 **Μετρημένο, όχι διαλεγμένο**: η Google δηλώνει ότι το παράθυρο επαναλήψεων μιας
 * event-driven συνάρτησης **1ης γενιάς** λήγει σε **7 ημέρες** (2ης γενιάς: 24 ώρες). Πάνω
 * από αυτό δεν υπάρχει καθυστερημένο διπλότυπο να φυλαχτεί, οπότε η ταφόπλακα γίνεται
 * σκουπίδι — και τη σβήνει η TTL πολιτική της Firestore (`firestore.indexes.json`).
 *
 * ⛔ **ΜΗΝ το μικρύνεις** «για οικονομία»: κάτω από το παράθυρο επαναλήψεων, το φάντασμα
 * ξαναγίνεται δυνατό — και είναι **μόνιμο** όταν συμβεί.
 */
export const SEARCH_TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Ένας χρόνος commit της Firestore, σε **δομή** — ποτέ ως `Timestamp`.
 *
 * Ο `Timestamp` είναι κλάση δύο **διαφορετικών** SDK (client / admin) και δεν περνά το σύνορο
 * της προβολής. Τα δύο αριθμητικά πεδία τα έχουν και οι δύο, με το ίδιο νόημα.
 */
export interface CommitVersion {
  readonly seconds: number;
  readonly nanoseconds: number;
}

/** Τι κάθεται **τώρα** στο ευρετήριο για μια οντότητα. `null` = τίποτα. */
export interface StoredSearchIndexState {
  /** Η έκδοση της πηγής που παρήγαγε αυτή την εγγραφή. Λείπει σε έγγραφα πριν το ADR-873. */
  readonly sourceUpdateTime?: CommitVersion | null;
  /** `true` = ταφόπλακα: η οντότητα διαγράφηκε σε αυτή την έκδοση. */
  readonly deleted?: boolean;
}

/**
 * Διάβασε έκδοση από ό,τι κι αν ήρθε — `Timestamp`, απλό αντικείμενο, ή τίποτα.
 *
 * Επιστρέφει `null` όταν **δεν ξέρουμε**, και το «δεν ξέρω» έχει ρητή συμπεριφορά στους δύο
 * κριτές παρακάτω. Δεν μαντεύει: ένας χρόνος που δεν είναι δύο πεπερασμένοι αριθμοί **δεν
 * είναι χρόνος**, και μια σύγκριση με `NaN` θα απαντούσε σιωπηλά «όχι νεότερο» σε **κάθε**
 * ερώτηση (το σχήμα του `Box3.isEmpty` με `NaN`).
 */
export function toCommitVersion(value: unknown): CommitVersion | null {
  if (typeof value !== 'object' || value === null) return null;
  const { seconds, nanoseconds } = value as { seconds?: unknown; nanoseconds?: unknown };
  if (!Number.isFinite(seconds) || !Number.isFinite(nanoseconds)) return null;
  return { seconds: seconds as number, nanoseconds: nanoseconds as number };
}

/**
 * Έκδοση από συμβολοσειρά ISO-8601 — **η εφεδρική διαδρομή**.
 *
 * Χρησιμοποιείται μόνο όταν το ίδιο το στιγμιότυπο δεν κουβαλά χρόνο commit (π.χ. ο χρόνος
 * του γεγονότος, `context.timestamp`). ⚠️ Ο χρόνος **δημοσίευσης** του γεγονότος δεν είναι ο
 * χρόνος **commit** — είναι λίγο αργότερα. Ως εφεδρεία στέκει, γιατί και οι δύο τους δίνει ο
 * server και κινούνται προς τα εμπρός· ως **κανονική** πηγή θα ήταν λάθος, και γι' αυτό ο
 * καλών τη ζητά **τελευταία**.
 */
export function isoToCommitVersion(iso: string | null | undefined): CommitVersion | null {
  if (typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1_000_000 };
}

/** `-1` ο `a` είναι παλιότερος · `0` ίδιο commit · `1` ο `a` είναι νεότερος. */
export function compareCommitVersions(a: CommitVersion, b: CommitVersion): -1 | 0 | 1 {
  if (a.seconds !== b.seconds) return a.seconds < b.seconds ? -1 : 1;
  if (a.nanoseconds !== b.nanoseconds) return a.nanoseconds < b.nanoseconds ? -1 : 1;
  return 0;
}

/**
 * Δικαιούται αυτή η γραφή να αντικαταστήσει ό,τι κάθεται στο ευρετήριο;
 *
 * - **Τίποτα αποθηκευμένο** ⇒ ναι.
 * - **Άγνωστη έκδοση** (αποθηκευμένη ή εισερχόμενη) ⇒ **ναι**. Δεν μπορούμε να αποδείξουμε ότι
 *   είναι μπαγιάτικη, και το ADR-872 το λέει καθαρά: **ποτέ σιωπηλή παράλειψη**. Το χειρότερο
 *   που κάνει μια περιττή γραφή είναι μια περιττή γραφή· το χειρότερο που κάνει μια περιττή
 *   παράλειψη είναι **αόρατη οντότητα**.
 * - **Ίδιο commit** ⇒ όχι: αυτό ακριβώς είναι το διπλότυπο που κόβουμε.
 * - **Ταφόπλακα νεότερη** ⇒ όχι — εδώ πεθαίνει το μόνιμο φάντασμα.
 */
export function shouldApplySearchIndexWrite(
  stored: StoredSearchIndexState | null,
  incoming: CommitVersion | null,
): boolean {
  if (stored === null || incoming === null) return true;
  const storedVersion = toCommitVersion(stored.sourceUpdateTime);
  if (storedVersion === null) return true;
  return compareCommitVersions(incoming, storedVersion) > 0;
}

/**
 * Δικαιούται αυτή η διαγραφή να αφήσει ταφόπλακα;
 *
 * - **Τίποτα αποθηκευμένο** ⇒ **ναι**, και είναι το σημείο που μας κάνει αυστηρότερους από την
 *   Elasticsearch: η ταφόπλακα γράφεται **ακόμη κι όταν δεν υπάρχει τι να σβηστεί**, ώστε ένα
 *   καθυστερημένο CREATE να βρει κάτι να συγκριθεί μαζί του.
 * - **Ήδη ταφόπλακα ίδιας ή νεότερης έκδοσης** ⇒ όχι (το διπλότυπο της ίδιας διαγραφής).
 * - **Αποθηκευμένη έκδοση νεότερη** ⇒ όχι: η οντότητα **ξαναδημιουργήθηκε** και το ευρετήριο
 *   κρατά τη νέα της μορφή. Αυτό είναι το **Ε-873.3** — χωρίς τον όρο, ένα καθυστερημένο DELETE
 *   σβήνει **έγκυρο** ευρετήριο.
 * - **Άγνωστη έκδοση** (οποιαδήποτε) ⇒ ναι, με τον ίδιο λόγο: μια ταφόπλακα παραπάνω είναι
 *   αναστρέψιμη από την επόμενη εγγραφή· ένα φάντασμα δεν είναι.
 */
export function shouldApplySearchIndexTombstone(
  stored: StoredSearchIndexState | null,
  incoming: CommitVersion | null,
): boolean {
  if (stored === null || incoming === null) return true;
  const storedVersion = toCommitVersion(stored.sourceUpdateTime);
  if (storedVersion === null) return true;
  const order = compareCommitVersions(incoming, storedVersion);
  if (order < 0) return false;
  return !(order === 0 && stored.deleted === true);
}

/** Πότε λήγει μια ταφόπλακα που γράφεται **τώρα** (ms από epoch). */
export function searchTombstoneExpiryMs(nowMs: number): number {
  return nowMs + SEARCH_TOMBSTONE_TTL_MS;
}

/** Ποιανού είναι η ταφόπλακα — όσο χρειάζεται για να παραμείνει αναγνώσιμη από τους κανόνες. */
export interface SearchTombstoneIdentity {
  readonly tenantId: string | null;
  readonly entityType: string;
  readonly entityId: string;
}

/**
 * Το **σχήμα** της ταφόπλακας — σε ένα σημείο, γιατί το γράφουν **δύο** πακέτα.
 *
 * 🔑 Ο φράχτης δεν είναι ο κώδικας που γράφει· είναι τα **πεδία**. Αν ο ένας γραφέας ξεχάσει
 * το `deleted` ή αφήσει prefixes, η ταφόπλακα του άλλου παύει να ισχύει σιωπηλά. Η μηχανική
 * της συναλλαγής διαφέρει ανά πακέτο (δύο SDK)· το **περιεχόμενο** όχι.
 *
 * ⚠️ Ο χρόνος λήξης φεύγει από εδώ ως **αριθμός ms**: ο `Timestamp` είναι κλάση που δεν περνά
 * το σύνορο της προβολής. Κάθε γραφέας τον μετατρέπει με το δικό του SDK.
 */
export function buildSearchTombstone(
  identity: SearchTombstoneIdentity,
  version: CommitVersion | null,
  nowMs: number,
): {
  readonly tenantId: string | null;
  readonly entityType: string;
  readonly entityId: string;
  readonly deleted: true;
  readonly sourceUpdateTime: CommitVersion | null;
  readonly search: { readonly normalized: string; readonly prefixes: readonly string[] };
  readonly expiresAtMs: number;
} {
  return {
    tenantId: identity.tenantId,
    entityType: identity.entityType,
    entityId: identity.entityId,
    deleted: true,
    sourceUpdateTime: version,
    // 🔑 Ο κενός πίνακας ΕΙΝΑΙ η εξαφάνιση: το ερώτημα φιλτράρει με `array-contains-any` πάνω
    // του, και κενός πίνακας δεν ταιριάζει ποτέ. Μην του βάλεις «placeholder» prefix.
    search: { normalized: '', prefixes: [] },
    expiresAtMs: searchTombstoneExpiryMs(nowMs),
  };
}
