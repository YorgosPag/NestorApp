/**
 * =============================================================================
 * CRON LEASE — αποκλεισμός επικαλυπτόμενων εκτελέσεων (ADR-739)
 * =============================================================================
 *
 * ## Τι εγγυάται — και τι ΔΕΝ εγγυάται
 *
 * Αυτό είναι **κλείδωμα αποδοτικότητας**, όχι ορθότητας. Αποτρέπει τη διπλή δουλειά
 * όταν δύο ticks επικαλύπτονται (π.χ. ένα αργό backup τρέχει ακόμη όταν χτυπά το
 * επόμενο λεπτό). **Δεν** εγγυάται «ακριβώς μία φορά».
 *
 * Η βιβλιογραφία των κατανεμημένων συστημάτων είναι κατηγορηματική: μόνο lease **μαζί με
 * fencing token** είναι ασφαλές για ορθότητα· οτιδήποτε άλλο έχει παράθυρο όπου δύο
 * κόμβοι πιστεύουν ταυτόχρονα ότι κρατούν το κλειδί (μια παύση GC μεγαλύτερη του TTL
 * αρκεί). Εδώ δεν υπάρχει fencing token, επειδή δεν χρειάζεται:
 *
 * **Η ορθότητα είναι ιδιότητα των ίδιων των jobs, όχι του κλειδώματος.** Το `backup`
 * ελέγχει μόνο του πόσος χρόνος πέρασε· τα purge δουλεύουν σε παρτίδες με `limit()`
 * πάνω σε ερώτημα που στενεύει καθώς προχωρά· το `oauth-cleanup` έχει `hasMore`. Διπλή
 * εκτέλεση σε αυτά είναι σπατάλη, όχι ζημιά. **Αν προσθέσεις job όπου η διπλή εκτέλεση
 * βλάπτει, κάν' το ιδempotent — μη στηριχτείς σε αυτό το αρχείο.**
 *
 * ## Χρόνος
 *
 * Οι προθεσμίες υπολογίζονται από τον **server της Firestore**, όχι από το ρολόι του
 * container: μια διόρθωση NTP που πάει το τοπικό ρολόι πίσω θα έκανε ένα ενεργό lease
 * να φαίνεται μελλοντικό για πάντα, ή ένα ληγμένο να φαίνεται ενεργό.
 *
 * @module lib/cron/cron-lease
 * @see ADR-739
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import type { CronJobState } from '@/types/cron-schedule';

const logger = createModuleLogger('CronLease');

/** Σχήμα του εγγράφου, όπως ζει στη Firestore (Timestamp αντί για ISO). */
interface CronLeaseDoc {
  slug?: string;
  lastSuccessAt?: Timestamp | null;
  lastAttemptAt?: Timestamp | null;
  leaseExpiresAt?: Timestamp | null;
  leaseOwner?: string | null;
  consecutiveFailures?: number;
  lastError?: string | null;
}

function docRef(slug: string): FirebaseFirestore.DocumentReference {
  return getAdminFirestore().collection(COLLECTIONS.CRON_JOB_STATE).doc(slug);
}

/**
 * Μετατρέπει μια αποθηκευμένη χρονική τιμή σε ISO, ανεκτικά.
 *
 * ⚠️ Δεν προϋποθέτει `Timestamp`. Το πεδίο μπορεί να περιέχει:
 * - `Timestamp` — η κανονική περίπτωση·
 * - **sentinel** `FieldValue.serverTimestamp()` — για όσο δεν έχει επιστρέψει ο server·
 * - συμβολοσειρά ISO ή αριθμό ms — αν το έγγραφο γράφτηκε από παλαιότερη έκδοση.
 *
 * Η αυστηρή εκδοχή (`value.toDate()`) **ρίχνει** σε καθεμία από τις τρεις τελευταίες
 * περιπτώσεις — και θα έριχνε ολόκληρο τον dispatcher, δηλαδή θα σταματούσε **όλες**
 * τις εργασίες επειδή ένα πεδίο μιας εργασίας είχε απρόσμενο σχήμα. Άγνωστο σχήμα
 * αντιμετωπίζεται ως «καμία γνωστή στιγμή»: το χειρότερο που συμβαίνει είναι μια
 * περιττή εκτέλεση catch-up.
 */
function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  if (typeof value === 'number') return new Date(value).toISOString();

  return null;
}

/** Διαβάζει την αποθηκευμένη κατάσταση μιας εργασίας (ή τα προεπιλεγμένα κενά). */
export async function readCronJobState(slug: string): Promise<CronJobState> {
  const snapshot = await docRef(slug).get();
  const data = (snapshot.data() ?? {}) as CronLeaseDoc;

  return {
    slug,
    lastSuccessAt: toIso(data.lastSuccessAt),
    lastAttemptAt: toIso(data.lastAttemptAt),
    leaseExpiresAt: toIso(data.leaseExpiresAt),
    leaseOwner: data.leaseOwner ?? null,
    consecutiveFailures: data.consecutiveFailures ?? 0,
    lastError: data.lastError ?? null,
  };
}

/** Έκβαση της απόπειρας να αποκτηθεί lease. */
export type LeaseAcquisition =
  | { readonly acquired: true; readonly state: CronJobState }
  | { readonly acquired: false; readonly heldUntil: string | null };

/**
 * Προσπαθεί να αποκτήσει το lease μιας εργασίας.
 *
 * Η ανάγνωση και η εγγραφή γίνονται μέσα σε **μία** συναλλαγή Firestore: αυτό είναι που
 * κάνει το «έλεγξε αν είναι ελεύθερο και μετά πάρ' το» ατομικό. Χωρίς τη συναλλαγή, δύο
 * ταυτόχρονοι καλούντες θα διάβαζαν και οι δύο «ελεύθερο» πριν γράψει ο ένας.
 *
 * @param leaseMinutes Διάρκεια του lease. Πρέπει να καλύπτει το `maxRuntimeMinutes` της
 *   εργασίας — αλλιώς λήγει ενώ το job ακόμη τρέχει και ένα επόμενο tick το ξαναρχίζει.
 *   Επιβάλλεται από test στο `cron-schedule`.
 * @param owner Ταυτότητα του κατόχου — **μόνο για διάγνωση**, δεν συμμετέχει στην
 *   απόφαση. Δεν είναι fencing token.
 */
export async function acquireCronLease(
  slug: string,
  leaseMinutes: number,
  owner: string
): Promise<LeaseAcquisition> {
  const db = getAdminFirestore();
  const ref = docRef(slug);

  return db.runTransaction<LeaseAcquisition>(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = (snapshot.data() ?? {}) as CronLeaseDoc;

    // Ένα lease που δεν έχει λήξει ανήκει σε άλλον. Ένα ληγμένο lease αγνοείται:
    // σημαίνει ότι ο προηγούμενος κάτοχος πέθανε στη μέση, και χωρίς λήξη η εργασία
    // θα έμενε κλειδωμένη για πάντα — δηλαδή σιωπηλά νεκρή, ακριβώς το σφάλμα που
    // αυτό το ADR διορθώνει.
    //
    // Η σύγκριση περνά από `toIso` για τον ίδιο λόγο ανεκτικότητας: ένα πεδίο με
    // απρόσμενο σχήμα δεν πρέπει να ρίχνει τη συναλλαγή. Άγνωστο σχήμα ⇒ «δεν
    // κρατείται», που είναι η ασφαλής κατεύθυνση — το χειρότερο είναι διπλή δουλειά,
    // ενώ η αντίθετη επιλογή θα κλείδωνε την εργασία για πάντα.
    const existingIso = toIso(data.leaseExpiresAt);
    if (existingIso && Date.parse(existingIso) > Timestamp.now().toMillis()) {
      return { acquired: false, heldUntil: existingIso };
    }

    const expiresAt = Timestamp.fromMillis(
      Timestamp.now().toMillis() + leaseMinutes * 60_000
    );

    transaction.set(
      ref,
      {
        slug,
        leaseExpiresAt: expiresAt,
        leaseOwner: owner,
        lastAttemptAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      acquired: true,
      state: {
        slug,
        lastSuccessAt: toIso(data.lastSuccessAt),
        lastAttemptAt: toIso(data.lastAttemptAt),
        leaseExpiresAt: toIso(expiresAt),
        leaseOwner: owner,
        consecutiveFailures: data.consecutiveFailures ?? 0,
        lastError: data.lastError ?? null,
      },
    };
  });
}

/**
 * Απελευθερώνει το lease μετά από **επιτυχή** εκτέλεση.
 *
 * Το `lastSuccessAt` είναι αυτό που οδηγεί το catch-up: αν ο container ήταν κάτω την
 * προγραμματισμένη ώρα, ο dispatcher το συγκρίνει με την προηγούμενη οφειλόμενη στιγμή
 * και τρέχει την εργασία με καθυστέρηση αντί να τη χάσει.
 */
export async function releaseCronLeaseAfterSuccess(slug: string): Promise<void> {
  await docRef(slug).set(
    {
      slug,
      lastSuccessAt: FieldValue.serverTimestamp(),
      leaseExpiresAt: null,
      leaseOwner: null,
      consecutiveFailures: 0,
      lastError: null,
    },
    { merge: true }
  );
}

/**
 * Απελευθερώνει το lease μετά από αποτυχία και αυξάνει τον μετρητή.
 *
 * ⚠️ Το `lastSuccessAt` **δεν** ενημερώνεται. Έτσι μια αποτυχημένη εκτέλεση αφήνει την
 * εργασία «οφειλόμενη» και το catch-up θα την ξαναδοκιμάσει στο επόμενο tick — αντί να
 * περιμένει την επόμενη μέρα. Το Sentry monitor έχει ήδη λάβει `error` check-in.
 */
export async function releaseCronLeaseAfterFailure(
  slug: string,
  error: string
): Promise<void> {
  await docRef(slug).set(
    {
      slug,
      leaseExpiresAt: null,
      leaseOwner: null,
      consecutiveFailures: FieldValue.increment(1),
      lastError: error.slice(0, 500),
    },
    { merge: true }
  );

  logger.warn('Cron job failed — lease released', { slug, error });
}
