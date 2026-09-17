/**
 * @fileoverview Read Paths — η ΕΝΩΣΗ των δρόμων ανάγνωσης μιας client λίστας (ADR-862 Φ0 Β11)
 *
 * **Το ερώτημα**: *«Πώς διαβάζει μια λίστα ό,τι της επιτρέπει ο κανόνας, όταν ο κανόνας
 * δέχεται ΠΕΡΙΣΣΟΤΕΡΟΥΣ από έναν δρόμους;»*
 *
 * 🔴 Το Firestore κρίνει κάθε `list` από τα **φίλτρα** του. Ο κανόνας των `files` δέχεται
 * δύο: «όλο το γραφείο» (`cdeReadReach == tenant`) **ή** «τα δικά μου» (`createdBy == uid`,
 * μαζί με το WIP μου). Ένα ερώτημα `or()` δεν συνθέτεται με τα φίλτρα μισθωτή του
 * καλούντα χωρίς να ξαναγραφτεί κάθε καταναλωτής ⇒ **δύο ερωτήματα, μία ένωση**, εδώ,
 * μία φορά — ο καταναλωτής βλέπει **μία** λίστα.
 *
 * 🔑 **Κανόνες της ένωσης**:
 *  1. **Διπλότυπα κατά `id`** — το δικό μου κοινοποιημένο αρχείο ταιριάζει και στους δύο
 *     δρόμους· εμφανίζεται **μία** φορά, στη θέση του πρώτου δρόμου.
 *  2. **Καμία μερική παράδοση** — η ακρόαση παραδίδει μόνο όταν **όλοι** οι δρόμοι έχουν
 *     απαντήσει τουλάχιστον μία φορά. Αλλιώς η οθόνη θα έδειχνε πρώτα «μισή» λίστα και
 *     μετά την πλήρη (τρεμόπαιγμα + ψευδές «άδειο»).
 *  3. **`lastDocument: null` όταν οι δρόμοι είναι >1** — ο δρομέας σελιδοποίησης ενός
 *     ερωτήματος **δεν** ορίζει θέση σε ένωση δύο. Κανένας καταναλωτής `files` δεν
 *     σελιδοποιεί (μετρημένο 2026-09-17: μόνος χρήστης του πεδίου οι ειδοποιήσεις).
 *
 * @see services/firestore/read-scope-config — ποιοι δρόμοι ανά συλλογή
 * @see firestore.rules `match /files/{fileId}` `allow list`
 */

import {
  onSnapshot,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import type { QueryResult } from './firestore-query.types';

/** Τα έγγραφα ενός στιγμιότυπου συλλογής, με το `id` τους. */
function mapDocuments<T>(snapshot: QuerySnapshot): T[] {
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as T));
}

/** Ο φάκελος αποτελέσματος — ΕΝΑΣ για ανάγνωση και για ακρόαση. */
function toQueryResult<T>(
  documents: readonly T[],
  lastDocument: DocumentSnapshot | null,
): QueryResult<T> {
  return { documents, size: documents.length, isEmpty: documents.length === 0, lastDocument };
}

/** Ο δείκτης σελιδοποίησης ενός στιγμιότυπου. */
function lastOf(snapshot: QuerySnapshot): DocumentSnapshot | null {
  return snapshot.docs[snapshot.docs.length - 1] ?? null;
}

/** Το `id` ενός αντιστοιχισμένου εγγράφου — ό,τι έβαλε ο {@link mapDocuments}. */
function idOf(document: unknown): string | null {
  if (typeof document !== 'object' || document === null || !('id' in document)) return null;
  const { id } = document;
  return typeof id === 'string' ? id : null;
}

/** **Η ένωση** — σειρά του πρώτου δρόμου, κάθε `id` μία φορά. */
export function mergePathDocuments<T>(perPath: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const documents of perPath) {
    for (const document of documents) {
      const id = idOf(document);
      if (id !== null && seen.has(id)) continue;
      if (id !== null) seen.add(id);
      merged.push(document);
    }
  }
  return merged;
}

/**
 * Το αποτέλεσμα από τα στιγμιότυπα **όλων** των δρόμων (βλ. κανόνα 3 της κεφαλίδας).
 *
 * ⚠️ `maxResults`: το όριο εφαρμόζεται **ανά δρόμο** στο ερώτημα, άρα η ένωση θα μπορούσε
 * να το ξεπεράσει (π.χ. `findByHash` με όριο 1 ⇒ 2). Κόβεται **ξανά** εδώ, ώστε ο
 * καταναλωτής να παίρνει ό,τι ζήτησε.
 */
export function resultOfSnapshots<T>(
  snapshots: readonly QuerySnapshot[],
  maxResults?: number,
): QueryResult<T> {
  if (snapshots.length === 1) {
    return toQueryResult(mapDocuments<T>(snapshots[0]), lastOf(snapshots[0]));
  }
  const merged = mergePathDocuments(snapshots.map(s => mapDocuments<T>(s)));
  return toQueryResult(maxResults ? merged.slice(0, maxResults) : merged, null);
}

/**
 * **Ακρόαση σε όλους τους δρόμους, παράδοση της ένωσης.**
 *
 * ⚠️ Ένα σφάλμα **οποιουδήποτε** δρόμου πάει στον `onError`: σιωπηλή απώλεια του δρόμου
 * «τα δικά μου» θα έκρυβε το WIP του χρήστη χωρίς κανένα ίχνος.
 */
export function listenToPaths<T>(
  queries: readonly Query[],
  maxResults: number | undefined,
  deliver: (result: QueryResult<T>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const latest: (QuerySnapshot | null)[] = queries.map(() => null);
  const unsubscribes = queries.map((q, index) =>
    onSnapshot(
      q,
      snapshot => {
        latest[index] = snapshot;
        const ready = latest.filter((s): s is QuerySnapshot => s !== null);
        if (ready.length === queries.length) deliver(resultOfSnapshots<T>(ready, maxResults));
      },
      onError,
    ),
  );
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}
