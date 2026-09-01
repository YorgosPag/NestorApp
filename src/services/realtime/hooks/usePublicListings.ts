'use client';

/**
 * @fileoverview Η **μία** ανάγνωση της οθόνης 2 — και η κλειστή λογιστική μαζί της.
 * @related ADR-777 §7 (Α3 · Α5 κανόνας 27 · Α20) · types/public-listing.ts
 * @module services/realtime/hooks/usePublicListings
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ **ΕΝΑ** ΕΡΩΤΗΜΑ, ΕΝΩ Ο `usePublicProperties` ΧΡΕΙΑΖΕΤΑΙ ΔΥΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας του `properties` έχει **δύο** δημόσια σκέλη (παλιό `commercialStatus` ·
 * νέο `offerKinds`), και **τα rules δεν είναι φίλτρα**: ένα ερώτημα πρέπει να
 * ικανοποιεί **ένα** σκέλος για **κάθε** έγγραφο που επιστρέφει. Άρα εκεί χρειάζονται
 * δύο ερωτήματα + συγχώνευση + αποδιπλασιασμός, **για πάντα**.
 *
 * Εδώ το κριτήριο δημοσίευσης εφαρμόστηκε **μία φορά, στον διακομιστή**: ό,τι υπάρχει
 * στη συλλογή είναι εξ ορισμού δημόσιο. Το ερώτημα γίνεται «φέρε τα όλα».
 *
 * 🔑 **Η λογιστική υπολογίζεται ΕΔΩ, όχι στον καταναλωτή** — γιατί αν την υπολόγιζε ο
 * καταναλωτής, θα υπήρχε μία λογιστική **ανά καταναλωτή**, και ο κανόνας 27 απαιτεί το
 * άθροισμα να κλείνει **πάντα**, όχι «όπου κάποιος θυμήθηκε».
 */

import { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import type { DocumentData, Query, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { PublicListing, ListingLedger } from '@/types/public-listing';
import { listingMapShape, isMappedShape } from '@/lib/listings/listing-map-shape';
import { readStoredListing } from '@/lib/listings/public-listing-from-document';
import { orderShowcaseListings } from '@/lib/listings/listing-showcase-order';
import { agencyDoorFor } from '@/lib/agency/agency-door';

const logger = createModuleLogger('usePublicListings');

// ============================================================================
// ΤΟ ΣΥΝΟΡΟ (ADR-839)
// ============================================================================
//
// 🔴 **Καμία από τις δύο συναρτήσεις δεν ξέρει το σχήμα** — το ρωτούν. Πριν το
//    ADR-839 και οι δύο διαδρομές έγραφαν `data() as PublicListing`, δηλαδή
//    **δήλωναν** ό,τι δεν είχαν ελέγξει· η αγγελία `ownp_330a5a4b…` έπεσε στην
//    παραγωγή ακριβώς εκεί. Εδώ μένει μόνο το «τι κάνω με την απάντηση».

/** Ό,τι χρειάζεται η ανάγνωση από ένα στιγμιότυπο — ώστε οι δύο διαδρομές να μοιράζονται τύπο. */
interface ListingSnapshotLike {
  readonly id: string;
  data(): unknown;
}

/**
 * **Πόσα έγγραφα ζητούν επανασύνθεση** — καταγράφεται, δεν διορθώνεται εδώ.
 *
 * ⚠️ **ΓΙΑΤΙ ΔΕΝ ΓΡΑΦΕΙ ΠΙΣΩ ο αναγνώστης (lazy migration), όσο κι αν το προτείνει
 * το πρότυπο του document store**: ο πελάτης **δεν έχει** δικαίωμα εγγραφής στο
 * `public_listings` — γράφει **μόνο** ο διακομιστής (`read: if true`, καμία
 * `write`). Ένα write-back-on-read θα απαιτούσε διαδρομή που επιτρέπει σε
 * **ανώνυμο** επισκέπτη να πυροδοτεί εγγραφές, δηλαδή θα αντάλλασσε μια λευκή
 * οθόνη με ένα διάνυσμα DoS. Η επανασύνθεση ανήκει στο batch (`rebuildAllPublicListings`),
 * και ο επισκέπτης βλέπει ήδη σωστά γιατί η μετάφραση έγινε **στη μνήμη**.
 */
function reportStaleListings(staleCount: number, total: number): void {
  if (staleCount === 0) return;
  logger.warn('Δημόσιες προβολές σε παλαιότερη έκδοση σχήματος — εκκρεμεί επανασύνθεση', {
    data: { stale: staleCount, total },
  });
}

/** Λίστα στιγμιότυπων → αγγελίες. Ό,τι δεν είναι καν αντικείμενο **πέφτει**, δεν σκάει. */
function readListingSnapshots(docs: readonly ListingSnapshotLike[]): readonly PublicListing[] {
  const reads = docs.map((snapshot) => readStoredListing(snapshot.data(), snapshot.id));

  reportStaleListings(reads.filter((read) => read?.needsRebuild).length, docs.length);

  return reads.flatMap((read) => (read === null ? [] : [read.listing]));
}

/** Ένα στιγμιότυπο → η έκβαση της αναζήτησης. Άμορφο έγγραφο = **δεν υπάρχει αγγελία**. */
function readSingleListing(raw: unknown, id: string): PublicListingLookup {
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
 * και δύο αντίγραφά του θα απέκλιναν στην πρώτη αλλαγή *(π.χ. ο ένας να μάθει
 * `needsRebuild` και ο άλλος όχι)*.
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
function subscribeToPublicListings(
  listingsQuery: Query<DocumentData>,
  deliver: (listings: readonly PublicListing[]) => void,
  fail: (message: string) => void,
  failure: { readonly message: string; readonly data?: Record<string, unknown> },
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
    },
  );
}

export interface PublicListingsState {
  readonly listings: readonly PublicListing[];
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * **Η ΜΙΑ ΚΑΤΑΣΤΑΣΗ ΜΙΑΣ ΔΗΜΟΣΙΑΣ ΣΥΝΔΡΟΜΗΣ** — τρία πεδία, τέσσερις μεταβάσεις.
 *
 * 🔴 **Δεύτερη εξαγωγή που ζήτησε το CHECK 3.28 στο ίδιο commit** *(ADR-841 §7 Α6)*, και
 * η δεύτερη φορά που είχε δίκιο: μετά τη συνδρομή, ο κλώνος που έμενε ήταν η **ίδια η
 * κατάσταση** *(τρία `useState` + οι ίδιες τέσσερις μεταβάσεις)*. Ένα `loading` που
 * ξεχνά να κλείσει σε **έναν** από τους δύο αδελφούς είναι μόνιμος «Φόρτωση…» — και το
 * είδαμε ζωντανά σε αυτή τη συνεδρία, από άλλη αιτία.
 *
 * 🔑 **Οι μεταβάσεις είναι ονομασμένες, όχι σκόρπιοι setters**: `begin` *(ρωτάω)* ·
 * `deliver` *(ήρθαν)* · `fail` *(δεν μπόρεσα)* · `idle` *(**δεν** ρωτάω — και δεν είναι
 * σφάλμα)*. Η τέταρτη είναι που δεν επιτρέπεται να γίνει `deliver([])`: *«κανείς δεν
 * ρώτησε»* και *«ρώτησα, δεν έχει»* καταλήγουν στην **ίδια** κενή λίστα αλλά είναι
 * διαφορετικές αλήθειες για τον καλούντα.
 *
 * ⚠️ **Ο καλών ταξινομεί ΠΡΙΝ το `deliver`** — η σειρά είναι απόφαση της οθόνης του,
 * όχι της συνδρομής.
 */
function usePublicListingsSubscriptionState(): {
  readonly state: PublicListingsState;
  readonly begin: () => void;
  readonly deliver: (listings: readonly PublicListing[]) => void;
  readonly fail: (message: string) => void;
  readonly idle: () => void;
} {
  const [listings, setListings] = useState<readonly PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const transitions = useMemo(
    () => ({
      begin: () => {
        setLoading(true);
        setError(null);
      },
      deliver: (fresh: readonly PublicListing[]) => {
        setListings(fresh);
        setLoading(false);
      },
      fail: (message: string) => {
        setError(message);
        setLoading(false);
      },
      idle: () => {
        setListings([]);
        setLoading(false);
        setError(null);
      },
    }),
    [],
  );

  return { state: { listings, loading, error }, ...transitions };
}

export function usePublicListings(): PublicListingsState {
  const { state, deliver, fail } = usePublicListingsSubscriptionState();

  useEffect(() => {
    // tenant-scope-exempt: `public_listings` είναι δηλωμένη `published-projection` στο
    // `services/firestore/tenant-config.ts` — κλειστό σχήμα ΧΩΡΙΣ ταυτότητα πελάτη,
    // γραμμένο μόνο από τον διακομιστή. Η αφιλτράριστη λίστα ΕΙΝΑΙ το ερώτημα που ο
    // κανόνας `read: if true` επιτρέπει ρητά (άγκυρα: `public-listings.rules.test.ts`).
    //
    // 🔴 **ΔΙΟΡΘΩΣΗ 2026-09-01 (ADR-841 §7 Α1)**: εδώ έγραφε *«δεν υπάρχει `companyId`
    //    να φιλτραριστεί»* — **έπαψε να ισχύει** τη στιγμή που μπήκε το `agencyId`.
    //    Υπάρχει πλέον ταυτότητα **γραφείου** στο σχήμα, και τη ρωτά η
    //    {@link usePublicAgencyListings}. Δεν υπάρχει ταυτότητα **πελάτη** — αυτό
    //    μένει αληθές και είναι ο λόγος της εξαίρεσης. ⚠️ Η **οθόνη 2** εξακολουθεί να
    //    ζητά τα πάντα επίτηδες: είναι όλη η αγορά, όχι μία βιτρίνα.
    const q = collection(db, COLLECTIONS.PUBLIC_LISTINGS);

    return subscribeToPublicListings(q, deliver, fail, {
      message: 'Δεν φορτώθηκαν οι δημόσιες αγγελίες',
    });
  }, [deliver, fail]);

  return state;
}

// ============================================================================
// Η ΜΙΑ ΑΓΓΕΛΙΑ — αδελφός, όχι δεύτερη ανάγνωση
// ============================================================================

/**
 * **Τι ξέρουμε για τη μία αγγελία** — τέσσερις **ρητές** καταστάσεις.
 *
 * 🔴 **Το `absent` ΔΕΝ είναι σφάλμα, και η διάκριση δεν είναι λεπτολογία.** Η
 * συλλογή είναι **προβολή**: μια αγγελία φεύγει από εκεί όταν το ακίνητο **πάψει να
 * είναι δημοσιεύσιμο** (`publish-public-listing`). Δηλαδή «δεν υπάρχει» σημαίνει
 * *«δεν δημοσιεύεται πια»* — πληροφορία που ο επισκέπτης **δικαιούται**, ιδίως όταν
 * έφτασε εδώ από κοινοποιημένο σύνδεσμο. Ένα κοινό «κάτι πήγε στραβά» θα τον έστελνε
 * να ξαναδοκιμάσει κάτι που **δεν πρόκειται** να αλλάξει.
 *
 * ⚠️ Ίδια σχεδίαση με το `SubmitState` του `PlaceSearchBox` και το `DisplayPrice`:
 * **ποτέ** `boolean` + `null` για δύο διαφορετικές αποτυχίες.
 */
export type PublicListingLookup =
  | { readonly state: 'loading' }
  | { readonly state: 'found'; readonly listing: PublicListing }
  | { readonly state: 'absent' }
  | { readonly state: 'error'; readonly message: string };

/**
 * Η **μία** αγγελία, ζωντανά — η ανάγνωση της **οθόνης 3**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΑΔΕΛΦΟΣ ΚΑΙ ΟΧΙ ΦΙΛΤΡΟ ΠΑΝΩ ΣΤΟ {@link usePublicListings}
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το να διαβάσει η οθόνη 3 **ολόκληρη** τη συλλογή και να κρατήσει ένα έγγραφο θα
 * ήταν σωστό σήμερα (**6** αγγελίες) και **δομικά λάθος** αύριο: η **Α0** δεσμεύει
 * *«μοντέλο για την τελική κλίμακα, οθόνη σταδιακά»*, και σε 60.000 αγγελίες το
 * άνοιγμα **μιας** σελίδας ακινήτου θα κατέβαζε **όλες** τις άλλες.
 *
 * ⚠️ **Δεν είναι δεύτερη ανάγνωση**: ίδια συλλογή, ίδια σταθερά, ίδιο σχήμα, ίδιο
 * αρχείο. Είναι η **ίδια** πηγή ρωτημένη πιο στενά — η διάκριση που ο κανόνας 19
 * ονομάζει «*μετακινούμε καταναλωτές, όχι αρχεία*». Μια **δεύτερη** ανάγνωση θα ήταν
 * άλλη πηγή ή άλλο κριτήριο δημοσίευσης· εδώ δεν υπάρχει κριτήριο, γιατί το εφάρμοσε
 * ήδη ο διακομιστής **μία φορά** (βλ. κεφαλίδα αρχείου).
 *
 * 🔴 **Ζωντανά, όχι εφάπαξ**: ο ίδιος γραφέας που σβήνει την αγγελία όταν πάψει να
 * είναι δημοσιεύσιμη θα την **εξαφανίσει από την ανοιχτή σελίδα** — αντί ο επισκέπτης
 * να κοιτά επί ώρα μια τιμή που δεν ισχύει.
 */
export function usePublicListing(id: string): PublicListingLookup {
  const [lookup, setLookup] = useState<PublicListingLookup>({ state: 'loading' });

  useEffect(() => {
    // ⚠️ Κενή ταυτότητα ⇒ το `doc()` **πετά**. Η διαδρομή `/listing/` χωρίς τμήμα δεν
    // ταιριάζει καν στο route, αλλά η άμυνα είναι φθηνή και η εναλλακτική είναι
    // λευκή οθόνη από εξαίρεση μέσα σε effect.
    if (id.trim() === '') {
      setLookup({ state: 'absent' });
      return;
    }

    setLookup({ state: 'loading' });

    // tenant-scope-exempt: `public_listings` είναι δηλωμένη `published-projection` στο
    // `services/firestore/tenant-config.ts` — κλειστό σχήμα ΧΩΡΙΣ ταυτότητα πελάτη.
    // Ανάγνωση **ενός** εγγράφου κατά ταυτότητα: δεν υπάρχει ερώτημα να φιλτραριστεί,
    // και ο κανόνας `read: if true` το επιτρέπει ρητά (άγκυρα: `public-listings.rules.test.ts`).
    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.PUBLIC_LISTINGS, id),
      (snapshot) => {
        setLookup(
          snapshot.exists()
            ? readSingleListing(snapshot.data(), snapshot.id)
            : { state: 'absent' }
        );
      },
      (err: Error) => {
        logger.error('Δεν φορτώθηκε η δημόσια αγγελία', { data: { id }, error: err.message });
        setLookup({ state: 'error', message: err.message });
      }
    );

    return () => unsubscribe();
  }, [id]);

  return lookup;
}

// ============================================================================
// ΟΙ ΑΓΓΕΛΙΕΣ **ΕΝΟΣ ΓΡΑΦΕΙΟΥ** — τρίτος αδελφός (ADR-841 §7 Α6)
// ============================================================================

/**
 * Οι αγγελίες **ενός** γραφείου, ζωντανά — η ανάγνωση της **βιτρίνας** `/pro/<ψευδώνυμο>`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΤΡΙΤΟΣ ΑΔΕΛΦΟΣ ΚΑΙ ΟΧΙ ΦΙΛΤΡΟ ΠΑΝΩ ΣΤΟ {@link usePublicListings}
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Ίδιο επιχείρημα, ίδιος αριθμός** με τον λόγο που το {@link usePublicListing} είναι
 * αδελφός: σε **60.000** αγγελίες, το άνοιγμα της βιτρίνας **ενός** γραφείου θα
 * κατέβαζε **όλη την αγορά** στον φυλλομετρητή για να κρατήσει έξι έγγραφα. Η **Α0**
 * δεσμεύει *«μοντέλο για την τελική κλίμακα, οθόνη σταδιακά»*.
 *
 * ⚠️ **Δεν είναι δεύτερη ανάγνωση**: ίδια συλλογή, ίδια σταθερά, ίδιο σύνορο σχήματος
 * ({@link readListingSnapshots}), ίδιο αρχείο. Είναι η **ίδια** πηγή ρωτημένη πιο
 * στενά — «*μετακινούμε καταναλωτές, όχι αρχεία*».
 *
 * 🔴 **ΚΑΙ ΓΙΝΕΤΑΙ ΜΟΝΟ ΕΠΕΙΔΗ ΥΠΑΡΧΕΙ ΤΑΥΤΟΤΗΤΑ.** Πριν το `agencyId` (ADR-841 §7 Α1)
 * το φίλτρο θα ήταν πάνω στην **επωνυμία-κείμενο** — δηλαδή δύο γραφεία με ίδιο όνομα
 * θα εμφάνιζαν το ένα τις αγγελίες του άλλου, και μια μετονομασία θα **άδειαζε** τη
 * βιτρίνα χωρίς να αλλάξει τίποτα στην πραγματικότητα. Γι' αυτό η Α6 δήλωνε ότι
 * *«είναι δύο δουλειές, όχι μία»*.
 *
 * ⚠️ **Καμία `orderBy`, και είναι απόφαση**: ένα `orderBy` θα απαιτούσε **σύνθετο
 * ευρετήριο** *(CHECK 3.15)* και —το βαρύτερο— θα έκρυβε τη σειρά μέσα στο ερώτημα.
 * Η σειρά μιας βιτρίνας είναι **ορατή απόφαση**: το `agency-profile.ts` απαγορεύει
 * ρητά **εμπορική** κατάταξη. Ταξινομεί ο καταναλωτής, με κριτήριο που διαβάζεται.
 *
 * ⚠️ **Ήδη ταξινομημένες** ({@link orderShowcaseListings}) — δες εκεί γιατί **όχι**
 * `projectedAt`, που είναι το προφανές και ψεύτικο κλειδί.
 *
 * ⚠️ **Επιστρέφει το ΙΔΙΟ {@link PublicListingsState}** με τον μεγάλο αδελφό — δεύτερο
 * σχήμα κατάστασης για την ίδια ερώτηση θα ήταν δεύτερο λεξιλόγιο *(«φορτώνει;»,
 * «απέτυχε;»)* που θα απέκλινε στην πρώτη αλλαγή.
 *
 * @param companyId Το `companyId` του γραφείου, ή `null` όταν το ψευδώνυμο δεν λύθηκε.
 */
export function usePublicAgencyListings(companyId: string | null): PublicListingsState {
  const { state, begin, deliver, fail, idle } = usePublicListingsSubscriptionState();

  useEffect(() => {
    // 🔑 **Η ΙΔΙΑ ΠΟΡΤΑ ΜΕ ΤΗ ΒΙΤΡΙΝΑ** ({@link agencyDoorFor}, ADR-827 §9.4) — και δεν
    //    είναι κομψότητα: οι δύο αναγνώσεις ζουν στην **ίδια σελίδα**. Μια δεύτερη
    //    κρίση εδώ θα μπορούσε να **διαφωνήσει** με εκείνη *(η μία ρωτά, η άλλη όχι)*,
    //    και η οθόνη θα έδειχνε βιτρίνα χωρίς αγγελίες — ή αγγελίες χωρίς βιτρίνα.
    //
    // ⚠️ **Κενή ταυτότητα ⇒ ΤΕΛΟΣ, όχι ερώτημα.** Ένα `where('agencyId','==', null)`
    //    θα επέστρεφε **κάθε αγγελία ιδιώτη** της αγοράς μέσα στη βιτρίνα ενός
    //    γραφείου — δηλαδή θα απέδιδε σε εκείνο ακίνητα που δεν του ανήκουν.
    const door = agencyDoorFor(companyId);

    if (door.kind === 'absent') {
      idle();
      return;
    }

    begin();

    // tenant-scope-exempt: το φίλτρο **ΕΙΝΑΙ** ταυτότητα οργανισμού — στενότερο από
    // το αφιλτράριστο ερώτημα που ο ίδιος κανόνας (`read: if true`) ήδη επιτρέπει.
    // Και το `agencyId` **δεν είναι** ταυτότητα πελάτη: είναι το κλειδί εγγράφου του
    // `agency_profiles/{companyId}`, που ο κανόνας δίνει σε **ανώνυμο** (ADR-841 §7 Α1).
    const q = query(
      collection(db, COLLECTIONS.PUBLIC_LISTINGS),
      where('agencyId', '==', door.companyId)
    );

    // ⚠️ **Η σειρά μπαίνει ΕΔΩ, όχι στην οθόνη** — ίδιο ιδίωμα με το
    //    `usePublicAgencies`: αν την έβαζε ο καταναλωτής, θα υπήρχε **μία σειρά ανά
    //    οθόνη** και ο ντετερμινισμός θα ήταν υπόσχεση που κάποιος πρέπει να
    //    **θυμάται**. Εδώ είναι διαδρομή που δεν παρακάμπτεται.
    return subscribeToPublicListings(
      q,
      (fresh) => deliver(orderShowcaseListings(fresh)),
      fail,
      {
        message: 'Δεν φορτώθηκαν οι αγγελίες του γραφείου',
        data: { companyId: door.companyId },
      },
    );
  }, [companyId, begin, deliver, fail, idle]);

  return state;
}

/**
 * Η **κλειστή λογιστική** πάνω σε ένα σύνολο αγγελιών (Α5, κανόνας 27).
 *
 * ⚠️ **Διαβάζει το ΙΔΙΟ `listingMapShape` με τον χάρτη.** Αυτό δεν είναι κομψότητα:
 * είναι ο λόγος που η λίστα δεν μπορεί να πει «11 στον χάρτη» ενώ ο χάρτης δείχνει 10.
 * Ένα δεύτερο κριτήριο εδώ (π.χ. «έχει συντεταγμένες;») θα ήταν δεύτερη απάντηση στο
 * ίδιο ερώτημα — το σχήμα του ADR-749, στην οθόνη αυτή τη φορά.
 */
export function computeListingLedger(listings: readonly PublicListing[]): ListingLedger {
  const mapped = listings.filter((l) => isMappedShape(listingMapShape(l.position))).length;
  return { total: listings.length, mapped, unmapped: listings.length - mapped };
}

/** Οι αγγελίες **χωρίς** σχήμα — αυτές που δεν επιτρέπεται να εξαφανιστούν (Α5 §4.1). */
export function selectUnmappedListings(
  listings: readonly PublicListing[]
): readonly PublicListing[] {
  return listings.filter((l) => !isMappedShape(listingMapShape(l.position)));
}

/** Οι αγγελίες **με** σχήμα, έτοιμες για τον χάρτη. */
export function selectMappedListings(
  listings: readonly PublicListing[]
): readonly PublicListing[] {
  return listings.filter((l) => isMappedShape(listingMapShape(l.position)));
}

/** Η λογιστική ως τιμή React — υπολογισμένη μία φορά ανά αλλαγή συνόλου. */
export function useListingLedger(listings: readonly PublicListing[]): ListingLedger {
  return useMemo(() => computeListingLedger(listings), [listings]);
}
