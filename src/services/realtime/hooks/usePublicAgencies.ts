'use client';

/**
 * @fileoverview Οι **δύο δημόσιες αναγνώσεις** του καταλόγου γραφείων (ADR-827 §9.6).
 * @related ADR-827 §9.4 · §9.5 · §9.6 · §9.9 α · lib/agency/agency-directory-order
 * @module services/realtime/hooks/usePublicAgencies
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ **ΩΜΟ** onSnapshot ΚΑΙ ΟΧΙ Ο firestoreQueryService
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανονικός αναγνώστης του repo *(ADR-361, φρουρός ισότητας περιεχομένου)* είναι ο
 * σωστός για **κάθε** επιφάνεια πίσω από τη σύνδεση. Εδώ είναι **δομικά αδύνατος**,
 * και μετρήθηκε μέσα στον ίδιο του τον κώδικα:
 *
 * - Το `subscribe()` καλεί `requireAuthContext()` **και** εφαρμόζει
 *   `buildTenantConstraints(key, ctx)` ⇒ φιλτράρει κατά `companyId`. Ο κατάλογος
 *   είναι **δια-οργανισμιακός** εξ ορισμού: ένα tenant φίλτρο θα επέστρεφε **μόνο το
 *   δικό σου γραφείο**, δηλαδή κατάλογο με ένα στοιχείο.
 * - Το `subscribeDoc()` κάνει `waitForAuthReady().then(hasUser => { if (!hasUser) return; … })`
 *   ⇒ για **ανώνυμο** επισκέπτη **δεν συνδρομεί ποτέ και δεν καλεί ποτέ το onData**:
 *   η σελίδα θα έμενε σε «Φόρτωση…» **για πάντα**, χωρίς σφάλμα και χωρίς ίχνος.
 *
 * ⚠️ Είναι ο **ίδιος** λόγος και το **ίδιο** ιδίωμα με το `usePublicListings` — ο
 * **τρίτος** καταναλωτής του δημόσιου προτύπου, όχι νέο πρότυπο. Το αρχείο δηλώνεται
 * στο `.shell-boundary.json` → `publicDataHooks`, που είναι η **δεύτερη, ανεξάρτητη**
 * ερώτηση του CHECK 3.63: *«τι κάνει μια επιφάνεια δημόσια; ο ΚΑΤΑΝΑΛΩΤΗΣ της.»*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΖΩΝΤΑΝΑ — ΚΑΙ ΕΚΕΙ ΞΕΠΕΡΝΑΜΕ ΚΑΘΕ ΚΑΤΑΛΟΓΟ ΠΟΥ ΜΕΤΡΗΘΗΚΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Rightmove, Houzz και idealista σερβίρουν σελίδες γραφείων από **κρυφή μνήμη**: όταν
 * ανακληθεί μια άδεια, η σελίδα εξακολουθεί να τη διαφημίζει μέχρι την επόμενη
 * ανασάρωση. Εδώ η ανάκληση της ικανότητας **σβήνει την προβολή** *(Π2, §9.13)* και ο
 * επισκέπτης που την κοιτά **αυτή τη στιγμή** τη βλέπει να φεύγει — χωρίς ανανέωση.
 * Δεν είναι επίδειξη: πλατφόρμα που δείχνει ανακληθέν γραφείο ως ενεργό **συμμετέχει**
 * στη μεσιτεία χωρίς εγγραφή, που ο Ν.4072/2012 κάνει παράνομη.
 */

import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { agencyDoorFor } from '@/lib/agency/agency-door';
import { orderAgencies } from '@/lib/agency/agency-directory-order';
import { readShowcase } from '@/lib/agency/showcase-read';
import type { PublicShowcase } from '@/types/agency-profile';

const logger = createModuleLogger('usePublicAgencies');

// ============================================================================
// 1. Ο ΚΑΤΑΛΟΓΟΣ — η σάρωση που το §9.4 επιτρέπει ΡΗΤΑ
// ============================================================================

export interface PublicAgenciesState {
  /** **Ήδη ταξινομημένες.** Δες παρακάτω γιατί η σειρά δεν ανήκει στην οθόνη. */
  readonly agencies: readonly PublicShowcase[];
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * **Όλες οι δημοσιευμένες βιτρίνες, ζωντανά και σε ουδέτερη σειρά.**
 *
 * 🔑 **Η ΣΑΡΩΣΗ ΕΠΙΤΡΕΠΕΤΑΙ ΕΠΕΙΔΗ Ο ΠΛΗΘΥΣΜΟΣ ΕΙΝΑΙ OPT-IN** (§9.4): κάθε εγγραφή
 * γράφτηκε με **ρητή, ανακλητή** πράξη του ίδιου του γραφείου. Το αδελφό
 * `workspace_aliases` **δεν** σαρώνεται ποτέ, γιατί εκεί κάθε χώρος έχει εγγραφή
 * **υποχρεωτικά** — δηλαδή η σάρωση θα ήταν **απογραφή μισθωτών** (Ε-5 §4 #1). Η
 * διαφορά δεν είναι στο σχήμα· είναι στο **ποιος έβαλε την εγγραφή εκεί**.
 *
 * ⚠️ **Η ταξινόμηση γίνεται ΕΔΩ, όχι στον καταναλωτή** — για τον ίδιο λόγο που η
 * λογιστική του `usePublicListings` υπολογίζεται στο hook: αν την έκανε ο
 * καταναλωτής, θα υπήρχε **μία σειρά ανά οθόνη**, και η ουδετερότητα του §9.9 α θα
 * ήταν υπόσχεση που κάποιος πρέπει να **θυμάται**. Εδώ είναι διαδρομή που **δεν
 * παρακάμπτεται**: η οθόνη δεν βλέπει ποτέ αταξινόμητο πίνακα.
 */
export function usePublicAgencies(): PublicAgenciesState {
  const [agencies, setAgencies] = useState<readonly PublicShowcase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // tenant-scope-exempt: το `agency_profiles` είναι δηλωμένο `published-projection`
    // στο `services/firestore/tenant-config.ts` (mode: none) — δημοσιευμένη βιτρίνα
    // οργανισμού, γραμμένη ΜΟΝΟ από τον διακομιστή, με read: if true. Δεν υπάρχει
    // companyId να φιλτραριστεί: το companyId ΕΙΝΑΙ το κλειδί και το περιεχόμενο.
    // Άγκυρα κανόνων: tests/firestore-rules/suites/agency-profiles.rules.test.ts
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.AGENCY_PROFILES),
      (snapshot) => {
        // 🔒 ADR-841 Φ6-Β — ΤΟ `as` ΕΓΙΝΕ ΦΡΟΥΡΟΣ. Με credentials, ένα έγγραφο
        //    ΧΩΡΙΣ καμία απόδειξη θα ζωγραφιζόταν ως κάρτα: ο κατάλογος που το
        //    §9.9 β ονομάζει «επικίνδυνο αντί για χρήσιμο». Παραλείπεται ΚΑΙ
        //    καταγράφεται — σιωπηλή παράλειψη θα ήταν «0 = κανείς δεν κοίταξε».
        const readable: PublicShowcase[] = [];
        for (const document of snapshot.docs) {
          const read = readShowcase(document.data(), document.id);
          if (read.outcome === 'showcase') readable.push(read.showcase);
          else logger.warn('Βιτρίνα χωρίς αναγνώσιμη απόδειξη — παραλείφθηκε', {
            data: { companyId: read.companyId },
          });
        }
        setAgencies(orderAgencies(readable));
        setLoading(false);
      },
      (err: Error) => {
        logger.error('Δεν φορτώθηκε ο κατάλογος γραφείων', { error: err.message });
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  return { agencies, loading, error };
}

// ============================================================================
// 2. Η ΜΙΑ ΒΙΤΡΙΝΑ — αδελφός, όχι φίλτρο πάνω στον κατάλογο
// ============================================================================

/**
 * **Τι ξέρουμε για τη μία βιτρίνα** — τέσσερις **ρητές** καταστάσεις.
 *
 * 🔴 Το `absent` **δεν είναι σφάλμα**: η συλλογή είναι **προβολή**, και ένα γραφείο
 * φεύγει από εκεί όταν αποσυρθεί **ή** όταν του ανακληθεί η ικανότητα (Π2). Δηλαδή
 * *«δεν υπάρχει»* σημαίνει *«δεν δημοσιεύεται»* — και ο επισκέπτης που έφτασε από
 * τυπωμένη κάρτα **δικαιούται** να το μάθει, αντί για «κάτι πήγε στραβά» που θα τον
 * έβαζε να ξαναδοκιμάζει κάτι που **δεν πρόκειται** να αλλάξει.
 *
 * ⚠️ **Ξεχωριστός τύπος από το `PublicShowcaseLookup`** των υπηρεσιών, και δεν είναι
 * διπλότυπο: εκείνο απαντά **εφάπαξ, στον διακομιστή** (`lookupAgencyProfile`, Admin
 * SDK) και **δεν έχει `loading`**, γιατί εκεί δεν υπάρχει «ακόμη δεν ξέρω». Κοινός
 * τύπος θα ανάγκαζε τον έναν από τους δύο να κουβαλά κατάσταση που δεν του συμβαίνει
 * ποτέ — ακριβώς το «δύο καταστάσεις μοιράζονται μία τιμή» του ADR-749.
 */
export type PublicAgencyLookup =
  | { readonly state: 'loading' }
  | { readonly state: 'found'; readonly showcase: PublicShowcase }
  | { readonly state: 'absent' }
  | { readonly state: 'error'; readonly message: string };

/**
 * **Η μία βιτρίνα, ζωντανά** — η ανάγνωση της σελίδας προφίλ.
 *
 * ⚠️ **Αδελφός, όχι φίλτρο πάνω στον κατάλογο**: ίδια συλλογή, ίδιο σχήμα, ίδιο
 * αρχείο — η **ίδια** πηγή ρωτημένη πιο στενά. Ένα `agencies.find(...)` θα ήταν σωστό
 * με δεκάδες γραφεία και **δομικά λάθος** με χιλιάδες: το άνοιγμα **μιας** κάρτας θα
 * κατέβαζε **όλες** τις άλλες.
 *
 * @param companyId Η ταυτότητα του οργανισμού, **ήδη λυμένη από το ψευδώνυμο στον
 * διακομιστή** (§9.6 #2). Το `null` σημαίνει *«το ψευδώνυμο δεν λύθηκε»* — και απαντά
 * **`absent`**, ταυτόσημα με *«λύθηκε αλλά δεν δημοσίευσε»*: η απουσία από την προβολή
 * οφείλει να είναι **αδιάκριτη** από την ανυπαρξία (§9.4), αλλιώς η σελίδα γίνεται
 * μαντείο *«υπάρχει τέτοιο γραφείο;»* — δηλαδή απαρίθμηση, ένα ερώτημα τη φορά.
 */
export function usePublicAgency(companyId: string | null): PublicAgencyLookup {
  const [lookup, setLookup] = useState<PublicAgencyLookup>({ state: 'loading' });

  useEffect(() => {
    const door = agencyDoorFor(companyId);
    if (door.kind === 'absent') {
      setLookup({ state: 'absent' });
      return;
    }

    setLookup({ state: 'loading' });

    // tenant-scope-exempt: δες το σχόλιο του usePublicAgencies παραπάνω. Ανάγνωση
    // ΕΝΟΣ εγγράφου κατά ταυτότητα — δεν υπάρχει ερώτημα να φιλτραριστεί.
    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.AGENCY_PROFILES, door.companyId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setLookup({ state: 'absent' });
          return;
        }
        const read = readShowcase(snapshot.data(), snapshot.id);
        if (read.outcome === 'showcase') {
          setLookup({ state: 'found', showcase: read.showcase });
          return;
        }
        // ⚠️ **ΑΝΑΓΝΩΣΤΟ ⇒ `absent`, ΟΧΙ `error`** — και η διάκριση είναι για τον
        //    ΑΝΘΡΩΠΟ, όχι για εμάς: το «error» τον βάζει να **ξαναδοκιμάσει** κάτι
        //    που **δεν πρόκειται** να αλλάξει μόνο του. Προς τα έξω είναι απουσία·
        //    προς τα μέσα καταγράφεται ως βλάβη, γιατί **είναι** βλάβη.
        logger.error('Βιτρίνα χωρίς αναγνώσιμη απόδειξη', {
          data: { companyId: read.companyId },
        });
        setLookup({ state: 'absent' });
      },
      (err: Error) => {
        logger.error('Δεν φορτώθηκε η βιτρίνα γραφείου', {
          data: { companyId },
          error: err.message,
        });
        setLookup({ state: 'error', message: err.message });
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  return lookup;
}
