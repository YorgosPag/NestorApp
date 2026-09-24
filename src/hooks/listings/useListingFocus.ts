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
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔗 ΔΥΟ ΔΟΧΕΙΑ ΓΙΑ ΤΟ `selected`, ΜΙΑ ΣΕΙΡΑ ΜΕΤΑΒΑΣΕΩΝ (ADR-777 §8.77)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | hook | πού ζει το `selected` | ποιος |
 * |---|---|---|
 * | `useUrlListingFocus` | **URL** (`?selected=`) — μοιράσιμο, επιβιώνει σε reload/πίσω | οθόνη 2 · χαρτοφυλάκιο |
 * | `useListingFocus` | React state | πάγκος δοκιμών |
 *
 * 🔑 **Ένα δοχείο τη φορά, ποτέ δύο συγχρονισμένα** (μάθημα ADR-332 D20.1: state + δικλείδα =
 * δύο αλήθειες που αποκλίνουν). Το URL γράφεται από το **υπάρχον** SSoT
 * `useSelectedEntityUrlState` (ADR-332 D21, `history.replaceState` ⇒ χωρίς πλοήγηση, χωρίς
 * remount, χωρίς εγγραφή στο ιστορικό ανά κλικ). Το `peeked` μένει **πάντα** σε state.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { isModalKeyboardScopeActive } from '@/lib/a11y/keyboard-scope';
import { useSelectedEntityUrlState } from '@/hooks/useSelectedEntityUrlState';

import {
  LISTING_SELECTED_PARAM,
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

/** Το επίμονο μισό της εστίασης: από πού διαβάζεται και πώς γράφεται. */
interface SelectedSource {
  readonly selected: string | null;
  readonly setSelected: (id: string | null) => void;
}

/** Η εστίαση με το `selected` στο **URL** — ο σύνδεσμος ανοίγει τον χάρτη με το ακίνητο επιλεγμένο. */
export function useUrlListingFocus(): ListingFocusController {
  const { selectedId, setSelectedId } = useSelectedEntityUrlState(LISTING_SELECTED_PARAM);
  return useFocusTransitions({ selected: selectedId, setSelected: setSelectedId });
}

/** Η εστίαση με το `selected` σε **state** — για επιφάνειες χωρίς δική τους διεύθυνση. */
export function useListingFocus(): ListingFocusController {
  const [selected, setSelected] = useState<string | null>(null);
  return useFocusTransitions({ selected, setSelected });
}

function useFocusTransitions({ selected, setSelected }: SelectedSource): ListingFocusController {
  const [peeked, setPeeked] = useState<string | null>(null);
  const focus = useMemo<ListingFocus>(() => ({ peeked, selected }), [peeked, selected]);

  const peek = useCallback((id: string | null) => setPeeked(id), []);

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
    setPeeked(null);
    setSelected(id);
  }, [setSelected]);

  const clear = useCallback(() => {
    setPeeked(null);
    setSelected(null);
  }, [setSelected]);

  useEscapeClearsFocus(focus, clear);

  return useMemo(() => ({ focus, peek, select, clear }), [focus, peek, select, clear]);
}

/**
 * **`Escape` ακυρώνει την επιλογή** — η έξοδος που κάθε επίμονη κατάσταση οφείλει.
 *
 * ⚠️ **Δεν δεσμεύεται όταν δεν υπάρχει τι να ακυρωθεί**: ένας μόνιμος ακροατής
 * `keydown` στο παράθυρο θα διεκδικούσε το `Escape` από κάθε διάλογο και μενού της
 * σελίδας (μάθημα ADR-364/ADR-711 — το `inert` **δεν** σταματά το `window keydown`).
 * Εδώ ο ακροατής **υπάρχει μόνο όσο υπάρχει εστίαση**.
 */
function useEscapeClearsFocus(focus: ListingFocus, clear: () => void): void {
  useEffect(() => {
    if (!hasListingFocus(focus)) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // 🔴 **ΕΝΑ Esc = ΕΝΑ ΠΛΑΙΣΙΟ** (ADR-777 §8.76): μια εσώτερη στρώση — π.χ. η λίστα
      //    διαλέγματος του χάρτη (`useEscapeKey`, `document` bubble) — το κατανάλωσε ήδη
      //    με `preventDefault()`. Ο `window` ακροατής τρέχει **μετά**, άρα ρωτά και σέβεται.
      if (event.defaultPrevented) return;

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
}
