/**
 * @fileoverview ΤΟ ΣΥΝΟΡΟ ΣΧΗΜΑΤΟΣ ΤΩΝ ΔΗΜΟΣΙΩΝ ΑΓΓΕΛΙΩΝ — **τι κάνω με την απάντηση**.
 * @related ADR-839 · ADR-777 §8.65 · services/realtime/hooks/usePublicListings.ts
 * @module services/realtime/hooks/public-listings-source
 *
 * 🔴 **ΕΞΗΧΘΗ ΓΙΑΤΙ ΤΟ `usePublicListings.ts` ΠΛΗΣΙΑΖΕ ΤΟ ΟΡΙΟ** *(416 γραμμές, όριο
 * 500 — δεσμευτικό στο pre-commit, N.7.1)*, και το Βήμα 4 προσθέτει ολόκληρο
 * γεωγραφικό ερώτημα.
 *
 * 🔑 **Η κοπή είναι ΚΑΤΑ ΕΥΘΥΝΗ, όχι αριθμητική.** Εδώ ζει *«τι κάνω με το έγγραφο που
 * γύρισε»* — γνώση που αλλάζει όταν αλλάζει **το σχήμα**. Στο `usePublicListings`
 * μένει *«ποιος ρωτά, πότε και τι κρατά»* — γνώση που αλλάζει όταν αλλάζει **η οθόνη**.
 *
 * 🔴 **Καμία συνάρτηση εδώ δεν ξέρει το σχήμα — το ρωτά.** Πριν το ADR-839 και οι δύο
 * διαδρομές έγραφαν `data() as PublicListing`, δηλαδή **δήλωναν** ό,τι δεν είχαν
 * ελέγξει· η αγγελία `ownp_330a5a4b…` έπεσε στην παραγωγή ακριβώς εκεί.
 */

import { onSnapshot } from 'firebase/firestore';
import type { DocumentData, Query, Unsubscribe } from 'firebase/firestore';

import { readStoredListing } from '@/lib/listings/public-listing-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import type { PublicListing } from '@/types/public-listing';

const logger = createModuleLogger('public-listings-source');

/** Ό,τι χρειάζεται η ανάγνωση από ένα στιγμιότυπο — ώστε οι διαδρομές να μοιράζονται τύπο. */
export interface ListingSnapshotLike {
  readonly id: string;
  data(): unknown;
}

/**
 * **Πόσα έγγραφα ζητούν επανασύνθεση** — καταγράφεται, δεν διορθώνεται εδώ.
 *
 * ⚠️ **ΓΙΑΤΙ ΔΕΝ ΓΡΑΦΕΙ ΠΙΣΩ ο αναγνώστης (lazy migration), όσο κι αν το προτείνει το
 * πρότυπο του document store**: ο πελάτης **δεν έχει** δικαίωμα εγγραφής στο
 * `public_listings` — γράφει **μόνο** ο διακομιστής (`read: if true`, καμία `write`).
 * Ένα write-back-on-read θα απαιτούσε διαδρομή που επιτρέπει σε **ανώνυμο** επισκέπτη
 * να πυροδοτεί εγγραφές, δηλαδή θα αντάλλασσε μια λευκή οθόνη με ένα διάνυσμα DoS. Η
 * επανασύνθεση ανήκει στο batch (`rebuildAllPublicListings`), και ο επισκέπτης βλέπει
 * ήδη σωστά γιατί η μετάφραση έγινε **στη μνήμη**.
 */
function reportStaleListings(staleCount: number, total: number): void {
  if (staleCount === 0) return;
  logger.warn('Δημόσιες προβολές σε παλαιότερη έκδοση σχήματος — εκκρεμεί επανασύνθεση', {
    data: { stale: staleCount, total },
  });
}

/** Λίστα στιγμιότυπων → αγγελίες. Ό,τι δεν είναι καν αντικείμενο **πέφτει**, δεν σκάει. */
export function readListingSnapshots(
  docs: readonly ListingSnapshotLike[]
): readonly PublicListing[] {
  const reads = docs.map((snapshot) => readStoredListing(snapshot.data(), snapshot.id));

  reportStaleListings(reads.filter((read) => read?.needsRebuild).length, docs.length);

  return reads.flatMap((read) => (read === null ? [] : [read.listing]));
}

/**
 * **Τι ξέρουμε για τη μία αγγελία** — τέσσερις **ρητές** καταστάσεις.
 *
 * 🔴 **Το `absent` ΔΕΝ είναι σφάλμα, και η διάκριση δεν είναι λεπτολογία.** Η συλλογή
 * είναι **προβολή**: μια αγγελία φεύγει από εκεί όταν το ακίνητο **πάψει να είναι
 * δημοσιεύσιμο** (`publish-public-listing`). Δηλαδή «δεν υπάρχει» σημαίνει *«δεν
 * δημοσιεύεται πια»* — πληροφορία που ο επισκέπτης **δικαιούται**, ιδίως όταν έφτασε
 * εδώ από κοινοποιημένο σύνδεσμο. Ένα κοινό «κάτι πήγε στραβά» θα τον έστελνε να
 * ξαναδοκιμάσει κάτι που **δεν πρόκειται** να αλλάξει.
 *
 * ⚠️ Ίδια σχεδίαση με το `SubmitState` του `PlaceSearchBox` και το `DisplayPrice`:
 * **ποτέ** `boolean` + `null` για δύο διαφορετικές αποτυχίες.
 */
export type PublicListingLookup =
  | { readonly state: 'loading' }
  | { readonly state: 'found'; readonly listing: PublicListing }
  | { readonly state: 'absent' }
  | { readonly state: 'error'; readonly message: string };

/** Ένα στιγμιότυπο → η έκβαση της αναζήτησης. Άμορφο έγγραφο = **δεν υπάρχει αγγελία**. */
export function readSingleListing(raw: unknown, id: string): PublicListingLookup {
  const read = readStoredListing(raw, id);
  if (read === null) return { state: 'absent' };

  reportStaleListings(read.needsRebuild ? 1 : 0, 1);
  return { state: 'found', listing: read.listing };
}

/**
 * **Ο ΕΝΑΣ ΚΥΚΛΟΣ ΖΩΗΣ ΜΙΑΣ ΔΗΜΟΣΙΑΣ ΣΥΝΔΡΟΜΗΣ** — και τον περνούν **και οι τρεις**.
 *
 * 🔴 **Εξήχθη επειδή το CHECK 3.28 τον κατήγγειλε ως κλώνο** *(2026-09-01, ADR-841 §7
 * Α6: 18 γραμμές / 59 tokens, `usePublicListings` ⇄ `usePublicAgencyListings`)* — και
 * είχε δίκιο: *«συνδρομή → σύνορο σχήματος → κατάσταση → σφάλμα»* είναι **ένα** πράγμα,
 * και δύο αντίγραφά του θα απέκλιναν στην πρώτη αλλαγή.
 *
 * ⛔ **ΔΕΝ χρησιμοποιείται το `createRealtimeCollectionHook`** (ADR-798 §22), και ο
 * λόγος είναι δομικός: εκείνο περνά **υποχρεωτικά** από τον `firestoreQueryService`
 * με φρουρό μισθωτή. Το `public_listings` είναι **δημοσιευμένη προβολή** που διαβάζει
 * **ανώνυμος** επισκέπτης — δεν υπάρχει μισθωτής να φρουρηθεί, και ο φρουρός θα
 * απέρριπτε κάθε ανάγνωση. Δύο διαφορετικές ερωτήσεις, δύο σπίτια *(ADR-749)*.
 *
 * 🔑 **Ο καλών κρατά τα setters του**: η μία διαδρομή παραδίδει ωμή λίστα, η άλλη
 * **ταξινομημένη** — η διαφορά ζει στο `deliver`, όχι σε δεύτερη μηχανή συνδρομής.
 */
export function subscribeToPublicListings(
  listingsQuery: Query<DocumentData>,
  deliver: (listings: readonly PublicListing[]) => void,
  fail: (message: string) => void,
  failure: { readonly message: string; readonly data?: Record<string, unknown> }
): Unsubscribe {
  return onSnapshot(
    listingsQuery,
    (snapshot) => deliver(readListingSnapshots(snapshot.docs)),
    (err: Error) => {
      logger.error(failure.message, {
        ...(failure.data === undefined ? {} : { data: failure.data }),
        error: err.message,
      });
      fail(err.message);
    }
  );
}
