'use client';

/**
 * @fileoverview **Η ΑΝΑΓΝΩΣΗ ΤΟΥ ΕΠΙΠΕΔΟΥ Β** — «τα δικά μου», ζωντανά, μία φορά γραμμένη.
 * @related ADR-777 §7 (Α9 · Α12 · Α14) · CHECK 3.35 · services/firestore/tenant-config.ts
 * @module services/realtime/hooks/useOwnedDocuments
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ: **ΔΥΟ ΣΥΛΛΟΓΕΣ ΜΕ ΤΟ ΙΔΙΟ ΕΡΩΤΗΜΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `property_demands` (Α9) και το `owner_properties` (Α14) είναι **και τα δύο**
 * `mode: 'userId'` στο `tenant-config.ts`: «ζητώ» και «προσφέρω», ιδιωτικά ανά
 * **άνθρωπο**. Η ανάγνωσή τους είναι **ταυτόσημη** — φίλτρο στο πεδίο κατόχου,
 * `onSnapshot`, τέσσερις καταστάσεις — και μια δεύτερη γραφή θα ήταν κλώνος που
 * μπλοκάρει το **CHECK 3.28**. Ο κανόνας **N.0.2** ζητά το SSoT **πριν** το δεύτερο
 * αντίγραφο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ `where(<πεδίο κατόχου>)` ΔΕΝ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ερώτημα χωρίς τον όρο **μπλοκάρεται από τη CHECK 3.35**, και αυτό είναι το
 * ζητούμενο: η πύλη γεννήθηκε επειδή το `getAllContacts` έστελνε **αφιλτράριστη**
 * λίστα επί μήνες με **όλες** τις προηγούμενες πύλες πράσινες.
 *
 * ⚠️ **Και ο κανόνας Firestore ΔΕΝ είναι φίλτρο.** Ένα ερώτημα «φέρε τα όλα»
 * **αποτυγχάνει ολόκληρο** — δεν επιστρέφει τα δικά μου. Χωρίς τον όρο, η οθόνη θα
 * έδειχνε **σφάλμα** που μοιάζει με «δεν έχεις τίποτα», και ο άνθρωπος θα ξανάγραφε
 * ό,τι είχε ήδη γράψει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ `query()` ΔΕΝ ΖΕΙ ΕΔΩ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΠΡΟΤΙΜΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πρώτη γραφή έχτιζε το ερώτημα **εδώ**, από `collectionName`/`ownerField` του
 * `spec`. Ήταν σωστός κώδικας που **καμία πύλη δεν μπορούσε να κρίνει**:
 *
 * - Η **CHECK 3.35** (AST) απάντησε κατά λέξη `unanalyzable — η συλλογή δεν
 *   προκύπτει στατικά`: το `collection(db, collectionName)` με **παράμετρο** δεν
 *   λύνεται σε κλειδί, άρα δεν υπάρχει `tenantMode` να ελεγχθεί.
 * - Η **CHECK 3.10** (grep 12 γραμμών) το είδε ως **αφιλτράριστο** — σωστά: το μπλοκ
 *   δεν ονόμαζε ούτε `COLLECTIONS.*` ούτε πεδίο.
 * - Και οι δύο καλούντες, που **ονομάζουν** και τα δύο, δεν είχαν `query(` ⇒ **καμία
 *   πύλη δεν τους ρωτούσε καν** (μετρημένο: `scanFile` επιστρέφει `[]`).
 *
 * Δηλαδή η κεντρικοποίηση μετακίνησε την κρίση σε σημείο όπου **κανείς δεν κοιτάζει**
 * — το ίδιο σχήμα που γέννησε τη CHECK 3.35, γραμμένο από την **αντίθετη** μεριά.
 *
 * 🔑 **Η μηχανή απαντά «πώς ακούω ζωντανά»· ο καλών απαντά «τι ρωτάω».** Το ερώτημα
 * είναι **ταυτότητα του τομέα**, όχι μεταφορά: ζει δίπλα στο `COLLECTIONS.*` και το
 * `FIELDS.*` που το ορίζουν, όπου **και οι δύο** πύλες το βλέπουν στατικά. Ο μηχανισμός
 * — τέσσερις καταστάσεις, `onSnapshot`, καθαρισμός, μετάφραση σφάλματος — μένει **ένας**.
 *
 * ⚠️ **ΜΗΝ ξαναφέρεις το `query()` εδώ** «για να μη χρειάζεται ο καλών να ξέρει
 * Firestore»: αυτό ακριβώς ήταν το πρώτο σχέδιο, και το τίμημα δεν είναι στυλ — είναι
 * ότι η απομόνωση της Α9/Α14 παύει να έχει κριτή.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot, type Query } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useOwnedDocuments');

// =============================================================================
// 1. ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ
// =============================================================================

/**
 * Τι ξέρουμε για τον κατάλογο. **Τέσσερις** ρητές καταστάσεις.
 *
 * 🔑 **Το `anonymous` είναι ΞΕΧΩΡΙΣΤΟ από το `loading`, και είναι το σημείο.** Ο
 * ανώνυμος επισκέπτης δεν «φορτώνει ακόμη» — **δεν πρόκειται** να φορτώσει τίποτα, και
 * μια αιώνια ροδέλα θα ήταν **ψέμα με κίνηση**.
 */
export type OwnedListState<T> =
  | { readonly state: 'anonymous' }
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly items: readonly T[] }
  | { readonly state: 'error'; readonly message: string };

/**
 * Τι ξέρουμε για **ένα** έγγραφο. **Πέντε** ρητές καταστάσεις.
 *
 * 🔑 **Το `absent` δεν είναι σφάλμα.** Μια ταυτότητα που δεν υπάρχει σημαίνει είτε
 * λάθος σύνδεσμος είτε — και είναι το ενδιαφέρον — **έγγραφο άλλου ανθρώπου**: ο
 * κανόνας Firestore δεν επιστρέφει «απαγορεύεται», επιστρέφει **τίποτα**. Και οι δύο
 * περιπτώσεις είναι «δεν υπάρχει **για σένα**», που είναι ακριβώς η αλήθεια που
 * επιτρέπεται να ειπωθεί: ένα «δεν έχεις δικαίωμα» θα **επιβεβαίωνε** την ύπαρξη,
 * δηλαδή θα διέρρεε το επίπεδο Β με άρνηση.
 */
export type OwnedDocumentState<T> =
  | { readonly state: 'anonymous' }
  | { readonly state: 'loading' }
  | { readonly state: 'found'; readonly item: T }
  | { readonly state: 'absent' }
  | { readonly state: 'error'; readonly message: string };

/** Πού ζει το «δικό μου» — η συλλογή + το **ερώτημα** που ονομάζει τον κάτοχο. */
export interface OwnedCollectionSpec {
  /** Το όνομα της συλλογής, από το `COLLECTIONS.*` — για την ανάγνωση **ενός** εγγράφου. */
  readonly collectionName: string;
  /**
   * Χτίζει το ερώτημα «τα δικά μου» — με το `where(<πεδίο κατόχου>)` **υποχρεωτικά**.
   *
   * ⚠️ **Σταθερά επιπέδου module, ΠΟΤΕ inline στο component.** Η αναφορά μπαίνει στις
   * εξαρτήσεις του `useEffect`: μια νέα συνάρτηση σε κάθε render ξαναγράφεται σε κάθε
   * render, δηλαδή **ξεγράφεται και ξαναγράφεται η συνδρομή** σε βρόχο.
   */
  readonly buildQuery: (userId: string) => Query;
  /** Τι φορτώνεται, για τα μηνύματα καταγραφής. */
  readonly label: string;
}

// =============================================================================
// 2. Ο ΚΑΤΑΛΟΓΟΣ
// =============================================================================

/** **Τα δικά μου**, ζωντανά. */
export function useOwnedList<T>(
  spec: OwnedCollectionSpec,
  userId: string | null,
): OwnedListState<T> {
  const [state, setState] = useState<OwnedListState<T>>(
    userId === null ? { state: 'anonymous' } : { state: 'loading' },
  );
  const { buildQuery, label } = spec;

  useEffect(() => {
    if (userId === null) {
      setState({ state: 'anonymous' });
      return;
    }

    setState({ state: 'loading' });

    const unsubscribe = onSnapshot(
      buildQuery(userId),
      (snapshot) => {
        setState({
          state: 'ready',
          items: snapshot.docs.map((entry) => entry.data() as T),
        });
      },
      (error: Error) => {
        logger.error(`Δεν φορτώθηκαν: ${label}`, { error: error.message });
        setState({ state: 'error', message: error.message });
      },
    );

    return () => unsubscribe();
  }, [buildQuery, label, userId]);

  return state;
}

// =============================================================================
// 3. ΤΟ ΕΝΑ ΕΓΓΡΑΦΟ — αδελφός, όχι φίλτρο
// =============================================================================

/**
 * **Ένα** δικό μου έγγραφο, ζωντανά.
 *
 * 🔑 **Αδελφός του καταλόγου, όχι φίλτρο πάνω του**: ίδια συλλογή, ίδιο σχήμα, πιο
 * στενή ερώτηση. Ένα `find()` πάνω στον κατάλογο θα υποχρέωνε τη σελίδα λεπτομέρειας
 * να κατεβάσει **όλα** τα έγγραφα του ανθρώπου για να δείξει ένα.
 */
export function useOwnedDocument<T>(
  spec: OwnedCollectionSpec,
  documentId: string,
  userId: string | null,
): OwnedDocumentState<T> {
  const [lookup, setLookup] = useState<OwnedDocumentState<T>>({ state: 'loading' });
  const { collectionName, label } = spec;

  useEffect(() => {
    if (userId === null) {
      setLookup({ state: 'anonymous' });
      return;
    }
    // ⚠️ Κενή ταυτότητα ⇒ το `doc()` **πετά**. Η άμυνα είναι φθηνή και η εναλλακτική
    // είναι λευκή οθόνη από εξαίρεση μέσα σε effect.
    if (documentId.trim() === '') {
      setLookup({ state: 'absent' });
      return;
    }

    setLookup({ state: 'loading' });

    // tenant-scope-exempt: ανάγνωση **ενός** εγγράφου κατά ταυτότητα — δεν υπάρχει
    // ερώτημα να φιλτραριστεί. Η απομόνωση επιβάλλεται από τον ίδιο τον κανόνα
    // (`resource.data.<ownerField> == request.auth.uid`), που για έγγραφο άλλου
    // ανθρώπου απαντά **άρνηση** και όχι δεδομένα.
    const unsubscribe = onSnapshot(
      doc(db, collectionName, documentId),
      (snapshot) => {
        setLookup(
          snapshot.exists()
            ? { state: 'found', item: snapshot.data() as T }
            : { state: 'absent' },
        );
      },
      (error: Error) => {
        // 🔑 Η άρνηση του κανόνα φτάνει **εδώ**, όχι στο `absent`. Και μεταφράζεται σε
        // `absent`: μια άρνηση που λέγεται «απαγορεύεται» **επιβεβαιώνει** την ύπαρξη,
        // δηλαδή διαρρέει το επίπεδο Β μέσω του μηνύματος λάθους.
        if (error.message.includes('permission')) {
          setLookup({ state: 'absent' });
          return;
        }
        logger.error(`Δεν φορτώθηκε: ${label}`, {
          data: { documentId },
          error: error.message,
        });
        setLookup({ state: 'error', message: error.message });
      },
    );

    return () => unsubscribe();
  }, [collectionName, label, documentId, userId]);

  return lookup;
}
