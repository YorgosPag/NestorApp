'use client';

/**
 * @fileoverview **Η ανάγνωση του ιδιωτικού χώρου** — οι ζητήσεις **μου**, ζωντανά.
 * @related ADR-777 §7 (Α9 · Α12 επίπεδο Β) · CHECK 3.35 · services/firestore/tenant-config.ts
 * @module services/realtime/hooks/useMyDemands
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ `where('authorUserId')` ΔΕΝ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `tenant-config.ts` δηλώνει `PROPERTY_DEMANDS: { mode: 'userId', fieldName:
 * 'authorUserId' }` — δηλαδή η συλλογή είναι **απομονωμένη ανά ΑΝΘΡΩΠΟ**, όχι ανά
 * εταιρεία. Ερώτημα χωρίς τον όρο **μπλοκάρεται από τη CHECK 3.35**, και αυτό είναι
 * το ζητούμενο: η πύλη γεννήθηκε επειδή το `getAllContacts` έστελνε **αφιλτράριστη**
 * λίστα επί μήνες με **όλες** τις προηγούμενες πύλες πράσινες.
 *
 * ⚠️ **Και ο κανόνας Firestore ΔΕΝ είναι φίλτρο.** Το `allow read: if …
 * resource.data.authorUserId == request.auth.uid` σημαίνει ότι ένα ερώτημα «φέρε τα
 * όλα» **αποτυγχάνει ολόκληρο** — δεν επιστρέφει τα δικά μου. Χωρίς τον όρο, η οθόνη
 * θα έδειχνε **σφάλμα**, όχι διαρροή· αλλά θα ήταν σφάλμα που μοιάζει με «δεν έχεις
 * ζητήσεις», και ο χρήστης θα ξανάγραφε ό,τι είχε ήδη γράψει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΑΝΑΓΝΩΣΕΙΣ, ΜΙΑ ΠΗΓΗ — ίδιο ιδίωμα με το `usePublicListings`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κατάλογος και η **μία** ζήτηση είναι **αδέλφια**, όχι φίλτρο πάνω στον κατάλογο.
 * Ίδια συλλογή, ίδια σταθερά, ίδιο σχήμα, ίδιο αρχείο — η **ίδια** πηγή ρωτημένη πιο
 * στενά, που είναι η διάκριση του κανόνα 19 («*μετακινούμε καταναλωτές, όχι αρχεία*»).
 */

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { db } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import type { PropertyDemand } from '@/types/property-demand';

const logger = createModuleLogger('useMyDemands');

/**
 * Τι ξέρουμε για τον κατάλογο. **Τέσσερις** ρητές καταστάσεις.
 *
 * 🔑 **Το `anonymous` είναι ΞΕΧΩΡΙΣΤΟ από το `loading`, και είναι το σημείο.** Ο
 * ανώνυμος επισκέπτης δεν «φορτώνει ακόμη» — **δεν πρόκειται** να φορτώσει τίποτα, και
 * μια αιώνια ροδέλα θα ήταν ψέμα με κίνηση. Ίδια σχεδίαση με το
 * {@link PublicListingLookup}: **ποτέ** `boolean` + `null` για δύο διαφορετικές
 * αποτυχίες.
 */
export type MyDemandsState =
  | { readonly state: 'anonymous' }
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly demands: readonly PropertyDemand[] }
  | { readonly state: 'error'; readonly message: string };

/**
 * **Οι ζητήσεις μου**, ζωντανά.
 *
 * @param userId — το uid του συνδεδεμένου, ή `null` όταν δεν υπάρχει ταυτότητα
 */
export function useMyDemands(userId: string | null): MyDemandsState {
  const [state, setState] = useState<MyDemandsState>(
    userId === null ? { state: 'anonymous' } : { state: 'loading' },
  );

  useEffect(() => {
    if (userId === null) {
      setState({ state: 'anonymous' });
      return;
    }

    setState({ state: 'loading' });

    // 🔴 Ο όρος απομόνωσης, από το **SSoT των ονομάτων πεδίων** — ποτέ ωμή
    // συμβολοσειρά: το `FIELDS` είναι μία από τις τέσσερις αυθεντίες που διαβάζει η
    // CHECK 3.35, και ένα χειρόγραφο `'authorUserId'` θα ήταν πέμπτη.
    const q = query(
      collection(db, COLLECTIONS.PROPERTY_DEMANDS),
      where(FIELDS.AUTHOR_USER_ID, '==', userId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setState({
          state: 'ready',
          demands: snapshot.docs.map((entry) => entry.data() as PropertyDemand),
        });
      },
      (error: Error) => {
        logger.error('Δεν φορτώθηκαν οι ζητήσεις', { error: error.message });
        setState({ state: 'error', message: error.message });
      },
    );

    return () => unsubscribe();
  }, [userId]);

  return state;
}

// ============================================================================
// Η ΜΙΑ ΖΗΤΗΣΗ — αδελφός, όχι φίλτρο
// ============================================================================

/**
 * Τι ξέρουμε για **μία** ζήτηση. **Πέντε** ρητές καταστάσεις.
 *
 * 🔑 **Το `absent` δεν είναι σφάλμα.** Ένα `dmnd_*` που δεν υπάρχει σημαίνει είτε
 * λάθος σύνδεσμος είτε — και είναι το ενδιαφέρον — **ζήτηση άλλου ανθρώπου**: ο
 * κανόνας Firestore δεν επιστρέφει «απαγορεύεται», επιστρέφει **τίποτα**. Και οι δύο
 * περιπτώσεις είναι «δεν υπάρχει **για σένα**», που είναι ακριβώς η αλήθεια που
 * επιτρέπεται να ειπωθεί: ένα «δεν έχεις δικαίωμα» θα **επιβεβαίωνε** ότι η ζήτηση
 * υπάρχει, δηλαδή θα διέρρεε το επίπεδο Β με άρνηση.
 */
export type MyDemandLookup =
  | { readonly state: 'anonymous' }
  | { readonly state: 'loading' }
  | { readonly state: 'found'; readonly demand: PropertyDemand }
  | { readonly state: 'absent' }
  | { readonly state: 'error'; readonly message: string };

/** Η **μία** ζήτηση, ζωντανά — η ανάγνωση της οθόνης λεπτομέρειας. */
export function useMyDemand(demandId: string, userId: string | null): MyDemandLookup {
  const [lookup, setLookup] = useState<MyDemandLookup>({ state: 'loading' });

  useEffect(() => {
    if (userId === null) {
      setLookup({ state: 'anonymous' });
      return;
    }
    // ⚠️ Κενή ταυτότητα ⇒ το `doc()` **πετά**. Η άμυνα είναι φθηνή και η εναλλακτική
    // είναι λευκή οθόνη από εξαίρεση μέσα σε effect.
    if (demandId.trim() === '') {
      setLookup({ state: 'absent' });
      return;
    }

    setLookup({ state: 'loading' });

    // tenant-scope-exempt: ανάγνωση **ενός** εγγράφου κατά ταυτότητα — δεν υπάρχει
    // ερώτημα να φιλτραριστεί. Η απομόνωση επιβάλλεται από τον ίδιο τον κανόνα
    // (`resource.data.authorUserId == request.auth.uid`, firestore.rules), που για
    // έγγραφο άλλου ανθρώπου απαντά **άρνηση** και όχι δεδομένα.
    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.PROPERTY_DEMANDS, demandId),
      (snapshot) => {
        setLookup(
          snapshot.exists()
            ? { state: 'found', demand: snapshot.data() as PropertyDemand }
            : { state: 'absent' },
        );
      },
      (error: Error) => {
        // 🔑 Η άρνηση του κανόνα φτάνει **εδώ**, όχι στο `absent`. Και μεταφράζεται σε
        // `absent`: βλ. τον τύπο — μια άρνηση που λέγεται «απαγορεύεται» επιβεβαιώνει
        // την ύπαρξη, δηλαδή διαρρέει το επίπεδο Β μέσω του μηνύματος λάθους.
        if (error.message.includes('permission')) {
          setLookup({ state: 'absent' });
          return;
        }
        logger.error('Δεν φορτώθηκε η ζήτηση', { data: { demandId }, error: error.message });
        setLookup({ state: 'error', message: error.message });
      },
    );

    return () => unsubscribe();
  }, [demandId, userId]);

  return lookup;
}
