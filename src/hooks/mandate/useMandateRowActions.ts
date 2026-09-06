'use client';

/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΠΑΝΩ ΣΕ ΜΙΑ ΕΝΤΟΛΗ** — μία φορά, για δύο οθόνες.
 * @related ADR-841 §7 Α18.12.ζ (E2) · ADR-777 §8.34 · §8.39
 * @module hooks/mandate/useMandateRowActions
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ — Ο ΔΕΥΤΕΡΟΣ ΚΑΤΑΝΑΛΩΤΗΣ ΓΕΝΝΗΘΗΚΕ, ΚΑΙ ΤΟ ΔΙΔΥΜΟ ΑΠΟΦΕΥΧΘΗΚΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι τέσσερις τιμές — `busyId` · `feedback` · `act` · `setPresence` — ζούσαν μέσα στον
 * {@link useMandateCatalog}. Ήταν σωστό όσο υπήρχε **μία** οθόνη· και οι τέσσερις όμως
 * ήταν **ήδη ανά `ownerPropertyId`**, δηλαδή ουδέτερες ως προς το αν πίσω τους στέκεται
 * κατάλογος ή **μία** εντολή.
 *
 * Η **Α18.12** έδωσε στην εντολή δική της οθόνη. Αντιγραφή αυτών των ~40 γραμμών εκεί θα
 * ήταν **ακριβώς** ο κλώνος-αδελφός που ο κανόνας N.18 περιγράφει: *«κεντρικοποιείς το Α,
 * γράφεις Β ως δίδυμο»* — και το `jscpd` τον πιάνει **ανεξάρτητα ονόματος**.
 *
 * ⛔ **ΜΗΝ προσθέσεις εδώ φόρτωση δεδομένων.** Αυτό το hook **δεν ξέρει** τι δείχνει η
 * οθόνη· ξέρει μόνο *«κάνε αυτή την πράξη σε αυτή την εντολή, και ξαναρώτα μετά»*. Το
 * *«ξαναρώτα»* το δίνει ο καλών ({@link reload}), γιατί μόνο εκείνος ξέρει **τι** πρέπει
 * να ξαναδιαβαστεί: ολόκληρος ο κατάλογος, ή το ένα έγγραφο.
 *
 * 🔴 **ΜΕΤΑ ΑΠΟ ΚΑΘΕ ΠΡΑΞΗ, ΞΑΝΑΦΟΡΤΩΝΕΙ — ΔΕΝ «ΔΙΟΡΘΩΝΕΙ» ΤΗ ΓΡΑΜΜΗ ΤΟΠΙΚΑ.**
 * Ένα αισιόδοξο `standing: 'awaiting-view'` μετά το «ξαναστείλτε» θα ήταν **τρίτος
 * ταξινομητής** (μετά τον διακομιστή και τον κοινό κριτή) — και θα απέκλινε την πρώτη
 * φορά που κάποιος άλλαζε τον κανόνα σε ένα από τα δύο άλλα σημεία. Το κόστος είναι
 * μία ανάγνωση· το όφελος είναι ότι υπάρχει **μία** αλήθεια για το τι βλέπει ο μεσίτης.
 *
 * ⚠️ **Η γραμμή που δουλεύει ονομάζεται** ({@link MandateRowActions.busyId}), ώστε η
 * οθόνη να κλειδώνει **μόνο** τα δικά της κουμπιά. Ένα καθολικό «φορτώνει» θα πάγωνε
 * ολόκληρο τον κατάλογο επειδή μία γραμμή στέλνει email.
 */

import { useCallback, useState } from 'react';

import type { MandateAction } from '@/lib/mandate/mandate-actions';
import {
  PRESENCE_LIFECYCLE,
  type PresenceAction,
} from '@/lib/owner-property/listing-presence';
import { runMandateAction, type ActionResult } from '@/services/mandate/mandate-catalog.client';
import { setOwnerListingLifecycle } from '@/services/owner-property/owner-property.service';

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

export interface MandateRowActions {
  /** Ποια **γραμμή** δουλεύει τώρα — ποτέ καθολική σημαία. */
  readonly busyId: string | null;
  /** Το αποτέλεσμα της **τελευταίας** πράξης, ή `null` αν δεν έγινε καμία. */
  readonly feedback: CatalogFeedback | null;
  readonly act: (ownerPropertyId: string, action: MandateAction) => void;
  /** ADR-777 §8.39 — «κατέβασέ το» / «ανέβασέ το», για αγγελία **του γραφείου**. */
  readonly setPresence: (ownerPropertyId: string, action: PresenceAction) => void;
}

/**
 * **Οι πράξεις πάνω σε μια εντολή**, ανεξάρτητα από το τι τις περιβάλλει.
 *
 * @param reload — τι σημαίνει *«ξαναρώτα»* για **αυτόν** τον καλούντα. ⚠️ Πρέπει να
 *   είναι **σταθερή** (`useCallback`): αλλιώς οι δύο επιστρεφόμενοι χειριστές
 *   ανακατασκευάζονται σε κάθε απόδοση και κάθε `memo` από κάτω τους σπάει.
 */
export function useMandateRowActions(reload: () => void): MandateRowActions {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CatalogFeedback | null>(null);

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

  return { busyId, feedback, act, setPresence };
}
