'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΜΙΑΣ ΕΝΤΟΛΗΣ** — φόρτωση, πράξη, ξαναφόρτωση **της μίας**.
 * @related ADR-841 §7 Α18.12 · hooks/mandate/useMandateRowActions.ts
 * @module hooks/mandate/useMandateDetail
 *
 * 🔑 **ΑΔΕΛΦΟΣ ΤΟΥ {@link useMandateCatalog}, ΟΧΙ ΔΙΔΥΜΟΣ ΤΟΥ.** Ό,τι μοιράζονται — οι
 * τέσσερις τιμές των πράξεων — ζει στο {@link useMandateRowActions} και **ζητείται**
 * και από τους δύο. Ό,τι διαφέρει είναι ακριβώς αυτό που πρέπει: **τι διαβάζεται**, και
 * **τι σημαίνει «ξαναρώτα»**.
 *
 * ⛔ Και δεν είναι διακοσμητικός κανόνας: ο ίδιος αγωγός (`jscpd`, CHECK 3.28) μέτρησε
 * **9 γραμμές / 50 tokens** κλώνο μέσα σε **ένα** αρχείο διαδρομής εντολών και τον
 * μπλόκαρε. Δύο hooks με αντιγραμμένους χειριστές θα ήταν πολλαπλάσιο αυτού.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΕΣΣΕΡΙΣ ΕΚΒΑΣΕΙΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΦΟΡΑΕΙ ΤΗ ΣΤΟΛΗ ΑΛΛΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Δεν υπάρχει»* ≠ *«υπάρχει χωρίς εντολή»* ≠ *«δεν σε ακούσαμε»*. Ο κατάλογος έχει
 * **δύο** καταστάσεις (`ready`/`failed`) γιατί μια λίστα ή έρχεται ή δεν έρχεται· μια
 * **ταυτότητα** όμως μπορεί να είναι λάθος, και αυτό δεν είναι βλάβη — είναι απάντηση.
 *
 * ⚠️ Το ίδιο σχήμα με τις τρεις άγνοιες του `MandateClientName`: **η άγνοια ονομάζεται,
 * δεν μεταμφιέζεται.**
 */

import { useCallback } from 'react';

import { useIdentityGatedResource } from '@/hooks/useIdentityGatedResource';
import {
  useMandateRowActions,
  type CatalogFeedback,
  type MandateRowActions,
} from '@/hooks/mandate/useMandateRowActions';
import { fetchMandateDetail, type DetailLoad } from '@/services/mandate/mandate-catalog.client';

/**
 * **Λύθηκε η ταυτότητα και δεν υπάρχει κανείς.**
 *
 * ⚠️ **Σταθερά σε εμβέλεια module, όχι κυριολεκτικό μέσα στο σώμα**: το
 * {@link useIdentityGatedResource} το κρατά, και ένα νέο αντικείμενο κάθε απόδοση θα
 * ήταν σιωπηλή αλλαγή αναφοράς σε κάθε μελλοντικό `useMemo` από κάτω.
 */
const UNAUTHENTICATED: DetailLoad = { kind: 'failed', message: 'unauthenticated' };

/**
 * Τι δείχνει η οθόνη **τώρα**.
 *
 * 🔑 Το `loaded` κουβαλά ολόκληρο το {@link DetailLoad} και **δεν το ξεδιπλώνει**: οι
 * τρεις εκβάσεις του διακομιστή είναι ήδη κλειστό σύνολο με ονόματα, και ένα δεύτερο
 * ξετύλιγμα εδώ θα ήταν **δεύτερο λεξιλόγιο** για το ίδιο πράγμα.
 */
export type MandateDetailState =
  | { readonly state: 'loading' }
  | {
      readonly state: 'settled';
      readonly loaded: DetailLoad;
      readonly busyId: string | null;
      readonly feedback: CatalogFeedback | null;
    };

/**
 * ⚠️ **Οι δύο πράξεις ΔΕΝ ξαναδηλώνονται**: η υπογραφή τους διαβάζεται **από τον
 * ιδιοκτήτη τους**, ώστε μια αλλαγή εκεί να **σπάει** αυτό το αρχείο.
 */
export interface MandateDetailApi extends Pick<MandateRowActions, 'act' | 'setPresence'> {
  readonly view: MandateDetailState;
  readonly reload: () => void;
}

export function useMandateDetail(ownerPropertyId: string): MandateDetailApi {
  // ⚠️ **Σταθερός** (`useCallback`): ο {@link useIdentityGatedResource} τον έχει στις
  //    εξαρτήσεις του, και ένας νέος κάθε απόδοση θα διάβαζε σε βρόχο.
  const fetcher = useCallback(() => fetchMandateDetail(ownerPropertyId), [ownerPropertyId]);

  // 🔑 **Ο ΚΑΝΟΝΑΣ «ΜΗΝ ΡΩΤΑΣ ΠΡΙΝ ΞΕΡΕΙΣ ΠΟΙΟΣ ΡΩΤΑ» ΖΗΤΕΙΤΑΙ, ΔΕΝ ΓΡΑΦΕΤΑΙ.** Η
  //    πρώτη γραφή τον **αντέγραψε** από τον κατάλογο και το **CHECK 3.28 τη μπλόκαρε**
  //    (30 γραμμές / 53 tokens) — δες {@link useIdentityGatedResource}.
  const { value: loaded, reload } = useIdentityGatedResource<DetailLoad>(fetcher, UNAUTHENTICATED);

  const { busyId, feedback, act, setPresence } = useMandateRowActions(reload);

  if (loaded === null) return { view: { state: 'loading' }, reload, act, setPresence };
  return { view: { state: 'settled', loaded, busyId, feedback }, reload, act, setPresence };
}
