'use client';

/**
 * @fileoverview **Τα ακίνητά ΜΟΥ** — το λεξιλόγιο της Α14 πάνω στη μία ανάγνωση.
 * @related ADR-777 §7 (Α14 · Α12 επίπεδο Β) · CHECK 3.35 · useOwnedDocuments.ts
 * @module services/realtime/hooks/useMyOwnerProperties
 *
 * 🔑 **Το κάτοπτρο του `useMyDemands`, πάνω στον ΙΔΙΟ μηχανισμό.** Και οι δύο
 * συλλογές είναι `mode: 'userId'` στο `tenant-config.ts`: «ζητώ» και «προσφέρω»,
 * ιδιωτικά ανά **άνθρωπο**. Ό,τι διαφέρει ζει εδώ — δύο σταθερές και δύο ονόματα
 * πεδίων.
 *
 * 🔴 **ADR-777 §8.39 — Ο ΚΑΤΑΛΟΓΟΣ ΦΙΛΤΡΑΡΕΙ ΚΑΤΑ ΧΩΡΟ, ΟΧΙ ΜΟΝΟ ΚΑΤΑ ΚΑΤΟΧΟ.**
 * Το ερώτημα ρωτά `authorUserId === uid`, που είναι η **απομόνωση** («ποιος επιτρέπεται
 * να το δει»). Ο **χώρος** είναι άλλη ερώτηση: μια αγγελία που ο μεσίτης κατέγραψε **για
 * πελάτη** έχει `authorCompanyId`, ανήκει στο **γραφείο**, και εμφανιζόταν μέσα στον
 * χώρο που το `.shell-boundary.json` δηλώνει «**ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΤΟΥ ΙΔΙΩΤΗ**».
 *
 * ⚠️ **ΓΙΑΤΙ ΦΙΛΤΡΟ ΚΑΙ ΟΧΙ ΔΕΥΤΕΡΟ `where()`:** ένα `where(authorCompanyId == null)` θα
 * έμοιαζε με **δεύτερο άξονα απομόνωσης** — και το `types/owner-property.ts` γράφει ρητά
 * ότι *«δύο άξονες απομόνωσης για ένα έγγραφο σημαίνει δύο απαντήσεις στο ποιος το
 * βλέπει»*. Η απομόνωση μένει **μία** (`authorUserId`, όπως και ο κανόνας Firestore)· ο
 * χώρος είναι απόφαση **παρουσίασης** και κρίνεται εδώ, καθαρά, χωρίς νέο index.
 *
 * ⚠️ **Ο πελάτης ΔΙΑΒΑΖΕΙ, ποτέ δεν γράφει.** Ο κανόνας δίνει `read` στα δικά του και
 * `if false` σε κάθε εγγραφή — η γραφή περνά από τον διακομιστή, γιατί η αγγελία έχει
 * **δημόσιο παράγωγο** (`public_listings`). Δες `owner-property.service.ts`.
 */

import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { db } from '@/lib/firebase';
import { isPersonalCustody } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import type { OwnerProperty } from '@/types/owner-property';

import {
  useOwnedDocument,
  useOwnedList,
  type OwnedCollectionSpec,
} from './useOwnedDocuments';

/**
 * Πού ζει «το ακίνητό μου» — και **ποιο είναι το ερώτημα**.
 *
 * 🔑 Το `query()` ζει **εδώ**, όχι στη μηχανή: μόνο εδώ ονομάζονται στατικά και οι δύο
 * αυθεντίες (`COLLECTIONS.OWNER_PROPERTIES` · `FIELDS.AUTHOR_USER_ID`), άρα μόνο εδώ
 * μπορούν οι **CHECK 3.10 και 3.35** να κρίνουν την απομόνωση. Δες το σκεπτικό στο
 * {@link useOwnedDocuments}.
 *
 * ⚠️ Σταθερά επιπέδου module — η αναφορά της `buildQuery` μπαίνει σε `useEffect` deps.
 */
const OWNER_PROPERTIES: OwnedCollectionSpec<OwnerProperty> = {
  collectionName: COLLECTIONS.OWNER_PROPERTIES,
  buildQuery: (userId) =>
    query(
      collection(db, COLLECTIONS.OWNER_PROPERTIES),
      where(FIELDS.AUTHOR_USER_ID, '==', userId),
    ),
  label: 'τα ακίνητά μου',
  /**
   * 🔴 **ΤΟ ΣΥΝΟΡΟ ΠΟΥ Ο ΠΕΛΑΤΗΣ ΔΕΝ ΠΕΡΝΟΥΣΕ** (ADR-842 §7.6.12 · ADR-864 Α3).
   *
   * Ο **διακομιστής** περνούσε από εδώ σε 19 σημεία· αυτή η οθόνη **όχι** — και το
   * τίμημα ήταν ορατό στον άνθρωπο: **0 από 7** αποθηκευμένες καταχωρήσεις έχουν
   * `marketingAudience` (η απουσία σημαίνει `public`, Α3), οπότε κάθε κάρτα τύπωνε
   * `marketingAudience.undefined`. Το σύνορο το ερμήνευε **ήδη σωστά**· απλώς δεν το
   * ρωτούσε κανείς.
   */
  fromDocument: ownerPropertyFromDocument,
};

/** Οι τέσσερις καταστάσεις του καταλόγου, με το λεξιλόγιο της προσφοράς. */
export type MyOwnerPropertiesState =
  | { readonly state: 'anonymous' }
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly properties: readonly OwnerProperty[] }
  | { readonly state: 'error'; readonly message: string };

/**
 * **Τα ακίνητά μου**, ζωντανά.
 *
 * @param userId — το uid του συνδεδεμένου, ή `null` όταν δεν υπάρχει ταυτότητα
 */
export function useMyOwnerProperties(userId: string | null): MyOwnerPropertiesState {
  const state = useOwnedList<OwnerProperty>(OWNER_PROPERTIES, userId);
  // 🔑 ADR-777 §8.75 — **σταθερή ταυτότητα ανά στιγμιότυπο**: χωρίς το `useMemo` κάθε απόδοση
  //    έδινε **νέο** πίνακα, και κάθε `useMemo([properties])` από κάτω (διαμέριση, GeoJSON του
  //    χάρτη) ξανάτρεχε σε **κάθε** απόδοση — δηλαδή ήταν διακοσμητικό.
  const items = state.state === 'ready' ? state.items : null;
  const properties = useMemo(() => (items === null ? null : items.filter(isPersonalCustody)), [items]);
  if (state.state !== 'ready' || properties === null) return state;
  return { state: 'ready', properties };
}

/** Οι πέντε καταστάσεις της μίας αγγελίας. */
export type MyOwnerPropertyLookup =
  | { readonly state: 'anonymous' }
  | { readonly state: 'loading' }
  | { readonly state: 'found'; readonly property: OwnerProperty }
  | { readonly state: 'absent' }
  | { readonly state: 'error'; readonly message: string };

/** Η **μία** αγγελία, ζωντανά — η ανάγνωση της οθόνης λεπτομέρειας. */
export function useMyOwnerProperty(
  ownerPropertyId: string,
  userId: string | null,
): MyOwnerPropertyLookup {
  const lookup = useOwnedDocument<OwnerProperty>(OWNER_PROPERTIES, ownerPropertyId, userId);
  if (lookup.state !== 'found') return lookup;
  // ⚠️ **`absent`, όχι σφάλμα** — ίδιο συμβόλαιο με τον κανόνα Firestore: «δεν υπάρχει
  // **εδώ**». Μια εταιρική αγγελία ζει στον χώρο του γραφείου, και η οθόνη της είναι
  // ο κατάλογος εντολών, όχι ο ιδιωτικός χώρος.
  if (!isPersonalCustody(lookup.item)) return { state: 'absent' };
  return { state: 'found', property: lookup.item };
}
