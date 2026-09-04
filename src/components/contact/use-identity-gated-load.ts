'use client';

/**
 * @fileoverview **ΜΙΑ ΦΟΡΤΩΣΗ ΠΟΥ ΠΕΡΙΜΕΝΕΙ ΤΑΥΤΟΤΗΤΑ** — ο κοινός σκελετός των δύο όψεων.
 * @related components/contact/MyContactsContent.tsx · ContactInboxContent.tsx · ADR-843 §10
 * @module components/contact/use-identity-gated-load
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΟ ΕΠΙΑΣΕ ΠΥΛΗ, ΟΧΙ ΑΝΑΓΝΩΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τα `useMyContactsLoad` και `useContactInboxLoad` γεννήθηκαν **ταυτόσημα** — 19 + 12
 * γραμμές, 192 tokens — και διέφεραν σε **ένα** πράγμα: ποια συνάρτηση ρωτά. Το
 * **CHECK 3.28** (jscpd, ADR-584) τα μπλόκαρε **μέσα στο ίδιο commit**, που είναι
 * ακριβώς ο λόγος ύπαρξής του: το `ssot:discover` είναι name/regex-based και **δεν θα
 * τα έβλεπε ποτέ** — έχουν διαφορετικά ονόματα.
 *
 * ⚠️ **Η ΠΑΓΙΔΑ ΤΟΥ N.0.2, ΓΡΑΜΜΕΝΗ**: το κλασικό λάθος είναι να κεντρικοποιείς το Α και
 * να γράφεις το Β ως δίδυμο. Εδώ γεννήθηκαν **και τα δύο** μαζί, δηλαδή κανείς δεν
 * αντέγραψε — απλώς **κανείς δεν ρώτησε «πού ανήκει αυτό;»** πριν το γράψει δεύτερη φορά.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΑΚΡΙΒΩΣ ΦΥΛΑΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Όσο δεν ξέρουμε ποιος ρωτά, η οθόνη μένει «φορτώνει» — που είναι η αλήθεια.** Δεν
 * είναι διακοσμητικό: χωρίς αυτό, ο άνθρωπος που ανανεώνει τη σελίδα βλέπει «απέτυχε»
 * για ένα κλάσμα, επειδή ο `useAuth` δεν έχει αποφασίσει ακόμη. Η άρνηση έρχεται **μόνο**
 * όταν η ταυτότητα έχει κριθεί και είναι `null`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';

/**
 * Η κατάσταση της οθόνης: ό,τι επιστρέφει ο μεταφορέας, **συν** τα δύο που γεννιούνται
 * εδώ. Διακριτή ένωση — ποτέ `boolean` + μήνυμα (N.7.2 #3).
 */
export type GatedLoad<TLoad> =
  | TLoad
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' };

export interface GatedLoadResult<TLoad> {
  readonly load: GatedLoad<TLoad>;
  /** Ξαναρωτά από την αρχή — **ΠΟΤΕ** τοπική διόρθωση της γραμμής. */
  readonly reload: () => void;
}

export function useIdentityGatedLoad<TLoad>(
  fetchOnce: () => Promise<TLoad>,
): GatedLoadResult<TLoad> {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid ?? null;
  const [load, setLoad] = useState<GatedLoad<TLoad>>({ kind: 'loading' });
  const [epoch, setEpoch] = useState(0);

  /**
   * ⚠️ **Ο μεταφορέας μπαίνει σε `ref`, ΟΧΙ στις εξαρτήσεις.** Και οι δύο σημερινοί
   * καλούντες περνούν σταθερή αναφορά module-επιπέδου, αλλά ένα **μελλοντικό** inline
   * `() => fetchX(id)` θα άλλαζε ταυτότητα σε κάθε render και θα γινόταν **ατέρμονος
   * βρόχος φόρτωσης**. Το `ref` κάνει αυτή την αστοχία **δομικά αδύνατη** αντί να την
   * αφήνει στην προσοχή του επόμενου.
   */
  const fetchRef = useRef(fetchOnce);
  fetchRef.current = fetchOnce;

  useEffect(() => {
    // Όσο δεν ξέρουμε ποιος ρωτά, η οθόνη μένει «φορτώνει» — που είναι η αλήθεια.
    if (authLoading) return;

    let alive = true;
    setLoad({ kind: 'loading' });

    if (userId === null) {
      setLoad({ kind: 'failed' });
      return;
    }

    void fetchRef.current().then((result) => {
      if (alive) setLoad(result);
    });

    return () => {
      alive = false;
    };
  }, [authLoading, userId, epoch]);

  const reload = useCallback(() => setEpoch((value) => value + 1), []);
  return { load, reload };
}
