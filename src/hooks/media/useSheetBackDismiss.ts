'use client';

/**
 * @fileoverview **Το πίσω κουμπί κλείνει το φύλλο** — SPEC-777D §26.3, κανόνας 4.
 * @related ADR-777 §7 (Α3) · NN/g «Bottom Sheets» · lib/layout/bottom-sheet-stops
 * @module hooks/media/useSheetBackDismiss
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΟ ΑΝΟΙΓΜΕΝΟ ΦΥΛΛΟ **ΜΟΙΑΖΕΙ ΜΕ ΣΕΛΙΔΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας 4 δεν είναι ευγένεια: όταν το φύλλο καταλαμβάνει σχεδόν την οθόνη, ο άνθρωπος
 * το διαβάζει ως **σελίδα**, άρα το πίσω κουμπί του τηλεφώνου *πρέπει* να το κλείνει. Αν
 * αντ' αυτού τον βγάλει από την αναζήτηση, χάνει **ολόκληρο** το ερώτημα — και η **Α3**
 * δεσμεύεται ρητά ότι τα φίλτρα **επιμένουν**, γιατί το 75% των αποτυχιών ήταν ακριβώς εκεί.
 *
 * 🔑 **«Κλείνει» σημαίνει «επιστρέφει στη ματιά», ποτέ «εξαφανίζεται».** Ο λόγος είναι
 * γραμμένος στο `BOTTOM_SHEET_DISMISS_STOP`: η λίστα κουβαλά τη λογιστική.
 *
 * ⚠️ **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ NEXT ΔΙΑΤΗΡΕΙΤΑΙ, ΔΕΝ ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ.** Ο δρομολογητής του App
 * Router κρατά **δικά του** κλειδιά μέσα στο `history.state`. Ένα σκέτο
 * `pushState({ουρά: true})` θα τα **έσβηνε** — και η βλάβη δεν θα φαινόταν εδώ, αλλά στην
 * επόμενη πλοήγηση. Γι' αυτό η γραφή **δεν γίνεται εδώ**: την κάνει το
 * {@link pushHistoryMarker}, ο **ΕΝΑΣ** γραφέας του native History API, που απλώνει το
 * κλειδί μας **πάνω** στο υπάρχον `history.state` και αφήνει τη **διεύθυνση άθικτη**.
 * Και η διεύθυνση μένει άθικτη επίτηδες: η κατάσταση του φύλλου είναι **στιγμή
 * περιήγησης**, όχι ερώτημα — μια διεύθυνση που την κουβαλούσε θα κοινοποιούνταν και θα
 * «άνοιγε» το φύλλο σε **desktop**, όπου φύλλο δεν υπάρχει.
 *
 * 🔶 **Δηλωμένο όριο:** αν ο άνθρωπος φύγει από την οθόνη με το φύλλο ανοιχτό, η δική μας
 * καταχώριση μένει στην ουρά. **Δεν** την αφαιρούμε στην αποπροσάρτηση: ένα `history.back()`
 * τη στιγμή που ο δρομολογητής πλοηγεί θα **ακύρωνε την πλοήγηση του ανθρώπου** — δηλαδή
 * θα θεραπεύαμε μια σιωπηλή καταχώριση με μια **ορατή** βλάβη.
 */

import { useEffect, useRef } from 'react';

import { pushHistoryMarker } from '@/lib/url-query-state';

/** Το κλειδί μας μέσα στο `history.state` — **δίπλα** στα κλειδιά του Next, ποτέ αντί γι' αυτά. */
export const SHEET_HISTORY_KEY = '__resultsSheetExpanded';

interface SheetBackDismissOptions {
  /** `false` όταν δεν υπάρχει φύλλο (ευρεία οθόνη ή «μετράω ακόμη») — τότε δεν αγγίζεται η ουρά. */
  readonly active: boolean;
  /** `true` όταν το φύλλο έχει φύγει από τη στάση ηρεμίας. */
  readonly expanded: boolean;
  /** Επιστροφή στη στάση ηρεμίας. **Οφείλει να είναι ταυτοδύναμη** — καλείται και εις διπλούν. */
  readonly dismiss: () => void;
}

/**
 * Δένει το πίσω κουμπί με τη σύμπτυξη του φύλλου.
 *
 * 🔑 **Η ταυτοδυναμία είναι ο λόγος που δεν υπάρχει συνθήκη ανταγωνισμού.** Δύο δρόμοι
 * οδηγούν στη σύμπτυξη — το κουμπί και το `popstate` — και ο πρώτος καλεί τον δεύτερο
 * μέσω `history.back()`. Αν η `dismiss` δεν ήταν ταυτοδύναμη θα χρειαζόταν σημαία «ποιος
 * ξεκίνησε», δηλαδή ακριβώς το είδος κατάστασης που γεννά τις αναπηδήσεις.
 */
export function useSheetBackDismiss({ active, expanded, dismiss }: SheetBackDismissOptions): void {
  const ownsEntry = useRef(false);
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    if (!active) return;

    const onPopState = (): void => {
      if (!ownsEntry.current) return;
      ownsEntry.current = false;
      dismissRef.current();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [active]);

  useEffect(() => {
    if (!active) return;

    if (expanded && !ownsEntry.current) {
      pushHistoryMarker({ [SHEET_HISTORY_KEY]: true });
      ownsEntry.current = true;
      return;
    }

    // Σύμπτυξη από κουμπί: η καταχώρισή μας φεύγει από την ουρά, ώστε το επόμενο «πίσω»
    // να σημαίνει «πίσω από την αναζήτηση» — και όχι ένα πάτημα που δεν κάνει τίποτα.
    if (!expanded && ownsEntry.current) {
      ownsEntry.current = false;
      window.history.back();
    }
  }, [active, expanded]);
}
