'use client';

/**
 * @fileoverview **Η μνήμη του προσχεδίου, δεμένη στον κύκλο ζωής της φόρμας.**
 * @related ADR-660 §5.10 · lib/owner-property/owner-property-draft-memory.ts
 * @module hooks/owner-property/useOwnerPropertyDraftMemory
 *
 * 🔑 **Καμία πολιτική εδώ.** Το *τι* θυμόμαστε, *πώς* επικυρώνεται και *πότε*
 * απορρίπτεται ζει στο leaf module. Εδώ ζει **μόνο** ό,τι είναι πραγματικά React:
 * πότε διαβάζεται (μία φορά, στο πρώτο render) και ποιος κρατά την «είδα την
 * ειδοποίηση» κατάσταση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΝΑΓΝΩΣΗ ΓΙΝΕΤΑΙ ΣΥΓΧΡΟΝΑ, ΣΤΟ ΠΡΩΤΟ RENDER — ΚΑΙ ΕΙΝΑΙ ΑΣΦΑΛΕΣ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα `localStorage` διαβασμένο στο render θα ήταν κανονικά **σφάλμα ενυδάτωσης**: ο
 * διακομιστής δεν έχει `window`, οπότε θα ζωγράφιζε άλλο δέντρο από τον πελάτη.
 * Εδώ **δεν ισχύει**, και ο λόγος είναι δομικός: η φόρμα φορτώνεται με `ssr: false`
 * ({@link OwnerPropertyCreationGate}) ⇒ **δεν αποδίδεται ποτέ στον διακομιστή**.
 *
 * ⚠️ **Και γι' αυτό ΔΕΝ γίνεται σε `useEffect`**: το `draftId` και τα `defaultValues`
 * του `react-hook-form` διαβάζονται **μία φορά, στο πρώτο render**. Επαναφορά ένα
 * καρέ αργότερα θα απαιτούσε `form.reset()` — δηλαδή η φόρμα θα ζωγράφιζε πρώτα άδεια
 * και μετά θα «πηδούσε», και το `draftId` θα είχε **ήδη κοπεί καινούργιο**.
 *
 * ⚠️ **ΜΗΝ το μεταφέρεις σε component που αποδίδεται στον διακομιστή** χωρίς να
 * γυρίσεις την ανάγνωση σε effect — αλλιώς είναι σφάλμα ενυδάτωσης που εμφανίζεται
 * μόνο σε παραγωγή.
 */

import React from 'react';

import {
  forgetOwnerPropertyDraft,
  recallOwnerPropertyDraft,
  rememberOwnerPropertyDraft,
  type RememberedOwnerPropertyDraft,
} from '@/lib/owner-property/owner-property-draft-memory';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';

export interface OwnerPropertyDraftMemory {
  /** Ό,τι βρέθηκε στο **πρώτο** render — σταθερό για όλη τη ζωή της φόρμας. */
  readonly restored: RememberedOwnerPropertyDraft | null;
  /** Λέγεται στον άνθρωπο ότι επαναφέρθηκε κάτι· κρύβεται μόλις το αποδεχτεί ή το ρίξει. */
  readonly noticeVisible: boolean;
  /** Κρύβει την ειδοποίηση **χωρίς** να σβήσει τίποτα. */
  readonly acknowledge: () => void;
  /** Γράφει το τρέχον προσχέδιο. Ασφαλές να κληθεί σε κάθε πληκτρολόγηση. */
  readonly remember: (draftId: string, values: OwnerPropertyFormValues) => void;
  /** Σβήνει το αποθηκευμένο — υποβολή που πέτυχε, ή ρητή απόρριψη. */
  readonly forget: () => void;
}

/**
 * ⚠️ **Στην ΕΠΕΞΕΡΓΑΣΙΑ δεν θυμάται τίποτα, και δεν είναι παράλειψη**: εκείνη η οθόνη
 * έχει ήδη **αποθηκευμένη** αγγελία με δικό της `id`. Ένα προσχέδιο περιηγητή από
 * άλλη συνεδρία που «επαναφερόταν» πάνω σε υπάρχουσα αγγελία θα αντικαθιστούσε
 * **δημοσιευμένα** δεδομένα με ημιτελή, σιωπηλά.
 */
export function useOwnerPropertyDraftMemory(
  editingId: string | null,
): OwnerPropertyDraftMemory {
  const [restored] = React.useState<RememberedOwnerPropertyDraft | null>(() =>
    editingId === null ? recallOwnerPropertyDraft() : null,
  );
  const [acknowledged, setAcknowledged] = React.useState(false);

  /**
   * 🔴 **Η ΛΗΘΗ ΕΙΝΑΙ ΤΕΛΙΚΗ — ΚΑΙ ΧΩΡΙΣ ΑΥΤΟ ΤΟ ΠΡΟΣΧΕΔΙΟ ΑΝΑΣΤΑΙΝΟΤΑΝ.**
   *
   * Το `forget()` αλλάζει κατάσταση ⇒ **νέα απόδοση** ⇒ το effect που αποθηκεύει
   * ξανατρέχει ⇒ **ξαναγράφει ό,τι μόλις σβήστηκε**. Στην επιτυχή υποβολή αυτό
   * σημαίνει ότι η επόμενη επίσκεψη θα έλεγε «επαναφέραμε το προσχέδιό σου» πάνω σε
   * αγγελία που **δημοσιεύτηκε** — ακριβώς η βλάβη που το leaf module υπόσχεται ότι
   * δεν συμβαίνει.
   *
   * ⚠️ **`useRef`, ΟΧΙ `useState`**: η σφραγίδα πρέπει να ισχύει **μέσα στην ίδια
   * απόδοση** που την έθεσε. Ένα `useState` γίνεται ορατό μόνο στην **επόμενη**, άρα
   * το effect αυτής της απόδοσης θα προλάβαινε να γράψει.
   *
   * ⚠️ **Ένας μηχανισμός, όχι φρουρός στον καλούντα**: το εναλλακτικό —«μην καλείς
   * `remember` μετά την υποβολή»— είναι κανόνας που ο **επόμενος** καλών πρέπει να
   * θυμάται, και δεν τον επιβάλλει τίποτα.
   */
  const sealed = React.useRef(false);

  const acknowledge = React.useCallback(() => setAcknowledged(true), []);

  const remember = React.useCallback(
    (draftId: string, values: OwnerPropertyFormValues) => {
      if (sealed.current) return;
      rememberOwnerPropertyDraft(draftId, values);
    },
    [],
  );

  const forget = React.useCallback(() => {
    sealed.current = true;
    forgetOwnerPropertyDraft();
    setAcknowledged(true);
  }, []);

  // 🔑 **Σταθερή ταυτότητα**, ώστε το αντικείμενο να μη γίνεται νέα εξάρτηση σε κάθε
  // απόδοση για όποιον το βάλει σε `useMemo`/`useEffect` παρακάτω.
  return React.useMemo(
    () => ({
      restored,
      noticeVisible: restored !== null && !acknowledged,
      acknowledge,
      remember,
      forget,
    }),
    [restored, acknowledged, acknowledge, remember, forget],
  );
}
