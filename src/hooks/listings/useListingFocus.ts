'use client';

/**
 * @fileoverview **Ο ΕΝΑΣ ιδιοκτήτης της εστίασης** της οθόνης 2 — και ο μόνος γραφέας της.
 * @related ADR-777 §7 (Α3) · lib/listings/listing-focus.ts · ADR-711 (Escape)
 * @module hooks/listings/useListingFocus
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ HOOK ΚΑΙ ΟΧΙ ΔΥΟ `useState` ΣΤΗΝ ΟΘΟΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι **μεταβάσεις** είναι το περιεχόμενο, όχι οι τιμές. Δύο ελεύθερα `useState` θα
 * άφηναν κάθε καλούντα να αποφασίσει μόνος του αν το κλικ σβήνει το `peeked` — και η
 * απάντηση θα απέκλινε από τον δεύτερο καλούντα, όπως αποκλίνει **πάντα**. Εδώ οι
 * μεταβάσεις είναι **τέσσερις, ονομασμένες**, και το «τι σβήνει τι» γράφεται μία φορά.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { isModalKeyboardScopeActive } from '@/lib/a11y/keyboard-scope';

import {
  NO_LISTING_FOCUS,
  hasListingFocus,
  type ListingFocus,
} from '@/lib/listings/listing-focus';

export interface ListingFocusController {
  readonly focus: ListingFocus;
  /** «Ο δείκτης είναι από πάνω» — ή `null` όταν φεύγει. **Ποτέ δεν αγγίζει την επιλογή.** */
  readonly peek: (id: string | null) => void;
  /** «Αυτό διάλεξα.» */
  readonly select: (id: string) => void;
  /** Ρητή ακύρωση — `Escape`, ή κλικ στον χάρτη έξω από κάθε σχήμα. */
  readonly clear: () => void;
}

export function useListingFocus(): ListingFocusController {
  const [focus, setFocus] = useState<ListingFocus>(NO_LISTING_FOCUS);

  const peek = useCallback((id: string | null) => {
    setFocus((current) => (current.peeked === id ? current : { ...current, peeked: id }));
  }, []);

  /**
   * 🔴 **ΤΟ ΚΛΙΚ ΣΒΗΝΕΙ ΤΟ `peeked`, ΚΑΙ ΕΙΝΑΙ ΑΠΑΙΤΗΣΗ ΑΦΗΣ.**
   *
   * Σε συσκευή αφής **δεν υπάρχει `mouseleave`**: το πάτημα παράγει συνθετικό
   * `mouseenter` που **δεν καθαρίζεται ποτέ**, οπότε το `peeked` θα κόλλαγε για πάντα
   * στο τελευταίο πατημένο σχήμα. Η γραμμή αυτή δεν είναι τακτοποίηση — είναι ο λόγος
   * που η επισήμανση δεν λερώνεται σε κινητό, όπου η Α3 δηλώνει ότι μπαίνουν **οι
   * περισσότεροι**.
   */
  const select = useCallback((id: string) => {
    setFocus({ peeked: null, selected: id });
  }, []);

  const clear = useCallback(() => setFocus(NO_LISTING_FOCUS), []);

  /**
   * **`Escape` ακυρώνει την επιλογή** — η έξοδος που κάθε επίμονη κατάσταση οφείλει.
   *
   * ⚠️ **Δεν δεσμεύεται όταν δεν υπάρχει τι να ακυρωθεί**: ένας μόνιμος ακροατής
   * `keydown` στο παράθυρο θα διεκδικούσε το `Escape` από κάθε διάλογο και μενού της
   * σελίδας (μάθημα ADR-364/ADR-711 — το `inert` **δεν** σταματά το `window keydown`).
   * Εδώ ο ακροατής **υπάρχει μόνο όσο υπάρχει εστίαση**.
   */
  useEffect(() => {
    if (!hasListingFocus(focus)) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;

      // 🔴 **ΤΟ MODAL ΕΧΕΙ ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΣΤΟ `Escape`, ΚΑΙ ΤΟ ΡΩΤΑΜΕ** (ADR-711).
      //    Χωρίς αυτή τη γραμμή, ένα `Escape` που ο άνθρωπος εννοούσε «κλείσε τον
      //    διάλογο» θα έσβηνε **και** την επιλογή του στον χάρτη — δύο πράξεις από ένα
      //    πάτημα, και η δεύτερη αόρατη πίσω από τον διάλογο.
      // ⚠️ Ο `escapeBus` (ADR-364) **δεν** είναι διαθέσιμος εδώ: ζει στο
      //    `subapps/dxf-viewer`, που είναι **εκτός** του root `tsconfig` — δομικά
      //    ανέφικτη εισαγωγή από την κύρια εφαρμογή. Το `keyboard-scope` είναι το
      //    framework-free SSoT που **και τα δύο** δέντρα εισάγουν.
      if (isModalKeyboardScopeActive()) return;

      clear();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focus, clear]);

  return useMemo(() => ({ focus, peek, select, clear }), [focus, peek, select, clear]);
}
