'use client';

/**
 * ADR-739 Φ.Ε βήμα 5 — **roving tabindex** για οριζόντια γραμμή εργαλείων, κατά WAI-ARIA APG.
 *
 * ## Τι λύνει
 * Ένα `role="toolbar"` με δέκα κουμπιά και φυσιολογική σειρά `Tab` σημαίνει **δέκα** στάσεις
 * πριν ο χρήστης βγει από αυτό. Το APG ορίζει το αντίθετο: **μία** στάση για όλη τη γραμμή,
 * και τα `←` / `→` μετακινούν μέσα της.
 *
 * ## 🔴 Γιατί δεν αρκεί το `tabIndex` — το `.focus()` είναι υποχρεωτικό
 * Το roving tabindex είναι **δύο** πράγματα ταυτόχρονα: ποιο στοιχείο δέχεται `Tab` (το
 * γνώρισμα) και ποιο έχει **τώρα** την εστίαση (το DOM). Αλλάζοντας μόνο το γνώρισμα, το
 * `document.activeElement` μένει στο παλιό κουμπί: τα βέλη «δουλεύουν» στο React DevTools και
 * δεν κάνουν **τίποτα** στην οθόνη. Το ίδιο σχήμα ακολουθεί το μόνο υπάρχον roving του έργου
 * (`dxf-settings/settings/shared/accordion-group.tsx`), εκεί κάθετα.
 *
 * ## 🔴 Γιατί `preventDefault` + `stopPropagation` — και γιατί αυτό είναι η ΛΥΣΗ του §28.10.4
 * Το ADR-739 §28.10.4 προειδοποιούσε ότι αυτό θα είναι το **πρώτο** toolbar του έργου όπου το
 * `document.activeElement` είναι `<button>`, οπότε το `consumesDirectionalKeys`
 * (`lib/a11y/keyboard-scope.ts`) **δεν** θα θεωρήσει τα βέλη καταναλωμένα και θα περάσουν στις
 * καθολικές συντομεύσεις — δηλαδή το `→` θα μετακινούσε την **επιλεγμένη οντότητα** ενώ ο
 * χρήστης πλοηγείται σε κουμπιά.
 *
 * ⚠️ Η προφανής «διόρθωση» — να μπει το `'toolbar'` στα `ARROW_NAVIGATION_ROLES` — είναι
 * **νεκρή εγγραφή**: εκείνο το σύνολο ελέγχεται πάνω στον ρόλο του **ίδιου** του εστιασμένου
 * στοιχείου (χωρίς `closest()`, επίτηδες O(1)), και το εστιασμένο στοιχείο εδώ είναι το
 * `<button>`, όχι το `[role="toolbar"]`. Θα άλλαζε ένα υπάρχον test σε πράσινο χωρίς να
 * καλύπτει τίποτα. Η σωστή λύση είναι να **μη φτάσει** το συμβάν ως εκεί: σταματά στο ίδιο το
 * toolbar. Γι' αυτό το `keyboard-scope.ts` **δεν** ακουμπιέται από αυτή τη δουλειά.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/use-roving-toolbar
 */

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

/** Ό,τι πρέπει να απλωθεί σε **κάθε** κουμπί της γραμμής. */
export interface RovingItemProps {
  readonly ref: (node: HTMLButtonElement | null) => void;
  readonly tabIndex: 0 | -1;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly onFocus: () => void;
}

export interface RovingToolbar {
  /** Τα props του κουμπιού στη θέση `index`. */
  readonly itemProps: (index: number) => RovingItemProps;
}

/**
 * Οριζόντιο roving tabindex για `count` κουμπιά.
 *
 * Ο δείκτης **κυκλώνει** (`→` στο τελευταίο πάει στο πρώτο), όπως ορίζει το APG για toolbar:
 * σε μια γραμμή 8 εικονιδίων η κυκλική κίνηση είναι φθηνότερη από το να καταλάβει ο χρήστης
 * ότι έφτασε στο τέρμα.
 */
export function useRovingToolbar(count: number): RovingToolbar {
  const [activeIndex, setActiveIndex] = useState(0);
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);

  const focusAt = useCallback((index: number) => {
    setActiveIndex(index);
    nodes.current[index]?.focus();
  }, []);

  const itemProps = useCallback(
    (index: number): RovingItemProps => ({
      ref: (node) => {
        nodes.current[index] = node;
      },
      // Ο δείκτης μπορεί να δείχνει σε κουμπί που ξεμοντάρισε (αλλαγή άξονα ⇒ άλλα κουμπιά).
      // Χωρίς το `>= count`, η γραμμή θα έμενε **χωρίς καμία** στάση `Tab` — μη προσβάσιμη.
      tabIndex: index === Math.min(activeIndex, count - 1) ? 0 : -1,
      onFocus: () => setActiveIndex(index),
      onKeyDown: (event) => {
        const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        const target = delta !== 0
          ? (index + delta + count) % count
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : null;
        if (target === null) return;

        // Και τα δύο, με αυτή τη σειρά: το `preventDefault` σταματά την κύλιση της σελίδας,
        // το `stopPropagation` κρατά το βέλος μακριά από το Radix `role="menu"` (που έχει δικό
        // του roving) **και** από τις καθολικές συντομεύσεις του καμβά (δες την κεφαλίδα).
        event.preventDefault();
        event.stopPropagation();
        focusAt(target);
      },
    }),
    [activeIndex, count, focusAt],
  );

  return { itemProps };
}
