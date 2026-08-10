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
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { PublicListing, ListingLedger } from '@/types/public-listing';
import { listingMapShape, isMappedShape } from '@/lib/listings/listing-map-shape';

const logger = createModuleLogger('usePublicListings');

export interface PublicListingsState {
  readonly listings: readonly PublicListing[];
  readonly loading: boolean;
  readonly error: string | null;
}

export function usePublicListings(): PublicListingsState {
  const [listings, setListings] = useState<readonly PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // tenant-scope-exempt: `public_listings` είναι δηλωμένη `published-projection` στο
    // `services/firestore/tenant-config.ts` — κλειστό σχήμα ΧΩΡΙΣ ταυτότητα πελάτη,
    // γραμμένο μόνο από τον διακομιστή. Δεν υπάρχει `companyId` να φιλτραριστεί, και
    // η αφιλτράριστη λίστα ΕΙΝΑΙ το ερώτημα που ο κανόνας `read: if true` επιτρέπει
    // ρητά (άγκυρα: `public-listings.rules.test.ts`).
    const q = collection(db, COLLECTIONS.PUBLIC_LISTINGS);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setListings(snapshot.docs.map((doc) => doc.data() as PublicListing));
        setLoading(false);
      },
      (err: Error) => {
        logger.error('Δεν φορτώθηκαν οι δημόσιες αγγελίες', { error: err.message });
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { listings, loading, error };
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
            ? { state: 'found', listing: snapshot.data() as PublicListing }
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
