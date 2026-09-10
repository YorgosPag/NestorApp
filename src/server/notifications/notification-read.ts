/**
 * =============================================================================
 * ΤΟ «ΔΙΑΒΑΣΤΗΚΕ» ΜΙΑΣ ΕΙΔΟΠΟΙΗΣΗΣ — ΕΝΑΣ ΣΥΓΓΡΑΦΕΑΣ (ADR-848)
 * =============================================================================
 *
 * Δύο πόρτες σημειώνουν μια ειδοποίηση ως διαβασμένη: το **κουδούνι** της
 * εφαρμογής (`POST /api/notifications/ack`) και ο **σύνδεσμος του email**
 * (`/n/{id}`). Αν η καθεμιά έγραφε τα δικά της πεδία, η πρώτη αλλαγή σχήματος θα
 * έφτανε στη μία — και μια ειδοποίηση ανοιγμένη από το email θα φαινόταν
 * **αδιάβαστη** στο κουδούνι, για πάντα, χωρίς τίποτα να κοκκινίσει.
 *
 * ⚠️ **Ανάγνωση ΑΝΑ ΚΛΕΙΔΙ, όχι ερώτημα.** Η πρώτη εκδοχή (στο route) έκανε
 * `where('__name__', 'in', ids.slice(0, 10))`: ερώτημα χωρίς φίλτρο ιδιοκτήτη που
 * **πετούσε σιωπηλά** κάθε ταυτότητα μετά τη δέκατη (όριο του `in`). Το `getAll`
 * διαβάζει έγγραφα **με το όνομά τους** — καμία σιωπηλή περικοπή, καμία ανάγκη για
 * ευρετήριο, και η ιδιοκτησία κρίνεται **ανά έγγραφο**.
 *
 * @module server/notifications/notification-read
 * @see app/api/notifications/ack/route — το κουδούνι
 * @see server/notifications/notification-permalink — το email
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

/**
 * Πάνω από αυτό δεν είναι «σημείωσε ό,τι είδα», είναι φορτίο. Το κουδούνι στέλνει
 * όσες ειδοποιήσεις έχει στη λίστα του — δεκάδες, όχι χιλιάδες.
 */
export const MAX_IDS_PER_MARK = 50;

/** Τα πεδία του «διαβάστηκε» — **ένας** ορισμός, για το κουδούνι και για το email. */
export function seenFields(): { readonly seen: true; readonly seenAt: string } {
  return { seen: true, seenAt: nowISO() };
}

/** Τι απέγινε κάθε ταυτότητα. Ονομασμένο, ποτέ πλήθος μόνο. */
export interface SeenOutcome {
  readonly marked: readonly string[];
  /** Υπάρχουν, αλλά ανήκουν σε **άλλον** — δεν αγγίζονται ποτέ. */
  readonly refused: readonly string[];
}

/**
 * **Σημείωσε ως διαβασμένες όσες από αυτές ανήκουν στον `uid`.**
 *
 * Ανύπαρκτες ταυτότητες αγνοούνται σιωπηλά (το κουδούνι μπορεί να κρατά ειδοποίηση
 * που σβήστηκε)· **ξένες** επιστρέφονται ονομαστικά, ώστε ο καλών να τις καταγράψει.
 */
export async function markNotificationsSeen(
  uid: string,
  ids: readonly string[],
): Promise<SeenOutcome> {
  const unique = [...new Set(ids)].filter((id) => id.length > 0).slice(0, MAX_IDS_PER_MARK);
  if (unique.length === 0) return { marked: [], refused: [] };

  const db = getAdminFirestore();
  const collection = db.collection(COLLECTIONS.NOTIFICATIONS);
  const snapshots = await db.getAll(...unique.map((id) => collection.doc(id)));

  const marked: string[] = [];
  const refused: string[] = [];
  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue;
    if (snapshot.data()?.userId === uid) marked.push(snapshot.id);
    else refused.push(snapshot.id);
  }

  if (marked.length > 0) {
    const batch = db.batch();
    const fields = seenFields();
    for (const id of marked) batch.update(collection.doc(id), fields);
    await batch.commit();
  }

  return { marked, refused };
}
