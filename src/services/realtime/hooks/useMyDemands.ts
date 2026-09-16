'use client';

/**
 * @fileoverview **Οι ζητήσεις ΜΟΥ** — το λεξιλόγιο της Α9 πάνω στη μία ανάγνωση.
 * @related ADR-777 §7 (Α9 · Α12 επίπεδο Β) · CHECK 3.35 · useOwnedDocuments.ts
 * @module services/realtime/hooks/useMyDemands
 *
 * 🔴 **Ο μηχανισμός εξήχθη στο {@link useOwnedDocuments} (ADR-777 Α14, 2026-08-11).**
 * Η **προσφορά του ιδιώτη** είναι η δεύτερη συλλογή `mode: 'userId'` του ADR-777 και
 * η ανάγνωσή της είναι **ταυτόσημη** — φίλτρο στο πεδίο κατόχου, `onSnapshot`, ίδιες
 * καταστάσεις. Δεύτερη γραφή θα ήταν κλώνος που μπλοκάρει το **CHECK 3.28**, και ο
 * **N.0.2** ζητά το SSoT **πριν** το αντίγραφο.
 *
 * ⚠️ **Η δημόσια επιφάνεια ΔΕΝ άλλαξε**, επίτηδες: οι δύο καταναλωτές
 * (`MyDemandsContent` · `DemandDetailContent`) διαβάζουν `state.demands` και
 * `lookup.demand` — ονόματα του **τομέα**, όχι του μηχανισμού. Μια «απλοποίηση» σε
 * `items`/`item` θα έκανε τις οθόνες να μιλούν τη γλώσσα του μεταφορέα.
 */

import { collection, query, where } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { db } from '@/lib/firebase';
import {
  readStoredDemand,
  type StoredDemandRead,
} from '@/lib/demand/property-demand-from-document';

import {
  useOwnedDocument,
  useOwnedList,
  type OwnedCollectionSpec,
} from './useOwnedDocuments';

/**
 * Πού ζει «η ζήτησή μου» — και **ποιο είναι το ερώτημα**.
 *
 * 🔑 Το `query()` ζει **εδώ**, όχι στη μηχανή: μόνο εδώ ονομάζονται στατικά και οι δύο
 * αυθεντίες (`COLLECTIONS.PROPERTY_DEMANDS` · `FIELDS.AUTHOR_USER_ID`), άρα μόνο εδώ
 * μπορούν οι **CHECK 3.10 και 3.35** να κρίνουν την απομόνωση. Δες το σκεπτικό στο
 * {@link useOwnedDocuments}.
 *
 * ⚠️ Σταθερά επιπέδου module — η αναφορά της `buildQuery` μπαίνει σε `useEffect` deps.
 */
const DEMANDS: OwnedCollectionSpec<StoredDemandRead> = {
  collectionName: COLLECTIONS.PROPERTY_DEMANDS,
  buildQuery: (userId) =>
    query(
      collection(db, COLLECTIONS.PROPERTY_DEMANDS),
      where(FIELDS.AUTHOR_USER_ID, '==', userId),
    ),
  label: 'οι ζητήσεις',
  /**
   * 🔴 **`readStoredDemand` ΚΑΙ ΟΧΙ `propertyDemandFromDocument`, ΕΠΙΤΗΔΕΣ.**
   *
   * Το λεπτό περιτύλιγμα πετά τις ελλιπείς — σωστό για τον **διακομιστή** (καραντίνα
   * RESO: καμία ελλιπής ζήτηση δεν γίνεται ισχυρισμός προς τρίτον). Εδώ θα ήταν
   * **σιωπηλή εξαφάνιση** από τον κατάλογο του **ίδιου του κατόχου** — ακριβώς αυτό
   * που απαγορεύει η Α5 §4.1, και το χειρότερο που μπορεί να δει ο άνθρωπος: κάτι
   * δικό του που «χάθηκε μόνο του».
   *
   * Άρα η οθόνη παίρνει **και τα δύο σκέλη** και δείχνει το ελλιπές **με τον λόγο του**
   * και έναν δρόμο διόρθωσης.
   */
  fromDocument: readStoredDemand,
};

/**
 * Οι τέσσερις καταστάσεις του καταλόγου, με το λεξιλόγιο της ζήτησης.
 *
 * ⚠️ **`StoredDemandRead` και όχι `PropertyDemand`** — ο κατάλογος του **κατόχου** είναι ο
 * ένας τόπος που οφείλει να δει και την **ελλιπή** ζήτηση: η Α5 §4.1 απαγορεύει τη
 * σιωπηλή εξαφάνιση. Οι διαδρομές του διακομιστή παίρνουν τον στενό τύπο μέσω του
 * `propertyDemandFromDocument` (καραντίνα, πρότυπο RESO `Incomplete`).
 */
export type MyDemandsState =
  | { readonly state: 'anonymous' }
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly demands: readonly StoredDemandRead[] }
  | { readonly state: 'error'; readonly message: string };

/**
 * **Οι ζητήσεις μου**, ζωντανά.
 *
 * @param userId — το uid του συνδεδεμένου, ή `null` όταν δεν υπάρχει ταυτότητα
 */
export function useMyDemands(userId: string | null): MyDemandsState {
  const state = useOwnedList<StoredDemandRead>(DEMANDS, userId);
  return state.state === 'ready' ? { state: 'ready', demands: state.items } : state;
}

/** Οι πέντε καταστάσεις της μίας ζήτησης. */
export type MyDemandLookup =
  | { readonly state: 'anonymous' }
  | { readonly state: 'loading' }
  | { readonly state: 'found'; readonly demand: StoredDemandRead }
  | { readonly state: 'absent' }
  | { readonly state: 'error'; readonly message: string };

/** Η **μία** ζήτηση, ζωντανά — η ανάγνωση της οθόνης λεπτομέρειας. */
export function useMyDemand(demandId: string, userId: string | null): MyDemandLookup {
  const lookup = useOwnedDocument<StoredDemandRead>(DEMANDS, demandId, userId);
  return lookup.state === 'found' ? { state: 'found', demand: lookup.item } : lookup;
}
