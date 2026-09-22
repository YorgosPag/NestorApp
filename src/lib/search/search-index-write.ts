/**
 * @module lib/search/search-index-write
 * @description **Ο γραφέας του `search_documents` από τη μεριά της εφαρμογής** — ο ίδιος
 * φράχτης έκδοσης με τους Cloud Functions triggers (ADR-873 Φάση 1 · Στάδιο 1).
 *
 * ## Γιατί υπάρχουν δύο γραφείς, και γιατί αυτό ΔΕΝ είναι διπλότυπο
 *
 * Ο φράχτης δεν έχει νόημα αν τον σέβεται μόνο ο ένας: ένας ωμός `set()` από εδώ **σβήνει το
 * `sourceUpdateTime`** και το ευρετήριο ξαναγίνεται τυφλό μέχρι την επόμενη εγγραφή οντότητας.
 * Το `functions/` όμως είναι **χωριστό πακέτο npm** που δεν μπορεί να εισάγει από το `src/`,
 * και η προβολή (ADR-874) μεταφέρει **μόνο** αρχεία χωρίς εξαρτήσεις — άρα ο κοινός κώδικας
 * δεν μπορεί να αγγίζει το `firebase-admin`.
 *
 * Γι' αυτό μοιράζονται ό,τι **πρέπει** να είναι ίδιο — ο κριτής και το **σχήμα** της
 * ταφόπλακας, στο `search-index-version.ts` — και το καθένα κρατά μόνο τη μηχανική του δικού
 * του SDK. ⛔ **ΜΗΝ** αντιγράψεις κριτή ή πεδία εδώ: κάθε πεδίο που αποκλίνει είναι μια
 * ταφόπλακα που ο άλλος γραφέας δεν αναγνωρίζει.
 *
 * @see functions/src/search/search-index-writer.ts (το αδελφό μισό) · ADR-029 · ADR-873 §9.1.2
 */

import 'server-only';

import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
} from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  buildSearchTombstone,
  shouldApplySearchIndexTombstone,
  shouldApplySearchIndexWrite,
  toCommitVersion,
  type CommitVersion,
  type SearchTombstoneIdentity,
  type StoredSearchIndexState,
} from '@/lib/search/search-index-version';

/** `applied` = το ευρετήριο κινήθηκε · `stale` = υπάρχει ήδη νεότερη έκδοση, η γραφή απορρίφθηκε. */
export type SearchIndexOutcome = 'applied' | 'stale';

/**
 * Η έκδοση μιας οντότητας, από το στιγμιότυπο που τη διάβασε.
 *
 * Το ίδιο νούμερο που βλέπει ο trigger για το ίδιο commit — γι' αυτό μια επανευρετηρίαση από
 * εδώ και μια εγγραφή από trigger **συγκρίνονται σωστά** αντί να αλληλοσβήνονται.
 */
export function entityCommitVersion(snapshot: DocumentSnapshot): CommitVersion | null {
  return toCommitVersion(snapshot.updateTime) ?? toCommitVersion(snapshot.readTime);
}

const searchDocRef = (db: Firestore, searchDocId: string): DocumentReference =>
  db.collection(COLLECTIONS.SEARCH_DOCUMENTS).doc(searchDocId);

const readStored = async (
  ref: DocumentReference,
  transaction: FirebaseFirestore.Transaction,
): Promise<StoredSearchIndexState | null> => {
  const snapshot = await transaction.get(ref);
  return snapshot.exists ? (snapshot.data() as StoredSearchIndexState) : null;
};

/**
 * Γράψε μια εγγραφή ευρετηρίου — εκτός αν κάθεται ήδη **νεότερη** έκδοση της ίδιας οντότητας.
 *
 * Πλήρης `set()`, ποτέ merge: ένα merge θα άφηνε πίσω τα πεδία μιας προηγούμενης ταφόπλακας
 * (`deleted`, `expiresAt`) και η ζωντανή εγγραφή θα **έληγε** μια βδομάδα αργότερα.
 */
export async function writeSearchIndexEntry(
  db: Firestore,
  searchDocId: string,
  payload: Record<string, unknown>,
  version: CommitVersion | null,
): Promise<SearchIndexOutcome> {
  const ref = searchDocRef(db, searchDocId);
  return db.runTransaction(async (transaction) => {
    if (!shouldApplySearchIndexWrite(await readStored(ref, transaction), version)) return 'stale';
    transaction.set(ref, { ...payload, sourceUpdateTime: version });
    return 'applied';
  });
}

/**
 * Βγάλε την οντότητα από την αναζήτηση — ως **ταφόπλακα**, ποτέ ως τρύπα.
 *
 * ⚠️ Όταν ο καλών **δεν ξέρει** έκδοση (π.χ. η οντότητα έχει ήδη φύγει και κάποιος ζητά ρητά
 * αφαίρεση), περνά `null`: ο κριτής το διαβάζει ως «δεν μπορώ να αποδείξω ότι είναι παλιό» και
 * η ταφόπλακα **γράφεται**. Μια ταφόπλακα παραπάνω αναιρείται από την επόμενη εγγραφή· ένα
 * φάντασμα στην αναζήτηση δεν αναιρείται από τίποτα.
 */
export async function writeSearchIndexTombstone(
  db: Firestore,
  searchDocId: string,
  identity: SearchTombstoneIdentity,
  version: CommitVersion | null,
  nowMs: number,
): Promise<SearchIndexOutcome> {
  const ref = searchDocRef(db, searchDocId);
  return db.runTransaction(async (transaction) => {
    const stored = await readStored(ref, transaction);
    if (!shouldApplySearchIndexTombstone(stored, version)) return 'stale';

    const { expiresAtMs, ...tombstone } = buildSearchTombstone(identity, version, nowMs);
    transaction.set(ref, {
      ...tombstone,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(expiresAtMs),
    });
    return 'applied';
  });
}
