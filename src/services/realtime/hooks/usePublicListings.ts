'use client';

/**
 * @fileoverview Η **μία** ανάγνωση της οθόνης 2 — και η κλειστή λογιστική μαζί της.
 * @related ADR-777 §7 (Α3 · Α5 κανόνας 27 · Α20) · §8.65 · types/public-listing.ts
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
 * στη συλλογή είναι εξ ορισμού δημόσιο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 §8.65 — ΤΟ ΕΡΩΤΗΜΑ ΕΦΥΓΕ ΑΠΟ ΤΟΝ ΦΥΛΛΟΜΕΤΡΗΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι τις 2026-09-07 εδώ στεκόταν `collection(db, PUBLIC_LISTINGS)` — **καμία**
 * `where`, **καμία** `limit`, και `onSnapshot`: ολόκληρη η αγορά, ζωντανά, σε κάθε
 * επισκέπτη. Ήταν γραμμένο ως **συνειδητή** απόφαση για εννέα αγγελίες, και ήταν σωστή
 * τότε. Τώρα το ερώτημα κουβαλά **περιοχή** *(εύρη σε δύο πεδία — ένα ερώτημα, δες
 * `lib/listings/listing-geo-query.ts` για τη μετρημένη σύγκριση με το geohash)* και
 * **πάντα** όριο.
 *
 * 🔑 **Η λογιστική υπολογίζεται ΕΔΩ, όχι στον καταναλωτή** — γιατί αν την υπολόγιζε ο
 * καταναλωτής, θα υπήρχε μία λογιστική **ανά καταναλωτή**, και ο κανόνας 27 απαιτεί το
 * άθροισμα να κλείνει **πάντα**, όχι «όπου κάποιος θυμήθηκε».
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { PublicListing, ListingLedger } from '@/types/public-listing';
import type { GeoArea } from '@/types/geo/coordinates';
import { listingMapShape, isMappedShape } from '@/lib/listings/listing-map-shape';
import {
  capListingReads,
  listingAreaKey,
  type ListingReadCoverage,
} from '@/lib/listings/listing-geo-query';
import { orderShowcaseListings } from '@/lib/listings/listing-showcase-order';
import { agencyDoorFor } from '@/lib/agency/agency-door';

import { countPublicListings, publicListingsQuery } from './public-listings-query';
import {
  readListingSnapshots,
  readSingleListing,
  subscribeToPublicListings,
  type PublicListingLookup,
} from './public-listings-source';

export type { PublicListingLookup } from './public-listings-source';

const logger = createModuleLogger('usePublicListings');

/**
 * **Πόση ακινησία σημαίνει «ο άνθρωπος κοιτάζει».**
 *
 * 🔑 Το υβριδικό ζωντανό: όσο ο χάρτης ταξιδεύει, κάθε κάδρο διαβάζεται **εφάπαξ** —
 * γρήγορα και χωρίς ακροατή. Μόλις σταματήσει τόσο, ανοίγει **μία** ζωντανή γραμμή για
 * εκείνο το κάδρο, και μια αγγελία που δημοσιεύεται τώρα εμφανίζεται μόνη της.
 *
 * ⚠️ **Ούτε Zillow, ούτε Idealista, ούτε Redfin το κάνουν** — δίνουν εφάπαξ ανάγνωση.
 * Γίνεται εδώ επειδή το ερώτημα είναι **ένα**: με geohash θα ήταν 4-9 ακροατές που
 * ανοιγοκλείνουν σε κάθε σύρσιμο, δηλαδή κόστος χωρίς αντίκρισμα.
 */
const LIVE_AFTER_STILLNESS_MS = 1_200;

export interface PublicListingsState {
  readonly listings: readonly PublicListing[];
  readonly loading: boolean;
  readonly error: string | null;
  /**
   * **Κοίταξα παντού, ή κόπηκα;** — η ομολογία που οφείλει η οθόνη (§8.65).
   *
   * ⚠️ Οι δύο αδελφοί *(μία αγγελία · βιτρίνα γραφείου)* είναι **πάντα** `'complete'`:
   * ρωτούν κατά ταυτότητα, όχι κατά περιοχή. Το πεδίο υπάρχει και σε αυτούς ώστε ο
   * καταναλωτής να μη χρειάζεται **δύο** σχήματα κατάστασης για την ίδια ερώτηση.
   */
  readonly coverage: ListingReadCoverage;
}

/** Η προεπιλογή: ρώτησα κατά ταυτότητα, δεν υπάρχει τίποτα να ομολογήσω. */
const COMPLETE: ListingReadCoverage = { kind: 'complete' };

/**
 * **Η ΜΙΑ ΚΑΤΑΣΤΑΣΗ ΜΙΑΣ ΔΗΜΟΣΙΑΣ ΣΥΝΔΡΟΜΗΣ** — τέσσερα πεδία, τέσσερις μεταβάσεις.
 *
 * 🔴 **Δεύτερη εξαγωγή που ζήτησε το CHECK 3.28 στο ίδιο commit** *(ADR-841 §7 Α6)*, και
 * η δεύτερη φορά που είχε δίκιο: μετά τη συνδρομή, ο κλώνος που έμενε ήταν η **ίδια η
 * κατάσταση**. Ένα `loading` που ξεχνά να κλείσει σε **έναν** από τους δύο αδελφούς
 * είναι μόνιμος «Φόρτωση…».
 *
 * 🔑 **Οι μεταβάσεις είναι ονομασμένες, όχι σκόρπιοι setters**: `begin` *(ρωτάω)* ·
 * `deliver` *(ήρθαν)* · `fail` *(δεν μπόρεσα)* · `idle` *(**δεν** ρωτάω — και δεν είναι
 * σφάλμα)*. Η τέταρτη είναι που δεν επιτρέπεται να γίνει `deliver([])`: *«κανείς δεν
 * ρώτησε»* και *«ρώτησα, δεν έχει»* καταλήγουν στην **ίδια** κενή λίστα αλλά είναι
 * διαφορετικές αλήθειες για τον καλούντα.
 *
 * ⚠️ **Ο καλών ταξινομεί ΠΡΙΝ το `deliver`** — η σειρά είναι απόφαση της οθόνης του.
 */
function usePublicListingsSubscriptionState(): {
  readonly state: PublicListingsState;
  readonly begin: () => void;
  readonly deliver: (listings: readonly PublicListing[], coverage?: ListingReadCoverage) => void;
  readonly fail: (message: string) => void;
  readonly idle: () => void;
} {
  const [listings, setListings] = useState<readonly PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<ListingReadCoverage>(COMPLETE);

  const transitions = useMemo(
    () => ({
      begin: () => {
        setLoading(true);
        setError(null);
      },
      deliver: (fresh: readonly PublicListing[], nextCoverage: ListingReadCoverage = COMPLETE) => {
        setListings(fresh);
        setCoverage(nextCoverage);
        setLoading(false);
      },
      fail: (message: string) => {
        setError(message);
        setLoading(false);
      },
      idle: () => {
        setListings([]);
        setCoverage(COMPLETE);
        setLoading(false);
        setError(null);
      },
    }),
    []
  );

  return { state: { listings, loading, error, coverage }, ...transitions };
}

/**
 * Οι δημόσιες αγγελίες **της δηλωμένης περιοχής** — η ανάγνωση της **οθόνης 2**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΥΒΡΙΔΙΚΟ ΖΩΝΤΑΝΟ, ΚΑΙ ΓΙΑΤΙ ΜΕ ΑΥΤΗ ΤΗ ΣΕΙΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Εφάπαξ, αμέσως** — ο επισκέπτης βλέπει το νέο κάδρο χωρίς να περιμένει ακροατή.
 * 2. **Ζωντανά, μετά τη σιγή** — μόνο για το κάδρο στο οποίο όντως στάθηκε.
 *
 * ⚠️ **Η αντίστροφη σειρά θα ήταν χειρότερη και από τις δύο**: ένας ακροατής που
 * ανοίγει και κλείνει σε κάθε σύρσιμο πληρώνει **πλήρη ανάγνωση** για κάδρα που ο
 * άνθρωπος προσπέρασε, και δεν προλαβαίνει ποτέ να παραδώσει ζωντανή ενημέρωση.
 *
 * ⚠️ **Το `near` διαβάζεται από ref, με κλειδί το {@link listingAreaKey}** — και είναι
 * το ίδιο ιδίωμα με τα `boundsRef`/`searchAreaRef` του `ResultsMap`: τα φίλτρα
 * ξαναγεννιούνται σε κάθε απόδοση, οπότε εξάρτηση στην **αναφορά** θα ακύρωνε τη
 * συνδρομή σε κάθε απόδοση *(νέο αντικείμενο ⇒ βρόχος)*.
 *
 * @param near Η δηλωμένη περιοχή, ή `null` για ολόκληρη την αγορά. **Και στις δύο
 *   περιπτώσεις ισχύει το {@link LISTING_READ_CAP}**: το ελάττωμα δεν ήταν η απουσία
 *   περιοχής — ήταν η απουσία **οποιουδήποτε** ορίου.
 * @param hold **Περίμενε — η περιοχή δεν είναι ακόμη γνωστή** *(ADR-883)*. Το όριο ενός
 *   δήμου φορτώνει ασύγχρονα· ως τότε το `near` είναι `null`, που εδώ θα σήμαινε *«όλη η
 *   αγορά»*. Χωρίς αυτή τη σημαία η λίστα θα έδειχνε για μια στιγμή αγγελίες όλης της
 *   Ελλάδας και θα αναβόσβηνε στον δήμο. Όσο ισχύει: `loading`, καμία ανάγνωση.
 */
export function usePublicListings(near: GeoArea | null, hold = false): PublicListingsState {
  const { state, begin, deliver, fail } = usePublicListingsSubscriptionState();

  const areaKey = hold ? 'hold' : listingAreaKey(near);
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const nearRef = useRef(near);
  nearRef.current = near;

  /**
   * 🔴 **Ο ΣΥΝΟΛΙΚΟΣ ΑΡΙΘΜΟΣ ΖΕΙ ΣΕ REF, ΚΑΙ ΤΟ ΕΜΑΘΑ ΓΡΑΦΟΝΤΑΣ ΤΟ ΛΑΘΟΣ.** Η πρώτη
   * γραφή διάβαζε το `state.coverage` **μέσα** στην επανάκληση του `onSnapshot` — δηλαδή
   * ένα **στιγμιότυπο** της κατάστασης παγωμένο τη στιγμή που στήθηκε ο ακροατής. Ο
   * ακροατής ζει **λεπτά**· η κατάσταση αλλάζει στο μεταξύ. Είναι κατά λέξη ο κανόνας
   * του ADR-040: *«οι χειριστές συμβάντων παίρνουν getter, ποτέ στιγμιότυπο»* — και η
   * συνέπεια εδώ θα ήταν μετρητής που **γυρίζει πίσω** στην πρώτη ζωντανή ενημέρωση.
   */
  const knownTotalRef = useRef<number | null>(null);

  useEffect(() => {
    const area = nearRef.current;
    let cancelled = false;
    let live: Unsubscribe | null = null;

    begin();
    knownTotalRef.current = null;
    if (holdRef.current) return undefined;

    // (1) ΕΦΑΠΑΞ — και η καταμέτρηση μαζί, ώστε η ομολογία να έρθει με τα δεδομένα.
    void Promise.all([getDocs(publicListingsQuery(area)), countPublicListings(area)])
      .then(([snapshot, total]) => {
        if (cancelled) return;
        knownTotalRef.current = total;
        const capped = capListingReads(readListingSnapshots(snapshot.docs), total);
        deliver(capped.items, capped.coverage);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        logger.error('Δεν φορτώθηκαν οι δημόσιες αγγελίες', { error: err.message });
        fail(err.message);
      });

    // (2) ΖΩΝΤΑΝΑ — μόνο αφού ο χάρτης ησυχάσει.
    const timer = setTimeout(() => {
      if (cancelled) return;
      live = subscribeToPublicListings(
        publicListingsQuery(area),
        (fresh) => {
          // ⚠️ Η **ομολογία** δεν ξαναϋπολογίζεται από νέα καταμέτρηση: το ζωντανό
          //    παραδίδει το **ίδιο** ερώτημα, άρα το «κόπηκε;» απαντιέται από το ίδιο
          //    «ένα παραπάνω». Δεύτερη καταμέτρηση ανά στιγμιότυπο θα ήταν ερώτημα ανά
          //    αλλαγή εγγράφου — κόστος χωρίς νέα γνώση.
          const capped = capListingReads(fresh, knownTotalRef.current);
          deliver(capped.items, capped.coverage);
        },
        fail,
        { message: 'Δεν φορτώθηκαν οι δημόσιες αγγελίες' }
      );
    }, LIVE_AFTER_STILLNESS_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      live?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `near` διαβάζεται από ref
    // επίτηδες (δες την κεφαλίδα): το κλειδί ΕΙΝΑΙ η ταυτότητα της περιοχής.
  }, [areaKey, begin, deliver, fail]);

  return state;
}

// ============================================================================
// Η ΜΙΑ ΑΓΓΕΛΙΑ — αδελφός, όχι δεύτερη ανάγνωση
// ============================================================================

/**
 * Η **μία** αγγελία, ζωντανά — η ανάγνωση της **οθόνης 3**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΑΔΕΛΦΟΣ ΚΑΙ ΟΧΙ ΦΙΛΤΡΟ ΠΑΝΩ ΣΤΟ {@link usePublicListings}
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το να διαβάσει η οθόνη 3 **ολόκληρη** τη συλλογή και να κρατήσει ένα έγγραφο θα
 * ήταν σωστό σήμερα και **δομικά λάθος** αύριο: η **Α0** δεσμεύει *«μοντέλο για την
 * τελική κλίμακα, οθόνη σταδιακά»*, και σε 60.000 αγγελίες το άνοιγμα **μιας** σελίδας
 * ακινήτου θα κατέβαζε **όλες** τις άλλες.
 *
 * ⚠️ **Δεν είναι δεύτερη ανάγνωση**: ίδια συλλογή, ίδια σταθερά, ίδιο σχήμα, ίδιο
 * αρχείο. Είναι η **ίδια** πηγή ρωτημένη πιο στενά — η διάκριση που ο κανόνας 19
 * ονομάζει «*μετακινούμε καταναλωτές, όχι αρχεία*».
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

    // `public_listings` είναι δηλωμένη `published-projection` στο
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
 * **Ίδιο επιχείρημα, ίδιος αριθμός** με τον λόγο που το {@link usePublicListing} είναι
 * αδελφός: σε **60.000** αγγελίες, το άνοιγμα της βιτρίνας **ενός** γραφείου θα
 * κατέβαζε **όλη την αγορά** στον φυλλομετρητή για να κρατήσει έξι έγγραφα.
 *
 * 🔴 **ΚΑΙ ΓΙΝΕΤΑΙ ΜΟΝΟ ΕΠΕΙΔΗ ΥΠΑΡΧΕΙ ΤΑΥΤΟΤΗΤΑ.** Πριν το `agencyId` (ADR-841 §7 Α1)
 * το φίλτρο θα ήταν πάνω στην **επωνυμία-κείμενο** — δηλαδή δύο γραφεία με ίδιο όνομα
 * θα εμφάνιζαν το ένα τις αγγελίες του άλλου, και μια μετονομασία θα **άδειαζε** τη
 * βιτρίνα χωρίς να αλλάξει τίποτα στην πραγματικότητα.
 *
 * ⚠️ **Καμία `orderBy`, και είναι απόφαση**: ένα `orderBy` θα απαιτούσε **σύνθετο
 * ευρετήριο** *(CHECK 3.15)* και —το βαρύτερο— θα έκρυβε τη σειρά μέσα στο ερώτημα.
 * Η σειρά μιας βιτρίνας είναι **ορατή απόφαση**: το `agency-profile.ts` απαγορεύει
 * ρητά **εμπορική** κατάταξη. Ταξινομεί ο καταναλωτής, με κριτήριο που διαβάζεται.
 *
 * ⚠️ **Ήδη ταξινομημένες** ({@link orderShowcaseListings}) — δες εκεί γιατί **όχι**
 * `projectedAt`, που είναι το προφανές και ψεύτικο κλειδί.
 *
 * @param companyId Το `companyId` του γραφείου, ή `null` όταν το ψευδώνυμο δεν λύθηκε.
 */
export function usePublicAgencyListings(companyId: string | null): PublicListingsState {
  const { state, begin, deliver, fail, idle } = usePublicListingsSubscriptionState();

  useEffect(() => {
    // 🔑 **Η ΙΔΙΑ ΠΟΡΤΑ ΜΕ ΤΗ ΒΙΤΡΙΝΑ** ({@link agencyDoorFor}, ADR-827 §9.4) — και δεν
    //    είναι κομψότητα: οι δύο αναγνώσεις ζουν στην **ίδια σελίδα**. Μια δεύτερη
    //    κρίση εδώ θα μπορούσε να **διαφωνήσει** με εκείνη, και η οθόνη θα έδειχνε
    //    βιτρίνα χωρίς αγγελίες — ή αγγελίες χωρίς βιτρίνα.
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
      }
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
