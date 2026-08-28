'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** — φόρτωση, πράξη, ξαναφόρτωση.
 * @related ADR-777 §8.34 · services/mandate/mandate-catalog.client.ts
 * @module hooks/mandate/useMandateCatalog
 *
 * 🔴 **ΜΕΤΑ ΑΠΟ ΚΑΘΕ ΠΡΑΞΗ, ΞΑΝΑΦΟΡΤΩΝΕΙ — ΔΕΝ «ΔΙΟΡΘΩΝΕΙ» ΤΗ ΓΡΑΜΜΗ ΤΟΠΙΚΑ.**
 * Ένα αισιόδοξο `standing: 'awaiting-view'` μετά το «ξαναστείλτε» θα ήταν **τρίτος
 * ταξινομητής** (μετά τον διακομιστή και τον κοινό κριτή) — και θα απέκλινε την πρώτη
 * φορά που κάποιος άλλαζε τον κανόνα σε ένα από τα δύο άλλα σημεία. Το κόστος είναι
 * μία ανάγνωση· το όφελος είναι ότι υπάρχει **μία** αλήθεια για το τι βλέπει ο μεσίτης.
 *
 * ⚠️ **Η γραμμή που δουλεύει ονομάζεται** ({@link MandateCatalogState.busyId}), ώστε η
 * οθόνη να κλειδώνει **μόνο** τα δικά της κουμπιά. Ένα καθολικό «φορτώνει» θα πάγωνε
 * ολόκληρο τον κατάλογο επειδή μία γραμμή στέλνει email.
 */

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';

import {
  fetchMandateCatalog,
  runMandateAction,
  type ActionResult,
} from '@/services/mandate/mandate-catalog.client';
import type { MandateAction } from '@/lib/mandate/mandate-actions';
import {
  PRESENCE_LIFECYCLE,
  type PresenceAction,
} from '@/lib/owner-property/listing-presence';
import { setOwnerListingLifecycle } from '@/services/owner-property/owner-property.service';
import type { MandateCatalog } from '@/services/mandate/mandate-catalog.service';

/**
 * Το αποτέλεσμα μιας πράξης **παρουσίας** (ADR-777 §8.39).
 *
 * ⚠️ **Δικό του σχήμα και όχι `ActionResult`**: εκείνο κουβαλά `MandateActionRejection`
 * (`declined`·`expired`·`not-pending`), λεξιλόγιο της **πρόσκλησης**. Η απόσυρση δεν
 * μπορεί να αρνηθεί για κανέναν από αυτούς τους λόγους — δανεικό λεξιλόγιο θα
 * υποσχόταν αρνήσεις που δεν συμβαίνουν.
 */
export type PresenceResult =
  | { readonly kind: 'presence-done'; readonly action: PresenceAction }
  | { readonly kind: 'presence-failed' };

/** Το αποτέλεσμα της **τελευταίας** πράξης, όπως το δείχνει η οθόνη. */
export interface CatalogFeedback {
  readonly ownerPropertyId: string;
  readonly result: ActionResult | PresenceResult;
}

export type MandateCatalogState =
  | { readonly state: 'loading' }
  | { readonly state: 'failed' }
  | {
      readonly state: 'ready';
      readonly catalog: MandateCatalog;
      readonly busyId: string | null;
      readonly feedback: CatalogFeedback | null;
    };

export interface MandateCatalogApi {
  readonly view: MandateCatalogState;
  readonly reload: () => void;
  readonly act: (ownerPropertyId: string, action: MandateAction) => void;
  /** ADR-777 §8.39 — «κατέβασέ το» / «ανέβασέ το», για αγγελία **του γραφείου**. */
  readonly setPresence: (ownerPropertyId: string, action: PresenceAction) => void;
}

export function useMandateCatalog(): MandateCatalogApi {
  const [catalog, setCatalog] = useState<MandateCatalog | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CatalogFeedback | null>(null);
  const [epoch, setEpoch] = useState(0);

  // 🔴 **ΠΕΡΙΜΕΝΕ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΠΡΙΝ ΡΩΤΗΣΕΙΣ** — μετρημένο ζωντανά, 2026-08-28.
  //
  // Χωρίς αυτό η οθόνη έγραφε **πάντα** «Οι εντολές δεν φορτώθηκαν» στο πρώτο άνοιγμα,
  // και δούλευε **μόνο** αν πατούσες «Δοκιμάστε ξανά». Η μέτρηση: στη φόρτωση, **0 από
  // 251** αιτήματα πήγαιναν στο `/api/owner-properties/brokered` — δηλαδή η αστοχία
  // συνέβαινε **πριν** από κάθε δίκτυο. Ο `apiClient` πετά συγχρόνως `401` όταν ο
  // `auth.currentUser` είναι ακόμη `null` (`enterprise-api-client.ts` → `getIdToken`),
  // και το `onAuthStateChanged` του πελάτη απλώς **καταγράφει** τον χρήστη αργότερα:
  // δεν ξαναζητά τίποτα. Άρα η πρώτη — και μοναδική — προσπάθεια χανόταν πάντα.
  //
  // ⚠️ **Το «περίμενε» δεν είναι εδώ επειδή είναι ευγενικό, αλλά επειδή αλλιώς η οθόνη
  // ΨΕΥΔΕΤΑΙ**: έλεγε «δεν φορτώθηκαν» ενώ ο διακομιστής δεν ρωτήθηκε ποτέ, και ο
  // μεσίτης θα συμπέραινε ότι έχει πρόβλημα ο κατάλογός του.
  //
  // 🔑 **Το ιδίωμα υπάρχει ήδη** (`useInboxApi`: *«Only fetch when user is
  // authenticated»*) — δεν γεννιέται νέος μηχανισμός αναμονής.
  const { user, loading: authLoading } = useAuth();
  // ⚠️ **Πρωτογενής εξάρτηση, όχι το αντικείμενο**: το `user` του context
  // ανακατασκευάζεται και θα ξανάτρεχε το effect σε κάθε απόδοση — δηλαδή θα
  // ξαναδιάβαζε τον κατάλογο σε βρόχο.
  const userId = user?.uid ?? null;

  useEffect(() => {
    // Όσο δεν ξέρουμε **ποιος** ρωτά, η οθόνη μένει «φορτώνει» — που είναι η αλήθεια.
    if (authLoading) return;

    let alive = true;
    setCatalog(null);
    setLoadFailed(false);

    // Λύθηκε η ταυτότητα και **δεν υπάρχει κανείς**: ο κατάλογος είναι αδύνατος. Αυτό
    // λέγεται, δεν σιωπά — αλλιώς η οθόνη θα γύριζε για πάντα (`useInboxApi`, ίδια
    // απόφαση: *«User not authenticated - clear loading and set error»*).
    if (userId === null) {
      setLoadFailed(true);
      return;
    }

    void fetchMandateCatalog().then((load) => {
      if (!alive) return;
      if (load.kind === 'ready') setCatalog(load.catalog);
      else setLoadFailed(true);
    });

    return () => {
      alive = false;
    };
  }, [epoch, authLoading, userId]);

  const reload = useCallback(() => setEpoch((value) => value + 1), []);

  const act = useCallback(
    (ownerPropertyId: string, action: MandateAction) => {
      setBusyId(ownerPropertyId);
      setFeedback(null);

      void runMandateAction(ownerPropertyId, action).then((result) => {
        setBusyId(null);
        setFeedback({ ownerPropertyId, result });
        // ⚠️ Ξαναφόρτωση **μόνο** σε επιτυχία: μια απόρριψη δεν άλλαξε τίποτα στη βάση,
        // και μια περιττή ανάγνωση θα έσβηνε το μήνυμα προτού προλάβει να διαβαστεί.
        if (result.kind === 'done') reload();
      });
    },
    [reload],
  );

  const setPresence = useCallback(
    (ownerPropertyId: string, action: PresenceAction) => {
      setBusyId(ownerPropertyId);
      setFeedback(null);

      // 🔑 ΚΑΜΙΑ ΝΕΑ ΔΙΑΔΡΟΜΗ ΚΑΙ ΚΑΝΕΝΑΣ ΝΕΟΣ ΠΕΛΑΤΗΣ: το `setOwnerListingLifecycle`
      // υπάρχει από την οθόνη του ιδιώτη και χτυπά **την ίδια** πύλη. Ό,τι άλλαξε είναι
      // ότι η πύλη κρίνει πλέον **χώρο** (`mayAdminister`) και όχι μόνο συγγραφέα, άρα
      // ο συνάδελφος περνά. Δεύτερος πελάτης θα ήταν δεύτερη αλήθεια (ADR-749).
      void setOwnerListingLifecycle(ownerPropertyId, PRESENCE_LIFECYCLE[action]).then((result) => {
        setBusyId(null);
        const ok = result.kind === 'saved';
        setFeedback({
          ownerPropertyId,
          result: ok ? { kind: 'presence-done', action } : { kind: 'presence-failed' },
        });
        if (ok) reload();
      });
    },
    [reload],
  );

  if (loadFailed) return { view: { state: 'failed' }, reload, act, setPresence };
  if (catalog === null) return { view: { state: 'loading' }, reload, act, setPresence };
  return { view: { state: 'ready', catalog, busyId, feedback }, reload, act, setPresence };
}
